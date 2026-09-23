/** Session types the planner can assign to a day. */
export const SESSION_TYPES = [
  'hyrox',
  'intervals',
  'tempo',
  'long',
  'compromised',
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
  | 'compromised'
  | 'hyrox'
  | 'shakeout'
  | 'race';

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
}
