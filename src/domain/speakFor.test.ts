// @vitest-environment node
/* Who may speak for a review (RV7, docs/design/reviews/spec.md section 3, Lane's decision 1): someone in it, or an admin.
   Everyone may still read it, and ask or agree a next step on a goal's own page. */
import { buildPlatformOrg } from '../data/platformOrg';
import { acceptRisk, addAction, askQuestion, markReviewed, NotAllowed, reviewCall, type ActionContext } from './actions';
import { currentCycle, scopeToCycle } from './cycle';
import { currentWeek } from './plan';
import { canSpeakFor, goalsIn, joinLine, reviewSession, scopeRefusal, speakRefusal } from './review';

const day = new Date('2026-11-11T12:00:00Z');
const full = buildPlatformOrg(day);
const c = currentCycle(full.cycles, day)!;
const wk = currentWeek(c, day);
const snap = scopeToCycle(full, c);
let n = 0;
const x = (who: string): ActionContext => ({ snapshot: snap, cycle: c, week: wk, actor: full.people.find((p) => p.id === who)!, now: '2026-11-11T12:00:00Z', newId: (p) => `${p}-sp-${++n}`, allGoals: snap.goals, full });
const review = full.reviews.find((r) => r.id === 'devprod')!;
const member = review.people.find((id) => !full.people.find((p) => p.id === id)!.admin)!;
const outsider = full.people.find((p) => !p.admin && !review.people.includes(p.id) && p.id !== review.createdBy)!.id;
const admin = full.people.find((p) => p.admin && !review.people.includes(p.id))!.id;
const goal = reviewSession(review, snap, c, day, wk).items.map((a) => a.goal).find((g) => g.ownerId !== outsider && g.ownerId !== member)!;
const refused = (f: () => unknown) => { try { f(); return 'allowed'; } catch (e) { return e instanceof NotAllowed ? e.message : String(e); } };

describe('who may speak for a review (RV7)', () => {
  it('someone in it, or an admin; nobody else', () => {
    expect(canSpeakFor(review, full.people.find((p) => p.id === member)!)).toBe(true);
    expect(canSpeakFor(review, full.people.find((p) => p.id === admin)!)).toBe(true);
    expect(canSpeakFor(review, full.people.find((p) => p.id === outsider)!)).toBe(false);
  });
  it('refuses reviewed, a note, the risk accepted, a question and a next step in it from someone not in it, with one sentence', () => {
    const say = speakRefusal(review);
    expect(say).toBe('Only people in Developer Productivity fortnightly, or an admin, can speak for it.');
    expect(refused(() => reviewCall(x(outsider), goal, review, 'acknowledge', ''))).toBe(say);
    expect(refused(() => reviewCall(x(outsider), goal, review, 'note', 'Talked it through'))).toBe(say);
    expect(refused(() => markReviewed(x(outsider), [goal], review, wk))).toBe(say);
    expect(refused(() => acceptRisk(x(outsider), goal, review, 'The vendor fix lands next week, so we wait.', wk))).toBe(say);
    expect(refused(() => askQuestion(x(outsider), goal, 'What blocks it?', { reviewId: review.id, week: wk }))).toBe(say);
    expect(refused(() => addAction(x(outsider), goal, 'Pair with SRE', { reviewId: review.id, week: wk }))).toBe(say);
  });
  it('lets a member and an admin speak for it', () => {
    expect(refused(() => reviewCall(x(member), goal, review, 'acknowledge', ''))).toBe('allowed');
    expect(refused(() => reviewCall(x(admin), goal, review, 'note', 'Talked it through'))).toBe('allowed');
  });
  it('leaves a question and a next step on a goal’s own page open to anyone', () => {
    expect(refused(() => askQuestion(x(outsider), goal, 'What blocks it?'))).toBe('allowed');
    expect(refused(() => addAction(x(outsider), goal, 'Pair with SRE'))).toBe('allowed');
  });
  it('tells someone not in it who can add them: its people and whoever set it up, up to six, then how many more', () => {
    const names: Record<string, string> = { a: 'Ana', b: 'Ben', c: 'Cy', d: 'Di', e: 'Ed', f: 'Flo', g: 'Gus' };
    expect(joinLine({ people: ['a'], createdBy: 'a' }, (id) => names[id] ?? null)).toBe('You’re not in this review. Ana or an admin can add you.');
    expect(joinLine({ people: ['a', 'b'], createdBy: 'c' }, (id) => names[id] ?? null)).toBe('You’re not in this review. Ana, Ben, Cy or an admin can add you.');
    expect(joinLine({ people: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], createdBy: 'a' }, (id) => names[id] ?? null)).toBe('You’re not in this review. Ana, Ben, Cy, Di, Ed, Flo and 1 more or an admin can add you.');
  });
  it('refuses anything said in it about a goal it doesn’t walk, from a member and an admin alike (build review of #322)', () => {
    const outside = snap.goals.find((g) => !goalsIn(review.scope, snap.goals).some((v) => v.id === g.id) && g.ownerId !== member && g.ownerId !== admin)!;
    const say = scopeRefusal(review, outside);
    expect(say).toBe(`Developer Productivity fortnightly doesn’t cover ${outside.title}, so nothing can be said about it there.`);
    for (const who of [member, admin]) {
      expect(refused(() => reviewCall(x(who), outside, review, 'acknowledge', ''))).toBe(say);
      expect(refused(() => acceptRisk(x(who), outside, review, 'The vendor fix lands next week, so we wait.', wk))).toBe(say);
      expect(refused(() => askQuestion(x(who), outside, 'What blocks it?', { reviewId: review.id, week: wk }))).toBe(say);
      expect(refused(() => addAction(x(who), outside, 'Pair with SRE', { reviewId: review.id, week: wk }))).toBe(say);
    }
  });
});
