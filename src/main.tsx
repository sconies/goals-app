import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { BrowserStore } from './data/store';
import './styles.css';

/** `?today=yyyy-mm-dd` pins the clock, for demos and the evals. */
function clock(): (() => Date) | undefined {
  const t = new URLSearchParams(location.search).get('today');
  if (!t || Number.isNaN(Date.parse(t))) return undefined;
  const fixed = new Date(t + 'T12:00:00Z');
  return () => fixed;
}

const today = clock();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={new BrowserStore(today)} today={today} />
  </StrictMode>,
);
