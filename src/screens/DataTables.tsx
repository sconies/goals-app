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
const HIDDEN: Record<Tab, string[]> = { people: ['Team objective'], goals: [], checkIns: [], plan: [] };

const text = (v: Cell | undefined) => (v == null ? '' : String(v));

export function DataTables() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS.find(([k]) => k === params.get('t'))?.[0]) ?? 'goals';
  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set('t', t); setParams(p, { replace: true }); };
  const canEdit = app.viewer.admin;
  const book = useMemo(() => workbook({ ws: app.ws, snapshot: app.snapshot, cycle: app.cycle, week: app.week, today: app.today }), [app.ws, app.snapshot, app.cycle, app.week, app.today]);
  const tables = useMemo(() => {
    const out = {} as Record<Tab, { head: string[]; rows: { key: string; cells: string[]; locked?: string }[] }>;
    for (const [t] of TABS) {
      const sheet = book.find((x) => x.name === SHEET[t])!;
      const [head, ...body] = sheet.rows;
      const h = (head ?? []).map(text);
      const rows: { key: string; cells: string[]; locked?: string }[] = body.map((r, i) => ({ key: t === 'checkIns' ? `${text(r[0])}:${text(r[2])}:${text(r[h.indexOf('Posted at')])}` : text(r[0]) || String(i), cells: r.map(text) as string[] }));
      if (t === 'checkIns') {
        // A week with two check-ins: the latest is that week's; the earlier one stays as history.
        const latest = new Map<string, string>();
        for (const r of rows) { const k = r.cells[0] + ':' + r.cells[2]; const at = r.cells[h.indexOf('Posted at')]!; if ((latest.get(k) ?? '') < at) latest.set(k, at); }
        for (const r of rows) if (latest.get(r.cells[0] + ':' + r.cells[2]) !== r.cells[h.indexOf('Posted at')]) r.locked = 'A later check-in that week replaced this one';
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

  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const { head, rows } = tables[tab];
  const cols = head.map((c, i) => ({ c, i })).filter(({ c }) => !HIDDEN[tab].includes(c));
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((r) => words.every((w) => r.cells.some((c) => c.toLowerCase().includes(w))));
  if (sort) shown.sort((a, b) => { const x = a.cells[sort.col] ?? '', y = b.cells[sort.col] ?? ''; const nx = Number(x), ny = Number(y); return (x !== '' && y !== '' && !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y)) * sort.dir; });

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
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setSort(null); setLimit(PAGE); }}>{l}<span className="tabcount">{tables[k].rows.length}</span>{editCount(k) > 0 && <span className="small"> · {editCount(k)} changed</span>}</button>)}
      </div>
      <div className="filterbar-row">
        <label className="filter-search"><span className="sr">Search this table</span>
          <input className="input" type="search" placeholder={`Search ${TABS.find(([k]) => k === tab)![1].toLowerCase()}`} value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        </label>
        <span className="small muted" role="status">{shown.length === rows.length ? `${rows.length} rows` : `${shown.length} of ${rows.length} rows`}</span>
      </div>

      <div className="table-wrap data-wrap">
        <table className="dtable">
          <thead>
            <tr>{cols.map(({ c, i }) => (
              <th key={c} scope="col" aria-sort={sort?.col === i ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                <button type="button" className="sortbtn" onClick={() => setSort((s) => (s?.col === i ? (s.dir === 1 ? { col: i, dir: -1 } : null) : { col: i, dir: 1 }))}>{c}{sort?.col === i ? <span aria-hidden="true">{sort.dir === 1 ? ' ↑' : ' ↓'}</span> : null}</button>
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
                  const label = `${c}, ${r.cells[1] || r.key}${tab === 'checkIns' ? `, week ${r.cells[2]}` : ''}`;
                  if (!canEdit || r.locked || !EDITABLE[tab](c)) return <td key={c} className={'dcell ro' + (i === 1 ? ' strong' : '')} title={value.length > 30 ? value : undefined}>{c === 'Goal' && tab !== 'people' ? <Link className="linkish" to={'/goals/' + (tab === 'checkIns' ? r.cells[0] : r.key)}>{value}</Link> : value}</td>;
                  const opts = options[c];
                  return (
                    <td key={c} className={'dcell' + (changed != null ? ' edited' : '')} title={changed != null ? `Was: ${original || '(empty)'}` : undefined}>
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
