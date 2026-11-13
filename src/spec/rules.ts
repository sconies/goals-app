/* The core rules, in plain words, for the spec (spec/core/rules/). Each rule says what it decides, exactly how, with
   its numbers read from the code (domain/thresholds.ts), and worked examples. Every example is run against the real
   rule by src/spec/spec.test.ts (and by the generator, which refuses to write an example that isn't true), so an
   example can't drift from the code: change a rule and its example fails until it's brought up to date.
   The examples use the same goals as src/domain/rules.test.ts (src/spec/examples.ts). */
import { daysSinceIn, weekIn } from './zones';
import { homeFor, waiting, type HomeFacts } from '../domain/home';
import { acceptedReason, acceptNote, MIN_ACCEPT_REASON, needsDecision } from '../domain/decide';
import { DIRECTORY_PAGE, movedTo, personLine, teamSummary } from '../domain/directory';
import { beforeStartLine, currentCycle, cycleDates, cycleState, placeLine, scopeToCycle, wrapUpOpenOn } from '../domain/cycle';
import { carryCopy, carryKind } from '../domain/carry';
import { everydayLevel, hasLevels, isEveryday, isTop, levelIds, levelName, levelRank, levelsOf } from '../domain/levels';
import { dayOneRows } from '../app/reads';
import { arrived, DAY_ONE_DAYS, gettingStarted, invitedTo, inviteLink, NEW_WORKSPACE_DAYS, stepCounter } from '../domain/dayOne';
import { arrivalIntro, arrivalLine, readInvitation } from '../domain/arrival';
import { describe, MIN_CORRECT_REASON, planChanges, planChangesInChunks, postCheckIn, type ChangeInput, type Rec } from '../domain/changeset';
import { splitTables } from '../domain/splitFile';
import { CHECK_KINDS, MUST_KINDS, near, whereText } from '../domain/problemLevels';
import { readHeader, readLine, readTables } from '../domain/sheets';
import { leaveOut } from '../domain/leaveOut';
import { planQuestion } from '../domain/goal';
import { checkInLevels, emptyDraft, evaluate, MIN_PATH, MIN_REASON, NO_REASON, parseNumber, previousFor, stepState, unanswered, valueProblem, type Answers, type Draft } from '../domain/checkin';
import { notStarted } from '../domain/plan';
import { cycleWeek, readWeekCode, weekCode, weekSays, yearWeek } from '../domain/weeks';
import { planSays, readWeek, spanSays, weekChoices } from '../domain/weekChoices';
import { currentWeek, daysSince, firstWeekFrom, resultWeek, isCount, isShare, NOT_A_COUNT, planAt, planAsOf, PROJECTION_WEEKS, projection, projectionFor, shapeProgress, valueSeries } from '../domain/plan';
import { amount, byWeekWords, goalScorecard, likelihood } from '../domain/scorecard';
import { directionLabel, fmt, gapText } from '../domain/format';
import { assessMetric, assessMilestone, assessRange, goalStatus, projects, RANK, worst } from '../domain/status';
import { MAX_WORKSPACE_NAME, MIN_NAME, nameLength, nameProblem, RULES, TREND_SPAN } from '../domain/thresholds';
import { cycleStanding, importName, leaveWorkspace, keptText, pastImports, undoPreview } from '../domain/removal';
import { applyCommit } from '../data/store';
import { acceptRisk, reviewCall, teamPeople } from '../domain/actions';
import { adminsLine, cycleLine, LEAD_FROM, NEEDS_SHOWN, ONLY_ADMIN_FROM, workspaceName, workspaceNeeds, yearLine } from '../domain/workspaceAttention';
import { FAR_OUTSIDE, FAR_RATIO, farOutside, groupDigits, placesToKeep, precisionProblem, sameAsWritten, typedDecimals } from '../domain/numbers';
import { buildWorkspace, ownerToAdd, setupDefaults } from '../domain/importer';
import { emptyText, fieldTable, FILL_SHEETS, LEVEL_WORDS, requiredLine, requiredText, requiredWord, specOf, TYPE_WORDS, wordsAndAlso } from '../domain/columns';
import { AVATAR_HUES, mergePeople } from '../domain/people';
import { gapTrend, goalTrend } from '../domain/trend';
import { flagsFor, needsAttention, attentionFor, attentionGroup } from '../domain/attention';
import { ATTENTION, ATTENTION_FLAGS, DECIDED, FLAG, HANDLED_LINE, LABEL, shortWord, STATUS_ORDER } from '../domain/vocabulary';
import type { Ask, DisplayStatus, Goal, MetricGoal, Snapshot } from '../domain/types';
import { criticalPath, findOnMap, rollup, rollupText, shownOnMap, troubled } from '../domain/map';
import { rebase, REBASE_WEEKS, rebaseOffer } from '../domain/checkin';
import { parentSuggestions, PARENT_SUGGESTIONS, planNote, startLevel } from '../domain/newGoal';
import { activeReadBack, leftAsUsual, readBack, reviewsJoining, underWay, type ReadBackContext } from '../domain/readBack';
import { judged } from '../domain/proposed';
import { goalCounts, measureUnsaid, withProposedCount } from '../domain/proposedSummary';
import { mayActivate, NOTHING_TO_CHECK_IN, proposalAsks, readyToActivate } from '../domain/proposedActions';
import { proposedMustFix } from '../domain/goalEntry';
import { mayChangeGoal } from '../domain/goalRights';
import { blankGoal, pastStage, stagesDoneAtSetUp, type GoalDraft } from '../domain/goal';
import { CHECK_IDS, fieldNeed, formNeed, goalChecks, goalMustFix, planGoal, stepSays, stepState as goalStepState, stepFields, unanswered as goalUnanswered } from '../domain/goalEntry';
import { numberAsTyped } from '../domain/numbers';
import { fieldNeedOf } from '../domain/columns';
import { commentReach, goalHistory, primaryAction, standingAction, stepsAndAsks, whyPointer } from '../domain/goalPage';
import type { ActionContext } from '../domain/actions';
import MODULE_SPEC from 'virtual:faro-modules/spec';
import { backTo, litItem, menuGroups, menuRows, pageName, phoneTabs, type PlaceNames } from '../domain/navigation';
import { movedGoals, ownGroup, scopesFor } from '../domain/goalsPage';
import { watchedGoals } from '../domain/review';
import { countLine, filterLine, findAll, keyOf, nearMiss, noneFound, search, suggest, textMatches } from '../domain/find';
import { goalRows, personRows, teamRows } from '../app/reads';
import { CHECK_IN_MOMENT } from './conformance';
import { checkIn, CYCLE, metric, MILESTONE, n, RANGE } from './examples';
import { goalResult } from '../domain/story';
import { quarterResults } from '../domain/year';
import { weekProgress } from '../domain/progress';

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
/** The field table of every sheet that loads back, as the rule page shows it. */
function fieldTableMarkdown(): string {
  const cellOf = (v: string) => v.replace(/\|/g, '\\|');
  return FILL_SHEETS.map((k) => {
    const t = fieldTable(k);
    const line = k === 'plan' ? '' : `. A new row needs: ${requiredLine(k)}`;
    return [
      `**${specOf(k).name}**${line}`, '',
      '| Column | A new row | Format | Example | If it’s left empty |', '|---|---|---|---|---|',
      ...t.filter((c) => c.required != null).map((c) => `| ${c.header} | ${cellOf(requiredText(c, t))} | ${cellOf(c.format)} | ${cellOf(c.example)} | ${cellOf(emptyText(c))} |`),
      '', `Worked out: ${t.filter((c) => c.required == null).map((c) => c.header).join(', ') || 'none'}.`,
    ].join('\n');
  }).join('\n\n');
}
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
  changes: [{ id: 'c', at: DAY_MADE, actorId: 'ana', goalId: null, entity: 'workspace', entityId: 'w', action: 'imported', summary: 'Created “Field Operations” with 2 people', diffs: [] }],
});

/* ---------- the demo workspace on Wednesday 11 November, for the directory's examples ---------- */
const DIR_NOW = new Date('2026-11-11T12:00:00Z');
let dir: Snapshot | null = null;
const dirWs = (): Snapshot => dir!;
/** People's ask, as its address has it, through the one search (finding things, rule 7): a page of 50, a page past the end the last. */
const dirAsk = (a: { q?: string; teamId?: string; admins?: boolean; page?: number }) => {
  const filters = { ...(a.teamId ? { team: a.teamId } : {}), ...(a.admins ? { admins: '1' } : {}) };
  const rows = personRows(dirWs());
  const pages = Math.max(1, Math.ceil(search(rows, { q: a.q ?? '', filters, size: DIRECTORY_PAGE }).total / DIRECTORY_PAGE));
  const page = Math.min(Math.max(1, a.page ?? 1), pages);
  const r = search(rows, { q: a.q ?? '', filters, size: DIRECTORY_PAGE, after: String((page - 1) * DIRECTORY_PAGE) });
  return { total: r.total, page, pages, from: r.rows.length ? (page - 1) * DIRECTORY_PAGE + 1 : 0, to: (page - 1) * DIRECTORY_PAGE + r.rows.length, rows: r.rows };
};

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
function changeInput(actor: string, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}): ChangeInput {
  const s = demo!;
  const cycle = s.cycles[0]!;
  const today = new Date(CHECK_IN_MOMENT);
  let k = 0;
  return { tables, snapshot: s, cycle, week: currentWeek(cycle, today), actor: s.people.find((p) => p.id === actor)!, now: today.toISOString(), newId: (p) => `${p}_x${++k}`, via: 'spreadsheet', ...extra };
}
function change(actor: string, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}) {
  return planChanges(changeInput(actor, tables, extra));
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
/** What a module's spec.ts uses for its worked examples: the demo workspace (built before any example runs), an action
    in it by one of its people, one of its goals, and what a commit says. */
export const exampleKit = { demo: () => demo!, asPerson, goalIn, summaryOf: (c: { changes: { summary: string }[] } | null | string) => summaryOf(c) };
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
**Weeks.** A cycle has a start date (week 0's Monday) and a number of weeks. Days are counted by calendar date in UTC.

**The home zone is a parameter** ([R3](../../requirements/internal/r3-time-zones.md)). Faro counts every day and week here in UTC. The internal app counts them in the workspace's home zone: read the moment on the home zone's clock, then count exactly as below (\`weekIn\` and \`daysSinceIn\` in \`src/spec/zones.ts\`). A week turns at midnight on Sunday there, a check-in posted at 23:30 on Sunday there counts for that Sunday's week, and a day is the home zone's date, across a clock change too. With the home zone UTC nothing changes. [zone.csv](../../conformance/zone.csv) scores it.

**Counting.** The week on a day is \`floor(days since the start / 7)\`: 0 before the start and in the first seven days, never more than the cycle's last week. Week *w*'s checkpoint date is the start plus 7·*w* days. Checkpoints run from week 0 to the last week; week 0 is set-up, and the first check-in is due in week 1.

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
      { given: 'The same cycle with a home zone (R3). A check-in posted at 2026-09-14T03:30Z: its week by UTC, and with the home zone America/New_York (where it is 23:30 on Sunday). Days from it to 2026-09-28T04:30Z (00:30 on Monday there), the same two ways.', then: 'week 1, week 0; 14 days, 15 days', run: () => { const p = '2026-09-14T03:30:00Z', d = at('2026-09-28T04:30:00Z'); return `week ${currentWeek(CYCLE, at(p))}, week ${weekIn(CYCLE, at(p), 'America/New_York')}; ${daysSince(p, d)} days, ${daysSinceIn(p, d, 'America/New_York')} days`; } },
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

**A number to keep in range** (\`range\`): a limit, a side (\`atMost\`, \`atLeast\` or \`between\`) and a warning margin; \`between\` also has a *lower* bound, below the limit, which is then the upper bound (“between 99.5% and 99.95%”). A value is *out* when it is strictly past a bound on the wrong side (\`atMost\`: > *limit*; \`atLeast\`: < *limit*; \`between\`: > *limit* or < *lower*; a value at a bound is not out) and *near* when strictly within the margin of a bound (\`atMost\`: > *limit* − *margin*; \`atLeast\`: < *limit* + *margin*; \`between\`: > *limit* − *margin* or < *lower* + *margin*). Where the words or a gap name one bound of a \`between\` range, it is the nearer one to the number: the lower below the middle, (*lower* + *limit*) / 2, else the upper. *previous* is the number of the latest check-in with a number for an earlier week (by week, not by when it was posted).

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
4. Else if the cycle's last day is past ([a year's end](year-end.md)): *latest*'s call, or **No check-in yet** if there is none. After the last day no goal becomes No recent update for want of a check-in.
5. Else if the days without an update are under ${RULES.staleDays}: *latest*'s call (the owner's), or **No check-in yet** if there is none.
6. Else: **No recent update** (\`stale\`).

*Days without an update* are the days since *latest* was posted; with no check-in, since the goal began: the latest of the cycle's start, the day it was added, and, for a number goal whose plan starts later (\`fromWeek\` > 0), that week's day (the cycle's start + 7 × \`fromWeek\` days; [years and weeks](years-and-weeks.md): a plan not yet started is not due).

The owner's call is official, even where the numbers disagree. A call is *greener* when it ranks better than what the rules calculated when it was posted: the check-in's stored \`calculated\`, never a recalculation (the two can differ, for example when a stage becomes late after posting). Ranks: ${Object.entries(RANK).map(([k, v]) => `\`${k}\` ${v}`).join(', ')}; lower is better.

**A group's status** (\`worst\`): with no goals, \`none\`; every goal done, \`done\`; otherwise the worst rank present, where rank 1 is \`on\`, and a tie in rank is broken by the order ${STATUS_ORDER.map((k) => `\`${k}\``).join(', ')} (so a group with a goal that has no recent update and none worse says \`stale\`, never \`risk\`).`,
    examples: [
      { given: 'A straight plan from 30 to 75 over 13 weeks (plan 43.846 in week 4). Week 4 numbers at 95%, 94%, 80% and 79% of the planned change.', then: 'on, risk, risk, off', run: () => [0.95, 0.94, 0.8, 0.79].map((r) => assessMetric(g3075, 13, 4, 30 + (planAt(g3075.plan, 4, 13) - 30) * r, []).calc).join(', ') },
      { given: 'The same goal: 58 in week 4 (ratio 2.0) and 40 (ratio 0.72).', then: '58: on, well ahead; 40: off, behind', run: () => { const a = assessMetric(g3075, 13, 4, 58, []), b = assessMetric(g3075, 13, 4, 40, []); return `58: ${a.calc}${a.ahead ? ', well ahead' : ''}; 40: ${b.calc}${b.behind ? ', behind' : ''}`; } },
      { given: 'Lower is better: back-loaded from 34 to 18 over 13 weeks; 29.4 and 35 in week 6.', then: '29.4: risk; 35: off', run: () => { const g = metric(34, 18, 'back'); return `29.4: ${assessMetric(g, 13, 6, 29.4, []).calc}; 35: ${assessMetric(g, 13, 6, 35, []).calc}`; } },
      { given: 'The 30→75 goal, its last check-in in week 11 (Monday 23 November 2026), in the 13-week cycle whose last day is Sunday 13 December: seen on the last day (20 days without an update), then the day after (21 days, boundary).', then: 'stale, on', run: () => ['2026-12-13T12:00:00Z', '2026-12-14T12:00:00Z'].map((d) => goalStatus(g3075, CYCLE, [ci('m', 11, 60)], new Date(d)).status).join(', ') },
      { given: 'Week 0 with 30, and week 3 with no number.', then: 'planned, none', run: () => `${assessMetric(g3075, 13, 0, 30, []).calc}, ${assessMetric(g3075, 13, 3, null, []).calc}` },
      { given: 'A stepped plan from 10 to 40 in week 2 (before its first step): 10, then 8.', then: 'on, risk', run: () => { const g = metric(10, 40, 'stepped'); return `${assessMetric(g, 13, 2, 10, []).calc}, ${assessMetric(g, 13, 2, 8, []).calc}`; } },
      { given: 'A cost in USD with 2 decimals, 0.42 down to 0.30 over 13 weeks (week 1 plan 0.4108): 0.41, 0.42 and 0.40 in week 1.', then: '0.41: on; 0.42: off, behind; 0.40: on, well ahead', run: () => { const g = { ...metric(0.42, 0.3), unit: 'USD', decimals: 2 }; return [0.41, 0.42, 0.4].map((v) => { const a = assessMetric(g, 13, 1, v, []); return `${v.toFixed(2)}: ${a.calc}${a.behind ? ', behind' : ''}${a.ahead ? ', well ahead' : ''}`; }).join('; '); } },
      { given: 'A range, at most 12.0% with a 1-point margin: 10.5 after 10.6; 11.2 after 10.6; 12.6 after 11.2; 10.4 after 12.6; 12.4 after 12.6.', then: 'on, risk, risk, risk, off', run: () => [[10.5, 10.6], [11.2, 10.6], [12.6, 11.2], [10.4, 12.6], [12.4, 12.6]].map(([v, p]) => assessRange(RANGE, 5, v!, p!).calc).join(', ') },
      { given: 'A range, at least 99 with a 0.5 margin: 99.8 after 99.9; 99.3 after 99.9; 98 after 98.5.', then: 'on, risk, off', run: () => { const g = { ...RANGE, range: { bound: 'atLeast' as const, limit: 99, margin: 0.5 } }; return [[99.8, 99.9], [99.3, 99.9], [98, 98.5]].map(([v, p]) => assessRange(g, 2, v!, p!).calc).join(', '); } },
      { given: 'A range between 99.5 and 99.95 with a 0.1 margin: 99.7 after 99.7; 99.9 after 99.7 (near the upper); 99.55 after 99.7 (near the lower); 99.95 after 99.7 (at the upper); 99.96 after 99.7; 99.4 after 99.3.', then: 'on, risk, risk, risk, risk, off', run: () => { const g = { ...RANGE, unit: '%', decimals: 2, range: { bound: 'between' as const, lower: 99.5, limit: 99.95, margin: 0.1 } }; return [[99.7, 99.7], [99.9, 99.7], [99.55, 99.7], [99.95, 99.7], [99.96, 99.7], [99.4, 99.3]].map(([v, p]) => assessRange(g, 2, v!, p!).calc).join(', '); } },
      { given: 'The same range, said in words, and its gap at 99.96 and at 99.4 (each against the nearer bound).', then: 'between 99.50% and 99.95% / Over the 99.95% limit / Under the 99.50% limit', run: () => { const g = { ...RANGE, unit: '%', decimals: 2, range: { bound: 'between' as const, lower: 99.5, limit: 99.95, margin: 0.1 } }; return [directionLabel(g), ...[99.96, 99.4].map((v) => gapText(g, assessRange(g, 2, v, 99.7)).short)].join(' / '); } },
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
    code: [{ file: 'src/domain/checkin.ts', names: ['emptyDraft', 'parseNumber', 'valueProblem', 'previousFor', 'earlierThisWeek', 'lastValueOf', 'numberCheck', 'checkInLevels', 'unanswered', 'stepState', 'answeredDiffs', 'unchangedStory', 'evaluate', 'toCheckIn', 'MISSING_TEXT', 'CAUSES_BEHIND', 'CAUSES_AHEAD'] }],
    tests: ['src/domain/rules.test.ts#check-in rules', 'src/domain/rules.test.ts#typed numbers', 'src/domain/postCheckIn.test.ts#what a new number is compared with (rule 5)', 'src/domain/postCheckIn.test.ts#the levels in a check-in (rules 2 and 3)', 'src/domain/rules.test.ts#what a check-in still needs, as stable codes', 'evals/scenarios.eval.ts'],
    reqs: ['REASON-BEHIND', 'REASON-AHEAD', 'PATH-TO-GREEN', 'GREENER', 'OWNER-CALL', 'CHECKIN-STATUS-VS-PLAN', 'OTHER-CAUSE', 'FIRST-CHECKIN', 'HONEST-CHECKIN'],
    body: `
A check-in is one week's report on one goal, by its owner only (R1; an admin may bring others' past weeks in by loading a workbook, or correct one that exists in Data's tables; neither adds this week's new check-in): the number (or each stage's state), the owner's call, and the words the numbers ask for. Every way in (the check-in screen, the bulk grid, a spreadsheet, the AI assistant) uses these rules.

**Reading a number** (\`parseNumber\`): spaces and a trailing unit or \`%\` are ignored; a decimal comma with one or two digits (\`29,4\`) is a decimal point; commas grouping thousands (\`1,250\`, \`1,250.5\`) are dropped. Anything else that isn't plain digits with one optional point and sign (hex, exponents, words, two points) is not a number; nor is anything 10¹² or more.

**Impossible and surprising numbers** (\`valueProblem\`): letters are refused with the one message of [numbers and names](numbers-and-names.md); a number with more decimal places than the goal keeps is refused (never rounded, the same rule); below zero is refused for a percentage or a time or money unit, and for a count (see [the projection](projection.md)); over 100% is refused for a share (see [the projection](projection.md)) and only questioned otherwise; a number goal's value more than ${FAR_OUTSIDE} times the plan's width beyond either end of its plan is questioned ("That's far outside this goal's plan (30 to 75%). Is 400 right?"); a count's value past its target (beyond it in the better direction) is questioned ("That's past the target of 40 pairs. Is 41 right?"); a number more than 3 times or less than a third of last week's is questioned ("Last week was 29.4. Is 294 right?"). Questions never refuse.

**What a new number is compared with** (\`previousFor\`, for the goal's check-ins and the week): the newest check-in of the latest week before it, and the newest number among the weeks before it. A check-in of the same week is never "last week": a second check-in in week 46 is compared with week 45, as is the goal page's "vs last week" after it. \`earlierThisWeek\` is the newest of the week's own, for a second check-in to name.

**One number check** (\`numberCheck\`): every way a number is typed (the check-in, the bulk grid, a spreadsheet) asks \`valueProblem\` with the goal's latest number before the week (\`lastValueOf\`: \`previousFor\`'s number), and a spreadsheet's error for an unusable number is \`valueProblem\`'s own words.

**The levels: Must fix and Check** (\`checkInLevels\`, \`unanswered\`, \`stepState\`). A number that can't be used is a *Must fix*: the check-in can't go on until it is fixed. A usable number that looks wrong is a *Check*: a question that must be answered before the check-in posts. Only the first that applies is asked, in \`valueProblem\`'s order: over 100% where the goal isn't a share, far outside its plan, past a count's target, then more than 3 times or under a third of the last number before this week ("Week 45 was 1.8%. Is 18.0% right?", with "Yes, 18.0% is right" and "Change the number"). Failing those, a number goal not yet at its target whose number is the same as last week's asks "The same as week 45: 80%. Did you measure it again this week?" ("Yes, measured again" or "No new number this week"); a number kept in a range never asks it. A Check is answered for the value it is about (its *key*): change the number and it asks again. With something to fix, the button says "1 thing to fix above: This week's number."; with a question open, "Answer the question above first.". A check-in posted from a screen is refused until its questions are answered, and each answer is kept in History as an *Asked* difference (the question, then the answer). The table asks the same questions under its rows; a spreadsheet and the AI tools keep today's hint.

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
      { given: 'Check-ins of 1.9 in week 44, 1.8 in week 45, then 18 and 1.9 in week 46: what week 46 is compared with; then the same with week 45 posting no number.', then: 'week 45, 1.8 / week 44, 1.9', run: () => { const own = [ci('m', 44, 1.9), ci('m', 45, 1.8), ci('m', 46, 18), ci('m', 46, 1.9)]; const quiet = [ci('m', 44, 1.9), { ...ci('m', 45, 0), value: null }]; return [own, quiet].map((o) => { const p = previousFor(o, 46).number; return `week ${p?.week}, ${p?.value}`; }).join(' / '); } },
      { given: 'A range goal at most 2.0% (1 decimal), 1.8% in week 45: 18 typed in week 46; then 18 with that question answered; then 19.', then: 'Week 45 was 1.8%. Is 18.0% right? / no question / Week 45 was 1.8%. Is 19.0% right?', run: () => { const flaky = { ...g3075, kind: 'range', unit: '%', decimals: 1, range: { bound: 'atMost', limit: 2, warn: 0.4 } } as unknown as Goal; const own = [{ ...ci('m', 45, 1.8) }]; const ask = (v: string, a?: Answers) => unanswered(checkInLevels(flaky, 46, D({ value: v }), own).checks, a)[0]?.question ?? 'no question'; return [ask('18'), ask('18', { 'far-from-last': '18' }), ask('19', { 'far-from-last': '18' })].join(' / '); } },
      { given: 'The 30→75 goal, 40 in week 3: 40 typed in week 4; and the button with that question open.', then: 'The same as week 3: 40%. Did you measure it again this week? / Answer the question above first.', run: () => { const l = checkInLevels(g3075, 4, D({ value: '40' }), [ci('m', 3, 40)]); return `${l.checks[0]?.question} / ${stepState(l.mustFix, l.checks).says}`; } },
      { given: '40 in week 4, called on track, with a reason for being behind but none for the greener call.', then: 'greener-why', run: () => evaluate(g3075, CYCLE, 4, D({ value: '40', status: 'on', cause: 'slower', why: 'Rollout paused for a week' }), []).codes.join(', ') },
    ],
  },

  /* ---------- numbers and names ---------- */
  {
    id: 'numbers-and-names',
    title: 'Numbers and names',
    summary: 'How a typed number is kept and shown, which numbers are questioned, and how two goals or two people with the same name are told apart.',
    code: [
      { file: 'src/domain/numbers.ts', names: ['typedDecimals', 'precisionProblem', 'placesToKeep', 'exampleNumber', 'notNumberText', 'groupDigits', 'fixed', 'farOutside', 'usuallyPositive', 'FAR_RATIO'] },
      { file: 'src/domain/goal.ts', names: ['planQuestion'] },
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

**Questioned, never refused.** In a check-in, see [the check-in](check-in.md). Setting a goal up, the questions are [goal entry](goal-entry.md)'s rule 3 (\`goalChecks\`), the same at every door: below zero for a percentage, time or money; over 100%; a target ${FAR_RATIO} times the start or more, or a ${FAR_RATIO}th of it or less (both non-zero, the same sign); a billion or more; each that applies, not only the first. A goal already set up that way isn't asked again.

**Plan changes confirmed, never silent** (\`planQuestion\`). The same check as a check-in's, applied when an existing number goal's plan changes, in the app's goal edit, the spreadsheet import, the data tables and the AI tools (one rule, in the change engine and the edit form). Two things are asked, in this order, and the change saves only once someone says yes:
- **Which way is better flips:** the new target is on the other side of the start (a 14 → 3 min goal given a target of 999). It says so: “This makes higher better: the target (999 min) is now above the start (14 min). It was 14 min to 3 min, lower is better.” The yes is “Yes, make higher better”.
- **Far outside the old plan:** a new start, target or hand-set week's number more than ${FAR_OUTSIDE} times the old plan's width beyond either end (\`farOutside\`): “The target of 400% is far outside the plan it replaces (30% to 75%). Status, progress and the forecast will all be judged against it.”

The app asks under the target, in the Check block, as goal entry's rule 3 (\`direction\`, \`far-from-plan\`); Import and Data list the questions above What will change with one yes button; the AI tools refuse with the question until called again with \`confirm: true\`. A plan already stored isn't asked about again.

**Names.** A workspace's, a goal's or an outcome's name has at least ${MIN_NAME} characters (\`nameProblem\`). Two goals may have the same title (compared without case or outer spaces): making one warns (\`sameTitleNote\`), and wherever both could be on screen each shows its key, or else its team, beside the title (\`duplicateTitles\`, \`goalTell\`). An import row with no key whose title another goal has is that goal again unless it names another team; then it's a new goal, noted. Two people may have the same name: the email is who someone is. Adding or renaming one says so (\`sameNameNote\`); beside the name goes their team, else their job title, else their email, whichever tells them apart (\`personTell\`). Each avatar's colour comes from the person's ID, and people with the same initials each get a colour none of the others has while there are colours to go round (\`avatarHues\`, ${AVATAR_HUES} colours).`,
    examples: [
      { given: 'Typed "12.5", "12.50", "1,250", "29,4", "3.25 days".', then: '1, 1, 0, 1, 2', run: () => ['12.5', '12.50', '1,250', '29,4', '3.25 days'].map((x) => String(typedDecimals(x))).join(', ') },
      { given: '12.5 in a goal of whole numbers.', then: '12.5 has 1 decimal place, but this goal keeps whole numbers, so it would show as 13. Type 13, or set the goal’s Decimals to 1.', run: () => precisionProblem('12.5', 12.5, 0) ?? 'fine' },
      { given: 'The places a check-in offers to keep for 5.5, 5.25 and 1.23456 on a whole-number goal, and for 5.', then: '1, 2, 3, none', run: () => ['5.5', '5.25', '1.23456', '5'].map((x) => String(placesToKeep(x, Number(x), 0) ?? 'none')).join(', ') },
      { given: '1250000, -12000 and 1250.5 shown.', then: '1,250,000, -12,000, 1,250.5', run: () => ['1250000', '-12000', '1250.5'].map(groupDigits).join(', ') },
      { given: 'A start of 10 signups and a target of 5,000.', then: 'The target (5,000 signups) is over 100 times where it starts (10 signups). Is that right?', run: () => goalChecks({ ...blankGoal('cicd', 'tunde', ''), title: 'Signups', unit: 'signups', start: '10', target: '5000' }, { week: 45, cycleWeeks: 53, existing: null, door: 'form' })[0]?.question ?? 'fine' },
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

\`attentionGroup(a)\`: \`needs\` when the goal needs attention; else \`handled\` when it is being handled; else none. (A goal being handled is always behind, so always flagged: the list is every goal with a flag other than \`due\`.) Wherever goals that need attention are listed (the Needs attention tab and filter on Goals in every layout, the list bar's switch on the Map, Home, Watching, and the AI assistant's \`find_goals\` with \`needs_attention\`), the \`needs\` group comes first and the \`handled\` group below it, each saying what is in hand. Nothing is hidden: a filter on the list (a team, an owner) keeps both groups. A **count** of goals that need attention (the Needs attention tab's count, Home's) counts the \`needs\` group only, and says so where both are listed. Under the words *${ATTENTION.handled.label}*, wherever a group of them is shown, one line says what it means: “${HANDLED_LINE}”`,
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

**Where the numbers come from.** A number to move and a range are judged by \`assessPosted\` in week *w* (the latest check-in up to week *w*, by week then posting, in its own week); dated stages by the status rule in week *w*. *better* is +1 when higher is better and −1 when lower is: for a number to move, +1 when the **current** plan's target ≥ its start (so the direction, the target, the due week and the likelihood floor come from the goal's current plan, while *plan*, *actual* and the projection come from \`assessPosted\`, with the plan as of the latest check-in's week); for a range, +1 for \`atLeast\`, −1 for \`atMost\`; for \`between\`, the side of the bound nearer the latest number (by distance, the upper when the two are as near), whose limit is the one *Vs the limit* and *Room to the limit* measure against. Two cells weigh both bounds of a \`between\` range: *Vs last week* is better when the move gains **room** (\`rangeRoom\`: the smaller of the distances to the two bounds), worse when it loses it, and reads \`up\` or \`down\`, \`flat\`, when the room is the same; *Will it stay within?* is judged against the bound nearer the **projected** number: the one it is likelier to cross, so the worse of the two answers. A range goal's trend is \`gapTrend\` on its room the same way.

**Tones.** \`plan\`: ahead \`good\`, behind \`bad\`, on plan or no number \`flat\`. \`since\`: better \`good\`, worse \`bad\`, otherwise \`flat\`. \`target\`: reached \`good\`, else \`flat\`. \`hit\`: Likely \`good\`, Possible \`flat\`, Unlikely and Very unlikely \`bad\`, Can’t say and Too early \`flat\`. \`limit\`: outside \`bad\`, near \`flat\`, inside \`good\`. \`room\`: over \`bad\`; near as [the status](status.md) says it (strictly within the margin), or at the limit, \`flat\`; else \`good\`. So \`limit\` and \`room\` always agree: a number exactly the margin inside its limit is not near, and both cells say so. \`done\`: at least as many done as are due \`good\`, else \`flat\`. \`late\`: any behind \`bad\`, none \`good\`. \`next\`: expected after its due week \`bad\`, else \`flat\`; All done \`good\`. A margin of 0 counts as none for the likelihood floor. \`likelihood\` is set only on a \`hit\` cell that says a likelihood. Every cell that says "No value yet" is \`flat\`.

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

**Since** (\`since\`, both kinds). The goal's check-ins up to week *w*, by week then posting; *latest* the last; *before* the newest number among the weeks before *latest*'s week (\`previousFor\`, [what a check-in must say](check-in.md)): another check-in in the same week never counts, so a second check-in in week 46 is compared with week 45, not with the first one.

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

**A quarter's result** (\`quarterResult\` in \`src/domain/year.ts\`) compares the number with the plan at the quarter's end as both are shown, at the goal's decimals: 0.68 against a plan shown as 0.68 is met, never "0.00 short". **A quarter that ended before the goal was set up is never judged** (\`bornWeek\`: the cycle's week of the goal's \`createdAt\`, 0 before the cycle began): a quarter whose last week is at or before it has nothing due ("Q1: before the goal was set up in week 46"), whatever week its baseline is from and whatever numbers were loaded for those weeks, so it is in no count of Met or Not met and raises no "Last quarter not met".`,
    examples: [
      { given: 'A target of 75, higher is better, projected 80 (range 78–82, d = −2.5); 76 (72–80, d = −0.25); 72 (70–74, d = 1.5); 60 (58–62, d = 7.5).', then: 'likely, possible, unlikely, very-unlikely', run: () => [[80, 78, 82], [76, 72, 80], [72, 70, 74], [60, 58, 62]].map(([value, low, high]) => likelihood(75, { value: value!, low: low!, high: high! }, 1)).join(', ') },
      { given: 'A target of 18, lower is better, projected 19 (range 18–20): d = (18 − 19) × −1 / 1 = 1.', then: 'possible', run: () => likelihood(18, { value: 19, low: 18, high: 20 }, -1) },
      { given: 'The 30→75 goal with 36, 39, 42, 45 in weeks 1–4, seen in week 4.', then: 'plan: 1 pt ahead of plan [good] (plan 44%); since: 3 pts better [good] (was 42% in week 3); target: 30 pts to go [flat] (target 75%); hit: Very unlikely [bad] (likely 72% by cycle end)', run: () => goalScorecard(g3075, CYCLE, [36, 39, 42, 45].map((v, i) => ci('m', i + 1, v)), 4, false).cells.map((c) => `${c.key}: ${c.value} [${c.tone}] (${c.sub})`).join('; ') },
      { given: 'A goal year of 53 weeks; a range goal (at most 12.0%) and a 30→75 goal with its baseline from week 23, both set up on 12 November 2026 (week 46), with nothing reported; seen in week 46.', then: 'range: none, none, none, open; metric: none, none, none, open', run: () => { const y = { id: 'y', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 }; const born = { createdAt: '2026-11-12T10:00:00Z' }; return `range: ${quarterResults({ ...RANGE, ...born }, y, [], 46).map((q) => q.kind).join(', ')}; metric: ${quarterResults({ ...g3075, ...born, plan: { ...g3075.plan, fromWeek: 23 } }, y, [], 46).map((q) => q.kind).join(', ')}`; } },
      { given: 'Short or over: higher is better, then lower is better.', then: 'short, over', run: () => [shortWord(1), shortWord(-1)].join(', ') },
      { given: 'A 60→30 goal (lower is better) with 50, 48, 46, 45 in weeks 1–4, seen in week 4: To target.', then: '15 pts over [flat] (target 30%)', run: () => { const c = goalScorecard(metric(60, 30), CYCLE, [50, 48, 46, 45].map((v, i) => ci('m', i + 1, v)), 4, false).cells.find((x) => x.key === 'target')!; return `${c.value} [${c.tone}] (${c.sub})`; } },
      { given: 'Values and amounts: 1 and 1.0 in hours (1 and 0 decimals), 1 in ms, 1 in pts, 1250.5 in USD (1 decimal), 0.4 and 1 in %; -0.3 in min (0 decimals).', then: 'fmt: 1 hour, 1.0 hours, 1 ms, 1 pts, 1,250.5 USD, 0.4%, -0 min; amount: 1 hour, 1.0 hour, 1 ms, 1 pt, 1,250.5 USD, 0.4 pts, 1 pt', run: () => { const u = (unit: string, decimals = 0) => ({ unit, decimals }); return `fmt: ${[fmt(1, u('hours')), fmt(1, u('hours', 1)), fmt(1, u('ms')), fmt(1, u('pts')), fmt(1250.5, u('USD', 1)), fmt(0.4, u('%', 1)), fmt(-0.3, u('min'))].join(', ')}; amount: ${[amount(1, u('hours')), amount(-1, u('hours', 1)), amount(1, u('ms')), amount(1, u('pts')), amount(1250.5, u('USD', 1)), amount(0.4, u('%', 1)), amount(1, u('%'))].join(', ')}`; } },
      { given: 'By when, in a 53-week year and a 13-week cycle: due week 53; due week 13; due week 40.', then: 'by year end, by cycle end, by week 40', run: () => [byWeekWords({ ...CYCLE, weeks: 53 }, 53), byWeekWords(CYCLE, 13), byWeekWords({ ...CYCLE, weeks: 53 }, 40)].join(', ') },
      { given: 'The 30→75 goal with no check-in, seen in week 2.', then: 'plan: No value yet (plan 37%); since: No check-in yet (nothing to compare); target: No value yet (target 75%); hit: Too early to say (needs three weeks of numbers)', run: () => goalScorecard(g3075, CYCLE, [], 2, false).cells.map((c) => `${c.key}: ${c.value} (${c.sub})`).join('; ') },
      { given: 'The 30→75 goal: 36 in week 1, then week 2 with no number, seen in week 3 (the plan is week 2’s: the latest check-in’s week, though it has no number). Then 36 and 36 in weeks 1 and 2.', then: 'plan: No value yet (plan 37%); since: No number this time (no number to compare); then since: No change (was 36% in week 1), plan: 1 pt behind plan (plan 37% in week 2)', run: () => { const a = goalScorecard(g3075, CYCLE, [ci('m', 1, 36), ci('m', 2, null)], 3, false).cells, b = goalScorecard(g3075, CYCLE, [ci('m', 1, 36), ci('m', 2, 36)], 3, false).cells; const c = (x: typeof a, k: string) => x.find((y) => y.key === k)!; return `plan: ${c(a, 'plan').value} (${c(a, 'plan').sub}); since: ${c(a, 'since').value} (${c(a, 'since').sub}); then since: ${c(b, 'since').value} (${c(b, 'since').sub}), plan: ${c(b, 'plan').value} (${c(b, 'plan').sub})`; } },
      { given: 'A range, at most 12.0% with a 1-point margin, seen in week 4: 10.5, 11.0, 12.6 in weeks 1–3, then 12.4 in week 4.', then: 'limit: Outside it [bad] (must stay at most 12.0%); since: 0.2 pts better [good] (was 12.6% in week 3); room: 0.4 pts over [bad] (warning within 1.0 pt); hit: Back within by the end? Very unlikely [bad] (likely 18.6% by cycle end)', run: () => goalScorecard(RANGE, CYCLE, [10.5, 11, 12.6, 12.4].map((v, i) => ci('r', i + 1, v)), 4, false).cells.map((c) => `${c.key}: ${c.key === 'hit' ? c.label + ' ' : ''}${c.value} [${c.tone}] (${c.sub})`).join('; ') },
      { given: 'The same range: 11.6 in week 1 (near), then 12.0 (at the limit), each seen in its week.', then: 'Inside, near it, 0.4 pts of room [flat]; Inside, near it, None: at the limit [flat]', run: () => [[11.6], [11.6, 12]].map((vs) => { const cs = goalScorecard(RANGE, CYCLE, vs.map((v, i) => ci('r', i + 1, v)), vs.length, false).cells; const r = cs.find((c) => c.key === 'room')!; return `${cs[0]!.value}, ${r.value} [${r.tone}]`; }).join('; ') },
      { given: 'A range between 1.6% and 1.8% (1 decimal, no margin): 1.9 then 1.7, seen in week 2; and 1.65 then 1.75.', then: 'since: 0.2 pts better [good]; since: 0.1 pts up [flat]', run: () => { const g = { ...RANGE, decimals: 1, range: { bound: 'between' as const, lower: 1.6, limit: 1.8, margin: 0 } }; return [[1.9, 1.7], [1.65, 1.75]].map((vs) => { const c = goalScorecard(g, CYCLE, vs.map((v, i) => ci('r', i + 1, v)), 2, false).cells.find((x) => x.key === 'since')!; return `since: ${c.value} [${c.tone}]`; }).join('; '); } },
      { given: 'The same range: 11.0 in week 1, exactly the margin inside its limit (boundary: not near).', then: 'Inside it [good], 1.0 pt of room [good]', run: () => { const cs = goalScorecard(RANGE, CYCLE, [ci('r', 1, 11)], 1, false).cells; const r = cs.find((c) => c.key === 'room')!; return `${cs[0]!.value} [${cs[0]!.tone}], ${r.value} [${r.tone}]`; } },
      { given: 'The 30→75 goal: 36 in week 1, then 39 and 41 both in week 2, seen in week 2 (a second check-in in a week, boundary).', then: 'since: 5 pts better (was 36% in week 1)', run: () => { const c = goalScorecard(g3075, CYCLE, [ci('m', 1, 36), ci('m', 2, 39), ci('m', 2, 41, { id: 'm2b', postedAt: '2026-09-21T15:00:00.000Z' })], 2, false).cells.find((x) => x.key === 'since')!; return `since: ${c.value} (${c.sub})`; } },
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
    code: [{ file: 'src/domain/changeset.ts', names: ['planChanges', 'postCheckIn', 'records', 'describe'] }, { file: 'src/domain/columns.ts', names: ['sheetKindOf'] }, { file: 'src/domain/numbers.ts', names: ['sameAsWritten'] }, { file: 'src/domain/commit.ts', names: ['Commit'] }],
    tests: ['src/domain/changeset.test.ts', 'src/domain/postCheckIn.test.ts', 'src/domain/roundtrip.test.ts', 'src/domain/removal.test.ts', 'src/domain/importSpeed.test.ts'],
    reqs: ['BULK-IMPORT', 'BULK-EDIT', 'ONE-FORMAT', 'ROUND-TRIP', 'IMPORT-ACTIONS', 'IMPORT-UNDO', 'DATA-TABLES', 'ONE-PER-WEEK'],
    body: `
\`planChanges(input)\` turns rows into a change set: **parse → validate → preview → apply → log**. Nothing is saved until the whole set is valid; then one *commit* saves it all, and one summary entry in the change log can undo all of it.

**The rows.** Each sheet (Goals, Plan, Check-ins, People, Asks) is known by its header row alone; its columns are the one format's, listed in [the export format](../export-format.md) (generated from \`src/domain/columns.ts\`), and every kind of issue it raises in [the issue kinds](../import-issues.md). A row finds its record by a goal's key (G-12), then its ID; a person by email, then by name when only one person has it; a team by name. A column a row leaves out keeps what the record says, and worked-out columns (status, gap, forecast) are never read. A number counts as changed only when it isn't \`sameAsWritten\`: the same text, or the same number at the decimal places the export writes it with (a plan week of 0.125 at 2 places is written 0.13, and 0.13 read back is no change), so an export loaded straight back is never a change, on any day. A change to any column that can be changed is applied, or said to be a problem, never quietly dropped.

**Checked by the app's own rules.** A goal row is checked as the goal form checks it; a check-in row is judged by [what a check-in must say](check-in.md) in its own week (a week behind plan needs a cause and a why, and a path to green when the call is behind); a person by the people rules; a row's Action (stop a goal, delete one, mark someone as left) by the removal rules. Only a goal's owner or an admin may change it. A plan change after check-ins started needs a reason (one for the whole set, or the row's own), and keeps the old plan. A check-in for a past week is *backfilled*: dated in its own week, so loading history doesn't make a goal look freshly checked in. One for a week that hasn't happened is refused. One for a week already posted replaces it, with a warning naming whose it was.

**One way to save a check-in** (\`postCheckIn\`): the check-in screens post through the same judgement, with the draft the form holds and a mode that says how it meets the week's own. \`new\` is refused when the week has a check-in ("Week 45 already has a check-in. Check in again, or correct it."); \`again\` adds a second beside it ("Checked in again for week 45: …"); \`correct\` replaces the week's newest, or adds a week that has none, and needs a reason of at least ${MIN_CORRECT_REASON} characters, kept as the entry's first difference ("Why corrected") and summed up as "Corrected week 44: 60% is now 61%" or "Added week 44 later: 61%". A week that has passed takes only \`correct\`. A correction keeps when the record it replaces was posted, so it never turns a late week into an on-time one, nor the reverse; a correction that changes nothing is refused ("Nothing is different from what week 44 already says."). A post that isn't a correction is no import: no Via mark and no import to undo (Delete this check-in takes it back). A correction is an import of one, undone with the import.

**A batch names its own rows** (backlog BT). A Goals row's **Ref** is a label of the file's own, kept nowhere: **Feeds into ref** on another Goals row, and **Goal ref** on a Check-ins row, name the goal that row adds or changes, so one file (or one \`bulk_change\`) builds a whole tree, with numbers, before any new goal has a key. A Ref on two rows is Must fix on both (and neither row saves); a ref that no row has, or that names a row that can't be saved, is Must fix on the row that uses it. A row with its own Ref is its own goal, even beside another new row of the same name. An empty ref says nothing: the other columns say what a goal feeds, so an export (where both are empty) loads back unchanged. Leaving a new goal out leaves out the rows that name it by Ref, as by name.

**A row that gives a week.** A Check-ins row with "Back on plan by week" and no Recovery is a plan: the old record's recovery state is read only when the row gives neither, so a correction never loses the week it gives.

**Speed** (import spec, rule 10). No row scans a list: goals by id, key and folded name, people by id, the saved check-ins by goal, and the issues by row are maps built once and kept up as rows are read, and a name one letter out is worked out once per name. Results are the same as a scan's, in the same order. A file costs about what its rows do: in Faro's tests, 5,000 new rows are checked in well under a second, and an unedited workbook of nearly 30,000 rows in about two (\`src/domain/importSpeed.test.ts\`, with N18's limits of 3, 8 and 20 seconds for 1,000, 5,000 and 30,000 rows). The size limits are in \`src/domain/importLimits.ts\`: comfortable up to 5,000 rows, and read up to 30,000 rows or 20 MB. \`planChangesInChunks(input)\` is the same engine a chunk at a time: it yields how far it has got (rows read, and what they would add, change and must fix) every 500 rows, so the import's worker can report progress and stop between chunks; \`planChanges\` runs it to the end. A file that would change more than 5,000 rows is checked, not saved, and split into parts (\`splitTables\` in \`src/domain/splitFile.ts\`): people first, each goal with its plan and check-ins, a goal before the goals that feed into it, and a goal larger than a part on its own.

**What it gives:** the items (each a change to one record, with its field-by-field differences), what was unchanged, the issues (errors that block, warnings to check, notes on how a row was read), whether a reason is needed, counts, and the commit (null while anything blocks). In "create" mode (set-up) the workspace starts empty and every row is new.`,
    examples: [
      { given: 'A file of 6,000 new goals, the 6,000th feeding into the first; each part holds at most 5,000 rows.', then: '2 parts: 5,000 and 1,000 rows; the first goal in part 1', run: () => { const goals = Array.from({ length: 6000 }, (_, i) => ({ goal: `Goal ${i + 1}`, owner: 'Rhea', ...(i === 5999 ? { 'feeds into': 'Goal 1' } : {}) })); const parts = splitTables({ goals }, 5000); return `${parts.length} parts: ${parts.map((p) => p.goals!.length.toLocaleString('en-GB')).join(' and ')} rows; the first goal in part ${parts.findIndex((p) => p.goals!.some((g) => g.goal === 'Goal 1')) + 1}`; } },
      { given: 'The engine run a chunk at a time over 1,200 new goals.', then: 'progress at 500 and 1,000 rows of 1,200', run: () => { const goals = Array.from({ length: 1200 }, (_, i) => ({ goal: `Chunked goal ${i + 1}`, owner: 'Rhea Kapoor', unit: '%', start: '1', target: '9' })); const run = planChangesInChunks(changeInput('amara', { goals })); const at: string[] = []; for (let s = run.next(); !s.done; s = run.next()) at.push(s.value.done.toLocaleString('en-GB')); return `progress at ${at.join(' and ')} rows of 1,200`; } },
      { given: 'A plan week of 0.125 kept at 2 decimal places, written 0.13 by the export, read back as 0.13; and as 0.12.', then: 'no change / a change', run: () => `${sameAsWritten('0.13', 0.125, 2) ? 'no change' : 'a change'} / ${sameAsWritten('0.12', 0.125, 2) ? 'no change' : 'a change'}` },
      { given: 'Rhea loads three new goals into the demo workspace: Ref top; Ref mid, Feeds into ref top; Ref leaf, Feeds into ref mid.', then: 'mid feeds top, leaf feeds mid', run: () => { const g = (ref: string, t: string, x: Record<string, string> = {}) => rec({ Ref: ref, Goal: t, Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '10', Target: '50', ...x }); const cs = change('rhea', { goals: [g('top', 'Top'), g('mid', 'Mid', { 'Feeds into ref': 'top' }), g('leaf', 'Leaf', { 'Feeds into ref': 'mid' })].map((r, i) => ({ ...r, __row: String(i + 2) })) }); const made = cs.commit?.goals ?? []; const t = (id: string | null) => made.find((x) => x.id === id)?.title.toLowerCase() ?? 'nothing'; return made.filter((x) => x.parentId).map((x) => `${x.title.toLowerCase()} feeds ${t(x.parentId)}`).join(', '); } },
      { given: 'In the demo workspace, Tariq (its owner) changes the AI-assisted reviews north star (ns-ai) to a target of 90, with no reason.', then: 'needs a reason; nothing to save', run: () => { const cs = change('tariq', { goals: [rec({ ID: 'ns-ai', Target: '90' })] }); return `${cs.needsReason ? 'needs a reason' : 'no reason needed'}; ${cs.commit ? 'ready to save' : 'nothing to save'}`; } },
      { given: 'The same change by Mateo, who neither owns it nor is an admin.', then: 'error: Only Tariq Haddad (its owner) or an admin can change “Pull requests with AI-assisted review”.', run: () => issues(change('mateo', { goals: [rec({ ID: 'ns-ai', Target: '90' })] }, { reason: 'x' })) },
      { given: 'Mateo posts mttr-pir on plan for week 45 from the check-in screen; then again with `new`; then with `again`; then corrects week 44 with the reason "oops".', then: 'Checked in for week 45 / Week 45 already has a check-in. Check in again, or correct it. / Checked in again for week 45 / Say why, in a sentence, so anyone reading week 44 later knows.', run: () => { const s = demo!; const today = new Date(CHECK_IN_MOMENT); const cycle = s.cycles[0]!; const week = currentWeek(cycle, today); const g = s.goals.find((x) => x.id === 'mttr-pir') as MetricGoal; let k = 0; const ctx = (snap: Snapshot) => ({ snapshot: snap, cycle, week, actor: s.people.find((p) => p.id === 'mateo')!, now: today.toISOString(), newId: (p: string) => `${p}_s${++k}` }); const d = { ...emptyDraft(g, null), value: String(Math.round(planAt(g.plan, week, cycle.weeks))) }; const fresh = { ...s, checkIns: s.checkIns.filter((c) => !(c.goalId === g.id && c.week === week)) }; const first = postCheckIn(ctx(fresh), { goalId: g.id, week, draft: d, mode: 'new' }); const after = { ...fresh, checkIns: [...fresh.checkIns, first.checkIn] }; const said = (f: () => string) => { try { return f(); } catch (e) { return (e as Error).message; } }; return [first.commit.changes[0]!.summary.replace(/:.*/, ''), said(() => postCheckIn(ctx(after), { goalId: g.id, week, draft: d, mode: 'new' }).commit.changes[0]!.summary), postCheckIn(ctx(after), { goalId: g.id, week, draft: d, mode: 'again' }).commit.changes[0]!.summary.replace(/:.*/, ''), said(() => postCheckIn(ctx(after), { goalId: g.id, week: week - 1, draft: d, mode: 'correct', reason: 'oops' }).commit.changes[0]!.summary)].join(' / '); } },
      { given: 'Mateo loads a week 4 number of 21 for his goal mttr-pir with no cause or why, into a copy with none of its check-ins.', then: 'the first problem says: Week 4 needs a Cause and a Why', run: () => { const s = demo!; const fresh = { ...s, checkIns: s.checkIns.filter((c) => c.goalId !== 'mttr-pir') }; const m = change('mateo', { checkIns: [rec({ 'Goal ID': 'mttr-pir', Week: '4', Value: '21' })] }, { snapshot: fresh }).issues[0]?.message ?? ''; return `the first problem says: ${/Week 4 needs a Cause and a Why/.exec(m)?.[0] ?? m}`; } },
    ],
    unclear: ['The engine is large (`src/domain/changeset.ts`): this section says what it does; its every message and column rule is in the code and its tests (listed below). A rebuild of the core status rules does not need it; a rebuild of import and bulk edit does.'],
  },
  /* ---------- the field table (backlog IM1) ---------- */
  {
    id: 'field-table',
    title: 'The field table',
    summary: 'For every column a person fills in: whether a new row must have it, its format, an example and what an empty cell does, said once for the template, the workbook’s Start here sheet, Help and the import.',
    code: [{ file: 'src/domain/columns.ts', names: ['fieldTable', 'requiredWord', 'requiredText', 'requiredLine', 'emptyText', 'EXAMPLE_ROWS'] }, { file: 'src/domain/export.ts', names: ['startHere', 'templateWorkbook'] }],
    tests: ['src/domain/fieldTable.test.ts'],
    reqs: ['FIELD-TABLE', 'ONE-FORMAT'],
    body: `
\`fieldTable(sheet)\` gives, for every column of a sheet that loads back (Goals, Plan, Check-ins, People), whether a **new row** must have it, its **format**, an **example**, what an **empty cell** does, and what it means. A column is one of: **Required**; **Required for** a type of goal (Target for a number goal), or **Required when** something holds (Cause when a check-in is behind); **Optional**, with what an empty cell gives; **Leave empty** (Faro fills it in, such as a new goal's Key); **For reading**; or **Worked out** (never read). Columns of which one is enough share a group (Owner or Owner email). On a row already here nothing is required: an empty cell keeps what the record says, except where a column says empty clears it.

The workbook's first sheet, **Start here**, is this table (with a "File of" row giving the workspace's and cycle's ids); the **template** is Start here and the four sheets with only the columns a person fills in, the required headers in bold, and example rows whose Action says **Example**, which the change engine leaves out and counts. A sheet named README (the old first sheet) or Start here is skipped on the way back in.

${fieldTableMarkdown()}`,
    examples: [
      { given: 'The Goals columns a new row must have, alone or as one of a pair.', then: 'Goal, Owner, Owner email', run: () => fieldTable('goals').filter((c) => c.required === 'required').map((c) => c.header).join(', ') },
      { given: 'The words for “required for a number goal” and for an optional column.', then: 'Required for a number goal / Optional', run: () => `${requiredWord({ for: ['metric'] })} / ${requiredWord({ optional: 'team' })}` },
      { given: 'What a new goal, check-in and person must have.', then: 'Goal, and Owner or Owner email. A number goal also needs Start and Target; a range goal, Limit; a stages goal, Stages. | Goal key (or Goal), Week, and Value or Stages. | Name and Email.', run: () => (['goals', 'checkIns', 'people'] as const).map((k) => requiredLine(k)).join(' | ') },
      { given: 'A Goals row whose Action says Example, with an owner nobody here has.', then: '0 changes, 1 example row left out, 0 problems', run: () => { const cs = change('amara', { goals: [rec({ Goal: 'X', Action: 'Example', Owner: 'Nobody here' })] }); return `${cs.items.length} changes, ${cs.examples} example row left out, ${cs.issues.length} problems`; } },
    ],
    unclear: ['It says what Faro does. IM2 changed the defaults the import design marked: a new goal’s Type is read from which columns it fills in, a number has no unit and a range no warning margin unless the row gives one (core rule: kinds, levels and near misses). The goal form keeps its own visible defaults until goal entry (GE1, GE2) reads this table.'],
  },
  /* ---------- kinds, levels and near misses (backlog IM2) ---------- */
  {
    id: 'import-levels',
    title: 'Kinds, levels and near misses',
    summary: 'Every problem the change engine finds is data: a kind, and a level its kind fixes (Must fix, Check, or said); problems group by kind, one answer covers a group, and a name one letter out is asked about, never guessed.',
    code: [
      { file: 'src/domain/problemLevels.ts', names: ['fold', 'near', 'editDistance', 'levelOf', 'MUST_KINDS', 'CHECK_KINDS', 'NOTE_KINDS', 'issueOf', 'groupId', 'groupIssues', 'groupTitle', 'whereText', 'ANSWERS'] },
      { file: 'src/domain/changeset.ts', names: ['planChanges'] },
    ],
    tests: ['src/domain/problemLevels.test.ts'],
    reqs: ['IMPORT-LEVELS'],
    body: `
Every problem \`planChanges\` finds is an **issue** with a **kind**, and the kind fixes its **level**:

- **Must fix** (\`must\`): Faro can't record it truthfully. Nothing is saved while one is left, unless its rows are left out by an answer. Kinds: ${MUST_KINDS.map((k) => `\`${k}\``).join(', ')}.
- **Check** (\`check\`): possible but unlikely. It is a question; the change saves once it is answered. Kinds: ${CHECK_KINDS.map((k) => `\`${k}\``).join(', ')}.
- **Said** (\`note\`): how a row was read (an owner matched by name, a type read from the columns, a date read as a week). Never blocks.

An issue carries its sheet and row, the record's name, its column in the sheet's own words, what the cell said (\`found\`), the near match offered (\`suggest\`), the sentence for that one row (\`message\`: what is wrong, what was read, what would be right), the answers its group takes, and its group's id. Issues are listed in the file's order: sheet (Goals, Plan, Check-ins, People), then row.

**Groups.** Issues group by kind, sheet, column and the folded value found: the group's id is those four, so it is the same for the same problem in a corrected file and an answer given to one file still applies. Each group has a title (what is wrong, or its question, with its count), where its rows are ("Goals, rows 2 to 4 and 9"; past three runs, the first three and "and 12 more"), and its answers, the suggested one first and none chosen. Must fix comes first, then Check, then what was read; within a level, the largest group first.

**Answers.** \`answers\` maps a group's id to a choice (and a value where the choice needs one). One answer covers every row in the group: \`use\` reads the cell as the near match; \`choose\` with a value reads it as that; \`new\` adds a team (admins only); \`leave\` leaves those rows out (listed in \`leftOut\`); \`last\` or \`first\` says which of two rows for one record to use; \`keep\` gives goals the decimal places their check-ins were typed with (a Decimals change their owner or an admin may make); \`done\`, \`not-done\` or \`from-now\` settles stages already past (done records them in their due weeks, as setting up a goal does; from now counts them from this week); \`right\`, \`yes\`, \`replace\`, \`add\`, \`new\`, \`same\`, \`change\` or \`goal\` say the row means what it says. \`confirm\` (the older single switch) answers every plan question and every unlikely number yes. The commit is null while a Must fix or an unanswered Check is left.

**Near misses.** A name or word is folded before it is compared: lower case, accents off, "&" and "and" the same, punctuation and repeated spaces one space (so "CI CD" is CI/CD). Folded equal to exactly one candidate, it is that one. Otherwise, exactly one candidate within one edit (two from 8 folded characters; a swap of two letters is one edit) is a **near miss**, asked as a Check with the near match first; never for one or two characters, and never when two candidates are within reach. Nothing near is Must fix. Teams, people (names, and an email's part before @ at the same domain), goals, a stage's name and a column's words are all read this way.

**Defaults that are asked or said.** A new goal with no Type is read from the columns it fills in (Start and Target: a number goal; Limit: a range; Stages: a stages goal); none, or two of them, is Must fix. A new number goal has no unit unless the row gives one, and none is asked once a file. A new range has no warning margin unless the row gives one. A date in the cycle, in Week, Due week or a stage's week, is read as its week and said; one outside the cycle is Must fix. The due week is always checked against the start the goal will have.

**Never guessed:** an owner from a first name; one of several people or goals with one name; a number from text; a type from two groups of columns; a week from a date outside the cycle; a row whose key names a goal with another name, owner and team (it is asked); anything on behalf of someone who may not make the change.`,
    examples: [
      { given: 'Near misses: “Platfrom” among Platform and CI/CD; “CI CD”; “Platfrom” among Platform and Platforms; “vp” among the levels; “numbr” among the types and their other spellings.', then: 'near Platform / exact CI/CD / none / none / near number', run: () => [near('Platfrom', ['Platform', 'CI/CD']), near('CI CD', ['Platform', 'CI/CD']), near('Platfrom', ['Platform', 'Platforms']), near('vp', wordsAndAlso(LEVEL_WORDS)), near('numbr', wordsAndAlso(TYPE_WORDS))].map((m) => ('exact' in m ? `exact ${m.exact}` : 'near' in m ? `near ${m.near}` : 'none')).join(' / ') },
      { given: 'Where rows 2, 3, 4 and 9 of Goals are.', then: 'Goals, rows 2 to 4 and 9', run: () => whereText('Goals', [2, 3, 4, 9]) },
      { given: 'Amara loads 14 new goals whose Team says “CI/DC”; then the same file with the answer “use”.', then: 'check: 14 rows name a team that isn’t here: “CI/DC”. Did you mean CI/CD? (14 rows, 1 group) → 14 new goals, ready to save', run: () => { const rows = Array.from({ length: 14 }, (_, k) => ({ ...rec({ Goal: `Pipeline goal ${k + 1}`, Owner: 'Rhea Kapoor', Team: 'CI/DC', Unit: '%', Start: '10', Target: '50' }), __row: String(k + 2) })); const cs = change('amara', { goals: rows }); const g = cs.groups.filter((x) => x.level !== 'note'); const done = change('amara', { goals: rows }, { answers: { [g[0]!.id]: { choice: 'use' } } }); return `${g[0]!.level}: ${g[0]!.title} (${g[0]!.count} rows, ${g.length} group) → ${describe(done).toLowerCase()}, ${done.commit ? 'ready to save' : 'not ready'}`; } },
      { given: 'A Goals row for G-1 whose Level says “vp”.', then: 'must unknown-word: Level says “vp”. Use north star, svp or team.', run: () => { const i = change('amara', { goals: [rec({ Key: 'G-1', Level: 'vp' })] }).issues[0]!; return `${i.level} ${i.kind}: ${i.message}`; } },
      { given: 'A new goal whose Type says “numbr”.', then: 'check near-word: Type says “numbr”. Read it as number?', run: () => { const i = change('amara', { goals: [rec({ Goal: 'Cache hit rate', Owner: 'Rhea Kapoor', Type: 'numbr', Unit: '%', Start: '10', Target: '50' })] }).issues.find((x) => x.level !== 'note')!; return `${i.level} ${i.kind}: ${i.message}`; } },
      { given: 'A new goal with Start and Target but no Type and no Unit column.', then: 'Type: metric (from Start and Target; the row gave none). / check no-unit: This number has no unit. Is it a plain count?', run: () => { const cs = change('amara', { goals: [rec({ Goal: 'Cache hit rate', Owner: 'Rhea Kapoor', Start: '10', Target: '50' })] }); const t = cs.issues.find((x) => x.kind === 'default' && x.column === 'Type')!; const u = cs.issues.find((x) => x.kind === 'no-unit')!; return `${t.message} / ${u.level} ${u.kind}: ${u.message}`; } },
      { given: 'A new goal owned by “Rhea Kapor”.', then: 'check near-ref: “Rhea Kapor” isn’t here. Did you mean Rhea Kapoor?', run: () => { const i = change('amara', { goals: [rec({ Goal: 'Cache hit rate', Owner: 'Rhea Kapor', Unit: '%', Start: '10', Target: '50' })] }).issues.find((x) => x.level !== 'note')!; return `${i.level} ${i.kind}: ${i.message}`; } },
      { given: 'G-1 on rows 2 and 3 of one file.', then: 'must duplicate (row 2), must duplicate (row 3): Key G-1 is on rows 2 and 3. Give each goal one row.', run: () => { const cs = change('amara', { goals: [rec({ Key: 'G-1', Target: '20' }), { ...rec({ Key: 'G-1', Target: '22' }), __row: '3' }] }); return `${cs.issues.map((i) => `${i.level} ${i.kind} (row ${i.row})`).join(', ')}: ${cs.issues[0]!.message}`; } },
      { given: 'A row called TOTAL with no owner.', then: 'check totals-row: Row 2 is called “TOTAL” and has no owner. It looks like a totals row.', run: () => { const i = change('amara', { goals: [rec({ Goal: 'TOTAL', Start: '10', Target: '550' })] }).issues[0]!; return `${i.level} ${i.kind}: ${i.message}`; } },
      { given: 'A new stages goal with stages due in weeks 2 and 50, in week 45; then answered “They’re done”.', then: 'check past-stage: 1 stage of “Runbooks rewritten” is due before this week (week 45): Draft@2. Is it done? → 1 new goal, 1 check-in (1 for past weeks)', run: () => { const t = { goals: [rec({ Goal: 'Runbooks rewritten', Owner: 'Rhea Kapoor', Type: 'milestone', Stages: 'Draft@2; Signed off@50' })] }; const cs = change('amara', t); const i = cs.issues.find((x) => x.kind === 'past-stage')!; const done = change('amara', t, { answers: { [i.group]: { choice: 'done' } } }); return `${i.level} ${i.kind}: ${i.message} → ${describe(done).toLowerCase()}`; } },
    ],
    unclear: ['A group’s id is its kind, sheet, column and folded value found, written with hyphens for spaces and colons between (`near-ref:goals:team:ci-dc`): a rebuild may make ids its own way, as long as the same problem gives the same id. The titles of groups are Faro’s wording; the conformance rows (spec/conformance/import.csv) score the kind, level, group and the one row’s sentence.', 'IM3 rewrote the import’s preview around these groups (Data’s tables and set-up keep the older list until IM8). near-header and two-columns (reading the file’s headers) come with IM5; new-team’s set-up case with ST4. other-workspace is asked by the preview from the file’s Start here sheet (rule: what was read), before the engine runs.'],
  },
  /* ---------- the import's preview (backlog IM3) ---------- */
  {
    id: 'import-preview',
    title: 'What an import read, and leaving rows out',
    summary: 'Before an import is saved, it says which sheets and columns it read and which it did not, counts by sheet, and may leave named rows out with the rows that depend on them; worked-out cells a file edited are counted and said, never read.',
    code: [
      { file: 'src/domain/sheets.ts', names: ['readTables', 'readLine', 'readsHeader'] },
      { file: 'src/domain/leaveOut.ts', names: ['leaveOut'] },
      { file: 'src/domain/workedOut.ts', names: ['workedOutEdits'] },
    ],
    tests: ['src/domain/importPreview.test.ts', 'src/domain/roundtrip.test.ts'],
    reqs: ['IMPORT-PREVIEW'],
    body: `
**What was read.** \`readTables\` knows each sheet by its header row. Besides the tables, it returns the sheets it read; the sheets it did not, each with why: \`reading-only\` (Results, Asks, Notes, a module's sheet such as Metrics), \`not-faro\` (a header row that is no Faro sheet's), \`second\` (a second sheet of one kind: only the first is read), \`start-here\` (the workbook's first sheet, or an older README, never a table and never mentioned); the **columns nothing reads** on each sheet it read (C19: named, never dropped silently); each table's headers as written; and the file's **origin**, the Start here sheet's "File of" row (the workspace's and cycle's ids). \`readLine\` says it in one sentence: "Read Goals. Not read: Results (for reading only); Budget (not a Faro sheet); the columns Notes and Budget on Goals. 2 example rows left out." Parts with nothing are left out.

**Another workspace's file** (\`other-workspace\`): when the origin's workspace isn't this one, it is asked before anything else, because the file's keys and IDs belong there. Answered "Add its rows as new goals", keys and IDs are dropped (and the Plan sheet, which needs keys) and the rows are read as new.

**Counts by sheet.** The change set counts unchanged rows by sheet (\`unchangedBy\`) beside its changes and issues, so the preview can give, per sheet read: rows read, added, changed, stopped or left, unchanged, rows to fix and rows to check.

**Leaving rows out** (decision 1: all or nothing unless the person chooses). \`leaveOut(tables, rows)\` returns the tables without those rows and without the rows that depend on them, each with why: a new goal's check-ins (named by its name, as a new goal has no key yet), goals whose Feeds into names it (and theirs in turn), and goals and Takes-over cells that name a new person left out.

**Worked-out cells.** \`workedOutEdits\` compares, for each row that matches a record by its key columns, the worked-out columns (Status, Now, Gap…) with what an export would write today. They are never read: a file that changes only them changes nothing, and the preview says so ("On 2 rows, Status differs from what Faro works out today. Faro never reads those columns: to change where a goal stands, post a check-in.").`,
    examples: [
      { given: 'A file with Start here, a Goals sheet with two columns of the person’s own (Notes, Budget), a Results sheet and a sheet called Budget.', then: 'Read Goals. Not read: Results (for reading only); Budget (not a Faro sheet); the columns Notes and Budget on Goals.', run: () => readLine(readTables([{ name: 'Start here', rows: [['Platform, 2026. Exported 2026-11-11, week 46 of 52.'], ['File of', 'platform-org', 'y2026']] }, { name: 'Goals', rows: [['Key', 'Goal', 'Owner', 'Notes', 'Budget'], ['G-1', 'Lead time', 'Rhea Kapoor', '', '']] }, { name: 'Results', rows: [['Key', 'Goal', 'Result', 'Q1'], ['G-1', 'x', 'y', 'z']] }, { name: 'Budget', rows: [['Line', 'Amount'], ['Runners', '400']] }])) },
      { given: 'Leaving out Goals row 44 (a new goal) with 4 Check-ins rows for it and one goal (row 45) that feeds into it.', then: '5 rows go with it; row 45 because Feeds into names Goals row 44', run: () => { const r = (o: Record<string, string>, row: number): Rec => ({ __row: String(row), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) }); const out = leaveOut({ goals: [r({ Goal: 'Runner pool size', Owner: 'Rhea Kapoor' }, 44), r({ Goal: 'Runner spares', Owner: 'Rhea Kapoor', 'Feeds into': 'Runner pool size' }, 45)], checkIns: [2, 3, 4, 5].map((k) => r({ Goal: 'Runner pool size', Week: String(40 + k), Value: '12' }, k)) }, [{ sheet: 'Goals', row: 44 }]); const g = out.also.find((x) => x.sheet === 'Goals')!; return `${out.also.length} rows go with it; row ${g.row} because ${g.because}`; } },
    ],
    unclear: ['The counts, the order of the blocks and the words of the preview are its screen\'s (spec/screens): a rebuild may lay them out its own way. Imported, Undo and Past imports are rule import-undo; paste and a header row below row 1 with IM5; large files with IM6.'],
  },
  /* ---------- the header row (backlog IM5, C17) ---------- */
  {
    id: 'import-header',
    title: 'The header row, and headers that are nearly right',
    summary: 'A sheet’s header row is found in its first ten rows; a column under another name the field table gives it is read as that column, and one a letter out is asked about once, at every door.',
    code: [
      { file: 'src/domain/sheets.ts', names: ['readHeader', 'headerMatch', 'readTables'] },
      { file: 'src/domain/columns.ts', names: ['sheetKindOf'] },
      { file: 'src/domain/changeset.ts', names: ['planChanges'] },
    ],
    tests: ['src/domain/headerRow.test.ts'],
    reqs: ['BULK-IMPORT', 'IMPORT-LEVELS'],
    body: `
**The header row** (\`readHeader\`): of a sheet's first ten rows, the one with the most cells that some sheet reads (its own header, any case, or another name the field table gives the column, its \`also\`), needing at least two. Rows above it (a title) are skipped and said: "Row 2 of Goals is the header row; 1 row above it was skipped." Each row keeps its number in the sheet. No such row: row 1, and the sheet is known only if its first row says so.

**Which sheet** (\`sheetKindOf\`, judged with each kind's own names in turn, Goals first, so a People sheet's "Title" is a job title and never Goals' other name for Goal; else on the names any sheet reads): Goals needs Goal or Key and one of Owner, Owner email, Type, Target, Level, Action; Check-ins Week and one of Value, Stages, Call; Plan a "Week N"; **People needs Email, or Name with another People column** (Team, Job title, Admin, ID): Name, Department and Salary band are no Faro sheet.

**Each header** (\`headerMatch\`): \`exact\`, \`also\` ("Goal name" is Goal, "Units" is Unit, read without a word), \`near\` (one letter out of exactly one name, rule 4: "Targett"), or \`unknown\` (named in the file line, never read). A near header is not listed as unread: the engine asks it as one Check per sheet and header, kind \`near-header\`, "A column on Goals is called “Targett”. Read it as Target?", answered "Read it as Target" or "Don't read it". The engine does this itself, so a paste, a file and MCP's bulk_change read headers the same way. While it is unanswered, a Must fix on the column it may be ("has no Target") waits: it is raised only once the answer is "Don't read it". **Two columns read as one** ("Goal" and "Goal name") are never one dropped quietly: the engine asks one Check, kind \`two-columns\`, "Two columns on Goals are read as Goal: “Goal” and “Goal name”. Which should be read?", answered by naming one; until then neither is read, and the column's Must fix waits. The rows-to-fix download keeps a near header's column as the file wrote it.

**The way in** (spec 2.1): a file (up to 20 MB and 30,000 rows; over, it says so and asks for parts), or rows pasted from a spreadsheet (read as a file called "Pasted rows"). A file with no Faro sheet names its first sheet's first five headers and offers the template.`,
    examples: [
      { given: 'A Goals sheet whose first row is the title “Platform goals FY27”.', then: 'header on row 2, goals', run: () => { const h = readHeader([['Platform goals FY27', ''], ['Goal', 'Level', 'Team', 'Owner']]); return `header on row ${h.row}, ${h.kind}`; } },
      { given: 'Headers Goal name, Owner name, Target value, Units.', then: 'goals: Goal (also), Owner (also), Target (also), Unit (also)', run: () => { const h = readHeader([['Goal name', 'Owner name', 'Target value', 'Units']]); return `${h.kind}: ${h.columns.map((c) => `${c.as} (${c.how})`).join(', ')}`; } },
      { given: 'Headers Name, Email, Title.', then: 'people', run: () => String(readHeader([['Name', 'Email', 'Title']]).kind) },
      { given: 'Headers Name, Department, Salary band.', then: 'no Faro sheet', run: () => (readHeader([['Name', 'Department', 'Salary band']]).kind ? 'a Faro sheet' : 'no Faro sheet') },
      { given: 'Headers Key, Goal, Targett.', then: 'Targett is near Target', run: () => { const c = readHeader([['Key', 'Goal', 'Targett']]).columns[2]!; return `${c.header} is ${c.how} ${c.as}`; } },
    ],
  },
  /* ---------- an import's undo, and past imports (backlog IM4) ---------- */
  {
    id: 'import-undo',
    title: 'Undoing an import, and past imports',
    summary: 'Every import, bulk edit and change through MCP is one entry in the change log that can be undone as a whole by whoever made it or an admin; Undo says first which rows changed since and will stay, and why.',
    code: [
      { file: 'src/domain/removal.ts', names: ['undoImport', 'undoPreview', 'pastImports', 'importName', 'canUndoImport'] },
      { file: 'src/domain/activity.ts', names: ['foldImports'] },
    ],
    tests: ['src/domain/removal.test.ts', 'src/domain/importUndo.test.ts'],
    reqs: ['IMPORT-UNDO'],
    body: `
**One entry.** An import's summary change (\`action: 'imported'\`, its \`entityId\` the import's id) keeps what every record it wrote was before (\`undo\`), its Via, and for a file its **File** (the name) and **Rows** ("654 changed, 397 unchanged, 5 left out") diffs. Every row's change carries the import's id. \`pastImports(changes)\` lists the summaries newest first, each with the undo entry if it has been undone. Activity folds an import's rows under its summary (\`foldImports\`): a row folds only when its summary is in the same list, so a search that finds the row alone still shows it, and a goal's own history never folds.

**Who.** Whoever made it, or an admin (\`canUndoImport\`); once.

**What Undo does.** Every row goes back as it was before the import: a goal or check-in it added is deleted, one it changed gets its earlier version back, a person it added goes again unless they are in use since (they have done something, own a goal, lead a team, sit in a review or have an ask), and a team it added goes once nothing sits in it. Every kind put back counts: an import that only changed a team objective puts back one row. A goal Undo deletes leaves the tree as a deleted goal does: what fed it moves up to what it fed, other goals stop listing it, and its open asks are withdrawn, even when the goal that fed it changed since. A row changed by anything after the import **stays as it is**, with why, when and by whom (\`KeptRow\`), from the latest change that touched it: "{who} posted a check-in for week {w} on {date}", "Its {field} was changed on {date}", "The check-in was corrected on {date}", "{name} has made changes since". A goal the import added stays when a check-in has been posted on it since.

**Before it.** \`undoPreview(x, importId)\` is \`undoImport\` without the commit: \`{ restores, skipped }\`, the same numbers and reasons Undo then gives. A screen and the MCP tool (\`undo_import\` with \`dry_run\`) say it before anything is undone; when nothing can go back, they say "Nothing left to undo" (\`nothingToUndo\`: "Nothing to undo: it changed no rows." when it wrote none), and \`undoImport\` refuses rather than mark it undone.`,
    examples: [
      { given: 'Amara loads a file adding two goals for Rhea; later Rhea checks in on the first. Undo is previewed.', then: '1 row goes back; stays: Pipeline cache hit rate: Rhea Kapoor posted a check-in for week 45 on 5 Nov', run: () => {
        const s = demo!; const cycle = s.cycles[0]!; const today = new Date(CHECK_IN_MOMENT); let k = 0;
        const cs = change('amara', { goals: [rec({ Goal: 'Pipeline cache hit rate', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '20', Target: '90' }), { ...rec({ Goal: 'Runner idle time', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '20', Target: '90' }), __row: '3' }] }, { file: { name: 'goals.xlsx' } });
        if (!cs.commit) return issues(cs);
        const after = applyCommit(s, cs.commit);
        const goal = cs.commit.goals!.find((g) => g.title === 'Pipeline cache hit rate')!;
        const later = new Date(today.getTime() + 60_000).toISOString();
        const ci = { id: 'ci_later', goalId: goal.id, authorId: 'rhea', week: currentWeek(cycle, today), postedAt: later, value: 30, stages: null, status: 'on' as const, calculated: 'on' as const, cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false };
        const s2 = applyCommit(after, { checkIns: [ci], changes: [{ id: 'chg_later', at: later, actorId: 'rhea', goalId: goal.id, entity: 'check-in', entityId: ci.id, action: 'posted', summary: 'Checked in', diffs: [] }] });
        const imp = pastImports(s2.changes)[0]!.entry;
        const p = undoPreview({ snapshot: s2, full: s2, cycle, week: currentWeek(cycle, today), actor: s.people.find((v) => v.id === 'amara')!, now: later, newId: (v) => `${v}_y${++k}` }, imp.entityId);
        return `${p.restores} row${p.restores === 1 ? ' goes' : 's go'} back; stays: ${p.skipped.map(keptText).join('; ')}`;
      } },
      { given: 'A file’s import summary, by its name.', then: 'goals.xlsx · 1 changed, 0 unchanged', run: () => {
        const cs = change('amara', { goals: [rec({ Goal: 'Pipeline cache hit rate', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '20', Target: '90' })] }, { file: { name: 'goals.xlsx' } });
        const sum = cs.commit?.changes.find((c) => c.action === 'imported');
        return sum ? `${importName(sum)} · ${sum.diffs.find((d) => d.field === 'Rows')!.to}` : issues(cs);
      } },
    ],
    unclear: ['Past imports’ list bar (When, Who, How) waits for the find spec’s FS2; until then it is found by search only.'],
  },
  /* ---------- deciding in a review (deep review P2, 10 Nov) ---------- */
  {
    id: 'review-decide',
    title: 'Deciding in a review',
    summary: 'A goal behind leaves a review with a next step (an owner and a week) or an accepted risk with a reason; the next session opens with what the last one agreed.',
    code: [
      { file: 'src/domain/decide.ts', names: ['needsDecision', 'decisionFor', 'acceptNote', 'acceptedReason', 'lastTime', 'sessionDecisions'] },
      { file: 'src/domain/actions.ts', names: ['acceptRisk', 'addAction', 'markReviewed'] },
      { file: 'src/domain/review.ts', names: ['sessionToDo', 'canSpeakFor', 'speakRefusal', 'joinLine'] },
    ],
    tests: ['src/domain/decide.test.ts', 'src/domain/review.test.ts', 'src/domain/speakFor.test.ts'],
    reqs: ['REVIEW-DECIDE', 'REVIEW-RUN', 'REVIEW-SPEAK'],
    body: `
**Who may speak for a review** (\`canSpeakFor\`): someone in it, or an admin. Marking a goal reviewed, a note, the review accepting a risk, and a question or next step raised in the review are refused for anyone else with "Only people in {review}, or an admin, can speak for it." (\`speakRefusal\`). Everyone may read a review, and anyone may still ask a question or agree a next step on a goal's own page. A review's page tells someone not in it who can add them (\`joinLine\`): "You’re not in this review. {its people and whoever set it up, up to six, then "and {n} more"} or an admin can add you."

**Who must decide.** A goal whose status is \`off\` or \`risk\` (\`needsDecision\`) is not marked reviewed in a walk until something is decided about it. Every other goal is marked reviewed as before.

**What counts as a decision** (\`decisionFor\`), the latest in the session first:
- a **next step** said in this session: an action with a person who does it and a week it is due by (open or done). An action without a week, a note or a question is not a decision;
- the review **accepting the risk**: a note said in the session whose words are "${DECIDED['accept-risk'].label}: " and then the reason, at least ${MIN_ACCEPT_REASON} characters (\`acceptRisk\`; \`acceptedReason\` reads it back). It is a look, not a plan: the goal still needs attention;
- or, wherever it was agreed (the goal's page, say), an open action on the goal with a person and a week, agreed since the goal's latest check-in and not yet overdue. This is the record [needs attention](flags.md) reads for "being handled".

**Choosing who does it** is find-and-pick ([finding things](finding.md)): you and your team are suggested before anything is typed; then the people whose name, job title or team has a word starting with each word typed, those whose name it starts first, never someone marked as left. It is the one person search, the same as People's.

**Last time** (\`lastTime\`): the session before this one is the latest earlier week anything was said in the review. Its actions are listed with how each stands now: open, overdue (open past its week) or done; open ones first, then by due week.

**Finishing** marks every goal not yet reviewed, in one save with Undo (\`markReviewed\`; Undo is \`unmarkReviewed\`), and so holds the session. Before it does, it says what was decided (\`sessionDecisions\`): the next steps by who owns them, the risks accepted, and the questions still open.

**To do** (\`sessionToDo\`): a person's session counts as something to do (the Reviews count, Home's main action) when it is this week's, not held, and either its day has come or a goal in it has been checked in on. So a workspace set up this morning doesn't say a review is to do.`,
    examples: [
      { given: 'Which statuses need a decision: off, risk, on, stale, done.', then: 'yes, yes, no, no, no', run: () => ['off', 'risk', 'on', 'stale', 'done'].map((k) => (needsDecision(k) ? 'yes' : 'no')).join(', ') },
      { given: 'The words saved for accepting the risk because "the vendor fix lands next release", and what is read back from them and from "Talked it through".', then: 'We accept the risk: the vendor fix lands next release / the vendor fix lands next release / not a decision', run: () => { const w = acceptNote('the vendor fix lands next release'); return `${w} / ${acceptedReason(w)} / ${acceptedReason('Talked it through') ?? 'not a decision'}`; } },
      { given: 'In the demo workspace, Daniel accepts the risk on the merge queue in the Developer Productivity fortnightly with the reason "ok".', then: 'refused: Say why the review accepts the risk.', run: () => summaryOf(asPerson('daniel', (x) => acceptRisk(x, goalIn('lead-mq'), demo!.reviews.find((r) => r.id === 'devprod')!, 'ok', 46))) },
      { given: 'In the demo workspace, Oskar, who is not in the Developer Productivity fortnightly and is not an admin, marks the merge queue reviewed in it.', then: 'refused: Only people in Developer Productivity fortnightly, or an admin, can speak for it.', run: () => summaryOf(asPerson('oskar', (x) => reviewCall(x, goalIn('lead-mq'), demo!.reviews.find((r) => r.id === 'devprod')!, 'acknowledge', ''))) },
      { given: 'Searching the demo workspace’s people for "kap", then "rhea tunde".', then: 'Rhea Kapoor / nobody', run: () => [search(personRows(demo!), { q: 'kap' }), search(personRows(demo!), { q: 'rhea tunde' })].map((a) => a.rows.map((p) => p.name).join(', ') || 'nobody').join(' / ') },
    ],
    unclear: ['Accepting the risk is stored as a note whose words start with a fixed phrase, so no new kind of record was needed before the talk. A rebuild should give it a kind of its own (a decision with a reason), and keep the phrase only for what people read.'],
  },
  /* ---------- a year's end (round 3, cycle end CY1) ---------- */
  {
    id: 'year-end',
    title: 'A year’s end',
    summary: 'A cycle’s real first and last days, where it stands on a day, and the week its results are judged at: the clock, not a button, ends a year.',
    code: [
      { file: 'src/domain/cycle.ts', names: ['cycleDates', 'cycleState', 'wrapUpOpenOn', 'wrapUpOpen', 'wrapUpCycle', 'placeLine', 'periodNow', 'dayWithYear'] },
      { file: 'src/domain/plan.ts', names: ['resultWeek', 'hasEnded'] },
      { file: 'src/domain/thresholds.ts', names: ['RULES'] },
    ],
    tests: ['src/domain/cycleEnd.test.ts', 'src/domain/workspace.test.ts'],
    reqs: ['RESULTS', 'YEAR'],
    body: `
**A cycle's days.** Week 0 is the week before week 1 (for starting numbers). A cycle's **first day** is week 1's Monday (\`startDate\` + 7 days); its **last day** is its last week's Sunday (\`startDate\` + (\`weeks\` + 1) × 7 − 1 days). The wrap-up **opens** on the Monday of week \`weeks − ${RULES.wrapUpWeeksBefore} + 1\` (its last ${RULES.wrapUpWeeksBefore} weeks) and **closes** ${RULES.wrapUpWeeksAfter} weeks after the last day.

**Where it stands** on a day (\`cycleState\`): \`before\` its first day (week 0 included); \`running\` until the day before the wrap-up opens; \`ending\` until its last day; \`ended\` until the wrap-up closes; \`closed\` after. The clock decides, never a button: a year ends on its last day whether or not anyone starts the next. The frame says it in one line (\`placeLine\`): "2026 · week 46 · Q4"; "2026 · week 53, the last week"; "2026 has ended"; before week 1, "2027 starts Mon 4 Jan 2027".

**The week results are judged at** (\`resultWeek\`) is the week by the calendar, held to 0…\`weeks + 1\`: the current week until the last day, then \`weeks + 1\`. A goal's result, its quarters and the last quarter's close read it, so a goal due in the last week gets its result, and Q4 closes on the numbers there are, the day after the year ends. Everything else keeps \`currentWeek\`, which stops at the last week: a check-in given after the end is dated the last week.

**After the last day nothing in the cycle is due, late or out of date.** No check-in is due (no "due" flag, nothing on Home's check-in block), and no goal becomes "No recent update" for want of a check-in: each keeps the last status its owner gave.`,
    examples: [
      { given: 'The demo’s 2026: week 0 from Monday 22 December 2025, 53 weeks. Its days.', then: 'first 2025-12-29, last 2027-01-03, wrap-up 2026-12-21 to 2027-01-31', run: () => { const d = cycleDates({ startDate: '2025-12-22', weeks: 53 }); return `first ${d.firstDay}, last ${d.lastDay}, wrap-up ${d.wrapUpOpens} to ${d.wrapUpCloses}`; } },
      { given: '2027 (week 0 from Monday 28 December 2026, 52 weeks).', then: 'first 2027-01-04, last 2028-01-02, wrap-up 2027-12-20 to 2028-01-30', run: () => { const d = cycleDates({ startDate: '2026-12-28', weeks: 52 }); return `first ${d.firstDay}, last ${d.lastDay}, wrap-up ${d.wrapUpOpens} to ${d.wrapUpCloses}`; } },
      { given: '2026 on Sunday 20 December 2026, Monday 21 December, Monday 28 December, Monday 4 January 2027 and Monday 1 February 2027: its state, and the frame.', then: 'running 2026 · week 51 · Q4 / ending 2026 · week 52 · Q4 / ending 2026 · week 53, the last week / ended 2026 has ended / closed 2026 has ended', run: () => { const y = { id: 'y', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 }; return ['2026-12-20', '2026-12-21', '2026-12-28', '2027-01-04', '2027-02-01'].map((d) => `${cycleState(y, at(d + 'T12:00:00Z'))} ${placeLine(y, at(d + 'T12:00:00Z'))}`).join(' / '); } },
      { given: 'Is 2026’s wrap-up open on Sunday 20 December 2026, Monday 21 December, Sunday 31 January 2027 and Monday 1 February 2027?', then: 'no, yes, yes, no', run: () => ['2026-12-20', '2026-12-21', '2027-01-31', '2027-02-01'].map((d) => (wrapUpOpenOn({ startDate: '2025-12-22', weeks: 53 }, at(d + 'T12:00:00Z')) ? 'yes' : 'no')).join(', ') },
      { given: '2027 seen on Monday 21 December 2026, before its week 1.', then: '2027 starts Mon 4 Jan 2027', run: () => placeLine({ id: 'y', name: '2027', startDate: '2026-12-28', weeks: 52, reviewDay: 3 }, at('2026-12-21T12:00:00Z')) },
      { given: 'A 13-week cycle from Monday 28 September 2026 (week 0).', then: 'first 2026-10-05, last 2027-01-03, wrap-up opens 2026-12-21', run: () => { const d = cycleDates({ startDate: '2026-09-28', weeks: 13 }); return `first ${d.firstDay}, last ${d.lastDay}, wrap-up opens ${d.wrapUpOpens}`; } },
      { given: 'The week and the week results are judged at, on Sunday 3 January 2027 and Monday 4 January 2027, in 2026.', then: '53 53 / 53 54', run: () => { const y = { startDate: '2025-12-22', weeks: 53 } as never; return ['2027-01-03', '2027-01-04'].map((d) => `${currentWeek(y, at(d + 'T12:00:00Z'))} ${resultWeek(y, at(d + 'T12:00:00Z'))}`).join(' / '); } },
      { given: 'G-37, 4 → 40 pairs due in week 53 of 2026, with 33 pairs in week 53. Its result and Q4 on Sunday 3 January 2027, then on Monday 4 January.', then: 'none, Q4: plan 40 pairs by week 53 / Not met: due week 53, Q4: 33 pairs against a plan of 40 pairs, 7 pairs short', run: () => { const y = { id: 'y', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 }; const g = metric(4, 40, 'straight', { id: 'g37', unit: 'pairs' }); const cis = [checkIn('g37', 53, 33, { postedAt: '2026-12-29T10:00:00Z' })]; return ['2027-01-03', '2027-01-04'].map((d) => { const w = resultWeek(y, at(d + 'T12:00:00Z')); return `${goalResult(g, y, cis, w)?.text ?? 'none'}, ${quarterResults(g, y, cis, w)[3]!.text}`; }).join(' / '); } },
      { given: 'The same goal with its last check-in in week 46 (posted 11 November 2026): its status, and whether its check-in is due, on Sunday 3 January 2027 and on Monday 11 January.', then: 'No recent update, due / On track, not due', run: () => { const y = { id: 'y', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 }; const g = metric(4, 40, 'straight', { id: 'g37', ownerId: 'p', unit: 'pairs' }); const cis = [checkIn('g37', 46, 30, { postedAt: '2026-11-11T10:00:00Z' })]; return ['2027-01-03', '2027-01-11'].map((d) => { const t = at(d + 'T12:00:00Z'); return `${LABEL[goalStatus(g, y, cis, t).status]}, ${weekProgress('p', { goals: [g], checkIns: cis } as unknown as Snapshot, y, currentWeek(y, t), t).due.length ? 'due' : 'not due'}`; }).join(' / '); } },
    ],
    unclear: ['How long the wrap-up stays open after the year ends (four weeks) and how early it opens (two weeks) are choices, kept in RULES; the rebuild may tune them.'],
  },

  /* ---------- starting the next year (round 3, cycle end CY2) ---------- */
  {
    id: 'start-next-year',
    title: 'Starting the next year',
    summary: 'Which cycle everyone is in, what an admin’s start prepares and reads back first, and when it can be undone.',
    code: [
      { file: 'src/domain/cycle.ts', names: ['currentCycle', 'laterCycle', 'nextCycleShape', 'beforeStart', 'beforeStartLine', 'nextCycle'] },
      { file: 'src/domain/carry.ts', names: ['carryKind', 'carries', 'finalNumber', 'startReadBack'] },
      { file: 'src/domain/startYear.ts', names: ['startPage', 'startPageText'] },
      { file: 'src/domain/actions.ts', names: ['startNextCycle'] },
      { file: 'src/domain/removal.ts', names: ['startOf', 'canUndoStart', 'undoStart', 'deleteCycle'] },
    ],
    tests: ['src/domain/startYear.test.ts', 'src/domain/journeys.test.ts'],
    reqs: ['CARRY-GOALS', 'RESULTS'],
    body: `
**Which cycle everyone is in** (\`currentCycle\`): of the cycles not removed, the latest whose week 1 has begun (its start + 7 days, on or before today); if none has, the earliest. So the next year, set up during the wrap-up, opens for everyone on its week 1's Monday and never earlier, and a year nobody follows stays current after it ends (it has ended: rule “A year’s end”). A new workspace's only cycle is current from day one, in its week 0.

**Before a cycle's week 1** (\`beforeStart\`) nothing is due, and the screens say when it starts: "2027 starts on Mon 4 Jan 2027, in 2 weeks. Nothing is due until then." ("next week" from 7 days before, "on Monday" in the last week before), with the first check-ins' date (week 1's review day).

**What happens to each goal** (\`carryKind\`), in this order: it **stops** when its owner said so at the wrap-up, unless it finished anyway; a number goal whose plan runs past the year **keeps** its plan; it **finishes** when its result is Met or Met late, its last number has reached the target, every stage is done, or its owner called it done; otherwise it **carries** on. A goal with a limit never finishes: a limit is kept every year. Goals that carry on or keep their plan go into the next year; the rest stay in this one.

**The read-back** (\`startReadBack\`) counts every live goal once, from \`carryKind\`, so what it says is what the start makes: wrapped up and carrying on (of them, keeping their plan), finishing, stopping; and not wrapped up yet (of them, carrying on as they are, and finishing). The four add up to the year's live goals.

**Starting** (\`startNextCycle\`): admins only; from the day the wrap-up opens (or once the year has ended); once (a second start says who started it and when). The next cycle's week 0 is this one's last week, its length follows the calendar, and its name is the year's. The change that starts it keeps the goals it added, so it can be undone.

**Undo** (\`canUndoStart\`, \`undoStart\`): admins, while nobody has used the new cycle: no check-in in it, no goal in it changed or added by a person, and no later cycle. Undo removes it as a deleted cycle is (in Recently removed for 30 days); starting again makes a new one, and the removed one can then never come back. Delete refuses a started cycle and points to Undo.`,
    examples: [
      { given: '2026 (week 0 from 22 December 2025, 53 weeks) and 2027 (week 0 from 28 December 2026): the current cycle on Monday 21 December 2026, Sunday 3 January 2027 and Monday 4 January 2027; and with 2026 alone on Monday 11 January 2027.', then: '2026, 2026, 2027; 2026', run: () => { const a = { id: 'a', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 }, b = { id: 'b', name: '2027', startDate: '2026-12-28', weeks: 52, reviewDay: 3 }; return `${['2026-12-21', '2027-01-03', '2027-01-04'].map((d) => currentCycle([a, b], at(d + 'T12:00:00Z'))!.name).join(', ')}; ${currentCycle([a], at('2027-01-11T12:00:00Z'))!.name}`; } },
      { given: '2027 seen on Monday 21 December 2026.', then: '2027 starts on Mon 4 Jan 2027, in 2 weeks. Nothing is due until then. Your first check-ins are due Thu 7 Jan 2027.', run: () => beforeStartLine({ id: 'b', name: '2027', startDate: '2026-12-28', weeks: 52, reviewDay: 3 }, at('2026-12-21T12:00:00Z'), true) ?? 'nothing' },
      { given: 'Four 2026 goals: 4 → 40 pairs ending on 33; 0 → 70% whose last number is 72%; one called done; and 4 → 40 pairs its owner stopped at the wrap-up.', then: 'carry, finish, finish, stop', run: () => { const y = { id: 'y', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 }; const k = (g: Goal, cis: ReturnType<typeof checkIn>[], stop = false) => carryKind(g, { cycle: y, checkIns: cis, retro: stop ? { id: 'r', goalId: g.id, cycleId: 'y', result: 'missed', learned: 'x', next: 'stop', byId: 'p', at: '' } : null }).kind; return [k(metric(4, 40, 'straight', { id: 'a' }), [checkIn('a', 53, 33)]), k(metric(0, 70, 'straight', { id: 'b' }), [checkIn('b', 46, 72)]), k(metric(0, 95, 'straight', { id: 'c' }), [checkIn('c', 38, 95, { status: 'done' })]), k(metric(4, 40, 'straight', { id: 'd' }), [checkIn('d', 53, 33)], true)].join(', '); } },
      { given: 'A goal kept at most 12.0% that ended inside its limit, and a number goal whose plan runs to week 66 of a 53-week year.', then: 'carry, keep', run: () => { const y = { id: 'y', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 }; return [carryKind(RANGE, { cycle: y, checkIns: [checkIn('r', 53, 11)], retro: null }).kind, carryKind(metric(0, 60, 'straight', { id: 'k', plan: { start: 0, target: 60, shape: 'straight', fromWeek: 45, endWeek: 66 } }), { cycle: y, checkIns: [], retro: null }).kind].join(', '); } },
    ],
    unclear: ['A goal nobody wrapped up follows the rule (it carries on unless it met its target): the owner can still stop it during the wrap-up. Removing the copy of a goal stopped after the start is round 3’s CY4 (recarry).'],
  },

  /* ---------- levels (round 3, workspace settings CF1) ---------- */
  {
    id: 'levels',
    title: 'Levels',
    summary: 'Which levels a goal can have, what each is called, which is the everyday one, and how they sort: read from one place.',
    code: [{ file: 'src/domain/levels.ts', names: ['DEFAULT_LEVELS', 'levelsOf', 'levelIds', 'levelDef', 'isLevel', 'levelName', 'everydayLevel', 'isEveryday', 'isTop', 'levelRank', 'hasLevels', 'LEVEL_WORDS'] }],
    tests: ['src/domain/levels.test.ts', 'src/core/layers.test.ts'],
    reqs: ['LEVELS'],
    body: `
**A goal's level** is an id from its cycle's levels, top first. A cycle that sets none has Faro's three: North star (\`north-star\`), SVP (\`svp\`) and Team (\`team\`), each with the hint the goal form shows. Every rule, screen, export and tool asks \`src/domain/levels.ts\`; nothing else names a level (\`scripts/check-settings.mjs\` fails one that does).

- **The everyday level** is the last: goals at it carry no tag. Every other level is tagged, in one plain style.
- **The top level** is the first, when there are two or more: the map's roots sort it first. With one level nothing is tagged and there is no top.
- **Sorting by level** goes top first; a removed or unknown level sorts after every live one.
- **A removed level** keeps its name for History, and leaves the lists.`,
    examples: [
      { given: 'A cycle with no levels of its own.', then: 'North star, SVP, Team; everyday team; top north-star', run: () => `${levelsOf(null).map((l) => l.name).join(', ')}; everyday ${everydayLevel(null)}; top ${levelIds(null).find((l) => isTop(null, l))}` },
      { given: 'Levels Company (north-star), Group, Division (svp) and Team: a goal at svp, and one at team.', then: 'Division, rank 2, tagged; Team, not tagged', run: () => { const c = { levels: [{ id: 'north-star', name: 'Company', hint: '' }, { id: 'lv-1', name: 'Group', hint: '' }, { id: 'svp', name: 'Division', hint: '' }, { id: 'team', name: 'Team', hint: '' }] }; return `${levelName(c, 'svp')}, rank ${levelRank(c, 'svp')}, ${isEveryday(c, 'svp') ? 'not tagged' : 'tagged'}; ${levelName(c, 'team')}, ${isEveryday(c, 'team') ? 'not tagged' : 'tagged'}`; } },
      { given: 'One level, Team.', then: 'no levels to tell apart; nothing tagged; no top', run: () => { const c = { levels: [{ id: 'team', name: 'Team', hint: '' }] }; return `${hasLevels(c) ? 'levels' : 'no levels to tell apart'}; ${isEveryday(c, 'team') ? 'nothing tagged' : 'tagged'}; ${isTop(c, 'team') ? 'top' : 'no top'}`; } },
    ],
    unclear: ['Setting a workspace’s own levels (names, number, order) is CF2; until then every cycle has the three.'],
  },

  /* ---------- the carry rule (round 3, cycle end CY4) ---------- */
  {
    id: 'carry',
    title: 'The carry rule, and what comes with a goal',
    summary: 'How a goal that carries on is set up in the next year, what comes with it, and how its copy stays true until someone uses it.',
    code: [
      { file: 'src/domain/carry.ts', names: ['carryCopy', 'carryExtras', 'finalNumber'] },
      { file: 'src/domain/recarry.ts', names: ['recarry', 'withRecarry'] },
      { file: 'src/domain/copies.ts', names: ['copyUntouched', 'byRecarry'] },
      { file: 'src/domain/actions.ts', names: ['saveRetro'] },
    ],
    tests: ['src/domain/startYear.test.ts'],
    reqs: ['CARRY-GOALS'],
    body: `
**The copy** (\`carryCopy\`) has a new id, the new cycle, today's date, its key and everything else as it was. A number goal that **carries** starts from its **final number** (its last value at or before the year's last week; its starting number when it has none) in **week 1** (\`fromWeek\` 0), with the same target and shape, **due at the end of the new year**: no end week, no hand-set numbers, no earlier plans. So no carried plan turns round, starts late or is already met. One that **keeps** its plan keeps its dates, counted from the new year's start (week 45 of a 53-week year is week −8). The stages not done are spread evenly over the new year: stage *i* of *n* is due in week \`round((i + 1) × weeks / n)\`, never after its last week. A limit is unchanged. A goal whose parent carries feeds the parent's copy; otherwise it has no "Feeds into" (and no effect).

**What comes with it** (\`carryExtras\`): its metric link (same metric and team, linked by the same person); each watch of it or of its tree (same person); each open ask or next step on it, with the copy added, so it shows in both years; and each review that names it or its tree, with the copy added. The start keeps all of it, so Undo removes the watches and links it added and takes the copies back out of the asks and reviews.

**Keeping a copy true** (\`recarry\`, run by \`withRecarry\` on every save, from the app and the AI tools alike): whenever a save touches a goal of a year that has a later cycle (a check-in posted, corrected, deleted or restored; a wrap-up; its plan; stopped, removed or brought back; an import or its Undo), its kind is worked out again and, only while its copy is untouched (no check-in in it, no change to it by a person), the copy's plan or stages are replaced, or the copy leaves with what came with it (a goal stopped or removed in its own year leaves too) and its children's copies lose it as parent and their effect, or the copy comes back. A copy that left comes back as it was, the same ID and key, with its children's copies under it again; one a person removed stays removed. Copies are compared field by field, so a store's own order changes nothing. A wrap-up's "stop" for a goal whose copy has been used is refused: "It already has check-ins in 2027. Stop it there instead." Copies recarry added don't stop the start being undone, and Undo takes them out too.`,
    examples: [
      { given: 'A 2026 goal from 0.42 to 0.30 USD planned from week 45, with a number set by hand, whose final number is 0.37: its plan in 2027.', then: 'start 0.37, target 0.3, from week 0, no end week, no hand-set numbers', run: () => { const g = metric(0.42, 0.3, 'straight', { id: 'u', plan: { start: 0.42, target: 0.3, shape: 'straight', fromWeek: 45, points: [{ week: 50, value: 0.35 }] } }); const c = carryCopy(g, { old: { weeks: 53 }, next: { id: 'n', weeks: 52 }, checkIns: [checkIn('u', 53, 0.37)], id: 'u2', parentId: null, now: '2026-12-21T10:00:00Z' }) as MetricGoal; return `start ${c.plan.start}, target ${c.plan.target}, from week ${c.plan.fromWeek}, ${c.plan.endWeek == null ? 'no end week' : 'end week ' + c.plan.endWeek}, ${c.plan.points ? 'hand-set numbers' : 'no hand-set numbers'}`; } },
      { given: 'A goal with stages due in weeks 3 and 7, neither done, into a 52-week year; and with the first done.', then: 'due weeks 26, 52; due weeks 52', run: () => { const due = (cis: ReturnType<typeof checkIn>[]) => `due weeks ${(carryCopy(MILESTONE, { old: { weeks: 13 }, next: { id: 'n', weeks: 52 }, checkIns: cis, id: 's2', parentId: null, now: '' }) as typeof MILESTONE).stages.map((x) => x.dueWeek).join(', ')}`; return `${due([])}; ${due([checkIn(MILESTONE.id, 4, null, { stages: [{ stageId: 'a', doneWeek: 3 }] as never })])}`; } },
      { given: 'A goal planned from week 45 to week 66 of a 53-week year.', then: 'from week -8 to week 13', run: () => { const c = carryCopy(metric(0, 60, 'straight', { id: 'k', plan: { start: 0, target: 60, shape: 'straight', fromWeek: 45, endWeek: 66 } }), { old: { weeks: 53 }, next: { id: 'n', weeks: 52 }, checkIns: [], id: 'k2', parentId: null, now: '' }) as MetricGoal; return `from week ${c.plan.fromWeek} to week ${c.plan.endWeek}`; } },
    ],
    unclear: ['A copy recarry took out shows on Recently removed like any removed goal; restoring it there brings back the goal only, not what came with it, while its goal in the old year still says stop.'],
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
      { file: 'src/domain/templates.ts', names: ['reportedIn', 'stagesFromNow'] },
      { file: 'src/domain/importer.ts', names: ['setupDefaults', 'SETUP_DEFAULTS', 'ownerToAdd'] },
    ],
    tests: ['src/domain/workspace.test.ts', 'src/domain/setupTruth.test.ts', 'src/domain/setupUpload.test.ts'],
    reqs: ['WORKSPACE-ONE-PLACE', 'WORKSPACE-ABOUT', 'SETUP-UPLOAD'],
    body: `
**A cycle** (a goal year) says how many goals it has and how many check-ins were posted on them (removed ones don't count), and so whether it can be deleted: only when nobody has checked in to it **and** it isn't the only cycle. The only cycle always stays, so a new workspace's cycle says so rather than offering Delete. Each cycle shows its real first and last days (week 1's Monday to its last week's Sunday: \`cycleDates\`, rule “A year's end”) and whether it is running (with its week), ending (the wrap-up's weeks), ended (with its last day) or not begun; on Cycles as one word after its name (\`cycleLine\`), with its goals and check-ins (\"no check-ins yet\" for none).

**A team's people** are everyone in it, and its lead even when the lead's own team is another; the lead counts once.

**A workspace's name** is ${MIN_NAME} to ${MAX_WORKSPACE_NAME} characters, after trimming and joining spaces. Nothing cuts it short: the field counts the characters once a name is within 20 of the limit, and a longer name is refused with how long it is.

**Leaving.** Anyone may leave a workspace themselves. It is the same as an admin marking them as left (whoever takes over their goals and open asks is chosen first; they leave the reviews they were in), logged as "Name left the workspace". The only admin may not leave.

**Set-up says only what it was told** (deep review U2–U7). People typed are never replaced by a spreadsheet uploaded after them: the file's people come after, anyone already there (the same email, or the same name where either has no email) isn't added twice, and only a typed row's empty fields take the file's (\`mergePeople\`); the upload says what it added and can be undone. A template's stage weeks count from the week the workspace joins (\`stagesFromNow\`); so do a spreadsheet's, for any goal with a stage due before that week and no check-ins in the file: the import's preview asks (create mode's \`past-stage\`) and set-up answers "Count them from this week" unless changed to "Keep the weeks as typed" (\`setupDefaults\`, IM8). A goal with check-ins in the file keeps its weeks, unasked. An owner the People sheet lacks is a Must fix answered with "Add {name}" (\`ownerToAdd\`: the row's name, email and team join the people step) or "Give it to someone here". Set-up never asks who leads a team, so it names no lead; anything else that adds a team adds its first person as the lead. The invitation link names the workspace (\`/join/<id>\`; the old \`/?workspace=<id>\` leads there), and opening it opens that workspace and remembers it, whatever the browser had open. With no goals, nothing is said to be due.

**What an admin has to sort out** (About's "To sort out", for admins only; a member is shown nothing), in this order: no goals in the running cycle; no review that hasn't ended; the only admin, once the workspace has ${ONLY_ADMIN_FROM} people or more; people with no email; people in no team; teams of ${LEAD_FROM} people or more with no lead (set-up never asks who leads a team, so a small new team isn't told off). About shows the first ${NEEDS_SHOWN}; the rest open from "and {k} more". The year ending is Home's to say, and feedback is the builders' business.

**The workspace in words.** Its name is the stored name without the example's own "Example: ", with its kind as a quieter line: "example data", "kept in this browser" (made in the demo) or nothing (a real one). The admins are named A to Z as a sentence; beyond three, the first two and how many others. The Year fact says the week ("2026, week 46 of 53.") and when the wrap-up opens: the first day of the first week the wrap-up is open (\`wrapUpOpen\`), or, once it's open, how many goals are still to wrap up; once the year's last day is past, when it ended and until when the wrap-up stays open; a cycle not begun says when its week 1 starts.`,
    examples: [
      { given: 'A new workspace: one cycle, no goals, no check-ins.', then: 'No goals and no check-ins yet; it’s the only cycle, so it stays', run: () => cycleStanding({ ...workspace([]), goals: [] }, CYCLE.id).says },
      { given: 'The same workspace with a second cycle nobody has checked in to.', then: 'No goals and no check-ins yet: it can be deleted', run: () => cycleStanding({ ...workspace([]), goals: [], cycles: [CYCLE, { ...CYCLE, id: 'c2', name: 'Next' }] }, 'c2').says },
      { given: 'One goal with two check-ins, in the only cycle.', then: '1 goal, 2 check-ins: it stays', run: () => cycleStanding(workspace([ci('m', 1, 32), ci('m', 2, 34)]), CYCLE.id).says },
      { given: 'A team led by Lee, who is in it, with Pat in it too.', then: '2 people', run: () => `${teamPeople({ snapshot: workspace([]) }, 't').length} people` },
      { given: 'Theo Brandt (theo@) and Mina Okafor (no email) typed, then a file with THEO@, Mina Okafor (mina@) and Ana Silva uploaded.', then: 'Theo Brandt theo@example.com; Mina Okafor mina@example.com; Ana Silva ana@example.com', run: () => mergePeople([{ name: 'Theo Brandt', email: 'theo@example.com' }, { name: 'Mina Okafor', email: '' }], [{ name: 'Theo B.', email: 'THEO@example.com' }, { name: 'Mina Okafor', email: 'mina@example.com' }, { name: 'Ana Silva', email: 'ana@example.com' }]).map((x) => `${x.name} ${x.email}`).join('; ') },
      { given: 'A spreadsheet loaded at set-up in week 46 of 53: “Canary releases live” at Design@2; Pilot@6; All services@10, and “Later” at A@47; B@50, both Ben’s; set-up gives its default answer.', then: 'Canary releases live: Design@47; Pilot@50; All services@53 / Later: A@47; B@50', run: () => { const at = (answers?: Record<string, { choice: string }>) => buildWorkspace({ name: 'P', startDate: '2025-12-29', people: 'Name\tEmail\tTeam\nBen Ortiz\tben@example.com\tPlatform', goals: '', tables: { goals: [{ goal: 'Canary releases live', 'owner email': 'ben@example.com', type: 'milestone', stages: 'Design@2; Pilot@6; All services@10' }, { goal: 'Later', 'owner email': 'ben@example.com', type: 'milestone', stages: 'A@47; B@50' }] }, now: new Date('2026-11-10T09:00:00Z'), idSuffix: 'x', ...(answers ? { answers } : {}) }); const given = setupDefaults(at().groups, []); return at(Object.fromEntries(given.map((x) => [x.id, x.answer]))).snapshot.goals.map((g) => `${g.title}: ${g.kind === 'milestone' ? g.stages.map((st) => `${st.name}@${st.dueWeek}`).join('; ') : ''}`).join(' / '); } },
      { given: 'At set-up, a goal row owned by “nia.okoro@example.com” (Owner “Nia Okoro”, Team Depots) that nobody typed, answered “Add Nia Okoro”.', then: 'Nia Okoro nia.okoro@example.com Depots', run: () => { const o = ownerToAdd([{ goal: 'Night shift rota', team: 'Depots', 'owner email': 'nia.okoro@example.com', owner: 'Nia Okoro' }], { column: 'Owner email', found: 'nia.okoro@example.com' }, 'Platform'); return `${o.name} ${o.email} ${o.team}`; } },
      { given: 'A workspace name of 83 characters.', then: `Keep the name to ${MAX_WORKSPACE_NAME} characters or fewer: it has 83.`, run: () => nameProblem('x'.repeat(83), 'workspace') ?? 'fine' },
      { given: 'A workspace name of 62 characters, as it is typed.', then: `62 of ${MAX_WORKSPACE_NAME} characters`, run: () => nameLength('x'.repeat(62)) ?? 'nothing said' },
      { given: 'Lee, the only admin, leaves.', then: 'refused: You’re the only admin here: make someone else an admin before you leave.', run: () => { try { leaveWorkspace({ snapshot: workspace([]), cycle: CYCLE, week: 2, actor: workspace([]).people[1]!, now: '2026-10-08T12:00:00Z', newId: (p) => p + '_1' }); return 'left'; } catch (e) { return `refused: ${(e as Error).message}`; } } },
      { given: 'What Lee, the admin, has to sort out: two people, neither with an email, one goal, no review.', then: 'No review is set up; 2 people have no email', run: () => workspaceNeeds(workspace([]), CYCLE, true).map((x) => x.says).join('; ') },
      { given: 'The same, for Pat, who isn’t an admin.', then: 'nothing', run: () => workspaceNeeds(workspace([]), CYCLE, false).map((x) => x.id).join(', ') || 'nothing' },
      { given: 'The example’s name in the demo, and a workspace called “Growth” in the real app.', then: 'Platform Engineering (example data) / Growth', run: () => [workspaceName({ name: 'Example: Platform Engineering', kind: 'example' }, 'demo'), workspaceName({ name: 'Growth', kind: 'own' }, 'live')].map((w) => w.name + (w.kind ? ` (${w.kind})` : '')).join(' / ') },
      { given: 'Admins Hamid Rezaei, Amara Nwosu and Grace Achterberg; then 40 admins whose first two A to Z are Aiko Suzuki and Akosua Owusu.', then: 'Amara Nwosu, Grace Achterberg and Hamid Rezaei / Aiko Suzuki, Akosua Owusu and 38 others', run: () => [adminsLine(['Hamid Rezaei', 'Amara Nwosu', 'Grace Achterberg'].map((name) => ({ name, admin: true }))), adminsLine(['Aiko Suzuki', 'Akosua Owusu', ...Array.from({ length: 38 }, (_, i) => `Zed ${i}`)].map((name) => ({ name, admin: true })))].join(' / ') },
      { given: 'Cycles’ row for that year in week 46, with 126 goals and 3,200 check-ins; for a 2027 cycle (week 0 from Monday 28 December 2026) with nothing in it yet; and for 2026 on Monday 11 January 2027.', then: '2026 · running / Week 46 of 53 · 29 Dec 2025 to 3 Jan 2027 / 126 goals · 3,200 check-ins; 2027 · starts 4 Jan 2027 / 0 goals · no check-ins yet; 2026 · ended 3 Jan 2027 / 29 Dec 2025 to 3 Jan 2027 · 53 weeks', run: () => { const y = { name: '2026', startDate: '2025-12-22', weeks: 53 }; const a = cycleLine(y, true, 46, new Date('2026-11-11T12:00:00Z'), { goals: 126, checkIns: 3200 }); const b = cycleLine({ name: '2027', startDate: '2026-12-28', weeks: 52 }, false, 46, new Date('2026-11-11T12:00:00Z'), { goals: 0, checkIns: 0 }); const c = cycleLine(y, true, 53, new Date('2027-01-11T12:00:00Z'), { goals: 126, checkIns: 3200 }); return `${a.title} / ${a.when} / ${a.counts}; ${b.title} / ${b.counts}; ${c.title} / ${c.when}`; } },
      { given: 'A 53-week year starting Monday 22 December 2025: on Wednesday 11 November (week 46), on Tuesday 15 December (week 51), on Tuesday 22 December (week 52) with 31 goals not wrapped up, and on Monday 4 January 2027 with 88.', then: '2026, week 46 of 53. The wrap-up opens on 21 Dec 2026. / 2026, week 51 of 53. The wrap-up opens on 21 Dec 2026. / 2026, week 52 of 53. The wrap-up is open: 31 goals still to wrap up. / 2026 ended on Sun 3 Jan 2027. The wrap-up is open until Sun 31 Jan 2027: 88 goals still to wrap up.', run: () => { const c = { name: '2026', startDate: '2025-12-22', weeks: 53 }; return `${yearLine(c, 46, new Date('2026-11-11T12:00:00Z'), 30)} / ${yearLine(c, 51, new Date('2026-12-15T12:00:00Z'), 31)} / ${yearLine(c, 52, new Date('2026-12-22T12:00:00Z'), 31)} / ${yearLine(c, 53, new Date('2027-01-04T12:00:00Z'), 88)}`; } },
    ],
    unclear: ['When “You’re the only admin” starts to be said (five people) and when a team without a lead is (three people) are choices, not laws; the rebuild may tune them.', 'Leaving with no goals and no history still marks the person as left (they can be restored), unlike an admin deleting someone with no history.'],
  },

  /* ---------- the directory: People and Teams (app redesign WR1) ---------- */
  {
    id: 'directory',
    title: 'The directory: who People lists, what a search finds, and where old addresses lead',
    summary: 'People’s order and search, a page at a time; the line beside a person; a team’s people and goals by status; and where People’s and Teams’ old Workspace addresses now lead.',
    code: [{ file: 'src/domain/directory.ts', names: ['personLine', 'teamSummary', 'movedTo', 'DIRECTORY_PAGE'] }, { file: 'src/domain/find.ts', names: ['searchPeople', 'searchTeams', 'byName'] }],
    tests: ['src/domain/directory.test.ts'],
    reqs: ['PEOPLE-DIRECTORY', 'OLD-ADDRESSES'],
    body: `
**Who is listed.** Everyone in the workspace except people marked as left (or deleted), by name A to Z, ignoring case and accents; two people with one name are ordered by email, then ID. With a search, those whose name it starts come first, then the rest A to Z: People, every person picker and Find share this one search (finding things, rule 7, through the Search port). ${DIRECTORY_PAGE} at a time; a page past the end is the last page.

**What a search finds.** A person matches when every word typed starts a word of their name, their job title or their team’s name, ignoring case and accents (so “eng man” finds “Engineering Manager”, and “lucia” finds “Lucía”). Words are split at spaces and at the punctuation inside names (“Build & Release”, “Cloud Cost (FinOps)”). A team filter keeps the team’s people as \`teamPeople\` gives them: its lead counts, wherever their own team is; “no team” keeps people with no team or a team that is gone. Teams match on the team’s name or its lead’s, and are listed A to Z.

**A person’s line**, beside them in a list: “Admin”; then “leads the team” (their own), “leads {team}” (another, the first A to Z) or “leads {n} teams”; then their goals in the running cycle that aren’t stopped (“{n} goals”, “1 goal”, “no goals”). The first part takes a capital.

**A team’s summary**: its lead, its people (its lead among them) and its goals in the running cycle counted by status, worst first, from the same statuses Goals uses, so a team’s counts on People and under Goals’ By team are the same numbers.

**Old addresses.** /workspace/people leads to /people, keeping its query; with ?team=<id> it leads to that team’s page; /workspace/teams leads to /teams; /workspace#people and #teams to People and Teams. Each is a replace, not a new history entry.`,
    examples: [
      { given: 'The demo workspace on Wednesday 11 November: People with nothing asked.', then: '97 people; 1 to 50 of page 1 of 2; first Adaeze Obi', run: () => { const r = dirAsk({}); return `${r.total} people; ${r.from} to ${r.to} of page ${r.page} of ${r.pages}; first ${r.rows[0]!.name}`; } },
      { given: 'The same, page 9.', then: 'page 2: 51 to 97', run: () => { const r = dirAsk({ page: 9 }); return `page ${r.page}: ${r.from} to ${r.to}`; } },
      { given: 'Searching for “rhea”, “lucia” and “Romero”.', then: 'Rhea Kapoor / Lucía Romero / Lucía Romero', run: () => ['rhea', 'lucia', 'Romero'].map((q) => dirAsk({ q }).rows.map((p) => p.name).join(', ')).join(' / ') },
      { given: 'The CI/CD team’s people, and the admins.', then: '7 people / Amara Nwosu, Grace Achterberg, Hamid Rezaei', run: () => `${dirAsk({ teamId: 'cicd' }).total} people / ${dirAsk({ admins: true }).rows.map((p) => p.name).join(', ')}` },
      { given: 'Teams whose name or lead starts with “rhea”.', then: 'CI/CD', run: () => search(teamRows(dirWs()), { q: 'rhea' }).rows.map((t) => t.name).join(', ') },
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
      { given: 'Ana set up Field Operations today with Ben, gave Ben one goal and left two unowned; what Ana sees.', then: 'first-check-in, assign (Give 2 goals an owner.), invite', run: () => { const r = gettingStarted('ana', dayOneRows(dayOneWs(['ana', 'ana', 'ana', 'ben'])), DAY_WS, { firstSeenAt: DAY_MADE, unowned: ['g1', 'g2'] }, DAY_NOW, 'Thursday'); return r.map((x) => (x.id === 'assign' ? `assign (${x.says})` : x.id)).join(', '); } },
      { given: 'Ben opens it for the first time.', then: 'Ana Silva set up Field Operations on 11 Nov and gave you 1 goal. / first-check-in', run: () => { const r = gettingStarted('ben', dayOneRows(dayOneWs(['ana', 'ben'])), DAY_WS, { firstSeenAt: DAY_MADE }, DAY_NOW, 'Thursday'); return `${r[0]!.says} / ${r.slice(1).map((x) => x.id).join(', ')}`; } },
      { given: 'Ana, 15 days after her first visit.', then: 'nothing', run: () => gettingStarted('ana', dayOneRows(dayOneWs(['ana'])), DAY_WS, { firstSeenAt: DAY_MADE }, new Date('2026-11-26T15:00:00Z'), 'Thursday').map((x) => x.id).join(', ') || 'nothing' },
    ],
    unclear: ['Two weeks, and 28 days for a workspace to stop being new, are choices; the rebuild may tune them.', 'Which goals were left without an owner is kept per person (the Prefs port), not on the goal: a rebuild keeps it out of the goal’s record too.'],
  },

  /* ---------- Welcome and the invitation (set-up spec ST1) ---------- */
  {
    id: 'welcome',
    title: 'Welcome and the invitation',
    summary: 'Which workspace opens (only one someone chose), what an invitation is and what it opens, and what the arrival says about each person.',
    code: [{ file: 'src/domain/dayOne.ts', names: ['inviteLink', 'invitedTo', 'arrived'] }, { file: 'src/domain/arrival.ts', names: ['readInvitation', 'arrivalLine', 'arrivalIntro', 'draftStopped'] }, { file: 'src/domain/actions.ts', names: ['arrive'] }],
    tests: ['src/domain/dayOne.test.ts', 'src/app/invitation.test.tsx'],
    reqs: ['SETUP-FIRST-SCREEN', 'IDENTITY'],
    body: `
**Only a workspace someone chose opens.** One this device remembers (the last opened), or the one an invitation names. A device that remembers none opens Welcome, at \`/welcome\`, never the first workspace the store lists. An invitation to a workspace that isn't there opens nothing else: it says so.

**An invitation** is the address \`/join/<workspace>\` (under \`/demo\` in the demo). The link copied before, \`/?workspace=<id>\`, leads there. Opening it opens that workspace and remembers it on the device; someone already known there goes to Home, anyone else to the arrival. Pasted into Welcome, only this site's \`/join/…\` or \`/?workspace=…\` is an invitation; anything else is "That isn't a Faro invitation."

**The arrival** says who set the workspace up, when, and how many people and goals it has, then lists everyone by team with one true line each: "Set this up · admin" (whoever set it up), "Admin", "Owns {n} goals", or "No goals yet". Choosing a name is the action.

**Arriving is logged once.** The first time someone chooses their name, the log gains "{name} opened {workspace} for the first time": a change on the person, \`acknowledged\`, by them. Choosing again (another device) adds nothing; whoever set it up has arrived already. No record changes and nothing new is stored, so no migration. In the internal app the first sign-in writes it (R1, rule 11).
`,
    examples: [
      { given: 'The invitation to ws_n0g3rv, in the real app and in the demo.', then: 'https://faro.example/join/ws_n0g3rv / https://faro.example/demo/join/ws_n0g3rv', run: () => `${inviteLink('https://faro.example', 'live', 'ws_n0g3rv')} / ${inviteLink('https://faro.example', 'demo', 'ws_n0g3rv')}` },
      { given: 'The workspace /join/ws_a and the old /?workspace=ws_b name.', then: 'ws_a, ws_b', run: () => `${invitedTo('/join/ws_a', '')}, ${invitedTo('/', '?workspace=ws_b')}` },
      { given: 'https://elsewhere.example/join/ws_a, pasted into Welcome on https://faro.example.', then: 'That isn’t a Faro invitation. It looks like https://faro.example/join/…', run: () => { const r = readInvitation('https://elsewhere.example/join/ws_a', 'https://faro.example'); return 'problem' in r ? r.problem : r.id; } },
      { given: 'The arrival’s lines for Ana (set it up), Ben (owns 1 goal) and Cara (owns none); and its opening line, 3 people and no goals.', then: 'Set this up · admin / Owns 1 goal / No goals yet / Ana Silva set this up on 11 Nov to keep the team’s goals in one place: 3 people, no goals yet.', run: () => [arrivalLine({ id: 'ana', admin: true }, 'ana', 0), arrivalLine({ id: 'ben', admin: false }, 'ana', 1), arrivalLine({ id: 'cara', admin: false }, 'ana', 0), arrivalIntro({ name: 'Field Operations', createdAt: '2026-11-11T10:00:00Z' }, 'Ana Silva', 3, 0)].join(' / ') },
      { given: 'Has Ben arrived before and after his arrival is logged; has Ana, who set it up?', then: 'no / yes / yes', run: () => { const made = { entity: 'workspace' as const, action: 'imported' as const, entityId: 'ws', summary: 'Created “Field Operations”', actorId: 'ana' }; const ppl = [{ id: 'ana', admin: true }, { id: 'ben', admin: false }]; const came = { entity: 'person' as const, action: 'acknowledged' as const, entityId: 'ben', summary: 'Ben Carter opened Field Operations for the first time', actorId: 'ben' }; return [arrived('ben', [made], ppl), arrived('ben', [made, came], ppl), arrived('ana', [made], ppl)].map((b) => (b ? 'yes' : 'no')).join(' / '); } },
    ],
    unclear: ['Faro lets anyone with the link choose any name, the admin’s included: the internal app replaces the arrival with the first sign-in (R1, rules 9 to 11).', 'What a device remembers (each workspace and who you are there) is kept in the browser; the internal app keeps it with the signed-in person.'],
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

**The kinds.** *Check-ins*: the week entries, missed weeks included. *Comments*: comments, and asks raised outside a review. *Reviews*: what a review said (looked at it, a note, a question or next step agreed in it, an ask answered in it). Whether an ask was raised in a review is the ask's own record of the review (its \`reviewId\`), never the review's name in its sentence, so renaming a review moves none of its past asks. *Changes*: everything else the change log holds for the goal (its plan, target, owner, team, level, links, metric; stopped, restored).

**Counts.** Per kind and for All, which is their sum; a run of missed weeks counts as its weeks, a group as its weeks.

**Order.** Newest first; a week's entry sits at the end of its week, so this week's is at the top.

**Searching** keeps the entries whose words match ([finding things](finding.md), rule 1).`,
    examples: (() => {
      const g = { ...g3075, createdAt: '2026-09-07T09:00:00Z' };
      const run = (weeks: number[], now: number, filter: 'all' | 'checkins' = 'checkins') => goalHistory({ goal: g, checkIns: weeks.map((w) => ci(g.id, w, 40, { why: `Reason ${w}` })), changes: [], cycle: CYCLE, week: now, asks: [] }, filter);
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

  /* ---------- Goal entry: one set of rules at every door (goal entry spec, rules 1, 2, 4, 7 and 12; GE1) ---------- */
  {
    id: 'goal-entry',
    title: 'Goal entry',
    summary: 'What a goal needs, what can’t be saved and who may save it: one rule for New goal, the edit page, set-up’s cards, a spreadsheet’s Goals rows and the AI tools, in the same words.',
    code: [
      { file: 'src/domain/goalEntry.ts', names: ['fieldNeed', 'formNeed', 'stepSays', 'goalMustFix', 'decimalsFor', 'goalChecks', 'CHECK_IDS', 'checksContext', 'sameNamedIn', 'checkedDiffs', 'stepState', 'planGoal', 'REASON_EMPTY'] },
      { file: 'src/domain/checkin.ts', names: ['unanswered', 'answeredDiffs'] },
      { file: 'src/domain/plan.ts', names: ['lateShare'] },
      { file: 'src/domain/goalRights.ts', names: ['mayAddGoal', 'mayChangeGoal'] },
      { file: 'src/domain/numbers.ts', names: ['numberAsTyped', 'parseNumber'] },
      { file: 'src/domain/goal.ts', names: ['decimalsFor', 'draftFor'] },
    ],
    tests: ['src/domain/goalEntry.test.ts', 'evals/goalEntry.eval.ts'],
    reqs: ['GOAL-ENTRY-REQUIRED'],
    body: `
Every way a goal comes in asks the same rule, in the same words: New goal, the edit page, set-up's goal cards, a Goals row of a spreadsheet, Data or a bulk edit (the change engine, \`planChanges\`), and the AI tools (which use the change engine). The form saves through \`planGoal\`, run by the \`saveGoal\` action, so it can't save what the engine would refuse.

**Who may (rule 7).** Anyone may add a goal for anyone, at any level, at every door (Lane, 11 Nov: \`mayAddGoal\` is always yes, and is the one place that is said). Changing a goal stays with its owner and admins (\`mayChangeGoal\`), whoever made it; New goal says so as soon as someone else is chosen as owner: “Amara will own it. After it is published, only Amara or an admin can change it.”

**What a field needs (rule 1).** Read from the spreadsheet's field table (\`fieldNeed\`): required, optional, worked out, or not asked for this type. In the form, a field that always shows a value (the type, the team, the level, which side a range keeps to) is required. Optional fields say “· optional” after their label; a step with two or more required fields and at least one optional says “${'Everything here is needed unless it says optional.'}” under its heading. The unit is optional and starts empty: a number has no unit by default, never “%”.

**What can't be saved (rule 2, \`goalMustFix\`).** Each problem is under its own field, in the form's order. The name (at least three characters), an owner, a team (“{Owner} isn’t in a team. Choose the team this goal is for.” when the owner has none), a level, a link that would make a loop; for a number to move, where it starts (“Enter where it starts today.”; on the edit page “Enter where it starts.”) and a target that differs from it (“The target is the same as today (40%). To hold a number where it is, make this a number to keep in range.”, offering to); for a range, the limit, and a warning margin of zero or more (empty is none); for a number to move, a To after its From and neither beyond the weeks offered (“To (week 40, 28 Sep–4 Oct 2026) isn’t after From (week 46, 9–15 Nov 2026). The plan has to run forwards.”); for stages, at least one, each with a name, a name no other stage has (compared without case or accents), and a due week in the year. A stage done in a check-in can't be removed, and fewer decimal places than check-ins already have is refused.

**A number as typed (rule 12, \`numberAsTyped\`).** Digits as people type them (a decimal comma, thousands, a sign); words after it only when they are the goal's unit (“12 days” in a days goal, with min and mins, day and days, hr and hours the same; “12%” in a % goal). Anything else after the digits is “has words”: “12 days” has words in it. Type the number only, like 12; this goal counts %. Letters in place of digits are “not a number”, with an example at the goal's decimal places.

**Decimals, worked out (\`decimalsFor\`).** The places chosen; or, when none were, the most typed in Today, Target or Limit, at most 3, said in one line (“Kept to 1 decimal place, as you typed them.”) with Change. A number with more places than chosen is refused, offering to keep them.

**What is asked (rule 3, \`goalChecks\`).** What is possible but unlikely is a question, never a refusal: a Check, in the same block as the check-in's, under the field it is about, with two answers, the first keeping what was typed. In this order, each that applies, and only once the fields it is about have no Must fix: a stage already past (“Week 43 was 2 weeks ago. Is this stage already done?”, either answer an answer); no unit (“This number has no unit. Is it a plain count?”, asked once); a number below zero for a percentage, time or money; over 100% (“The target is over 100%. That’s fine for growth, but a share of something (coverage, adoption) can’t pass 100%. Is 150% right?”); a target ${FAR_RATIO} times its start or more, or a ${FAR_RATIO}th; a billion or more; a target on the worse side of the start for the metric chosen to measure it (““Pipeline queue wait” is better lower, but the target (9 min) is above today (7 min). Is that the plan?”: the metric the form chose, from the goal.measure place, else the one that measures the goal now, which a module says through its records' \`measures\` (\`goalMeasureOf\`), so the saving rule, a spreadsheet's rows and the AI tools ask it of a goal already measured); the same name in the same team; an owner in another team (“Amara is in Office of the VP, not Build & Release. Which team is this goal for?”, whose second answer moves it); a link to a goal at a lower level (whose second answer removes the link); a warning margin as wide as the limit; weeks set by hand that leave more than 60% of the change to the last quarter of the plan's weeks (\`lateShare\`); and, for a goal being changed, a target that flips which way is better or a number far outside the old plan (\`planQuestion\`). An answer is kept in the draft as the values it was about (\`answers[slot] = key\`), so changing them asks again (\`unanswered\`, shared with the check-in); answered, the block collapses to “You said 150% is right.” with Change. A goal already saved isn't asked again about what it already says. The import asks the same questions in the same words (an unlikely number, a link to a lower level), keeping its own forms of no unit, the same name and stages already past; a file's Team column says the team in so many words, so an owner in another team is asked only in the form. The AI tools list every question goal by goal (“Not saved. Check with the person first: …”) and take \`confirm: true\` as yes to each. About a number goal's weeks (the [years and weeks](years-and-weeks.md) rules): a From before this week (“Week 40 was 6 weeks ago. Has this been running since then? The plan would expect 39 min by this week.”, whose second answer starts it this week), a To already past, and a plan longer than 53 weeks; a file is asked only the last. The question about a metric's latest number (\`far-from-metric\`) waits for the metrics module to keep one for a slice; a file is asked \`wrong-side\` once the import reads Measured by.

**Whether a step goes on (rule 4, \`stepState\`).** The button is never disabled. Pressed with a Must fix on its step, every field of the step shows its own, focus goes to the first, and one line above the button counts them: “2 things to fix above: Unit and Target.” (more than three: the first two “and {k} more”), the same line the check-in uses. A Must fix shows under a field once it has been changed and left, never while typing. With none, an unanswered question holds the step: focus goes to it and the line reads “Answer the question above, under Target.” (several: “Answer the 2 questions above.”; \`openLine\`). The edit page's Save changes does the same.

**Saving (rule 7, \`planGoal\`).** Refused, in these words, unless the actor may, nothing must be fixed, every question is answered (“Not saved. Check with the person first: …”, with the questions' words), and a plan change after check-ins have started has a reason (“${'Say why, in a sentence. It goes in the goal’s History, and anyone watching it sees the change flagged.'}”). Then one commit: the goal (a new one with the workspace's next key), its History entry with Why and each answer as *Checked* (the question, then the answer given), and a new goal's stages already done (only those due before this week, whatever the draft says).`,
    examples: (() => {
      const blank = (o: Partial<GoalDraft>): GoalDraft => ({ ...blankGoal('cicd', 'tunde', ''), title: 'Signed artifacts', ...o });
      const fixes = (d: GoalDraft, extra: Partial<Parameters<typeof goalMustFix>[1]> = {}) => goalMustFix(d, { cycleWeeks: 53, week: 45, existing: null, door: 'form', ...extra }).map((f) => `${f.id}: ${f.text}`).join(' / ') || 'nothing';
      const asTyped = (raw: string, unit: string) => { const r = numberAsTyped(raw, unit); return 'n' in r && !('problem' in r) ? String(r.n) : (r as { problem: string }).problem; };
      return [
        { given: 'Unit and Start for a number to move; Unit for dated stages; Margin for a range (the field table’s needs).', then: 'required as start, optional as unit; not-asked; optional', run: () => `${fieldNeed(fieldNeedOf('goals', 'Start'), 'metric')} as start, ${formNeed('unit', 'metric')} as unit; ${formNeed('unit', 'milestone')}; ${formNeed('margin', 'range')}` },
        { given: 'Whether step 3 of a number goal with no metric, and step 1, say “Everything here is needed unless it says optional.”', then: 'yes; no', run: () => [stepSays(stepFields(2, 'metric'), 'metric'), stepSays(stepFields(0, 'metric'), 'metric')].map((x) => (x ? 'yes' : 'no')).join('; ') },
        { given: '“12”, “1,250.5”, “29,4”, “12%” in a % goal; “12 days” in a days goal, “12 mins” in a min goal; “12 days” in a % goal and with no unit; “12%” in a days goal; “abc”, “1.2.3”, “12-”.', then: '12, 1250.5, 29.4, 12; 12, 12; has-words, has-words; has-words; not-number, not-number, not-number', run: () => [[['12', '%'], ['1,250.5', '%'], ['29,4', '%'], ['12%', '%']], [['12 days', 'days'], ['12 mins', 'min']], [['12 days', '%'], ['12 days', '']], [['12%', 'days']], [['abc', ''], ['1.2.3', ''], ['12-', '']]].map((g) => g.map(([r, u]) => asTyped(r!, u!)).join(', ')).join('; ') },
        { given: 'A name of “ab”.', then: 'name-short: Give the goal a name of at least three characters.', run: () => fixes(blank({ title: 'ab', start: '1', target: '2' })) },
        { given: 'A number goal, unit %, today “12 days”, target 30.', then: 'has-words: “12 days” has words in it. Type the number only, like 12; this goal counts %.', run: () => fixes(blank({ unit: '%', start: '12 days', target: '30' })) },
        { given: 'Unit “days”, today “12 days”, target 5.', then: 'nothing', run: () => fixes(blank({ unit: 'days', start: '12 days', target: '5' })) },
        { given: 'Unit %, today “1,5”, target 3, decimals not chosen; then decimals chosen as whole numbers.', then: 'nothing / too-precise: 1,5 has 1 decimal place, but this goal keeps whole numbers, so it would show as 2. Type 2, or keep 1 decimal place for this goal.', run: () => [fixes(blank({ unit: '%', start: '1,5', target: '3' })), fixes(blank({ unit: '%', start: '1,5', target: '3', decimals: '0' }))].join(' / ') },
        { given: 'Today “abc”, target 30, whole numbers.', then: 'not-number: “abc” isn’t a number. Type digits only, like 29.', run: () => fixes(blank({ start: 'abc', target: '30', decimals: '0' })) },
        { given: 'Today 40, target 40, unit %.', then: 'same-as-start: The target is the same as today (40%). To hold a number where it is, make this a number to keep in range.', run: () => fixes(blank({ unit: '%', start: '40', target: '40' })) },
        { given: 'Stages “Design” in week 48 and “design ” in week 50; then “Design” with no week.', then: 'stage-twice: Two stages are called “Design”. Give each its own name, such as “design review”. / stage-week: Choose the week “Design” is due.', run: () => [fixes(blank({ kind: 'milestone', stages: [{ id: 'a', name: 'Design', dueWeek: '48' }, { id: 'b', name: 'design ', dueWeek: '50' }] })), fixes(blank({ kind: 'milestone', stages: [{ id: 'a', name: 'Design', dueWeek: '' }] }))].join(' / ') },
        { given: 'A file’s stage “Design” due in week 60 of a 53-week year.', then: 'stage-week: “Design” needs a due week between 1 and 53: it says “60”.', run: () => fixes(blank({ kind: 'milestone', stages: [{ id: 'a', name: 'Design', dueWeek: '60' }] }), { door: 'table' }) },
        { given: 'An owner in no team, the team empty.', then: 'team-empty: Amara Nwosu isn’t in a team. Choose the team this goal is for.', run: () => fixes(blank({ teamId: '', ownerId: 'amara', start: '1', target: '2' }), { owner: { name: 'Amara Nwosu', teamId: null } }) },
        { given: 'A range with a warning margin of −1.', then: 'margin-negative: Enter a warning margin of zero or more, or leave it empty.', run: () => fixes(blank({ kind: 'range', limit: '12', margin: '-1' })) },
        { given: 'Step 3 with Unit empty but no Today, and Target “30 mins” in a % goal; four Must fix on one step.', then: '2 things to fix above: Baseline and Target. / 4 things to fix above: Baseline, Target and 2 more.', run: () => [goalStepState(2, goalMustFix(blank({ unit: '%', target: '30 mins' }), { cycleWeeks: 53, week: 45, existing: null, door: 'form' })).says, goalStepState(2, [{ field: 'start', id: 'start-empty', text: '' }, { field: 'target', id: 'target-empty', text: '' }, { field: 'limit', id: 'limit-empty', text: '' }, { field: 'margin', id: 'margin-negative', text: '' }]).says].join(' / ') },
        { given: 'The questions, in order: −5 → 5%; 10 → 1,500%; 5 → 2 days; no unit, 1 → 5.', then: 'below-zero; over-100, hundredfold; nothing; no-unit', run: () => [{ start: '-5', target: '5' }, { start: '10', target: '1500' }, { unit: 'days', start: '5', target: '2' }, { unit: '', start: '1', target: '5' }].map((o) => goalChecks(blank({ unit: '%', ...o }), { week: 45, cycleWeeks: 53, existing: null, door: 'form' }).map((c) => c.id).join(', ') || 'nothing').join('; ') },
        { given: '50 → 150%, answered yes; then the target changed to 160.', then: 'The target is over 100%. That’s fine for growth, but a share of something (coverage, adoption) can’t pass 100%. Is 150% right? / answered / asked again', run: () => {
          const at = (t: string) => goalChecks(blank({ unit: '%', start: '50', target: t }), { week: 45, cycleWeeks: 53, existing: null, door: 'form' });
          const answers = { 'over-100': at('150')[0]!.key };
          return [at('150')[0]!.question, goalUnanswered(at('150'), answers).length ? 'open' : 'answered', goalUnanswered(at('160'), answers).length ? 'asked again' : 'answered'].join(' / ');
        } },
        { given: 'A range at most 12% warning within 20; then within 1.', then: 'With a limit of 12% and a warning 20% away, it would almost always read at risk. Is 20 right? / nothing', run: () => ['20', '1'].map((m) => goalChecks(blank({ kind: 'range', unit: '%', limit: '12', margin: m }), { week: 45, cycleWeeks: 53, existing: null, door: 'form' })[0]?.question ?? 'nothing').join(' / ') },
        { given: 'A north star feeding a Team goal; an SVP goal feeding an SVP goal; Amara (Office of the VP) as owner in Build & Release.', then: 'A north star usually feeds nothing, and “Flaky test rate” is a Team goal. Is this link right? / nothing / Amara is in Office of the VP, not Build & Release. Which team is this goal for?', run: () => {
          const q = (d: Partial<GoalDraft>, o: object) => goalChecks(blank({ unit: '%', ...d }), { week: 45, cycleWeeks: 53, existing: null, door: 'form', ...o })[0]?.question ?? 'nothing';
          return [q({ level: 'north-star', parentId: 'p' }, { parent: { id: 'p', title: 'Flaky test rate', level: 'team' } }), q({ level: 'svp', parentId: 'p' }, { parent: { id: 'p', title: 'Flaky test rate', level: 'svp' } }), q({ ownerId: 'amara' }, { owner: { name: 'Amara Nwosu', teamId: 'vp', teamName: 'Office of the VP' }, team: { id: 'cicd', name: 'Build & Release' } })].join(' / ');
        } },
        { given: 'Weeks set by hand from 10 to 5 over 7 weeks: 10, 10, 10, 10, 9, 8; then a back-loaded shape with none set by hand.', then: 'This plan leaves 80% of the change to the last 2 of 7 weeks. Is that the plan? / nothing', run: () => {
          const points = Object.fromEntries([10, 10, 10, 10, 9, 8].map((v, i) => [String(i + 1), String(v)]));
          return [blank({ unit: 'days', start: '10', target: '5', endWeek: '7', fromWeek: '0', points }), blank({ unit: 'days', start: '10', target: '5', endWeek: '7', fromWeek: '0', shape: 'back' })].map((d) => goalChecks(d, { week: 45, cycleWeeks: 53, existing: null, door: 'form' })[0]?.question ?? 'nothing').join(' / ');
        } },
        { given: 'Step 3 with 50 → 150% unanswered; then with −5 → 5% too.', then: 'Answer the question above, under Target. / Answer the 2 questions above.', run: () => {
          const c = (d: Partial<GoalDraft>) => goalChecks(blank({ unit: '%', ...d }), { week: 45, cycleWeeks: 53, existing: null, door: 'form' });
          return [goalStepState(2, [], c({ start: '50', target: '150' })).says, goalStepState(2, [], [...c({ start: '50', target: '150' }), ...c({ start: '-5', target: '5' })]).says].join(' / ');
        } },
        { given: 'The questions goal entry asks, in their order.', then: CHECK_IDS.join(', '), run: () => CHECK_IDS.join(', ') },
        { given: 'In the demo’s 2026, week 46: baseline 42 min, target 30, From week 40, To week 66; then From 30, To 93 (week 40 of 2027).', then: 'Week 40 was 6 weeks ago. Has this been running since then? The plan would expect 39 min by this week. / This plan runs 63 weeks, to week 40 of 2027. Is that right?', run: () => {
          const ask = (fromWeek: string, endWeek: string) => goalChecks(blank({ unit: 'min', start: '42', target: '30', fromWeek, endWeek }), { week: 46, cycleWeeks: 53, existing: null, door: 'form', startDate: '2025-12-22' }).filter((c) => c.id === 'from-past' || c.id === 'long-plan');
          return [ask('40', '66')[0]?.question, ask('30', '93').find((c) => c.id === 'long-plan')?.question].join(' / ');
        } },
        { given: 'A file’s From 2026-W46 and To 2026-W40, read as weeks 46 and 40.', then: 'to-before-from: To (week 40, 28 Sep–4 Oct 2026) isn’t after From (week 46, 9–15 Nov 2026). The plan has to run forwards.', run: () => fixes(blank({ unit: 'min', start: '42', target: '30', fromWeek: '46', endWeek: '40' }), { week: 46, startDate: '2025-12-22' }) },
        { given: 'Tunde (not an admin) saves a new north star owned by Amara through the saveGoal action; then a spreadsheet row of the same; then Tunde changes a goal Amara owns.', then: 'saved, G-127 owned by amara / no problems / refused: Only Rhea Kapoor (its owner) or an admin can change', run: () => {
          const tables = { goals: [rec({ Goal: 'A north star for Amara', Owner: 'Amara Nwosu', Level: 'North star', Unit: '%', Start: '10', Target: '20' })] };
          const made = asPerson('tunde', (x) => { const o = planGoal(x, { draft: { ...blankGoal('cicd', 'amara', ''), title: 'A north star for Amara', level: 'north', unit: '%', start: '10', target: '20' }, confirm: true }); return `saved, ${o.goal.key} owned by ${o.goal.ownerId}`; });
          const theirs = demo!.goals.find((g) => g.ownerId !== 'tunde')!;
          const refused = asPerson('tunde', (x) => planGoal(x, { draft: { ...blankGoal(theirs.teamId, 'amara', ''), title: 'Renamed' }, goalId: theirs.id }));
          return [made, issues(change('tunde', tables)), String(refused).replace(/ “.*$/, '')].join(' / ');
        } },
      ];
    })(),
  },

  /* ---------- Years and weeks (goal entry, rule 13; GE9) ---------- */
  {
    id: 'years-and-weeks',
    title: 'Years and weeks',
    summary: 'A goal’s weeks are counted from its cycle’s start and shown as a goal year’s week with its dates and their year; one rule converts each way, for the picker, the sheet and the AI tools.',
    code: [
      { file: 'src/domain/weeks.ts', names: ['yearWeek', 'cycleWeek', 'weekCode', 'readWeekCode', 'weekSays', 'weeksProblem', 'lastWeekOffered', 'firstWeekOffered', 'defaultTo', 'startsSays'] },
      { file: 'src/domain/weekChoices.ts', names: ['planSays', 'readWeek', 'weekIs', 'weekChoices', 'spanSays', 'rangeSays'] },
      { file: 'src/domain/plan.ts', names: ['notStarted'] },
      { file: 'src/domain/progress.ts', names: ['firstDueWeek'] },
      { file: 'src/domain/status.ts', names: ['daysWithoutUpdate'] },
      { file: 'src/domain/carry.ts', names: ['carryCopy'] },
    ],
    tests: ['src/domain/weeks.test.ts'],
    reqs: ['GOAL-DATES'],
    body: `
**What is kept.** Nothing in the data changes: a plan's From (\`fromWeek\`), its To (\`endWeek\`) and a stage's due week stay whole numbers counted from the cycle's start, week 0 being the week before week 1. People never see those numbers bare: they see a goal year and its week, always with the dates and the year.

**A goal year** runs from its week 1 (the week holding the first Thursday of the month the year starts in) to the week before the next one's week 1: 52 or 53 weeks. In a year that starts in January its year and week are the ISO week date. The cycle's own goal year holds weeks 1 to its last; a later cycle week is in the next goal year (in the demo's 2026, week 54 is week 1 of 2027) and week 0 and below in the previous one (week 0 is week 52 of 2025). A cycle shorter than a goal year (under 48 weeks) names every week by its dates alone, the ISO week date: 13 weeks from 30 March 2026 hold 2026 weeks 15 to 27, and its week 14 is 2026 week 28.

**Said.** In a field “Week 46 · 9–15 Nov 2026”; in a list under its year “Week 46 · 9–15 Nov”; in a sentence “week 46 (9–15 Nov 2026)”, or “week 13 of 2027 (29 Mar–4 Apr 2027)” in another goal year; in a file \`2026-W46\`. Under a picked week, what it is: “This week”, “Next week”, “The end of 2026”, “The end of Q1 2027”, “6 weeks ago”.

**Picked, never typed** (the week picker). From offers the first week of last year to the last of next year; To the week after From to the same end; a stage's Due this goal year only; each with up to three named weeks (for To: the end of this quarter, the end of the year, the end of Q1 next year). Typing in the picker reads a week of the year shown (“50”), a day (“14 Dec”, the next such day) or a year and a week (“2027 5”). A file or a tool gives \`2026-W46\`, or the cycle's week number as before. To left unsaid is the cycle's last week, or, for a From at or past it (a new goal in the year's last week), the end of next year (\`defaultTo\`).

**The sheet.** From and To beside Plan from week and Due week, which still load; where both of a pair are given, the one that differs from the goal counts, and two that differ and disagree are a Must fix (“From says 2026-W46 and Plan from week says 40. Change just one of them.”). An empty Due week beside a To says nothing. In a file with no Start column, a bare number under From may be the starting number (the export's Start renamed): it is a Must fix asking which (“From says “52”: a starting number, or a week? …”), never read as a week. A week a year doesn't have: “2027 has 52 weeks. Use 2027-W52, or 2028-W01.”

**A plan that hasn't started.** A number goal whose From is still to come (\`notStarted\`) is not due for a check-in and not late until that week; it reads “No check-in yet · starts week 50”. No new status.

**Carried.** A number goal carried into the next year starts from its last number in week 0 of the new year, so its plan is not flat for the weeks it already ran.`,
    examples: (() => {
      const y26 = { startDate: '2025-12-22', weeks: 53 };
      const at = (n: number) => { const y = yearWeek(y26, n); return `${y.year} week ${y.week}`; };
      return [
        { given: 'The demo’s 2026 (from Monday 22 Dec 2025, 53 weeks): cycle weeks 46, 53, 54, 66, 105, 1, 0 and −12.', then: '2026 week 46; 2026 week 53; 2027 week 1; 2027 week 13; 2027 week 52; 2026 week 1; 2025 week 52; 2025 week 40', run: () => [46, 53, 54, 66, 105, 1, 0, -12].map(at).join('; ') },
        { given: 'Weeks 46, 53 and 1 in a field; 66 in a sentence; 54 in a file.', then: 'Week 46 · 9–15 Nov 2026 / Week 53 · 28 Dec 2026–3 Jan 2027 / Week 1 · 29 Dec 2025–4 Jan 2026 / week 13 of 2027 (29 Mar–4 Apr 2027) / 2027-W01', run: () => [weekSays(y26, 46, 'field'), weekSays(y26, 53, 'field'), weekSays(y26, 1, 'field'), weekSays(y26, 66, 'sentence'), weekCode(y26, 54)].join(' / ') },
        { given: 'Week 13 of 2027; week 53 of 2027.', then: '66 / 2027 has 52 weeks. Use 2027-W52, or 2028-W01.', run: () => { const r = readWeekCode(y26, '2027-W53'); return `${cycleWeek(y26, { year: 2027, week: 13 })} / ${'text' in r ? r.text : ''}`; } },
        { given: 'Typed in the picker in week 46: “14 Dec”; “3 Jan”; “5” with 2027 shown.', then: '51; 53; 58', run: () => [readWeek(y26, 46, '14 Dec', 2026), readWeek(y26, 46, '3 Jan', 2026), readWeek(y26, 46, '5', 2027)].join('; ') },
        { given: 'The named weeks for To, From week 46; for From.', then: 'The end of 2026 (53), The end of Q1 2027 (66), The end of 2027 (105) / This week (46), The start of this quarter (40), The start of 2026 (1)', run: () => [weekChoices(y26, 46, 'to', 46), weekChoices(y26, 46, 'from')].map((c) => c.named.map((x) => `${x.name} (${x.n})`).join(', ')).join(' / ') },
        { given: 'The line under the numbers: From 46 to 66; From 50 to 53, in week 46.', then: '20 weeks. It runs past the end of 2026 and carries into 2027 with this plan. / 3 weeks. It starts in week 50 (7–13 Dec 2026). Until then nothing is due, and it reads “No check-in yet · starts week 50”.', run: () => [spanSays(y26, 46, 66, 46), spanSays(y26, 50, 53, 46)].join(' / ') },
        { given: 'A plan in a sentence: 42 min from week 46 to 30 min by week 66.', then: 'from 42 min in week 46 (9–15 Nov 2026) to 30 min by week 13 of 2027 (29 Mar–4 Apr 2027)', run: () => planSays(y26, 46, 66, '42 min', '30 min') },
        { given: 'A number goal whose From is week 50, seen in week 46 and in week 50.', then: 'not started / started', run: () => { const g = { kind: 'metric', plan: { start: 1, target: 2, shape: 'straight', fromWeek: 50 } } as unknown as Goal; return [notStarted(g, 46), notStarted(g, 50)].map((x) => (x ? 'not started' : 'started')).join(' / '); } },
      ];
    })(),
  },

  /* ---------- New goal's order (onboarding spec, rules 1, 2 and 5; OB1) ---------- */
  {
    id: 'new-goal',
    title: 'New goal',
    summary: 'New goal asks what, then who and where, then how it’s measured, then reads it back; its level starts from the goal it feeds, and “Feeds into” suggests the goals one level up.',
    code: [{ file: 'src/domain/newGoal.ts', names: ['NEW_GOAL_STEPS', 'stepIndex', 'startLevel', 'parentSuggestions', 'PARENT_SUGGESTIONS', 'planNote'] }],
    tests: ['src/domain/newGoal.test.ts'],
    reqs: ['NEW-GOAL-STEPS'],
    body: `
**The steps.** Four, each with its own address under \`/goals/new\`: *what* (the name and the kind), *who and where* (owner, team, level, what it feeds, what else it helps, guardrail), *how it's measured* (what measures it, the numbers or stages, how it's measured in words and where the number comes from), and *check* (the goal read back, each row with Change). Each Continue is one history entry, so the browser's Back steps back; a later step opened with an earlier one unfilled goes to the first unfilled one. A draft is kept on every change and picked up at the step it stopped at. People, teams and goals are found by typing (the [finding](finding.md) rules), never chosen from a list of everything. The owner starts as the person adding it, and the team follows the owner until it is chosen by hand.

**The level it starts at (rule 1).** With a goal it feeds: one level below that goal's. Without: Team, unless the owner leads a team that already owns a north-star or SVP goal; then none, and the person is asked ("Choose a level."). Any goal can be chosen to feed (anyone may set any level; Lane, 11 Nov): one at a lower level is asked about where it is chosen ([goal entry](goal-entry.md), rule 3's \`feeds-lower\`), never refused.

**Suggestions for "Feeds into" (rule 2).** Before anything is typed, at most ${PARENT_SUGGESTIONS}: the goals one level up in the goal's team, worst first; then goals one level up that the person's own goals already feed; then goals opened lately that are above the level. A north star has none: it is the top of its tree.

**The plan's note (rule 5).** One sentence with this goal's own next quarter end: "Each week’s number is checked in during that week, so the one that closes Q4 is week 53, checked in 28 Dec–3 Jan."`,
    examples: (() => {
      const org = { get teams() { return dirWs().teams; }, get goals() { return dirWs().goals; }, get cycles() { return dirWs().cycles; } };
      const g = (id: string) => org.goals.find((x) => x.id === id)!;
      const byTitle = (a: Goal, b: Goal) => a.title.localeCompare(b.title);
      const lvl = (l: string | null) => l ?? 'none: asked';
      return [
        { given: 'The demo: Rhea (her team, CI/CD, owns SVP goals) and Tunde, each with nothing to feed; then anyone, under the north star “Lead time for changes”.', then: 'none: asked; team; svp', run: () => [startLevel(org.cycles[0], 'rhea', org.teams, org.goals, null), startLevel(org.cycles[0], 'tunde', org.teams, org.goals, null), startLevel(org.cycles[0], 'tunde', org.teams, org.goals, g('ns-lead'))].map(lvl).join('; ') },
        { given: 'Rhea’s new SVP goal in CI/CD: the first suggestion for “Feeds into”.', then: 'Lead time for changes', run: () => parentSuggestions(org.cycles[0], 'svp', 'cicd', 'rhea', org.goals, byTitle)[0]?.title ?? 'none' },
        { given: 'A north star’s suggestions.', then: '0', run: () => String(parentSuggestions(org.cycles[0], 'north-star', 'cicd', 'rhea', org.goals, byTitle).length) },
        { given: 'The plan’s note in week 10 of 2026.', then: 'Each week’s number is checked in during that week, so the one that closes Q1 is week 13, checked in 23–29 Mar.', run: () => planNote(org.cycles[0]!, 10) ?? '' },
      ];
    })(),
    unclear: ['Whether a goal for someone else should start as proposed (round 2, GE10) is a later item; today anyone may add a goal for anyone, at any level (Lane, 11 Nov, decision 11).'],
  },

  /* ---------- the read-back (goal entry, rule 5; GE3) ---------- */
  {
    id: 'read-back',
    title: 'The read-back',
    summary: 'New goal’s last step reads the goal back in sentences, with what was left as usual and what you said, then says what happens after it is published: when the first check-in is due, who sees it, the reviews it joins and how long it can be taken back.',
    code: [{ file: 'src/domain/readBack.ts', names: ['readBack', 'leftAsUsual', 'reviewsJoining'] }, { file: 'src/domain/progress.ts', names: ['firstReview', 'reviewDate'] }, { file: 'src/domain/review.ts', names: ['goalsIn'] }],
    tests: ['src/domain/readBack.test.ts'],
    reqs: ['NEW-GOAL-STEPS', 'GOAL-ENTRY-REQUIRED'],
    body: `
**The rows** (rule 5, \`readBack\`), each a small label, a sentence and Change to its step; after Change, Continue comes straight back, and a change that leaves a later step needing something (another type) opens that step first.

- **What**: a number to move, “A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better.” (the shape: “the same amount each week”, “slowly at first, faster near the end”, “in a few jumps”, or “with the weeks’ numbers set by hand”; weeks as [years and weeks](years-and-weeks.md) says them); a range, “A number to keep in range: at or under 12%. It warns only once the limit is crossed.” (or “It warns within 1% of the limit.”); stages, “Dated stages: 2 stages, the last due week 50 (7–13 Dec 2026).” then how many are already done or overdue ([a goal not born late](not-born-late.md)).
- **Who and where**: “{Owner} owns it, in {team}. It’s a Team goal and feeds “{parent}” ({key}).”, or “… and feeds nothing: it’s at the top of its own tree.”; then what else it helps, and “It’s a guardrail.”
- **Measured by** (number goals): the metric chosen (“Lead time for changes, for CI/CD.”), or “No metric: “{how it’s measured}”.”, or “No metric, and not described yet.”
- **Left as usual** (\`leftAsUsual\`): every default not changed, judged by value, in this order: “Whole numbers.”, “From this week to the end of 2026.”, “Steady.”, “No early warning.”, “Not a guardrail.”, “Helps no other goal.” Change goes to the first one’s step. Absent when nothing was left. (Feeding nothing is said once, in Who and where.)
- **You said**: each answered question’s read-back sentence ([goal entry](goal-entry.md), rule 3), with no Change. Absent when none.

**After you publish.** With the weekly rhythm: “Its first check-in is due by Thursday 12 Nov, then every week.” (the first review day on or after today, \`firstReview\`, or From’s week when the plan starts later), then for a number to move “The first number sets where it stands; the plan says 47% for week 47.” (the plan for the week after this one), for a range “It asks for this week’s number.”, for stages “It asks which stages are done.” With no rhythm: “It shows as “No check-in yet” until you post its first number. Nothing is due.” Stages that are all already done: “Every stage is already done, so no check-in is due.” Then who sees it (“Everyone in {workspace} can see it.”, or for someone else “{Owner} sees it on their Home the next time they open Faro. Faro doesn’t send email.”); with Reviews on, the reviews that will walk it (\`reviewsJoining\`: \`goalsIn\` applied to the goal as built; “It joins Platform leadership weekly, which walks every north star.”, several by name, or “It joins no review yet.”); and how long it can be taken back (“Until its first check-in you can change anything, or delete it. After that, a change to the plan needs a reason.”, or for someone else “Only {owner} or an admin can change it once it is published. …”). Stages already done are saved as its first check-in, so then: “Its stage already done is its first check-in, so it can be stopped, with a reason, but not deleted. A change to the plan needs a reason.”`,
    examples: (() => {
      const cy = { id: 'c', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 } as unknown as ReadBackContext['cycle'];
      const d = (o: Partial<GoalDraft> = {}): GoalDraft => ({ ...blankGoal('build', 'tunde', 'ns-mttr'), title: 'Signed artifacts in staging', unit: '%', start: '40', target: '90', ...o });
      const c = (o: Partial<ReadBackContext> = {}): ReadBackContext => ({ cycle: cy, week: 46, today: new Date('2026-11-11T12:00:00Z'), level: 'team', owner: { name: 'Tunde Bakare', isViewer: true }, teamName: 'Build & Release', parent: { title: 'Lead time for changes', key: 'G-41' }, alsoHelps: [], metric: null, answers: [], rhythm: 'weekly', reviewsOn: true, reviewsJoined: [], wsName: 'Platform Engineering', ...o });
      const what = (x: GoalDraft) => readBack(x, c()).rows[0]!.text;
      return [
        { given: 'Tunde’s “Signed artifacts in staging”, 40% → 90% by week 53, steady, Team, feeds G-41; on Wednesday 11 Nov 2026 (week 46, due Thursday).', then: 'A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better. / Its first check-in is due by Thursday 12 Nov, then every week. The first number sets where it stands; the plan says 47% for week 47.', run: () => `${what(d())} / ${readBack(d(), c()).after[0]}` },
        { given: 'The same, published on Friday 13 Nov.', then: 'Its first check-in is due by Thursday 19 Nov, then every week. The first number sets where it stands; the plan says 47% for week 47.', run: () => readBack(d(), c({ today: new Date('2026-11-13T12:00:00Z') })).after[0]! },
        { given: 'The same, with no rhythm.', then: 'It shows as “No check-in yet” until you post its first number. Nothing is due.', run: () => readBack(d(), c({ rhythm: 'none' })).after[0]! },
        { given: 'Owned by Amara, added by someone else.', then: 'Amara sees it on their Home the next time they open Faro. Faro doesn’t send email.', run: () => readBack(d(), c({ owner: { name: 'Amara Okafor', isViewer: false } })).after[1]! },
        { given: 'A north star, with the demo’s reviews; then with Reviews off.', then: 'It joins Platform leadership weekly and Quarterly business review. / no review line', run: () => {
          const joined = reviewsJoining({ id: 'new', level: 'north-star', parentId: null, title: 'New' }, dirWs().reviews, dirWs().goals, dirWs().cycles[0]);
          return `${readBack(d({ parentId: '' }), c({ level: 'north-star', parent: null, reviewsJoined: joined })).after[2]} / ${readBack(d(), c({ reviewsOn: false, reviewsJoined: joined })).after.some((x) => /joins/.test(x)) ? 'a review line' : 'no review line'}`;
        } },
        { given: 'A range at most 12%, no margin; one stage due week 50.', then: 'A number to keep in range: at or under 12%. It warns only once the limit is crossed. / Dated stages: 1 stage, the last due week 50 (7–13 Dec 2026).', run: () => `${what(d({ kind: 'range', limit: '12' }))} / ${what(d({ kind: 'milestone', stages: [{ id: 's1', name: 'Pilot', dueWeek: '50' }] }))}` },
        { given: 'Left as usual for a goal that feeds nothing; nothing defaulted.', then: 'Whole numbers. From this week to the end of 2026. Steady. Not a guardrail. Helps no other goal. / no row', run: () => `${leftAsUsual(d({ parentId: '' }), c()).map((u) => u.text).join(' ')} / ${readBack(d({ decimals: '1', fromWeek: '45', endWeek: '50', shape: 'back', guardrail: true, alsoHelps: ['g'] }), c()).rows.some((r) => r.id === 'usual') ? 'a row' : 'no row'}` },
        { given: 'Stages, one of two already done.', then: 'Its stage already done is its first check-in, so it can be stopped, with a reason, but not deleted. A change to the plan needs a reason.', run: () => readBack(d({ kind: 'milestone', stages: [{ id: 's1', name: 'Design', dueWeek: '40', done: 'yes' }, { id: 's2', name: 'Pilot', dueWeek: '50' }] }), c()).after.at(-1)! },
      ];
    })(),
    unclear: ['The rhythm and Reviews switches (FT1, FT2) are not built yet: New goal reads back the weekly rhythm with Reviews on. Pronouns aren’t kept, so someone else’s Home is “their Home”.'],
  },

  /* ---------- proposed goals (goal entry, rule 14; GE10) ---------- */
  {
    id: 'proposed',
    title: 'Proposed goals',
    summary: 'A goal can be proposed before anyone is held to it: visible to everyone, never judged, nothing due, counted apart, and made active by one deliberate act of its owner or an admin.',
    code: [{ file: 'src/domain/proposed.ts', names: ['isProposed', 'judged', 'withProposed', 'measureEmpty', 'withdrawnSummary', 'proposalAsks'] }, { file: 'src/domain/proposedSummary.ts', names: ['goalCounts', 'withProposedCount', 'measureUnsaid', 'proposedSummary'] }, { file: 'src/domain/proposedActions.ts', names: ['mayActivate', 'readyToActivate', 'activate', 'activated', 'backToProposed'] }, { file: 'src/domain/goalEntry.ts', names: ['proposedMustFix', 'unsaidDraft'] }, { file: 'src/domain/goalRights.ts', names: ['mayChangeGoal'] }, { file: 'src/domain/cycle.ts', names: ['scopeToCycle'] }, { file: 'src/domain/readBack.ts', names: ['underWay', 'afterProposing', 'activeReadBack'] }, { file: 'src/domain/carry.ts', names: ['carryKind'] }],
    tests: ['src/domain/proposed.test.ts'],
    reqs: ['GOAL-PROPOSED'],
    body: `
**The words.** *Proposed*: the goal's state, visible, not judged, nothing due. *Active*: every other goal that isn't stopped, said only where the two are set side by side. *Propose*: save a new goal as proposed. *Make it active*: the act that starts it (not "approve": nobody is asked for permission; not "start", which From already means). *Withdraw*: remove a proposed goal.

**Data.** A goal is proposed while \`proposedAt\` is set (with \`proposedBy\`, who proposed it) and it is neither removed nor stopped (\`isProposed\`). Making it active clears both; History has when.

**Never judged.** \`judged(goals)\` is those neither proposed nor stopped, and every rule that leaves a stopped goal out leaves a proposed one out the same way: the cycle's scope (\`scopeToCycle\`) keeps proposed goals beside its goals, never among them, so no status rule is ever run on one and it is in no count, health line, Needs attention, review agenda, check-in, wrap-up, streak or metric comparison. A check-in on one is refused at every door: "${NOTHING_TO_CHECK_IN}" Its summary has the state \`proposed\` and the status word "Proposed", drawn as a word alone, with no shape.

**Counted apart.** \`goalCounts\` gives active and proposed apart, and a count line adds "{n} proposed": "2 goals, worst first. 1 proposed".

**Saving.** A new goal is proposed when "Is it under way?" is answered "Not yet: propose it", a file's State says proposed, or a tool's state does. While proposed, the type's own required fields (Baseline and Target, the Limit, the stages) are optional all together (\`proposedMustFix\`): a proposal that says none of them is stored as dated stages with no stages (\`measureUnsaid\`) and every screen says "How it’s measured isn’t said yet."; one that says part of it is judged as any goal is. No reason is ever asked of a change to a proposed goal.

**Who.** Anyone may propose a goal for anyone. Its owner or an admin makes it active (\`mayActivate\`); whoever proposed it may also change or withdraw it while it is proposed (\`mayChangeGoal\`).

**Making it active** (\`activate\`): refused unless \`mayActivate\` and \`readyToActivate\` (rule 2's full list, empty). A number goal's From becomes the week chosen, this week unless said, and hand-set weeks before it are dropped. History: "Made it active, from week {n}". The read-back (\`activeReadBack\`) says the plan from then with its dates, "{n} weeks, not the {m} you proposed" when the span changed, and when the first check-in is due.

A From before this week is asked at every door (rule 3's from-past, in New goal's words; a tool passes \`confirm\` once the person has said yes), and a From outside week 0 to the week before the plan's To is refused: "From must be a week of this cycle before the plan’s To: week 0 to week {n}." A proposal has no check-ins, so proposing a stages goal asks nothing about stages already past and saves no check-in for them; they are marked done at its first check-in. Marking an owner as left hands over their proposed goals with the rest (\`leaving\`).

**Back to proposed** (\`backToProposed\`): an active goal with no check-ins, by its owner or an admin. One with a check-in can't: "It has check-ins, so it can’t go back to proposed. Stop it instead." (\`state-has-check-ins\` in a file).

**Withdrawing** is deleting (domain/removal): Recently removed for 30 days, with Undo; History says "Withdrew the proposal “{goal}”".

**Home** (\`proposalAsks\`): under "Proposed goals" in "Needs your response", a goal proposed for the viewer by someone else, not yet opened ("{Name} proposed a goal for you: “{goal}”."), and one proposed 8 weeks ago or more (\`PROPOSED_ASK_WEEKS\`) for its owner: "“{goal}” has been proposed for {n} weeks. Make it active, or withdraw it." Each has "Open it"; the second also "Not yet", which puts it off for 8 more weeks. Opening the goal as its owner ends the first; once it has waited 7 days it is Home's lead when no ask is (the Home rule's \`proposalLead\`). What each person opened and put off is kept behind the Prefs port. Never a status, a count or a flag. Proposing for someone else says so after the read-back: "{Owner} sees it on their Home as a proposal for them. Faro doesn’t send email."

**The carry.** A proposed goal carries into the next year as proposed.`,
    examples: (() => {
      const cy = { id: 'c', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 } as unknown as ReadBackContext['cycle'];
      const d = (o: Partial<GoalDraft> = {}): GoalDraft => ({ ...blankGoal('build', 'tunde', ''), title: 'Signed artifacts in staging', unit: '%', start: '40', target: '90', fromWeek: '46', ...o });
      const goal = (o: Partial<Goal> = {}): Goal => ({ id: 'g132', key: 'G-132', cycleId: 'c', teamId: 'build', ownerId: 'tunde', title: 'Signed artifacts in staging', io: 'output', level: 'team', guardrail: false, parentId: null, effect: null, source: '', definition: '', createdAt: '2026-11-11T10:00:00Z', kind: 'metric', unit: '%', decimals: 0, plan: { start: 40, target: 90, shape: 'straight', fromWeek: 46 }, originalPlan: null, rebaselinedWeek: null, proposedAt: '2026-11-11T10:00:00Z', proposedBy: 'tunde', ...o } as Goal);
      const fix = (x: GoalDraft) => proposedMustFix(x, { cycleWeeks: 53, week: 46, existing: null, door: 'form', startDate: '2025-12-22' }).map((f) => f.id).join(', ') || 'nothing';
      return [
        { given: 'Tunde’s 40% → 90% proposed, and two active goals: judged, and counted.', then: '2 judged; 2 goals, worst first. 1 proposed', run: () => { const gs = [goal({ id: 'a', proposedAt: null }), goal({ id: 'b', proposedAt: null }), goal()]; const c = goalCounts(gs); return `${judged(gs).length} judged; ${withProposedCount(countLine({ thing: 'goal', things: 'goals' }, c.active, false, 'worst first'), c.proposed)}`; } },
        { given: 'Proposing with nothing measured; with only a Baseline; with both numbers.', then: 'nothing / target-empty / nothing', run: () => [fix(d({ start: '', target: '' })), fix(d({ target: '' })), fix(d())].join(' / ') },
        { given: 'A proposal stored with nothing measured: is it unsaid, and what does making it active need?', then: 'unsaid; stage-none', run: () => { const g = goal({ kind: 'milestone', stages: [] } as Partial<Goal>); return `${measureUnsaid(g) ? 'unsaid' : 'said'}; ${readyToActivate(g, { cycleWeeks: 53, week: 46, startDate: '2025-12-22' }).map((f) => f.id).join(', ')}`; } },
        { given: 'Rhea (not an admin) proposed it for Tunde: who may make it active, and who may change it (Tunde, Rhea, Oskar)?', then: 'activate: yes, no, no; change: yes, yes, no', run: () => { const g = goal({ proposedBy: 'rhea' }); const w = (id: string) => ({ id, admin: false }); const yn = (b: boolean) => (b ? 'yes' : 'no'); return `activate: ${['tunde', 'rhea', 'oskar'].map((p) => yn(mayActivate(w(p), g))).join(', ')}; change: ${['tunde', 'rhea', 'oskar'].map((p) => yn(mayChangeGoal(w(p), g))).join(', ')}`; } },
        { given: 'Tunde makes G-132 active on Wednesday 25 Nov (week 48), From this week.', then: 'From 40% in week 48 (23–29 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027): 5 weeks, not the 7 you proposed. Its first check-in is due by Thursday 26 Nov, then every week.', run: () => activeReadBack(goal(), { cycle: cy, week: 48, today: new Date('2026-11-25T12:00:00Z'), rhythm: 'weekly', fromWeek: 48 }) },
        { given: 'New goal’s last step, for your own goal, From this week.', then: 'Not yet: propose it: Everyone can see it and comment. Nothing is due and it has no status until you or an admin make it active.', run: () => { const u = underWay({ owner: { name: 'Tunde Bakare', isViewer: true }, rhythm: 'weekly', week: 46, from: 46 }).proposed; return `${u.label}: ${u.line}`; } },
        { given: 'Proposed by Rhea for Tunde on 11 Nov; Tunde’s Home that day (not opened), then the owner’s Home 9 weeks later, opened.', then: 'Rhea proposed a goal for you: “Signed artifacts in staging”. / “Signed artifacts in staging” has been proposed for 9 weeks. Make it active, or withdraw it.', run: () => { const g = goal({ proposedBy: 'rhea' }); const t = { id: 'tunde', admin: false }; return [proposalAsks([g], t, new Date('2026-11-11T12:00:00Z'), { opened: new Set(), putOff: new Map() }, () => 'Rhea Kapoor')[0]!.says, proposalAsks([g], t, new Date('2027-01-15T12:00:00Z'), { opened: new Set(['g132']), putOff: new Map() })[0]!.says].join(' / '); } },
        { given: 'The year ends with it still proposed.', then: 'carry, still proposed', run: () => { const c = carryCopy(goal(), { old: { weeks: 53 }, next: { id: 'n', weeks: 52 }, checkIns: [], id: 'g2', parentId: null, now: '' }); return `${carryKind(goal(), { cycle: cy, checkIns: [], retro: null }).kind}, ${c.proposedAt ? 'still proposed' : 'active'}`; } },
      ];
    })(),
    unclear: ['A Map node and a Board column for proposed goals (with the filter on), Home’s two rows, “Make it proposed again” in the goal’s menu, the metric page’s listing and Reviews’ “Propose a new goal” are specified (2.15) but not yet built; the rules they need are here.', 'Whether a goal for someone else should start proposed: New goal starts on “Not yet” for one (decision 16); a file or a tool starts it active unless State says proposed.'],
  },

  /* ---------- a goal not born late (onboarding spec, rules 3 and 4; OB2) ---------- */
  {
    id: 'not-born-late',
    title: 'A goal not born late',
    summary: 'A stage already past when a goal is set up is asked about, and one said to be done counts as on time; a goal’s first number may restart its plan.',
    code: [{ file: 'src/domain/goal.ts', names: ['pastStage', 'stagesDoneAtSetUp'] }, { file: 'src/domain/goalEntry.ts', names: ['goalMustFix'] }, { file: 'src/domain/checkin.ts', names: ['rebaseOffer', 'rebase', 'REBASE_WEEKS'] }, { file: 'src/domain/actions.ts', names: ['recordStagesDone'] }, { file: 'src/domain/goalRights.ts', names: ['MARKS_STAGES'] }],
    tests: ['src/domain/notBornLate.test.ts', 'src/domain/setUpCheckIn.test.ts', 'evals/onboarding.eval.ts'],
    reqs: ['NEW-GOAL-TRUTH'],
    body: `
**A stage already past (rule 3).** Setting up a new goal, a stage due before this week is *past*, and must be answered: *done* or *overdue*. Done: the goal is published with one check-in in the week of the latest stage said to be done, each of those stages done in its own due week (posted by whoever set it up, now, with the note "Recorded as already done when the goal was set up"). So none of them is late, and its quarter can read met. That check-in is a check-in like any other, so only the goal's owner records it (R1; an admin loading a workbook is the exception): someone setting up a goal for someone else is still asked, the question adds "Mateo marks done stages at the first check-in.", and the goal is published without it. Overdue: published as it stands; the stage is late from the start. Changing an existing goal never asks. Only the goal's owner or an admin records it, and only before its first check-in.

**A fresh start at the first check-in (rule 4).** Offered when all hold: a number to move; no check-in yet; set up at most ${REBASE_WEEKS} weeks ago; the number typed is valid, would not be on plan, and hasn't reached the target. Not for a number kept in range, stages, or a goal with any check-in. Taken, the goal's start becomes the number from this week (\`fromWeek\`), to the same target, due week and shape; hand-set plan numbers after this week are kept. It needs no reason, since no check-in had started; the change log says "Started the plan from {value} at the first check-in (was {start})". The check-in posted then is on plan.`,
    examples: (() => {
      const g = metric(5, 2, 'straight', { createdAt: '2026-11-09T09:00:00Z', unit: 'days', plan: { start: 5, target: 2, shape: 'straight', fromWeek: 10 } });
      const offer = (v: number, created = 10) => { const o = rebaseOffer(g, CYCLE, 10, v, [], created); return o ? `offered (${o.start} → ${o.value})` : 'not offered'; };
      return [
        { given: 'Week 10: stages due weeks 12, 10 and 3. Which are past?', then: '3', run: () => [12, 10, 3].filter((w) => pastStage(w, 10)).join(', ') },
        { given: 'Two stages, A due week 3 and B due week 7, set up in week 10 with A said to be done: the check-in recorded.', then: 'week 3, A done in week 3, B not done', run: () => { const c = stagesDoneAtSetUp(MILESTONE, ['a'], 'p', '2026-11-11T10:00:00Z', 'c')!; return `week ${c.week}, ${c.stages!.map((u) => (u.doneWeek != null ? `${u.stageId.toUpperCase()} done in week ${u.doneWeek}` : `${u.stageId.toUpperCase()} not done`)).join(', ')}`; } },
        { given: 'Lead time, 5 days down to 2, set up in week 10, no check-in yet: its first number is 7; 5; 2; and 7 for a goal set up in week 1.', then: 'offered (5 → 7); not offered; not offered; not offered', run: () => [offer(7), offer(5), offer(2), offer(7, 1)].join('; ') },
        { given: 'The same goal, started from 7 in week 10.', then: 'start 7, target 2, from week 10, straight', run: () => { const r = rebase(g, 7, 10); return r.kind === 'metric' ? `start ${r.plan.start}, target ${r.plan.target}, from week ${r.plan.fromWeek}, ${r.plan.shape}` : ''; } },
      ];
    })(),
    unclear: ['How many weeks after set-up a first number may still restart the plan (four) is a choice, not a law.'],
  },

  /* ---------- finding things (the app redesign, AR1) ---------- */
  {
    id: 'finding',
    title: 'Finding things',
    summary: 'What a search matches, the near miss offered when nothing does, and the one search per kind of thing (goals, people, teams) that every list, picker and Find calls.',
    code: [{ file: 'src/domain/find.ts', names: ['textMatches', 'wordsOf', 'fold', 'oneEditApart', 'nearMiss', 'search', 'searchGoals', 'searchPeople', 'searchTeams', 'goalWords', 'goalRow', 'personRow', 'teamRow', 'rowsByIds', 'page', 'suggest', 'withRecent', 'countLine', 'filterLine', 'filterText', 'noneFound', 'historyStep', 'findAll', 'findAllAsync', 'keyOf', 'FIND_KINDS', 'FIND_SIZE'] }, { file: 'src/domain/query.ts', names: ['searchKey'] }],
    tests: ['src/domain/find.test.ts', 'src/adapters/parts.test.ts', 'src/adapters/findAll.test.ts'],
    reqs: ['FIND-ANYWHERE'],
    body: `
**What a search matches.** A row is found by its words, as one text; a search matches when every word typed starts a word of the row, ignoring case and accents. Words break at spaces and at \`/ - , . : ( )\`, so "CI/CD" is two words and "ci" finds it, "Lucía" is found by "lucia", and "back" doesn't find "Rollback". An empty search matches everything.

**A goal's key** finds it however it is typed: "G-48", "g48", "g-48" or a bare "48". A whole search that is one key finds only that goal ("G-48" isn't G-4); a bare number also matches as words.

**A goal's words** are its title, key, owner, team, level, status word ("Off track"), the owner's latest reason and path to green and what they need, its definition and its source. **A person's** are their name, job title and team; someone marked as left is never found for a picker. **A team's** are its name and its lead's name.

**A near miss.** Only when nothing matches: each word typed that starts none of the list's words, and has 4 letters or more, is corrected to the commonest of the list's words one edit away (one letter added, dropped or changed, or two next to each other swapped). If every such word has one, the corrected search is said and its rows shown; otherwise nothing. Never for a key. (The design said 5 letters; its own example, "qeue" for "queue", needs 4.)

**One search per kind.** \`search(rows, ask)\` with \`ask = { q, filters, sort, after, size }\` gives \`{ total, rows, next, near? }\`: every match in the kind's order, a page at a time (50 unless asked, at most 200), and where the next page starts. Goals take a Goals link's filters and sort (\`src/domain/query.ts\`) and come worst first unless sorted; people come with those whose name starts with the search first, then A to Z; teams A to Z. Each row is the same two lines everywhere: a goal's status and title, then "{key} · {owner} · {team}"; a person's name, then "{job title} · {team}"; a team's name, then "Led by {name} · {n} people" or "No lead · …".

**Suggestions before typing.** Up to 6 rows, no repeats, in order. A person: you; the people of your team, its lead first, then A to Z; then people chosen lately. A team: your team; teams you lead; teams chosen lately. A goal: your goals, worst first; the goals they feed; goals chosen lately. When your own would fill the list, up to two places are kept for those chosen lately. Nobody marked as left. "Lately" is the last 12 things a person chose or opened in a workspace, newest first, kept per person behind the \`Prefs\` port.

**The words under a list** (the list bar). The count line: not narrowed, "{n} {things}, {order}." ("126 goals, worst first."), with "Showing {a} to {b}." when paged, and "1 goal." for one; narrowed, "{n} {things} match." or "1 goal matches."; nothing, no line. The filter line: "Filtered by: " then each filter as its label and its values joined with " or " ("Team CI/CD · Status Off track or At risk"). A search is never a filter. When nothing is found: "No {thing} matches “{q}”." (with these filters: "… with these filters."; filters alone: "No {things} match these filters."); a near miss: "No {thing} matches “{q}”. Showing {things} that match “{near}”." **History:** choosing a filter, a sort or a page adds an entry; a search's first key adds one and later keys replace it, so Back returns to the list before the search; Enter or leaving the field writes nothing more when the address already says what was typed; clearing adds one.

**Find, from anywhere.** One search across kinds: goals, people, teams, then a module's kinds (the metric library's metrics), never workspaces. Each kind is searched by its own rule above with 3 rows, and only the groups that found something are given, in that order, each with how many match in all ("Goals · 8", then "See all 8 goals"). People marked as left are found too, named "{name} (left)", after everyone here. A search that is one goal's key ("G-48", "g48", "48") puts that goal first and alone under Goals. When a kind finds nothing, its near miss is tried; when no kind finds anything, Find says "Nothing matches “{q}”." Before anything is typed it offers what was opened or chosen lately, up to 8, of any kind.

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
        { given: 'In the demo workspace, Tunde’s people before typing (Build & Release, led by Pavel Novák).', then: 'Tunde Bakare, Pavel Novák, then Build & Release A to Z', run: () => { const r = suggest(personRows(demo!), 'tunde', []).map((x) => x.name); return r[0] === 'Tunde Bakare' && r[1] === 'Pavel Novák' && r.slice(2).every((n, i, a) => i === 0 || a[i - 1]!.localeCompare(n) <= 0) ? 'Tunde Bakare, Pavel Novák, then Build & Release A to Z' : r.join(', '); } },
        { given: 'In the demo workspace, Rhea’s suggestions before typing: people with nothing chosen lately; then after choosing Daniel Okafor.', then: 'Rhea Kapoor, Aiko Suzuki, Diego Ramírez, Femi Adebayo, Johanna Virtanen, Marcus Bell / Rhea Kapoor, Aiko Suzuki, Diego Ramírez, Femi Adebayo, Johanna Virtanen, Daniel Okafor', run: () => [[], [{ kind: 'person', id: 'daniel' }]].map((r) => suggest(personRows(demo!), 'rhea', r).map((x) => x.name).join(', ')).join(' / ') },
        { given: 'Count lines: 126 goals worst first; 97 people A to Z, first page of 50; 17 goals narrowed; 1 person narrowed.', then: '126 goals, worst first. / 97 people, A to Z. Showing 1 to 50. / 17 goals match. / 1 person matches.', run: () => [countLine({ thing: 'goal', things: 'goals' }, 126, false, 'worst first'), countLine({ thing: 'person', things: 'people' }, 97, false, 'A to Z', { from: 1, to: 50 }), countLine({ thing: 'goal', things: 'goals' }, 17, true), countLine({ thing: 'person', things: 'people' }, 1, true)].join(' / ') },
        { given: 'The filter line for Team CI/CD and Status Off track or At risk; nothing found for “rolback” with the near miss “rollback”.', then: 'Filtered by: Team CI/CD · Status Off track or At risk / No goal matches “rolback”. Showing goals that match “rollback”.', run: () => `${filterLine([{ key: 'team', label: 'Team', values: ['CI/CD'] }, { key: 'status', label: 'Status', values: ['Off track', 'At risk'] }])} / ${noneFound({ thing: 'goal', things: 'goals' }, 'rolback', false, 'rollback')}` },
        { given: 'In the demo workspace, Find for “rhea”, “48” and “zzzz”: each group with its total and first rows.', then: 'goal 8: Lead time for changes, Pipeline queue wait (p90), Flaky test rate in the main pipelines; person 1: Rhea Kapoor; team 1: CI/CD / goal 1: On-call engineers across all twelve rotations who had fewer than two out-of-hours pages in the week, not counting planned maintenance windows / nothing', run: () => {
          const at = new Date(CHECK_IN_MOMENT), wk = currentWeek(cycle(), at);
          const rows = { goal: goalRows(demo!, cycle(), at, wk), person: personRows(demo!), team: teamRows(demo!) } as const;
          return ['rhea', '48', 'zzzz'].map((q) => findAll(q, ['goal', 'person', 'team'], (k, a) => search(rows[k as keyof typeof rows], a)).map((g) => `${g.kind} ${g.total}: ${g.rows.map((r) => r.name).join(', ')}`).join('; ') || 'nothing').join(' / ');
        } },
        { given: 'Whole keys: “G-48”, “g48”, “48”, “rollback”.', then: 'G-48, G-48, G-48, none', run: () => ['G-48', 'g48', '48', 'rollback'].map((q) => keyOf(q) ?? 'none').join(', ') },
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

**The back link** ("‹ {where}", above the title) is never on a place's first page (Home, Check-in, Goals, Reviews, People, Teams, Activity, Data, Workspace, Settings, Help, Feedback, and a module's own), nor on a form, whose one way out is its closing control. Elsewhere it goes back to the last earlier page in the tab that isn't a form (check-in, the table, New goal, an edit, set-up, a wrap-up) and isn't this page (in a review's walk, the walk's other goals count as this page), named in the navigation's words: Home, Goals, "your goals" on Mine, a saved view's name, a goal's title, a review's name. Pressing it goes back that many entries, so the browser's Forward still works, and the browser's Back onto a form you left steps over it the same way. Arriving from outside, it goes to the page's parent: the goal a goal feeds (or Goals), the goal for its print page, the review for a goal in its walk and for its summary, Reviews, People, Teams, Help (for an article and What's new), Workspace for a section, a module's first page for its other pages; otherwise Home.`,
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

/** The feature modules' rules: each module's spec.ts (through the registry), written in its module's section of the spec. */
for (const m of MODULE_SPEC) RULE_LIST.push(...m.part.map((r) => ({ ...r, module: m.id })));

/** Home's facts for the examples: weekly, due Thursday 12 Nov 2026, week 46 of 53. */
const HOME_F = (p: Partial<HomeFacts> & { today: string }, c: Partial<HomeFacts['checkIns']> = {}): HomeFacts => ({
  week: 46, lastWeek: 53, cycleName: '2026', workspace: 'Platform Engineering', starts: null, ended: false, rhythm: { dueDate: '2026-11-12', nextDueDate: '2026-11-19' },
  wrap: null, sessions: [], owns: 2, watches: 1, asks: [], ...p, checkIns: { total: 2, done: 0, due: [], draft: false, allInOnTimeToday: false, streak: 0, ...c },
});
const HOME_DUE = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, title: `Goal ${i + 1}`, number: true }));
const HOME_REVIEW = { id: 'dp', name: 'Developer Productivity fortnightly', date: '2026-11-10', held: false, discuss: 14, healthy: 21, done: 0, total: 35, started: false, nextGoal: null, nextDate: '2026-11-24' };
const homeSays = (f: HomeFacts) => { const p = homeFor(f); return p.lead ? `${p.lead.kind}: ${p.lead.eyebrow} · ${p.lead.title} · ${p.lead.action.label}` : `${p.quiet!.sentence}${p.quiet!.line ? ` ${p.quiet!.line}` : ''}${p.quiet!.buttons.length ? ` [${p.quiet!.buttons.map((b) => b.label).join('] [')}]` : ''}`; };

RULE_LIST.push({
  id: 'home',
  title: 'Home: what is asked of you today',
  summary: 'Whether Home leads with one thing asked of the viewer today, and its one primary action, or says in one quiet line that nothing is.',
  code: [{ file: 'src/domain/home.ts', names: ['homeFor', 'homeLead', 'quietLine', 'LEAD_DAYS', 'longDay', 'waiting', 'waitingOrder', 'askLead', 'proposalLead'] }],
  tests: ['src/domain/home.test.ts'],
  reqs: ['HOME-OWNER'],
  body: `
**The lead** is the first of these that holds, and Home's one primary action; with none, Home has no primary button at all:

1. *Late check-ins*: a rhythm is set, a check-in is still to do this week, and its due date has passed. "Check-ins were due on {Thursday 12 Nov}" · "{n} check-ins still to do" · "{titles}. They count for week {w} until Sunday." · **Start check-in**.
2. *Check-ins*: a rhythm is set, a check-in is still to do, and it is due within \`LEAD_DAYS\` (1) day, or a draft is kept (**Pick up where you left off**), or a review the viewer is in is today and isn't held ("{Review} is today" · "{n} check-ins to do before it").
3. *The wrap-up*: open (the cycle's last two weeks, or after its end), the viewer owns goals not yet wrapped up, and no check-in is still to do this week. **Start the wrap-up** opens the first.
4. *A review*: one the viewer is in, this week's, on or past its day, not held, with goals not yet marked reviewed; the earliest, then by name. Past its day it says "Not held yet" with the warning mark. **Open the review**, or **Continue: {goal}** once begun.
5. *An ask*: the first ask waiting on the viewer in the order below, when it is late, due this week, or has waited 7 days or more with no date. "Needs your response · {its line}" · "{First name} needs a decision" (asked a question, asked for an update; "A next step you agreed is due") · "“{ask}”. About {goal}." · **Respond**, **Answer**, **Check in** or **Mark done**. It is then not listed again under "Also needs your response".
   Then, when no ask leads (\`proposalLead\`): a goal proposed for the viewer by someone else and not yet opened (goal entry rule 14) is an ask with no date, asked on the day it was proposed, so it leads once it has waited 7 days or more, the oldest first. "Needs your response · waiting since {4 Nov}, {9 days}" · "{First name} proposed a goal for you" · "“{goal}”. Nothing is due on it until you make it active." · **Open it**. Its row under "Proposed goals" is then not listed.

**An ask that waits** (\`waiting\`). Its due date is its own due week's Sunday; else, for a question raised in a review, the first session after the one it was raised in, fixed when asked (it does not move on when that session passes); else none. Late: today is after the due date. Its line, said after who asked and when: late, with the warning mark, "Was due week {w} ({dates})" or "Was due before {review}’s session on {Tue 10 Nov}"; "Due before today’s session" / "tomorrow’s" with the warning mark; "Due this week ({dates})"; "Due week {w} ({dates})"; "Before its next session, {Tue 24 Nov}"; no date and 7 days or more, "Waiting since {4 Aug}, {8 days | 14 weeks}" (weeks from 14 days); newer, "Asked today", "yesterday" or "on {Tuesday}". **Order** (\`waitingOrder\`): late; due this week; no date and waited 7 days or more, oldest first; the rest, newest first; within each, decisions, questions, updates, next steps.

With two or more number goals to check in on, the check-in leads add the quiet link "Or type all your numbers in one table". A ring counts what the lead counts (check-ins, reviewed, wrapped).

**The quiet line** (no lead), the first that holds: before the cycle starts, "Nothing is asked of you today." and when it starts; after it ends, "{cycle} has ended."; check-ins to do but not yet asked, "Check-ins for week {w} are due by {date}. You have {n} to do." with a plain **Check in early**; all of the viewer's check-ins in, "{Both check-ins are | All {n} check-ins are} in for week {w}." and when the next are due, with "That is {k} weeks in a row on time." first only on the day the last went in on time and from a streak of 2; someone who owns, watches and is asked nothing, "You don’t own or watch a goal in {workspace} yet." with **See the goals** and **Set up a goal**; otherwise just "Nothing is asked of you today."

Never said: "You’re all set", a deadline that has passed for someone who met it, "0 weeks". Your goals are counted once, in "Your goals", and each count opens exactly those goals (\`/goals?scope=mine&status=…\`); no link on Home is a bare \`/goals\`.`,
  examples: [
    { given: 'Tunde, Monday 9 Nov, 2 check-ins to do.', then: 'Nothing is asked of you today. Check-ins for week 46 are due by Thursday 12 Nov. You have 2 to do. [Check in early]', run: () => homeSays(HOME_F({ today: '2026-11-09' }, { due: HOME_DUE(2) })) },
    { given: 'Tunde, Wednesday 11 Nov, 1 to do.', then: 'check-in: Check-ins are due by Thursday 12 Nov, tomorrow · 1 check-in to do · Start check-in', run: () => homeSays(HOME_F({ today: '2026-11-11' }, { done: 1, due: HOME_DUE(1) })) },
    { given: 'Tunde, Thursday 12 Nov, posts his last one today, 5 weeks in a row on time.', then: 'Both check-ins are in for week 46. That is 5 weeks in a row on time. The next are due by Thursday 19 Nov.', run: () => homeSays(HOME_F({ today: '2026-11-12' }, { done: 2, allInOnTimeToday: true, streak: 5 })) },
    { given: 'Tunde, Friday 13 Nov, 1 not posted.', then: 'check-in-late: Check-ins were due on Thursday 12 Nov · 1 check-in still to do · Start check-in', run: () => homeSays(HOME_F({ today: '2026-11-13' }, { done: 1, due: HOME_DUE(1) })) },
    { given: 'Rhea, Tuesday 10 Nov, 6 to do, her Developer Productivity fortnightly today.', then: 'check-in: Developer Productivity fortnightly is today · 6 check-ins to do before it · Start check-in', run: () => homeSays(HOME_F({ today: '2026-11-10', sessions: [HOME_REVIEW] }, { total: 7, done: 1, due: HOME_DUE(6) })) },
    { given: 'Rhea, Tuesday 10 Nov, all 7 in.', then: 'review: Developer Productivity fortnightly is today · your 7 check-ins are in · 14 goals to discuss · Open the review', run: () => homeSays(HOME_F({ today: '2026-11-10', sessions: [HOME_REVIEW] }, { total: 7, done: 7 })) },
    { given: 'Someone who owns, watches and is asked nothing.', then: 'Nothing is asked of you today. You don’t own or watch a goal in Platform Engineering yet. [See the goals] [Set up a goal]', run: () => homeSays(HOME_F({ today: '2026-11-11', owns: 0, watches: 0 }, { total: 0 })) },
    { given: 'Daniel’s question, raised on Tuesday 3 Nov in the Developer Productivity fortnightly, whose next session is Tuesday 10 Nov: its line on Monday 9 Nov, then on Wednesday 11 Nov unanswered.', then: 'Due before tomorrow’s session / Was due before Developer Productivity fortnightly’s session on Tue 10 Nov', run: () => ['2026-11-09', '2026-11-11'].map((t) => waiting({ id: 'q', kind: 'question', by: 'Daniel', goals: [{ id: 'g', title: 'Pipeline queue wait' }], said: 'Is the budget approved?', askedOn: '2026-11-03', dueWeek: null, session: { name: 'Developer Productivity fortnightly', date: '2026-11-10' }, where: 'Developer Productivity fortnightly' }, t).line).join(' / ') },
    { given: 'Amara, Monday 9 Nov, no check-ins of her own; Rhea’s decision for her asked on 4 Aug, with no date.', then: 'ask: Needs your response · waiting since 4 Aug, 13 weeks · Rhea needs a decision · Respond', run: () => homeSays(HOME_F({ today: '2026-11-09', owns: 0, asks: [waiting({ id: 'd', kind: 'decision', by: 'Rhea', goals: [{ id: 'g', title: 'Lead time for changes' }], said: 'Approve the runner budget', askedOn: '2026-08-04', dueWeek: null, session: null, where: null }, '2026-11-09')] }, { total: 0 })) },
    { given: 'Tunde, Friday 13 Nov, both in; Rhea proposed a goal for him on 4 Nov that he hasn’t opened.', then: 'ask: Needs your response · waiting since 4 Nov, 9 days · Rhea proposed a goal for you · Open it', run: () => homeSays(HOME_F({ today: '2026-11-13', proposals: [{ id: 'g132', title: 'Signed artifacts in staging', by: 'Rhea', proposedOn: '2026-11-04' }] }, { done: 2 })) },
    { given: 'Tunde, Wednesday 23 Dec (week 52), both in, the wrap-up open.', then: 'wrap-up: 2026 ends on Sunday 3 Jan · Wrap up your 2 goals · Start the wrap-up', run: () => homeSays(HOME_F({ today: '2026-12-23', week: 52, rhythm: { dueDate: '2026-12-24', nextDueDate: '2026-12-31' }, wrap: { ends: '2027-01-03', ended: false, left: [{ id: 'g1', title: 'Goal 1' }, { id: 'g2', title: 'Goal 2' }], total: 2 } }, { done: 2 })) },
  ],
  unclear: ['The ring and its words are drawn by the screen from the lead’s counts; the conformance rows (home.csv) give the lead’s kind and the quiet sentence for each demo person on each day of two weeks.'],
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
