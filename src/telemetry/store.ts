/* The store, timed: each save and load is a CLIENT span inside the action that asked for it. For the shared database
   that's the RPC (okr_commit, okr_create_workspace) as the browser sees it, so `db.system` is postgresql and
   `db.operation` the function's name; nothing is instrumented inside Postgres. The demo's browser store is timed the
   same way, as db.system=browser. The store behaves exactly as before: the span only watches. */
import type { Commit, Store } from '../data/store';
import { errorType } from './errors';
import type { Telemetry } from './client';

export function tracedStore(store: Store, tel: Telemetry): Store {
  const pg = store.kind === 'supabase';
  const timed = <T,>(op: string, run: () => Promise<T>, attrs: Record<string, unknown> = {}): Promise<T> => {
    // Read the parent now, while the action that called is still running.
    const span = tel.span(op, { kind: 'CLIENT', parent: tel.parent(), attributes: { 'db.system': pg ? 'postgresql' : 'browser', 'db.operation': op, ...attrs } });
    let p: Promise<T>;
    try { p = run(); } catch (e) { p = Promise.reject(e); }
    return p.then(
      (v) => { span.end({ status: 'OK' }); return v; },
      (e: unknown) => { const t = errorType(e); span.end({ status: 'ERROR', statusMessage: t, attributes: { 'error.type': t } }); throw e; },
    );
  };
  const size = (c: Commit) => Object.values(c).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  return {
    kind: store.kind,
    hasExample: store.hasExample,
    workspaces: () => store.workspaces(),
    load: (ws) => timed(pg ? 'select' : 'load', () => store.load(ws)),
    commit: (ws, c) => timed(pg ? 'okr_commit' : 'commit', () => store.commit(ws, c), { 'app.count': size(c) }),
    createWorkspace: (w, data) => timed(pg ? 'okr_create_workspace' : 'create_workspace', () => store.createWorkspace(w, data)),
    resetExample: (id) => store.resetExample(id),
    deleteWorkspace: (id) => timed(pg ? 'okr_delete_workspace' : 'delete_workspace', () => store.deleteWorkspace(id)),
    issueToken: (id, c) => timed(pg ? 'okr_token_create' : 'issue_token', () => store.issueToken(id, c)),
    ...(store.saveProblem ? { saveProblem: () => store.saveProblem!() } : {}),
    ...(store.onSaveProblem ? { onSaveProblem: (l: () => void) => store.onSaveProblem!(l) } : {}),
  };
}
