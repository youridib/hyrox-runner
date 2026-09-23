import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { todayISO } from '../domain/dates';
import { buildPlan, type Plan } from '../domain/plan';
import { store, type AppState } from '../state/store';
import { getDict } from '../i18n';

/** Subscribes to the store and re-renders on change. */
export function useAppState(): AppState {
  const [state, setState] = useState(store.get());
  useEffect(() => store.subscribe(setState), []);
  return state;
}

/**
 * The current local date, kept fresh.
 *
 * A home-screen web app is suspended rather than reloaded, so an app left
 * open overnight would otherwise keep highlighting yesterday. This re-checks
 * whenever the app becomes visible again and on a slow interval as a backstop.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    const check = () => {
      const now = todayISO();
      setToday((previous) => (previous === now ? previous : now));
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      window.clearInterval(timer);
    };
  }, []);

  return today;
}

export function usePlan(state: AppState, today: string): Plan {
  return useMemo(
    () =>
      buildPlan(
        {
          raceDate: state.raceDate,
          currentPaceSec: state.currentPaceSec,
          weeklyTemplate: state.weeklyTemplate,
          overrides: state.overrides,
          heaviestDay: state.heaviestDay,
        },
        today,
        { blockStart: state.blockStart },
      ),
    [
      state.raceDate,
      state.currentPaceSec,
      state.weeklyTemplate,
      state.overrides,
      state.heaviestDay,
      state.blockStart,
      today,
    ],
  );
}

export function useDict(state: AppState) {
  return useMemo(() => getDict(state.language), [state.language]);
}

/** A transient message shown at the bottom of the screen. */
export function useToast(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number>();

  const show = useCallback((next: string) => {
    setMessage(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 3200);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [message, show];
}
