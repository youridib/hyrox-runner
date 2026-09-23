import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATE,
  SCHEMA_VERSION,
  defaultState,
  migrate,
  parseImport,
} from '../src/state/schema';
import { isValidISO } from '../src/domain/dates';
import { SESSION_TYPES } from '../src/domain/types';

const TODAY = '2026-07-01';

describe('defaultState', () => {
  it('is internally consistent and immediately usable', () => {
    const s = defaultState(TODAY);
    expect(s.version).toBe(SCHEMA_VERSION);
    expect(isValidISO(s.raceDate)).toBe(true);
    expect(isValidISO(s.blockStart)).toBe(true);
    expect(s.weeklyTemplate).toHaveLength(7);
    expect(s.currentPaceSec).toBeGreaterThan(0);
  });

  it('puts the default race far enough out to contain a full block', () => {
    const s = defaultState(TODAY);
    expect(s.raceDate > s.blockStart).toBe(true);
  });
});

describe('migrate from older versions', () => {
  it('turns a v1 hyroxDays array into a weekly template', () => {
    const s = migrate(
      { hyroxDays: [0, 2, 5], raceDate: '2026-10-24', currentPaceSec: 285, language: 'nl' },
      TODAY,
    );
    expect(s.weeklyTemplate).toEqual(['hyrox', null, 'hyrox', null, null, 'hyrox', null]);
    expect(s.raceDate).toBe('2026-10-24');
    expect(s.currentPaceSec).toBe(285);
    expect(s.language).toBe('nl');
    expect(s.version).toBe(SCHEMA_VERSION);
  });

  it('carries a v2 dayAssignments array straight across', () => {
    const assignments = ['hyrox', 'tempo', null, null, 'rest', 'hyrox', null];
    const s = migrate({ dayAssignments: assignments, raceDate: '2026-10-24' }, TODAY);
    expect(s.weeklyTemplate).toEqual(assignments);
  });

  it('keeps a v3 state unchanged apart from pruning', () => {
    const v3 = {
      version: 3,
      raceDate: '2026-10-24',
      currentPaceSec: 290,
      weeklyTemplate: ['hyrox', null, null, null, null, null, null],
      overrides: { '2026-07-08': 'tempo' },
      log: { '2026-06-30': { done: true, rpe: 7, note: 'good' } },
      heaviestDay: 0,
      language: 'en',
      blockStart: '2026-06-01',
    };
    const s = migrate(v3, TODAY);
    expect(s.overrides).toEqual({ '2026-07-08': 'tempo' });
    expect(s.log['2026-06-30']).toEqual({ done: true, rpe: 7, note: 'good' });
    expect(s.heaviestDay).toBe(0);
    expect(s.blockStart).toBe('2026-06-01');
  });

  it('is idempotent', () => {
    const once = migrate({ hyroxDays: [1, 3], raceDate: '2026-10-24' }, TODAY);
    expect(migrate(once, TODAY)).toEqual(once);
  });
});

describe('migrate rejects bad values field by field', () => {
  it('falls back on an invalid race date without losing the rest', () => {
    const s = migrate({ raceDate: '2026-02-30', currentPaceSec: 275 }, TODAY);
    expect(isValidISO(s.raceDate)).toBe(true);
    expect(s.currentPaceSec).toBe(275); // the good field survived
  });

  it('clamps an out-of-range pace', () => {
    expect(migrate({ currentPaceSec: -100 }, TODAY).currentPaceSec).toBeGreaterThan(0);
    expect(migrate({ currentPaceSec: 1e9 }, TODAY).currentPaceSec).toBeLessThanOrEqual(600);
    expect(migrate({ currentPaceSec: NaN }, TODAY).currentPaceSec).toBe(300);
  });

  it('drops unknown session types from the template', () => {
    const s = migrate(
      { weeklyTemplate: ['hyrox', 'bogus', 42, null, {}, 'rest', 'tempo'] },
      TODAY,
    );
    expect(s.weeklyTemplate).toEqual(['hyrox', null, null, null, null, 'rest', 'tempo']);
  });

  it('replaces a template of the wrong length with the default', () => {
    expect(migrate({ weeklyTemplate: ['hyrox'] }, TODAY).weeklyTemplate).toEqual(DEFAULT_TEMPLATE);
    expect(migrate({ weeklyTemplate: 'nope' }, TODAY).weeklyTemplate).toEqual(DEFAULT_TEMPLATE);
  });

  it('drops overrides with bad dates or bad types', () => {
    const s = migrate(
      {
        overrides: {
          'not-a-date': 'tempo',
          '2026-07-08': 'bogus',
          '2026-07-09': 'tempo',
        },
      },
      TODAY,
    );
    expect(s.overrides).toEqual({ '2026-07-09': 'tempo' });
  });

  it('prunes overrides too old to affect any future plan', () => {
    const s = migrate({ overrides: { '2020-01-01': 'tempo', '2026-07-09': 'rest' } }, TODAY);
    expect(s.overrides['2020-01-01']).toBeUndefined();
    expect(s.overrides['2026-07-09']).toBe('rest');
  });

  it('normalises log entries and clamps RPE', () => {
    const s = migrate(
      {
        log: {
          '2026-06-30': { done: 'yes', rpe: 99, note: 'x' },
          '2026-06-29': { done: true, rpe: -4 },
          '2026-06-28': { done: true },
          'bad-date': { done: true },
        },
      },
      TODAY,
    );
    expect(s.log['2026-06-30']!.done).toBe(false); // 'yes' is not true
    expect(s.log['2026-06-30']!.rpe).toBe(10);
    expect(s.log['2026-06-29']!.rpe).toBe(1);
    expect(s.log['2026-06-28']).toEqual({ done: true });
    expect(s.log['bad-date']).toBeUndefined();
  });

  it('drops a heaviest day that is not a Hyrox day', () => {
    expect(migrate({ weeklyTemplate: DEFAULT_TEMPLATE, heaviestDay: 3 }, TODAY).heaviestDay).toBeNull();
    expect(migrate({ weeklyTemplate: DEFAULT_TEMPLATE, heaviestDay: 0 }, TODAY).heaviestDay).toBe(0);
    expect(migrate({ heaviestDay: 42 }, TODAY).heaviestDay).toBeNull();
    expect(migrate({ heaviestDay: 'Monday' }, TODAY).heaviestDay).toBeNull();
  });

  it('falls back to English for an unknown language', () => {
    expect(migrate({ language: 'klingon' }, TODAY).language).toBe('en');
    expect(migrate({ language: 'nl' }, TODAY).language).toBe('nl');
  });

  it('rejects a block start later than the race it builds toward', () => {
    const s = migrate({ raceDate: '2026-08-01', blockStart: '2026-09-01' }, TODAY);
    expect(s.blockStart <= s.raceDate).toBe(true);
  });

  it('returns a valid state for any garbage input', () => {
    const garbage: unknown[] = [null, undefined, 0, '', 'text', [], [1, 2], true, NaN];
    for (const raw of garbage) {
      const s = migrate(raw, TODAY);
      expect(isValidISO(s.raceDate), String(raw)).toBe(true);
      expect(s.weeklyTemplate, String(raw)).toHaveLength(7);
      for (const t of s.weeklyTemplate) {
        if (t !== null) expect(SESSION_TYPES).toContain(t);
      }
    }
  });
});

describe('parseImport', () => {
  it('accepts a real exported backup', () => {
    const exported = JSON.stringify({ ...defaultState(TODAY), exportedAt: '2026-07-01T10:00:00Z' });
    const result = parseImport(exported, TODAY);
    expect('error' in result).toBe(false);
    expect((result as { raceDate: string }).raceDate).toBe(defaultState(TODAY).raceDate);
  });

  it('refuses text that is not JSON', () => {
    expect(parseImport('definitely not json', TODAY)).toEqual({ error: 'not-json' });
  });

  it('refuses JSON that is not an object', () => {
    expect(parseImport('[1,2,3]', TODAY)).toEqual({ error: 'not-an-object' });
    expect(parseImport('"hello"', TODAY)).toEqual({ error: 'not-an-object' });
  });

  it('refuses an unrelated JSON file rather than silently wiping state', () => {
    expect(parseImport('{"unrelated":true}', TODAY)).toEqual({ error: 'not-a-hyrox-backup' });
  });

  it('accepts and upgrades an old backup', () => {
    const result = parseImport('{"hyroxDays":[0,2],"raceDate":"2026-10-24"}', TODAY);
    expect('error' in result).toBe(false);
    expect((result as { version: number }).version).toBe(SCHEMA_VERSION);
  });
});
