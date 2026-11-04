/* Other ways to see the same goals: a sortable table, a board by status, a week-by-week history grid and cards.
   The Goals tabs say which goals and how they're grouped; the layout says how they're drawn. Each person's
   choice is remembered, and it's in the address so a view can be shared. */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { planAt, weekDates } from '../domain/plan';
import { goalAsOf } from '../domain/goal';
import { fmt } from '../domain/format';
import { assessPosted, LABEL } from '../domain/status';
import { summarise, weeklyCalls, type GoalSummary } from '../domain/summary';
import { MEANING, RESULT_MEANING, RESULT_TEXT, SHORT_MEANING } from '../domain/story';
import { isYear, quarterOf, quarterResults, quarters } from '../domain/year';
import type { DisplayStatus, Goal } from '../domain/types';
import { Spark, StageSpark } from '../ui/charts';
import { useWidth } from '../ui/useWidth';
import { Chip, LevelTag, Sheet, StatusShape, WarnMark } from '../ui/bits';
import { describe, type ChangeSet } from '../domain/changeset';
import { LEVEL_LABEL } from '../domain/format';
import { LEVELS } from '../domain/query';
import type { Level } from '../domain/types';
import { ExportButton, ExportSheet } from './Export';
import { MenuButton, useGoalQuery } from './GoalFilters';
import { compare, type GoalQuery, type SortKey } from '../domain/query';
import { Icon } from '../ui/Icon';

export type Layout = 'list' | 'table' | 'board' | 'history' | 'cards' | 'map';
export const LAYOUTS: [Layout, string][] = [['list', 'List'], ['table', 'Table'], ['board', 'Board'], ['history', 'History'], ['cards', 'Cards'], ['map', 'Map']];
const KEY = 'goals-app-layout';
const isLayout = (v: string | null): v is Layout => !!v && LAYOUTS.some(([k]) => k === v);

/** The layout from the address, else this person's last choice, else the list. */
export function useLayout(): [Layout, (l: Layout) => void] {
  const [params, setParams] = useSearchParams();
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  const fromUrl = params.get('view');
  const layout: Layout = isLayout(fromUrl) ? fromUrl : isLayout(saved) ? saved : 'list';
  const set = (l: Layout) => {
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
    const next = new URLSearchParams(params);
    if (l === 'list') next.delete('view'); else next.set('view', l);
    setParams(next, { replace: true });
  };
  return [layout, set];
}

export function LayoutSwitch({ layout, onChange }: { layout: Layout; onChange: (l: Layout) => void }) {
  return (
    <div className="seg layout-switch" role="group" aria-label="Layout">
      {LAYOUTS.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={layout === k} aria-label={label} title={label} onClick={() => onChange(k)}>
          <LayoutIcon k={k} /><span className="ls-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

function LayoutIcon({ k }: { k: Layout }) {
  const p = { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true } as const;
  if (k === 'list') return <svg {...p}><path d="M3 4h10M3 8h10M3 12h10" /></svg>;
  if (k === 'table') return <svg {...p}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6.5h12M6 6.5V13" /></svg>;
  if (k === 'board') return <svg {...p}><rect x="2" y="3" width="3.5" height="10" rx="1" /><rect x="6.25" y="3" width="3.5" height="7" rx="1" /><rect x="10.5" y="3" width="3.5" height="5" rx="1" /></svg>;
  if (k === 'history') return <svg {...p}><path d="M2 4h2M6 4h2M10 4h2M2 8h2M6 8h2M10 8h4M2 12h2M6 12h4" strokeWidth="2.2" /></svg>;
  if (k === 'map') return <svg {...p}><rect x="6" y="1.5" width="4" height="3" rx="0.8" /><rect x="1.5" y="11.5" width="4" height="3" rx="0.8" /><rect x="10.5" y="11.5" width="4" height="3" rx="0.8" /><path d="M8 4.5v3.5M3.5 11.5V8h9v3.5" /></svg>;
  return <svg {...p}><rect x="2" y="2.5" width="5" height="5" rx="1" /><rect x="9" y="2.5" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>;
}

/** Goals to draw, in groups (a tree, a level, a team…). Depth indents goals inside a tree. */
export interface ViewGroup { key: string; title: string; hint?: string; rows: { goal: Goal; depth: number }[] }

function useSummaries(groups: ViewGroup[]) {
  const app = useApp();
  return useMemo(() => {
    const m = new Map<string, GoalSummary>();
    for (const g of groups) for (const r of g.rows) if (!m.has(r.goal.id)) m.set(r.goal.id, summarise(r.goal, app.snapshot, app.cycle, app.today, app.week));
    return m;
  }, [groups, app.snapshot, app.cycle, app.today, app.week]);
}

function GroupHead({ g, count }: { g: ViewGroup; count: number }) {
  return (
    <div className="stack" style={{ gap: 'var(--s1)' }}>
      <h2 className="block-title">{g.title} <span className="hint">· {count}</span></h2>
      {g.hint && <span className="hint">{g.hint}</span>}
    </div>
  );
}

/* ---------- table ---------- */

type ColId = 'goal' | 'owner' | 'status' | 'now' | 'target' | 'gap' | 'trend';
/**
 * The table's columns, and the Sort option each one sets (the table has no sort of its own: its headers, Sort in the
 * toolbar and Sort in Filters are one setting, which orders every layout). Now, Target and Trend mix units, so they
 * have no order of their own.
 */
const COLS: [ColId, SortKey | null, string, string][] = [
  ['goal', 'title', 'Goal', ''], ['owner', 'owner', 'Owner', 'col-opt'], ['status', 'worst', 'Status', ''], ['now', null, 'Now', 'num'], ['target', null, 'Target', 'num col-opt'], ['gap', 'gap', 'Gap', 'col-opt'], ['trend', null, 'Trend', 'col-opt'],
];
/**
 * The optional columns that fit beside a readable goal name (360px for Goal), in the order they give way. Their widths
 * are the ones in styles/finish/list-board.css; a column that doesn't fit is left out rather than squeezing the name.
 * Gap needs a table of 1180px or more, so its words stay on one line beside a full-width name.
 */
const BASE_W = 40 + 172 + 136, GOAL_MIN = 360, GAP_FROM = 1180;
const OPTIONAL: [ColId, number][] = [['target', 120], ['gap', 232], ['owner', 150], ['trend', 120]];
function shownCols(w: number): Set<ColId> {
  const out = new Set<ColId>(['goal', 'status', 'now']);
  let room = w - BASE_W - GOAL_MIN;
  for (const [c, cw] of OPTIONAL) { if (room < cw || (c === 'gap' && w < GAP_FROM)) break; out.add(c); room -= cw; }
  return out;
}

/** Text in which "week 43" and "week-43" never break inside; a line breaks at a space or after "·" instead. */
export function Keep({ text }: { text: string }) {
  const parts = text.split(/(week[- ]\d+)/);
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="nb">{p}</span> : p))}</>;
}

export function GoalTable({ groups }: { groups: ViewGroup[] }) {
  const app = useApp();
  const sums = useSummaries(groups);
  const [url, setQuery] = useGoalQuery();
  // A column's header sets the same Sort as the toolbar and Filters, so they always agree. Names can be reversed (as in
  // Sort); the others are on or off. The router applies the address as a low-priority update, so the table follows a
  // press at once from here and the address catches up.
  const [pressed, setPressed] = useState<Pick<GoalQuery, 'sort' | 'dir'> | null>(null);
  useEffect(() => { setPressed(null); }, [url.sort, url.dir]);
  const query = pressed ? { ...url, ...pressed } : url;
  const sortBy = (k: SortKey) => {
    const next = query.sort !== k ? { sort: k, dir: 1 as const } : k === 'title' && query.dir === 1 ? { sort: k, dir: -1 as const } : { sort: null, dir: 1 as const };
    setPressed(next);
    setQuery((cur) => ({ ...cur, ...next }));
  };
  const order = query.sort ? compare(query, app.week) : null;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (ids: string[], on: boolean) => setSel((s0) => { const n = new Set(s0); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const [box, width] = useWidth<HTMLDivElement>();
  const show = shownCols(width || 1400);
  const cols = COLS.filter(([c]) => show.has(c));
  return (
    <div ref={box} className="gtables">
      {groups.map((g) => {
        const rows = g.rows.map((r) => ({ ...r, s: sums.get(r.goal.id)! }));
        // Sorted, a group is a flat list in that order (the same order the Goals screen gives it once the address lands).
        if (order) { rows.sort((a, b) => order(a.s, b.s)); rows.forEach((r) => { r.depth = 0; }); }
        if (!rows.length) return null;
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={rows.length} />}
            <div className="table-wrap sticky-head">
              <table className="gtable">
                {/* One set of column widths for every group, so numbers line up from one tree to the next. */}
                <colgroup><col className="c-sel" />{cols.map(([c]) => <col key={c} className={'c-' + c} />)}</colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="selcol"><label className="selhit"><input type="checkbox" aria-label={`Select every goal in ${g.title}`} checked={rows.every((r) => sel.has(r.goal.id))} onChange={(e) => toggle(rows.map((r) => r.goal.id), e.target.checked)} /></label></th>
                    {cols.map(([, k, label, cls]) => {
                      const on = !!k && query.sort === k;
                      return (
                        <th key={label} scope="col" className={cls + (on ? ' sorted' : '')} aria-sort={on ? (query.dir === 1 ? 'ascending' : 'descending') : undefined}>
                          {k ? <button type="button" className="sortbtn" onClick={() => sortBy(k)}>{label}{on && <Icon name={query.dir === 1 ? 'chevron-down' : 'chevron-up'} size={12} className="sort-chev" />}</button> : label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ goal, depth, s }) => (
                    <Fragment key={goal.id}>
                    <tr data-tone={s.status} className={sel.has(goal.id) ? 'selected' : undefined}>
                      <td className="selcol"><label className="selhit"><input type="checkbox" aria-label={`Select ${goal.title}`} checked={sel.has(goal.id)} onChange={(e) => toggle([goal.id], e.target.checked)} /></label></td>
                      <td className="gt-goal" style={depth ? { paddingLeft: `calc(var(--s3) + ${depth * 16}px)` } : undefined}>
                        <span className="gt-name"><Link to={'/goals/' + goal.id}>{goal.title}</Link><LevelTag level={goal.level} /></span>
                      </td>
                      {show.has('owner') && <td className="col-opt">{s.owner}</td>}
                      <td><Chip k={s.status} /><ResultTag s={s} /><span className="hint gt-plan">{s.lastWeek != null ? <Keep text={`Last: week ${s.lastWeek}`} /> : app.week > 0 ? 'No check-in yet' : ''}</span></td>
                      <td className="num">{s.now}{s.planThen ? <span className="hint gt-plan"><Keep text={`plan ${s.planThen}`} /></span> : s.planNow != null && <span className="hint gt-plan">plan {s.planNowText} this week</span>}</td>
                      {show.has('target') && <td className="num col-opt">{s.target}</td>}
                      {show.has('gap') && <td className={'col-opt gt-gap tone-' + s.gapTone + ' small'} title={s.gap}>{s.gap}</td>}
                      {show.has('trend') && <td className="col-opt"><Trend s={s} /></td>}
                    </tr>
                    {hasStory(s) && <tr className={'story-row' + (sel.has(goal.id) ? ' selected' : '')} data-tone={s.status}><td /><td colSpan={cols.length}><TableStory s={s} /></td></tr>}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {sel.size > 0 && <BulkBar ids={[...sel]} onClear={() => setSel(new Set())} />}
    </div>
  );
}

function Trend({ s }: { s: GoalSummary }) {
  const app = useApp();
  const g = s.goal;
  if (g.kind === 'milestone') {
    const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
    return a.kind === 'milestone' ? <StageSpark a={a} width={72} /> : null;
  }
  return <Spark goal={g} weeks={app.cycle.weeks} series={s.series} />;
}

/* ---------- board ---------- */

const COLUMNS: { key: string; title: string; statuses: DisplayStatus[]; always: boolean }[] = [
  { key: 'off', title: 'Off track', statuses: ['off'], always: true },
  { key: 'risk', title: 'At risk', statuses: ['risk'], always: true },
  { key: 'stale', title: LABEL.stale, statuses: ['stale'], always: true },
  { key: 'waiting', title: 'No check-in yet', statuses: ['none', 'planned'], always: false },
  { key: 'on', title: 'On track', statuses: ['on'], always: true },
  { key: 'done', title: 'Done', statuses: ['done'], always: false },
];

export function GoalBoard({ groups }: { groups: ViewGroup[] }) {
  const sums = useSummaries(groups);
  const all = [...sums.values()];
  // Within a lane: the higher goals first (the north star leads), then those waiting on a decision, then by name.
  const order = (a: GoalSummary, b: GoalSummary) => LEVELS.indexOf(a.goal.level) - LEVELS.indexOf(b.goal.level) || Number(!!b.story.needs) - Number(!!a.story.needs) || a.goal.title.localeCompare(b.goal.title);
  // Filtered, an empty lane is noise: only the lanes with goals in them (round 3 and visual review 2).
  const app = useApp();
  const filtered = all.length < app.snapshot.goals.length;
  const cols = COLUMNS.map((c) => ({ ...c, items: all.filter((s) => c.statuses.includes(s.status)).sort(order) })).filter((c) => c.items.length || (c.always && !filtered));
  const [shown, setShown] = useState<Set<string>>(new Set());
  return (
    <div className="board">
      {cols.map((c) => {
        // Healthy lanes show a few cards and a count; the exceptions show everything.
        const healthy = c.key === 'on' || c.key === 'done';
        const items = healthy && !shown.has(c.key) ? c.items.slice(0, 3) : c.items;
        return (
        <section key={c.key} className="board-col" aria-label={`${c.title}, ${c.items.length}`}>
          <h2 className={'board-head tone-' + (c.key === 'waiting' ? 'stale' : c.key)}><StatusShape k={c.statuses[0]!} />{c.title}<span className="board-count tnum">{c.items.length}</span></h2>
          <span className="hint board-meaning">{SHORT_MEANING[c.statuses[0]!][0]!.toUpperCase() + SHORT_MEANING[c.statuses[0]!].slice(1)}</span>
          {c.items.length === 0 && <span className="hint board-empty">None</span>}
          {items.map((s) => (
            <Link key={s.goal.id} to={'/goals/' + s.goal.id} className="board-card" data-tone={s.status}>
              {/* The level on a short row of its own, right-aligned as on Cards; no row when the goal is a team goal. */}
              {s.goal.level !== 'team' && <span className="board-level"><LevelTag level={s.goal.level} /></span>}
              <span className="board-title">{s.goal.title}</span>
              <span className="hint ellipsis">{s.owner} · {s.team}</span>
              <ResultTag s={s} />
              {/* The same evidence on every card: the number and its gap, then the owner's account when there is one. */}
              <span className="small muted">{s.now} · <Keep text={s.gap} /></span>
              {hasStory(s) && <StoryLines s={s} compact brief />}
            </Link>
          ))}
          {healthy && c.items.length > 3 && (
            <button type="button" className="btn ghost sm board-more" aria-expanded={items.length === c.items.length}
              onClick={() => setShown((v) => { const n = new Set(v); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n; })}>
              {items.length < c.items.length ? `Show all ${c.items.length}` : 'Show fewer'}
            </button>
          )}
        </section>
        );
      })}
    </div>
  );
}

/* ---------- history: quarter results, and the weekly status behind them ---------- */

type Span = 'year' | 1 | 2 | 3 | 4;
/** History opens on each quarter's actual against plan; the owners' weekly calls are a named option (Senior UX review, finding 14). */
export function HistoryGrid({ groups }: { groups: ViewGroup[] }) {
  const app = useApp();
  const year = isYear(app.cycle);
  const [params, setParams] = useSearchParams();
  // Both choices are in the link, so a saved or shared History view comes back the same (round 3 review).
  const now = quarterOf(app.cycle, app.week);
  const read = (p: URLSearchParams) => {
    const w = p.get('weeks');
    return {
      show: (year && p.get('hist') !== 'weekly' ? 'results' : 'weekly') as 'results' | 'weekly',
      span: (w === 'year' ? 'year' : /^q[1-4]$/.test(w ?? '') ? Number(w!.slice(1)) : now.n) as Span,
    };
  };
  // The screen follows a press at once; the address follows too, but the router applies it as a low-priority update
  // that a busy render can hold back, so the choice is also kept here and re-read whenever the address changes.
  const fromUrl = read(params);
  const [shown, setShown] = useState(fromUrl);
  const key = fromUrl.show + ':' + fromUrl.span;
  useEffect(() => { setShown(read(params)); }, [key]);
  const { show, span } = shown;
  // Built on the address as it is now, so a change made a moment ago elsewhere on the page isn't lost.
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : params);
    if (v == null) p.delete(k); else p.set(k, v);
    setShown(read(p));
    setParams(p, { replace: true });
  };
  return (
    <>
      {year && (
        <div className="row between history-head" style={{ alignItems: 'center' }}>
          <div className="seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={show === 'results'} onClick={() => setParam('hist', null)}>Quarter results</button>
            <button type="button" aria-pressed={show === 'weekly'} onClick={() => setParam('hist', 'weekly')}>Weekly status</button>
          </div>
          <span className="hint">{show === 'results' ? 'Each quarter: the number at its end against the owner’s plan.' : 'Each square is the owner’s call that week, not a quarter result.'}</span>
        </div>
      )}
      {show === 'results'
        ? <QuarterResults groups={groups} />
        : <WeeklyHistory groups={groups} span={year ? span : 'year'} setSpan={(v) => setParam('weeks', v === now.n ? null : v === 'year' ? 'year' : 'q' + v)} />}
    </>
  );
}

function QuarterResults({ groups }: { groups: ViewGroup[] }) {
  const app = useApp();
  const qs = quarters(app.cycle);
  const nowQ = quarterOf(app.cycle, app.week).n;
  return (
    <>
      {groups.map((g) => {
        if (!g.rows.length) return null;
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={g.rows.length} />}
            <div className="table-wrap sticky-head">
              <table className="gtable qtable">
                <thead>
                  <tr>
                    <th scope="col">Goal</th>
                    {qs.map((q) => <th key={q.n} scope="col" className={q.n === nowQ ? 'now' : undefined}>{q.label} <span className="hint">{q.months}{q.n === nowQ ? ' · now' : ''}</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(({ goal, depth }) => {
                    const rs = quarterResults(goal, app.cycle, app.snapshot.checkIns, app.week);
                    return (
                      <tr key={goal.id}>
                        <th scope="row" className="gt-goal" style={depth ? { paddingLeft: `calc(var(--s3) + ${depth * 16}px)` } : undefined}><Link to={'/goals/' + goal.id}>{goal.title}</Link></th>
                        {rs.map((r) => (
                          <td key={r.quarter.n} className={'qcell q-' + r.kind}>
                            <span className="qcell-label">{r.quarter.label} {r.quarter.months}</span>
                            <span className="q-result">{r.kind === 'met' ? <><StatusShape k="on" />Met</> : r.kind === 'missed' ? <><StatusShape k="off" />Missed</> : r.kind === 'open' ? (r.quarter.n === nowQ ? 'In progress' : 'To come') : <span className="hint">Nothing due</span>}</span>
                            {r.kind !== 'none' && <span className="hint qcell-text">{r.text.replace(/^Q\d: /, '')}</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}

function WeeklyHistory({ groups, span, setSpan }: { groups: ViewGroup[]; span: Span; setSpan: (v: Span) => void }) {
  const app = useApp();
  const sums = useSummaries(groups);
  const year = isYear(app.cycle);
  const qs = quarters(app.cycle);
  const q = span === 'year' ? null : qs[span - 1]!;
  const weeks = q ? Array.from({ length: q.to - q.from + 1 }, (_, i) => q.from + i) : Array.from({ length: app.cycle.weeks }, (_, i) => i + 1);
  const whole = year && span === 'year';
  // The selected square: a goal and a week. Tap or click a square, or move with the arrow keys (one tab stop per grid).
  const firstGoal = groups.find((g) => g.rows.length)?.rows[0]?.goal.id ?? null;
  const [sel, setSel] = useState<{ goal: string | null; week: number }>({ goal: firstGoal, week: Math.max(1, Math.min(app.week, app.cycle.weeks)) });
  const selWeek = weeks.includes(sel.week) ? sel.week : (weeks.includes(app.week) ? app.week : weeks[0]!);
  const selGoal = sel.goal && groups.some((g) => g.rows.some((r) => r.goal.id === sel.goal)) ? sel.goal : firstGoal;
  const cellText = (s: GoalSummary, w: number, c: ReturnType<typeof weeklyCalls>) => {
    const ci = c.get(w);
    if (!ci) return w <= app.week ? 'No check-in' : 'Not yet';
    const v = s.goal.kind === 'milestone' ? `${(ci.stages ?? []).filter((u) => u.doneWeek != null).length} of ${s.goal.stages.length} stages` : ci.value == null ? '' : String(ci.value) + (s.goal.unit ? (s.goal.unit === '%' ? '%' : ' ' + s.goal.unit) : '');
    return `${LABEL[ci.status]}${v ? ', ' + v : ''}${ci.backfilled ? ' (loaded later)' : ''}`;
  };
  const move = (e: React.KeyboardEvent, rows: string[], goalId: string, wk: number) => {
    const i = rows.indexOf(goalId), j = weeks.indexOf(wk);
    const to = e.key === 'ArrowRight' ? [i, j + 1] : e.key === 'ArrowLeft' ? [i, j - 1] : e.key === 'ArrowDown' ? [i + 1, j] : e.key === 'ArrowUp' ? [i - 1, j] : e.key === 'Home' ? [i, 0] : e.key === 'End' ? [i, weeks.length - 1] : null;
    if (!to) return;
    e.preventDefault();
    const [r, c] = [Math.max(0, Math.min(rows.length - 1, to[0]!)), Math.max(0, Math.min(weeks.length - 1, to[1]!))];
    setSel({ goal: rows[r]!, week: weeks[c]! });
    const table = (e.currentTarget as HTMLElement).closest('table');
    requestAnimationFrame(() => table?.querySelector<HTMLElement>(`[data-cell="${rows[r]}:${weeks[c]}"]`)?.focus());
  };
  const inspected = selGoal ? sums.get(selGoal) : undefined;
  return (
    <>
      {/* One line above the grid: what a square means, its key, and the range. */}
      <div className="row between history-head" style={{ alignItems: 'center' }}>
        <div className="hlegend">
          {(['on', 'risk', 'off', 'done'] as const).map((k) => <span key={k} className={'hcell-key tone-' + k}><StatusShape k={k} />{LABEL[k]}</span>)}
          <span className="hcell-key"><span className="hcell-empty" aria-hidden="true" />No check-in</span>
        </div>
        {year && (
          <div className="seg" role="group" aria-label="Weeks shown">
            {qs.map((x) => <button key={x.n} type="button" aria-pressed={span === x.n} onClick={() => setSpan(x.n as Span)}>{x.label}</button>)}
            <button type="button" aria-pressed={span === 'year'} onClick={() => setSpan('year')}>Whole year</button>
          </div>
        )}
      </div>
      {inspected && <WeekInspector s={inspected} week={selWeek} text={cellText(inspected, selWeek, weeklyCalls(inspected.checkIns))} />}
      {groups.map((g) => {
        if (!g.rows.length) return null;
        const rowIds = g.rows.map((r) => r.goal.id);
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={g.rows.length} />}
            <div className="table-wrap">
              <table className={'hgrid' + (whole ? ' hgrid-year' : '')} role="grid" aria-label={`Weekly status, ${g.title}`}>
                <thead>
                  <tr>
                    <th scope="col" className="hg-goal">Goal</th>
                    {weeks.map((wk) => <th key={wk} scope="col" className={(wk === app.week ? 'now' : '') + (year && qs.some((x) => x.from === wk) ? ' q-start' : '') + (wk === selWeek ? ' sel' : '')} title={weekDates(app.cycle, wk)}><span className="sr">Week </span>{whole ? (qs.find((x) => x.from === wk)?.label ?? '') : wk}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(({ goal, depth }) => {
                    const s = sums.get(goal.id)!;
                    const calls = weeklyCalls(s.checkIns);
                    return (
                      <tr key={goal.id} className={goal.id === selGoal ? 'sel-row' : undefined}>
                        <th scope="row" className="hg-goal" style={depth ? { paddingLeft: 8 + depth * 12 } : undefined}><Link to={'/goals/' + goal.id}>{goal.title}</Link></th>
                        {weeks.map((wk) => {
                          const ci = calls.get(wk);
                          const text = cellText(s, wk, calls);
                          const on = goal.id === selGoal && wk === selWeek;
                          return (
                            <td key={wk} data-cell={`${goal.id}:${wk}`} tabIndex={on ? 0 : -1} aria-selected={on} onClick={() => setSel({ goal: goal.id, week: wk })} onFocus={() => !on && setSel({ goal: goal.id, week: wk })} onKeyDown={(e) => move(e, rowIds, goal.id, wk)}
                              className={'hcell' + (wk === app.week ? ' now' : '') + (wk > app.week ? ' future' : '') + (ci ? ' tone-' + ci.status : '') + (ci?.backfilled ? ' backfilled' : '') + (on ? ' sel' : '') + (wk === selWeek ? ' sel-col' : '')} title={`Week ${wk}: ${text}`}>
                              {ci ? <StatusShape k={ci.status} /> : wk <= app.week ? <span className="hcell-empty" aria-hidden="true" /> : null}
                              <span className="sr">{goal.title}, week {wk}: {text}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}

/** The selected square, in words: which week and when, the owner's call, the number and the plan that week. */
function WeekInspector({ s, week, text }: { s: GoalSummary; week: number; text: string }) {
  const app = useApp();
  const ci = weeklyCalls(s.checkIns).get(week);
  const g = s.goal;
  const planThen = g.kind === 'metric' && week <= app.cycle.weeks ? fmt(planAt(goalAsOf(g, week).plan, week, app.cycle.weeks), g) : null;
  return (
    <div className="week-inspector" role="status" aria-live="polite" aria-label="Selected week">
      <span className="strong">Week {week} <span className="hint">· {weekDates(app.cycle, week)}{week === app.week ? ' · this week' : ''}</span></span>
      <span className="wi-goal ellipsis"><Link to={'/goals/' + g.id}>{g.title}</Link></span>
      <span className="row" style={{ gap: 6 }}>{ci && <StatusShape k={ci.status} />}<span>{text}</span>{planThen && <span className="hint">· plan {planThen}</span>}</span>
      <span className="hint">Arrow keys move between weeks and goals.</span>
    </div>
  );
}

/* ---------- cards ---------- */

export function GoalCards({ groups }: { groups: ViewGroup[] }) {
  const sums = useSummaries(groups);
  return (
    <>
      {groups.map((g) => {
        if (!g.rows.length) return null;
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={g.rows.length} />}
            <div className="gcards">
              {g.rows.map(({ goal }) => {
                const s = sums.get(goal.id)!;
                return (
                  <Link key={goal.id} to={'/goals/' + goal.id} className="gcard" data-tone={s.status}>
                    <span className="row between nowrap"><Chip k={s.status} /><LevelTag level={goal.level} /></span>
                    <span className="gcard-title">{goal.title}</span>
                    {/* The number straight under the title, in the same place on every card, so cards compare (visual review 2). */}
                    <span className="gcard-figure"><span className="gcard-now">{s.now}</span><span className="small"><Keep text={`target ${s.target}`} /> · <span className={'tone-' + s.gapTone}><Keep text={s.gap} /></span></span></span>
                    <span className="hint"><Keep text={`${s.owner} · ${s.team}${s.story.since && s.status !== 'stale' ? ` · ${s.story.since.toLowerCase()}` : ''}`} /></span>
                    <ResultTag s={s} />
                    {hasStory(s) ? <StoryLines s={s} brief /> : <span className="small">{s.story.where}</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ---------- bulk actions on the selected goals ---------- */

function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const app = useApp();
  const [sheet, setSheet] = useState<'owner' | 'level' | 'export' | null>(null);
  const goals = ids.map((id) => app.goal(id)).filter((g): g is Goal => !!g);
  const watch = async () => {
    for (const g of goals) await app.watch('goal', g.id);
    app.toast(`Watching ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`);
  };
  return (
    <div className="selbar" role="region" aria-label="Selected goals">
      <span className="strong selbar-count">{goals.length} selected</span>
      {/* Wide enough, each action is a button; on a phone they share one Actions menu, so the bar stays one row. */}
      <span className="selbar-actions">
        <button type="button" className="btn sm" onClick={() => setSheet('owner')}>Change owner</button>
        <button type="button" className="btn sm" onClick={() => setSheet('level')}>Change level</button>
        <button type="button" className="btn sm" onClick={() => void watch()}>Watch</button>
        <ExportButton goals={goals} viewName="Selected" />
      </span>
      <MenuButton className="selbar-menu" label="Actions" summary="" items={[
        { label: 'Change owner', onClick: () => setSheet('owner') },
        { label: 'Change level', onClick: () => setSheet('level') },
        { label: 'Watch', onClick: () => void watch() },
        { label: 'Export', onClick: () => setSheet('export') },
      ]} />
      <button type="button" className="btn ghost sm" onClick={onClear}>Clear</button>
      {(sheet === 'owner' || sheet === 'level') && <BulkSheet kind={sheet} goals={goals} onClose={() => setSheet(null)} onDone={onClear} />}
      {sheet === 'export' && <ExportSheet goals={goals} viewName="Selected" onClose={() => setSheet(null)} />}
    </div>
  );
}

function BulkSheet({ kind, goals, onClose, onDone }: { kind: 'owner' | 'level'; goals: Goal[]; onClose: () => void; onDone: () => void }) {
  const app = useApp();
  const [value, setValue] = useState('');
  const [cs, setCs] = useState<ChangeSet | null>(null);
  const [busy, setBusy] = useState(false);
  const levels: Level[] = ['north-star', 'svp', 'team'];
  const save = async () => {
    if (!value) return;
    const res = app.previewChanges({ goals: goals.map((g, i) => ({ __row: String(i + 2), id: g.id, ...(kind === 'owner' ? { owner: app.person(value)?.name ?? '' } : { level: value === 'north-star' ? 'north star' : value }) })) }, 'bulk');
    setCs(res);
    if (!res.commit) return;
    setBusy(true);
    try {
      await app.applyChanges(res);
      app.toast(`Saved: ${describe(res).toLowerCase()}`);
      onDone();
      onClose();
    } catch { setBusy(false); }
  };
  const errors = cs?.issues.filter((x) => x.severity === 'error') ?? [];
  return (
    <Sheet open onClose={onClose} title={`${kind === 'owner' ? 'Change the owner of' : 'Change the level of'} ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="field"><span className="field-label">{kind === 'owner' ? 'New owner' : 'Level'}</span>
          <select className="input" value={value} onChange={(e) => { setValue(e.target.value); setCs(null); }}>
            <option value="">Choose…</option>
            {kind === 'owner' ? app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) : levels.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </label>
        <span className="hint">{app.viewer.admin ? 'As an admin you can change any goal.' : 'You can change the goals you own. Leave others out of the selection.'} Each change is logged on its goal.</span>
        {errors.length > 0 && (
          <ul className="issue-list" role="alert">{errors.map((x, i) => <li key={i}><span className="label">{x.goal}</span><span>{x.message}</span></li>)}</ul>
        )}
        {cs && !cs.items.length && !errors.length && <span className="hint" role="status">Nothing changes: they already have that {kind}.</span>}
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={!value || busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Sheet>
  );
}

/* ---------- the story, the legend and results ---------- */

const hasStory = (s: GoalSummary) => ['off', 'risk', 'stale'].includes(s.status) || s.story.warnings.length > 0;

/** Why it's off, what the owner will do, by when, what they need, and any warnings. */
/**
 * A goal's story where it's listed. Full: why, the recovery plan, by when, what's needed, and every warning.
 * Brief (board and cards, where goals sit side by side): why in two lines, by when, and the first warning with a count
 * of the rest. The goal's page always has the whole story.
 */
export function StoryLines({ s, compact, brief }: { s: GoalSummary; compact?: boolean; brief?: boolean }) {
  const st = s.story;
  const full: [string, string][] = s.status === 'stale'
    ? [['Last heard', st.since ?? '']]
    : ['off', 'risk'].includes(s.status)
      ? [['Why', st.why ?? 'Not given'], ['Recovery plan', st.doing ?? 'Not given'], ['Owner’s date', st.byWhen?.replace(/^Owner’s date: b/, 'B') ?? 'No date given'], ...(st.needs ? [['Needs', st.needs] as [string, string]] : [])]
      : [];
  const rows = brief ? full.filter(([k]) => k === 'Why' || k === 'Owner’s date' || k === 'Last heard') : full;
  const warnings = brief ? st.warnings.slice(0, 1) : st.warnings;
  const more = st.warnings.length - warnings.length;
  return (
    <div className={'story' + (compact ? ' compact' : '') + (brief ? ' brief' : '')}>
      {/* Brief, a clamped line keeps the whole of it as a tooltip. */}
      {rows.length > 0 && <dl>{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd className={v === 'Not given' || v === 'No date given' ? 'tone-off' : undefined} title={brief && k === 'Why' ? v : undefined}><Keep text={v} /></dd></Fragment>)}</dl>}
      {warnings.map((w) => <span key={w} className="story-warn"><WarnMark />{w}</span>)}
      {more > 0 && <span className="hint">and {more} more {more === 1 ? 'warning' : 'warnings'} on the goal</span>}
    </div>
  );
}

/**
 * The story in a table: one line (what's needed, why, by when, how many warnings), so rows stay comparable,
 * with Details to open the whole story in place (Senior UX review, 2 Nov).
 */
function TableStory({ s }: { s: GoalSummary }) {
  const [open, setOpen] = useState(false);
  const st = s.story;
  const n = st.warnings.length;
  const parts = s.status === 'stale'
    ? [st.since ?? 'No check-in for two weeks or more']
    : [
      ...(st.needs ? ['Decision or help needed'] : []),
      ...(['off', 'risk'].includes(s.status) ? [st.why ? `Why: ${st.why}` : 'No reason given', st.byWhen ?? 'No date given'] : []),
    ];
  if (n) parts.push(`${n} ${n === 1 ? 'warning' : 'warnings'}`);
  return (
    <div className="table-story">
      {open ? <StoryLines s={s} compact /> : <span className="table-story-line small" title={parts.join(' · ')}>{parts.join(' · ')}</span>}
      <button type="button" className="linkish small table-story-toggle" aria-expanded={open} aria-label={`${open ? 'Less' : 'Details'}: the story of ${s.goal.title}`} onClick={() => setOpen((v) => !v)}>{open ? 'Less' : 'Details'}</button>
    </div>
  );
}

export function ResultTag({ s }: { s: GoalSummary }) {
  const r = s.story.result;
  if (!r) return null;
  return <span className={'result-tag result-' + r.kind} title={RESULT_MEANING[r.kind]}>{RESULT_TEXT[r.kind]}{r.kind === 'missed' ? ` · due week ${r.dueWeek}` : r.kind === 'late' ? ` · week ${r.week}, due ${r.dueWeek}` : ''}</span>;
}

/** What each status means, always in view where goals are listed. */
export function StatusLegend() {
  return (
    <details className="legend">
      <summary>
        {(['on', 'risk', 'off', 'stale'] as const).map((k) => <span key={k} className={'legend-key tone-' + k}><StatusShape k={k} /><span className="strong">{LABEL[k]}</span><span className="muted">{SHORT_MEANING[k]}</span></span>)}
        <span className="linkish small legend-more">What these mean</span>
      </summary>
      <dl className="legend-full">
        {(['on', 'risk', 'off', 'stale'] as const).map((k) => <Fragment key={k}><dt className={'tone-' + k}>{LABEL[k]}</dt><dd>{MEANING[k]}</dd></Fragment>)}
        {(['completed', 'late', 'missed'] as const).map((k) => <Fragment key={k}><dt><span className={'result-tag result-' + k}>{RESULT_TEXT[k]}</span></dt><dd>{RESULT_MEANING[k]}</dd></Fragment>)}
        <dt>The call</dt><dd>The status is the owner’s call each week, checked against the numbers. A call greener than the numbers needs a reason, and is flagged.</dd>
      </dl>
    </details>
  );
}
