/* A goal that is proposed, not yet active (goal entry GE10; docs/design/goal-entry/spec.md, 2.15 and rule 14).

   A proposed goal is a real goal, with a key and a page, that everyone can see and nobody is yet held to. It is never
   judged: the status rules are never run on it, nothing is due on it, and it is in no count, health line, Needs
   attention, review agenda, check-in, wrap-up or metric comparison. The one place that keeps it out of all of them is
   `judged`, which domain/cycle's scopeToCycle applies as it applies "not stopped": a proposed goal sits beside the
   snapshot's goals (`Snapshot.proposed`), never among them. It becomes active by one deliberate act, `activate`, by its
   owner or an admin.

   Pure: no screens, storage or network. Who may change it is domain/goalRights' (whoever proposed it may, while it is
   proposed); what can't be saved is goal entry's rule 2, with the type's own required fields optional. */
import type { GoalDraft } from './goal';
import type { Goal, Person } from './types';

/** The word, one meaning: the goal's state, visible, not judged, nothing due. */
export const PROPOSED = 'Proposed';
/** Whether a goal is proposed: set, and neither removed nor stopped. */
export const isProposed = (g: Pick<Goal, 'proposedAt' | 'removedAt' | 'stoppedAt'>): boolean => !!g.proposedAt && !g.removedAt && !g.stoppedAt;

/**
 * The goals that are judged: neither proposed nor stopped. Every rule that leaves a stopped goal out of being judged
 * leaves a proposed one out the same way, through this (domain/cycle scopeToCycle and the reads built on it).
 */
export const judged = <G extends Pick<Goal, 'proposedAt' | 'stoppedAt'>>(goals: readonly G[]): G[] => goals.filter((g) => !g.stoppedAt && !g.proposedAt);

/** The snapshot's goals with this cycle's proposed ones beside them: for the places that find a goal by id, never for one that judges. */
export const withProposed = (s: { goals: Goal[]; proposed?: Goal[] }): Goal[] => (s.proposed?.length ? [...s.goals, ...s.proposed] : s.goals);

/** Whether a draft says nothing yet about how it is measured: none of its type's own required fields is filled in. */
export function measureEmpty(d: Pick<GoalDraft, 'kind' | 'start' | 'target' | 'limit' | 'stages'> & Partial<Pick<GoalDraft, 'lower'>>): boolean {
  if (d.kind === 'metric') return !d.start.trim() && !d.target.trim();
  if (d.kind === 'range') return !d.limit.trim() && !d.lower?.trim();
  return !d.stages.some((s) => s.name.trim() || s.dueWeek.trim());
}

/**
 * A goal with a baseline and nothing else yet (backlog GB, Lane 12 Nov; core, inside this proposed state). While a number
 * goal is proposed, its target may be left unset: it keeps its baseline (the plan's start) and unit, says "Target not
 * set", and is made active only once a target is set, since making it active runs rule 2's full list. Like any proposal it
 * has no status, nothing due and is in no count.
 */
export const TARGET_NOT_SET = 'Target not set';
/** Whether a goal is a number goal whose target isn't set yet (only ever while proposed). */
export const targetNotSet = (g: Goal): boolean => g.kind === 'metric' && !!g.targetUnset;
/** Whether a draft is a number goal with a baseline and no target: what a proposal may save (GB). */
export const baselineOnly = (d: Pick<GoalDraft, 'kind' | 'start' | 'target'>): boolean => d.kind === 'metric' && !!d.start.trim() && !d.target.trim();

/** What withdrawing a proposal says (it is domain/removal's deleteGoal: Recently removed for 30 days, with Undo). */
export const withdrawnSummary = (title: string) => `Withdrew the proposal “${title}”`;

/** A proposal still waiting this many weeks is asked about on Home (never a status or a flag). */
export const PROPOSED_ASK_WEEKS = 8;

/** Whole weeks since a goal was proposed. */
export const weeksProposed = (g: Pick<Goal, 'proposedAt'>, today: Date): number => (g.proposedAt ? Math.floor((today.getTime() - new Date(g.proposedAt).getTime()) / (7 * 86_400_000)) : 0);

/**
 * " in {review}" for a goal proposed in a review's walk (decision 15), by the review's name; empty when it was proposed
 * elsewhere, or the review isn't there to name (ended, or Reviews switched off: `reviewOf` gives null), so nothing is
 * said about reviews.
 */
export const proposedInWords = (g: Pick<Goal, 'proposedIn'>, reviewOf: (id: string) => string | null): string => {
  const name = g.proposedIn ? reviewOf(g.proposedIn) : null;
  return name ? ` in ${name}` : '';
};

export interface ProposalAsk { kind: 'for-you' | 'stale'; goal: Goal; says: string }

/**
 * Home's rows (rule 14): `for-you`, a goal proposed for the viewer by someone else that they haven't opened; `stale`, a
 * goal proposed PROPOSED_ASK_WEEKS weeks ago or more that the viewer may make active (an admin only for their own), not
 * put off. `seen` is what the viewer has opened, and until when each stale ask is put off (the Prefs port).
 */
export function proposalAsks(goals: readonly Goal[], viewer: Pick<Person, 'id' | 'admin'>, today: Date, seen: { opened: ReadonlySet<string>; putOff: ReadonlyMap<string, string> }, nameOf: (id: string) => string = (id) => id, reviewOf: (id: string) => string | null = () => null): ProposalAsk[] {
  const out: ProposalAsk[] = [];
  for (const g of goals.filter(isProposed)) {
    if (g.ownerId === viewer.id && g.proposedBy && g.proposedBy !== viewer.id && !seen.opened.has(g.id)) {
      out.push({ kind: 'for-you', goal: g, says: `${nameOf(g.proposedBy).split(' ')[0]} proposed a goal for you${proposedInWords(g, reviewOf)}: “${g.title}”.` });
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
