/* The demo's controls, kept out of the way: one quiet "Demo" control opens a panel to switch role, take a
   walkthrough, research the app, reset the example, or leave. Nothing else on screen changes. */
import { useModules } from '../core/app';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { TOURS, writeTour } from '../app/tours';
import { EXAMPLE, isExample } from '../data/examples';
import type { Person } from '../domain/types';
import { Avatar, Sheet } from './bits';
import { PROTOTYPE_LINE } from '../help/about';
import { useSwitchWorkspace } from './WorkspaceSwitch';
import { PickOne } from './Pick';

/** What someone does, by role: the thing to pick in a demo, with the name second. */
export function personaOf(p: Person, app: ReturnType<typeof useApp>): { role: string; does: string } {
  const owns = app.snapshot.goals.filter((g) => g.ownerId === p.id).length;
  const watches = app.snapshot.watches.filter((w) => w.personId === p.id).length;
  const runs = app.snapshot.reviews.filter((r) => r.createdBy === p.id).map((r) => r.name);
  if (/\b(VP|Vice President|Chief|CEO|CTO|COO|CFO)\b/i.test(p.role)) return { role: 'Leader', does: runs.length ? `Runs the ${runs[0]} and watches the north stars` : 'Leads the reviews and watches the north stars' };
  if (/\b(Director|Head)\b/i.test(p.role)) return { role: 'Director', does: runs.length ? `Runs the ${runs[0]}${owns ? ` and owns ${owns} ${owns === 1 ? 'goal' : 'goals'}` : ''}` : 'Leads part of the organisation' };
  if (p.admin && !owns) return { role: 'Admin', does: 'Sets up people, years and reviews' };
  if (owns) return { role: 'Goal owner', does: `Owns ${owns} ${owns === 1 ? 'goal' : 'goals'} and checks in weekly` };
  return { role: 'Team member', does: watches ? `Watches ${watches === 1 ? 'a goal' : `${watches} goals`} and owns none` : 'Can see every goal' };
}

/** The people worth trying in the example: the VP, a goal owner with goals behind, someone who only watches, two more
    owners, the admin, and a director who runs a review. Elsewhere: a leader, an admin, the biggest owners and a watcher. */
const CAST = ['amara', 'rhea', 'oskar', 'tariq', 'mateo', 'grace', 'farah'];
export function demoCast(app: ReturnType<typeof useApp>): Person[] {
  const picked = CAST.map((id) => app.person(id)).filter((p): p is Person => !!p);
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
    <button type="button" className={compact ? 'demo-entry compact' : 'demo-entry'} title={`Demo: viewing as ${role}, ${app.viewer.name}`} onClick={onOpen}>
      <span className="demo-word">Demo</span>
      {!compact && <span className="demo-as">{role} · {app.viewer.name.split(' ')[0]}</span>}
      <span className="sr">{compact ? `, viewing as ${role}, ${app.viewer.name}` : ''}: open the demo controls</span>
    </button>
  );
}

export function DemoPanel({ onClose, onPresent, title = 'Demo', children }: { onClose: () => void; onPresent: () => void; title?: string; children?: ReactNode }) {
  const app = useApp();
  const modules = useModules();
  const nav = useNavigate();
  const switchTo = useSwitchWorkspace();
  const [resetting, setResetting] = useState(false);
  const cast = demoCast(app);
  const others = app.snapshot.people.filter((p) => !cast.includes(p));
  const [showAll, setShowAll] = useState(false);
  const pick = (id: string) => { app.setViewer(id); onClose(); nav('/'); };
  const own = !isExample(app.ws.id);
  const startTour = (id: string) => {
    const t = TOURS.find((x) => x.id === id)!;
    // The walkthroughs follow the example's people and goals: from a workspace you made, they open the example first.
    writeTour({ id, step: 0 });
    onClose();
    if (own) {
      try { localStorage.setItem('goals-app-viewer:' + EXAMPLE.id, t.personId); } catch { /* storage blocked */ }
      switchTo(EXAMPLE.id, t.start);
      return;
    }
    if (app.person(t.personId)) app.setViewer(t.personId);
    nav(t.start);
  };
  const row = (p: Person) => {
    const { role, does } = personaOf(p, app);
    return (
      <button key={p.id} type="button" className="menuitem persona" aria-current={p.id === app.viewer.id ? 'true' : undefined} onClick={() => pick(p.id)}>
        <Avatar p={p} size="sm" />
        <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <span className="strong">{role}</span>
          <span className="tiny muted">{p.name}{p.role ? `, ${p.role}` : ''} · {does}</span>
        </span>
        {p.id === app.viewer.id && <span className="tiny strong" style={{ color: 'var(--accent-text)' }}>Now</span>}
      </button>
    );
  };
  // A module's walkthrough only while the module is on here.
  const tours = TOURS.filter((t) => (own || app.person(t.personId)) && (!t.module || modules.on.has(t.module)));
  return (
    <Sheet open onClose={onClose} title={title} wide>
      {children}
      {/* Said plainly, once (demo review, 8 Nov, item 13). The same words are in Help, under The demo. */}
      <p className="hint demo-what">{PROTOTYPE_LINE}</p>
      {/* People and walkthroughs side by side on a desktop; everything else below, in one row of short sections. */}
      <div className="demo-grid">
        <section className="stack demo-people" style={{ gap: 4 }} aria-label="See it as">
          <span className="field-label">See it as</span>
          {cast.map(row)}
          {others.length > 0 && (showAll ? (
            <div className="demo-everyone">
              <PickOne kind="person" label={`Everyone else (${others.length})`} value={null} onChange={(id) => id && pick(id)} hide={cast.map((p) => p.id)} />
            </div>
          ) : <button type="button" className="linkish small" onClick={() => setShowAll(true)}>Everyone else, by name or team ({others.length})</button>)}
        </section>
        {tours.length > 0 && (
          <section className="stack demo-tours" style={{ gap: 4 }} aria-label="Show me how">
            <span className="field-label">Show me how</span>
            <span className="hint">A walkthrough you do yourself: it points at each step and moves on when you’ve done it.{own ? ` They use the example’s people and goals, so each opens ${EXAMPLE.name.replace(/^Example: /, 'the example, ')}; ${app.ws.name} stays as it is.` : ''}</span>
            {tours.map((t) => (
              <button key={t.id} type="button" className="menuitem" onClick={() => startTour(t.id)}>
                <span className="stack" style={{ gap: 0, flex: 1 }}><span className="strong">{t.title}</span><span className="tiny muted">As a {t.role.toLowerCase()} · {t.steps.length} steps</span></span>
              </button>
            ))}
          </section>
        )}
        <div className="demo-more">
        <section className="stack" style={{ gap: 4 }} aria-label="Research">
          <span className="field-label">Research</span>
          <Link className="menuitem" to="/research" onClick={onClose}><span className="stack" style={{ gap: 0 }}><span className="strong">Try it as a researcher</span><span className="tiny muted">Tasks to attempt, notes on any screen, and a report at the end</span></span></Link>
        </section>
        {app.ws.kind === 'example' && (
          <section className="stack" style={{ gap: 4 }} aria-label="Example data">
            <span className="field-label">Example data</span>
            {resetting
              ? <span className="stack demo-confirm" style={{ gap: 'var(--s2)' }}><span className="small">Undo every change in this example, and clear its drafts and what you’ve seen here? It only touches this browser: nobody else’s copy changes.</span><span className="row" style={{ gap: 'var(--s2)' }}><button type="button" className="btn sm" onClick={async () => { await app.resetExample(); setResetting(false); onClose(); nav('/'); }}>Yes, start over</button><button type="button" className="btn ghost sm" onClick={() => setResetting(false)}>Cancel</button></span></span>
              : <button type="button" className="menuitem" onClick={() => setResetting(true)}><span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="strong">Start over</span><span className="tiny muted">Undo every change in {app.ws.name.replace(/^Example: /, '')}, drafts included. Only in this browser</span></span></button>}
          </section>
        )}
        {/* A workspace made in the demo starts over by going: it and everything this browser kept about it (UX report, 8 Nov). */}
        {own && (
          <section className="stack" style={{ gap: 4 }} aria-label="Your workspace">
            <span className="field-label">Your workspace</span>
            {resetting
              ? <span className="stack demo-confirm" style={{ gap: 'var(--s2)' }}><span className="small">Remove {app.ws.name} and everything in it from this browser, drafts included, and go back to the example?</span><span className="row" style={{ gap: 'var(--s2)' }}><button type="button" className="btn sm" onClick={async () => { await app.deleteWorkspace(); app.switchWorkspace(EXAMPLE.id); setResetting(false); onClose(); nav('/'); }}>Yes, remove it</button><button type="button" className="btn ghost sm" onClick={() => setResetting(false)}>Cancel</button></span></span>
              : <button type="button" className="menuitem" onClick={() => setResetting(true)}><span className="stack" style={{ gap: 0, minWidth: 0 }}><span className="strong">Start over</span><span className="tiny muted">Remove {app.ws.name} from this browser and go back to the example</span></span></button>}
          </section>
        )}
        <section className="stack" style={{ gap: 4 }} aria-label="Options">
          <span className="field-label">Options</span>
          <button type="button" className="menuitem" onClick={() => { onPresent(); onClose(); }}><span className="stack" style={{ gap: 0 }}><span className="strong">Present without demo controls</span><span className="tiny muted">Bring them back from the menu</span></span></button>
          <a className="menuitem" href="/"><span className="strong">Leave the demo</span></a>
        </section>
        </div>
      </div>
    </Sheet>
  );
}
