/* Switching workspace as real navigation (backlog WS, outside review of 9 Nov). Before, switching changed what was open
   without a history entry, so Back silently "un-switched"; switching from a check-in landed on "That goal doesn't
   exist"; and for a moment the sidebar named the old workspace over the new one's content.
   Now:
   - a switch is a page move with its own history entry, carrying the workspace in the entry's state, so Back goes to
     the workspace you came from, visibly, and Forward returns;
   - you land on the same kind of page in the other workspace when it has one (Home, Goals, Reviews, a Workspace
     section…), otherwise on Home; never on a goal or check-in that belongs to the old one;
   - part-way through a task with a draft (a check-in, a goal, a review), it asks first, and says the draft stays in
     its own workspace, in this browser, for when you come back;
   - while the other workspace loads, the screen says "Opening <name>…" instead of mixing the two. */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { placeLine } from '../domain/cycle';
import { landingLine, workspaceName } from '../domain/workspaceAttention';
import { Sheet } from './bits';
import { FaroMark } from './Brand';
import { Icon } from './Icon';

/* The panel loads on first open (small workspaces SM4, section 8). */
const WorkspacePanel = lazy(() => import('./WorkspacePanel').then((m) => ({ default: m.WorkspacePanel })));

/** Pages that exist in every workspace: a switch keeps you on them. Anything else (a goal, a check-in) goes Home. */
const SAME_IN_EVERY = /^\/(goals|watching|reviews|activity|people|teams|data|workspace(\/[a-z-]+)?|settings|help(\/[^/]+)?|whats-new|feedback|retro)?$/;

/** A task part-way through, whose draft belongs to the workspace it was started in, and its name in words. */
function taskAt(path: string): string | null {
  if (/^\/check-in(\/|$)|^\/quick-check-in$/.test(path)) return 'a check-in';
  if (/^\/goals\/new$/.test(path)) return 'a new goal';
  if (/^\/goals\/[^/]+\/edit$/.test(path)) return 'changing a goal';
  if (/^\/reviews\/(new|[^/]+\/edit)$/.test(path)) return 'setting up a review';
  if (/^\/retro\/[^/]+$/.test(path)) return 'a wrap-up';
  return null;
}

/** Whether this browser keeps a draft for the workspace (app/drafts: `goals-app-draft:<workspace>:…`). */
function hasDraftIn(wsId: string) {
  try {
    for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith(`goals-app-draft:${wsId}:`)) return true;
  } catch { /* storage blocked: nothing kept */ }
  return false;
}

/** Where a switch lands, from the page you're on. */
/** A person's or a team's page belongs to the workspace it was in: after a switch, the list it came from (WR1). */
export const landingFor = (path: string) => (/^\/(people|teams)\/[^/]+$/.test(path) ? `/${path.split('/')[1]}` : SAME_IN_EVERY.test(path) && !taskAt(path) ? path : '/');

type Switch = (id: string, to?: string) => void;
const Ctx = createContext<Switch | null>(null);

/** Switch to another workspace: a history entry, the right landing page, and a warning first when a draft would be left. */
export function useSwitchWorkspace(): Switch {
  const go = useContext(Ctx);
  if (!go) throw new Error('useSwitchWorkspace outside WorkspaceSwitchProvider');
  return go;
}

export function WorkspaceSwitchProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [asking, setAsking] = useState<{ id: string; to?: string; task: string } | null>(null);
  const state = loc.state as { ws?: string } | null;

  // Back and Forward: an entry made by a switch names its workspace; open it if it isn't the one open (or opening).
  const want = state?.ws;
  useEffect(() => {
    if (!want || want === (app.opening?.id ?? app.ws.id) || !app.workspaces.some((w) => w.id === want)) return;
    app.switchWorkspace(want);
    // Only when the history entry changes: a switch made any other way doesn't move you back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.key]);

  // Once a switch has landed, who you are there and your role, if either changed (landingLine).
  const landing = useRef<{ id: string; was: { name: string; admin?: boolean } } | null>(null);
  useEffect(() => {
    const l = landing.current;
    if (!l || app.opening || app.ws.id !== l.id || !app.viewerChosen) return;
    landing.current = null;
    const said = landingLine(l.was, app.viewer);
    if (said) app.toast(said);
  }, [app, app.ws.id, app.opening, app.viewer, app.viewerChosen]);

  const move = useCallback((id: string, to?: string) => {
    const from = app.ws.id;
    landing.current = { id, was: { name: app.viewer.name, admin: app.viewer.admin } };
    // The entry you're leaving remembers its workspace, so Back returns to it.
    nav(loc.pathname + loc.search + loc.hash, { replace: true, state: { ...(state ?? {}), ws: from } });
    nav(to ?? landingFor(loc.pathname), { state: { ws: id } });
  }, [app.ws.id, app.viewer.name, app.viewer.admin, loc.pathname, loc.search, loc.hash, nav, state]);

  const go = useCallback<Switch>((id, to) => {
    if (id === app.ws.id && !app.opening) { if (to) nav(to); return; }
    const task = taskAt(loc.pathname);
    if (task && hasDraftIn(app.ws.id)) { setAsking({ id, to, task }); return; }
    move(id, to);
  }, [app.ws.id, app.opening, loc.pathname, move, nav]);

  const target = asking && app.workspaces.find((w) => w.id === asking.id);
  return (
    <Ctx.Provider value={go}>
      {children}
      {asking && target && (
        <Sheet open onClose={() => setAsking(null)} title={`Switch to ${target.name}?`}>
          <div className="stack switch-ask" style={{ gap: 'var(--s4)' }}>
            <p className="small">You’re part-way through {asking.task} in {app.ws.name}. What you’ve typed stays there as a draft, in this browser: switch back to {app.ws.name} and open it again to carry on.</p>
            <div className="sheet-foot">
              <button type="button" className="btn ghost" onClick={() => setAsking(null)}>Stay here</button>
              <button type="button" className="btn primary" onClick={() => { const a = asking; setAsking(null); move(a.id, a.to); }}>Switch workspace</button>
            </div>
          </div>
        </Sheet>
      )}
    </Ctx.Provider>
  );
}

/**
 * The workspace switcher (backlog WS): the sidebar's header (and, on a phone, the top bar's line under the page's name)
 * names the open workspace and opens this. It lists every workspace you can open, says whether you're an admin here,
 * leads to Workspace, and offers setting up a workspace of your own (moved here from Home, where Lane found it
 * confusing). Switching is real navigation (useSwitchWorkspace). Even with one workspace it opens, for the rest.
 */
export function WorkspaceSwitcher({ variant }: { variant: 'side' | 'top' | 'rail' }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const shown = app.opening ?? app.ws;
  const name = workspaceName(shown, app.mode).name;
  // On the icon rail the Faro mark is the control (SM4, 2.6): no row is added, so the Demo box keeps its room at 1024 × 768.
  const button = variant === 'rail' ? (
    <button type="button" className="ws-rail-switch" aria-label={`${name}: switch workspace, or set one up`} data-label={`${name}: switch workspace, or set one up`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <FaroMark size={28} label={null} />
    </button>
  ) : variant === 'side' ? (
    <button type="button" className="ws-head ws-switch" title={`${shown.name}: switch workspace`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>

      <span className="stack ws-head-text" style={{ gap: 0, minWidth: 0, flex: 1 }}>
        {/* "Example: Platform Engineering" was cut to "Example: Platf…": the name, with "Example" as the quieter line. */}
        <b className="ws-name">{name}</b>
        <span className="tiny muted ws-meta">{app.opening ? 'Opening…' : `${app.ws.kind === 'example' ? 'Example · ' : ''}${placeLine(app.cycle, app.today)}`}</span>
      </span>
      {/* Said, not only read out: it looked like a title, and a careful tester missed it (outside review, 12 Nov). */}
      <span className="tiny muted ws-switch-word" aria-hidden="true">Switch</span>
      <Icon name="chevron-down" size={14} className="ws-switch-chev" />
      <span className="sr">: switch workspace, or set one up</span>
    </button>
  ) : (
    <button type="button" className="ws-switch-top tiny muted" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span className="ellipsis">{app.opening ? `Opening ${shown.name}…` : `${app.ws.kind === 'example' ? 'Example data' : app.ws.name}, ${placeLine(app.cycle, app.today)}`}</span>
      <Icon name="chevron-down" size={12} />
      <span className="sr">: switch workspace</span>
    </button>
  );
  return (
    <>
      {button}
      {open && <Suspense fallback={null}><WorkspacePanel onClose={() => setOpen(false)} /></Suspense>}
    </>
  );
}
