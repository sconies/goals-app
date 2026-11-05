/* Answering a request for a decision or help (product review, 3 Nov): the exact ask, who raised it and when, every goal
   waiting on it, and a focused place to answer. Answering closes the request for every linked goal; asking the owner a
   question instead leaves it open. Review coverage ("Reviewed & next") is separate and never answers a request.
   Since the flagship goal page (5 Nov) it's answered in place, in the goal's "Asked of you": Home's Respond opens the
   goal with this form open and the answer box focused. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { canAnswer } from '../domain/requests';
import type { HelpRequest } from '../domain/types';
import { timeAgo } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { mark } from '../telemetry';

export function RespondForm({ request: r, onClose, focus }: { request: HelpRequest; onClose: () => void; focus?: boolean }) {
  const app = useApp();
  const [mode, setMode] = useState<'answer' | 'ask'>('answer');
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const asker = app.person(r.askedBy);
  const goals = r.goalIds.map((id) => app.goal(id)).filter((g) => !!g);
  const allowed = canAnswer(r, app.viewer);
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
  const save = async () => {
    setTried(true);
    if (text.trim().length < 3 || busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (mode === 'answer') {
        await app.answerRequest(r, text);
        app.toast(goals.length > 1 ? `Answered for all ${goals.length} goals waiting on it` : 'Answered. The owner sees it on the goal and in the next review.');
      } else {
        await app.addNote(goals[0]!, `${asker?.name.split(' ')[0] ?? 'Hi'}, about your request (“${r.ask}”): ${text.trim()}`);
        app.toast('Asked. The request stays open until it’s answered.');
      }
      onClose();
    } catch { inFlight.current = false; setBusy(false); }
  };
  return (
    <form ref={form} className="stack respond-form" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <span className="hint">{goals.length > 1 ? `${goals.length} goals are waiting on this: ` : 'For '}{goals.map((g, i) => <span key={g.id}>{i ? ', ' : ''}<Link className="linkish" to={'/goals/' + g.id}>{g.title}</Link></span>)}. Asked by {asker?.name ?? 'the owner'} {timeAgo(r.createdAt, app.today)}.</span>
      {allowed ? (
        <>
          <div className="seg full" role="group" aria-label="How to respond">
            <button type="button" aria-pressed={mode === 'answer'} onClick={() => setMode('answer')}>Answer it</button>
            <button type="button" aria-pressed={mode === 'ask'} onClick={() => setMode('ask')}>Ask the owner first</button>
          </div>
          <label className="field"><span className="field-label">{mode === 'answer' ? 'Your answer or decision' : 'Your question'}</span>
            <textarea ref={box} className={'input' + (tried && text.trim().length < 3 ? ' invalid' : '')} rows={3} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={mode === 'answer' ? 'e.g. Approved: interim read-only scope until the vendor fix lands' : 'e.g. What would read-only scope leave out?'} />
            {/* A line kept for the message, so the footer doesn't jump when it appears. */}
            <span className="field-msg" role="alert">{tried && text.trim().length < 3 && <><Icon name="alert" size={16} />Write a few words.</>}</span>
            <span className="hint">{mode === 'answer' ? `This closes the request${goals.length > 1 ? ` for all ${goals.length} goals` : ''}. It’s logged, and the next review sees it was answered.` : 'The request stays open; your question goes on the goal for its owner.'}</span>
          </label>
          <div className="sheet-foot respond-foot">
            <button type="button" className="linkish small" onClick={onClose}>Leave it open</button>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : mode === 'answer' ? 'Record the answer' : 'Ask the owner'}</button>
          </div>
        </>
      ) : <p className="hint">Only {r.recipientId ? app.person(r.recipientId)?.name : 'the person asked'} or an admin can answer it. You can comment on the goal.</p>}
    </form>
  );
}
