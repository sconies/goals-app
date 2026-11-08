/* Data: every person, goal, check-in and plan as a table. Everyone can look; admins type into cells across many rows,
   then Review changes shows the before and after and any problems, and Save applies them together. Saving goes
   through the bulk-change engine, so the same rules, rights and change log apply as for Import and the AI assistant.
   Each table's layout is the person's own: which columns, in what order (drag a heading, or move them in Columns) and
   how wide (drag a heading's edge, or use the arrow keys on it). It's remembered in this browser, can be saved as a
   named layout, and the table exports exactly as it shows (domain/tableLayout). Filters are in DataFilters; columns,
   widths and saved layouts in DataLayout. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { Place } from '../core/app';
import type { ChangeSet, Rec, Tables } from '../domain/changeset';
import { workbook, type Cell } from '../domain/export';
import { BOUND_WORDS, CAUSE_WORDS, isEditable, LEVEL_WORDS, RECOVERY_WORDS, SHAPE_WORDS } from '../domain/columns';
import { Chip, Sheet } from '../ui/bits';
import { LABEL } from '../domain/status';
import type { DisplayStatus, SavedView } from '../domain/types';
import { Preview } from '../ui/Preview';
import { MenuButton } from '../ui/MenuButton';
import { ColumnsSheet, readLocal, SaveLayoutSheet, useColumnMoves, writeLocal, type Local } from './DataLayout';
import { FilterEditor, shortFilter } from './DataFilters';
import {
  applyTable, columnKind, describeFilter, filterEntries, parseFilters, parseSort,
  type ColumnKind, type PropFilter, type TableSort,
} from '../domain/tableFilter';
import {
  choosableColumns, clampWidth, exportedTable, isTableView, layoutParams, MAX_WIDTH, minWidth, parseLayout, TABLE_ORDER, TABLES, visibleColumns,
  type DataTable, type TableLayout,
} from '../domain/tableLayout';
import { Icon } from '../ui/Icon';
import { LABEL as STATUS_WORD } from '../domain/vocabulary';

type Tab = DataTable;
const TABS: [Tab, string][] = TABLE_ORDER.map((t) => [t, TABLES[t].label]);
const PAGE = 100;

/** Columns people can change, as the one format says (domain/columns); everything else (keys, what the app works out)
    is shown but not editable. A goal's type is set when it's made. Asks are raised and answered in the app. */
const EDITABLE: Record<Tab, (col: string) => boolean> = {
  people: (c) => isEditable('people', c) || c === 'Email',
  goals: (c) => isEditable('goals', c) && c !== 'Type',
  checkIns: (c) => isEditable('checkIns', c),
  plan: (c) => isEditable('plan', c),
  requests: () => false,
};
const NAME = Object.fromEntries(TABLE_ORDER.map((t) => [t, TABLES[t].name])) as Record<Tab, string>;
/** IDs and keys: set quietly, in the ID face. */
const ID_COLS = ['ID', 'Key', 'Goal key', 'Goal keys', 'Email', 'Owner email', 'Posted by email', 'Feeds into key'];

const text = (v: Cell | undefined) => (v == null ? '' : String(v));
/** A goal's status word back to its status, so the cell can show the shape beside the word (the words come from the rules). */
const STATUS_OF = Object.fromEntries(Object.entries(LABEL).map(([k, v]) => [v, k])) as Record<string, DisplayStatus>;
/** A moment such as 2026-10-28T10:00:00.000Z, said the way people read it: 28 Oct 2026, 10:00. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const when = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
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

  /* ---------- saved layouts: named, kept with the person (or pinned for everyone) ---------- */
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

  /* ---------- the table as shown, for the modules' tools (the data.tools place: the spreadsheets module) ---------- */
  // As shown, with the columns that say which record each row is added at the end (greyed), so it loads back.
  const asShown = () => {
    const t = exportedTable(book.find((x) => x.name === TABLES[tab].sheet)!, current);
    return { rows: t.rows, muted: t.muted, scope: activeView?.name ?? '' };
  };

  // The Saved layouts and Spreadsheets menus open on whichever side of their button has room.
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
  const { headRef, dragging, dragged, startDrag, startResize, resizeKey } = useColumnMoves(tab, order, (cols) => setLay({ cols }), widthOf, setWidth);

  // Choices for the cells that have a fixed set of answers; the engine checks the rest.
  // The words come from the one format's columns (domain/columns), so what's chosen here reads back the same.
  const options: Record<string, string[]> = {
    Owner: app.snapshot.people.map((p) => p.name),
    'Owner email': app.snapshot.people.map((p) => p.email ?? '').filter(Boolean),
    Team: ['', ...app.snapshot.teams.map((t) => t.name)],
    Level: Object.values(LEVEL_WORDS.word),
    Plan: Object.values(SHAPE_WORDS.word),
    'Must stay': Object.values(BOUND_WORDS.word),
    Admin: ['', 'yes'],
    Call: ['', ...(['on', 'risk', 'off', 'done'] as const).map((k) => STATUS_WORD[k])],
    Cause: ['', ...new Set(Object.values(CAUSE_WORDS.word))],
    Recovery: ['', ...Object.values(RECOVERY_WORDS.word)],
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
        <MenuButton className="data-views" summary="" label={activeView ? `Saved layout: ${activeView.name}` : 'Saved layouts'} items={viewItems} />
        <Place name="data.tools" table={TABLES[tab].label} asShown={asShown} />
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
      {savingView && <SaveLayoutSheet tab={tab} layout={current} head={head} views={views} active={activeView} onClose={() => setSavingView(false)} />}
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
          <Preview cs={cs} name={`${total} ${total === 1 ? 'change' : 'changes'} in Data`} reason={reason} setReason={(v) => { setReason(v); review(v); }} busy={busy} onApply={() => void apply()} onAgain={() => setCs(null)} againLabel="Keep editing" fixHint="Fix those cells, then review again." />
        </Sheet>
      )}
    </div>
  );
}
