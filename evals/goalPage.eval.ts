/* The flagship goal page (approved by Lane, 5 Nov): what each part says, from the domain, in plain numbers on the example
   data. Each case is tagged with the requirement it holds up. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import { attentionFor } from '../src/domain/attention';
import { actionList, activityStream, askedOf, barFigures, feedsLine, firstLook, lastTalked, pathCheck, postedLine, primaryAction, sinceLooked, whyLine } from '../src/domain/goalPage';
import { currentWeek, projection } from '../src/domain/plan';
import { assessPosted, goalStatus } from '../src/domain/status';
import { summarise } from '../src/domain/summary';
import { toJson } from '../src/domain/export';
import { shareCardSvg, wrap } from '../src/ui/shareCard';
import type { Snapshot } from '../src/domain/types';

const R = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const goal = (id: string, snap: Snapshot = s) => snap.goals.find((g) => g.id === id)!;
const status = (id: string, snap: Snapshot = s) => goalStatus(goal(id, snap), snap.cycles[0]!, snap.checkIns, today).status;

describe('the summary bar', () => {
  it(R('GOAL-PAGE-BAR', 'the lead time north star: its number against plan and target in its own units, heading, why, and who is on it'), () => {
    const g = goal('ns-lead');
    const f = barFigures(g, s, cycle, week, false);
    expect(f.now).toMatch(/^\d+ hours$/);
    expect(f.against[0]).toMatch(/^plan \d+ hours$/);
    expect(f.against[1]).toMatch(/^target 24 hours$/);
    expect(['worsening', 'flat', 'recovering']).toContain(f.direction);
    // In the goal's units, never a share of planned progress (Lane, 5 Nov).
    expect(f.directionText).toMatch(/hours (behind|against|ahead of) plan/);
    expect(f.directionText).not.toMatch(/of plan/);
    const why = whyLine(g, s, attentionFor(g, s, cycle, today));
    expect(why.text).toBeTruthy();
    expect(why.by).toMatch(/^Rhea, week \d+$/);
    expect(why.handledText).toMatch(/^(being handled: |no response yet$)/);
    const feeds = feedsLine(s.goals.filter((x) => x.parentId === 'ns-lead'), (x) => status(x.id));
    expect(feeds?.text).toMatch(/^Directly feeding it \(four goals\): 2 off track/);
  });

  it(R('GOAL-PAGE-BAR', 'a range says where it is against its limit; dated stages say how many are done and which are slipping or late'), () => {
    expect(barFigures(goal('ns-cfr'), s, cycle, week, false).against[0]).toMatch(/^at most [\d.]+%$/);
    expect(barFigures(goal('ns-cfr'), s, cycle, week, false).against.join(' ')).toMatch(/(inside|outside) the limit/);
    const m = barFigures(goal('lead-mq'), s, cycle, week, false);
    expect(m.now).toBe('2 of 4 stages done');
    // Both are more than two weeks behind their dates: late, in the vocabulary's stage words (up to two is slipping).
    expect(m.against[0]).toBe('2 stages late');
  });

  it(R('GOAL-PAGE-BAR', 'one main action by who is looking and what is waiting'), () => {
    const g = goal('env-search');
    const p = (who: string, extra: Partial<Parameters<typeof primaryAction>[0]> = {}) => primaryAction({ goal: g, viewer: s.people.find((x) => x.id === who)!, owner: s.people.find((x) => x.id === g.ownerId), status: status('env-search'), due: true, week, asked: [], updateAsked: false, watching: false, ...extra });
    expect(p('amara').label).toBe('Ask Kojo for an update');
    expect(p('amara', { updateAsked: true }).kind).toBe('watch');
    expect(p('kojo').label).toBe(`Check in for week ${week}`);
    expect(p('kojo', { asked: [{ id: 'd1', kind: 'question', fromId: 'amara', fromFirst: 'Amara', text: 'When?', at: '', where: null, due: null }] }).label).toBe('Answer Amara’s question');
    // An action of yours comes after a check-in that's due (ONE-ASK).
    const action = { id: 'a1', kind: 'action' as const, fromId: 'camille', fromFirst: 'Camille', text: 'Fix search ranking', at: '', where: null, due: week + 1 };
    expect(p('kojo', { asked: [action] }).kind).toBe('check-in');
    expect(p('kojo', { asked: [action], due: false })).toMatchObject({ kind: 'done', label: 'Mark your action done', targetId: 'a1' });
  });
});

describe('one home for each fact', () => {
  it(R('GOAL-PAGE-ONCE', 'a reason given week after week is said once in the activity, and later repeats point back to it'), () => {
    const stream = activityStream(goal('ns-lead'), s);
    const said = (why: string) => why.trim() !== '' && why !== 'On plan.';
    const reasons = stream.flatMap((x) => (x.kind === 'checkins' && x.sameAs == null ? [x.why] : x.kind === 'checkin' && x.sameAs == null && said(x.checkIn.why) ? [x.checkIn.why] : []));
    expect(new Set(reasons).size).toBe(reasons.length);
    // The same reason three weeks running is one group: "Weeks 42–44: …".
    const last3 = s.checkIns.filter((c) => c.goalId === 'ns-lead').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).slice(-3).map((c) => c.id);
    const same: Snapshot = { ...s, checkIns: s.checkIns.map((c) => (last3.includes(c.id) ? { ...c, why: 'The merge queue is still waiting on MergeFlow.', cause: 'external' as const } : c)) };
    const group = activityStream(goal('ns-lead'), same).find((x) => x.kind === 'checkins');
    expect(group && group.kind === 'checkins' && group.from < group.to).toBe(true);
  });

  it(R('GOAL-PAGE-ONCE', 'what is being done is one list: the path to green and every ask on the goal, each open, done or overdue by its own state'), () => {
    const g = goal('ns-lead');
    const st = goalStatus(g, cycle, s.checkIns, today);
    const items = actionList(g, s, week, st.status, st.latest, cycle);
    expect(items.some((x) => x.kind === 'path')).toBe(true);
    expect(items.some((x) => x.kind === 'decision' && x.who === 'amara' && x.state === 'open')).toBe(true);
    expect(items.some((x) => x.kind === 'action' && x.who === 'amara' && x.state === 'open' && x.due != null)).toBe(true);
    // Rhea's one-page case was marked done: done because it says so, not because its week passed.
    expect(items.find((x) => x.what.startsWith('One-page case for the Q4 runner budget'))?.state).toBe('done');
    expect(items.every((x) => ['open', 'done', 'overdue'].includes(x.state))).toBe(true);
    // The owner's date, checked against the trend, without restating the week.
    const merge = goal('lead-merge');
    const check = pathCheck(merge, s, cycle, week, goalStatus(merge, cycle, s.checkIns, today).latest);
    expect(check?.check ?? '').toMatch(/^(The recent trend|Too few|The stages|.+ said it would be back on plan by week \d+; that week has passed\.)/);
  });

  it(R('GOAL-PAGE-ONCE', 'last time we talked: the review that discussed it and what was said; or when it will be'), () => {
    const t = lastTalked(goal('ns-lead'), s, cycle, week, today);
    expect(t.held?.review).toBe('Platform leadership weekly');
    expect(t.held?.said.map((d) => d.note).join(' ')).toMatch(/Runner budget goes to finance/);
    expect(t.next?.weekday).toMatch(/day$/);
    const none = lastTalked(goal('cost-idle'), s, cycle, week, today);
    expect(none.held).toBeNull();
    expect(none.next).toBeNull();
  });
});

describe('how you arrived', () => {
  it(R('GOAL-PAGE-INTENT', 'what is asked of you on a goal: every ask waiting on you, and a comment only when you came to reply'), () => {
    const amara = s.people.find((p) => p.id === 'amara')!;
    expect(askedOf(goal('ns-lead'), s, amara, null).map((x) => x.kind)).toEqual(['decision', 'action']);
    const comment = s.changes.find((c) => c.entity === 'note' && c.goalId === 'ns-lead' && c.actorId !== 'amara');
    expect(comment).toBeTruthy();
    expect(askedOf(goal('ns-lead'), s, amara, comment!.id).some((x) => x.id === comment!.id && x.kind === 'comment')).toBe(true);
  });

  it(R('GOAL-PAGE-INTENT', 'after posting, since you looked, and a first look each say it in one line'), () => {
    expect(postedLine(goal('ns-lead'), s, cycle, week)?.text).toMatch(/^Posted: (.+ → .+|still .+)( · \d+ weeks on time)?$/);
    const since = sinceLooked(goal('lead-mq'), s, { at: '2026-10-27T09:00:00.000Z', status: 'risk' }, status('lead-mq'), today);
    expect(since.text).toMatch(/^Since you looked on Tuesday: .*at risk → off track\.$/);
    expect(sinceLooked(goal('lead-mq'), s, { at: today.toISOString(), status: status('lead-mq') }, status('lead-mq'), today).text).toBe('Nothing new since you looked earlier today.');
    expect(firstLook(goal('ns-lead'))).toMatch(/^What it measures: .+ \(from .+\)\.$/);
  });
});

describe('the projection, as a range, everywhere', () => {
  it(R('PROJECTION-RANGE', 'steady on a noisy number, exact on a clean trend'), () => {
    const noisy = [84, 81, 86, 82, 87, 80, 85, 83].map((value, i) => ({ week: 38 + i, value }));
    const a = projection([...noisy, { week: 46, value: 80 }], 53)!, b = projection([...noisy, { week: 46, value: 87 }], 53)!;
    expect(Math.abs(a.value - b.value)).toBeLessThan(5);
    expect(a.high - a.low).toBeGreaterThan(0);
    const clean = projection(noisy.map((x, i) => ({ week: x.week, value: 80 + i })), 53)!;
    expect(clean.value).toBeCloseTo(80 + 15);
    expect(clean.high - clean.low).toBeCloseTo(0);
  });

  it(R('PROJECTION-RANGE', 'the assessment, the goal summary, the export and the AI assistant’s get_goal carry the same range'), () => {
    const g = goal('ns-ai');
    const a = assessPosted(g, cycle, s.checkIns, week);
    const sum = summarise(g, s, cycle, today, week);
    expect(a.kind === 'metric' && a.projection).toBeTruthy();
    expect(sum.projection).toEqual(a.kind === 'metric' ? a.projection : null);
    const j = toJson({ ws: { id: 'example', name: 'Example' }, snapshot: s, cycle, week, today, goals: [g] });
    const now = (j.goals[0] as unknown as { now: { projection: { low: number; high: number; likeliest: number; byWeek: number } } }).now;
    expect(now.projection.low).toBeLessThanOrEqual(now.projection.likeliest);
    expect(now.projection.high).toBeGreaterThanOrEqual(now.projection.likeliest);
    expect(now.projection.byWeek).toBe(cycle.weeks);
    if (sum.forecast) expect(sum.forecast).toMatch(/\d+(–\d+)?%/);
  });
});

describe('share', () => {
  it(R('GOAL-SHARE', 'the card is one SVG of the summary bar and a small chart, with the link, and its words are escaped'), () => {
    const g = goal('ns-lead');
    const svg = shareCardSvg({
      workspace: 'Platform Engineering', title: g.title + ' <&>', owner: 'Rhea Kapoor', meta: 'North star · G-1', status: 'off', statusWord: 'Off track',
      now: '38 hours', against: 'plan 29 hours · target 24 hours', why: 'The merge queue and the runner pools are both on the critical path.', when: 'Week 44',
      link: 'https://goals.example/goals/G-1',
      chart: g.kind === 'metric' ? { goal: g, weeks: cycle.weeks, week, series: [{ week: 40, value: 36 }, { week: 44, value: 38 }], projection: { value: 39, low: 37, high: 41, week: 53, from: 40, to: 44, slope: 0.3 } } : null,
    });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"')).toBe(true);
    expect(svg).toContain('Off track');
    expect(svg).toContain('&lt;&amp;&gt;');
    expect(svg).toContain('goals.example/goals/G-1');
    expect(svg).toContain('<polygon');
    expect(wrap('one two three four five six seven', 9, 2)).toEqual(['one two', 'three…']);
  });
});
