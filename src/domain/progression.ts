import type { ColorKey, EffectiveType, PhaseKey, SessionArgs, SessionSpec, Zones } from './types';
import { formatPace, paceRange, per1k, per400 } from './zones';

/** Deload weeks keep the intensity and cut the volume to ~60%. */
export const DELOAD_MULTIPLIER = 0.6;

const dloadInt = (n: number, mult: number, min = 1): number =>
  Math.max(min, Math.round(n * mult));

const dloadDur = (n: number, mult: number, step = 5): number =>
  Math.max(step, Math.round((n * mult) / step) * step);

export interface ProgressionCtx {
  phase: PhaseKey;
  weekInPhase: number;
  isDeload: boolean;
  daysToRace: number;
}

/**
 * Volume for a session type at a given point in the block.
 *
 * Every ramp is capped, so a long base phase plateaus rather than growing
 * without bound, and every deload value is derived from the same week's
 * non-deload value, which keeps `deload <= normal` true by construction.
 */
export function buildArgs(type: EffectiveType, zones: Zones, ctx: ProgressionCtx): SessionArgs {
  const { phase, isDeload } = ctx;
  const mult = isDeload ? DELOAD_MULTIPLIER : 1;
  const week = Math.max(1, ctx.weekInPhase);

  const args: SessionArgs = {
    isDeload,
    easy: paceRange(zones.easy),
    thr: paceRange(zones.threshold),
    p400: per400(zones.target),
    p1k: per1k(zones.target),
    vo2Low: formatPace(zones.vo2.low),
    vo2High: formatPace(zones.vo2.high),
    dtr: ctx.daysToRace,
    // Seeded so no template can ever interpolate `undefined`.
    reps: 4,
    sets: 3,
    blockMin: 8,
    durationMin: 30,
    stations: 1,
    reps1k: 1,
  };

  if (type === 'intervals') {
    if (phase === 'racespec') args.reps = dloadInt(5 + week, mult);
    else if (phase === 'sharpen') args.reps = dloadInt(3 + week, mult);
    else if (phase === 'build') args.reps = dloadInt(Math.min(6, 3 + week), mult);
    else if (phase === 'base') args.reps = dloadInt(Math.min(8, 4 + week), mult, 4);
    else args.reps = 4;
  }

  if (type === 'tempo') {
    if (phase === 'racespec') {
      args.sets = 3;
      args.blockMin = dloadInt(6 + 2 * week, mult, 4);
    } else if (phase === 'sharpen') {
      args.sets = isDeload ? 2 : 3;
      args.blockMin = 8;
    } else if (phase === 'build') {
      args.sets = 3;
      args.blockMin = dloadInt(Math.min(10, 6 + 2 * week), mult, 4);
    } else if (phase === 'base') {
      args.durationMin = dloadDur(Math.min(30, 15 + 5 * week), mult);
    } else {
      args.durationMin = 10;
    }
  }

  if (type === 'long') {
    if (phase === 'racespec') args.durationMin = dloadDur(45 + 5 * week, mult);
    else if (phase === 'sharpen') args.durationMin = dloadDur(50 + 5 * week, mult);
    else if (phase === 'build') args.durationMin = dloadDur(50 + 5 * week, mult);
    else if (phase === 'base') args.durationMin = dloadDur(Math.min(60, 40 + 5 * week), mult, 5);
    else args.durationMin = 35;
  }

  if (type === 'compromised') {
    if (phase === 'racespec') {
      args.stations = isDeload ? 1 : week >= 3 ? 2 : 1;
      args.reps1k = isDeload ? 1 : Math.min(2, week);
    } else if (phase === 'sharpen') {
      args.stations = isDeload ? 2 : week === 1 ? 3 : 4;
      args.reps1k = isDeload ? 2 : week === 1 ? 3 : 4;
    } else {
      args.stations = 1;
      args.reps1k = 1;
    }
  }

  return args;
}

const COLORS: Record<EffectiveType, ColorKey> = {
  race: 'race',
  hyrox: 'hyrox',
  intervals: 'intervals',
  tempo: 'tempo',
  long: 'long',
  compromised: 'compromised',
  shakeout: 'shakeout',
  rest: 'shakeout',
};

/**
 * Picks the translation variant for a session. Returns a variant key plus the
 * numbers to render it with - never a user-facing string, so the domain stays
 * language-agnostic and testable.
 */
export function getSessionSpec(
  type: EffectiveType,
  zones: Zones,
  ctx: ProgressionCtx,
  isRaceDay: boolean,
): SessionSpec {
  const args = buildArgs(type, zones, ctx);
  const isTaper = ctx.phase === 'taper';
  const spec = (variant: string, color: ColorKey): SessionSpec => ({ variant, color, args });

  if (isRaceDay || type === 'race') return spec('race', 'race');

  switch (type) {
    case 'hyrox':
      return spec(isTaper ? 'hyroxTaper' : 'hyroxNormal', COLORS.hyrox);

    case 'rest':
      return spec(isTaper && ctx.daysToRace === 1 ? 'restEve' : 'restNormal', COLORS.rest);

    case 'shakeout':
      return spec(
        isTaper && ctx.daysToRace === 2 ? 'shakeoutEve' : 'shakeoutNormal',
        COLORS.shakeout,
      );

    case 'long':
      return spec(isTaper ? 'longTaper' : 'longNormal', COLORS.long);

    case 'intervals':
      if (isTaper) return spec('intervalsTaper', COLORS.intervals);
      if (ctx.phase === 'sharpen') return spec('intervalsSharpen', COLORS.intervals);
      if (ctx.phase === 'racespec') return spec('intervalsRaceSpec', COLORS.intervals);
      if (ctx.phase === 'build') return spec('intervalsBuild', COLORS.intervals);
      return spec('intervalsBase', COLORS.intervals);

    case 'tempo':
      if (isTaper) return spec('tempoTaper', COLORS.tempo);
      if (ctx.phase === 'sharpen') return spec('tempoSharpen', COLORS.tempo);
      if (ctx.phase === 'racespec') return spec('tempoRaceSpec', COLORS.tempo);
      if (ctx.phase === 'build') return spec('tempoBuild', COLORS.tempo);
      return spec('tempoBase', COLORS.tempo);

    case 'compromised':
      if (isTaper) return spec('compromisedTaper', COLORS.compromised);
      if (ctx.phase === 'sharpen') return spec('compromisedSharpen', COLORS.compromised);
      if (ctx.phase === 'racespec') return spec('compromisedRaceSpec', COLORS.compromised);
      return spec('compromisedNormal', COLORS.compromised);

    default:
      return spec('fallback', 'shakeout');
  }
}
