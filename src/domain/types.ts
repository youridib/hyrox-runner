/** Session types the planner can assign to a day. */
export const SESSION_TYPES = [
  'hyrox',
  'intervals',
  'tempo',
  'long',
  'easy',
  'compromised',
  'timeTrial',
  'shakeout',
  'rest',
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

/** `race` is never user-pickable - it is derived from the race date. */
export type EffectiveType = SessionType | 'race';

export const PHASE_KEYS = ['past', 'taper', 'sharpen', 'racespec', 'build', 'base'] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

/** Colour token names; must match the CSS custom properties. */
export type ColorKey =
  | 'intervals'
  | 'tempo'
  | 'long'
  | 'easy'
  | 'compromised'
  | 'timeTrial'
  | 'hyrox'
  | 'shakeout'
  | 'race';

/**
 * The eight race stations, in race order.
 *
 * Order matters: a compromised-run block rehearses the sequence the race
 * actually asks for, so every station list the domain emits stays race-ordered.
 */
export const STATIONS = [
  'ski',
  'sledPush',
  'sledPull',
  'burpeeBroadJump',
  'row',
  'farmers',
  'lunges',
  'wallBalls',
] as const;

export type Station = (typeof STATIONS)[number];

export interface StationBenchmark {
  /** Seconds for the race-standard dose at race weight. */
  seconds: number;
  /** ISO date tested. Benchmarks older than ~6 weeks are stale. */
  testedOn: string;
}

/**
 * One station as it should be executed, at the athlete's own division and sex.
 * The domain never names a station in a user-facing language - the key is the
 * name, and i18n renders it.
 */
export interface StationDose {
  station: Station;
  meters?: number;
  reps?: number;
  weightKg?: number;
  /** Wall-ball target height, in metres. */
  heightM?: number;
  /** Carried in each hand, for the farmers carry. */
  perHand?: boolean;
}

export const DIVISIONS = ['open', 'pro', 'doubles'] as const;
export type Division = (typeof DIVISIONS)[number];

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

export interface Zone {
  low: number;
  high: number;
}

export interface Zones {
  easy: Zone;
  threshold: Zone;
  target: Zone;
  vo2: Zone;
  strides: Zone;
}

/** A maximal effort over a known distance, used to derive critical speed. */
export interface TimeTrial {
  meters: number;
  seconds: number;
}

/** Everything a translation function may need to render a session. */
export interface SessionArgs {
  isDeload: boolean;
  easy: string;
  thr: string;
  p400: string;
  p1k: string;
  vo2Low: string;
  vo2High: string;
  dtr: number;
  /**
   * Volume numbers are always present, never optional. A missing value would
   * render as "undefined reps" in the UI, so buildArgs seeds every field and
   * the per-type branches only overwrite what applies.
   */
  reps: number;
  sets: number;
  blockMin: number;
  durationMin: number;
  stations: number;
  reps1k: number;
  /**
   * Race-ordered station doses for this session's block. Empty for every
   * session that does not touch a station, so a template can map over it
   * without a guard.
   */
  block: readonly StationDose[];
  /** Target seconds per roxzone transition - 8 of these are 8 transitions. */
  transitionSec: number;
  /**
   * Planned minutes for this session. Seeded for every type because the
   * weekly intensity accounting sums it across the week, and a missing value
   * there would silently understate how hard the week is.
   */
  plannedMin: number;
  /** Distance of a scheduled time trial, in metres. */
  ttMeters: number;
  /** Fraction of full volume this day carries; 1 outside the taper. */
  taperPct: number;
}

/**
 * A session as the domain describes it: which translation variant to render
 * and the numbers to render it with. The domain never produces user-facing
 * strings - that is the i18n layer's job.
 */
export interface SessionSpec {
  variant: string;
  color: ColorKey;
  args: SessionArgs;
}

export interface PlannedDay {
  /** ISO yyyy-mm-dd, local calendar date. */
  date: string;
  /** 0 = Monday .. 6 = Sunday. */
  dayOfWeek: number;
  daysToRace: number;
  isRaceDay: boolean;
  phase: PhaseKey;
  weekInPhase: number;
  weekInPhaseTotal: number | null;
  isDeload: boolean;
  effectiveType: EffectiveType;
  /** Set when this day came from a date override rather than the template. */
  overrideType: SessionType | null;
  /** Set when the weekly template pinned this day. */
  templateType: SessionType | null;
  session: SessionSpec;
}

/** How hard a session is for intensity-distribution purposes. */
export type IntensityBand = 'easy' | 'moderate' | 'hard';

export interface WeekIntensity {
  easyMin: number;
  moderateMin: number;
  hardMin: number;
  totalMin: number;
  /** Hard minutes as a fraction of planned minutes, 0 when nothing is planned. */
  hardFraction: number;
  /** True once the hard fraction passes the polarized-training guard rail. */
  overloaded: boolean;
}

export interface PlannedWeek {
  /** ISO date of the Monday. */
  monday: string;
  /** Sequential index across the whole block; 0 = the first planned week. */
  index: number;
  phase: PhaseKey;
  weekInPhase: number;
  weekInPhaseTotal: number | null;
  isDeload: boolean;
  containsRaceDay: boolean;
  days: PlannedDay[];
  /** Planned intensity distribution for the week. */
  intensity: WeekIntensity;
}

export interface PlanConfig {
  /** ISO yyyy-mm-dd. */
  raceDate: string;
  currentPaceSec: number;
  /** Recurring intent, Monday-first. `null` means "let the planner decide". */
  weeklyTemplate: (SessionType | null)[];
  /** ISO date -> one-off override, beats the template for that date only. */
  overrides: Record<string, SessionType>;
  /** 0-6, or null when it varies. */
  heaviestDay: number | null;
  /**
   * Maximal efforts over known distances. Two at different distances upgrade
   * the pace anchor from a single-point estimate to a real critical speed;
   * one, or none, falls back to `currentPaceSec`.
   */
  timeTrials?: readonly TimeTrial[];
  /**
   * Logged 1 km splits, in seconds, run immediately off a station block.
   * These are what calibrate the station-fatigue penalty to this athlete.
   */
  compromisedSplits?: readonly number[];
  /** Station times, for weakness ranking and the race plan. */
  stationBenchmarks?: Partial<Record<Station, StationBenchmark>>;
  division?: Division;
  sex?: Sex;
  /** Goal finish in seconds. Seeds the untested station times when set. */
  goalFinishSec?: number | null;
}
