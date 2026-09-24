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
  /** The athlete's own time, or the population average when untested. */
  seconds: number;
  /** Seconds between this time and the P25 target - the time available. */
  secondsAvailable: number;
  /** True when no benchmark exists and the population average stood in. */
  estimated: boolean;
}

/**
 * Ranks stations by seconds available against the P25 target, worst first.
 *
 * Ranking in absolute seconds rather than percentage behind is the whole
 * point: it keeps the app pointed at wall balls (5:15 of spread) instead of
 * the SkiErg (1:19), which percentage-behind would flatter.
 */
export function rankWeaknesses(
  benchmarks: Partial<Record<Station, StationBenchmark>> = {},
): StationGap[] {
  return STATIONS.map((station) => {
    const mark = benchmarks[station];
    const seconds = mark && Number.isFinite(mark.seconds) ? mark.seconds : STATION_REFERENCE[station].avg;
    return {
      station,
      seconds,
      secondsAvailable: Math.round(seconds - stationP25(station)),
      estimated: !mark,
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
