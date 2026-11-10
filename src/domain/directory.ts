/* The directory: People and Teams, a place for everyone (app redesign WR1, docs/design/workspace/spec.md rules 4, 5
   and 8). Who is listed and in what order, what a search finds, the line beside a person, a team's summary, and where
   the addresses People and Teams had under Workspace now lead. Pure: the screens and their tests read these, and
   `findInDirectory` is the seam where an internal app plugs in its server search (R4). */
import { teamMembers, teamPeople } from './actions';
import { textMatches } from './find';
import { statusCounts } from './order';
import type { DisplayStatus, Goal, Person, Snapshot, Team } from './types';

/** How many people People shows at a time. */
export const DIRECTORY_PAGE = 50;

/** Lower case, accents gone: "Lucía" and "lucia" are the same to a search. */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Whether every word typed starts a word of one of the texts: "eng man" finds "Engineering Manager". The search rule
 * all lists share (find.ts `textMatches`), over a name, a job title and a team's name. */
export function matchesWords(q: string, texts: string[]): boolean {
  return textMatches(texts.join(' '), q);
}

const collator = new Intl.Collator('en-GB', { sensitivity: 'base' });
/** The directory's order: by name, ignoring case and accents; then by email, then by ID, so two people with one name keep their places. */
export const byName = (a: Pick<Person, 'name' | 'email' | 'id'>, b: Pick<Person, 'name' | 'email' | 'id'>) =>
  collator.compare(a.name, b.name) || (a.email ?? '').localeCompare(b.email ?? '') || a.id.localeCompare(b.id);

/** What People asks for: its address's query (`?q=`, `?team=<id>` or `-`, `?admins=1`, `?page=` from 1). */
export interface DirectoryAsk { q?: string; teamId?: string; admins?: boolean; page?: number; size?: number }
export interface DirectoryPage { total: number; page: number; pages: number; from: number; to: number; rows: Person[] }

/**
 * Everyone the directory lists for an ask, a page at a time (rule 4): never anyone marked as left; by name A to Z; `q`
 * matching when every word of it starts a word of the name, the job title or the team's name; `teamId` keeping the
 * team's people as `teamPeople` gives them (its lead counts, wherever their own team is), `-` people in no team;
 * `admins` keeping the admins. A page past the end is the last page.
 */
export function findInDirectory(people: Person[], teams: Team[], ask: DirectoryAsk = {}): DirectoryPage {
  const size = ask.size ?? DIRECTORY_PAGE;
  const team = new Map(teams.map((t) => [t.id, t]));
  const lead = ask.teamId && ask.teamId !== '-' ? team.get(ask.teamId)?.leadId : undefined;
  const found = people.filter((p) => !p.leftAt && !p.removedAt)
    .filter((p) => !ask.teamId || (ask.teamId === '-' ? !p.teamId || !team.has(p.teamId) : p.teamId === ask.teamId || p.id === lead))
    .filter((p) => !ask.admins || p.admin)
    .filter((p) => !ask.q?.trim() || matchesWords(ask.q, [p.name, p.role ?? '', team.get(p.teamId ?? '')?.name ?? '']))
    .sort(byName);
  const pages = Math.max(1, Math.ceil(found.length / size));
  const page = Math.min(Math.max(1, Math.floor(ask.page ?? 1) || 1), pages);
  const rows = found.slice((page - 1) * size, page * size);
  return { total: found.length, page, pages, from: rows.length ? (page - 1) * size + 1 : 0, to: (page - 1) * size + rows.length, rows };
}

/** The teams Teams lists: by name A to Z; `q` matches the team's name or its lead's. */
export function findTeams(teams: Team[], people: Person[], q = ''): Team[] {
  const name = new Map(people.map((p) => [p.id, p.name]));
  return teams.filter((t) => !q.trim() || matchesWords(q, [t.name, name.get(t.leadId) ?? ''])).sort((a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id));
}

/** What the directory's counts read: the workspace scoped to the running cycle (goals not stopped), and each goal's status. */
export interface DirectoryCtx { snapshot: Pick<Snapshot, 'people' | 'teams' | 'goals'>; statusOf: (g: Goal) => DisplayStatus }

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
