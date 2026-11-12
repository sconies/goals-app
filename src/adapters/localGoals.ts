/* The query port (src/ports/goals.ts) over the workspace loaded in this browser: summary rows made by the pure rules
   (src/app/reads.ts goalRows: summariseAll), filtered and sorted by the Goals query (applyQuery), a page at a time.
   The internal app's adapter asks its server instead and changes no screen. */
import { applyQuery, type GoalQuery } from '../domain/query';
import { nearMiss, goalWords, type GoalRows } from '../domain/find';
import { goalsCounted } from '../domain/goalsPage';
import type { GoalSummary } from '../domain/summary';
import { PAGE_MAX, type GoalAsk, type GoalCounts, type GoalPage, type GoalRow, type Goals } from '../ports/goals';

const listRow = ({ checkIns: _c, series: _s, ...row }: GoalSummary): GoalRow => row;

/** `rows` is called on each read, so it may be lazy (made once per workspace as loaded). */
export function localGoals(rows: () => GoalRows): Goals {
  const among = (ask: Pick<GoalAsk, 'among'>) => {
    const r = rows();
    if (!ask.among) return r.summaries;
    const keep = new Set(ask.among);
    return r.summaries.filter((s) => keep.has(s.goal.id));
  };
  // The query's matches; a search that finds nothing tries its near miss (find rule 5), as Goals does.
  const matched = (ask: Pick<GoalAsk, 'query' | 'among'>): { list: GoalSummary[]; near?: string } => {
    const sums = among(ask), ctx = rows().ctx;
    const list = applyQuery(sums, ask.query, ctx);
    if (list.length || !ask.query.q.trim()) return { list };
    const fix = nearMiss(ask.query.q, sums.map(goalWords));
    const again = fix ? applyQuery(sums, { ...ask.query, q: fix } satisfies GoalQuery, ctx) : [];
    return again.length ? { list: again, near: fix! } : { list };
  };
  const goals = (ask: GoalAsk): GoalPage => {
    const size = Math.max(1, Math.min(ask.size ?? PAGE_MAX, PAGE_MAX));
    const { list, near } = matched(ask);
    // The key is the last row's goal id: the next page starts after it wherever it now stands, so a goal added or
    // changed elsewhere between pages doesn't shift the page. A key no longer in the list starts again from the top.
    const from = ask.after ? list.findIndex((s) => s.goal.id === ask.after) + 1 : 0;
    const page = list.slice(from, from + size);
    const more = from + size < list.length;
    return { rows: page.map(listRow), next: more ? page[page.length - 1]!.goal.id : null, total: list.length, ...(near ? { near } : {}) };
  };
  const counts = (ask: Pick<GoalAsk, 'query' | 'among'>): GoalCounts => {
    const { list } = matched(ask);
    return { total: list.length, ...goalsCounted(list, applyQuery(among(ask), { ...ask.query, attention: false, needs: [], sort: null }, rows().ctx)) };
  };
  return {
    now: { goals, counts },
    goals: async (ask) => goals(ask),
    counts: async (ask) => counts(ask),
    async goal(id) { return rows().summaries.find((s) => s.goal.id === id) ?? null; },
  };
}
