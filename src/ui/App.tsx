import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { paceRange, formatClock, formatPace, per400 } from '../domain/zones';
import { findToday } from '../domain/plan';
import { buildRacePlan, type RacePlan } from '../domain/racePlan';
import { dayOfWeek } from '../domain/dates';
import type { PlannedDay, PlannedWeek, SessionType, Zone } from '../domain/types';
import { store } from '../state/store';
import type { LogEntry } from '../state/schema';
import { useAppState, useDict, usePlan, useToast, useToday } from './hooks';
import { computeStats } from './stats';
import { BlockWeekCard, DayRow, IconGear, TodayCard, shortDate } from './components';
import { SettingsDrawer } from './SettingsDrawer';
import { StationsTab } from './StationsTab';
import type { Dict } from '../i18n';
import { getTips } from '../i18n/tips';

type Tab = 'today' | 'week' | 'block' | 'stations' | 'race';

const TAB_LABELS: Record<Tab, (dict: Dict) => string> = {
  today: (d) => d.tabToday,
  week: (d) => d.tabWeek,
  block: (d) => d.tabBlock,
  stations: (d) => d.tabStations,
  race: (d) => d.tabRace,
};

export function App(): JSX.Element {
  const state = useAppState();
  const today = useToday();
  const dict = useDict(state);
  const plan = usePlan(state, today);
  const [toast, showToast] = useToast();

  const [tab, setTab] = useState<Tab>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = state.language;
  }, [state.language]);

  const todayDay = findToday(plan);
  const currentWeek: PlannedWeek | undefined =
    plan.weeks[plan.currentWeekIndex] ?? plan.weeks.at(-1);

  const stats = useMemo(
    () => computeStats(plan, state.log, today),
    [plan, state.log, today],
  );

  const racePlan = useMemo(
    () =>
      buildRacePlan({
        zones: plan.zones,
        benchmarks: state.stationBenchmarks,
        goalFinishSec: state.goalFinishSec,
        estimates: plan.stationEstimates,
      }),
    [plan.zones, plan.stationEstimates, state.stationBenchmarks, state.goalFinishSec],
  );

  /** Changes one date, or the recurring template from now on. */
  const pick = (day: PlannedDay, type: SessionType | null, scope: 'date' | 'template') => {
    if (scope === 'template') {
      const next = [...state.weeklyTemplate];
      next[day.dayOfWeek] = type;
      store.update({
        weeklyTemplate: next,
        heaviestDay:
          state.heaviestDay === day.dayOfWeek && type !== 'hyrox' ? null : state.heaviestDay,
      });
      return;
    }
    const overrides = { ...state.overrides };
    if (type === null) delete overrides[day.date];
    else overrides[day.date] = type;
    store.update({ overrides });
  };

  const setLog = (date: string, entry: LogEntry | null) => {
    const log = { ...state.log };
    if (entry === null) delete log[date];
    else log[date] = entry;
    store.update({ log });
  };

  const renderDay = (day: PlannedDay) => (
    <DayRow
      key={day.date}
      day={day}
      dict={dict}
      isToday={day.date === today}
      expanded={expandedDay === day.date}
      entry={state.log[day.date]}
      onToggle={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
      onPick={(type, scope) => pick(day, type, scope)}
      onLog={(entry) => setLog(day.date, entry)}
    />
  );

  return (
    <>
      <div class="app">
        <header class="header">
          <div class="wordmark">Hyrox Runner</div>
          <button
            type="button"
            class="settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label={dict.settings}
          >
            <IconGear />
          </button>
        </header>

        <PhaseHero plan={plan} dict={dict} />

        <nav class="tabs" role="tablist">
          {(['today', 'week', 'block', 'stations', 'race'] as const).map((key) => (
            <button
              type="button"
              key={key}
              role="tab"
              aria-selected={tab === key}
              class={`tab${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              {TAB_LABELS[key](dict)}
            </button>
          ))}
        </nav>

        {tab === 'today' && (
          <>
            {/* The taper is 14 days; race week - the fixed part - is 7. */}
            {plan.daysToRace > 0 && plan.daysToRace <= 7 && (
              <div class="race-week-banner">
                <div class="label">{dict.raceWeekTitle}</div>
                <div class="title">{dict.daysToGo(plan.daysToRace)}</div>
                <div class="desc">{dict.raceWeekDesc}</div>
              </div>
            )}
            {todayDay && (
              <>
                <TodayCard day={todayDay} dict={dict} />
                <TipsCard day={todayDay} dict={dict} language={state.language} />
              </>
            )}
            <StatsStrip stats={stats} dict={dict} />
            <PaceZones plan={plan} dict={dict} />
          </>
        )}

        {tab === 'week' && currentWeek && (
          <section class="week">
            <div class="section-title">{dict.thisWeek}</div>
            <div class="section-hint">{dict.thisWeekHint}</div>
            <IntensityStrip week={currentWeek} dict={dict} />
            <div class="week-list">{currentWeek.days.map(renderDay)}</div>
          </section>
        )}

        {tab === 'stations' && (
          <StationsTab plan={plan} racePlan={racePlan} state={state} dict={dict} />
        )}

        {tab === 'race' && <RacePlanCard plan={racePlan} dict={dict} />}

        {tab === 'block' && (
          <section class="week">
            <div class="section-title">{dict.blockTitle}</div>
            <div class="section-hint">{dict.blockHint}</div>
            {plan.weeks.map((week) => (
              <BlockWeekCard
                key={week.monday}
                week={week}
                dict={dict}
                isCurrent={week.index === plan.currentWeekIndex}
                expanded={expandedWeek === week.monday}
                onToggle={() => setExpandedWeek(expandedWeek === week.monday ? null : week.monday)}
                renderDays={() => <div class="week-list">{week.days.map(renderDay)}</div>}
              />
            ))}
          </section>
        )}

        <footer class="footer">
          {dict.footerLine1}
          <br />
          {dict.footerLine2}
        </footer>
      </div>

      {settingsOpen && (
        <SettingsDrawer
          state={state}
          dict={dict}
          onClose={() => setSettingsOpen(false)}
          onToast={showToast}
        />
      )}

      {toast && <div class="toast" role="status">{toast}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ */

function PhaseHero({ plan, dict }: { plan: ReturnType<typeof usePlan>; dict: Dict }): JSX.Element {
  const week = plan.weeks[plan.currentWeekIndex];
  const phase = dict.phase[plan.phase] ?? { label: plan.phase, desc: '' };
  const showProgress = week && week.weekInPhaseTotal && plan.phase !== 'past' && plan.phase !== 'taper';
  const showDeload = week?.isDeload && plan.phase !== 'past' && plan.phase !== 'taper';

  return (
    <section class="phase-hero">
      <div class="phase-eyebrow">
        {shortDate(plan.today, dict)} {'·'} {dict.days.full[dayOfWeek(plan.today)]}
      </div>
      <h1 class="phase-label">{phase.label}</h1>
      {(showProgress || showDeload) && (
        <div class="phase-progress">
          {showProgress && <span>{dict.weekOf(week!.weekInPhase, week!.weekInPhaseTotal!)}</span>}
          {showDeload && <span class="deload-badge">{dict.deloadBadge}</span>}
        </div>
      )}
      <div class="phase-meta">
        {plan.daysToRace < 0 ? (
          <span class="num">{dict.racePassed}</span>
        ) : plan.daysToRace === 0 ? (
          <span class="num">{dict.raceToday}</span>
        ) : (
          <>
            <span class="num">{dict.daysToRace(plan.daysToRace)}</span> {'·'}{' '}
            <span class="num">{shortDate(plan.raceDate, dict)}</span>
          </>
        )}
      </div>
      <p class="phase-desc">{phase.desc}</p>
      {showDeload && (
        <p class="phase-desc" style="color:var(--long);margin-top:8px;">{dict.deloadNote}</p>
      )}
    </section>
  );
}

/**
 * Practical notes for today's session.
 *
 * The Today tab is read-only on purpose: it answers "what am I doing and how
 * do I do it well". Changing or logging a session lives in the Week and Block
 * tabs, where the whole week is in view to change it against.
 */
function TipsCard({
  day,
  dict,
  language,
}: {
  day: PlannedDay;
  dict: Dict;
  language: string;
}): JSX.Element | null {
  const tips = getTips(language, day.effectiveType);
  if (tips.length === 0) return null;

  return (
    <section class="tips-card">
      <div class="log-label">{dict.tipsTitle}</div>
      <ul class="tips-list">
        {day.isDeload && <li class="tips-deload">{dict.deloadTip}</li>}
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}

function StatsStrip({
  stats,
  dict,
}: {
  stats: { done: number; planned: number; streakWeeks: number };
  dict: Dict;
}): JSX.Element {
  return (
    <div class="stats">
      <div class="stat">
        <div class="value">
          {stats.done}/{stats.planned}
        </div>
        <div class="label">{dict.last28Days}</div>
      </div>
      <div class="stat">
        <div class="value">{stats.streakWeeks}</div>
        <div class="label">{dict.streakLabel(stats.streakWeeks)}</div>
      </div>
    </div>
  );
}

/**
 * How much of the week is hard.
 *
 * Hyrox days count as hard here while staying out of the adjacency rules -
 * two separate questions that the original conflated. A week over ~30% hard
 * is a week with no easy days left in it.
 */
function IntensityStrip({ week, dict }: { week: PlannedWeek; dict: Dict }): JSX.Element | null {
  const { hardFraction, totalMin, overloaded } = week.intensity;
  if (totalMin === 0) return null;

  return (
    <div class={`intensity-strip${overloaded ? ' is-warning' : ''}`}>
      <div class="intensity-head">
        <span class="label">{dict.intensityTitle}</span>
        <span class="value">{dict.intensityLabel(Math.round(hardFraction * 100), totalMin)}</span>
      </div>
      <div class="intensity-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.round(hardFraction * 100))}%` }} />
      </div>
      {overloaded && <div class="intensity-warning">{dict.intensityWarning}</div>}
    </div>
  );
}

/**
 * The race plan: every number the app already held, arranged so it can be
 * executed. Runs are flat by design - the average finisher loses 1:53 between
 * run 1 and run 8, and a fast opening is what buys that loss.
 */
function RacePlanCard({ plan, dict }: { plan: RacePlan; dict: Dict }): JSX.Element {
  const stations = [...plan.stations].sort((a, b) => b.secondsAvailable - a.secondsAvailable);
  const goalImpossible = plan.goalPaceSec !== null && plan.goalPaceSec < 120;

  return (
    <section class="race-plan">
      <div class="section-title">{dict.racePlanTitle}</div>
      <div class="section-hint">{dict.racePlanHint}</div>

      <div class="race-finish">
        <div class="race-finish-value">{formatClock(plan.predictedFinishSec)}</div>
        <div class="race-finish-label">{dict.predictedFinish}</div>
        <div class="section-hint">{dict.predictedFinishHint}</div>
        {plan.goalFinishSec !== null && (
          <div class="race-goal">
            <span>
              {dict.goalFinishLabel} {formatClock(plan.goalFinishSec)}
            </span>
            {goalImpossible ? (
              <span class="race-goal-warn">{dict.goalImpossible}</span>
            ) : (
              <span>
                {dict.goalPaceLabel}: {formatPace(plan.goalPaceSec as number)}/km
              </span>
            )}
          </div>
        )}
      </div>

      <div class="race-block">
        <div class="race-block-title">{dict.runScheduleTitle}</div>
        <div class="section-hint">{dict.runScheduleHint}</div>
        <div class="race-runs">
          {plan.runs.map((run) => (
            <div class="race-run" key={run.index}>
              <span class="label">{dict.runLabel(run.index)}</span>
              <span class="value">{formatPace(run.seconds)}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="race-block">
        <div class="race-block-title">{dict.stationTargetsTitle}</div>
        <div class="section-hint">{dict.stationTargetsHint}</div>
        <div class="race-stations">
          {stations.map((station) => (
            <div class="race-station" key={station.station}>
              <span class="label">
                {dict.stations[station.station]}
                {station.estimated && <span class="est">{dict.estimatedMark}</span>}
              </span>
              <span class="value">{formatPace(station.seconds)}</span>
              <span class="target">
                {dict.targetTimeLabel} {formatPace(station.targetSeconds)}
              </span>
              <span class={`gap${station.secondsAvailable > 0 ? ' is-gap' : ''}`}>
                {station.secondsAvailable > 0
                  ? `+${formatPace(station.secondsAvailable)}`
                  : `−${formatPace(Math.abs(station.secondsAvailable))}`}
              </span>
            </div>
          ))}
        </div>
        <div class="section-hint">{dict.estimatedHint}</div>
      </div>

      <div class="race-block">
        <div class="race-block-title">{dict.roxzoneTitle}</div>
        <div class="race-roxzone">
          {dict.roxzoneBudget(8, `${plan.transitionSec} s`, formatClock(plan.roxzoneSec))}
        </div>
        <div class="section-hint">{dict.roxzoneHint}</div>
      </div>

      <div class="race-block">
        <div class="race-block-title">{dict.preRaceTitle}</div>
        <ul class="tips-list">
          {dict.preRaceSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PaceZones({ plan, dict }: { plan: ReturnType<typeof usePlan>; dict: Dict }): JSX.Element {
  const rows: Array<[string, Zone, string]> = [
    [dict.zones.easy!, plan.zones.easy, 'long'],
    [dict.zones.threshold!, plan.zones.threshold, 'tempo'],
    [dict.zones.target!, plan.zones.target, 'compromised'],
    [dict.zones.vo2!, plan.zones.vo2, 'intervals'],
    [dict.zones.strides!, plan.zones.strides, 'race'],
  ];

  return (
    <section class="pace-zones">
      <div class="section-title">
        {dict.paceZones} {'·'}{' '}
        {dict.paceZonesSub(formatPace(Math.round((plan.zones.target.low + plan.zones.target.high) / 2)))}
      </div>
      <div class="section-hint">
        {plan.anchor.source === 'twoPoint' ? dict.anchorTwoPoint : dict.anchorSinglePoint} {'·'}{' '}
        {dict.anchorDecay(plan.anchor.decaySec)}
      </div>
      <div class="pace-zone-list">
        {rows.map(([label, zone, color]) => (
          <div class="pace-zone-row" key={label}>
            <div class="label">
              <span class="dot" style={{ background: `var(--${color})` }} />
              {label}
            </div>
            <div class="value">{paceRange(zone)}</div>
            <div class="per400">{per400(zone)}/400m</div>
          </div>
        ))}
      </div>
    </section>
  );
}
