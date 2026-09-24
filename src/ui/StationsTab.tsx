import type { JSX } from 'preact';
import { daysBetween, todayISO } from '../domain/dates';
import { BENCHMARK_STALE_DAYS, stationP25 } from '../domain/stations';
import { STATIONS, type Station } from '../domain/types';
import { formatClock, formatPace } from '../domain/zones';
import type { Plan } from '../domain/plan';
import type { RacePlan } from '../domain/racePlan';
import type { Dict } from '../i18n';
import { store } from '../state/store';
import { TimeField } from './components';
import type { AppState } from '../state/schema';

/* ------------------------------------------------------------------ */

export interface StationsTabProps {
  plan: Plan;
  racePlan: RacePlan;
  state: AppState;
  dict: Dict;
}

/**
 * The stations, scored on their own.
 *
 * They are 40% of the race and carry most of its spread, so they get a tab
 * rather than a corner of the settings drawer. Every station always shows a
 * number: your own once you have tested it, otherwise what your goal finish
 * or your current pace implies - and the ranking is in seconds available
 * against the population 25th percentile, which is where the time actually is.
 */
export function StationsTab({ plan, racePlan, state, dict }: StationsTabProps): JSX.Element {
  const today = todayISO();

  const setBenchmark = (station: Station, seconds: number | null) => {
    const existing = state.stationBenchmarks[station];
    if (seconds !== null && seconds === existing?.seconds) return;
    if (seconds === null && existing === undefined) return;

    const benchmarks = { ...state.stationBenchmarks };
    if (seconds === null) delete benchmarks[station];
    else if (seconds < 30 || seconds > 3600) return;
    else benchmarks[station] = { seconds, testedOn: today };
    store.update({ stationBenchmarks: benchmarks });
  };

  const tested = STATIONS.filter((s) => state.stationBenchmarks[s] !== undefined).length;
  const estimatingFrom = STATIONS.map((s) => plan.stationEstimates[s]).find(
    (estimate) => estimate.source !== 'benchmark',
  )?.source;

  const hasGoal = racePlan.goalFinishSec !== null;

  /**
   * The gap worth showing on a row.
   *
   * With a goal, only a measured station has one: an untested station's time
   * *is* its goal target, so the difference is zero and says nothing. Without
   * a goal every row is measured against the field instead.
   */
  const gapOf = (row: (typeof racePlan.stations)[number]): number | null => {
    if (!hasGoal) return row.secondsAvailable;
    return row.estimated ? null : row.goalGapSeconds;
  };

  // Worst first: what you are furthest behind your goal on, then the stations
  // you have not tested, biggest target first - the most time still at stake.
  const rows = [...racePlan.stations].sort((a, b) => {
    const rank = (row: (typeof racePlan.stations)[number]): [number, number] =>
      gapOf(row) === null ? [1, row.goalTargetSeconds ?? row.seconds] : [0, gapOf(row) as number];
    const [groupA, valueA] = rank(a);
    const [groupB, valueB] = rank(b);
    return groupA - groupB || valueB - valueA;
  });

  return (
    <section class="stations-tab">
      <div class="section-title">{dict.stationsTitle}</div>
      <div class="section-hint">{dict.stationsHint}</div>

      <div class="station-goal">
        <label class="setting-label" for="goal-finish-left">{dict.goalFinishSetting}</label>
        <TimeField
          id="goal-finish"
          hours
          value={state.goalFinishSec}
          placeholder={racePlan.predictedFinishSec}
          leftLabel={dict.goalHoursLabel}
          rightLabel={dict.goalMinutesLabel}
          onCommit={(seconds) =>
            store.update({
              // Outside this range it is a typo, and storage would drop it on
              // the next load anyway.
              goalFinishSec:
                seconds !== null && seconds >= 1800 && seconds <= 5 * 3600 ? seconds : null,
            })
          }
        />
        <div class="setting-hint">
          {estimatingFrom === 'goal'
            ? dict.estimateFromGoal
            : estimatingFrom === 'pace'
              ? dict.estimateFromPace(formatPace(racePlan.targetPaceSec))
              : dict.estimateAllMeasured}
        </div>
      </div>

      <div class="station-rows">
        {rows.map((row) => {
          const mark = state.stationBenchmarks[row.station];
          const stale = mark ? daysBetween(mark.testedOn, today) > BENCHMARK_STALE_DAYS : false;
          const gap = gapOf(row);
          const ahead = gap !== null && gap <= 0;
          return (
            <div class={`station-row${mark ? ' is-measured' : ''}`} key={row.station}>
              <div class="station-row-head">
                <span class="station-name">
                  {dict.stations[row.station]}
                  {!mark && <span class="est">{dict.estimatedMark}</span>}
                  {stale && <span class="stale">{dict.benchmarkStale}</span>}
                </span>
                {gap !== null && (
                  <span class={`station-gap${ahead ? ' is-ahead' : ''}`}>
                    {ahead ? `−${formatPace(Math.abs(gap))}` : `+${formatPace(gap)}`}
                  </span>
                )}
              </div>

              <div class="station-row-body">
                <TimeField
                  id={`bm-${row.station}`}
                  value={mark?.seconds ?? null}
                  placeholder={row.seconds}
                  leftLabel={dict.minutesLabel}
                  rightLabel={dict.secondsLabel}
                  onCommit={(seconds) => setBenchmark(row.station, seconds)}
                />
                {/* Both numbers: what your goal needs here, and what the
                    field's 25th percentile does. */}
                <span class="station-target">
                  {row.goalTargetSeconds !== null && (
                    <span class="goal">
                      {dict.goalShort} {formatPace(row.goalTargetSeconds)}
                    </span>
                  )}
                  <span class="field">
                    {dict.fieldShort} {formatPace(stationP25(row.station))}
                  </span>
                </span>
                {mark && (
                  <button
                    type="button"
                    class="station-clear"
                    aria-label={dict.clearBenchmark}
                    title={dict.clearBenchmark}
                    onClick={() => setBenchmark(row.station, null)}
                  >
                    {'×'}
                  </button>
                )}
              </div>

              {/* How much of this station's time is above its target. */}
              {gap !== null && (
                <div class="station-bar" aria-hidden="true">
                  <span
                    class={ahead ? 'is-ahead' : ''}
                    style={{
                      width: `${Math.min(100, Math.round((Math.abs(gap) / Math.max(1, row.seconds)) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div class={`station-totals${racePlan.goalOverrunSec > 0 ? ' is-over' : ''}`}>
        <div class="station-total-row">
          <span>{dict.stationTotalLabel}</span>
          <span class="value">{formatClock(racePlan.stationTotalSec)}</span>
        </div>
        <div class="station-total-row">
          {/* With a goal set the untested stations are what the goal requires
              of them, so the total is the goal - not a prediction. */}
          <span>{hasGoal ? dict.requiredFinish : dict.predictedFinish}</span>
          <span class="value">{formatClock(racePlan.predictedFinishSec)}</span>
        </div>
        {racePlan.goalOverrunSec > 0 && (
          <div class="station-total-row is-over">
            <span>{dict.goalOverBy}</span>
            <span class="value">{formatClock(racePlan.goalOverrunSec)}</span>
          </div>
        )}
      </div>

      {racePlan.goalOverrunSec > 0 && (
        <div class="station-overrun">{dict.goalOverrunHint(formatPace(racePlan.targetPaceSec))}</div>
      )}

      <div class="section-hint">
        {dict.stationsTestedLabel(tested, STATIONS.length)} {'·'} {dict.stationsFooterHint}
      </div>
    </section>
  );
}
