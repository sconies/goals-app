/* Search, filters and sort for the goals: one definition of what each means, used by the Goals screen in every layout,
   by exports, by saved views and shared links (as a query string), and by the AI assistant's find_goals. */
import { isLevel, levelName, levelRank } from './levels';
import { onAttentionList } from './attention';
import { RANK } from './status';
import { formatKey, normalKey } from './goalKey';
import { filterText, goalWords, textMatches, type FilterPart } from './find';
import { ATTENTION, ATTENTION_FLAGS, FLAG, LABEL, QUARTER, RESULT, WARNING, type FlagKind } from './vocabulary';
import type { GoalSummary } from './summary';
import type { Cycle, Goal, GoalKind, Level } from './types';
import { quarterOf } from './year';

export type QStatus = 'off' | 'risk' | 'stale' | 'on' | 'done' | 'planned' | 'none' | 'unmeasured';
/** A reason a goal needs attention (domain/attention.ts's flags), for "Needs attention because …"; or its path to green's date slipped. */
export type Need = Exclude<FlagKind, 'due'> | 'slipped';
export type Result = 'completed' | 'late' | 'missed' | 'open';
export type SortKey = 'worst' | 'title' | 'owner' | 'team' | 'level' | 'gap' | 'last' | 'due';

export interface GoalQuery {
  /** Words that must all appear in the goal's title, owner, team, level, reason, recovery plan or definition. */
  q: string;
  status: QStatus[];
  level: Level[];
  team: string[];
  /** Owners by id; `-me` (NOT_ME) means "not the person asking" (Home rule 4, HM3), said as "Owner: not you". */
  owner: string[];
  kind: GoalKind[];
  /** Only the goals on the Needs attention list (those being handled with them, grouped below): the same rule as Home, Watching, the map, reviews and the AI (domain/attention.ts). */
  attention: boolean;
  /** …and only because of one of these (empty: for any reason). */
  needs: Need[];
  /** Due by the end of this quarter, or by a given week. */
  due: 'quarter' | number | null;
  /** No update for at least this many weeks: the stale rule's days since the latest check-in was posted, in weeks. */
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
  /**
   * A module's filters (docs/design/architecture.md, 4.2): its parameter in the address and the value picked, compared
   * with the column the module fills for each goal (QueryContext.columns). Measured by a metric: `{ metric: <id> }`.
   */
  cols: Record<string, string>;
  /** This week's check-in (habit spec 1; HM7, HB2): `no`, due and not checked in yet; `asked`, checked in after an ask
      for an update. Only goals due this week match either. */
  checkedin?: 'no' | 'asked' | null;
  /** Only the goals a review walks (its id): the habit panel's links (HB2). An unknown review matches nothing. */
  inreview?: string | null;
  /** What changed since a day (Home rule 5, HM4): `worse`, `better`, `quiet`, `done` or `any`, as written. The rule, its
      words and which kinds it knows are changed.ts's, through the context (`moved`) and the names: so none of it is in
      Home's first download. A kind it doesn't know is no filter. */
  moved?: string | null;
  /** The day `moved` counts from (yyyy-mm-dd); left out: this week's Monday. */
  since?: string | null;
}

export const EMPTY_QUERY: GoalQuery = { q: '', status: [], level: [], team: [], owner: [], kind: [], attention: false, needs: [], due: null, quiet: null, quarter: null, result: [], feeds: null, helps: false, sort: null, dir: 1, cols: {}, checkedin: null, inreview: null, moved: null, since: null };

export const STATUS_OPTIONS: [QStatus, string][] = (['off', 'risk', 'stale', 'on', 'done', 'none', 'planned', 'unmeasured'] as const).map((k) => [k, LABEL[k]]);
/** "Needs attention because …": each flag that makes a goal need attention, in its vocabulary words. */
export const NEED_OPTIONS: [Need, string][] = [...ATTENTION_FLAGS.filter((k): k is Exclude<FlagKind, 'due'> => k !== 'due').map((k): [Need, string] => [k, FLAG[k].label]), ['slipped', WARNING.slipped.label]];
/** Links and saved views from before release 2 said these; they still open the same goals. */
const OLD_NEEDS: Record<string, Need | null> = { 'no-recovery': 'no-path', 'missed-date': 'missed-path' };
export const RESULT_OPTIONS: [Result, string][] = (['completed', 'late', 'missed', 'open'] as const).map((k) => [k, RESULT[k].label]);
export const KIND_OPTIONS: [GoalKind, string][] = [['metric', 'Move a number'], ['range', 'Keep in range'], ['milestone', 'Dated stages']];
export const SORT_OPTIONS: [SortKey, string][] = [['worst', 'Worst first'], ['title', 'Name'], ['owner', 'Owner'], ['team', 'Team'], ['level', 'Level'], ['gap', 'Furthest from plan'], ['last', 'Longest since a check-in'], ['due', 'Due soonest']];

/** The owner value that means "not mine": the goals someone else owns (Home's "need attention that aren’t yours"). */
export const NOT_ME = '-me';

const list = <T extends string>(v: string | null, ok: readonly T[]): T[] => (v ? v.split(',').filter((x): x is T => (ok as readonly string[]).includes(x)) : []);
const int = (v: string | null) => { const n = v == null ? NaN : Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

/**
 * The parameters modules' filters read (?metric=), added once as the build's modules load (src/core/app.tsx), so a
 * link, a saved view and the AI read them as the core's own. The domain names no module: it only keeps the list.
 */
const COLUMN_PARAMS: string[] = [];
export function addColumnParams(params: readonly string[]) {
  for (const k of params) if (!COLUMN_PARAMS.includes(k) && !QUERY_KEYS.includes(k)) { COLUMN_PARAMS.push(k); QUERY_KEYS.push(k); }
}

/** Read a query from a URL's search params (unknown or bad values are ignored, never an error). */
export function parseQuery(p: URLSearchParams): GoalQuery {
  const [sortKey, dir] = (p.get('sort') ?? '').split('.');
  const due = p.get('due');
  const qtr = p.get('qtr');
  return {
    q: (p.get('q') ?? '').slice(0, 200),
    status: list(p.get('status'), STATUS_OPTIONS.map(([k]) => k)),
    level: (p.get('level') ?? '').split(',').filter((l) => isLevel(null, l)),
    team: (p.get('team') ?? '').split(',').filter(Boolean),
    owner: (p.get('owner') ?? '').split(',').filter(Boolean),
    kind: list(p.get('kind'), KIND_OPTIONS.map(([k]) => k)),
    ...needsOf(p),
    due: due === 'quarter' ? 'quarter' : int(due),
    quiet: int(p.get('quiet')),
    quarter: qtr === 'met' || qtr === 'missed' ? qtr : null,
    result: list(p.get('result'), RESULT_OPTIONS.map(([k]) => k)),
    feeds: p.get('feeds') || null,
    helps: p.get('helps') === '1',
    sort: SORT_OPTIONS.some(([k]) => k === sortKey) ? (sortKey as SortKey) : null,
    dir: dir === 'desc' ? -1 : 1,
    cols: Object.fromEntries(COLUMN_PARAMS.map((k) => [k, (p.get(k) ?? '').slice(0, 200)]).filter(([, v]) => v)),
    checkedin: p.get('checkedin') === 'no' || p.get('checkedin') === 'asked' ? (p.get('checkedin') as 'no' | 'asked') : null,
    inreview: (p.get('inreview') ?? '').slice(0, 200) || null,
    moved: p.get('moved') || null,
    since: p.get('since') || null,
  };
}

/** Needs attention from a link: attention=1, needs=… (because), or a link from before release 2 (needs=slipped, …). */
function needsOf(p: URLSearchParams): Pick<GoalQuery, 'attention' | 'needs'> {
  const raw = (p.get('needs') ?? '').split(',').filter(Boolean);
  const needs = [...new Set(raw.map((v) => (v in OLD_NEEDS ? OLD_NEEDS[v] : (NEED_OPTIONS.some(([k]) => k === v) ? (v as Need) : undefined))).filter((v): v is Need => !!v))];
  return { attention: p.get('attention') === '1' || raw.some((v) => v in OLD_NEEDS || NEED_OPTIONS.some(([k]) => k === v)), needs };
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
  if (q.attention || q.needs.length) out.push(['attention', '1']);
  if (q.needs.length) out.push(['needs', q.needs.join(',')]);
  // After attention and before the rest (Home spec, section 1), so Home's links are the address Goals writes.
  if (q.moved) { out.push(['moved', q.moved]); if (q.since) out.push(['since', q.since]); }
  if (q.due != null) out.push(['due', String(q.due)]);
  if (q.quiet != null) out.push(['quiet', String(q.quiet)]);
  if (q.quarter) out.push(['qtr', q.quarter]);
  if (q.result.length) out.push(['result', q.result.join(',')]);
  if (q.feeds) out.push(['feeds', q.feeds]);
  if (q.helps) out.push(['helps', '1']);
  if (q.checkedin) out.push(['checkedin', q.checkedin]);
  if (q.inreview) out.push(['inreview', q.inreview]);
  for (const k of Object.keys(q.cols ?? {}).sort()) if (q.cols[k]) out.push([k, q.cols[k]!]);
  if (q.sort) out.push(['sort', q.sort + (q.dir === -1 ? '.desc' : '')]);
  return out;
}
/** Every parameter a goals query reads: the core's, then modules' (addColumnParams). */
export const QUERY_KEYS = ['q', 'status', 'level', 'team', 'owner', 'kind', 'attention', 'needs', 'moved', 'since', 'due', 'quiet', 'qtr', 'result', 'feeds', 'helps', 'checkedin', 'inreview', 'sort'];

/** Does the query narrow the goals at all? (Sorting alone doesn't.) */
export const filters = (q: GoalQuery) => queryEntries({ ...q, sort: null }).length > 0;

/** What a goal's place in the query needs to know beyond its summary. */
export interface QueryContext {
  goals: Goal[]; cycle: Cycle; week: number;
  /** Each module filter's column, by its parameter: the value it holds for a goal (a metric's id), or null. A filter whose column isn't here (its module is off) narrows nothing. */
  columns?: Record<string, (goal: Goal) => string | null>;
  /** A goal's standing this week (habit rule 1, `standing.ts`), null when it isn't due: what `checkedin=` reads. */
  standing?: (goal: Goal) => 'unasked' | 'asked' | 'after' | 'none' | null;
  /** The goals a review walks, by the review's id; null for no such review: what `inreview=` reads. Not here while Reviews is off: `inreview=` then narrows nothing, as a switched-off module's column doesn't (module map F4). */
  inReview?: (reviewId: string) => ReadonlySet<string> | null;
  /** Who is asking: what `owner=-me` leaves out. Without it, `-me` narrows nothing. */
  viewerId?: string;
  /** Does the goal pass `moved=<kind>&since=<day>` (Home rule 5, changed.ts `movedPasses`)? Without it, `moved=` matches nothing. */
  moved?: (goal: Goal, kind: string, since: string | null) => boolean;
}

/** The goal and every goal that feeds it, all the way down. */
export function treeOf(id: string, goals: Goal[]): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) { grew = false; for (const g of goals) if (g.parentId && out.has(g.parentId) && !out.has(g.id)) { out.add(g.id); grew = true; } }
  return out;
}

/** The goal key a search names, if the whole search is one: "G-48", "g48" or a bare "48" all name G-48. */
export function searchKey(text: string): string | null {
  const t = text.trim();
  return normalKey(t) ?? (/^\d{1,9}$/.test(t) ? formatKey(Number(t)) : null);
}

/** Does this goal pass every filter in the query? */
export function matches(s: GoalSummary, q: GoalQuery, ctx: QueryContext, tree?: Set<string> | null): boolean {
  const g = s.goal;
  // The words on the goal's row, each typed word the start of one, its key however it's typed (find rule 1): a key
  // finds only its own goal ("G-4" isn't G-48); a bare number finds its key and any text with it too.
  if (q.q.trim() && !textMatches(goalWords(s), q.q, g.key)) return false;
  if (q.status.length && !q.status.includes(s.status)) return false;
  if (q.level.length && !q.level.includes(g.level)) return false;
  if (q.team.length && !q.team.includes(g.teamId)) return false;
  // Any of the owners named; `-me`, anyone but the person asking (nobody asking: anyone).
  if (q.owner.length && !q.owner.some((o) => o === g.ownerId || (o === NOT_ME && g.ownerId !== ctx.viewerId))) return false;
  if (q.kind.length && !q.kind.includes(g.kind)) return false;
  for (const [k, v] of Object.entries(q.cols ?? {})) { const col = ctx.columns?.[k]; if (col && col(g) !== v) return false; }
  if (q.attention || q.needs.length) {
    // Needs attention lists the goals being handled too, below the others (Lane, 9 Nov): nothing is hidden.
    if (!onAttentionList(s.attention)) return false;
    if (q.needs.length && !q.needs.some((n) => (n === 'slipped' ? s.story.flags.includes('slipped') : s.attention.flags.some((f) => f.kind === n)))) return false;
  }
  if (q.due != null) {
    const by = q.due === 'quarter' ? quarterOf(ctx.cycle, Math.max(1, ctx.week)).to : q.due;
    if (s.dueWeek > by) return false;
  }
  // A done goal has nothing left to report, so it never counts as quiet (demo review, 8 Nov, item 6).
  if (q.quiet != null && (s.status === 'done' || s.quietDays < q.quiet * 7)) return false;
  if (q.checkedin) {
    const st = ctx.standing?.(g);
    if (q.checkedin === 'no' ? st !== 'none' : st !== 'asked') return false;
  }
  if (q.inreview && ctx.inReview && !ctx.inReview(q.inreview)?.has(g.id)) return false;
  if (q.moved && !ctx.moved?.(g, q.moved, q.since ?? null)) return false;
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

/** Order summaries by the query's sort (worst first when none is set). Ties go worst first, then by name. */
export function compare(q: GoalQuery, _week?: number): (a: GoalSummary, b: GoalSummary) => number {
  const key = q.sort ?? 'worst';
  const worst = (a: GoalSummary, b: GoalSummary) => RANK[b.status] - RANK[a.status];
  const name = (a: GoalSummary, b: GoalSummary) => a.goal.title.localeCompare(b.goal.title);
  const by: Record<SortKey, (a: GoalSummary, b: GoalSummary) => number> = {
    worst,
    title: name,
    owner: (a, b) => a.owner.localeCompare(b.owner),
    team: (a, b) => a.team.localeCompare(b.team),
    level: (a, b) => levelRank(null, a.goal.level) - levelRank(null, b.goal.level),
    gap: (a, b) => GAP_RANK[b.gapTone] - GAP_RANK[a.gapTone],
    last: (a, b) => b.quietDays - a.quietDays,
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

/** Names for what a query holds by id; `col` words a module filter's value ("Measured by", "Lead time"), null when no module that's on reads it. */
export interface QueryNames {
  team: (id: string) => string; person: (id: string) => string; goal: (id: string) => string;
  /** A review's name, for `inreview=`; left out while Reviews is off, when `inreview=` is no filter and has no words. */
  review?: (id: string) => string;
  col?: (param: string, value: string) => { label: string; value: string } | null;
  /** `moved=` as a filter part, "Changed since Fri 6 Nov: got worse" (changed.ts `movedPart`); null for a kind it doesn't know. */
  moved?: (q: GoalQuery) => FilterPart | null;
}

/** Each active filter in words, for the chips above the goals and a saved view's description. */
export function describeQuery(q: GoalQuery, names: QueryNames): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  const label = <T extends string>(opts: [T, string][], v: T) => opts.find(([k]) => k === v)?.[1] ?? v;
  if (q.q.trim()) out.push({ key: 'q', text: `“${q.q.trim()}”` });
  if (q.status.length) out.push({ key: 'status', text: q.status.map((s) => label(STATUS_OPTIONS, s)).join(' or ') });
  if (q.level.length) out.push({ key: 'level', text: q.level.map((l) => levelName(null, l)).join(' or ') });
  if (q.team.length) out.push({ key: 'team', text: q.team.map(names.team).join(' or ') });
  if (q.owner.length) out.push({ key: 'owner', text: 'Owned by ' + q.owner.map((o) => (o === NOT_ME ? 'someone else' : names.person(o))).join(' or ') });
  if (q.kind.length) out.push({ key: 'kind', text: q.kind.map((k) => label(KIND_OPTIONS, k)).join(' or ') });
  if (q.attention || q.needs.length) out.push({ key: 'needs', text: ATTENTION.needs.label + (q.needs.length ? ` because: ${q.needs.map((n) => label(NEED_OPTIONS, n).toLowerCase()).join(' or ')}` : '') });
  if (q.due != null) out.push({ key: 'due', text: q.due === 'quarter' ? 'Due this quarter' : `Due by week ${q.due}` });
  if (q.quiet != null) out.push({ key: 'quiet', text: `No update for ${q.quiet}+ ${q.quiet === 1 ? 'week' : 'weeks'}` });
  if (q.quarter) out.push({ key: 'qtr', text: `${QUARTER[q.quarter].label} last quarter` });
  if (q.result.length) out.push({ key: 'result', text: q.result.map((r) => label(RESULT_OPTIONS, r)).join(' or ') });
  if (q.feeds) out.push({ key: 'feeds', text: `In the tree of ${names.goal(q.feeds)}` });
  if (q.helps) out.push({ key: 'helps', text: 'With “also helps” links' });
  if (q.checkedin) out.push({ key: 'checkedin', text: q.checkedin === 'no' ? 'No check-in this week yet' : 'Checked in after an ask' });
  if (q.inreview && names.review) out.push({ key: 'inreview', text: `In ${names.review(q.inreview)}` });
  const mv = names.moved?.(q);
  if (mv) out.push({ key: 'moved', text: filterText(mv) });
  for (const [k, v] of Object.entries(q.cols ?? {})) { const c = names.col?.(k, v); if (c) out.push({ key: k, text: `${c.label} ${c.value}` }); }
  return out;
}

/**
 * The filters on, as find's rule 3 says them ("Team CI/CD · Status Off track or At risk"), each removable by its key.
 * A search is never a filter, and the Needs attention switch isn't one (the switch says it); its reasons are.
 */
export function queryParts(q: GoalQuery, names: QueryNames): FilterPart[] {
  const label = <T extends string>(opts: [T, string][], v: T) => opts.find(([k]) => k === v)?.[1] ?? v;
  const out: FilterPart[] = [];
  if (q.status.length) out.push({ key: 'status', label: 'Status', values: q.status.map((s) => label(STATUS_OPTIONS, s)) });
  if (q.level.length) out.push({ key: 'level', label: 'Level', values: q.level.map((l) => levelName(null, l)) });
  if (q.team.length) out.push({ key: 'team', label: 'Team', values: q.team.map(names.team) });
  if (q.owner.length) out.push({ key: 'owner', label: 'Owner', values: q.owner.map((o) => (o === NOT_ME ? 'not you' : names.person(o))) });
  if (q.kind.length) out.push({ key: 'kind', label: 'Kind', values: q.kind.map((k) => label(KIND_OPTIONS, k)) });
  if (q.needs.length) out.push({ key: 'needs', label: `${ATTENTION.needs.label} because`, values: q.needs.map((n) => label(NEED_OPTIONS, n).toLowerCase()) });
  if (q.due != null) out.push({ key: 'due', label: 'Due', values: [q.due === 'quarter' ? 'this quarter' : `by week ${q.due}`] });
  if (q.quiet != null) out.push({ key: 'quiet', label: 'No update for', values: [`${q.quiet}+ ${q.quiet === 1 ? 'week' : 'weeks'}`] });
  if (q.quarter) out.push({ key: 'qtr', label: 'Last quarter', values: [QUARTER[q.quarter].label] });
  if (q.result.length) out.push({ key: 'result', label: 'Result', values: q.result.map((r) => label(RESULT_OPTIONS, r)) });
  if (q.feeds) out.push({ key: 'feeds', label: 'In the tree of', values: [names.goal(q.feeds)] });
  if (q.helps) out.push({ key: 'helps', label: 'With', values: ['“also helps” links'] });
  if (q.checkedin) out.push({ key: 'checkedin', label: 'This week', values: [q.checkedin === 'no' ? 'no check-in yet' : 'checked in after an ask'] });
  if (q.inreview && names.review) out.push({ key: 'inreview', label: 'In', values: [names.review(q.inreview)] });
  // "Changed since Fri 6 Nov: got worse" (Home rule 5).
  const mv = names.moved?.(q);
  if (mv) out.push(mv);
  for (const [k, v] of Object.entries(q.cols ?? {})) { const c = names.col?.(k, v); if (c) out.push({ key: k, label: c.label, values: [c.value] }); }
  return out;
}

/** Remove one filter (by its describeQuery key). */
export function without(q: GoalQuery, key: string): GoalQuery {
  const map: Record<string, Partial<GoalQuery>> = { q: { q: '' }, status: { status: [] }, level: { level: [] }, team: { team: [] }, owner: { owner: [] }, kind: { kind: [] }, needs: { needs: [], attention: false }, due: { due: null }, quiet: { quiet: null }, qtr: { quarter: null }, result: { result: [] }, feeds: { feeds: null }, helps: { helps: false }, checkedin: { checkedin: null }, inreview: { inreview: null }, moved: { moved: null, since: null } };
  if (key in (q.cols ?? {})) { const { [key]: _, ...cols } = q.cols; return { ...q, cols }; }
  return { ...q, ...(map[key] ?? {}) };
}
