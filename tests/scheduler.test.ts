import { describe, expect, it } from 'vitest';
import {
  HARD_TYPES,
  autoFillNormal,
  autoFillTaper,
  circularDist,
  fillWeek,
  scorePlacement,
} from '../src/domain/scheduler';
import type { PhaseKey, SessionType } from '../src/domain/types';

const EMPTY: (SessionType | null)[] = [null, null, null, null, null, null, null];
const isHard = (t: SessionType | undefined) => t !== undefined && HARD_TYPES.includes(t);

/** Days (0-6) carrying a hard session, in a filled week. */
const hardDays = (week: SessionType[]): number[] =>
  week.map((t, i) => (isHard(t) ? i : -1)).filter((i) => i >= 0);

const NORMAL_PHASES: PhaseKey[] = ['base', 'build', 'racespec', 'sharpen'];

/** Every 7-slot template of Hyrox days / free days, as a bitmask. */
function* allHyroxTemplates(): Generator<(SessionType | null)[]> {
  for (let mask = 0; mask < 128; mask++) {
    const t: (SessionType | null)[] = [];
    for (let d = 0; d < 7; d++) t.push(mask & (1 << d) ? 'hyrox' : null);
    yield t;
  }
}

describe('circularDist', () => {
  it('wraps around the week', () => {
    expect(circularDist(0, 6)).toBe(1); // Monday and Sunday are adjacent
    expect(circularDist(0, 3)).toBe(3);
    expect(circularDist(2, 2)).toBe(0);
    expect(circularDist(1, 5)).toBe(3);
  });

  it('is symmetric and never exceeds three', () => {
    for (let a = 0; a < 7; a++) {
      for (let b = 0; b < 7; b++) {
        expect(circularDist(a, b)).toBe(circularDist(b, a));
        expect(circularDist(a, b)).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('scorePlacement weighting', () => {
  it('punishes stacked hard days far more than merely adjacent ones', () => {
    const adjacent = scorePlacement({ 0: 'intervals', 1: 'tempo' }, [], null);
    const spaced = scorePlacement({ 0: 'intervals', 3: 'tempo' }, [], null);
    expect(spaced).toBeGreaterThan(adjacent);
  });

  it('prefers a hard session away from the heaviest Hyrox day', () => {
    const dayAfterHeaviest = scorePlacement({ 1: 'intervals' }, [0], 0);
    const elsewhere = scorePlacement({ 3: 'intervals' }, [0], 0);
    expect(elsewhere).toBeGreaterThan(dayAfterHeaviest);
  });
});

describe('autoFillNormal', () => {
  it('fills every day of the week', () => {
    for (const phase of NORMAL_PHASES) {
      const week = autoFillNormal(EMPTY, phase, null);
      expect(week).toHaveLength(7);
      for (const t of week) expect(t).toBeTruthy();
    }
  });

  it('never stacks hard sessions back to back, for any Hyrox template', () => {
    for (const template of allHyroxTemplates()) {
      for (const phase of NORMAL_PHASES) {
        const week = autoFillNormal(template, phase, null);
        const hard = hardDays(week);
        for (let i = 0; i < hard.length; i++) {
          for (let j = i + 1; j < hard.length; j++) {
            expect(
              circularDist(hard[i]!, hard[j]!),
              phase + ' ' + JSON.stringify(template) + ' -> ' + JSON.stringify(week),
            ).toBeGreaterThan(1);
          }
        }
      }
    }
  });

  it('drops a quality session rather than stacking, when the free days cannot hold them all', () => {
    // Mon-Wed are Hyrox, leaving four consecutive free days. Four days in a row
    // cannot hold three non-adjacent sessions, so one has to go.
    const template: (SessionType | null)[] = ['hyrox', 'hyrox', 'hyrox', null, null, null, null];
    const week = autoFillNormal(template, 'racespec', null);
    expect(hardDays(week).length).toBeLessThanOrEqual(2);
    expect(week).toContain('intervals');
    expect(week).toContain('compromised');
  });

  it('keeps all three quality sessions when the week has room for them', () => {
    const week = autoFillNormal(EMPTY, 'racespec', null);
    expect(hardDays(week)).toHaveLength(3);
  });

  it('never introduces an adjacency the user did not pin', () => {
    // Two hard sessions pinned back to back: the planner must not add more.
    const template: (SessionType | null)[] = [null, 'tempo', 'intervals', null, null, null, null];
    for (const phase of NORMAL_PHASES) {
      const week = autoFillNormal(template, phase, null);
      const pairs = hardDays(week).flatMap((a, i, all) =>
        all.slice(i + 1).filter((b) => circularDist(a, b) <= 1),
      ).length;
      expect(pairs, phase + ' -> ' + JSON.stringify(week)).toBeLessThanOrEqual(1);
    }
  });

  it('avoids a hard session the day after the heaviest Hyrox day when a free day exists', () => {
    // Monday Hyrox and heaviest; Tuesday free, but so are Wed-Sun.
    const template: (SessionType | null)[] = ['hyrox', null, null, null, null, null, null];
    for (const phase of NORMAL_PHASES) {
      const week = autoFillNormal(template, phase, 0);
      expect(isHard(week[1]), phase + ' -> ' + JSON.stringify(week)).toBe(false);
    }
  });

  it('honours every pinned day exactly', () => {
    const template: (SessionType | null)[] = [
      'hyrox', 'tempo', null, 'rest', null, 'hyrox', null,
    ];
    for (const phase of NORMAL_PHASES) {
      const week = autoFillNormal(template, phase, null);
      template.forEach((pinned, i) => {
        if (pinned !== null) expect(week[i], phase + ' day ' + i).toBe(pinned);
      });
    }
  });

  it('returns pins untouched when the whole week is pinned', () => {
    const full: SessionType[] = [
      'hyrox', 'tempo', 'rest', 'intervals', 'rest', 'long', 'shakeout',
    ];
    expect(autoFillNormal(full, 'build', null)).toEqual(full);
  });

  it('schedules compromised runs once the block turns race-specific, and long runs before', () => {
    expect(autoFillNormal(EMPTY, 'racespec', null)).toContain('compromised');
    expect(autoFillNormal(EMPTY, 'sharpen', null)).toContain('compromised');
    expect(autoFillNormal(EMPTY, 'base', null)).toContain('long');
    expect(autoFillNormal(EMPTY, 'build', null)).toContain('long');
    expect(autoFillNormal(EMPTY, 'base', null)).not.toContain('compromised');
  });

  it('never doubles up on endurance work', () => {
    for (const phase of NORMAL_PHASES) {
      const week = autoFillNormal(EMPTY, phase, null);
      const endurance = week.filter((t) => t === 'long' || t === 'compromised');
      expect(endurance.length, phase).toBeLessThanOrEqual(1);
    }
  });

  it('respects an already-pinned endurance session instead of adding a second', () => {
    const template: (SessionType | null)[] = [null, null, null, null, null, 'long', null];
    const week = autoFillNormal(template, 'racespec', null);
    expect(week.filter((t) => t === 'long' || t === 'compromised')).toHaveLength(1);
  });

  it('scales the quality budget down when few days are free', () => {
    // Six days pinned, one free: at most one quality session can be added.
    const template: (SessionType | null)[] = [
      'hyrox', 'rest', 'hyrox', 'rest', 'hyrox', 'rest', null,
    ];
    const week = autoFillNormal(template, 'build', null);
    expect(hardDays(week)).toHaveLength(1);
  });

  it('is deterministic', () => {
    for (const phase of NORMAL_PHASES) {
      const a = autoFillNormal(EMPTY, phase, 2);
      const b = autoFillNormal(EMPTY, phase, 2);
      expect(a).toEqual(b);
    }
  });
});

describe('autoFillTaper', () => {
  /** daysToRace per weekday for a race on the Saturday of the week. */
  const raceOnSaturday = [5, 4, 3, 2, 1, 0, -1];

  it('locks the race-week shape regardless of the template', () => {
    const week = autoFillTaper(EMPTY, raceOnSaturday);
    expect(week[4]).toBe('rest'); // day before the race
    expect(week[3]).toBe('shakeout'); // two days out
    expect(week[2]).toBe('intervals'); // the one short sharpener
  });

  it('puts nothing hard in the last two days before the race', () => {
    for (let raceDay = 0; raceDay < 7; raceDay++) {
      const dtr = Array.from({ length: 7 }, (_, d) => raceDay - d);
      const week = autoFillTaper(EMPTY, dtr);
      week.forEach((type, d) => {
        const daysOut = dtr[d]!;
        if (daysOut === 1 || daysOut === 2) {
          expect(isHard(type), 'race on day ' + raceDay + ', day ' + d).toBe(false);
        }
      });
    }
  });

  it('still honours an explicit pin, so the user is never overruled', () => {
    const template: (SessionType | null)[] = [null, null, null, null, 'tempo', null, null];
    expect(autoFillTaper(template, raceOnSaturday)[4]).toBe('tempo');
  });

  it('leaves the days after the race easy', () => {
    const week = autoFillTaper(EMPTY, raceOnSaturday);
    expect(week[6]).toBe('shakeout');
  });
});

describe('fillWeek dispatch', () => {
  it('uses the taper shape only in race week', () => {
    const dtr = [5, 4, 3, 2, 1, 0, -1];
    expect(fillWeek(EMPTY, 'taper', null, dtr)[4]).toBe('rest');
    // The same dates outside taper go through the normal planner instead.
    const normal = fillWeek(EMPTY, 'build', null, [60, 59, 58, 57, 56, 55, 54]);
    expect(normal).toContain('long');
  });
});
