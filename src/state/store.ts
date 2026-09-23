import { todayISO } from '../domain/dates';
import { LEGACY_KEYS, STORAGE_KEY, defaultState, migrate, type AppState } from './schema';

type Listener = (state: AppState) => void;

/**
 * Persisted app state with a subscribe/update surface.
 *
 * Storage is treated as untrusted and unreliable throughout: reads go through
 * `migrate`, and every write is wrapped, because Safari throws on
 * `localStorage` in private mode and can evict it outright under ITP. Losing
 * a write must never take the running app down with it.
 */
class Store {
  private state: AppState;
  private listeners = new Set<Listener>();
  private writeFailed = false;

  constructor() {
    this.state = this.load();
  }

  private load(): AppState {
    const today = todayISO();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw), today);

      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const migrated = migrate(JSON.parse(legacy), today);
          this.persist(migrated);
          return migrated;
        }
      }
    } catch (err) {
      console.warn('[hyrox] state load failed, starting fresh', err);
    }
    return defaultState(today);
  }

  private persist(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.writeFailed = false;
    } catch (err) {
      this.writeFailed = true;
      console.warn('[hyrox] state save failed', err);
    }
  }

  get(): AppState {
    return this.state;
  }

  /** True when the last write was rejected - surfaced in settings. */
  get storageBroken(): boolean {
    return this.writeFailed;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
    const delta = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...delta };
    this.persist(this.state);
    for (const fn of this.listeners) fn(this.state);
  }

  replace(next: AppState): void {
    this.state = next;
    this.persist(this.state);
    for (const fn of this.listeners) fn(this.state);
  }

  export(): string {
    return JSON.stringify({ ...this.state, exportedAt: new Date().toISOString() }, null, 2);
  }
}

export const store = new Store();
export type { AppState };
