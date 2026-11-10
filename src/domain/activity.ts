/* The change log, filtered: by who, which goal (or its whole tree), team, level, kind of change, dates and words.
   Every setting lives in the link, so a filtered log can be shared or kept. */
import type { Cell } from './export';
import { LEVEL_LABEL } from './format';
import { weekDate } from './plan';
import { quarterOf } from './year';
import type { Change, Cycle, Level, Snapshot } from './types';
import { VIA_LABEL, VIA_MCP_BEFORE } from './changeset';

export type ActivityKind = 'checkins' | 'plans' | 'goals' | 'reviews' | 'comments' | 'people' | 'imports' | 'ai' | 'cycle';
export const ACTIVITY_KINDS: [ActivityKind, string][] = [
  ['checkins', 'Check-ins'], ['plans', 'Plans and targets'], ['goals', 'Goal details'], ['reviews', 'Reviews'],
  ['comments', 'Comments'], ['people', 'People and admins'], ['imports', 'Imports and bulk edits'], ['ai', 'Via MCP'], ['cycle', 'Wrap-ups and cycles'],
];
export type When = 'this-week' | 'last-week' | 'quarter' | 'custom';
export const WHEN_OPTIONS: [When, string][] = [['this-week', 'This week'], ['last-week', 'Last week'], ['quarter', 'This quarter'], ['custom', 'Between two dates']];

export interface ActivityQuery {
  q: string;
  who: string[];
  goal: string | null;
  /** With the goal: every goal feeding it too. */
  tree: boolean;
  team: string[];
  level: Level[];
  kind: ActivityKind[];
  when: When | null;
  from: string | null;
  to: string | null;
  /** Arriving from Watching: the goals someone watches (at a level, or all). */
  watching: string | null;
  since: string | null;
}
export const EMPTY_ACTIVITY: ActivityQuery = { q: '', who: [], goal: null, tree: false, team: [], level: [], kind: [], when: null, from: null, to: null, watching: null, since: null };
export const ACTIVITY_KEYS = ['q', 'who', 'goal', 'tree', 'team', 'level', 'kind', 'when', 'from', 'to', 'watching', 'since'];

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export function parseActivity(p: URLSearchParams): ActivityQuery {
  const kinds = ACTIVITY_KINDS.map(([k]) => k);
  const when = p.get('when') as When | null;
  return {
    q: p.get('q') ?? '', who: list(p.get('who')), goal: p.get('goal'), tree: p.get('tree') === '1',
    team: list(p.get('team')), level: list(p.get('level')).filter((l): l is Level => l in LEVEL_LABEL),
    kind: list(p.get('kind')).filter((k): k is ActivityKind => (kinds as string[]).includes(k)),
    when: WHEN_OPTIONS.some(([k]) => k === when) ? when : null, from: date(p.get('from')), to: date(p.get('to')),
    watching: p.get('watching'), since: date(p.get('since')),
  };
}

export function activityEntries(a: ActivityQuery): [string, string][] {
  const out: [string, string][] = [];
  if (a.q.trim()) out.push(['q', a.q]);
  if (a.who.length) out.push(['who', a.who.join(',')]);
  if (a.goal) out.push(['goal', a.goal]);
  if (a.goal && a.tree) out.push(['tree', '1']);
  if (a.team.length) out.push(['team', a.team.join(',')]);
  if (a.level.length) out.push(['level', a.level.join(',')]);
  if (a.kind.length) out.push(['kind', a.kind.join(',')]);
  if (a.when) out.push(['when', a.when]);
  if (a.when === 'custom' && a.from) out.push(['from', a.from]);
  if (a.when === 'custom' && a.to) out.push(['to', a.to]);
  if (a.watching != null) out.push(['watching', a.watching]);
  if (a.since) out.push(['since', a.since]);
  return out;
}

const VIA = (c: Change) => c.diffs.find((d) => d.field === 'Via')?.to ?? null;
const PLAN_FIELDS = ['Start', 'Target', 'Plan shape', 'Target due', 'Plan numbers', 'Limit', 'Warning margin', 'Stages'];

/** What kind of change this is. A goal change that touches its plan or target counts as a plan change. */
export function kindOf(c: Change): ActivityKind {
  if (VIA(c) === VIA_LABEL.mcp || VIA(c) === VIA_MCP_BEFORE) return 'ai';
  if (c.action === 'imported' || c.action === 'undone') return 'imports';
  if (c.entity === 'check-in') return 'checkins';
  if (c.entity === 'metric') return 'goals';
  if (c.entity === 'goal') return c.action !== 'created' && c.diffs.some((d) => PLAN_FIELDS.includes(d.field)) ? 'plans' : 'goals';
  if (c.entity === 'decision' || c.entity === 'review') return 'reviews';
  if (c.entity === 'note') return 'comments';
  if (c.entity === 'person' || c.entity === 'workspace' || c.entity === 'view' || c.entity === 'watch') return 'people';
  return 'cycle';
}

/** The dates a "when" covers, as YYYY-MM-DD, inclusive. */
export function whenRange(a: ActivityQuery, cycle: Cycle, week: number): { from: string | null; to: string | null } {
  const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
  if (a.when === 'this-week') return { from: weekDate(cycle, week), to: plus(weekDate(cycle, week), 6) };
  if (a.when === 'last-week') return { from: weekDate(cycle, week - 1), to: plus(weekDate(cycle, week - 1), 6) };
  if (a.when === 'quarter') { const q = quarterOf(cycle, week); return { from: weekDate(cycle, q.from), to: plus(weekDate(cycle, q.to), 6) }; }
  if (a.when === 'custom') return { from: a.from, to: a.to };
  return { from: a.since, to: null };
}

export interface ActivityContext { snapshot: Snapshot; cycle: Cycle; week: number; watched: Set<string> | null }

/** The goal and every goal feeding it, however deep. */
export function treeOf(goalId: string, s: Snapshot): Set<string> {
  const out = new Set([goalId]);
  let grew = true;
  while (grew) { grew = false; for (const g of s.goals) if (g.parentId && out.has(g.parentId) && !out.has(g.id)) { out.add(g.id); grew = true; } }
  return out;
}

/** A test for one change against the query (every setting must match). */
export function activityFilter(a: ActivityQuery, x: ActivityContext): (c: Change) => boolean {
  const s = x.snapshot;
  const goals = a.goal ? (a.tree ? treeOf(a.goal, s) : new Set([a.goal])) : null;
  const { from, to } = whenRange(a, x.cycle, x.week);
  const words = a.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const goal = (id: string | null) => (id ? s.goals.find((g) => g.id === id) : undefined);
  const person = (id: string) => s.people.find((p) => p.id === id);
  return (c) => {
    if (x.watched && (!c.goalId || !x.watched.has(c.goalId))) return false;
    const day = c.at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (a.who.length && !a.who.includes(c.actorId)) return false;
    if (goals && (!c.goalId || !goals.has(c.goalId))) return false;
    const g = goal(c.goalId);
    if (a.team.length) {
      const team = g ? g.teamId : c.entity === 'person' ? person(c.entityId)?.teamId ?? null : null;
      if (!team || !a.team.includes(team)) return false;
    }
    if (a.level.length && (!g || !a.level.includes(g.level))) return false;
    if (a.kind.length && !a.kind.includes(kindOf(c))) return false;
    if (words.length) {
      const hay = [c.summary, person(c.actorId)?.name ?? '', g?.title ?? '', ...c.diffs.flatMap((d) => [d.field, d.from, d.to])].join(' ').toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  };
}

/** The active settings as words, each removable by its key. */
export function describeActivity(a: ActivityQuery, s: Snapshot, cycle: Cycle, week: number): { key: string; text: string }[] {
  const name = (id: string) => s.people.find((p) => p.id === id)?.name ?? id;
  const out: { key: string; text: string }[] = [];
  if (a.q.trim()) out.push({ key: 'q', text: `“${a.q.trim()}”` });
  if (a.who.length) out.push({ key: 'who', text: `By ${a.who.map(name).join(' or ')}` });
  if (a.goal) out.push({ key: 'goal', text: `${a.tree ? 'In the tree of' : 'On'} ${s.goals.find((g) => g.id === a.goal)?.title ?? 'a goal'}` });
  if (a.team.length) out.push({ key: 'team', text: a.team.map((t) => s.teams.find((x) => x.id === t)?.name ?? t).join(' or ') });
  if (a.level.length) out.push({ key: 'level', text: a.level.map((l) => LEVEL_LABEL[l]).join(' or ') });
  if (a.kind.length) out.push({ key: 'kind', text: a.kind.map((k) => ACTIVITY_KINDS.find(([x]) => x === k)![1]).join(' or ') });
  if (a.when) {
    const r = whenRange(a, cycle, week);
    const d = (v: string | null) => (v ? new Date(v + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '…');
    out.push({ key: 'when', text: a.when === 'custom' ? `${d(r.from)} to ${d(r.to)}` : `${WHEN_OPTIONS.find(([k]) => k === a.when)![1]} (${d(r.from)} to ${d(r.to)})` });
  }
  return out;
}

/** The query without one setting. */
/** The active filters as the filter line says them (find spec, rule 3): a label and its values. The search isn't one. */
export function activityParts(a: ActivityQuery, s: Snapshot, cycle: Cycle, week: number): { key: string; label: string; values: string[] }[] {
  const name = (id: string) => s.people.find((p) => p.id === id)?.name ?? id;
  const text = new Map(describeActivity(a, s, cycle, week).map((c) => [c.key, c.text]));
  const out: { key: string; label: string; values: string[] }[] = [];
  if (a.who.length) out.push({ key: 'who', label: 'Who', values: a.who.map(name) });
  if (a.goal) out.push({ key: 'goal', label: a.tree ? 'In the tree of' : 'Goal', values: [s.goals.find((g) => g.id === a.goal)?.title ?? 'a goal'] });
  if (a.team.length) out.push({ key: 'team', label: 'Team', values: a.team.map((t) => s.teams.find((x) => x.id === t)?.name ?? t) });
  if (a.level.length) out.push({ key: 'level', label: 'Level', values: a.level.map((l) => LEVEL_LABEL[l]) });
  if (a.kind.length) out.push({ key: 'kind', label: 'Kind', values: a.kind.map((k) => ACTIVITY_KINDS.find(([x]) => x === k)![1]) });
  if (a.when) out.push({ key: 'when', label: 'When', values: [text.get('when') ?? ''] });
  return out;
}

export function withoutActivity(a: ActivityQuery, key: string): ActivityQuery {
  const map: Record<string, Partial<ActivityQuery>> = { q: { q: '' }, who: { who: [] }, goal: { goal: null, tree: false }, team: { team: [] }, level: { level: [] }, kind: { kind: [] }, when: { when: null, from: null, to: null } };
  return { ...a, ...(map[key] ?? {}) };
}

/** The filtered log as rows for a CSV: one row per change, its field changes in one cell. */
export function activityRows(list: Change[], s: Snapshot): Cell[][] {
  const name = (id: string) => s.people.find((p) => p.id === id)?.name ?? id;
  return [
    ['When', 'Who', 'What', 'Goal', 'Kind', 'Changes', 'Via'],
    ...list.map((c) => [
      c.at, name(c.actorId), c.summary, c.goalId ? s.goals.find((g) => g.id === c.goalId)?.title ?? c.goalId : null,
      ACTIVITY_KINDS.find(([k]) => k === kindOf(c))![1],
      c.diffs.filter((d) => d.field !== 'Via').map((d) => `${d.field}: ${d.from === '—' ? '' : d.from + ' → '}${d.to}`).join('; ') || null,
      VIA(c),
    ]),
  ];
}
