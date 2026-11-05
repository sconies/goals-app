/* Data: every person, goal, check-in and plan as a table. Everyone can look; admins type into cells across many rows,
   then Review changes shows the before and after and any problems, and Save applies them together. Saving goes
   through the bulk-change engine, so the same rules, rights and change log apply as for Import and the AI assistant.
   Each table's layout is the person's own: which columns, in what order (drag a heading, or move them in Columns) and
   how wide (drag a heading's edge, or use the arrow keys on it). It's remembered in this browser, can be saved as a
   named table view, and the table exports exactly as it shows (domain/tableLayout). */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { downloadText, downloadWorkbook } from '../app/spreadsheet';
import type { ChangeSet, Rec, Tables } from '../domain/changeset';
import { GOAL_DERIVED_COLUMNS, toCsv, workbook, type Cell } from '../domain/export';
import { Chip, Sheet } from '../ui/bits';
import { LABEL } from '../domain/status';
import type { DisplayStatus, SavedView } from '../domain/types';
import { Preview } from './Import';
import { MenuButton } from './GoalFilters';
import {
  applyTable, columnKind, describeFilter, filterEntries, NO_VALUE, OP_LABEL, OPS, parseFilters, parseSort, SEP,
  type ColumnKind, type Op, type PropFilter, type TableSort,
} from '../domain/tableFilter';
import {
  choosableColumns, clampWidth, isTableView, layoutParams, MAX_WIDTH, minWidth, moveColumn, parseLayout, shownTable, TABLE_ORDER, TABLES, visibleColumns,
  type DataTable, type TableLayout,
} from '../domain/tableLayout';
import { Icon } from '../ui/Icon';

type Tab = DataTable;
const TABS: [Tab, string][] = TABLE_ORDER.map((t) => [t, TABLES[t].label]);
const PAGE = 100;

/** Columns people can change; everything else (IDs, keys, what the app works out) is shown but not editable. */
const EDITABLE: Record<Tab, (col: string) => boolean> = {
  people: (c) => ['Name', 'Job title', 'Team', 'Admin'].includes(c),
  goals: (c) => !['Key', 'ID', 'Type', 'Feeds into ID', ...GOAL_DERIVED_COLUMNS].includes(c),
  checkIns: (c) => ['Value', 'Stages', 'Call', 'Cause', 'Why', 'Why greener', 'Path to green', 'Recovery', 'Back on plan by week', 'Needs', 'Next step'].includes(c),
  plan: (c) => /^Week \d+$/.test(c),
  // Requests are raised in check-ins and answered on the goal; here they're for looking across.
  requests: () => false,
};
const NAME = Object.fromEntries(TABLE_ORDER.map((t) => [t, TABLES[t].name])) as Record<Tab, string>;
/** IDs and keys: set quietly, in the ID face. */
const ID_COLS = ['ID', 'Key', 'Goal key', 'Goal keys'];

/** This browser's layout of each table: columns in order and widths. (Saved table views go with the person.) */
type Local = { cols: string[] | null; widths: Record<string, number> };
const layoutKey = (t: Tab) => `goals-data-layout:${t}`;
const readLocal = (t: Tab): Local => {
  try {
    const v = localStorage.getItem(layoutKey(t));
    if (v) { const o = JSON.parse(v) as Partial<Local>; return { cols: Array.isArray(o.cols) ? o.cols : null, widths: o.widths && typeof o.widths === 'object' ? o.widths : {} }; }
    // Before layouts: the columns someone chose.
    const old = localStorage.getItem(`goals-data-cols:${t}`);
    return { cols: old ? JSON.parse(old) as string[] : null, widths: {} };
  } catch { return { cols: null, widths: {} }; }
};
const writeLocal = (t: Tab, l: Local) => {
  try { if (!l.cols && !Object.keys(l.widths).length) localStorage.removeItem(layoutKey(t)); else localStorage.setItem(layoutKey(t), JSON.stringify(l)); } catch { /* storage blocked */ }
};

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
const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'table';
/** A width set by hand holds the column at exactly that. */
const sized = (w: number | undefined) => (w ? { width: w, minWidth: w, maxWidth: w } : undefined);
const noEdits = (): Record<Tab, Record<string, Record<string, string>>> => ({ people: {}, goals: {}, checkIns: {}, plan: {}, requests: {} });

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
      const sheet = book.find((x) => x.name === TABLES[t].sheet)!;
      const [head, ...body] = sheet.rows;
      const h = (head ?? []).map(text);
      // Every record's own ID is its key: it's shown, and it never changes.
      const idi = Math.max(0, h.indexOf('ID'));
      const rows: { key: string; cells: string[]; locked?: string }[] = body.map((r, i) => ({ key: text(r[idi]) || String(i), cells: r.map(text) as string[] }));
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
  const [edits, setEdits] = useState(noEdits);
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

  /* ---------- the layout: columns in order, and widths ---------- */
  const [local, setLocal] = useState<Record<Tab, Local>>(() => Object.fromEntries(TABS.map(([t]) => [t, readLocal(t)])) as Record<Tab, Local>);
  const lay = local[tab];
  const setLay = (next: Partial<Local>) => setLocal((x) => { const l = { ...x[tab], ...next }; writeLocal(tab, l); return { ...x, [tab]: l }; });
  const order = visibleColumns(tab, head, lay.cols);
  const cols = order.map((c) => ({ c, i: head.indexOf(c) }));
  const always = [NAME[tab], ...TABLES[tab].always.filter((c) => head.includes(c))];
  const all = choosableColumns(tab, head);
  const widthOf = (c: string): number | undefined => lay.widths[c];
  const setWidth = (c: string, w: number | null) => setLocal((x) => {
    const widths = { ...x[tab].widths };
    if (w == null) delete widths[c]; else widths[c] = clampWidth(tab, c, w);
    const l = { ...x[tab], widths };
    writeLocal(tab, l);
    return { ...x, [tab]: l };
  });
  const current: TableLayout = { table: tab, cols: lay.cols, widths: lay.widths, q, filters, sort };

  const [choosing, setChoosing] = useState(false);
  const shown = applyTable(rows, head, q, filters, sort);
  const kinds = useMemo(() => Object.fromEntries(head.map((c, i) => [c, columnKind(rows.map((r) => r.cells[i] ?? ''))])) as Record<string, ColumnKind>, [head, rows]);
  const narrowed = !!q.trim() || filters.length > 0;

  /* ---------- table views: named layouts, kept with the person (or pinned for everyone) ---------- */
  const views = (app.snapshot.views ?? []).filter((v) => !v.deletedAt && isTableView(v) && (v.pinned || v.personId === app.viewer.id) && parseLayout(v.params)?.table === tab)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));
  const activeView = views.find((v) => v.params === layoutParams(current));
  const [savingView, setSavingView] = useState(false);
  const openView = (v: SavedView) => {
    const l = parseLayout(v.params);
    if (!l) return;
    setLay({ cols: l.cols, widths: l.widths });
    setParams(new URLSearchParams([['t', tab], ...(l.q ? [['q', l.q] as [string, string]] : []), ...filterEntries(l.filters, l.sort)]), { replace: true });
    setLimit(PAGE);
  };

  /* ---------- export, as shown ---------- */
  const exportAs = async (kind: 'csv' | 'xlsx') => {
    const sheet = book.find((x) => x.name === TABLES[tab].sheet)!;
    const out = shownTable(sheet, current);
    const base = `${slug(app.ws.name)}-${slug(TABLES[tab].label)}${activeView ? '-' + slug(activeView.name) : ''}-${app.today.toISOString().slice(0, 10)}`;
    try {
      if (kind === 'csv') downloadText(toCsv(out), base + '.csv', 'text/csv;charset=utf-8');
      else await downloadWorkbook([{ name: TABLES[tab].label, rows: out }], base + '.xlsx');
      app.toast(`Exported ${out.length - 1} ${out.length === 2 ? 'row' : 'rows'} and ${out[0]?.length ?? 0} columns, as shown`);
    } catch (e) { app.toast('Couldn’t export: ' + (e instanceof Error ? e.message : String(e)), 'error'); }
  };

  /* ---------- moving a column by dragging its heading (mouse or pen; on touch, Columns moves them) ---------- */
  const headRef = useRef<HTMLTableRowElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragged = useRef(false);
  const startDrag = (e: React.PointerEvent, col: string) => {
    if (e.pointerType === 'touch' || e.button !== 0 || col === NAME[tab]) return;
    const x0 = e.clientX;
    let live = false;
    let now = order;
    const move = (ev: PointerEvent) => {
      if (!live) {
        if (Math.abs(ev.clientX - x0) < 6) return;
        live = true;
        setDragging(col);
      }
      const from = now.indexOf(col);
      for (const th of headRef.current?.querySelectorAll<HTMLElement>('th[data-col]') ?? []) {
        const c = th.dataset.col!;
        const k = now.indexOf(c);
        if (c === col || k < 1) continue;
        const b = th.getBoundingClientRect();
        // Past the middle of a neighbour, in the direction of travel: take its place.
        if ((k > from && ev.clientX > b.left + b.width / 2 && ev.clientX < b.right) || (k < from && ev.clientX < b.left + b.width / 2 && ev.clientX > b.left)) {
          now = moveColumn(now, col, k);
          setLay({ cols: now.slice(1) });
          break;
        }
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      // The press that ends a drag isn't also a click on the heading (which sorts).
      if (live) { dragged.current = true; setTimeout(() => { dragged.current = false; }, 0); }
      setDragging(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  // The Views and Export menus open on whichever side of their button has room.
  const toolsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = toolsRef.current;
    if (!el) return;
    const place = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      const list = d.open ? d.querySelector<HTMLElement>('.view-menu-list') : null;
      if (!list) return;
      Object.assign(list.style, { left: '0px', right: 'auto' });
      if (list.getBoundingClientRect().right > window.innerWidth - 8) Object.assign(list.style, { left: 'auto', right: '0px' });
    };
    el.addEventListener('toggle', place, true);
    return () => el.removeEventListener('toggle', place, true);
  }, []);
  // While a column is moving, the page says so (the cursor), and text isn't selected.
  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('col-dragging');
    return () => document.body.classList.remove('col-dragging');
  }, [dragging]);

  /* ---------- a column's width: drag its heading's edge, or the arrow keys on that edge ---------- */
  // A column that sizes itself still says how wide it is.
  useLayoutEffect(() => {
    for (const h of headRef.current?.querySelectorAll<HTMLElement>('.col-resize') ?? []) {
      if (!h.hasAttribute('data-set')) h.setAttribute('aria-valuenow', String(Math.max(Number(h.getAttribute('aria-valuemin')), Math.round(h.closest('th')!.getBoundingClientRect().width))));
    }
  });
  const startResize = (e: React.PointerEvent<HTMLElement>, col: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const w0 = handle.closest('th')!.getBoundingClientRect().width, x0 = e.clientX;
    try { handle.setPointerCapture(e.pointerId); } catch { /* not every pointer can be captured */ }
    const move = (ev: PointerEvent) => setWidth(col, w0 + ev.clientX - x0);
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  const resizeKey = (e: React.KeyboardEvent<HTMLElement>, col: string) => {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setWidth(col, null); return; }
    const w = widthOf(col) ?? Math.round(e.currentTarget.closest('th')!.getBoundingClientRect().width);
    const step = e.shiftKey ? 64 : 16;
    const next = e.key === 'ArrowLeft' ? w - step : e.key === 'ArrowRight' ? w + step : e.key === 'Home' ? minWidth(tab, col) : e.key === 'End' ? MAX_WIDTH : null;
    if (next == null) return;
    e.preventDefault();
    setWidth(col, next);
  };

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
      setEdits(noEdits());
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

  const usual = !lay.cols && !Object.keys(lay.widths).length;
  const viewItems = [
    ...views.map((v) => ({ label: v.name + (v.pinned ? ' (pinned)' : ''), current: activeView?.id === v.id, onClick: () => openView(v) })),
    { label: 'Save this layout…', onClick: () => setSavingView(true) },
    ...(usual ? [] : [{ label: 'Back to the usual columns', onClick: () => setLay({ cols: null, widths: {} }) }]),
  ];

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
      <div className="filterbar-row data-tools" ref={toolsRef}>
        <label className="filter-search"><span className="sr">Search this table</span>
          <input className="input" type="search" placeholder={`Search ${TABLES[tab].label.toLowerCase()}`} value={q} onChange={(e) => { setView({ q: e.target.value }); setLimit(PAGE); }} />
        </label>
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setEditing({ index: null })}><Icon name="plus" />Filter</button>
        <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setChoosing(true)}>Columns · {cols.length} of {all.length + 1}</button>
        <MenuButton className="data-views" summary="" label={activeView ? `View: ${activeView.name}` : 'Views'} items={viewItems} />
        <MenuButton className="data-export" summary="" label="Export" items={[{ label: 'CSV, as shown', onClick: () => void exportAs('csv') }, { label: 'Excel (.xlsx), as shown', onClick: () => void exportAs('xlsx') }]} />
        <span className="small muted data-count" role="status">{shown.length === rows.length ? `${rows.length} rows` : `${shown.length} of ${rows.length} rows`}</span>
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
      {choosing && <ColumnsSheet tab={tab} order={order} always={always} all={all} onCols={(c) => setLay({ cols: c })} onClose={() => setChoosing(false)} />}
      {savingView && <SaveTableView tab={tab} layout={current} head={head} views={views} active={activeView} onClose={() => setSavingView(false)} />}
      {editing && <FilterEditor head={head.filter((c) => !TABLES[tab].hidden.includes(c))} kinds={kinds} values={(c) => [...new Set(rows.map((r) => r.cells[head.indexOf(c)] ?? '').filter((v) => v.trim()))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))}
        start={editing.index != null ? filters[editing.index] : undefined}
        onSave={(f) => { setView({ filters: editing.index != null ? filters.map((x, j) => (j === editing.index ? f : x)) : [...filters, f] }); setEditing(null); setLimit(PAGE); }}
        onClose={() => setEditing(null)} />}

      <div className={'table-wrap data-wrap' + (dragging ? ' dragging' : '')} ref={wrapRef}>
        {empty ? (
          <div className="data-empty" role="status">
            <span>No rows match.</span>
            <button type="button" className="linkish" onClick={() => setView({ q: '', filters: [] })}>Clear the search and filters</button>
          </div>
        ) : (
        <table className="dtable">
          <thead>
            <tr ref={headRef}>{cols.map(({ c }) => {
              const w = widthOf(c);
              const cls = [c === NAME[tab] ? 'dname' : ID_COLS.includes(c) ? 'did' : kinds[c] === 'number' ? 'num' : '', tab === 'plan' && /^Week \d+$/.test(c) ? 'wk' : '', ISO_TIME.test(rows[0]?.cells[head.indexOf(c)] ?? '') ? 'dtime' : '', w ? 'sized' : '', c !== NAME[tab] ? 'movable' : '', dragging === c ? 'moving' : ''];
              return (
                <th key={c} scope="col" data-col={c} style={sized(w)} className={cls.filter(Boolean).join(' ') || undefined}
                  title={c === 'ID' ? 'Each record’s own ID. It never changes.' : c === 'Key' ? 'The goal’s short key. It never changes.' : undefined} aria-sort={sort?.col === c ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {c !== NAME[tab] && <span className="col-grip" aria-hidden="true"><Icon name="grip" size={12} /></span>}
                  <button type="button" className="sortbtn" onPointerDown={(e) => startDrag(e, c)}
                    onClick={() => { if (dragged.current) return; setView({ sort: sort?.col === c ? (sort.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 } }); }}>
                    <span className="sortbtn-text">{c}</span><span className="sort-slot" aria-hidden="true">{sort?.col === c ? <Icon name={sort.dir === 1 ? 'arrow-up' : 'arrow-down'} size={12} /> : null}</span>
                  </button>
                  <span className="col-resize" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`Width of ${c}`}
                    aria-valuemin={minWidth(tab, c)} aria-valuemax={MAX_WIDTH} aria-valuenow={w} data-set={w ? '' : undefined} aria-valuetext={w ? `${w} pixels` : 'Automatic width'}
                    title="Drag to change the width, or use the arrow keys. Delete or a double click goes back to automatic."
                    onPointerDown={(e) => startResize(e, c)} onKeyDown={(e) => resizeKey(e, c)} onDoubleClick={() => setWidth(c, null)} />
                </th>
              );
            })}</tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((r) => (
              <tr key={r.key} title={r.locked}>
                {cols.map(({ c, i }) => {
                  const original = r.cells[i] ?? '';
                  const changed = edits[tab][r.key]?.[c];
                  const value = changed ?? original;
                  const label = `${c}, ${r.cells[head.indexOf(NAME[tab])] || r.key}${tab === 'checkIns' ? `, week ${r.cells[head.indexOf('Week')]}` : ''}`;
                  const w = widthOf(c);
                  const kind = (c === NAME[tab] ? ' dname' : ID_COLS.includes(c) ? ' did' : kinds[c] === 'number' ? ' num' : '') + (tab === 'plan' && /^Week \d+$/.test(c) ? ' wk' : '') + (w ? ' sized' : '');
                  if (!canEdit || r.locked || !EDITABLE[tab](c)) {
                    const status = tab === 'goals' && c === 'Status' ? STATUS_OF[value] : undefined;
                    const time = ISO_TIME.test(value);
                    return (
                      <td key={c} style={sized(w)} className={'dcell ro' + kind + (c === NAME[tab] ? ' strong' : '') + (time ? ' dtime' : '')} title={c === 'ID' ? 'IDs never change' : c === 'Key' ? 'Keys never change' : value.length > 20 || c === NAME[tab] || w ? value : undefined}>
                        {c === 'Goal' ? <Link className="linkish" to={'/goals/' + (tab === 'goals' || tab === 'plan' ? r.cells[head.indexOf('ID')] : r.cells[head.indexOf('Goal ID')])}>{value}</Link>
                          : status ? <Chip k={status} label={value} className="dstatus" />
                            : time ? <time dateTime={value}>{when(value)}</time>
                              : value}
                      </td>
                    );
                  }
                  const opts = options[c];
                  return (
                    <td key={c} style={sized(w)} className={'dcell' + kind + (changed != null ? ' edited' : '')} title={changed != null ? `Was: ${original || '(empty)'}` : undefined}>
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
            <button type="button" className="btn ghost" onClick={() => setEdits(noEdits())}>Discard</button>
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

/** Which columns a table shows and in what order. Move them up and down (with a keyboard, and on touch, as well as by
    dragging a heading on a computer), and tick the ones to show. The name column always comes first. */
function ColumnsSheet({ tab, order, always, all, onCols, onClose }: { tab: Tab; order: string[]; always: string[]; all: string[]; onCols: (c: string[] | null) => void; onClose: () => void }) {
  const [said, setSaid] = useState('');
  const rest = order.slice(1);
  const move = (c: string, by: number) => {
    const k = order.indexOf(c);
    const to = Math.max(1, Math.min(order.length - 1, k + by));
    if (to === k) return;
    onCols(moveColumn(order, c, to).slice(1));
    setSaid(`${c} moved to place ${to + 1} of ${order.length}.`);
  };
  return (
    <Sheet open onClose={onClose} title="Columns">
      <div className="stack col-chooser" style={{ gap: 'var(--s4)' }}>
        <span className="hint">Choose what this table shows and in what order; it stays this way in this browser. {always.join(' and ')} always show, and {NAME[tab].toLowerCase()} comes first. On a computer you can also drag a column’s heading to move it, and its edge to change its width.</span>
        <section className="col-order-wrap" aria-labelledby="col-order-h">
          <h3 className="label" id="col-order-h">Shown, in this order</h3>
          <ol className="col-order">
            <li className="col-order-row fixed"><span className="col-order-name">{order[0]}</span><span className="hint">Always first</span></li>
            {rest.map((c, k) => (
              <li key={c} className="col-order-row">
                <span className="col-order-name">{c}</span>
                <span className="col-order-moves">
                  <button type="button" className="iconbtn" aria-label={`Move ${c} up`} disabled={k === 0} onClick={() => move(c, -1)}><Icon name="chevron-up" /></button>
                  <button type="button" className="iconbtn" aria-label={`Move ${c} down`} disabled={k === rest.length - 1} onClick={() => move(c, 1)}><Icon name="chevron-down" /></button>
                </span>
              </li>
            ))}
          </ol>
          <span className="sr" role="status">{said}</span>
        </section>
        <div className="col-groups">{GROUPS[tab].map((g) => {
          const list = all.filter((c) => groupOf(tab, c) === g);
          if (!list.length) return null;
          return (
            <fieldset key={g || 'all'} className="col-group">
              <legend className={g ? 'label' : 'sr'}>{g || 'Columns'}</legend>
              <div className="col-checks">{list.map((c) => (
                <label key={c} className="check"><input type="checkbox" disabled={always.includes(c)} checked={order.includes(c)} onChange={(e) => {
                  onCols(e.target.checked ? [...rest, c] : rest.filter((x) => x !== c));
                }} /> {c}</label>
              ))}</div>
            </fieldset>
          );
        })}</div>
        <div className="sheet-foot">
          <span className="row" style={{ gap: 'var(--s3)' }}>
            <button type="button" className="linkish small" onClick={() => onCols(null)}>The usual columns</button>
            <button type="button" className="linkish small" onClick={() => onCols([...rest, ...all.filter((c) => !rest.includes(c))])}>Every column</button>
          </span>
          <button type="button" className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </Sheet>
  );
}

/** Save the table's layout under a name: a new table view, or over one of yours with the same name. */
function SaveTableView({ tab, layout, head, views, active, onClose }: { tab: Tab; layout: TableLayout; head: string[]; views: SavedView[]; active?: SavedView; onClose: () => void }) {
  const app = useApp();
  const mine = views.filter((v) => v.personId === app.viewer.id);
  const [name, setName] = useState(active && active.personId === app.viewer.id ? active.name : '');
  const [busy, setBusy] = useState(false);
  const same = mine.find((v) => v.name.trim().toLowerCase() === name.trim().toLowerCase());
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await app.saveTableView({ id: same?.id, name, layout }, head);
      app.toast(same ? `Saved over “${same.name}”` : `Saved “${name.trim()}”. It opens from Views.`);
      onClose();
    } catch { setBusy(false); }
  };
  const n = visibleColumns(tab, head, layout.cols).length;
  const set = Object.keys(layout.widths).length;
  const bits = [`${n} columns`, set ? `${set} ${set === 1 ? 'width' : 'widths'} set` : '', layout.filters.length ? `${layout.filters.length} ${layout.filters.length === 1 ? 'filter' : 'filters'}` : '', layout.q ? `the search “${layout.q}”` : '', layout.sort ? `sorted by ${layout.sort.col}` : ''].filter(Boolean);
  return (
    <Sheet open onClose={onClose} title={`Save this ${TABLES[tab].label.toLowerCase()} layout`}>
      <form className="stack save-table-view" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <span className="hint">Keeps the columns, their order and widths, and the search, filters and sort ({bits.join(', ')}). It opens from Views, on any computer you use.</span>
        <label className="field"><span className="field-label">Name</span>
          <input className="input" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Owners and gaps" />
        </label>
        {same && <span className="hint">You already have a view called “{same.name}”: this saves over it.</span>}
        {mine.length > 0 && (
          <div className="stack" style={{ gap: 'var(--s2)' }}>
            <span className="label">Your {TABLES[tab].label.toLowerCase()} views</span>
            <ul className="table-views">{mine.map((v) => (
              <li key={v.id}><span>{v.name}{v.pinned ? <span className="hint"> · pinned for everyone</span> : null}</span>
                <button type="button" className="linkish small" onClick={() => void app.deleteView(v.id).then(() => app.toast(`Deleted “${v.name}”`))}>Delete<span className="sr"> {v.name}</span></button></li>
            ))}</ul>
          </div>
        )}
        <div className="sheet-foot">
          <button type="button" className="linkish small" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim() || busy}>{same ? 'Save over it' : 'Save view'}</button>
        </div>
      </form>
    </Sheet>
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
