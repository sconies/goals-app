/* Telemetry's React pieces: the page someone is on (one span per page change, ended once it has painted, so its length
   is how long the page took to show), the workspace's recording switch, a mark for a screen's own steps, and an error
   boundary that records a crash and offers a way on instead of a blank page. */
import { Component, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { useApp } from '../app/state';
import type { Mark } from '../help/flows';
import { Empty } from '../ui/bits';
import { inputStart } from './browser';
import { mark, telemetry } from './index';

/** Inside the loaded app: says who and where to telemetry, and records each page change. */
export function TelemetryRoutes() {
  const app = useApp();
  const loc = useLocation();
  const nav = useNavigationType();
  const first = useRef(true);
  const recording = app.ws.recording !== false;
  useLayoutEffect(() => {
    telemetry.setContext({ workspaceId: app.ws.id, userId: app.viewer.id, store: app.storeKind, recording });
  }, [app.ws.id, app.viewer.id, app.storeKind, recording]);
  // After the page has rendered, off the path to the screen; before the screen's own marks, which come after it in the tree.
  useEffect(() => {
    try {
      // The first page started when the browser began loading it; later ones when the click or Back that led here did.
      const load = first.current;
      first.current = false;
      const span = telemetry.page(loc.pathname, loc.search, load ? 'load' : nav === 'POP' ? 'pop' : nav === 'REPLACE' ? 'replace' : 'push', load ? performance.timeOrigin : inputStart());
      const painted = () => span.end({ status: 'OK' });
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(painted, 0)); else setTimeout(painted, 0);
    } catch { /* never in the way */ }
    // Only a new address is a new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, loc.search]);
  return null;
}

/** Marks a screen's own step in a named flow when it shows (and again when `step` changes). */
export function useMark(name: Mark | null) {
  useEffect(() => { if (name) mark(name); }, [name]);
}

/** A crash on a page: recorded, and a calm way on instead of a blank screen. Moving to another address (`at`) clears it. */
export class ErrorBoundary extends Component<{ children: ReactNode; at?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(prev: { at?: string }) { if (prev.at !== this.props.at && this.state.failed) this.setState({ failed: false }); }
  componentDidCatch(error: unknown) { try { telemetry.exception(error, 'react'); } catch { /* never in the way */ } }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page narrow">
        <Empty title="Something went wrong on this page">
          <p className="muted">Your saved work is safe. Reload the page, or go back to Home.</p>
          <div className="row"><button type="button" className="btn primary" onClick={() => location.reload()}>Reload</button><a className="btn" href={location.pathname.startsWith('/demo') ? '/demo' : '/'}>Home</a></div>
        </Empty>
      </div>
    );
  }
}
