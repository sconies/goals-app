/* The Table layout: one row per goal, its columns giving way as the table narrows, sorted from the headers, with a
   one-line story under each goal that needs one and the bulk actions for the goals ticked. */
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../app/state';
import { assessPosted } from '../domain/status';
import { type GoalSummary } from '../domain/summary';
import { compare, type GoalQuery, type SortKey } from '../domain/query';
import { Spark, StageSpark } from '../ui/charts';
import { useWidth } from '../ui/useWidth';
import { Chip, LevelTag } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { hasStory, Keep, ResultTag, TableStory } from '../ui/GoalStory';
import { BulkBar } from './BulkEdit';
import { useGoalQuery } from './GoalFilters';
import { useSummaries, GroupHead, type ViewGroup } from './GoalViews';
import { LABEL } from '../domain/vocabulary';

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
                        <span className="gt-name"><Link to={'/goals/' + goal.id}>{goal.title}</Link><LevelTag level={goal.level} />{goal.key && <span className="gkey" title="The goal’s key">{goal.key}</span>}</span>
                      </td>
                      {show.has('owner') && <td className="col-opt">{s.owner}</td>}
                      <td><Chip k={s.status} /><ResultTag s={s} /><span className="hint gt-plan">{s.lastWeek != null ? <Keep text={`Last: week ${s.lastWeek}`} /> : app.week > 0 ? LABEL.none : ''}</span></td>
                      <td className="num">{s.now}{s.planThen ? <span className="hint gt-plan"><Keep text={`plan ${s.planThen}`} /></span> : s.planNow != null && <span className="hint gt-plan">plan {s.planNowText} this week</span>}</td>
                      {show.has('target') && <td className="num col-opt">{s.target}</td>}
                      {show.has('gap') && <td className={'col-opt gt-gap tone-' + s.gapTone + ' small'} title={s.gap}>{s.gap !== s.now ? s.gap : ''}</td>}
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
