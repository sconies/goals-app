/* Search, filters and sort for the goals: one definition of what each means, used by the Goals screen in every layout,
   by exports, by saved views and shared links (as a query string), and by the AI assistant's find_goals. */
import { LEVEL_LABEL } from './format';
import { LABEL, RANK } from './status';
import type { GoalSummary } from './summary';
import type { Cycle, Goal, GoalKind, Level } from './types';
import { quarterOf } from './year';

export type QStatus = 'off' | 'risk' | 'stale' | 'on' | 'done' | 'planned';
/** Needs attention: a decision or help asked for, no recovery plan, a recovery date that slipped or was missed, or a call greener than the numbers. */
export type Need = 'decision' | 'no-recovery' | 'slipped' | 'missed-date' | 'greener';
export type Result = 'completed' | 'late' | 'missed' | 'open';
export type SortKey = 'worst' | 'title' | 'owner' | 'team' | 'level' | 'gap' | 'last' | 'due';

export interface GoalQuery {
  /** Words that must all appear in the goal's title, owner, team, level, reason, recovery plan or definition. */
  q: string;
  status: QStatus[];
  level: Level[];
  team: string[];
  owner: string[];
  kind: GoalKind[];
  needs: Need[];
  /** Due by the end of this quarter, or by a given week. */
  due: 'quarter' | number | null;
  /** No check-in for at least this many weeks (or none at all). */
  quiet: number | null;
  /** How the last closed quarter went. */
  quarter: 'met' | 'missed' | null;
  result: Result[];
  /** Only this goal and the goals that feed it, all the way down. */
  feeds: string | null;
  /** Only goals with a dotted "also helps" line, to or from them. */
  helps: boolean;
  sort: SortKey | null;
  /** 1: the natural order for the key (worst first, A to Z, oldest check-in first, soonest due); -1 reverses it. */
  dir: 1 | -1;
}

export const EMPTY_QUERY: GoalQuery = { q: '', status: [], level: [], team: [], owner: [], kind: [], needs: [], due: null, quiet: null, quarter: null, result: [], feeds: null, helps: false, sort: null, dir: 1 };

export const STATUS_OPTIONS: [QStatus, string][] = [['off', LABEL.off], ['risk', LABEL.risk], ['stale', LABEL.stale], ['on', LABEL.on], ['done', LABEL.done], ['planned', 'Not started']];
export const NEED_OPTIONS: [Need, string][] = [['decision', 'Decision or help needed'], ['no-recovery', 'No recovery plan'], ['slipped', 'Recovery date slipped'], ['missed-date', 'Missed its own date'], ['greener', 'Called greener than the numbers']];
export const RESULT_OPTIONS: [Result, string][] = [['completed', 'Completed'], ['late', 'Completed late'], ['missed', 'Did not meet'], ['open', 'Not finished yet']];
export const KIND_OPTIONS: [GoalKind, string][] = [['metric', 'Move a number'], ['range', 'Keep in range'], ['milestone', 'Dated stages']];
export const SORT_OPTIONS: [SortKey, string][] = [['worst', 'Worst first'], ['title', 'Name'], ['owner', 'Owner'], ['team', 'Team'], ['level', 'Level'], ['gap', 'Furthest from plan'], ['last', 'Longest since a check-in'], ['due', 'Due soonest']];
export const LEVELS: Level[] = ['north-star', 'svp', 'team'];

const list = <T extends string>(v: string | null, ok: readonly T[]): T[] => (v ? v.split(',').filter((x): x is T => (ok as readonly string[]).includes(x)) : []);
const int = (v: string | null) => { const n = v == null ? NaN : Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

/** Read a query from a URL's search params (unknown or bad values are ignored, never an error). */
export function parseQuery(p: URLSearchParams): GoalQuery {
  const [sortKey, dir] = (p.get('sort') ?? '').split('.');
  const due = p.get('due');
  const qtr = p.get('qtr');
  return {
    q: (p.get('q') ?? '').slice(0, 200),
    status: list(p.get('status'), STATUS_OPTIONS.map(([k]) => k)),
    level: list(p.get('level'), LEVELS),
    team: (p.get('team') ?? '').split(',').filter(Boolean),
    owner: (p.get('owner') ?? '').split(',').filter(Boolean),
    kind: list(p.get('kind'), KIND_OPTIONS.map(([k]) => k)),
    needs: list(p.get('needs'), NEED_OPTIONS.map(([k]) => k)),
    due: due === 'quarter' ? 'quarter' : int(due),
    quiet: int(p.get('quiet')),
    quarter: qtr === 'met' || qtr === 'missed' ? qtr : null,
    result: list(p.get('result'), RESULT_OPTIONS.map(([k]) => k)),
    feeds: p.get('feeds') || null,
    helps: p.get('helps') === '1',
    sort: SORT_OPTIONS.some(([k]) => k === sortKey) ? (sortKey as SortKey) : null,
    dir: dir === 'desc' ? -1 : 1,
  };
}

/** The query as search params: only what differs from no filter, in a fixed order, so equal queries make equal links. */
export function queryEntries(q: GoalQuery): [string, string][] {
  const out: [string, string][] = [];
  if (q.q.trim()) out.push(['q', q.q.trim()]);
  if (q.status.length) out.push(['status', q.status.join(',')]);
  if (q.level.length) out.push(['level', q.level.join(',')]);
  if (q.team.length) out.push(['team', q.team.join(',')]);
  if (q.owner.length) out.push(['owner', q.owner.join(',')]);
  if (q.kind.length) out.push(['kind', q.kind.join(',')]);
  if (q.needs.length) out.push(['needs', q.needs.join(',')]);
  if (q.due != null) out.push(['due', String(q.due)]);
  if (q.quiet != null) out.push(['quiet', String(q.quiet)]);
  if (q.quarter) out.push(['qtr', q.quarter]);
  if (q.result.length) out.push(['result', q.result.join(',')]);
  if (q.feeds) out.push(['feeds', q.feeds]);
  if (q.helps) out.push(['helps', '1']);
  if (q.sort) out.push(['sort', q.sort + (q.dir === -1 ? '.desc' : '')]);
  return out;
}
export const QUERY_KEYS = ['q', 'status', 'level', 'team', 'owner', 'kind', 'needs', 'due', 'quiet', 'qtr', 'result', 'feeds', 'helps', 'sort'];

/** Does the query narrow the goals at all? (Sorting alone doesn't.) */
export const filters = (q: GoalQuery) => queryEntries({ ...q, sort: null }).length > 0;

/** What a goal's place in the query needs to know beyond its summary. */
export interface QueryContext { goals: Goal[]; cycle: Cycle; week: number }

/** The goal and every goal that feeds it, all the way down. */
export function treeOf(id: string, goals: Goal[]): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) { grew = false; for (const g of goals) if (g.parentId && out.has(g.parentId) && !out.has(g.id)) { out.add(g.id); grew = true; } }
  return out;
}

/** Does this goal pass every filter in the query? */
export function matches(s: GoalSummary, q: GoalQuery, ctx: QueryContext, tree?: Set<string> | null): boolean {
  const g = s.goal;
  if (q.q.trim()) {
    const hay = [g.title, s.owner, s.team, LEVEL_LABEL[g.level], s.story.why ?? '', s.story.doing ?? '', s.story.needs ?? '', g.definition, g.source].join(' ').toLowerCase();
    if (!q.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  const status: QStatus = s.status === 'none' ? 'planned' : s.status;
  if (q.status.length && !q.status.includes(status)) return false;
  if (q.level.length && !q.level.includes(g.level)) return false;
  if (q.team.length && !q.team.includes(g.teamId)) return false;
  if (q.owner.length && !q.owner.includes(g.ownerId)) return false;
  if (q.kind.length && !q.kind.includes(g.kind)) return false;
  if (q.needs.length) {
    const has = (n: Need) => (n === 'decision' ? !!s.story.needs && (s.status === 'off' || s.status === 'risk') : s.story.flags.includes(n));
    if (!q.needs.some(has)) return false;
  }
  if (q.due != null) {
    const by = q.due === 'quarter' ? quarterOf(ctx.cycle, Math.max(1, ctx.week)).to : q.due;
    if (s.dueWeek > by) return false;
  }
  if (q.quiet != null && s.lastWeek != null && ctx.week - s.lastWeek < q.quiet) return false;
  if (q.quarter) {
    const last = [...s.story.quarters].reverse().find((x) => x.kind === 'met' || x.kind === 'missed');
    if (last?.kind !== q.quarter) return false;
  }
  if (q.result.length && !q.result.includes(s.story.result?.kind ?? 'open')) return false;
  if (q.feeds && !(tree ?? treeOf(q.feeds, ctx.goals)).has(g.id)) return false;
  if (q.helps && !(g.alsoHelps?.length || ctx.goals.some((x) => x.alsoHelps?.includes(g.id)))) return false;
  return true;
}

const GAP_RANK = { off: 4, risk: 3, stale: 2, on: 1, ahead: 0 } as const;
const LEVEL_RANK: Record<Level, number> = { 'north-star': 0, svp: 1, team: 2 };

/** Order summaries by the query's sort (worst first when none is set). Ties go worst first, then by name. */
export function compare(q: GoalQuery, week: number): (a: GoalSummary, b: GoalSummary) => number {
  const key = q.sort ?? 'worst';
  const worst = (a: GoalSummary, b: GoalSummary) => RANK[b.status] - RANK[a.status];
  const name = (a: GoalSummary, b: GoalSummary) => a.goal.title.localeCompare(b.goal.title);
  const by: Record<SortKey, (a: GoalSummary, b: GoalSummary) => number> = {
    worst,
    title: name,
    owner: (a, b) => a.owner.localeCompare(b.owner),
    team: (a, b) => a.team.localeCompare(b.team),
    level: (a, b) => LEVEL_RANK[a.goal.level] - LEVEL_RANK[b.goal.level],
    gap: (a, b) => GAP_RANK[b.gapTone] - GAP_RANK[a.gapTone],
    last: (a, b) => (week - (b.lastWeek ?? -99)) - (week - (a.lastWeek ?? -99)),
    due: (a, b) => a.dueWeek - b.dueWeek,
  };
  return (a, b) => q.dir * by[key](a, b) || worst(a, b) || name(a, b);
}

/** The goals that pass the query, in its order. */
export function applyQuery(sums: GoalSummary[], q: GoalQuery, ctx: QueryContext): GoalSummary[] {
  const tree = q.feeds ? treeOf(q.feeds, ctx.goals) : null;
  const out = sums.filter((s) => matches(s, q, ctx, tree));
  return q.sort ? out.sort(compare(q, ctx.week)) : out;
}

/** Each active filter in words, for the chips above the goals and a saved view's description. */
export function describeQuery(q: GoalQuery, names: { team: (id: string) => string; person: (id: string) => string; goal: (id: string) => string }): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  const label = <T extends string>(opts: [T, string][], v: T) => opts.find(([k]) => k === v)?.[1] ?? v;
  if (q.q.trim()) out.push({ key: 'q', text: `“${q.q.trim()}”` });
  if (q.status.length) out.push({ key: 'status', text: q.status.map((s) => label(STATUS_OPTIONS, s)).join(' or ') });
  if (q.level.length) out.push({ key: 'level', text: q.level.map((l) => LEVEL_LABEL[l]).join(' or ') });
  if (q.team.length) out.push({ key: 'team', text: q.team.map(names.team).join(' or ') });
  if (q.owner.length) out.push({ key: 'owner', text: 'Owned by ' + q.owner.map(names.person).join(' or ') });
  if (q.kind.length) out.push({ key: 'kind', text: q.kind.map((k) => label(KIND_OPTIONS, k)).join(' or ') });
  if (q.needs.length) out.push({ key: 'needs', text: q.needs.map((n) => label(NEED_OPTIONS, n)).join(' or ') });
  if (q.due != null) out.push({ key: 'due', text: q.due === 'quarter' ? 'Due this quarter' : `Due by week ${q.due}` });
  if (q.quiet != null) out.push({ key: 'quiet', text: `No check-in for ${q.quiet}+ ${q.quiet === 1 ? 'week' : 'weeks'}` });
  if (q.quarter) out.push({ key: 'qtr', text: q.quarter === 'met' ? 'Met last quarter' : 'Missed last quarter' });
  if (q.result.length) out.push({ key: 'result', text: q.result.map((r) => label(RESULT_OPTIONS, r)).join(' or ') });
  if (q.feeds) out.push({ key: 'feeds', text: `In the tree of ${names.goal(q.feeds)}` });
  if (q.helps) out.push({ key: 'helps', text: 'With “also helps” links' });
  return out;
}

/** Remove one filter (by its describeQuery key). */
export function without(q: GoalQuery, key: string): GoalQuery {
  const map: Record<string, Partial<GoalQuery>> = { q: { q: '' }, status: { status: [] }, level: { level: [] }, team: { team: [] }, owner: { owner: [] }, kind: { kind: [] }, needs: { needs: [] }, due: { due: null }, quiet: { quiet: null }, qtr: { quarter: null }, result: { result: [] }, feeds: { feeds: null }, helps: { helps: false } };
  return { ...q, ...(map[key] ?? {}) };
}
