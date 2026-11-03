/* The research bar, while a research session is on: the current task, how it went, a note on any part of any
   screen, and a first-glance question on each new screen. Kept small and to one side. */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useApp } from '../app/state';
import { addNote, readNotes, screenName, TASKS, writeSession, type ResearchNote } from '../app/research';
import { useResearch } from '../screens/Research';
import { personaOf } from './Demo';

type Card = { kind: 'glance' } | { kind: 'pick' } | { kind: 'comment'; target: string } | { kind: 'task' } | null;

function describe(el: Element): string {
  const label = el.getAttribute('aria-label') || el.closest('[aria-label]')?.getAttribute('aria-label') || '';
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const what = (label || text).slice(0, 90);
  return what || el.tagName.toLowerCase();
}

export function ResearchBar() {
  const app = useApp();
  const s = useResearch();
  const { pathname } = useLocation();
  const [card, setCard] = useState<Card>(null);
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState<NonNullable<ResearchNote['severity']>>('minor');
  // No outcome until one is chosen: a task's result is never carried over from the last one.
  const [outcome, setOutcome] = useState<ResearchNote['outcome'] | null>(null);
  const [rating, setRating] = useState(4);
  const screen = screenName(pathname);
  const persona = personaOf(app.viewer, app).role;

  // A first glance on each screen not yet seen in this session.
  useEffect(() => {
    if (!s || pathname === '/research') return;
    let skipped: string[] = [];
    try { skipped = JSON.parse(sessionStorage.getItem('goals-research-skipped') || '[]'); } catch { /* ignore */ }
    const seen = readNotes(s.id).some((n) => n.kind === 'first-glance' && screenName(n.route) === screen) || skipped.includes(screen);
    if (!seen) { setText(''); setCard((c) => (c && c.kind !== 'glance' ? c : { kind: 'glance' })); }
  }, [s, pathname, screen]);

  // Picking the part of the screen a note is about: the next click anywhere outside the bar.
  useEffect(() => {
    if (card?.kind !== 'pick') return;
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el || el.closest('.research-bar')) return;
      e.preventDefault();
      e.stopPropagation();
      setText('');
      setCard({ kind: 'comment', target: describe(el) });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCard(null); };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('research-picking');
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('keydown', onKey); document.body.classList.remove('research-picking'); };
  }, [card]);

  if (!s || pathname === '/research') return null;
  const task = TASKS[s.task];
  const save = async () => {
    if (!card || card.kind === 'pick') return;
    if (card.kind === 'glance') {
      if (text.trim().length < 3) return;
      await addNote(s, { kind: 'first-glance', persona, route: pathname, target: '', text: text.trim() });
      app.toast(`First glance noted: ${screen}`);
    } else if (card.kind === 'comment') {
      if (text.trim().length < 3) return;
      await addNote(s, { kind: 'comment', persona, route: pathname, target: card.target, severity, text: text.trim() });
      app.toast('Note saved');
    } else if (card.kind === 'task' && task) {
      if (!outcome) return;
      await addNote(s, { kind: 'task', persona, route: pathname, target: '', taskId: task.id, outcome, rating, text: text.trim() });
      // After the last task the session moves past it: all done, and the hub asks for the report (no repeat of the last one).
      writeSession({ ...s, task: Math.min(TASKS.length, s.task + 1) });
      app.toast(`Task ${s.task + 1} noted`);
    }
    setCard(null);
    setText('');
  };
  const skipGlance = () => {
    try { const k = 'goals-research-skipped'; sessionStorage.setItem(k, JSON.stringify([...JSON.parse(sessionStorage.getItem(k) || '[]'), screen])); } catch { /* ignore */ }
    setCard(null);
  };

  return (
    <aside className="research-bar" aria-label="Research">
      {card?.kind === 'glance' && (
        <form className="research-card" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <span className="label">First glance · {screen}</span>
          <label className="field"><span className="small strong">Before you do anything: what is this page for, and what would you do first?</span>
            <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <span className="row"><button type="submit" className="btn sm" disabled={text.trim().length < 3}>Save</button><button type="button" className="btn ghost sm" onClick={skipGlance}>Skip</button></span>
        </form>
      )}
      {card?.kind === 'pick' && <div className="research-card" role="status"><span className="small strong">Click the part of the screen your note is about.</span><span className="hint">Esc to cancel.</span></div>}
      {card?.kind === 'comment' && (
        <form className="research-card" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <span className="label">Note on “{card.target}” · {screen}</span>
          <label className="field"><span className="sr">How much it matters</span>
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
              <option value="blocker">Blocker: can’t get it done</option><option value="major">Major: done, but hard or wrong</option><option value="minor">Minor</option><option value="polish">Polish</option><option value="idea">An idea</option>
            </select>
          </label>
          <label className="field"><span className="sr">Your note</span><textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What you did, what you expected, what happened" /></label>
          <span className="row"><button type="submit" className="btn sm" disabled={text.trim().length < 3}>Save note</button><button type="button" className="btn ghost sm" onClick={() => setCard(null)}>Cancel</button></span>
        </form>
      )}
      {card?.kind === 'task' && task && (
        <form className="research-card" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <span className="label">Task {s.task + 1} · {task.title}</span>
          <fieldset className="field"><legend className="small strong">How did it go?</legend>
            <span className="row">{(['done', 'stuck', 'gave-up'] as const).map((o) => <label key={o} className="check"><input type="radio" name="outcome" checked={outcome === o} onChange={() => setOutcome(o)} /> {o === 'done' ? 'Done' : o === 'stuck' ? 'Stuck' : 'Gave up'}</label>)}</span>
          </fieldset>
          <label className="field"><span className="small strong">How sure are you it’s right? (1 to 5)</span>
            <select className="input" value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <label className="field"><span className="small strong">What happened</span><textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <span className="row"><button type="submit" className="btn sm" disabled={!outcome}>Save and next task</button><button type="button" className="btn ghost sm" onClick={() => setCard(null)}>Cancel</button></span>
        </form>
      )}
      <div className="research-strip">
        <span className="stack" style={{ gap: 0, minWidth: 0 }}>
          <span className="label">Research · as {persona}</span>
          {task ? <span className="small strong ellipsis" title={task.detail}>Task {s.task + 1}: {task.title}</span> : <span className="small strong">All {TASKS.length} tasks noted</span>}
        </span>
        <span className="row nowrap" style={{ gap: 'var(--s1)' }}>
          {task && <button type="button" className="btn sm" onClick={() => { setText(''); setOutcome(null); setRating(4); setCard({ kind: 'task' }); }}>How did it go?</button>}
          <button type="button" className="btn sm" onClick={() => setCard({ kind: 'pick' })}>Note on this</button>
          <Link className={'btn sm' + (task ? ' ghost' : '')} to="/research">{task ? 'Hub' : 'Write your report'}</Link>
        </span>
      </div>
    </aside>
  );
}
