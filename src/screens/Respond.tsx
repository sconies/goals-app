/* The one Respond panel (one way to ask, 5 Nov): every ask, whatever its kind, is answered here, in place on the goal
   page's "Asked of you" (Home's buttons open the goal with this panel open and its box focused). It says exactly what
   was asked, who asked and when, every goal it covers, and offers the one way to close it:
   - a decision or help, or a question: answer it (one answer closes it for every goal it covers);
   - an ask for an update: check in, or answer it in a sentence;
   - an action: mark it done, with an optional note.
   Someone who needs more before deciding asks the owner a question, which is an ask of its own, open until answered;
   the ask they're responding to stays open. Review coverage ("Reviewed & next") is separate and never answers an ask. */
import { mayPostCheckIn } from '../domain/goalRights';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { canAnswer, canMarkDone } from '../domain/asks';
import type { Ask } from '../domain/types';
import { timeAgo } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { mark } from '../telemetry';

export function RespondForm({ ask: r, onClose, focus }: { ask: Ask; onClose: () => void; focus?: boolean }) {
  const app = useApp();
  const [mode, setMode] = useState<'answer' | 'ask'>('answer');
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const asker = app.person(r.askedBy);
  const goals = r.goalIds.map((id) => app.goal(id)).filter((g) => !!g);
  const owner = goals[0] ? app.person(goals[0].ownerId) : undefined;
  const action = r.kind === 'action';
  const allowed = action ? canMarkDone(r, app.viewer) : canAnswer(r, app.viewer);
  // Asking the owner first fits a decision or help someone else needs from you; an owner doesn't ask themselves.
  const canAskBack = r.kind === 'decision' && !!owner && owner.id !== app.viewer.id;
  const inFlight = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  // The answer-a-request flow (src/help/flows.ts): opened here, and closed when the form goes, answered or not.
  useEffect(() => { mark('respond.open'); return () => mark('respond.close'); }, []);
  const form = useRef<HTMLFormElement>(null);
  // Opened from a link: the answer box takes the focus, and the whole form is brought into view, its button included.
  useEffect(() => {
    if (!focus) return;
    box.current?.focus({ preventScroll: true });
    // After the page has settled at the top (the shell scrolls a new page there once it's drawn).
    const t = setTimeout(() => form.current?.scrollIntoView?.({ block: 'nearest' }), 80);
    return () => clearTimeout(t);
  }, [focus]);
  // An action's note is optional; an answer or a question needs a few words.
  const short = !action && text.trim().length < 3;
  const save = async () => {
    setTried(true);
    if (short || busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (action) {
        await app.markActionDone(r, text);
        app.toast(`Marked done. ${asker && asker.id !== app.viewer.id ? `${asker.name.split(' ')[0]} sees it on the goal` : 'It shows as done on the goal'} and in the review.`);
      } else if (mode === 'answer') {
        await app.answerRequest(r, text);
        app.toast(goals.length > 1 ? `Answered for all ${goals.length} goals waiting on it` : `Answered. ${asker && asker.id !== app.viewer.id ? `${asker.name.split(' ')[0]} sees it on the goal` : 'It’s on the goal'} and in the next review.`);
      } else {
        await app.askQuestion(goals[0]!, text);
        app.toast(`Asked ${owner?.name.split(' ')[0] ?? 'the owner'}. Their request stays open until you answer it.`);
      }
      onClose();
    } catch { inFlight.current = false; setBusy(false); }
  };
  const label = action ? 'A note (optional)' : mode === 'ask' ? `Your question for ${owner?.name.split(' ')[0] ?? 'the owner'}` : r.kind === 'update' ? 'Or answer in a sentence' : 'Your answer or decision';
  const hint = action ? 'Marking it done closes it. It’s logged, and the review sees it was done.'
    : mode === 'ask' ? 'Their request stays open; your question is open on their Home until they answer it.'
    : `This closes it${goals.length > 1 ? ` for all ${goals.length} goals` : ''}. It’s logged, and the next review sees it was answered.`;
  const button = busy ? 'Saving…' : action ? 'Mark done' : mode === 'ask' ? 'Ask the question' : 'Record the answer';
  return (
    <form ref={form} className="stack respond-form" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <span className="hint">{goals.length > 1 ? `${goals.length} goals are waiting on this: ` : 'For '}{goals.map((g, i) => <span key={g.id}>{i ? ', ' : ''}<Link className="linkish" to={'/goals/' + g.id}>{g.title}</Link></span>)}. {action ? 'Agreed' : 'Asked'} by {asker?.name ?? 'the owner'} {timeAgo(r.createdAt, app.today)}{r.dueWeek != null ? `, due week ${r.dueWeek}` : ''}.</span>
      {allowed ? (
        <>
          {/* Check-ins are the owner's (R1): anyone else answers in a sentence. */}
          {r.kind === 'update' && goals[0] && mayPostCheckIn(app.viewer, goals[0], 'form') && <Link className="btn" to={'/check-in/' + goals[0].id}>Check in for week {app.week}</Link>}
          {canAskBack && (
            <div className="seg full" role="group" aria-label="How to respond">
              <button type="button" aria-pressed={mode === 'answer'} onClick={() => setMode('answer')}>Answer it</button>
              <button type="button" aria-pressed={mode === 'ask'} onClick={() => setMode('ask')}>Ask the owner first</button>
            </div>
          )}
          <label className="field"><span className="field-label">{label}</span>
            <textarea ref={box} className={'input' + (tried && short ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={action ? 'e.g. Done: config changes go through the pipeline from today' : mode === 'answer' ? 'e.g. Approved: the extra runner budget for Q4' : 'e.g. What would the smaller pool leave out?'} />
            {/* A line kept for the message, so the footer doesn't jump when it appears. */}
            <span className="field-msg" role="alert">{tried && short && <><Icon name="alert" size={16} />Write a few words.</>}</span>
            <span className="hint">{hint}</span>
          </label>
          <div className="sheet-foot respond-foot">
            <button type="button" className="linkish small" onClick={onClose}>Leave it open</button>
            <button type="submit" className="btn primary" disabled={busy}>{button}</button>
          </div>
        </>
      ) : <p className="hint">Only {r.recipientId ? app.person(r.recipientId)?.name : 'the person asked'}{action ? ', whoever agreed it,' : ''} or an admin can {action ? 'mark it done' : 'answer it'}. You can comment on the goal.</p>}
    </form>
  );
}
