import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useApp } from '../app/state';
import { Avatar } from './bits';
import { dueCheckIns } from '../screens/CheckInScreen';

const ICON: Record<'checkin' | 'goals' | 'new', ReactNode> = {
  checkin: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M2 9.5 3.8 3h8.4L14 9.5V13H2z" /><path d="M2 9.5h3.5l1 1.5h3l1-1.5H14" /></svg>,
  goals: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></svg>,
  new: <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>,
};

const TABS = [
  { to: '/', label: 'Check-in', icon: ICON.checkin, end: true, match: (p: string) => p === '/' || p.startsWith('/check-in') },
  { to: '/goals', label: 'Goals', icon: ICON.goals, end: false, match: (p: string) => p.startsWith('/goals') && p !== '/goals/new' },
  { to: '/goals/new', label: 'New goal', icon: ICON.new, end: true, match: (p: string) => p === '/goals/new' },
];

function ViewerSelect({ id }: { id: string }) {
  const app = useApp();
  return (
    <select id={id} className="input" value={app.viewer.id} onChange={(e) => app.setViewer(e.target.value)}>
      {app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
    </select>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const { pathname } = useLocation();
  const due = dueCheckIns(app).length;
  const current = TABS.find((t) => t.match(pathname));
  const work = useRef<HTMLElement>(null);
  useEffect(() => {
    work.current?.scrollTo?.(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <div className="mtop">
        <Avatar p={app.viewer} />
        <span className="stack" style={{ gap: 0 }}>
          <strong>{current?.label ?? 'Goals'}</strong>
          <span className="tiny muted">Week {app.week} of {app.cycle.weeks}</span>
        </span>
        <label className="sr" htmlFor="viewer-m">Viewing as</label>
        <ViewerSelect id="viewer-m" />
      </div>
      <div className="shell">
        <nav className="side" aria-label="Main">
          <div className="brand">
            <span className="mark"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" strokeWidth="2"><circle cx="8" cy="8" r="5.5" /><circle className="dot" cx="8" cy="8" r="1.5" /></svg></span>
            <span><b>Goals</b><span>Developer Platform</span></span>
          </div>
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className="nav" aria-current={t.match(pathname) ? 'page' : undefined}>
              {t.icon}<span>{t.label}</span>
              {t.to === '/' && due > 0 && <span className="count" aria-label={due + ' due'}>{due}</span>}
            </NavLink>
          ))}
          <span className="group">Cycle</span>
          <span className="small muted" style={{ padding: '0 10px' }}>{app.cycle.name}<br />Week {app.week} of {app.cycle.weeks}</span>
          <div className="demo-box">
            <label className="label" htmlFor="viewer">Demo · viewing as</label>
            <ViewerSelect id="viewer" />
            <button className="linkish small" onClick={() => { if (confirm('Start again from the demo data? Your changes in this browser are cleared.')) void app.reset(); }}>Reset demo data</button>
          </div>
          <div className="me">
            <Avatar p={app.viewer} />
            <span><b>{app.viewer.name}</b><span>{app.viewer.role}</span></span>
          </div>
        </nav>
        <main className="work" ref={work}>{children}</main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} aria-current={t.match(pathname) ? 'page' : undefined}>
            {t.icon}<span>{t.label}{t.to === '/' && due > 0 ? ` · ${due}` : ''}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
