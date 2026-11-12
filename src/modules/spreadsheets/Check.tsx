/* The import's preview (backlog IM3; docs/design/import/spec.md 2.3), at /data/import/check: what the file is and what
   was read, counts by sheet, then what must be fixed, then the questions, then what will be saved, and Save. Nothing is
   saved until every Must fix is fixed (or its rows left out) and every Check is answered; one answer covers every row
   in its group. The file is held in memory (importStore): a reload comes back to Import. */
import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useApp } from '../../app/state';
import { saveAndSay } from '../../app/files';
import { readChanges } from '../../app/spreadsheet';
import { MODULE_SHEETS } from '../../core/records';
import { describe, type ChangeSet } from '../../domain/changeset';
import { workbook } from '../../domain/export';
import { leaveOut } from '../../domain/leaveOut';
import { questionsLine, type Answer, type Choice, type IssueGroup, type Sheet } from '../../domain/problemLevels';
import { readLine, type Tables } from '../../domain/sheets';
import { workedOutEdits } from '../../domain/workedOut';
import { useMark } from '../../telemetry/react';
import { Sheet as SheetBox, WarnMark } from '../../ui/bits';
import { PickOne } from '../../ui/Pick';
import type { Snapshot } from '../../domain/types';
import { isNewIn, useImportPlan } from './importPlan';
import { importStore } from './importStore';
import { baseName, rowsSheets, type RowProblem } from './rowsFile';
import './import.css';

const SHEETS: Sheet[] = ['Goals', 'Plan', 'Check-ins', 'People'];
const KEY: Record<Sheet, keyof Tables> = { Goals: 'goals', Plan: 'plan', 'Check-ins': 'checkIns', People: 'people' };
const n = (k: number, one: string, many = one + 's') => `${k.toLocaleString('en-GB')} ${k === 1 ? one : many}`;
const blank = (r: Record<string, string>) => Object.entries(r).every(([k, v]) => k === '__row' || !String(v).trim());
const rowKey = (x: { sheet: string; row: number }) => `${x.sheet}:${x.row}`;
const uniqueRows = <T extends { sheet: Sheet; row: number }>(list: readonly T[]) => [...new Map(list.map((x) => [rowKey(x), x])).values()];

/** Reads a chosen file into the import, staying on the preview. Shared by Import and the preview's own "Choose…". */
export async function chooseFile(f: File | undefined, onProblem: (text: string) => void): Promise<boolean> {
  if (!f) return false;
  try {
    const got = await readChanges(f);
    if (!got.read.length) { onProblem(`Nothing in ${f.name} looks like a Faro sheet. Faro looks for Goal and Owner (goals), Goal key and Week (check-ins), or Name and Email (people). The template has the right headers.`); return false; }
    importStore.chose(got, f.name);
    return true;
  } catch {
    onProblem(`Faro can’t read ${f.name}. Save it as .xlsx or .csv and try again.`);
    return false;
  }
}

export function Check() {
  const app = useApp();
  const nav = useNavigate();
  const { st, base, left, cs, otherWorkspace } = useImportPlan();
  const file = useRef<HTMLInputElement>(null);
  const why = useRef<HTMLTextAreaElement>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useMark(cs ? 'import.read' : null);

  const choose = () => { if (file.current) file.current.value = ''; file.current?.click(); };
  const picker = <input ref={file} type="file" accept=".xlsx,.zip,.csv,.tsv,.txt" className="sr" aria-label="Choose a spreadsheet" onChange={(e) => void chooseFile(e.target.files?.[0], setProblem).then((ok) => ok && setProblem(''))} />;

  // A reload loses the file (it was only ever in memory): back to Import, which says so.
  if (!st.read || !base) return <Navigate to="/data/import" replace state={{ lost: true }} />;
  const read = st.read;

  if (otherWorkspace) {
    const from = read.origin!.workspaceName ? `“${read.origin!.workspaceName}”` : 'another workspace';
    return (
      <div className="page narrow import-check">
        <div className="page-head"><h1 className="title-xl">Check this import</h1><span className="hint">Nothing has been saved.</span></div>
        <p className="small">{st.name} · {readLine(read)}</p>
        <div className="level-block level-check" role="group" aria-labelledby="other-ws">
          <span className="level-head"><WarnMark /><span className="level-word">Check</span></span>
          <strong id="other-ws" className="level-q">This file was exported from {from}, not from {app.ws.name}. Its keys and IDs belong there.</strong>
          <span className="level-actions">
            <button type="button" className="btn" onClick={() => importStore.set({ asNew: true })}>Add its rows as new goals</button>
            <button type="button" className="btn" onClick={() => { importStore.reset(); nav('/data/import'); }}>Cancel</button>
          </span>
        </div>
      </div>
    );
  }
  if (!cs) return null;

  const must = cs.groups.filter((g) => g.level === 'must');
  const checks = cs.groups.filter((g) => g.level === 'check');
  const mustIssues = cs.issues.filter((i) => i.level === 'must');
  const mustRows = uniqueRows(mustIssues);
  const answered = Object.keys(st.answers).filter((id) => st.said[id] && !cs.groups.some((g) => g.id === id));
  const answeredChecks = answered.filter((id) => st.said[id]!.level === 'check');
  const answeredMust = answered.filter((id) => st.said[id]!.level === 'must');
  const total = cs.items.length;
  const nothing = !total && !must.length && !checks.length;
  const onlyReason = !cs.commit && !must.length && !checks.length && cs.needsReason && total > 0;
  const leftCount = cs.leftOut.length + left.length;

  const save = async () => {
    if (onlyReason) { setTried(true); why.current?.focus(); return; }
    if (!cs.commit) return;
    setBusy(true);
    try {
      await app.applyChanges(cs);
      app.toast(`Saved: ${describe(cs).toLowerCase()}`);
      importStore.reset();
      nav('/goals');
    } catch (e) {
      setProblem(`Nothing was saved: ${e instanceof Error ? e.message : String(e)}. Try again.`);
      setBusy(false);
    }
  };
  const download = (rows: RowProblem[], what: string, done: string) => saveAndSay(app.toast, { workspace: app.ws.name, what, date: app.today, as: `${baseName(st.name)}-${what}` }, { kind: 'xlsx', sheets: rowsSheets(read, base, rows) }, done);
  const toFix: RowProblem[] = mustIssues.map((i) => ({ sheet: i.sheet, row: i.row, problem: i.message }));

  return (
    <div className="page narrow import-check">
      {picker}
      <div className="page-head">
        <h1 className="title-xl">Check this import</h1>
        <span className="hint">Nothing has been saved.</span>
      </div>

      <p className="small import-file-line"><span className="strong">{st.name}</span> · {readLine(read, cs.examples)}</p>
      {st.carried > 0 && <p className="small">Your {n(st.carried, 'answer')} still {st.carried === 1 ? 'applies' : 'apply'}.</p>}
      {problem && <p className="hint tone-off" role="alert">{problem}</p>}

      <Counts cs={cs} base={base} read={read.read} />

      {(must.length > 0 || answeredMust.length > 0) && (
        <section className="stack import-section" aria-labelledby="must-fix">
          <h2 className="h2" id="must-fix">Must fix</h2>
          {must.length > 0 && <p className="hint">{n(mustRows.length, 'row')}, {n(new Set(must.map((g) => g.kind)).size, 'kind')} of problem</p>}
          {must.map((g) => <GroupBlock key={g.id} g={g} cs={cs} prior={st.answers[g.id]} />)}
          {answeredMust.map((id) => <Answered key={id} id={id} />)}
          {mustRows.length > 0 && (
            <div className="import-fix-actions">
              <button type="button" className="btn" onClick={() => void download(toFix, 'rows-to-fix', 'Rows to fix saved')}>Download the {n(mustRows.length, 'row')} to fix</button>
              <button type="button" className="linkish tap" onClick={() => setLeaving(true)}>Leave these {n(mustRows.length, 'row')} out and save the rest</button>
            </div>
          )}
        </section>
      )}

      {(checks.length > 0 || answeredChecks.length > 0) && (
        <section className="stack import-section" aria-labelledby="checks">
          <h2 className="h2" id="checks">Check</h2>
          <p className="hint">{checks.length ? `${questionsLine(checks)}.` : ''}{answeredChecks.length ? ` ${answeredChecks.length} of ${checks.length + answeredChecks.length} answered.` : ''}</p>
          {checks.map((g) => <GroupBlock key={g.id} g={g} cs={cs} prior={st.answers[g.id]} />)}
          {answeredChecks.map((id) => <Answered key={id} id={id} />)}
        </section>
      )}

      {nothing ? (
        <Nothing cs={cs} base={base} names={Object.fromEntries(read.read.map((x) => [x.kind, x.name]))} />
      ) : (
        <section className="stack import-section" aria-labelledby="will-save">
          <h2 className="h2" id="will-save">What will be saved</h2>
          <p>{total ? describe(cs) : 'Nothing yet'}.{cs.unchanged ? ` ${n(cs.unchanged, 'row is', 'rows are')} unchanged.` : ''}{leftCount ? ` ${n(leftCount, 'row is', 'rows are')} left out.` : ''}</p>
          {total > 0 && <Link to="/data/import/check/changes">Show the {n(total, 'change')}</Link>}
          {left.length > 0 && (
            <p className="small">{n(left.length, 'row was', 'rows were')} left out at your choice. <button type="button" className="linkish tap" onClick={() => void download(left.map((x) => ({ ...x, problem: 'because' in x && x.because ? `Left out: ${x.because}.` : 'Left out at your choice.' })), 'left-out', 'Rows left out saved')}>Download them</button> · <button type="button" className="linkish tap" onClick={() => importStore.set({ leftOut: [] })}>Put them back</button></p>
          )}
        </section>
      )}

      {cs.items.some((x) => x.needsReason) && (
        <label className="field">
          <span className="field-label">Why are these plans changing?</span>
          <span className="hint">Say why to save: check-ins have started on {cs.items.filter((x) => x.needsReason).length === 1 ? 'this goal' : 'these goals'}, so the change log keeps the reason with the old and new plan. A Reason column in the file is used first.</span>
          <textarea ref={why} className={'input' + (tried && cs.needsReason ? ' invalid' : '')} aria-invalid={tried && cs.needsReason ? true : undefined} rows={2} value={st.reason} onChange={(e) => importStore.set({ reason: e.target.value })} />
        </label>
      )}

      <Foot mustRows={mustRows.length} questions={checks.length} total={total} nothing={nothing} ready={!!cs.commit} onlyReason={onlyReason} tried={tried} busy={busy} onSave={() => void save()} onChoose={choose} />

      <LeaveSheet open={leaving} onClose={() => setLeaving(false)} rows={mustRows.map((i) => ({ sheet: i.sheet, row: i.row, name: i.name, problem: i.message }))} onDownload={() => void download(toFix, 'left-out', 'Rows left out saved')}
        dependants={leaving ? leaveOut(base, [...st.leftOut, ...mustRows.map((i) => ({ sheet: i.sheet, row: i.row }))], isNewIn(app.snapshot)).also.filter((x) => !left.some((y) => rowKey(y) === rowKey(x))) : []}
        onLeave={() => { importStore.set({ leftOut: [...st.leftOut, ...mustRows.map((i) => ({ sheet: i.sheet, row: i.row }))] }); setLeaving(false); }} />
    </div>
  );
}

/** Counts by sheet (2.3, item 2): a table from 700 px; below, one sentence per sheet with the zero parts left out. */
function Counts({ cs, base, read }: { cs: ChangeSet; base: Tables; read: { name: string; kind: string }[] }) {
  const rows = SHEETS.filter((sh) => read.some((r) => r.kind === KEY[sh])).map((sh) => {
    const items = cs.items.filter((x) => x.sheet === sh);
    const issueRows = (level: 'must' | 'check') => uniqueRows(cs.issues.filter((i) => i.sheet === sh && i.level === level)).length;
    return {
      sheet: read.find((r) => r.kind === KEY[sh])!.name,
      read: (base[KEY[sh]] ?? []).filter((r) => !blank(r)).length,
      added: items.filter((x) => ['new goal', 'check-in', 'new person'].includes(x.kind)).length,
      changed: items.filter((x) => ['goal', 'plan', 'replaces check-in', 'person', 'team'].includes(x.kind)).length,
      stopped: items.filter((x) => ['stop goal', 'delete goal', 'person left'].includes(x.kind)).length,
      unchanged: cs.unchangedBy[sh],
      must: issueRows('must'),
      check: issueRows('check'),
    };
  });
  const sentence = (r: (typeof rows)[number]) => {
    const parts = [r.added && `${r.added.toLocaleString('en-GB')} added`, r.changed && `${r.changed.toLocaleString('en-GB')} changed`, r.stopped && `${r.stopped.toLocaleString('en-GB')} stopped or left`, r.unchanged && `${r.unchanged.toLocaleString('en-GB')} unchanged`, r.must && `${r.must.toLocaleString('en-GB')} must be fixed`, r.check && `${r.check.toLocaleString('en-GB')} to check`].filter(Boolean);
    return `${r.sheet}: ${n(r.read, 'row')} read${parts.length ? `; ${parts.join(', ')}` : ''}.`;
  };
  return (
    <section className="import-counts" aria-label="Counts by sheet">
      <table className="import-counts-table">
        <thead><tr><th scope="col">Sheet</th><th scope="col" className="num">Rows read</th><th scope="col" className="num">Added</th><th scope="col" className="num">Changed</th><th scope="col" className="num">Stopped or left</th><th scope="col" className="num">Unchanged</th><th scope="col" className="num">Must fix</th><th scope="col" className="num">Check</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.sheet}><th scope="row">{r.sheet}</th>{[r.read, r.added, r.changed, r.stopped, r.unchanged, r.must, r.check].map((v, i) => <td key={i} className="num">{v.toLocaleString('en-GB')}</td>)}</tr>)}</tbody>
      </table>
      <ul className="import-counts-lines">{rows.map((r) => <li key={r.sheet}>{sentence(r)}</li>)}</ul>
    </section>
  );
}

/** "Nothing would change" (2.3), with the worked-out cells that differ from today's, when there are any. */
function Nothing({ cs, base, names }: { cs: ChangeSet; base: Tables; names: Partial<Record<keyof Tables, string>> }) {
  const app = useApp();
  const edits = useMemo(() => workedOutEdits(base, workbook({ ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today, sheets: MODULE_SHEETS }), names), [base, app, names]);
  const rows = edits.reduce((k, e) => k + e.rows.length, 0);
  const cols = [...new Set(edits.flatMap((e) => e.columns))];
  return (
    <section className="import-nothing" aria-labelledby="nothing">
      <h2 className="h2" id="nothing">Nothing would change</h2>
      <p>All {n(cs.unchanged, 'row says', 'rows say')} what Faro already says.</p>
      {rows > 0 && <p className="small">On {n(rows, 'row')}, {cols.length === 1 ? cols[0] : `${cols.slice(0, -1).join(', ')} and ${cols.at(-1)}`} {cols.length === 1 && rows === 1 ? 'differs' : 'differ'} from what Faro works out today. Faro never reads those columns: to change where a goal stands, post a check-in.</p>}
    </section>
  );
}

/** A question answered: what was asked and the answer, with Change. */
function Answered({ id }: { id: string }) {
  const said = importStore.get().said[id]!;
  return (
    <div className="import-answered">
      <span>{said.title}: <span className="strong">{said.label}</span></span>
      <button type="button" className="btn ghost sm" onClick={() => importStore.answer(id, null)}>Change</button>
    </div>
  );
}

/** What a choice that needs a value finds: a team, a person or a goal, by the group's column. */
const pickKind = (g: IssueGroup): 'team' | 'person' | 'goal' => (g.column === 'Team' ? 'team' : ['Owner', 'Owner email', 'Takes over', 'Name', 'Email'].includes(g.column ?? '') ? 'person' : 'goal');
/** The cell an answer reads as: a team's name, a person's email (or name), a goal's key. */
function valueOf(s: Snapshot, kind: 'team' | 'person' | 'goal', id: string): string {
  if (kind === 'team') return s.teams.find((t) => t.id === id)?.name ?? '';
  if (kind === 'person') { const p = s.people.find((x) => x.id === id); return p?.email || p?.name || ''; }
  const g = s.goals.find((x) => x.id === id);
  return g?.key ?? g?.id ?? '';
}

/** One group (rule 6): its title, where its rows are and the fix, its answers, and its rows on request. */
function GroupBlock({ g, cs, prior }: { g: IssueGroup; cs: ChangeSet; prior?: Answer }) {
  const app = useApp();
  const [chosen, setChosen] = useState('');
  const [shown, setShown] = useState(0);
  const give = (c: Choice, v?: string) => {
    // An unlikely number's answer covers the numbers it was given for, and those of the answer before it.
    const covers = g.values ? [...new Set([...(prior?.covers ?? []), ...g.values])] : undefined;
    importStore.answer(g.id, { choice: c.choice, ...(v ? { value: v } : {}), ...(covers ? { covers } : {}) }, { title: g.title, label: v ? `Use “${v}”` : c.label, level: g.level === 'must' ? 'must' : 'check' });
  };
  const rows = cs.issues.filter((i) => i.group === g.id);
  const valueChoice = g.answers.find((c) => c.choice === chosen && c.needsValue);
  const list = valueChoice?.options?.filter((o) => o !== g.suggest) ?? [];
  const isMust = g.level === 'must';
  return (
    <div className={'level-block import-group ' + (isMust ? 'level-fix' : 'level-check')} role="group" aria-labelledby={`t-${g.id}`}>
      <span className="level-head"><WarnMark /><span className="level-word">{isMust ? 'Must fix' : 'Check'}</span></span>
      <strong id={`t-${g.id}`} className="level-q">{g.title}</strong>
      <span className="small">{g.where}. {g.count > 1 || g.example !== g.title ? g.example : ''}</span>
      {g.answers.length > 0 && (
        <fieldset className="import-answers">
          <legend className="sr">{g.title}</legend>
          {g.answers.map((c) => (
            <label key={c.choice} className="import-answer">
              <input type="radio" name={`a-${g.id}`} checked={chosen === c.choice} onChange={() => { setChosen(c.choice); if (!c.needsValue) give(c); }} />
              <span>{c.label}</span>
            </label>
          ))}
          {valueChoice && (
            <span className="import-value">
              {valueChoice.options ? (
                // A column's few words: one radio each, chosen at once.
                <span className="import-answers" role="radiogroup" aria-label={valueChoice.label}>
                  {list.map((o) => <label key={o} className="import-answer"><input type="radio" name={`o-${g.id}`} onChange={() => give(valueChoice, o)} /><span>Use “{o}”</span></label>)}
                </span>
              ) : (
                // A team, a person or a goal: found by typing (find-and-pick), never chosen from a list of everything.
                <PickOne kind={pickKind(g)} label={valueChoice.label} value={null} onChange={(id) => { const v = id ? valueOf(app.snapshot, pickKind(g), id) : ''; if (v) give(valueChoice, v); }} />
              )}
            </span>
          )}
        </fieldset>
      )}
      {rows.length > 0 && (shown === 0 ? (
        <button type="button" className="linkish tap import-show" onClick={() => setShown(50)}>Show the {n(rows.length, 'row')}</button>
      ) : (
        <div className="import-rows">
          <table className="import-rows-table">
            <thead><tr><th scope="col" className="num">Row</th><th scope="col">Name</th><th scope="col">{g.column ?? 'Cell'}</th></tr></thead>
            <tbody>{rows.slice(0, shown).map((i) => <tr key={rowKey(i)}><td className="num">{i.row}</td><td>{i.name || '—'}</td><td>{i.value ?? i.found ?? '—'}</td></tr>)}</tbody>
          </table>
          {rows.length > shown && <button type="button" className="linkish tap" onClick={() => setShown(shown + 50)}>Show 50 more</button>}
        </div>
      ))}
    </div>
  );
}

/** The foot (2.3, item 7): what still stands in the way, and the one primary action. */
function Foot({ mustRows, questions, total, nothing, ready, onlyReason, tried, busy, onSave, onChoose }: { mustRows: number; questions: number; total: number; nothing: boolean; ready: boolean; onlyReason: boolean; tried: boolean; busy: boolean; onSave: () => void; onChoose: () => void }) {
  const saveLabel = busy ? 'Saving…' : `Save ${n(total, 'change')}`;
  if (nothing) return <div className="foot-row import-foot"><button type="button" className="btn primary big-btn" onClick={onChoose}>Choose another file</button></div>;
  if (mustRows) {
    return (
      <>
        <p className="hint preview-hint" role="status">{n(mustRows, 'row')} must be fixed{questions ? ` and ${n(questions, 'question')} answered` : ''} before this can be saved.</p>
        <div className="foot-row import-foot"><button type="button" className="btn primary big-btn" onClick={onChoose}>Choose the corrected file</button></div>
      </>
    );
  }
  return (
    <>
      {questions > 0 && <p className="hint preview-hint" role="status">Answer {n(questions, 'question')} to save.</p>}
      {onlyReason && <p className={'hint preview-hint' + (tried ? ' tone-off' : '')} role="status">Say why the plans are changing to save.</p>}
      <div className="foot-row import-foot">
        <button type="button" className="btn big-btn preview-again" onClick={onChoose}>Choose another file</button>
        <button type="button" className="btn primary big-btn" disabled={(!ready && !onlyReason) || busy} aria-disabled={onlyReason || undefined} onClick={onSave}>{saveLabel}</button>
      </div>
    </>
  );
}

/** Leaving rows out (2.3, decision 1): what goes, what goes with it, and the choice. */
function LeaveSheet({ open, onClose, rows, dependants, onDownload, onLeave }: { open: boolean; onClose: () => void; rows: (RowProblem & { name: string })[]; dependants: { sheet: Sheet; row: number; because: string }[]; onDownload: () => void; onLeave: () => void }) {
  const what = SHEETS.map((sh) => { const k = dependants.filter((d) => d.sheet === sh).length; return k ? n(k, sh === 'Check-ins' ? 'check-in' : sh === 'People' ? 'person' : sh === 'Plan' ? 'plan row' : 'goal', sh === 'People' ? 'people' : undefined) : ''; }).filter(Boolean).join(' and ');
  return (
    <SheetBox open={open} onClose={onClose} title={`Leave ${n(rows.length, 'row')} out?`}>
      <p>These {n(rows.length, 'row')} won’t be saved{dependants.length ? `, nor will ${n(dependants.length, 'row')} that depend on them (${what})` : ''}. Everything else will.</p>
      <ul className="issue-list import-leave-list">
        {rows.slice(0, 50).map((x) => <li key={rowKey(x)}><span className="label">{x.sheet}, row {x.row}{x.name ? ` · ${x.name}` : ''}</span><span>{x.problem}</span></li>)}
        {dependants.slice(0, 50).map((x) => <li key={rowKey(x)}><span className="label">{x.sheet}, row {x.row}</span><span>Goes with them: {x.because}.</span></li>)}
      </ul>
      <div className="foot-row">
        <button type="button" className="linkish tap" onClick={onDownload}>Download these rows</button>
        <span className="grow" />
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn primary" onClick={onLeave}>Leave them out</button>
      </div>
    </SheetBox>
  );
}
