import type { PhaseKey } from './types';

/**
 * Phase windows, expressed as an inclusive range of "days to race".
 * `start` is the far edge (most days out), `end` the near edge.
 * `base` is open-ended: it runs from 71 days out to however long the block is.
 *
 * The taper is 14 days, not 7. The meta-analytic answer (Bosquet et al. 2007)
 * is 8-14 days with volume down 41-60%, intensity and frequency unchanged -
 * so the first taper week keeps all three quality sessions at shorter
 * durations, and only the final seven days take the fixed race-week shape.
 */
export const PHASE_BOUNDS: Record<
  Exclude<PhaseKey, 'past'>,
  { start: number | null; end: number }
> = {
  taper: { start: 14, end: 1 },
  sharpen: { start: 28, end: 15 },
  racespec: { start: 49, end: 29 },
  build: { start: 70, end: 50 },
  base: { start: null, end: 71 },
};

export function getPhase(daysToRace: number): PhaseKey {
  if (daysToRace < 0) return 'past';
  if (daysToRace <= 14) return 'taper';
  if (daysToRace <= 28) return 'sharpen';
  if (daysToRace <= 49) return 'racespec';
  if (daysToRace <= 70) return 'build';
  return 'base';
}

/** The final seven days: the fixed, non-negotiable race-week shape. */
export const RACE_WEEK_DAYS = 7;
export const isRaceWeekDay = (daysToRace: number): boolean =>
  daysToRace <= RACE_WEEK_DAYS;

/**
 * Which week of its phase a day falls in, counting forward (week 1 is the
 * first week of the phase, furthest from race day).
 *
 * `base` is open-ended, so its week number cannot be derived from
 * `daysToRace` alone - the caller must supply how many days the block spans,
 * which is what makes base progression work at all. Without `blockLengthDays`
 * every base week collapses to week 1.
 */
export function computeWeekInPhase(
  daysToRace: number,
  phase: PhaseKey,
  blockLengthDays?: number,
): { week: number; total: number | null } {
  if (phase === 'past') return { week: 1, total: null };

  const bounds = PHASE_BOUNDS[phase];

  if (bounds.start === null) {
    // Base phase. The block's first day is week 1; count forward from there.
    if (blockLengthDays === undefined || blockLengthDays <= bounds.end) {
      return { week: 1, total: null };
    }
    const totalWeeks = Math.ceil((blockLengthDays - bounds.end + 1) / 7);
    const daysIn = blockLengthDays - daysToRace;
    const week = Math.min(totalWeeks, Math.max(1, Math.floor(daysIn / 7) + 1));
    return { week, total: totalWeeks };
  }

  const totalDays = bounds.start - bounds.end + 1;
  const totalWeeks = Math.ceil(totalDays / 7);
  const daysIn = bounds.start - daysToRace;
  const week = Math.min(totalWeeks, Math.max(1, Math.floor(daysIn / 7) + 1));
  return { week, total: totalWeeks };
}

/** No deload inside the opening weeks of a block - there is nothing to shed. */
export const DELOAD_BLOCK_FLOOR_WEEKS = 3;

/**
 * Deload weeks sit every 4th week counting back from race week, and never
 * inside the taper - the taper is already a deload by another name.
 * Anchored to the week's Monday so the flag is constant across the week.
 *
 * Counting back from race day alone can land a deload in the second week of a
 * fresh block, so `blockWeekIndex` (0-based, from the block start) suppresses
 * deloads until the block has accumulated something worth absorbing.
 */
export function computeIsDeload(mondayDaysToRace: number, blockWeekIndex?: number): boolean {
  if (mondayDaysToRace <= PHASE_BOUNDS.taper.start!) return false;
  if (blockWeekIndex !== undefined && blockWeekIndex < DELOAD_BLOCK_FLOOR_WEEKS) return false;
  const weeksFromRace = Math.ceil(mondayDaysToRace / 7);
  return weeksFromRace >= 4 && weeksFromRace % 4 === 0;
}

/**
 * Exponential volume decay across the 14-day taper.
 *
 * `vol(d) = 0.8 * exp(-0.057 * daysIntoTaper)`, which lands taper week 1 at
 * roughly 65% of sharpen volume and taper week 2 at 40-45% - the 41-60% cut
 * Bosquet found, achieved by cutting session duration while intensity and
 * frequency stay where they were.
 */
export const TAPER_DECAY_K = 0.057;

export function taperVolumeMultiplier(daysToRace: number): number {
  const start = PHASE_BOUNDS.taper.start!;
  if (daysToRace > start) return 1;
  const daysIntoTaper = Math.max(0, start - Math.max(0, daysToRace));
  return Math.min(1, Math.max(0.35, 0.8 * Math.exp(-TAPER_DECAY_K * daysIntoTaper)));
}
