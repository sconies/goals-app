/* Data's columns: which a table shows and in what order, their widths (kept in this browser), moving and sizing them
   from the headings, and saving the whole arrangement as a named layout. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../app/state';
import { GOAL_DERIVED_COLUMNS } from '../domain/export';
import type { SavedView } from '../domain/types';
import { MAX_WIDTH, minWidth, moveColumn, TABLES, visibleColumns, type DataTable, type TableLayout } from '../domain/tableLayout';
import { Sheet } from '../ui/bits';
import { Icon } from '../ui/Icon';

/** This browser's layout of each table: columns in order and widths. (Saved layouts go with the person.) */
export type Local = { cols: string[] | null; widths: Record<string, number> };
const layoutKey = (t: DataTable) => `goals-data-layout:${t}`;
export const readLocal = (t: DataTable): Local => {
  try {
    const v = localStorage.getItem(layoutKey(t));
    if (v) { const o = JSON.parse(v) as Partial<Local>; return { cols: Array.isArray(o.cols) ? o.cols : null, widths: o.widths && typeof o.widths === 'object' ? o.widths : {} }; }
    // Before layouts: the columns someone chose.
    const old = localStorage.getItem(`goals-data-cols:${t}`);
    return { cols: old ? JSON.parse(old) as string[] : null, widths: {} };
  } catch { return { cols: null, widths: {} }; }
};
export const writeLocal = (t: DataTable, l: Local) => {
  try { if (!l.cols && !Object.keys(l.widths).length) localStorage.removeItem(layoutKey(t)); else localStorage.setItem(layoutKey(t), JSON.stringify(l)); } catch { /* storage blocked */ }
};

/** The column chooser's groups: a long list reads in parts. */
const PLAN_COLS = ['Unit', 'Decimals', 'Start', 'Target', 'Plan', 'Plan from week', 'Due week', 'Limit', 'Must stay', 'Margin', 'Stages'];
const GROUPS: Record<DataTable, string[]> = { goals: ['Details', 'Plan', 'This week', 'Quarters'], plan: ['Details', 'Weeks'], checkIns: [''], people: [''], requests: [''] };
const groupOf = (t: DataTable, c: string): string => {
  if (t === 'goals') return /^Q[1-4]$/.test(c) ? 'Quarters' : (GOAL_DERIVED_COLUMNS as readonly string[]).includes(c) ? 'This week' : PLAN_COLS.includes(c) ? 'Plan' : 'Details';
  if (t === 'plan') return /^Week \d+$/.test(c) ? 'Weeks' : 'Details';
  return '';
};
/**
 * Moving a column by dragging its heading (mouse or pen; on touch, Columns moves them), and setting a column's width by
 * dragging its heading's edge or with the arrow keys on that edge.
 */
export function useColumnMoves(tab: DataTable, order: string[], setCols: (cols: string[]) => void, widthOf: (c: string) => number | undefined, setWidth: (c: string, w: number | null) => void) {
  const headRef = useRef<HTMLTableRowElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragged = useRef(false);
  const startDrag = (e: React.PointerEvent, col: string) => {
    if (e.pointerType === 'touch' || e.button !== 0 || col === TABLES[tab].name) return;
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
          setCols(now.slice(1));
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

  return { headRef, dragging, dragged, startDrag, startResize, resizeKey };
}

/** Which columns a table shows and in what order. Move them up and down (with a keyboard, and on touch, as well as by
    dragging a heading on a computer), and tick the ones to show. The name column always comes first. */
export function ColumnsSheet({ tab, order, always, all, onCols, onClose }: { tab: DataTable; order: string[]; always: string[]; all: string[]; onCols: (c: string[] | null) => void; onClose: () => void }) {
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
        <span className="hint">Choose what this table shows and in what order; it stays this way in this browser. {always.join(' and ')} always show, and {TABLES[tab].name.toLowerCase()} comes first. On a computer you can also drag a column’s heading to move it, and its edge to change its width.</span>
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

/** Save the table's layout under a name: a new saved layout, or over one of yours with the same name. */
export function SaveLayoutSheet({ tab, layout, head, views, active, onClose }: { tab: DataTable; layout: TableLayout; head: string[]; views: SavedView[]; active?: SavedView; onClose: () => void }) {
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
      app.toast(same ? `Saved over “${same.name}”` : `Saved “${name.trim()}”. It opens from Saved layouts.`);
      onClose();
    } catch { setBusy(false); }
  };
  const n = visibleColumns(tab, head, layout.cols).length;
  const set = Object.keys(layout.widths).length;
  const bits = [`${n} columns`, set ? `${set} ${set === 1 ? 'width' : 'widths'} set` : '', layout.filters.length ? `${layout.filters.length} ${layout.filters.length === 1 ? 'filter' : 'filters'}` : '', layout.q ? `the search “${layout.q}”` : '', layout.sort ? `sorted by ${layout.sort.col}` : ''].filter(Boolean);
  return (
    <Sheet open onClose={onClose} title={`Save this ${TABLES[tab].label.toLowerCase()} layout`}>
      <form className="stack save-table-view" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <span className="hint">Keeps the columns, their order and widths, and the search, filters and sort ({bits.join(', ')}). It opens from Saved layouts, on any computer you use.</span>
        <label className="field"><span className="field-label">Name</span>
          <input className="input" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Owners and gaps" />
        </label>
        {same && <span className="hint">You already have a saved layout called “{same.name}”: this saves over it.</span>}
        {mine.length > 0 && (
          <div className="stack" style={{ gap: 'var(--s2)' }}>
            <span className="label">Your saved {TABLES[tab].label.toLowerCase()} layouts</span>
            <ul className="table-views">{mine.map((v) => (
              <li key={v.id}><span>{v.name}{v.pinned ? <span className="hint"> · pinned for everyone</span> : null}</span>
                <button type="button" className="linkish small" onClick={() => void app.deleteView(v.id)}>Delete<span className="sr"> {v.name}</span></button></li>
            ))}</ul>
          </div>
        )}
        <div className="sheet-foot">
          <button type="button" className="linkish small" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim() || busy}>{same ? 'Save over it' : 'Save layout'}</button>
        </div>
      </form>
    </Sheet>
  );
}
