/* What only the browser can tell: errors nobody caught, how long the page took to load (navigation timing and the
   largest contentful paint, where the browser measures it), when a page change started (the click or Back that led to
   it), and the page closing or being hidden, when what's waiting is sent. Every listener is passive and wrapped, so
   telemetry can't add an error of its own. */
import type { Telemetry } from './client';

let lastInput = 0;
/** When the click, key or Back that led to a page change happened (performance time), if it was just now. */
export function inputStart(): number | undefined {
  if (typeof performance === 'undefined') return undefined;
  const at = lastInput;
  return at && performance.now() - at < 1000 ? performance.timeOrigin + at : undefined;
}

const safe = (fn: () => void) => () => { try { fn(); } catch { /* telemetry never breaks the page */ } };

export function installBrowser(tel: Telemetry) {
  if (typeof window === 'undefined') return;
  const opts = { capture: true, passive: true } as const;
  const input = () => { lastInput = performance.now(); };
  for (const t of ['click', 'submit', 'keydown', 'popstate'] as const) window.addEventListener(t, input, opts);

  window.addEventListener('error', (e) => safe(() => { if (e.error || e.message) tel.exception(e.error ?? e.message, 'window'); })());
  window.addEventListener('unhandledrejection', (e) => safe(() => tel.exception(e.reason, 'promise'))());

  // The largest contentful paint, kept until the page is hidden: it can grow while the page loads.
  let lcp = 0;
  try {
    if (typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
      new PerformanceObserver((list) => { const last = list.getEntries().at(-1); if (last) lcp = last.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    }
  } catch { /* not measured here */ }
  let lcpSent = false;
  const hidden = safe(() => {
    if (lcp && !lcpSent) { lcpSent = true; tel.metric('browser.lcp', lcp); }
    void tel.flush(true);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hidden(); });
  window.addEventListener('pagehide', safe(() => { if (lcp && !lcpSent) { lcpSent = true; tel.metric('browser.lcp', lcp); } tel.leave(); }));

  // Navigation timing, once the page has loaded.
  const timing = safe(() => {
    const n = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!n) return;
    tel.metric('browser.navigation.ttfb', n.responseStart);
    tel.metric('browser.navigation.dom_content_loaded', n.domContentLoadedEventEnd);
    if (n.loadEventEnd > 0) tel.metric('browser.navigation.load', n.loadEventEnd);
  });
  if (document.readyState === 'complete') setTimeout(timing, 0);
  else window.addEventListener('load', () => setTimeout(timing, 0), { once: true });
}
