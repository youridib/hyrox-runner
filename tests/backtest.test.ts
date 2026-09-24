import { describe, expect, it } from 'vitest';
import { buildPlan } from '../src/domain/plan';
import { addDays, daysBetween, todayISO } from '../src/domain/dates';
import { HARD_TYPES, circularDist } from '../src/domain/scheduler';
import { getDict, renderSession } from '../src/i18n';
import { migrate } from '../src/state/schema';
import type { PlanConfig, SessionType } from '../src/domain/types';

/**
 * Backtests: rather than asserting one plan, these walk whole blocks day by
 * day and assert the invariants that must hold at every point. They are the
 * check that the planner stays coherent as the block advances, which is the
 * failure mode a single snapshot test cannot catch.
 */

const TEMPLATES: Array<{ name: string; template: (SessionType | null)[]; heaviest: number | null }> = [
  { name: '3x Hyrox Mon/Wed/Sat', template: ['hyrox', null, 'hyrox', null, null, 'hyrox', null], heaviest: null },
  { name: '3x Hyrox with heaviest Monday', template: ['hyrox', null, 'hyrox', null, null, 'hyrox', null], heaviest: 0 },
  { name: '2x Hyrox Tue/Thu', template: [null, 'hyrox', null, 'hyrox', null, null, null], heaviest: 1 },
  { name: '4x Hyrox', template: ['hyrox', null, 'hyrox', null, 'hyrox', 'hyrox', null], heaviest: 4 },
  { name: 'no Hyrox at all', template: [null, null, null, null, null, null, null], heaviest: null },
  { name: 'Sunday rest pinned', template: ['hyrox', null, 'hyrox', null, null, 'hyrox', 'rest'], heaviest: null },
  { name: 'back-to-back Hyrox', template: ['hyrox', 'hyrox', null, null, null, null, null], heaviest: 0 },
];

/** Races across a year, deliberately including DST weeks and a leap year. */
const RACE_DATES = [
  '2026-01-17',
  '2026-03-28', // the weekend the clocks go forward
  '2026-05-09',
  '2026-06-20',
  '2026-08-15',
  '2026-10-24', // the weekend the clocks go back
  '2026-12-05',
  '2024-02-29', // leap day
];

const config = (raceDate: string, i: number): PlanConfig => ({
  raceDate,
  currentPaceSec: 240 + (i % 5) * 30,
  weeklyTemplate: TEMPLATES[i % TEMPLATES.length]!.template,
  overrides: {},
  heaviestDay: TEMPLATES[i % TEMPLATES.length]!.heaviest,
});

describe('backtest: full blocks stay coherent end to end', () => {
  for (const [i, raceDate] of RACE_DATES.entries()) {
    const cfg = config(raceDate, i);
    const blockStart = addDays(raceDate, -140); // a 20-week block

    it(`race ${raceDate} with "${TEMPLATES[i % TEMPLATES.length]!.name}"`, () => {
      const plan = buildPlan(cfg, blockStart, { blockStart });

      expect(plan.weeks.length).toBe(21); // 20 full weeks plus race week
      let seenRaceDays = 0;
      let previousDate: string | null = null;

      for (const week of plan.weeks) {
        // Hard sessions are never stacked.
        const hard = week.days
          .map((d, idx) => (HARD_TYPES.includes(d.effectiveType as SessionType) ? idx : -1))
          .filter((idx) => idx >= 0);
        for (let a = 0; a < hard.length; a++) {
          for (let b = a + 1; b < hard.length; b++) {
            expect(
              circularDist(hard[a]!, hard[b]!),
              `${raceDate} ${week.monday}: ${week.days.map((d) => d.effectiveType).join(',')}`,
            ).toBeGreaterThan(1);
          }
        }

        for (const day of week.days) {
          // Dates advance by exactly one day, with no gaps or repeats.
          if (previousDate) expect(daysBetween(previousDate, day.date)).toBe(1);
          previousDate = day.date;

          if (day.isRaceDay) seenRaceDays++;

          // Every day resolves to a renderable session in both languages.
          for (const lang of ['en', 'nl'] as const) {
            const rendered = renderSession(day.session, getDict(lang));
            for (const [field, value] of Object.entries(rendered)) {
              expect(typeof value, `${day.date} ${lang} ${field}`).toBe('string');
              expect(value, `${day.date} ${lang} ${field}`).not.toContain('undefined');
              expect(value, `${day.date} ${lang} ${field}`).not.toContain('NaN');
              expect(value, `${day.date} ${lang} ${field}`).not.toContain('[object');
            }
            expect(rendered.title.length, `${day.date} ${lang}`).toBeGreaterThan(0);
          }
        }
      }

      expect(seenRaceDays).toBe(1);
    });
  }
});

describe('backtest: the plan advances sensibly as the weeks pass', () => {
  it('never changes a past day just because today moved forward', () => {
    const raceDate = '2026-10-24';
    const blockStart = '2026-06-29';
    const cfg = config(raceDate, 0);

    // Snapshot the plan as seen from one date, then re-derive it from later
    // dates: shared days must be identical. If they are not, the planner is
    // rewriting history under the user.
    const reference = new Map<string, string>();
    for (let offset = 0; offset <= 112; offset += 7) {
      const today = addDays(blockStart, offset);
      const plan = buildPlan(cfg, today, { blockStart });
      for (const week of plan.weeks) {
        for (const day of week.days) {
          const signature = `${day.effectiveType}|${day.session.variant}|${JSON.stringify(day.session.args)}`;
          const previous = reference.get(day.date);
          if (previous !== undefined) {
            expect(signature, `${day.date} changed when today became ${today}`).toBe(previous);
          } else {
            reference.set(day.date, signature);
          }
        }
      }
    }
  });

  it('walks through every phase in order over a long block', () => {
    const cfg = config('2026-10-24', 0);
    const blockStart = addDays('2026-10-24', -140);
    const plan = buildPlan(cfg, blockStart, { blockStart });
    const phases = [...new Set(plan.weeks.map((w) => w.phase))];
    expect(phases).toEqual(['base', 'build', 'racespec', 'sharpen', 'taper']);
  });

  it('raises interval volume as the block progresses, then cuts it for the race', () => {
    const cfg = config('2026-10-24', 0);
    const blockStart = addDays('2026-10-24', -140);
    const plan = buildPlan(cfg, blockStart, { blockStart });

    const intervalReps = plan.weeks
      .filter((w) => !w.isDeload && w.phase === 'base')
      .map((w) => w.days.find((d) => d.effectiveType === 'intervals')?.session.args.reps)
      .filter((n): n is number => n !== undefined);

    expect(intervalReps.length).toBeGreaterThan(3);
    // Base progression exists at all - the original was flat here.
    expect(Math.max(...intervalReps)).toBeGreaterThan(Math.min(...intervalReps));

    // Race week carries at most one short quality session.
    const raceWeek = plan.weeks.at(-1)!;
    const raceWeekHard = raceWeek.days.filter((d) =>
      HARD_TYPES.includes(d.effectiveType as SessionType),
    );
    expect(raceWeekHard.length).toBeLessThanOrEqual(1);
  });

  it('gives every non-deload week at least one quality session outside race week', () => {
    for (const [i, raceDate] of RACE_DATES.entries()) {
      const cfg = config(raceDate, i);
      const blockStart = addDays(raceDate, -140);
      const plan = buildPlan(cfg, blockStart, { blockStart });
      for (const week of plan.weeks) {
        if (week.containsRaceDay) continue;
        const quality = week.days.filter((d) =>
          ['intervals', 'tempo', 'compromised', 'long'].includes(d.effectiveType),
        );
        expect(quality.length, `${raceDate} ${week.monday}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  // Compromised running now starts in build, at low dose, every second week:
  // the decay-reduction adaptation is worth starting months before racespec.
  // It still never appears in base.
  it('places compromised runs no earlier than mid-build', () => {
    const cfg = config('2026-10-24', 4); // the "no Hyrox at all" template
    const blockStart = addDays('2026-10-24', -140);
    const plan = buildPlan(cfg, blockStart, { blockStart });
    let buildWeeksWithCompromised = 0;
    for (const week of plan.weeks) {
      const hasCompromised = week.days.some((d) => d.effectiveType === 'compromised');
      if (!hasCompromised) continue;
      expect(['build', 'racespec', 'sharpen', 'taper'], week.monday).toContain(week.phase);
      if (week.phase === 'build') buildWeeksWithCompromised++;
    }
    // Every second build week at most, not all of them.
    expect(buildWeeksWithCompromised).toBeGreaterThan(0);
    expect(buildWeeksWithCompromised).toBeLessThanOrEqual(2);
  });
});

describe('backtest: every day of a year renders without throwing', () => {
  it('survives being opened on any date relative to any race', () => {
    const cfg = config('2026-10-24', 0);
    let checked = 0;
    for (let offset = -200; offset <= 30; offset += 1) {
      const today = addDays('2026-10-24', offset);
      const plan = buildPlan(cfg, today);
      expect(plan.weeks.length).toBeGreaterThanOrEqual(1);
      // Today is always present in the block, before or after the race.
      const found = plan.weeks.flatMap((w) => w.days).some((d) => d.date === today);
      expect(found, `today ${today} missing from its own plan`).toBe(true);
      checked++;
    }
    expect(checked).toBe(231);
  });

  it('survives every pace in the allowed range', () => {
    for (let pace = 150; pace <= 600; pace += 10) {
      const plan = buildPlan({ ...config('2026-10-24', 0), currentPaceSec: pace }, '2026-08-01');
      for (const day of plan.weeks.flatMap((w) => w.days)) {
        const rendered = renderSession(day.session, getDict('en'));
        expect(rendered.pace, `pace ${pace} on ${day.date}`).not.toContain('-');
        expect(rendered.pace).not.toContain('NaN');
      }
    }
  });
});

describe('backtest: corrupt storage never produces an unusable plan', () => {
  const CORRUPT: unknown[] = [
    null,
    undefined,
    0,
    'a string',
    [],
    {},
    { raceDate: 'nonsense' },
    { raceDate: '2026-02-30' },
    { raceDate: '2026-10-24', currentPaceSec: NaN },
    { raceDate: '2026-10-24', currentPaceSec: -500 },
    { raceDate: '2026-10-24', currentPaceSec: 1e9 },
    { raceDate: '2026-10-24', weeklyTemplate: 'not an array' },
    { raceDate: '2026-10-24', weeklyTemplate: ['bogus', 1, null, {}, [], 'hyrox', 'rest'] },
    { raceDate: '2026-10-24', weeklyTemplate: ['hyrox'] },
    { raceDate: '2026-10-24', overrides: { 'not-a-date': 'tempo', '2026-07-08': 'bogus' } },
    { raceDate: '2026-10-24', overrides: 'nope' },
    { raceDate: '2026-10-24', log: { '2026-07-08': { done: 'yes', rpe: 99 } } },
    { raceDate: '2026-10-24', heaviestDay: 42 },
    { raceDate: '2026-10-24', heaviestDay: -1 },
    { raceDate: '2026-10-24', heaviestDay: 3 }, // not a Hyrox day in the default template
    { raceDate: '2026-10-24', language: 'klingon' },
    { raceDate: '2026-10-24', blockStart: '2099-01-01' },
    { hyroxDays: [0, 2, 5], raceDate: '2026-10-24', currentPaceSec: 300 }, // v1 shape
    { dayAssignments: ['hyrox', null, 'hyrox', null, null, 'hyrox', null], raceDate: '2026-10-24' }, // v2
  ];

  for (const [i, raw] of CORRUPT.entries()) {
    it(`case ${i}: ${JSON.stringify(raw)?.slice(0, 60) ?? String(raw)}`, () => {
      const state = migrate(raw, '2026-07-01');
      const plan = buildPlan(
        {
          raceDate: state.raceDate,
          currentPaceSec: state.currentPaceSec,
          weeklyTemplate: state.weeklyTemplate,
          overrides: state.overrides,
          heaviestDay: state.heaviestDay,
        },
        '2026-07-01',
        { blockStart: state.blockStart },
      );

      expect(plan.weeks.length).toBeGreaterThanOrEqual(1);
      for (const day of plan.weeks.flatMap((w) => w.days)) {
        const rendered = renderSession(day.session, getDict(state.language));
        expect(rendered.title.length).toBeGreaterThan(0);
        expect(rendered.title).not.toContain('undefined');
      }
    });
  }

  it('always yields a state that round-trips through JSON', () => {
    for (const raw of CORRUPT) {
      const state = migrate(raw, '2026-07-01');
      expect(() => JSON.parse(JSON.stringify(state))).not.toThrow();
      expect(migrate(JSON.parse(JSON.stringify(state)), '2026-07-01')).toEqual(state);
    }
  });
});

describe('backtest: the real default configuration works today', () => {
  it('builds a usable plan from the shipped defaults on the actual current date', () => {
    const state = migrate({}, todayISO());
    const plan = buildPlan(
      {
        raceDate: state.raceDate,
        currentPaceSec: state.currentPaceSec,
        weeklyTemplate: state.weeklyTemplate,
        overrides: state.overrides,
        heaviestDay: state.heaviestDay,
      },
      todayISO(),
      { blockStart: state.blockStart },
    );
    expect(plan.currentWeekIndex).toBeGreaterThanOrEqual(0);
    expect(plan.weeks.at(-1)!.containsRaceDay).toBe(true);
  });
});
