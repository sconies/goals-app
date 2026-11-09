import { StrictMode } from 'react';
import { fixedClock } from './adapters/local';
import type { Clock } from './ports';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { BrowserStore, LIVE_KEY, pickExampleFromUrl, type Mode, type Store } from './data/store';
import { applyAppearance } from './app/appearance';
import { startSplash } from './ui/Splash';
import { telemetry } from './telemetry';
import { installBrowser } from './telemetry/browser';
import { installStaleCodeReload, recoverFromStaleCode } from './telemetry/staleCode';
import { tracedStore } from './telemetry/store';
import { shapeAgrees } from './domain/vocabulary';
import './styles.css';
import './styles/finish/home-watching.css';
import './styles/finish/forms-checkin.css';
import './styles/finish/wizard.css';
import './styles/finish/goal-history.css';
import './styles/finish/list-board.css';
import './styles/finish/map-reviews.css';
import './styles/finish/data-workspace.css';
import './styles/finish/sheets.css';
import './styles/notes/reviews.css';
import './styles/notes/goal-page.css';
import './styles/notes/attention-home.css';
import './styles/notes/shell-settings.css';
import './styles/notes/data-ids.css';
import './styles/notes/print-motion.css';
import './styles/notes/help.css';
import './styles/notes/recording.css';
import './styles/notes/goal-flagship.css';
import './styles/notes/markup.css';
import './styles/notes/workspace.css';
import './styles/remove.css';
import './styles/notes/phone-toolbar.css';

applyAppearance();
// Faro's splash, once per launch, over the app as it loads (src/ui/Splash.tsx). It never delays the app.
startSplash();
// Errors, load timings and the page closing (src/telemetry). Records nothing without a database.
installBrowser(telemetry);
// After a deploy, a tab running the old build reloads once when a part of it has gone (review F16).
installStaleCodeReload();

/** Everything under /demo is the demo: the example data in this browser, with a role switcher and a reset. */
const mode: Mode = location.pathname === '/demo' || location.pathname.startsWith('/demo/') ? 'demo' : 'live';

/** `?today=yyyy-mm-dd` pins the clock, for the demo and the evals. Never for shared data: it would date real records wrongly. */
function clock(): Clock | undefined {
  const q = new URLSearchParams(location.search);
  if (mode === 'live' && q.get('store') !== 'browser' && !import.meta.env.DEV) return undefined;
  const t = q.get('today');
  if (!t || Number.isNaN(Date.parse(t))) return undefined;
  return fixedClock(new Date(t + 'T12:00:00Z'));
}


/** The demo keeps its copy in this browser. The real app uses Supabase when configured; without it (local
    development, the evals) or with `?store=browser` it keeps real workspaces in this browser instead.
    The Supabase client loads only when it is used, so the demo stays small. */
async function store(today?: () => Date): Promise<Store> {
  if (mode === 'demo') { pickExampleFromUrl(location.search); return inspectable(new BrowserStore(today)); }
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env;
  if (url && key && new URLSearchParams(location.search).get('store') !== 'browser') {
    const { SupabaseStore } = await import('./adapters/supabase/goalsStore');
    return new SupabaseStore(url, key);
  }
  return inspectable(new BrowserStore(today, { key: LIVE_KEY, example: false }));
}

/**
 * A store kept in this browser can be read from the page (`window.__goalsStore.load(id)`), for the evals and for anyone
 * checking what the demo holds: the example isn't stored whole any more (only the saves are), so reading localStorage
 * no longer shows it. It holds only what's already in this browser.
 */
function inspectable(s: BrowserStore): BrowserStore {
  (window as unknown as { __goalsStore?: Pick<Store, 'load' | 'workspaces' | 'commit'> }).__goalsStore = { load: (id) => s.load(id), workspaces: () => s.workspaces(), commit: (id, c) => s.commit(id, c) };
  return s;
}

/* The one rule for whether a status shape agrees with the words beside it (domain/vocabulary.ts), for the check that
   holds every screen to it (evals P3 and P4): rules live once, so the check asks the app rather than restating it. */
(window as unknown as { __shapeAgrees?: typeof shapeAgrees }).__shapeAgrees = shapeAgrees;

const today = clock();
const root = createRoot(document.getElementById('root')!);
void store(today).then(
  (s) => root.render(
    <StrictMode>
      <App store={tracedStore(s, telemetry)} mode={mode} today={today} />
    </StrictMode>,
  ),
  (e: unknown) => {
    if (recoverFromStaleCode(e)) return;
    root.render(<div className="boot"><div className="boot-card"><span className="h3">The app couldn’t start</span><p className="muted">{e instanceof Error ? e.message : String(e)}</p><button className="btn primary" onClick={() => location.reload()}>Try again</button></div></div>);
  },
);
