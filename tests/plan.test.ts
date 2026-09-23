import { describe, expect, it } from 'vitest';
import { MAX_BLOCK_WEEKS, buildPlan, findDay, findToday } from '../src/domain/plan';
import { addDays, dayOfWeek, daysBetween, mondayOf } from '../src/domain/dates';
import type { PlanConfig, SessionType } from '../src/domain/types';

const baseConfig = (over: Partial<PlanConfig> = {}): PlanConfig => ({
  raceDate: '2026-10-24', // a Saturday
  currentPaceSec: 300,
  weeklyTemplate: ['hyrox', null, 'hyrox', null, null, 'hyrox', null],
  overrides: {},
  heaviestDay: null,
  ...over,
});

describe('buildPlan structure', () => {
  it('produces contiguous Mondays with seven days each', () => {
    const plan = buildPlan(baseConfig(), '2026-07-01');
    expect(plan.weeks.length).toBeGreaterThan(10);
    plan.weeks.forEach((week, i) => {
      expect(dayOfWeek(week.monday)).toBe(0);
      expect(week.days).toHaveLength(7);
      week.days.forEach((day, d) => {
        expect(day.date).toBe(addDays(week.monday, d));
        expect(day.dayOfWeek).toBe(d);
      });
      if (i > 0) expect(daysBetween(plan.weeks[i - 1]!.monday, week.monday)).toBe(7);
    });
  });

  it('runs from the block start through race week inclusive', () => {
    const plan = buildPlan(baseConfig(), '2026-07-01', { blockStart: '2026-06-29' });
    expect(plan.weeks[0]!.monday).toBe('2026-06-29');
    expect(plan.weeks.at(-1)!.monday).toBe(mondayOf('2026-10-24'));
    expect(plan.weeks.at(-1)!.containsRaceDay).toBe(true);
  });

  it('contains exactly one race day across the whole block', () => {
    const plan = buildPlan(baseConfig(), '2026-07-01');
    const raceDays = plan.weeks.flatMap((w) => w.days).filter((d) => d.isRaceDay);
    expect(raceDays).toHaveLength(1);
    expect(raceDays[0]!.date).toBe('2026-10-24');
    expect(raceDays[0]!.effectiveType).toBe('race');
    expect(raceDays[0]!.session.variant).toBe('race');
  });

  it('points currentWeekIndex at the week containing today', () => {
    const plan = buildPlan(baseConfig(), '2026-07-15');
    const week = plan.weeks[plan.currentWeekIndex]!;
    expect(week.days.some((d) => d.date === '2026-07-15')).toBe(true);
    expect(findToday(plan)!.date).toBe('2026-07-15');
  });

  it('gives every day a session with a colour and a variant', () => {
    const plan = buildPlan(baseConfig(), '2026-06-01');
    for (const week of plan.weeks) {
      for (const day of week.days) {
        expect(day.session.variant, day.date).toBeTruthy();
        expect(day.session.color, day.date).toBeTruthy();
        expect(day.effectiveType, day.date).toBeTruthy();
      }
    }
  });
});

describe('overrides versus the weekly template', () => {
  it('applies an override to its own date and to no other', () => {
    const config = baseConfig({ overrides: { '2026-07-08': 'rest' } });
    const plan = buildPlan(config, '2026-07-06');
    expect(findDay(plan, '2026-07-08')!.effectiveType).toBe('rest');
    // The same weekday a week later is untouched - this is the bug the
    // original had, where a pin silently applied to every week forever.
    expect(findDay(plan, '2026-07-15')!.effectiveType).not.toBe('rest');
  });

  it('marks the source of each day so the UI can show why', () => {
    const config = baseConfig({ overrides: { '2026-07-08': 'rest' } });
    const plan = buildPlan(config, '2026-07-06');
    const overridden = findDay(plan, '2026-07-08')!;
    expect(overridden.overrideType).toBe('rest');

    const templated = findDay(plan, '2026-07-06')!; // Monday, template says hyrox
    expect(templated.templateType).toBe('hyrox');
    expect(templated.overrideType).toBeNull();
  });

  it('lets the weekly template repeat across every week', () => {
    const plan = buildPlan(baseConfig(), '2026-07-01');
    for (const week of plan.weeks) {
      if (week.containsRaceDay) continue; // race week overrides the template
      expect(week.days[0]!.effectiveType, week.monday).toBe('hyrox');
      expect(week.days[2]!.effectiveType, week.monday).toBe('hyrox');
    }
  });

  it('gives an override precedence over the template on the same date', () => {
    const config = baseConfig({ overrides: { '2026-07-06': 'tempo' } });
    const plan = buildPlan(config, '2026-07-06');
    expect(findDay(plan, '2026-07-06')!.effectiveType).toBe('tempo');
  });
});

describe('deload weeks across a block', () => {
  it('flags whole weeks, never individual days', () => {
    const plan = buildPlan(baseConfig(), '2026-06-01');
    for (const week of plan.weeks) {
      if (week.containsRaceDay || week.phase === 'taper') continue;
      const flags = new Set(week.days.map((d) => d.isDeload));
      expect(flags.size, week.monday).toBe(1);
      expect([...flags][0]).toBe(week.isDeload);
    }
  });

  it('never marks race week as a deload', () => {
    const plan = buildPlan(baseConfig(), '2026-06-01');
    const raceWeek = plan.weeks.find((w) => w.containsRaceDay)!;
    expect(raceWeek.days.every((d) => !d.isDeload)).toBe(true);
  });

  it('spaces deload weeks four apart', () => {
    const plan = buildPlan(baseConfig(), '2026-04-01', { blockStart: '2026-03-30' });
    const deloadIdx = plan.weeks.filter((w) => w.isDeload).map((w) => w.index);
    expect(deloadIdx.length).toBeGreaterThan(2);
    for (let i = 1; i < deloadIdx.length; i++) {
      expect(deloadIdx[i]! - deloadIdx[i - 1]!).toBe(4);
    }
  });
});

describe('race week is inviolable', () => {
  it('rests the day before and never schedules hard work in the last two days', () => {
    const plan = buildPlan(baseConfig(), '2026-10-19');
    const raceWeek = plan.weeks.find((w) => w.containsRaceDay)!;
    const dayBefore = raceWeek.days.find((d) => d.daysToRace === 1)!;
    const twoOut = raceWeek.days.find((d) => d.daysToRace === 2)!;
    expect(dayBefore.effectiveType).toBe('rest');
    expect(dayBefore.session.variant).toBe('restEve');
    expect(twoOut.session.variant).toBe('shakeoutEve');
  });

  it('holds for a race on any weekday', () => {
    for (let offset = 0; offset < 7; offset++) {
      const raceDate = addDays('2026-10-19', offset);
      const plan = buildPlan(baseConfig({ raceDate }), addDays(raceDate, -5));
      const raceWeek = plan.weeks.find((w) => w.containsRaceDay)!;
      const dayBefore = raceWeek.days.find((d) => d.daysToRace === 1);
      if (dayBefore) expect(dayBefore.effectiveType, raceDate).toBe('rest');
      expect(raceWeek.days.filter((d) => d.isRaceDay), raceDate).toHaveLength(1);
    }
  });

  it('ignores the recurring template in race week', () => {
    // 'I usually lift on Saturdays' must not put a Hyrox session on race eve.
    const config = baseConfig({
      raceDate: '2026-10-25', // Sunday, so Saturday is race eve
      weeklyTemplate: ['hyrox', null, 'hyrox', null, null, 'hyrox', null],
    });
    const plan = buildPlan(config, '2026-10-20');
    expect(findDay(plan, '2026-10-24')!.effectiveType).toBe('rest');
  });

  it('still honours an explicit per-date override in race week', () => {
    const config = baseConfig({
      raceDate: '2026-10-25',
      overrides: { '2026-10-22': 'hyrox' },
    });
    const plan = buildPlan(config, '2026-10-20');
    expect(findDay(plan, '2026-10-22')!.effectiveType).toBe('hyrox');
  });

  it('overrides even a template that asks for a hard session on race day', () => {
    const config = baseConfig({
      raceDate: '2026-10-24',
      weeklyTemplate: ['hyrox', null, 'hyrox', null, null, 'intervals', null],
    });
    const plan = buildPlan(config, '2026-10-19');
    expect(findDay(plan, '2026-10-24')!.effectiveType).toBe('race');
  });
});

describe('robustness', () => {
  it('rejects an invalid race date loudly rather than rendering nonsense', () => {
    expect(() => buildPlan(baseConfig({ raceDate: 'garbage' }), '2026-01-01')).toThrow(RangeError);
    expect(() => buildPlan(baseConfig(), 'garbage')).toThrow(RangeError);
  });

  it('still produces a usable week when the race has already passed', () => {
    const plan = buildPlan(baseConfig({ raceDate: '2026-01-10' }), '2026-03-01');
    expect(plan.daysToRace).toBeLessThan(0);
    expect(plan.phase).toBe('past');
    expect(plan.weeks.length).toBeGreaterThanOrEqual(1);
    expect(findToday(plan)).toBeDefined();
  });

  it('handles a race today', () => {
    const plan = buildPlan(baseConfig({ raceDate: '2026-07-15' }), '2026-07-15');
    expect(plan.daysToRace).toBe(0);
    expect(findToday(plan)!.effectiveType).toBe('race');
  });

  it('handles a race tomorrow', () => {
    const plan = buildPlan(baseConfig({ raceDate: '2026-07-16' }), '2026-07-15');
    expect(findToday(plan)!.effectiveType).toBe('rest');
  });

  it('caps absurdly distant race dates instead of looping forever', () => {
    const plan = buildPlan(baseConfig({ raceDate: '2099-01-01' }), '2026-01-01');
    expect(plan.weeks.length).toBe(MAX_BLOCK_WEEKS);
  });

  it('clamps a block start that is after today', () => {
    const plan = buildPlan(baseConfig(), '2026-07-01', { blockStart: '2026-09-01' });
    expect(daysBetween(plan.blockStart, mondayOf('2026-07-01'))).toBeGreaterThanOrEqual(0);
    expect(findToday(plan)).toBeDefined();
  });

  it('ignores an invalid block start', () => {
    const plan = buildPlan(baseConfig(), '2026-07-01', { blockStart: 'not-a-date' });
    expect(plan.blockStart).toBe(mondayOf('2026-07-01'));
  });

  it('is pure: the same inputs give the same plan', () => {
    const config = baseConfig();
    const a = buildPlan(config, '2026-07-01');
    const b = buildPlan(config, '2026-07-01');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not mutate the config it is given', () => {
    const config = baseConfig({ overrides: { '2026-07-08': 'rest' } });
    const snapshot = JSON.stringify(config);
    buildPlan(config, '2026-07-01');
    expect(JSON.stringify(config)).toBe(snapshot);
  });

  it('survives a fully-pinned template without dropping a day', () => {
    const full: SessionType[] = ['hyrox', 'tempo', 'rest', 'intervals', 'rest', 'long', 'shakeout'];
    const plan = buildPlan(baseConfig({ weeklyTemplate: full }), '2026-07-01');
    for (const week of plan.weeks) expect(week.days).toHaveLength(7);
  });
});
