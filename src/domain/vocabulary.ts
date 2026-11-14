/* One meaning for every status word (consolidation release 2, 6 Nov). Every word the app, its exports, Help and the AI
   assistant use for a state is defined here once: its code (what is stored or passed), its label (what people read),
   a one-line meaning, a longer one, the rule that decides it, and where it may appear. Everything else reads it from
   here, and the status legend, Help's status article, the export's definitions, the AI's tool descriptions and
   docs/glossary.md are generated from it (`npm run glossary`; src/domain/vocabulary.test.ts checks the file is current).
   The vocabulary check (evals/vocabulary.eval.ts) fails the build on a vocabulary word written anywhere else.

   Stored codes never change; only what people read does. Some labels name more than one thing on purpose, with the
   same meaning: Done is finished, whether a goal, a stage or an action; Met and Not met say the same of a goal's result
   and of a quarter. Each such entry says which one it shares its meaning with (`same`). */
import { MIN_STOP_REASON, RESTORE_DAYS, RULES, TREND_SPAN, UNDO_MS } from './thresholds';
import type { AskKind, AskStatus, DisplayStatus } from './types';
import { UNMEASURED, UNMEASURED_MEANING } from './unmeasured';

export { MIN_STOP_REASON, RESTORE_DAYS, UNDO_MS };

/** Where a word may appear: on screens, in exports (workbook, CSV, JSON, the brief, print), in Help, and from the AI assistant. */
export type Place = 'screens' | 'exports' | 'help' | 'ai';
const ALL: readonly Place[] = ['screens', 'exports', 'help', 'ai'];

export interface Term<C extends string = string> {
  code: C;
  /** What people read. */
  label: string;
  /** A few words, lower case, for beside the word in a key: "on plan so far". */
  short: string;
  /** One line. */
  meaning: string;
  /** The whole definition, for Help, the export's definitions and the glossary. */
  long: string;
  /** The function that decides it, as `file#name` under src/domain (vocabulary.test.ts checks it exists). */
  rule: string;
  where: readonly Place[];
  /** Another entry with this label and this meaning, as `group.code`. */
  same?: string;
  /** Words said for it before release 2. Never said again: the vocabulary check fails on them. */
  retired?: readonly string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const term = <C extends string>(code: C, t: Omit<Term<C>, 'code' | 'where'> & { where?: readonly Place[] }): Term<C> => ({ code, where: ALL, ...t });

/* ---------- a goal's status ---------- */

export const STATUS: Record<DisplayStatus, Term<DisplayStatus>> = {
  on: term('on', {
    label: 'On track', short: 'on plan so far',
    meaning: `On plan so far: at least ${pct(RULES.onTrack)} of the progress planned by now.`,
    long: `At least ${pct(RULES.onTrack)} of the progress planned by now, inside its limit, or every stage on schedule. If the recent trend says it will still finish short, it is flagged as getting worse.`,
    rule: 'status#goalStatus',
  }),
  risk: term('risk', {
    label: 'At risk', short: 'could miss without a change',
    meaning: `Could miss without a change: ${pct(RULES.atRisk)}–${pct(RULES.onTrack)} of the planned progress, or close to a limit.`,
    long: `${pct(RULES.atRisk)}–${pct(RULES.onTrack)} of the progress planned by now, inside a limit’s warning margin or over it for one week, or a stage up to ${RULES.lateWeeksOff} weeks late. The owner says how it gets back: its path to green.`,
    rule: 'status#goalStatus',
  }),
  off: term('off', {
    label: 'Off track', short: 'will miss without intervention',
    meaning: `Will miss without intervention: under ${pct(RULES.atRisk)} of the planned progress, a stage more than ${RULES.lateWeeksOff} weeks late, or over a limit two weeks running.`,
    long: `Under ${pct(RULES.atRisk)} of the progress planned by now, a stage more than ${RULES.lateWeeksOff} weeks late, or over a limit two weeks running. It needs a decision, help or a new plan.`,
    rule: 'status#goalStatus',
  }),
  stale: term('stale', {
    label: 'No recent update', short: `no check-in for ${RULES.staleDays / 7} weeks or more`,
    meaning: `No check-in for ${RULES.staleDays} days or more, so its status can’t be trusted.`,
    long: `The latest check-in was posted ${RULES.staleDays} days ago or more (or, with none at all, the goal began that long ago). Its last call, numbers and forecast are out of date until the owner checks in.`,
    rule: 'status#goalStatus',
    retired: ['No recent check-in', 'gone quiet', 'goes quiet', 'An update is overdue', 'update is overdue', 'no check-in for 2+ weeks', 'Quiet for'],
  }),
  none: term('none', {
    label: 'No check-in yet', short: 'begun, with no check-in yet',
    meaning: 'Under way, with no check-in yet.',
    long: `The goal has begun and nobody has checked in on it yet. ${RULES.staleDays} days after it began with still none, it has no recent update.`,
    rule: 'status#goalStatus',
    retired: ['Waiting for its first check-in', 'Nothing reported yet'],
  }),
  planned: term('planned', {
    label: 'Not started', short: 'starts next week',
    meaning: 'Hasn’t begun: its first week is still to come.',
    long: 'Week 0: the goal is set up and its first check-in is due in week 1.',
    rule: 'status#goalStatus',
  }),
  // Its own status (Lane, 14 Nov): wherever a goal held to no number is shown, it says this, never "No check-in yet".
  unmeasured: term('unmeasured', {
    label: UNMEASURED, short: 'its number isn’t measured yet',
    meaning: UNMEASURED_MEANING,
    long: 'The goal is measured by a number nobody collects yet, so it is held to no number until it is: no status from its plan, nothing late or quiet, and no projected year-end number. Once its number is measured, it is held to its plan again. The owner can still call it done.',
    rule: 'status#goalStatus',
  }),
  done: term('done', {
    label: 'Done', short: 'finished',
    meaning: 'Finished: the owner has called it done.',
    long: 'The owner called it done in a check-in. Done means finished wherever it is said: a goal, a stage or an action.',
    rule: 'status#goalStatus',
  }),
};

/** Worst first: the order statuses are counted and listed in. */
export const STATUS_ORDER: DisplayStatus[] = ['off', 'risk', 'stale', 'none', 'unmeasured', 'on', 'planned', 'done'];

/* ---------- what needs attention, and why ---------- */

export type FlagKind = 'off' | 'risk' | 'stale' | 'decision' | 'missed-path' | 'no-path' | 'trend' | 'greener' | 'due';

/** A flag that is a status says the status's own word and meaning. */
const statusFlag = (k: 'off' | 'risk' | 'stale'): Term<FlagKind> => ({ ...STATUS[k], code: k, rule: 'attention#attentionFor', where: ALL, same: `status.${k}`, retired: undefined });

export const FLAG: Record<FlagKind, Term<FlagKind>> = {
  off: statusFlag('off'),
  risk: statusFlag('risk'),
  stale: statusFlag('stale'),
  decision: term('decision', {
    label: 'Decision or help needed', short: 'waiting on someone',
    meaning: 'The owner is waiting on a decision or help that nobody has given yet.',
    long: 'An open ask for a decision or help on the goal (its own, or one it is linked to). It stops counting once it is answered or withdrawn.',
    rule: 'asks#openFor',
  }),
  'no-path': term('no-path', {
    label: 'No path to green', short: 'behind, with no way back said',
    meaning: 'Off track or at risk, and the owner hasn’t said how it gets back.',
    long: 'The latest check-in is off track or at risk and has no path to green: what changes, the week it is back on plan by, and any decision or help needed.',
    rule: 'attention#attentionFor',
    retired: ['No recovery plan'],
  }),
  'missed-path': term('missed-path', {
    label: 'Missed its own date', short: 'past the owner’s own date',
    meaning: 'Still behind after the week the owner said it would be back on plan.',
    long: 'The path to green named a week to be back on plan by, that week has passed, and the goal is still off track or at risk.',
    rule: 'attention#attentionFor',
    retired: ['Missed path to green'],
  }),
  trend: term('trend', {
    label: 'Getting worse', short: 'further behind each time',
    meaning: 'Further behind plan at each of the last two check-ins, or on track but heading short of its target.',
    long: `A number further behind its plan (in the goal’s own units) at each of the last two of ${TREND_SPAN} check-ins, and visibly so: behind now as shown, and further behind than at the first of them; a number moving towards its limit two check-ins running; a stage expected later than it was at the check-in before; or on track today with the whole projected range falling short of the target. The goal’s trend, its chart and its scorecard use the same rule.`,
    rule: 'trend#gapTrend',
    retired: ['Worsening trend', 'Falling further behind', 'Losing ground on the plan', 'and slipping', 'Moving towards the limit'],
  }),
  greener: term('greener', {
    label: 'Greener than calculated', short: 'call better than the numbers',
    meaning: 'The owner’s call is better than the numbers say, with a reason.',
    long: 'The owner called it greener than the app calculates from the numbers. A greener call needs a reason, which is shown beside it.',
    rule: 'status#goalStatus',
    retired: ['Called greener than the numbers', 'greener than the numbers'],
  }),
  due: term('due', {
    label: 'Check-in due', short: 'none yet this week',
    meaning: 'No check-in yet this week. It doesn’t, on its own, make a goal need attention.',
    long: 'The goal has no check-in for this week yet, and one is due by the workspace’s check-in day. It is listed for the owner, but on its own it doesn’t make the goal need attention.',
    rule: 'attention#attentionFor',
    where: ['screens', 'help', 'ai'],
  }),
};

/** The flags that make a goal need attention (a check-in due on its own doesn't), worst first. */
export const ATTENTION_FLAGS: FlagKind[] = ['off', 'missed-path', 'stale', 'decision', 'no-path', 'risk', 'trend', 'greener'];

/** Needs attention, being handled. */
export const ATTENTION = {
  needs: term('needs', {
    label: 'Needs attention', short: 'new, and nobody has picked it up',
    meaning: 'Flagged for something new that nobody has picked up yet.',
    long: `A goal needs attention when it is ${ATTENTION_FLAGS.map((k) => FLAG[k].label.toLowerCase()).join(', ').replace(/, ([^,]+)$/, ' or $1')}, unless someone is already handling it. The same rule picks the goals on Home, in Watching, on the map, in the Goals filter, in reviews and for the AI assistant. Wherever they are listed, the goals being handled are listed below them, so nothing is hidden; a count of goals that need attention leaves those out.`,
    rule: 'attention#needsAttention',
  }),
  handled: term('handled', {
    label: 'Being handled', short: 'an action agreed since its latest check-in',
    meaning: 'An action with an owner and a date was agreed after its latest check-in. It comes back to Needs attention if anything new happens.',
    long: 'Off track or at risk, and since its latest check-in an action was agreed with an owner and a due week (and isn’t overdue), or, when it is at risk, its request was answered. An off-track goal is handled only with an action. Marking it reviewed or noting it is not enough: that goal still needs attention, and says who looked at it. A new check-in or a new flag makes it need attention again.',
    rule: 'attention#handledFor',
  }),
} as const;

/**
 * Being handled, said under the words wherever a group of them is shown (Lane, 9 Nov: "I don't even know what that
 * means"): Home, Watching, the Needs attention list, the count's note and reviews all use this one line.
 */
export const HANDLED_LINE = 'These have an action with an owner and a date, or an answer to their request, agreed after their latest check-in. They come back under Needs attention if anything new happens.';

/** What the numbers would otherwise hide, on a goal's story, besides the flags above. Not a reason to need attention on its own. */
export type WarningKind = 'slipped' | 'same-cause' | 'missed-quarter';
export const WARNING: Record<WarningKind, Term<WarningKind>> = {
  slipped: term('slipped', {
    label: 'Date slipped', short: 'the way back moved later',
    meaning: 'The week the owner says it will be back on plan has moved later.',
    long: 'While it has been behind, the week its path to green names has moved later than the first one given.',
    rule: 'story#storyOf',
    retired: ['Recovery date slipped'],
  }),
  'same-cause': term('same-cause', {
    label: 'Same cause again', short: 'one cause, three times',
    meaning: 'The same cause given at three check-ins running.',
    long: 'Behind, with the same cause given at each of its last three check-ins.',
    rule: 'story#storyOf',
  }),
  'missed-quarter': term('missed-quarter', {
    label: 'Last quarter not met', short: 'behind its quarter plan',
    meaning: 'It didn’t meet the plan for the quarter that has just ended.',
    long: 'In a goal year: at the end of the last quarter it was worse than its own plan said it would be (short of it, or over it when lower is better), compared at the goal’s decimals.',
    rule: 'year#quarterResults',
  }),
};

/* ---------- results ---------- */

export type ResultKind = 'completed' | 'late' | 'missed';
/** A goal's result once it's due. The codes stay as stored and linked (`result=completed`); the words are Met, Met late, Not met. */
export const RESULT: Record<ResultKind | 'open', Term<ResultKind | 'open'>> = {
  completed: term('completed', {
    label: 'Met', short: 'hit by its date',
    meaning: 'Hit the target by its due date.',
    long: 'Reached the target (stayed in range, or finished every stage) by its due week, or the owner called it done by then.',
    rule: 'story#goalResult',
    retired: ['Completed'],
  }),
  late: term('late', {
    label: 'Met late', short: 'hit after its date',
    meaning: 'Hit the target, but after its due date.',
    long: 'Reached the target (or finished every stage) after its due week.',
    rule: 'story#goalResult',
    retired: ['Completed late'],
  }),
  missed: term('missed', {
    label: 'Not met', short: 'its date passed',
    meaning: 'The due date passed without hitting the target.',
    long: 'Its due week passed without reaching the target (or staying in range, or finishing every stage).',
    rule: 'story#goalResult',
    retired: ['Did not meet'],
  }),
  open: term('open', {
    label: 'Not finished yet', short: 'not due yet',
    meaning: 'Not due yet, and not done.',
    long: 'Its due week hasn’t passed and the owner hasn’t called it done, so it has no result yet.',
    rule: 'story#goalResult',
    where: ['screens', 'ai'],
  }),
};

export type QuarterKind = 'met' | 'missed' | 'open';
/** Each quarter of a goal year, against the owner's own plan. The same words as a goal's result. */
export const QUARTER: Record<QuarterKind, Term<QuarterKind>> = {
  met: term('met', {
    label: 'Met', short: 'at its plan',
    meaning: 'At the quarter’s end it was where its plan said, or better.',
    long: 'A quarter’s target is the plan’s number at its end (or the stages due by then, or staying in range). Met: it was there or better, compared at the goal’s decimals, so a number shown equal to its plan is met.',
    rule: 'year#quarterResults', same: 'result.completed',
  }),
  missed: term('missed', {
    label: 'Not met', short: 'worse than its plan',
    meaning: 'At the quarter’s end it was worse than its plan: short of it, or over it when lower is better.',
    long: 'At the quarter’s end it was worse than where its plan said it would be, compared at the goal’s decimals (equal is met), or had no number to show.',
    rule: 'year#quarterResults', same: 'result.missed',
    retired: ['Missed its plan', 'Missed last quarter'],
  }),
  open: term('open', {
    label: 'In progress', short: 'still running',
    meaning: 'The quarter is still running.',
    long: 'The quarter hasn’t ended, so it is neither met nor not met yet.',
    rule: 'year#quarterResults',
  }),
};

/** A quarter that is neither met, not met nor running: the words one place, for the goal page, History (and its key) and
    Print (#239's review: Print said "None due" where the others said "Not applicable", and History "Nothing due"). */
export const QUARTER_NOT_JUDGED = {
  before: { label: 'Not applicable', meaning: 'The quarter ended before the goal was set up, so it is never judged.' },
  none: { label: 'None due', meaning: 'Nothing was due that quarter, so there is nothing to judge.' },
  later: { label: 'To come', meaning: 'The quarter hasn’t started yet.' },
} as const;

/** What the owner says at the wrap-up: their own words, always labelled as their view, never as the result. */
export type OwnerViewKind = 'hit' | 'partly' | 'missed';
export const OWNER_VIEW_LABEL = 'Owner’s view';
export const OWNER_VIEW: Record<OwnerViewKind, Term<OwnerViewKind>> = {
  hit: term('hit', { label: 'Hit it', short: 'in the owner’s words', meaning: 'The owner’s view at the wrap-up: it landed.', long: 'What the owner says at the wrap-up. It is their view, shown as “Owner’s view”, and never changes the result.', rule: 'cycle#suggestedResult' }),
  partly: term('partly', { label: 'Partly', short: 'in the owner’s words', meaning: 'The owner’s view at the wrap-up: some of it landed.', long: 'What the owner says at the wrap-up. It is their view, shown as “Owner’s view”, and never changes the result.', rule: 'cycle#suggestedResult' }),
  missed: term('missed', { label: 'Missed', short: 'in the owner’s words', meaning: 'The owner’s view at the wrap-up: it didn’t land.', long: 'What the owner says at the wrap-up. It is their view, shown as “Owner’s view”, and never changes the result.', rule: 'cycle#suggestedResult' }),
};

/* ---------- stages ---------- */

export type StageWord = 'done' | 'planned' | 'risk' | 'off';
/** A dated stage. The codes are the stage kinds the rules use (status.ts StageKind). */
export const STAGE: Record<StageWord, Term<StageWord>> = {
  done: term('done', { label: 'Done', short: 'finished', meaning: 'Finished, in the week the owner said.', long: 'The stage is finished, in the week the owner said it was.', rule: 'status#assessMilestone', same: 'status.done' }),
  planned: term('planned', { label: 'On schedule', short: 'not late', meaning: 'Not done yet, and not late.', long: 'Not done yet, and expected by its due week.', rule: 'status#assessMilestone' }),
  risk: term('risk', {
    label: 'Slipping', short: `up to ${RULES.lateWeeksOff} weeks late`,
    meaning: `Expected 1–${RULES.lateWeeksOff} weeks after its due week.`,
    long: `Not done, and now expected 1–${RULES.lateWeeksOff} weeks after its due week. A stage slipping makes the goal at risk.`,
    rule: 'status#assessMilestone',
  }),
  off: term('off', {
    label: 'Late', short: `over ${RULES.lateWeeksOff} weeks late`,
    meaning: `Expected more than ${RULES.lateWeeksOff} weeks after its due week.`,
    long: `Not done, and now expected more than ${RULES.lateWeeksOff} weeks after its due week. A late stage makes the goal off track.`,
    rule: 'status#assessMilestone',
  }),
};

/** Stages behind their dates, each in its word: "2 stages late", "1 stage slipping", "1 stage late, 1 slipping". */
export function stagesBehind(kinds: readonly ('risk' | 'off')[]): string {
  const late = kinds.filter((k) => k === 'off').length, slipping = kinds.filter((k) => k === 'risk').length, n = kinds.length;
  if (!n) return STAGE.planned.label;
  const noun = `${n} ${n === 1 ? 'stage' : 'stages'}`;
  if (!slipping) return `${noun} ${lower(STAGE.off)}`;
  if (!late) return `${noun} ${lower(STAGE.risk)}`;
  return `${noun}: ${late} ${lower(STAGE.off)}, ${slipping} ${lower(STAGE.risk)}`;
}

/* ---------- asks ---------- */

export const ASK_KIND: Record<AskKind, Term<AskKind>> = {
  decision: term('decision', { label: 'Decision or help', short: 'what an owner needs', meaning: 'What an owner needs from a named person, often raised in a check-in.', long: 'A decision or help an owner needs from someone. Open until it is answered or withdrawn.', rule: 'asks#asksOf' }),
  update: term('update', { label: 'Update', short: 'a check-in asked for', meaning: 'An update asked of a goal’s owner.', long: 'Someone asked the owner to check in. Open until they do (or answer it), or it is withdrawn.', rule: 'asks#asksOf' }),
  question: term('question', { label: 'Question', short: 'for the owner', meaning: 'A question for a goal’s owner.', long: 'A question for the owner, often from a review. Open until it is answered or withdrawn.', rule: 'asks#asksOf' }),
  action: term('action', { label: 'Action', short: 'something to do', meaning: 'Something someone agreed to do, by a week.', long: 'Something to do, agreed in a review, for someone, by a week. Marked done, never answered.', rule: 'asks#asksOf' }),
};

export type AskWord = AskStatus | 'overdue';
export const ASK_STATUS: Record<AskWord, Term<AskWord>> = {
  open: term('open', { label: 'Open', short: 'waiting for a response', meaning: 'Waiting for the person asked to respond.', long: 'Nobody has answered it (an action: marked it done) or withdrawn it yet.', rule: 'asks#asksOf' }),
  answered: term('answered', { label: 'Answered', short: 'closed with an answer', meaning: 'The person asked has answered it.', long: 'Closed by its answer, which applies to every goal it is about.', rule: 'asks#isResolved' }),
  done: term('done', { label: 'Done', short: 'finished', meaning: 'Finished: the action was done.', long: 'An action marked done by whoever does it, whoever agreed it, or an admin.', rule: 'asks#isResolved', same: 'status.done' }),
  withdrawn: term('withdrawn', { label: 'Withdrawn', short: 'no longer needed', meaning: 'Taken back by whoever asked, or an admin.', long: 'No longer needed; the log keeps it.', rule: 'asks#asksOf' }),
  overdue: term('overdue', {
    label: 'Overdue', short: 'open past its week',
    meaning: 'Still open after the week it was due by.',
    long: 'An ask with a due week, still open after that week. Only asks are overdue; a goal without a recent check-in has no recent update.',
    rule: 'asks#isOverdue',
  }),
};

/* ---------- a review's session ---------- */

export type SessionWord = 'not-started' | 'in-progress' | 'held';
export const SESSION: Record<SessionWord, Term<SessionWord>> = {
  'not-started': term('not-started', { label: 'Not started', short: 'nothing said yet', meaning: 'Hasn’t begun: nothing said or reviewed yet this session.', long: 'Nobody has marked a goal reviewed or said anything in this session yet.', rule: 'review#sessionState', same: 'status.planned' }),
  'in-progress': term('in-progress', { label: 'In progress', short: 'still running', meaning: 'Under way: some goals reviewed, not all.', long: 'Something has been said or reviewed, but not every goal in the session.', rule: 'review#sessionState', same: 'quarter.open' }),
  held: term('held', { label: 'Held', short: 'every goal reviewed', meaning: 'Every goal in the session has been marked reviewed.', long: 'Every goal in it has been marked reviewed; it was held on the day the last one was.', rule: 'review#sessionState' }),
};

/* ---------- what a review decides about a goal behind (deep review P2, 10 Nov) ---------- */

export type DecidedWord = 'next-step' | 'accept-risk';
export const DECIDED: Record<DecidedWord, Term<DecidedWord>> = {
  'next-step': term('next-step', { label: 'Next step', short: 'who does what, by when', meaning: 'What happens next for a goal behind: an action with an owner and a week it is due by.', long: 'An action agreed for a goal that is off track or at risk, with the person who does it and the week it is due by. Open until it is marked done; overdue once its week has passed.', rule: 'decide#decisionFor' }),
  'accept-risk': term('accept-risk', { label: 'We accept the risk', short: 'no action, with a reason', meaning: 'The review decided to take no action on a goal behind, and said why.', long: 'A review looked at a goal that is off track or at risk and decided to take no action for now, with a reason everyone can read. It is kept on the goal and in the review’s record; the goal still needs attention.', rule: 'decide#decisionFor' }),
};

/* ---------- the trend ---------- */

export type TrendWord = 'worse' | 'better' | 'flat';
/** Which way a goal is heading over its last check-ins: one rule (trend.ts) for the flag, the story, the scorecard and the chart. */
export const TREND: Record<TrendWord, Term<TrendWord>> = {
  worse: { ...FLAG.trend, code: 'worse', same: 'flag.trend', retired: undefined },
  better: term('better', {
    label: 'Getting better', short: 'closer to plan each time',
    meaning: 'Closer to plan (or further from its limit, or a stage expected sooner) at each of the last two check-ins.',
    long: `The opposite of getting worse, by the same rule: the gap to plan smaller (or the room to the limit larger) at each of the last two of ${TREND_SPAN} check-ins, or a stage expected sooner than at the check-in before.`,
    rule: 'trend#gapTrend',
    retired: ['Closing the gap', 'catching up', 'Gaining ground', 'Moving away from the limit'],
  }),
  flat: term('flat', {
    label: 'No steady trend', short: 'not one way each time',
    meaning: 'Neither further behind nor closer at each of the last two check-ins.',
    long: `Not the same way at each of the last two of ${TREND_SPAN} check-ins (or fewer than ${TREND_SPAN} to go on), so neither getting worse nor getting better.`,
    rule: 'trend#gapTrend',
    where: ['screens', 'ai'],
  }),
};

/* ---------- the gap to plan ---------- */

export type GapWord = 'behind' | 'ahead' | 'on-plan' | 'reached';
export const GAP: Record<GapWord, Term<GapWord>> = {
  behind: term('behind', { label: 'behind plan', short: 'short of the plan', meaning: 'Short of the plan for its week, by the amount said: “9 hours behind plan”.', long: 'The latest number against the plan for its own week, in the goal’s units, said the same whichever way is better.', rule: 'format#gapText', retired: ['below week-', 'above week-', 'On the week-'] }),
  ahead: term('ahead', { label: 'ahead of plan', short: 'better than the plan', meaning: 'Better than the plan for its week, by the amount said: “3 pts ahead of plan”.', long: 'The latest number against the plan for its own week, in the goal’s units, said the same whichever way is better.', rule: 'format#gapText' }),
  'on-plan': term('on-plan', { label: 'On plan', short: 'exactly the plan', meaning: 'Exactly the plan for its week, at the goal’s decimals.', long: 'The latest number is the plan for its week, as written to the goal’s decimals.', rule: 'format#gapText' }),
  reached: term('reached', { label: 'Target reached', short: 'there already', meaning: 'The latest number has reached the target (or every stage is done).', long: 'The latest number is at or past the target, or every stage is done. It is a gap, not a result: the result comes when the goal is due.', rule: 'format#gapText' }),
};

/**
 * The word for an amount on the wrong side of a plan or target (demo review, 8 Nov): "short" when higher is better,
 * "over" when lower is better. "1 pt short" of a 46% plan; "1 min over" a 6 min plan, never "1 min short". `better` is
 * the goal's better direction: +1 when higher is better, −1 when lower is.
 */
export function shortWord(better: number): 'short' | 'over' {
  return better < 0 ? 'over' : 'short';
}

/** "9 hours behind plan", "3 pts ahead of plan", "On plan": `better` is the difference in the better direction, `amount` it said in the goal's units. */
export function gapPhrase(better: number, amount: string): string {
  return better === 0 ? GAP['on-plan'].label : `${amount} ${better > 0 ? GAP.ahead.label : GAP.behind.label}`;
}

/* ---------- removed, stopped, ended ---------- */

export type RemovalWord = 'left' | 'stopped' | 'ended' | 'removed' | 'comment-removed' | 'note-removed' | 'edited';
export const REMOVAL: Record<RemovalWord, Term<RemovalWord>> = {
  left: term('left', { label: 'Left', short: 'left the workspace', meaning: 'A person who has left the workspace.', long: 'Out of pickers, counts, reviews and Home; named in history as “Name (left)”.', rule: 'removal#markPersonLeft' }),
  stopped: term('stopped', { label: 'Stopped', short: 'stopped early, with a reason', meaning: 'A goal stopped before the end of its year, with a reason. Not a status.', long: 'Out of every list, still on its own page, in exports and in Activity, with when, by whom and why.', rule: 'removal#stopGoal' }),
  ended: term('ended', { label: 'Ended', short: 'no longer due', meaning: 'A review that has ended: it keeps its notes and actions and is no longer due.', long: 'An ended review keeps everything said in it, and is no longer due or listed.', rule: 'removal#endReview' }),
  removed: term('removed', { label: 'Removed', short: `restorable for ${RESTORE_DAYS} days`, meaning: `Deleted, and still restorable for ${RESTORE_DAYS} days.`, long: `Taken away, never erased: it can be undone, and restored for ${RESTORE_DAYS} days under Recently removed.`, rule: 'removal#recentlyRemoved' }),
  'comment-removed': term('comment-removed', { label: 'Comment removed', short: 'its place stays', meaning: 'What a thread shows where a comment was.', long: 'A removed comment keeps its place in the thread, with these words.', rule: 'removal#commentsOf' }),
  'note-removed': term('note-removed', { label: 'Note removed', short: 'its place stays', meaning: 'What a review’s record shows where a note was.', long: 'A removed review note keeps its place in the record, with these words.', rule: 'removal#commentsOf' }),
  edited: term('edited', { label: 'edited', short: 'changed after posting', meaning: 'Beside words corrected after they were posted.', long: 'The words were corrected after they were posted; the log keeps the before and after.', rule: 'removal#commentsOf' }),
};

/** A person who left, as history names them: "Maya Patel (left)". */
export const leftName = (name: string) => `${name} (${REMOVAL.left.label.toLowerCase()})`;
export const LEFT = REMOVAL.left.label;
export const STOPPED = REMOVAL.stopped.label;
export const ENDED = REMOVAL.ended.label;
export const REMOVED = REMOVAL.removed.label;
export const COMMENT_REMOVED = REMOVAL['comment-removed'].label;
export const NOTE_REMOVED = REMOVAL['note-removed'].label;
export const EDITED = REMOVAL.edited.label;

/* ---------- a workspace ---------- */

/** What a workspace is, in one sentence (outside review and Lane, 12 Nov). Workspace's About says it under the workspace's name, and
    docs/glossary.md quotes it; the rebuild states its own the same way (R6a). Not a status word, so not a term. */
export const WORKSPACE_MEANS = 'A workspace is one organisation’s goals and the people who share them: its own people and teams, its own goal year and check-in day, and its own admins. What you can do in it depends on your role there: an admin or a member.';

/* ---------- every group, and helpers ---------- */

export const GROUPS = {
  status: { title: 'A goal’s status', terms: STATUS },
  flag: { title: 'What needs attention, and why', terms: FLAG },
  attention: { title: 'Needs attention and being handled', terms: ATTENTION },
  warning: { title: 'Other warnings on a goal’s story', terms: WARNING },
  trend: { title: 'Which way it’s heading', terms: TREND },
  gap: { title: 'Against the plan', terms: GAP },
  result: { title: 'A goal’s result, once it’s due', terms: RESULT },
  quarter: { title: 'Each quarter of a goal year', terms: QUARTER },
  ownerView: { title: 'The owner’s view at the wrap-up', terms: OWNER_VIEW },
  stage: { title: 'A dated stage', terms: STAGE },
  askKind: { title: 'Kinds of ask', terms: ASK_KIND },
  askStatus: { title: 'Where an ask stands', terms: ASK_STATUS },
  session: { title: 'A review’s session', terms: SESSION },
  removal: { title: 'Removed, stopped and ended', terms: REMOVAL },
} as const;
export type GroupKey = keyof typeof GROUPS;

/** Every term, with its group. */
export const ALL_TERMS: { group: GroupKey; term: Term }[] = (Object.keys(GROUPS) as GroupKey[]).flatMap((group) => Object.values(GROUPS[group].terms as Record<string, Term>).map((term) => ({ group, term })));

/** The labels of a group, by code. */
export const labels = <C extends string>(terms: Record<C, Term<C>>): Record<C, string> => Object.fromEntries(Object.entries<Term<C>>(terms).map(([k, t]) => [k, t.label])) as Record<C, string>;

/** A goal's status as people read it. */
export const LABEL: Record<DisplayStatus, string> = labels(STATUS);
/** What each status means, one line; and in a few words, for a key. */
export const MEANING: Record<DisplayStatus, string> = Object.fromEntries(Object.entries(STATUS).map(([k, t]) => [k, t.meaning])) as Record<DisplayStatus, string>;
export const SHORT_MEANING: Record<DisplayStatus, string> = Object.fromEntries(Object.entries(STATUS).map(([k, t]) => [k, t.short])) as Record<DisplayStatus, string>;
export const RESULT_TEXT: Record<ResultKind, string> = { completed: RESULT.completed.label, late: RESULT.late.label, missed: RESULT.missed.label };
export const RESULT_MEANING: Record<ResultKind, string> = { completed: RESULT.completed.meaning, late: RESULT.late.meaning, missed: RESULT.missed.meaning };

/**
 * The words each status shape may stand beside: its status's own, and the words that share its shape (a stage's state,
 * a result, a quarter). A shape beside none of its words disagrees with it, such as the At risk half-circle beside
 * "Getting worse" on a goal that is on track: a flag that isn't a status uses the warning mark (design rules). The check
 * on every screen (P3, P4) and the components' test read this.
 */
export const SHAPE_WORDS: Record<DisplayStatus, readonly string[]> = {
  on: [STATUS.on.label, RESULT.completed.label, RESULT.late.label, QUARTER.met.label],
  risk: [STATUS.risk.label, STAGE.risk.label],
  off: [STATUS.off.label, STAGE.off.label, RESULT.missed.label, QUARTER.missed.label],
  stale: [STATUS.stale.label],
  none: [STATUS.none.label],
  unmeasured: [STATUS.unmeasured.label],
  planned: [STATUS.planned.label, STAGE.planned.label],
  done: [STATUS.done.label],
};

/**
 * Whether a status shape agrees with the words beside it: they name its status (or a word that shares its shape). A
 * word inside a longer one counts as the longer one: "Not met" is not "Met", and "Met late" is not "Late".
 */
export function shapeAgrees(k: DisplayStatus, beside: string): boolean {
  const text = beside.toLowerCase();
  const found: { at: number; end: number; word: string }[] = [];
  for (const word of new Set(Object.values(SHAPE_WORDS).flat().map((w) => w.toLowerCase()))) {
    for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + 1)) {
      const end = at + word.length;
      // Whole words only: "late" in "slate" or "on track" in "non tracked" don't count.
      if (/[a-z]/.test(text[at - 1] ?? '') || /[a-z]/.test(text[end] ?? '')) continue;
      found.push({ at, end, word });
    }
  }
  const whole = found.filter((f) => !found.some((g) => g !== f && g.at <= f.at && g.end >= f.end && g.end - g.at > f.end - f.at));
  const mine = new Set(SHAPE_WORDS[k].map((w) => w.toLowerCase()));
  return whole.some((f) => mine.has(f.word));
}

/** A word in the middle of a sentence: "off track", "no recent update". */
export const lower = (t: Pick<Term, 'label'>) => t.label.charAt(0).toLowerCase() + t.label.slice(1);
/** For the AI assistant and anything a machine reads: the word people see, then the code: "Off track (off)". */
export const withCode = (t: Pick<Term, 'label' | 'code'>) => `${t.label} (${t.code})`;
/** A code or a label, any case, as its code: "Off track", "off track" and "off" are all `off`. Null when it's neither. */
export function codeFrom<C extends string>(terms: Record<C, Term<C>>, input: unknown): C | null {
  const s = String(input ?? '').trim().toLowerCase().replace(/\s*\([^)]*\)$/, '');
  if (!s) return null;
  for (const t of Object.values<Term<C>>(terms)) if (t.code.toLowerCase() === s || t.label.toLowerCase() === s) return t.code;
  // "Off track (off)" as the AI prints it.
  const coded = /\(([^)]+)\)\s*$/.exec(String(input ?? ''));
  return coded ? codeFrom(terms, coded[1]) : null;
}
/** Every way to say a group's terms that codeFrom accepts, for a tool's input description: "On track (on), At risk (risk), …". */
export const choices = <C extends string>(terms: Record<C, Term<C>>, only?: readonly C[]) => (only ?? (Object.keys(terms) as C[])).map((k) => withCode(terms[k])).join(', ');
