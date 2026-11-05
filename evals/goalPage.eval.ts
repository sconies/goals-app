/* The flagship goal page (approved by Lane, 5 Nov): what each part says, from the domain, in plain numbers on the example
   data. Each case is tagged with the requirement it holds up. */
import { describe, expect, it } from 'vitest';
import { seed } from '../src/data/seed';
import { EXAMPLES } from '../src/data/examples';
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
const support = EXAMPLES.find((e) => e.workspace.id === 'example-support')!.build(today);
const sCycle = support.cycles[0]!;
const status = (id: string, snap: Snapshot = s) => goalStatus(goal(id, snap), snap.cycles[0]!, snap.checkIns, today).status;

describe('the summary bar', () => {
  it(R('GOAL-PAGE-BAR', 'the CSAT north star: its number against plan and target in its own units, heading, why, and who is on it'), () => {
    const g = goal('csat', support);
    const f = barFigures(g, support, sCycle, week, false);
    expect(f.now).toMatch(/^\d+%$/);
    expect(f.against[0]).toMatch(/^plan \d+%$/);
    expect(f.against[1]).toMatch(/^target 88%$/);
    expect(['worsening', 'flat', 'recovering']).toContain(f.direction);
    // In points, never a share of planned progress (Lane, 5 Nov).
    expect(f.directionText).toMatch(/pts? (behind|against|ahead of) plan/);
    expect(f.directionText).not.toMatch(/of plan/);
    const why = whyLine(g, support, attentionFor(g, support, sCycle, today));
    expect(why.text).toMatch(/^Billing questions doubled/);
    expect(why.handledText).toMatch(/^(being handled: |nobody on it yet$)/);
    const feeds = feedsLine(support.goals.filter((x) => x.parentId === 'csat'), (x) => status(x.id, support));
    expect(feeds?.text).toMatch(/^Fed by three goals: 1 off track/);
  });

  it(R('GOAL-PAGE-BAR', 'a range says where it is against its limit; dated stages say how many are done and which are slipping'), () => {
    expect(barFigures(goal('cfr'), s, cycle, week, false).against).toEqual(expect.arrayContaining(['at most 12.0%']));
    expect(barFigures(goal('cfr'), s, cycle, week, false).against.join(' ')).toMatch(/(inside|outside) the limit/);
    const m = barFigures(goal('access'), s, cycle, week, false);
    expect(m.now).toBe('2 of 4 stages done');
    expect(m.against[0]).toBe('2 stages slipping');
  });

  it(R('GOAL-PAGE-BAR', 'one main action by who is looking and what is waiting'), () => {
    const g = goal('env');
    const p = (who: string, extra: Partial<Parameters<typeof primaryAction>[0]> = {}) => primaryAction({ goal: g, viewer: s.people.find((x) => x.id === who)!, owner: s.people.find((x) => x.id === g.ownerId), status: status('env'), due: true, week, asked: [], updateAsked: false, watching: false, ...extra });
    expect(p('elena').label).toBe('Ask Jonas for an update');
    expect(p('elena', { updateAsked: true }).kind).toBe('watch');
    expect(p('jonas').label).toBe(`Check in for week ${week}`);
    expect(p('jonas', { asked: [{ id: 'd1', kind: 'question', fromId: 'elena', fromFirst: 'Elena', text: 'When?', at: '', where: null }] }).label).toBe('Answer Elena’s question');
  });
});

describe('one home for each fact', () => {
  it(R('GOAL-PAGE-ONCE', 'a reason given week after week is said once in the activity, and later repeats point back to it'), () => {
    const stream = activityStream(goal('csat', support), support);
    const reasons = stream.flatMap((x) => (x.kind === 'checkins' && x.sameAs == null ? [x.why] : x.kind === 'checkin' && x.sameAs == null && x.checkIn.why !== 'On plan.' ? [x.checkIn.why] : []));
    expect(new Set(reasons).size).toBe(reasons.length);
    const group = stream.find((x) => x.kind === 'checkins');
    expect(group && group.kind === 'checkins' && group.from < group.to).toBe(true);
  });

  it(R('GOAL-PAGE-ONCE', 'what is being done is one list: the path to green, requests and review actions, each open, done or overdue'), () => {
    const g = goal('head');
    const st = goalStatus(g, cycle, s.checkIns, today);
    const items = actionList(g, s, week, st.status, st.latest);
    expect(items.some((x) => x.kind === 'path')).toBe(true);
    expect(items.some((x) => x.kind === 'request' && x.who === 'elena' && x.state === 'open')).toBe(true);
    expect(items.every((x) => ['open', 'done', 'overdue'].includes(x.state))).toBe(true);
    // The owner's date, checked against the trend, without restating the week.
    const check = pathCheck(g, s, cycle, week, st.latest);
    expect(check?.check ?? '').toMatch(/^(The recent trend|Too few|The stages|.+ said it would be back on plan by week \d+; that week has passed\.)/);
  });

  it(R('GOAL-PAGE-ONCE', 'last time we talked: the review that discussed it and what was said; or when it will be'), () => {
    const t = lastTalked(goal('head'), s, cycle, week, today, status('head'));
    expect(t.held?.review).toBe('Platform weekly review');
    expect(t.held?.said[0]?.note).toMatch(/^Brain and GPU quota/);
    const none = lastTalked(goal('cfr'), s, cycle, week, today, status('cfr'));
    expect(none.held).toBeNull();
    expect(none.next?.weekday).toMatch(/day$/);
  });
});

describe('how you arrived', () => {
  it(R('GOAL-PAGE-INTENT', 'what is asked of you on a goal: the request you were asked, and a comment only when you came to reply'), () => {
    const elena = s.people.find((p) => p.id === 'elena')!;
    expect(askedOf(goal('head'), s, elena, null, null).map((x) => x.kind)).toEqual(['request']);
    const comment = s.changes.find((c) => c.entity === 'note' && c.goalId === 'head' && c.actorId !== 'elena');
    if (comment) expect(askedOf(goal('head'), s, elena, null, comment.id).some((x) => x.id === comment.id)).toBe(true);
  });

  it(R('GOAL-PAGE-INTENT', 'after posting, since you looked, and a first look each say it in one line'), () => {
    expect(postedLine(goal('alerts'), s, cycle, week)?.text).toMatch(/^Posted: (.+ → .+|still .+)( · \d+ weeks on time)?$/);
    const since = sinceLooked(goal('access'), s, { at: '2026-10-27T09:00:00.000Z', status: 'risk' }, status('access'), today);
    expect(since.text).toMatch(/^Since you looked on Tuesday: .*at risk → off track\.$/);
    expect(sinceLooked(goal('access'), s, { at: today.toISOString(), status: status('access') }, status('access'), today).text).toBe('Nothing new since you looked earlier today.');
    expect(firstLook(goal('head'))).toMatch(/^What it measures: .+ \(from .+\)\.$/);
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
    const g = goal('alerts');
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
    const g = goal('csat', support);
    const svg = shareCardSvg({
      workspace: 'Customer Support', title: g.title + ' <&>', owner: 'Hana Okafor', meta: 'North star · G-1', status: 'off', statusWord: 'Off track',
      now: '83%', against: 'plan 86% · target 88%', why: 'Billing questions doubled after the price change and those score lowest.', when: 'Week 44',
      link: 'https://goals.example/goals/G-1',
      chart: g.kind === 'metric' ? { goal: g, weeks: sCycle.weeks, week, series: [{ week: 40, value: 84 }, { week: 44, value: 83 }], projection: { value: 83, low: 80, high: 86, week: 53, from: 40, to: 44, slope: 0 } } : null,
    });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"')).toBe(true);
    expect(svg).toContain('Off track');
    expect(svg).toContain('&lt;&amp;&gt;');
    expect(svg).toContain('goals.example/goals/G-1');
    expect(svg).toContain('<polygon');
    expect(wrap('one two three four five six seven', 9, 2)).toEqual(['one two', 'three…']);
  });
});
