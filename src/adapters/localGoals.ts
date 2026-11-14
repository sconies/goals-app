/* The query port (src/ports/goals.ts) over the workspace loaded in this browser: summary rows made by the pure rules
   (src/app/reads.ts goalRows: summariseAll), filtered and sorted by the Goals query (applyQuery), a page at a time.
   A scope is worked out for the person asking (`facts`: who they are, their teams, what they watch); with no sort the
   order is worst first, then by title (domain/query compare).
   The internal app's adapter asks its server instead and changes no screen. */
import { applyQuery, type GoalQuery, type QueryContext } from '../domain/query';
import { nearMiss, goalWords, type GoalRows } from '../domain/find';
import { goalsCounted, scopeIds, type ScopeFacts } from '../domain/goalsPage';
import type { GoalSummary } from '../domain/summary';
import { PAGE_MAX, type GoalAsk, type GoalCounts, type GoalPage, type GoalRow, type Goals } from '../ports/goals';

const listRow = ({ checkIns: _c, series: _s, ...row }: GoalSummary): GoalRow => row;

/** `rows` is called on each read, so it may be lazy (made once per workspace as loaded). */
export function localGoals(rows: () => GoalRows, facts?: () => ScopeFacts): Goals {
  const inScope = (ask: Pick<GoalAsk, 'scope'>) => {
    const r = rows();
    if (!ask.scope || ask.scope === 'all') return r.summaries;
    if (!facts) throw new Error('This port wasn’t told who is asking, so it can’t answer a scope.');
    const keep = new Set(scopeIds(facts(), ask.scope));
    return r.summaries.filter((s) => keep.has(s.goal.id));
  };
  // Who is asking, for `owner=-me` ("not mine", Home rule 4).
  const withViewer = (ctx: QueryContext): QueryContext => (facts ? { ...ctx, viewerId: facts().viewerId } : ctx);
  // The query's matches; a search that finds nothing tries its near miss (find rule 5), as Goals does.
  const matched = (ask: Pick<GoalAsk, 'query' | 'scope'>): { list: GoalSummary[]; near?: string } => {
    const sums = inScope(ask), ctx = withViewer(rows().ctx);
    // No sort is worst first, then by title: a rule a server can answer too, not the order goals are stored in.
    const query: GoalQuery = ask.query.sort ? ask.query : { ...ask.query, sort: 'worst', dir: 1 };
    const list = applyQuery(sums, query, ctx);
    if (list.length || !query.q.trim()) return { list };
    const fix = nearMiss(query.q, sums.map(goalWords));
    const again = fix ? applyQuery(sums, { ...query, q: fix } satisfies GoalQuery, ctx) : [];
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
  const counts = (ask: Pick<GoalAsk, 'query' | 'scope'>): GoalCounts => {
    const { list } = matched(ask);
    return { total: list.length, ...goalsCounted(list, applyQuery(inScope(ask), { ...ask.query, attention: false, needs: [], sort: null }, withViewer(rows().ctx))) };
  };
  return {
    now: { goals, counts },
    goals: async (ask) => goals(ask),
    counts: async (ask) => counts(ask),
    async goal(id) { return rows().summaries.find((s) => s.goal.id === id) ?? null; },
  };
}
