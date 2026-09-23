import { addDays, daysBetween, isValidISO, todayISO } from '../domain/dates';
import { SESSION_TYPES, type SessionType } from '../domain/types';
import { MAX_PACE_SEC, MIN_PACE_SEC, clampPace } from '../domain/zones';

export const SCHEMA_VERSION = 3;
export const STORAGE_KEY = 'hyroxRunner.v3';
export const LEGACY_KEYS = ['hyroxRunner.v2', 'hyroxRunner.v1'] as const;

export type Language = 'en' | 'nl';

export interface LogEntry {
  done: boolean;
  /** Rate of perceived exertion, 1-10. */
  rpe?: number;
  note?: string;
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
}

export const DEFAULT_TEMPLATE: (SessionType | null)[] = [
  'hyrox', null, 'hyrox', null, null, 'hyrox', null,
];

/** Overrides this far in the past can never affect a future plan. */
const OVERRIDE_RETENTION_DAYS = 120;
/** Keep roughly two years of training history. */
const LOG_RETENTION_DAYS = 730;

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
  };
}

const isSessionType = (v: unknown): v is SessionType =>
  typeof v === 'string' && (SESSION_TYPES as readonly string[]).includes(v);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

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
    out[date] = entry;
  }
  return out;
}

function coerceHeaviestDay(raw: unknown, template: (SessionType | null)[]): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 6) return null;
  // A heaviest day that is not a Hyrox day is meaningless.
  return template[raw] === 'hyrox' ? raw : null;
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
  };
}

function inferVersion(raw: Record<string, unknown>): number {
  if ('weeklyTemplate' in raw || 'overrides' in raw) return 3;
  if ('dayAssignments' in raw) return 2;
  return 1;
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
