import { addDays, daysBetween, mondayOf } from '../domain/dates';
import type { Plan } from '../domain/plan';
import type { LogEntry } from '../state/schema';

/** Session types that count as a training session for completion stats. */
const COUNTED = new Set([
  'intervals', 'tempo', 'long', 'easy', 'compromised', 'timeTrial', 'hyrox', 'shakeout',
]);

export interface Stats {
  /** Sessions completed in the trailing window. */
  done: number;
  /** Sessions planned in the trailing window, up to and including today. */
  planned: number;
  /** Consecutive whole weeks, ending last week, with at least one session. */
  streakWeeks: number;
}

/**
 * Completion over the last 28 days and the current weekly streak.
 *
 * Only days up to today count toward `planned`, so an untrained future never
 * drags the number down, and the streak is measured in whole completed weeks
 * so the current partial week cannot break it.
 */
export function computeStats(plan: Plan, log: Record<string, LogEntry>, today: string): Stats {
  const windowStart = addDays(today, -27);

  let done = 0;
  let planned = 0;

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (daysBetween(windowStart, day.date) < 0) continue;
      if (daysBetween(day.date, today) < 0) continue;
      if (day.effectiveType === 'rest') continue;
      if (!COUNTED.has(day.effectiveType)) continue;
      planned++;
      if (log[day.date]?.done) done++;
    }
  }

  // Walk back week by week from the most recently completed week.
  let streakWeeks = 0;
  let cursor = addDays(mondayOf(today), -7);
  for (let guard = 0; guard < 104; guard++) {
    let any = false;
    for (let d = 0; d < 7; d++) {
      if (log[addDays(cursor, d)]?.done) {
        any = true;
        break;
      }
    }
    if (!any) break;
    streakWeeks++;
    cursor = addDays(cursor, -7);
  }

  return { done, planned, streakWeeks };
}
