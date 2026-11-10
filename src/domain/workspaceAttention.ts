/* What needs attention in a workspace (backlog WS, outside review of 9 Nov: the overview restated Home instead of
   answering "what needs attention here"). Workspace's overview lists these first, each with where to deal with it;
   the sections follow. Pure: given the workspace as it is, who is asking, and how much new feedback is about it. */
import { wrapUpOpen } from './cycle';
import { periodWord } from './year';
import type { Cycle, Snapshot } from './types';

export interface WorkspaceNeed {
  /** Stable, for tests and keys. */
  id: 'no-goals' | 'few-people' | 'no-email' | 'no-team' | 'no-lead' | 'no-review' | 'wrap-up' | 'cycle-ending' | 'feedback';
  /** What needs doing, in one plain line. */
  says: string;
  /** Where it's dealt with. */
  to: string;
  /** Only admins can deal with it, so only admins are told. */
  admins: boolean;
}

/** How near a cycle's end it says so: four weeks before the wrap-up opens. */
export const ENDING_WEEKS = 4;

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/**
 * What needs attention in the open workspace, most pressing first, for this person: admins see what only they can
 * fix; everyone sees what anyone can. `feedbackNew` is how many new markups and pieces of feedback came from this
 * workspace (null while they load). Empty when nothing does.
 */
export function workspaceNeeds(s: Pick<Snapshot, 'people' | 'teams' | 'goals' | 'reviews' | 'retros'>, cycle: Cycle, week: number, admin: boolean, feedbackNew: number | null): WorkspaceNeed[] {
  const out: WorkspaceNeed[] = [];
  const word = periodWord(cycle);
  // The year closing: the wrap-up is open, or about to be.
  if (wrapUpOpen(cycle, week)) {
    const left = s.goals.filter((g) => !s.retros.some((r) => r.goalId === g.id)).length;
    out.push({ id: 'wrap-up', says: `${cycle.name} is ending: ${left ? `${n(left, 'goal', 'goals')} still to wrap up` : 'every goal is wrapped up'}. The next ${word} starts from the wrap-up.`, to: '/retro', admins: false });
  } else if (cycle.weeks - 1 - week <= ENDING_WEEKS) {
    const weeks = cycle.weeks - 1 - week;
    out.push({ id: 'cycle-ending', says: `${cycle.name} ends soon: the wrap-up opens in ${n(weeks, 'week', 'weeks')}, in week ${cycle.weeks - 1}.`, to: '/workspace/cycles', admins: false });
  }
  if (!s.goals.length) out.push({ id: 'no-goals', says: `No goals in ${cycle.name} yet. Each owner adds theirs from New goal.`, to: '/goals/new', admins: false });
  if (admin) {
    if (s.people.length < 3) out.push({ id: 'few-people', says: `Only ${n(s.people.length, 'person', 'people')} here. Goal owners need to be here to check in.`, to: '/people', admins: true });
    const noEmail = s.people.filter((p) => !p.email).length;
    if (noEmail) out.push({ id: 'no-email', says: `${n(noEmail, 'person has', 'people have')} no email yet, which is how two people with one name are told apart.`, to: '/people?emails=1', admins: true });
    const noTeam = s.people.filter((p) => !p.teamId || !s.teams.some((t) => t.id === p.teamId)).length;
    if (noTeam) out.push({ id: 'no-team', says: `${n(noTeam, 'person is', 'people are')} in no team.`, to: '/people?team=-', admins: true });
    const noLead = s.teams.filter((t) => !t.leadId || !s.people.some((p) => p.id === t.leadId)).length;
    if (noLead) out.push({ id: 'no-lead', says: `${n(noLead, 'team has', 'teams have')} no lead.`, to: '/teams', admins: true });
    if (!s.reviews.some((r) => !r.removedAt && !r.endedAt)) out.push({ id: 'no-review', says: 'No review is set up. A weekly review is where the goals that need attention are talked about.', to: '/reviews/new', admins: true });
  }
  if (feedbackNew) out.push({ id: 'feedback', says: `${n(feedbackNew, 'new markup or piece of feedback was', 'new markups and pieces of feedback were')} sent from this workspace.`, to: '/feedback', admins: false });
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/**
 * A cycle as Workspace's Cycles lists it (backlog WS: "dates, what's current, and its actions"): its first and last
 * days, and where it stands against the week the workspace is in: running (with the week), not started, or over.
 */
export function cycleWhen(c: Pick<Cycle, 'startDate' | 'weeks'>, current: boolean, week: number, today: Date): { dates: string; now: string } {
  const start = new Date(c.startDate + 'T00:00:00Z');
  const end = new Date(start.getTime() + (c.weeks * 7 - 1) * 86_400_000);
  const now = current ? `Running: week ${Math.max(1, Math.min(week, c.weeks))} of ${c.weeks}` : c.startDate > today.toISOString().slice(0, 10) ? `Starts ${day(start)}` : 'Over';
  return { dates: `${day(start)} to ${day(end)}, ${c.weeks} weeks`, now };
}
