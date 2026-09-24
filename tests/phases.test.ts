import { describe, expect, it } from 'vitest';
import { PHASE_BOUNDS, computeIsDeload, computeWeekInPhase, getPhase } from '../src/domain/phases';

describe('getPhase boundaries', () => {
  it('maps each documented edge to the right phase', () => {
    const cases: Array<[number, string]> = [
      [-1, 'past'],
      [0, 'taper'],
      // The taper is 14 days: Bosquet's 8-14 day window, not a single week.
      [7, 'taper'],
      [14, 'taper'],
      [15, 'sharpen'],
      [28, 'sharpen'],
      [29, 'racespec'],
      [49, 'racespec'],
      [50, 'build'],
      [70, 'build'],
      [71, 'base'],
      [400, 'base'],
    ];
    for (const [dtr, expected] of cases) expect(getPhase(dtr), `dtr=${dtr}`).toBe(expected);
  });

  it('never leaves a gap or an overlap between 0 and 400 days out', () => {
    let previous = getPhase(400);
    const seen = [previous];
    for (let dtr = 399; dtr >= 0; dtr--) {
      const phase = getPhase(dtr);
      if (phase !== previous) {
        expect(seen).not.toContain(phase); // phases never resume once left
        seen.push(phase);
        previous = phase;
      }
    }
    expect(seen).toEqual(['base', 'build', 'racespec', 'sharpen', 'taper']);
  });
});

describe('computeWeekInPhase', () => {
  it('counts forward through each fixed-length phase', () => {
    expect(computeWeekInPhase(49, 'racespec').week).toBe(1);
    expect(computeWeekInPhase(42, 'racespec').week).toBe(2);
    expect(computeWeekInPhase(29, 'racespec').week).toBe(3);
    expect(computeWeekInPhase(49, 'racespec').total).toBe(3);

    expect(computeWeekInPhase(28, 'sharpen').week).toBe(1);
    expect(computeWeekInPhase(15, 'sharpen').week).toBe(2);
    expect(computeWeekInPhase(28, 'sharpen').total).toBe(2);

    expect(computeWeekInPhase(14, 'taper').week).toBe(1);
    expect(computeWeekInPhase(7, 'taper').week).toBe(2);
    expect(computeWeekInPhase(14, 'taper').total).toBe(2);

    expect(computeWeekInPhase(70, 'build').week).toBe(1);
    expect(computeWeekInPhase(50, 'build').week).toBe(3);
    expect(computeWeekInPhase(70, 'build').total).toBe(3);
  });

  it('clamps to the phase length rather than running past it', () => {
    for (const dtr of [29, 30, 31]) {
      const { week, total } = computeWeekInPhase(dtr, 'racespec');
      expect(week).toBeLessThanOrEqual(total!);
    }
  });

  // This is the bug the original had: base is open-ended, so without the block
  // length every base day collapsed to week 1 and base never progressed.
  it('progresses through the base phase when the block length is known', () => {
    const blockLength = 140; // 20 weeks
    const w1 = computeWeekInPhase(140, 'base', blockLength).week;
    const w2 = computeWeekInPhase(133, 'base', blockLength).week;
    const w3 = computeWeekInPhase(126, 'base', blockLength).week;
    expect([w1, w2, w3]).toEqual([1, 2, 3]);
  });

  it('never decreases as race day gets closer within the base phase', () => {
    const blockLength = 200;
    let previous = 0;
    for (let dtr = blockLength; dtr >= PHASE_BOUNDS.base.end; dtr--) {
      const { week } = computeWeekInPhase(dtr, 'base', blockLength);
      expect(week).toBeGreaterThanOrEqual(previous);
      previous = week;
    }
  });

  it('falls back to week 1 when the block is too short to contain a base phase', () => {
    expect(computeWeekInPhase(70, 'base', 60).week).toBe(1);
    expect(computeWeekInPhase(70, 'base').week).toBe(1);
  });
});

describe('computeIsDeload', () => {
  it('fires on every fourth week counting back from the race', () => {
    // Monday's daysToRace for the weeks 4, 8 and 12 out.
    expect(computeIsDeload(28)).toBe(true);
    expect(computeIsDeload(56)).toBe(true);
    expect(computeIsDeload(84)).toBe(true);
  });

  it('stays off in the weeks between', () => {
    for (const dtr of [21, 35, 42, 49, 63, 70, 77]) {
      expect(computeIsDeload(dtr), `dtr=${dtr}`).toBe(false);
    }
  });

  it('never fires inside the taper', () => {
    for (let dtr = -3; dtr <= 14; dtr++) expect(computeIsDeload(dtr), `dtr=${dtr}`).toBe(false);
  });

  it('spaces deloads exactly four weeks apart across a long block', () => {
    const deloadWeeks: number[] = [];
    for (let weeks = 1; weeks <= 30; weeks++) {
      if (computeIsDeload(weeks * 7)) deloadWeeks.push(weeks);
    }
    expect(deloadWeeks).toEqual([4, 8, 12, 16, 20, 24, 28]);
    for (let i = 1; i < deloadWeeks.length; i++) {
      expect(deloadWeeks[i]! - deloadWeeks[i - 1]!).toBe(4);
    }
  });
});
