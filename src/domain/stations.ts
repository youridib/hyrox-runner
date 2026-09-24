import {
  STATIONS,
  type Division,
  type Sex,
  type Station,
  type StationBenchmark,
  type StationDose,
} from './types';

/**
 * Station benchmarks, population reference and weakness ranking.
 *
 * This is the 40% of race time the planner used to say nothing about. It does
 * not prescribe strength work - it measures the stations, ranks where the time
 * actually is, and hands that ranking to the compromised runs and the race
 * plan. Pure, like the rest of the domain.
 */

export interface StationReference {
  /** Mean finish time for the station, in seconds. */
  avg: number;
  /** 10th percentile (fast) and 90th percentile (slow), in seconds. */
  p10: number;
  p90: number;
}

/**
 * 12,479 finishers, average finish 1:25:27 (HyroxDataLab).
 *
 * Spread is the point of this table, not the average: wall balls, burpee
 * broad jumps and sled pull carry 4-5 minutes between P10 and P90, the ergs
 * carry about 1:15. That is why the ranking below works in seconds rather
 * than in percentages.
 */
export const STATION_REFERENCE: Record<Station, StationReference> = {
  ski: { avg: 272, p10: 235, p90: 314 },
  sledPush: { avg: 163, p10: 107, p90: 236 },
  sledPull: { avg: 293, p10: 198, p90: 416 },
  burpeeBroadJump: { avg: 274, p10: 158, p90: 421 },
  row: { avg: 289, p10: 252, p90: 330 },
  farmers: { avg: 123, p10: 90, p90: 165 },
  lunges: { avg: 283, p10: 193, p90: 396 },
  wallBalls: { avg: 359, p10: 229, p90: 544 },
};

/**
 * P25 is not published, so it is interpolated linearly between the published
 * P10 and P90: p25 = p10 + (0.15 / 0.80) * (p90 - p10).
 *
 * Station distributions are right-skewed, so this slightly over-estimates
 * P25 - the conservative direction for a number the athlete is chasing.
 */
export const stationP25 = (station: Station): number => {
  const ref = STATION_REFERENCE[station];
  return Math.round(ref.p10 + 0.1875 * (ref.p90 - ref.p10));
};

/** Roxzone: the top quartile spends 5:26 across 8 transitions, ~41 s each. */
export const TRANSITION_TARGET_SEC = 40;
export const TRANSITION_COUNT = 8;

/** A benchmark older than this is an estimate, not a measurement. */
export const BENCHMARK_STALE_DAYS = 42;

export interface StationGap {
  station: Station;
  /** The athlete's own time, or an estimate when untested. */
  seconds: number;
  /** Seconds between this time and the P25 target - the time available. */
  secondsAvailable: number;
  /** True when no benchmark exists and an estimate stood in. */
  estimated: boolean;
}

/** Where an untested station's number came from. */
export type EstimateSource = 'benchmark' | 'goal' | 'pace';

export interface StationEstimate {
  station: Station;
  seconds: number;
  source: EstimateSource;
}

/**
 * Mean run pace across the 12,479-finisher reference set: 44:24 of running
 * over 8 km. Used as the pivot for scaling stations to a runner's ability.
 */
export const REFERENCE_RUN_PACE_SEC = 333;

/**
 * How much running ability carries over to the stations.
 *
 * Not fully: VO2max and endurance volume correlate with finish time, but grip
 * strength and muscle mass do not, and wall balls transfer far less than the
 * ergs do. Half is the honest middle - a runner 10% faster than the reference
 * is assumed 5% faster at the stations, not 10%.
 */
export const PACE_TRANSFER = 0.5;

export interface EstimateInput {
  /** Flat target pace per kilometre, in seconds. */
  targetPaceSec: number;
  /** Goal finish in seconds, when the athlete has set one. */
  goalFinishSec?: number | null;
  benchmarks?: Partial<Record<Station, StationBenchmark>>;
  transitionSec?: number;
  runCount?: number;
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/**
 * The floor a goal-derived target cannot go below.
 *
 * The 10th percentile of the field is already a very fast station; a goal
 * that would demand faster than this from an untested station is a goal that
 * does not fit, and the honest answer is to say so rather than to print a
 * time nobody runs.
 */
const targetFloor = (station: Station): number => STATION_REFERENCE[station].p10;

/** Slack for the rounding of eight separate targets. */
const ROUNDING_TOLERANCE_SEC = 8;

export interface GoalTargets {
  /** Seconds the goal leaves for each station. */
  targets: Record<Station, number>;
  /** Total station budget the goal allows, after runs and roxzone. */
  budgetSec: number;
  /** What the plan actually adds up to: measured times plus targets. */
  requiredStationSec: number;
  /** Seconds the plan overruns the goal by; 0 when it fits. */
  overrunSec: number;
}

/**
 * What a goal finish leaves for each station.
 *
 * One rule, applied per station: *what the goal leaves for this station,
 * given every other station you have already measured*. For an untested
 * station that is its share of whatever is left after the measured ones are
 * paid for. For a measured one it is what the goal would have wanted there,
 * so your own time has something to be judged against.
 *
 * Shares come from the population averages: if wall balls are 17% of the
 * average station total, they get 17% of your budget.
 *
 * Targets are floored at the 10th percentile, so an unreachable goal shows up
 * as an overrun you can see rather than as times nobody runs.
 */
export function goalStationTargets(input: EstimateInput): GoalTargets | null {
  const goal = input.goalFinishSec;
  if (!goal || !Number.isFinite(goal)) return null;

  const benchmarks = input.benchmarks ?? {};
  const transitionSec = input.transitionSec ?? TRANSITION_TARGET_SEC;
  const runCount = input.runCount ?? 8;
  const targetPaceSec = Number.isFinite(input.targetPaceSec) ? Math.max(0, input.targetPaceSec) : 0;

  const measuredSeconds = (station: Station): number | null => {
    const mark = benchmarks[station];
    return mark && Number.isFinite(mark.seconds) ? Math.round(mark.seconds) : null;
  };

  const budgetSec = goal - targetPaceSec * runCount - transitionSec * TRANSITION_COUNT;

  const targets = {} as Record<Station, number>;
  for (const station of STATIONS) {
    // Everything else you have measured is already spent.
    const spentElsewhere = sum(
      STATIONS.filter((s) => s !== station).map((s) => measuredSeconds(s) ?? 0),
    );
    // The stations still sharing what is left: the untested ones, plus this
    // one when it is the station being asked about.
    const sharing = STATIONS.filter((s) => s === station || measuredSeconds(s) === null);
    const sharingAverage = sum(sharing.map((s) => STATION_REFERENCE[s].avg));
    const share = sharingAverage > 0 ? STATION_REFERENCE[station].avg / sharingAverage : 0;
    const remaining = budgetSec - spentElsewhere;
    targets[station] = Math.max(targetFloor(station), Math.round(remaining * share));
  }

  const requiredStationSec = sum(
    STATIONS.map((station) => measuredSeconds(station) ?? targets[station]),
  );

  // Eight rounded targets can land a second or two either side of the budget.
  // That is arithmetic, not a goal you are missing, so it is not reported.
  const overshoot = requiredStationSec - budgetSec;
  return {
    targets,
    budgetSec: Math.round(budgetSec),
    requiredStationSec,
    overrunSec: overshoot > ROUNDING_TOLERANCE_SEC ? Math.round(overshoot) : 0,
  };
}

/**
 * What each station should be expected to take, before it has been tested.
 *
 * A measured benchmark always wins. For the rest:
 *
 * - With a goal finish, the stations get whatever the goal leaves once the
 *   runs and the roxzone are paid for, split by each station's share of the
 *   population total. That turns a goal into eight numbers you can chase.
 * - Without one, the population averages are scaled to the athlete's own
 *   target pace, damped by `PACE_TRANSFER`.
 *
 * Either way every station has a number from the first day, so the weakness
 * ranking and the race plan mean something before any testing happens.
 */
export function estimateStations(input: EstimateInput): Record<Station, StationEstimate> {
  const benchmarks = input.benchmarks ?? {};
  const transitionSec = input.transitionSec ?? TRANSITION_TARGET_SEC;
  const runCount = input.runCount ?? 8;
  const targetPaceSec = Number.isFinite(input.targetPaceSec) ? input.targetPaceSec : 0;

  const measured = (station: Station): number | null => {
    const mark = benchmarks[station];
    return mark && Number.isFinite(mark.seconds) ? Math.round(mark.seconds) : null;
  };

  // What the goal leaves each station, or null when there is no goal.
  const goal = goalStationTargets({
    targetPaceSec,
    goalFinishSec: input.goalFinishSec,
    benchmarks,
    transitionSec,
    runCount,
  });

  // Ability scaling for the no-goal case.
  const ratio = targetPaceSec > 0 ? targetPaceSec / REFERENCE_RUN_PACE_SEC : 1;
  const scale = Math.min(1.6, Math.max(0.6, 1 + PACE_TRANSFER * (ratio - 1)));

  const out = {} as Record<Station, StationEstimate>;
  for (const station of STATIONS) {
    const own = measured(station);
    if (own !== null) {
      out[station] = { station, seconds: own, source: 'benchmark' };
      continue;
    }
    if (goal) {
      // An unreachable goal is not hidden: the target is floored and the
      // overrun is reported, rather than quietly reverting to the pace model.
      out[station] = { station, seconds: Math.max(30, goal.targets[station]), source: 'goal' };
      continue;
    }
    out[station] = {
      station,
      seconds: Math.max(30, Math.round(STATION_REFERENCE[station].avg * scale)),
      source: 'pace',
    };
  }
  return out;
}

/** Which source the untested stations are currently leaning on. */
export const estimateSource = (
  estimates: Record<Station, StationEstimate>,
): EstimateSource | null => {
  const untested = STATIONS.map((s) => estimates[s]).filter((e) => e.source !== 'benchmark');
  return untested.length === 0 ? null : (untested[0] as StationEstimate).source;
};

/**
 * Ranks stations by seconds available against the P25 target, worst first.
 *
 * Ranking in absolute seconds rather than percentage behind is the whole
 * point: it keeps the app pointed at wall balls (5:15 of spread) instead of
 * the SkiErg (1:19), which percentage-behind would flatter.
 */
export function rankWeaknesses(
  benchmarks: Partial<Record<Station, StationBenchmark>> = {},
  estimates?: Record<Station, StationEstimate>,
): StationGap[] {
  return STATIONS.map((station) => {
    const mark = benchmarks[station];
    const measured = mark && Number.isFinite(mark.seconds);
    // An untested station still gets a number - from the goal or the pace
    // when one was worked out, from the population average otherwise - so the
    // ranking is usable before any testing has happened.
    const seconds = measured
      ? (mark as StationBenchmark).seconds
      : (estimates?.[station].seconds ?? STATION_REFERENCE[station].avg);
    return {
      station,
      seconds: Math.round(seconds),
      secondsAvailable: Math.round(seconds - stationP25(station)),
      estimated: !measured,
    };
  }).sort(
    (a, b) =>
      b.secondsAvailable - a.secondsAvailable ||
      STATIONS.indexOf(a.station) - STATIONS.indexOf(b.station),
  );
}

/** Whether a benchmark is old enough to be treated as an estimate. */
export const isStale = (daysSinceTest: number): boolean => daysSinceTest > BENCHMARK_STALE_DAYS;

/* ------------------------------------------------------------------ */

interface Loads {
  push: number;
  pull: number;
  farmers: number;
  lunges: number;
  wallBall: number;
  wallBallHeight: number;
}

/**
 * Race-standard loads by division and sex, in kilograms.
 *
 * Distances are fixed across divisions; the loads are not. These follow the
 * published Open and Pro standards - worth checking against the rulebook for
 * your race, since HYROX has changed weights between seasons. Doubles carries
 * Open loads with the work shared between partners.
 */
const LOADS: Record<Division, Record<Sex, Loads>> = {
  open: {
    male: { push: 152, pull: 103, farmers: 24, lunges: 20, wallBall: 6, wallBallHeight: 3.0 },
    female: { push: 102, pull: 78, farmers: 16, lunges: 10, wallBall: 4, wallBallHeight: 2.7 },
  },
  pro: {
    male: { push: 202, pull: 153, farmers: 32, lunges: 30, wallBall: 9, wallBallHeight: 3.0 },
    female: { push: 152, pull: 103, farmers: 24, lunges: 20, wallBall: 6, wallBallHeight: 2.7 },
  },
  doubles: {
    male: { push: 152, pull: 103, farmers: 24, lunges: 20, wallBall: 6, wallBallHeight: 3.0 },
    female: { push: 102, pull: 78, farmers: 16, lunges: 10, wallBall: 4, wallBallHeight: 2.7 },
  },
};

/** The race-standard dose for one station, at this athlete's weights. */
export function stationDose(
  station: Station,
  division: Division = 'open',
  sex: Sex = 'male',
): StationDose {
  const load = LOADS[division][sex];
  switch (station) {
    case 'ski':
      return { station, meters: 1000 };
    case 'sledPush':
      return { station, meters: 50, weightKg: load.push };
    case 'sledPull':
      return { station, meters: 50, weightKg: load.pull };
    case 'burpeeBroadJump':
      return { station, meters: 80 };
    case 'row':
      return { station, meters: 1000 };
    case 'farmers':
      return { station, meters: 200, weightKg: load.farmers, perHand: true };
    case 'lunges':
      return { station, meters: 100, weightKg: load.lunges };
    case 'wallBalls':
      return { station, reps: 100, weightKg: load.wallBall, heightM: load.wallBallHeight };
  }
}

/** A fraction of the race-standard dose, rounded to something executable. */
export function scaleDose(dose: StationDose, fraction: number): StationDose {
  const f = Math.min(1, Math.max(0.1, fraction));
  const scaled: StationDose = { ...dose };
  if (dose.meters !== undefined) {
    scaled.meters = Math.max(10, Math.round((dose.meters * f) / 10) * 10);
  }
  if (dose.reps !== undefined) {
    scaled.reps = Math.max(5, Math.round((dose.reps * f) / 5) * 5);
  }
  return scaled;
}

/**
 * Picks the stations for one compromised-run block.
 *
 * Weighted toward the athlete's two worst benchmarks, rotated across the
 * other six so a whole block still rehearses all eight, and always emitted in
 * race order so the sequence transfers.
 */
export function chooseStations(
  count: number,
  weaknesses: readonly StationGap[],
  rotation: number,
): Station[] {
  const wanted = Math.min(STATIONS.length, Math.max(1, Math.round(count)));
  const ranked = weaknesses.length > 0 ? weaknesses : rankWeaknesses();
  const picked: Station[] = [];

  // The two worst stations are in every block - that is where the time is.
  for (const gap of ranked.slice(0, 2)) {
    if (picked.length < wanted && !picked.includes(gap.station)) picked.push(gap.station);
  }

  // The rest rotate, so the other six get rehearsed across the block.
  const others = ranked.map((w) => w.station).filter((s) => !picked.includes(s));
  const offset = Math.abs(Math.trunc(rotation));
  for (let i = 0; picked.length < wanted && i < others.length; i++) {
    const station = others[(offset + i) % others.length] as Station;
    if (!picked.includes(station)) picked.push(station);
  }

  return picked.sort((a, b) => STATIONS.indexOf(a) - STATIONS.indexOf(b));
}

/** A race-ordered block of station doses, scaled to the session's size. */
export function buildStationBlock(
  count: number,
  weaknesses: readonly StationGap[],
  rotation: number,
  fraction: number,
  division: Division = 'open',
  sex: Sex = 'male',
): StationDose[] {
  return chooseStations(count, weaknesses, rotation).map((station) =>
    scaleDose(stationDose(station, division, sex), fraction),
  );
}
