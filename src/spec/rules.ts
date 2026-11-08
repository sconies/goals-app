/* The core rules, in plain words, for the spec (spec/core/rules/). Each rule says what it decides, exactly how, with
   its numbers read from the code (domain/thresholds.ts), and worked examples. Every example is run against the real
   rule by src/spec/spec.test.ts (and by the generator, which refuses to write an example that isn't true), so an
   example can't drift from the code: change a rule and its example fails until it's brought up to date.
   The examples use the same goals as src/domain/rules.test.ts (src/spec/examples.ts). */
import { planChanges, type ChangeInput, type Rec } from '../domain/changeset';
import { emptyDraft, evaluate, MIN_PATH, MIN_REASON, NO_REASON, parseNumber, valueProblem, type Draft } from '../domain/checkin';
import { currentWeek, firstWeekFrom, planAt, planAsOf, PROJECTION_WEEKS, projection, projectionFor, shapeProgress, valueSeries } from '../domain/plan';
import { goalScorecard, likelihood } from '../domain/scorecard';
import { assessMetric, assessMilestone, assessRange, goalStatus, RANK, worst } from '../domain/status';
import { MIN_NAME, RULES, TREND_SPAN } from '../domain/thresholds';
import { FAR_OUTSIDE, FAR_RATIO, farOutside, groupDigits, precisionProblem, setupProblem, typedDecimals } from '../domain/numbers';
import { AVATAR_HUES } from '../domain/people';
import { gapTrend, goalTrend } from '../domain/trend';
import { flagsFor, needsAttention, attentionFor } from '../domain/attention';
import { ATTENTION_FLAGS, FLAG, LABEL, shortWord, STATUS_ORDER } from '../domain/vocabulary';
import type { Ask, MetricGoal, Snapshot } from '../domain/types';
import { CHECK_IN_MOMENT } from './conformance';
import { checkIn, CYCLE, metric, MILESTONE, n, RANGE } from './examples';

export interface Example {
  /** The situation, in words. */
  given: string;
  /** What the rule gives, in words or numbers: exactly what `run` returns. */
  then: string;
  run: () => string;
}

export interface Rule {
  id: string;
  title: string;
  /** One sentence: what it decides. */
  summary: string;
  /** Where it lives: a file under src/domain and the functions in it. */
  code: { file: string; names: string[] }[];
  /** The tests that check it: a file, or `file#describe` for one describe block in it (their titles are listed under the rule). */
  tests: string[];
  /** Requirement ids (evals/requirements.json) it implements. */
  reqs: string[];
  /** The rule, as Markdown. */
  body: string;
  examples: Example[];
  /** What a rebuild could get wrong from the words alone. */
  unclear?: string[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const g3075 = metric(30, 75);
const ci = checkIn;
const D = (d: Partial<Draft>): Draft => ({ ...emptyDraft(g3075, null), ...d });
const at = (iso: string) => new Date(iso);
const list = (xs: readonly string[]) => xs.join(', ');

/* A tiny workspace for the attention examples: one goal, its check-ins and asks. */
function workspace(checkIns: Snapshot['checkIns'], requests: Ask[] = [], decisions: Snapshot['decisions'] = []): Snapshot {
  return {
    people: [{ id: 'p', name: 'Pat Owner', role: '', initials: 'PO', teamId: 't', admin: false }, { id: 'l', name: 'Lee Lead', role: '', initials: 'LL', teamId: 't', admin: true }],
    teams: [{ id: 't', name: 'Team', leadId: 'l', objective: '' }], cycles: [CYCLE], goals: [g3075], checkIns, decisions, changes: [], watches: [], reviews: [], retros: [], requests,
  };
}
const flagCodes = (s: Snapshot, today: string) => flagsFor(g3075, s, CYCLE, at(today)).flags.map((f) => f.kind).join(', ') || 'none';

/* ---------- the demo workspace, for the change engine's examples ---------- */
let demo: Snapshot | null = null;
async function demoWorkspace(): Promise<Snapshot> {
  if (!demo) demo = (await import('../data/platformOrg/generate')).buildPlatformOrg(new Date(CHECK_IN_MOMENT));
  return demo;
}
/** Called once before the examples run: the change engine's examples read the demo workspace. */
export async function prepareExamples() { await demoWorkspace(); }
function change(actor: string, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}) {
  const s = demo!;
  const cycle = s.cycles[0]!;
  const today = new Date(CHECK_IN_MOMENT);
  let k = 0;
  return planChanges({ tables, snapshot: s, cycle, week: currentWeek(cycle, today), actor: s.people.find((p) => p.id === actor)!, now: today.toISOString(), newId: (p) => `${p}_x${++k}`, via: 'spreadsheet', ...extra });
}
const rec = (o: Record<string, string>): Rec => ({ __row: '2', ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
const issues = (cs: ReturnType<typeof planChanges>) => cs.issues.filter((i) => i.severity !== 'note').map((i) => `${i.severity}: ${i.message}`).join(' / ') || 'no problems';

export const RULE_LIST: Rule[] = [
  /* ---------- weeks and plans ---------- */
  {
    id: 'weeks-and-plans',
    title: 'Weeks and plans',
    summary: 'Which week it is, and what a goal’s plan says its number should be in any week.',
    code: [{ file: 'src/domain/plan.ts', names: ['currentWeek', 'daysSince', 'weekDate', 'firstWeekFrom', 'shapeProgress', 'planEnd', 'planAt', 'planHistoryOf', 'planAsOf', 'goalAsOf'] }, { file: 'src/domain/progress.ts', names: ['firstDueWeek', 'firstReview', 'reviewDate'] }, { file: 'src/domain/review.ts', names: ['sessionWeek'] }],
    tests: ['src/domain/rules.test.ts#plan', 'src/domain/rules.test.ts#goals', 'src/domain/year.test.ts', 'src/domain/firstWeek.test.ts'],
    reqs: ['PLAN-SHAPE', 'REBASELINE', 'PLAN-CHANGE', 'CALENDAR-WEEKS', 'YEAR'],
    body: `
**Weeks.** A cycle has a start date (week 0's Monday) and a number of weeks. Days are counted by calendar date in UTC. The week on a day is \`floor(days since the start / 7)\`: 0 before the start and in the first seven days, never more than the cycle's last week. Week *w*'s checkpoint date is the start plus 7·*w* days. Checkpoints run from week 0 to the last week; week 0 is set-up, and the first check-in is due in week 1.

**Set up part way through a week.** Nothing is late on the day it's set up. A goal's first check-in is due in the first week whose review day (the cycle's \`reviewDay\`, 0 = Monday) falls on or after the day the goal was created; a review's first session is the first of its sessions on or after the day it was set up (its own weekday, every \`everyWeeks\` weeks). So a goal or review set up on the review day or before it starts that week, and one set up after it (on the Sunday, say) starts the next week. Anything set up before the cycle starts begins in week 1. Before its first week a goal is not due, not flagged as due, and doesn't count for or against the on-time streak.

**Days since** a moment is the number of calendar days (UTC) from that moment's date to today's date: a check-in posted at 23:00 on Monday is one day old on Tuesday at 01:00.

**A number goal's plan** goes from \`start\` to \`target\`:

- It begins at \`fromWeek\` (0, or the week a goal was set up mid-cycle; never later than one week before the end) and is due at \`endWeek\` (the cycle's last week unless the goal runs longer, such as to the end of the year).
- In or before \`fromWeek\` the plan is \`start\`; in or after \`endWeek\` it is \`target\`.
- If plan numbers were set by hand (\`points\`, each a week and a value), the plan runs in straight lines from (\`fromWeek\`, start) through each point between the two, in week order, to (\`endWeek\`, target).
- Otherwise it follows its shape. With *n* = \`endWeek − fromWeek\` and *w* = \`week − fromWeek\` (held to 0…*n*), the share of the change planned by then is:
  - **straight:** *w* / *n*;
  - **back-loaded** (\`back\`): (*w* / *n*)^1.5;
  - **stepped:** three equal steps, landing in week ⌊*n*/3⌋ + 1, week ⌊2*n*/3⌋ + 1 and week *n*: the count of those reached, divided by 3.
- The plan for the week is \`start + (target − start) × share\`.

**Plans that changed.** When a plan changes after check-ins started, the plan before is kept (\`planHistory\`, oldest first: each applied to the weeks before its \`untilWeek\`). The plan *as of* a week is the first kept plan whose \`untilWeek\` is later than that week, or else the current plan. (Older data keeps only \`originalPlan\` and \`rebaselinedWeek\`: read it as one kept plan until that week.) A check-in is always judged against the plan as of its own week.`,
    examples: [
      { given: 'The 13-week cycle starts Monday 7 September 2026. What week is Sunday 13 September at 23:00 UTC, and Monday 14 September?', then: '0, 1', run: () => `${currentWeek(CYCLE, at('2026-09-13T23:00:00Z'))}, ${currentWeek(CYCLE, at('2026-09-14T00:00:00Z'))}` },
      { given: 'A day long after the cycle ends (1 March 2027).', then: '13', run: () => String(currentWeek(CYCLE, at('2027-03-01T00:00:00Z'))) },
      { given: 'Reviews on Thursdays. A goal set up on Monday 28 September (week 3), on Thursday 1 October (its review day) and on Sunday 4 October: the week its first check-in is due.', then: '3, 3, 4', run: () => ['2026-09-28T09:00:00Z', '2026-10-01T16:00:00Z', '2026-10-04T10:00:00Z'].map((d) => firstWeekFrom(CYCLE, d, CYCLE.reviewDay)).join(', ') },
      { given: 'A straight plan from 30 to 75 over 13 weeks: the plan in week 4.', then: '43.846', run: () => n(planAt(g3075.plan, 4, 13)) },
      { given: 'A back-loaded plan from 34 to 18 over 13 weeks: the plan in week 4.', then: '31.27', run: () => n(planAt({ start: 34, target: 18, shape: 'back' }, 4, 13), 2) },
      { given: 'A stepped plan over 13 weeks: the share planned in weeks 4, 5, 8, 9, 12 and 13.', then: '0, 0.333, 0.333, 0.667, 0.667, 1', run: () => [4, 5, 8, 9, 12, 13].map((w) => n(shapeProgress('stepped', w, 13))).join(', ') },
      { given: 'A plan from 10 to 50 due in week 13, with a number set by hand of 40 in week 4: the plan in weeks 2, 4 and 8.', then: '25, 40, 44.444', run: () => [2, 4, 8].map((w) => n(planAt({ start: 10, target: 50, shape: 'straight', points: [{ week: 4, value: 40 }] }, w, 13))).join(', ') },
      { given: 'A goal set up in week 5 (from week 5), straight from 0 to 80 due in week 13: the plan in weeks 3, 5, 9 and 13.', then: '0, 0, 40, 80', run: () => [3, 5, 9, 13].map((w) => n(planAt({ start: 0, target: 80, shape: 'straight', fromWeek: 5 }, w, 13))).join(', ') },
      { given: 'A goal whose target moved from 75 to 95 in week 6 (the 30→75 plan kept until week 6): the target of the plan as of weeks 4 and 6.', then: '75, 95', run: () => { const g: MetricGoal = { ...g3075, plan: { ...g3075.plan, target: 95 }, planHistory: [{ untilWeek: 6, plan: g3075.plan }] }; return `${planAsOf(g, 4).target}, ${planAsOf(g, 6).target}`; } },
    ],
  },

  /* ---------- status ---------- */
  {
    id: 'status',
    title: 'A goal’s status',
    summary: 'What the numbers say (the calculated status), and the official status everyone sees: the owner’s call, unless it has gone stale.',
    code: [{ file: 'src/domain/status.ts', names: ['assessMetric', 'assessRange', 'assessMilestone', 'assessPosted', 'goalStatus', 'daysWithoutUpdate', 'worst', 'RANK'] }, { file: 'src/domain/thresholds.ts', names: ['RULES'] }],
    tests: ['src/domain/rules.test.ts#metric status', 'src/domain/rules.test.ts#range status', 'src/domain/rules.test.ts#milestone status', 'src/domain/rules.test.ts#official status', 'evals/scenarios.eval.ts'],
    reqs: ['STATUS-BANDS', 'STATUS-DIRECTION', 'RANGE', 'MILESTONE', 'OWNER-CALL', 'GREENER', 'STALE', 'HONEST-NUMBERS'],
    body: `
There are seven statuses (codes in brackets): ${STATUS_ORDER.map((k) => `${LABEL[k]} (\`${k}\`)`).join(', ')}, listed worst first. Their meanings are in [the vocabulary](../vocabulary.md). The numbers below come from \`RULES\` in \`src/domain/thresholds.ts\`: on track at ${pct(RULES.onTrack)}, at risk from ${pct(RULES.atRisk)}, well ahead at ${pct(RULES.wellAhead)}, stale after ${RULES.staleDays} days, a stage off track when more than ${RULES.lateWeeksOff} weeks late.

### What the numbers say: the calculation

The calculation gives one of \`on\`, \`risk\`, \`off\`, \`done\`, \`planned\` (week 0) or \`none\` (no number to judge).

**A number to move** (\`metric\`), for week *w* with this week's number *actual*:

1. *plan* = the plan for week *w* (see [weeks and plans](weeks-and-plans.md)); *planned* = *plan* − *start*; the better direction is the sign of *target* − *start*.
2. Week 0 of the cycle (not the plan's \`fromWeek\`): \`planned\`. No number: \`none\`.
3. If nothing is planned yet (|*planned*| < 10⁻⁹, as on a stepped plan before its first step): \`on\`, unless the number went the wrong way from *start* (then \`risk\`, and *behind*).
4. *ratio* = (*actual* − *start*) / *planned*, rounded to 9 decimal places, so 95% is 95% and not 94.9999…%. It reads the same whichever way is better.
5. **On plan as written.** A number is typed to the goal's decimals. If *actual* equals the plan rounded to those decimals, and no number that can be written at those decimals lands in the on-track band (a ratio of at least ${RULES.onTrack} and under ${RULES.wellAhead}), the goal is \`on\` with ratio 1. This is a new goal's first week when the plan has moved less than one decimal step.
6. Otherwise: ratio ≥ ${RULES.onTrack} is \`on\`; ≥ ${RULES.atRisk} is \`risk\`; below that \`off\`. It is *well ahead* at ratio ≥ ${RULES.wellAhead} (still \`on\`) and *behind* below ${RULES.onTrack}.
7. It also carries the projection to the due week (see [the projection](projection.md)) from the earlier numbers plus this one, and *forecastMisses*: the projection's likeliest value falls short of the target in the better direction.

**A number to keep in range** (\`range\`): a limit, a side (\`atMost\` or \`atLeast\`) and a warning margin. A value is *out* when it is strictly past the limit on the wrong side (\`atMost\`: > *limit*; \`atLeast\`: < *limit*; a value at the limit is not out) and *near* when strictly within the margin (\`atMost\`: > *limit* − *margin*; \`atLeast\`: < *limit* + *margin*). *previous* is the number of the latest check-in with a number for an earlier week (by week, not by when it was posted).

- Week 0: \`planned\`; no number: \`none\`.
- Out this week and out at *previous*: \`off\`.
- Out this week, or out at *previous*, or near: \`risk\`.
- Otherwise \`on\`.

**Dated stages** (\`milestone\`), in week *w*, from the latest check-in's stage updates (each: the week it was done, or the week it is now expected):

- A stage marked done is \`done\`; it was late by max(0, done week − due week).
- A stage not done is expected in its forecast week (or its due week if none), never before its due week; once its due week has passed (due < *w*), never before this week. *Weeks late* = expected − due. More than ${RULES.lateWeeksOff} weeks late: \`off\` (Late); 1–${RULES.lateWeeksOff}: \`risk\` (Slipping); otherwise \`planned\` (On schedule).
- The goal: every stage done is \`done\`; week 0 is \`planned\`; any stage \`off\` is \`off\`; any \`risk\` is \`risk\`; otherwise \`on\`.

**From what has been posted** (\`assessPosted\`, used everywhere a goal's status is shown) in week *w*:

- Take the goal's check-ins up to week *w*, ordered by week, then by when they were posted. The latest is the one that counts, judged **in its own week**, not this week: a goal checked in last week is judged against last week's plan.
- A number goal is judged with the plan as of that check-in's week, its number, and the numbers before it (for the projection).
- A range goal is judged with its number and the one before it.
- Dated stages are judged in week *w* (this week), with the latest check-in's stage updates: a stage that is overdue is late whether or not anyone has checked in. With no check-in at all and nothing late, it is \`none\`, not \`on\` (no evidence is not good news).

### The official status

\`goalStatus\` gives the status everyone sees, on a given day:

1. *week* = the cycle's week that day. *latest* = the goal's check-in posted most recently (by when it was posted, whatever week it was for).
2. If *latest*'s call is \`done\`: **Done**.
3. Else if *week* is 0: **Not started**.
4. Else if the days without an update are under ${RULES.staleDays}: *latest*'s call (the owner's), or **No check-in yet** if there is none.
5. Else: **No recent update** (\`stale\`).

*Days without an update* are the days since *latest* was posted; with no check-in, since the goal began (the cycle's start, or the day it was added if later).

The owner's call is official, even where the numbers disagree. A call is *greener* when it ranks better than what the rules calculated when it was posted: the check-in's stored \`calculated\`, never a recalculation (the two can differ, for example when a stage becomes late after posting). Ranks: ${Object.entries(RANK).map(([k, v]) => `\`${k}\` ${v}`).join(', ')}; lower is better.

**A group's status** (\`worst\`): with no goals, \`none\`; every goal done, \`done\`; otherwise the worst rank present, where rank 1 is \`on\`, and a tie in rank is broken by the order ${STATUS_ORDER.map((k) => `\`${k}\``).join(', ')} (so a group with a goal that has no recent update and none worse says \`stale\`, never \`risk\`).`,
    examples: [
      { given: 'A straight plan from 30 to 75 over 13 weeks (plan 43.846 in week 4). Week 4 numbers at 95%, 94%, 80% and 79% of the planned change.', then: 'on, risk, risk, off', run: () => [0.95, 0.94, 0.8, 0.79].map((r) => assessMetric(g3075, 13, 4, 30 + (planAt(g3075.plan, 4, 13) - 30) * r, []).calc).join(', ') },
      { given: 'The same goal: 58 in week 4 (ratio 2.0) and 40 (ratio 0.72).', then: '58: on, well ahead; 40: off, behind', run: () => { const a = assessMetric(g3075, 13, 4, 58, []), b = assessMetric(g3075, 13, 4, 40, []); return `58: ${a.calc}${a.ahead ? ', well ahead' : ''}; 40: ${b.calc}${b.behind ? ', behind' : ''}`; } },
      { given: 'Lower is better: back-loaded from 34 to 18 over 13 weeks; 29.4 and 35 in week 6.', then: '29.4: risk; 35: off', run: () => { const g = metric(34, 18, 'back'); return `29.4: ${assessMetric(g, 13, 6, 29.4, []).calc}; 35: ${assessMetric(g, 13, 6, 35, []).calc}`; } },
      { given: 'Week 0 with 30, and week 3 with no number.', then: 'planned, none', run: () => `${assessMetric(g3075, 13, 0, 30, []).calc}, ${assessMetric(g3075, 13, 3, null, []).calc}` },
      { given: 'A stepped plan from 10 to 40 in week 2 (before its first step): 10, then 8.', then: 'on, risk', run: () => { const g = metric(10, 40, 'stepped'); return `${assessMetric(g, 13, 2, 10, []).calc}, ${assessMetric(g, 13, 2, 8, []).calc}`; } },
      { given: 'A cost in USD with 2 decimals, 0.42 down to 0.30 over 13 weeks (week 1 plan 0.4108): 0.41, 0.42 and 0.40 in week 1.', then: '0.41: on; 0.42: off, behind; 0.40: on, well ahead', run: () => { const g = { ...metric(0.42, 0.3), unit: 'USD', decimals: 2 }; return [0.41, 0.42, 0.4].map((v) => { const a = assessMetric(g, 13, 1, v, []); return `${v.toFixed(2)}: ${a.calc}${a.behind ? ', behind' : ''}${a.ahead ? ', well ahead' : ''}`; }).join('; '); } },
      { given: 'A range, at most 12.0% with a 1-point margin: 10.5 after 10.6; 11.2 after 10.6; 12.6 after 11.2; 10.4 after 12.6; 12.4 after 12.6.', then: 'on, risk, risk, risk, off', run: () => [[10.5, 10.6], [11.2, 10.6], [12.6, 11.2], [10.4, 12.6], [12.4, 12.6]].map(([v, p]) => assessRange(RANGE, 5, v!, p!).calc).join(', ') },
      { given: 'A range, at least 99 with a 0.5 margin: 99.8 after 99.9; 99.3 after 99.9; 98 after 98.5.', then: 'on, risk, off', run: () => { const g = { ...RANGE, range: { bound: 'atLeast' as const, limit: 99, margin: 0.5 } }; return [[99.8, 99.9], [99.3, 99.9], [98, 98.5]].map(([v, p]) => assessRange(g, 2, v!, p!).calc).join(', '); } },
      { given: 'Stages A (due week 3) and B (due week 7). In week 4, A done in week 3 and B expected in week 9; then B expected in week 10.', then: 'risk, off', run: () => [9, 10].map((f) => assessMilestone(MILESTONE, 4, [{ stageId: 'a', doneWeek: 3, forecastWeek: null }, { stageId: 'b', doneWeek: null, forecastWeek: f }]).calc).join(', ') },
      { given: 'The same stages in week 6 with no updates at all: stage A is overdue.', then: 'A: off, 3 weeks late; goal: off', run: () => { const a = assessMilestone(MILESTONE, 6, null); return `A: ${a.stages[0]!.kind}, ${a.stages[0]!.weeksLate} weeks late; goal: ${a.calc}`; } },
      { given: 'In week 9, A done in week 3 and B done in week 9.', then: 'done; B was 2 weeks late', run: () => { const a = assessMilestone(MILESTONE, 9, [{ stageId: 'a', doneWeek: 3, forecastWeek: null }, { stageId: 'b', doneWeek: 9, forecastWeek: null }]); return `${a.calc}; B was ${a.stages[1]!.weeksLate} weeks late`; } },
      { given: 'The 30→75 goal, checked in for week 4 with 40, called at risk where the rules said off track, posted 8 October; status on 10 October.', then: 'risk, greener', run: () => { const s = goalStatus(g3075, CYCLE, [ci('m', 4, 40, { status: 'risk', calculated: 'off', postedAt: '2026-10-08T10:00:00Z' })], at('2026-10-10T10:00:00Z')); return `${s.status}${s.greener ? ', greener' : ''}`; } },
      { given: 'Its only check-in posted 23 September: status on 6 October (13 days) and 7 October (14 days).', then: 'on, stale', run: () => { const c = [ci('m', 2, 36, { postedAt: '2026-09-23T10:00:00Z' })]; return `${goalStatus(g3075, CYCLE, c, at('2026-10-06T10:00:00Z')).status}, ${goalStatus(g3075, CYCLE, c, at('2026-10-07T10:00:00Z')).status}`; } },
      { given: 'No check-ins at all: status on 8, 15 and 21 September.', then: 'planned, none, stale', run: () => ['2026-09-08', '2026-09-15', '2026-09-21'].map((d) => goalStatus(g3075, CYCLE, [], at(d + 'T10:00:00Z')).status).join(', ') },
      { given: 'Groups of goals: [on, stale], [on, stale, risk], [none, planned], [on, risk, off], [done, done], [on, done].', then: 'stale, risk, none, off, done, on', run: () => ([['on', 'stale'], ['on', 'stale', 'risk'], ['none', 'planned'], ['on', 'risk', 'off'], ['done', 'done'], ['on', 'done']] as const).map((x) => worst([...x])).join(', ') },
    ],
    unclear: ['Step 5 (on plan as written) depends on how numbers are rounded to decimals: JavaScript’s `Number(x.toFixed(d))`. A rebuild in another language should round half away from zero on the decimal string, and compare with a tolerance of 10⁻⁹.'],
  },

  /* ---------- projection ---------- */
  {
    id: 'projection',
    title: 'The projection',
    summary: 'Where a number lands by its due week if the recent trend holds: the likeliest value and a range around it.',
    code: [{ file: 'src/domain/plan.ts', names: ['projection', 'projectionFor', 'isShare', 'isCount', 'valueSeries', 'PROJECTION_WEEKS'] }],
    tests: ['src/domain/rules.test.ts#plan', 'src/domain/scorecard.test.ts'],
    reqs: ['FORECAST', 'PROJECTION-RANGE'],
    body: `
The projection fits a least-squares line through the recent numbers, not a slope between two points, so one noisy week can't swing it.

**The numbers it uses** (a *series* of week and value, oldest first; see “Where it is used” for which points):

- *last* is the latest point. Take the points with week > *last*.week − ${PROJECTION_WEEKS} (the last ${PROJECTION_WEEKS} weeks).
- If those span fewer than 3 weeks (*last*.week − first week < 3), reach back to the latest point at least 3 weeks before *last*, and use it and every point after it. If there is none, there is **no projection** (\`null\`): it needs a number at least three weeks before the latest one.

**The line.** With *n* points, *x̄* and *ȳ* the mean week and value, *Sxx* = Σ(*x* − *x̄*)², *slope* = Σ(*x* − *x̄*)(*y* − *ȳ*) / *Sxx*:

- *spread* = √(Σ(*y* − line)² / (*n* − 2)) when *n* > 2, else 0.
- A slope the numbers barely support counts for little: *t* = *slope* / (*spread* / √*Sxx*) (infinite when the spread is 0), and the line leans by *lean* = *t*² / (1 + *t*²) (1 when *t* is infinite).
- To week *T*: *value* = *ȳ* + *lean* · *slope* · (*T* − *x̄*).
- *half* = *spread* · √(1/*n* + (*T* − *x̄*)² / *Sxx*); *low* = *value* − *half*, *high* = *value* + *half*. About two chances in three that the number lands inside if nothing changes. A clean trend has no spread, so its range is the line itself.
- Every result (value, low, high, slope) is rounded to 9 decimal places. It also says *from* (first week used), *to* (*last*.week) and *week* (*T*).

**Held to what the number can be** (\`projectionFor\`, which every projection of a goal's own numbers goes through): a *share* (unit \`%\` and every plan number, start, target, any hand-set points or a range's limit, within 0–100) has value, low and high held to 0–100; a *count* (0 decimals, a plan of whole numbers never below zero, and a unit that is not %, a time, money, points or a score) is held at or above 0.

**Where it is used.** A number to move projects to its due week (\`endWeek\`, else the cycle's end) from every earlier check-in that has a number (all of them, in week order then posting order, even two in one week) plus the number of the week judged. A range goal's scorecard projects to the cycle's end from one number per week (the latest posted in each week wins).`,
    examples: [
      { given: 'Numbers in weeks 1 and 2 only, projected to week 13.', then: 'none', run: () => (projection([{ week: 1, value: 10 }, { week: 2, value: 12 }], 13) ? 'a projection' : 'none') },
      { given: '10 in week 1 and 16 in week 4, to week 13.', then: 'value 34, range 34–34, slope 2', run: () => { const p = projection([{ week: 1, value: 10 }, { week: 4, value: 16 }], 13)!; return `value ${n(p.value)}, range ${n(p.low)}–${n(p.high)}, slope ${n(p.slope)}`; } },
      { given: 'A clean trend: 0 in week 1, 10 in week 3, 25 in week 6, to week 13.', then: 'value 60, range 60–60, slope 5', run: () => { const p = projection([{ week: 1, value: 0 }, { week: 3, value: 10 }, { week: 6, value: 25 }], 13)!; return `value ${n(p.value)}, range ${n(p.low)}–${n(p.high)}, slope ${n(p.slope)}`; } },
      { given: 'An old slump doesn’t count: 90 in week 1, 10 in week 2, then 20, 22, … 34 in weeks 10–17, to week 20.', then: 'from week 10, value 40', run: () => { const p = projection([{ week: 1, value: 90 }, { week: 2, value: 10 }, ...Array.from({ length: 8 }, (_, i) => ({ week: 10 + i, value: 20 + 2 * i }))], 20)!; return `from week ${p.from}, value ${n(p.value)}`; } },
      { given: 'A noisy CSAT: 84, 81, 86, 82, 87, 80, 85, 83, 84, 81, 86, 82 in weeks 34–45, to week 53.', then: 'value 83.096, range 78.397–87.796, from week 38', run: () => { const p = projection([84, 81, 86, 82, 87, 80, 85, 83, 84, 81, 86, 82].map((value, i) => ({ week: 34 + i, value })), 53)!; return `value ${n(p.value)}, range ${n(p.low)}–${n(p.high)}, from week ${p.from}`; } },
      { given: 'Incidents, a count: 12, 8, 3, 2 in weeks 1, 3, 5, 6, to week 13. The bare line goes below zero; the goal’s projection stops at 0.', then: 'line low -14.33; held: value 0, low 0', run: () => { const pts = [{ week: 1, value: 12 }, { week: 3, value: 8 }, { week: 5, value: 3 }, { week: 6, value: 2 }]; const p = projectionFor({ ...metric(12, 0), unit: 'incidents' }, pts, 13)!; return `line low ${n(projection(pts, 13)!.low, 2)}; held: value ${n(p.value)}, low ${n(p.low)}`; } },
      { given: 'The latest check-in of each week counts: week 2 posted twice (5, then 7 a day later), and week 1 with 3.', then: '1: 3, 2: 7', run: () => valueSeries([ci('m', 2, 5, { postedAt: '2026-09-21T10:00:00Z' }), ci('m', 2, 7, { postedAt: '2026-09-22T10:00:00Z' }), ci('m', 1, 3)]).map((p) => `${p.week}: ${p.value}`).join(', ') },
      { given: 'The 30→75 goal with 42 in week 3 and 45 in week 6: the likeliest value at week 13, and whether it misses the target.', then: '52, misses', run: () => { const a = assessMetric(g3075, 13, 6, 45, [{ week: 3, value: 42 }]); return `${n(a.forecast)}, ${a.forecastMisses ? 'misses' : 'reaches'}`; } },
    ],
  },

  /* ---------- check-in ---------- */
  {
    id: 'check-in',
    title: 'What a check-in must say',
    summary: 'What a check-in needs before it can be posted, and the record it becomes.',
    code: [{ file: 'src/domain/checkin.ts', names: ['emptyDraft', 'parseNumber', 'valueProblem', 'evaluate', 'toCheckIn', 'MISSING_TEXT', 'CAUSES_BEHIND', 'CAUSES_AHEAD'] }],
    tests: ['src/domain/rules.test.ts#check-in rules', 'src/domain/rules.test.ts#typed numbers', 'src/domain/rules.test.ts#what a check-in still needs, as stable codes', 'evals/scenarios.eval.ts'],
    reqs: ['REASON-BEHIND', 'REASON-AHEAD', 'PATH-TO-GREEN', 'GREENER', 'OWNER-CALL', 'CHECKIN-STATUS-VS-PLAN', 'OTHER-CAUSE', 'FIRST-CHECKIN'],
    body: `
A check-in is one week's report on one goal, by its owner (or an admin): the number (or each stage's state), the owner's call, and the words the numbers ask for. Every way in (the check-in screen, the bulk grid, a spreadsheet, the AI assistant) uses these rules.

**Reading a number** (\`parseNumber\`): spaces and a trailing unit or \`%\` are ignored; a decimal comma with one or two digits (\`29,4\`) is a decimal point; commas grouping thousands (\`1,250\`, \`1,250.5\`) are dropped. Anything else that isn't plain digits with one optional point and sign (hex, exponents, words, two points) is not a number; nor is anything 10¹² or more.

**Impossible and surprising numbers** (\`valueProblem\`): letters are refused with the one message of [numbers and names](numbers-and-names.md); a number with more decimal places than the goal keeps is refused (never rounded, the same rule); below zero is refused for a percentage or a time or money unit; over 100% is refused for a share (see [the projection](projection.md)) and only questioned otherwise; a number goal's value more than ${FAR_OUTSIDE} times the plan's width beyond either end of its plan is questioned ("That's far outside this goal's plan (30 to 75%). Is 400 right?"); a number more than 3 times or less than a third of last week's is questioned ("Last week was 29.4. Is 294 right?"). Questions never refuse.

**Judging the draft** (\`evaluate\`, for the goal, the week, the draft and the goal's check-ins): the check-in is judged as in [the status](status.md), with the goal's earlier check-ins (weeks before this one). The calculated call is the calculation, with \`planned\` and \`none\` counting as \`on\`. The owner's call defaults to it.

- *greener*: the owner's call ranks better than the calculated one.
- *reason* needed: for a number to move, **ahead** when well ahead (ratio ≥ ${RULES.wellAhead}) and **behind** when behind (ratio < ${RULES.onTrack}); for the others, **behind** when the calculation is \`risk\` or \`off\`.
- *a new target* may be proposed when a number goal is well ahead.
- *a path to green* is needed when the owner's call is \`risk\` or \`off\`.

What is still missing, as codes, in this order:

1. \`value\` (none typed), \`value-not-number\`, \`value-precision\` (more decimal places than the goal keeps), or \`value-impossible\` (refused above). Not asked of dated stages.
2. \`greener-why\`: a greener call needs its own reason of at least ${MIN_REASON} characters.
3. \`reason-behind\` / \`reason-ahead\`: a cause (one of the listed causes, or "Something else") and a why of at least ${MIN_REASON} characters.
4. \`path\`: what changes (at least ${MIN_PATH} characters) and, when the recovery state is \`plan\` (the default), a week to be back on plan by that is after this week and no later than the cycle's last week. The other recovery states (\`investigating\`, \`help\`, \`target\`) need no week.
5. \`target\`: a proposed target, when given, must be beyond the current target in the better direction.

It can be posted when nothing is missing.

**The record** (\`toCheckIn\`): the number (or the stages), the owner's call as \`status\`, the calculation as \`calculated\`, the cause only when a reason was needed, the why, the greener reason only when greener, the proposed target only when one could be asked, the path to green only when needed (its week only for the \`plan\` state), what's next, and whether the data is flagged. It refuses a draft that can't be posted. The why stored when nothing needed explaining was once "${NO_REASON}"; it is never shown or counted as a reason.`,
    examples: [
      { given: 'Typed: "29,4", "1,250", "1,250.5", "62%", "29.4 days", " -3 ".', then: '29.4, 1250, 1250.5, 62, 29.4, -3', run: () => ['29,4', '1,250', '1,250.5', '62%', '29.4 days', ' -3 '].map((s) => String(parseNumber(s))).join(', ') },
      { given: 'Typed: "0x1F", "1e308", "abc", "1.2.3", "99999999999999".', then: 'null, null, null, null, null', run: () => ['0x1F', '1e308', 'abc', '1.2.3', '99999999999999'].map((s) => String(parseNumber(s))).join(', ') },
      { given: '-5 days (last week 30); 120% (last week 60, not a share); 294 days (last week 29.4).', then: 'refused; questioned; questioned: Last week was 29.4. Is 294 right?', run: () => { const a = valueProblem('-5', 30, 'days'), b = valueProblem('120', 60, '%'), c = valueProblem('294', 29.4, 'days'); const w = (p: typeof a) => (p ? (p.block ? 'refused' : 'questioned') : 'fine'); return `${w(a)}; ${w(b)}; ${w(c)}: ${c?.text}`; } },
      { given: 'The 30→75 goal in week 4 (plan 43.846): nothing typed; "abc"; "140"; "44".', then: 'value; value-not-number; value-impossible; nothing missing', run: () => [{}, { value: 'abc' }, { value: '140' }, { value: '44' }].map((d) => evaluate(g3075, CYCLE, 4, D(d), []).codes[0] ?? 'nothing missing').join('; ') },
      { given: '40 in week 4 (off track) with nothing else; then with a cause, a why, a path and back by week 7; then back by week 4.', then: 'reason-behind, path; can post; path', run: () => { const why = { cause: 'slower' as const, why: 'Rollout paused for a week', ptgWhat: 'Restart the rollout' }; return [D({ value: '40' }), D({ value: '40', ...why, ptgBy: 7 }), D({ value: '40', ...why, ptgBy: 4 })].map((d) => { const e = evaluate(g3075, CYCLE, 4, d, []); return e.canPost ? 'can post' : e.codes.join(', '); }).join('; '); } },
      { given: '58 in week 4 (well ahead): nothing else; with a reason and a proposed target of 70; with 95.', then: 'reason-ahead; target; can post', run: () => { const why = { value: '58', cause: 'early' as const, why: 'The bot shipped two weeks early' }; return [D({ value: '58' }), D({ ...why, proposeTarget: '70' }), D({ ...why, proposeTarget: '95' })].map((d) => { const e = evaluate(g3075, CYCLE, 4, d, []); return e.canPost ? 'can post' : e.codes.join(', '); }).join('; '); } },
      { given: '40 in week 4, called on track, with a reason for being behind but none for the greener call.', then: 'greener-why', run: () => evaluate(g3075, CYCLE, 4, D({ value: '40', status: 'on', cause: 'slower', why: 'Rollout paused for a week' }), []).codes.join(', ') },
    ],
  },

  /* ---------- numbers and names ---------- */
  {
    id: 'numbers-and-names',
    title: 'Numbers and names',
    summary: 'How a typed number is kept and shown, which numbers are questioned, and how two goals or two people with the same name are told apart.',
    code: [
      { file: 'src/domain/numbers.ts', names: ['typedDecimals', 'precisionProblem', 'notNumberText', 'groupDigits', 'fixed', 'farOutside', 'setupProblem'] },
      { file: 'src/domain/goal.ts', names: ['validateGoal', 'planHint'] },
      { file: 'src/domain/people.ts', names: ['sameNameNote', 'personTell', 'nameWithTell', 'avatarHues', 'duplicateTitles', 'goalTell', 'sameTitleNote'] },
      { file: 'src/domain/thresholds.ts', names: ['MIN_NAME', 'nameProblem'] },
    ],
    tests: ['src/domain/numbers.test.ts', 'src/domain/names.test.ts'],
    reqs: ['NO-SILENT-ROUNDING', 'SAME-NAMES'],
    body: `
One rule for every way in: the check-in, New goal, goal edit, the workspace set-up, the spreadsheet import and the AI tools (backlog N).

**Never rounded quietly.** Each number goal keeps a number of decimal places (*Decimals*, 0 to 3), and every number of it is shown at those places. A number typed with more (\`typedDecimals\`: the digits after the point, trailing zeros not counted; a decimal comma counts as a point) is refused (\`precisionProblem\`), saying what it would show as and the two ways forward: type it at the goal's places, or raise Decimals. This holds for a check-in's value, a start, target, limit, margin and any plan number typed by hand. A plan already stored isn't judged again when a goal is edited; only numbers changed are. An import that adds a goal without Decimals takes the most decimal places its start, target and limit were typed with (up to 3).

**Letters in a number** get one message everywhere (\`notNumberText\`): ““a12” isn't a number. Type digits only, like 29.4.” (Letters after the digits are read as a unit: “12 days” is 12.)

**Thousands grouped.** Every number shown is written at its places with its thousands grouped by commas (\`groupDigits\`, \`fixed\`): 1,250,000; −12,000; 1,250.5. Files and the AI tools' data carry the plain number.

**Questioned, never refused.** In a check-in, see [the check-in](check-in.md). Setting up (\`setupProblem\`, \`planHint\`): over 100% (asked as before); below zero for a percentage, time or money; a target ${FAR_RATIO} times the start or more, or a ${FAR_RATIO}th of it or less (both non-zero, the same sign); a billion or more. The import notes it on the row; a goal already set up that way isn't asked again.

**Names.** A workspace's, a goal's or an outcome's name has at least ${MIN_NAME} characters (\`nameProblem\`). Two goals may have the same title (compared without case or outer spaces): making one warns (\`sameTitleNote\`), and wherever both could be on screen each shows its key, or else its team, beside the title (\`duplicateTitles\`, \`goalTell\`). An import row with no key whose title another goal has is that goal again unless it names another team; then it's a new goal, noted. Two people may have the same name: the email is who someone is. Adding or renaming one says so (\`sameNameNote\`); beside the name goes their team, else their job title, else their email, whichever tells them apart (\`personTell\`). Each avatar's colour comes from the person's ID, and people with the same initials each get a colour none of the others has while there are colours to go round (\`avatarHues\`, ${AVATAR_HUES} colours).`,
    examples: [
      { given: 'Typed "12.5", "12.50", "1,250", "29,4", "3.25 days".', then: '1, 1, 0, 1, 2', run: () => ['12.5', '12.50', '1,250', '29,4', '3.25 days'].map((x) => String(typedDecimals(x))).join(', ') },
      { given: '12.5 in a goal of whole numbers.', then: '12.5 has 1 decimal place, but this goal keeps whole numbers, so it would show as 13. Type 13, or set the goal’s Decimals to 1.', run: () => precisionProblem('12.5', 12.5, 0) ?? 'fine' },
      { given: '1250000, -12000 and 1250.5 shown.', then: '1,250,000, -12,000, 1,250.5', run: () => ['1250000', '-12000', '1250.5'].map(groupDigits).join(', ') },
      { given: 'A start of 10 signups and a target of 5,000.', then: 'The target is over 100 times the start (10 to 5,000). Is that right?', run: () => setupProblem('signups', 10, 5000) ?? 'fine' },
      { given: '400 typed for the 30→75 goal, then 110.', then: 'questioned; fine', run: () => [farOutside(400, 30, 75), farOutside(110, 30, 75)].map((x) => (x ? 'questioned' : 'fine')).join('; ') },
    ],
  },

  /* ---------- flags and attention ---------- */
  {
    id: 'flags',
    title: 'Flags, the trend and needs attention',
    summary: 'Why a goal is flagged, which way it is heading, and whether it needs attention or is being handled.',
    code: [{ file: 'src/domain/trend.ts', names: ['gapTrend', 'planGaps', 'stagesTrend', 'goalTrend'] }, { file: 'src/domain/attention.ts', names: ['flagsFor', 'attentionFor', 'handledFor', 'needsAttention', 'attentionList'] }, { file: 'src/domain/asks.ts', names: ['openFor', 'answeredSince', 'isOverdue'] }],
    tests: ['src/domain/attention.test.ts', 'src/domain/story.test.ts', 'evals/attention.eval.ts', 'evals/vocabulary.eval.ts'],
    reqs: ['ATTENTION', 'ATTENTION-HANDLED', 'ONE-ATTENTION-RULE', 'ONE-TREND', 'PATH-TO-GREEN', 'GREENER', 'STALE'],
    body: `
### The trend

One rule says whether a goal is **getting worse**, **getting better** or neither (\`flat\`). It looks at the last ${TREND_SPAN} check-ins.

\`gapTrend(gaps)\`: *gaps* are each check-in's distance from where it should be, oldest first, positive when better. Take the last ${TREND_SPAN}; with fewer, \`flat\`. The two steps between them both down (each by more than 10⁻⁹): \`worse\` (for a number to move, only if the latest gap is also below −10⁻⁹: short of plan). Both up by more than 10⁻⁹: \`better\`. Otherwise \`flat\`.

- **A number to move:** each of the goal's check-ins with a number (in week order, then posting order) gives (*value* − plan for its own week, by the plan as of that week) × the better direction (+1 if the target is above the start, else −1). Unrounded, so a number held flat while the plan moves on is further behind each time. If that isn't \`worse\` but there are at least ${TREND_SPAN} numbers, and the latest, judged in its own week against the goal's **current** plan (here, unlike everywhere else, not the plan as of that week; with the earlier numbers for its projection), is \`on\` while its projection's likeliest value misses the target: \`worse\` ("on track today, but heading short").
- **A number to keep in range:** the last ${TREND_SPAN} numbers' room to the limit: (*value* − *limit*) × (−1 for at most, +1 for at least).
- **Dated stages** (not through \`gapTrend\`): the last two check-ins with stage updates (fewer: \`flat\`), each judged in its own week. \`worse\` if any stage not done is now expected later than at the one before (this wins); else \`better\` if a stage is newly done in a week strictly earlier than it was expected at the one before, or any not done is expected strictly sooner; else \`flat\`.

### The flags

\`flagsFor(goal, workspace, cycle, today)\`. With the official status (see [the status](status.md)), *week* the week today, *latest* the latest check-in and its path to green, and *behind* meaning the status is \`off\` or \`risk\`:

| Flag | When |
|---|---|
| ${FLAG.off.label} (\`off\`) | the status is \`off\` |
| ${FLAG.stale.label} (\`stale\`) | the status is \`stale\` |
| ${FLAG['missed-path'].label} (\`missed-path\`) | behind, and the path to green names a week that is before this week |
| ${FLAG.decision.label} (\`decision\`) | not done, and an ask of kind \`decision\` that includes this goal is open |
| ${FLAG['no-path'].label} (\`no-path\`) | behind, and the latest check-in's \`pathToGreen\` is null |
| ${FLAG.risk.label} (\`risk\`) | the status is \`risk\` |
| ${FLAG.trend.label} (\`trend\`) | not done, and the trend is \`worse\` |
| ${FLAG.greener.label} (\`greener\`) | not done, the latest call is greener than its calculation, and the status isn't \`stale\` |
| ${FLAG.due.label} (\`due\`) | week ≥ 1, not done, and no check-in for this week yet |

They are listed worst first: ${list(ATTENTION_FLAGS.map((k) => `\`${k}\``))}, then \`due\`. A goal's weight is that of its worst flag. A check-in due, on its own, doesn't make a goal need attention. A done goal raises none of them, so it never needs attention and a review lists it with the goals that have nothing flagged.

### Being handled, and needs attention

A goal whose official status is \`off\` or \`risk\` (and has a check-in) is **being handled** when one of these *looks* happened strictly after its latest check-in's \`postedAt\` (latest by \`postedAt\`), on or before today's **date** (the UTC day; the time of day doesn't count):

- someone other than the owner (this condition is for these two only) marked it reviewed (a decision of kind \`acknowledge\`, its \`at\`) or added a review note (\`note\`) on it;
- an action (an ask of kind \`action\` that includes the goal, open now) was created (\`createdAt\`), and it isn't overdue (an open ask is overdue once its due week is before this week); or
- a decision ask that includes the goal was answered (\`answeredAt\`; the latest such answer);

and no flag is raised now (apart from \`due\`) that wasn't also raised when the same rules are run on the **same workspace** with "today" set to the moment of the earliest look (the workspace is not re-cut to that moment). The strongest look names it: an action, then an answer, then a note, then a review; the latest of the strongest kind.

A goal **needs attention** when it has a flag other than \`due\` and isn't being handled. Home, Watching, the map, the Goals filter, reviews, the brief and the AI assistant all use this one rule.`,
    examples: [
      { given: 'Gaps oldest first: −1, −2, −3; 1, 2, 3; −1, −2, −1; −3, −2, −1; only −1, −2; with "short of plan" required: 3, 2, 1.', then: 'worse, better, flat, better, flat, flat', run: () => [gapTrend([-1, -2, -3]), gapTrend([1, 2, 3]), gapTrend([-1, -2, -1]), gapTrend([-3, -2, -1]), gapTrend([-1, -2]), gapTrend([3, 2, 1], true)].join(', ') },
      { given: 'The 30→75 goal held at 33 in weeks 1, 2 and 3 while the plan moves on.', then: 'worse', run: () => goalTrend(g3075, CYCLE, [1, 2, 3].map((w) => ci('m', w, 33))).word },
      { given: 'A range, at most 12: 10, 11, 11.5 in weeks 1–3 (closer to the limit each time).', then: 'worse', run: () => goalTrend(RANGE, CYCLE, [10, 11, 11.5].map((v, i) => ci('r', i + 1, v))).word },
      { given: 'The 30→75 goal: 40 in week 4, called off track with a cause, why and path back by week 7, posted Monday 5 October. The flags on Thursday 8 October.', then: 'off', run: () => flagCodes(workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })]), '2026-10-08T12:00:00Z') },
      { given: 'The same check-in, a week later (Thursday 15 October, week 5): no check-in yet this week.', then: 'off, due', run: () => flagCodes(workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })]), '2026-10-15T12:00:00Z') },
      { given: 'Off track in week 4 with a path back by week 5; checked in again for week 6 (posted 19 October), still off track, carrying the same path. On Thursday 22 October (week 6).', then: 'off, missed-path', run: () => { const p = { status: 'off' as const, calculated: 'off' as const, cause: 'slower' as const, why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 5, needs: '' } }; return flagCodes(workspace([ci('m', 4, 40, p), ci('m', 6, 41, p)]), '2026-10-22T12:00:00Z'); } },
      { given: 'Off track in week 4 (posted Monday 5 October) and nothing since: on Thursday 22 October (17 days later), the status itself has gone stale, so it is no longer flagged off track.', then: 'stale, due', run: () => flagCodes(workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })]), '2026-10-22T12:00:00Z') },
      { given: 'At risk with no path to green, and an open decision ask on the goal (week 4, Thursday 8 October).', then: 'decision, no-path, risk', run: () => flagCodes(workspace([ci('m', 4, 40, { status: 'risk', calculated: 'risk' })], [{ id: 'a1', kind: 'decision', goalIds: ['m'], askedBy: 'p', recipientId: 'l', ask: 'Approve the budget', status: 'open', dueWeek: null, reviewId: null, week: 4, checkInId: null, createdAt: '2026-10-05T10:00:00Z', updatedAt: '2026-10-05T10:00:00Z', answer: null, answeredBy: null, answeredAt: null }]), '2026-10-08T12:00:00Z') },
      { given: 'Off track in week 4 (posted Monday 5 October), and the lead marked it reviewed on Tuesday 6 October. On Thursday 8 October: being handled, needs attention?', then: 'handled by reviewed; needs attention: no', run: () => { const s = workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })], [], [{ id: 'd1', goalId: 'm', checkInId: null, reviewId: null, week: 4, kind: 'acknowledge', byId: 'l', at: '2026-10-06T09:00:00Z', note: '' }]); const a = attentionFor(g3075, s, CYCLE, at('2026-10-08T12:00:00Z')); return `handled by ${a.handled?.kind ?? 'nothing'}; needs attention: ${needsAttention(a) ? 'yes' : 'no'}`; } },
    ],
  },

  /* ---------- scorecard ---------- */
  {
    id: 'scorecard',
    title: 'The scorecard',
    summary: 'The cells at the top of a goal’s page: against plan, since last week, what’s left, and how likely it is to hit the target.',
    code: [{ file: 'src/domain/scorecard.ts', names: ['likelihood', 'likelihoodFloor', 'goalScorecard', 'amount', 'byWeekWords'] }, { file: 'src/domain/summaryFacts.ts', names: ['summaryFacts'] }, { file: 'src/domain/vocabulary.ts', names: ['shortWord'] }, { file: 'src/domain/year.ts', names: ['quarterResult'] }],
    tests: ['src/domain/scorecard.test.ts', 'src/domain/year.test.ts', 'evals/goalPage.eval.ts'],
    reqs: ['GOAL-PAGE-SCORECARD', 'PROJECTION-RANGE', 'HONEST-NUMBERS'],
    body: `
\`goalScorecard(goal, cycle, checkIns, week, stale)\` gives a few cells, each a key, a label, a value, a muted line under it (*sub*) and a tone (\`good\`, \`bad\` or \`flat\`). *stale* is true when the official status is \`stale\`: then nothing is projected. Every number comes from the rules above; the scorecard only words them, and decides one thing of its own: the likelihood.

**How likely** (\`likelihood(mark, projection, better, floor)\`), worked in the better direction (+1 when higher is better): *half* = max(half the projected range's width, *floor*, 10⁻⁹); *d* = (*mark* − likeliest value) × *better* / *half*. *d* ≤ −0.5: **Likely**; ≤ 1: **Possible**; ≤ 2: **Unlikely**; above: **Very unlikely**. Words, never a percentage. The floor for a target is max(2% of the planned change, half the goal's last decimal place); for a limit, the same with the margin (or 10% of the limit when there is no margin) in place of the planned change.

**A number to move** (judged as in [the status](status.md), from what has been posted):

| Cell | Value |
|---|---|
| \`plan\`, Vs plan | the latest number against the plan for its own week, rounded to the goal's decimals and said in the better direction: "9 hours behind plan", "3 pts ahead of plan", "On plan". No number: "No value yet". Sub: "plan 43.85%", plus "in week 4" when the latest check-in is older than this week |
| \`since\`, Vs last week (Last change when stale) | the change from the check-in before with a number: "4 pts better" or "worse", "No change", or "First check-in". Sub: "was 40% in week 3" |
| \`target\`, To target | what's left, "12 pts to go", or Target reached. When lower is better the amount is over the target and says so: "5 min over". Sub: "target 75%", plus "by week 40" when due before the cycle's end |
| \`hit\`, Will it hit 75%? | the likelihood of reaching the target by its due week; "Can’t say" when stale; "Too early to say" with no projection. Sub: "likely 52% by cycle end" |

**Tones.** \`plan\`: ahead \`good\`, behind \`bad\`, on plan or no number \`flat\`. \`since\`: better \`good\`, worse \`bad\`, otherwise \`flat\` (the check-in before is the latest earlier one, by week then posting, that has a number). \`target\`: reached \`good\`, else \`flat\`. \`hit\`: Likely \`good\`, Possible \`flat\`, Unlikely and Very unlikely \`bad\`, Can’t say and Too early \`flat\`. \`limit\`: outside \`bad\`, near \`flat\`, inside \`good\`. \`room\`: over \`bad\`, within the margin (room ≤ margin) \`flat\`, else \`good\`. \`done\`: at least as many done as are due \`good\`, else \`flat\`. \`late\`: any behind \`bad\`, none \`good\`. \`next\`: expected after its due week \`bad\`, else \`flat\`; All done \`good\`. The likelihood floor uses the goal's current plan; a margin of 0 counts as none.

**A number to keep in range:** \`limit\` (Inside it, Inside, near it, Outside it), \`since\`, \`room\` (how far inside or over the limit) and \`hit\` (Will it stay within?, or Back within by the end? when outside; the likelihood of ending on the safe side of the limit at the cycle's end).

**Dated stages:** \`done\` (stages done of all, with how many are due by this week), \`late\` (stages behind their dates, slipping or late, and by up to how many weeks) and \`next\` (the week the next stage now lands, or All done).

A stopped goal has no \`hit\` cell.

**Short or over** (\`shortWord(better)\` in \`src/domain/vocabulary.ts\`, the one place the word is chosen): an amount on the wrong side of a plan or target is "short" when higher is better and "over" when lower is better: "1 pt short" of a 46% plan, "1 min over" a 6 min plan. The scorecard's \`target\` cell, the chart's mark at the due week ("5 over") and a quarter's result ("Q3: 7 min against a plan of 6 min, 1 min over") all use it.

**A quarter's result** (\`quarterResult\` in \`src/domain/year.ts\`) compares the number with the plan at the quarter's end as both are shown, at the goal's decimals: 0.68 against a plan shown as 0.68 is met, never "0.00 short".`,
    examples: [
      { given: 'A target of 75, higher is better, projected 80 (range 78–82, d = −2.5); 76 (72–80, d = −0.25); 72 (70–74, d = 1.5); 60 (58–62, d = 7.5).', then: 'likely, possible, unlikely, very-unlikely', run: () => [[80, 78, 82], [76, 72, 80], [72, 70, 74], [60, 58, 62]].map(([value, low, high]) => likelihood(75, { value: value!, low: low!, high: high! }, 1)).join(', ') },
      { given: 'A target of 18, lower is better, projected 19 (range 18–20): d = (18 − 19) × −1 / 1 = 1.', then: 'possible', run: () => likelihood(18, { value: 19, low: 18, high: 20 }, -1) },
      { given: 'The 30→75 goal with 36, 39, 42, 45 in weeks 1–4, seen in week 4.', then: 'plan: 1 pt ahead of plan [good] (plan 44%); since: 3 pts better [good] (was 42% in week 3); target: 30 pts to go [flat] (target 75%); hit: Very unlikely [bad] (likely 72% by cycle end)', run: () => goalScorecard(g3075, CYCLE, [36, 39, 42, 45].map((v, i) => ci('m', i + 1, v)), 4, false).cells.map((c) => `${c.key}: ${c.value} [${c.tone}] (${c.sub})`).join('; ') },
      { given: 'Short or over: higher is better, then lower is better.', then: 'short, over', run: () => [shortWord(1), shortWord(-1)].join(', ') },
      { given: 'A 60→30 goal (lower is better) with 50, 48, 46, 45 in weeks 1–4, seen in week 4: To target.', then: '15 pts over [flat] (target 30%)', run: () => { const c = goalScorecard(metric(60, 30), CYCLE, [50, 48, 46, 45].map((v, i) => ci('m', i + 1, v)), 4, false).cells.find((x) => x.key === 'target')!; return `${c.value} [${c.tone}] (${c.sub})`; } },
      { given: 'The same, but stale.', then: 'hit: Can’t say', run: () => { const c = goalScorecard(g3075, CYCLE, [36, 39, 42, 45].map((v, i) => ci('m', i + 1, v)), 4, true).cells.find((x) => x.key === 'hit')!; return `hit: ${c.value}`; } },
    ],
    unclear: ['The scorecard’s words (labels, values and sub lines, including how units are said: “%” differences as pts, a unit made singular at 1, numbers padded to the goal’s decimals) are not all written out here. The conformance data gives every cell for every goal and week; a rebuild that matches each cell’s key, tone and likelihood has the rule, and the words follow `src/domain/scorecard.ts` and `src/domain/format.ts`.'],
  },

  /* ---------- the change engine ---------- */
  {
    id: 'change-engine',
    title: 'The change engine',
    summary: 'The one way many changes come in at once: a spreadsheet, set-up, the bulk check-in grid, the data tables and the AI assistant.',
    code: [{ file: 'src/domain/changeset.ts', names: ['planChanges', 'records', 'describe'] }, { file: 'src/domain/columns.ts', names: ['sheetKindOf'] }, { file: 'src/domain/commit.ts', names: ['Commit'] }],
    tests: ['src/domain/changeset.test.ts', 'src/domain/roundtrip.test.ts', 'src/domain/removal.test.ts'],
    reqs: ['BULK-IMPORT', 'BULK-EDIT', 'ONE-FORMAT', 'ROUND-TRIP', 'IMPORT-ACTIONS', 'IMPORT-UNDO', 'DATA-TABLES'],
    body: `
\`planChanges(input)\` turns rows into a change set: **parse → validate → preview → apply → log**. Nothing is saved until the whole set is valid; then one *commit* saves it all, and one summary entry in the change log can undo all of it.

**The rows.** Each sheet (Goals, Plan, Check-ins, People, Asks) is known by its header row alone; its columns are the one format's, listed in [docs/export-format.md](../../../docs/export-format.md) (generated from \`src/domain/columns.ts\`). A row finds its record by a goal's key (G-12), then its ID; a person by email, then by name when only one person has it; a team by name. A column a row leaves out keeps what the record says, and worked-out columns (status, gap, forecast) are never read. A change to any column that can be changed is applied, or said to be a problem, never quietly dropped.

**Checked by the app's own rules.** A goal row is checked as the goal form checks it; a check-in row is judged by [what a check-in must say](check-in.md) in its own week (a week behind plan needs a cause and a why, and a path to green when the call is behind); a person by the people rules; a row's Action (stop a goal, delete one, mark someone as left) by the removal rules. Only a goal's owner or an admin may change it. A plan change after check-ins started needs a reason (one for the whole set, or the row's own), and keeps the old plan. A check-in for a past week is *backfilled*: dated in its own week, so loading history doesn't make a goal look freshly checked in. One for a week that hasn't happened is refused. One for a week already posted replaces it, with a warning naming whose it was.

**What it gives:** the items (each a change to one record, with its field-by-field differences), what was unchanged, the issues (errors that block, warnings to check, notes on how a row was read), whether a reason is needed, counts, and the commit (null while anything blocks). In "create" mode (set-up) the workspace starts empty and every row is new.`,
    examples: [
      { given: 'In the demo workspace, Tariq (its owner) changes the AI-assisted reviews north star (ns-ai) to a target of 90, with no reason.', then: 'needs a reason; nothing to save', run: () => { const cs = change('tariq', { goals: [rec({ ID: 'ns-ai', Target: '90' })] }); return `${cs.needsReason ? 'needs a reason' : 'no reason needed'}; ${cs.commit ? 'ready to save' : 'nothing to save'}`; } },
      { given: 'The same change by Mateo, who neither owns it nor is an admin.', then: 'error: Only Tariq Haddad (its owner) or an admin can change “Pull requests with AI-assisted review”.', run: () => issues(change('mateo', { goals: [rec({ ID: 'ns-ai', Target: '90' })] }, { reason: 'x' })) },
      { given: 'Mateo loads a week 4 number of 21 for his goal mttr-pir with no cause or why, into a copy with none of its check-ins.', then: 'the first problem says: Week 4 needs a Cause and a Why', run: () => { const s = demo!; const fresh = { ...s, checkIns: s.checkIns.filter((c) => c.goalId !== 'mttr-pir') }; const m = change('mateo', { checkIns: [rec({ 'Goal ID': 'mttr-pir', Week: '4', Value: '21' })] }, { snapshot: fresh }).issues[0]?.message ?? ''; return `the first problem says: ${/Week 4 needs a Cause and a Why/.exec(m)?.[0] ?? m}`; } },
    ],
    unclear: ['The engine is large (`src/domain/changeset.ts`): this section says what it does; its every message and column rule is in the code and its tests (listed below). A rebuild of the core status rules does not need it; a rebuild of import and bulk edit does.'],
  },
];

/** Runs every example: the ones that don't give what they say. */
export async function wrongExamples(): Promise<string[]> {
  await prepareExamples();
  const out: string[] = [];
  for (const r of RULE_LIST) for (const e of r.examples) {
    let got: string;
    try { got = e.run(); } catch (err) { got = `threw ${String(err)}`; }
    if (got !== e.then) out.push(`${r.id}: “${e.given}” gives “${got}”, not “${e.then}”`);
  }
  return out;
}
