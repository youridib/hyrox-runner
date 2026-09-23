import { describe, expect, it } from 'vitest';
import { DELOAD_MULTIPLIER, buildArgs, getSessionSpec } from '../src/domain/progression';
import { computeZones } from '../src/domain/zones';
import type { PhaseKey, SessionArgs, SessionType } from '../src/domain/types';

const zones = computeZones(300);

const ctx = (phase: PhaseKey, weekInPhase: number, isDeload = false, daysToRace = 30) => ({
  phase,
  weekInPhase,
  isDeload,
  daysToRace,
});

/** The volume field that actually carries the load, per session type. */
const load: Record<string, (a: SessionArgs) => number> = {
  intervals: (a) => a.reps,
  // Base tempo is one continuous block; the other phases are sets x minutes.
  tempo: (a) => Math.max(a.durationMin, a.sets * a.blockMin),
  long: (a) => a.durationMin,
  compromised: (a) => a.stations + a.reps1k,
};

const QUALITY = ['intervals', 'tempo', 'long', 'compromised'] as const;

describe('buildArgs seeds every field', () => {
  it('never leaves a volume number undefined for any type or phase', () => {
    const types: SessionType[] = [
      'intervals', 'tempo', 'long', 'compromised', 'rest', 'shakeout', 'hyrox',
    ];
    const phases: PhaseKey[] = ['base', 'build', 'racespec', 'sharpen', 'taper', 'past'];
    for (const type of types) {
      for (const phase of phases) {
        const args = buildArgs(type, zones, ctx(phase, 1));
        for (const [key, value] of Object.entries(args)) {
          expect(value, type + '/' + phase + '/' + key).toBeDefined();
          if (typeof value === 'number') {
            expect(Number.isFinite(value), type + '/' + phase + '/' + key).toBe(true);
          }
        }
      }
    }
  });

  it('renders no volume string containing "undefined" or "NaN"', () => {
    for (const phase of ['base', 'build', 'racespec', 'sharpen', 'taper'] as PhaseKey[]) {
      for (const type of QUALITY) {
        const args = buildArgs(type, zones, ctx(phase, 2));
        const rendered = [args.easy, args.thr, args.p400, args.p1k, args.vo2Low, args.vo2High];
        for (const s of rendered) {
          expect(s).not.toContain('undefined');
          expect(s).not.toContain('NaN');
        }
      }
    }
  });
});

describe('progression is monotonic within a phase', () => {
  const phaseWeeks: Array<[PhaseKey, number]> = [
    ['base', 8],
    ['build', 3],
    ['racespec', 3],
    ['sharpen', 2],
  ];

  for (const [phase, weeks] of phaseWeeks) {
    for (const type of QUALITY) {
      it(type + ' never decreases across ' + phase, () => {
        let previous = -Infinity;
        for (let week = 1; week <= weeks; week++) {
          const value = load[type]!(buildArgs(type, zones, ctx(phase, week)));
          expect(value, type + '/' + phase + ' week ' + week).toBeGreaterThanOrEqual(previous);
          previous = value;
        }
      });
    }
  }

  it('actually increases somewhere, rather than being flat everywhere', () => {
    expect(buildArgs('intervals', zones, ctx('base', 4)).reps).toBeGreaterThan(
      buildArgs('intervals', zones, ctx('base', 1)).reps,
    );
  });
});

describe('deload always reduces load', () => {
  const phases: PhaseKey[] = ['base', 'build', 'racespec', 'sharpen'];

  for (const phase of phases) {
    for (const type of QUALITY) {
      it(type + ' in ' + phase + ' is never heavier on a deload week', () => {
        for (let week = 1; week <= 4; week++) {
          const normal = load[type]!(buildArgs(type, zones, ctx(phase, week, false)));
          const deload = load[type]!(buildArgs(type, zones, ctx(phase, week, true)));
          expect(deload, type + '/' + phase + ' week ' + week).toBeLessThanOrEqual(normal);
        }
      });
    }
  }

  it('cuts to roughly the stated multiplier where volume is large enough to round', () => {
    const normal = buildArgs('long', zones, ctx('build', 3)).durationMin;
    const deload = buildArgs('long', zones, ctx('build', 3, true)).durationMin;
    expect(deload / normal).toBeGreaterThan(DELOAD_MULTIPLIER - 0.15);
    expect(deload / normal).toBeLessThan(DELOAD_MULTIPLIER + 0.15);
  });

  it('never cuts a session out of existence', () => {
    for (const phase of phases) {
      for (let week = 1; week <= 4; week++) {
        expect(buildArgs('intervals', zones, ctx(phase, week, true)).reps).toBeGreaterThanOrEqual(1);
        expect(buildArgs('compromised', zones, ctx(phase, week, true)).stations).toBeGreaterThanOrEqual(1);
        expect(buildArgs('long', zones, ctx(phase, week, true)).durationMin).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe('progression matches the original planner where it was already correct', () => {
  const reps = (phase: PhaseKey, w: number) => buildArgs('intervals', zones, ctx(phase, w)).reps;

  it('keeps the documented racespec interval ramp', () => {
    expect([1, 2, 3].map((w) => reps('racespec', w))).toEqual([6, 7, 8]);
  });

  it('keeps the documented sharpen interval ramp', () => {
    expect([1, 2].map((w) => reps('sharpen', w))).toEqual([4, 5]);
  });

  it('keeps the documented build interval ramp, capped at six', () => {
    expect([1, 2, 3].map((w) => reps('build', w))).toEqual([4, 5, 6]);
  });

  // The original returned week 1 for every base day, so this was always [5,5,5,5].
  it('delivers the base ramp the original commented but never reached', () => {
    expect([1, 2, 3, 4].map((w) => reps('base', w))).toEqual([5, 6, 7, 8]);
  });

  it('caps the base ramp instead of growing without bound', () => {
    expect(reps('base', 25)).toBe(8);
    expect(buildArgs('long', zones, ctx('base', 25)).durationMin).toBe(60);
    expect(buildArgs('tempo', zones, ctx('base', 25)).durationMin).toBe(30);
  });

  it('keeps the documented racespec tempo and long ramps', () => {
    expect([1, 2, 3].map((w) => buildArgs('tempo', zones, ctx('racespec', w)).blockMin)).toEqual([
      8, 10, 12,
    ]);
    expect([1, 2, 3].map((w) => buildArgs('long', zones, ctx('racespec', w)).durationMin)).toEqual([
      50, 55, 60,
    ]);
  });

  it('keeps the compromised build-up through racespec and sharpen', () => {
    const c = (phase: PhaseKey, w: number) => buildArgs('compromised', zones, ctx(phase, w));
    expect([1, 2, 3].map((w) => c('racespec', w).stations)).toEqual([1, 1, 2]);
    expect([1, 2, 3].map((w) => c('racespec', w).reps1k)).toEqual([1, 2, 2]);
    expect([1, 2].map((w) => c('sharpen', w).stations)).toEqual([3, 4]);
  });
});

describe('getSessionSpec variant selection', () => {
  it('returns the race variant on race day regardless of the planned type', () => {
    for (const type of ['intervals', 'long', 'rest', 'hyrox'] as const) {
      expect(getSessionSpec(type, zones, ctx('taper', 1, false, 0), true).variant).toBe('race');
    }
  });

  it('uses the race-eve variants at the right distance out', () => {
    expect(getSessionSpec('rest', zones, ctx('taper', 1, false, 1), false).variant).toBe('restEve');
    expect(getSessionSpec('shakeout', zones, ctx('taper', 1, false, 2), false).variant).toBe(
      'shakeoutEve',
    );
    expect(getSessionSpec('rest', zones, ctx('taper', 1, false, 4), false).variant).toBe(
      'restNormal',
    );
  });

  it('picks a phase-specific variant for every quality type', () => {
    const table: Array<[SessionType, PhaseKey, string]> = [
      ['intervals', 'base', 'intervalsBase'],
      ['intervals', 'build', 'intervalsBuild'],
      ['intervals', 'racespec', 'intervalsRaceSpec'],
      ['intervals', 'sharpen', 'intervalsSharpen'],
      ['intervals', 'taper', 'intervalsTaper'],
      ['tempo', 'base', 'tempoBase'],
      ['tempo', 'build', 'tempoBuild'],
      ['tempo', 'racespec', 'tempoRaceSpec'],
      ['tempo', 'sharpen', 'tempoSharpen'],
      ['compromised', 'sharpen', 'compromisedSharpen'],
      ['compromised', 'racespec', 'compromisedRaceSpec'],
      ['compromised', 'build', 'compromisedNormal'],
      ['long', 'taper', 'longTaper'],
      ['long', 'build', 'longNormal'],
      ['hyrox', 'taper', 'hyroxTaper'],
      ['hyrox', 'build', 'hyroxNormal'],
    ];
    for (const [type, phase, variant] of table) {
      expect(getSessionSpec(type, zones, ctx(phase, 1), false).variant, type + '/' + phase).toBe(
        variant,
      );
    }
  });

  it('assigns a colour token to every session', () => {
    for (const type of [
      'intervals', 'tempo', 'long', 'compromised', 'hyrox', 'rest', 'shakeout',
    ] as const) {
      expect(getSessionSpec(type, zones, ctx('build', 1), false).color).toBeTruthy();
    }
  });
});
