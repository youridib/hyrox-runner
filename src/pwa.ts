import { registerSW } from 'virtual:pwa-register';
import { getDict } from './i18n';
import { store } from './state/store';

/**
 * Registers the service worker and, when a new build is waiting, offers a
 * reload rather than taking one. An unprompted refresh mid-session could
 * interrupt someone reading their session between intervals.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    onNeedRefresh() {
      const dict = getDict(store.get().language);
      const banner = document.createElement('div');
      banner.className = 'toast';
      banner.setAttribute('role', 'status');
      banner.innerHTML = `<span></span> <button type="button" style="margin-left:10px;border:1px solid var(--border-hover);background:var(--surface);color:var(--text);border-radius:8px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer;"></button>`;
      // Text is assigned, never interpolated, so translations cannot inject markup.
      banner.querySelector('span')!.textContent = dict.updateAvailable;
      const button = banner.querySelector('button')!;
      button.textContent = dict.reloadBtn;
      button.onclick = () => void updateSW(true);
      document.body.appendChild(banner);
    },
  });
}
