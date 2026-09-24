import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_STALE_DAYS,
  TRANSITION_TARGET_SEC,
  estimateStations,
  goalStationTargets,
  STATION_REFERENCE,
  buildStationBlock,
  chooseStations,
  isStale,
  rankWeaknesses,
  scaleDose,
  stationDose,
  stationP25,
} from '../src/domain/stations';
import { computeZones, midPace } from '../src/domain/zones';
import { STATIONS, type Station, type StationBenchmark } from '../src/domain/types';

const mark = (seconds: number): StationBenchmark => ({ seconds, testedOn: '2026-07-01' });

describe('the population reference', () => {
  it('keeps P10 < P25 < average for every station', () => {
    for (const station of STATIONS) {
      const ref = STATION_REFERENCE[station];
      expect(ref.p10, station).toBeLessThan(stationP25(station));
      expect(stationP25(station), station).toBeLessThan(ref.avg);
      expect(ref.avg, station).toBeLessThan(ref.p90);
    }
  });

  it('puts the widest spread on the stations the review says carry it', () => {
    const spread = (s: Station) => STATION_REFERENCE[s].p90 - STATION_REFERENCE[s].p10;
    // Wall balls, burpee broad jumps and sled pull carry 4-5 min of spread;
    // the ergs carry about 1:15. Ranking has to see that difference.
    expect(spread('wallBalls')).toBeGreaterThan(spread('row') * 3);
    expect(spread('burpeeBroadJump')).toBeGreaterThan(spread('ski') * 3);
  });
});

describe('rankWeaknesses', () => {
  it('ranks by seconds available, not by percentage behind', () => {
    // 30 s behind on the SkiErg is a bigger percentage than 200 s behind on
    // wall balls, and a far smaller opportunity. Seconds is the right unit.
    const ranked = rankWeaknesses({
      ski: mark(stationP25('ski') + 30),
      wallBalls: mark(stationP25('wallBalls') + 200),
    });
    expect(ranked[0]!.station).toBe('wallBalls');
  });

  it('falls back to the population average for an untested station', () => {
    const ranked = rankWeaknesses({});
    for (const gap of ranked) {
      expect(gap.estimated).toBe(true);
      expect(gap.seconds).toBe(STATION_REFERENCE[gap.station].avg);
    }
    expect(ranked).toHaveLength(STATIONS.length);
  });

  it('is sorted worst first and is deterministic', () => {
    const ranked = rankWeaknesses({ row: mark(400), farmers: mark(60) });
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.secondsAvailable).toBeGreaterThanOrEqual(ranked[i]!.secondsAvailable);
    }
    expect(rankWeaknesses({ row: mark(400) })).toEqual(rankWeaknesses({ row: mark(400) }));
  });

  it('reports a station already ahead of target as negative, not as zero', () => {
    const ranked = rankWeaknesses({ farmers: mark(stationP25('farmers') - 20) });
    const farmers = ranked.find((g) => g.station === 'farmers')!;
    expect(farmers.secondsAvailable).toBeLessThan(0);
  });

  it('survives a corrupt benchmark without dropping the station', () => {
    const ranked = rankWeaknesses({ row: { seconds: NaN, testedOn: 'nonsense' } });
    expect(ranked).toHaveLength(STATIONS.length);
    for (const gap of ranked) expect(Number.isFinite(gap.secondsAvailable)).toBe(true);
  });
});

describe('benchmark staleness', () => {
  it('treats anything past six weeks as an estimate', () => {
    expect(isStale(BENCHMARK_STALE_DAYS)).toBe(false);
    expect(isStale(BENCHMARK_STALE_DAYS + 1)).toBe(true);
    expect(isStale(0)).toBe(false);
  });
});

describe('station doses', () => {
  it('loads Pro heavier than Open, for both categories', () => {
    for (const station of ['sledPush', 'sledPull', 'farmers', 'lunges'] as const) {
      const open = stationDose(station, 'open', 'male').weightKg!;
      const pro = stationDose(station, 'pro', 'male').weightKg!;
      expect(pro, station).toBeGreaterThan(open);
    }
  });

  it('keeps distances fixed across divisions', () => {
    for (const station of STATIONS) {
      const open = stationDose(station, 'open', 'male');
      const pro = stationDose(station, 'pro', 'female');
      expect(open.meters, station).toBe(pro.meters);
      expect(open.reps, station).toBe(pro.reps);
    }
  });

  it('scales a dose down to something executable rather than to fractions', () => {
    const scaled = scaleDose(stationDose('wallBalls'), 0.4);
    expect(scaled.reps).toBe(40);
    expect(scaled.reps! % 5).toBe(0);
    const row = scaleDose(stationDose('row'), 0.5);
    expect(row.meters).toBe(500);
  });

  it('never scales a station out of existence', () => {
    for (const station of STATIONS) {
      const scaled = scaleDose(stationDose(station), 0.01);
      if (scaled.meters !== undefined) expect(scaled.meters, station).toBeGreaterThanOrEqual(10);
      if (scaled.reps !== undefined) expect(scaled.reps, station).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('choosing a block', () => {
  const weaknesses = rankWeaknesses({
    wallBalls: mark(600),
    sledPull: mark(500),
    row: mark(240),
  });

  it('always includes the two worst stations', () => {
    const chosen = chooseStations(3, weaknesses, 0);
    expect(chosen).toContain('wallBalls');
    expect(chosen).toContain('sledPull');
  });

  it('keeps the block in race order so the sequence transfers', () => {
    for (let rotation = 0; rotation < 8; rotation++) {
      const chosen = chooseStations(4, weaknesses, rotation);
      const indices = chosen.map((s) => STATIONS.indexOf(s));
      expect([...indices].sort((a, b) => a - b)).toEqual(indices);
    }
  });

  it('rotates the remaining stations across the block', () => {
    const seen = new Set<Station>();
    for (let rotation = 0; rotation < 8; rotation++) {
      for (const station of chooseStations(3, weaknesses, rotation)) seen.add(station);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  it('never repeats a station inside one block', () => {
    for (let rotation = 0; rotation < 8; rotation++) {
      const chosen = chooseStations(5, weaknesses, rotation);
      expect(new Set(chosen).size).toBe(chosen.length);
    }
  });

  it('is usable with no benchmarks at all', () => {
    const block = buildStationBlock(3, [], 0, 0.5);
    expect(block).toHaveLength(3);
    for (const dose of block) expect(STATIONS).toContain(dose.station);
  });

  it('clamps an absurd count rather than throwing', () => {
    expect(chooseStations(0, weaknesses, 0)).toHaveLength(1);
    expect(chooseStations(99, weaknesses, 0)).toHaveLength(STATIONS.length);
    expect(chooseStations(3, weaknesses, -7)).toHaveLength(3);
  });
});

describe('estimating an untested station', () => {
  const zones = computeZones(300);
  const targetPaceSec = midPace(zones.target);

  it('works backwards from a goal finish when there is one', () => {
    const estimates = estimateStations({ targetPaceSec, goalFinishSec: 5400 });
    const total = STATIONS.reduce((sum, s) => sum + estimates[s].seconds, 0);
    // Goal, minus the runs and the roxzone, is what the stations get.
    const expected = 5400 - targetPaceSec * 8 - TRANSITION_TARGET_SEC * 8;
    expect(total).toBeGreaterThan(expected - 10);
    expect(total).toBeLessThan(expected + 10);
    for (const station of STATIONS) expect(estimates[station].source).toBe('goal');
  });

  it("splits that budget by each station share of the population total", () => {
    const estimates = estimateStations({ targetPaceSec, goalFinishSec: 5400 });
    // Wall balls are the biggest slice of the reference total, farmers the
    // smallest; a goal cannot change which is which.
    expect(estimates.wallBalls.seconds).toBeGreaterThan(estimates.farmers.seconds);
    expect(estimates.wallBalls.seconds).toBeGreaterThan(estimates.sledPush.seconds);
  });

  it('falls back to pace when no goal is set, scaled to the athlete', () => {
    const fast = estimateStations({ targetPaceSec: 240 });
    const slow = estimateStations({ targetPaceSec: 420 });
    expect(fast.wallBalls.source).toBe('pace');
    // Running ability transfers, but only partly - never one for one.
    expect(fast.wallBalls.seconds).toBeLessThan(STATION_REFERENCE.wallBalls.avg);
    expect(slow.wallBalls.seconds).toBeGreaterThan(STATION_REFERENCE.wallBalls.avg);
    const paceRatio = 240 / 420;
    const stationRatio = fast.wallBalls.seconds / slow.wallBalls.seconds;
    expect(stationRatio).toBeGreaterThan(paceRatio);
    expect(stationRatio).toBeLessThan(1);
  });

  it('keeps a measured station measured, whatever the goal says', () => {
    const estimates = estimateStations({
      targetPaceSec,
      goalFinishSec: 5400,
      benchmarks: { wallBalls: { seconds: 420, testedOn: '2026-07-01' } },
    });
    expect(estimates.wallBalls).toEqual({ station: 'wallBalls', seconds: 420, source: 'benchmark' });
    expect(estimates.row.source).toBe('goal');
  });

  it('shows a goal that does not fit as an overrun rather than hiding it', () => {
    const goal = goalStationTargets({ targetPaceSec, goalFinishSec: 1800 })!;
    // Every target is floored at the 10th percentile - a very fast station -
    // and the plan then says by how much the goal is missed.
    for (const station of STATIONS) {
      expect(goal.targets[station]).toBeGreaterThanOrEqual(STATION_REFERENCE[station].p10);
    }
    expect(goal.overrunSec).toBeGreaterThan(0);
    // The estimates still come from the goal: no silent revert to the pace
    // model, which would have hidden the fact that the goal is unreachable.
    const estimates = estimateStations({ targetPaceSec, goalFinishSec: 1800 });
    for (const station of STATIONS) expect(estimates[station].source).toBe('goal');
  });

  it('never returns a non-finite or negative estimate', () => {
    for (const pace of [0, -50, Number.NaN, 150, 600]) {
      for (const goal of [null, 0, Number.NaN, 4200, 1e9]) {
        const estimates = estimateStations({ targetPaceSec: pace, goalFinishSec: goal });
        for (const station of STATIONS) {
          expect(Number.isFinite(estimates[station].seconds), `${pace}/${goal}`).toBe(true);
          expect(estimates[station].seconds).toBeGreaterThan(0);
        }
      }
    }
  });

  it('ranks weaknesses against the estimates rather than the population average', () => {
    // A 1:20 goal makes every untested station a target the athlete is behind
    // on, and the ranking has to reflect the numbers actually shown.
    const estimates = estimateStations({ targetPaceSec, goalFinishSec: 4800 });
    const ranked = rankWeaknesses({}, estimates);
    for (const gap of ranked) {
      expect(gap.seconds).toBe(estimates[gap.station].seconds);
      expect(gap.estimated).toBe(true);
    }
  });
});

describe('station targets from a goal finish', () => {
  const zones = computeZones(300);
  const targetPaceSec = midPace(zones.target);
  const goalFinishSec = 5100; // 1:25:00

  it('gives each station its share of what the goal leaves', () => {
    const goal = goalStationTargets({ targetPaceSec, goalFinishSec })!;
    const total = STATIONS.reduce((sum, s) => sum + goal.targets[s], 0);
    expect(total).toBeGreaterThan(goal.budgetSec - 10);
    expect(total).toBeLessThan(goal.budgetSec + 10);
    expect(goal.overrunSec).toBe(0);

    // Share is the station's slice of the population station total: wall
    // balls are ~17% of it, so they get ~17% of the budget.
    const referenceTotal = STATIONS.reduce((sum, s) => sum + STATION_REFERENCE[s].avg, 0);
    for (const station of STATIONS) {
      const share = STATION_REFERENCE[station].avg / referenceTotal;
      expect(goal.targets[station] / goal.budgetSec).toBeCloseTo(share, 2);
    }
  });

  it('moves with the run pace, because the runs are paid for first', () => {
    const quick = goalStationTargets({ targetPaceSec: 300, goalFinishSec })!;
    const slow = goalStationTargets({ targetPaceSec: 360, goalFinishSec })!;
    // A minute a kilometre slower over 8 km is 8 minutes off the stations.
    expect(quick.budgetSec - slow.budgetSec).toBe(480);
    expect(quick.targets.wallBalls).toBeGreaterThan(slow.targets.wallBalls);
  });

  it('spends a measured station first and re-splits what is left', () => {
    const before = goalStationTargets({ targetPaceSec, goalFinishSec })!;
    const after = goalStationTargets({
      targetPaceSec,
      goalFinishSec,
      // Wall balls come in a minute slower than the goal wanted.
      benchmarks: { wallBalls: { seconds: before.targets.wallBalls + 60, testedOn: '2026-07-01' } },
    })!;

    // The other stations have to give that minute back between them.
    expect(after.targets.row).toBeLessThan(before.targets.row);
    expect(after.targets.sledPull).toBeLessThan(before.targets.sledPull);
    // And the plan still adds up to the goal.
    expect(after.overrunSec).toBe(0);
    expect(after.requiredStationSec).toBeLessThanOrEqual(after.budgetSec + 5);
  });

  it('still tells a measured station what the goal wanted from it', () => {
    const goal = goalStationTargets({
      targetPaceSec,
      goalFinishSec,
      benchmarks: { wallBalls: { seconds: 425, testedOn: '2026-07-01' } },
    })!;
    // The measured station keeps a target of its own, so 7:05 can be judged
    // against it rather than against nothing.
    expect(goal.targets.wallBalls).toBeGreaterThan(0);
    expect(goal.targets.wallBalls).toBeLessThan(425);
  });

  it('reports the overrun when measured times eat the whole budget', () => {
    const goal = goalStationTargets({
      targetPaceSec,
      goalFinishSec,
      benchmarks: {
        wallBalls: { seconds: 900, testedOn: '2026-07-01' },
        sledPull: { seconds: 900, testedOn: '2026-07-01' },
        burpeeBroadJump: { seconds: 900, testedOn: '2026-07-01' },
      },
    })!;
    expect(goal.requiredStationSec).toBeGreaterThan(goal.budgetSec);
    expect(goal.overrunSec).toBe(goal.requiredStationSec - goal.budgetSec);
  });

  it('returns nothing at all when no goal is set', () => {
    expect(goalStationTargets({ targetPaceSec })).toBeNull();
    expect(goalStationTargets({ targetPaceSec, goalFinishSec: null })).toBeNull();
    expect(goalStationTargets({ targetPaceSec, goalFinishSec: Number.NaN })).toBeNull();
  });
});
