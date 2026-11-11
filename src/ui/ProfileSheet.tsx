/* Who you are: find yourself by typing (or, in the demo, someone to view as). */
import type { ReactNode } from 'react';
import { useApp } from '../app/state';
import { watchedGoals } from '../domain/review';
import type { Person } from '../domain/types';
import { Sheet } from './bits';
import { PickOne } from './Pick';

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
  // Nothing is built while it's closed: in a workspace of thousands, this sheet is on every page.
  if (!open) return null;
  const me = app.person(app.viewer.id);
  return (
    <Sheet open onClose={onClose} title={app.mode === 'demo' ? 'View as someone else' : 'Who are you?'}>
      {children}
      <p className="hint" style={{ marginBottom: 'var(--s3)' }}>{app.mode === 'demo'
        ? 'Each person sees their own home: the goals they own, what they watch and the reviews they’re in.'
        : 'Type your name to find it. Sign-in comes later with your company login; until then this device remembers who you are.'}</p>
      {me && <p className="small">Now: <span className="strong">{me.name}</span>, {personFacts(me, app)}.</p>}
      {/* Find-and-pick (find spec, move 14): someone is found by typing, never chosen from a list of everyone. */}
      <PickOne kind="person" label={app.mode === 'demo' ? 'See it as' : 'Your name'} value={null} hide={[app.viewer.id]} onChange={(id) => { if (id) { app.setViewer(id); onClose(); } }} />
    </Sheet>
  );
}
