import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatClock, formatPace } from '../domain/zones';
import { todayISO } from '../domain/dates';
import { DIVISIONS, SEXES, type Division, type Sex } from '../domain/types';
import type { Dict } from '../i18n';
import { parseImport, type AppState } from '../state/schema';
import { store } from '../state/store';
import { IconClose, TimeField, shortDate } from './components';

export interface SettingsDrawerProps {
  state: AppState;
  dict: Dict;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function SettingsDrawer({ state, dict, onClose, onToast }: SettingsDrawerProps): JSX.Element {
  const fileInput = useRef<HTMLInputElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  // Local pace fields so typing is not fought by a re-render on every keystroke.
  const [paceMin, setPaceMin] = useState(String(Math.floor(state.currentPaceSec / 60)));
  const [paceSec, setPaceSec] = useState(String(state.currentPaceSec % 60).padStart(2, '0'));
  const [ttMeters, setTtMeters] = useState('');
  const [ttTime, setTtTime] = useState<number | null>(null);

  const today = todayISO();

  /**
   * A time trial is an upgrade to the pace anchor, not a replacement for it:
   * two efforts at different distances give a real critical speed, one still
   * leaves the single-point estimate in place.
   */
  const addTimeTrial = () => {
    const meters = Number.parseInt(ttMeters, 10);
    const seconds = ttTime;
    // The same bounds the schema enforces on read. Accepting anything wider
    // here would store a trial that quietly vanishes on the next load.
    if (!Number.isFinite(meters) || meters < 400 || meters > 21_100) return;
    if (seconds === null || seconds < 60 || seconds > 4 * 3600) return;
    store.update({
      timeTrials: [{ date: today, meters, seconds }, ...state.timeTrials].slice(0, 12),
    });
    setTtMeters('');
    setTtTime(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    drawer.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const commitPace = () => {
    const min = Math.min(10, Math.max(2, Number.parseInt(paceMin, 10) || 5));
    const sec = Math.min(59, Math.max(0, Number.parseInt(paceSec, 10) || 0));
    store.update({ currentPaceSec: min * 60 + sec });
    setPaceMin(String(min));
    setPaceSec(String(sec).padStart(2, '0'));
  };

  const hyroxDays = state.weeklyTemplate
    .map((v, i) => (v === 'hyrox' ? i : -1))
    .filter((i) => i >= 0);

  const toggleHyrox = (day: number) => {
    const next = [...state.weeklyTemplate];
    next[day] = next[day] === 'hyrox' ? null : 'hyrox';
    store.update({
      weeklyTemplate: next,
      heaviestDay: next[day] === 'hyrox' || state.heaviestDay !== day ? state.heaviestDay : null,
    });
  };

  const doExport = () => {
    const blob = new Blob([store.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hyrox-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download on iOS Safari.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const result = parseImport(text);
    if ('error' in result) {
      onToast(dict.importFailed(result.error));
      return;
    }
    store.replace(result);
    onToast(dict.importOk);
  };

  return (
    <>
      <div class="drawer-backdrop" onClick={onClose} />
      <div class="drawer" role="dialog" aria-modal="true" aria-label={dict.settings} ref={drawer} tabIndex={-1}>
        <div class="drawer-handle" />
        <div class="drawer-title">
          {dict.settings}
          <button type="button" class="drawer-close" onClick={onClose} aria-label={dict.close}>
            <IconClose />
          </button>
        </div>

        {store.storageBroken && <div class="banner warn">{dict.storageWarning}</div>}

        <div class="setting-group">
          <label class="setting-label">{dict.language}</label>
          <div class="lang-switch">
            {(['en', 'nl'] as const).map((lang) => (
              <button
                type="button"
                key={lang}
                class={`lang-btn${state.language === lang ? ' active' : ''}`}
                onClick={() => {
                  store.update({ language: lang });
                  document.documentElement.lang = lang;
                }}
              >
                {lang === 'en' ? 'English' : 'Nederlands'}
              </button>
            ))}
          </div>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="race-date-input">{dict.raceDate}</label>
          <input
            type="date"
            class="date-input"
            id="race-date-input"
            value={state.raceDate}
            onChange={(e) => {
              const value = (e.target as HTMLInputElement).value;
              if (value) store.update({ raceDate: value });
            }}
          />
        </div>

        <div class="setting-group">
          <label class="setting-label">{dict.currentPace}</label>
          <div class="pace-input-group">
            <input
              type="number" class="pace-input" id="pace-min-input"
              min={2} max={10} step={1} inputMode="numeric"
              value={paceMin}
              onInput={(e) => setPaceMin((e.target as HTMLInputElement).value)}
              onBlur={commitPace}
            />
            <span class="pace-sep">:</span>
            <input
              type="number" class="pace-input" id="pace-sec-input"
              min={0} max={59} step={1} inputMode="numeric"
              value={paceSec}
              onInput={(e) => setPaceSec((e.target as HTMLInputElement).value)}
              onBlur={commitPace}
            />
            <span class="pace-unit">{dict.paceUnit}</span>
          </div>
          <div class="setting-hint">
            {dict.paceHint} {'·'} {formatPace(state.currentPaceSec)}/km
          </div>
        </div>

        <div class="setting-group">
          <label class="setting-label">{dict.timeTrialTitle}</label>
          <div class="pace-input-group">
            <input
              type="number" class="pace-input wide" id="tt-meters-input"
              min={400} max={21100} step={100} inputMode="numeric"
              aria-label={dict.ttDistanceLabel}
              placeholder="1200"
              value={ttMeters}
              onInput={(e) => setTtMeters((e.target as HTMLInputElement).value)}
            />
            <TimeField
              id="tt-time"
              value={ttTime}
              placeholder={null}
              leftLabel={dict.minutesLabel}
              rightLabel={dict.secondsLabel}
              onCommit={setTtTime}
            />
            <button type="button" class="data-btn" onClick={addTimeTrial}>{dict.ttAddBtn}</button>
          </div>
          <div class="tt-list">
            {state.timeTrials.length === 0 && <div class="setting-hint">{dict.ttEmpty}</div>}
            {state.timeTrials.map((trial) => (
              <div class="tt-row" key={`${trial.date}-${trial.meters}-${trial.seconds}`}>
                <span>{dict.ttEntry(trial.meters, formatClock(trial.seconds), shortDate(trial.date, dict))}</span>
                <button
                  type="button"
                  class="tt-remove"
                  aria-label={dict.ttRemove}
                  onClick={() =>
                    store.update({
                      timeTrials: state.timeTrials.filter((t) => t !== trial),
                    })
                  }
                >
                  {'×'}
                </button>
              </div>
            ))}
          </div>
          <div class="setting-hint">{dict.timeTrialHint}</div>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="division-select">{dict.divisionLabel}</label>
          <select
            class="select-input"
            id="division-select"
            value={state.division}
            onChange={(e) =>
              store.update({ division: (e.target as HTMLSelectElement).value as Division })
            }
          >
            {DIVISIONS.map((division) => (
              <option key={division} value={division}>{dict.divisions[division]}</option>
            ))}
          </select>
          <div class="setting-hint">{dict.divisionHint}</div>
          <div class="lang-switch" style="margin-top:10px;">
            {SEXES.map((sex) => (
              <button
                type="button"
                key={sex}
                class={`lang-btn${state.sex === sex ? ' active' : ''}`}
                onClick={() => store.update({ sex: sex as Sex })}
              >
                {dict.sexes[sex]}
              </button>
            ))}
          </div>
        </div>

        <div class="setting-group">
          <label class="setting-label">{dict.hyroxDays}</label>
          <div class="day-picker">
            {dict.days.two.map((label, i) => (
              <button
                type="button"
                key={label + i}
                class={`day-picker-btn${state.weeklyTemplate[i] === 'hyrox' ? ' active' : ''}`}
                aria-pressed={state.weeklyTemplate[i] === 'hyrox'}
                onClick={() => toggleHyrox(i)}
              >
                {label}
              </button>
            ))}
          </div>
          <div class="setting-hint">{dict.hyroxDaysHint}</div>
        </div>

        <div class="setting-group">
          <label class="setting-label" for="heaviest-day-select">{dict.heaviestDay}</label>
          <select
            class="select-input"
            id="heaviest-day-select"
            disabled={hyroxDays.length === 0}
            value={state.heaviestDay === null ? '' : String(state.heaviestDay)}
            onChange={(e) => {
              const value = (e.target as HTMLSelectElement).value;
              store.update({ heaviestDay: value === '' ? null : Number.parseInt(value, 10) });
            }}
          >
            <option value="">{dict.variesWeekly}</option>
            {hyroxDays.map((i) => (
              <option key={i} value={String(i)}>{dict.days.full[i]}</option>
            ))}
          </select>
          <div class="setting-hint">{dict.heaviestDayHint}</div>
        </div>

        <div class="setting-group">
          <label class="setting-label">{dict.dataTitle}</label>
          <div class="data-row">
            <button type="button" class="data-btn" onClick={doExport}>{dict.exportBtn}</button>
            <button type="button" class="data-btn" onClick={() => fileInput.current?.click()}>
              {dict.importBtn}
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            style="display:none"
            onChange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) void doImport(file);
              (e.target as HTMLInputElement).value = '';
            }}
          />
          <div class="setting-hint">{dict.exportHint}</div>
        </div>

        <div
          class="setting-group"
          style="padding-top:16px;border-top:1px solid var(--border);margin-top:24px;"
        >
          <div class="data-row">
            <button
              type="button"
              class="data-btn"
              onClick={() => {
                store.update({
                  weeklyTemplate: ['hyrox', null, 'hyrox', null, null, 'hyrox', null],
                  heaviestDay: null,
                  overrides: {},
                });
              }}
            >
              {dict.resetWeek}
            </button>
            <button
              type="button"
              class="data-btn"
              onClick={() => {
                if (confirm(dict.restartBlockConfirm)) store.update({ blockStart: todayISO() });
              }}
            >
              {dict.restartBlock}
            </button>
          </div>
          <div class="setting-hint">{dict.restartBlockHint}</div>
        </div>
      </div>
    </>
  );
}
