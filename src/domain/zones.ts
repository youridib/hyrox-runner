import type { Zones } from './types';
import { pad2 } from './dates';

/** Guard rails for the one number the whole plan is derived from. */
export const MIN_PACE_SEC = 150; // 2:30/km
export const MAX_PACE_SEC = 600; // 10:00/km

export const DEFAULT_PACE_SEC = 300;

/**
 * Holds the pace inside plausible human bounds. NaN and Infinity fall back to
 * the default rather than propagating - every zone, every session volume and
 * every rendered string is derived from this one number, so one bad value
 * here would poison the entire plan.
 */
export const clampPace = (sec: number): number => {
  if (!Number.isFinite(sec)) return DEFAULT_PACE_SEC;
  return Math.min(MAX_PACE_SEC, Math.max(MIN_PACE_SEC, Math.round(sec)));
};

/** Seconds -> `m:ss`. Negative input is clamped to zero rather than rendered. */
export function formatPace(sec: number): string {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = Math.round(safe % 60);
  // Rounding 59.6s up must carry into the minute.
  return s === 60 ? `${m + 1}:00` : `${m}:${pad2(s)}`;
}

/** Training zones derived from a fresh 1 km pace, in seconds per km. */
export function computeZones(paceSec: number): Zones {
  const p = clampPace(paceSec);
  return {
    easy: { low: p + 60, high: p + 90 },
    threshold: { low: p + 15, high: p + 25 },
    target: { low: p + 0, high: p + 30 },
    vo2: { low: p - 15, high: p - 5 },
    strides: { low: p - 45, high: p - 30 },
  };
}

export const paceRange = (z: { low: number; high: number }): string =>
  `${formatPace(z.low)}\u2013${formatPace(z.high)}/km`;

export const per400 = (z: { low: number; high: number }): string =>
  `${formatPace(z.low * 0.4)}\u2013${formatPace(z.high * 0.4)}`;

export const per1k = (z: { low: number; high: number }): string =>
  `${formatPace(z.low)}\u2013${formatPace(z.high)}`;
