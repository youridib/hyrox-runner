import type { PhaseKey, SessionType } from './types';

/** Sessions that carry real neuromuscular cost and must be spaced apart. */
export const HARD_TYPES: readonly SessionType[] = ['intervals', 'tempo', 'compromised'];

const isHard = (t: SessionType | null): boolean =>
  t !== null && HARD_TYPES.includes(t);

/**
 * Scoring weights. Named so the trade-offs are legible and a test can assert
 * the ordering between them rather than re-deriving magic numbers.
 */
export const WEIGHTS = {
  /** Two hard sessions on the same day: effectively forbidden. */
  hardSameDay: -1000,
  /** Back-to-back hard days. */
  hardAdjacent: -50,
  /** Reward for hard sessions three or more days apart. */
  hardWellSpaced: 2,
  /** A hard session the day after the heaviest Hyrox day. */
  hardAfterHeaviest: -15,
  /** Any hard session adjacent to any Hyrox day. */
  hardNearHyrox: -3,
  /** Any easy session adjacent to a Hyrox day - barely matters. */
  easyNearHyrox: -0.5,
  /** Nudges intervals earlier in the week, when legs are freshest. */
  intervalsEarly: -0.3,
  /** Nudges long/compromised later in the week, when there is time. */
  enduranceLate: 0.4,
} as const;

/** Circular distance between two weekdays, 0-3. */
export const circularDist = (a: number, b: number): number => {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
};

export function scorePlacement(
  placement: Record<number, SessionType>,
  hyroxDays: number[],
  heaviestDay: number | null,
): number {
  let score = 0;
  const entries = Object.entries(placement).map(
    ([d, t]) => [Number(d), t] as [number, SessionType],
  );
  const hardDays = entries.filter(([, t]) => isHard(t)).map(([d]) => d);

  for (const [day, type] of entries) {
    const hard = isHard(type);

    if (hard) {
      for (const other of hardDays) {
        if (other === day) continue;
        const dist = circularDist(day, other);
        if (dist === 0) score += WEIGHTS.hardSameDay;
        else if (dist === 1) score += WEIGHTS.hardAdjacent;
        else if (dist >= 3) score += WEIGHTS.hardWellSpaced;
      }
    }

    for (const hyroxDay of hyroxDays) {
      if (circularDist(day, hyroxDay) !== 1) continue;
      const isDayAfter = (hyroxDay + 1) % 7 === day;
      if (isDayAfter && heaviestDay !== null && heaviestDay === hyroxDay) {
        score += WEIGHTS.hardAfterHeaviest;
      } else if (hard) {
        score += WEIGHTS.hardNearHyrox;
      } else {
        score += WEIGHTS.easyNearHyrox;
      }
    }

    if (type === 'intervals') score += day * WEIGHTS.intervalsEarly;
    else if (type === 'long' || type === 'compromised') score += day * WEIGHTS.enduranceLate;
  }

  return score;
}

/**
 * Counts pairs of hard sessions sitting on adjacent days.
 *
 * Used as a feasibility check rather than a score: some weeks genuinely
 * cannot hold three quality sessions - four free days in a row can hold two
 * at most - and in those weeks the right answer is to train less, not to
 * stack hard days back to back.
 */
export function countAdjacentHardPairs(placement: Record<number, SessionType>): number {
  const days = Object.entries(placement)
    .filter(([, t]) => isHard(t))
    .map(([d]) => Number(d));
  let pairs = 0;
  for (let i = 0; i < days.length; i++) {
    for (let j = i + 1; j < days.length; j++) {
      if (circularDist(days[i] as number, days[j] as number) <= 1) pairs++;
    }
  }
  return pairs;
}

function* permutations<T>(arr: readonly T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest, k - 1)) yield [arr[i] as T, ...p];
  }
}

/**
 * Fills the unpinned days of a normal (non-race) week.
 *
 * The week wants up to three quality sessions - intervals, tempo, and either
 * a long run or, once the block turns race-specific, a compromised run. What
 * the user already pinned counts toward that budget; whatever is missing gets
 * placed in the free slots by exhaustive search over the scoring function.
 */
export function autoFillNormal(
  pinned: readonly (SessionType | null)[],
  phase: PhaseKey,
  heaviestDay: number | null,
): SessionType[] {
  const result: (SessionType | null)[] = [...pinned];
  const autoIdx: number[] = [];
  const hyroxDays: number[] = [];
  const pinnedAssignments: Record<number, SessionType> = {};
  const pinnedTypes = new Set<SessionType>();

  for (let d = 0; d < 7; d++) {
    const t = result[d] ?? null;
    if (t === null) {
      autoIdx.push(d);
    } else {
      pinnedTypes.add(t);
      pinnedAssignments[d] = t;
      if (t === 'hyrox') hyroxDays.push(d);
    }
  }

  if (autoIdx.length === 0) return result as SessionType[];

  const isRaceSpecific = phase === 'racespec' || phase === 'sharpen';
  const enduranceType: SessionType = isRaceSpecific ? 'compromised' : 'long';
  const hasEndurancePinned = pinnedTypes.has('long') || pinnedTypes.has('compromised');

  const pinnedQualityCount =
    HARD_TYPES.filter((t) => pinnedTypes.has(t)).length + (hasEndurancePinned ? 1 : 0);
  const budget = autoIdx.length + pinnedQualityCount;

  // Ordered by how much each session matters, most important first, because
  // this is also the order they get dropped in when the week cannot hold them.
  let desired: SessionType[];
  if (budget <= 0) desired = [];
  else if (budget === 1) desired = [isRaceSpecific ? 'intervals' : 'tempo'];
  else if (budget === 2) desired = ['intervals', enduranceType];
  else desired = ['intervals', enduranceType, 'tempo'];

  const needed = desired.filter((t) => {
    if (pinnedTypes.has(t)) return false;
    if ((t === 'long' || t === 'compromised') && hasEndurancePinned) return false;
    return true;
  });

  const wanted = needed.slice(0, autoIdx.length);

  // Adjacency the user created by pinning; the planner may not make it worse.
  const baselineViolations = countAdjacentHardPairs(pinnedAssignments);

  const searchBest = (
    toPlace: SessionType[],
  ): { combo: number[]; placement: Record<number, SessionType> } | null => {
    let bestScore = -Infinity;
    let best: { combo: number[]; placement: Record<number, SessionType> } | null = null;
    for (const combo of permutations(autoIdx, toPlace.length)) {
      const placement: Record<number, SessionType> = { ...pinnedAssignments };
      for (let i = 0; i < toPlace.length; i++) {
        placement[combo[i] as number] = toPlace[i] as SessionType;
      }
      const s = scorePlacement(placement, hyroxDays, heaviestDay);
      if (s > bestScore) {
        bestScore = s;
        best = { combo, placement };
      }
    }
    return best;
  };

  // Try the full set first, then drop the least important session and retry,
  // until the week can hold what is left without stacking hard days.
  for (let count = wanted.length; count >= 1; count--) {
    const toPlace = wanted.slice(0, count);
    const best = searchBest(toPlace);
    if (!best) continue;
    if (countAdjacentHardPairs(best.placement) > baselineViolations) continue;
    for (let i = 0; i < toPlace.length; i++) {
      result[best.combo[i] as number] = toPlace[i] as SessionType;
    }
    break;
  }

  for (const d of autoIdx) if (result[d] === null) result[d] = 'shakeout';
  return result as SessionType[];
}

/**
 * Race week. Nothing here is negotiable: the day before the race is rest, two
 * days out is a shakeout, three days out is the one short sharpener, and
 * everything else is easy. Days past the race fall back to shakeout.
 */
export function autoFillTaper(
  pinned: readonly (SessionType | null)[],
  daysToRacePerDay: readonly number[],
): SessionType[] {
  const result: (SessionType | null)[] = [...pinned];
  for (let d = 0; d < 7; d++) {
    if (result[d] !== null && result[d] !== undefined) continue;
    const dtr = daysToRacePerDay[d] as number;
    if (dtr < 0) result[d] = 'shakeout';
    else if (dtr === 0) result[d] = 'rest'; // overridden by isRaceDay downstream
    else if (dtr === 1) result[d] = 'rest';
    else if (dtr === 2) result[d] = 'shakeout';
    else if (dtr === 3) result[d] = 'intervals';
    else result[d] = 'shakeout';
  }
  return result as SessionType[];
}

export function fillWeek(
  pinned: readonly (SessionType | null)[],
  phase: PhaseKey,
  heaviestDay: number | null,
  daysToRacePerDay: readonly number[],
): SessionType[] {
  if (phase === 'taper') return autoFillTaper(pinned, daysToRacePerDay);
  return autoFillNormal(pinned, phase, heaviestDay);
}
