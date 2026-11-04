/* Data: every person, goal, check-in and plan as a table. Everyone can look; admins type into cells across many rows,
   then Review changes shows the before and after and any problems, and Save applies them together. Saving goes
   through the bulk-change engine, so the same rules, rights and change log apply as for Import and the AI assistant. */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import type { ChangeSet, Rec, Tables } from '../domain/changeset';
import { GOAL_DERIVED_COLUMNS, workbook, type Cell } from '../domain/export';
import { Chip, Sheet } from '../ui/bits';
import { LABEL } from '../domain/status';
import type { DisplayStatus } from '../domain/types';
import { Preview } from './Import';
import {
  applyTable, columnKind, describeFilter, filterEntries, NO_VALUE, OP_LABEL, OPS, parseFilters, parseSort, SEP,
  type ColumnKind, type Op, type PropFilter, type TableSort,
} from '../domain/tableFilter';
import { Icon } from '../ui/Icon';

type Tab = 'people' | 'goals' | 'checkIns' | 'plan' | 'requests';
const TABS: [Tab, string][] = [['goals', 'Goals'], ['checkIns', 'Check-ins'], ['plan', 'Plans'], ['requests', 'Requests'], ['people', 'People']];
const SHEET: Record<Tab, string> = { goals: 'Goals', plan: 'Plan', checkIns: 'Check-ins', people: 'People', requests: 'Requests' };
const PAGE = 100;

/** Columns people can change; everything else (IDs, what the app works out) is shown but not editable. */
const EDITABLE: Record<Tab, (col: string) => boolean> = {
  people: (c) => ['Name', 'Job title', 'Team', 'Admin'].includes(c),
  goals: (c) => !['ID', 'Type', 'Feeds into ID', ...GOAL_DERIVED_COLUMNS].includes(c),
  checkIns: (c) => ['Value', 'Stages', 'Call', 'Cause', 'Why', 'Why greener', 'Path to green', 'Recovery', 'Back on plan by week', 'Needs', 'Next step'].includes(c),
  plan: (c) => /^Week \d+$/.test(c),
  // Requests are raised in check-ins and answered on the goal; here they're for looking across.
  requests: () => false,
};
/** The column that names each row: it stays in view while scrolling across. */
const NAME: Record<Tab, string> = { people: 'Name', goals: 'Goal', checkIns: 'Goal', plan: 'Goal', requests: 'Request' };
/** What each table shows to start with: the columns people compare. Everything else is one click away under Columns. */
const DEFAULT_COLS: Record<Tab, string[] | null> = {
  goals: ['ID', 'Goal', 'Level', 'Team', 'Owner', 'Type', 'Unit', 'Start', 'Target', 'Status', 'Now', 'Gap', 'Last check-in week', 'Feeds into'],
  checkIns: ['ID', 'Goal', 'Week', 'Value', 'Stages', 'Call', 'Calculated', 'Plan that week', 'Why', 'Recovery', 'Back on plan by week', 'Needs', 'Posted by'],
  plan: null,
  people: null,
  requests: ['ID', 'Request', 'Goals', 'Asked by', 'Asked of', 'Status', 'Asked at', 'Answer', 'Answered by'],
};
const colsKey = (t: Tab) => `goals-data-cols:${t}`;
const HIDDEN: Record<Tab, string[]> = { people: ['Team objective'], goals: [], checkIns: [], plan: [], requests: [] };

const text = (v: Cell | undefined) => (v == null ? '' : String(v));
/** A goal's status word back to its status, so the cell can show the shape beside the word (the words come from the rules). */
const STATUS_OF = Object.fromEntries(Object.entries(LABEL).map(([k, v]) => [v, k])) as Record<string, DisplayStatus>;
/** A moment such as 2026-10-28T10:00:00.000Z, said the way people read it: 28 Oct 2026, 10:00. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const when = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
/** The column chooser's groups: a long list reads in parts. */
const PLAN_COLS = ['Unit', 'Decimals', 'Start', 'Target', 'Plan', 'Plan from week', 'Due week', 'Limit', 'Must stay', 'Margin', 'Stages'];
const GROUPS: Record<Tab, string[]> = { goals: ['Details', 'Plan', 'This week', 'Quarters'], plan: ['Details', 'Weeks'], checkIns: [''], people: [''], requests: [''] };
const groupOf = (t: Tab, c: string): string => {
  if (t === 'goals') return /^Q[1-4]$/.test(c) ? 'Quarters' : (GOAL_DERIVED_COLUMNS as readonly string[]).includes(c) ? 'This week' : PLAN_COLS.includes(c) ? 'Plan' : 'Details';
  if (t === 'plan') return /^Week \d+$/.test(c) ? 'Weeks' : 'Details';
  return '';
};
/** A filter as one short line for its chip: the first two values, then how many more. The full text is in the editor. */
const shortFilter = (f: PropFilter) => {
  const vs = f.value.split(SEP).filter(Boolean);
  if ((f.op !== 'is' && f.op !== 'isNot') || vs.length <= 2) return describeFilter(f);
  return `${f.col} ${OP_LABEL[f.op]} ${vs.slice(0, 2).join(', ')} +${vs.length - 2}`;
};

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
  const [edits, setEdits] = useState<Record<Tab, Record<string, Record<string, string>>>>({ people: {}, goals: {}, checkIns: {}, plan: {}, requests: {} });
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
  // Columns: the compact default, or this person's own choice (kept in this browser). ID and the name always show.
  const [chosen, setChosen] = useState<Record<string, string[] | null>>(() => Object.fromEntries(TABS.map(([t]) => { try { const v = localStorage.getItem(colsKey(t)); return [t, v ? JSON.parse(v) as string[] : null]; } catch { return [t, null]; } })));
  const pick = chosen[tab] ?? DEFAULT_COLS[tab];
  const always = ['ID', NAME[tab]];
  // The column that names each row comes first on every table, and stays in view while scrolling across.
  const listed = head.map((c, i) => ({ c, i })).filter(({ c }) => !HIDDEN[tab].includes(c) && (!pick || always.includes(c) || pick.includes(c)));
  const cols = [...listed.filter((x) => x.c === NAME[tab]), ...listed.filter((x) => x.c !== NAME[tab])];
  const setCols = (next: string[] | null) => { setChosen((x) => ({ ...x, [tab]: next })); try { if (next) localStorage.setItem(colsKey(tab), JSON.stringify(next)); else localStorage.removeItem(colsKey(tab)); } catch { /* storage blocked */ } };
  const [choosing, setChoosing] = useState(false);
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
      if (recs.length && t !== 'requests') out[t] = recs;
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
      setEdits({ people: {}, goals: {}, checkIns: {}, plan: {}, requests: {} });
      setCs(null);
      setReason('');
    } catch { /* the save already said what went wrong */ }
    setBusy(false);
  };
  const admins = app.snapshot.people.filter((p) => p.admin).map((p) => p.name);
  const empty = shown.length === 0 && narrowed;
  // The table box ends just above the window's bottom edge (and the changes bar): it knows where it starts.
  const wrapRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const place = () => el.style.setProperty('--data-top', `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    place();
    const ro = new ResizeObserver(place);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener('resize', place);
    return () => { ro.disconnect(); window.removeEventListener('resize', place); };
  }, [tab, empty]);

  return (
    <div className={'page wide data-page' + (total ? ' has-edits' : '')}>
      <div className="page-head">
        <h1 className="title-xl">Data</h1>
        <span className="hint">{canEdit
          ? 'Every goal, check-in, plan and person. Type into any cell that isn’t greyed out, then review your changes and save them together; they’re checked with the same rules as everywhere else and logged.'
          : `Every goal, check-in, plan and person, to look through. Admins can change them here: ${admins.join(', ') || 'no one yet'}.`}</span>
      </div>
      <div className="seg tabs one-row" role="tablist" aria-label="Table">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setLimit(PAGE); }}>{l}<span className="tabcount">{tables[k].rows.length}</span>{editCount(k) > 0 && <><span className="tab-dot" aria-hidden="true" /><span className="sr">, {editCount(k)} changed</span></>}</button>)}
      </div>
      <div className="filterbar-row">
        <label className="filter-search"><span className="sr">Search this table</span>
          <input className="input" type="search" placeholder={`Search ${TABS.find(([k]) => k === tab)![1].toLowerCase()}`} value={q} onChange={(e) => { setView({ q: e.target.value }); setLimit(PAGE); }} />
        </label>
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setEditing({ index: null })}><Icon name="plus" />Filter</button>
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setChoosing(true)}>Columns · {cols.length} of {head.length - HIDDEN[tab].length}</button>
        <span className="small muted" role="status">{shown.length === rows.length ? `${rows.length} rows` : `${shown.length} of ${rows.length} rows`}</span>
      </div>
      {(filters.length > 0 || sort) && (
        <div className="filter-chips" aria-label="Filters and sort">
          {filters.map((f, k) => (
            <span key={k} className="prop-chip">
              <button type="button" className="prop-chip-edit" aria-label={`Change filter: ${describeFilter(f)}`} title={describeFilter(f)} onClick={() => setEditing({ index: k })}><span className="prop-chip-text">{shortFilter(f)}</span></button>
              <button type="button" className="prop-chip-x" aria-label={`Remove filter: ${describeFilter(f)}`} onClick={() => setView({ filters: filters.filter((_, j) => j !== k) })}><Icon name="close" /></button>
            </span>
          ))}
          {sort && (
            <span className="prop-chip">
              <span className="prop-chip-edit"><span className="prop-chip-text">Sorted by {sort.col}, {kinds[sort.col] === 'number' ? (sort.dir === 1 ? 'lowest first' : 'highest first') : sort.dir === 1 ? 'A to Z' : 'Z to A'}</span></span>
              <button type="button" className="prop-chip-x" aria-label="Remove the sort" onClick={() => setView({ sort: null })}><Icon name="close" /></button>
            </span>
          )}
          <button type="button" className="linkish small" onClick={() => setView({ q: '', filters: [], sort: null })}>Clear all</button>
        </div>
      )}
      {choosing && (
        <Sheet open onClose={() => setChoosing(false)} title="Columns">
          <div className="stack col-chooser" style={{ gap: 'var(--s3)' }}>
            <span className="hint">Choose what this table shows; it stays this way in this browser. ID and {NAME[tab].toLowerCase()} always show.</span>
            <div className="col-groups">{GROUPS[tab].map((g) => {
              const list = head.filter((c) => !HIDDEN[tab].includes(c) && groupOf(tab, c) === g);
              if (!list.length) return null;
              return (
                <fieldset key={g || 'all'} className="col-group">
                  <legend className={g ? 'label' : 'sr'}>{g || 'Columns'}</legend>
                  <div className="col-checks">{list.map((c) => (
                    <label key={c} className="check"><input type="checkbox" disabled={always.includes(c)} checked={cols.some((x) => x.c === c)} onChange={(e) => {
                      const now = cols.map((x) => x.c);
                      setCols(e.target.checked ? [...now, c] : now.filter((x) => x !== c));
                    }} /> {c}</label>
                  ))}</div>
                </fieldset>
              );
            })}</div>
            <div className="sheet-foot">
              <span className="row" style={{ gap: 'var(--s3)' }}>
                <button type="button" className="linkish small" onClick={() => setCols(null)}>The usual columns</button>
                <button type="button" className="linkish small" onClick={() => setCols(head.filter((c) => !HIDDEN[tab].includes(c)))}>Every column</button>
              </span>
              <button type="button" className="btn primary" onClick={() => setChoosing(false)}>Done</button>
            </div>
          </div>
        </Sheet>
      )}
      {editing && <FilterEditor head={head.filter((c) => !HIDDEN[tab].includes(c))} kinds={kinds} values={(c) => [...new Set(rows.map((r) => r.cells[head.indexOf(c)] ?? '').filter((v) => v.trim()))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))}
        start={editing.index != null ? filters[editing.index] : undefined}
        onSave={(f) => { setView({ filters: editing.index != null ? filters.map((x, j) => (j === editing.index ? f : x)) : [...filters, f] }); setEditing(null); setLimit(PAGE); }}
        onClose={() => setEditing(null)} />}

      <div className="table-wrap data-wrap" ref={wrapRef}>
        {empty ? (
          <div className="data-empty" role="status">
            <span>No rows match.</span>
            <button type="button" className="linkish" onClick={() => setView({ q: '', filters: [] })}>Clear the search and filters</button>
          </div>
        ) : (
        <table className="dtable">
          <thead>
            <tr>{cols.map(({ c }) => (
              <th key={c} scope="col" className={[c === 'ID' ? 'did' : c === NAME[tab] ? 'dname' : kinds[c] === 'number' ? 'num' : '', tab === 'plan' && /^Week \d+$/.test(c) ? 'wk' : '', ISO_TIME.test(rows[0]?.cells[head.indexOf(c)] ?? '') ? 'dtime' : ''].filter(Boolean).join(' ') || undefined} title={c === 'ID' ? 'Each record’s own ID. It never changes.' : undefined} aria-sort={sort?.col === c ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                <button type="button" className="sortbtn" onClick={() => setView({ sort: sort?.col === c ? (sort.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 } })}>{c}<span className="sort-slot" aria-hidden="true">{sort?.col === c ? <Icon name={sort.dir === 1 ? 'arrow-up' : 'arrow-down'} size={12} /> : null}</span></button>
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
                  const kind = (c === 'ID' ? ' did' : c === NAME[tab] ? ' dname' : kinds[c] === 'number' ? ' num' : '') + (tab === 'plan' && /^Week \d+$/.test(c) ? ' wk' : '');
                  if (!canEdit || r.locked || !EDITABLE[tab](c)) {
                    const status = tab === 'goals' && c === 'Status' ? STATUS_OF[value] : undefined;
                    const time = ISO_TIME.test(value);
                    return (
                      <td key={c} className={'dcell ro' + kind + (c === NAME[tab] ? ' strong' : '') + (time ? ' dtime' : '')} title={c === 'ID' ? 'IDs never change' : value.length > 20 || c === NAME[tab] ? value : undefined}>
                        {c === 'Goal' ? <Link className="linkish" to={'/goals/' + (tab === 'goals' || tab === 'plan' ? r.key : r.cells[head.indexOf('Goal ID')])}>{value}</Link>
                          : status ? <Chip k={status} label={value} className="dstatus" />
                            : time ? <time dateTime={value}>{when(value)}</time>
                              : value}
                      </td>
                    );
                  }
                  const opts = options[c];
                  return (
                    <td key={c} className={'dcell' + kind + (changed != null ? ' edited' : '')} title={changed != null ? `Was: ${original || '(empty)'}` : undefined}>
                      {opts && (opts.includes(value) || value === '')
                        ? <select aria-label={label} value={value} onChange={(e) => edit(tab, r.key, c, e.target.value, original)}>{(opts.includes('') ? opts : ['', ...opts]).map((o) => <option key={o} value={o}>{o || '—'}</option>)}</select>
                        : <input aria-label={label} value={value} title={c === NAME[tab] ? value : undefined} onChange={(e) => edit(tab, r.key, c, e.target.value, original)} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      {shown.length > limit && <button type="button" className="btn" onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>}

      {canEdit && total > 0 && (
        <div className="data-foot" role="region" aria-label="Your changes">
          <span className="data-foot-count">{total} {total === 1 ? 'change' : 'changes'}<span className="data-foot-more"> in {rowsEdited} {rowsEdited === 1 ? 'row' : 'rows'}, not saved yet</span></span>
          <span className="data-foot-actions">
            <button type="button" className="btn ghost" onClick={() => setEdits({ people: {}, goals: {}, checkIns: {}, plan: {}, requests: {} })}>Discard</button>
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
