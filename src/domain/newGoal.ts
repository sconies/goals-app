/* New goal's own rules (onboarding spec, section 4, rules 1, 2 and 5; OB1): the level a new goal starts at, the goals
   "Feeds into" suggests before anything is typed, and the plan table's one sentence for this goal. Pure: plans come from
   plan.ts, weeks from year.ts, the order from order.ts. Nothing here decides who may add what (that is planChanges). */
import { weekDates } from './plan';
import { isYear, quarters } from './year';
import type { Cycle, Goal, Level, Team } from './types';

/** The four steps of New goal, in order, each an address under /goals/new (onboarding spec, 1). */
export const NEW_GOAL_STEPS = [
  { slug: 'what', name: 'What', title: 'New goal: what' },
  { slug: 'who', name: 'Who and where', title: 'New goal: who and where' },
  { slug: 'measure', name: 'How it’s measured', title: 'New goal: how it’s measured' },
  { slug: 'check', name: 'Check', title: 'New goal: check' },
] as const;
export type NewGoalStep = (typeof NEW_GOAL_STEPS)[number]['slug'];

/** A step's index from its address; unknown is null. */
export function stepIndex(slug: string | undefined): number | null {
  const i = NEW_GOAL_STEPS.findIndex((s) => s.slug === slug);
  return i < 0 ? null : i;
}

const ABOVE: Record<Level, Level | null> = { team: 'svp', svp: 'north-star', 'north-star': null };
const BELOW: Record<Level, Level> = { 'north-star': 'svp', svp: 'team', team: 'team' };
const RANK: Record<Level, number> = { 'north-star': 0, svp: 1, team: 2 };

/**
 * Rule 1. The level a new goal starts at. With a parent: one below the parent's. Without: Team, unless the owner leads a
 * team that already owns a north-star or SVP goal; then none, and the person is asked ("Choose a level.").
 */
export function startLevel(ownerId: string, teams: Pick<Team, 'id' | 'leadId'>[], goals: Pick<Goal, 'teamId' | 'level'>[], parent: Pick<Goal, 'level'> | null): Level | null {
  if (parent) return BELOW[parent.level];
  const led = new Set(teams.filter((t) => t.leadId === ownerId).map((t) => t.id));
  return goals.some((g) => led.has(g.teamId) && g.level !== 'team') ? null : 'team';
}

/** Whether a goal at `parent`'s level can be fed by one at `level`: only from a level below (today's rule, said in the list). */
export function canFeed(level: Level, parent: Pick<Goal, 'level'>): boolean {
  return RANK[parent.level] < RANK[level];
}

/** The words for a goal "Feeds into" can't take: "A Team goal can’t feed a Team goal." Null when it can. */
export function feedRefusal(level: Level, parent: Pick<Goal, 'level'>, label: Record<Level, string>): string | null {
  const a = (l: Level) => (l === 'svp' ? 'an' : 'a') + ' ' + label[l];
  return canFeed(level, parent) ? null : `${a(level).replace(/^a/, 'A')} goal can’t feed ${a(parent.level)} goal.`;
}

/** Most suggestions "Feeds into" offers before anything is typed. */
export const PARENT_SUGGESTIONS = 6;

/**
 * Rule 2. Suggestions for "Feeds into", in order: the goals one level above `level` in `teamId`, worst first; then those
 * one level above in any team that the viewer's own goals already feed; then goals opened lately above `level`. Six at
 * most, each once. A north star has none (it is the top of its tree).
 */
export function parentSuggestions(level: Level, teamId: string, viewerId: string, goals: Goal[], worst: (a: Goal, b: Goal) => number, recent: string[] = []): Goal[] {
  const up = ABOVE[level];
  if (!up) return [];
  const live = goals.filter((g) => !g.stoppedAt && !g.removedAt);
  const out: Goal[] = [];
  const add = (gs: Goal[]) => { for (const g of gs) if (out.length < PARENT_SUGGESTIONS && !out.includes(g)) out.push(g); };
  add(live.filter((g) => g.level === up && g.teamId === teamId).sort(worst));
  const fed = new Set(live.filter((g) => g.ownerId === viewerId && g.parentId).map((g) => g.parentId!));
  add(live.filter((g) => g.level === up && fed.has(g.id)).sort(worst));
  const byId = new Map(live.map((g) => [g.id, g]));
  add(recent.map((id) => byId.get(id)).filter((g): g is Goal => !!g && RANK[g.level] < RANK[level]));
  return out;
}

/**
 * Rule 5. The plan table's explanation, with this goal's own next quarter end: "Each week’s number is checked in during
 * that week, so the one that closes Q4 is week 53, checked in 28 Dec–3 Jan." Null for a cycle that isn't a year.
 */
export function planNote(cycle: Cycle, week: number): string | null {
  if (!isYear(cycle)) return null;
  const q = quarters(cycle).find((x) => x.to >= Math.max(1, week)) ?? quarters(cycle)[3]!;
  return `Each week’s number is checked in during that week, so the one that closes ${q.label} is week ${q.to}, checked in ${weekDates(cycle, q.to)}.`;
}
