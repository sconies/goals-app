import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import { useDraft } from '../app/drafts';
import { buildWorkspace, parseTable, thisMonday, type ImportIssue } from '../domain/importer';
import { downloadTemplate, readSpreadsheet } from '../app/spreadsheet';
import type { Profile } from '../domain/types';
import { Avatar, PROFILE_LABEL, Steps } from '../ui/bits';

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

interface PersonRow { name: string; title: string; team: string; profile: Profile }
interface ImportDraft { step: number; name: string; startDate: string; people: PersonRow[]; objectives: Record<string, string>; goals: string; goalsMode: 'later' | 'file' }

const blankRow = (): PersonRow => ({ name: '', title: '', team: '', profile: 'contributor' });
const PROFILE_WORDS: Record<string, Profile> = { lead: 'lead', 'team lead': 'lead', sponsor: 'sponsor', coach: 'coach', 'goals coach': 'coach', contributor: 'contributor' };

/** Rows of a pasted or uploaded people table, matched to our columns by header when there is one. */
function rowsFromTable(tsv: string): { rows: PersonRow[]; objectives: Record<string, string> } {
  const table = parseTable(tsv);
  const first = (table[0] ?? []).map((h) => h.toLowerCase());
  const hasHeader = first.includes('name');
  const col = (names: string[], fallback: number) => {
    const i = first.findIndex((h) => names.includes(h));
    return hasHeader ? i : fallback;
  };
  const ci = { name: col(['name'], 0), team: col(['team'], 1), profile: col(['profile', 'role'], 2), title: col(['job title', 'title'], -1), objective: col(['team objective', 'objective'], -1) };
  const objectives: Record<string, string> = {};
  const rows = (hasHeader ? table.slice(1) : table).map((r) => {
    const get = (i: number) => (i >= 0 ? r[i] ?? '' : '');
    if (get(ci.objective) && get(ci.team)) objectives[get(ci.team)] = get(ci.objective);
    return { name: get(ci.name), team: get(ci.team), title: get(ci.title), profile: PROFILE_WORDS[get(ci.profile).toLowerCase()] ?? 'contributor' };
  }).filter((r) => r.name || r.team);
  return { rows, objectives };
}

const peopleTsv = (rows: PersonRow[], objectives: Record<string, string>) =>
  ['Name\tJob title\tTeam\tProfile\tTeam objective', ...rows.filter((r) => r.name.trim() || r.team.trim()).map((r) => [r.name, r.title, r.team, r.profile, objectives[r.team] ?? ''].join('\t'))].join('\n');

/** Load your own data: name it, add people (type, paste or upload), optionally goals, then create. */
export function ImportWizard() {
  const app = useApp();
  const nav = useNavigate();
  const [d, set, clear] = useDraft<ImportDraft>(app.ws.id + ':import', () => ({ step: 0, name: '', startDate: thisMonday(app.today), people: [blankRow(), blankRow(), blankRow()], objectives: {}, goals: '', goalsMode: 'later' }));
  const [suffix] = useState(() => Math.random().toString(36).slice(2, 6));
  const [busy, setBusy] = useState(false);
  const [fileNote, setFileNote] = useState('');
  const [created, setCreated] = useState<{ people: number; goals: number; teams: number } | null>(null);
  const goals = d.goalsMode === 'file' ? d.goals : '';
  const result = buildWorkspace({ name: d.name, startDate: d.startDate, people: peopleTsv(d.people, d.objectives), goals, now: app.today, idSuffix: suffix });
  const issues = (t: ImportIssue['table']) => result.issues.filter((i) => i.table === t);
  const blocking = (t: ImportIssue['table']) => issues(t).filter((i) => !/becomes a contributor|using straight/.test(i.message));
  const filled = d.people.filter((r) => r.name.trim() || r.team.trim());
  const canNext = [d.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.startDate), filled.length > 0 && !blocking('People').length, d.goalsMode === 'later' || (!!d.goals.trim() && !blocking('Goals').length), true][d.step]!;

  const upload = async (file: File) => {
    try {
      const got = await readSpreadsheet(file);
      const patch: Partial<ImportDraft> = {};
      if (got.people) { const r = rowsFromTable(got.people); patch.people = r.rows.length ? r.rows : d.people; patch.objectives = r.objectives; }
      if (got.goals) { patch.goals = got.goals; patch.goalsMode = 'file'; }
      set(patch);
      setFileNote(`Read ${file.name}: ${got.people ? rowsFromTable(got.people).rows.length + ' people' : 'no people sheet'}${got.goals ? ', plus a goals sheet' : ''}.`);
    } catch (e) {
      setFileNote(`Couldn’t read ${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

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
          <span className="tick" aria-hidden="true"><svg viewBox="0 0 48 48" width="64" height="64"><circle cx="24" cy="24" r="22" /><path d="m14 25 7 7 13-15" /></svg></span>
          <h1 className="title-xl">{d.name || 'Your workspace'} is ready</h1>
          <p className="muted">{created.people} people in {created.teams} teams{created.goals ? `, and ${created.goals} goals` : ''}. You’re viewing it as {app.viewer.name}. Switch back to the example any time from the workspace menu.</p>
          <div className="row" style={{ justifyContent: 'center' }}><Link className="btn primary big-btn" to={created.goals ? '/' : '/goals/new'}>{created.goals ? 'Go to home' : 'Set up the first goal'}</Link><Link className="btn" to="/">Home</Link></div>
        </div>
      </div>
    );
  }

  const LABELS = ['Name', 'People', 'Goals', 'Check and create'];
  const rowIssue = (i: number) => issues('People').find((x) => x.row === i + 2)?.message;
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
            <p className="muted small">Type names in, or paste rows straight from a spreadsheet into the table. Each person’s role decides what they see.</p>
            <div className="people-grid" role="table" aria-label="People">
              <div className="pg-head" role="row"><span role="columnheader">Name</span><span role="columnheader">Team</span><span role="columnheader">Role</span><span /></div>
              {d.people.map((r, i) => (
                <div key={i} className="pg-row" role="row">
                  <input className="input" aria-label={`Person ${i + 1}: name`} value={r.name} placeholder="Name"
                    onChange={(e) => set({ people: d.people.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })}
                    onPaste={(e) => {
                      const t = e.clipboardData.getData('text');
                      if (!/[\t\n]/.test(t)) return;
                      e.preventDefault();
                      const got = rowsFromTable(t);
                      set({ people: [...d.people.slice(0, i), ...got.rows, ...d.people.slice(i + got.rows.length)].filter((x, k, arr) => x.name || x.team || k >= arr.length - 1), objectives: { ...d.objectives, ...got.objectives } });
                    }} />
                  <input className="input" aria-label={`Person ${i + 1}: team`} value={r.team} placeholder="Team" list="teams"
                    onChange={(e) => set({ people: d.people.map((x, k) => (k === i ? { ...x, team: e.target.value } : x)) })} />
                  <select className="input" aria-label={`Person ${i + 1}: role`} value={r.profile}
                    onChange={(e) => set({ people: d.people.map((x, k) => (k === i ? { ...x, profile: e.target.value as Profile } : x)) })}>
                    {(['lead', 'sponsor', 'coach', 'contributor'] as Profile[]).map((p) => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}
                  </select>
                  <button type="button" className="iconbtn" aria-label={`Remove person ${i + 1}`} onClick={() => set({ people: d.people.length > 1 ? d.people.filter((_, k) => k !== i) : [blankRow()] })}>✕</button>
                  {rowIssue(i) && <span className="pg-issue tiny tone-off" role="alert">{rowIssue(i)}</span>}
                </div>
              ))}
              <datalist id="teams">{[...new Set(d.people.map((r) => r.team).filter(Boolean))].map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div className="row">
              <button type="button" className="btn sm" onClick={() => set({ people: [...d.people, blankRow()] })}>+ Add a person</button>
              <UploadButton onFile={upload} />
              <button type="button" className="btn sm ghost" onClick={() => void downloadTemplate()}>Download the template (.xlsx)</button>
            </div>
            {fileNote && <span className="small muted" role="status">{fileNote}</span>}
            <span className="small muted">{filled.length} {filled.length === 1 ? 'person' : 'people'} · {result.snapshot.teams.length} {result.snapshot.teams.length === 1 ? 'team' : 'teams'}{result.snapshot.people.some((p) => p.profile === 'lead') ? '' : ' · tip: give each team a team lead'}</span>
          </>
        )}
        {d.step === 2 && (
          <>
            <h1 className="qtitle big">Goals</h1>
            <div className="kindcards">
              <button type="button" className="kindcard" aria-pressed={d.goalsMode === 'later'} onClick={() => set({ goalsMode: 'later' })}>
                <span className="strong">Set them up in the app</span><span className="small">Each lead adds their goals step by step. Recommended for a first try.</span>
              </button>
              <button type="button" className="kindcard" aria-pressed={d.goalsMode === 'file'} onClick={() => set({ goalsMode: 'file' })}>
                <span className="strong">Bring them from a spreadsheet</span><span className="small">Use the Goals sheet of the template.</span>
              </button>
            </div>
            {d.goalsMode === 'file' && (
              <div className="stack">
                <div className="row"><UploadButton onFile={upload} label={d.goals ? 'Upload a different file' : 'Upload the spreadsheet'} /><button type="button" className="btn sm ghost" onClick={() => void downloadTemplate()}>Download the template (.xlsx)</button></div>
                {fileNote && <span className="small muted" role="status">{fileNote}</span>}
                {result.snapshot.goals.length > 0 && <ul className="preview">{result.snapshot.goals.map((g) => <li key={g.id}>{g.title}{g.headline ? ' · headline' : ''} · {result.snapshot.people.find((p) => p.id === g.ownerId)?.name}</li>)}</ul>}
                {issues('Goals').map((i) => <span key={i.row + i.message} className="small tone-off">Row {i.row}: {i.message}</span>)}
              </div>
            )}
          </>
        )}
        {d.step === 3 && (
          <>
            <h1 className="qtitle big">Ready to create “{d.name}”?</h1>
            <div className="summary-card">
              <p><strong>{result.snapshot.people.length}</strong> people in <strong>{result.snapshot.teams.length}</strong> teams{result.snapshot.goals.length ? <>, and <strong>{result.snapshot.goals.length}</strong> goals</> : '; goals get set up in the app'}.</p>
              <p className="small muted">The cycle starts {new Date(d.startDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} and runs 13 weeks. Creating it is logged.</p>
              {result.issues.length > 0 && <p className="small tone-risk">{result.issues.map((i) => i.message).join(' ')}</p>}
            </div>
          </>
        )}
        <div className="focus-foot">
          {d.step > 0 && <button type="button" className="btn" onClick={() => set({ step: d.step - 1 })}>Back</button>}
          <span style={{ flex: 1 }} />
          <button className="btn primary big-btn" type="submit" disabled={!canNext || busy} aria-disabled={!canNext || busy}>{busy ? 'Creating…' : d.step < 3 ? 'Continue →' : 'Create workspace'}</button>
        </div>
      </form>
    </div>
  );
}

function UploadButton({ onFile, label = 'Upload a spreadsheet' }: { onFile: (f: File) => void; label?: string }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => file.current?.click()}>{label}</button>
      <input ref={file} type="file" accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </>
  );
}
