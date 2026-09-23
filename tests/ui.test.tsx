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
    expect(document.querySelectorAll('.tab')).toHaveLength(3);
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
    // This week's Monday exactly 28 days out puts today in a deload week.
    reset({ raceDate: addDays(mondayOf(TODAY), 28) });
    render(<App />);
    expect(document.querySelector('.deload-badge')).toBeTruthy();
    expect(document.querySelector('.tips-card .tips-deload')).toBeTruthy();
  });

  it('shows no deload note in a normal week', () => {
    reset({ raceDate: addDays(mondayOf(TODAY), 35) });
    render(<App />);
    expect(document.querySelector('.tips-card .tips-deload')).toBeNull();
  });
});

describe('tabs', () => {
  it('switches between today, week and block', () => {
    render(<App />);
    const tabs = Array.from(document.querySelectorAll('.tab')) as HTMLElement[];

    fireEvent.click(tabs[1]!);
    expect(document.querySelectorAll('.day-row')).toHaveLength(7);

    fireEvent.click(tabs[2]!);
    expect(document.querySelectorAll('.block-week').length).toBeGreaterThan(4);

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
