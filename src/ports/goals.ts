/* The query port's first cut (AX5; spec/rebuild/ports-at-scale.md, "The query port"): what Home and Goals read about
   goals, a page at a time, without reading the workspace themselves. `goals()` lists summary rows for a Goals query,
   `counts()` counts the same filter, and `goal()` gives one goal with its check-ins.

   - Faro's adapter (src/adapters/localGoals.ts) answers in the browser from the loaded workspace, by the pure rules in
     src/domain (summarise, applyQuery), as the Search port does. A server's adapter answers from summary rows.
   - Paging is by key: `after` is the `next` the last page gave, never a page number, so a goal added or changed between
     pages doesn't move the next page.
   - No page is larger than PAGE_MAX, and only `goal()` gives a goal's check-ins: list rows carry what the rules say about
     a goal now, never its history.
   - It is asynchronous: a server answers later. Faro's adapter can also answer at once (`now`), which the app uses so a
     screen doesn't draw empty first; a server's adapter leaves it out and the screen waits.
   - Both of its asks are server-shaped (#193's review): a scope is named ("mine", "team", "watching", "all", or
     "team:<id>") and answered for the person asking, never sent as a list of ids; and a list with no sort has a rule
     order, worst first and then by title, never the order goals happen to be stored in.
   Its contract: src/ports/contracts/goals.ts, whose cases are spec/conformance/goals.csv. */
import type { GoalQuery } from '../domain/query';
import type { GoalSummary } from '../domain/summary';
import type { DisplayStatus } from '../domain/types';
import type { ScopeName } from '../domain/goalsPage';

export type { GoalQuery, GoalSummary, ScopeName };

/** One live goal's summary row, as a list gives it: the rules' reading now, without its check-ins or its series. */
export type GoalRow = Omit<GoalSummary, 'checkIns' | 'series'>;

/** The largest page any read gives. */
export const PAGE_MAX = 50;

export interface GoalAsk {
  /** The Goals screen's filter and sort (src/domain/query.ts); EMPTY_QUERY for every goal. With no sort, worst first,
      then by title. */
  query: GoalQuery;
  /** Only a scope's goals, for the person asking: "mine", "team" (their team and the teams they lead), "watching",
      "team:<id>", or "all" (the same as leaving it out). */
  scope?: ScopeName | null;
  /** The next page starts after this key: the last page's `next`. */
  after?: string | null;
  /** Rows on a page, at most PAGE_MAX (the default). */
  size?: number;
}

export interface GoalPage {
  rows: GoalRow[];
  /** The key to ask the next page with, or null on the last. */
  next: string | null;
  /** How many goals the whole query matches. */
  total: number;
  /** When a search found nothing, the near miss it tried instead (find rule 5): the rows are that search's. */
  near?: string;
}

export interface GoalCounts {
  /** How many goals the query matches. */
  total: number;
  /** Of those, how many in each status. */
  status: Record<DisplayStatus, number>;
  /** How many need attention, counted with the query's own attention filter left off (the Goals switch's count). */
  attention: number;
}

export interface Goals {
  goals(ask: GoalAsk): Promise<GoalPage>;
  counts(ask: Pick<GoalAsk, 'query' | 'scope'>): Promise<GoalCounts>;
  /** One goal's summary with its check-ins; null for a goal that isn't live here. */
  goal(id: string): Promise<GoalSummary | null>;
  /** Faro's adapter answers at once as well; a server's doesn't. */
  readonly now?: { goals(ask: GoalAsk): GoalPage; counts(ask: Pick<GoalAsk, 'query' | 'scope'>): GoalCounts };
}

/** Every row a query matches, page by page: for a screen that lists them all, as Goals does today. */
export async function allGoals(port: Goals, ask: Omit<GoalAsk, 'after'>): Promise<GoalPage> {
  const first = await port.goals({ ...ask, after: null });
  const rows = [...first.rows];
  let next = first.next;
  while (next) { const p = await port.goals({ ...ask, after: next }); rows.push(...p.rows); next = p.next; }
  return { ...first, rows, next: null };
}

/** The same, from an adapter that answers at once. */
export function allGoalsNow(now: NonNullable<Goals['now']>, ask: Omit<GoalAsk, 'after'>): GoalPage {
  const first = now.goals({ ...ask, after: null });
  const rows = [...first.rows];
  let next = first.next;
  while (next) { const p = now.goals({ ...ask, after: next }); rows.push(...p.rows); next = p.next; }
  return { ...first, rows, next: null };
}
