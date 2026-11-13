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


/** What withdrawing a proposal says (it is domain/removal's deleteGoal: Recently removed for 30 days, with Undo). */
export const withdrawnSummary = (title: string) => `Withdrew the proposal “${title}”`;

/** A proposal still waiting this many weeks is asked about on Home (never a status or a flag). */
export const PROPOSED_ASK_WEEKS = 8;

/** Whole weeks since a goal was proposed. */
export const weeksProposed = (g: Pick<Goal, 'proposedAt'>, today: Date): number => (g.proposedAt ? Math.floor((today.getTime() - new Date(g.proposedAt).getTime()) / (7 * 86_400_000)) : 0);

export interface ProposalAsk { kind: 'for-you' | 'stale'; goal: Goal; says: string }

/**
 * Home's rows (rule 14): `for-you`, a goal proposed for the viewer by someone else that they haven't opened; `stale`, a
 * goal proposed PROPOSED_ASK_WEEKS weeks ago or more that the viewer may make active (an admin only for their own), not
 * put off. `seen` is what the viewer has opened, and until when each stale ask is put off (the Prefs port).
 */
export function proposalAsks(goals: readonly Goal[], viewer: Pick<Person, 'id' | 'admin'>, today: Date, seen: { opened: ReadonlySet<string>; putOff: ReadonlyMap<string, string> }, nameOf: (id: string) => string = (id) => id): ProposalAsk[] {
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
