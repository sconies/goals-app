/* The import's changes (backlog IM3; docs/design/import/spec.md 2.4), at /data/import/check/changes: every change the
   file would make, in the file's order, 50 at a time, found by a goal, a person or a key, filtered to what's added,
   changed or stopped. Each says its sheet and row, what it does, each field before and after, and how a value Faro
   supplied was worked out ("the owner's team; the row gave none"). */
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../../app/state';
import { describe, type Item } from '../../domain/changeset';
import { fold, SHEET_ORDER } from '../../domain/problemLevels';
import { LEFT, STOPPED } from '../../domain/vocabulary';
import { ListBar, ListSearch } from '../../ui/ListBar';
import { PlanDiff, planWeeks } from '../../ui/Preview';
import { useImportPlan } from './importPlan';
import { PAGE } from '../../domain/importLimits';
import { importStore } from './importStore';
import { leftRowsOf } from './rowsFile';
import './import.css';

type Show = 'all' | 'added' | 'changed' | 'stopped';
const SHOW_OF = (x: Item): Show => (['new goal', 'check-in', 'new person'].includes(x.kind) ? 'added' : ['stop goal', 'delete goal', 'person left'].includes(x.kind) ? 'stopped' : 'changed');
const WHAT: Record<Item['kind'], string> = {
  'new goal': 'added', goal: 'changed', plan: 'plan changed', 'check-in': 'added', 'replaces check-in': 'replaces a check-in', person: 'changed', 'new person': 'added', team: 'changed',
  'stop goal': STOPPED.toLowerCase(), 'delete goal': 'deleted', 'person left': LEFT.toLowerCase(),
};
const n = (k: number, one: string, many = one + 's') => `${k.toLocaleString('en-GB')} ${k === 1 ? one : many}`;

export function Changes() {
  const app = useApp();
  const nav = useNavigate();
  const { st, cs, base, left, toSave } = useImportPlan();
  const [problem, setProblem] = useState('');
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const show = (params.get('show') ?? 'all') as Show;
  const q = params.get('q') ?? '';
  const [count, setCount] = useState(PAGE);
  const items = useMemo(() => [...(cs?.items ?? [])].sort((a, b) => SHEET_ORDER.indexOf(a.sheet) - SHEET_ORDER.indexOf(b.sheet) || a.row - b.row), [cs]);
  const keyOf = (x: Item) => {
    const g = x.goalId ? app.goal(x.goalId) ?? cs?.commit?.goals?.find((y) => y.id === x.goalId) : undefined;
    return x.kind === 'new goal' ? (g?.key ? `new, will be ${g.key}` : 'new') : g?.key ?? '';
  };
  const found = items.filter((x) => (show === 'all' || SHOW_OF(x) === show) && (!q || fold(`${x.goal} ${keyOf(x)}`).includes(fold(q))));
  if (!cs) return <Navigate to="/data/import" replace state={{ lost: true }} />;
  const counts = { all: items.length, added: items.filter((x) => SHOW_OF(x) === 'added').length, changed: items.filter((x) => SHOW_OF(x) === 'changed').length, stopped: items.filter((x) => SHOW_OF(x) === 'stopped').length };
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v && v !== 'all') p.set(k, v); else p.delete(k); setParams(p, { replace: true }); setCount(PAGE); };
  const notes = (x: Item) => cs.issues.filter((i) => i.level === 'note' && i.sheet === x.sheet && i.row === x.row);
  const shown = found.slice(0, count);
  // Ready with no reason needed, or once one is typed on the summary (worked out with it only when saving).
  const ready = !!cs.commit || (cs.needsReason && !!st.reason.trim() && !cs.groups.some((g) => g.level === 'must' || g.level === 'check'));
  const save = async () => {
    const final = toSave();
    if (!final?.commit) return;
    setBusy(true);
    setProblem('');
    const importId = final.commit.changes.find((c) => c.action === 'imported')?.entityId;
    try {
      await app.applyChanges(final);
      if (importId && base) importStore.set({ done: { importId, tables: base, rows: leftRowsOf(left) } });
      else app.toast(`Saved: ${describe(cs).toLowerCase()}`);
      nav(importId ? `/data/import/done/${importId}` : '/goals');
    } catch (e) {
      setProblem(`Nothing was saved: ${e instanceof Error ? e.message : String(e)}. Try again.`);
      setBusy(false);
    }
  };
  return (
    <div className="page narrow import-check">
      <div className="page-head">
        <h1 className="title-xl">The changes</h1>
        <span className="hint">Nothing has been saved.</span>
      </div>
      <ListBar search={<ListSearch value={q} onSearch={(t) => set('q', t)} label="Find a goal, a person or a key" placeholder="Find a goal, a person or a key" />}>
        <span className="seg import-shows" role="group" aria-label="Show">
          {(['all', 'added', 'changed', 'stopped'] as Show[]).map((k) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => set('show', k)}>{k[0]!.toUpperCase() + k.slice(1)} {counts[k].toLocaleString('en-GB')}</button>
          ))}
        </span>
      </ListBar>
      <p className="small" role="status">{n(found.length, 'change')}, in the file’s order.{found.length ? ` Showing 1 to ${shown.length.toLocaleString('en-GB')}.` : ''}</p>
      <ul className="import-changes">
        {shown.map((x) => (
          <li key={`${x.sheet}:${x.row}:${x.kind}:${x.goalId}`} className="import-change">
            <span><span className="strong">{x.goal}</span>{keyOf(x) ? <span className="hint"> · {keyOf(x)}</span> : null}</span>
            <span className="small muted">{x.sheet}, row {x.row} · {x.kind === 'replaces check-in' ? x.summary : WHAT[x.kind]}</span>
            {x.diffs.filter((d) => d.field !== 'Via').map((d) => (d.field === 'Plan numbers' && planWeeks(d.to).length
              ? <PlanDiff key={d.field} d={d} goal={app.goal(x.goalId)} weeks={app.cycle.weeks} />
              : <span key={d.field} className="small"><span className="muted">{d.field}:</span> {d.from && d.from !== '—' ? <><s>{d.from}</s> → </> : null}{d.to}</span>))}
            {notes(x).map((i, k) => <span key={k} className="small muted">({i.message.replace(/\.$/, '')})</span>)}
          </li>
        ))}
      </ul>
      {found.length > shown.length && <div><button type="button" className="btn" onClick={() => setCount(count + PAGE)}>Show 50 more</button></div>}
      {problem && <p className="hint tone-off" role="alert">{problem}</p>}
      <div className="foot-row import-foot">
        <Link className="btn big-btn preview-again" to="/data/import/check">Back to the summary</Link>
        <button type="button" className="btn primary big-btn" disabled={!ready || busy} onClick={() => void save()}>{busy ? 'Saving…' : `Save ${n(items.length, 'change')}`}</button>
      </div>
    </div>
  );
}
