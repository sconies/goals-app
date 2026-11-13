/* The dialogs that take something away: stopping or deleting a goal, and marking someone as left (or deleting someone
   with no history). Each says plainly what happens to whatever depended on it; the rules themselves are in
   domain/removal, and every one of these is followed by a message with Undo. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { openAsksFor } from '../domain/asks';
import { goalHasCheckIns, hasHistory, leaving, personHistory } from '../domain/removal';
import { leftName, MIN_STOP_REASON } from '../domain/vocabulary';
import type { Goal, Person } from '../domain/types';
import { Sheet } from './bits';
import { PickOne } from './Pick';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const firstOf = (name: string) => name.split(' ')[0] ?? name;

/** What removing a goal is called: Stop when it has check-ins (its history stays), Delete when it has none. */
export const goalRemoveLabel = (hasCheckIns: boolean) => (hasCheckIns ? 'Stop this goal' : 'Delete this goal');

/** Stop a goal with history (with a reason), or delete one with none. */
export function RemoveGoalSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const app = useApp();
  const nav = useNavigate();
  const history = goalHasCheckIns(app.full, goal.id);
  const feeding = app.snapshot.goals.filter((g) => g.parentId === goal.id);
  const parent = goal.parentId ? app.goal(goal.parentId) : undefined;
  const asks = openAsksFor(goal.id, app.snapshot).length;
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const short = reason.trim().length < MIN_STOP_REASON;
  const go = async () => {
    setTried(true);
    if ((history && short) || busy) return;
    setBusy(true);
    try {
      if (history) { await app.stopGoal(goal, reason); onClose(); }
      else { await app.deleteGoal(goal); onClose(); nav('/goals'); }
    } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={history ? 'Stop this goal' : 'Delete this goal'}>
      <form className="stack remove-sheet" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void go(); }} noValidate>
        <p className="strong">{goal.title}</p>
        {history ? (
          <>
            <p className="small">It leaves the numbers, reviews, Home, Watching and the lists of what needs attention. Its page, chart and check-ins stay, marked Stopped, and it’s still in exports and Activity.</p>
            <div className="field">
              <label className="field"><span className="field-label">Why is it stopping?</span>
                <textarea className={'input' + (tried && short ? ' invalid' : '')} aria-invalid={tried && short ? true : undefined} rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: the platform team took this over in October" />
              </label>
              {tried && short && <span className="hint tone-off" role="alert">Say why, in a sentence ({MIN_STOP_REASON} characters or more). It’s kept with the goal.</span>}
            </div>
          </>
        ) : (
          <p className="small">It has no check-ins, so it’s deleted rather than stopped. You can undo it straight away, and an admin can restore it for 30 days.</p>
        )}
        {(feeding.length > 0 || asks > 0) && (
          <ul className="remove-effects small">
            {feeding.length > 0 && <li>{plural(feeding.length, 'goal feeding it feeds', 'goals feeding it feed')} {parent ? `“${parent.title}”` : 'nothing'} instead.</li>}
            {asks > 0 && <li>{asks === 1 ? 'Its open ask is' : `Its ${asks} open asks are`} withdrawn, with a note saying why.</li>}
          </ul>
        )}
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn danger big-btn" type="submit">{busy ? (history ? 'Stopping…' : 'Deleting…') : history ? 'Stop the goal' : 'Delete the goal'}</button></div>
      </form>
    </Sheet>
  );
}

/** Make an active goal with no check-ins proposed again (GE10, rule 14's `backToProposed`): its owner or an admin. */
export function BackToProposedSheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    try { await app.run('backToProposed', { goalId: goal.id }); onClose(); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="Make it proposed again">
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <p className="strong">{goal.title}</p>
        <p className="small">It will have no status and nothing will be due until it is made active.</p>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Keep it active</button><button className="btn primary big-btn" type="submit">{busy ? 'Saving…' : 'Make it proposed'}</button></div>
      </form>
    </Sheet>
  );
}

/** What taking someone out of the workspace is called for them: Mark as left, or (no history) Delete. */
export function leaveLabel(app: ReturnType<typeof useApp>, p: Person) {
  return hasHistory(personHistory(app.full, p.id)) ? 'Mark as left' : `Delete ${firstOf(p.name)}`;
}

/**
 * Mark someone as left: first who takes over their goals and their open asks (as asker and as responder), then they're
 * gone from pickers, counts, reviews and Home, and history names them "Name (left)". Someone with no history is deleted
 * outright instead.
 */
export function LeaveSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  const app = useApp();
  const history = hasHistory(personHistory(app.full, person.id));
  const l = leaving({ snapshot: app.snapshot, cycle: app.cycle, full: app.full }, person.id);
  const asks = new Set([...l.asked, ...l.asking].map((r) => r.id)).size;
  const [goalsTo, setGoalsTo] = useState('');
  const [asksTo, setAsksTo] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const first = firstOf(person.name);
  const blocked = person.id === app.viewer.id ? 'You can’t take yourself out of the workspace. Ask another admin.'
    : person.admin && !app.snapshot.people.some((p) => p.admin && p.id !== person.id) ? `${first} is the only admin: make someone else an admin first.` : null;
  const missingGoals = l.goals.length > 0 && !goalsTo;
  const missingAsks = asks > 0 && !asksTo;
  const go = async () => {
    setTried(true);
    if (blocked || busy || (history && (missingGoals || missingAsks))) return;
    setBusy(true);
    try {
      if (history) await app.markPersonLeft(person.id, { goalsTo: goalsTo || null, asksTo: asksTo || null });
      else await app.deletePerson(person.id);
      onClose();
    } catch { setBusy(false); }
  };
  const picker = (label: string, value: string, set: (v: string) => void, missing: boolean, hint: string) => (
    <div className="field">
      <PickOne kind="person" label={label} value={value || null} onChange={(id) => set(id ?? '')} hide={[person.id]} invalid={tried && missing} />
      <span className={'hint' + (tried && missing ? ' tone-off' : '')} role={tried && missing ? 'alert' : undefined}>{tried && missing ? 'Choose who takes them over.' : hint}</span>
    </div>
  );
  return (
    <Sheet open onClose={onClose} title={history ? `Mark ${person.name} as left` : `Delete ${person.name}`}>
      <form className="stack remove-sheet" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void go(); }} noValidate>
        {blocked ? <p className="small">{blocked}</p> : history ? (
          <>
            <p className="small">First, who takes over from {first}. Then {first} is gone from pickers, counts, reviews and Home. Their history stays, under “{leftName(person.name)}”.</p>
            {l.goals.length > 0 && picker(`Who takes over ${first}’s ${plural(l.goals.length, 'goal', 'goals')}?`, goalsTo, (v) => { setGoalsTo(v); if (!asksTo) setAsksTo(v); }, missingGoals,
              l.goals.slice(0, 3).map((g) => g.title).join(', ') + (l.goals.length > 3 ? `, and ${l.goals.length - 3} more` : ''))}
            {asks > 0 && picker(`Who takes over ${first}’s ${plural(asks, 'open ask', 'open asks')}?`, asksTo, setAsksTo, missingAsks,
              [l.asked.length ? `${plural(l.asked.length, 'they raised', 'they raised')}` : '', l.asking.length ? `${plural(l.asking.length, 'waiting on them', 'waiting on them')}` : ''].filter(Boolean).join(', ') + '. Each keeps its history.')}
            {!l.goals.length && !asks && <p className="small">{first} owns no goals in this cycle and has no open asks, so nothing needs handing over.</p>}
            {(l.reviews.length > 0 || l.leads.length > 0) && (
              <ul className="remove-effects small">
                {l.reviews.length > 0 && <li>{first} leaves {l.reviews.length === 1 ? 'the review' : 'the reviews'} {l.reviews.map((r) => `“${r.name}”`).join(', ')}.</li>}
                {l.leads.length > 0 && <li>{l.leads.map((t) => t.name).join(', ')} {l.leads.length === 1 ? 'is' : 'are'} led by {app.person(goalsTo)?.name ?? 'whoever takes over the goals (or no one)'} from now on.</li>}
              </ul>
            )}
          </>
        ) : (
          <p className="small">{person.name} has no goals, check-ins, notes or asks here, so they’re deleted rather than marked as left. You can undo it straight away, and an admin can restore them for 30 days.</p>
        )}
        <div className="foot-row">
          <button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button>
          {!blocked && <button className="btn danger big-btn" type="submit">{busy ? 'Saving…' : history ? 'Mark as left' : `Delete ${first}`}</button>}
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Leave this workspace yourself (backlog WS, Lane 9 Nov): who takes over your goals and open asks first, then you're
 * gone from it. The only admin is told to make someone else an admin first. An admin can bring you back from Recently
 * removed for 30 days.
 */
export function LeaveWorkspaceSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const me = app.viewer;
  const l = leaving({ snapshot: app.snapshot, cycle: app.cycle, full: app.full }, me.id);
  const asks = new Set([...l.asked, ...l.asking].map((r) => r.id)).size;
  const [goalsTo, setGoalsTo] = useState('');
  const [asksTo, setAsksTo] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const blocked = me.admin && !app.snapshot.people.some((p) => p.admin && p.id !== me.id) ? 'You’re the only admin here, so you can’t leave yet: make someone else an admin in People first.' : null;
  const missingGoals = l.goals.length > 0 && !goalsTo;
  const missingAsks = asks > 0 && !asksTo;
  const go = async () => {
    setTried(true);
    if (blocked || busy || missingGoals || missingAsks) return;
    setBusy(true);
    try { await app.leaveWorkspace({ goalsTo: goalsTo || null, asksTo: asksTo || null }); onClose(); } catch { setBusy(false); }
  };
  const picker = (label: string, value: string, set: (v: string) => void, missing: boolean, hint: string) => (
    <div className="field">
      <PickOne kind="person" label={label} value={value || null} onChange={(id) => set(id ?? '')} hide={[me.id]} invalid={tried && missing} />
      <span className={'hint' + (tried && missing ? ' tone-off' : '')} role={tried && missing ? 'alert' : undefined}>{tried && missing ? 'Choose who takes them over.' : hint}</span>
    </div>
  );
  return (
    <Sheet open onClose={onClose} title={`Leave ${app.ws.name}?`}>
      <form className="stack remove-sheet" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void go(); }} noValidate>
        {blocked ? <p className="small">{blocked}</p> : (
          <>
            <p className="small">You’ll be gone from its pickers, counts, reviews and Home{app.mode === 'demo' ? ', in this browser' : ''}. What you did here stays in its history, under “{leftName(me.name)}”. An admin can bring you back from Recently removed for 30 days.</p>
            {l.goals.length > 0 && picker(`Who takes over your ${plural(l.goals.length, 'goal', 'goals')}?`, goalsTo, (v) => { setGoalsTo(v); if (!asksTo) setAsksTo(v); }, missingGoals,
              l.goals.slice(0, 3).map((g) => g.title).join(', ') + (l.goals.length > 3 ? `, and ${l.goals.length - 3} more` : ''))}
            {asks > 0 && picker(`Who takes over your ${plural(asks, 'open ask', 'open asks')}?`, asksTo, setAsksTo, missingAsks, 'Each keeps its history.')}
            {!l.goals.length && !asks && <p className="small">You own no goals in this cycle and have no open asks, so nothing needs handing over.</p>}
            {l.reviews.length > 0 && <p className="small">You leave {l.reviews.length === 1 ? 'the review' : 'the reviews'} {l.reviews.map((r) => `“${r.name}”`).join(', ')}.</p>}
          </>
        )}
        <div className="foot-row">
          <button className="btn ghost big-btn" type="button" onClick={onClose}>{blocked ? 'Close' : 'Stay'}</button>
          {!blocked && <button className="btn danger big-btn" type="submit">{busy ? 'Leaving…' : 'Leave the workspace'}</button>}
        </div>
      </form>
    </Sheet>
  );
}
