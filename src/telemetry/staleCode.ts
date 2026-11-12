/* Stale code after a deploy (review F16, 9 Nov). A tab opened before a deploy still runs the old build; the first time
   it asks for a part it hasn't loaded yet (the Map, Markup, a spreadsheet reader), that file has gone, and the page
   showed "Something went wrong". Instead, the page reloads itself once, at the same address: the new build loads and
   the person carries on. Drafts are saved as they type (src/app/drafts.ts), so nothing typed is lost.

   Once means once in a short while: if the reload didn't help (the network is down, the file really is broken), the
   next failure shows the error page as before rather than reloading forever.

   Offline is not stale code (#167's review): a part that can't be fetched because the network is down fails with the
   same words, and a reload then has nothing to load, so the browser's own error page replaced Faro. When the browser
   says it is offline, nothing reloads; the page says so plainly instead (`isOffline`, the error page in react.tsx). */

/** What browsers and Vite say when a file of the build can't be fetched or run any more. */
const STALE = [
  /failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /unable to preload css/i, // Vite, a stylesheet
  /'text\/html' is not a valid javascript mime type/i, // the old file's address answered with the app's page
  /chunkloaderror|loading (css )?chunk \S+ failed/i,
];

/** Whether an error is a part of the build that has gone (a deploy happened since this tab loaded). */
export function isStaleCodeError(error: unknown): boolean {
  if (error == null) return false;
  const e = error as { name?: unknown; message?: unknown };
  const text = `${typeof e.name === 'string' ? e.name : ''} ${typeof e.message === 'string' ? e.message : typeof error === 'string' ? error : ''}`;
  return STALE.some((re) => re.test(text));
}

const KEY = 'faro-stale-reload';
/** A second failure within this long of the reload is a real failure, not stale code: show it. */
export const RELOAD_WINDOW_MS = 60_000;

type Env = { storage?: Pick<Storage, 'getItem' | 'setItem'> | null; reload: () => void; now: () => number; online?: () => boolean };

/** Whether the browser says it has no network. Only a definite "offline" counts: unknown is online. */
export function isOffline(): boolean {
  try { return typeof navigator !== 'undefined' && navigator.onLine === false; } catch { return false; }
}

function browserEnv(): Env {
  let storage: Env['storage'] = null;
  try { storage = window.sessionStorage; } catch { /* blocked */ }
  return { storage, reload: () => window.location.reload(), now: () => Date.now(), online: () => !isOffline() };
}

let reloading = false;
/** Reload the page once for stale code. True when it is reloading; false when it already did just now (or can't
    remember that it did, so can't promise once), and the caller should show the error instead. */
export function reloadOnce(env: Env = browserEnv()): boolean {
  // Vite's event and the error page can both ask, for the same failure: one reload.
  if (reloading) return true;
  const { storage, reload, now, online } = env;
  if (!storage) return false;
  // Offline: a reload would load nothing at all. Don't use up the once either; the next failure online still reloads.
  if (online && !online()) return false;
  try {
    const last = Number(storage.getItem(KEY) ?? 0);
    if (last && now() - last < RELOAD_WINDOW_MS) return false;
    storage.setItem(KEY, String(now()));
  } catch { return false; }
  reloading = true;
  reload();
  return true;
}

/** For a stale-code error: reload once. True when the page is reloading. */
export function recoverFromStaleCode(error: unknown, env?: Env): boolean {
  return isStaleCodeError(error) && reloadOnce(env);
}

/** For tests: forget a reload this page asked for. */
export function resetStaleCode() { reloading = false; }

/** Vite tells the page when a part of the build fails to load (`vite:preloadError`): reload once. The error still
    reaches the page (it isn't swallowed), which shows "Loading the new version" until the reload lands, or the error
    page if this is a second failure. Its event is about the build's own files, so it counts however the browser words it. */
export function installStaleCodeReload() {
  if (typeof window === 'undefined') return;
  window.addEventListener('vite:preloadError', () => { try { reloadOnce(); } catch { /* never in the way */ } });
  // A part loaded outside a screen (a spreadsheet reader, the zip maker) fails as a promise nobody caught.
  window.addEventListener('unhandledrejection', (e) => { try { recoverFromStaleCode(e.reason); } catch { /* never in the way */ } });
}

/** Whether this page has asked for a reload (so the error page should say it is loading, not that it failed). */
export const isReloading = () => reloading;
