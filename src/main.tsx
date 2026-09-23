import { render } from 'preact';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { store } from './state/store';
import { registerServiceWorker } from './pwa';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from the document');

function Root() {
  return (
    <ErrorBoundary language={store.get().language}>
      <App />
    </ErrorBoundary>
  );
}

document.documentElement.lang = store.get().language;
render(<Root />, root);
registerServiceWorker();
