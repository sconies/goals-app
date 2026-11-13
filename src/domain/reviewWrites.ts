/* What in a save is Reviews' own (build review of #371, medium 2): judged by what the save writes, not by which action or
   tool made it, so every door is covered once, the app's dispatcher (app/actions.ts performAny) and the AI tools' save
   (mcp/tools.ts callTool) alike. While Reviews is switched off a save that writes any of it is refused. */
import { asksOf } from './asks';
import type { Commit } from './commit';
import type { Snapshot } from './types';

/**
 * Rule (FT2). A save writes Reviews' records when it logs a change to a review or to a note said in one, writes a note
 * (a decision) or a review not stored before, raises an ask in a review (one whose review differs from the stored ask's,
 * or a new one naming a review), or proposes a goal in a review (a `proposedIn` that differs from the stored goal's).
 * What a save carries along unchanged is not: answering a question raised in a review, editing a goal once proposed in
 * one, or the reviews a person leaves when marked as left, or a carried goal joins. `stored` is the whole workspace as
 * loaded.
 */
export function writesReviews(c: Commit, stored: Pick<Snapshot, 'goals' | 'reviews' | 'requests' | 'checkIns'> & { proposed?: Snapshot['goals'] }): boolean {
  if ((c.changes ?? []).some((x) => x.entity === 'review' || x.entity === 'decision')) return true;
  if (c.decisions?.length) return true;
  if (c.reviews?.some((r) => !stored.reviews.some((v) => v.id === r.id))) return true;
  const goal = (id: string) => stored.goals.find((g) => g.id === id) ?? stored.proposed?.find((g) => g.id === id);
  if (c.goals?.some((g) => !!g.proposedIn && g.proposedIn !== (goal(g.id)?.proposedIn ?? null))) return true;
  if (c.requests?.some((a) => !!a.reviewId)) {
    const asks = asksOf(stored);
    if (c.requests.some((a) => !!a.reviewId && a.reviewId !== (asks.find((x) => x.id === a.id)?.reviewId ?? null))) return true;
  }
  return false;
}
