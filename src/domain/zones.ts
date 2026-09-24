import type { TimeTrial, Zones } from './types';
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

/** Seconds -> `h:mm:ss`, for race-length totals. */
export function formatClock(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/* ------------------------------------------------------------------ */

/**
 * Critical speed from two maximal efforts (e.g. 1200 m and 2400 m).
 *
 * Returns null rather than a plausible-looking number when the two efforts
 * cannot describe a critical speed - same distance, slower over the shorter
 * one, or an implausible result. A bad anchor is worse than no upgrade.
 */
export function criticalSpeed(t1: TimeTrial, t2: TimeTrial): { cs: number; dPrime: number } | null {
  const short = t1.meters <= t2.meters ? t1 : t2;
  const long = t1.meters <= t2.meters ? t2 : t1;

  const dm = long.meters - short.meters;
  const dt = long.seconds - short.seconds;
  if (!Number.isFinite(dm) || !Number.isFinite(dt) || dm <= 0 || dt <= 0) return null;

  const cs = dm / dt; // m/s
  const dPrime = short.meters - cs * short.seconds; // m
  if (!Number.isFinite(cs) || cs <= 0 || dPrime <= 0) return null;

  const paceSec = 1000 / cs;
  if (paceSec < MIN_PACE_SEC || paceSec > MAX_PACE_SEC) return null;
  return { cs, dPrime };
}

/**
 * A fresh maximal 1 km sits above critical speed - it is a 3-4 min effort,
 * near vVO2max. This converts one to the other so the single-input path keeps
 * working: a second time trial is an upgrade, not a requirement.
 */
export const CS_FROM_SINGLE_EFFORT = 1.08;

export type AnchorSource = 'twoPoint' | 'singlePoint';

export interface PaceAnchor {
  /** Critical-speed pace, in seconds per km. */
  csPaceSec: number;
  /** Station-fatigue penalty added to critical speed for race pace. */
  decaySec: number;
  source: AnchorSource;
}

/**
 * Hyrox target pace = critical-speed pace plus a station-fatigue penalty.
 *
 * No athlete-level setting: the seed is one population number, and every
 * logged compromised-run split moves it toward the truth for this athlete.
 * The seed is a starting guess with a short half-life, not a classification.
 */
export const SEED_DECAY_SEC_PER_KM = 30;

/** Blend the seed out as real compromised-run splits arrive. */
export function stationDecay(decaySamples: readonly number[]): number {
  const usable = decaySamples.filter((n) => Number.isFinite(n));
  if (usable.length === 0) return SEED_DECAY_SEC_PER_KM;
  const observed = usable.reduce((a, b) => a + b, 0) / usable.length;
  const w = Math.min(1, usable.length / 5); // fully self-calibrated by ~5 runs
  return w * observed + (1 - w) * SEED_DECAY_SEC_PER_KM;
}

/**
 * Turns logged compromised-run 1 km splits into decay samples: how much
 * slower than critical speed the athlete actually runs off a station block.
 * This is the only honest measurement of the penalty, which is why the
 * compromised runs log the split at all.
 */
export const splitsToDecay = (splits: readonly number[], csPaceSec: number): number[] =>
  splits.filter((s) => Number.isFinite(s)).map((s) => s - csPaceSec);

/**
 * Keeps the penalty inside the band where the zones stay ordered and the
 * prescription stays sane: never so small that target pace collides with
 * threshold, never so large that it drifts into easy running.
 */
export function clampDecay(decaySec: number, csPaceSec: number): number {
  const min = Math.max(10, Math.round(csPaceSec * 0.05) + 6);
  const max = Math.max(min, Math.min(90, Math.round(csPaceSec * 0.2)));
  if (!Number.isFinite(decaySec)) return Math.min(max, Math.max(min, SEED_DECAY_SEC_PER_KM));
  return Math.min(max, Math.max(min, Math.round(decaySec)));
}

export interface AnchorInput {
  /** Best fresh 1 km, in seconds. The single-point fallback. */
  currentPaceSec: number;
  timeTrials?: readonly TimeTrial[];
  /** Logged 1 km splits off a station block, in seconds. */
  compromisedSplits?: readonly number[];
}

/**
 * Resolves the pace anchor from whatever the athlete has given.
 *
 * Two maximal efforts at different distances give a real critical speed; one
 * fresh 1 km gives an estimate of the same thing. Either way the zones below
 * are fractions of critical speed, not fixed offsets from a time trial.
 */
export function resolveAnchor(input: AnchorInput): PaceAnchor {
  const trials = (input.timeTrials ?? []).filter(
    (t) => Number.isFinite(t.meters) && Number.isFinite(t.seconds) && t.meters > 0 && t.seconds > 0,
  );

  let csPaceSec: number | null = null;
  let source: AnchorSource = 'singlePoint';

  // Prefer the two most recent trials that are far enough apart in distance
  // to say something; callers pass them newest first.
  outer: for (let i = 0; i < trials.length; i++) {
    for (let j = i + 1; j < trials.length; j++) {
      const a = trials[i] as TimeTrial;
      const b = trials[j] as TimeTrial;
      if (Math.abs(a.meters - b.meters) < 400) continue;
      const cs = criticalSpeed(a, b);
      if (cs) {
        csPaceSec = clampPace(1000 / cs.cs);
        source = 'twoPoint';
        break outer;
      }
    }
  }

  if (csPaceSec === null) {
    csPaceSec = clampPace(clampPace(input.currentPaceSec) * CS_FROM_SINGLE_EFFORT);
  }

  const decaySec = clampDecay(
    stationDecay(splitsToDecay(input.compromisedSplits ?? [], csPaceSec)),
    csPaceSec,
  );

  return { csPaceSec, decaySec, source };
}

/**
 * Training zones as fractions of critical speed, in seconds per km.
 *
 * Fractional rather than additive, because fixed second-offsets do not scale:
 * a +60 s "easy" is +20% for a 5:00/km runner and +40% for a 2:30/km runner,
 * which hands the slower athlete the harder easy run. Passing a bare number
 * keeps the single-anchor path working - it is read as a fresh 1 km pace.
 */
export function computeZones(anchor: PaceAnchor | number): Zones {
  const resolved: PaceAnchor =
    typeof anchor === 'number' ? resolveAnchor({ currentPaceSec: anchor }) : anchor;

  const cs = clampPace(resolved.csPaceSec);
  const decay = clampDecay(resolved.decaySec, cs);
  const at = (fraction: number) => Math.round(cs / fraction);

  return {
    // Fractions of critical speed: easy 0.68-0.78, threshold 0.96-1.00,
    // VO2 1.08-1.15, strides 1.25-1.35.
    easy: { low: at(0.78), high: at(0.68) },
    threshold: { low: at(1.0), high: at(0.96) },
    // Race pace is flat by design: critical speed plus the station penalty,
    // with a tight band rather than a 30 s spread to start too fast inside.
    target: { low: cs + decay - 5, high: cs + decay + 5 },
    vo2: { low: at(1.15), high: at(1.08) },
    strides: { low: at(1.35), high: at(1.25) },
  };
}

export const paceRange = (z: { low: number; high: number }): string =>
  `${formatPace(z.low)}–${formatPace(z.high)}/km`;

export const per400 = (z: { low: number; high: number }): string =>
  `${formatPace(z.low * 0.4)}–${formatPace(z.high * 0.4)}`;

export const per1k = (z: { low: number; high: number }): string =>
  `${formatPace(z.low)}–${formatPace(z.high)}`;

/** The middle of a zone - what a flat-pace prescription actually asks for. */
export const midPace = (z: { low: number; high: number }): number =>
  Math.round((z.low + z.high) / 2);
