/* Other ways to see the same goals: a sortable table, a board by status and a week-by-week history grid. (Cards went
   on 9 Nov, Lane: it showed less than the list and added nothing; a link or saved view naming it opens the list.)
   The Goals tabs say which goals and how they're grouped; the layout says how they're drawn. Each person's
   choice is remembered, and it's in the address so a view can be shared. This file holds what every layout shares
   (the choice of layout, the groups, each goal's summary); each layout has a file of its own: GoalTable, GoalBoard,
   and GoalHistory, with the bulk actions in BulkEdit and a goal's story in ui/GoalStory. */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useLatestParams } from './GoalFilters';
import { useApp } from '../app/state';
import { summarise, type GoalSummary } from '../domain/summary';
import type { Goal } from '../domain/types';
import { MenuButton } from '../ui/MenuButton';

export type Layout = 'list' | 'table' | 'board' | 'history' | 'map';
export const LAYOUTS: [Layout, string][] = [['list', 'List'], ['table', 'Table'], ['board', 'Board'], ['history', 'History'], ['map', 'Map']];
/** Each layout in one line, said in the Layout menu and the phone's View sheet (backlog N, 8 Nov). */
export const LAYOUT_ABOUT: Record<Layout, string> = {
  list: 'rows, grouped as Group says.',
  table: 'a row per goal; sort any column.',
  board: 'a column for each status.',
  history: 'each goal’s status, week by week.',
  map: 'how the goals feed each other.',
};
const KEY = 'goals-app-layout';
const isLayout = (v: string | null): v is Layout => !!v && LAYOUTS.some(([k]) => k === v);

/** The layouts a workspace has: the Map only while the Goal map is on (SW1; src/app/reads.ts goalMapOn). */
export const layoutsOn = (map: boolean): [Layout, string][] => (map ? LAYOUTS : LAYOUTS.filter(([k]) => k !== 'map'));
/** What Goals says once when a link, saved view or remembered choice asked for the Map while the Goal map is off. */
export const MAP_OFF_NOTE = 'The Goal map is off here, so this is the List.';

/** The layout that went (Lane, 9 Nov): a link, saved view or remembered choice naming it opens the list. */
export const GONE_LAYOUT = 'cards';
export const GONE_LAYOUT_NOTE = 'Cards has gone, so these goals are in List, which shows everything Cards did.';

/** Whether this person's remembered layout was Cards; if so it is forgotten, so the list says so only once. */
export function forgetGoneLayout(): boolean {
  try {
    if (localStorage.getItem(KEY) !== GONE_LAYOUT) return false;
    localStorage.setItem(KEY, 'list');
    return true;
  } catch { return false; }
}

/** The layout from the address, else this person's last choice, else the list. */
export function useLayout(map = true): [Layout, (l: Layout) => void] {
  const [params, setParams] = useSearchParams();
  const latest = useLatestParams();
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  const fromUrl = params.get('view');
  // With the Goal map off (SW1), a Map asked for opens the List (Goals says so once, MAP_OFF_NOTE).
  const known = (v: string | null): v is Layout => isLayout(v) && (map || v !== 'map');
  const layout: Layout = known(fromUrl) ? fromUrl : known(saved) ? saved : 'list';
  // Each layout is a step Back can return to (outside review, 9 Nov): a new history entry, never a replaced one. The
  // list is the address without a layout, unless the layout came from this person's last choice: then the address
  // says view=list, so the step is a real change of address and Back after it shows the layout it left.
  const set = (l: Layout) => {
    if (l === layout) return;
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
    const next = latest(), was = next.get('view');
    if (l !== 'list') next.set('view', l);
    else if (isLayout(was) && was !== 'list') next.delete('view');
    else next.set('view', 'list');
    setParams(next);
  };
  return [layout, set];
}

/**
 * The layouts are one choice on every width (goals spec, 2.1, item 3.6; GL2): the button says the open layout, and the
 * menu says what each one is. On a phone it is the View sheet's first group instead.
 */
export function LayoutMenu({ layout, onChange, layouts = LAYOUTS }: { layout: Layout; onChange: (l: Layout) => void; layouts?: [Layout, string][] }) {
  return (
    <MenuButton className="layout-menu" label="Layout" summary="" markCurrent display={`Layout: ${layoutName(layout)}`}
      items={layouts.map(([k, label]) => ({ label, hint: layoutLine(k), icon: <LayoutIcon k={k} />, current: k === layout, onClick: () => onChange(k) }))} />
  );
}

/** A layout's name, and its line as a sentence ("Rows, grouped as Group says."). */
export const layoutName = (l: Layout) => LAYOUTS.find(([k]) => k === l)?.[1] ?? 'List';
export const layoutLine = (l: Layout) => LAYOUT_ABOUT[l].replace(/^./, (c) => c.toUpperCase());

export function LayoutIcon({ k }: { k: Layout }) {
  const p = { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true } as const;
  if (k === 'list') return <svg {...p}><path d="M3 4h10M3 8h10M3 12h10" /></svg>;
  if (k === 'table') return <svg {...p}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6.5h12M6 6.5V13" /></svg>;
  if (k === 'board') return <svg {...p}><rect x="2" y="3" width="3.5" height="10" rx="1" /><rect x="6.25" y="3" width="3.5" height="7" rx="1" /><rect x="10.5" y="3" width="3.5" height="5" rx="1" /></svg>;
  if (k === 'history') return <svg {...p}><path d="M2 4h2M6 4h2M10 4h2M2 8h2M6 8h2M10 8h4M2 12h2M6 12h4" strokeWidth="2.2" /></svg>;
  return <svg {...p}><rect x="6" y="1.5" width="4" height="3" rx="0.8" /><rect x="1.5" y="11.5" width="4" height="3" rx="0.8" /><rect x="10.5" y="11.5" width="4" height="3" rx="0.8" /><path d="M8 4.5v3.5M3.5 11.5V8h9v3.5" /></svg>;
}

/** Goals to draw, in groups (a tree, a level, a team…). Depth indents goals inside a tree. */
export interface ViewGroup { key: string; title: string; hint?: string; rows: { goal: Goal; depth: number }[] }

export function useSummaries(groups: ViewGroup[]) {
  const app = useApp();
  return useMemo(() => {
    const m = new Map<string, GoalSummary>();
    for (const g of groups) for (const r of g.rows) if (!m.has(r.goal.id)) m.set(r.goal.id, summarise(r.goal, app.snapshot, app.cycle, app.today, app.week));
    return m;
  }, [groups, app.snapshot, app.cycle, app.today, app.week]);
}

export function GroupHead({ g, count }: { g: ViewGroup; count: number }) {
  return (
    <div className="stack" style={{ gap: 'var(--s1)' }}>
      <h2 className="block-title">{g.title} <span className="hint">· {count}</span></h2>
      {g.hint && <span className="hint">{g.hint}</span>}
    </div>
  );
}
