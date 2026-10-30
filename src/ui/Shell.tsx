import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { weekProgress } from '../domain/progress';
import { reviewQueue } from '../domain/review';
import type { Profile } from '../domain/types';
import { Avatar, PROFILE_HELP, PROFILE_LABEL, Sheet } from './bits';

type NavId = 'home' | 'checkin' | 'review' | 'goals' | 'activity' | 'new' | 'workspace';
const NAV: Record<NavId, { to: string; label: string; icon: ReactNode }> = {
  home: { to: '/', label: 'Home', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 7 8 2.5 13.5 7v6.5h-11z" /><path d="M6.5 13.5v-4h3v4" /></svg> },
  checkin: { to: '/check-in', label: 'Check-in', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" /><path d="m5.5 8.2 1.8 1.8 3.3-3.6" /></svg> },
  review: { to: '/review', label: 'Review', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z" /><circle cx="8" cy="8" r="1.8" /></svg> },
  goals: { to: '/goals', label: 'Goals', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></svg> },
  activity: { to: '/activity', label: 'Activity', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" /></svg> },
  new: { to: '/goals/new', label: 'New goal', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg> },
  workspace: { to: '/workspace', label: 'Workspace', icon: <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg> },
};
const ORDER: Record<Profile, NavId[]> = {
  lead: ['home', 'checkin', 'goals', 'activity', 'new', 'workspace'],
  sponsor: ['home', 'review', 'goals', 'activity', 'new', 'workspace'],
  coach: ['home', 'workspace', 'goals', 'activity', 'new'],
  contributor: ['home', 'goals', 'activity', 'workspace'],
};

function isActive(id: NavId, path: string) {
  const to = NAV[id].to;
  if (id === 'home') return path === '/';
  if (id === 'goals') return path.startsWith('/goals') && path !== '/goals/new';
  return path === to || path.startsWith(to + '/');
}

export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const groups = (['lead', 'sponsor', 'coach', 'contributor'] as Profile[]).map((p) => [p, app.snapshot.people.filter((x) => x.profile === p)] as const).filter(([, l]) => l.length);
  return (
    <Sheet open={open} onClose={onClose} title="Switch profile">
      <p className="small muted" style={{ marginBottom: 12 }}>Each profile sees its own home and next steps. This is a demo, so anyone can switch.</p>
      {groups.map(([p, list]) => (
        <section key={p} className="stack" style={{ gap: 4, marginBottom: 14 }}>
          <span className="label">{PROFILE_LABEL[p]} · <span style={{ fontWeight: 400 }}>{PROFILE_HELP[p]}</span></span>
          {list.map((x) => (
            <button key={x.id} className="menuitem" aria-current={x.id === app.viewer.id ? 'true' : undefined} onClick={() => { app.setViewer(x.id); onClose(); }}>
              <Avatar p={x} size="sm" />
              <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}><span className="strong">{x.name}</span><span className="tiny muted">{x.role || PROFILE_LABEL[x.profile]}</span></span>
              {x.id === app.viewer.id && <span className="tiny strong" style={{ color: 'var(--accent-text)' }}>You</span>}
            </button>
          ))}
        </section>
      ))}
    </Sheet>
  );
}

function WorkspaceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  return (
    <Sheet open={open} onClose={onClose} title="Workspaces">
      <div className="stack" style={{ gap: 4 }}>
        {app.workspaces.map((w) => (
          <button key={w.id} className="menuitem" aria-current={w.id === app.ws.id ? 'true' : undefined} onClick={() => { app.switchWorkspace(w.id); onClose(); }}>
            <span className={'wsmark' + (w.kind === 'example' ? ' example' : '')} aria-hidden="true">{w.name.slice(0, 1).toUpperCase()}</span>
            <span className="stack" style={{ gap: 0, flex: 1 }}><span className="strong">{w.name}</span><span className="tiny muted">{w.kind === 'example' ? 'Demo data you can play with and reset' : 'Your data'}</span></span>
            {w.id === app.ws.id && <span className="tiny strong" style={{ color: 'var(--accent-text)' }}>Open</span>}
          </button>
        ))}
        <Link className="menuitem" to="/workspace/new" onClick={onClose}><span className="wsmark add" aria-hidden="true">+</span><span className="strong">Load your own data</span></Link>
      </div>
    </Sheet>
  );
}

const ROLE_SHORT: Record<Profile, string> = { lead: 'Team lead', sponsor: 'Sponsor', coach: 'Coach', contributor: 'Contributor' };

/** Demo control: which role's view this is, switchable in one tap. Each role has its own home and navigation. */
function RoleBar({ onPeople }: { onPeople: () => void }) {
  const app = useApp();
  const nav = useNavigate();
  const roles = (['lead', 'sponsor', 'coach', 'contributor'] as Profile[]).filter((r) => app.snapshot.people.some((x) => x.profile === r));
  const pick = (r: Profile) => {
    const person = app.snapshot.people.find((x) => x.profile === r);
    if (!person || r === app.viewer.profile) return;
    app.setViewer(person.id);
    nav('/');
  };
  return (
    <div className="rolebar">
      <span className="rolebar-label" id="rolebar-label">Viewing as</span>
      <div className="seg rolebar-seg" role="group" aria-labelledby="rolebar-label">
        {roles.map((r) => <button key={r} aria-pressed={app.viewer.profile === r} onClick={() => pick(r)}>{ROLE_SHORT[r]}</button>)}
      </div>
      <button className="rolebar-person" onClick={onPeople}><Avatar p={app.viewer} size="sm" /><span className="ellipsis">{app.viewer.name}</span><span aria-hidden="true">⌄</span><span className="sr">Switch to someone else</span></button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const { pathname } = useLocation();
  const [sheet, setSheet] = useState<'profile' | 'workspace' | 'more' | null>(null);
  const order = ORDER[app.viewer.profile];
  const due = weekProgress(app.viewer.id, app.snapshot, app.cycle, app.week, app.today).due.length;
  const q = app.viewer.profile === 'sponsor' ? reviewQueue(app.snapshot, app.cycle, app.today, app.week) : null;
  const count = (id: NavId) => (id === 'checkin' ? due : id === 'review' && q ? q.total - q.done : 0);
  const tabs = order.slice(0, 3);
  const more = order.slice(3);
  const work = useRef<HTMLElement>(null);
  useEffect(() => { window.scrollTo?.(0, 0); work.current?.scrollTo?.(0, 0); }, [pathname]);
  const title = order.filter((id) => isActive(id, pathname)).map((id) => NAV[id].label)[0] ?? 'Goals';

  const focusMode = /^\/(check-in|review)(\/|$)|^\/goals\/(new|[^/]+\/edit)$|^\/workspace\/new$/.test(pathname);
  return (
    <div className={'app' + (focusMode ? ' focus-mode' : '')}>
      <div className="mtop">
        <button className="wsbtn" onClick={() => setSheet('workspace')}>
          <span className={'wsmark' + (app.ws.kind === 'example' ? ' example' : '')} aria-hidden="true">{app.ws.name.slice(0, 1).toUpperCase()}</span>
          <span className="sr">Switch workspace ({app.ws.name})</span>
        </button>
        <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
          <strong className="ellipsis">{title}</strong>
          <span className="tiny muted ellipsis">{app.ws.kind === 'example' ? 'Example data' : app.ws.name}, week {app.week} of {app.cycle.weeks}</span>
        </span>
        <button className="profilebtn" onClick={() => setSheet('profile')}>
          <Avatar p={app.viewer} />
          <span className="sr">Switch profile ({app.viewer.name}, {PROFILE_LABEL[app.viewer.profile]})</span>
        </button>
      </div>
      <div className="shell">
        <nav className="side" aria-label="Main">
          <button className="wsbtn wide" onClick={() => setSheet('workspace')}>
            <span className={'wsmark' + (app.ws.kind === 'example' ? ' example' : '')} aria-hidden="true">{app.ws.name.slice(0, 1).toUpperCase()}</span>
            <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1, textAlign: 'left' }}>
              <b className="ellipsis">{app.ws.name}</b>
              <span className="tiny muted">Week {app.week} of {app.cycle.weeks}</span>
            </span>
            <span aria-hidden="true" className="muted">⌄</span>
          </button>
          {order.map((id) => (
            <Link key={id} to={NAV[id].to} className="nav" aria-current={isActive(id, pathname) ? 'page' : undefined}>
              {NAV[id].icon}<span>{NAV[id].label}</span>
              {count(id) > 0 && <span className="count">{count(id)}<span className="sr"> to do</span></span>}
            </Link>
          ))}
          <button className="me" onClick={() => setSheet('profile')}>
            <Avatar p={app.viewer} />
            <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1, textAlign: 'left' }}>
              <b className="ellipsis">{app.viewer.name}</b>
              <span className="tiny muted">{PROFILE_LABEL[app.viewer.profile]}</span>
            </span>
          </button>
        </nav>
        <main className="work" ref={work} id="main">
          {!focusMode && <RoleBar onPeople={() => setSheet('profile')} />}
          {children}
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {tabs.map((id) => (
          <Link key={id} to={NAV[id].to} aria-current={isActive(id, pathname) ? 'page' : undefined}>
            <span className="tabicon">{NAV[id].icon}{count(id) > 0 && <span className="badge">{count(id)}</span>}</span>
            <span>{NAV[id].label}</span>
          </Link>
        ))}
        <button onClick={() => setSheet('more')} aria-current={more.some((id) => isActive(id, pathname)) ? 'page' : undefined}>
          <span className="tabicon"><svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><circle cx="3.5" cy="8" r="1.4" fill="currentColor" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /><circle cx="12.5" cy="8" r="1.4" fill="currentColor" /></svg></span>
          <span>More</span>
        </button>
      </nav>
      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="More">
        <div className="stack" style={{ gap: 4 }}>
          {more.map((id) => (
            <Link key={id} to={NAV[id].to} className="menuitem" onClick={() => setSheet(null)}>{NAV[id].icon}<span className="strong">{NAV[id].label}</span></Link>
          ))}
          <button className="menuitem" onClick={() => setSheet('workspace')}>{NAV.workspace.icon}<span className="stack" style={{ gap: 0 }}><span className="strong">Switch workspace</span><span className="tiny muted">{app.ws.name}</span></span></button>
          <button className="menuitem" onClick={() => setSheet('profile')}><Avatar p={app.viewer} size="sm" /><span className="stack" style={{ gap: 0 }}><span className="strong">Switch profile</span><span className="tiny muted">{app.viewer.name}, {PROFILE_LABEL[app.viewer.profile].toLowerCase()}</span></span></button>
        </div>
      </Sheet>
      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)} />
      <WorkspaceSheet open={sheet === 'workspace'} onClose={() => setSheet(null)} />
      <div className="toasts" role="status" aria-live="polite">
        {app.toasts.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.kind === 'success' ? '✓ ' : ''}{t.text}</div>)}
      </div>
    </div>
  );
}
