/* Making a proposed goal active, and an active one proposed again (goal entry GE10, rule 14): the two actions, apart from
   domain/proposed so the first download doesn't carry them (app/actions loads this file when one of them runs). Pure. */
import type { ActionContext } from './actions';
import { NotAllowed } from './actions';
import type { Commit } from './commit';
import { mayChangeGoal } from './goalRights';
import { isProposed, PROPOSED, withProposed } from './proposed';
import { draftFor } from './goal';
import { planEnd } from './plan';
import { goalChecks, goalMustFix, type MustFix, type MustFixContext } from './goalEntry';
import type { Change, Goal, Person } from './types';

type Actor = Pick<Person, 'id' | 'admin'>;

/** The check-in's words for a proposed goal, at every door (the screen, a file, the tools). */
export const NOTHING_TO_CHECK_IN = 'This goal is proposed, so there is nothing to check in. Make it active first.';

/** Who may make a proposed goal active: its owner, or an admin (not whoever proposed it, unless they are one of those). */
export const mayActivate = (actor: Actor, goal: Pick<Goal, 'ownerId'>): boolean => !!actor.admin || goal.ownerId === actor.id;

/** A proposal still waiting this many weeks is asked about on Home (never a status or a flag). */
export const PROPOSED_ASK_WEEKS = 8;

/** Rule 2's full list for the goal as it stands, as if it were made active from `fromWeek` (this week by default). */
export function readyToActivate(goal: Goal, ctx: Pick<MustFixContext, 'cycleWeeks' | 'week' | 'startDate'> & { fromWeek?: number }): MustFix[] {
  const d = draftFor(goal);
  if (goal.kind === 'metric') d.fromWeek = String(ctx.fromWeek ?? Math.max(0, ctx.week));
  return goalMustFix(d, { ...ctx, existing: null, door: 'form' });
}

const no = (msg: string): never => { throw new NotAllowed(msg); };
const goalIn = (x: ActionContext, ref: string) => withProposed(x.snapshot).find((g) => g.id === ref || g.key === ref) ?? (x.allGoals ?? []).find((g) => !g.removedAt && (g.id === ref || g.key === ref));
const nameOf = (x: ActionContext, id: string | null | undefined) => x.snapshot.people.find((p) => p.id === id)?.name;
const change = (x: ActionContext, g: Goal, summary: string, diffs: Change['diffs']): Change => ({ id: x.newId('chg'), at: x.now, actorId: x.actor.id, goalId: g.id, entity: 'goal', entityId: g.id, action: 'edited', summary, diffs });

/** The goal made active from a week: its proposal cleared; a number goal's plan starts that week, its hand-set weeks before it dropped. */
export function activated(goal: Goal, fromWeek: number): Goal {
  const g = { ...goal, proposedAt: null, proposedBy: null } as Goal;
  if (g.kind !== 'metric') return g;
  const points = g.plan.points?.filter((p) => p.week > fromWeek);
  const { points: _drop, ...plan } = g.plan;
  return { ...g, plan: { ...plan, fromWeek, ...(points?.length ? { points } : {}) } };
}

/**
 * Make a proposed goal active (rule 14): its owner or an admin, when nothing is missing. A number goal's plan starts
 * from `fromWeek`, this week unless said. History says "Made it active, from week {n}". The app's toast has Undo,
 * which puts the goal back as it was (domain/removal undoRemoval).
 */
export function activate(x: ActionContext, i: { goalId: string; fromWeek?: number; confirm?: boolean }): { commit: Commit; goal: Goal } {
  const g = goalIn(x, i.goalId) ?? no('That goal no longer exists. Reload to see the latest.');
  if (!isProposed(g)) no(`“${g.title}” is already active.`);
  if (!mayActivate(x.actor, g)) no(`${nameOf(x, g.ownerId) ?? 'Its owner'} or an admin can make this active.`);
  const from = i.fromWeek ?? Math.max(0, x.week);
  // From is a week of this cycle's year before the plan's To (the GE10 review: 53 and -3 were saved).
  const to = g.kind === 'metric' ? planEnd(g.plan, x.cycle.weeks) : 0;
  if (g.kind === 'metric' && (!Number.isInteger(from) || from < 0 || from >= to)) no(`From must be a week of this cycle before the plan’s To: week 0 to week ${to - 1}.`);
  // A From before this week is asked at every door, never assumed (rule 3's from-past): the screen asks it in place.
  const asked = g.kind === 'metric' && from < x.week ? fromPastQuestion(g, from, x) : null;
  if (asked && !i.confirm) no(`Not saved. Check with the person first: ${asked}`);
  const missing = readyToActivate(g, { cycleWeeks: x.cycle.weeks, week: x.week, startDate: x.cycle.startDate, fromWeek: from });
  if (missing.length) no(`“${g.title}” can’t be made active yet: ${missing.map((f) => f.text).join(' ')}`);
  const goal = activated(g, from);
  const words = g.kind === 'metric' ? `Made it active, from week ${from}` : 'Made it active';
  return { commit: { goals: [goal], changes: [change(x, goal, words, [{ field: 'State', from: PROPOSED, to: 'Active' }, ...(g.kind === 'metric' && (g.plan.fromWeek ?? 0) !== from ? [{ field: 'From', from: `week ${g.plan.fromWeek ?? 0}`, to: `week ${from}` }] : [])])] }, goal };
}


/** Rule 3's from-past question for a number goal made active from an earlier week, in the words New goal uses. */
function fromPastQuestion(g: Goal, from: number, x: ActionContext): string | null {
  const d = { ...draftFor(g), fromWeek: String(from) };
  return goalChecks(d, { week: x.week, cycleWeeks: x.cycle.weeks, existing: null, door: 'form', startDate: x.cycle.startDate }).find((c) => c.id === 'from-past')?.question ?? null;
}

/** Why an active goal can't go back to proposed: it has check-ins. */
export const HAS_CHECK_INS = 'It has check-ins, so it can’t go back to proposed. Stop it instead.';

/** Make an active goal with no check-ins proposed again: its owner or an admin. */
export function backToProposed(x: ActionContext, i: { goalId: string }): { commit: Commit; goal: Goal } {
  const g = goalIn(x, i.goalId) ?? no('That goal no longer exists. Reload to see the latest.');
  if (isProposed(g)) no(`“${g.title}” is already proposed.`);
  if (g.stoppedAt) no(`“${g.title}” is stopped.`);
  if (!mayChangeGoal(x.actor, g)) no(`Only ${nameOf(x, g.ownerId) ?? 'its owner'} (its owner) or an admin can make it proposed again.`);
  if (x.snapshot.checkIns.some((c) => c.goalId === g.id && !c.removedAt)) no(HAS_CHECK_INS);
  const goal = { ...g, proposedAt: x.now, proposedBy: x.actor.id } as Goal;
  return { commit: { goals: [goal], changes: [change(x, goal, 'Made it proposed again', [{ field: 'State', from: 'Active', to: PROPOSED }])] }, goal };
}

/** Whole weeks since a goal was proposed. */
export const weeksProposed = (g: Pick<Goal, 'proposedAt'>, today: Date): number => (g.proposedAt ? Math.floor((today.getTime() - new Date(g.proposedAt).getTime()) / (7 * 86_400_000)) : 0);

export interface ProposalAsk { kind: 'for-you' | 'stale'; goal: Goal; says: string }

/**
 * Home's rows (rule 14): `for-you`, a goal proposed for the viewer by someone else that they haven't opened; `stale`, a
 * goal proposed PROPOSED_ASK_WEEKS weeks ago or more that the viewer may make active (an admin only for their own), not
 * put off. `seen` is what the viewer has opened, and until when each stale ask is put off (the Prefs port).
 */
export function proposalAsks(goals: readonly Goal[], viewer: Actor, today: Date, seen: { opened: ReadonlySet<string>; putOff: ReadonlyMap<string, string> }, nameOf: (id: string) => string = (id) => id): ProposalAsk[] {
  const out: ProposalAsk[] = [];
  for (const g of goals.filter(isProposed)) {
    if (g.ownerId === viewer.id && g.proposedBy && g.proposedBy !== viewer.id && !seen.opened.has(g.id)) {
      out.push({ kind: 'for-you', goal: g, says: `${nameOf(g.proposedBy).split(' ')[0]} proposed a goal for you: “${g.title}”.` });
      continue;
    }
    const n = weeksProposed(g, today);
    const until = seen.putOff.get(g.id);
    if (g.ownerId === viewer.id && n >= PROPOSED_ASK_WEEKS && !(until && until > today.toISOString().slice(0, 10))) {
      out.push({ kind: 'stale', goal: g, says: `“${g.title}” has been proposed for ${n} weeks. Make it active, or withdraw it.` });
    }
  }
  return out;
}
