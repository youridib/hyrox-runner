import type { ComponentChildren, JSX } from 'preact';
import { Component } from 'preact';
import { STORAGE_KEY } from '../state/schema';
import { getDict } from '../i18n';

interface Props {
  children: ComponentChildren;
  language: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches a render failure and offers a way out.
 *
 * In a home-screen web app there is no address bar, so an uncaught render
 * error leaves a white screen the user cannot reload past. This turns that
 * dead end into a message, a reload button, and - as a last resort - a way to
 * clear the stored state that is causing it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('[hyrox] render failed', error);
  }

  render(): JSX.Element | ComponentChildren {
    if (!this.state.error) return this.props.children;
    const dict = getDict(this.props.language);

    return (
      <div class="fatal">
        <h1>{dict.errorTitle}</h1>
        <p>{dict.errorBody}</p>
        <div class="data-row">
          <button type="button" class="data-btn" onClick={() => location.reload()}>
            {dict.reloadBtn}
          </button>
          <button
            type="button"
            class="data-btn"
            onClick={() => {
              try {
                localStorage.removeItem(STORAGE_KEY);
              } catch {
                /* storage may be unavailable; reloading is still worth a try */
              }
              location.reload();
            }}
          >
            {dict.errorReset}
          </button>
        </div>
      </div>
    );
  }
}
