import type {
  ColorKey,
  Division,
  EffectiveType,
  PhaseKey,
  SessionArgs,
  SessionSpec,
  Sex,
  StationDose,
  Zones,
} from './types';
import { taperVolumeMultiplier } from './phases';
import { TRANSITION_TARGET_SEC, buildStationBlock, rankWeaknesses, type StationGap } from './stations';
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
  /**
   * 0-based index of this week in the block. Drives the fortnightly rotations
   * - the VO2 maintenance dose and which stations a compromised block uses -
   * so both are stable for a given block start rather than drifting with
   * today's date.
   */
  blockWeekIndex?: number;
  /** 0-based count of time trials scheduled before this one in the block. */
  timeTrialIndex?: number;
  /** Station weaknesses, worst first. Falls back to the population ranking. */
  weaknesses?: readonly StationGap[];
  division?: Division;
  sex?: Sex;
}

/**
 * VO2max is the strongest single correlate of finish time (rho = -0.71), and
 * it used to lose its direct stimulus for the last 10+ weeks of the block.
 * One VO2 session every second week through build and racespec keeps it,
 * substituted for the threshold session rather than added to the week.
 */
export function isVo2MaintenanceWeek(ctx: ProgressionCtx): boolean {
  if (ctx.blockWeekIndex === undefined) return false;
  if (ctx.phase !== 'build' && ctx.phase !== 'racespec') return false;
  return Math.abs(ctx.blockWeekIndex) % 2 === 1;
}

/**
 * Time trials alternate distance so two points exist for critical speed.
 *
 * Keyed to how many time trials have been scheduled, not to the week index:
 * deload weeks are always four apart, so any week-parity rotation would hand
 * every time trial in the block the same distance, and the two-point upgrade
 * could never be reached by following the plan.
 */
export const timeTrialMeters = (timeTrialIndex = 0): number =>
  Math.abs(timeTrialIndex) % 2 === 1 ? 2400 : 1200;

/** How much of the race-standard station dose a compromised block carries. */
function stationFraction(phase: PhaseKey, isDeload: boolean): number {
  const base = phase === 'sharpen' ? 0.75 : phase === 'racespec' ? 0.5 : phase === 'taper' ? 0.3 : 0.4;
  return isDeload ? base * 0.7 : base;
}

/**
 * Rough planned minutes per session, used only for the weekly intensity
 * accounting. Approximate on purpose - the question it answers is "how much
 * of this week is hard", and that survives a few minutes of error.
 */
function estimateMinutes(type: EffectiveType, args: SessionArgs, ctx: ProgressionCtx): number {
  const warmup = 15; // 10 min warm-up plus 5 min cool-down
  switch (type) {
    case 'intervals':
      // 400s run ~2.5 min a rep with recovery, 1 km reps ~6, VO2 reps ~3.5.
      if (ctx.phase === 'racespec' || ctx.phase === 'taper') return warmup + args.reps * 2.5;
      if (ctx.phase === 'sharpen') return warmup + args.reps * 6;
      return warmup + args.reps * 3.5;
    case 'tempo':
      return warmup + Math.max(args.durationMin, args.sets * (args.blockMin + 2));
    case 'long':
    case 'easy':
      return args.durationMin;
    case 'compromised':
      // A station block plus its run, plus the transitions between them.
      return warmup + args.stations * 9 + args.reps1k * 5;
    case 'timeTrial':
      return warmup + 15;
    case 'hyrox':
      return 60;
    case 'shakeout':
      return 25;
    case 'race':
      return 90;
    case 'rest':
    default:
      return 0;
  }
}

/**
 * Volume for a session type at a given point in the block.
 *
 * Every ramp is capped, so a long base phase plateaus rather than growing
 * without bound, and every deload value is derived from the same week's
 * non-deload value, which keeps `deload <= normal` true by construction. The
 * taper multiplies the same ramps by an exponential decay, so it cuts volume
 * without touching intensity or frequency.
 */
export function buildArgs(type: EffectiveType, zones: Zones, ctx: ProgressionCtx): SessionArgs {
  const { phase, isDeload } = ctx;
  const taperPct = taperVolumeMultiplier(ctx.daysToRace);
  const mult = (isDeload ? DELOAD_MULTIPLIER : 1) * (phase === 'taper' ? taperPct : 1);
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
    block: [],
    transitionSec: TRANSITION_TARGET_SEC,
    plannedMin: 0,
    ttMeters: timeTrialMeters(ctx.timeTrialIndex),
    taperPct: Math.round(taperPct * 100) / 100,
  };

  if (type === 'intervals') {
    if (isVo2MaintenanceWeek(ctx)) args.reps = dloadInt(Math.min(8, 4 + week), mult, 4);
    else if (phase === 'racespec') args.reps = dloadInt(5 + week, mult);
    else if (phase === 'sharpen') args.reps = dloadInt(3 + week, mult);
    else if (phase === 'build') args.reps = dloadInt(Math.min(6, 3 + week), mult);
    else if (phase === 'base') args.reps = dloadInt(Math.min(8, 4 + week), mult, 4);
    else args.reps = dloadInt(4, mult);
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
      // Taper: the threshold session survives, trimmed to ~10-20 min.
      args.durationMin = dloadDur(Math.max(10, Math.round(20 * mult)), 1);
    }
  }

  if (type === 'long') {
    if (phase === 'racespec') args.durationMin = dloadDur(45 + 5 * week, mult);
    else if (phase === 'sharpen') args.durationMin = dloadDur(50 + 5 * week, mult);
    else if (phase === 'build') args.durationMin = dloadDur(50 + 5 * week, mult);
    else if (phase === 'base') args.durationMin = dloadDur(Math.min(60, 40 + 5 * week), mult, 5);
    else args.durationMin = dloadDur(45, mult);
  }

  // Genuine easy aerobic volume. Endurance training volume correlated with
  // finish time at rho = -0.68, and the old default week had essentially none.
  if (type === 'easy') {
    args.durationMin =
      phase === 'base' || phase === 'build'
        ? dloadDur(Math.min(50, 35 + 5 * week), mult, 5)
        : dloadDur(35, mult, 5);
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

    // Stations are chosen, not fixed: the athlete's two worst benchmarks are
    // in every block, the rest rotate, and the block stays in race order.
    const perBlock = phase === 'sharpen' && !isDeload ? 3 : phase === 'build' ? 2 : 3;
    args.block = buildStationBlock(
      perBlock,
      ctx.weaknesses ?? rankWeaknesses(),
      ctx.blockWeekIndex ?? 0,
      stationFraction(phase, isDeload),
      ctx.division,
      ctx.sex,
    ) as readonly StationDose[];
  }

  args.plannedMin = Math.round(estimateMinutes(type, args, ctx));
  return args;
}

const COLORS: Record<EffectiveType, ColorKey> = {
  race: 'race',
  hyrox: 'hyrox',
  intervals: 'intervals',
  tempo: 'tempo',
  long: 'long',
  easy: 'easy',
  compromised: 'compromised',
  timeTrial: 'timeTrial',
  shakeout: 'shakeout',
  rest: 'shakeout',
};

/**
 * Picks the translation variant for a session. Returns a variant key plus the
 * numbers to render it with - never a user-facing string, so the domain stays
 * language-agnostic and testable.
 *
 * The taper is two weeks now, and the two weeks are not the same session. In
 * taper week 1 the quality sessions are simply trimmed; only inside the final
 * seven days does the fixed race-week copy apply.
 */
export function getSessionSpec(
  type: EffectiveType,
  zones: Zones,
  ctx: ProgressionCtx,
  isRaceDay: boolean,
): SessionSpec {
  const args = buildArgs(type, zones, ctx);
  const isTaper = ctx.phase === 'taper';
  const isRaceWeek = isTaper && ctx.daysToRace <= 7;
  const spec = (variant: string, color: ColorKey): SessionSpec => ({ variant, color, args });

  if (isRaceDay || type === 'race') return spec('race', 'race');

  switch (type) {
    case 'hyrox':
      if (isRaceWeek) return spec('hyroxTaper', COLORS.hyrox);
      // Taper logic is the same for strength as for running: cut the volume,
      // keep the intensity. Dropping it for 14 days blunts output.
      if (isTaper) return spec('hyroxTaperEarly', COLORS.hyrox);
      return spec('hyroxNormal', COLORS.hyrox);

    case 'rest':
      return spec(isTaper && ctx.daysToRace === 1 ? 'restEve' : 'restNormal', COLORS.rest);

    case 'shakeout':
      return spec(
        isTaper && ctx.daysToRace === 2 ? 'shakeoutEve' : 'shakeoutNormal',
        COLORS.shakeout,
      );

    case 'easy':
      return spec('easyNormal', COLORS.easy);

    case 'timeTrial':
      return spec('timeTrialNormal', COLORS.timeTrial);

    case 'long':
      return spec(isTaper ? 'longTaper' : 'longNormal', COLORS.long);

    case 'intervals':
      if (isRaceWeek) return spec('intervalsTaper', COLORS.intervals);
      if (isTaper) return spec('intervalsTaperEarly', COLORS.intervals);
      if (isVo2MaintenanceWeek(ctx)) return spec('intervalsVo2Maintenance', COLORS.intervals);
      if (ctx.phase === 'sharpen') return spec('intervalsSharpen', COLORS.intervals);
      if (ctx.phase === 'racespec') return spec('intervalsRaceSpec', COLORS.intervals);
      if (ctx.phase === 'build') return spec('intervalsBuild', COLORS.intervals);
      return spec('intervalsBase', COLORS.intervals);

    case 'tempo':
      if (isRaceWeek) return spec('tempoTaper', COLORS.tempo);
      if (isTaper) return spec('tempoTaperEarly', COLORS.tempo);
      if (ctx.phase === 'sharpen') return spec('tempoSharpen', COLORS.tempo);
      if (ctx.phase === 'racespec') return spec('tempoRaceSpec', COLORS.tempo);
      if (ctx.phase === 'build') return spec('tempoBuild', COLORS.tempo);
      return spec('tempoBase', COLORS.tempo);

    case 'compromised':
      if (isRaceWeek) return spec('compromisedTaper', COLORS.compromised);
      if (isTaper) return spec('compromisedTaperEarly', COLORS.compromised);
      if (ctx.phase === 'sharpen') return spec('compromisedSharpen', COLORS.compromised);
      if (ctx.phase === 'racespec') return spec('compromisedRaceSpec', COLORS.compromised);
      return spec('compromisedNormal', COLORS.compromised);

    default:
      return spec('fallback', 'shakeout');
  }
}
