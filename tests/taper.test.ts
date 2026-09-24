import { describe, expect, it } from 'vitest';
import {
  DELOAD_BLOCK_FLOOR_WEEKS,
  PHASE_BOUNDS,
  computeIsDeload,
  taperVolumeMultiplier,
} from '../src/domain/phases';
import { HARD_FRACTION_LIMIT, bandOf, weekIntensity } from '../src/domain/intensity';
import { autoFillNormal, fillWeek, scorePlacement } from '../src/domain/scheduler';
import { buildArgs } from '../src/domain/progression';
import { buildPlan } from '../src/domain/plan';
import { addDays } from '../src/domain/dates';
import { computeZones } from '../src/domain/zones';
import type { EffectiveType, PlanConfig, SessionArgs, SessionType } from '../src/domain/types';

const EMPTY: (SessionType | null)[] = [null, null, null, null, null, null, null];
const zones = computeZones(300);

const config = (over: Partial<PlanConfig> = {}): PlanConfig => ({
  raceDate: '2026-10-24',
  currentPaceSec: 300,
  weeklyTemplate: ['hyrox', null, 'hyrox', null, null, 'hyrox', null],
  overrides: {},
  heaviestDay: null,
  ...over,
});

describe('the 14-day taper', () => {
  it('runs for two weeks, not one', () => {
    expect(PHASE_BOUNDS.taper.start).toBe(14);
    expect(PHASE_BOUNDS.taper.end).toBe(1);
  });

  it('cuts volume exponentially, landing week 1 near 65% and week 2 near 45%', () => {
    expect(taperVolumeMultiplier(20)).toBe(1); // outside the taper
    const weekOne = (taperVolumeMultiplier(14) + taperVolumeMultiplier(8)) / 2;
    const weekTwo = (taperVolumeMultiplier(7) + taperVolumeMultiplier(1)) / 2;
    expect(weekOne).toBeGreaterThan(0.6);
    expect(weekOne).toBeLessThan(0.75);
    expect(weekTwo).toBeGreaterThan(0.38);
    expect(weekTwo).toBeLessThan(0.52);
  });

  it('never rises as the race approaches', () => {
    let previous = Infinity;
    for (let dtr = 14; dtr >= 0; dtr--) {
      const mult = taperVolumeMultiplier(dtr);
      expect(mult).toBeLessThanOrEqual(previous);
      previous = mult;
    }
  });

  it('keeps all three quality sessions in taper week one', () => {
    // Monday 14 days out through Sunday 8 days out: none of it is race week.
    const dtr = [14, 13, 12, 11, 10, 9, 8];
    const week = fillWeek(EMPTY, 'taper', null, dtr);
    expect(week).toContain('intervals');
    expect(week).toContain('tempo');
    expect(week.filter((t) => t === 'long' || t === 'compromised')).toHaveLength(1);
  });

  it('still locks the final seven days, even in a week that straddles', () => {
    // Race on the Thursday of the following week: Monday is 10 days out,
    // Sunday is 4 days out, so the boundary falls inside this week.
    const dtr = [10, 9, 8, 7, 6, 5, 4];
    const week = fillWeek(EMPTY, 'taper', null, dtr);
    // Everything inside the final seven days takes the fixed easy shape.
    for (let d = 3; d < 7; d++) expect(week[d], `day ${d}`).toBe('shakeout');
    // The days still outside it keep normal quality work at taper volume.
    expect(week.slice(0, 3)).toContain('intervals');

    const dtrRaceWeek = [5, 4, 3, 2, 1, 0, -1];
    const raceWeek = fillWeek(EMPTY, 'taper', null, dtrRaceWeek);
    expect(raceWeek[4]).toBe('rest');
    expect(raceWeek[3]).toBe('shakeout');
    expect(raceWeek[2]).toBe('intervals');
  });

  it('trims volume rather than frequency, across a real block', () => {
    const plan = buildPlan(config(), '2026-06-01', { blockStart: '2026-06-01' });
    const taperWeeks = plan.weeks.filter((w) => w.phase === 'taper');
    expect(taperWeeks).toHaveLength(2);

    const sharpen = plan.weeks.filter((w) => w.phase === 'sharpen').at(-1)!;
    const taperOne = taperWeeks[0]!;
    // Frequency holds: taper week one still trains on as many days.
    const trainingDays = (week: typeof sharpen) =>
      week.days.filter((d) => d.effectiveType !== 'rest').length;
    expect(trainingDays(taperOne)).toBeGreaterThanOrEqual(trainingDays(sharpen) - 1);
    // Volume falls.
    expect(taperOne.intensity.totalMin).toBeLessThan(sharpen.intensity.totalMin);
  });

  it('keeps strength alive through the taper instead of deleting it', () => {
    const args = buildArgs('hyrox', zones, {
      phase: 'taper',
      weekInPhase: 1,
      isDeload: false,
      daysToRace: 12,
    });
    expect(args.plannedMin).toBeGreaterThan(0);
  });
});

describe('the deload floor', () => {
  it('suppresses a deload in the opening weeks of a fresh block', () => {
    // 28 days out is a deload week by the four-week cadence, but not if the
    // block only just started - there is nothing yet to absorb.
    expect(computeIsDeload(28)).toBe(true);
    expect(computeIsDeload(28, 1)).toBe(false);
    expect(computeIsDeload(28, DELOAD_BLOCK_FLOOR_WEEKS)).toBe(true);
  });

  it('holds the four-week cadence once the block is under way', () => {
    const weeks: number[] = [];
    for (let w = 0; w < 30; w++) {
      if (computeIsDeload((30 - w) * 7, w)) weeks.push(w);
    }
    for (let i = 1; i < weeks.length; i++) {
      expect(weeks[i]! - weeks[i - 1]!).toBe(4);
    }
  });
});

describe('weekly intensity accounting', () => {
  const day = (effectiveType: EffectiveType, plannedMin: number) => ({
    effectiveType,
    session: { args: { plannedMin } as SessionArgs },
  });

  it('counts Hyrox days as hard, because the stations are', () => {
    expect(bandOf('hyrox')).toBe('hard');
    expect(bandOf('compromised')).toBe('hard');
    expect(bandOf('tempo')).toBe('moderate');
    expect(bandOf('long')).toBe('easy');
    expect(bandOf('rest')).toBe('none');
  });

  it('reports the hard fraction and flags a week with no easy days in it', () => {
    const brutal = weekIntensity([
      day('hyrox', 60),
      day('intervals', 40),
      day('hyrox', 60),
      day('compromised', 60),
      day('rest', 0),
    ]);
    expect(brutal.hardFraction).toBeGreaterThan(HARD_FRACTION_LIMIT);
    expect(brutal.overloaded).toBe(true);

    // A gym hour is work sets, rests and technique - the work sets are what
    // hit 8.5 mmol/L, so half the hour counts as hard and half as time on
    // your feet. Counting the whole hour made every plannable week read as
    // overloaded, which is a warning that says nothing.
    const gymOnly = weekIntensity([day('hyrox', 60), day('rest', 0)]);
    expect(gymOnly.hardMin).toBe(30);
    expect(gymOnly.easyMin).toBe(30);
    expect(gymOnly.totalMin).toBe(60);

    const polarized = weekIntensity([
      day('long', 90),
      day('easy', 45),
      day('easy', 45),
      day('intervals', 40),
      day('shakeout', 25),
    ]);
    expect(polarized.hardFraction).toBeLessThan(HARD_FRACTION_LIMIT);
    expect(polarized.overloaded).toBe(false);
  });

  it('never divides by zero on a week of nothing but rest', () => {
    const empty = weekIntensity([day('rest', 0), day('rest', 0)]);
    expect(empty.hardFraction).toBe(0);
    expect(empty.overloaded).toBe(false);
  });

  it('is attached to every planned week', () => {
    const plan = buildPlan(config(), '2026-06-01', { blockStart: '2026-06-01' });
    for (const week of plan.weeks) {
      expect(Number.isFinite(week.intensity.hardFraction), week.monday).toBe(true);
      expect(week.intensity.hardFraction).toBeGreaterThanOrEqual(0);
      expect(week.intensity.hardFraction).toBeLessThanOrEqual(1);
    }
  });
});

describe('scheduler changes', () => {
  it('no longer penalises an easy session the day after the heaviest lift', () => {
    // The weight is named hardAfterHeaviest; it now behaves that way. A
    // shakeout after a heavy lift is a good thing, not a -15.
    const easyAfter = scorePlacement({ 1: 'shakeout' }, [0], 0);
    const easyElsewhere = scorePlacement({ 3: 'shakeout' }, [0], 0);
    expect(easyAfter).toBeGreaterThan(easyElsewhere - 1);
    // Hard work is still pushed off that day.
    expect(scorePlacement({ 1: 'intervals' }, [0], 0)).toBeLessThan(
      scorePlacement({ 3: 'intervals' }, [0], 0),
    );
  });

  it('drops the third interval session before the tempo in base and build', () => {
    // Mon-Wed pinned leaves four consecutive free days, which can hold two
    // quality sessions at most.
    const template: (SessionType | null)[] = ['hyrox', 'hyrox', 'hyrox', null, null, null, null];
    const week = autoFillNormal(template, 'build', null);
    expect(week).toContain('tempo');
    expect(week).toContain('long');
    // Race-specific phases still drop the tempo first.
    const raceSpec = autoFillNormal(template, 'racespec', null);
    expect(raceSpec).toContain('intervals');
    expect(raceSpec).toContain('compromised');
  });

  it('schedules a time trial late in a deload week, in place of a session', () => {
    const week = autoFillNormal(EMPTY, 'base', null, { timeTrial: true });
    expect(week).toContain('timeTrial');
    // Late in the week, where the legs are freshest after the cut volume.
    expect(week.indexOf('timeTrial')).toBeGreaterThanOrEqual(4);
    // And in place of a quality session, not on top of all three: a deload
    // week must not end up with more hard days than a normal one.
    const hard = (w: SessionType[]) =>
      w.filter((t) => ['intervals', 'tempo', 'compromised', 'timeTrial'].includes(t)).length;
    expect(hard(week)).toBeLessThanOrEqual(hard(autoFillNormal(EMPTY, 'base', null)));
  });

  it('keeps the race-specific work in a deload week that carries a time trial', () => {
    const template: (SessionType | null)[] = [null, 'hyrox', null, null, 'hyrox', null, null];
    const week = autoFillNormal(template, 'sharpen', null, { timeTrial: true, easyVolume: true });
    expect(week).toContain('timeTrial');
    expect(week).toContain('compromised');
  });

  it('adds easy aerobic volume rather than a week of shakeouts', () => {
    const week = autoFillNormal(EMPTY, 'base', null, { easyVolume: true });
    expect(week).toContain('easy');
    expect(week).toContain('shakeout');
  });

  it('brings compromised running into build only when asked', () => {
    expect(autoFillNormal(EMPTY, 'build', null)).toContain('long');
    expect(autoFillNormal(EMPTY, 'build', null, { compromisedInBuild: true })).toContain(
      'compromised',
    );
  });
});

describe('the self-calibrating target pace', () => {
  it('moves target pace when compromised splits are logged', () => {
    const seeded = buildPlan(config(), '2026-06-01');
    const calibrated = buildPlan(
      config({ compromisedSplits: [400, 400, 400, 400, 400] }),
      '2026-06-01',
    );
    expect(calibrated.zones.target.low).toBeGreaterThan(seeded.zones.target.low);
    expect(calibrated.anchor.decaySec).toBeGreaterThan(seeded.anchor.decaySec);
  });

  it('keeps the same block shape whichever anchor is in use', () => {
    const single = buildPlan(config(), '2026-06-01', { blockStart: '2026-06-01' });
    const double = buildPlan(
      config({
        timeTrials: [
          { meters: 2400, seconds: 550 },
          { meters: 1200, seconds: 250 },
        ],
      }),
      '2026-06-01',
      { blockStart: '2026-06-01' },
    );
    expect(double.anchor.source).toBe('twoPoint');
    expect(double.weeks.length).toBe(single.weeks.length);
    expect(double.weeks.map((w) => w.phase)).toEqual(single.weeks.map((w) => w.phase));
  });

  it('re-tests the anchor without the user asking, in every deload week', () => {
    const blockStart = addDays('2026-10-24', -140);
    const plan = buildPlan(config(), blockStart, { blockStart });
    const deloadWeeks = plan.weeks.filter((w) => w.isDeload);
    expect(deloadWeeks.length).toBeGreaterThan(1);
    for (const week of deloadWeeks) {
      expect(
        week.days.some((d) => d.effectiveType === 'timeTrial'),
        week.monday,
      ).toBe(true);
    }
  });
});

describe('the scheduled time trials can actually reach two-point critical speed', () => {
  it('alternates distance between scheduled time trials, not by week parity', () => {
    // Deload weeks are always four apart, so anything keyed to week parity
    // would hand every time trial in the block the same distance and the
    // two-point upgrade could never be reached by following the plan.
    for (const blockDays of [84, 105, 112, 140, 168]) {
      const raceDate = addDays('2026-06-01', blockDays);
      const blockStart = '2026-06-01';
      const plan = buildPlan(config({ raceDate }), blockStart, { blockStart });
      const distances = plan.weeks
        .flatMap((w) => w.days)
        .filter((d) => d.effectiveType === 'timeTrial')
        .map((d) => d.session.args.ttMeters);

      expect(distances.length, `block of ${blockDays} days`).toBeGreaterThan(1);
      expect(new Set(distances).size, `block of ${blockDays} days: ${distances.join(',')}`).toBe(2);
      // Far enough apart for criticalSpeed to accept the pair.
      expect(Math.max(...distances) - Math.min(...distances)).toBeGreaterThanOrEqual(400);
    }
  });

  it('upgrades the anchor once both scheduled trials have been entered', () => {
    const blockStart = '2026-06-01';
    const raceDate = addDays(blockStart, 140);
    const scheduled = buildPlan(config({ raceDate }), blockStart, { blockStart })
      .weeks.flatMap((w) => w.days)
      .filter((d) => d.effectiveType === 'timeTrial');

    // The athlete runs the first two the app asked for. Real efforts are
    // faster over the shorter distance: critical speed 4 m/s with D' = 200 m.
    const entered = scheduled.slice(0, 2).map((d) => ({
      meters: d.session.args.ttMeters,
      seconds: Math.round((d.session.args.ttMeters - 200) / 4),
    }));

    const plan = buildPlan(config({ raceDate, timeTrials: entered }), blockStart, { blockStart });
    expect(plan.anchor.source).toBe('twoPoint');
  });
});
