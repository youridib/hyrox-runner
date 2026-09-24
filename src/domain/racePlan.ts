import {
  STATION_REFERENCE,
  TRANSITION_COUNT,
  TRANSITION_TARGET_SEC,
  stationP25,
} from './stations';
import { STATIONS, type Station, type StationBenchmark, type Zones } from './types';
import { midPace } from './zones';

/**
 * The race plan.
 *
 * Everything here already existed in the app as separate numbers: a target
 * pace, station benchmarks, a transition target. Putting them in one place is
 * what turns them into a plan you can execute, which is the highest ratio of
 * race-day benefit to implementation effort in the whole review.
 */

export const RUN_COUNT = 8;

export interface RunSplit {
  /** 1-8. */
  index: number;
  /** Prescribed seconds for this kilometre. */
  seconds: number;
}

export interface StationTarget {
  station: Station;
  /** The athlete's benchmark, or the population average when untested. */
  seconds: number;
  /** The P25 target for the same station. */
  targetSeconds: number;
  /** Seconds available against that target; negative means already ahead. */
  secondsAvailable: number;
  estimated: boolean;
}

export interface RacePlan {
  /** Flat prescribed pace per kilometre, in seconds. */
  targetPaceSec: number;
  runs: RunSplit[];
  runTotalSec: number;
  stations: StationTarget[];
  stationTotalSec: number;
  roxzoneSec: number;
  transitionSec: number;
  predictedFinishSec: number;
  /** Set when a goal time was given: the pace that goal actually requires. */
  goalFinishSec: number | null;
  goalPaceSec: number | null;
  /**
   * Seconds per kilometre the plan can afford to start faster than target:
   * zero, always. Opening more than 15 s/km fast costs about 6 minutes over
   * the back half, which is the single most expensive mistake in the race.
   */
  openingAllowanceSec: number;
}

export interface RacePlanInput {
  zones: Zones;
  benchmarks?: Partial<Record<Station, StationBenchmark>>;
  /** Target finish in seconds, when the athlete has one. */
  goalFinishSec?: number | null;
  transitionSec?: number;
}

/**
 * Builds the race plan from the numbers the app already holds.
 *
 * The run schedule is flat on purpose. The average finisher positive-splits
 * by 1:53 between run 1 and run 8; the training objective is to shrink that
 * drift, so the plan prescribes the average rather than the fast start that
 * causes it.
 */
export function buildRacePlan(input: RacePlanInput): RacePlan {
  const targetPaceSec = midPace(input.zones.target);
  const transitionSec = input.transitionSec ?? TRANSITION_TARGET_SEC;

  const runs: RunSplit[] = Array.from({ length: RUN_COUNT }, (_, i) => ({
    index: i + 1,
    seconds: targetPaceSec,
  }));
  const runTotalSec = targetPaceSec * RUN_COUNT;

  const stations: StationTarget[] = STATIONS.map((station) => {
    const mark = input.benchmarks?.[station];
    const seconds =
      mark && Number.isFinite(mark.seconds) ? Math.round(mark.seconds) : STATION_REFERENCE[station].avg;
    const targetSeconds = stationP25(station);
    return {
      station,
      seconds,
      targetSeconds,
      secondsAvailable: seconds - targetSeconds,
      estimated: !mark,
    };
  });

  const stationTotalSec = stations.reduce((total, s) => total + s.seconds, 0);
  const roxzoneSec = transitionSec * TRANSITION_COUNT;
  const predictedFinishSec = runTotalSec + stationTotalSec + roxzoneSec;

  const goalFinishSec =
    input.goalFinishSec && Number.isFinite(input.goalFinishSec) && input.goalFinishSec > 0
      ? Math.round(input.goalFinishSec)
      : null;

  // What the goal asks of the runs, once the stations and roxzone are paid
  // for. A goal that leaves nothing for the runs says so rather than quietly
  // prescribing an impossible pace.
  const goalPaceSec =
    goalFinishSec === null
      ? null
      : Math.max(0, Math.round((goalFinishSec - stationTotalSec - roxzoneSec) / RUN_COUNT));

  return {
    targetPaceSec,
    runs,
    runTotalSec,
    stations,
    stationTotalSec,
    roxzoneSec,
    transitionSec,
    predictedFinishSec,
    goalFinishSec,
    goalPaceSec,
    openingAllowanceSec: 0,
  };
}

/** Stations sorted by the time available against P25, biggest first. */
export const biggestOpportunities = (plan: RacePlan, count = 3): StationTarget[] =>
  [...plan.stations].sort((a, b) => b.secondsAvailable - a.secondsAvailable).slice(0, count);
