// @vitest-environment node
/* Reviews behind its switch (FT2, docs/design/feature-toggles/spec.md 4.2): what the read-back before switching it off
   counts and says. Nothing is changed by switching off: the counts are what stays. */
import { buildPlatformOrg } from '../data/platformOrg';
import { asksOf } from './asks';
import { acceptNote } from './decide';
import { switchOffLines, switchOffReadBack } from './reviewsOff';

const s = buildPlatformOrg(new Date('2026-11-12T12:00:00Z'));
const reads = { people: s.people, reviews: s.reviews, changes: s.changes, asks: asksOf(s), decisions: s.decisions, goals: s.goals, dueDay: 'Thursday' };

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
      decisions: [], goals: [], dueDay: 'Thursday',
    });
    expect(r).toEqual({ people: 2, reviews: 1, said: 2, steps: 1, questions: 2, risks: 0, dueDay: 'Thursday' });
  });

  it('says each line only when its count is above nought; the first, the due day’s and the last always', () => {
    const lines = (r: Parameters<typeof switchOffLines>[0]) => switchOffLines(r).map((l) => l.strong + l.rest);
    expect(lines({ people: 30, reviews: 6, said: 41, steps: 3, questions: 1, risks: 2, dueDay: 'Thursday' })).toEqual([
      'Reviews leaves the menu, and Home’s “Next review”.',
      '6 reviews stay in the record, with the 41 things said or marked in them. Each goal’s History still shows them.',
      '3 open next steps agreed in a review stay open on their goals and on Home.',
      '1 question waiting for a review stays open; it no longer names a session.',
      '2 accepted risks stay on their goals, as they were said. No new one can be accepted while Reviews is off.',
      'Check-ins are still due by Thursday. “Before the review” becomes “by Thursday” on Home, in the check-in and in the count of goals checked in on time.',
      'Nothing is deleted. Switch Reviews back on and every review is as it was.',
    ]);
    expect(lines({ people: 2, reviews: 0, said: 0, steps: 0, questions: 0, risks: 0, dueDay: 'Monday' })).toEqual([
      'Reviews leaves the menu, and Home’s “Next review”.',
      'Check-ins are still due by Monday. “Before the review” becomes “by Monday” on Home, in the check-in and in the count of goals checked in on time.',
      'Nothing is deleted. Switch Reviews back on and every review is as it was.',
    ]);
  });

  it('RS2: counts the risks a review accepted on goals not removed, leaving out a removed note, another note and a removed goal', () => {
    const d = (goalId: string, note: string, removedAt: string | null = null) => ({ goalId, kind: 'note' as const, note, removedAt });
    const r = switchOffReadBack({
      people: [], reviews: [], changes: [], asks: [], dueDay: 'Thursday',
      goals: [{ id: 'a' }, { id: 'b' }, { id: 'gone', removedAt: '2026-11-01' }],
      decisions: [d('a', acceptNote('Supplier slip, back by week 48')), d('b', acceptNote('Waiting on legal')), d('a', acceptNote('Said twice'), '2026-11-02'), d('b', 'Just a note'), d('gone', acceptNote('On a removed goal'))],
    });
    expect([r.risks, r.dueDay]).toEqual([2, 'Thursday']);
    expect(switchOffLines({ ...r, people: 1, reviews: 0, said: 0, steps: 0, questions: 0, risks: 1 }).map((l) => l.strong + l.rest)).toContain('1 accepted risk stays on its goal, as it was said. No new one can be accepted while Reviews is off.');
  });

  it('RS2: the demo’s accepted risks are its notes that start “We accept the risk:”', () => {
    const r = switchOffReadBack(reads);
    expect(r.risks).toBe(s.decisions.filter((x) => x.kind === 'note' && !x.removedAt && x.note.startsWith('We accept the risk: ') && s.goals.some((g) => g.id === x.goalId && !g.removedAt)).length);
  });
});
