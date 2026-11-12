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
import type { Goal } from './types';

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


/** What withdrawing a proposal says (it is domain/removal's deleteGoal: Recently removed for 30 days, with Undo). */
export const withdrawnSummary = (title: string) => `Withdrew the proposal “${title}”`;
