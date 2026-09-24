import { describe, expect, it } from 'vitest';
import {
  MAX_PACE_SEC,
  MIN_PACE_SEC,
  SEED_DECAY_SEC_PER_KM,
  clampDecay,
  computeZones,
  criticalSpeed,
  formatClock,
  resolveAnchor,
  splitsToDecay,
  stationDecay,
} from '../src/domain/zones';
import { buildRacePlan } from '../src/domain/racePlan';
import { parseGoalFinish, parseMmSs } from '../src/ui/components';
import { STATIONS, type TimeTrial } from '../src/domain/types';

describe('criticalSpeed', () => {
  it('recovers a known critical speed from two efforts', () => {
    // CS = 4 m/s with D' = 200 m: 1200 m in 250 s, 2400 m in 550 s.
    const result = criticalSpeed({ meters: 1200, seconds: 250 }, { meters: 2400, seconds: 550 })!;
    expect(result.cs).toBeCloseTo(4, 5);
    expect(result.dPrime).toBeCloseTo(200, 5);
  });

  it('does not care which effort is given first', () => {
    const a = criticalSpeed({ meters: 1200, seconds: 250 }, { meters: 2400, seconds: 550 })!;
    const b = criticalSpeed({ meters: 2400, seconds: 550 }, { meters: 1200, seconds: 250 })!;
    expect(a).toEqual(b);
  });

  it('refuses efforts that cannot describe a critical speed', () => {
    // Same distance, faster over the longer one, and a nonsense pair.
    expect(criticalSpeed({ meters: 1200, seconds: 250 }, { meters: 1200, seconds: 260 })).toBeNull();
    expect(criticalSpeed({ meters: 1200, seconds: 300 }, { meters: 2400, seconds: 280 })).toBeNull();
    expect(criticalSpeed({ meters: 1200, seconds: 250 }, { meters: 2400, seconds: 251 })).toBeNull();
    expect(criticalSpeed({ meters: NaN, seconds: 250 }, { meters: 2400, seconds: 550 })).toBeNull();
  });

  it('rejects a derived pace outside human bounds instead of returning it', () => {
    expect(criticalSpeed({ meters: 1000, seconds: 60 }, { meters: 5000, seconds: 200 })).toBeNull();
  });
});

describe('resolveAnchor', () => {
  it('upgrades to two-point critical speed when two distances exist', () => {
    const trials: TimeTrial[] = [
      { meters: 2400, seconds: 550 },
      { meters: 1200, seconds: 250 },
    ];
    const anchor = resolveAnchor({ currentPaceSec: 240, timeTrials: trials });
    expect(anchor.source).toBe('twoPoint');
    expect(anchor.csPaceSec).toBe(250); // 1000 / 4 m/s
  });

  it('keeps working from a single 1 km, which is the whole point', () => {
    const anchor = resolveAnchor({ currentPaceSec: 240 });
    expect(anchor.source).toBe('singlePoint');
    // A maximal 1 km sits above critical speed, so CS pace is slower.
    expect(anchor.csPaceSec).toBeGreaterThan(240);
  });

  it('ignores two trials at nearly the same distance', () => {
    const anchor = resolveAnchor({
      currentPaceSec: 300,
      timeTrials: [
        { meters: 1000, seconds: 210 },
        { meters: 1200, seconds: 260 },
      ],
    });
    expect(anchor.source).toBe('singlePoint');
  });

  it('holds the anchor inside human bounds for any input', () => {
    for (const pace of [-100, 0, NaN, 1e9, 150, 600]) {
      const anchor = resolveAnchor({ currentPaceSec: pace });
      expect(anchor.csPaceSec).toBeGreaterThanOrEqual(MIN_PACE_SEC);
      expect(anchor.csPaceSec).toBeLessThanOrEqual(MAX_PACE_SEC);
      expect(Number.isFinite(anchor.decaySec)).toBe(true);
    }
  });
});

describe('the station-fatigue penalty', () => {
  it('starts at the population seed when nothing has been logged', () => {
    expect(stationDecay([])).toBe(SEED_DECAY_SEC_PER_KM);
  });

  it('blends the seed out as splits arrive, and is fully self-calibrated by five', () => {
    const observed = [60, 60, 60, 60, 60];
    const one = stationDecay(observed.slice(0, 1));
    const three = stationDecay(observed.slice(0, 3));
    const five = stationDecay(observed);
    expect(one).toBeGreaterThan(SEED_DECAY_SEC_PER_KM);
    expect(three).toBeGreaterThan(one);
    expect(five).toBe(60);
  });

  it('turns logged splits into a penalty against critical speed', () => {
    expect(splitsToDecay([330, 350], 300)).toEqual([30, 50]);
    expect(splitsToDecay([Number.NaN, 330], 300)).toEqual([30]);
  });

  it('clamps the penalty so the zones cannot cross each other', () => {
    for (const cs of [150, 200, 300, 450, 600]) {
      const tiny = clampDecay(0, cs);
      const huge = clampDecay(10_000, cs);
      expect(tiny).toBeGreaterThan(0);
      expect(huge).toBeLessThanOrEqual(90);
      expect(clampDecay(NaN, cs)).toBeGreaterThan(0);
    }
  });
});

describe('zones as fractions of critical speed', () => {
  it('scales the easy zone proportionally rather than by a fixed offset', () => {
    // The old model added +60-90 s to every athlete, which is a far harder
    // easy run for the slower one. Proportional keeps the ratio constant.
    const fast = computeZones({ csPaceSec: 200, decaySec: 30, source: 'twoPoint' });
    const slow = computeZones({ csPaceSec: 400, decaySec: 30, source: 'twoPoint' });
    expect(fast.easy.low / 200).toBeCloseTo(slow.easy.low / 400, 2);
  });

  it('puts race pace below threshold, where 8 x 1 km off stations belongs', () => {
    const zones = computeZones({ csPaceSec: 300, decaySec: 30, source: 'twoPoint' });
    expect(zones.target.low).toBeGreaterThan(zones.threshold.high);
    expect(zones.target.high).toBeLessThan(zones.easy.low);
  });

  it('keeps every zone ordered and positive across the whole pace range', () => {
    for (let cs = MIN_PACE_SEC; cs <= MAX_PACE_SEC; cs += 10) {
      for (const decay of [0, 30, 500]) {
        const z = computeZones({ csPaceSec: cs, decaySec: decay, source: 'twoPoint' });
        for (const [name, zone] of Object.entries(z)) {
          expect(zone.low, `${name} at ${cs}`).toBeLessThan(zone.high);
          expect(zone.low, `${name} at ${cs}`).toBeGreaterThan(0);
        }
        expect(z.strides.low).toBeLessThan(z.vo2.low);
        expect(z.vo2.high).toBeLessThan(z.threshold.low);
        expect(z.threshold.high).toBeLessThan(z.target.low);
        expect(z.target.high).toBeLessThan(z.easy.low);
      }
    }
  });

  it('still accepts a bare 1 km pace, so the old call site keeps working', () => {
    expect(computeZones(300)).toEqual(computeZones(resolveAnchor({ currentPaceSec: 300 })));
  });
});

describe('the race plan', () => {
  const zones = computeZones({ csPaceSec: 300, decaySec: 30, source: 'twoPoint' });

  it('adds up to runs plus stations plus roxzone', () => {
    const plan = buildRacePlan({ zones });
    expect(plan.predictedFinishSec).toBe(
      plan.runTotalSec + plan.stationTotalSec + plan.roxzoneSec,
    );
    expect(plan.runs).toHaveLength(8);
    expect(plan.stations).toHaveLength(STATIONS.length);
  });

  it('prescribes a flat profile: run 1 is never faster than run 8', () => {
    const plan = buildRacePlan({ zones });
    const seconds = plan.runs.map((r) => r.seconds);
    expect(new Set(seconds).size).toBe(1);
    expect(plan.openingAllowanceSec).toBe(0);
  });

  it('uses the athlete benchmark where there is one and says so where there is not', () => {
    const plan = buildRacePlan({
      zones,
      benchmarks: { wallBalls: { seconds: 420, testedOn: '2026-07-01' } },
    });
    const wallBalls = plan.stations.find((s) => s.station === 'wallBalls')!;
    expect(wallBalls.seconds).toBe(420);
    expect(wallBalls.estimated).toBe(false);
    expect(plan.stations.find((s) => s.station === 'row')!.estimated).toBe(true);
  });

  it('works out the pace a goal actually requires, once stations are paid for', () => {
    const plan = buildRacePlan({ zones, goalFinishSec: 5400 });
    expect(plan.goalPaceSec).toBe(
      Math.round((5400 - plan.stationTotalSec - plan.roxzoneSec) / 8),
    );
  });

  it('never returns a negative goal pace for an impossible goal', () => {
    const plan = buildRacePlan({ zones, goalFinishSec: 1800 });
    expect(plan.goalPaceSec).toBeGreaterThanOrEqual(0);
  });

  it('ignores a goal that is not a number', () => {
    expect(buildRacePlan({ zones, goalFinishSec: Number.NaN }).goalFinishSec).toBeNull();
    expect(buildRacePlan({ zones }).goalPaceSec).toBeNull();
  });
});

describe('formatClock', () => {
  it('renders race-length totals with hours and pads the parts', () => {
    expect(formatClock(5127)).toBe('1:25:27');
    expect(formatClock(326)).toBe('5:26');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('time entry never stores what the schema will throw away', () => {
  it('parses m:ss and rejects everything that is not a duration', () => {
    expect(parseMmSs('5:30')).toBe(330);
    expect(parseMmSs('12:05')).toBe(725);
    expect(parseMmSs('330')).toBe(330);
    // Each of these used to slip through and be stored.
    expect(parseMmSs('0:00')).toBeNull();
    expect(parseMmSs('-1:30')).toBeNull();
    expect(parseMmSs('1:05:30')).toBeNull();
    expect(parseMmSs('5:75')).toBeNull();
    expect(parseMmSs('abc')).toBeNull();
    expect(parseMmSs('')).toBeNull();
    expect(parseMmSs('5:')).toBeNull();
  });

  it('reads a goal finish as hours and minutes, the way the field asks for it', () => {
    // 1:25 is 1:25:00 to everyone who races this, not 85 seconds.
    expect(parseGoalFinish('1:25')).toBe(5100);
    expect(parseGoalFinish('1:25:30')).toBe(5130);
    expect(parseGoalFinish('0:55')).toBe(3300);
  });

  it('refuses a goal outside the range the schema will keep', () => {
    expect(parseGoalFinish('0:10')).toBeNull(); // 10 min: not a Hyrox finish
    expect(parseGoalFinish('9:00')).toBeNull(); // 9 hours
    expect(parseGoalFinish('1:99')).toBeNull();
    expect(parseGoalFinish('-1:00')).toBeNull();
    expect(parseGoalFinish('90')).toBeNull();
    expect(parseGoalFinish('')).toBeNull();
  });
});
