/* What moved since you last looked (round 3, HM4: docs/design/home/spec.md rule 5). Pure: the app layer works out each
   goal's status on `since` by calling the status rule (goalStatus) with today = since and only the check-ins posted
   before it, and hands the two statuses here. Home's "Changed since" block, the teams table's "Since" column, the Goals
   filter `moved=…&since=…` and find_goals all read `movement`, so they can't disagree. */
import { RANK } from './status';
import { dayText } from './format';
import type { DisplayStatus, Status } from './types';

/** What a goal did between `since` and now. */
export type MoveKind = 'worse' | 'better' | 'quiet' | 'done';
export interface Move { kind: MoveKind; early: boolean }
/** The Goals filter's values (`moved=`): one kind, or any change. */
export type MovedFilter = MoveKind | 'any';
/** Each kind's words, as Home's counts, the teams table and the Goals filter line say them. */
export const MOVED_WORDS: Record<MovedFilter, string> = { worse: 'got worse', better: 'recovered', quiet: 'went quiet', done: 'done', any: 'any change' };
const known = (kind: string): kind is MovedFilter => Object.hasOwn(MOVED_WORDS, kind);
/** A day as `since=` writes it; anything else counts from this week's Monday. */
const isDay = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));

/** The Goals filter line's part for `moved=`: "Changed since Fri 6 Nov: got worse"; "Changed this week: …" with no day.
    None for no `moved=` or a kind it doesn't know (no filter). */
export function movedPart(q: { moved?: string | null; since?: string | null }): { key: string; label: string; values: string[] } | null {
  const kind = q.moved ?? '', since = q.since ?? null;
  return known(kind) ? { key: 'moved', label: isDay(since) ? `Changed since ${dayText(since)}:` : 'Changed this week:', values: [MOVED_WORDS[kind]] } : null;
}

/** Does a goal pass `moved=<kind>`, given what it did (`movement`)? A kind it doesn't know is no filter. */
export const movedPasses = (kind: string, m: Move | null) => !known(kind) || (!!m && (kind === 'any' || m.kind === kind));
/** The day `since=` names, or null (this week's Monday) when it isn't one. */
export const sinceDay = (d: string | null) => (isDay(d) ? d : null);

/** Never more than this many days back (rule 5): a person away for months sees the last four weeks. */
export const SINCE_MAX_DAYS = 28;

/** When Home was last opened, per person and workspace (`home-seen`, behind the Prefs port): yyyy-mm-dd days. */
export interface Seen { last: string | null; prev: string | null }

const DAY = 86_400_000;
const shift = (iso: string, days: number) => new Date(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
const daysFrom = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10) + 'T00:00:00Z') - Date.parse(from.slice(0, 10) + 'T00:00:00Z')) / DAY);

/**
 * The day to count from: `prev` when Home was already opened today, else `last`; never more than 28 days back; null when
 * Home was never opened (the screen then counts from the week's Monday and says "Changed this week").
 */
export function sinceFor(seen: Seen | null, today: string): string | null {
  const day = seen?.last === today ? seen.prev : seen?.last ?? null;
  if (!day) return null;
  const floor = shift(today, -SINCE_MAX_DAYS);
  return day < floor ? floor : day;
}

/** The Monday of the week a day is in: what "Changed this week" counts from when Home was never opened. */
export function mondayOf(today: string): string {
  const wd = new Date(today.slice(0, 10) + 'T00:00:00Z').getUTCDay();
  return shift(today, -((wd + 6) % 7));
}

/** Opening Home on a new day: `prev = last`, `last = today`. A second visit the same day changes nothing. */
export function seenToday(seen: Seen | null, today: string): Seen {
  if (seen?.last === today) return seen;
  return { last: today, prev: seen?.last ?? null };
}

/** The block's heading: "Changed since Friday 6 Nov", "Changed this week" (never opened), "Changed in the last 4 weeks" (the cap). */
export function changedHeading(since: string | null, today: string, longDay: (iso: string) => string): string {
  if (!since) return 'Changed this week';
  if (daysFrom(since, today) >= SINCE_MAX_DAYS) return 'Changed in the last 4 weeks';
  return `Changed since ${longDay(since)}`;
}

/** A goal's status now, with the owner's call and what the rules calculated in its latest check-in (for `early`). */
export interface StatusNow { status: DisplayStatus; call?: Status | null; calculated?: Status | null }

/** Statuses that say nothing yet about a plan: before a first check-in, or before the cycle's first week. */
const UNSAID = new Set<DisplayStatus>(['none', 'planned']);

/**
 * Rule 5. A goal's move between its status on `since` (`before`; null when the goal was created after it) and now:
 * `done` when it is done now and wasn't; `quiet` when it now has no recent update and hadn't (weekly rhythm only);
 * otherwise `worse` or `better` by the status rule's rank (the vocabulary's order), or null when nothing moved.
 * A first status of on track is no change; a first status at risk or off track is worse. A new check-in that keeps the
 * status is no change: Home is not a feed (History has it). `early`: worse because the owner called it behind while the
 * rules' own calculation is not (the opposite of the `greener` flag).
 */
export function movement(before: DisplayStatus | null, now: StatusNow, weekly = true): Move | null {
  if (before == null || before === now.status) return null;
  if (now.status === 'done') return { kind: 'done', early: false };
  if (before === 'done') return null;
  if (now.status === 'stale') return weekly ? { kind: 'quiet', early: false } : null;
  if (UNSAID.has(now.status)) return null;
  const was = UNSAID.has(before) ? RANK.on : RANK[before];
  const r = RANK[now.status];
  if (r === was) return null;
  if (r < was) return { kind: 'better', early: false };
  const early = !!now.call && !!now.calculated && RANK[now.call] > RANK[now.calculated] && RANK[now.calculated] <= RANK.on;
  return { kind: 'worse', early };
}

/** Which of Home's sets a goal is counted in, first that holds: yours, your team, watching. */
export type SetId = 'mine' | 'team' | 'watching';
const SET_ORDER: Record<SetId, number> = { mine: 0, team: 1, watching: 2 };
const KIND_ORDER: Record<MoveKind, number> = { worse: 0, quiet: 1, better: 2, done: 3 };

/** One goal as `changedSince` reads it: its status on `since` (null: created after it) and now, and its set. */
export interface ThenNow { id: string; title: string; teamId: string; set: SetId; setName: string; was: DisplayStatus | null; now: StatusNow }
/** One goal that moved. */
export interface Moved { id: string; title: string; teamId: string; set: SetId; setName: string; was: DisplayStatus; now: DisplayStatus; kind: MoveKind; early: boolean }
export interface Changed { since: string | null; counts: Record<MoveKind, number>; rows: Moved[] }

/**
 * Rule 5. What moved: the counts by kind, and the goals that moved, worse first, then quiet, better and done; within each
 * by set (yours, your team, watching), then name. The viewer's own goals are included (they changed for others too).
 */
export function changedSince(goals: readonly ThenNow[], since: string | null, weekly = true): Changed {
  const rows: Moved[] = [];
  for (const g of goals) {
    const m = movement(g.was, g.now, weekly);
    if (m) rows.push({ id: g.id, title: g.title, teamId: g.teamId, set: g.set, setName: g.setName, was: g.was!, now: g.now.status, kind: m.kind, early: m.early });
  }
  rows.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || SET_ORDER[a.set] - SET_ORDER[b.set] || a.title.localeCompare(b.title));
  const counts: Record<MoveKind, number> = { worse: 0, better: 0, quiet: 0, done: 0 };
  for (const r of rows) counts[r.kind]++;
  return { since, counts, rows };
}

/** A teams table's "Since" column: each team's moves (rule 4's TeamRow.moved). */
export function movesByTeam(rows: readonly Pick<Moved, 'teamId' | 'kind'>[]): Map<string, { worse: number; better: number; quiet: number }> {
  const out = new Map<string, { worse: number; better: number; quiet: number }>();
  for (const r of rows) {
    if (r.kind === 'done') continue;
    const t = out.get(r.teamId) ?? { worse: 0, better: 0, quiet: 0 };
    t[r.kind]++;
    out.set(r.teamId, t);
  }
  return out;
}

/**
 * The goals "Changed since" counts: the widest of the viewer's sets (the Goals scope with most goals: Mine, My team or
 * Watching), so each count opens exactly those goals with `scope=<that set>`. Each goal is said with the first set it is
 * in (yours, your team, watching), or its team's name when the set is drawn as teams. Null with no set.
 */
export function changedSet(tabs: readonly { id: string; ids: readonly string[] }[], viewerId: string, goals: readonly { id: string; ownerId: string; teamId: string }[], teamName: (id: string) => string, drawnAsTeams: (list: { teamId: string }[]) => boolean): { scope: SetId; goals: { id: string; set: SetId; setName: string }[] } | null {
  const sets = (['mine', 'team', 'watching'] as const).map((id) => tabs.find((t) => t.id === id)).filter((t): t is { id: SetId; ids: readonly string[] } => !!t && t.ids.length > 0);
  if (!sets.length) return null;
  const widest = sets.reduce((a, b) => (b.ids.length >= a.ids.length ? b : a));
  const team = new Set(tabs.find((t) => t.id === 'team')?.ids ?? []);
  const byId = new Map(goals.map((g) => [g.id, g]));
  const list = widest.ids.map((id) => byId.get(id)).filter((g): g is { id: string; ownerId: string; teamId: string } => !!g);
  const asTeams = drawnAsTeams(list);
  const WORD: Record<SetId, string> = { mine: 'yours', team: 'your team', watching: 'watching' };
  return {
    scope: widest.id,
    goals: list.map((g) => {
      const set: SetId = g.ownerId === viewerId ? 'mine' : team.has(g.id) ? 'team' : 'watching';
      return { id: g.id, set, setName: asTeams ? teamName(g.teamId) : WORD[set] };
    }),
  };
}
