// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { App } from '../src/ui/App';
import { STORAGE_KEY, defaultState } from '../src/state/schema';
import { store } from '../src/state/store';
import { todayISO, addDays, mondayOf } from '../src/domain/dates';

/**
 * These render the real app against real state. They exist to catch the
 * failure modes the domain tests cannot see: a component that throws, a
 * control that does not persist, a re-render that drops what the user typed.
 */

const TODAY = todayISO();

function reset(partial: Partial<ReturnType<typeof defaultState>> = {}) {
  const state = { ...defaultState(TODAY), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  store.replace(state);
  return state;
}

beforeEach(() => {
  localStorage.clear();
  reset();
});

afterEach(cleanup);

describe('first render', () => {
  it('renders the shell without throwing', () => {
    render(<App />);
    expect(screen.getByText('Hyrox Runner')).toBeTruthy();
    expect(document.querySelectorAll('.tab')).toHaveLength(4);
  });

  it('shows today with a real session, not a placeholder', () => {
    render(<App />);
    const today = document.querySelector('.today');
    expect(today).toBeTruthy();
    const title = today!.querySelector('.today-title')!.textContent ?? '';
    expect(title.trim().length).toBeGreaterThan(0);
    expect(title).not.toContain('undefined');
    expect(title).not.toContain('NaN');
  });

  it('renders no "undefined" or "NaN" anywhere in the document', () => {
    render(<App />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('[object Object]');
  });
});

describe('today tab is read-only', () => {
  it('shows practical tips for the session', () => {
    render(<App />);
    const tips = document.querySelector('.tips-card');
    expect(tips).toBeTruthy();
    const items = tips!.querySelectorAll('.tips-list li');
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of Array.from(items)) {
      expect((item.textContent ?? '').length).toBeGreaterThan(20);
    }
  });

  it('offers no logging or editing controls', () => {
    render(<App />);
    expect(document.querySelector('.done-btn')).toBeNull();
    expect(document.querySelector('.rpe-chip')).toBeNull();
    expect(document.querySelector('.note-input')).toBeNull();
    expect(document.querySelector('.type-picker')).toBeNull();
    expect(document.querySelector('.scope-picker')).toBeNull();
  });

  it('keeps logging and editing available on the week tab', () => {
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[1]!);
    fireEvent.click(document.querySelectorAll('.day-row-header')[1]!);
    expect(document.querySelector('.type-picker')).toBeTruthy();
  });

  it('shows tips in Dutch after switching language', () => {
    reset({ language: 'nl' });
    render(<App />);
    const tips = document.querySelector('.tips-card');
    expect(tips).toBeTruthy();
    expect(tips!.textContent).toContain('Hoe uitvoeren');
  });

  it('flags a deload week in the tips', () => {
    // This week's Monday exactly 28 days out puts today in a deload week -
    // but only once the block is old enough to have something to absorb, so
    // the block has to have started a few weeks ago.
    reset({
      raceDate: addDays(mondayOf(TODAY), 28),
      blockStart: addDays(mondayOf(TODAY), -28),
    });
    render(<App />);
    expect(document.querySelector('.deload-badge')).toBeTruthy();
    expect(document.querySelector('.tips-card .tips-deload')).toBeTruthy();
  });

  it('shows no deload note in a normal week', () => {
    reset({
      raceDate: addDays(mondayOf(TODAY), 35),
      blockStart: addDays(mondayOf(TODAY), -28),
    });
    render(<App />);
    expect(document.querySelector('.tips-card .tips-deload')).toBeNull();
  });
});

describe('tabs', () => {
  it('switches between today, week, block and race', () => {
    render(<App />);
    const tabs = Array.from(document.querySelectorAll('.tab')) as HTMLElement[];

    fireEvent.click(tabs[1]!);
    expect(document.querySelectorAll('.day-row')).toHaveLength(7);

    fireEvent.click(tabs[2]!);
    expect(document.querySelectorAll('.block-week').length).toBeGreaterThan(4);

    fireEvent.click(tabs[3]!);
    expect(document.querySelector('.race-plan')).toBeTruthy();

    fireEvent.click(tabs[0]!);
    expect(document.querySelector('.today')).toBeTruthy();
  });

  it('shows every week of the block, each with seven coloured dots', () => {
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[2]!);
    const weeks = document.querySelectorAll('.block-week');
    expect(weeks.length).toBeGreaterThan(10);
    for (const week of Array.from(weeks)) {
      expect(week.querySelectorAll('.block-dot')).toHaveLength(7);
    }
  });

  it('marks the current week in the block view', () => {
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[2]!);
    expect(document.querySelectorAll('.block-week.is-current')).toHaveLength(1);
  });
});

describe('changing a session', () => {
  const openFirstDay = () => {
    fireEvent.click(document.querySelectorAll('.tab')[1]!);
    fireEvent.click(document.querySelectorAll('.day-row-header')[0]!);
  };

  it('applies a one-off change to that date only', () => {
    render(<App />);
    openFirstDay();

    const picker = document.querySelector('.type-picker')!;
    const restChip = within(picker as HTMLElement).getByText('Rest');
    fireEvent.click(restChip);

    const monday = mondayOf(TODAY);
    expect(store.get().overrides[monday]).toBe('rest');
    // The recurring template is untouched - this is the fix for the original
    // behaviour, where every pin silently applied to every week forever.
    expect(store.get().weeklyTemplate[0]).toBe('hyrox');
  });

  it('applies a recurring change to the template instead', () => {
    render(<App />);
    openFirstDay();

    fireEvent.click(screen.getByText('Every week'));
    const picker = document.querySelector('.type-picker')!;
    fireEvent.click(within(picker as HTMLElement).getByText('Rest'));

    expect(store.get().weeklyTemplate[0]).toBe('rest');
    expect(store.get().overrides[mondayOf(TODAY)]).toBeUndefined();
  });

  it('persists the change across a remount', () => {
    render(<App />);
    openFirstDay();
    const picker = document.querySelector('.type-picker')!;
    fireEvent.click(within(picker as HTMLElement).getByText('Tempo'));

    cleanup();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.overrides[mondayOf(TODAY)]).toBe('tempo');
  });

  it('clears an override with the Auto chip', () => {
    render(<App />);
    openFirstDay();
    const picker = () => document.querySelector('.type-picker') as HTMLElement;
    fireEvent.click(within(picker()).getByText('Tempo'));
    expect(store.get().overrides[mondayOf(TODAY)]).toBe('tempo');

    fireEvent.click(within(picker()).getByText('Auto'));
    expect(store.get().overrides[mondayOf(TODAY)]).toBeUndefined();
  });
});

describe('session logging', () => {
  it('marks a session done and keeps it after a remount', () => {
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[1]!);
    // Find a day that is not a rest day, so the log panel is present.
    const headers = Array.from(document.querySelectorAll('.day-row-header'));
    let logged: string | null = null;
    for (const header of headers) {
      fireEvent.click(header);
      const button = document.querySelector('.done-btn');
      if (button) {
        fireEvent.click(button);
        logged = Object.keys(store.get().log)[0] ?? null;
        break;
      }
      fireEvent.click(header);
    }
    expect(logged).toBeTruthy();
    expect(store.get().log[logged!]!.done).toBe(true);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.log[logged!].done).toBe(true);
  });

  it('records an RPE and a note', () => {
    reset({ log: {} });
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[1]!);
    const headers = Array.from(document.querySelectorAll('.day-row-header'));
    for (const header of headers) {
      fireEvent.click(header);
      const doneBtn = document.querySelector('.done-btn');
      if (!doneBtn) {
        fireEvent.click(header);
        continue;
      }
      fireEvent.click(doneBtn);
      const chips = document.querySelectorAll('.rpe-chip');
      expect(chips.length).toBe(10);
      fireEvent.click(chips[6]!); // RPE 7
      const note = document.querySelector('.note-input') as HTMLTextAreaElement;
      fireEvent.input(note, { target: { value: 'held pace' } });
      break;
    }
    const entry = Object.values(store.get().log)[0]!;
    expect(entry.rpe).toBe(7);
    expect(entry.note).toBe('held pace');
  });

  it('shows completion and streak stats', () => {
    render(<App />);
    const stats = document.querySelectorAll('.stat');
    expect(stats).toHaveLength(2);
    expect(stats[0]!.querySelector('.value')!.textContent).toMatch(/^\d+\/\d+$/);
  });
});

describe('settings', () => {
  const openSettings = () => {
    render(<App />);
    fireEvent.click(document.querySelector('.settings-btn')!);
  };

  it('opens and closes', () => {
    openSettings();
    expect(document.querySelector('.drawer')).toBeTruthy();
    fireEvent.click(document.querySelector('.drawer-close')!);
    expect(document.querySelector('.drawer')).toBeNull();
  });

  it('changes the race date and rebuilds the plan', () => {
    openSettings();
    const input = document.getElementById('race-date-input') as HTMLInputElement;
    const newRace = addDays(TODAY, 30);
    fireEvent.change(input, { target: { value: newRace } });
    expect(store.get().raceDate).toBe(newRace);
    expect(document.body.textContent).toContain('30 days to race');
  });

  it('keeps what is typed in the pace field until it is committed', () => {
    openSettings();
    const min = document.getElementById('pace-min-input') as HTMLInputElement;
    fireEvent.input(min, { target: { value: '4' } });
    // The original rebuilt the whole DOM on every change, losing the field.
    expect((document.getElementById('pace-min-input') as HTMLInputElement).value).toBe('4');
    fireEvent.blur(min);
    expect(store.get().currentPaceSec).toBe(4 * 60 + (store.get().currentPaceSec % 60));
  });

  it('clamps an out-of-range pace on commit', () => {
    openSettings();
    const min = document.getElementById('pace-min-input') as HTMLInputElement;
    fireEvent.input(min, { target: { value: '99' } });
    fireEvent.blur(min);
    expect(store.get().currentPaceSec).toBeLessThanOrEqual(10 * 60 + 59);
  });

  it('toggles Hyrox days', () => {
    openSettings();
    const buttons = document.querySelectorAll('.day-picker-btn');
    const before = store.get().weeklyTemplate[1];
    fireEvent.click(buttons[1]!);
    expect(store.get().weeklyTemplate[1]).not.toBe(before);
    expect(store.get().weeklyTemplate[1]).toBe('hyrox');
  });

  it('switches language and re-renders the copy', () => {
    openSettings();
    fireEvent.click(screen.getByText('Nederlands'));
    expect(store.get().language).toBe('nl');
    expect(document.body.textContent).toContain('Instellingen');
    expect(document.documentElement.lang).toBe('nl');
  });

  it('offers export and import controls', () => {
    openSettings();
    expect(screen.getByText('Export backup')).toBeTruthy();
    expect(screen.getByText('Import backup')).toBeTruthy();
  });
});

describe('edge-case dates', () => {
  it('renders race day', () => {
    reset({ raceDate: TODAY });
    render(<App />);
    expect(document.body.textContent).toContain('Race today.');
    expect(document.querySelector('.today-title')!.textContent).toContain('RACE DAY');
  });

  it('renders the day before the race as rest', () => {
    reset({ raceDate: addDays(TODAY, 1) });
    render(<App />);
    expect(document.querySelector('.today-title')!.textContent!.toLowerCase()).toContain('rest');
  });

  it('renders race week with its banner', () => {
    reset({ raceDate: addDays(TODAY, 4) });
    render(<App />);
    expect(document.querySelector('.race-week-banner')).toBeTruthy();
    expect(document.body.textContent).toContain('Race week');
  });

  it('renders a passed race without breaking', () => {
    reset({ raceDate: addDays(TODAY, -10) });
    render(<App />);
    expect(document.body.textContent).toContain('Race passed');
    expect(document.querySelector('.today')).toBeTruthy();
  });

  it('recovers from corrupt stored state rather than white-screening', () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');
    render(<App />);
    expect(screen.getByText('Hyrox Runner')).toBeTruthy();
    expect(document.querySelector('.today')).toBeTruthy();
  });
});

describe('storage failure', () => {
  it('still renders and accepts input when localStorage throws', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
    });

    try {
      render(<App />);
      expect(screen.getByText('Hyrox Runner')).toBeTruthy();
      fireEvent.click(document.querySelectorAll('.tab')[1]!);
      expect(document.querySelectorAll('.day-row')).toHaveLength(7);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });
});

describe('race plan tab', () => {
  const openRaceTab = () => {
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[3]!);
  };

  it('shows a predicted finish, eight runs and eight stations', () => {
    openRaceTab();
    const plan = document.querySelector('.race-plan')!;
    expect(plan).toBeTruthy();
    expect(plan.querySelector('.race-finish-value')!.textContent).toMatch(/^\d+:\d{2}:\d{2}$/);
    expect(plan.querySelectorAll('.race-run')).toHaveLength(8);
    expect(plan.querySelectorAll('.race-station')).toHaveLength(8);
  });

  it('prescribes the same pace for every run, run 1 included', () => {
    openRaceTab();
    const paces = Array.from(document.querySelectorAll('.race-run .value')).map(
      (node) => node.textContent,
    );
    expect(new Set(paces).size).toBe(1);
  });

  it('marks untested stations as estimates', () => {
    openRaceTab();
    expect(document.querySelectorAll('.race-station .est')).toHaveLength(8);
  });

  it('uses a logged benchmark instead of the population average', () => {
    reset({ stationBenchmarks: { wallBalls: { seconds: 420, testedOn: TODAY } } });
    openRaceTab();
    const marked = document.querySelectorAll('.race-station .est');
    expect(marked).toHaveLength(7);
    expect(document.querySelector('.race-plan')!.textContent).toContain('7:00');
  });

  it('shows the pace a goal time requires', () => {
    reset({ goalFinishSec: 5400 });
    openRaceTab();
    expect(document.querySelector('.race-goal')).toBeTruthy();
    expect(document.querySelector('.race-goal')!.textContent).toContain('1:30:00');
  });
});

describe('measuring the other 48%', () => {
  const openSettings = () => {
    render(<App />);
    fireEvent.click(document.querySelector('.settings-btn')!);
  };

  it('stores a station benchmark typed as m:ss', () => {
    openSettings();
    const input = document.getElementById('bm-wallBalls') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '5:30' } });
    expect(store.get().stationBenchmarks.wallBalls!.seconds).toBe(330);
    expect(store.get().stationBenchmarks.wallBalls!.testedOn).toBe(TODAY);
  });

  it('clears a benchmark when the field is emptied', () => {
    reset({ stationBenchmarks: { row: { seconds: 300, testedOn: TODAY } } });
    openSettings();
    fireEvent.blur(document.getElementById('bm-row') as HTMLInputElement, {
      target: { value: '' },
    });
    expect(store.get().stationBenchmarks.row).toBeUndefined();
  });

  it('adds a time trial and upgrades the pace anchor', () => {
    reset({ timeTrials: [{ date: TODAY, meters: 2400, seconds: 550 }] });
    openSettings();
    fireEvent.input(document.getElementById('tt-meters-input') as HTMLInputElement, {
      target: { value: '1200' },
    });
    fireEvent.input(document.getElementById('tt-time-input') as HTMLInputElement, {
      target: { value: '4:10' },
    });
    fireEvent.click(screen.getByText('Add time trial'));

    expect(store.get().timeTrials).toHaveLength(2);
    expect(store.get().timeTrials[0]!.seconds).toBe(250);
    expect(document.body.textContent).not.toContain('undefined');
  });

  it('ignores a half-typed time trial rather than storing a guess', () => {
    openSettings();
    fireEvent.input(document.getElementById('tt-meters-input') as HTMLInputElement, {
      target: { value: '1200' },
    });
    fireEvent.click(screen.getByText('Add time trial'));
    expect(store.get().timeTrials).toHaveLength(0);
  });

  it('changes division and category', () => {
    openSettings();
    fireEvent.change(document.getElementById('division-select') as HTMLSelectElement, {
      target: { value: 'pro' },
    });
    expect(store.get().division).toBe('pro');
    fireEvent.click(screen.getByText('Women'));
    expect(store.get().sex).toBe('female');
  });

  it('logs a compromised-run split, and only on compromised days', () => {
    // Race-specific phase, so the week carries a compromised run.
    reset({ raceDate: addDays(TODAY, 40), blockStart: addDays(mondayOf(TODAY), -28) });
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[1]!);

    const headers = Array.from(document.querySelectorAll('.day-row-header'));
    let found = false;
    for (const header of headers) {
      fireEvent.click(header);
      const doneBtn = document.querySelector('.done-btn');
      if (doneBtn) fireEvent.click(doneBtn);
      const split = document.querySelector('.split-input') as HTMLInputElement | null;
      if (split) {
        fireEvent.blur(split, { target: { value: '5:40' } });
        found = true;
        break;
      }
      fireEvent.click(header);
    }

    expect(found).toBe(true);
    const entry = Object.values(store.get().log).find((e) => e.splitSec !== undefined);
    expect(entry!.splitSec).toBe(340);
  });
});

describe('weekly intensity', () => {
  it('shows how much of the week is hard', () => {
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[1]!);
    const strip = document.querySelector('.intensity-strip');
    expect(strip).toBeTruthy();
    expect(strip!.textContent).toMatch(/\d+%/);
  });

  it('warns when a week has no easy days left in it', () => {
    // Hyrox every day: every planned minute is hard.
    reset({
      weeklyTemplate: ['hyrox', 'hyrox', 'hyrox', 'hyrox', 'hyrox', 'hyrox', 'hyrox'],
    });
    render(<App />);
    fireEvent.click(document.querySelectorAll('.tab')[1]!);
    expect(document.querySelector('.intensity-strip.is-warning')).toBeTruthy();
    expect(document.querySelector('.intensity-warning')).toBeTruthy();
  });
});

describe('settings inputs never store what a reload would discard', () => {
  const openSettings = () => {
    render(<App />);
    fireEvent.click(document.querySelector('.settings-btn')!);
  };

  it('does not re-date a benchmark that was only tabbed through', () => {
    // Blur fires on every focus loss. Re-dating here would reset the six-week
    // staleness clock without the user changing anything.
    const old = { seconds: 420, testedOn: addDays(TODAY, -60) };
    reset({ stationBenchmarks: { wallBalls: old } });
    openSettings();
    const input = document.getElementById('bm-wallBalls') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: input.value } });
    expect(store.get().stationBenchmarks.wallBalls).toEqual(old);
  });

  it('re-dates a benchmark that actually changed', () => {
    reset({ stationBenchmarks: { wallBalls: { seconds: 420, testedOn: addDays(TODAY, -60) } } });
    openSettings();
    fireEvent.blur(document.getElementById('bm-wallBalls') as HTMLInputElement, {
      target: { value: '6:00' },
    });
    expect(store.get().stationBenchmarks.wallBalls).toEqual({ seconds: 360, testedOn: TODAY });
  });

  it('refuses a benchmark that is not a plausible station time', () => {
    openSettings();
    for (const value of ['0:00', '99:00', '1:05:30']) {
      fireEvent.blur(document.getElementById('bm-row') as HTMLInputElement, {
        target: { value },
      });
      expect(store.get().stationBenchmarks.row, value).toBeUndefined();
    }
  });

  it('reads a goal finish as hours and minutes', () => {
    openSettings();
    const input = document.getElementById('goal-finish-input') as HTMLInputElement;
    fireEvent.blur(input, { target: { value: '1:25' } });
    expect(store.get().goalFinishSec).toBe(5100);

    // And refuses one the schema would drop on the next load.
    fireEvent.blur(input, { target: { value: '0:10' } });
    expect(store.get().goalFinishSec).toBeNull();
  });

  it('refuses a time trial outside the bounds storage keeps', () => {
    openSettings();
    fireEvent.input(document.getElementById('tt-meters-input') as HTMLInputElement, {
      target: { value: '50000' },
    });
    fireEvent.input(document.getElementById('tt-time-input') as HTMLInputElement, {
      target: { value: '4:10' },
    });
    fireEvent.click(screen.getByText('Add time trial'));
    expect(store.get().timeTrials).toHaveLength(0);
  });
});
