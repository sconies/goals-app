/* What in a save is Reviews' own (build review of #371, medium 2): judged by what the save writes, not by which action or
   tool made it, so every door is covered once, the app's dispatcher (app/actions.ts performAny) and the AI tools' save
   (mcp/tools.ts callTool) alike. While Reviews is switched off a save that writes any of it is refused. */
import type { Commit } from './commit';
import type { Ask, Goal, Review } from './types';

/** What the rule reads of the workspace as loaded: its goals (proposed ones too), reviews and asks (app/reads reviewWriteRows). */
export interface StoredReviewRows { goals: readonly Pick<Goal, 'id' | 'proposedIn'>[]; reviews: readonly Pick<Review, 'id'>[]; asks: readonly Pick<Ask, 'id' | 'reviewId'>[] }

/**
 * Rule (FT2). A save writes Reviews' records when it logs a change to a review or to a note said in one, writes a note
 * (a decision) or a review not stored before, raises an ask in a review (one whose review differs from the stored ask's,
 * or a new one naming a review), or proposes a goal in a review (a `proposedIn` that differs from the stored goal's).
 * What a save carries along unchanged is not: answering a question raised in a review, editing a goal once proposed in
 * one, or the reviews a person leaves when marked as left, or a carried goal joins. `stored` is what the workspace as
 * loaded holds of those.
 */
export function writesReviews(c: Commit, stored: StoredReviewRows): boolean {
  if ((c.changes ?? []).some((x) => x.entity === 'review' || x.entity === 'decision')) return true;
  if (c.decisions?.length) return true;
  if (c.reviews?.some((r) => !stored.reviews.some((v) => v.id === r.id))) return true;
  const goal = (id: string) => stored.goals.find((g) => g.id === id);
  if (c.goals?.some((g) => !!g.proposedIn && g.proposedIn !== (goal(g.id)?.proposedIn ?? null))) return true;
  if (c.requests?.some((a) => !!a.reviewId && a.reviewId !== (stored.asks.find((x) => x.id === a.id)?.reviewId ?? null))) return true;
  return false;
}
