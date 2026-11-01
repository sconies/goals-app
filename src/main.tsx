import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { BrowserStore, LIVE_KEY, type Mode, type Store } from './data/store';
import './styles.css';

/** `?today=yyyy-mm-dd` pins the clock, for demos and the evals. */
function clock(): (() => Date) | undefined {
  const t = new URLSearchParams(location.search).get('today');
  if (!t || Number.isNaN(Date.parse(t))) return undefined;
  const fixed = new Date(t + 'T12:00:00Z');
  return () => fixed;
}

/** Everything under /demo is the demo: the example data in this browser, with a role switcher and a reset. */
const mode: Mode = location.pathname === '/demo' || location.pathname.startsWith('/demo/') ? 'demo' : 'live';

/** The demo keeps its copy in this browser. The real app uses Supabase when configured; without it (local
    development, the evals) or with `?store=browser` it keeps real workspaces in this browser instead.
    The Supabase client loads only when it is used, so the demo stays small. */
async function store(today?: () => Date): Promise<Store> {
  if (mode === 'demo') return new BrowserStore(today);
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env;
  if (url && key && new URLSearchParams(location.search).get('store') !== 'browser') {
    const { SupabaseStore } = await import('./data/supabaseStore');
    return new SupabaseStore(url, key);
  }
  return new BrowserStore(today, { key: LIVE_KEY, example: false });
}

const today = clock();
const root = createRoot(document.getElementById('root')!);
void store(today).then((s) =>
  root.render(
    <StrictMode>
      <App store={s} mode={mode} today={today} />
    </StrictMode>,
  ),
);
