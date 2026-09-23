import type { PhaseKey } from './types';

/**
 * Phase windows, expressed as an inclusive range of "days to race".
 * `start` is the far edge (most days out), `end` the near edge.
 * `base` is open-ended: it runs from 64 days out to however long the block is.
 */
export const PHASE_BOUNDS: Record<
  Exclude<PhaseKey, 'past'>,
  { start: number | null; end: number }
> = {
  taper: { start: 7, end: 1 },
  sharpen: { start: 21, end: 8 },
  racespec: { start: 42, end: 22 },
  build: { start: 63, end: 43 },
  base: { start: null, end: 64 },
};

export function getPhase(daysToRace: number): PhaseKey {
  if (daysToRace < 0) return 'past';
  if (daysToRace <= 7) return 'taper';
  if (daysToRace <= 21) return 'sharpen';
  if (daysToRace <= 42) return 'racespec';
  if (daysToRace <= 63) return 'build';
  return 'base';
}

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

/**
 * Deload weeks sit every 4th week counting back from race week, and never
 * inside the taper - race week is already a deload by another name.
 * Anchored to the week's Monday so the flag is constant across the week.
 */
export function computeIsDeload(mondayDaysToRace: number): boolean {
  if (mondayDaysToRace <= 7) return false;
  const weeksFromRace = Math.ceil(mondayDaysToRace / 7);
  return weeksFromRace >= 4 && weeksFromRace % 4 === 0;
}
