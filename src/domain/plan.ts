import {
  addDays,
  dayOfWeek,
  daysBetween,
  isValidISO,
  mondayOf,
} from './dates';
import { computeIsDeload, computeWeekInPhase, getPhase } from './phases';
import { getSessionSpec } from './progression';
import { fillWeek } from './scheduler';
import { computeZones } from './zones';
import type {
  EffectiveType,
  PhaseKey,
  PlanConfig,
  PlannedDay,
  PlannedWeek,
  SessionType,
  Zones,
} from './types';

/** A block longer than this is almost certainly a mistyped race date. */
export const MAX_BLOCK_WEEKS = 104;

export interface Plan {
  today: string;
  raceDate: string;
  daysToRace: number;
  phase: PhaseKey;
  zones: Zones;
  weeks: PlannedWeek[];
  /** Index into `weeks` for the week containing today, or -1 if outside. */
  currentWeekIndex: number;
  blockStart: string;
  blockLengthDays: number;
}

export interface BuildPlanOptions {
  /** Monday the block is counted from. Defaults to the Monday of today. */
  blockStart?: string;
}

/**
 * Builds the whole training block, week by week, keyed to real calendar dates.
 *
 * Building the block rather than just "this week" is what makes progression
 * well-defined: a day's week-in-phase is its position in the block, not a
 * value reverse-engineered from how far away the race happens to be. It also
 * means base-phase progression exists at all, since base is open-ended and
 * only the block length says how long it runs.
 */
export function buildPlan(
  config: PlanConfig,
  todayISO: string,
  options: BuildPlanOptions = {},
): Plan {
  if (!isValidISO(todayISO)) throw new RangeError(`Invalid today: ${todayISO}`);
  if (!isValidISO(config.raceDate)) throw new RangeError(`Invalid raceDate: ${config.raceDate}`);

  const zones = computeZones(config.currentPaceSec);
  const daysToRace = daysBetween(todayISO, config.raceDate);
  const phase = getPhase(daysToRace);

  const todayMonday = mondayOf(todayISO);
  const raceMonday = mondayOf(config.raceDate);

  // The block starts at the requested Monday, but never after today's week and
  // never after race week - a block that ends before it begins has no weeks.
  let blockStart = options.blockStart && isValidISO(options.blockStart)
    ? mondayOf(options.blockStart)
    : todayMonday;
  if (daysBetween(blockStart, todayMonday) < 0) blockStart = todayMonday;
  if (daysBetween(blockStart, raceMonday) < 0) blockStart = raceMonday;

  const lastMonday = daysBetween(raceMonday, todayMonday) > 0 ? todayMonday : raceMonday;
  const spanWeeks = Math.floor(daysBetween(blockStart, lastMonday) / 7) + 1;
  const weekCount = Math.min(MAX_BLOCK_WEEKS, Math.max(1, spanWeeks));

  const blockLengthDays = daysBetween(blockStart, config.raceDate);

  const weeks: PlannedWeek[] = [];
  let currentWeekIndex = -1;

  for (let w = 0; w < weekCount; w++) {
    const monday = addDays(blockStart, w * 7);
    const mondayDtr = daysBetween(monday, config.raceDate);
    const weekPhase = getPhase(mondayDtr);
    const isDeloadWeek = computeIsDeload(mondayDtr);

    const dates: string[] = [];
    const dtrPerDay: number[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(monday, d);
      dates.push(date);
      dtrPerDay.push(daysBetween(date, config.raceDate));
    }

    // An override beats the recurring template, and only for its own date.
    //
    // In race week the recurring template is ignored entirely: "I usually lift
    // on Saturdays" is not a decision to lift the day before a race. Only an
    // explicit override for that exact date still stands, because that is the
    // user deliberately choosing something for race week itself.
    const pinned: (SessionType | null)[] = dates.map((date, d) => {
      const override = config.overrides[date];
      if (override) return override;
      if (weekPhase === 'taper') return null;
      return config.weeklyTemplate[d] ?? null;
    });

    const filled = fillWeek(pinned, weekPhase, config.heaviestDay, dtrPerDay);

    const days: PlannedDay[] = [];
    let containsRaceDay = false;

    for (let d = 0; d < 7; d++) {
      const date = dates[d] as string;
      const dtr = dtrPerDay[d] as number;
      const isRaceDay = dtr === 0;
      if (isRaceDay) containsRaceDay = true;

      const dayPhase = getPhase(dtr);
      const { week: weekInPhase, total } = computeWeekInPhase(dtr, dayPhase, blockLengthDays);

      // Race day is its own thing, and race week is already a deload.
      const isDeload = isDeloadWeek && !isRaceDay && dayPhase !== 'taper';
      const effectiveType: EffectiveType = isRaceDay ? 'race' : (filled[d] as SessionType);

      days.push({
        date,
        dayOfWeek: d,
        daysToRace: dtr,
        isRaceDay,
        phase: dayPhase,
        weekInPhase,
        weekInPhaseTotal: total,
        isDeload,
        effectiveType,
        overrideType: config.overrides[date] ?? null,
        templateType: config.weeklyTemplate[d] ?? null,
        session: getSessionSpec(
          effectiveType,
          zones,
          { phase: dayPhase, weekInPhase, isDeload, daysToRace: dtr },
          isRaceDay,
        ),
      });
    }

    const mondayWeekCtx = computeWeekInPhase(mondayDtr, weekPhase, blockLengthDays);

    if (daysBetween(monday, todayMonday) === 0) currentWeekIndex = w;

    weeks.push({
      monday,
      index: w,
      phase: weekPhase,
      weekInPhase: mondayWeekCtx.week,
      weekInPhaseTotal: mondayWeekCtx.total,
      isDeload: isDeloadWeek,
      containsRaceDay,
      days,
    });
  }

  return {
    today: todayISO,
    raceDate: config.raceDate,
    daysToRace,
    phase,
    zones,
    weeks,
    currentWeekIndex,
    blockStart,
    blockLengthDays,
  };
}

/** Convenience: the day entry for a given ISO date, if the block covers it. */
export function findDay(plan: Plan, date: string): PlannedDay | undefined {
  for (const week of plan.weeks) {
    for (const day of week.days) if (day.date === date) return day;
  }
  return undefined;
}

/** Convenience: today's planned day. */
export function findToday(plan: Plan): PlannedDay | undefined {
  return findDay(plan, plan.today);
}

export { dayOfWeek };
