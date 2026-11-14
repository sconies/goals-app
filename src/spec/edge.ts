/* The edge-case workspace (backlog item 11, Lane 14 Nov): a second, small workspace beside the demo, made so that the
   rules the demo never exercises are scored too. The full drill's stage 1 rebuild guessed three rules wrong and still
   scored 100% (docs/drill/2026-11-full-drill.md, gaps 1.3, 1.9 and 1.12), because the demo has no range kept between two
   bounds, no ties in posting time and no correction that should or shouldn't stop a moment. The records here are written
   by hand, as inputs; every expected row is made from them by the same code as the demo's (conformanceTables in
   conformance.ts), so no rule is restated here. Stored `calculated` on each check-in is what `evaluate` gives when it
   was posted, as the app stores it. `npm run spec` writes it to spec/conformance/edge/; the drill runs a rebuild on it
   as well as on the demo and scores stage 1's files from both. */
import { evaluate, draftFrom, emptyDraft } from '../domain/checkin';
import { goalAsOf } from '../domain/plan';
import type { CheckIn, Cycle, Goal, PathToGreen, Status } from '../domain/types';
import type { ConformanceWorkspace } from './conformance';

/** A 13-week goal year from Monday 5 January 2026, reviewed on Thursdays. */
const CYCLE: Cycle = { id: 'edge', name: 'Edge cases', startDate: '2026-01-05', weeks: 13, reviewDay: 3 };
const DAY = 86_400_000;
const start = Date.parse(CYCLE.startDate + 'T00:00:00Z');
/** A time in week `w`: `day` days after its Monday (0 Monday … 3 Thursday), at `hh:mm` UTC. */
const at = (w: number, day = 1, hh = 10, mm = 0) => new Date(start + (7 * w + day) * DAY + (hh * 60 + mm) * 60_000).toISOString();
/** Built for week 12's review day, Thursday 2 April 2026, at noon UTC. */
const BUILT_FOR = at(12, 3, 12);

const base = { cycleId: CYCLE.id, teamId: 'edge', io: 'output' as const, level: 'team', guardrail: false, parentId: null, effect: null, source: '', definition: '', createdAt: at(0, 0, 9) };
const metric = (key: string, id: string, title: string, unit: string, decimals: number, startV: number, target: number, more: Partial<Extract<Goal, { kind: 'metric' }>> = {}): Goal =>
  ({ ...base, id, key, ownerId: 'nia', title, kind: 'metric', unit, decimals, plan: { start: startV, target, shape: 'straight' }, originalPlan: null, rebaselinedWeek: null, ...more });
const range = (key: string, id: string, title: string, unit: string, decimals: number, r: Extract<Goal, { kind: 'range' }>['range']): Goal =>
  ({ ...base, id, key, ownerId: 'nia', title, kind: 'range', unit, decimals, range: r });

/**
 * The goals, each named for the edge it is there for. E-1 to E-3 are ranges at and either side of their bounds (gap 1.8,
 * and 1.14's order of a range's last numbers); E-4 and E-5 the numbers refused or only questioned for a share (1.9) and a
 * time or money unit below zero, refused or not by its unit (1.7, with E-10, E-11 and E-14); E-6 to E-8 the habit's moment across gaps and corrections (1.2, 1.3); E-9 and
 * E-10 ties in posting time (1.12); E-11 a plan that starts mid-year and a goal added late (1.6); E-12 being handled and
 * a new flag since (1.5); E-13 a goal stopped part-way through the year; E-15 a goal held to no number (1.6).
 */
export const EDGE_GOALS: Goal[] = [
  range('E-1', 'between', 'Availability kept between two bounds', '%', 2, { bound: 'between', lower: 99.5, limit: 99.95, margin: 0.1 }),
  range('E-2', 'at-most', 'Change failure rate at most 12%', '%', 1, { bound: 'atMost', limit: 12, margin: 2 }),
  range('E-3', 'at-least', 'Test coverage at least 80%', '%', 0, { bound: 'atLeast', limit: 80, margin: 5 }),
  metric('E-4', 'share', 'Signups who finish set-up', '%', 0, 30, 75),
  metric('E-5', 'not-share', 'Growth on last year', '%', 0, 50, 150),
  metric('E-6', 'gap-reach', 'Services with a runbook', '%', 0, 10, 50),
  metric('E-7', 'corrected', 'Alerts with an owner', '%', 0, 10, 50),
  metric('E-8', 'back-gap', 'Deploys a day', 'deploys', 0, 2, 12),
  metric('E-9', 'tie-same-week', 'Builds under ten minutes', '%', 0, 20, 80),
  metric('E-10', 'tie-two-weeks', 'Hours of on-call each week', 'h/week', 0, 30, 6),
  metric('E-11', 'late-plan', 'Cost per build', 'USD', 2, 4, 1, { createdAt: at(3, 2), plan: { start: 4, target: 1, shape: 'straight', fromWeek: 5 } }),
  metric('E-12', 'handled', 'Pages answered in five minutes', '%', 0, 40, 90),
  metric('E-13', 'stopped', 'Legacy jobs moved', 'jobs', 0, 0, 20, { stoppedAt: at(6, 2), stoppedBy: 'ada', stopReason: 'Folded into the platform goal.' }),
  metric('E-14', 'not-time', 'Cache warm-up time', 'ms', 0, 500, 200),
  metric('E-15', 'held', 'Customer effort score', 'pts', 1, 5, 3, { unmeasuredSince: at(0, 0, 9) }),
];

/** What each goal is there for, by key, for the conformance README: the case, in words, and the gap it closes. */
export const EDGE_NOTES: Record<string, string> = {
  'E-1': 'A range kept between 99.5 and 99.95 (margin 0.1): inside, near each bound, at each bound, past each bound, and back (1.8).',
  'E-2': 'At most 12 (margin 2): at the margin’s edge, inside it, at the limit and just past it (1.8).',
  'E-3': 'At least 80 (margin 5): the same from below, and two numbers for one week, the later posted the same day (1.14).',
  'E-4': 'A share planned from 30 to 75%: 110 and 400 are both refused as over 100% (1.9).',
  'E-5': 'Planned from 50 to 150%, so not a share: 120 is only questioned; −5% is refused (1.7, 1.9).',
  'E-6': 'The target met in week 2, nothing for week 3, met again in week 4: the week before is week 2, so no moment; met again in week 7 after falling short (1.3).',
  'E-7': 'Corrections: a second check-in for week 2 (no moment); week 5 posted before week 4, which then reaches the target (a moment); a late week; a backfilled week (no moment) (1.3).',
  'E-8': 'Behind in weeks 2, 3 and 5 with nothing for week 4, then on track: back 4; behind for one week: nothing (1.2).',
  'E-9': 'Two check-ins for one week posted at the same moment, twice, in each record order: the status keeps the first record, the calculation the last (1.12).',
  'E-10': 'Weeks 4 and 5 posted at the same moment: the status keeps week 4’s, the calculation week 5’s (1.12); later a time unit below zero, refused (1.7).',
  'E-11': 'Added in week 3 with a plan from week 5: nothing due before it (1.6); money below zero, refused (1.7).',
  'E-12': 'Off track with a path back by week 5 and an action agreed after: in hand, then needing attention again once the path’s week passes (1.5).',
  'E-13': 'Stopped in week 6: in every file up to week 5, then gone.',
  'E-14': 'Milliseconds below zero: not a time unit for that rule, so not refused (1.7).',
  'E-15': 'Held to no number: no status from its plan and nothing due, even with a check-in (1.6).',
};

type Draft = { id: string; goal: string; week: number; value?: number | null; status: Status; postedAt?: string; path?: PathToGreen; backfilled?: boolean };
const path = (byWeek: number): PathToGreen => ({ what: 'Pair on the slow pipeline stages', byWeek, needs: '' });

/**
 * The check-ins, in the order workspace.json holds them: that order breaks a full tie in posting time (status.md rule 1;
 * conformance README), so it is part of the case. Posted on the Tuesday of their week at 10:00 unless said otherwise.
 */
const DRAFTS: Draft[] = [
  // E-1, between 99.5 and 99.95 (margin 0.1): inside, near the upper, near the lower, at the upper, at the lower, over
  // the upper, under the lower, then back inside.
  ...[99.7, 99.9, 99.55, 99.95, 99.5, 99.96, 99.4, 99.7].map((v, i): Draft => ({ id: `e1-${i + 1}`, goal: 'between', week: i + 1, value: v, status: v > 99.95 || v < 99.5 ? 'off' : 'on' })),
  // E-2, at most 12 (margin 2): at the edge of the margin (10, not near), inside the margin, at the limit, just over it.
  ...[9, 10, 10.5, 12, 12.1, 11].map((v, i): Draft => ({ id: `e2-${i + 1}`, goal: 'at-most', week: i + 1, value: v, status: v > 12 ? 'off' : 'on' })),
  // E-3, at least 80 (margin 5): at the edge of the margin (85), inside it, at the limit, just under it. Two numbers
  // for week 4, the second posted later the same day: the range's latest is the last by week, then posting (1.14).
  ...[90, 85, 84, 80, 79].map((v, i): Draft => ({ id: `e3-${i + 1}`, goal: 'at-least', week: i + 1, value: v, status: v < 80 ? 'off' : 'on' })),
  { id: 'e3-4b', goal: 'at-least', week: 4, value: 82, status: 'on', postedAt: at(4, 1, 15) },
  // E-4, a share planned from 30 to 75: 110 and 400 are both over 100% and refused (1.9), then a plain number.
  { id: 'e4-1', goal: 'share', week: 1, value: 33, status: 'on' },
  { id: 'e4-2', goal: 'share', week: 2, value: 110, status: 'on' },
  { id: 'e4-3', goal: 'share', week: 3, value: 400, status: 'on' },
  { id: 'e4-4', goal: 'share', week: 4, value: 44, status: 'on' },
  // E-5, planned from 50 to 150%: not a share, so 120 is only questioned; then a negative percentage, refused (1.7).
  { id: 'e5-1', goal: 'not-share', week: 1, value: 60, status: 'on' },
  { id: 'e5-2', goal: 'not-share', week: 2, value: 120, status: 'on' },
  { id: 'e5-3', goal: 'not-share', week: 3, value: -5, status: 'off', path: path(6) },
  // E-6, 10 → 50: reached in week 2; nothing for week 3; week 4 also meets it, but the week before is week 2, which met
  // it, so no moment (1.3: not week − 1). Short in week 5, nothing for week 6, met again in week 7: reached.
  { id: 'e6-1', goal: 'gap-reach', week: 1, value: 20, status: 'on' },
  { id: 'e6-2', goal: 'gap-reach', week: 2, value: 50, status: 'on' },
  { id: 'e6-4', goal: 'gap-reach', week: 4, value: 52, status: 'on' },
  { id: 'e6-5', goal: 'gap-reach', week: 5, value: 45, status: 'on' },
  { id: 'e6-7', goal: 'gap-reach', week: 7, value: 50, status: 'on' },
  // E-7, 10 → 50, corrections (1.3). Week 2's number corrected to the target the next Monday: a second check-in for
  // week 2, so no moment. Week 5 posted before week 4, and week 4's then reaches the target: an earlier-posted check-in
  // for a later week is not a correction, so it is reached. Week 7 posted late, a week after its own; week 8 reaches the
  // target against it. Week 6 loaded later from a spreadsheet (backfilled): it reaches the target, but never a moment.
  { id: 'e7-1', goal: 'corrected', week: 1, value: 30, status: 'on' },
  { id: 'e7-2', goal: 'corrected', week: 2, value: 35, status: 'on' },
  { id: 'e7-2c', goal: 'corrected', week: 2, value: 50, status: 'on', postedAt: at(3, 0, 9) },
  { id: 'e7-3', goal: 'corrected', week: 3, value: 30, status: 'on' },
  { id: 'e7-5', goal: 'corrected', week: 5, value: 40, status: 'on', postedAt: at(5, 1, 8) },
  { id: 'e7-4', goal: 'corrected', week: 4, value: 52, status: 'on', postedAt: at(5, 1, 9) },
  { id: 'e7-7', goal: 'corrected', week: 7, value: 31, status: 'on', postedAt: at(8, 1, 9) },
  { id: 'e7-8', goal: 'corrected', week: 8, value: 51, status: 'on', postedAt: at(8, 1, 10) },
  { id: 'e7-9', goal: 'corrected', week: 9, value: 33, status: 'on' },
  { id: 'e7-6', goal: 'corrected', week: 6, value: 55, status: 'on', postedAt: at(9, 2), backfilled: true },
  // E-8, behind in weeks 2, 3 and 5 (nothing for week 4), on track for week 6: back 4 (1.2). Then behind in week 8
  // alone and on track for week 9: back 1, which says nothing.
  ...([[1, 3, 'on'], [2, 3, 'risk'], [3, 3, 'off'], [5, 4, 'risk'], [6, 7, 'on'], [7, 8, 'on'], [8, 7, 'risk'], [9, 9, 'on']] as const)
    .map(([w, v, s]): Draft => ({ id: `e8-${w}`, goal: 'back-gap', week: w, value: v, status: s, ...(s === 'on' ? {} : { path: path(w + 3) }) })),
  // E-9, a full tie (1.12): two check-ins for week 3 posted at the same moment, the later record in workspace.json
  // first by id. The official status keeps the earlier record (its call, off track); the calculation takes the later
  // one (its number, 50). Week 6 the same, the other way round.
  { id: 'e9-1', goal: 'tie-same-week', week: 1, value: 25, status: 'on' },
  { id: 'e9-3b', goal: 'tie-same-week', week: 3, value: 20, status: 'off', postedAt: at(3, 1, 12), path: path(6) },
  { id: 'e9-3a', goal: 'tie-same-week', week: 3, value: 50, status: 'on', postedAt: at(3, 1, 12) },
  { id: 'e9-6a', goal: 'tie-same-week', week: 6, value: 60, status: 'on', postedAt: at(6, 1, 12) },
  { id: 'e9-6b', goal: 'tie-same-week', week: 6, value: 30, status: 'risk', postedAt: at(6, 1, 12), path: path(9) },
  // E-10, weeks 4 and 5 posted at the same moment (week 4 late, in week 5): the official status keeps week 4's, the
  // calculation week 5's. Then nothing more, so it goes stale.
  { id: 'e10-1', goal: 'tie-two-weeks', week: 1, value: 29, status: 'on' },
  { id: 'e10-5', goal: 'tie-two-weeks', week: 5, value: 20, status: 'on', postedAt: at(5, 1, 12) },
  { id: 'e10-4', goal: 'tie-two-weeks', week: 4, value: 27, status: 'risk', postedAt: at(5, 1, 12), path: path(7) },
  // A unit of hours a week is a time: below zero is refused (1.7).
  { id: 'e10-9', goal: 'tie-two-weeks', week: 9, value: -1, status: 'on' },
  // E-11, set up in week 3 with a plan from week 5: due from week 5 only (1.6).
  { id: 'e11-6', goal: 'late-plan', week: 6, value: 3.8, status: 'on' },
  { id: 'e11-8', goal: 'late-plan', week: 8, value: 3.9, status: 'risk', path: path(10) },
  // USD is money: below zero is refused (1.7).
  { id: 'e11-9', goal: 'late-plan', week: 9, value: -0.5, status: 'risk', path: path(11) },
  // E-12, off track in week 4 (posted on its Friday) with a path back by week 5; an action agreed that afternoon, due
  // week 7 (requests below). In hand in week 5; in week 6 the path's week has passed, a new flag, so it needs attention
  // again (1.5). Checked in again in week 7, after the action: news again.
  { id: 'e12-1', goal: 'handled', week: 1, value: 44, status: 'on' },
  { id: 'e12-3', goal: 'handled', week: 3, value: 45, status: 'on' },
  { id: 'e12-4', goal: 'handled', week: 4, value: 41, status: 'off', postedAt: at(4, 4, 9), path: path(5) },
  { id: 'e12-7', goal: 'handled', week: 7, value: 50, status: 'risk', path: path(9) },
  // E-13, checked in until it was stopped.
  { id: 'e13-2', goal: 'stopped', week: 2, value: 2, status: 'on' },
  { id: 'e13-5', goal: 'stopped', week: 5, value: 3, status: 'risk', path: path(8) },
  // E-14, milliseconds are not a time unit for this rule: below zero is not refused (1.7).
  { id: 'e14-1', goal: 'not-time', week: 1, value: 480, status: 'on' },
  { id: 'e14-2', goal: 'not-time', week: 2, value: -2, status: 'on' },
  // E-15, held to no number: nothing due and no status from its plan, even with a check-in (1.6).
  { id: 'e15-3', goal: 'held', week: 3, value: 4.6, status: 'on' },
];

/** The check-ins as stored: `calculated` is what the rules gave the posted number in its week, with what was posted before. */
function checkIns(): CheckIn[] {
  const goals = new Map(EDGE_GOALS.map((g) => [g.id, g]));
  const out: CheckIn[] = [];
  for (const d of DRAFTS) {
    const goal = goals.get(d.goal)!;
    const c: CheckIn = { id: d.id, goalId: d.goal, authorId: goal.ownerId, week: d.week, postedAt: d.postedAt ?? at(d.week), value: d.value ?? null, stages: null, status: d.status, calculated: 'on', cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: d.path ?? null, next: '', dataFlagged: false, ...(d.backfilled ? { backfilled: true } : {}) };
    const before = out.filter((x) => x.postedAt < c.postedAt);
    const g = goalAsOf(goal, c.week);
    c.calculated = evaluate(g, CYCLE, c.week, { ...emptyDraft(g, null), value: draftFrom(c).value }, before).calc;
    out.push(c);
  }
  return out;
}

/** The edge-case workspace, as spec/conformance/edge/workspace.json holds it. */
export function edgeWorkspace(): ConformanceWorkspace {
  return {
    about: 'The edge-case workspace (src/spec/edge.ts): a small workspace beside the demo, for the rules the demo never exercises (ranges at and past both bounds, numbers refused for a share, the habit’s moment across gaps and corrections, ties in posting time, a plan that starts late, being handled, a goal stopped). Read it as you read the demo’s; only stage 1’s files are made from it. See spec/conformance/README.md.',
    builtFor: BUILT_FOR,
    edge: true,
    cycle: CYCLE,
    people: [{ id: 'nia', name: 'Nia Okoro', teamId: 'edge', admin: false }, { id: 'ada', name: 'Ada Lind', teamId: 'edge', admin: true }],
    teams: [{ id: 'edge', name: 'Edge cases', leadId: 'ada', objective: '' }],
    goals: EDGE_GOALS,
    checkIns: checkIns(),
    decisions: [],
    requests: [
      { id: 'ask-e12', kind: 'action', goalIds: ['handled'], askedBy: 'ada', recipientId: 'nia', ask: 'Add a second responder to the rota.', status: 'open', dueWeek: 7, reviewId: null, week: 4, checkInId: null, createdAt: at(4, 4, 15), updatedAt: at(4, 4, 15), answer: null, answeredBy: null, answeredAt: null },
    ],
    reviews: [],
    watches: [],
  };
}
