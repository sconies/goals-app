/* Who you are: the people in the workspace, by team, to pick yourself (or, in the demo, someone to view as). */
import type { ReactNode } from 'react';
import { useApp } from '../app/state';
import { watchedGoals } from '../domain/review';
import type { Person } from '../domain/types';
import { Avatar, Sheet } from './bits';

/** What a person does here, in a few words: the goals they own, what they watch, whether they're an admin. */
export function personFacts(p: Person, app: ReturnType<typeof useApp>): string {
  const owns = app.snapshot.goals.filter((g) => g.ownerId === p.id).length;
  const watches = watchedGoals(p.id, app.snapshot).length;
  const reviews = app.snapshot.reviews.filter((r) => r.people.includes(p.id)).length;
  const bits = [owns ? `owns ${owns}` : '', watches ? `watches ${watches}` : '', reviews ? `in ${reviews} ${reviews === 1 ? 'review' : 'reviews'}` : '', p.admin ? 'admin' : ''].filter(Boolean);
  return bits.length ? bits.join(', ') : 'can view everything';
}

export function ProfileSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children?: ReactNode }) {
  const app = useApp();
  const teams = [...app.snapshot.teams.map((t) => [t.name, app.snapshot.people.filter((x) => x.teamId === t.id)] as const), ['No team', app.snapshot.people.filter((x) => !x.teamId)] as const].filter(([, l]) => l.length);
  return (
    <Sheet open={open} onClose={onClose} title={app.mode === 'demo' ? 'View as someone else' : 'Who are you?'}>
      {children}
      <p className="hint" style={{ marginBottom: 'var(--s3)' }}>{app.mode === 'demo'
        ? 'Each person sees their own home: the goals they own, what they watch and the reviews they’re in.'
        : 'Pick your name. Sign-in comes later with your company login; until then this device remembers who you are.'}</p>
      {teams.map(([team, list]) => (
        <section key={team} className="stack" style={{ gap: 'var(--s1)', marginBottom: 'var(--s4)' }}>
          <span className="field-label">{team}</span>
          {list.map((x) => (
            <button key={x.id} className="menuitem" aria-current={x.id === app.viewer.id ? 'true' : undefined} onClick={() => { app.setViewer(x.id); onClose(); }}>
              <Avatar p={x} size="sm" />
              <span className="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}><span className="strong">{x.name}</span><span className="tiny muted">{personFacts(x, app)}</span></span>
              {x.id === app.viewer.id && <span className="tiny strong" style={{ color: 'var(--accent-text)' }}>You</span>}
            </button>
          ))}
        </section>
      ))}
    </Sheet>
  );
}
