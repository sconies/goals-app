/* Lane's review notes (5 Nov), reviews: where each review's session stands, as the Reviews page says it. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import { currentWeek } from '../src/domain/plan';
import { lastHeld, openActions, reviewSession, sessionState, sessionStateText } from '../src/domain/review';
import type { Ask, Decision } from '../src/domain/types';

const R = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-11-05T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const review = s.reviews.find((r) => r.id === 'weekly')!;
const said = (goalId: string, kind: Decision['kind'], at: string, extra: Partial<Decision> = {}): Decision => ({ id: `${kind}_${goalId}_${at}`, goalId, checkInId: null, reviewId: review.id, week: reviewSession(review, s, cycle, today, week).week, kind, byId: 'amara', at, note: kind === 'acknowledge' ? '' : 'Agreed', ...extra });

describe('a review session, as the Reviews page reports it', () => {
  const fresh = reviewSession(review, s, cycle, today, week);
  it(R('REVIEW-LIST-STATE', 'a session nobody has opened is not started'), () => expect(sessionStateText(sessionState(fresh))).toBe('Not started'));
  it(R('REVIEW-LIST-STATE', 'three goals reviewed of the whole set is in progress, three of N'), () => {
    const three = fresh.items.slice(0, 3).map((a) => said(a.goal.id, 'acknowledge', '2026-11-05T10:00:00Z'));
    const x = reviewSession(review, { ...s, decisions: [...s.decisions, ...three] }, cycle, today, week);
    expect(sessionStateText(sessionState(x))).toBe(`In progress · 3 of ${fresh.total} reviewed`);
  });
  it(R('REVIEW-LIST-STATE', 'every goal reviewed on Thursday 5 November is held that day'), () => {
    const all = fresh.items.map((a) => said(a.goal.id, 'acknowledge', '2026-11-05T10:00:00Z'));
    const x = reviewSession(review, { ...s, decisions: [...s.decisions, ...all] }, cycle, today, week);
    expect(sessionStateText(sessionState(x))).toBe('Held Thu 5 Nov');
  });
  it(R('REVIEW-LIST-STATE', 'last week’s note means it was last held last week'), () => {
    expect(lastHeld(review, s, fresh.week)?.week).toBe(fresh.week - 1);
  });
  it(R('ONE-ASK', 'an action stays open until it’s marked done or withdrawn: one due last week is overdue, not gone'), () => {
    const act = (id: string, dueWeek: number | null, status: Ask['status'] = 'open'): Ask => ({ id, kind: 'action', goalIds: ['ns-lead'], askedBy: 'amara', recipientId: 'rhea', ask: 'Agreed', status, dueWeek, reviewId: review.id, week: fresh.week, checkInId: null, createdAt: '2026-11-05T10:00:00Z', updatedAt: '2026-11-05T10:00:00Z', answer: null, answeredBy: null, answeredAt: null });
    const acts = [act('old', week - 1), act('next', week + 1), act('open', null), act('done', week - 1, 'done'), act('gone', null, 'withdrawn')];
    const ids = new Set(acts.map((a) => a.id));
    expect(openActions(review, { ...s, requests: [...(s.requests ?? []), ...acts] }).map((d) => d.id).filter((id) => ids.has(id)).sort()).toEqual(['next', 'old', 'open']);
  });
});
