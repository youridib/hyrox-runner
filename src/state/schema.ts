import { addDays, daysBetween, isValidISO, todayISO } from '../domain/dates';
import {
  DIVISIONS,
  SESSION_TYPES,
  SEXES,
  STATIONS,
  type Division,
  type SessionType,
  type Sex,
  type Station,
  type StationBenchmark,
} from '../domain/types';
import { MAX_PACE_SEC, MIN_PACE_SEC, clampPace } from '../domain/zones';

export const SCHEMA_VERSION = 4;
export const STORAGE_KEY = 'hyroxRunner.v4';
export const LEGACY_KEYS = ['hyroxRunner.v3', 'hyroxRunner.v2', 'hyroxRunner.v1'] as const;

export type Language = 'en' | 'nl';

export interface LogEntry {
  done: boolean;
  /**
   * Rate of perceived exertion, 1-10. Collected as a private training diary
   * only: nothing in the planner reads it, and no load model is derived from
   * it.
   */
  rpe?: number;
  note?: string;
  /**
   * The 1 km split run straight off a station block, in seconds. This is the
   * only honest measurement of the station-fatigue penalty, and it is what
   * moves target pace off the population seed and onto this athlete.
   */
  splitSec?: number;
}

/** A maximal effort, dated so the trend can be shown and the anchor re-tested. */
export interface TimeTrialEntry {
  date: string;
  meters: number;
  seconds: number;
}

export interface AppState {
  version: number;
  raceDate: string;
  currentPaceSec: number;
  /** Recurring weekly intent, Monday-first. `null` = planner decides. */
  weeklyTemplate: (SessionType | null)[];
  /** ISO date -> one-off override for that date only. */
  overrides: Record<string, SessionType>;
  /** ISO date -> what actually happened. */
  log: Record<string, LogEntry>;
  heaviestDay: number | null;
  language: Language;
  /** Monday the block is counted from. */
  blockStart: string;
  /** Time-trial history, newest first. Two distances give a critical speed. */
  timeTrials: TimeTrialEntry[];
  /** Station times for the race-standard dose, keyed by station. */
  stationBenchmarks: Partial<Record<Station, StationBenchmark>>;
  division: Division;
  sex: Sex;
  /** Goal finish in seconds, or null to project from current fitness. */
  goalFinishSec: number | null;
}

export const DEFAULT_TEMPLATE: (SessionType | null)[] = [
  'hyrox', null, 'hyrox', null, null, 'hyrox', null,
];

/** Overrides this far in the past can never affect a future plan. */
const OVERRIDE_RETENTION_DAYS = 120;
/** Keep roughly two years of training history. */
const LOG_RETENTION_DAYS = 730;
/** Time trials older than this say nothing about current fitness. */
const TIME_TRIAL_RETENTION_DAYS = 365;
/** Splits this far back predate whatever the athlete is now. */
const SPLIT_WINDOW_DAYS = 120;
/** Only the most recent splits calibrate the penalty. */
const SPLIT_SAMPLE_LIMIT = 8;

export function defaultState(today = todayISO()): AppState {
  return {
    version: SCHEMA_VERSION,
    raceDate: addDays(today, 112), // ~16 weeks out: a full block
    currentPaceSec: 300,
    weeklyTemplate: [...DEFAULT_TEMPLATE],
    overrides: {},
    log: {},
    heaviestDay: null,
    language: 'en',
    blockStart: today,
    timeTrials: [],
    stationBenchmarks: {},
    division: 'open',
    sex: 'male',
    goalFinishSec: null,
  };
}

const isSessionType = (v: unknown): v is SessionType =>
  typeof v === 'string' && (SESSION_TYPES as readonly string[]).includes(v);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStation = (v: string): v is Station => (STATIONS as readonly string[]).includes(v);

function coerceTemplate(raw: unknown): (SessionType | null)[] {
  if (!Array.isArray(raw) || raw.length !== 7) return [...DEFAULT_TEMPLATE];
  return raw.map((v) => (isSessionType(v) ? v : null));
}

function coerceOverrides(raw: unknown, today: string): Record<string, SessionType> {
  if (!isObject(raw)) return {};
  const out: Record<string, SessionType> = {};
  const cutoff = addDays(today, -OVERRIDE_RETENTION_DAYS);
  for (const [date, value] of Object.entries(raw)) {
    if (!isValidISO(date) || !isSessionType(value)) continue;
    if (daysBetween(cutoff, date) < 0) continue; // too old to matter
    out[date] = value;
  }
  return out;
}

function coerceLog(raw: unknown, today: string): Record<string, LogEntry> {
  if (!isObject(raw)) return {};
  const out: Record<string, LogEntry> = {};
  const cutoff = addDays(today, -LOG_RETENTION_DAYS);
  for (const [date, value] of Object.entries(raw)) {
    if (!isValidISO(date) || !isObject(value)) continue;
    if (daysBetween(cutoff, date) < 0) continue;
    const entry: LogEntry = { done: value.done === true };
    if (typeof value.rpe === 'number' && Number.isFinite(value.rpe)) {
      entry.rpe = Math.min(10, Math.max(1, Math.round(value.rpe)));
    }
    if (typeof value.note === 'string' && value.note.trim()) {
      entry.note = value.note.slice(0, 500);
    }
    // A split outside human 1 km range is a typo, not a measurement.
    if (typeof value.splitSec === 'number' && Number.isFinite(value.splitSec)) {
      const split = Math.round(value.splitSec);
      if (split >= MIN_PACE_SEC && split <= MAX_PACE_SEC) entry.splitSec = split;
    }
    out[date] = entry;
  }
  return out;
}

function coerceHeaviestDay(raw: unknown, template: (SessionType | null)[]): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 6) return null;
  // A heaviest day that is not a Hyrox day is meaningless.
  return template[raw] === 'hyrox' ? raw : null;
}

function coerceTimeTrials(raw: unknown, today: string): TimeTrialEntry[] {
  if (!Array.isArray(raw)) return [];
  const cutoff = addDays(today, -TIME_TRIAL_RETENTION_DAYS);
  const out: TimeTrialEntry[] = [];
  for (const value of raw) {
    if (!isObject(value)) continue;
    const { date, meters, seconds } = value;
    if (typeof date !== 'string' || !isValidISO(date)) continue;
    if (typeof meters !== 'number' || !Number.isFinite(meters)) continue;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) continue;
    if (meters < 400 || meters > 21_100) continue;
    if (seconds < 60 || seconds > 4 * 3600) continue;
    if (daysBetween(cutoff, date) < 0) continue;
    out.push({ date, meters: Math.round(meters), seconds: Math.round(seconds) });
  }
  // Newest first: the anchor should follow current fitness, not history.
  return out.sort((a, b) => daysBetween(a.date, b.date)).slice(0, 12);
}

function coerceBenchmarks(raw: unknown): Partial<Record<Station, StationBenchmark>> {
  if (!isObject(raw)) return {};
  const out: Partial<Record<Station, StationBenchmark>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isStation(key) || !isObject(value)) continue;
    const { seconds, testedOn } = value;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) continue;
    if (seconds < 30 || seconds > 3600) continue;
    out[key] = {
      seconds: Math.round(seconds),
      testedOn: typeof testedOn === 'string' && isValidISO(testedOn) ? testedOn : todayISO(),
    };
  }
  return out;
}

/**
 * Turns whatever is in storage into a valid state, whatever shape it is in.
 *
 * Every field falls back independently, so one corrupt value costs that value
 * and not the whole block. This is the reason the app cannot white-screen on
 * bad storage - there is no path from here that returns something unusable.
 */
export function migrate(raw: unknown, today = todayISO()): AppState {
  const base = defaultState(today);
  if (!isObject(raw)) return base;

  const version = typeof raw.version === 'number' ? raw.version : inferVersion(raw);

  // v1 stored `hyroxDays: number[]`; v2 replaced it with a 7-slot array.
  let template: (SessionType | null)[];
  if (version <= 1 && Array.isArray(raw.hyroxDays)) {
    template = [null, null, null, null, null, null, null];
    for (const d of raw.hyroxDays) {
      if (typeof d === 'number' && d >= 0 && d <= 6) template[d] = 'hyrox';
    }
  } else if (version === 2) {
    template = coerceTemplate(raw.dayAssignments);
  } else {
    template = coerceTemplate(raw.weeklyTemplate ?? raw.dayAssignments);
  }

  const raceDate =
    typeof raw.raceDate === 'string' && isValidISO(raw.raceDate) ? raw.raceDate : base.raceDate;

  const pace =
    typeof raw.currentPaceSec === 'number' && Number.isFinite(raw.currentPaceSec)
      ? clampPace(raw.currentPaceSec)
      : base.currentPaceSec;

  let blockStart =
    typeof raw.blockStart === 'string' && isValidISO(raw.blockStart) ? raw.blockStart : today;
  // A block cannot start after the race it builds toward.
  if (daysBetween(blockStart, raceDate) < 0) blockStart = today;

  const goal =
    typeof raw.goalFinishSec === 'number' &&
    Number.isFinite(raw.goalFinishSec) &&
    raw.goalFinishSec >= 1800 &&
    raw.goalFinishSec <= 5 * 3600
      ? Math.round(raw.goalFinishSec)
      : null;

  return {
    version: SCHEMA_VERSION,
    raceDate,
    currentPaceSec: pace,
    weeklyTemplate: template,
    overrides: coerceOverrides(raw.overrides, today),
    log: coerceLog(raw.log, today),
    heaviestDay: coerceHeaviestDay(raw.heaviestDay, template),
    language: raw.language === 'nl' ? 'nl' : 'en',
    blockStart,
    timeTrials: coerceTimeTrials(raw.timeTrials, today),
    stationBenchmarks: coerceBenchmarks(raw.stationBenchmarks),
    division: (DIVISIONS as readonly string[]).includes(raw.division as string)
      ? (raw.division as Division)
      : 'open',
    sex: (SEXES as readonly string[]).includes(raw.sex as string) ? (raw.sex as Sex) : 'male',
    goalFinishSec: goal,
  };
}

function inferVersion(raw: Record<string, unknown>): number {
  if ('timeTrials' in raw || 'stationBenchmarks' in raw) return 4;
  if ('weeklyTemplate' in raw || 'overrides' in raw) return 3;
  if ('dayAssignments' in raw) return 2;
  return 1;
}

/**
 * The logged compromised-run splits that calibrate the station penalty.
 *
 * Only recent ones: a split from four months ago describes an athlete who no
 * longer exists, and the penalty is supposed to track the one who does.
 */
export function recentSplits(
  log: Record<string, LogEntry>,
  today = todayISO(),
): number[] {
  const cutoff = addDays(today, -SPLIT_WINDOW_DAYS);
  return Object.entries(log)
    .filter(([date, entry]) => isValidISO(date) && daysBetween(cutoff, date) >= 0 && entry.splitSec)
    .sort(([a], [b]) => daysBetween(a, b))
    .slice(0, SPLIT_SAMPLE_LIMIT)
    .map(([, entry]) => entry.splitSec as number);
}

/** Validates an imported file before it is allowed to replace live state. */
export function parseImport(text: string, today = todayISO()): AppState | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'not-json' };
  }
  if (!isObject(raw)) return { error: 'not-an-object' };
  if (!('raceDate' in raw) && !('weeklyTemplate' in raw) && !('dayAssignments' in raw)) {
    return { error: 'not-a-hyrox-backup' };
  }
  return migrate(raw, today);
}

export const PACE_BOUNDS = { min: MIN_PACE_SEC, max: MAX_PACE_SEC };
