/* The Goals page (docs/design/goals/spec.md, section 4: GL1): whose goals (the scope), how they are arranged (the
   group), the Needs attention switch, the line that counts them, a view in words, and old addresses. Pure, and each
   rule takes only what it reads (AR4): goal ids, summaries, names. Status, attention, order and filters come from their
   own rules (status.ts, attention.ts, order.ts, query.ts); nothing here restates them. */
import { applyQuery, describeQuery, type GoalQuery, type QueryContext } from './query';
import { onAttentionList, needsAttention } from './attention';
import { countLine } from './find';
import { FLAG, LABEL, STATUS_ORDER } from './vocabulary';
import type { GoalSummary } from './summary';
import type { DisplayStatus } from './types';

export type Scope = 'mine' | 'team' | 'watching' | 'all';
export type Group = 'tree' | 'team' | 'level' | 'none';
export const SCOPES: Scope[] = ['mine', 'team', 'watching', 'all'];
export const GROUPS: [Group, string, string][] = [
  ['tree', 'As trees', 'Each top goal, then what feeds it'],
  ['team', 'By team', 'Teams worst first, each with its counts'],
  ['level', 'By level', 'North stars, then SVP, then team goals'],
  ['none', 'None', 'One list'],
];

/** What the scopes read: the viewer's goals, team and watched goals, by id. */
export interface ScopeFacts {
  /** Goals in the running cycle, not stopped: id, owner, team. */
  goals: { id: string; ownerId: string; teamId: string }[];
  viewerId: string;
  /** The viewer's own team and the teams they lead, with names. */
  teams: { id: string; name: string }[];
  watched: Set<string>;
}

export interface ScopeTab { id: Scope; label: string; ids: string[] }

/**
 * Rule 1. The tabs someone has, in order: Mine (when they own a goal), My team or My teams (their team and the teams
 * they lead, when they have one), Watching, All. A tab waits (small workspaces SM1, rule 1): it is drawn when its list
 * has a goal and isn't the same list as a tab drawn before it; All is always drawn. `every` keeps each scope whether
 * drawn or not, since every address still opens. Opens on the scope last used when it is still drawn; otherwise Mine,
 * else Watching when it has goals, else All.
 */
export function scopesFor(f: ScopeFacts, last: Scope | null): { tabs: ScopeTab[]; every: ScopeTab[]; opens: Scope } {
  const every: ScopeTab[] = [];
  const mine = scopeIds(f, 'mine');
  every.push({ id: 'mine', label: 'Mine', ids: mine });
  if (f.teams.length) every.push({ id: 'team', label: f.teams.length === 1 ? 'My team' : 'My teams', ids: scopeIds(f, 'team') });
  every.push({ id: 'watching', label: 'Watching', ids: scopeIds(f, 'watching') });
  every.push({ id: 'all', label: 'All', ids: scopeIds(f, 'all') });
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const tabs: ScopeTab[] = [];
  // A list the same as All, or as a tab drawn before it, waits: All is drawn last, always.
  const all = every.find((t) => t.id === 'all')!;
  for (const t of every) if (t === all || (t.ids.length && !same(t.ids, all.ids) && !tabs.some((d) => same(d.ids, t.ids)))) tabs.push(t);
  const has = (s: Scope | null) => !!s && tabs.some((t) => t.id === s);
  const opens: Scope = has(last) ? last! : mine.length ? 'mine' : (every.find((t) => t.id === 'watching')!.ids.length ? 'watching' : 'all');
  return { tabs, every, opens };
}

/** What a scope is asked by, so a server can answer it for the person asking without being sent ids (AX5): a tab
    of Goals, or one named team (`team:<id>`). */
export type ScopeName = Scope | `team:${string}`;

/** The goals in a scope, by id, in the workspace's order. "team" is the viewer's own team and the teams they lead. */
export function scopeIds(f: ScopeFacts, scope: ScopeName): string[] {
  if (scope === 'all') return f.goals.map((g) => g.id);
  if (scope === 'mine') return f.goals.filter((g) => g.ownerId === f.viewerId).map((g) => g.id);
  if (scope === 'watching') return f.goals.filter((g) => f.watched.has(g.id)).map((g) => g.id);
  const teams = new Set(scope === 'team' ? f.teams.map((t) => t.id) : [scope.slice('team:'.length)]);
  return f.goals.filter((g) => teams.has(g.teamId)).map((g) => g.id);
}

/** Rule 2. A scope's own arrangement: All as trees; every other scope one list. */
export const ownGroup = (s: Scope): Group => (s === 'all' ? 'tree' : 'none');

/** A scope's name in sentences. */
export function scopeWords(s: Scope, ws: string, teams: string[]): string {
  if (s === 'mine') return 'your goals';
  if (s === 'team') return teams.length === 1 ? teams[0]! : 'your teams';
  if (s === 'watching') return 'what you watch';
  return ws;
}

/**
 * Rule 3. The switch's count: the goals in the scope that need attention, after the filters and the search but
 * ignoring the switch itself. Being handled is never counted.
 */
export function attentionCount(sums: GoalSummary[], query: GoalQuery, ctx: QueryContext): number {
  return applyQuery(sums, { ...query, attention: false, needs: [], sort: null }, ctx).filter((s) => needsAttention(s.attention)).length;
}

/**
 * What the query port's counts() says about a query's goals (src/ports/goals.ts): how many in each status, and how many
 * need attention among `unflagged`, the same query with its attention filter left off (the Goals switch's count).
 */
export function goalsCounted(matched: GoalSummary[], unflagged: GoalSummary[]): { status: Record<DisplayStatus, number>; attention: number } {
  const status = Object.fromEntries(STATUS_ORDER.map((k) => [k, 0])) as Record<DisplayStatus, number>;
  for (const s of matched) status[s.status]++;
  return { status, attention: unflagged.filter((s) => needsAttention(s.attention)).length };
}

/** What a count reads of a goal's summary: a list row from the query port is enough. */
type Counted = Pick<GoalSummary, 'status' | 'attention'>;

/** The statuses that have goals, worst first: "2 off track · 4 at risk". */
function statusList(sums: Counted[], flagged = false): string {
  const counts = new Map<DisplayStatus, Counted[]>();
  for (const s of sums) counts.set(s.status, [...(counts.get(s.status) ?? []), s]);
  const order = [...STATUS_ORDER] as DisplayStatus[];
  return order.filter((k) => counts.get(k)?.length).map((k) => {
    const these = counts.get(k)!;
    const words = `${these.length} ${LABEL[k].toLowerCase()}`;
    if (!flagged || k === 'off' || k === 'risk' || k === 'stale') return words;
    // A status that isn't itself a reason says why: the commonest two flags.
    const tally = new Map<string, number>();
    for (const s of these) for (const f of s.attention.flags) if (!['off', 'risk', 'stale', 'due'].includes(f.kind)) tally.set(f.kind, (tally.get(f.kind) ?? 0) + 1);
    const why = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => (FLAG as Record<string, { label: string }>)[f]?.label.toLowerCase() ?? f);
    return why.length ? `${words}, flagged for ${why.join(' or ')}` : words;
  }).join(' · ');
}

/**
 * Rule 4. The line that counts the goals shown. Switch off: the list bar's count line, then each status worst first.
 * Switch on: "{n} need attention: " then the statuses of those, and how many are being handled below. Nothing shown:
 * no line (the page's empty words say it).
 */
export function goalsLine(shown: Counted[], narrowed: boolean, order: string, attention: boolean): string {
  if (!attention) {
    const head = countLine({ thing: 'goal', things: 'goals' }, shown.length, narrowed, order);
    return head ? `${head} ${statusList(shown)}` : '';
  }
  const needs = shown.filter((s) => needsAttention(s.attention));
  const handled = shown.filter((s) => onAttentionList(s.attention) && !needsAttention(s.attention));
  if (!needs.length && !handled.length) return '';
  const head = needs.length ? `${needs.length} ${needs.length === 1 ? 'needs' : 'need'} attention: ${statusList(needs, true)}.` : 'Nothing new needs attention.';
  return handled.length ? `${head} ${handled.length} being handled ${handled.length === 1 ? 'is' : 'are'} listed below.` : head;
}

/** Rule 5. A view in words: scope, group (when not its own), needs attention, layout (when not List), filters, sort. */
export function describeView(p: URLSearchParams, query: GoalQuery, names: Parameters<typeof describeQuery>[1], scopeLabel: (s: Scope) => string): string {
  const scope = (p.get('scope') as Scope | null) ?? 'all';
  const group = p.get('group') as Group | null;
  const parts = [scopeLabel(scope)];
  const g = GROUPS.find(([k]) => k === (group ?? ownGroup(scope)));
  if (group && group !== ownGroup(scope)) parts.push(g![1].replace(/^As/, 'as').replace(/^By/, 'by').replace(/^None$/, 'one list'));
  else if (scope === 'all') parts.push('as trees');
  if (p.get('attention') === '1') parts.push('needs attention');
  const view = p.get('view');
  if (view && view !== 'list') parts.push(view[0]!.toUpperCase() + view.slice(1));
  const filters = describeQuery({ ...query, q: '', attention: false, needs: [] }, names).map((c) => c.text);
  const sort = query.sort ? `Sorted by ${({ worst: 'worst first', title: 'name', owner: 'owner', team: 'team', level: 'level', gap: 'furthest from plan', last: 'longest since a check-in', due: 'due soonest' } as Record<string, string>)[query.sort]}.` : '';
  return [`${parts.join(', ')}.`, filters.length ? `${filters.join(' · ')}.` : '', sort].filter(Boolean).join(' ');
}

const OLD_SHOW: Record<string, [Scope, Group | null, boolean]> = {
  mine: ['mine', null, false], watching: ['watching', null, false], outcomes: ['all', null, false],
  levels: ['all', 'level', false], teams: ['all', 'team', false], attention: ['all', null, true],
};

/**
 * Rule 6. Old addresses and old saved views: `show=` becomes a scope, a group and the switch; an address with filters and
 * no scope is All. Returns the new search (other parts kept) and a line to say, if any; null when nothing moves.
 * `opens` is rule 1's scope for a bare /goals.
 */
export function movedGoals(search: string, opens: Scope, has: (s: Scope) => boolean): { search: string; note: string | null } | null {
  const p = new URLSearchParams(search);
  const show = p.get('show');
  let note: string | null = null;
  if (show !== null) {
    p.delete('show');
    const to = OLD_SHOW[show];
    if (to) {
      p.set('scope', has(to[0]) ? to[0] : opens);
      if (to[1]) p.set('group', to[1]);
      if (to[2]) p.set('attention', '1');
    } else {
      p.set('scope', opens);
      note = `There’s no “${show}” tab, so these are ${opens === 'all' ? 'all goals' : opens === 'mine' ? 'your goals' : opens === 'team' ? 'your team’s goals' : 'the goals you watch'}.`;
    }
  } else if (!p.get('scope')) {
    const filtered = [...p.keys()].some((k) => !['view', 'today', 'store', 'present', 'weeks', 'hist'].includes(k));
    p.set('scope', filtered ? 'all' : opens);
  } else if (!has(p.get('scope') as Scope)) {
    p.set('scope', opens);
  } else return null;
  // The address's parts in the spec's order: scope, group, view, attention, then the rest as they were.
  const first = ['scope', 'group', 'view', 'attention'];
  const out = new URLSearchParams([...first.filter((k) => p.has(k)).map((k) => [k, p.get(k)!] as [string, string]), ...[...p].filter(([k]) => !first.includes(k))]);
  return { search: out.toString(), note };
}
