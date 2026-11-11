/* The directory: People and Teams, a place for everyone (app redesign WR1, docs/design/workspace/spec.md rules 4, 5
   and 8). Who is listed and in what order, what a search finds, the line beside a person, a team's summary, and where
   the addresses People and Teams had under Workspace now lead. Pure. Who People and Teams list, and what their search
   finds, is the one search for people and teams (find.ts rule 7, `searchPeople` and `searchTeams`), reached through the
   Search port, the seam where an internal app plugs in its server search (R4). */
import { teamMembers, teamPeople } from './actions';
import { statusCounts } from './order';
import type { DisplayStatus, Goal, Snapshot } from './types';

/** How many people People shows at a time. */
export const DIRECTORY_PAGE = 50;

/** What the directory's counts read: the workspace scoped to the running cycle (goals not stopped), and each goal's status. */
export interface DirectoryCtx { snapshot: Pick<Snapshot, 'people' | 'teams' | 'goals'>; statusOf: (g: Goal) => DisplayStatus }

const collator = new Intl.Collator('en-GB', { sensitivity: 'base' });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The line beside a person in the directory (rule 5): "Admin"; "leads the team" (their own), "leads {team}" (another,
 * the first A to Z) or "leads {n} teams"; then their goals in the running cycle. The first part takes a capital.
 */
export function personLine(x: Pick<DirectoryCtx, 'snapshot'>, personId: string): string {
  const p = x.snapshot.people.find((q) => q.id === personId);
  if (!p) return '';
  const leads = x.snapshot.teams.filter((t) => t.leadId === p.id).sort((a, b) => collator.compare(a.name, b.name));
  const goals = x.snapshot.goals.filter((g) => g.ownerId === p.id && !g.stoppedAt && !g.removedAt).length;
  const lead = !leads.length ? '' : leads.length > 1 ? `leads ${leads.length} teams` : leads[0]!.id === p.teamId ? 'leads the team' : `leads ${leads[0]!.name}`;
  return [p.admin ? 'admin' : '', lead, goals ? plural(goals, 'goal', 'goals') : 'no goals'].filter(Boolean).map((s, i) => (i ? s : capital(s))).join(' · ');
}

/**
 * A team as Teams and its page show it (rule 5): its lead, its people (as `teamPeople`: its lead among them), its
 * current goals and their counts by status, so the counts here and under Goals' By team are the same numbers.
 */
export function teamSummary(x: DirectoryCtx, teamId: string) {
  const team = x.snapshot.teams.find((t) => t.id === teamId);
  const people = teamPeople(x, teamId);
  const goals = teamMembers(x, teamId).current;
  return { lead: x.snapshot.people.find((p) => p.id === team?.leadId) ?? null, people, goals, byStatus: statusCounts(goals.map(x.statusOf)) };
}

/**
 * Where an address that moved now leads (rule 8), or null when it didn't move: People and Teams left Workspace for
 * places of their own, and Workspace's overview is Workspace itself (About). The query is kept (but for `team`, which became the team's own page), and so is any hash.
 */
export function movedTo(path: string, search = '', hash = ''): string | null {
  const q = new URLSearchParams(search);
  const rest = (drop: string[] = []) => { const n = new URLSearchParams(q); for (const k of drop) n.delete(k); const s = n.toString(); return s ? `?${s}` : ''; };
  if (path === '/workspace' || path === '/workspace/') {
    if (hash === '#people') return '/people' + rest();
    if (hash === '#teams') return '/teams' + rest();
    return null;
  }
  if (path === '/workspace/people') {
    const team = q.get('team');
    if (team && team !== '-') return `/teams/${encodeURIComponent(team)}` + rest(['team']);
    return '/people' + rest() + hash;
  }
  if (path === '/workspace/teams') return '/teams' + rest() + hash;
  // Workspace opens on About (WR2): the overview's own address is Workspace's.
  if (path === '/workspace/overview') return '/workspace' + rest() + hash;
  return null;
}
