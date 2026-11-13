/* "Propose a new goal" in a review's walk (goal entry GE10, decision 15; spec 2.15 "Reviews"): the room proposes the
   goal itself, with only a name, who would own it and what it would feed. It is saved through the saveGoal action as a
   proposed goal with `proposedIn` (the review), so its owner's Home says where it came from and the review's next
   "Last time" names it. Loaded only when opened. */
import { useState } from 'react';
import { useApp } from '../app/state';
import { blankGoal } from '../domain/goal';
import { nameProblem } from '../domain/thresholds';
import type { Goal, Review } from '../domain/types';
import { Sheet } from './bits';
import { PersonPick } from './PersonPick';
import { PickOne } from './Pick';

/** What was typed, kept while the page is open when the sheet is closed without Cancel (build review of #376). */
const drafts = new Map<string, { title: string; owner: string | null; feeds: string | null }>();

export function ProposeInReview({ goal, review, onClose, returnFocus }: { goal: Goal; review: Review; onClose: () => void; returnFocus?: () => HTMLElement | null }) {
  const app = useApp();
  const key = `${review.id}:${goal.id}`;
  const kept = drafts.get(key);
  const [title, setTitle] = useState(kept?.title ?? '');
  // Who would own it starts as the owner of the goal on screen; what it would feed, as that goal.
  const [owner, setOwner] = useState<string | null>(kept ? kept.owner : goal.ownerId);
  const [feeds, setFeeds] = useState<string | null>(kept ? kept.feeds : goal.id);
  const dismiss = () => { if (title.trim()) drafts.set(key, { title, owner, feeds }); onClose(); };
  const cancel = () => { drafts.delete(key); onClose(); };
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const named = nameProblem(title, 'goal');
  const save = async () => {
    if (named || !owner) { setTried(true); return; }
    setBusy(true);
    try {
      const teamId = app.person(owner)?.teamId ?? goal.teamId;
      const g = await app.saveGoal({ ...blankGoal(teamId, owner, feeds ?? ''), title: title.trim() }, null, { state: 'proposed', proposedIn: review.id });
      const who = owner === app.viewer.id ? 'You' : app.person(owner)?.name.split(' ')[0] ?? 'Its owner';
      app.toast(`Proposed “${g.title}”. ${who} can make it active once it’s set up.`);
      drafts.delete(key);
      onClose();
    } catch { setBusy(false); } // the save already said what went wrong; what was typed stays
  };
  return (
    <Sheet open onClose={dismiss} title="Propose a new goal" returnFocus={returnFocus}>
      <form className="stack" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <span className="hint">In {review.name}. It is saved as proposed: everyone can see it, and nothing is due on it. Its owner sets it up and makes it active.</span>
        <label className="field"><span className="field-label">What should the goal be called?</span>
          <input className={'input' + (tried && named ? ' invalid' : '')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          {tried && named && <span className="hint tone-off" role="alert">{named}</span>}
        </label>
        <span className="stack" style={{ gap: 'var(--s1)' }}>
          <PersonPick value={owner} onChange={setOwner} label="Who will own it?" invalid={tried && !owner}
            suggest={[{ id: goal.ownerId, note: 'who owns this goal' }, ...(goal.ownerId !== app.viewer.id ? [{ id: app.viewer.id, note: '' }] : [])]} />
          {tried && !owner && <span className="hint tone-off" role="alert">Choose who will own it.</span>}
        </span>
        <PickOne kind="goal" label="It will feed" none="Nothing: top of its own tree" value={feeds} onChange={setFeeds} first={[{ id: goal.id, note: 'the goal on screen' }]} />
        <div className="foot-row">
          <button type="button" className="btn ghost big-btn" onClick={cancel}>Cancel</button>
          <button type="submit" className="btn primary big-btn" disabled={busy}>{busy ? 'Saving…' : 'Propose it'}</button>
        </div>
      </form>
    </Sheet>
  );
}
