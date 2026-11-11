/* The workspace in words (backlog WS; app redesign WR2, docs/design/workspace/spec.md rules 1, 2, 3 and 6): what an
   admin has to sort out, the workspace's name and its admins as people read them, where the year stands, and a
   cycle's dates. Workspace's About reads these. Pure. */
import { cycleDates, cycleState, dayWithYear, wrapUpOpen } from './cycle';
import type { Cycle, Person, Snapshot } from './types';

export interface WorkspaceNeed {
  /** Stable, for tests and keys. */
  id: 'no-goals' | 'no-review' | 'only-admin' | 'no-email' | 'no-team' | 'no-lead';
  /** What needs sorting out, as a short sentence (shown in bold). */
  says: string;
  /** Why it matters, in a line under it. */
  why: string;
  /** The one plain button at the row's right. */
  action: string;
  /** Where the button leads. */
  to: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/** "You're the only admin" is said from this many people on: a small team's one admin is no worry. */
export const ONLY_ADMIN_FROM = 5;
/** A team without a lead is said from this size: set-up never asks who leads a team, so a team of one or two isn't told off. */
export const LEAD_FROM = 3;

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/**
 * What an admin has to sort out in the open workspace (app redesign WR2, docs/design/workspace/spec.md rule 3), in
 * order: no goals in the running cycle; no review; the only admin of a workspace of five or more; people with no
 * email; people in no team; teams of three or more with no lead. Members get nothing: these are an admin's to fix.
 * The year ending is Home's and the Year fact's to say; feedback is the builders' business.
 */
export function workspaceNeeds(s: Pick<Snapshot, 'people' | 'teams' | 'goals' | 'reviews'>, cycle: Pick<Cycle, 'name'>, admin: boolean): WorkspaceNeed[] {
  if (!admin) return [];
  const out: WorkspaceNeed[] = [];
  if (!s.goals.length) out.push({ id: 'no-goals', says: `No goals in ${cycle.name} yet`, why: 'Each owner adds theirs from New goal.', action: 'Add one', to: '/goals/new' });
  if (!s.reviews.some((r) => !r.removedAt && !r.endedAt)) out.push({ id: 'no-review', says: 'No review is set up', why: 'A review is where the goals that need attention are talked about.', action: 'Set one up', to: '/reviews/new' });
  if (s.people.filter((p) => p.admin).length === 1 && s.people.length >= ONLY_ADMIN_FROM) out.push({ id: 'only-admin', says: 'You’re the only admin', why: 'Make a second, so the workspace isn’t stuck when you’re away.', action: 'Choose someone', to: '/workspace/access' });
  const noEmail = s.people.filter((p) => !p.email).length;
  if (noEmail) out.push({ id: 'no-email', says: `${n(noEmail, 'person has', 'people have')} no email`, why: 'An email is how two people with one name are told apart.', action: 'Add them', to: '/people?emails=1' });
  const noTeam = s.people.filter((p) => !p.teamId || !s.teams.some((t) => t.id === p.teamId)).length;
  if (noTeam) out.push({ id: 'no-team', says: `${n(noTeam, 'person is', 'people are')} in no team`, why: 'Goals are grouped by team.', action: 'See them', to: '/people?team=-' });
  const size = (t: { id: string; leadId: string }) => s.people.filter((p) => p.teamId === t.id).length;
  const noLead = s.teams.filter((t) => (!t.leadId || !s.people.some((p) => p.id === t.leadId)) && size(t) >= LEAD_FROM).length;
  if (noLead) out.push({ id: 'no-lead', says: `${n(noLead, 'team has', 'teams have')} no lead`, why: 'A lead is who people ask about the team’s goals.', action: 'See them', to: '/teams' });
  return out;
}

/** About's "To sort out" shows this many rows; the rest open in place from "and {k} more". */
export const NEEDS_SHOWN = 3;

/**
 * A workspace's name as people read it (rule 1): the stored name without the example's own "Example: ", and its kind
 * as a quieter second line: "example data", "kept in this browser" (one made in the demo), or nothing (a real one).
 */
export function workspaceName(ws: { name: string; kind?: string }, mode: 'demo' | 'live'): { name: string; kind: string } {
  if (ws.kind === 'example') return { name: ws.name.replace(/^Example:\s*/, ''), kind: 'example data' };
  return { name: ws.name, kind: mode === 'demo' ? 'kept in this browser' : '' };
}

/** The admins as a sentence, A to Z (rule 2): beyond `max`, the first `max - 1` and how many others. */
export function adminsLine(people: Pick<Person, 'name' | 'admin'>[], max = 3): string {
  const names = people.filter((p) => p.admin).map((p) => p.name).sort((a, b) => a.localeCompare(b, 'en-GB', { sensitivity: 'base' }));
  const shown = names.length > max ? [...names.slice(0, max - 1), `${names.length - (max - 1)} others`] : names;
  return shown.length < 2 ? shown.join('') : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

/**
 * Where the year stands (rule 6; cycle-end rule 1), for About's Year fact and Cycles' current row: the week, and when the
 * wrap-up opens, or how many goals are still to wrap up once it's open. Once its last day is past it says so, and until
 * when the wrap-up stays open. A cycle not begun says when its week 1 starts. `left` is how many of its goals have no
 * wrap-up yet.
 */
export function yearLine(cycle: Pick<Cycle, 'name' | 'startDate' | 'weeks'>, week: number, today: Date, left: number): string {
  const d = cycleDates(cycle);
  const state = cycleState(cycle, today);
  const still = left ? `${n(left, 'goal', 'goals')} still to wrap up` : 'every goal is wrapped up';
  if (state === 'before') return `${cycle.name} starts on ${day(new Date(d.firstDay + 'T00:00:00Z'))}.`;
  if (state === 'ended') return `${cycle.name} ended on ${dayWithYear(d.lastDay)}. The wrap-up is open until ${dayWithYear(d.wrapUpCloses)}: ${still}.`;
  if (state === 'closed') return `${cycle.name} ended on ${dayWithYear(d.lastDay)}.`;
  const w = Math.max(1, Math.min(week, cycle.weeks));
  const at = `${cycle.name}, week ${w} of ${cycle.weeks}.`;
  if (state === 'ending' || wrapUpOpen(cycle, w)) return `${at} The wrap-up is open: ${still}.`;
  return `${at} The wrap-up opens on ${day(new Date(d.wrapUpOpens + 'T00:00:00Z'))}.`;
}


/**
 * A cycle as Workspace's Cycles lists it (backlog WS: "dates, what's current, and its actions"): its first and last
 * days, and where it stands against the week the workspace is in: running (with the week), not started, or over.
 */
export function cycleWhen(c: Pick<Cycle, 'startDate' | 'weeks'>, current: boolean, week: number, today: Date): { dates: string; now: string } {
  const d = cycleDates(c);
  const first = new Date(d.firstDay + 'T00:00:00Z'), last = new Date(d.lastDay + 'T00:00:00Z');
  const state = cycleState(c, today);
  const now = state === 'before' ? `Starts ${day(first)}` : state === 'ended' || state === 'closed' ? 'Over' : current ? `Running: week ${Math.max(1, Math.min(week, c.weeks))} of ${c.weeks}` : 'Running';
  return { dates: `${day(first)} to ${day(last)}, ${c.weeks} weeks`, now };
}

/**
 * A cycle as Cycles lists it (WR4, docs/design/workspace/spec.md 2.6): its name and where it stands as a word
 * ("running", "over", "starts {date}"), its week and dates (the running one) or only its dates, and its goals and
 * check-ins ("no check-ins yet" for none).
 */
export function cycleLine(c: Pick<Cycle, 'name' | 'startDate' | 'weeks'>, current: boolean, week: number, today: Date, counts: { goals: number; checkIns: number }): { title: string; when: string; counts: string } {
  // Its real days (cycle-end rule 1): week 1's Monday to its last week's Sunday, so 2026 is 29 Dec 2025 to 3 Jan 2027.
  const d = cycleDates(c);
  const first = new Date(d.firstDay + 'T00:00:00Z'), last = new Date(d.lastDay + 'T00:00:00Z');
  const dates = `${day(first)} to ${day(last)}`;
  const state = cycleState(c, today);
  const word = state === 'before' ? `starts ${day(first)}` : state === 'running' ? 'running' : state === 'ending' ? 'ending' : `ended ${day(last)}`;
  const title = `${c.name} · ${word}`;
  const live = state === 'running' || state === 'ending';
  const when = live && current ? `Week ${Math.max(1, Math.min(week, c.weeks))} of ${c.weeks} · ${dates}` : `${dates} · ${c.weeks} weeks`;
  const goals = `${counts.goals.toLocaleString('en-GB')} ${counts.goals === 1 ? 'goal' : 'goals'}`;
  return { title, when, counts: `${goals} · ${counts.checkIns ? `${counts.checkIns.toLocaleString('en-GB')} ${counts.checkIns === 1 ? 'check-in' : 'check-ins'}` : 'no check-ins yet'}` };
}

