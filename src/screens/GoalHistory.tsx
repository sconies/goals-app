/* The History layout: each quarter's result against the plan, or the owner's call week by week. */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { planAt, weekDates } from '../domain/plan';
import { goalAsOf } from '../domain/goal';
import { fmt } from '../domain/format';
import { LABEL } from '../domain/status';
import { weeklyCalls, type GoalSummary } from '../domain/summary';
import { isYear, quarterOf, quarterResults, quarters } from '../domain/year';
import { QuarterMark, quarterWords } from '../ui/charts';
import { StatusShape, TitleTell } from '../ui/bits';
import { StatusLegend } from '../ui/StatusLegend';
import { useSummaries, GroupHead, type ViewGroup } from './GoalViews';
import { QUARTER } from '../domain/vocabulary';

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
  const qs = quarters(app.cycle);
  const setSpan = (v: Span) => setParam('weeks', v === now.n ? null : v === 'year' ? 'year' : 'q' + v);
  const weekly = show === 'weekly' || !year;
  return (
    <>
      {/* One place for the controls, one line saying what a mark means, then the key for this view. */}
      <div className="history-head">
        {year && (
          <div className="history-controls">
            <div className="seg" role="group" aria-label="Show">
              <button type="button" aria-pressed={show === 'results'} onClick={() => setParam('hist', null)}>Quarter results</button>
              <button type="button" aria-pressed={show === 'weekly'} onClick={() => setParam('hist', 'weekly')}>Weekly status</button>
            </div>
            {show === 'weekly' && (
              <div className="history-weeks">
                <span className="history-label" aria-hidden="true">Weeks</span>
                <div className="seg" role="group" aria-label="Weeks shown">
                  {qs.map((x) => <button key={x.n} type="button" aria-pressed={span === x.n} onClick={() => setSpan(x.n as Span)}>{x.label}</button>)}
                  <button type="button" aria-pressed={span === 'year'} onClick={() => setSpan('year')}>Whole year</button>
                </div>
              </div>
            )}
          </div>
        )}
        <p className="history-hint">
          {!weekly ? 'Each quarter: the number at its end against the owner’s plan.' : year ? 'Each mark is the owner’s call that week, not a quarter result.' : 'Each mark is the owner’s call that week.'}
          {weekly && <span className="key-hint"> Arrow keys move between weeks and goals.</span>}
        </p>
        {weekly
          ? (
            <StatusLegend kind="key" statuses={['on', 'risk', 'off', 'done']} className="hlegend" itemClass="hcell-key"
              extra={<li className="hcell-key"><span className="hcell-empty" aria-hidden="true" />No check-in</li>} />
          ) : (
            <div className="hlegend qlegend" aria-label="Key">
              <span className="hcell-key q-met"><QuarterMark kind="met" />{QUARTER.met.label}</span>
              <span className="hcell-key q-missed"><QuarterMark kind="missed" />{QUARTER.missed.label}</span>
              <span className="hcell-key q-open"><QuarterMark kind="open" done={0.5} />{QUARTER.open.label}</span>
              <span className="hcell-key q-none"><QuarterMark kind="none" />Nothing due</span>
            </div>
          )}
      </div>
      {!weekly
        ? <QuarterResults groups={groups} />
        : <WeeklyHistory groups={groups} span={year ? span : 'year'} />}
    </>
  );
}

/** How far through a quarter this week is, for the ring of a quarter in progress. */
const quarterDone = (q: { from: number; to: number }, week: number) => (week - q.from + 1) / (q.to - q.from + 1);

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
                        <th scope="row" className={'gt-goal' + (depth ? ' child' : '')} style={depth ? { paddingLeft: 12 + depth * 16 } : undefined}><Link to={'/goals/' + goal.id}>{goal.title}</Link> <TitleTell goal={goal} /></th>
                        {rs.map((r) => (
                          <td key={r.quarter.n} className={'qcell q-' + r.kind + (r.quarter.n === nowQ ? ' q-now' : '')}>
                            <span className="qcell-label">{r.quarter.label} {r.quarter.months}{r.quarter.n === nowQ ? ' · now' : ''}</span>
                            <span className="q-result"><QuarterMark kind={r.kind} done={r.quarter.n === nowQ ? quarterDone(r.quarter, app.week) : 0} />{r.kind === 'met' || r.kind === 'missed' ? QUARTER[r.kind].label : r.kind === 'open' ? (r.quarter.n === nowQ ? QUARTER.open.label : 'To come') : 'Nothing due'}</span>
                            {r.kind !== 'none' && <span className="hint qcell-text">{quarterWords(r.text, true)}</span>}
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

/** A table that scrolls sideways says so: a shadow on the goal column once scrolled, a fade at the edge until the end. */
const scrollEdges = (el: HTMLElement | null) => {
  if (!el) return;
  el.classList.toggle('scrolled', el.scrollLeft > 0);
  el.classList.toggle('at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
};
/** Keeps those cues right as the grid or the window changes size (a range of weeks, a rotated phone). */
const watchEdges = (el: HTMLElement | null) => {
  if (!el) return;
  scrollEdges(el);
  if (typeof ResizeObserver === 'undefined') return;
  const ro = new ResizeObserver(() => scrollEdges(el));
  ro.observe(el);
  if (el.firstElementChild) ro.observe(el.firstElementChild);
  return () => ro.disconnect();
};

function WeeklyHistory({ groups, span }: { groups: ViewGroup[]; span: Span }) {
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
    const v = s.goal.kind === 'milestone' ? `${(ci.stages ?? []).filter((u) => u.doneWeek != null).length} of ${s.goal.stages.length} stages` : ci.value == null ? '' : fmt(ci.value, s.goal);
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
  // In the whole year, the header names each quarter and, under it, every fourth week and this one.
  const numbered = (wk: number) => wk === app.week || (Math.abs(wk - app.week) > 1 && (wk === app.cycle.weeks || qs.some((x) => wk >= x.from && wk <= x.to && (wk - x.from) % 4 === 0 && x.to - wk >= 2)));
  const inspected = selGoal ? sums.get(selGoal) : undefined;
  return (
    <>
      {inspected && <WeekInspector s={inspected} week={selWeek} text={cellText(inspected, selWeek, weeklyCalls(inspected.checkIns))} />}
      {groups.map((g) => {
        if (!g.rows.length) return null;
        const rowIds = g.rows.map((r) => r.goal.id);
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={g.rows.length} />}
            <div className={'table-wrap hwrap' + (whole ? ' hwrap-year' : '')} style={{ '--weeks': weeks.length } as React.CSSProperties} ref={watchEdges} onScroll={(e) => scrollEdges(e.currentTarget)}>
              <table className={'hgrid' + (whole ? ' hgrid-year' : '')} role="grid" aria-label={`Weekly status, ${g.title}`}>
                <thead>
                  <tr>
                    <th scope="col" className="hg-goal">Goal</th>
                    {weeks.map((wk) => {
                      const qStart = qs.find((x) => x.from === wk);
                      return (
                        <th key={wk} scope="col" className={(wk === app.week ? 'now' : '') + (year && qStart ? ' q-start' : '') + (wk === selWeek ? ' sel' : '')} title={weekDates(app.cycle, wk)}>
                          {whole
                            ? <><span className="sr">Week {wk}</span><span className="hq" aria-hidden="true">{year ? qStart?.label ?? '' : ''}</span><span className="hn" aria-hidden="true">{numbered(wk) ? wk : ''}</span></>
                            : <><span className="sr">Week </span>{wk}</>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(({ goal, depth }) => {
                    const s = sums.get(goal.id)!;
                    const calls = weeklyCalls(s.checkIns);
                    return (
                      <tr key={goal.id} className={goal.id === selGoal ? 'sel-row' : undefined}>
                        <th scope="row" className={'hg-goal' + (depth ? ' child' : '')} style={depth ? ({ '--depth': depth } as React.CSSProperties) : undefined}><Link to={'/goals/' + goal.id} title={goal.title}>{goal.title}</Link> <TitleTell goal={goal} /></th>
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

/** The selected square, in words, on two lines: which week and when; then the goal, the owner's call, the number and the plan that week. */
function WeekInspector({ s, week, text }: { s: GoalSummary; week: number; text: string }) {
  const app = useApp();
  const ci = weeklyCalls(s.checkIns).get(week);
  const g = s.goal;
  const planThen = g.kind === 'metric' && week <= app.cycle.weeks ? fmt(planAt(goalAsOf(g, week).plan, week, app.cycle.weeks), g) : null;
  return (
    <div className="week-inspector" role="status" aria-live="polite" aria-label="Selected week">
      <span className="wi-week">Week {week} <span className="hint">· {weekDates(app.cycle, week)}{week === app.week ? ' · this week' : ''}</span></span>
      <span className="wi-line">
        <span className="wi-goal"><Link to={'/goals/' + g.id} title={g.title}>{g.title}</Link> <TitleTell goal={g} /></span>
        <span className="wi-call">{ci && <StatusShape k={ci.status} />}<span>{text}</span>{planThen && <span className="hint">· plan {planThen}</span>}</span>
      </span>
    </div>
  );
}
