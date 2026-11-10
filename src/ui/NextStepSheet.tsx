/* A next step on a goal, from its page (backlog GD(1), deep review P2): what happens next, who does it (the person
   search) and by when. Adding one asks all three; changing one keeps the log's before and after (actions.editCall). */
import { useState } from 'react';
import { useApp } from '../app/state';
import { weekDates } from '../domain/plan';
import type { Ask, Goal } from '../domain/types';
import { Sheet } from './bits';
import { PersonPick } from './PersonPick';

export function NextStepSheet({ goal, existing, onClose }: { goal: Goal; existing?: Ask | null; onClose: () => void }) {
  const app = useApp();
  const [text, setText] = useState(existing?.ask ?? '');
  const [who, setWho] = useState<string>(existing?.recipientId ?? goal.ownerId);
  const [due, setDue] = useState<number | null>(existing?.dueWeek ?? null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const weeks = Array.from({ length: Math.max(0, app.cycle.weeks - Math.max(1, app.week) + 1) }, (_, k) => Math.max(1, app.week) + k);
  // An existing action may be due in a week already past: keep it choosable.
  if (existing?.dueWeek != null && !weeks.includes(existing.dueWeek)) weeks.unshift(existing.dueWeek);
  const bad = { text: text.trim().length < 3, due: due == null };
  const save = async () => {
    if (bad.text || bad.due) { setTried(true); return; }
    setBusy(true);
    try {
      if (existing) await app.editCall(existing, text, { assigneeId: who, dueWeek: due });
      else await app.addAction(goal, text, { assigneeId: who, dueWeek: due });
      app.toast(existing ? 'Next step changed' : `Next step added to ${goal.title}`);
      onClose();
    } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`${existing ? 'Change the next step' : 'Add a next step'}: ${goal.title}`}>
      <form className="stack" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <span className="hint">Whoever does it sees it on Home and on this goal, open until it’s marked done. Once its week has passed it is overdue, and the goal needs attention again.</span>
        <label className="field"><span className="field-label composer-label">What happens next</span>
          <textarea className={'input' + (tried && bad.text ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing" />
          {tried && bad.text && <span className="hint tone-off" role="alert">Write a few words first.</span>}
        </label>
        <div className="pair">
          <PersonPick value={who} onChange={setWho} label="Who" />
          <label className="field"><span className="field-label">By</span>
            <select className={'input' + (tried && bad.due ? ' invalid' : '')} value={due ?? ''} onChange={(e) => setDue(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Choose a week</option>
              {weeks.map((w) => <option key={w} value={w}>{w === app.week ? 'This week' : `Week ${w}`} · {weekDates(app.cycle, w)}</option>)}
            </select>
            {tried && bad.due && <span className="hint tone-off" role="alert">Choose the week it’s due by.</span>}
          </label>
        </div>
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save the change' : 'Add the next step'}</button></div>
      </form>
    </Sheet>
  );
}
