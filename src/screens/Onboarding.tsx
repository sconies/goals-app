/* Setting up a workspace: from nothing to an outcome, the goals feeding it and the people who own them,
   one question per screen, in about three minutes. A template fills it in so it's never blank. */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSetup } from '../app/state';
import { useDraft } from '../app/drafts';
import { downloadTemplate, readSpreadsheet } from '../app/spreadsheet';
import { buildWorkspace, parseTable, thisMonday, type ImportIssue } from '../domain/importer';
import { TEMPLATES, type TemplateGoal } from '../domain/templates';
import { Steps } from '../ui/bits';

interface PersonRow { name: string; title: string; team: string; admin: boolean }
interface GoalRow extends TemplateGoal { owner: string }
interface SetupDraft {
  step: number;
  name: string;
  startDate: string;
  reviewDay: number;
  me: PersonRow;
  people: PersonRow[];
  objectives: Record<string, string>;
  template: string;
  outcome: GoalRow;
  goals: GoalRow[];
  /** A Goals sheet from an uploaded spreadsheet, used instead of the outcome and goals steps. */
  fileGoals: string;
}

const blankPerson = (): PersonRow => ({ name: '', title: '', team: '', admin: false });
const blankGoal = (owner = ''): GoalRow => ({ title: '', kind: 'metric', unit: '', start: '', target: '', owner });
const YES = /^(y|yes|true|1|admin|sponsor|coach|goals coach)$/i;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const STEP_LABELS = ['Workspace', 'You', 'Your team', 'Starting point', 'Outcome', 'Goals', 'Check'];

/** Rows of a pasted or uploaded people table, matched to our columns by header when there is one. */
export function peopleFromTable(tsv: string): { rows: PersonRow[]; objectives: Record<string, string> } {
  const table = parseTable(tsv);
  const first = (table[0] ?? []).map((h) => h.toLowerCase());
  const hasHeader = first.includes('name');
  const col = (names: string[], fallback: number) => (hasHeader ? first.findIndex((h) => names.includes(h)) : fallback);
  const ci = { name: col(['name'], 0), team: col(['team'], 1), admin: col(['admin', 'profile', 'role'], 2), title: col(['job title', 'title'], -1), objective: col(['team objective', 'objective'], -1) };
  const objectives: Record<string, string> = {};
  const rows = (hasHeader ? table.slice(1) : table).map((r) => {
    const get = (i: number) => (i >= 0 ? r[i] ?? '' : '');
    if (get(ci.objective) && get(ci.team)) objectives[get(ci.team)] = get(ci.objective);
    return { name: get(ci.name), team: get(ci.team), title: get(ci.title), admin: YES.test(get(ci.admin).trim()) };
  }).filter((r) => r.name || r.team);
  return { rows, objectives };
}

function peopleTsv(me: PersonRow, rows: PersonRow[], objectives: Record<string, string>) {
  const all = [me, ...rows.filter((r) => r.name.trim() || r.team.trim())];
  return ['Name\tJob title\tTeam\tAdmin\tTeam objective', ...all.map((r) => [r.name, r.title, r.team, r.admin ? 'yes' : '', objectives[r.team] ?? ''].join('\t'))].join('\n');
}

function goalsTsv(d: SetupDraft) {
  if (d.template === 'file') return d.fileGoals;
  if (d.template === 'later') return '';
  const people = [d.me, ...d.people];
  const teamOf = (owner: string) => people.find((p) => p.name.trim().toLowerCase() === owner.trim().toLowerCase())?.team ?? d.me.team;
  const row = (g: GoalRow, headline: boolean) => [
    g.title, teamOf(g.owner), g.owner, g.kind, g.kind === 'milestone' ? '' : g.unit, g.kind === 'milestone' ? '' : g.start, g.kind === 'milestone' ? '' : g.target,
    g.plan ?? 'straight', '', '', '', g.kind === 'milestone' ? g.stages ?? '' : '', headline ? '' : d.outcome.title, headline ? 'north star' : '', '', '',
  ].join('\t');
  const goals = d.goals.filter((g) => g.title.trim());
  return ['Goal\tTeam\tOwner\tType\tUnit\tStart\tTarget\tPlan\tLimit\tMust stay\tMargin\tStages\tFeeds into\tLevel\tEffect\tSource', row(d.outcome, true), ...goals.map((g) => row(g, false))].join('\n');
}

/** First run of the real app: what it does, then setting up. */
export function Welcome() {
  const [start, setStart] = useState(false);
  if (start) return <Onboarding onClose={() => setStart(false)} />;
  return (
    <div className="welcome">
      <div className="welcome-body">
        <span className="welcome-mark" aria-hidden="true"><svg viewBox="0 0 16 16" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></svg></span>
        <h1 className="title-xl">Weekly goals that stay on track</h1>
        <ul className="welcome-points">
          <li><strong>Set an outcome</strong> and the few goals that move it.</li>
          <li><strong>Owners check in weekly</strong>, in under a minute each.</li>
          <li><strong>Anyone can watch</strong> the goals they care about, and run a review on them.</li>
        </ul>
        <div className="stack" style={{ gap: 'var(--s3)' }}>
          <button className="btn primary big-btn" onClick={() => setStart(true)}>Set up your workspace</button>
          <span className="hint">About 3 minutes. Start from a template and change what you need.</span>
          <a className="linkish tap" href="/demo">Or try the demo first</a>
        </div>
      </div>
    </div>
  );
}

/** Setting up a workspace, one question per screen. */
export function Onboarding({ onClose }: { onClose?: () => void }) {
  const setup = useSetup();
  const nav = useNavigate();
  const [d, set, clear, restored] = useDraft<SetupDraft>(`setup:${setup.mode}`, () => ({
    step: 0, name: '', startDate: thisMonday(setup.today), reviewDay: 3,
    me: { name: '', title: '', team: '', admin: true }, people: [blankPerson(), blankPerson()], objectives: {},
    template: '', outcome: blankGoal(), goals: [], fileGoals: '',
  }));
  const [suffix] = useState(() => Math.random().toString(36).slice(2, 6));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileNote, setFileNote] = useState('');
  const [cycleOpen, setCycleOpen] = useState(false);

  const result = buildWorkspace({ name: d.name, startDate: d.startDate, reviewDay: d.reviewDay, people: peopleTsv(d.me, d.people, d.objectives), goals: goalsTsv(d), now: setup.today, idSuffix: suffix });
  const issues = (t: ImportIssue['table'], blocking = true) => result.issues.filter((i) => i.table === t && (!blocking || !/using straight/.test(i.message)));
  const personIssue = (i: number) => issues('People').find((x) => x.row === i + 3)?.message;
  const goalIssue = (row: number) => issues('Goals').find((x) => x.row === row)?.message;
  const owners = [d.me, ...d.people].filter((p) => p.name.trim()).map((p) => p.name.trim());
  const skipGoalSteps = d.template === 'file' || d.template === 'later';

  const ok = [
    !!d.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(d.startDate),
    !!d.me.name.trim() && !!d.me.team.trim(),
    !issues('People').length,
    !!d.template,
    !!d.outcome.title.trim() && !goalIssue(2),
    !issues('Goals').length,
    !result.issues.filter((i) => !/using straight/.test(i.message)).length,
  ];
  const problem = [
    !d.name.trim() ? 'Give the workspace a name.' : 'Pick the Monday the cycle starts.',
    !d.me.name.trim() ? 'Add your name.' : 'Add your team.',
    'Fix the rows marked in red, or clear them.',
    'Pick a starting point.',
    !d.outcome.title.trim() ? 'Name the outcome.' : goalIssue(2) ?? '',
    'Fix the goals marked in red, or remove them.',
    result.issues[0]?.message ?? '',
  ];
  const go = (step: number) => { setTried(false); set({ step }); };
  const next = () => {
    if (!ok[d.step]) { setTried(true); return; }
    if (d.step === 3 && skipGoalSteps) return go(6);
    if (d.step < 6) return go(d.step + 1);
    void create();
  };
  const back = () => go(d.step === 6 && skipGoalSteps ? 3 : Math.max(0, d.step - 1));

  const pickTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) set({ template: id, outcome: { ...t.outcome, owner: d.me.name.trim() }, goals: t.goals.map((g) => ({ ...g, owner: d.me.name.trim() })) });
    else if (id === 'blank') set({ template: id, outcome: blankGoal(d.me.name.trim()), goals: [blankGoal(d.me.name.trim())] });
    else set({ template: id });
  };

  const upload = async (file: File) => {
    try {
      const got = await readSpreadsheet(file);
      const patch: Partial<SetupDraft> = {};
      if (got.people) { const r = peopleFromTable(got.people); if (r.rows.length) { patch.people = r.rows; patch.objectives = r.objectives; } }
      if (got.goals) { patch.fileGoals = got.goals; }
      set(patch);
      const n = got.people ? peopleFromTable(got.people).rows.length : 0;
      setFileNote(`Read ${file.name}: ${n ? `${n} people` : 'no people sheet'}${got.goals ? ', plus a goals sheet you can use in the next step' : ''}.`);
    } catch (e) {
      setFileNote(`Couldn’t read ${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const meId = result.snapshot.people[0]?.id;
      await setup.createWorkspace(d.name.trim(), result.snapshot, meId);
      clear();
      nav('/ready', { replace: true });
    } catch (e) {
      setup.toast('Couldn’t create the workspace: ' + (e instanceof Error ? e.message : String(e)), 'error');
      setBusy(false);
    }
  };

  const close = () => (onClose ? onClose() : nav(setup.hasWorkspaces ? '/workspace' : '/'));
  const shownStep = d.step + 1;
  const updatePerson = (i: number, p: Partial<PersonRow>) => set({ people: d.people.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const updateGoal = (i: number, p: Partial<GoalRow>) => set({ goals: d.goals.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const label = busy ? 'Creating…' : d.step === 6 ? 'Create workspace' : 'Next';

  return (
    <div className="focus">
      <div className="focus-top">
        <span className="small strong">Set up</span>
        <Steps at={shownStep} of={7} label={STEP_LABELS[d.step]} />
        <button className="iconbtn" onClick={close} aria-label="Close and keep what you’ve typed">✕</button>
      </div>
      <form className="focus-body" onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
        {restored && d.step === 0 && <p className="hint">Picked up where you left off. <button type="button" className="linkish" onClick={() => { clear(); window.location.reload(); }}>Start over</button></p>}

        {d.step === 0 && (
          <section className="qsection">
            <h1 className="qtitle big">What’s this workspace for?</h1>
            <label className="field"><span className="field-label">Name</span>
              <input className={'input big-input' + (tried && !d.name.trim() ? ' invalid' : '')} autoFocus value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Platform Engineering" />
            </label>
            {cycleOpen ? (
              <div className="pair">
                <label className="field"><span className="field-label">Cycle starts</span><input className="input" type="date" value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} /></label>
                <label className="field"><span className="field-label">Weekly review on</span>
                  <select className="input" value={d.reviewDay} onChange={(e) => set({ reviewDay: Number(e.target.value) })}>{DAYS.map((x, i) => <option key={x} value={i}>{x}</option>)}</select>
                </label>
              </div>
            ) : (
              <span className="hint">A 13-week cycle from {new Date(d.startDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}, with the review on {DAYS[d.reviewDay]}s. <button type="button" className="linkish" onClick={() => setCycleOpen(true)}>Change</button></span>
            )}
          </section>
        )}

        {d.step === 1 && (
          <section className="qsection">
            <h1 className="qtitle big">Who are you?</h1>
            <div className="pair">
              <label className="field"><span className="field-label">Your name</span><input className={'input' + (tried && !d.me.name.trim() ? ' invalid' : '')} autoFocus value={d.me.name} onChange={(e) => set({ me: { ...d.me, name: e.target.value } })} placeholder="e.g. Ana Silva" /></label>
              <label className="field"><span className="field-label">Your team</span><input className={'input' + (tried && !d.me.team.trim() ? ' invalid' : '')} value={d.me.team} onChange={(e) => set({ me: { ...d.me, team: e.target.value } })} placeholder="e.g. Platform" /></label>
            </div>
            <p className="hint">You’ll be this workspace’s admin: you can add people, change settings and make others admins. Anyone can own goals, watch them and run reviews.</p>
          </section>
        )}

        {d.step === 2 && (
          <section className="qsection">
            <div className="stack" style={{ gap: 'var(--s1)' }}>
              <h1 className="qtitle big">Who else is on it?</h1>
              <span className="hint">Type them in, paste rows from a spreadsheet, or upload one. You can also add people later.</span>
            </div>
            <div className="people-grid" role="table" aria-label="People">
              <div className="pg-head" role="row"><span role="columnheader">Name</span><span role="columnheader">Team</span><span role="columnheader">Admin</span><span /></div>
              {d.people.map((r, i) => (
                <div key={i} className="pg-row" role="row">
                  <input className="input" aria-label={`Person ${i + 1}: name`} value={r.name} placeholder="Name"
                    onChange={(e) => updatePerson(i, { name: e.target.value })}
                    onPaste={(e) => {
                      const t = e.clipboardData.getData('text');
                      if (!/[\t\n]/.test(t)) return;
                      e.preventDefault();
                      const got = peopleFromTable(t);
                      set({ people: [...d.people.slice(0, i), ...got.rows, ...d.people.slice(i + got.rows.length)].filter((x, k, arr) => x.name || x.team || k >= arr.length - 1), objectives: { ...d.objectives, ...got.objectives } });
                    }} />
                  <input className="input" aria-label={`Person ${i + 1}: team`} value={r.team} placeholder={d.me.team || 'Team'} list="teams" onChange={(e) => updatePerson(i, { team: e.target.value })} />
                  <label className="pg-check"><input type="checkbox" aria-label={`Person ${i + 1}: admin`} checked={r.admin} onChange={(e) => updatePerson(i, { admin: e.target.checked })} /></label>
                  <button type="button" className="iconbtn" aria-label={`Remove person ${i + 1}`} onClick={() => set({ people: d.people.length > 1 ? d.people.filter((_, k) => k !== i) : [blankPerson()] })}>✕</button>
                  {personIssue(i) && <span className="pg-issue hint tone-off" role="alert">{personIssue(i)}</span>}
                </div>
              ))}
              <datalist id="teams">{[...new Set([d.me.team, ...d.people.map((r) => r.team)].filter(Boolean))].map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div className="actions">
              <button type="button" className="btn sm" onClick={() => set({ people: [...d.people, blankPerson()] })}>Add a person</button>
              <UploadButton onFile={upload} />
              <button type="button" className="linkish tap" onClick={() => void downloadTemplate()}>Download the Excel template</button>
            </div>
            {fileNote && <span className="hint" role="status">{fileNote}</span>}
          </section>
        )}

        {d.step === 3 && (
          <section className="qsection">
            <div className="stack" style={{ gap: 'var(--s1)' }}>
              <h1 className="qtitle big">Where do you want to start?</h1>
              <span className="hint">A template gives you an outcome and the goals that usually feed it. You change the names and numbers next.</span>
            </div>
            <div className="optlist" role="radiogroup" aria-label="Starting point">
              {d.fileGoals && <button type="button" role="radio" className="opt" aria-checked={d.template === 'file'} onClick={() => pickTemplate('file')}><span>Goals from your spreadsheet</span><span className="hint">As uploaded</span></button>}
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" role="radio" className="opt" aria-checked={d.template === t.id} onClick={() => pickTemplate(t.id)}>
                  <span>{t.name}</span><span className="hint">{t.blurb}</span>
                </button>
              ))}
              <button type="button" role="radio" className="opt" aria-checked={d.template === 'blank'} onClick={() => pickTemplate('blank')}><span>Start blank</span><span className="hint">Type your own outcome and goals</span></button>
              <button type="button" role="radio" className="opt" aria-checked={d.template === 'later'} onClick={() => pickTemplate('later')}><span>Set goals up later</span><span className="hint">Each owner adds theirs in the app</span></button>
            </div>
          </section>
        )}

        {d.step === 4 && (
          <section className="qsection">
            <div className="stack" style={{ gap: 'var(--s1)' }}>
              <h1 className="qtitle big">What outcome are you after?</h1>
              <span className="hint">The one number that says whether this cycle worked. Everything else feeds it.</span>
            </div>
            <GoalFields g={d.outcome} owners={owners} onChange={(p) => set({ outcome: { ...d.outcome, ...p } })} issue={tried ? goalIssue(2) : undefined} headline />
          </section>
        )}

        {d.step === 5 && (
          <section className="qsection">
            <div className="stack" style={{ gap: 'var(--s1)' }}>
              <h1 className="qtitle big">What feeds it?</h1>
              <span className="hint">Two to four goals that move “{d.outcome.title}”. Pick an owner for each; they check in weekly.</span>
            </div>
            {d.goals.map((g, i) => (
              <div key={i} className="goalcard">
                <GoalFields g={g} owners={owners} onChange={(p) => updateGoal(i, p)} issue={tried ? goalIssue(i + 3) : undefined} />
                <button type="button" className="linkish tap" onClick={() => set({ goals: d.goals.filter((_, k) => k !== i) })}>Remove this goal</button>
              </div>
            ))}
            <div><button type="button" className="btn sm" onClick={() => set({ goals: [...d.goals, blankGoal(d.me.name.trim())] })}>Add a goal</button></div>
          </section>
        )}

        {d.step === 6 && (
          <section className="qsection">
            <h1 className="qtitle big">Ready to create {d.name.trim() || 'your workspace'}?</h1>
            <dl className="details">
              <dt>People</dt><dd>{result.snapshot.people.length} in {result.snapshot.teams.length} {result.snapshot.teams.length === 1 ? 'team' : 'teams'}</dd>
              <dt>North star</dt><dd>{result.snapshot.goals.find((g) => g.level === 'north-star')?.title ?? 'Set up later'}</dd>
              <dt>Goals</dt><dd>{result.snapshot.goals.filter((g) => g.level !== 'north-star').length || 'Set up later'}</dd>
              <dt>Cycle</dt><dd>13 weeks from {new Date(d.startDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}, review on {DAYS[d.reviewDay]}s</dd>
              <dt>You</dt><dd>{d.me.name}, admin</dd>
            </dl>
          </section>
        )}

        <div className="focus-foot">
          {tried && !ok[d.step] && <span className="hint tone-off" role="alert">{problem[d.step]}</span>}
          <div className="foot-row">
            {d.step > 0 && <button type="button" className="btn ghost" onClick={back}>Back</button>}
            <button className="btn primary big-btn" type="submit" disabled={busy}>{label}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function GoalFields({ g, owners, onChange, issue, headline }: { g: GoalRow; owners: string[]; onChange: (p: Partial<GoalRow>) => void; issue?: string; headline?: boolean }) {
  return (
    <div className="stack" style={{ gap: 'var(--s3)' }}>
      <label className="field"><span className={headline ? 'sr' : 'field-label'}>{headline ? 'Outcome' : 'Goal'}</span>
        <input className={'input' + (headline ? ' big-input' : '') + (issue && !g.title.trim() ? ' invalid' : '')} aria-label={headline ? 'Outcome' : 'Goal'} value={g.title} onChange={(e) => onChange({ title: e.target.value })} placeholder={headline ? 'e.g. Weekly active users' : 'e.g. Activation rate'} />
      </label>
      {!headline && (
        <div className="seg full" role="group" aria-label="Kind of goal">
          <button type="button" aria-pressed={g.kind === 'metric'} onClick={() => onChange({ kind: 'metric' })}>A number</button>
          <button type="button" aria-pressed={g.kind === 'milestone'} onClick={() => onChange({ kind: 'milestone', stages: g.stages || 'Design@3; Pilot@7; Launch@12' })}>Dated stages</button>
        </div>
      )}
      {g.kind === 'metric' ? (
        <div className="trio">
          <label className="field"><span className="field-label">Today</span><input className="input" inputMode="decimal" value={g.start} onChange={(e) => onChange({ start: e.target.value })} aria-label={(headline ? 'Outcome' : g.title || 'Goal') + ': today'} /></label>
          <label className="field"><span className="field-label">Target</span><input className="input" inputMode="decimal" value={g.target} onChange={(e) => onChange({ target: e.target.value })} aria-label={(headline ? 'Outcome' : g.title || 'Goal') + ': target'} /></label>
          <label className="field"><span className="field-label">Unit</span><input className="input" value={g.unit} onChange={(e) => onChange({ unit: e.target.value })} placeholder="%, days" aria-label={(headline ? 'Outcome' : g.title || 'Goal') + ': unit'} /></label>
        </div>
      ) : (
        <label className="field"><span className="field-label">Stages and the week each is due</span>
          <input className="input" value={g.stages ?? ''} onChange={(e) => onChange({ stages: e.target.value })} placeholder="Design@3; Pilot@7; Launch@12" />
          <span className="hint">Separate stages with “;”, and put the week after “@”.</span>
        </label>
      )}
      <label className="field"><span className="field-label">Owner</span>
        <select className="input" value={g.owner} onChange={(e) => onChange({ owner: e.target.value })}>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      </label>
      {issue && <span className="hint tone-off" role="alert">{issue}</span>}
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
