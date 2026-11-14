/* Home's sets (round 3, HM3: docs/design/home/spec.md rule 4): "Your goals", "Your team" and "Goals you watch" are
   exactly the Goals scopes, and a set of more than twelve goals in two or more teams is drawn as teams, worst first. Pure. Apart from
   home.ts so that only the screens that draw a set load it (Home's first download stays as it was); `asTeams`, which
   Home asks before loading them, stays in home.ts. */
import { attentionOrder, needsAttention, splitAttention, type GoalAttention } from './attention';
import type { Scope, ScopeTab } from './goalsPage';
import { asTeams } from './home';
import { statusCounts, worstGroupsFirst } from './order';
import type { DisplayStatus } from './types';

/** One team of a set drawn as teams: its goals in the set, by status worst first, and how many need attention. `moved`
    (rule 5, HM4) is added by "Changed since"; until then it is absent and the table has no "Since" column. */
export interface TeamRow { teamId: string; name: string; total: number; byStatus: { status: DisplayStatus; n: number }[]; needs: number; moved?: { worse: number; better: number; quiet: number } }

/** One set (a Goals scope) as Home draws it. `needs` is splitAttention's, so "{k} need attention" is the Goals switch's
    count for the scope; `rows` are the goals Home lists (for "Your team", those not the viewer's own). */
export interface SetFacts {
  total: number;
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
    return { total: list.length, byStatus: statusCounts(list.map((a) => a.status.status)), needs, handled, rows: rows(needs), teams: asTeams(list.map((a) => a.goal)) ? asTeamRows(list, name) : null };
  };
  const team = scopes.find((t) => t.id === 'team')?.ids.some((g) => byId.get(g) && byId.get(g)!.goal.ownerId !== viewer.id) ? set('team', (n) => n.filter((a) => a.goal.ownerId !== viewer.id)) : null;
  return { mine: set('mine'), team: team ? { ...team, names: viewer.teams.map((t) => t.name) } : null, watching: set('watching') };
}
