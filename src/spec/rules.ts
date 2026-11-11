/* The core rules, in plain words, for the spec (spec/core/rules/). Each rule says what it decides, exactly how, with
   its numbers read from the code (domain/thresholds.ts), and worked examples. Every example is run against the real
   rule by src/spec/spec.test.ts (and by the generator, which refuses to write an example that isn't true), so an
   example can't drift from the code: change a rule and its example fails until it's brought up to date.
   The examples use the same goals as src/domain/rules.test.ts (src/spec/examples.ts). */
import { acceptedReason, acceptNote, MIN_ACCEPT_REASON, needsDecision } from '../domain/decide';
import { findPeople } from '../domain/people';
import { DIRECTORY_PAGE, findInDirectory, findTeams, movedTo, personLine, teamSummary } from '../domain/directory';
import { scopeToCycle } from '../domain/cycle';
import { DAY_ONE_DAYS, gettingStarted, NEW_WORKSPACE_DAYS, stepCounter } from '../domain/dayOne';
import { planChanges, type ChangeInput, type Rec } from '../domain/changeset';
import { planQuestion } from '../domain/goal';
import { emptyDraft, evaluate, MIN_PATH, MIN_REASON, NO_REASON, parseNumber, valueProblem, type Draft } from '../domain/checkin';
import { currentWeek, firstWeekFrom, isCount, isShare, NOT_A_COUNT, planAt, planAsOf, PROJECTION_WEEKS, projection, projectionFor, shapeProgress, valueSeries } from '../domain/plan';
import { amount, byWeekWords, goalScorecard, likelihood } from '../domain/scorecard';
import { fmt } from '../domain/format';
import { assessMetric, assessMilestone, assessRange, goalStatus, projects, RANK, worst } from '../domain/status';
import { MAX_WORKSPACE_NAME, MIN_NAME, nameLength, nameProblem, RULES, TREND_SPAN } from '../domain/thresholds';
import { cycleStanding, leaveWorkspace } from '../domain/removal';
import { acceptRisk, teamPeople } from '../domain/actions';
import { adminsLine, cycleLine, LEAD_FROM, NEEDS_SHOWN, ONLY_ADMIN_FROM, workspaceName, workspaceNeeds, yearLine } from '../domain/workspaceAttention';
import { FAR_OUTSIDE, FAR_RATIO, farOutside, groupDigits, placesToKeep, precisionProblem, setupProblem, typedDecimals } from '../domain/numbers';
import { stagesFromJoining } from '../domain/templates';
import { AVATAR_HUES, mergePeople } from '../domain/people';
import { gapTrend, goalTrend } from '../domain/trend';
import { flagsFor, needsAttention, attentionFor, attentionGroup } from '../domain/attention';
import { ATTENTION, ATTENTION_FLAGS, DECIDED, FLAG, HANDLED_LINE, LABEL, shortWord, STATUS_ORDER } from '../domain/vocabulary';
import type { Ask, DisplayStatus, Goal, MetricGoal, Snapshot } from '../domain/types';
import { criticalPath, findOnMap, rollup, rollupText, shownOnMap, troubled } from '../domain/map';
import { commentReach, goalHistory, primaryAction, standingAction, stepsAndAsks, whyPointer } from '../domain/goalPage';
import type { ActionContext } from '../domain/actions';
import * as MET from '../domain/metrics';
import { backTo, litItem, menuGroups, menuRows, pageName, phoneTabs, type PlaceNames } from '../domain/navigation';
import { movedGoals, ownGroup, scopesFor } from '../domain/goalsPage';
import { watchedGoals } from '../domain/review';
import { countLine, filterLine, nearMiss, noneFound, search, suggest, textMatches } from '../domain/find';
import { goalRows, personRows, teamRows } from '../app/reads';
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

/* ---------- a workspace just set up, for day one's examples ---------- */
const DAY_MADE = '2026-11-11T09:00:00Z';
const DAY_NOW = new Date('2026-11-11T15:00:00Z');
const DAY_WS = { name: 'Field Operations', kind: 'own', createdAt: DAY_MADE };
const dayOneWs = (owners: string[]): Pick<Snapshot, 'people' | 'goals' | 'checkIns' | 'watches' | 'changes'> => ({
  people: [{ id: 'ana', name: 'Ana Silva', role: '', initials: 'AS', teamId: 't', admin: true }, { id: 'ben', name: 'Ben Ortiz', role: '', initials: 'BO', teamId: 't', admin: false }],
  goals: owners.map((ownerId, i) => ({ id: `g${i}`, ownerId, title: `Goal ${i}` } as unknown as Goal)),
  checkIns: [], watches: [],
  changes: [{ id: 'c', at: DAY_MADE, actorId: 'ana', goalId: null, entity: 'workspace', entityId: 'w', action: 'created', summary: 'Created “Field Operations” with 2 people', diffs: [] }],
});

/* ---------- the demo workspace on Wednesday 11 November, for the directory's examples ---------- */
const DIR_NOW = new Date('2026-11-11T12:00:00Z');
let dir: Snapshot | null = null;
const dirWs = (): Snapshot => dir!;
const dirAsk = (a: Parameters<typeof findInDirectory>[2]) => findInDirectory(dirWs().people, dirWs().teams, a);

/* ---------- the demo workspace, for the change engine's examples ---------- */
let demo: Snapshot | null = null;
async function demoWorkspace(): Promise<Snapshot> {
  if (!demo) demo = (await import('../data/platformOrg/generate')).buildPlatformOrg(new Date(CHECK_IN_MOMENT));
  return demo;
}
/** Called once before the examples run: the change engine's examples read the demo workspace. */
export async function prepareExamples() {
  await demoWorkspace();
  if (!dir) { const full = (await import('../data/platformOrg/generate')).buildPlatformOrg(DIR_NOW); dir = scopeToCycle(full, full.cycles[0]!); }
}
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
    code: [{ file: 'src/domain/checkin.ts', names: ['emptyDraft', 'parseNumber', 'valueProblem', 'lastValueOf', 'numberCheck', 'unchangedStory', 'evaluate', 'toCheckIn', 'MISSING_TEXT', 'CAUSES_BEHIND', 'CAUSES_AHEAD'] }],
    tests: ['src/domain/rules.test.ts#check-in rules', 'src/domain/rules.test.ts#typed numbers', 'src/domain/rules.test.ts#what a check-in still needs, as stable codes', 'evals/scenarios.eval.ts'],
    reqs: ['REASON-BEHIND', 'REASON-AHEAD', 'PATH-TO-GREEN', 'GREENER', 'OWNER-CALL', 'CHECKIN-STATUS-VS-PLAN', 'OTHER-CAUSE', 'FIRST-CHECKIN', 'HONEST-CHECKIN'],
    body: `
A check-in is one week's report on one goal, by its owner (or an admin): the number (or each stage's state), the owner's call, and the words the numbers ask for. Every way in (the check-in screen, the bulk grid, a spreadsheet, the AI assistant) uses these rules.

**Reading a number** (\`parseNumber\`): spaces and a trailing unit or \`%\` are ignored; a decimal comma with one or two digits (\`29,4\`) is a decimal point; commas grouping thousands (\`1,250\`, \`1,250.5\`) are dropped. Anything else that isn't plain digits with one optional point and sign (hex, exponents, words, two points) is not a number; nor is anything 10¹² or more.

**Impossible and surprising numbers** (\`valueProblem\`): letters are refused with the one message of [numbers and names](numbers-and-names.md); a number with more decimal places than the goal keeps is refused (never rounded, the same rule); below zero is refused for a percentage or a time or money unit, and for a count (see [the projection](projection.md)); over 100% is refused for a share (see [the projection](projection.md)) and only questioned otherwise; a number goal's value more than ${FAR_OUTSIDE} times the plan's width beyond either end of its plan is questioned ("That's far outside this goal's plan (30 to 75%). Is 400 right?"); a count's value past its target (beyond it in the better direction) is questioned ("That's past the target of 40 pairs. Is 41 right?"); a number more than 3 times or less than a third of last week's is questioned ("Last week was 29.4. Is 294 right?"). Questions never refuse.

**One number check** (\`numberCheck\`): every way a number is typed (the check-in, the bulk grid, a spreadsheet) asks \`valueProblem\` with the goal's latest number (\`lastValueOf\`: the newest of its check-ins that has a value), and a spreadsheet's error for an unusable number is \`valueProblem\`'s own words.

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
5. \`story-unchanged\`: the draft carries last check-in's account (\`carried\`: its cause, why, path and week, copied in when the owner chose to edit it), and a part still asked for is word for word the same (\`unchangedStory\`: the reason when a reason is needed and the cause and the why, trimmed, are unchanged; the path when a path is needed and what changes, trimmed, and the week are unchanged), and the owner hasn't said it is still true (\`stillTrue\`). A draft that carries nothing (a spreadsheet, the AI tools) is never asked this.
6. \`target\`: a proposed target, when given, must be beyond the current target in the better direction.

It can be posted when nothing is missing.

**The record** (\`toCheckIn\`): the number (or the stages), the owner's call as \`status\`, the calculation as \`calculated\`, the cause only when a reason was needed, the why, the greener reason only when greener, the proposed target only when one could be asked, the path to green only when needed (its week only for the \`plan\` state), what's next, and whether the data is flagged. It refuses a draft that can't be posted. The why stored when nothing needed explaining was once "${NO_REASON}"; it is never shown or counted as a reason.`,
    examples: [
      { given: 'Typed: "29,4", "1,250", "1,250.5", "62%", "29.4 days", " -3 ".', then: '29.4, 1250, 1250.5, 62, 29.4, -3', run: () => ['29,4', '1,250', '1,250.5', '62%', '29.4 days', ' -3 '].map((s) => String(parseNumber(s))).join(', ') },
      { given: 'Typed: "0x1F", "1e308", "abc", "1.2.3", "99999999999999".', then: 'null, null, null, null, null', run: () => ['0x1F', '1e308', 'abc', '1.2.3', '99999999999999'].map((s) => String(parseNumber(s))).join(', ') },
      { given: '-5 days (last week 30); 120% (last week 60, not a share); 294 days (last week 29.4).', then: 'refused; questioned; questioned: Last week was 29.4. Is 294 right?', run: () => { const a = valueProblem('-5', 30, 'days'), b = valueProblem('120', 60, '%'), c = valueProblem('294', 29.4, 'days'); const w = (p: typeof a) => (p ? (p.block ? 'refused' : 'questioned') : 'fine'); return `${w(a)}; ${w(b)}; ${w(c)}: ${c?.text}`; } },
      { given: 'The 30→75 goal in week 4 (plan 43.846): nothing typed; "abc"; "140"; "44". Every code still missing, in order: a refused number is still judged, so 140 (well ahead) also asks for its reason.', then: 'value; value-not-number; value-impossible, reason-ahead; nothing missing', run: () => [{}, { value: 'abc' }, { value: '140' }, { value: '44' }].map((d) => evaluate(g3075, CYCLE, 4, D(d), []).codes.join(', ') || 'nothing missing').join('; ') },
      { given: '40 in week 4 (off track) with nothing else; then with a cause, a why, a path and back by week 7; then back by week 4.', then: 'reason-behind, path; can post; path', run: () => { const why = { cause: 'slower' as const, why: 'Rollout paused for a week', ptgWhat: 'Restart the rollout' }; return [D({ value: '40' }), D({ value: '40', ...why, ptgBy: 7 }), D({ value: '40', ...why, ptgBy: 4 })].map((d) => { const e = evaluate(g3075, CYCLE, 4, d, []); return e.canPost ? 'can post' : e.codes.join(', '); }).join('; '); } },
      { given: '58 in week 4 (well ahead): nothing else; with a reason and a proposed target of 70; with 95.', then: 'reason-ahead; target; can post', run: () => { const why = { value: '58', cause: 'early' as const, why: 'The bot shipped two weeks early' }; return [D({ value: '58' }), D({ ...why, proposeTarget: '70' }), D({ ...why, proposeTarget: '95' })].map((d) => { const e = evaluate(g3075, CYCLE, 4, d, []); return e.canPost ? 'can post' : e.codes.join(', '); }).join('; '); } },
      { given: '40 in week 4, with last week’s cause, why, path and week copied in untouched; then said to be still true; then with the why rewritten.', then: 'story-unchanged; can post; story-unchanged (the path)', run: () => { const carried = { cause: 'slower' as const, why: 'Rollout paused for a week', what: 'Restart the rollout', by: 7 }; const same = { value: '40', cause: 'slower' as const, why: carried.why, ptgWhat: carried.what, ptgBy: 7, carried }; return [D(same), D({ ...same, stillTrue: true }), D({ ...same, why: 'The fix is waiting on review' })].map((d, i) => { const e = evaluate(g3075, CYCLE, 4, d, []); return e.canPost ? 'can post' : e.codes.join(', ') + (i === 2 ? ` (the ${e.unchanged.join(', ')})` : ''); }).join('; '); } },
      { given: 'A count, 4 → 40 pairs: -5; 41.', then: 'refused; questioned: That’s past the target of 40 pairs. Is 41 right?', run: () => { const pairs = { ...g3075, unit: 'pairs', decimals: 0, plan: { ...g3075.plan, start: 4, target: 40 } }; const a = valueProblem('-5', 10, 'pairs', pairs), b = valueProblem('41', 38, 'pairs', pairs); return `${a?.block ? 'refused' : 'fine'}; ${b && !b.block ? 'questioned' : 'fine'}: ${b?.text}`; } },
      { given: '40 in week 4, called on track, with a reason for being behind but none for the greener call.', then: 'greener-why', run: () => evaluate(g3075, CYCLE, 4, D({ value: '40', status: 'on', cause: 'slower', why: 'Rollout paused for a week' }), []).codes.join(', ') },
    ],
  },

  /* ---------- numbers and names ---------- */
  {
    id: 'numbers-and-names',
    title: 'Numbers and names',
    summary: 'How a typed number is kept and shown, which numbers are questioned, and how two goals or two people with the same name are told apart.',
    code: [
      { file: 'src/domain/numbers.ts', names: ['typedDecimals', 'precisionProblem', 'placesToKeep', 'exampleNumber', 'notNumberText', 'groupDigits', 'fixed', 'farOutside', 'setupProblem'] },
      { file: 'src/domain/goal.ts', names: ['validateGoal', 'planHint', 'planQuestion'] },
      { file: 'src/domain/people.ts', names: ['sameNameNote', 'personTell', 'nameWithTell', 'avatarHues', 'duplicateTitles', 'goalTell', 'sameTitleNote'] },
      { file: 'src/domain/thresholds.ts', names: ['MIN_NAME', 'nameProblem'] },
    ],
    tests: ['src/domain/numbers.test.ts', 'src/domain/names.test.ts'],
    reqs: ['NO-SILENT-ROUNDING', 'SAME-NAMES'],
    body: `
One rule for every way in: the check-in, New goal, goal edit, the workspace set-up, the spreadsheet import and the AI tools (backlog N).

**Never rounded quietly.** Each number goal keeps a number of decimal places (*Decimals*, 0 to 3), and every number of it is shown at those places. A number typed with more (\`typedDecimals\`: the digits after the point, trailing zeros not counted; a decimal comma counts as a point) is refused (\`precisionProblem\`), saying what it would show as and the two ways forward: type it at the goal's places, or raise Decimals. In a check-in the refusal offers to raise Decimals for the goal in one step, to the places the number was typed with, up to 3 (\`placesToKeep\`: "Keep 1 decimal place for this goal"), logged as a change to the goal with why. This holds for a check-in's value, a start, target, limit, margin and any plan number typed by hand. A plan already stored isn't judged again when a goal is edited; only numbers changed are. An import that adds a goal without Decimals takes the most decimal places its start, target and limit were typed with (up to 3).

**Letters in a number** get one message everywhere (\`notNumberText\`): ““a12” isn't a number. Type digits only, like 29.4.” Its example is at the goal's decimal places when there is a goal (\`exampleNumber\`): “like 29” for whole numbers, “like 29.45” for two places. (Letters after the digits are read as a unit: “12 days” is 12.)

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
    code: [{ file: 'src/domain/trend.ts', names: ['gapTrend', 'planGaps', 'stagesTrend', 'goalTrend'] }, { file: 'src/domain/attention.ts', names: ['flagsFor', 'attentionFor', 'handledFor', 'lookedAtFor', 'needsAttention', 'waitingOnDecision', 'attentionGroup', 'attentionList'] }, { file: 'src/domain/asks.ts', names: ['openFor', 'answeredSince', 'isOverdue'] }],
    tests: ['src/domain/attention.test.ts', 'src/domain/story.test.ts', 'evals/attention.eval.ts', 'evals/vocabulary.eval.ts'],
    reqs: ['ATTENTION', 'ATTENTION-HANDLED', 'ONE-ATTENTION-RULE', 'ONE-TREND', 'PATH-TO-GREEN', 'GREENER', 'STALE'],
    body: `
### The trend

One rule says whether a goal is **getting worse**, **getting better** or neither (\`flat\`). It looks at the last ${TREND_SPAN} check-ins: of every check-in on the goal in the workspace (posted by today), whatever week it is for; not cut to week ≤ this week as the calculation is.

\`gapTrend(gaps)\`: *gaps* are each check-in's distance from where it should be, oldest first, positive when better. Take the last ${TREND_SPAN}; with fewer, \`flat\`. The two steps between them both down (each by more than 10⁻⁹): \`worse\` (for a number to move, only if the latest gap is also below −10⁻⁹: short of plan). Both up by more than 10⁻⁹: \`better\`. Otherwise \`flat\`.

- **A number to move:** each of the goal's check-ins with a number (in week order, then posting order) gives (*value* − plan for its own week, by the plan as of that week) × the better direction (+1 if the target is above the start, else −1). Unrounded, so a number held flat while the plan moves on is further behind each time. A \`worse\` from them stands only if it also shows at the goal's decimals (deep review T5): the last of the ${TREND_SPAN} gaps, rounded to the goal's decimals, is below 0, and the first, rounded, is above it; otherwise it is \`flat\`. So a number typed as the plan ("on plan" three times) is never getting worse. If that isn't \`worse\` (whether it was \`flat\` or \`better\`) but there are at least ${TREND_SPAN} numbers, and the latest, judged in its own week against the goal's **current** plan (here, unlike everywhere else, not the plan as of that week; with the earlier numbers for its projection), is \`on\` while its projection's likeliest value misses the target and so does the better end of its range (*high* when the target is above the start, else *low*; both it and the target rounded to the goal's decimals): \`worse\` ("on track today, but heading short"). A range that, as shown, includes the target isn't heading short.
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

A goal is **waiting on a decision** (\`waitingOnDecision\`) exactly when it has the \`decision\` flag. The Goals filter "${FLAG.decision.label}" and every saved view built on it, the Table's one-line story, the Board's order within a lane and Home's asks all use this one rule, so they name the same goals.

They are listed worst first: ${list(ATTENTION_FLAGS.map((k) => `\`${k}\``))}, then \`due\`. A goal's weight is that of its worst flag. A check-in due, on its own, doesn't make a goal need attention. A done goal raises none of them, so it never needs attention and a review lists it with the goals that have nothing flagged.

### Being handled, and needs attention

A goal whose official status is \`off\` or \`risk\` (and has a check-in) is **being handled** (Lane, 10 Nov) when one of these happened strictly after its latest check-in's \`postedAt\` (latest by \`postedAt\`), on or before today's **date** (the UTC day; the time of day doesn't count):

- an action (an ask of kind \`action\` that includes the goal, open now) with a due week (\`dueWeek\` not null) was created (\`createdAt\`), and it isn't overdue (an open ask is overdue once its due week is before this week). Its owner is its \`recipientId\`, else the goal's owner; or
- only when the status is \`risk\`: a decision ask that includes the goal was answered: its \`status\` is \`answered\` (not \`done\`, which is for actions), timed by \`answeredAt\`; the latest such answer;

and no flag is raised now (apart from \`due\`, left out of *now* only) that wasn't also raised when the same rules are run on the **same workspace** with "today" set to the moment of the earliest of those (the workspace is not re-cut to that moment). Decisions and asks that were removed are not in the workspace at all, so never count. An action names it before an answer; the latest of the strongest kind. Its words: "Action: *first name*, due week *n*", or "Request answered by *first name*, week *n*". An action with no due week, an off-track goal's answered request, and marking it reviewed or noting it never put a goal in hand.

A behind goal is **looked at** (\`lookedAtFor\`) when, under the same timing, someone other than the owner marked it reviewed (a decision of kind \`acknowledge\`) or added a note (\`note\`) on it: the latest such, said "Looked at by *first name* in *review name*, week *n*" (without " in …" outside a review). It is a quiet line only: it doesn't change whether the goal needs attention.

A goal **needs attention** when it has a flag other than \`due\` and isn't being handled. Home, Watching, the map, the Goals filter, reviews, the brief and MCP all use this one rule.

### The Needs attention list

\`attentionGroup(a)\`: \`needs\` when the goal needs attention; else \`handled\` when it is being handled; else none. (A goal being handled is always behind, so always flagged: the list is every goal with a flag other than \`due\`.) Wherever goals that need attention are listed (the Needs attention tab and filter on Goals in every layout, the map's "Only what needs attention", Home, Watching, and the AI assistant's \`find_goals\` with \`needs_attention\`), the \`needs\` group comes first and the \`handled\` group below it, each saying what is in hand. Nothing is hidden: a filter on the list (a team, an owner) keeps both groups. A **count** of goals that need attention (the Needs attention tab's count, Home's) counts the \`needs\` group only, and says so where both are listed. Under the words *${ATTENTION.handled.label}*, wherever a group of them is shown, one line says what it means: “${HANDLED_LINE}”`,
    examples: [
      { given: 'Gaps oldest first: −1, −2, −3; 1, 2, 3; −1, −2, −1; −3, −2, −1; only −1, −2; with "short of plan" required: 3, 2, 1.', then: 'worse, better, flat, better, flat, flat', run: () => [gapTrend([-1, -2, -3]), gapTrend([1, 2, 3]), gapTrend([-1, -2, -1]), gapTrend([-3, -2, -1]), gapTrend([-1, -2]), gapTrend([3, 2, 1], true)].join(', ') },
      { given: 'The 30→75 goal held at 33 in weeks 1, 2 and 3 while the plan moves on.', then: 'worse', run: () => goalTrend(g3075, CYCLE, [1, 2, 3].map((w) => ci('m', w, 33))).word },
      { given: 'A 10→11 minute goal over 13 weeks, whole minutes, at 10 in weeks 3, 4 and 5 (on plan as shown, a little further behind each time unrounded).', then: 'flat', run: () => goalTrend({ ...g3075, decimals: 0, plan: { start: 10, target: 11, shape: 'straight' } }, CYCLE, [3, 4, 5].map((w) => ci('m', w, 10))).word },
      { given: 'The same goal at 10, 10 and 9 in weeks 3, 4 and 5.', then: 'worse', run: () => goalTrend({ ...g3075, decimals: 0, plan: { start: 10, target: 11, shape: 'straight' } }, CYCLE, [10, 10, 9].map((v, i) => ci('m', i + 3, v))).word },
      { given: 'A range, at most 12: 10, 11, 11.5 in weeks 1–3 (closer to the limit each time).', then: 'worse', run: () => goalTrend(RANGE, CYCLE, [10, 11, 11.5].map((v, i) => ci('r', i + 1, v))).word },
      { given: 'The 30→75 goal: 40 in week 4, called off track with a cause, why and path back by week 7, posted Monday 5 October. The flags on Thursday 8 October.', then: 'off', run: () => flagCodes(workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })]), '2026-10-08T12:00:00Z') },
      { given: 'The same check-in, a week later (Thursday 15 October, week 5): no check-in yet this week.', then: 'off, due', run: () => flagCodes(workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })]), '2026-10-15T12:00:00Z') },
      { given: 'Off track in week 4 with a path back by week 5; checked in again for week 6 (posted 19 October), still off track, carrying the same path. On Thursday 22 October (week 6).', then: 'off, missed-path', run: () => { const p = { status: 'off' as const, calculated: 'off' as const, cause: 'slower' as const, why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 5, needs: '' } }; return flagCodes(workspace([ci('m', 4, 40, p), ci('m', 6, 41, p)]), '2026-10-22T12:00:00Z'); } },
      { given: 'Off track in week 4 (posted Monday 5 October) and nothing since: on Thursday 22 October (17 days later), the status itself has gone stale, so it is no longer flagged off track.', then: 'stale, due', run: () => flagCodes(workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })]), '2026-10-22T12:00:00Z') },
      { given: 'At risk with no path to green, and an open decision ask on the goal (week 4, Thursday 8 October).', then: 'decision, no-path, risk', run: () => flagCodes(workspace([ci('m', 4, 40, { status: 'risk', calculated: 'risk' })], [{ id: 'a1', kind: 'decision', goalIds: ['m'], askedBy: 'p', recipientId: 'l', ask: 'Approve the budget', status: 'open', dueWeek: null, reviewId: null, week: 4, checkInId: null, createdAt: '2026-10-05T10:00:00Z', updatedAt: '2026-10-05T10:00:00Z', answer: null, answeredBy: null, answeredAt: null }]), '2026-10-08T12:00:00Z') },
      { given: 'Off track in week 4 (posted Monday 5 October), and the lead agreed an action on Tuesday 6 October, due week 6. Which group of the Needs attention list on Thursday 8 October, and on Monday 5 October before that?', then: 'handled; needs', run: () => { const s = workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })], [{ id: 'a1', kind: 'action', goalIds: ['m'], askedBy: 'l', recipientId: null, ask: 'Restart the rollout with the platform team', status: 'open', dueWeek: 6, reviewId: null, week: 4, checkInId: null, createdAt: '2026-10-06T09:00:00Z', updatedAt: '2026-10-06T09:00:00Z', answer: null, answeredBy: null, answeredAt: null }]); return ['2026-10-08T12:00:00Z', '2026-10-05T18:00:00Z'].map((t) => attentionGroup(attentionFor(g3075, s, CYCLE, at(t))) ?? 'none').join('; '); } },
      { given: 'Off track in week 4 (posted Monday 5 October), and the lead marked it reviewed on Tuesday 6 October. On Thursday 8 October: being handled, needs attention, looked at?', then: 'handled by nothing; needs attention: yes; looked at: reviewed', run: () => { const s = workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })], [], [{ id: 'd1', goalId: 'm', checkInId: null, reviewId: null, week: 4, kind: 'acknowledge', byId: 'l', at: '2026-10-06T09:00:00Z', note: '' }]); const a = attentionFor(g3075, s, CYCLE, at('2026-10-08T12:00:00Z')); return `handled by ${a.handled?.kind ?? 'nothing'}; needs attention: ${needsAttention(a) ? 'yes' : 'no'}; looked at: ${a.lookedAt?.kind ?? 'no'}`; } },
      { given: 'The same, but the action agreed on Tuesday has no due week. On Thursday 8 October: being handled?', then: 'handled by nothing; needs attention: yes', run: () => { const s = workspace([ci('m', 4, 40, { status: 'off', calculated: 'off', cause: 'slower', why: 'Rollout paused', pathToGreen: { what: 'Restart the rollout', byWeek: 7, needs: '' } })], [{ id: 'a1', kind: 'action', goalIds: ['m'], askedBy: 'l', recipientId: null, ask: 'Restart the rollout with the platform team', status: 'open', dueWeek: null, reviewId: null, week: 4, checkInId: null, createdAt: '2026-10-06T09:00:00Z', updatedAt: '2026-10-06T09:00:00Z', answer: null, answeredBy: null, answeredAt: null }]); const a = attentionFor(g3075, s, CYCLE, at('2026-10-08T12:00:00Z')); return `handled by ${a.handled?.kind ?? 'nothing'}; needs attention: ${needsAttention(a) ? 'yes' : 'no'}`; } },
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
- **An amount** (a difference, always positive) \`amount(v)\`: *n*(|*v*|), then: for \`%\`, " pt" when that number is 1 and " pts" otherwise ("1 pt", "0.4 pts", "1.0 pt"); no unit, nothing; any other unit after a space, made singular (last letter dropped) when the number is 1 ("1", "1.0" and "1.00" all count) and the unit is a word of three or more letters ending in a single s, any case (\`/^[a-z][a-z-]*[^s]s$/i\`): "1 hour", "1.0 day", "1 pt" for \`pts\`; but "1 ms" (G-58's "1 ms worse" in week 10 of the conformance data).
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
      { given: 'Values and amounts: 1 and 1.0 in hours (1 and 0 decimals), 1 in ms, 1 in pts, 1250.5 in USD (1 decimal), 0.4 and 1 in %; -0.3 in min (0 decimals).', then: 'fmt: 1 hour, 1.0 hours, 1 ms, 1 pts, 1,250.5 USD, 0.4%, -0 min; amount: 1 hour, 1.0 hour, 1 ms, 1 pt, 1,250.5 USD, 0.4 pts, 1 pt', run: () => { const u = (unit: string, decimals = 0) => ({ unit, decimals }); return `fmt: ${[fmt(1, u('hours')), fmt(1, u('hours', 1)), fmt(1, u('ms')), fmt(1, u('pts')), fmt(1250.5, u('USD', 1)), fmt(0.4, u('%', 1)), fmt(-0.3, u('min'))].join(', ')}; amount: ${[amount(1, u('hours')), amount(-1, u('hours', 1)), amount(1, u('ms')), amount(1, u('pts')), amount(1250.5, u('USD', 1)), amount(0.4, u('%', 1)), amount(1, u('%'))].join(', ')}`; } },
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
    summary: 'The one way many changes come in at once: a spreadsheet, set-up, the bulk check-in grid, the data tables and MCP.',
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
  /* ---------- deciding in a review (deep review P2, 10 Nov) ---------- */
  {
    id: 'review-decide',
    title: 'Deciding in a review',
    summary: 'A goal behind leaves a review with a next step (an owner and a week) or an accepted risk with a reason; the next session opens with what the last one agreed.',
    code: [
      { file: 'src/domain/decide.ts', names: ['needsDecision', 'decisionFor', 'acceptNote', 'acceptedReason', 'lastTime', 'sessionDecisions'] },
      { file: 'src/domain/actions.ts', names: ['acceptRisk', 'addAction', 'markReviewed'] },
      { file: 'src/domain/review.ts', names: ['sessionToDo'] },
      { file: 'src/domain/people.ts', names: ['findPeople'] },
    ],
    tests: ['src/domain/decide.test.ts', 'src/domain/review.test.ts'],
    reqs: ['REVIEW-DECIDE', 'REVIEW-RUN'],
    body: `
**Who must decide.** A goal whose status is \`off\` or \`risk\` (\`needsDecision\`) is not marked reviewed in a walk until something is decided about it. Every other goal is marked reviewed as before.

**What counts as a decision** (\`decisionFor\`), the latest in the session first:
- a **next step** said in this session: an action with a person who does it and a week it is due by (open or done). An action without a week, a note or a question is not a decision;
- the review **accepting the risk**: a note said in the session whose words are "${DECIDED['accept-risk'].label}: " and then the reason, at least ${MIN_ACCEPT_REASON} characters (\`acceptRisk\`; \`acceptedReason\` reads it back). It is a look, not a plan: the goal still needs attention;
- or, wherever it was agreed (the goal's page, say), an open action on the goal with a person and a week, agreed since the goal's latest check-in and not yet overdue. This is the record [needs attention](flags.md) reads for "being handled".

**The people search** (\`findPeople\`): nothing is listed until something is typed; then the people whose name or team contains it, those whose name starts with it first, at most 8, never someone marked as left.

**Last time** (\`lastTime\`): the session before this one is the latest earlier week anything was said in the review. Its actions are listed with how each stands now: open, overdue (open past its week) or done; open ones first, then by due week.

**Finishing** marks every goal not yet reviewed, in one save with Undo (\`markReviewed\`; Undo is \`unmarkReviewed\`), and so holds the session. Before it does, it says what was decided (\`sessionDecisions\`): the next steps by who owns them, the risks accepted, and the questions still open.

**To do** (\`sessionToDo\`): a person's session counts as something to do (the Reviews count, Home's main action) when it is this week's, not held, and either its day has come or a goal in it has been checked in on. So a workspace set up this morning doesn't say a review is to do.`,
    examples: [
      { given: 'Which statuses need a decision: off, risk, on, stale, done.', then: 'yes, yes, no, no, no', run: () => ['off', 'risk', 'on', 'stale', 'done'].map((k) => (needsDecision(k) ? 'yes' : 'no')).join(', ') },
      { given: 'The words saved for accepting the risk because "the vendor fix lands next release", and what is read back from them and from "Talked it through".', then: 'We accept the risk: the vendor fix lands next release / the vendor fix lands next release / not a decision', run: () => { const w = acceptNote('the vendor fix lands next release'); return `${w} / ${acceptedReason(w)} / ${acceptedReason('Talked it through') ?? 'not a decision'}`; } },
      { given: 'In the demo workspace, Daniel accepts the risk on the merge queue in the Developer Productivity fortnightly with the reason "ok".', then: 'refused: Say why the review accepts the risk.', run: () => summaryOf(asPerson('daniel', (x) => acceptRisk(x, goalIn('lead-mq'), demo!.reviews.find((r) => r.id === 'devprod')!, 'ok', 46))) },
      { given: 'Searching the demo workspace’s people for "", then for "kap".', then: 'nobody / Rhea Kapoor', run: () => { const team = (id: string) => demo!.teams.find((t) => t.id === id)?.name ?? ''; return `${findPeople(demo!.people, '', team).map((p) => p.name).join(', ') || 'nobody'} / ${findPeople(demo!.people, 'kap', team).map((p) => p.name).join(', ')}`; } },
    ],
    unclear: ['Accepting the risk is stored as a note whose words start with a fixed phrase, so no new kind of record was needed before the talk. A rebuild should give it a kind of its own (a decision with a reason), and keep the phrase only for what people read.'],
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
      { file: 'src/domain/workspaceAttention.ts', names: ['workspaceNeeds', 'workspaceName', 'adminsLine', 'yearLine', 'cycleLine', 'cycleWhen', 'NEEDS_SHOWN', 'ONLY_ADMIN_FROM', 'LEAD_FROM'] },
      { file: 'src/domain/people.ts', names: ['mergePeople'] },
      { file: 'src/domain/templates.ts', names: ['stagesFromJoining', 'stagesFromNow'] },
    ],
    tests: ['src/domain/workspace.test.ts', 'src/domain/setupTruth.test.ts'],
    reqs: ['WORKSPACE-ONE-PLACE', 'WORKSPACE-ABOUT'],
    body: `
**A cycle** (a goal year) says how many goals it has and how many check-ins were posted on them (removed ones don't count), and so whether it can be deleted: only when nobody has checked in to it **and** it isn't the only cycle. The only cycle always stays, so a new workspace's cycle says so rather than offering Delete. Each cycle shows its first and last days (its start date, then \`weeks × 7 − 1\` days on) and whether it is running (with its week), not started yet, or over; on Cycles as one word after its name (\`cycleLine\`), with its goals and check-ins (\"no check-ins yet\" for none).

**A team's people** are everyone in it, and its lead even when the lead's own team is another; the lead counts once.

**A workspace's name** is ${MIN_NAME} to ${MAX_WORKSPACE_NAME} characters, after trimming and joining spaces. Nothing cuts it short: the field counts the characters once a name is within 20 of the limit, and a longer name is refused with how long it is.

**Leaving.** Anyone may leave a workspace themselves. It is the same as an admin marking them as left (whoever takes over their goals and open asks is chosen first; they leave the reviews they were in), logged as "Name left the workspace". The only admin may not leave.

**Set-up says only what it was told** (deep review U2–U7). People typed are never replaced by a spreadsheet uploaded after them: the file's people come after, anyone already there (the same email, or the same name where either has no email) isn't added twice, and only a typed row's empty fields take the file's (\`mergePeople\`); the upload says what it added and can be undone. A template's stage weeks count from the week the workspace joins (\`stagesFromNow\`); so do a spreadsheet's, for any goal with a stage due before that week and no check-ins in the file (\`stagesFromJoining\`), said on Check with "Keep the weeks as typed". A goal with check-ins in the file keeps its weeks. Set-up never asks who leads a team, so it names no lead; anything else that adds a team adds its first person as the lead. The invitation link names the workspace (\`/?workspace=<id>\`), and opening it opens that workspace and remembers it, whatever the browser had open. With no goals, nothing is said to be due.

**What an admin has to sort out** (About's "To sort out", for admins only; a member is shown nothing), in this order: no goals in the running cycle; no review that hasn't ended; the only admin, once the workspace has ${ONLY_ADMIN_FROM} people or more; people with no email; people in no team; teams of ${LEAD_FROM} people or more with no lead (set-up never asks who leads a team, so a small new team isn't told off). About shows the first ${NEEDS_SHOWN}; the rest open from "and {k} more". The year ending is Home's to say, and feedback is the builders' business.

**The workspace in words.** Its name is the stored name without the example's own "Example: ", with its kind as a quieter line: "example data", "kept in this browser" (made in the demo) or nothing (a real one). The admins are named A to Z as a sentence; beyond three, the first two and how many others. The Year fact says the week ("2026, week 46 of 53.") and when the wrap-up opens: the first day of the first week the wrap-up is open (\`wrapUpOpen\`), or, once it's open, how many goals are still to wrap up; a cycle not started says when it starts.`,
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
      { given: 'What Lee, the admin, has to sort out: two people, neither with an email, one goal, no review.', then: 'No review is set up; 2 people have no email', run: () => workspaceNeeds(workspace([]), CYCLE, true).map((x) => x.says).join('; ') },
      { given: 'The same, for Pat, who isn’t an admin.', then: 'nothing', run: () => workspaceNeeds(workspace([]), CYCLE, false).map((x) => x.id).join(', ') || 'nothing' },
      { given: 'The example’s name in the demo, and a workspace called “Growth” in the real app.', then: 'Platform Engineering (example data) / Growth', run: () => [workspaceName({ name: 'Example: Platform Engineering', kind: 'example' }, 'demo'), workspaceName({ name: 'Growth', kind: 'own' }, 'live')].map((w) => w.name + (w.kind ? ` (${w.kind})` : '')).join(' / ') },
      { given: 'Admins Hamid Rezaei, Amara Nwosu and Grace Achterberg; then 40 admins whose first two A to Z are Aiko Suzuki and Akosua Owusu.', then: 'Amara Nwosu, Grace Achterberg and Hamid Rezaei / Aiko Suzuki, Akosua Owusu and 38 others', run: () => [adminsLine(['Hamid Rezaei', 'Amara Nwosu', 'Grace Achterberg'].map((name) => ({ name, admin: true }))), adminsLine(['Aiko Suzuki', 'Akosua Owusu', ...Array.from({ length: 38 }, (_, i) => `Zed ${i}`)].map((name) => ({ name, admin: true })))].join(' / ') },
      { given: 'Cycles’ row for that year in week 46, with 126 goals and 3,200 check-ins; and for a 2027 cycle with nothing in it yet.', then: '2026 · running / Week 46 of 53 · 22 Dec 2025 to 27 Dec 2026 / 126 goals · 3,200 check-ins; 2027 · starts 4 Jan 2027 / 0 goals · no check-ins yet', run: () => { const a = cycleLine({ name: '2026', startDate: '2025-12-22', weeks: 53 }, true, 46, new Date('2026-11-11T12:00:00Z'), { goals: 126, checkIns: 3200 }); const b = cycleLine({ name: '2027', startDate: '2027-01-04', weeks: 52 }, false, 46, new Date('2026-11-11T12:00:00Z'), { goals: 0, checkIns: 0 }); return `${a.title} / ${a.when} / ${a.counts}; ${b.title} / ${b.counts}`; } },
      { given: 'A 53-week year starting Monday 22 December 2025: on Wednesday 11 November (week 46), on Tuesday 15 December (week 51), and on Tuesday 22 December (week 52) with 31 goals not wrapped up.', then: '2026, week 46 of 53. The wrap-up opens on 21 Dec 2026. / 2026, week 51 of 53. The wrap-up opens on 21 Dec 2026. / 2026, week 52 of 53. The wrap-up is open: 31 goals still to wrap up.', run: () => { const c = { name: '2026', startDate: '2025-12-22', weeks: 53 }; return `${yearLine(c, 46, new Date('2026-11-11T12:00:00Z'), 30)} / ${yearLine(c, 51, new Date('2026-12-15T12:00:00Z'), 31)} / ${yearLine(c, 52, new Date('2026-12-22T12:00:00Z'), 31)}`; } },
    ],
    unclear: ['When “You’re the only admin” starts to be said (five people) and when a team without a lead is (three people) are choices, not laws; the rebuild may tune them.', 'Leaving with no goals and no history still marks the person as left (they can be restored), unlike an admin deleting someone with no history.'],
  },

  /* ---------- the directory: People and Teams (app redesign WR1) ---------- */
  {
    id: 'directory',
    title: 'The directory: who People lists, what a search finds, and where old addresses lead',
    summary: 'People’s order and search, a page at a time; the line beside a person; a team’s people and goals by status; and where People’s and Teams’ old Workspace addresses now lead.',
    code: [{ file: 'src/domain/directory.ts', names: ['findInDirectory', 'matchesWords', 'byName', 'findTeams', 'personLine', 'teamSummary', 'movedTo', 'DIRECTORY_PAGE'] }],
    tests: ['src/domain/directory.test.ts'],
    reqs: ['PEOPLE-DIRECTORY', 'OLD-ADDRESSES'],
    body: `
**Who is listed.** Everyone in the workspace except people marked as left (or deleted), by name A to Z, ignoring case and accents; two people with one name are ordered by email, then ID. ${DIRECTORY_PAGE} at a time; a page past the end is the last page.

**What a search finds.** A person matches when every word typed starts a word of their name, their job title or their team’s name, ignoring case and accents (so “eng man” finds “Engineering Manager”, and “lucia” finds “Lucía”). Words are split at spaces and at the punctuation inside names (“Build & Release”, “Cloud Cost (FinOps)”). A team filter keeps the team’s people as \`teamPeople\` gives them: its lead counts, wherever their own team is; “no team” keeps people with no team or a team that is gone. Teams match on the team’s name or its lead’s, and are listed A to Z.

**A person’s line**, beside them in a list: “Admin”; then “leads the team” (their own), “leads {team}” (another, the first A to Z) or “leads {n} teams”; then their goals in the running cycle that aren’t stopped (“{n} goals”, “1 goal”, “no goals”). The first part takes a capital.

**A team’s summary**: its lead, its people (its lead among them) and its goals in the running cycle counted by status, worst first, from the same statuses Goals uses, so a team’s counts on People and under Goals’ By team are the same numbers.

**Old addresses.** /workspace/people leads to /people, keeping its query; with ?team=<id> it leads to that team’s page; /workspace/teams leads to /teams; /workspace#people and #teams to People and Teams. Each is a replace, not a new history entry.`,
    examples: [
      { given: 'The demo workspace on Wednesday 11 November: People with nothing asked.', then: '97 people; 1 to 50 of page 1 of 2; first Adaeze Obi', run: () => { const r = dirAsk({}); return `${r.total} people; ${r.from} to ${r.to} of page ${r.page} of ${r.pages}; first ${r.rows[0]!.name}`; } },
      { given: 'The same, page 9.', then: 'page 2: 51 to 97', run: () => { const r = dirAsk({ page: 9 }); return `page ${r.page}: ${r.from} to ${r.to}`; } },
      { given: 'Searching for “rhea”, “lucia” and “Romero”.', then: 'Rhea Kapoor / Lucía Romero / Lucía Romero', run: () => ['rhea', 'lucia', 'Romero'].map((q) => dirAsk({ q }).rows.map((p) => p.name).join(', ')).join(' / ') },
      { given: 'The CI/CD team’s people, and the admins.', then: '7 people / Amara Nwosu, Grace Achterberg, Hamid Rezaei', run: () => `${dirAsk({ teamId: 'cicd' }).total} people / ${dirAsk({ admins: true }).rows.map((p) => p.name).join(', ')}` },
      { given: 'Teams whose name or lead starts with “rhea”.', then: 'CI/CD', run: () => findTeams(dirWs().teams, dirWs().people, 'rhea').map((t) => t.name).join(', ') },
      { given: 'The lines beside Amara, Rhea and Oskar.', then: 'Admin · leads the team · no goals / Leads the team · 8 goals / No goals', run: () => ['amara', 'rhea', 'oskar'].map((id) => personLine({ snapshot: dirWs() }, id)).join(' / ') },
      { given: 'CI/CD’s summary.', then: 'led by Rhea Kapoor; 7 people; 17 goals', run: () => { const t = teamSummary({ snapshot: dirWs(), statusOf: (g) => goalStatus(g, dirWs().cycles[0]!, dirWs().checkIns, DIR_NOW).status }, 'cicd'); return `led by ${t.lead?.name}; ${t.people.length} people; ${t.goals.length} goals`; } },
      { given: 'Old addresses: /workspace/people?team=cicd, /workspace/people?team=-, /workspace/teams, /workspace#people.', then: '/teams/cicd, /people?team=-, /teams, /people', run: () => [movedTo('/workspace/people', '?team=cicd'), movedTo('/workspace/people', '?team=-'), movedTo('/workspace/teams'), movedTo('/workspace', '', '#people')].join(', ') },
    ],
    unclear: ['The page size (50) and the reading of “a word” (split at spaces and at & / ( ) , . -) are choices; a rebuild with a server search should keep the rule that every word typed starts a word.', 'Who leads a team is not a role: a lead is any person a team names, in any team.'],
  },

  /* ---------- day one (app redesign OB3) ---------- */
  {
    id: 'day-one',
    title: 'Day one: set-up’s steps and “Getting started”',
    summary: 'How many steps set-up counts for the path chosen, and what Home’s “Getting started” tells each person in a workspace’s first weeks.',
    code: [{ file: 'src/domain/dayOne.ts', names: ['setupSteps', 'stepCounter', 'gettingStarted', 'creatorOf', 'DAY_ONE_DAYS', 'NEW_WORKSPACE_DAYS'] }],
    tests: ['src/domain/dayOne.test.ts'],
    reqs: ['DAY-ONE', 'ONBOARDING'],
    body: `
**Set-up’s steps.** A template or “Start blank”: seven (workspace, you, your team, starting point, outcome, goals, check). “Set goals up later” or a spreadsheet: five, without the outcome and the goals, so Check is “Step 5 of 5”.

**Who set it up** is whoever the workspace’s “Created …” change names, or else its first admin. A goal set-up left with no owner is made theirs, and its id is kept for them (the Prefs port), so Home can ask them to give it one; nothing is added to the goal.

**Getting started**, for one person, in this order, each left out when it doesn’t apply or is done. Whoever set it up: their first check-ins (goals they own with none); “Give {n} goals an owner” (the goals set-up left without one that they still own); “Add the people who own goals” while they’re alone, otherwise “Send your team the link” until they copy it; “Set up the first goal” while there are none. Anyone else: who set it up, when, and how many goals they were given; their first check-ins; and, owning none, the goals to see (until opened), to watch (until they watch one), and a goal of their own. Nothing at all when they hid it, ${DAY_ONE_DAYS} days after their first visit, in the example, or in a workspace more than ${NEW_WORKSPACE_DAYS} days old that they didn’t just join.`,
    examples: [
      { given: 'The counter on Check: a template; goals set up later.', then: 'Step 7 of 7 / Step 5 of 5', run: () => `${stepCounter('check', 'product')} / ${stepCounter('check', 'later')}` },
      { given: 'Ana set up Field Operations today with Ben, gave Ben one goal and left two unowned; what Ana sees.', then: 'first-check-in, assign (Give 2 goals an owner.), invite', run: () => { const r = gettingStarted('ana', dayOneWs(['ana', 'ana', 'ana', 'ben']), DAY_WS, { firstSeenAt: DAY_MADE, unowned: ['g1', 'g2'] }, DAY_NOW, 'Thursday'); return r.map((x) => (x.id === 'assign' ? `assign (${x.says})` : x.id)).join(', '); } },
      { given: 'Ben opens it for the first time.', then: 'Ana Silva set up Field Operations on 11 Nov and gave you 1 goal. / first-check-in', run: () => { const r = gettingStarted('ben', dayOneWs(['ana', 'ben']), DAY_WS, { firstSeenAt: DAY_MADE }, DAY_NOW, 'Thursday'); return `${r[0]!.says} / ${r.slice(1).map((x) => x.id).join(', ')}`; } },
      { given: 'Ana, 15 days after her first visit.', then: 'nothing', run: () => gettingStarted('ana', dayOneWs(['ana']), DAY_WS, { firstSeenAt: DAY_MADE }, new Date('2026-11-26T15:00:00Z'), 'Thursday').map((x) => x.id).join(', ') || 'nothing' },
    ],
    unclear: ['Two weeks, and 28 days for a workspace to stop being new, are choices; the rebuild may tune them.', 'Which goals were left without an owner is kept per person (the Prefs port), not on the goal: a rebuild keeps it out of the goal’s record too.'],
  },

  /* ---------- the goal map ---------- */
  {
    id: 'map',
    title: 'The goal map',
    summary: 'The critical path, what the map shows when folded, what a parent says about the goals under it, which trees are in trouble, and finding a goal by name or key.',
    code: [{ file: 'src/domain/map.ts', names: ['criticalPath', 'shownOnMap', 'rollup', 'rollupText', 'troubled', 'findOnMap', 'layout', 'pack', 'layoutIndented'] }],
    tests: ['src/domain/map.test.ts'],
    reqs: ['GOAL-MAP'],
    body: `
**The critical path.** From each top goal (a goal with nothing above it), step down to the input most likely to make it miss: each input scores its threat (off track 4; at risk or no recent update 2; anything else 0) times one half plus its share of its siblings' estimated effect (equal shares when none is set). The path takes the highest score (a tie goes to the worse status) and stops where nothing below scores above 0. A path is only drawn when it reaches a goal in trouble.

**What the map shows, folded.** Every top goal, always. Under a goal: everything feeding it once it is *opened*; nothing once it is *shut*; otherwise only its next step on the critical path. So the map opens on the top goals with the critical path drawn beneath the ones in trouble, and a goal's fold button counts the inputs still hidden. When the Goals screen is searched or filtered, every match is unfolded.

**What's under a goal** (the roll-up, shared with the List's tree cards): everything feeding it, at any depth. Its status is the group's status of those goals (\`worst\`, in [A goal's status](status.md)); its words count the goals behind, worst first ("2 off track, 1 at risk"), or else say "None behind" with the group's status, or "All *n* done". A goal with no check-in yet is not counted.

**A tree in trouble:** the group's status of its top goal and everything under it ranks 2 or worse (off track, at risk or no recent update). Troubled trees only keeps those trees.

**Finding a goal.** Best first: the goal whose key has the number typed ("G-48", "g48", "g-48"), then titles starting with the words, then titles holding every word, then keys starting with what was typed. Finding a goal opens every goal above it.

**Fit all.** The trees keep their order and wrap into rows; of every place the rows could break, the map takes the one that lets it be drawn largest in the window. Fit all then shows every goal, as large as fits and never above 100%. Readable shows the top goals and the critical path at no less than 75%.`,
    examples: (() => {
      const g = (id: string, parentId: string | null, title: string, key: string) => ({ ...g3075, id, parentId, title, key });
      const tree = [g('t', null, 'Lead time for changes', 'G-1'), g('a', 't', 'Merge to deploy', 'G-2'), g('b', 't', 'Review time', 'G-3'), g('c', 'a', 'Merge queue live', 'G-4'), g('d', null, 'Cloud cost', 'G-5'), g('e', 'd', 'Idle machines off', 'G-6')];
      const st = (s: Record<string, DisplayStatus>) => (x: Goal) => s[x.id] ?? 'on';
      const bad = st({ a: 'off', b: 'risk', c: 'on', d: 'on', e: 'done' });
      return [
        { given: 'Lead time (on track) fed by Merge to deploy (off track, fed by Merge queue live, on track) and Review time (at risk); Cloud cost (on track) fed by Idle machines off (done). The critical path.', then: 't, a', run: () => [...criticalPath(tree, bad)].join(', ') },
        { given: 'The same goals, folded: what the map shows; then with Lead time opened; then with Lead time shut.', then: 't, a, d; t, a, c, b, d; t, d', run: () => { const c = criticalPath(tree, bad); const show = (open: string[], shut: string[]) => [...shownOnMap(tree, c, { open: new Set(open), shut: new Set(shut), trail: true })].join(', '); return [show([], []), show(['t', 'a'], []), show([], ['t'])].join('; '); } },
        { given: 'What’s under Lead time, and under Cloud cost.', then: 'off: 1 off track, 1 at risk; done: All 1 done', run: () => ['t', 'd'].map((id) => { const r = rollup(tree.find((x) => x.id === id)!, tree, bad)!; return `${r.worst}: ${rollupText(r)}`; }).join('; ') },
        { given: 'Under a goal: one on track and one done; then one on track and one with no recent update.', then: 'None behind: on track; 1 no recent update', run: () => ([['on', 'done'], ['on', 'stale']] as const).map(([x, y]) => rollupText(rollup(tree[0]!, tree.slice(0, 3), st({ a: x, b: y }))!)).join('; ') },
        { given: 'Which trees are in trouble.', then: 't', run: () => tree.filter((x) => !x.parentId && troubled(x, tree, bad)).map((x) => x.id).join(', ') },
        { given: 'Finding “g4”, “G-2”, “merge” and “queue merge” (titles that start the same way go A to Z).', then: 'c; a; c, a; c', run: () => ['g4', 'G-2', 'merge', 'queue merge'].map((q) => findOnMap(tree, q).map((x) => x.id).join(', ')).join('; ') },
      ];
    })(),
    unclear: ['How the trees wrap into rows is a choice about drawing, not a rule: any layout in which Fit all shows every goal, the trees in order, at least as large as this one, conforms.'],
  },

  /* ---------- act on a goal: its buttons and its one list (goal spec, GT1) ---------- */
  {
    id: 'goal-act',
    title: 'Acting on a goal: its buttons, and next steps and asks',
    summary: 'Which main button a goal’s page offers whoever is looking, the plain button beside it, and the one list of everything asked and agreed on the goal, each row with at most one button.',
    code: [{ file: 'src/domain/goalPage.ts', names: ['primaryAction', 'standingAction', 'stepsAndAsks', 'whyPointer', 'asksOnGoal'] }],
    tests: ['src/domain/goalAct.test.ts', 'evals/goalPage.eval.ts'],
    reqs: ['GOAL-ACT', 'GOAL-ASK-ONCE'],
    body: `
**The main button**, the first that applies: a question asked of the viewer here ("Answer {name}’s question"); a decision or help asked of them ("Answer {name}’s request"); for the owner, a goal with no check-in yet ("Post the first check-in"), then this week’s check-in when it is due ("Check in for week {n}"); the viewer’s own open next step ("Mark your next step done"); for the owner of a goal off track or at risk with no next step open, "Add a next step"; for anyone else on a goal with no recent update that nobody has asked about, "Ask {owner} for an update". Otherwise none. Watch is never the main button.

**Beside it**: the owner has "Check in again" unless the main button is a check-in, and never on a done or stopped goal; anyone else has "Watch", or "Watching" once they do; a stopped goal has nothing.

**Next steps and asks** lists every ask on the goal that isn’t withdrawn (a decision or help, a question, an ask for an update) and every next step. *For you*: the open rows the viewer is asked (or, for a decision, asked of no one in particular) or a next step they do. *Open*, in order: overdue next steps (longest overdue first), decisions, questions, next steps by their week, asks for an update. *Done*: answered or done, newest first.

Each row says its kind and its words ("Decision or help: …", "Question: …", "Next step: …", "Update asked"); who and when ("Asked of Amara by Rhea · 3 weeks ago", with "· for 3 goals" when one decision covers several; for a next step "Amara · by week 47 (Thu 19 Nov) · agreed in {review}" or "agreed by {name}"); its state ("Open", "Overdue by 1 week" with the warning mark, "Answered", "Done · week 44"); and an answered or done row’s answer as "{name}: {words}".

**At most one button**, the first that applies: "Respond" (a decision the viewer may answer), "Answer" (a question they may answer), "Mark done" (a next step they do or agreed, or an admin), "Check in" (an ask for an update, for the owner), "Withdraw" (whoever asked, an admin, or for a decision the owner of the goal it was raised on). The rights are the asks’ own rules (canAnswer, canMarkDone, canWithdraw), not restated.

**The gap**: a goal off track or at risk with no next step open. Its page says "No next step yet. Nobody has said what happens next, who does it and by when."

**Why points, it doesn’t repeat**: with a decision or help open, Why says "Waiting on a decision from {name}: see Next steps and asks" ("from {name} and {name}" for several; "Waiting on a decision: see Next steps and asks" when asked of no one in particular). The ask’s words are said only in the list.`,
    examples: (() => {
      const people = [{ id: 'p', name: 'Pat Owner' }, { id: 'l', name: 'Lee Lead' }, { id: 'o', name: 'Oz Other' }];
      const P = (id: string) => ({ id, name: people.find((x) => x.id === id)!.name, role: '', initials: '', teamId: 't', admin: false });
      const ask = (x: Partial<Ask> & Pick<Ask, 'id' | 'kind' | 'ask'>): Ask => ({ goalIds: ['m'], askedBy: 'p', recipientId: 'l', status: 'open', dueWeek: null, reviewId: null, week: null, checkInId: null, createdAt: '2026-10-19T10:00:00Z', updatedAt: '2026-10-19T10:00:00Z', answer: null, answeredBy: null, answeredAt: null, ...x });
      const decision = ask({ id: 'd', kind: 'decision', ask: 'approve the extra runner budget' });
      const step = ask({ id: 's', kind: 'action', ask: 'Take the budget to finance', askedBy: 'l', recipientId: 'l', dueWeek: 9 });
      const done = ask({ id: 'x', kind: 'action', ask: 'Write the one-page case', askedBy: 'l', recipientId: 'p', dueWeek: 6, status: 'done', answer: 'Sent to Lee', answeredBy: 'p', answeredAt: '2026-10-14T10:00:00Z' });
      const run = (viewer: string, asks: Ask[], week = 8, status: DisplayStatus = 'off') => stepsAndAsks({ goal: g3075, viewer: P(viewer), week, cycle: CYCLE, status, asks, people, reviews: [] });
      const rows = (xs: { text: string; button: string | null }[]) => xs.map((r) => `${r.text} [${r.button ?? 'no button'}]`).join('; ') || 'none';
      const pr = (viewer: string, extra: Partial<Parameters<typeof primaryAction>[0]> = {}) => primaryAction({ goal: g3075, viewer: P(viewer), owner: P('p'), status: 'off', due: false, week: 8, asked: [], updateAsked: false, openSteps: 1, ...extra });
      return [
        { given: 'Week 8. Pat owns the goal (off track) and asked Lee for a decision; Lee agreed a next step for himself, due week 9. Lee looks.', then: 'For you: Decision or help: approve the extra runner budget [Respond]; Next step: Take the budget to finance [Mark done]', run: () => `For you: ${rows(run('l', [decision, step]).forYou)}` },
        { given: 'The same, as Pat.', then: 'Open: Decision or help: approve the extra runner budget [Withdraw]; Next step: Take the budget to finance [no button]', run: () => `Open: ${rows(run('p', [decision, step]).open)}` },
        { given: 'The same, as Oz, who is neither asked nor asked anything.', then: 'Open: Decision or help: approve the extra runner budget [no button]; Next step: Take the budget to finance [no button]', run: () => `Open: ${rows(run('o', [decision, step]).open)}` },
        { given: 'The next step in week 11, still open, as Oz: its state and its place.', then: 'Overdue by 2 weeks, first', run: () => { const x = run('o', [decision, step], 11).open; return `${x.find((r) => r.kind === 'action')!.state}, ${x[0]!.kind === 'action' ? 'first' : 'not first'}`; } },
        { given: 'A next step Pat marked done on Wednesday 14 October (week 5), as Oz: its state and its answer.', then: 'Done · week 5 · Pat: Sent to Lee', run: () => { const r = run('o', [done]).done[0]!; return `${r.state} · ${r.answer}`; } },
        { given: 'Off track, with the decision open and no next step; then on track with nothing.', then: 'gap: yes; gap: no', run: () => `gap: ${run('o', [decision]).gap ? 'yes' : 'no'}; gap: ${run('o', [], 8, 'on').gap ? 'yes' : 'no'}` },
        { given: 'Pat, the owner: one next step open; then none; then this week’s check-in due.', then: 'none; Add a next step; Check in for week 8', run: () => [pr('p'), pr('p', { openSteps: 0 }), pr('p', { openSteps: 0, due: true })].map((x) => x.label || 'none').join('; ') },
        { given: 'Beside it: Pat with no check-in due; Oz, watching; Oz, not.', then: 'Check in again; Watching; Watch', run: () => [standingAction({ goal: g3075, viewer: P('p'), primary: pr('p'), watching: false, status: 'off' }), standingAction({ goal: g3075, viewer: P('o'), primary: pr('o'), watching: true, status: 'off' }), standingAction({ goal: g3075, viewer: P('o'), primary: pr('o'), watching: false, status: 'off' })].map((x) => x.label).join('; ') },
        { given: 'What Why says about the decision asked of Lee; then one asked of no one.', then: 'Waiting on a decision from Lee: see Next steps and asks; Waiting on a decision: see Next steps and asks', run: () => [whyPointer(g3075, [decision], people), whyPointer(g3075, [{ ...decision, recipientId: null }], people)].join('; ') },
      ];
    })(),
    unclear: ['How many done rows show before “Show all” (three) is a choice about the page, not the rule.', '“3 weeks ago” counts weeks of the cycle between when it was asked and now, not days.'],
  },

  /* ---------- a goal's history (goal spec, rule 4; GT2) ---------- */
  {
    id: 'goal-history',
    title: 'A goal’s history',
    summary: 'Every week of a goal, checked in or not, its comments, what reviews said and its changes, under four filters with counts.',
    code: [{ file: 'src/domain/goalPage.ts', names: ['goalHistory', 'historyKind', 'activityStream'] }],
    tests: ['src/domain/goalHistory.test.ts'],
    reqs: ['GOAL-HISTORY'],
    body: `
**Every week.** One entry for each week from the goal's first (the week it was created, or the first week it was checked in, if earlier) to this week, or to the week it stopped: its check-in, or "No check-in". Four or more weeks in a row with none are one entry ("Weeks 12 to 17 · No check-ins (6 weeks)"); fewer are a week each. This week is always its own entry. A goal with no check-in yet has one week entry, this week, "No check-in yet". Check-ins in a row that gave the same reason are one group, as before; every week is in it.

**The kinds.** *Check-ins*: the week entries, missed weeks included. *Comments*: comments, and asks raised outside a review. *Reviews*: what a review said (looked at it, a note, a question or next step agreed in it, an ask answered in it). *Changes*: everything else the change log holds for the goal (its plan, target, owner, team, level, links, metric; stopped, restored).

**Counts.** Per kind and for All, which is their sum; a run of missed weeks counts as its weeks, a group as its weeks.

**Order.** Newest first; a week's entry sits at the end of its week, so this week's is at the top.

**Searching** keeps the entries whose words match ([finding things](finding.md), rule 1).`,
    examples: (() => {
      const g = { ...g3075, createdAt: '2026-09-07T09:00:00Z' };
      const run = (weeks: number[], now: number, filter: 'all' | 'checkins' = 'checkins') => goalHistory({ goal: g, checkIns: weeks.map((w) => ci(g.id, w, 40, { why: `Reason ${w}` })), changes: [], cycle: CYCLE, week: now, reviews: [] }, filter);
      const say = (h: ReturnType<typeof run>) => h.entries.map((x) => (x.kind === 'missed' ? (x.from === x.to ? `${x.from}: ${x.yet ? 'none yet' : 'none'}` : `${x.from}–${x.to}: none (${x.weeks})`) : x.kind === 'checkin' ? `${x.checkIn.week}` : x.kind)).join(', ');
      return [
        { given: 'Created in week 1, checked in weeks 1 to 3; now week 5.', then: '5: none, 4: none, 3, 2, 1', run: () => say(run([1, 2, 3], 5)) },
        { given: 'Checked in weeks 1 and 8; now week 9.', then: '9: none, 8, 2–7: none (6), 1', run: () => say(run([1, 8], 9)) },
        { given: 'Checked in week 1 only; now week 6: the run reaching this week keeps this week apart.', then: '6: none, 2–5: none (4), 1', run: () => say(run([1], 6)) },
        { given: 'No check-in yet, in week 3.', then: '3: none yet', run: () => say(run([], 3)) },
        { given: 'The counts for checked in weeks 1 and 8, now week 9.', then: 'all 9, check-ins 9', run: () => { const h = run([1, 8], 9, 'all'); return `all ${h.counts.all}, check-ins ${h.counts.checkins}`; } },
      ];
    })(),
    unclear: ['How long a run of missed weeks must be to fold into one line (four) is a choice about reading, not a law.'],
  },

  /* ---------- who a comment reaches (goal spec, rule 5; GT3) ---------- */
  {
    id: 'comment-reach',
    title: 'Who a comment reaches',
    summary: 'The line under a goal’s comment box: everyone in the workspace can read a comment, and the goal’s owner and the people watching it see it on Home.',
    code: [{ file: 'src/domain/goalPage.ts', names: ['commentReach'] }],
    tests: ['src/domain/goalAct.test.ts'],
    reqs: ['GOAL-SAYS'],
    body: `
"Everyone in {workspace} can read this." Then, for anyone but the owner: "{owner} and the {n} people watching see it on Home." ("the 1 person"; with nobody watching, "{owner} sees it on Home."). For the owner: "The {n} people watching see it on Home." (with nobody watching, "Nobody is watching it yet, so it shows on no one else’s Home.").

*The people watching* are those whose watches cover the goal: the goal itself, a tree it is in, or its level. The viewer and the owner are never counted among them.`,
    examples: (() => {
      const g = { ...g3075, ownerId: 'r' };
      const say = (viewerId: string, watcherIds: string[]) => commentReach({ goal: g, viewerId, ownerFirst: 'Rhea', watcherIds, workspace: 'Platform Engineering' });
      return [
        { given: 'Oskar on Rhea’s goal, with six others watching it.', then: 'Everyone in Platform Engineering can read this. Rhea and the 6 people watching see it on Home.', run: () => say('o', ['a', 'b', 'c', 'd', 'e', 'f']) },
        { given: 'Rhea on her own goal, the same six watching.', then: 'Everyone in Platform Engineering can read this. The 6 people watching see it on Home.', run: () => say('r', ['a', 'b', 'c', 'd', 'e', 'f']) },
        { given: 'Oskar, nobody watching.', then: 'Everyone in Platform Engineering can read this. Rhea sees it on Home.', run: () => say('o', []) },
        { given: 'Oskar, one other watching (and Oskar himself, who isn’t counted).', then: 'Everyone in Platform Engineering can read this. Rhea and the 1 person watching see it on Home.', run: () => say('o', ['a', 'o']) },
      ];
    })(),
  },

  /* ---------- finding things (the app redesign, AR1) ---------- */
  {
    id: 'finding',
    title: 'Finding things',
    summary: 'What a search matches, the near miss offered when nothing does, and the one search per kind of thing (goals, people, teams) that every list, picker and Find calls.',
    code: [{ file: 'src/domain/find.ts', names: ['textMatches', 'wordsOf', 'fold', 'oneEditApart', 'nearMiss', 'search', 'searchGoals', 'searchPeople', 'searchTeams', 'goalWords', 'goalRow', 'page', 'suggest', 'withRecent', 'countLine', 'filterLine', 'filterText', 'noneFound', 'historyStep'] }, { file: 'src/domain/query.ts', names: ['searchKey'] }],
    tests: ['src/domain/find.test.ts', 'src/adapters/parts.test.ts'],
    reqs: [],
    body: `
**What a search matches.** A row is found by its words, as one text; a search matches when every word typed starts a word of the row, ignoring case and accents. Words break at spaces and at \`/ - , . : ( )\`, so "CI/CD" is two words and "ci" finds it, "Lucía" is found by "lucia", and "back" doesn't find "Rollback". An empty search matches everything.

**A goal's key** finds it however it is typed: "G-48", "g48", "g-48" or a bare "48". A whole search that is one key finds only that goal ("G-48" isn't G-4); a bare number also matches as words.

**A goal's words** are its title, key, owner, team, level, status word ("Off track"), the owner's latest reason and path to green and what they need, its definition and its source. **A person's** are their name, job title and team; someone marked as left is never found for a picker. **A team's** are its name and its lead's name.

**A near miss.** Only when nothing matches: each word typed that starts none of the list's words, and has 4 letters or more, is corrected to the commonest of the list's words one edit away (one letter added, dropped or changed, or two next to each other swapped). If every such word has one, the corrected search is said and its rows shown; otherwise nothing. Never for a key. (The design said 5 letters; its own example, "qeue" for "queue", needs 4.)

**One search per kind.** \`search(rows, ask)\` with \`ask = { q, filters, sort, after, size }\` gives \`{ total, rows, next, near? }\`: every match in the kind's order, a page at a time (50 unless asked, at most 200), and where the next page starts. Goals take a Goals link's filters and sort (\`src/domain/query.ts\`) and come worst first unless sorted; people come with those whose name starts with the search first, then A to Z; teams A to Z. Each row is the same two lines everywhere: a goal's status and title, then "{key} · {owner} · {team}"; a person's name, then "{job title} · {team}"; a team's name, then "Led by {name} · {n} people" or "No lead · …".

**Suggestions before typing.** Up to 6 rows, no repeats, in order. A person: you; the people of your team, A to Z; then people chosen lately. A team: your team; teams you lead; teams chosen lately. A goal: your goals, worst first; the goals they feed; goals chosen lately. When your own would fill the list, up to two places are kept for those chosen lately. Nobody marked as left. "Lately" is the last 12 things a person chose or opened in a workspace, newest first, kept per person behind the \`Prefs\` port.

**The words under a list** (the list bar). The count line: not narrowed, "{n} {things}, {order}." ("126 goals, worst first."), with "Showing {a} to {b}." when paged, and "1 goal." for one; narrowed, "{n} {things} match." or "1 goal matches."; nothing, no line. The filter line: "Filtered by: " then each filter as its label and its values joined with " or " ("Team CI/CD · Status Off track or At risk"). A search is never a filter. When nothing is found: "No {thing} matches “{q}”." (with these filters: "… with these filters."; filters alone: "No {things} match these filters."); a near miss: "No {thing} matches “{q}”. Showing {things} that match “{near}”." **History:** choosing a filter, a sort or a page adds an entry; a search's first key adds one and later keys replace it, so Back returns to the list before the search; Enter or leaving the field writes nothing more when the address already says what was typed; clearing adds one.

**The seam.** Screens, pickers and the AI tools reach this through the \`Search\` port (\`src/ports/search.ts\`), whose browser adapter calls these rules over the loaded workspace and whose contract is these examples. A server's search replaces the adapter; it may leave the near miss out.`,
    examples: (() => {
      const row = 'Rollback in under five minutes G-48 Tunde Bakare Build & Release Team Off track';
      const cycle = () => demo!.cycles[0]!;
      const find = (kind: 'goal' | 'person' | 'team', q: string) => {
        const at = new Date(CHECK_IN_MOMENT), wk = currentWeek(cycle(), at);
        const rows = kind === 'goal' ? goalRows(demo!, cycle(), at, wk) : kind === 'person' ? personRows(demo!) : teamRows(demo!);
        const a = search(rows, { q, size: 200 });
        return `${a.total}${a.near ? ` (near: ${a.near})` : ''}: ${a.rows.slice(0, 3).map((r) => r.name).join(', ')}`;
      };
      return [
        { given: `The row “${row}”, searched for “rollback”, “roll min”, “back”, “off track”.`, then: 'yes, yes, no, yes', run: () => ['rollback', 'roll min', 'back', 'off track'].map((q) => (textMatches(row, q, 'G-48') ? 'yes' : 'no')).join(', ') },
        { given: 'The same row (key G-48), searched for “g-48”, “G48”, “48”; and “Canary halt G-4” (key G-4) for “G-48”.', then: 'yes, yes, yes; no', run: () => `${['g-48', 'G48', '48'].map((q) => (textMatches(row, q, 'G-48') ? 'yes' : 'no')).join(', ')}; ${textMatches('Canary halt G-4', 'G-48', 'G-4') ? 'yes' : 'no'}` },
        { given: '“Lucía Romero Staff Engineer CI/CD” searched for “lucia ci”; anything searched for “”.', then: 'yes; yes', run: () => `${textMatches('Lucía Romero Staff Engineer CI/CD', 'lucia ci') ? 'yes' : 'no'}; ${textMatches('Anything', '') ? 'yes' : 'no'}` },
        { given: 'Near misses: “rolback”, “kafak”, “piplin”, “rolbak” (list has rollback, kafka, pipeline); “qeue wait” (queue, wait); “cost” (costs); “G-480”.', then: 'rollback; kafka; none; none; queue wait; none; none', run: () => ([['rolback', ['rollback']], ['kafak', ['kafka']], ['piplin', ['pipeline']], ['rolbak', ['rollback']], ['qeue wait', ['queue', 'wait']], ['cost', ['costs']], ['G-480', ['G-48']]] as [string, string[]][]).map(([q, v]) => nearMiss(q, v) ?? 'none').join('; ') },
        { given: 'In the demo workspace: goals for “G-48”, “tunde”, “rolback” and “zzzz”.', then: '1: On-call engineers across all twelve rotations who had fewer than two out-of-hours pages in the week, not counting planned maintenance windows / 2: Contract tests between the top 40 service pairs, One-click rollback for every deployable service / 2 (near: rollback): Change failure rate, One-click rollback for every deployable service / 0: ', run: () => ['G-48', 'tunde', 'rolback', 'zzzz'].map((q) => find('goal', q)).join(' / ') },
        { given: 'In the demo workspace, Rhea’s suggestions before typing: people with nothing chosen lately; then after choosing Daniel Okafor.', then: 'Rhea Kapoor, Aiko Suzuki, Diego Ramírez, Femi Adebayo, Johanna Virtanen, Marcus Bell / Rhea Kapoor, Aiko Suzuki, Diego Ramírez, Femi Adebayo, Johanna Virtanen, Daniel Okafor', run: () => [[], [{ kind: 'person', id: 'daniel' }]].map((r) => suggest(personRows(demo!), 'rhea', r).map((x) => x.name).join(', ')).join(' / ') },
        { given: 'Count lines: 126 goals worst first; 97 people A to Z, first page of 50; 17 goals narrowed; 1 person narrowed.', then: '126 goals, worst first. / 97 people, A to Z. Showing 1 to 50. / 17 goals match. / 1 person matches.', run: () => [countLine({ thing: 'goal', things: 'goals' }, 126, false, 'worst first'), countLine({ thing: 'person', things: 'people' }, 97, false, 'A to Z', { from: 1, to: 50 }), countLine({ thing: 'goal', things: 'goals' }, 17, true), countLine({ thing: 'person', things: 'people' }, 1, true)].join(' / ') },
        { given: 'The filter line for Team CI/CD and Status Off track or At risk; nothing found for “rolback” with the near miss “rollback”.', then: 'Filtered by: Team CI/CD · Status Off track or At risk / No goal matches “rolback”. Showing goals that match “rollback”.', run: () => `${filterLine([{ key: 'team', label: 'Team', values: ['CI/CD'] }, { key: 'status', label: 'Status', values: ['Off track', 'At risk'] }])} / ${noneFound({ thing: 'goal', things: 'goals' }, 'rolback', false, 'rollback')}` },
        { given: 'In the demo workspace: people for “tunde” and “LUCIA”; teams for “rhea”.', then: '1: Tunde Bakare / 1: Lucía Romero / 1: CI/CD', run: () => [find('person', 'tunde'), find('person', 'LUCIA'), find('team', 'rhea')].join(' / ') },
      ];
    })(),
    unclear: ['Which of two rows that match equally comes first is the kind\'s order (goals worst first, then by name); a server may break ties another way within a status, as long as the order is stable from page to page.', 'A goal\'s words include its owner\'s latest reason, so a search for “off track” also finds a goal whose reason says both words: 13 goals in the demo, of which 11 are off track.'],
  },
];

/** The names the navigation examples read: a few of the demo's, as the rules look them up. */
const NAV_GOALS: Record<string, { title: string; parent?: string }> = { 'G-1': { title: 'Lead time for changes' }, 'G-7': { title: 'Merge-to-deploy time', parent: 'G-1' } };
const NAV_NAMES: PlaceNames = {
  goal: (id) => NAV_GOALS[id]?.title ?? null, parent: (id) => NAV_GOALS[id]?.parent ?? null,
  review: (id) => (id === 'weekly' ? 'Platform leadership weekly' : null), view: () => null, article: () => null,
  person: (id) => (id === 'rhea' ? 'Rhea Kapoor' : null), team: () => null, section: (id) => (id === 'access' ? 'Access' : null),
  module: (p) => (p === '/metrics/lead-time' ? 'Lead time for changes (metric)' : null),
};

RULE_LIST.push({
  id: 'navigation',
  title: 'Navigation: the menu, the lit item and a page’s name',
  summary: 'Which places the menu lists for a viewer, where a module’s items go, which one is lit at an address, what a page is called, and what a Back link says.',
  code: [{ file: 'src/domain/navigation.ts', names: ['CORE_NAV', 'GROUP_NAMES', 'menuGroups', 'menuRows', 'phoneTabs', 'moreFor', 'menuViews', 'isLit', 'litItem', 'litTab', 'pageName', 'placeName', 'backTo', 'FIRST_PAGES', 'FORM'] }],
  tests: ['src/domain/navigation.test.ts'],
  reqs: ['NAV-WHERE', 'NAV-BACK'],
  body: `
**The menu** is four groups, with a hairline between them and a name each for screen readers: *your work* (Home; Check-in, only for someone with a goal to check in on: one of theirs, not stopped or done; Goals, with up to four saved views under it: those pinned for everyone A to Z, then their own, the latest opened first; Reviews), *look up* (People, the modules' items in the order they register, Activity, Data), *make* (New goal), and *this workspace and you* (Workspace, Settings, Help, Feedback). Then you: your name and "Admin · {team}" or your team. A module's item says its group (your work, after Reviews, or to look up, the default); with the module off it isn't there. **The phone's tabs** are Home, Check-in, Goals and Reviews for someone with a goal to check in on, and Home, Goals, Reviews and People for anyone else; **More** holds every other row, in the same groups.

**The lit item** (one at most): a goal opened in a review's walk (\`?review=\`) lights Reviews; Goals at a saved view's exact address lights that view instead of Goals; otherwise the item whose place the address is in: Home only at \`/\`; Check-in for a check-in and the table; Goals for every goal, its edit and print pages, and the wrap-up (\`/retro\`); New goal for New goal and its steps; People for People and Teams; Workspace for its sections but not set-up (\`/workspace/new\`); Help for Help and What's new; a module's item for its pages. \`/ready\`, \`/research\`, set-up and a page not found light nothing. **On a phone** the tab that holds the lit row is lit; a row in More lights More.

**A page's name** (the browser's title, then "· {workspace} · Faro"; the phone's top bar shows the part before the first " · "): a module's page names itself; the fixed places by name, and Goals is "Goals" on every tab; a goal by its title ("Change {title}" to edit, "{title}, to print", "Check in: {title}", "Wrap up: {title}", "{title} · {review}" in a review's walk); a review, a person, a team and a Help article by their own name; a Workspace section as "{section} · Workspace"; the wrap-up as "Wrap up {year}"; something not there as "Goal not found" (or review, person, team); any other address "Page not found". So six goals opened in turn give six titles.

**The back link** ("‹ {where}", above the title) is never on a place's first page: Home, Check-in, Goals, Reviews, People, Teams, Activity, Data, Workspace, Settings, Help, Feedback, and a module's own. Elsewhere it goes back to the last earlier page in the tab that isn't a form (check-in, the table, New goal, an edit, set-up, a wrap-up) and isn't this page (in a review's walk, the walk's other goals count as this page), named in the navigation's words: Home, Goals, "your goals" on Mine, a saved view's name, a goal's title, a review's name. Pressing it goes back that many entries, so the browser's Forward still works, and the browser's Back onto a form you left steps over it the same way. Arriving from outside, it goes to the page's parent: the goal a goal feeds (or Goals), the goal for its edit or print page, the review for a goal in its walk and for its summary, Reviews, People, Teams, Help (for an article and What's new), Check-in for the table, Workspace for a section, a module's first page for its other pages; otherwise Home.`,
  examples: [
    { given: 'The menu for someone with a goal to check in on, with a module item to look things up (Metrics), group by group; then for someone without.', then: 'home checkin goals reviews | people module:metrics activity data | new | workspace settings help feedback / home goals reviews | people module:metrics activity data | new | workspace settings help feedback', run: () => [true, false].map((o) => { const g = menuGroups(o, [{ id: 'metrics', to: '/metrics', label: 'Metrics' }]); return [g.work, g.lookup, g.make, g.you].map((x) => x.join(' ')).join(' | '); }).join(' / ') },
    { given: 'The phone’s tabs for someone with a goal to check in on, and for someone without.', then: 'home checkin goals reviews / home goals reviews people', run: () => [phoneTabs(true), phoneTabs(false)].map((x) => x.join(' ')).join(' / ') },
    { given: 'The lit item at /goals/lead-mq, /goals/lead-mq?review=weekly, /goals/new, /retro, /teams/cicd, /whats-new and /research.', then: 'goals, reviews, new, goals, people, help, none', run: () => ['/goals/lead-mq', '/goals/lead-mq?review=weekly', '/goals/new', '/retro', '/teams/cicd', '/whats-new', '/research'].map((a) => { const [p = '/', q = ''] = a.split('?'); return litItem(p, q, menuRows(menuGroups(true))) ?? 'none'; }).join(', ') },
    { given: 'The page’s name at /goals?scope=watching, /goals/G-1, its edit page, /goals/G-1?review=weekly, /check-in/G-1, /workspace/access, a module’s page for the metric “Lead time for changes”, and an unknown goal.', then: 'Goals / Lead time for changes / Change Lead time for changes / Lead time for changes · Platform leadership weekly / Check in: Lead time for changes / Access · Workspace / Lead time for changes (metric) / Goal not found', run: () => ['/goals?scope=watching', '/goals/G-1', '/goals/G-1/edit', '/goals/G-1?review=weekly', '/check-in/G-1', '/workspace/access', '/metrics/lead-time', '/goals/G-99'].map((a) => { const [p = '/', q = ''] = a.split('?'); return pageName(p, q, NAV_NAMES); }).join(' / ') },
    { given: 'The back link: Goals on Mine → Lead time for changes; Goals → a goal → Edit → Save → the goal; a new tab on Merge-to-deploy time (which feeds Lead time for changes); a new tab on Lead time for changes; Settings from a goal; Home → Rhea’s page; a new tab on Rhea’s page.', then: '‹ your goals (1 back) / ‹ Goals (3 back) / ‹ Lead time for changes (/goals/G-1) / ‹ Goals (/goals) / none / ‹ Home (1 back) / ‹ People (/people)', run: () => ([['/goals/G-1', ['/goals?scope=mine']], ['/goals/G-1', ['/goals?scope=all', '/goals/G-1', '/goals/G-1/edit']], ['/goals/G-7', []], ['/goals/G-1', []], ['/settings', ['/goals/G-1']], ['/people/rhea', ['/']], ['/people/rhea', []]] as [string, string[]][]).map(([a, t]) => { const b = backTo(a, '', [...t, a].map((path) => ({ path })), NAV_NAMES); return b ? `‹ ${b.label} (${b.steps ? `${b.steps} back` : b.to})` : 'none'; }).join(' / ') },
  ],
});

RULE_LIST.push({
  id: 'goals-page',
  title: 'The Goals page: whose goals, how they are grouped, and the switch',
  summary: 'Which scope tabs someone has and which opens, each scope’s own grouping, what the Needs attention switch counts, the line that counts the goals shown, and how old addresses and saved views open.',
  code: [{ file: 'src/domain/goalsPage.ts', names: ['scopesFor', 'ownGroup', 'scopeWords', 'attentionCount', 'goalsLine', 'describeView', 'movedGoals', 'GROUPS'] }],
  tests: ['src/domain/goalsPage.test.ts'],
  reqs: ['GOALS-SCOPE', 'GOALS-ATTENTION', 'GOALS-ADDRESS'],
  body: `
**Whose goals (the scope).** Mine: the goals someone owns, when they own one. My team: the goals of their own team and of any team they lead, when they have one ("My teams" for several). Watching: the goals they watch. All: every goal. Only goals not stopped count. Goals opens on the scope used last in this workspace when they still have it; otherwise Mine, else Watching when it has goals, else All.

**How they are grouped.** As trees (All's own), by team, by level, or none: one list, worst first (every other scope's own). A group equal to the scope's own is left out of the address.

**The switch.** "Needs attention · {n}" counts the goals in the scope, after the search and the filters, that need attention ([flags](flags.md)); being handled is never counted. On, the goals that need attention come first and those being handled below.

**The line.** Off: the list's count line ([finding things](finding.md)), then each status that has goals, worst first, "{n} {status}", joined with " · ". On: "{n} need attention: " with the same list over those goals, where a status that isn't itself a reason says why ("2 on track, flagged for getting worse"), then how many being handled are listed below.

**Old addresses.** show=mine, watching, outcomes, levels, teams and attention become a scope, a group and the switch; an address with a filter and no scope is All; a bare /goals is the scope that opens; /watching is Watching. A saved view stored in the old form opens in the new one; the record is not rewritten.`,
  examples: (() => {
    const facts = (who: string) => ({ goals: demo!.goals.filter((g) => !g.stoppedAt).map((g) => ({ id: g.id, ownerId: g.ownerId, teamId: g.teamId })), viewerId: who, teams: demo!.teams.filter((t) => t.id === demo!.people.find((p) => p.id === who)?.teamId || t.leadId === who).map((t) => ({ id: t.id, name: t.name })), watched: new Set(watchedGoals(who, demo!).map((g) => g.id)) });
    const tabs = (who: string) => { const r = scopesFor(facts(who), null); return `${r.tabs.map((t) => `${t.label} ${t.ids.length}`).join(' · ')}; opens on ${r.opens}`; };
    return [
      { given: 'Rhea’s tabs (she owns goals and leads CI/CD) in the demo workspace.', then: 'Mine 8 · My team 17 · Watching 12 · All 126; opens on mine', run: () => tabs('rhea') },
      { given: 'The scope each opens on: Rhea; and someone in no team who owns nothing and watches nothing.', then: 'mine; all', run: () => `${scopesFor(facts('rhea'), null).opens}; ${scopesFor({ goals: facts('rhea').goals, viewerId: 'nobody', teams: [], watched: new Set() }, null).opens}` },
      { given: 'Each scope’s own group.', then: 'none, none, none, tree', run: () => (['mine', 'team', 'watching', 'all'] as const).map(ownGroup).join(', ') },
      { given: 'Old addresses: show=levels; show=attention&needs=decision; quiet=2; a bare address for someone who opens on Mine; show=cards-and-more.', then: 'scope=all&group=level / scope=all&attention=1&needs=decision / scope=all&quiet=2 / scope=mine / scope=mine (There’s no “cards-and-more” tab, so these are your goals.)', run: () => ['show=levels', 'show=attention&needs=decision', 'quiet=2', '', 'show=cards-and-more'].map((q) => { const m = movedGoals(q, 'mine', () => true)!; return m.search + (m.note ? ` (${m.note})` : ''); }).join(' / ') },
    ];
  })(),
});

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
