import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { dayOfMonth, monthIndex } from '../domain/dates';
import { MAX_PACE_SEC, MIN_PACE_SEC } from '../domain/zones';
import type { PlannedDay, PlannedWeek, SessionType } from '../domain/types';
import { SESSION_TYPES } from '../domain/types';
import { renderSession, type Dict } from '../i18n';
import type { LogEntry } from '../state/schema';

export const EM_DASH = '—';

export const shortDate = (iso: string, dict: Dict): string =>
  `${dayOfMonth(iso)} ${dict.months[monthIndex(iso)]}`;

/**
 * Two numeric fields for a duration, because a single `m:ss` text box asks
 * for a colon that a phone's numeric keypad does not have - which left the
 * field accepting whole minutes and nothing else.
 */
export interface TimeFieldProps {
  id: string;
  /** Current value in seconds, or null when nothing is set. */
  value: number | null;
  /** Shown greyed when there is no value: the estimate this row is using. */
  placeholder: number | null;
  leftLabel: string;
  rightLabel: string;
  /** Left field is hours when true, minutes otherwise. */
  hours?: boolean;
  onCommit: (seconds: number | null) => void;
}

const split = (seconds: number | null, hours: boolean): [string, string] => {
  if (seconds === null) return ['', ''];
  const unit = hours ? 3600 : 60;
  const left = Math.floor(seconds / unit);
  const right = hours ? Math.round((seconds % 3600) / 60) : Math.round(seconds % 60);
  return [String(left), String(right).padStart(2, '0')];
};

export function TimeField({
  id, value, placeholder, leftLabel, rightLabel, hours = false, onCommit,
}: TimeFieldProps): JSX.Element {
  const [committed, setCommitted] = useState(value);
  const [draft, setDraft] = useState(() => split(value, hours));

  // Follow the store when it changes underneath us, but never while the user
  // is mid-edit: that is what used to eat keystrokes in the pace field.
  if (value !== committed) {
    setCommitted(value);
    setDraft(split(value, hours));
  }

  const commit = () => {
    const [left, right] = draft;
    if (left.trim() === '' && right.trim() === '') {
      onCommit(null);
      return;
    }
    const unit = hours ? 3600 : 60;
    const l = Math.max(0, Number.parseInt(left, 10) || 0);
    const r = Math.min(59, Math.max(0, Number.parseInt(right, 10) || 0));
    const seconds = l * unit + r * (hours ? 60 : 1);
    onCommit(seconds > 0 ? seconds : null);
  };

  const [placeLeft, placeRight] = split(placeholder, hours);

  return (
    <div class="time-field">
      <input
        type="number"
        class="time-input"
        id={`${id}-left`}
        inputMode="numeric"
        min={0}
        max={hours ? 9 : 59}
        step={1}
        aria-label={leftLabel}
        placeholder={placeLeft || '0'}
        value={draft[0]}
        onInput={(e) => setDraft([(e.target as HTMLInputElement).value, draft[1]])}
        onBlur={commit}
      />
      <span class="time-sep">:</span>
      <input
        type="number"
        class="time-input"
        id={`${id}-right`}
        inputMode="numeric"
        min={0}
        max={59}
        step={hours ? 1 : 5}
        aria-label={rightLabel}
        placeholder={placeRight || '00'}
        value={draft[1]}
        onInput={(e) => setDraft([draft[0], (e.target as HTMLInputElement).value])}
        onBlur={commit}
      />
    </div>
  );
}

export const IconGear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 10v6m8.66-15.66-4.24 4.24m-8.84 8.84L3.34 20.66M23 12h-6m-10 0H1m20.66 8.66-4.24-4.24m-8.84-8.84L3.34 3.34" />
  </svg>
);

export const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.8" stroke-linecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* ------------------------------------------------------------------ */

export function TodayCard({ day, dict }: { day: PlannedDay; dict: Dict }): JSX.Element {
  const session = renderSession(day.session, dict);
  return (
    <section class="today" style={{ '--accent-glow': `var(--${session.color})` }}>
      <div class="today-eyebrow">
        <span>
          {dict.todayLabel} {'·'} {shortDate(day.date, dict)}
        </span>
        {day.isRaceDay && <span style="color:var(--race);">{'●'} {dict.raceDayLabel}</span>}
        {day.overrideType && !day.isRaceDay && (
          <span style="color:var(--text-dim);">{'●'} {dict.pinnedLabel}</span>
        )}
        {day.isDeload && <span class="deload-badge">{dict.deloadBadge}</span>}
      </div>
      <h2 class="today-title">
        <span class="dot" style={{ background: `var(--${session.color})`, color: `var(--${session.color})` }} />
        {session.title}
      </h2>
      {session.pace !== EM_DASH && <div class="today-pace">{session.pace}</div>}
      <div class="today-details">{session.details}</div>
      {session.why && <div class="today-why">{session.why}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */

export interface LogPanelProps {
  date: string;
  entry: LogEntry | undefined;
  dict: Dict;
  /** Compromised runs ask for the 1 km split; nothing else does. */
  askForSplit?: boolean;
  onChange: (next: LogEntry | null) => void;
}

export function LogPanel({ date, entry, dict, askForSplit, onChange }: LogPanelProps): JSX.Element {
  const done = entry?.done ?? false;
  return (
    <div class="log-block">
      <div class="log-label">{dict.logTitle}</div>
      <div class="log-row">
        <button
          type="button"
          class={`done-btn${done ? ' is-done' : ''}`}
          aria-pressed={done}
          onClick={() => onChange(done ? null : { ...entry, done: true })}
        >
          {done ? `✓ ${dict.markedDone}` : dict.markDone}
        </button>
        {done && (
          <button type="button" class="done-btn" onClick={() => onChange(null)}>
            {dict.undo}
          </button>
        )}
      </div>

      {done && (
        <>
          <div class="log-label" style="margin-top:16px;">{dict.rpeLabel}</div>
          <div class="rpe-scale">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                type="button"
                key={n}
                class={`rpe-chip${entry?.rpe === n ? ' active' : ''}`}
                aria-pressed={entry?.rpe === n}
                onClick={() =>
                  onChange({ ...entry, done: true, rpe: entry?.rpe === n ? undefined : n })
                }
              >
                {n}
              </button>
            ))}
          </div>
          {askForSplit && (
            <>
              <div class="log-label" style="margin-top:16px;">{dict.splitLabel}</div>
              <TimeField
                id={`split-${date}`}
                value={entry?.splitSec ?? null}
                placeholder={null}
                leftLabel={dict.minutesLabel}
                rightLabel={dict.secondsLabel}
                onCommit={(seconds) => {
                  // A split outside human 1 km range is a typo. Storing it
                  // would drag the station penalty around until the next
                  // reload threw it away again.
                  const usable =
                    seconds !== null && seconds >= MIN_PACE_SEC && seconds <= MAX_PACE_SEC;
                  onChange({ ...entry, done: true, splitSec: usable ? seconds : undefined });
                }}
              />
              <div class="section-hint">{dict.splitHint}</div>
            </>
          )}
          <textarea
            class="note-input"
            rows={2}
            placeholder={dict.notePlaceholder}
            aria-label={dict.noteLabel}
            value={entry?.note ?? ''}
            onInput={(e) =>
              onChange({ ...entry, done: true, note: (e.target as HTMLTextAreaElement).value })
            }
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PICKER_TYPES: (SessionType | '')[] = ['', ...SESSION_TYPES];

export interface TypePickerProps {
  day: PlannedDay;
  dict: Dict;
  onPick: (type: SessionType | null, scope: 'date' | 'template') => void;
}

/**
 * Lets the user change a day's session, and - crucially - say whether they
 * mean just this date or every week. The original had only the second
 * behaviour, so a one-off change silently became permanent.
 */
export function TypePicker({ day, dict, onPick }: TypePickerProps): JSX.Element {
  const [scope, setScope] = useState<'date' | 'template'>('date');
  const current = scope === 'date' ? day.overrideType : day.templateType;

  return (
    <>
      <div class="type-picker-label">{dict.sessionType}</div>
      <div class="scope-picker" role="group" aria-label={dict.scopeHint}>
        <button
          type="button"
          class={`scope-btn${scope === 'date' ? ' active' : ''}`}
          onClick={() => setScope('date')}
        >
          {dict.onlyThisDay}
        </button>
        <button
          type="button"
          class={`scope-btn${scope === 'template' ? ' active' : ''}`}
          onClick={() => setScope('template')}
        >
          {dict.everyWeek}
        </button>
      </div>
      <div class="section-hint" style="margin-bottom:10px;">{dict.scopeHint}</div>
      <div class="type-picker">
        {PICKER_TYPES.map((key) => (
          <button
            type="button"
            key={key}
            class={`type-chip${key === '' ? ' type-auto' : ''}${(current ?? '') === key ? ' active' : ''}`}
            onClick={() => onPick(key === '' ? null : key, scope)}
          >
            {key === '' ? dict.types.auto : dict.types[key]}
          </button>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

export interface DayRowProps {
  day: PlannedDay;
  dict: Dict;
  isToday: boolean;
  expanded: boolean;
  entry: LogEntry | undefined;
  onToggle: () => void;
  onPick: (type: SessionType | null, scope: 'date' | 'template') => void;
  onLog: (next: LogEntry | null) => void;
}

export function DayRow({
  day, dict, isToday, expanded, entry, onToggle, onPick, onLog,
}: DayRowProps): JSX.Element {
  const session = renderSession(day.session, dict);
  const classes = ['day-row'];
  if (isToday) classes.push('is-today');
  if (day.isRaceDay) classes.push('is-race');
  if (expanded) classes.push('is-expanded');
  if (day.isDeload) classes.push('is-deload');

  return (
    <div class={classes.join(' ')}>
      <div
        class="day-row-header"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div class="day-row-label">
          <span>
            {dict.days.short[day.dayOfWeek]} {dayOfMonth(day.date)}
          </span>
          {day.overrideType && !day.isRaceDay && <span class="pin-dot" title={dict.pinnedLabel} />}
          {entry?.done && <span style="color:var(--long);font-size:11px;">{'✓'}</span>}
        </div>
        <div class="day-row-title">
          <span class="dot" style={{ background: `var(--${session.color})` }} />
          <span>{session.title}</span>
        </div>
        <div class="day-row-caret">{'›'}</div>
      </div>

      {expanded && (
        <div class="day-row-expanded">
          {!day.isRaceDay && <TypePicker day={day} dict={dict} onPick={onPick} />}
          {session.pace !== EM_DASH && <div class="pace-line">{session.pace}</div>}
          <div>{session.details}</div>
          {session.why && <div class="why">{session.why}</div>}
          {day.effectiveType !== 'rest' && (
            <LogPanel
              date={day.date}
              entry={entry}
              dict={dict}
              askForSplit={day.effectiveType === 'compromised'}
              onChange={onLog}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface BlockWeekProps {
  week: PlannedWeek;
  dict: Dict;
  isCurrent: boolean;
  expanded: boolean;
  onToggle: () => void;
  renderDays: () => JSX.Element;
}

export function BlockWeekCard({
  week, dict, isCurrent, expanded, onToggle, renderDays,
}: BlockWeekProps): JSX.Element {
  const classes = ['block-week'];
  if (isCurrent) classes.push('is-current');
  if (week.containsRaceDay) classes.push('is-race');

  const label = week.containsRaceDay
    ? dict.raceWeekTitle
    : dict.phase[week.phase]?.label ?? week.phase;

  return (
    <div class={classes.join(' ')}>
      <div
        class="block-week-header"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div>
          <div class="block-week-title">
            {label}
            {week.isDeload && !week.containsRaceDay && (
              <span class="deload-badge" style="margin-left:8px;">{dict.deloadBadge}</span>
            )}
            {isCurrent && (
              <span style="margin-left:8px;color:var(--text-dim);font-size:11px;">
                {dict.todayLabel}
              </span>
            )}
          </div>
          <div class="block-week-sub">
            {shortDate(week.monday, dict)}
            {/* Race week is one week by definition, so "week 1 of 1" is noise. */}
            {week.weekInPhaseTotal && week.weekInPhaseTotal > 1 && !week.containsRaceDay
              ? ` · ${dict.blockWeekLabel(week.weekInPhase, week.weekInPhaseTotal)}`
              : ''}
          </div>
        </div>
        <div class="block-dots" aria-hidden="true">
          {week.days.map((day) => (
            <span
              key={day.date}
              class={`block-dot${day.effectiveType === 'rest' ? ' muted' : ''}`}
              style={{ background: `var(--${day.session.color})` }}
            />
          ))}
        </div>
      </div>
      {expanded && <div class="block-week-body">{renderDays()}</div>}
    </div>
  );
}
