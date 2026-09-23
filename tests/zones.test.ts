import { describe, expect, it } from 'vitest';
import {
  MAX_PACE_SEC,
  MIN_PACE_SEC,
  clampPace,
  computeZones,
  formatPace,
  per400,
} from '../src/domain/zones';

describe('formatPace', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatPace(300)).toBe('5:00');
    expect(formatPace(305)).toBe('5:05');
    expect(formatPace(359)).toBe('5:59');
  });

  it('carries a rounded 60th second into the next minute', () => {
    // 359.6s must not render as "5:60".
    expect(formatPace(359.6)).toBe('6:00');
    expect(formatPace(119.7)).toBe('2:00');
  });

  it('never renders a negative pace', () => {
    expect(formatPace(-30)).toBe('0:00');
  });

  it('never produces a seconds field outside 0-59', () => {
    for (let s = 0; s < 1200; s += 0.1) {
      const [, secs] = formatPace(s).split(':');
      expect(Number(secs)).toBeGreaterThanOrEqual(0);
      expect(Number(secs)).toBeLessThan(60);
    }
  });
});

describe('clampPace', () => {
  it('holds the pace inside plausible human bounds', () => {
    expect(clampPace(10)).toBe(MIN_PACE_SEC);
    expect(clampPace(99999)).toBe(MAX_PACE_SEC);
    expect(clampPace(300)).toBe(300);
    expect(clampPace(NaN)).toBe(300);
    expect(clampPace(Infinity)).toBe(300);
  });
});

describe('computeZones', () => {
  it('orders the zones from fastest to slowest', () => {
    const z = computeZones(300);
    expect(z.strides.low).toBeLessThan(z.vo2.low);
    expect(z.vo2.low).toBeLessThan(z.target.low);
    expect(z.target.low).toBeLessThan(z.threshold.low);
    expect(z.threshold.low).toBeLessThan(z.easy.low);
  });

  it('keeps low faster than high inside every zone', () => {
    for (const pace of [150, 200, 300, 450, 600]) {
      const zones = computeZones(pace);
      for (const [name, z] of Object.entries(zones)) {
        expect(z.low, `${name} at ${pace}`).toBeLessThan(z.high);
      }
    }
  });

  it('never produces a negative zone, even at the fastest allowed pace', () => {
    const z = computeZones(MIN_PACE_SEC);
    for (const zone of Object.values(z)) {
      expect(zone.low).toBeGreaterThan(0);
      expect(zone.high).toBeGreaterThan(0);
    }
  });

  it('clamps out-of-range input before deriving anything', () => {
    expect(computeZones(1)).toEqual(computeZones(MIN_PACE_SEC));
  });
});

describe('per400', () => {
  it('scales a per-km range to 400 m', () => {
    // 5:00/km -> 2:00 per 400 m.
    expect(per400({ low: 300, high: 300 })).toBe('2:00\u20132:00');
  });
});
