import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { BrowserStore, type Store } from './data/store';
import { SupabaseStore } from './data/supabaseStore';
import './styles.css';

/** `?today=yyyy-mm-dd` pins the clock, for demos and the evals. */
function clock(): (() => Date) | undefined {
  const t = new URLSearchParams(location.search).get('today');
  if (!t || Number.isNaN(Date.parse(t))) return undefined;
  const fixed = new Date(t + 'T12:00:00Z');
  return () => fixed;
}

/** Shared Supabase data when configured; `?store=browser` keeps a private copy in this browser instead. */
function store(today?: () => Date): Store {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env;
  if (url && key && new URLSearchParams(location.search).get('store') !== 'browser') return new SupabaseStore(url, key, today);
  return new BrowserStore(today);
}

const today = clock();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store(today)} today={today} />
  </StrictMode>,
);
