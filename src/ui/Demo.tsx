/* The demo's controls, kept out of the way: one quiet "Demo" control opens a panel to switch role, take a
   walkthrough, research the app, change or reset the example data, or leave. Nothing else on screen changes. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { setNavMode, useNavMode } from '../app/navMode';
import { TOURS, writeTour } from '../app/tours';
import type { Person } from '../domain/types';
import { Avatar, Sheet } from './bits';

/** What someone does, by role: the thing to pick in a demo, with the name second. */
export function personaOf(p: Person, app: ReturnType<typeof useApp>): { role: string; does: string } {
  const owns = app.snapshot.goals.filter((g) => g.ownerId === p.id).length;
  const watches = app.snapshot.watches.filter((w) => w.personId === p.id).length;
  if (/\b(VP|Vice President|Head|Director|Chief|CEO|CTO|COO|CFO)\b/i.test(p.role)) return { role: 'Leader', does: 'Leads the reviews and watches the north stars' };
  if (p.admin && !owns) return { role: 'Admin', does: 'Sets up people, years and reviews' };
  if (owns) return { role: 'Goal owner', does: `Owns ${owns} ${owns === 1 ? 'goal' : 'goals'} and checks in weekly` };
  return { role: 'Team member', does: watches ? 'Follows the goals that matter to their work' : 'Can see every goal' };
}

/** The people worth trying: a leader, an admin, owners and someone who only watches. */
export function demoCast(app: ReturnType<typeof useApp>): Person[] {
  const picked = ['elena', 'maya', 'sam', 'priya', 'tom'].map((id) => app.person(id)).filter((p): p is Person => !!p);
  if (picked.length >= 3) return picked;
  const owns = (p: Person) => app.snapshot.goals.filter((g) => g.ownerId === p.id).length;
  const people = app.snapshot.people;
  const leader = people.find((p) => personaOf(p, app).role === 'Leader');
  return [...new Set([leader, ...people.filter((p) => p.admin).slice(0, 1), ...[...people].filter((p) => owns(p) > 0).sort((a, b) => owns(b) - owns(a)).slice(0, 2), people.find((p) => !owns(p) && !p.admin)].filter((p): p is Person => !!p))];
}

/** The quiet way in: a small control in the sidebar (desktop) or the header (phone). */
export function DemoEntry({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  const app = useApp();
  const { role } = personaOf(app.viewer, app);
  return (
    <button type="button" className={compact ? 'demo-entry compact' : 'demo-entry'} onClick={onOpen}>
      <span className="demo-word">Demo</span>
      {!compact && <span className="demo-as">{role} · {app.viewer.name.split(' ')[0]}</span>}
      <span className="sr">{compact ? `, viewing as ${role}, ${app.viewer.name}` : ''}: open the demo controls</span>
    </button>
  );
}

export function DemoPanel({ onClose, onPresent }: { onClose: () => void; onPresent: () => void }) {
  const app = useApp();
  const nav = useNavigate();
  const navMode = useNavMode();
  const [resetting, setResetting] = useState(false);
  const cast = demoCast(app);
  const others = app.snapshot.people.filter((p) => !cast.includes(p));
  const [showAll, setShowAll] = useState(false);
  const pick = (id: string) => { app.setViewer(id); onClose(); nav('/'); };
  const startTour = (id: string) => {
    const t = TOURS.find((x) => x.id === id)!;
    if (app.person(t.personId)) app.setViewer(t.personId);
    writeTour({ id, step: 0 });
    onClose();
    nav(t.start);
  };
  const row = (p: Person) => {
    const { role, does } = personaOf(p, app);
    return (
      <button key={p.id} type="button" className="menuitem persona" aria-current={p.id === app.viewer.id ? 'true' : undefined} onClick={() => pick(p.id)}>
        <Avatar p={p} size="sm" />
        <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <span className="strong">{role}</span>
          <span className="tiny muted ellipsis">{p.name}{p.role ? `, ${p.role}` : ''} · {does}</span>
        </span>
        {p.id === app.viewer.id && <span className="tiny strong" style={{ color: 'var(--accent-text)' }}>Now</span>}
      </button>
    );
  };
  const tours = TOURS.filter((t) => app.ws.kind !== 'example' || app.person(t.personId));
  return (
    <Sheet open onClose={onClose} title="Demo">
      <div className="stack" style={{ gap: 'var(--s5)' }}>
        <section className="stack" style={{ gap: 4 }} aria-label="See it as">
          <span className="field-label">See it as</span>
          {cast.map(row)}
          {others.length > 0 && (showAll ? others.map(row) : <button type="button" className="linkish small" onClick={() => setShowAll(true)}>Everyone else ({others.length})</button>)}
        </section>
        {tours.length > 0 && app.ws.id === 'example' && (
          <section className="stack" style={{ gap: 4 }} aria-label="Show me how">
            <span className="field-label">Show me how</span>
            <span className="hint">A walkthrough you do yourself: it points at each step and moves on when you’ve done it.</span>
            {tours.map((t) => (
              <button key={t.id} type="button" className="menuitem" onClick={() => startTour(t.id)}>
                <span className="stack" style={{ gap: 0, flex: 1 }}><span className="strong">{t.title}</span><span className="tiny muted">As a {t.role.toLowerCase()} · {t.steps.length} steps</span></span>
              </button>
            ))}
          </section>
        )}
        <section className="stack" style={{ gap: 4 }} aria-label="Research">
          <span className="field-label">Research</span>
          <Link className="menuitem" to="/research" onClick={onClose}><span className="stack" style={{ gap: 0 }}><span className="strong">Try it as a researcher</span><span className="tiny muted">Tasks to attempt, notes on any screen, and a report at the end</span></span></Link>
        </section>
        <section className="stack" style={{ gap: 4 }} aria-label="Example data">
          <span className="field-label">Example data</span>
          {app.ws.kind === 'example' && (resetting
            ? <span className="row"><span className="small">Undo every change in this example?</span><button type="button" className="btn sm" onClick={async () => { await app.resetExample(); setResetting(false); onClose(); nav('/'); }}>Yes, start over</button><button type="button" className="btn ghost sm" onClick={() => setResetting(false)}>Cancel</button></span>
            : <button type="button" className="menuitem" onClick={() => setResetting(true)}><span className="strong">Start over</span><span className="tiny muted">Undo every change in {app.ws.name.replace(/^Example: /, '')}</span></button>)}
          <Link className="menuitem" to="/workspace" onClick={onClose}><span className="strong">Other example companies</span></Link>
        </section>
        <section className="stack" style={{ gap: 4 }} aria-label="Options">
          <span className="field-label">Options</span>
          <button type="button" className="menuitem" onClick={() => { onPresent(); onClose(); }}><span className="stack" style={{ gap: 0 }}><span className="strong">Present without demo controls</span><span className="tiny muted">Bring them back from the menu</span></span></button>
          <button type="button" className="menuitem" aria-pressed={navMode === 'four'} onClick={() => setNavMode(navMode === 'four' ? 'current' : 'four')}><span className="strong">{navMode === 'four' ? 'Back to the current tabs' : 'Try 4 tabs'}</span></button>
          <a className="menuitem" href="/"><span className="strong">Leave the demo</span></a>
        </section>
      </div>
    </Sheet>
  );
}
