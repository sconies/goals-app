// @vitest-environment node
/* Reviews behind its switch (FT2, docs/design/feature-toggles/spec.md 4.2): what the read-back before switching it off
   counts and says. Nothing is changed by switching off: the counts are what stays. */
import { buildPlatformOrg } from '../data/platformOrg';
import { asksOf } from './asks';
import { switchOffLines, switchOffReadBack } from './reviewsOff';

const s = buildPlatformOrg(new Date('2026-11-12T12:00:00Z'));
const reads = { people: s.people, reviews: s.reviews, changes: s.changes, asks: asksOf(s) };

describe('the read-back before switching Reviews off', () => {
  it('counts the demo’s live reviews, what was said in them, and the open asks raised in one', () => {
    const r = switchOffReadBack(reads);
    expect(r.people).toBe(s.people.length);
    expect(r.reviews).toBe(s.reviews.filter((x) => !x.removedAt && !x.endedAt).length);
    expect(r.reviews).toBe(6);
    expect(r.said).toBe(s.changes.filter((c) => c.entity === 'review' || c.entity === 'decision').length);
    expect(r.steps).toBe(asksOf(s).filter((a) => a.kind === 'action' && a.status === 'open' && a.reviewId).length);
    expect(r.questions).toBe(asksOf(s).filter((a) => a.kind === 'question' && a.status === 'open' && a.reviewId).length);
  });

  it('leaves out an ended or removed review, an answered ask and an ask raised outside a review', () => {
    const r = switchOffReadBack({
      people: [{}, {}, { removedAt: '2026-11-01' }],
      reviews: [{}, { endedAt: '2026-11-01' }, { removedAt: '2026-11-01' }],
      changes: [{ entity: 'review' }, { entity: 'decision' }, { entity: 'goal' }],
      asks: [
        { kind: 'action', status: 'open', reviewId: 'weekly' }, { kind: 'action', status: 'done', reviewId: 'weekly' }, { kind: 'action', status: 'open', reviewId: null },
        { kind: 'question', status: 'open', reviewId: 'weekly' }, { kind: 'question', status: 'open', reviewId: 'weekly' }, { kind: 'update', status: 'open', reviewId: 'weekly' },
      ],
    });
    expect(r).toEqual({ people: 2, reviews: 1, said: 2, steps: 1, questions: 2 });
  });

  it('says each line only when its count is above nought, the first and last always', () => {
    const lines = (r: Parameters<typeof switchOffLines>[0]) => switchOffLines(r).map((l) => l.strong + l.rest);
    expect(lines({ people: 30, reviews: 6, said: 41, steps: 3, questions: 1 })).toEqual([
      'Reviews leaves the menu, and Home’s “Next review”.',
      '6 reviews stay in the record, with the 41 things said or marked in them. Each goal’s History still shows them.',
      '3 open next steps agreed in a review stay open on their goals and on Home.',
      '1 question waiting for a review stays open; it no longer names a session.',
      'Nothing is deleted. Switch Reviews back on and every review is as it was.',
    ]);
    expect(lines({ people: 2, reviews: 0, said: 0, steps: 0, questions: 0 })).toEqual([
      'Reviews leaves the menu, and Home’s “Next review”.',
      'Nothing is deleted. Switch Reviews back on and every review is as it was.',
    ]);
  });
});
