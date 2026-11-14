/* Home's sets (round 3, HM3: docs/design/home/spec.md rule 4): "Your goals", "Your team" and "Goals you watch" are
   exactly the Goals scopes, and a set of more than twelve goals in two or more teams is drawn as teams, worst first. Pure. Apart from
   home.ts so that only the screens that draw a set load it (Home's first download stays as it was); `asTeams`, which
   Home asks before loading them, stays in home.ts. */
import { attentionOrder, needsAttention, splitAttention, type GoalAttention } from './attention';
import type { Scope, ScopeTab } from './goalsPage';
import { asTeams } from './home';
import { statusCounts, worstGroupsFirst } from './order';
import type { DisplayStatus } from './types';
import type { Standing } from './standing';
import { dayText } from './format';
import { WEEKDAY } from './progress';

/** One team of a set drawn as teams: its goals in the set, by status worst first, and how many need attention. `moved`
    (rule 5, HM4) is added by "Changed since"; until then it is absent and the table has no "Since" column. */
export interface TeamRow { teamId: string; name: string; total: number; byStatus: { status: DisplayStatus; n: number }[]; needs: number; moved?: { worse: number; better: number; quiet: number } }

/** One set (a Goals scope) as Home draws it. `needs` is splitAttention's, so "{k} need attention" is the Goals switch's
    count for the scope; `rows` are the goals Home lists (for "Your team", those not the viewer's own). */
export interface SetFacts {
  total: number;
  /** Every goal in the set. */
  ids: string[];
  byStatus: { status: DisplayStatus; n: number }[];
  needs: GoalAttention[];
  handled: GoalAttention[];
  rows: GoalAttention[];
  /** One row per team, worst first, when the set is drawn as teams (`asTeams`); null otherwise. */
  teams: TeamRow[] | null;
}

/** The team set also carries its teams' names, for "Your team · {team}" and "Your teams · {n} goals in {k} teams". */
export interface Sets { mine: SetFacts | null; team: (SetFacts & { names: string[] }) | null; watching: SetFacts | null }

/** A set's goals as teams, worst first (as Goals orders "By team": `worstGroupsFirst`), then by name. */
export function asTeamRows(list: readonly GoalAttention[], teamName: (id: string) => string): TeamRow[] {
  const by = new Map<string, GoalAttention[]>();
  for (const a of list) by.set(a.goal.teamId, [...(by.get(a.goal.teamId) ?? []), a]);
  const rows = [...by.entries()].map(([teamId, these]) => ({ teamId, name: teamName(teamId), these }));
  return worstGroupsFirst(rows, (r) => r.these.map((a) => a.status.status), (r) => r.name).map(({ teamId, name, these }) => ({
    teamId, name, total: these.length, byStatus: statusCounts(these.map((a) => a.status.status)), needs: these.filter(needsAttention).length,
  }));
}

/**
 * Rule 4. Home's sets are exactly the Goals scopes (`scopesFor`'s `every`, drawn as a tab or not), so each block's total is its scope's count.
 * `team` is present only when the scope exists and holds a goal the viewer doesn't own; its rows are what needs attention
 * without the viewer's own goals (the link adds `owner=-me`). A goal listed in one set is not left out of the next.
 * `attention` has each goal of the scopes (attentionFor); `teams` names every team.
 */
export function homeSets(viewer: { id: string; teams: { id: string; name: string }[] }, scopes: readonly ScopeTab[], attention: readonly GoalAttention[], teams: readonly { id: string; name: string }[]): Sets {
  const byId = new Map(attention.map((a) => [a.goal.id, a]));
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? '';
  const set = (id: Scope, rows: (needs: GoalAttention[]) => GoalAttention[] = (n) => n): SetFacts | null => {
    const tab = scopes.find((t) => t.id === id);
    const list = (tab?.ids ?? []).map((g) => byId.get(g)).filter((a): a is GoalAttention => !!a).sort(attentionOrder);
    if (!list.length) return null;
    const { needs, handled } = splitAttention(list);
    return { total: list.length, ids: list.map((a) => a.goal.id), byStatus: statusCounts(list.map((a) => a.status.status)), needs, handled, rows: rows(needs), teams: asTeams(list.map((a) => a.goal)) ? asTeamRows(list, name) : null };
  };
  const team = scopes.find((t) => t.id === 'team')?.ids.some((g) => byId.get(g) && byId.get(g)!.goal.ownerId !== viewer.id) ? set('team', (n) => n.filter((a) => a.goal.ownerId !== viewer.id)) : null;
  return { mine: set('mine'), team: team ? { ...team, names: viewer.teams.map((t) => t.name) } : null, watching: set('watching') };
}

/* ---------- How the week's check-ins stand (rule 6, cell 3; HM7) ---------- */

export type StandingSet = 'team' | 'watching' | 'all';

/** Over which goals the cell counts: a set drawn as teams (rule 4), your teams' before what you watch; for an admin with
    neither, every goal; for anyone else, none (their own are counted in Your goals and the check-in). */
export function standingSet(sets: Pick<Sets, 'team' | 'watching'>, admin: boolean): StandingSet | null {
  return sets.team?.teams ? 'team' : sets.watching?.teams ? 'watching' : admin ? 'all' : null;
}

/** The goals of the set due this week (`standing` is null for one that isn't): `in` have this week's check-in, `late`
    came in after the due day. Null when none is due. Goals, never people. */
export interface StandingFacts { set: StandingSet; of: number; in: number; late: number }
export function standingOver<G>(set: StandingSet, goals: readonly G[], standing: (g: G) => Standing | null): StandingFacts | null {
  const due = goals.map(standing).filter((x): x is Standing => x !== null);
  return due.length ? { set, of: due.length, in: due.filter((x) => x !== 'none').length, late: due.filter((x) => x === 'after').length } : null;
}

/** The cell's words (part 4): "Checked in for week {w}" · "{a} of {b} goals" · "Due by Thu 12 Nov", or after the due day
    "{c} came in after Thursday"; it opens the goals of the set with no check-in yet, worst first. */
export function standingWords(f: StandingFacts, week: number, dueDate: string, today: string): { label: string; value: string; sub: string; to: string } {
  const weekday = WEEKDAY[(new Date(dueDate + 'T00:00:00Z').getUTCDay() + 6) % 7]!;
  return {
    label: `Checked in for week ${week}`,
    value: `${f.in} of ${f.of} ${f.of === 1 ? 'goal' : 'goals'}`,
    sub: today > dueDate && f.late ? `${f.late} came in after ${weekday}` : `Due by ${dayText(dueDate)}`,
    to: `/goals?scope=${f.set}&checkedin=no`,
  };
}
