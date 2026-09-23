import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  daysBetween,
  isValidISO,
  mondayOf,
  parseISO,
  todayISO,
} from '../src/domain/dates';

describe('parseISO', () => {
  it('accepts well-formed dates', () => {
    expect(parseISO('2026-10-28')).toEqual({ y: 2026, m: 10, d: 28 });
  });

  it('rejects malformed and impossible dates', () => {
    for (const bad of ['', 'nope', '2026-13-01', '2026-02-30', '2026-00-10', '26-1-1', '2026-1-01']) {
      expect(isValidISO(bad), bad).toBe(false);
    }
  });

  it('rejects leap day in a non-leap year but accepts it in a leap year', () => {
    expect(isValidISO('2025-02-29')).toBe(false);
    expect(isValidISO('2024-02-29')).toBe(true);
  });
});

describe('daysBetween', () => {
  it('counts whole days in both directions', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('is exact across a spring-forward DST boundary', () => {
    // Europe/Amsterdam springs forward on 2026-03-29 (a 23-hour day).
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-03-29', '2026-03-30')).toBe(1);
  });

  it('is exact across an autumn DST boundary', () => {
    // Europe/Amsterdam falls back on 2026-10-25 (a 25-hour day).
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1);
  });

  it('crosses year boundaries and leap days', () => {
    expect(daysBetween('2023-12-31', '2024-01-01')).toBe(1);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1);
  });

  it('agrees with addDays over a full year', () => {
    let d = '2026-01-01';
    for (let i = 0; i < 365; i++) {
      expect(daysBetween('2026-01-01', d)).toBe(i);
      d = addDays(d, 1);
    }
  });
});

describe('weekday helpers', () => {
  it('treats Monday as 0', () => {
    expect(dayOfWeek('2026-10-26')).toBe(0); // a Monday
    expect(dayOfWeek('2026-11-01')).toBe(6); // the following Sunday
  });

  it('snaps every day of a week to the same Monday', () => {
    const monday = '2026-10-26';
    for (let i = 0; i < 7; i++) expect(mondayOf(addDays(monday, i))).toBe(monday);
  });

  it('is stable across a DST change within the week', () => {
    expect(mondayOf('2026-03-29')).toBe('2026-03-23');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
  });
});

describe('todayISO', () => {
  it('uses local calendar fields, not UTC', () => {
    // 23:30 local on the 5th is still the 5th, even where UTC has rolled over.
    const local = new Date(2026, 4, 5, 23, 30, 0);
    expect(todayISO(local)).toBe('2026-05-05');
  });

  it('pads single-digit months and days', () => {
    expect(todayISO(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});
