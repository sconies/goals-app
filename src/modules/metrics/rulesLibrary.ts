/* The metric library as a place (ML1, docs/design/metrics/spec.md section 4): finding metrics (rule 1), a metric's goals
   side by side (rule 2) and what a metric needs (rule 3), with the words the library and a metric's page say and where
   the old addresses lead. The screens (Metrics.tsx), the AI tools (tools.ts) and the conformance rows
   (spec/conformance/metrics.csv) all call these, so they can't disagree.

   Pure, as src/domain is: each takes only the rows it reads (the metrics, the links, the cycle's live goal ids, the
   people), never the whole workspace, and no clock (`now` is given). Statuses, "now", targets and the gap to plan come
   from the core's goal summary (domain/summary, domain/scorecard), never worked out again here. */
import { fold, textMatches } from '../../domain/find';
import { placesText } from '../../domain/numbers';
import { byWeekWords } from '../../domain/scorecard';
import { RANK } from '../../domain/status';
import type { GoalSummary } from '../../domain/summary';
import type { Cycle, DisplayStatus, Person, Team } from '../../domain/types';
import { COMPANY, ownerName } from './rules';
import { directionWords } from './names';
/* Rule 4's names and the words for a direction live in names.ts (light enough for the first save): passed on here. */
export { closeNames, directionWords, nameWords } from './names';
import type { Metric, MetricDirection, MetricLink } from './types';

const DAY = 86_400_000;

/** How many metrics the library lists a page. */
export const LIBRARY_PAGE = 50;
/** How long a new metric may go unused before "No goal uses it" (rule 3). */
export const UNUSED_GRACE_DAYS = 14;

/* ---------- words ---------- */

/** "lower is better", as a row and a search read it. */
/** Decimals in words (spec 2.2): "whole numbers", "to 1 decimal place", "to 2 decimal places". */
export const decimalsWords = (d: number) => (d === 0 ? 'whole numbers' : `to ${placesText(d)}`);

/** A metric's part of an address: its id without "metric_" (the demo's are slugs, "lead-time"); any other id as it is. */
export const metricSlug = (id: string) => id.replace(/^metric_/, '');
/** The metric an address names: by its slug, or its whole id. Removed ones too: the page says it was removed. */
export const metricAt = (metrics: readonly Metric[], part: string): Metric | undefined => {
  // The router gives the part decoded already; an address typed by hand may still be encoded ("100%25" or "100%").
  let p = part;
  try { p = decodeURIComponent(part); } catch { /* a bare % stays as it is */ }
  return metrics.find((m) => m.id === p) ?? metrics.find((m) => m.id === `metric_${p}`);
};
/** A metric's page. */
export const metricPath = (m: Pick<Metric, 'id'>) => `/metrics/${encodeURIComponent(metricSlug(m.id))}`;

/** What the rules read of a workspace for the library: plain rows. */
export interface LibraryReads {
  /** Every metric, removed ones included (the rules leave them out). */
  metrics: readonly Metric[];
  /** Every goal's link, unlinked ones included. */
  links: readonly MetricLink[];
  /** The running cycle's live goals (not stopped): a link counts only while its goal is one of them. */
  goalIds: ReadonlySet<string>;
  /** People, to name owners and know who has left. */
  people: readonly Pick<Person, 'id' | 'name' | 'leftAt'>[];
  /** Now, as an ISO timestamp: when "No goal uses it" starts to count. */
  now: string;
}

/** A metric's links in force: not unlinked, to a live goal in the running cycle. */
export const liveLinks = (r: Pick<LibraryReads, 'links' | 'goalIds'>, metricId: string) => r.links.filter((l) => l.metricId === metricId && !l.removedAt && r.goalIds.has(l.goalId));
/** The units the library's metrics use, A to Z: the "Unit" filter's short list. */
export const unitsInUse = (metrics: readonly Metric[]) => [...new Set(metrics.filter((m) => !m.removedAt).map((m) => m.unit))].sort((a, b) => fold(a).localeCompare(fold(b)));
/** The owner's name, or null when none is set or they have left. */
export { ownerName } from './rules';

/* ---------- rule 3: what a metric needs ---------- */

export type NeedId = 'no-owner' | 'no-meaning' | 'no-source' | 'unused';
export interface MetricNeed { id: NeedId; sentence: string; button: string; to: string }

/**
 * Rule 3. What a metric still needs, in this order: an owner (unset, or they have left), a meaning, a source, and a goal
 * that uses it (once it was added more than 14 days ago). Each with the sentence the page and the library say, and one
 * button that opens the form at that field, or Goals in its unit.
 */
export function metricNeeds(m: Metric, r: Omit<LibraryReads, 'metrics'>): MetricNeed[] {
  const out: MetricNeed[] = [];
  const edit = (field: string) => `${metricPath(m)}/edit?field=${field}`;
  const owner = r.people.find((p) => p.id === m.ownerId);
  if (!owner || owner.leftAt) out.push({ id: 'no-owner', sentence: owner ? 'Its owner has left' : 'It has no owner', button: 'Choose an owner', to: edit('owner') });
  if (!m.meaning.trim()) out.push({ id: 'no-meaning', sentence: 'No meaning yet', button: 'Say what it means', to: edit('meaning') });
  if (!m.source.trim()) out.push({ id: 'no-source', sentence: 'No source named', button: 'Say where the number comes from', to: edit('source') });
  const old = Date.parse(r.now) - Date.parse(m.createdAt) > UNUSED_GRACE_DAYS * DAY;
  if (old && !liveLinks(r, m.id).length) out.push({ id: 'unused', sentence: 'No goal uses it', button: `See goals in ${m.unit}`, to: `/goals?scope=all&q=${encodeURIComponent(m.unit)}` });
  return out;
}

/** The first need in a row's words: "No meaning yet", or "No meaning yet, and 1 more". */
export const needsLine = (needs: readonly MetricNeed[]) => (!needs.length ? '' : needs.length === 1 ? needs[0]!.sentence : `${needs[0]!.sentence}, and ${needs.length - 1} more`);

/* ---------- rule 1: finding metrics ---------- */

export type LibrarySort = 'name' | 'goals' | 'changed';
export const LIBRARY_SORTS: [LibrarySort, string][] = [['name', 'A to Z'], ['goals', 'Most goals first'], ['changed', 'Changed lately']];

/** What someone asks the library for: the address's `?q=`, `?unit=`, `?team=`, `?owner=`, `?dir=`, `?unused=1`, `?sortout=1`, `?sort=`, `?page=`. */
export interface LibraryAsk {
  q?: string;
  unit?: string;
  /** A team's id: metrics a goal measures for that team; `company`: for the whole company. */
  teamId?: string;
  ownerId?: string;
  dir?: MetricDirection;
  unused?: boolean;
  sortout?: boolean;
  /** Retired metrics only (MT3); by default they are left out. */
  retired?: boolean;
  sort?: LibrarySort;
  page?: number;
  size?: number;
}

/** One metric as the library lists it: the metric, its owner's name (null: none, or left), the goals it measures now, and what it needs. */
export interface LibraryRow { metric: Metric; owner: string | null; goalIds: string[]; needs: MetricNeed[] }
export interface LibraryPage { total: number; page: number; pages: number; from: number; to: number; rows: LibraryRow[] }

/**
 * Rule 1. The metrics that match, a page at a time. Removed metrics are never listed. A search matches the name, the
 * unit, "lower is better" or "higher is better", the owner's name, the meaning and the source, word by word as every
 * list does (find rule 1). A team keeps the metrics a live goal is measured by for it ("company": for the whole
 * company); "unused" those no live goal uses; "sort out" those rule 3 says need something (for anyone: it's the same
 * filter for everyone). Sorted A to Z ignoring case and accents, by most goals first, or by the latest change first.
 */
export function findMetrics(r: LibraryReads, ask: LibraryAsk = {}): LibraryPage {
  const size = ask.size ?? LIBRARY_PAGE;
  const rows: LibraryRow[] = r.metrics.filter((m) => !m.removedAt && (ask.retired ? !!m.retiredAt : !m.retiredAt)).map((m) => {
    const links = liveLinks(r, m.id);
    return { metric: m, owner: ownerName(r.people, m), goalIds: links.map((l) => l.goalId), needs: metricNeeds(m, r), links };
  }).filter(({ metric: m, owner, links, needs }) => {
    if (ask.q?.trim() && !textMatches([m.name, m.unit, directionWords(m.direction), owner ?? '', m.meaning, m.source].join(' '), ask.q)) return false;
    if (ask.unit && fold(m.unit) !== fold(ask.unit)) return false;
    if (ask.teamId && !links.some((l) => (ask.teamId === 'company' ? l.teamId == null : l.teamId === ask.teamId))) return false;
    if (ask.ownerId && m.ownerId !== ask.ownerId) return false;
    if (ask.dir && m.direction !== ask.dir) return false;
    if (ask.unused && links.length) return false;
    if (ask.sortout && !needs.length) return false;
    return true;
  }).map(({ links: _, ...row }) => row);
  const byName = (a: LibraryRow, b: LibraryRow) => fold(a.metric.name).localeCompare(fold(b.metric.name));
  rows.sort(ask.sort === 'goals' ? (a, b) => b.goalIds.length - a.goalIds.length || byName(a, b)
    : ask.sort === 'changed' ? (a, b) => b.metric.updatedAt.localeCompare(a.metric.updatedAt) || byName(a, b)
    : byName);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(1, Math.floor(ask.page ?? 1)), pages);
  const from = rows.length ? (page - 1) * size + 1 : 0;
  const to = Math.min(rows.length, page * size);
  return { total: rows.length, page, pages, from, to, rows: rows.slice(from ? from - 1 : 0, to) };
}

/* ---------- rule 2: a metric's goals ---------- */

/** What rule 2 reads of each goal: the core's summary row (status, now, target, gap and owner, worked out once). */
export type GoalRow = Pick<GoalSummary, 'goal' | 'status' | 'now' | 'nowValue' | 'target' | 'dueWeek' | 'gap' | 'owner'>;

/** One goal measured by the metric, as its page's table shows it. */
export interface MetricGoalRow {
  goal: GoalRow['goal'];
  status: DisplayStatus;
  /** The slice in words: the team's name, or "The whole company", then " · {part}" when the link is for one part (MT2). */
  slice: string;
  /** The latest value in the goal's format, or "No value yet". */
  now: string;
  nowValue: number | null;
  /** The target with its week: "24 hours by year end", "≤ 2.0% by year end". */
  target: string;
  /** The scorecard's words against plan ("9 hours behind plan"), or a range's room to its limit ("Inside the 2.0% limit"). */
  vsPlan: string;
  owner: string;
}

/**
 * Rule 2. Every goal a metric measures now, one row per link in force to a live goal of the running cycle, worst
 * status first, then by slice name, then title. Each row is the goal's own summary (domain/summary), with its slice.
 */
export function metricGoals(metricId: string, links: readonly MetricLink[], goals: readonly GoalRow[], teams: readonly Pick<Team, 'id' | 'name'>[], cycle: Pick<Cycle, 'weeks'>): MetricGoalRow[] {
  const byGoal = new Map(goals.filter((s) => !s.goal.stoppedAt).map((s) => [s.goal.id, s]));
  const rows: MetricGoalRow[] = [];
  for (const l of links) {
    const s = l.metricId === metricId && !l.removedAt ? byGoal.get(l.goalId) : undefined;
    if (!s) continue;
    const team = l.teamId == null ? COMPANY : teams.find((t) => t.id === l.teamId)?.name ?? 'A removed team';
    const slice = (l.part ?? '').trim() ? `${team} · ${(l.part ?? '').trim()}` : team;
    rows.push({ goal: s.goal, status: s.status, slice, now: s.now, nowValue: s.nowValue, target: `${s.target} ${byWeekWords(cycle as Cycle, s.dueWeek)}`, vsPlan: s.gap, owner: s.owner });
  }
  return rows.sort((a, b) => RANK[b.status] - RANK[a.status] || a.slice.localeCompare(b.slice) || a.goal.title.localeCompare(b.goal.title));
}

/**
 * Rule 2's line under the table: "Lowest now: Build & Release, 4 min. Highest: CI/CD, 7 min." when two or more rows
 * have a value in the same unit and decimals; otherwise null. A row with no value yet is left out.
 */
export function summaryLine(rows: readonly MetricGoalRow[]): string | null {
  const valued = rows.filter((r) => r.nowValue != null && r.goal.kind !== 'milestone');
  if (valued.length < 2) return null;
  const shape = (r: MetricGoalRow) => (r.goal.kind === 'milestone' ? '' : `${fold(r.goal.unit)}|${r.goal.decimals}`);
  if (new Set(valued.map(shape)).size > 1) return null;
  const sorted = [...valued].sort((a, b) => a.nowValue! - b.nowValue! || a.slice.localeCompare(b.slice));
  const lo = sorted[0]!, hi = sorted[sorted.length - 1]!;
  // Two goals for one slice: each is named by its goal, so the line never names the same slice twice.
  const who = (r: MetricGoalRow) => (lo.slice === hi.slice ? r.goal.title : r.slice);
  return `Lowest now: ${who(lo)}, ${lo.now}. Highest: ${who(hi)}, ${hi.now}.`;
}

/** A metric's goals by status, worst first, only the statuses it has: what a library row says ("1 off track · 2 on track"). */
export function goalsByStatus(statuses: readonly DisplayStatus[]): { status: DisplayStatus; n: number }[] {
  const n = new Map<DisplayStatus, number>();
  for (const s of statuses) n.set(s, (n.get(s) ?? 0) + 1);
  return [...n.entries()].map(([status, k]) => ({ status, n: k })).sort((a, b) => RANK[b.status] - RANK[a.status] || a.status.localeCompare(b.status));
}

/* ---------- old addresses ---------- */

/**
 * Where an address of Wednesday's Metrics page under Data leads now (spec section 1), or null when it didn't move:
 * `/data/metrics` (and its `?m=<id>`, `?m=<id>&edit`, `?new` forms, also once they arrive at `/metrics`). Every other part
 * of the query (`?today=`, say) is kept.
 */
export function movedMetrics(path: string, search = ''): string | null {
  const p = path.replace(/\/+$/, '');
  if (p !== '/data/metrics' && p !== '/metrics') return null;
  const q = new URLSearchParams(search);
  const m = q.get('m');
  const edit = q.has('edit');
  const isNew = q.has('new');
  if (p === '/metrics' && !m && !isNew) return null;
  for (const k of ['m', 'edit', 'new']) q.delete(k);
  const rest = q.toString() ? `?${q.toString()}` : '';
  if (m) return `/metrics/${encodeURIComponent(metricSlug(m))}${edit ? '/edit' : ''}${rest}`;
  if (isNew) return `/metrics/new${rest}`;
  return `/metrics${rest}`;
}

/* ---------- rule 4: a close name ---------- */



/** The close-name question's words (spec 2.3): "This looks like “{other}” ({unit}, {direction}, owned by {name})." */
export const closeNameWords = (m: Metric, people: LibraryReads['people']) => {
  const owner = ownerName(people, m);
  return `“${m.name}” (${m.unit}, ${directionWords(m.direction)}${owner ? `, owned by ${owner}` : ''})`;
};

export { ownerlessMetrics } from './rules';
