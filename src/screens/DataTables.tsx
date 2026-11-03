/* Data: every person, goal, check-in and plan as a table. Everyone can look; admins type into cells across many rows,
   then Review changes shows the before and after and any problems, and Save applies them together. Saving goes
   through the bulk-change engine, so the same rules, rights and change log apply as for Import and the AI assistant. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import type { ChangeSet, Rec, Tables } from '../domain/changeset';
import { GOAL_DERIVED_COLUMNS, workbook, type Cell } from '../domain/export';
import { Sheet } from '../ui/bits';
import { Preview } from './Import';
import {
  applyTable, columnKind, describeFilter, filterEntries, NO_VALUE, OP_LABEL, OPS, parseFilters, parseSort, SEP,
  type ColumnKind, type Op, type PropFilter, type TableSort,
} from '../domain/tableFilter';

type Tab = 'people' | 'goals' | 'checkIns' | 'plan';
const TABS: [Tab, string][] = [['goals', 'Goals'], ['checkIns', 'Check-ins'], ['plan', 'Plans'], ['people', 'People']];
const SHEET: Record<Tab, string> = { goals: 'Goals', plan: 'Plan', checkIns: 'Check-ins', people: 'People' };
const PAGE = 100;

/** Columns people can change; everything else (IDs, what the app works out) is shown but not editable. */
const EDITABLE: Record<Tab, (col: string) => boolean> = {
  people: (c) => ['Name', 'Job title', 'Team', 'Admin'].includes(c),
  goals: (c) => !['ID', 'Type', 'Feeds into ID', ...GOAL_DERIVED_COLUMNS].includes(c),
  checkIns: (c) => ['Value', 'Stages', 'Call', 'Cause', 'Why', 'Why greener', 'Path to green', 'Recovery', 'Back on plan by week', 'Needs', 'Next step'].includes(c),
  plan: (c) => /^Week \d+$/.test(c),
};
/** The column that names each row: it stays in view while scrolling across. */
const NAME: Record<Tab, string> = { people: 'Name', goals: 'Goal', checkIns: 'Goal', plan: 'Goal' };
const HIDDEN: Record<Tab, string[]> = { people: ['Team objective'], goals: [], checkIns: [], plan: [] };

const text = (v: Cell | undefined) => (v == null ? '' : String(v));

export function DataTables() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS.find(([k]) => k === params.get('t'))?.[0]) ?? 'goals';
  // Search, filters and sort are in the link with the table, so a filtered table can be shared. A new table starts clear.
  const setTab = (t: Tab) => setParams(new URLSearchParams([['t', t]]), { replace: true });
  const q = params.get('q') ?? '';
  const filters = parseFilters(params);
  const sort = parseSort(params);
  const setView = (next: { q?: string; filters?: PropFilter[]; sort?: TableSort | null }) => setParams((cur) => {
    const nq = next.q ?? cur.get('q') ?? '';
    const nf = next.filters ?? parseFilters(cur);
    const ns = next.sort !== undefined ? next.sort : parseSort(cur);
    return new URLSearchParams([['t', cur.get('t') ?? 'goals'], ...(nq ? [['q', nq] as [string, string]] : []), ...filterEntries(nf, ns)]);
  }, { replace: true });
  const canEdit = app.viewer.admin;
  const book = useMemo(() => workbook({ ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today }), [app.ws, app.snapshot, app.cycle, app.week, app.today]);
  const tables = useMemo(() => {
    const out = {} as Record<Tab, { head: string[]; rows: { key: string; cells: string[]; locked?: string }[] }>;
    for (const [t] of TABS) {
      const sheet = book.find((x) => x.name === SHEET[t])!;
      const [head, ...body] = sheet.rows;
      const h = (head ?? []).map(text);
      // Every record's own ID is its key: it's shown, and it never changes.
      const rows: { key: string; cells: string[]; locked?: string }[] = body.map((r, i) => ({ key: text(r[0]) || String(i), cells: r.map(text) as string[] }));
      if (t === 'checkIns') {
        // A week with two check-ins: the latest is that week's; the earlier one stays as history.
        const [gi, wi, pi] = ['Goal ID', 'Week', 'Posted at'].map((c) => h.indexOf(c)) as [number, number, number];
        const latest = new Map<string, string>();
        for (const r of rows) { const k = r.cells[gi] + ':' + r.cells[wi]; if ((latest.get(k) ?? '') < r.cells[pi]!) latest.set(k, r.cells[pi]!); }
        for (const r of rows) if (latest.get(r.cells[gi] + ':' + r.cells[wi]) !== r.cells[pi]) r.locked = 'A later check-in that week replaced this one';
      }
      out[t] = { head: h, rows };
    }
    return out;
  }, [book]);

  // Edits: per table, per row, per column. A cell typed back to what it was is no longer an edit.
  const [edits, setEdits] = useState<Record<Tab, Record<string, Record<string, string>>>>({ people: {}, goals: {}, checkIns: {}, plan: {} });
  const edit = (t: Tab, key: string, col: string, value: string, original: string) => setEdits((e) => {
    const row = { ...(e[t][key] ?? {}) };
    if (value === original) delete row[col]; else row[col] = value;
    const table = { ...e[t] };
    if (Object.keys(row).length) table[key] = row; else delete table[key];
    return { ...e, [t]: table };
  });
  const editCount = (t: Tab) => Object.values(edits[t]).reduce((n, r) => n + Object.keys(r).length, 0);
  const total = TABS.reduce((n, [t]) => n + editCount(t), 0);
  const rowsEdited = TABS.reduce((n, [t]) => n + Object.keys(edits[t]).length, 0);

  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const { head, rows } = tables[tab];
  const cols = head.map((c, i) => ({ c, i })).filter(({ c }) => !HIDDEN[tab].includes(c));
  const shown = applyTable(rows, head, q, filters, sort);
  const kinds = useMemo(() => Object.fromEntries(head.map((c, i) => [c, columnKind(rows.map((r) => r.cells[i] ?? ''))])) as Record<string, ColumnKind>, [head, rows]);
  const narrowed = !!q.trim() || filters.length > 0;

  // Choices for the cells that have a fixed set of answers; the engine checks the rest.
  const options: Record<string, string[]> = {
    Owner: app.snapshot.people.map((p) => p.name),
    Team: ['', ...app.snapshot.teams.map((t) => t.name)],
    Level: ['north star', 'svp', 'team'],
    Admin: ['', 'yes'],
    Call: ['On track', 'At risk', 'Off track', 'Done'],
  };

  const [cs, setCs] = useState<ChangeSet | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const records = (): Tables => {
    const out: Tables = {};
    for (const [t] of TABS) {
      const { head: h, rows: rs } = tables[t];
      const recs: Rec[] = Object.entries(edits[t]).map(([key, changed]) => {
        const r = rs.find((x) => x.key === key)!;
        const rec: Rec = { __row: String(rs.indexOf(r) + 2) };
        h.forEach((c, i) => { rec[c.toLowerCase()] = changed[c] ?? r.cells[i] ?? ''; });
        return rec;
      });
      if (recs.length) out[t] = recs;
    }
    return out;
  };
  const review = (why = reason) => setCs(app.previewChanges(records(), 'table', why));
  const apply = async () => {
    if (!cs?.commit) return;
    setBusy(true);
    try {
      await app.applyChanges(cs);
      app.toast(`Saved ${total} ${total === 1 ? 'change' : 'changes'}`);
      setEdits({ people: {}, goals: {}, checkIns: {}, plan: {} });
      setCs(null);
      setReason('');
    } catch { /* the save already said what went wrong */ }
    setBusy(false);
  };
  const admins = app.snapshot.people.filter((p) => p.admin).map((p) => p.name);

  return (
    <div className={'page wide data-page' + (total ? ' has-edits' : '')}>
      <div className="page-head">
        <h1 className="title-xl">Data</h1>
        <span className="hint">{canEdit
          ? 'Every goal, check-in, plan and person. Type into any white cell, then review your changes and save them together; they’re checked with the same rules as everywhere else and logged.'
          : `Every goal, check-in, plan and person, to look through. Admins can change them here: ${admins.join(', ') || 'no one yet'}.`}</span>
      </div>
      <div className="seg tabs one-row" role="tablist" aria-label="Table">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setLimit(PAGE); }}>{l}<span className="tabcount">{tables[k].rows.length}</span>{editCount(k) > 0 && <span className="small"> · {editCount(k)} changed</span>}</button>)}
      </div>
      <div className="filterbar-row">
        <label className="filter-search"><span className="sr">Search this table</span>
          <input className="input" type="search" placeholder={`Search ${TABS.find(([k]) => k === tab)![1].toLowerCase()}`} value={q} onChange={(e) => { setView({ q: e.target.value }); setLimit(PAGE); }} />
        </label>
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setEditing({ index: null })}>+ Filter</button>
        <span className="small muted" role="status">{shown.length === rows.length ? `${rows.length} rows` : `${shown.length} of ${rows.length} rows`}</span>
      </div>
      {(filters.length > 0 || sort) && (
        <div className="filter-chips" aria-label="Filters and sort">
          {filters.map((f, k) => (
            <span key={k} className="prop-chip">
              <button type="button" className="prop-chip-edit" aria-label={`Change filter: ${describeFilter(f)}`} onClick={() => setEditing({ index: k })}>{describeFilter(f)}</button>
              <button type="button" className="prop-chip-x" aria-label={`Remove filter: ${describeFilter(f)}`} onClick={() => setView({ filters: filters.filter((_, j) => j !== k) })}>✕</button>
            </span>
          ))}
          {sort && (
            <span className="prop-chip">
              <span className="prop-chip-edit">Sorted by {sort.col}, {kinds[sort.col] === 'number' ? (sort.dir === 1 ? 'lowest first' : 'highest first') : sort.dir === 1 ? 'A to Z' : 'Z to A'}</span>
              <button type="button" className="prop-chip-x" aria-label="Remove the sort" onClick={() => setView({ sort: null })}>✕</button>
            </span>
          )}
          <button type="button" className="linkish small" onClick={() => setView({ q: '', filters: [], sort: null })}>Clear all</button>
        </div>
      )}
      {editing && <FilterEditor head={cols.map(({ c }) => c)} kinds={kinds} values={(c) => [...new Set(rows.map((r) => r.cells[head.indexOf(c)] ?? '').filter((v) => v.trim()))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))}
        start={editing.index != null ? filters[editing.index] : undefined}
        onSave={(f) => { setView({ filters: editing.index != null ? filters.map((x, j) => (j === editing.index ? f : x)) : [...filters, f] }); setEditing(null); setLimit(PAGE); }}
        onClose={() => setEditing(null)} />}

      <div className="table-wrap data-wrap">
        <table className="dtable">
          <thead>
            <tr>{cols.map(({ c }) => (
              <th key={c} scope="col" className={c === 'ID' ? 'did' : c === NAME[tab] ? 'dname' : undefined} title={c === 'ID' ? 'Each record’s own ID. It never changes.' : undefined} aria-sort={sort?.col === c ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                <button type="button" className="sortbtn" onClick={() => setView({ sort: sort?.col === c ? (sort.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 } })}>{c}{sort?.col === c ? <span aria-hidden="true">{sort.dir === 1 ? ' ↑' : ' ↓'}</span> : null}</button>
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((r) => (
              <tr key={r.key} title={r.locked}>
                {cols.map(({ c, i }) => {
                  const original = r.cells[i] ?? '';
                  const changed = edits[tab][r.key]?.[c];
                  const value = changed ?? original;
                  const label = `${c}, ${r.cells[head.indexOf(NAME[tab])] || r.key}${tab === 'checkIns' ? `, week ${r.cells[head.indexOf('Week')]}` : ''}`;
                  const kind = c === 'ID' ? ' did' : c === NAME[tab] ? ' dname' : '';
                  if (!canEdit || r.locked || !EDITABLE[tab](c)) return <td key={c} className={'dcell ro' + kind + (c === NAME[tab] ? ' strong' : '')} title={c === 'ID' ? 'IDs never change' : value.length > 30 ? value : undefined}>{c === 'Goal' ? <Link className="linkish" to={'/goals/' + (tab === 'goals' || tab === 'plan' ? r.key : r.cells[head.indexOf('Goal ID')])}>{value}</Link> : value}</td>;
                  const opts = options[c];
                  return (
                    <td key={c} className={'dcell' + kind + (changed != null ? ' edited' : '')} title={changed != null ? `Was: ${original || '(empty)'}` : undefined}>
                      {opts && (opts.includes(value) || value === '')
                        ? <select aria-label={label} value={value} onChange={(e) => edit(tab, r.key, c, e.target.value, original)}>{(opts.includes('') ? opts : ['', ...opts]).map((o) => <option key={o} value={o}>{o || '—'}</option>)}</select>
                        : <input aria-label={label} value={value} onChange={(e) => edit(tab, r.key, c, e.target.value, original)} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && narrowed && <div className="calm">No rows match. <button type="button" className="linkish" onClick={() => setView({ q: '', filters: [] })}>Clear the search and filters</button></div>}
      {shown.length > limit && <button type="button" className="btn" onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}

      {canEdit && total > 0 && (
        <div className="data-foot" role="region" aria-label="Your changes">
          <span className="small strong">{total} {total === 1 ? 'change' : 'changes'} in {rowsEdited} {rowsEdited === 1 ? 'row' : 'rows'}, not saved yet</span>
          <span className="row" style={{ gap: 'var(--s2)' }}>
            <button type="button" className="btn ghost" onClick={() => setEdits({ people: {}, goals: {}, checkIns: {}, plan: {} })}>Discard</button>
            <button type="button" className="btn primary" onClick={() => review()}>Review changes</button>
          </span>
        </div>
      )}
      {cs && (
        <Sheet open onClose={() => setCs(null)} title="Review your changes" wide>
          <Preview cs={cs} name={`${total} ${total === 1 ? 'change' : 'changes'} from the data tables`} reason={reason} setReason={(v) => { setReason(v); review(v); }} busy={busy} onApply={() => void apply()} onAgain={() => setCs(null)} againLabel="Keep editing" fixHint="Fix those cells, then review again." />
        </Sheet>
      )}
    </div>
  );
}

/** Add or change one filter: a column, a condition that suits it, and a value. */
function FilterEditor({ head, kinds, values, start, onSave, onClose }: { head: string[]; kinds: Record<string, ColumnKind>; values: (col: string) => string[]; start?: PropFilter; onSave: (f: PropFilter) => void; onClose: () => void }) {
  const [col, setCol] = useState(start?.col ?? head.find((c) => kinds[c] === 'choice') ?? head[0] ?? '');
  const kind = kinds[col] ?? 'text';
  const [op, setOp] = useState<Op>(start?.op ?? OPS[kind][0]!);
  const [value, setValue] = useState(start?.value ?? '');
  const pickCol = (c: string) => { setCol(c); setOp(OPS[kinds[c] ?? 'text'][0]!); setValue(''); };
  const picked = value.split(SEP).filter(Boolean);
  const multi = op === 'is' || op === 'isNot';
  const ready = NO_VALUE.includes(op) || value.trim() !== '';
  return (
    <Sheet open onClose={onClose} title={start ? 'Change the filter' : 'Add a filter'}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); if (ready) onSave({ col, op, value: NO_VALUE.includes(op) ? '' : value }); }}>
        <div className="prop-row">
          <label className="field"><span className="field-label">Property</span>
            <select className="input" value={col} onChange={(e) => pickCol(e.target.value)}>{head.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </label>
          <label className="field"><span className="field-label">Condition</span>
            <select className="input" value={op} onChange={(e) => { const next = e.target.value as Op; if ((next === 'is' || next === 'isNot') !== multi) setValue(''); setOp(next); }}>{OPS[kind].map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}</select>
          </label>
        </div>
        {!NO_VALUE.includes(op) && (multi && kind !== 'number'
          ? (
            <fieldset className="filter-group"><legend className="field-label">Value</legend>
              <span className="filter-options prop-values">{values(col).map((v) => (
                <label key={v} className="check"><input type="checkbox" checked={picked.includes(v)} onChange={() => setValue((picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]).join(SEP))} /> {v}</label>
              ))}</span>
            </fieldset>
          )
          : <label className="field"><span className="field-label">Value</span><input className="input" autoFocus inputMode={kind === 'number' ? 'decimal' : undefined} value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'number' ? 'A number' : 'Some text'} /></label>)}
        <div className="sheet-foot">
          <button type="button" className="linkish small" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!ready}>{start ? 'Change filter' : 'Add filter'}</button>
        </div>
      </form>
    </Sheet>
  );
}
