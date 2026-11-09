/* The core rules, in plain words, for the spec (spec/core/rules/). Each rule says what it decides, exactly how, with
   its numbers read from the code (domain/thresholds.ts), and worked examples. Every example is run against the real
   rule by src/spec/spec.test.ts (and by the generator, which refuses to write an example that isn't true), so an
   example can't drift from the code: change a rule and its example fails until it's brought up to date.
   The examples use the same goals as src/domain/rules.test.ts (src/spec/examples.ts). */
import { planChanges, type ChangeInput, type Rec } from '../domain/changeset';
import { planQuestion } from '../domain/goal';
import { emptyDraft, evaluate, MIN_PATH, MIN_REASON, NO_REASON, parseNumber, valueProblem, type Draft } from '../domain/checkin';
import { currentWeek, firstWeekFrom, isCount, isShare, NOT_A_COUNT, planAt, planAsOf, PROJECTION_WEEKS, projection, projectionFor, shapeProgress, valueSeries } from '../domain/plan';
import { amount, byWeekWords, goalScorecard, likelihood } from '../domain/scorecard';
import { fmt } from '../domain/format';
import { assessMetric, assessMilestone, assessRange, goalStatus, projects, RANK, worst } from '../domain/status';
import { MAX_WORKSPACE_NAME, MIN_NAME, nameLength, nameProblem, RULES, TREND_SPAN } from '../domain/thresholds';
import { cycleStanding, leaveWorkspace } from '../domain/removal';
import { teamPeople } from '../domain/actions';
import { ENDING_WEEKS, workspaceNeeds } from '../domain/workspaceAttention';
import { FAR_OUTSIDE, FAR_RATIO, farOutside, groupDigits, placesToKeep, precisionProblem, setupProblem, typedDecimals } from '../domain/numbers';
import { stagesFromJoining } from '../domain/templates';
import { AVATAR_HUES, mergePeople } from '../domain/people';
import { gapTrend, goalTrend } from '../domain/trend';
import { flagsFor, needsAttention, attentionFor } from '../domain/attention';
import { ATTENTION_FLAGS, FLAG, LABEL, shortWord, STATUS_ORDER } from '../domain/vocabulary';
import type { Ask, MetricGoal, Snapshot } from '../domain/types';
import type { ActionContext } from '../domain/actions';
import * as MET from '../domain/metrics';
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
  /** A feature module's rule: its page is in that module's section (spec/modules/<id>/rules.md), not the core's. */
  module?: string;
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
/** An action in the demo workspace, by one of its people, for the metric library's examples. A rule that says no gives its words. */
function asPerson<T>(actor: string, run: (x: ActionContext) => T): T | string {
  const s = demo!;
  const cycle = s.cycles[0]!;
  const today = new Date(CHECK_IN_MOMENT);
  let k = 0;
  const x: ActionContext = { snapshot: s, cycle, week: currentWeek(cycle, today), actor: s.people.find((p) => p.id === actor)!, now: today.toISOString(), newId: (p) => `${p}_x${++k}`, full: s };
  try { return run(x); } catch (e) { return `refused: ${(e as Error).message}`; }
}
const goalIn = (id: string) => demo!.goals.find((g) => g.id === id)!;
const summaryOf = (c: { changes: { summary: string }[] } | null | string) => (typeof c === 'string' ? c : c ? c.changes.map((v) => v.summary).join(' / ') : 'nothing to save');
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
5. **On plan as written.** A number is typed to the goal's decimals *d*. If *actual* equals the plan rounded to those decimals, and no number that can be written at those decimals lands in the on-track band (a ratio of at least ${RULES.onTrack} and under ${RULES.wellAhead}), the goal is \`on\` with ratio 1. This is a new goal's first week when the plan has moved less than one decimal step. Exactly:

   \`\`\`
   step = 10^-d
   a = start + planned × ${RULES.onTrack};  b = start + planned × ${RULES.wellAhead}
   writable = |b − a| ≥ step                       (a band a step wide always holds a number)
   if not writable:
     for k from floor(min(a, b) / step) − 1 to ceil(max(a, b) / step) + 1:
       v = k × step rounded to d places
       if ${RULES.onTrack} ≤ ratio(v) < ${RULES.wellAhead}: writable = true
   if |actual − (plan rounded to d places)| < 10⁻⁹ and not writable: on, ratio 1
   \`\`\`

   *ratio(v)* is step 4's ratio for *v*. Otherwise go on to step 6.
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

- Take the goal's check-ins up to week *w* (those with \`week\` ≤ *w*, from the ones posted by today), ordered by week, then by when they were posted. The latest is the one that counts, judged **in its own week**, not this week: a goal checked in last week is judged against last week's plan.
- A number goal is judged with the plan as of that check-in's week, its number, and the numbers before it (for the projection).
- A range goal is judged with its number and the one before it.
- A number goal (to move or keep in range) with no check-in up to week *w* is judged in week *w* with no number: \`planned\` in week 0, else \`none\`.
- Dated stages are judged in week *w* (this week), with the latest check-in's stage updates (a stage the updates don't mention has no update: not done, expected in its due week): a stage that is overdue is late whether or not anyone has checked in. With no check-in at all and nothing late, it is \`none\`, not \`on\` (no evidence is not good news).

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
- A slope the numbers barely support counts for little: *t* = *slope* / *se*, with *se* = *spread* / √*Sxx* (*t* is infinite when *se* ≤ 10⁻¹², so float noise on a clean trend counts as no spread), and the line leans by *lean* = *t*² / (1 + *t*²) (1 when *t* is infinite).
- To week *T*: *value* = *ȳ* + *lean* · *slope* · (*T* − *x̄*).
- *half* = *spread* · √(1/*n* + (*T* − *x̄*)² / *Sxx*); *low* = *value* − *half*, *high* = *value* + *half*. About two chances in three that the number lands inside if nothing changes. A clean trend has no spread, so its range is the line itself.
- Every result (value, low, high, slope) is rounded to 9 decimal places. The *slope* it gives is the one the line leans by, *lean* · *slope*, not the fitted slope (the conformance data's \`slope\` column is this one). It also says *from* (first week used), *to* (*last*.week) and *week* (*T*).

**Held to what the number can be** (\`projectionFor\`, which every projection of a goal's own numbers goes through), judged on the goal as it is projected: a number to move with the plan as of the week judged (its start, its target and its hand-set points; earlier plans in \`planHistory\` don't count), a range with its limit alone (no start or target).

- A *share* (\`isShare\`): the unit, trimmed, is \`%\`, and every one of those plan numbers is within 0–100. Value, low and high are held to 0–100.
- A *count* (\`isCount\`): 0 decimals; every one of those plan numbers a whole number, zero or more; and a unit that, trimmed and in lower case, is not \`%\` and doesn't match \`/${NOT_A_COUNT.source}/\` (a time, money, points or a score: the whole unit is one of those words, or it holds a currency code or sign or a degree sign anywhere). Value, low and high are held at or above 0. The unit is otherwise free: \`deploys\`, \`templates\`, \`TB\` and \`checks\` are counts when the rest holds.

**Where it is used.** A number to move projects to its due week (\`endWeek\` of the plan as of the week judged, the latest check-in's; else the cycle's end) from every earlier check-in that has a number (all of them, in week order then posting order, even two in one week) plus the number of the week judged. A range goal's scorecard projects to the cycle's end from one number per week: of the check-ins with a number, the latest posted in each week wins (a later check-in with no number doesn't hide an earlier one with a number).`,
    examples: [
      { given: 'Numbers in weeks 1 and 2 only, projected to week 13.', then: 'none', run: () => (projection([{ week: 1, value: 10 }, { week: 2, value: 12 }], 13) ? 'a projection' : 'none') },
      { given: '10 in week 1 and 16 in week 4, to week 13.', then: 'value 34, range 34–34, slope 2', run: () => { const p = projection([{ week: 1, value: 10 }, { week: 4, value: 16 }], 13)!; return `value ${n(p.value)}, range ${n(p.low)}–${n(p.high)}, slope ${n(p.slope)}`; } },
      { given: 'A clean trend: 0 in week 1, 10 in week 3, 25 in week 6, to week 13.', then: 'value 60, range 60–60, slope 5', run: () => { const p = projection([{ week: 1, value: 0 }, { week: 3, value: 10 }, { week: 6, value: 25 }], 13)!; return `value ${n(p.value)}, range ${n(p.low)}–${n(p.high)}, slope ${n(p.slope)}`; } },
      { given: 'An old slump doesn’t count: 90 in week 1, 10 in week 2, then 20, 22, … 34 in weeks 10–17, to week 20.', then: 'from week 10, value 40', run: () => { const p = projection([{ week: 1, value: 90 }, { week: 2, value: 10 }, ...Array.from({ length: 8 }, (_, i) => ({ week: 10 + i, value: 20 + 2 * i }))], 20)!; return `from week ${p.from}, value ${n(p.value)}`; } },
      { given: 'A noisy CSAT: 84, 81, 86, 82, 87, 80, 85, 83, 84, 81, 86, 82 in weeks 34–45, to week 53.', then: 'value 83.096, range 78.397–87.796, from week 38', run: () => { const p = projection([84, 81, 86, 82, 87, 80, 85, 83, 84, 81, 86, 82].map((value, i) => ({ week: 34 + i, value })), 53)!; return `value ${n(p.value)}, range ${n(p.low)}–${n(p.high)}, from week ${p.from}`; } },
      { given: 'Incidents, a count: 12, 8, 3, 2 in weeks 1, 3, 5, 6, to week 13. The bare line goes below zero; the goal’s projection stops at 0.', then: 'line low -14.33; held: value 0, low 0', run: () => { const pts = [{ week: 1, value: 12 }, { week: 3, value: 8 }, { week: 5, value: 3 }, { week: 6, value: 2 }]; const p = projectionFor({ ...metric(12, 0), unit: 'incidents' }, pts, 13)!; return `line low ${n(projection(pts, 13)!.low, 2)}; held: value ${n(p.value)}, low ${n(p.low)}`; } },
      { given: 'The latest check-in of each week counts: week 2 posted twice (5, then 7 a day later), and week 1 with 3.', then: '1: 3, 2: 7', run: () => valueSeries([ci('m', 2, 5, { postedAt: '2026-09-21T10:00:00Z' }), ci('m', 2, 7, { postedAt: '2026-09-22T10:00:00Z' }), ci('m', 1, 3)]).map((p) => `${p.week}: ${p.value}`).join(', ') },
      { given: 'The same noisy CSAT: the slope the line was fitted with, and the slope the projection gives (leaned).', then: 'fitted -0.19, given -0.035', run: () => { const pts = [84, 81, 86, 82, 87, 80, 85, 83, 84, 81, 86, 82].map((value, i) => ({ week: 34 + i, value })).slice(4); const xm = pts.reduce((t, p) => t + p.week, 0) / pts.length, ym = pts.reduce((t, p) => t + p.value, 0) / pts.length; const fitted = pts.reduce((t, p) => t + (p.week - xm) * (p.value - ym), 0) / pts.reduce((t, p) => t + (p.week - xm) ** 2, 0); return `fitted ${n(fitted)}, given ${n(projection(pts, 53)!.slope)}`; } },
      { given: 'Whole-number goals from 0 to 10 in deploys, ms, USD, pts, TB and min; then deploys from 0 to 10.5 with 1 decimal; then % from 10 to 40.', then: 'count, not, not, not, count, not; not; share', run: () => [['deploys', 'ms', 'USD', 'pts', 'TB', 'min'].map((unit) => isCount({ ...metric(0, 10), unit }) ? 'count' : 'not').join(', '), isCount({ ...metric(0, 10.5), unit: 'deploys', decimals: 1 }) ? 'count' : 'not', isShare(metric(10, 40)) ? 'share' : 'not'].join('; ') },
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

1. \`value\` (none typed), \`value-not-number\`, \`value-precision\` (more decimal places than the goal keeps), or \`value-impossible\` (refused above): at most one of them, checked in that order. Not asked of dated stages. A number that is refused for its precision or as impossible is still the number the draft is judged with, so the codes below are asked of it too; one that can't be read (\`value\`, \`value-not-number\`) is judged as no number.
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
      { given: 'The 30→75 goal in week 4 (plan 43.846): nothing typed; "abc"; "140"; "44". Every code still missing, in order: a refused number is still judged, so 140 (well ahead) also asks for its reason.', then: 'value; value-not-number; value-impossible, reason-ahead; nothing missing', run: () => [{}, { value: 'abc' }, { value: '140' }, { value: '44' }].map((d) => evaluate(g3075, CYCLE, 4, D(d), []).codes.join(', ') || 'nothing missing').join('; ') },
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
      { file: 'src/domain/numbers.ts', names: ['typedDecimals', 'precisionProblem', 'placesToKeep', 'notNumberText', 'groupDigits', 'fixed', 'farOutside', 'setupProblem'] },
      { file: 'src/domain/goal.ts', names: ['validateGoal', 'planHint', 'planQuestion'] },
      { file: 'src/domain/people.ts', names: ['sameNameNote', 'personTell', 'nameWithTell', 'avatarHues', 'duplicateTitles', 'goalTell', 'sameTitleNote'] },
      { file: 'src/domain/thresholds.ts', names: ['MIN_NAME', 'nameProblem'] },
    ],
    tests: ['src/domain/numbers.test.ts', 'src/domain/names.test.ts'],
    reqs: ['NO-SILENT-ROUNDING', 'SAME-NAMES'],
    body: `
One rule for every way in: the check-in, New goal, goal edit, the workspace set-up, the spreadsheet import and the AI tools (backlog N).

**Never rounded quietly.** Each number goal keeps a number of decimal places (*Decimals*, 0 to 3), and every number of it is shown at those places. A number typed with more (\`typedDecimals\`: the digits after the point, trailing zeros not counted; a decimal comma counts as a point) is refused (\`precisionProblem\`), saying what it would show as and the two ways forward: type it at the goal's places, or raise Decimals. In a check-in the refusal offers to raise Decimals for the goal in one step, to the places the number was typed with, up to 3 (\`placesToKeep\`: "Keep 1 decimal place for this goal"), logged as a change to the goal with why. This holds for a check-in's value, a start, target, limit, margin and any plan number typed by hand. A plan already stored isn't judged again when a goal is edited; only numbers changed are. An import that adds a goal without Decimals takes the most decimal places its start, target and limit were typed with (up to 3).

**Letters in a number** get one message everywhere (\`notNumberText\`): ““a12” isn't a number. Type digits only, like 29.4.” (Letters after the digits are read as a unit: “12 days” is 12.)

**Thousands grouped.** Every number shown is written at its places with its thousands grouped by commas (\`groupDigits\`, \`fixed\`): 1,250,000; −12,000; 1,250.5. Files and the AI tools' data carry the plain number.

**Questioned, never refused.** In a check-in, see [the check-in](check-in.md). Setting up (\`setupProblem\`, \`planHint\`): over 100% (asked as before); below zero for a percentage, time or money; a target ${FAR_RATIO} times the start or more, or a ${FAR_RATIO}th of it or less (both non-zero, the same sign); a billion or more. The import notes it on the row; a goal already set up that way isn't asked again.

**Plan changes confirmed, never silent** (\`planQuestion\`). The same check as a check-in's, applied when an existing number goal's plan changes, in the app's goal edit, the spreadsheet import, the data tables and the AI tools (one rule, in the change engine and the edit form). Two things are asked, in this order, and the change saves only once someone says yes:
- **Which way is better flips:** the new target is on the other side of the start (a 14 → 3 min goal given a target of 999). It says so: “This makes higher better: the target (999 min) is now above the start (14 min). It was 14 min to 3 min, lower is better.” The yes is “Yes, make higher better”.
- **Far outside the old plan:** a new start, target or hand-set week's number more than ${FAR_OUTSIDE} times the old plan's width beyond either end (\`farOutside\`): “The target of 400% is far outside the plan it replaces (30% to 75%). Status, progress and the forecast will all be judged against it.”

The app asks beside the target, with a tick box carrying the yes; Import and Data list the questions above What will change with one yes button; the AI tools refuse with the question until called again with \`confirm: true\`. A plan already stored isn't asked about again, and a new goal is asked about its numbers by \`planHint\` instead.

**Names.** A workspace's, a goal's or an outcome's name has at least ${MIN_NAME} characters (\`nameProblem\`). Two goals may have the same title (compared without case or outer spaces): making one warns (\`sameTitleNote\`), and wherever both could be on screen each shows its key, or else its team, beside the title (\`duplicateTitles\`, \`goalTell\`). An import row with no key whose title another goal has is that goal again unless it names another team; then it's a new goal, noted. Two people may have the same name: the email is who someone is. Adding or renaming one says so (\`sameNameNote\`); beside the name goes their team, else their job title, else their email, whichever tells them apart (\`personTell\`). Each avatar's colour comes from the person's ID, and people with the same initials each get a colour none of the others has while there are colours to go round (\`avatarHues\`, ${AVATAR_HUES} colours).`,
    examples: [
      { given: 'Typed "12.5", "12.50", "1,250", "29,4", "3.25 days".', then: '1, 1, 0, 1, 2', run: () => ['12.5', '12.50', '1,250', '29,4', '3.25 days'].map((x) => String(typedDecimals(x))).join(', ') },
      { given: '12.5 in a goal of whole numbers.', then: '12.5 has 1 decimal place, but this goal keeps whole numbers, so it would show as 13. Type 13, or set the goal’s Decimals to 1.', run: () => precisionProblem('12.5', 12.5, 0) ?? 'fine' },
      { given: 'The places a check-in offers to keep for 5.5, 5.25 and 1.23456 on a whole-number goal, and for 5.', then: '1, 2, 3, none', run: () => ['5.5', '5.25', '1.23456', '5'].map((x) => String(placesToKeep(x, Number(x), 0) ?? 'none')).join(', ') },
      { given: '1250000, -12000 and 1250.5 shown.', then: '1,250,000, -12,000, 1,250.5', run: () => ['1250000', '-12000', '1250.5'].map(groupDigits).join(', ') },
      { given: 'A start of 10 signups and a target of 5,000.', then: 'The target is over 100 times the start (10 to 5,000). Is that right?', run: () => setupProblem('signups', 10, 5000) ?? 'fine' },
      { given: '400 typed for the 30→75 goal, then 110.', then: 'questioned; fine', run: () => [farOutside(400, 30, 75), farOutside(110, 30, 75)].map((x) => (x ? 'questioned' : 'fine')).join('; ') },
      { given: 'A queue wait goal, 14 → 3 min (lower is better), given a target of 999.', then: 'direction: This makes higher better: the target (999 min) is now above the start (14 min). It was 14 min to 3 min, lower is better. [Yes, make higher better]', run: () => { const was = metric(14, 3, 'straight', { unit: 'min' }); const q = planQuestion(was, { ...was, plan: { ...was.plan, target: 999 } }); return q ? `${q.code}: ${q.text} [${q.confirm}]` : 'fine'; } },
      { given: 'The 30→75 goal given a target of 400, then of 90.', then: 'far: The target of 400% is far outside the plan it replaces (30% to 75%). Status, progress and the forecast will all be judged against it. / fine', run: () => [400, 90].map((t) => { const q = planQuestion(g3075, { ...g3075, plan: { ...g3075.plan, target: t } }); return q ? `${q.code}: ${q.text}` : 'fine'; }).join(' / ') },
      { given: 'In the demo workspace, Tariq turns the AI-assisted reviews north star (ns-ai) round (its target the same distance on the other side of its start), with a reason; then again, confirmed.', then: 'asks first, nothing to save; ready to save', run: () => { const g = goalIn('ns-ai') as MetricGoal; const t = String(2 * g.plan.start - g.plan.target); const tables = { goals: [rec({ ID: 'ns-ai', Target: t })] }; return [change('tariq', tables, { reason: 'Measuring the other way round now' }), change('tariq', tables, { reason: 'Measuring the other way round now', confirm: true })].map((cs) => (cs.commit ? 'ready to save' : cs.needsConfirm ? 'asks first, nothing to save' : issues(cs))).join('; '); } },
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

One rule says whether a goal is **getting worse**, **getting better** or neither (\`flat\`). It looks at the last ${TREND_SPAN} check-ins: of every check-in on the goal in the workspace (posted by today), whatever week it is for; not cut to week ≤ this week as the calculation is.

\`gapTrend(gaps)\`: *gaps* are each check-in's distance from where it should be, oldest first, positive when better. Take the last ${TREND_SPAN}; with fewer, \`flat\`. The two steps between them both down (each by more than 10⁻⁹): \`worse\` (for a number to move, only if the latest gap is also below −10⁻⁹: short of plan). Both up by more than 10⁻⁹: \`better\`. Otherwise \`flat\`.

- **A number to move:** each of the goal's check-ins with a number (in week order, then posting order) gives (*value* − plan for its own week, by the plan as of that week) × the better direction (+1 if the target is above the start, else −1). Unrounded, so a number held flat while the plan moves on is further behind each time. If that isn't \`worse\` (whether it was \`flat\` or \`better\`) but there are at least ${TREND_SPAN} numbers, and the latest, judged in its own week against the goal's **current** plan (here, unlike everywhere else, not the plan as of that week; with the earlier numbers for its projection), is \`on\` while its projection's likeliest value misses the target: \`worse\` ("on track today, but heading short").
- **A number to keep in range:** the last ${TREND_SPAN} numbers' room to the limit: (*value* − *limit*) × (−1 for at most, +1 for at least).
- **Dated stages** (not through \`gapTrend\`): the last two check-ins with stage updates (fewer: \`flat\`), each judged as in [the status](status.md) in its own week, so a stage's *expected* week at the earlier check-in is what the status rule gave then (its forecast or due week, never before its due week, and never before that check-in's week once overdue; a done stage's expected week is its done week). Stages are compared in the goal's stage order. \`worse\` if any stage not done is now expected later than at the one before (this wins); else \`better\` if a stage is newly done in a week strictly earlier than it was expected at the one before, or any not done is expected strictly sooner; else \`flat\`.

### The flags

\`flagsFor(goal, workspace, cycle, today)\`. With the official status (see [the status](status.md)), *week* the week today, *latest* the latest check-in and its path to green, and *behind* meaning the status is \`off\` or \`risk\`:

| Flag | When |
|---|---|
| ${FLAG.off.label} (\`off\`) | the status is \`off\` |
| ${FLAG.stale.label} (\`stale\`) | the status is \`stale\` |
| ${FLAG['missed-path'].label} (\`missed-path\`) | behind, and the path to green names a week that is before this week |
| ${FLAG.decision.label} (\`decision\`) | not done, and an ask of kind \`decision\` whose \`goalIds\` include this goal has \`status\` \`open\` in the workspace as it stands today (in the conformance data, as of the week’s moment, so an ask answered later counts as open) |
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
- a decision ask that includes the goal was answered: its \`status\` is \`answered\` (not \`done\`, which is for actions), timed by \`answeredAt\`; the latest such answer;

and no flag is raised now (apart from \`due\`, left out of *now* only) that wasn't also raised when the same rules are run on the **same workspace** with "today" set to the moment of the earliest look (the earliest of every qualifying look, of any kind) (the workspace is not re-cut to that moment). Decisions and asks that were removed are not in the workspace at all, so never count. The strongest look names it: an action, then an answer, then a note, then a review; the latest of the strongest kind.

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
    code: [{ file: 'src/domain/scorecard.ts', names: ['likelihood', 'likelihoodFloor', 'goalScorecard', 'amount', 'byWeekWords'] }, { file: 'src/domain/status.ts', names: ['doneCheckIn', 'projects'] }, { file: 'src/domain/summaryFacts.ts', names: ['summaryFacts'] }, { file: 'src/domain/vocabulary.ts', names: ['shortWord'] }, { file: 'src/domain/year.ts', names: ['quarterResult'] }],
    tests: ['src/domain/scorecard.test.ts', 'src/domain/year.test.ts', 'evals/goalPage.eval.ts'],
    reqs: ['GOAL-PAGE-SCORECARD', 'PROJECTION-RANGE', 'HONEST-NUMBERS'],
    body: `
\`goalScorecard(goal, cycle, checkIns, week, stale)\` gives a few cells, each a key, a label, a value, a muted line under it (*sub*) and a tone (\`good\`, \`bad\` or \`flat\`). *stale* is true when the official status is \`stale\`: then nothing is projected. Every number comes from the rules above; the scorecard only words them, and decides one thing of its own: the likelihood.

**How likely** (\`likelihood(mark, projection, better, floor)\`), worked in the better direction (+1 when higher is better): *half* = max(half the projected range's width, *floor*, 10⁻⁹); *d* = (*mark* − likeliest value) × *better* / *half*. *d* ≤ −0.5: **Likely**; ≤ 1: **Possible**; ≤ 2: **Unlikely**; above: **Very unlikely**. Words, never a percentage. The floor for a target is max(2% of the planned change, half the goal's last decimal place); for a limit, the same with the margin (or 10% of the limit when there is no margin) in place of the planned change.

**Where the numbers come from.** A number to move and a range are judged by \`assessPosted\` in week *w* (the latest check-in up to week *w*, by week then posting, in its own week); dated stages by the status rule in week *w*. *better* is +1 when higher is better and −1 when lower is: for a number to move, +1 when the **current** plan's target ≥ its start (so the direction, the target, the due week and the likelihood floor come from the goal's current plan, while *plan*, *actual* and the projection come from \`assessPosted\`, with the plan as of the latest check-in's week); for a range, +1 for \`atLeast\`, −1 for \`atMost\`.

**Tones.** \`plan\`: ahead \`good\`, behind \`bad\`, on plan or no number \`flat\`. \`since\`: better \`good\`, worse \`bad\`, otherwise \`flat\`. \`target\`: reached \`good\`, else \`flat\`. \`hit\`: Likely \`good\`, Possible \`flat\`, Unlikely and Very unlikely \`bad\`, Can’t say and Too early \`flat\`. \`limit\`: outside \`bad\`, near \`flat\`, inside \`good\`. \`room\`: over \`bad\`, within the margin (room ≤ margin) \`flat\`, else \`good\`. \`done\`: at least as many done as are due \`good\`, else \`flat\`. \`late\`: any behind \`bad\`, none \`good\`. \`next\`: expected after its due week \`bad\`, else \`flat\`; All done \`good\`. A margin of 0 counts as none for the likelihood floor. \`likelihood\` is set only on a \`hit\` cell that says a likelihood. Every cell that says "No value yet" is \`flat\`.

A stopped goal has no \`hit\` cell. (The conformance data never shows one: a goal stopped by a week's moment isn't in that week.) Nor has a done goal (\`doneCheckIn\`: of its check-ins with \`week\` ≤ *w*, the one posted most recently, by \`postedAt\`, is called \`done\`): for a number to move or keep in range, a \`result\` cell takes its place, at the end of the row (see the words below); dated stages get no \`result\` cell, only lose \`hit\` (they have none). Neither projects anywhere (\`projects\`): no likely end on the chart, no forecast in a list or an export. A quarter of a done goal that starts after the week it was done has nothing due ("done in week 37"); the quarter it was done in is judged then, on its final number.

### The words

Every label, value and sub line, exactly. Text in quotes is literal (the ’ in “Can’t say” is U+2019). *w* is the week judged.

**How a number is written.**

- *n(v)*: *v* to the goal's decimals (\`toFixed\`), thousands grouped with commas (\`fixed\`): 1,250.5; -0.40. No special case for a sign: a small negative number keeps its minus even when it rounds to zero, so -0.3 at 0 decimals is "-0" (a projection of a time just below zero says "likely -0 min by year end").
- **A value** \`fmt(v)\`: *n(v)*, then the unit: \`%\` attached ("44%"); no unit, nothing; any other unit after a space ("28 hours", "0.41 USD"). The unit is made singular (its last letter dropped) only when *n(v)* is exactly "1" and the unit is a lower-case word of three or more letters ending in a single s (\`/^[a-z][a-z-]+[^s]s$/\`): "1 hour", "1 template"; but "1.0 hours", "1 ms", "1 pts".
- **An amount** (a difference, always positive) \`amount(v)\`: *n*(|*v*|), then: for \`%\`, " pt" when that number is 1 and " pts" otherwise ("1 pt", "0.4 pts", "1.0 pt"); no unit, nothing; any other unit after a space, made singular (last letter dropped) when the number is 1 ("1", "1.0" and "1.00" all count) and the unit ends in a letter then "s", any case (\`/[a-z]s$/i\`): "1 hour", "1.0 day", "1 pt" for \`pts\`, and "1 m" for \`ms\` (a known slip, backlog 0u, kept until it is fixed with a conformance row).
- **The mark** in a label: *n(target)*, with "%" attached for \`%\` and no other unit: "Will it hit 24?", "Will it hit 80%?".
- **By when** \`byWeekWords(due)\`: due ≥ the cycle's weeks: "by year end" when the cycle has 48 weeks or more, else "by cycle end"; otherwise "by week *due*".

**A number to move**, in this order. *a* = \`assessPosted\` in week *w*: *actual* (the latest check-in's number, or none), *plan* (the plan for the latest check-in's week, as of that week; with no check-in, for week *w*), *a.week* (the latest check-in's week, or *w*), the projection. *target* and *due* (the plan's end week) are the current plan's.

| Cell | Label | Value | Sub |
|---|---|---|---|
| \`plan\` | "Vs plan" | No number: "No value yet". Else *diff* = (*actual* − *plan*) × *better*, rounded to the decimals: 0 "On plan"; above 0 "*amount(diff)* ahead of plan"; below "*amount(diff)* behind plan" | "plan *fmt(plan)*", then " in week *a.week*" when *a.week* < *w* (not when there is no number) |
| \`since\` | "Vs last week", or "Last change" when stale | See *Since* below | See *Since* below |
| \`target\` | "To target" | No number: "No value yet". Else *left* = (*target* − *actual*) × *better*, rounded: ≤ 0 "Target reached"; else "*amount(left)* to go" when higher is better, "*amount(left)* over" when lower is | "target *fmt(target)*", then " by week *due*" when *due* ≠ the cycle's weeks |
| \`hit\` | "Will it hit *mark*?" | Stale: "Can’t say". No projection: "Too early to say". Else the likelihood's word: "Likely", "Possible", "Unlikely", "Very unlikely" | Stale: "no recent update to go on". No projection: "needs three weeks of numbers". Else "likely *fmt(value)* *byWeekWords(due)*" |

**A number to keep in range**, in this order: \`limit\`, \`since\`, \`room\`, \`hit\`. *a* = \`assessPosted\` in week *w* (*actual*, *out*, *near* as in [the status](status.md)); *lim* = "at most *fmt(limit)*" or "at least *fmt(limit)*"; *room* = (*limit* − *actual*) × −*better*, rounded to the decimals (positive inside the limit).

| Cell | Label | Value | Sub |
|---|---|---|---|
| \`limit\` | "Vs the limit" | No number: "No value yet". Out: "Outside it"; near: "Inside, near it"; else "Inside it" | "must stay *lim*" |
| \`room\` | "Room to the limit" | No number: "No value yet". *room* > 0: "*amount(room)* of room"; 0: "None: at the limit"; below 0: "*amount(room)* over" (\`atMost\`) or "*amount(room)* under" (\`atLeast\`) | "warning within *amount(margin)*" (also with no number) |
| \`hit\` | "Back within by the end?" when out, else "Will it stay within?" | As for a number to move, with the limit as the mark; the projection is one number per week (the latest posted wins) up to week *w*, to the cycle's end | As for a number to move, with *byWeekWords(the cycle's weeks)* |

The likelihood floor for a range is max(2% of |*margin*| (or of |10% of the limit| when the margin is 0), half the last decimal place).

**A done goal's result** (\`result\`, a number to move or keep in range, in place of \`hit\` and after the other cells). *done* = the check-in \`doneCheckIn\` found.

| Cell | Label | Value | Sub | Tone |
|---|---|---|---|---|
| \`result\` | "Result" | "Done" | "*fmt(done.value)* in week *done.week*" ("76% in week 5"); with no number, "in week *done.week*" | \`good\` |

The other cells stay as they are, judged as usual; \`likelihood\` is empty on \`result\`.

**Since** (\`since\`, both kinds). The goal's check-ins up to week *w*, by week then posting; *latest* the last; *before* the last one ahead of it in that order with a number (another check-in in the same week counts).

| When | Value | Sub | Tone |
|---|---|---|---|
| No check-in at all | "No check-in yet" | "nothing to compare" | \`flat\` |
| *latest* has no number | "No number this time" | "no number to compare" | \`flat\` |
| No *before* | "First check-in" | "nothing to compare yet" | \`flat\` |
| *delta* = *latest* − *before*, rounded to the decimals, is 0 | "No change" | "was *fmt(before)* in week *before.week*" | \`flat\` |
| *delta* × *better* > 0 | "*amount(delta)* better" | the same | \`good\` |
| otherwise | "*amount(delta)* worse" | the same | \`bad\` |

For a range, better means further from the limit on its safe side.

**Dated stages**, in this order. Stages are judged in week *w* with the latest check-in's stage updates (up to week *w*). *late* = the stages not done with weeks late > 0; *most* = the most weeks late among them.

| Cell | Label | Value | Sub |
|---|---|---|---|
| \`done\` | "Stages done" | "*done* of *all*" | "*due* due by week *w*" (*due*: stages with due week ≤ *w*) |
| \`late\` | "Stages behind" | the count of *late*, or "None" | None: "on schedule". Else the kinds, then ", up to *most* week" (1) or "weeks": all Late "late, up to 4 weeks"; all Slipping "slipping, up to 1 week"; both "*k* late, *j* slipping, up to 5 weeks" |
| \`next\` | "Next stage" | The not-done stage with the earliest **due** week (ties: the earlier in the goal's stage order): "Week *expected*". None left: "All done" | Its name, then ", due week *due*" when expected after its due week. All done: "last done in week *m*", *m* the latest done week (0 if none) |

**Short or over** (\`shortWord(better)\` in \`src/domain/vocabulary.ts\`, the one place the word is chosen): an amount on the wrong side of a plan or target is "short" when higher is better and "over" when lower is better: "1 pt short" of a 46% plan, "1 min over" a 6 min plan. The scorecard's \`target\` cell, the chart's mark at the due week ("5 over") and a quarter's result ("Q3: 7 min against a plan of 6 min, 1 min over") all use it.

**A quarter's result** (\`quarterResult\` in \`src/domain/year.ts\`) compares the number with the plan at the quarter's end as both are shown, at the goal's decimals: 0.68 against a plan shown as 0.68 is met, never "0.00 short".`,
    examples: [
      { given: 'A target of 75, higher is better, projected 80 (range 78–82, d = −2.5); 76 (72–80, d = −0.25); 72 (70–74, d = 1.5); 60 (58–62, d = 7.5).', then: 'likely, possible, unlikely, very-unlikely', run: () => [[80, 78, 82], [76, 72, 80], [72, 70, 74], [60, 58, 62]].map(([value, low, high]) => likelihood(75, { value: value!, low: low!, high: high! }, 1)).join(', ') },
      { given: 'A target of 18, lower is better, projected 19 (range 18–20): d = (18 − 19) × −1 / 1 = 1.', then: 'possible', run: () => likelihood(18, { value: 19, low: 18, high: 20 }, -1) },
      { given: 'The 30→75 goal with 36, 39, 42, 45 in weeks 1–4, seen in week 4.', then: 'plan: 1 pt ahead of plan [good] (plan 44%); since: 3 pts better [good] (was 42% in week 3); target: 30 pts to go [flat] (target 75%); hit: Very unlikely [bad] (likely 72% by cycle end)', run: () => goalScorecard(g3075, CYCLE, [36, 39, 42, 45].map((v, i) => ci('m', i + 1, v)), 4, false).cells.map((c) => `${c.key}: ${c.value} [${c.tone}] (${c.sub})`).join('; ') },
      { given: 'Short or over: higher is better, then lower is better.', then: 'short, over', run: () => [shortWord(1), shortWord(-1)].join(', ') },
      { given: 'A 60→30 goal (lower is better) with 50, 48, 46, 45 in weeks 1–4, seen in week 4: To target.', then: '15 pts over [flat] (target 30%)', run: () => { const c = goalScorecard(metric(60, 30), CYCLE, [50, 48, 46, 45].map((v, i) => ci('m', i + 1, v)), 4, false).cells.find((x) => x.key === 'target')!; return `${c.value} [${c.tone}] (${c.sub})`; } },
      { given: 'Values and amounts: 1 and 1.0 in hours (1 and 0 decimals), 1 in ms, 1 in pts, 1250.5 in USD (1 decimal), 0.4 and 1 in %; -0.3 in min (0 decimals).', then: 'fmt: 1 hour, 1.0 hours, 1 ms, 1 pts, 1,250.5 USD, 0.4%, -0 min; amount: 1 hour, 1.0 hour, 1 m, 1 pt, 1,250.5 USD, 0.4 pts, 1 pt', run: () => { const u = (unit: string, decimals = 0) => ({ unit, decimals }); return `fmt: ${[fmt(1, u('hours')), fmt(1, u('hours', 1)), fmt(1, u('ms')), fmt(1, u('pts')), fmt(1250.5, u('USD', 1)), fmt(0.4, u('%', 1)), fmt(-0.3, u('min'))].join(', ')}; amount: ${[amount(1, u('hours')), amount(-1, u('hours', 1)), amount(1, u('ms')), amount(1, u('pts')), amount(1250.5, u('USD', 1)), amount(0.4, u('%', 1)), amount(1, u('%'))].join(', ')}`; } },
      { given: 'By when, in a 53-week year and a 13-week cycle: due week 53; due week 13; due week 40.', then: 'by year end, by cycle end, by week 40', run: () => [byWeekWords({ ...CYCLE, weeks: 53 }, 53), byWeekWords(CYCLE, 13), byWeekWords({ ...CYCLE, weeks: 53 }, 40)].join(', ') },
      { given: 'The 30→75 goal with no check-in, seen in week 2.', then: 'plan: No value yet (plan 37%); since: No check-in yet (nothing to compare); target: No value yet (target 75%); hit: Too early to say (needs three weeks of numbers)', run: () => goalScorecard(g3075, CYCLE, [], 2, false).cells.map((c) => `${c.key}: ${c.value} (${c.sub})`).join('; ') },
      { given: 'The 30→75 goal: 36 in week 1, then week 2 with no number, seen in week 3 (the plan is week 2’s: the latest check-in’s week, though it has no number). Then 36 and 36 in weeks 1 and 2.', then: 'plan: No value yet (plan 37%); since: No number this time (no number to compare); then since: No change (was 36% in week 1), plan: 1 pt behind plan (plan 37% in week 2)', run: () => { const a = goalScorecard(g3075, CYCLE, [ci('m', 1, 36), ci('m', 2, null)], 3, false).cells, b = goalScorecard(g3075, CYCLE, [ci('m', 1, 36), ci('m', 2, 36)], 3, false).cells; const c = (x: typeof a, k: string) => x.find((y) => y.key === k)!; return `plan: ${c(a, 'plan').value} (${c(a, 'plan').sub}); since: ${c(a, 'since').value} (${c(a, 'since').sub}); then since: ${c(b, 'since').value} (${c(b, 'since').sub}), plan: ${c(b, 'plan').value} (${c(b, 'plan').sub})`; } },
      { given: 'A range, at most 12.0% with a 1-point margin, seen in week 4: 10.5, 11.0, 12.6 in weeks 1–3, then 12.4 in week 4.', then: 'limit: Outside it [bad] (must stay at most 12.0%); since: 0.2 pts better [good] (was 12.6% in week 3); room: 0.4 pts over [bad] (warning within 1.0 pt); hit: Back within by the end? Very unlikely [bad] (likely 18.6% by cycle end)', run: () => goalScorecard(RANGE, CYCLE, [10.5, 11, 12.6, 12.4].map((v, i) => ci('r', i + 1, v)), 4, false).cells.map((c) => `${c.key}: ${c.key === 'hit' ? c.label + ' ' : ''}${c.value} [${c.tone}] (${c.sub})`).join('; ') },
      { given: 'The same range: 11.6 in week 1 (near), then 12.0 (at the limit), each seen in its week.', then: 'Inside, near it, 0.4 pts of room [flat]; Inside, near it, None: at the limit [flat]', run: () => [[11.6], [11.6, 12]].map((vs) => { const cs = goalScorecard(RANGE, CYCLE, vs.map((v, i) => ci('r', i + 1, v)), vs.length, false).cells; const r = cs.find((c) => c.key === 'room')!; return `${cs[0]!.value}, ${r.value} [${r.tone}]`; }).join('; ') },
      { given: 'Stages A (due week 3) and B (due week 7), seen in week 6: no check-in; then A done in week 4, B expected week 9; then both done (week 4 and week 8), seen in week 9.', then: 'done: 0 of 2 (1 due by week 6); late: 1 (late, up to 3 weeks); next: Week 6 (A, due week 3) | done: 1 of 2 (1 due by week 6); late: 1 (slipping, up to 2 weeks); next: Week 9 (B, due week 7) | done: 2 of 2 (2 due by week 9); late: None (on schedule); next: All done (last done in week 8)', run: () => { const show = (cs: ReturnType<typeof goalScorecard>['cells']) => cs.map((c) => `${c.key}: ${c.value} (${c.sub})`).join('; '); return [show(goalScorecard(MILESTONE, CYCLE, [], 6, false).cells), show(goalScorecard(MILESTONE, CYCLE, [ci('ms', 6, null, { stages: [{ stageId: 'a', doneWeek: 4, forecastWeek: null }, { stageId: 'b', doneWeek: null, forecastWeek: 9 }] })], 6, false).cells), show(goalScorecard(MILESTONE, CYCLE, [ci('ms', 9, null, { stages: [{ stageId: 'a', doneWeek: 4, forecastWeek: null }, { stageId: 'b', doneWeek: 8, forecastWeek: null }] })], 9, false).cells)].join(' | '); } },
      { given: 'The 30→75 goal with 36, 39, 42, 45 in weeks 1–4 and 76 in week 5, called done; seen in week 7, and its forecast.', then: 'result: Done [good] (76% in week 5); no forecast', run: () => { const cis = [...[36, 39, 42, 45].map((v, i) => ci('m', i + 1, v)), ci('m', 5, 76, { status: 'done' })]; const c = goalScorecard(g3075, CYCLE, cis, 7, false).cells.find((x) => x.key === 'result' || x.key === 'hit')!; return `${c.key}: ${c.value} [${c.tone}] (${c.sub}); ${projects(g3075, goalStatus(g3075, CYCLE, cis, at('2026-10-30T10:00:00Z')).status) ? 'forecast' : 'no forecast'}`; } },
      { given: 'The same, but stale.', then: 'hit: Can’t say', run: () => { const c = goalScorecard(g3075, CYCLE, [36, 39, 42, 45].map((v, i) => ci('m', i + 1, v)), 4, true).cells.find((x) => x.key === 'hit')!; return `hit: ${c.value}`; } },
    ],
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
  /* ---------- the workspace (backlog WS) ---------- */
  {
    id: 'workspace',
    title: 'The workspace: cycles, teams, names, leaving and what needs attention',
    summary: 'What Workspace says about each cycle and team, the longest name a workspace may have, who may leave, and what its overview lists as needing attention.',
    code: [
      { file: 'src/domain/removal.ts', names: ['cycleStanding', 'cycleDeletable', 'leaveWorkspace'] },
      { file: 'src/domain/actions.ts', names: ['teamPeople'] },
      { file: 'src/domain/thresholds.ts', names: ['nameProblem', 'nameLength', 'MAX_WORKSPACE_NAME'] },
      { file: 'src/domain/workspaceAttention.ts', names: ['workspaceNeeds', 'cycleWhen', 'ENDING_WEEKS'] },
      { file: 'src/domain/people.ts', names: ['mergePeople'] },
      { file: 'src/domain/templates.ts', names: ['stagesFromJoining', 'stagesFromNow'] },
    ],
    tests: ['src/domain/workspace.test.ts', 'src/domain/setupTruth.test.ts'],
    reqs: ['WORKSPACE-ONE-PLACE'],
    body: `
**A cycle** (a goal year) says how many goals it has and how many check-ins were posted on them (removed ones don't count), and so whether it can be deleted: only when nobody has checked in to it **and** it isn't the only cycle. The only cycle always stays, so a new workspace's cycle says so rather than offering Delete. Each cycle shows its first and last days (its start date, then \`weeks × 7 − 1\` days on) and whether it is running (with its week), not started yet, or over.

**A team's people** are everyone in it, and its lead even when the lead's own team is another; the lead counts once.

**A workspace's name** is ${MIN_NAME} to ${MAX_WORKSPACE_NAME} characters, after trimming and joining spaces. Nothing cuts it short: the field counts the characters once a name is within 20 of the limit, and a longer name is refused with how long it is.

**Leaving.** Anyone may leave a workspace themselves. It is the same as an admin marking them as left (whoever takes over their goals and open asks is chosen first; they leave the reviews they were in), logged as "Name left the workspace". The only admin may not leave.

**Set-up says only what it was told** (deep review U2–U7). People typed are never replaced by a spreadsheet uploaded after them: the file's people come after, anyone already there (the same email, or the same name where either has no email) isn't added twice, and only a typed row's empty fields take the file's (\`mergePeople\`); the upload says what it added and can be undone. A template's stage weeks count from the week the workspace joins (\`stagesFromNow\`); so do a spreadsheet's, for any goal with a stage due before that week and no check-ins in the file (\`stagesFromJoining\`), said on Check with "Keep the weeks as typed". A goal with check-ins in the file keeps its weeks. Set-up never asks who leads a team, so it names no lead; anything else that adds a team adds its first person as the lead. The invitation link names the workspace (\`/?workspace=<id>\`), and opening it opens that workspace and remembers it, whatever the browser had open. With no goals, nothing is said to be due.

**What needs attention** on the overview, most pressing first: the year ending (the wrap-up open, or opening within ${ENDING_WEEKS} weeks); no goals in the cycle; then, for admins only, fewer than 3 people, people with no email, people in no team, teams with no lead, and no review set up; then new markups and feedback sent from this workspace. Admins are told what only they can fix; everyone is told what anyone can.`,
    examples: [
      { given: 'A new workspace: one cycle, no goals, no check-ins.', then: 'No goals and no check-ins yet; it’s the only cycle, so it stays', run: () => cycleStanding({ ...workspace([]), goals: [] }, CYCLE.id).says },
      { given: 'The same workspace with a second cycle nobody has checked in to.', then: 'No goals and no check-ins yet: it can be deleted', run: () => cycleStanding({ ...workspace([]), goals: [], cycles: [CYCLE, { ...CYCLE, id: 'c2', name: 'Next' }] }, 'c2').says },
      { given: 'One goal with two check-ins, in the only cycle.', then: '1 goal, 2 check-ins: it stays', run: () => cycleStanding(workspace([ci('m', 1, 32), ci('m', 2, 34)]), CYCLE.id).says },
      { given: 'A team led by Lee, who is in it, with Pat in it too.', then: '2 people', run: () => `${teamPeople({ snapshot: workspace([]) }, 't').length} people` },
      { given: 'Theo Brandt (theo@) and Mina Okafor (no email) typed, then a file with THEO@, Mina Okafor (mina@) and Ana Silva uploaded.', then: 'Theo Brandt theo@example.com; Mina Okafor mina@example.com; Ana Silva ana@example.com', run: () => mergePeople([{ name: 'Theo Brandt', email: 'theo@example.com' }, { name: 'Mina Okafor', email: '' }], [{ name: 'Theo B.', email: 'THEO@example.com' }, { name: 'Mina Okafor', email: 'mina@example.com' }, { name: 'Ana Silva', email: 'ana@example.com' }]).map((x) => `${x.name} ${x.email}`).join('; ') },
      { given: 'A spreadsheet loaded at set-up in week 46 of 53: “Canary releases live” at Design@2; Pilot@6; All services@10, and “Later” at A@47; B@50.', then: 'Canary releases live: Design@47; Pilot@50; All services@53 / Later: A@47; B@50', run: () => stagesFromJoining([{ goal: 'Canary releases live', stages: 'Design@2; Pilot@6; All services@10' }, { goal: 'Later', stages: 'A@47; B@50' }], undefined, 46, 53).goals.map((g) => `${g['goal']}: ${g['stages']}`).join(' / ') },
      { given: 'A workspace name of 83 characters.', then: `Keep the name to ${MAX_WORKSPACE_NAME} characters or fewer: it has 83.`, run: () => nameProblem('x'.repeat(83), 'workspace') ?? 'fine' },
      { given: 'A workspace name of 62 characters, as it is typed.', then: `62 of ${MAX_WORKSPACE_NAME} characters`, run: () => nameLength('x'.repeat(62)) ?? 'nothing said' },
      { given: 'Lee, the only admin, leaves.', then: 'refused: You’re the only admin here: make someone else an admin before you leave.', run: () => { try { leaveWorkspace({ snapshot: workspace([]), cycle: CYCLE, week: 2, actor: workspace([]).people[1]!, now: '2026-10-08T12:00:00Z', newId: (p) => p + '_1' }); return 'left'; } catch (e) { return `refused: ${(e as Error).message}`; } } },
      { given: 'What needs attention for an admin in week 2: two people with no email, one goal, no review, 4 new markups from here.', then: 'few-people, no-email, no-review, feedback', run: () => workspaceNeeds(workspace([]), CYCLE, 2, true, 4).map((x) => x.id).join(', ') },
      { given: 'The same, for Pat, who isn’t an admin.', then: 'feedback', run: () => workspaceNeeds(workspace([]), CYCLE, 2, false, 4).map((x) => x.id).join(', ') },
    ],
    unclear: ['How many weeks before the wrap-up "ends soon" starts (four) is a choice, not a law; the rebuild may tune it.', 'Leaving with no goals and no history still marks the person as left (they can be restored), unlike an admin deleting someone with no history.'],
  },
];

/** The feature modules' rules: each is written in its module's section of the spec. */
RULE_LIST.push({
  id: 'metrics',
  module: 'metrics',
  title: 'The metric library',
  summary: 'What a metric must say, who may add, change, remove, link and unlink one, and which metric measures a goal, for which slice.',
  code: [{ file: 'src/domain/metrics.ts', names: ['metricProblems', 'saveMetric', 'removeMetric', 'linkProblems', 'linkGoalMetric', 'unlinkGoalMetric', 'measureOf', 'goalTarget'] }, { file: 'src/domain/removal.ts', names: ['undoRemoval', 'restoreRemoved'] }],
  tests: ['src/domain/metrics.test.ts', 'src/modules/metrics/tools.test.ts'],
  reqs: [],
  body: `
A **metric** is one number defined once per workspace, so every goal about it means the same thing. It has a **name**, a **unit** and a **direction** (higher or lower is better): those three are required. Everything else is optional: what it **means and how it’s calculated**, **decimals** (0 to ${MET.METRIC_LIMITS.decimals}; 0 when not said), its **source** and who owns that source (text), how often the source **refreshes** (${MET.REFRESHES.join(', ')}, or not said), its **owner** (a person in the workspace: whoever added it, unless they hand it on) and **caveats**. A name is 3 to ${MET.METRIC_LIMITS.name} characters and no other metric in use shares it, whatever the case; a unit is up to ${MET.METRIC_LIMITS.unit} characters; each text up to ${MET.METRIC_LIMITS.text.toLocaleString('en-GB')}. Text is trimmed before it’s checked.

**Who may.** Anyone adds a metric. Only its owner or an admin changes or removes it. Only a goal’s owner or an admin says which metric measures the goal, or stops it being measured by one, whoever owns the metric.

**Measuring a goal.** A goal is measured by at most one metric, for one **slice**: a team’s number, or the whole company’s. The goal’s own target is the target in that metric (a number to move: its plan’s target; a number to keep in range: its limit); nothing is copied. A goal with dated stages has no number, so no metric measures it. The goal and the metric must have the same unit, any case. A goal aiming the other way from the metric’s better direction (planned to go up when lower is better, or kept at least a level when lower is better) is linked with a warning, since a guardrail may mean it. So is a goal that keeps more decimal places than its metric. The goal's target in the metric is shown as every number is ([numbers and names](../../core/rules/numbers-and-names.md)): at the goal's decimals, digits grouped, with its unit. Linking again with the same metric and slice changes nothing; another metric or slice is a change.

**Logged, never lost.** Every change is in the change log as a metric change (adding, changing field by field, removing, restoring; linking and unlinking on the goal it measures). Removing a metric keeps its row, unlinks every goal it measured in the same save, and leaves the goals as they were. Undo straight after puts the metric and its links back; restoring it later from Recently removed brings the metric back without its old links. Unlinking keeps the link’s row too, and Undo puts it back.`,
  examples: [
    { given: 'Oskar adds a metric named “Build time” with no unit or direction.', then: 'refused: Say its unit: %, min, hours, USD, deploys… Say which way is better: higher or lower.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'Build time' }).commit)) },
    { given: 'Oskar adds “Build time”, in min, lower is better.', then: 'Added the metric “Build time”', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'Build time', unit: 'min', direction: 'lower' }).commit)) },
    { given: 'Oskar adds “flaky TEST rate”, in %, lower is better, when “Flaky test rate” is already in the library.', then: 'refused: There’s already a metric called Flaky test rate. Use it, or give this one a different name.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { name: 'flaky TEST rate', unit: '%', direction: 'lower' }).commit)) },
    { given: 'Oskar changes the caveats of Flaky test rate, which Rhea owns.', then: 'refused: Only Rhea Kapoor or an admin can change this metric.', run: () => summaryOf(asPerson('oskar', (x) => MET.saveMetric(x, { id: 'metric_flaky-rate', caveats: 'Retries hide some.' }).commit)) },
    { given: 'Rhea changes Flaky test rate to 2 decimals.', then: 'Changed the metric “Flaky test rate”', run: () => summaryOf(asPerson('rhea', (x) => MET.saveMetric(x, { id: 'metric_flaky-rate', decimals: 2 }).commit)) },
    { given: 'What measures the lead time north star (ns-lead), and its target in it.', then: 'Lead time for changes, The whole company, target 24', run: () => { const m = MET.measureOf(demo!, goalIn('ns-lead'))!; return `${m.metric.name}, ${m.slice}, ${m.target!.kind} ${m.target!.value}`; } },
    { given: 'What measures the flaky test goal (lead-flaky, keep it at most 2%).', then: 'Flaky test rate, CI/CD, at most 2', run: () => { const m = MET.measureOf(demo!, goalIn('lead-flaky'))!; return `${m.metric.name}, ${m.slice}, ${m.target!.kind} ${m.target!.value}`; } },
    { given: 'Rhea measures her test-sharding goal (ci-shard, in %, planned 20 to 90) by Remote build cache hit rate (%, higher is better) for CI/CD.', then: 'Measured by “Remote build cache hit rate” for CI/CD', run: () => summaryOf(asPerson('rhea', (x) => MET.linkGoalMetric(x, goalIn('ci-shard'), 'metric_cache-hit', 'cicd'))) },
    { given: 'Rhea measures ci-shard (planned to go up) by Flaky test rate (lower is better).', then: 'error: none; warning: The goal aims up, but for Flaky test rate lower is better. Check it’s meant.', run: () => { const p = MET.linkProblems(goalIn('ci-shard'), demo!.metrics!.find((m) => m.id === 'metric_flaky-rate')!); return `error: ${p.errors.join(' ') || 'none'}; warning: ${p.warnings.join(' ') || 'none'}`; } },
    { given: 'Grace (an admin) measures the CI pipeline time north star (ns-ci, in min) by Lead time for changes (in hours).', then: 'refused: The goal is in min and the metric is in hours. Use the same unit for both.', run: () => summaryOf(asPerson('grace', (x) => MET.linkGoalMetric(x, goalIn('ns-ci'), 'metric_lead-time'))) },
    { given: 'Grace measures the merge queue goal (lead-mq, dated stages) by Lead time for changes.', then: 'refused: A goal with dated stages has no number, so a metric can’t measure it.', run: () => summaryOf(asPerson('grace', (x) => MET.linkGoalMetric(x, goalIn('lead-mq'), 'metric_lead-time'))) },
    { given: 'Oskar measures ns-ci, which Daniel owns, by CI pipeline time on main (p90).', then: 'refused: Only the goal’s owner or an admin can choose what measures it.', run: () => summaryOf(asPerson('oskar', (x) => MET.linkGoalMetric(x, goalIn('ns-ci'), 'metric_ci-time'))) },
    { given: 'Rhea measures ns-lead by Lead time for changes for the whole company, as it already is.', then: 'nothing to save', run: () => summaryOf(asPerson('rhea', (x) => MET.linkGoalMetric(x, goalIn('ns-lead'), 'metric_lead-time', null))) },
    { given: 'Rhea removes Lead time for changes, which measures one goal.', then: 'Removed the metric “Lead time for changes”, unlinking 1 goal / No longer measured by “Lead time for changes”, as the metric was removed', run: () => summaryOf(asPerson('rhea', (x) => MET.removeMetric(x, 'metric_lead-time'))) },
  ],
  unclear: ['Two people changing the same metric at once: the later save wins (metrics carry no version yet, unlike goals and reviews).', 'The words for a slice are the team’s name, or “The whole company”; the change log says “for the whole company” or “for <team>”.'],
});

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
