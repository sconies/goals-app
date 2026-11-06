/* The research hub: everything a researcher (a person or an AI agent) needs to try the app and report back:
   what it's for, what's deliberately not built yet, the tasks, how to leave notes, and where the report goes. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { addNote, notesMarkdown, readNotes, readSession, REPORT_TEMPLATE, startSession, TASKS, writeSession, type ResearchSession } from '../app/research';
import { saveAndSay } from '../app/files';
import { personaOf } from '../ui/Demo';

export function useResearch(): ResearchSession | null {
  const [s, set] = useState(readSession);
  useEffect(() => {
    const on = () => set(readSession());
    window.addEventListener('goals-research', on);
    return () => window.removeEventListener('goals-research', on);
  }, []);
  return s;
}

export function Research() {
  const app = useApp();
  const nav = useNavigate();
  const s = useResearch();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'person' | 'ai'>('person');
  const [report, setReport] = useState(REPORT_TEMPLATE);
  const [sent, setSent] = useState(false);
  const notes = s ? readNotes(s.id) : [];
  const done = (id: string) => notes.find((n) => n.kind === 'task' && n.taskId === id);
  const go = (i: number) => {
    if (!s) return;
    const t = TASKS[i]!;
    writeSession({ ...s, task: i });
    if (app.person(t.as)) app.setViewer(t.as);
    nav(t.start);
  };
  const submit = async () => {
    if (!s || report.trim().length < 40) return;
    await addNote(s, { kind: 'report', persona: personaOf(app.viewer, app).role, route: '/research', target: '', text: report.trim() });
    setSent(true);
    app.toast('Report received. Thank you');
  };
  return (
    <div className="page narrow research">
      <div className="page-head">
        <h1 className="title-xl">Research this app</h1>
        <span className="hint">For people and AI agents trying it out. Use it as you would, say what you think as you go, and try to break it.</span>
      </div>

      <section className="block">
        <h2 className="block-title">What it is</h2>
        <p>A goals tool for a company of about 15,000 people. Goals are set for the year; owners check in on each one every week (or whenever something changes): the number, whether it’s on track, and if not, why and how it gets back on plan. Leaders manage by exception: the app brings forward what’s off track, getting worse or without a recent update, with the owner’s account of it, and doesn’t let a number hide. Reviews walk the goals worst first.</p>
        <p>You’re in the demo: an invented organisation, Platform Engineering, kept in your browser. Pick who you are from the Demo control; each task below picks for you.</p>
      </section>

      <section className="block note-box" aria-label="Not built yet, on purpose">
        <h2 className="block-title">Not built yet, on purpose: access control</h2>
        <p>There is no sign-in yet. In the demo anyone can be anyone, and the real app trusts who you say you are. Company sign-in and access control come later, by design. Please don’t report this; everything else is fair game.</p>
      </section>

      <section className="block">
        <h2 className="block-title">How to do it</h2>
        <ol className="steps-list">
          <li><span className="strong">First glance.</span> On each new screen, before doing anything, say what you think it’s for and what you’d do first. The app asks.</li>
          <li><span className="strong">Do the tasks.</span> Each is a goal, not a set of steps. Work it out as a busy person would; then say how it went: done, stuck or gave up.</li>
          <li><span className="strong">Comment on anything.</span> Use “Note on this” in the research bar, then click the part of the screen you mean.</li>
          <li><span className="strong">Try to break it.</span> Wrong numbers, empty fields, back and refresh mid-way, a phone-sized window.</li>
          <li><span className="strong">Write the report</span> below, most important findings first, each with the screen, what you did, what you expected and what happened.</li>
        </ol>
      </section>

      {!s ? (
        <section className="block">
          <h2 className="block-title">Start</h2>
          <form className="stack" style={{ gap: 'var(--s3)', maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); startSession(name || (kind === 'ai' ? 'AI agent' : 'Anonymous'), kind); }}>
            <label className="field"><span className="field-label">Your name, or the agent’s <span className="hint">optional</span></span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <fieldset className="field"><legend className="field-label">You are</legend>
              <span className="row"><label className="check"><input type="radio" name="rk" checked={kind === 'person'} onChange={() => setKind('person')} /> A person</label><label className="check"><input type="radio" name="rk" checked={kind === 'ai'} onChange={() => setKind('ai')} /> An AI agent</label></span>
            </fieldset>
            <div><button type="submit" className="btn primary big-btn">Start the session</button></div>
          </form>
        </section>
      ) : (
        <>
          <section className="block">
            <div className="row between"><h2 className="block-title">Tasks <span className="hint">· {(() => {
              const said = TASKS.map((t) => done(t.id)).filter(Boolean);
              const count = (o: string) => said.filter((r) => r!.outcome === o).length;
              const parts = [count('done') && `${count('done')} done`, count('stuck') && `${count('stuck')} stuck`, count('gave-up') && `${count('gave-up')} gave up`].filter(Boolean);
              return `${said.length} of ${TASKS.length} recorded${parts.length ? `: ${parts.join(', ')}` : ''}`;
            })()}</span></h2></div>
            <ol className="task-list">
              {TASKS.map((t, i) => {
                const r = done(t.id);
                return (
                  <li key={t.id} className={r ? 'task-done' : ''}>
                    <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span className="strong">{i + 1}. {t.title}</span>
                      <span className="small muted">{t.detail}</span>
                      {r && <span className="small">You said: {r.outcome === 'done' ? 'done' : r.outcome === 'stuck' ? 'stuck' : 'gave up'}{r.rating ? `, confidence ${r.rating} of 5` : ''}</span>}
                    </span>
                    <button type="button" className="btn sm" onClick={() => go(i)}>{r ? 'Try again' : i === s.task ? 'Start' : 'Go'}</button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="block">
            <h2 className="block-title">Your report</h2>
            <span className="hint">{notes.length} {notes.length === 1 ? 'note' : 'notes'} so far. They’re kept with the report. Paste a report written elsewhere, or load a file.</span>
            {sent ? <p className="calm">Report received. Thank you.</p> : (
              <>
                <textarea className="input mono-ish" rows={16} value={report} onChange={(e) => setReport(e.target.value)} aria-label="Your report" />
                <span className="row">
                  <label className="btn sm">Load a file<input type="file" accept=".md,.txt,text/markdown,text/plain" className="sr" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setReport(await f.text()); }} /></label>
                  <button type="button" className="btn sm" onClick={() => void saveAndSay(app.toast, { workspace: app.ws.name, what: 'research-notes', scope: s.id, date: app.today }, { kind: 'md', text: notesMarkdown(s) }, 'Notes saved')}>Download my notes</button>
                </span>
                <div><button type="button" className="btn primary big-btn" disabled={report.trim().length < 40 || report.trim() === REPORT_TEMPLATE.trim()} onClick={() => void submit()}>Send the report</button></div>
              </>
            )}
            <button type="button" className="linkish small" onClick={() => writeSession(null)}>End this session</button>
          </section>
        </>
      )}

      <section className="block">
        <details className="disclose"><summary>The full protocol, for AI agents</summary>
          <div className="protocol">
            <p>You are doing user research on this web app, the way a careful human tester would. Behave like the person each task names, not like a script.</p>
            <ul>
              <li><strong>First glance, every screen.</strong> Before acting, record in one or two sentences what the page seems to be for and what you would do first. The first-glance prompt does this; answer it honestly, even if wrong.</li>
              <li><strong>Think aloud.</strong> Note what you expect before each action and whether it happened. Hesitation is a finding.</li>
              <li><strong>Act like a hurried person.</strong> Try the obvious thing first. Don’t read every word. Don’t use the URL bar to navigate unless a person would.</li>
              <li><strong>Every flow and every screen.</strong> Do all the tasks; then visit every screen listed in the navigation, each Goals layout (List, Table, Board, History, Cards, Map), a goal page, the check-in, a review, Watching, Activity, Workspace, Import and Export.</li>
              <li><strong>Try to break it.</strong> Empty and very long text, wrong formats (letters, commas, units, negatives), back and refresh mid-flow, double-clicks, a 390 px wide window, keyboard only.</li>
              <li><strong>Evidence for each finding:</strong> screen, what you did, what you expected, what happened, and a severity: blocker (can’t complete), major (completes with real difficulty or wrong result), minor, polish, or idea.</li>
              <li><strong>Keep it signal.</strong> Lead the report with the ten most important findings; put the rest in notes. Don’t report the lack of sign-in or access control: it’s deliberately not built yet.</li>
              <li><strong>Hand in:</strong> use “Note on this” for findings tied to a spot on a screen, the task buttons for outcomes, and paste your report above before you finish.</li>
            </ul>
          </div>
        </details>
      </section>
    </div>
  );
}
