import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { useDraft } from '../app/drafts';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE, thisMonday, type ImportIssue } from '../domain/importer';
import type { Profile } from '../domain/types';
import { Avatar, PROFILE_LABEL, ProgressRing, Steps } from '../ui/bits';

export function WorkspaceHome() {
  const app = useApp();
  const [confirming, setConfirming] = useState(false);
  const people = (['lead', 'sponsor', 'coach', 'contributor'] as Profile[]).map((p) => [p, app.snapshot.people.filter((x) => x.profile === p)] as const).filter(([, l]) => l.length);
  return (
    <div className="page narrow">
      <div className="page-head">
        <h1 className="title-xl">Workspace</h1>
        <span className="small muted">Switch between the example and your own data. Each workspace has its own people, goals and change log.</span>
      </div>
      <section className="block">
        <div className="glist">
          {app.workspaces.map((w) => (
            <button key={w.id} className="gline ws-line" aria-current={w.id === app.ws.id ? 'true' : undefined} onClick={() => app.switchWorkspace(w.id)}>
              <span className={'wsmark' + (w.kind === 'example' ? ' example' : '')} aria-hidden="true">{w.name.slice(0, 1).toUpperCase()}</span>
              <span className="gline-title">{w.name}</span>
              <span className="gline-now">{w.id === app.ws.id ? 'Open now' : w.kind === 'example' ? 'Demo data' : 'Your data'}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <Link className="btn primary" to="/workspace/new">Load your own data</Link>
          {app.ws.kind === 'example' && (confirming
            ? <><span className="small">Undo every change in the example?</span><button className="btn" onClick={async () => { await app.resetExample(); setConfirming(false); }}>Yes, reset it</button><button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button></>
            : <button className="btn" onClick={() => setConfirming(true)}>Reset the example</button>)}
        </div>
      </section>
      <section className="block">
        <h2 className="block-title">People in {app.ws.name}</h2>
        {people.map(([p, list]) => (
          <div key={p} className="stack" style={{ gap: 4, marginBottom: 10 }}>
            <span className="label">{PROFILE_LABEL[p]} · {list.length}</span>
            <div className="people">{list.map((x) => <span key={x.id} className="person"><Avatar p={x} size="sm" />{x.name}</span>)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

interface ImportDraft { step: number; name: string; startDate: string; people: string; goals: string }

/** Load your own data: name it, paste people, paste goals, check, create. */
export function ImportWizard() {
  const app = useApp();
  const nav = useNavigate();
  const [d, set, clear] = useDraft<ImportDraft>(app.ws.id + ':import', () => ({ step: 0, name: '', startDate: thisMonday(app.today), people: '', goals: '' }));
  const [suffix] = useState(() => Math.random().toString(36).slice(2, 6));
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ people: number; goals: number; teams: number } | null>(null);
  const result = buildWorkspace({ name: d.name, startDate: d.startDate, people: d.people, goals: d.goals, now: app.today, idSuffix: suffix });
  const issues = (t: ImportIssue['table']) => result.issues.filter((i) => i.table === t);
  const blocking = (t: ImportIssue['table']) => issues(t).filter((i) => !/becomes a contributor|using straight/.test(i.message));
  const canNext = [d.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.startDate), d.people.trim() !== '' && !blocking('People').length, !blocking('Goals').length, true][d.step]!;

  const create = async () => {
    setBusy(true);
    try {
      await app.createWorkspace(d.name.trim(), result.snapshot);
      clear();
      setCreated({ people: result.snapshot.people.length, goals: result.snapshot.goals.length, teams: result.snapshot.teams.length });
    } catch (e) {
      app.toast('Couldn’t create the workspace: ' + (e instanceof Error ? e.message : String(e)), 'error');
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="focus">
        <div className="celebrate" role="status">
          <ProgressRing done={1} total={1} size={88} />
          <h1 className="title-xl">{d.name || 'Your workspace'} is ready</h1>
          <p className="muted">{created.people} people, {created.teams} teams and {created.goals} goals. You’re viewing it as {app.viewer.name}. Switch back to the example any time from the workspace menu.</p>
          <div className="row" style={{ justifyContent: 'center' }}><Link className="btn primary big-btn" to="/">Go to home</Link><Link className="btn" to="/goals">See the goals</Link></div>
        </div>
      </div>
    );
  }

  const LABELS = ['Name', 'People', 'Goals', 'Check and create'];
  return (
    <div className="focus">
      <div className="focus-top">
        <span className="small strong">Load your data</span>
        <Steps at={d.step + 1} of={4} label={LABELS[d.step]} />
        <button className="iconbtn" onClick={() => nav('/workspace')} aria-label="Close and keep the draft">✕</button>
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); if (!canNext) return; if (d.step < 3) set({ step: d.step + 1 }); else void create(); }} noValidate>
        {d.step === 0 && (
          <>
            <h1 className="qtitle big">Name your workspace</h1>
            <p className="muted small">It sits next to the example, so you can switch between them. Nothing in the example changes.</p>
            <label className="field"><span className="small strong">Workspace name</span><input className="input big-input" autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Platform Engineering" /></label>
            <label className="field" style={{ maxWidth: 240 }}><span className="small strong">Cycle starts (a Monday)</span><input className="input" type="date" value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} /><span className="tiny muted">13 weeks, with the review on Thursdays.</span></label>
          </>
        )}
        {d.step === 1 && (
          <>
            <h1 className="qtitle big">Who’s involved?</h1>
            <p className="muted small">Copy rows from a spreadsheet and paste them here, or upload a CSV. Columns: Name, Job title, Team, Profile (lead, sponsor, coach or contributor), Team objective.</p>
            <Paste label="People" value={d.people} onChange={(v) => set({ people: v })} template={PEOPLE_TEMPLATE} />
            <Preview count={result.snapshot.people.length} noun="person" plural="people" issues={issues('People')} rows={result.snapshot.people.slice(0, 6).map((p) => `${p.name} · ${PROFILE_LABEL[p.profile]} · ${result.snapshot.teams.find((t) => t.id === p.teamId)?.name ?? ''}`)} />
          </>
        )}
        {d.step === 2 && (
          <>
            <h1 className="qtitle big">What are the goals? <span className="muted" style={{ fontWeight: 400 }}>Optional</span></h1>
            <p className="muted small">Paste them now, or skip and set them up in the app. Columns: Goal, Team, Owner, Type (metric, range, milestone), Unit, Start, Target, Plan, Limit, Must stay, Margin, Stages (“Name@week; Name@week”), Feeds into, Headline, Effect, Source.</p>
            <Paste label="Goals" value={d.goals} onChange={(v) => set({ goals: v })} template={GOALS_TEMPLATE} />
            <Preview count={result.snapshot.goals.length} noun="goal" plural="goals" issues={issues('Goals')} rows={result.snapshot.goals.slice(0, 6).map((g) => `${g.title}${g.headline ? ' · headline' : ''} · ${result.snapshot.people.find((p) => p.id === g.ownerId)?.name}`)} />
          </>
        )}
        {d.step === 3 && (
          <>
            <h1 className="qtitle big">Ready to create “{d.name}”?</h1>
            <div className="summary-card">
              <p><strong>{result.snapshot.people.length}</strong> people in <strong>{result.snapshot.teams.length}</strong> teams, and <strong>{result.snapshot.goals.length}</strong> goals.</p>
              <p className="small muted">The cycle starts {new Date(d.startDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} and runs 13 weeks. Creating it is logged.</p>
              {result.issues.length > 0 && <p className="small tone-risk">{result.issues.length} note{result.issues.length > 1 ? 's' : ''} from the check: {result.issues.map((i) => i.message).join(' ')}</p>}
            </div>
          </>
        )}
        <div className="focus-foot">
          {d.step > 0 && <button type="button" className="btn" onClick={() => set({ step: d.step - 1 })}>Back</button>}
          <span style={{ flex: 1 }} />
          {d.step === 2 && !d.goals.trim() && <button type="button" className="btn" onClick={() => set({ step: 3 })}>Skip goals</button>}
          <button className="btn primary big-btn" type="submit" disabled={!canNext || busy} aria-disabled={!canNext || busy}>{busy ? 'Creating…' : d.step < 3 ? 'Continue →' : 'Create workspace'}</button>
        </div>
      </form>
    </div>
  );
}

function Paste({ label, value, onChange, template }: { label: string; value: string; onChange: (v: string) => void; template: string }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="field"><span className="sr">{label}</span>
        <textarea className="input mono" rows={7} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label + ' (paste from a spreadsheet)'} placeholder={template.split('\n').slice(0, 2).join('\n')} spellCheck={false} />
      </label>
      <div className="row">
        <button type="button" className="btn sm" onClick={() => file.current?.click()}>Upload a CSV</button>
        <input ref={file} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await f.text()); }} />
        <button type="button" className="btn sm ghost" onClick={() => onChange(template)}>Fill with the example rows</button>
        <a className="btn sm ghost" download={label.toLowerCase() + '-template.csv'} href={'data:text/csv;charset=utf-8,' + encodeURIComponent(template.replace(/\t/g, ','))}>Download a template</a>
      </div>
    </div>
  );
}

function Preview({ count, noun, plural, issues, rows }: { count: number; noun: string; plural: string; issues: ImportIssue[]; rows: string[] }) {
  if (!count && !issues.length) return null;
  return (
    <div className="stack" style={{ gap: 6 }} role="status">
      {count > 0 && <span className="small strong tone-on">✓ {count} {count === 1 ? noun : plural} read</span>}
      {rows.length > 0 && <ul className="preview">{rows.map((r) => <li key={r}>{r}</li>)}{count > rows.length && <li className="muted">and {count - rows.length} more</li>}</ul>}
      {issues.map((i) => <span key={i.row + i.message} className="small tone-off">Row {i.row}: {i.message}</span>)}
    </div>
  );
}
