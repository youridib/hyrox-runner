/**
 * Calendar-date helpers.
 *
 * All dates in the domain are plain local calendar days, represented as ISO
 * `yyyy-mm-dd` strings. Day arithmetic goes through UTC midnight so a DST
 * transition can never shift a result by a day - the old
 * `(b - a) / 86400000` form relied on rounding to survive the 23- and
 * 25-hour days, which is luck rather than design.
 */

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Parses `yyyy-mm-dd`, returning null for anything malformed or non-existent. */
export function parseISO(iso: string): { y: number; m: number; d: number } | null {
  const match = ISO_RE.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Reject dates such as 2025-02-30 that survive the range check.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

export const isValidISO = (iso: string): boolean => parseISO(iso) !== null;

/** UTC-midnight epoch ms for an ISO date. Used only as a stable day index. */
export function isoToUTC(iso: string): number {
  const parts = parseISO(iso);
  if (!parts) throw new RangeError(`Invalid ISO date: ${iso}`);
  return Date.UTC(parts.y, parts.m - 1, parts.d);
}

export function utcToISO(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Whole days from `a` to `b`; negative when `b` is earlier. DST-safe. */
export function daysBetween(a: string, b: string): number {
  return (isoToUTC(b) - isoToUTC(a)) / MS_PER_DAY;
}

export function addDays(iso: string, n: number): string {
  return utcToISO(isoToUTC(iso) + n * MS_PER_DAY);
}

/** 0 = Monday .. 6 = Sunday. */
export function dayOfWeek(iso: string): number {
  return (new Date(isoToUTC(iso)).getUTCDay() + 6) % 7;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -dayOfWeek(iso));
}

/** Today as a local calendar date - the only place the clock is read. */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function dayOfMonth(iso: string): number {
  return parseISO(iso)!.d;
}

/** 0-based month index, for looking up a localised month name. */
export function monthIndex(iso: string): number {
  return parseISO(iso)!.m - 1;
}
