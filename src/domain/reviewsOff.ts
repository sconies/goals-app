/* Switching Reviews off (FT2: docs/design/feature-toggles/spec.md 4.2): what the read-back an admin sees first counts
   and says. Its own file, not review.ts (where the spec placed it until FT3 moves it into the module), because review.ts
   is in the first download and this is read only by Workspace, which loads when it is opened. */
import type { Ask, Review } from './types';

/** What switching Reviews off keeps, counted for the read-back an admin sees first. */
export interface ReviewsReadBack {
  /** Everyone here: "For all {n} people here". */
  people: number;
  /** Reviews set up and not ended or removed: they leave the menu, and stay in the record. */
  reviews: number;
  /** Things said or marked in reviews: the changes Activity counts under Reviews. */
  said: number;
  /** Open next steps agreed in a review: they stay open on their goals and on Home. */
  steps: number;
  /** Open questions raised in a review: they stay open and no longer name a session. */
  questions: number;
}

/**
 * Rule (FT2). What the read-back before switching Reviews off counts, from what it reads: everyone here; reviews not
 * removed or ended; the changes with entity review or decision (the number Activity shows under Reviews); and the open
 * next steps and open questions raised in a review. Nothing here is changed by switching off: the counts are what stays.
 */
export function switchOffReadBack(reads: { people: readonly { removedAt?: string | null }[]; reviews: readonly Pick<Review, 'endedAt' | 'removedAt'>[]; changes: readonly { entity: string }[]; asks: readonly Pick<Ask, 'kind' | 'status' | 'reviewId'>[] }): ReviewsReadBack {
  const open = (kind: Ask['kind']) => reads.asks.filter((a) => a.kind === kind && a.status === 'open' && !!a.reviewId).length;
  return {
    people: reads.people.filter((p) => !p.removedAt).length,
    reviews: reads.reviews.filter((r) => !r.removedAt && !r.endedAt).length,
    said: reads.changes.filter((c) => c.entity === 'review' || c.entity === 'decision').length,
    steps: open('action'),
    questions: open('question'),
  };
}

/** The read-back's lines, in order: the first and last always, each other only when its count is above nought. */
export function switchOffLines(r: ReviewsReadBack): { strong: string; rest: string }[] {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return [
    { strong: 'Reviews leaves the menu', rest: ', and Home’s “Next review”.' },
    ...(r.reviews ? [{ strong: `${n(r.reviews, 'review stays', 'reviews stay')} in the record`, rest: `${r.said ? `, with the ${n(r.said, 'thing', 'things')} said or marked in ${r.reviews === 1 ? 'it' : 'them'}` : ''}. Each goal’s History still shows ${r.reviews === 1 ? 'it' : 'them'}.` }] : []),
    ...(r.steps ? [{ strong: `${n(r.steps, 'open next step', 'open next steps')} agreed in a review ${r.steps === 1 ? 'stays' : 'stay'} open`, rest: ' on their goals and on Home.' }] : []),
    ...(r.questions ? [{ strong: `${n(r.questions, 'question', 'questions')} waiting for a review`, rest: ` ${r.questions === 1 ? 'stays' : 'stay'} open; ${r.questions === 1 ? 'it no longer names' : 'they no longer name'} a session.` }] : []),
    { strong: '', rest: 'Nothing is deleted. Switch Reviews back on and every review is as it was.' },
  ];
}
