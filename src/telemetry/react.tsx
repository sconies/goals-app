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
import { isOffline, isStaleCodeError, recoverFromStaleCode } from './staleCode';

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

/** A crash on a page: recorded, and a calm way on instead of a blank screen. Moving to another address (`at`) clears it.
    A part of an older build that has gone since a deploy (review F16) reloads the page once instead (staleCode.ts).
    Offline, a part that can't be fetched says so and reloads nothing (#167's review): a reload would load nothing. */
type Failure = { failed: boolean; reloading: boolean; offline: boolean; stillOffline: boolean };
export class ErrorBoundary extends Component<{ children: ReactNode; at?: string }, Failure> {
  state: Failure = { failed: false, reloading: false, offline: false, stillOffline: false };
  // Stale code shows "Loading the new version" straight away; if it can't reload (it just did), the error page.
  static getDerivedStateFromError(error: unknown) {
    const stale = isStaleCodeError(error);
    const offline = stale && isOffline();
    return { failed: true, reloading: stale && !offline, offline, stillOffline: false };
  }
  componentDidUpdate(prev: { at?: string }) { if (prev.at !== this.props.at && this.state.failed && !this.state.reloading) this.setState({ failed: false, offline: false, stillOffline: false }); }
  componentDidCatch(error: unknown) {
    try { telemetry.exception(error, 'react'); } catch { /* never in the way */ }
    if (this.state.reloading && !recoverFromStaleCode(error)) this.setState({ reloading: false });
  }
  /** Back online, the page loads again; still offline, a reload would show the browser's error page, so say so. */
  private retry = () => { if (isOffline()) this.setState({ stillOffline: true }); else location.reload(); };
  render() {
    if (!this.state.failed) return this.props.children;
    if (this.state.reloading) {
      return (
        <div className="page narrow" role="status" data-stale-reload>
          <Empty title="Loading the new version of Faro">
            <p className="muted">Faro was updated while this page was open. It reloads here, on the same page; anything you were typing is kept.</p>
          </Empty>
        </div>
      );
    }
    if (this.state.offline) {
      return (
        <div className="page narrow" role="status" data-offline>
          <Empty title="This page needs a connection">
            <p className="muted">You’re offline, and this part of Faro hasn’t loaded yet. Your saved work is safe. When you’re back online, try again.</p>
            {this.state.stillOffline && <p className="muted" role="alert">Still offline.</p>}
            <div className="row"><button type="button" className="btn primary" onClick={this.retry}>Try again</button><button type="button" className="btn" onClick={() => history.back()}>Go back</button></div>
          </Empty>
        </div>
      );
    }
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
