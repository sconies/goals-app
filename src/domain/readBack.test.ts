/* The read-back (goal entry, rule 5; GE3): every worked example in docs/design/goal-entry/spec.md, rule 5. */
import { describe, expect, it } from 'vitest';
import { blankGoal, type GoalDraft } from './goal';
import { leftAsUsual, readBack, reviewsJoining, type ReadBackContext } from './readBack';
import type { Cycle, Goal, Review } from './types';

const cycle = { id: 'c', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 } as Cycle;
const wed = new Date('2026-11-11T12:00:00Z');
const draft = (o: Partial<GoalDraft> = {}): GoalDraft => ({ ...blankGoal('br', 'tunde', 'g41'), title: 'Signed artifacts in staging', unit: '%', start: '40', target: '90', endWeek: '', ...o });
const ctx = (o: Partial<ReadBackContext> = {}): ReadBackContext => ({
  cycle, week: 46, today: wed, level: 'team', owner: { name: 'Tunde Bakare', isViewer: true }, teamName: 'Build & Release',
  parent: { title: 'Lead time for changes', key: 'G-41' }, alsoHelps: [], metric: null, answers: [], rhythm: 'weekly', reviewsOn: true, reviewsJoined: [], wsName: 'Platform Engineering', ...o,
});
const row = (d: GoalDraft, c: ReadBackContext, id: string) => readBack(d, c).rows.find((r) => r.id === id)?.text;

describe('the read-back (rule 5)', () => {
  it('reads a number to move back with its weeks, and when its first check-in is due (Wednesday 11 Nov)', () => {
    const rb = readBack(draft(), ctx());
    expect(row(draft(), ctx(), 'what')).toBe('A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better.');
    expect(rb.after[0]).toBe('Its first check-in is due by Thursday 12 Nov, then every week. The first number sets where it stands; the plan says 47% for week 47.');
    expect(row(draft(), ctx(), 'who')).toBe('Tunde Bakare owns it, in Build & Release. It’s a Team goal and feeds “Lead time for changes” (G-41).');
  });

  it('published on Friday 13 Nov, it is due the Thursday after', () => {
    expect(readBack(draft(), ctx({ today: new Date('2026-11-13T12:00:00Z'), week: 46 })).after[0]).toBe('Its first check-in is due by Thursday 19 Nov, then every week. The first number sets where it stands; the plan says 47% for week 47.');
  });

  it('with no rhythm, nothing is due and no weekday is named', () => {
    const after = readBack(draft(), ctx({ rhythm: 'none' })).after.join(' ');
    expect(after).toContain('It shows as “No check-in yet” until you post its first number. Nothing is due.');
    expect(after).not.toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
  });

  it('for someone else, says who sees it and who can change it', () => {
    const after = readBack(draft({ ownerId: 'amara' }), ctx({ owner: { name: 'Amara Okafor', isViewer: false } })).after;
    expect(after).toContain('Amara sees it on their Home the next time they open Faro. Faro doesn’t send email.');
    expect(after).toContain('Only Amara or an admin can change it once it is published. Until its first check-in they can change anything, or delete it.');
    expect(readBack(draft(), ctx()).after).toContain('Everyone in Platform Engineering can see it.');
  });

  it('names the review it joins, and with Reviews off has no review line', () => {
    const joined = [{ name: 'Platform leadership weekly', why: 'every north star' }];
    expect(readBack(draft(), ctx({ reviewsJoined: joined })).after).toContain('It joins Platform leadership weekly, which walks every north star.');
    expect(readBack(draft(), ctx({ reviewsJoined: [] })).after).toContain('It joins no review yet.');
    expect(readBack(draft(), ctx({ reviewsOn: false, reviewsJoined: joined })).after.join(' ')).not.toMatch(/joins/);
  });

  it('a range at most 12%, no margin; and with one', () => {
    const r = draft({ kind: 'range', limit: '12', margin: '' });
    expect(row(r, ctx(), 'what')).toBe('A number to keep in range: at or under 12%. It warns only once the limit is crossed.');
    expect(row({ ...r, margin: '1' }, ctx(), 'what')).toBe('A number to keep in range: at or under 12%. It warns within 1% of the limit.');
    expect(readBack(r, ctx()).after[0]).toBe('Its first check-in is due by Thursday 12 Nov, then every week. It asks for this week’s number.');
  });

  it('one stage due week 50 is “1 stage”, never “1 stages”', () => {
    const s = draft({ kind: 'milestone', stages: [{ id: 's1', name: 'Pilot', dueWeek: '50' }] });
    expect(row(s, ctx(), 'what')).toBe('Dated stages: 1 stage, the last due week 50 (7–13 Dec 2026).');
    expect(readBack(s, ctx()).rows.some((r) => r.id === 'measured')).toBe(false);
    const done = draft({ kind: 'milestone', stages: [{ id: 's1', name: 'Design', dueWeek: '40', done: 'yes' }, { id: 's2', name: 'Pilot', dueWeek: '50' }] });
    expect(row(done, ctx(), 'what')).toBe('Dated stages: 2 stages, the last due week 50 (7–13 Dec 2026). 1 stage is already done.');
  });

  it('says every default not changed, and Change goes to the first; nothing defaulted, no row', () => {
    expect(leftAsUsual(draft({ parentId: '' }), ctx()).map((u) => u.text).join(' ')).toBe('Whole numbers. From this week to the end of 2026. Steady. Feeds nothing. Not a guardrail. Helps no other goal.');
    expect(readBack(draft(), ctx()).rows.find((r) => r.id === 'usual')?.step).toBe(2);
    const changed = draft({ decimals: '1', start: '40.5', fromWeek: '45', endWeek: '50', shape: 'back', guardrail: true, alsoHelps: ['g9'] });
    expect(readBack(changed, ctx({ alsoHelps: ['Merge-to-deploy time'] })).rows.some((r) => r.id === 'usual')).toBe(false);
    expect(row(changed, ctx({ alsoHelps: ['Merge-to-deploy time'] }), 'who')).toBe('Tunde Bakare owns it, in Build & Release. It’s a Team goal and feeds “Lead time for changes” (G-41). It also helps “Merge-to-deploy time”. It’s a guardrail.');
  });

  it('Measured by: the metric, a description or neither; You said: each answer', () => {
    expect(row(draft(), ctx({ metric: 'Lead time for changes, for CI/CD.' }), 'measured')).toBe('Lead time for changes, for CI/CD.');
    expect(row(draft({ definition: 'Share of images signed' }), ctx(), 'measured')).toBe('No metric: “Share of images signed”.');
    expect(row(draft(), ctx(), 'measured')).toBe('No metric, and not described yet.');
    expect(readBack(draft(), ctx()).rows.some((r) => r.id === 'said')).toBe(false);
    const said = readBack(draft(), ctx({ answers: ['You said 150% is right.'] })).rows.find((r) => r.id === 'said');
    expect(said).toEqual({ id: 'said', label: 'You said', text: 'You said 150% is right.', step: null });
  });

  it('a north star feeds nothing: the top of its own tree', () => {
    expect(row(draft({ parentId: '' }), ctx({ level: 'north-star', parent: null }), 'who')).toBe('Tunde Bakare owns it, in Build & Release. It’s a north star and feeds nothing: it’s at the top of its own tree.');
  });
});

describe('reviewsJoining', () => {
  const g = (id: string, level: Goal['level'], parentId: string | null = null) => ({ id, level, parentId, title: id === 'ns' ? 'Lead time for changes' : id, removedAt: null } as unknown as Goal);
  const goals = [g('ns', 'north-star'), g('svp', 'svp', 'ns')];
  const review = (name: string, scope: Partial<Review['scope']>, o: Partial<Review> = {}) => ({ id: name, name, scope: { goals: [], trees: [], levels: [], ...scope }, ...o } as Review);
  it('a level, a tree, neither, and an ended review', () => {
    const reviews = [review('Platform leadership weekly', { levels: ['north-star'] }), review('Lead time review', { trees: ['ns'] }), review('Old one', { trees: ['ns'] }, { endedAt: '2026-10-01' })];
    expect(reviewsJoining({ id: 'new', level: 'north-star', parentId: null, title: 'New' }, reviews, goals, cycle)).toEqual([{ name: 'Platform leadership weekly', why: 'every north star' }]);
    expect(reviewsJoining({ id: 'new', level: 'team', parentId: 'svp', title: 'New' }, reviews, goals, cycle)).toEqual([{ name: 'Lead time review', why: '“Lead time for changes” and what feeds it' }]);
    expect(reviewsJoining({ id: 'new', level: 'svp', parentId: null, title: 'New' }, [review('SVP review', { levels: ['svp'] })], goals, cycle)).toEqual([{ name: 'SVP review', why: 'every SVP goal' }]);
    expect(reviewsJoining({ id: 'new', level: 'team', parentId: null, title: 'New' }, reviews, goals, cycle)).toEqual([]);
  });
});
