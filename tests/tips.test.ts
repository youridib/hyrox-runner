import { describe, expect, it } from 'vitest';
import { TIPS, getTips } from '../src/i18n/tips';
import { SESSION_TYPES, type EffectiveType } from '../src/domain/types';
import { buildPlan } from '../src/domain/plan';
import { addDays, todayISO } from '../src/domain/dates';

const ALL_TYPES: EffectiveType[] = [...SESSION_TYPES, 'race'];

describe('tips coverage', () => {
  for (const lang of ['en', 'nl'] as const) {
    it(`${lang} has tips for every session type`, () => {
      for (const type of ALL_TYPES) {
        const tips = TIPS[lang][type];
        expect(tips, `${lang}/${type}`).toBeDefined();
        expect(tips.length, `${lang}/${type}`).toBeGreaterThanOrEqual(3);
        for (const tip of tips) {
          expect(tip.length, `${lang}/${type}`).toBeGreaterThan(20);
          expect(tip).not.toContain('undefined');
        }
      }
    });
  }

  it('keeps both languages in step', () => {
    for (const type of ALL_TYPES) {
      expect(TIPS.nl[type].length, type).toBe(TIPS.en[type].length);
    }
  });

  it('falls back to English for an unknown language', () => {
    expect(getTips('klingon', 'intervals')).toEqual(TIPS.en.intervals);
  });

  it('returns tips for whatever the planner can put on a day', () => {
    // Walk a whole block and assert every session type it emits has tips.
    const today = todayISO();
    const plan = buildPlan(
      {
        raceDate: addDays(today, 140),
        currentPaceSec: 300,
        weeklyTemplate: ['hyrox', null, 'hyrox', null, null, 'hyrox', null],
        overrides: {},
        heaviestDay: null,
      },
      today,
    );
    const seen = new Set<string>();
    for (const week of plan.weeks) {
      for (const day of week.days) {
        seen.add(day.effectiveType);
        expect(getTips('en', day.effectiveType).length, day.effectiveType).toBeGreaterThan(0);
        expect(getTips('nl', day.effectiveType).length, day.effectiveType).toBeGreaterThan(0);
      }
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});
