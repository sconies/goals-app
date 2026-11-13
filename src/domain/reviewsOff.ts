/* Switching Reviews off (FT2: docs/design/feature-toggles/spec.md 4.2): what the read-back an admin sees first counts
   and says. Its own file, not review.ts (where the spec placed it until FT3 moves it into the module), because review.ts
   is in the first download and this is read only by Workspace, which loads when it is opened. */
import type { Ask, Decision, Review } from './types';
import { acceptedReason } from './decide';

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
  /** Risks a review accepted on goals not removed (RS2): they stay on their goals, as they were said. */
  risks: number;
  /** The day check-ins are due, by name ("Thursday", dueWords' `day`): it doesn't change (RS2). */
  dueDay: string;
}

/**
 * Rule (FT2). What the read-back before switching Reviews off counts, from what it reads: everyone here; reviews not
 * removed or ended; the changes with entity review or decision (the number Activity shows under Reviews); and the open
 * next steps and open questions raised in a review. Rule RS2 adds two: the risks a review accepted on goals not removed
 * (a note that starts "We accept the risk:", not itself removed), and the due day's name, from dueWords.
 * Nothing here is changed by switching off: the counts are what stays.
 */
export function switchOffReadBack(reads: {
  people: readonly { removedAt?: string | null }[]; reviews: readonly Pick<Review, 'endedAt' | 'removedAt'>[]; changes: readonly { entity: string }[]; asks: readonly Pick<Ask, 'kind' | 'status' | 'reviewId'>[];
  decisions: readonly Pick<Decision, 'goalId' | 'kind' | 'note' | 'removedAt'>[]; goals: readonly { id: string; removedAt?: string | null }[]; dueDay: string;
}): ReviewsReadBack {
  const live = new Set(reads.goals.filter((g) => !g.removedAt).map((g) => g.id));
  const open = (kind: Ask['kind']) => reads.asks.filter((a) => a.kind === kind && a.status === 'open' && !!a.reviewId).length;
  return {
    people: reads.people.filter((p) => !p.removedAt).length,
    reviews: reads.reviews.filter((r) => !r.removedAt && !r.endedAt).length,
    said: reads.changes.filter((c) => c.entity === 'review' || c.entity === 'decision').length,
    steps: open('action'),
    questions: open('question'),
    risks: reads.decisions.filter((d) => d.kind === 'note' && !d.removedAt && live.has(d.goalId) && acceptedReason(d.note) != null).length,
    dueDay: reads.dueDay,
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
    // RS2 (docs/design/round-4/reviews-switch/spec.md 2.2): after the questions line.
    ...(r.risks ? [{ strong: `${n(r.risks, 'accepted risk stays on its goal', 'accepted risks stay on their goals')}`, rest: ', as ' + (r.risks === 1 ? 'it was' : 'they were') + ' said. No new one can be accepted while Reviews is off.' }] : []),
    { strong: `Check-ins are still due by ${r.dueDay}.`, rest: ` “Before the review” becomes “by ${r.dueDay}” on Home, in the check-in and in the count of goals checked in on time.` },
    { strong: '', rest: 'Nothing is deleted. Switch Reviews back on and every review is as it was.' },
  ];
}
