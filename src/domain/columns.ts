/* The one spreadsheet format (release 3). Every sheet and every column the app writes or reads is defined here, once:
   its header, what it means, whether it says which record a row is (match), can be changed (edit), says what to do with
   the row (action) or is worked out by the app (worked: written with the vocabulary's words, never read back), and how
   it is written. The workbook, the zipped CSVs, a single CSV, the set-up template, the Data tables, the AI assistant's
   tools and docs/export-format.md (src/domain/formatDoc.ts) are all made from it, and the import recognises a sheet by
   its header row, never its name.

   The words a column takes (a level, a type, a call…) are here too, with the ways people write them, so the export
   writes one word and the import reads it back; a word it doesn't know is a problem to fix, never a quiet default. */
import { EVERYDAY_WORD, LEVEL_WORDS } from './levels';
export { LEVEL_WORDS };
import { ASK_KIND_LABEL, ASK_STATUS_LABEL, asksOf } from './asks';
import { CAUSES_AHEAD, CAUSES_BEHIND, causeLabel, MIN_PATH, MIN_REASON } from './checkin';
import { readingCells } from './reading';
import { planAsOf, planAt, planEnd, weekDate } from './plan';
import { weekCode } from './weeks';
import { answerOf, saidIn, type Said } from './review';
import type { GoalSummary } from './summary';
import type { ModuleSheet } from './records';
import type { Ask, Cause, CheckIn, Cycle, Goal, Person, PlanShape, RecoveryState, Snapshot, Status, Workspace } from './types';
import { ASK_KIND, FLAG, LABEL, LEFT, leftName, lower, QUARTER, STOPPED } from './vocabulary';

export type Cell = string | number | null;

export interface ExportInput {
  ws: Pick<Workspace, 'id' | 'name'>;
  snapshot: Snapshot;
  cycle: Cycle;
  week: number;
  today: Date;
  /** Only these goals (the current view); every goal in the cycle when left out. */
  goals?: Goal[];
  /** The sheets feature modules add (domain/records), after the core's: those of the modules in this build. */
  sheets?: readonly ModuleSheet[];
  /** False when Reviews is switched off here (RS, spec 5): the workbook leaves out the Notes sheet and Asks' Review column. */
  reviews?: boolean;
}

/** What a column is for. */
export type Role = 'match' | 'edit' | 'action' | 'worked' | 'shown';
/** How the README and docs say each role. */
export const ROLE_WORD: Record<Role, string> = {
  match: 'Matches the row',
  edit: 'You can change it',
  action: 'What to do with the row',
  worked: 'Worked out',
  shown: 'For reading',
};
/** What loading a file back does with a column of each role, unless the column says otherwise. */
const ROLE_LOADED: Record<Role, string> = {
  match: 'Matches the row to its record; it never changes',
  edit: 'Changed when loaded back',
  action: 'Done when loaded back, with the same rules and preview as the app',
  worked: 'Worked out by the app; ignored when loaded back',
  shown: 'For reading; not loaded back from this sheet',
};

/** What loading a column back does: its own words, or its role's. */
export const roleLoaded = (c: { role: Role; loaded?: string }) => c.loaded ?? ROLE_LOADED[c.role];

export interface Column<C> {
  header: string;
  role: Role;
  /** What it means, in a sentence. */
  means: string;
  /** What loading it back does, when it isn't the role's usual. */
  loaded?: string;
  write: (c: C) => Cell;
}

/** Everything a row's writer can look up. */
export interface Ctx {
  x: ExportInput;
  /** A person's name; someone who left reads "Name (left)". Empty when there's no one. */
  name: (id: string | null | undefined) => string;
  /** A person's email, or null. */
  email: (id: string | null | undefined) => string | null;
  team: (id: string | null | undefined) => string | null;
  /** Any goal in the cycle, stopped ones included. */
  goal: (id: string | null | undefined) => Goal | undefined;
}
export interface GoalRow { c: Ctx; s: GoalSummary; g: Goal }
export interface PlanRow { c: Ctx; g: Extract<Goal, { kind: 'metric' }> }
export interface CheckInRow { c: Ctx; g: Goal; ci: CheckIn }
export interface PersonRow { c: Ctx; p: Person }
export interface AskRow { c: Ctx; a: Ask }
export interface NoteRow { c: Ctx; d: Said }

/* ---------- the words a column takes ---------- */

/** Lower case, single spaces, no punctuation but what a word needs. */
const norm = (s: string) => s.trim().toLowerCase().replace(/[‐-―]/g, '-').replace(/\s+/g, ' ');

export interface Words<C extends string> {
  /** What the column is called in problems: "Level". */
  what: string;
  /** The word written for each code (the first one people can type). */
  word: Record<C, string>;
  /** Other ways people write each code, lower case. */
  also: Partial<Record<C, string[]>>;
  /** Old prefixes still read (from before this format), lower case. */
  prefix?: Partial<Record<C, string[]>>;
}
/** A word's code; null for an empty cell; undefined for a word it doesn't know. */
export function codeOf<C extends string>(w: Words<C>, raw: string): C | null | undefined {
  const v = norm(raw);
  if (!v) return null;
  for (const [code, word] of Object.entries(w.word) as [C, string][]) if (norm(word) === v || (w.also[code] ?? []).includes(v) || code === v) return code;
  for (const [code, list] of Object.entries(w.prefix ?? {}) as [C, string[]][]) if (list.some((p) => v.startsWith(p))) return code;
  return undefined;
}
/** "Level says “vp”. Use north star, svp or team." (import spec 3.1: the column, what was read, and what would be right.) */
export const unknownWord = <C extends string>(w: Words<C>, raw: string) => `${w.what} says “${raw.trim()}”. Use ${oneOf(Object.values(w.word) as string[])}.`;
/** Every way a column's words are written: each word, then the other spellings it reads (what a near miss is sought among). */
export const wordsAndAlso = <C extends string>(w: Words<C>): string[] => [...(Object.values(w.word) as string[]), ...(Object.values(w.also) as string[][]).flat()];
export const oneOf = (list: string[]) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} or ${list.at(-1)}`);
/** "Goals, Plan and People" */
export const andList = (list: string[]) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

export const TYPE_WORDS: Words<Goal['kind']> = { what: 'Type', word: { metric: 'metric', range: 'range', milestone: 'milestone' }, also: { metric: ['move a number', 'number'], range: ['keep a number in range', 'keep in range'], milestone: ['hit dated stages', 'stages'] }, prefix: { metric: ['metric', 'move'], range: ['range', 'keep'], milestone: ['mile', 'hit'] } };
export const SHAPE_WORDS: Words<PlanShape> = { what: 'Plan', word: { straight: 'straight', back: 'back-loaded', stepped: 'stepped' }, also: { straight: ['linear', 'straight line'], back: ['back', 'backloaded', 'back loaded'], stepped: ['steps', 'step'] } };
/** A baseline's firmness (BL): provisional, or firm. */
export const FIRMNESS_WORDS: Words<'provisional' | 'firm'> = { what: 'Baseline is', word: { provisional: 'provisional', firm: 'firm' }, also: { provisional: ['yes', 'y', 'true', 'draft', 'estimate'], firm: ['no', 'n', 'false', 'final', 'confirmed'] } };
export const BOUND_WORDS: Words<'atMost' | 'atLeast' | 'between'> = { what: 'Must stay', word: { atMost: 'at most', atLeast: 'at least', between: 'between' }, also: { atMost: ['atmost', 'max', 'maximum', '<=', '≤', 'below'], atLeast: ['atleast', 'min', 'minimum', '>=', '≥', 'above'] } };
export const YES_WORDS: Words<'yes' | 'no'> = { what: 'Admin', word: { yes: 'yes', no: 'no' }, also: { yes: ['y', 'true', '1', 'x', 'admin'], no: ['n', 'false', '0'] } };
export const CALL_WORDS: Words<Status> = {
  what: 'Call',
  word: { on: LABEL.on, risk: LABEL.risk, off: LABEL.off, done: LABEL.done },
  // The colours people used to say.
  also: { on: ['green'], risk: ['amber', 'yellow'], off: ['red'] },
};
const causeCodes = [...new Map([...CAUSES_BEHIND, ...CAUSES_AHEAD]).keys()];
export const CAUSE_WORDS: Words<Cause> = { what: 'Cause', word: Object.fromEntries(causeCodes.map((k) => [k, causeLabel(k)])) as Record<Cause, string>, also: {} };
export const RECOVERY_WORDS: Words<RecoveryState> = { what: 'Recovery', word: { plan: 'Plan', investigating: 'Still investigating', help: 'Needs a decision or help', target: 'Target should change' }, also: { help: ['help'], target: ['target'] } };
/** A Goals row's Action: stop a goal with history (with a Reason), or delete one set up by mistake (domain/removal).
    Example marks a template's example row, which is never imported (import spec C15). */
export const GOAL_ACTION_WORDS: Words<'stop' | 'delete' | 'example'> = { what: 'Action', word: { stop: 'Stop', delete: 'Delete', example: 'Example' }, also: { stop: [STOPPED.toLowerCase()], delete: ['deleted', 'remove'] } };
/** A People row's Action: mark someone as left, handing their goals and asks to Takes over (domain/removal); or Example. */
export const PERSON_ACTION_WORDS: Words<'left' | 'example'> = { what: 'Action', word: { left: LEFT, example: 'Example' }, also: { left: ['leave', 'leaving', 'mark as left'] } };

export { isEmail, normalEmail } from './people';

/* ---------- the sheets ---------- */

/** The core's sheets. A feature module's sheet (domain/records ModuleSheet) has a kind of its own. */
export type SheetKind = 'goals' | 'plan' | 'checkIns' | 'people' | 'results' | 'asks' | 'notes';
export interface SheetSpec<C, K extends string = SheetKind> {
  kind: K;
  name: string;
  /** One row per… */
  rowIs: string;
  about: string;
  /** Whether loading the file back reads it. */
  loaded: boolean;
  columns: Column<C>[];
}

const m = <C,>(header: string, means: string, write: (c: C) => Cell, loaded?: string): Column<C> => ({ header, role: 'match', means, write, ...(loaded ? { loaded } : {}) });
const e = <C,>(header: string, means: string, write: (c: C) => Cell, loaded?: string): Column<C> => ({ header, role: 'edit', means, write, ...(loaded ? { loaded } : {}) });
const w = <C,>(header: string, means: string, write: (c: C) => Cell): Column<C> => ({ header, role: 'worked', means, write });
const sh = <C,>(header: string, means: string, write: (c: C) => Cell): Column<C> => ({ header, role: 'shown', means, write });
/** Columns for a module's sheet (domain/records ModuleSheet): one that says which record a row is, and one only shown. */
export const moduleColumn = { match: m, shown: sh };
/** A cell: empty for nothing. */
export const cellOr = (v: string | number | null | undefined): Cell => (v == null || v === '' ? null : v);
const blank = () => null;
const or = (v: string | number | null | undefined): Cell => (v == null || v === '' ? null : v);

const metricOf = (g: Goal) => (g.kind === 'metric' ? g : null);
const rangeOf = (g: Goal) => (g.kind === 'range' ? g : null);
const parentOf = (r: GoalRow) => r.c.goal(r.g.parentId);
const quarter = (n: number) => (r: GoalRow): Cell => {
  const q = r.s.story.quarters.find((y) => y.quarter.n === n);
  return !q || q.kind === 'none' ? null : `${QUARTER[q.kind].label}: ${q.text.replace(/^Q\d: /, '')}`;
};
/** A check-in's stages as the owner gave them (done, expected or on its due week), so loading it back changes nothing. */
export function stagesText(g: Goal, c: CheckIn): string {
  if (g.kind !== 'milestone' || !c.stages) return '';
  return g.stages.map((st) => {
    const u = c.stages!.find((x) => x.stageId === st.id);
    return `${st.name}: ${u?.doneWeek != null ? 'done week ' + u.doneWeek : u?.forecastWeek != null ? 'expected week ' + u.forecastWeek : 'due week ' + st.dueWeek}`;
  }).join('; ');
}
/** "Design@3; Pilot@7": a milestone goal's stages, as the Stages column says them. */
export const stagesSpec = (g: Goal) => (g.kind === 'milestone' ? g.stages.map((x) => `${x.name}@${x.dueWeek}`).join('; ') : '');

/** A goal's result and each quarter against the plan: worked out, on Goals and on Results. */
const RESULT_COLUMNS: Column<GoalRow>[] = [
  w('Result', 'Set once the goal is due, in the result words defined under Words.', (r) => or(r.s.story.result?.text)),
  w('Q1', 'The first quarter against the owner’s plan: a quarter’s target is the plan’s number at its end.', quarter(1)),
  w('Q2', 'The second quarter against the plan.', quarter(2)),
  w('Q3', 'The third quarter against the plan.', quarter(3)),
  w('Q4', 'The fourth quarter against the plan.', quarter(4)),
];

export const GOALS: SheetSpec<GoalRow> = {
  kind: 'goals', name: 'Goals', rowIs: 'goal', loaded: true,
  about: 'Every goal: what it is, who owns it, its plan, and where it stands. Add a row with no Key or ID for a new goal.',
  columns: [
    m('Key', 'The goal’s short key in this workspace (G-12). It never changes, and a goal carried into the next cycle keeps it. Leave it empty for a new goal.', (r) => or(r.g.key), 'Matches the goal first, so a file from last cycle still finds its goals'),
    m('ID', 'The goal’s identity in this cycle. Leave it empty for a new goal.', (r) => r.g.id, 'Matches the goal when there’s no Key'),
    e('Goal', 'The goal’s name.', (r) => r.g.title),
    { header: 'Action', role: 'action', means: `Empty to add or change the goal. ${GOAL_ACTION_WORDS.word.stop} stops a goal with check-ins (say why in Reason); ${GOAL_ACTION_WORDS.word.delete} deletes one with none, set up by mistake.`, write: blank },
    e('Ref', 'A label of your own for this row, so other rows in the same file can name the goal it adds before it has a key (Feeds into ref, Goal ref). Only for this file: never kept. Empty in an export.', blank, 'Names the row’s goal for Feeds into ref and Goal ref in the same file'),
    e('Level', `${oneOf(Object.values(LEVEL_WORDS.word))}: how important it is, for reporting.`, (r) => LEVEL_WORDS.word[r.g.level] ?? r.g.level),
    e('Team', 'The team it belongs to, by name.', (r) => or(r.c.team(r.g.teamId))),
    e('Owner', 'Who owns it, by name. A name works when only one person has it; Owner email is exact.', (r) => or(r.c.name(r.g.ownerId))),
    e('Owner email', 'Who owns it, by email: what tells two people with the same name apart.', (r) => r.c.email(r.g.ownerId), 'Changes the owner; when Owner and Owner email disagree, the one you changed counts'),
    e('Type', `${oneOf(Object.values(TYPE_WORDS.word))}: move a number, keep one in range, or hit dated stages.`, (r) => TYPE_WORDS.word[r.g.kind], 'Sets a new goal’s type; it can’t change on an existing goal'),
    e('State', 'active or proposed.', (r) => (r.g.stoppedAt ? 'stopped' : r.g.proposedAt ? 'proposed' : 'active')),
    e('Unit', 'Number and range goals: what the number counts (%, days, ms).', (r) => (r.g.kind === 'milestone' ? null : or(r.g.unit))),
    e('Decimals', 'Number and range goals: how many decimal places the number has (0 to 3).', (r) => (r.g.kind === 'milestone' ? null : r.g.decimals)),
    e('Start', 'Number goals: where the plan starts.', (r) => metricOf(r.g)?.plan.start ?? null, 'Changes the plan; needs a reason once check-ins have started'),
    e('Baseline period', 'Number goals: the period the baseline (Start) covers, when it is a figure you already have (June to September 2026). Shown as the goal’s number until its first check-in.', (r) => metricOf(r.g)?.baseline?.period ?? null),
    e('Baseline is', `Number goals with a baseline period: ${oneOf(Object.values(FIRMNESS_WORDS.word))}. Firming up a provisional baseline isn’t a plan change.`, (r) => { const b = metricOf(r.g)?.baseline; return b ? FIRMNESS_WORDS.word[b.provisional ? 'provisional' : 'firm'] : null; }),
    e('Target', 'Number goals: where the plan ends, by its due week.', (r) => metricOf(r.g)?.plan.target ?? null, 'Changes the plan; needs a reason once check-ins have started'),
    e('Plan', `Number goals: the plan’s shape, ${oneOf(Object.values(SHAPE_WORDS.word))}.`, (r) => { const g = metricOf(r.g); return g ? SHAPE_WORDS.word[g.plan.shape] : null; }, 'Changes the plan; needs a reason once check-ins have started'),
    e('From', 'Number goals: the week the plan starts from (2026-W46).', (r) => { const g = metricOf(r.g); return g ? weekCode(r.c.x.cycle, g.plan.fromWeek ?? 0) : null; }, 'Changes the plan; needs a reason once check-ins have started'),
    e('Plan from week', 'Number goals: the week the plan starts from (0 for the cycle’s start, later for a goal set up mid-cycle).', (r) => { const g = metricOf(r.g); return g ? g.plan.fromWeek ?? 0 : null; }, 'Changes the plan; needs a reason once check-ins have started'),
    e('To', 'Number goals: the week the target is due (2027-W13).', (r) => { const g = metricOf(r.g); return g ? weekCode(r.c.x.cycle, planEnd(g.plan, r.c.x.cycle.weeks)) : null; }, 'Changes the plan; needs a reason once check-ins have started'),
    e('Due week', 'Number goals: the week the target is due, counted from the cycle’s start.', (r) => { const g = metricOf(r.g); return g ? planEnd(g.plan, r.c.x.cycle.weeks) : null; }, 'Changes the plan; needs a reason once check-ins have started'),
    e('Limit', 'Range goals: the number it must stay within, or both of two (99.5–99.95).', (r) => { const g = rangeOf(r.g)?.range; return g ? (g.lower != null ? `${g.lower}–${g.limit}` : g.limit) : null; }),
    e('Must stay', `Range goals: ${oneOf(Object.values(BOUND_WORDS.word))} the limit.`, (r) => { const g = rangeOf(r.g); return g ? BOUND_WORDS.word[g.range.bound] : null; }),
    e('Margin', 'Range goals: how close to the limit counts as at risk.', (r) => rangeOf(r.g)?.range.margin ?? null),
    e('Stages', 'Milestone goals: each stage as Name@week, separated by semicolons.', (r) => or(stagesSpec(r.g))),
    e('Feeds into', 'The goal this one feeds, by name.', (r) => or(parentOf(r)?.title)),
    e('Feeds into key', 'The goal this one feeds, by key. Exact where names repeat.', (r) => or(parentOf(r)?.key), 'Changes what it feeds; when Feeds into and Feeds into key disagree, the one you changed counts'),
    e('Feeds into ref', 'The goal this one feeds, by the Ref of its row in this file: a goal the same file adds. Empty in an export.', blank, 'Changes what it feeds, like Feeds into key'),
    e('Why it helps', 'Why this goal should move the one it feeds: a hypothesis, not a proven cause.', (r) => or(r.g.whyHelps)),
    e('Effect', 'The effect expected on the goal it feeds, in that goal’s unit.', (r) => r.g.effect),
    e('Source', 'Where the number comes from, and who owns that source.', (r) => or(r.g.source)),
    e('Definition', 'Exactly what is counted.', (r) => or(r.g.definition)),
    e('Reason', 'Why the plan is changing, or why the goal stops. Written by you; empty in an export.', blank, 'Kept in the change log with the change'),
    w('Status', 'Where the goal stands now, in the status words defined under Words below; Proposed for a proposed goal.', (r) => (r.g.stoppedAt ? STOPPED : r.s.statusLabel)),
    w('Since', 'How long it has stood so.', (r) => or(r.s.story.since)),
    w('Now', 'The latest number, or stages done.', (r) => or(r.s.now)),
    w('Plan this week', 'Number goals: the plan’s number this week.', (r) => (r.s.planNow != null ? r.s.planNowText : null)),
    w('Gap', 'How far it is from the plan, said the same whichever way is better.', (r) => or(r.s.gap)),
    w('Last check-in week', 'The week of its latest check-in.', (r) => r.s.lastWeek),
    w('Forecast', 'Where the recent trend takes it by its due week.', (r) => or(r.s.forecast)),
    w('Why it’s off', 'The owner’s latest reason, when it’s behind.', (r) => or(r.s.story.why)),
    w('Recovery plan', 'What the owner will do about it.', (r) => or(r.s.story.doing)),
    w('By when', 'When it will be back on plan, or why there’s no date.', (r) => or(r.s.story.byWhen)),
    w('Needs', 'The open asks for a decision or help.', (r) => or(r.s.story.needs)),
    w('Next step', 'The owner’s next step.', (r) => or(r.s.story.next)),
    w('Warnings', 'What the numbers would hide; each warning starts with its word, defined under Words.', (r) => or(r.s.story.warnings.join(' '))),
    // The result and the quarters, as on Results: one definition, on both sheets.
    ...RESULT_COLUMNS,
  ],
};

/** The Plan sheet's fixed columns; a "Week N" column follows for every week to the last due week. */
export const PLAN: SheetSpec<PlanRow> = {
  kind: 'plan', name: 'Plan', rowIs: 'number goal', loaded: true,
  about: 'The plan as numbers, one column per week. Type over any week to set the plan by hand.',
  columns: [
    m('Key', 'The goal’s key.', (r) => or(r.g.key), 'Matches the goal first'),
    m('ID', 'The goal’s ID in this cycle.', (r) => r.g.id, 'Matches the goal when there’s no Key'),
    sh('Goal', 'The goal’s name (change it on Goals).', (r) => r.g.title),
    sh('Unit', 'What the number counts (change it on Goals).', (r) => or(r.g.unit)),
    e('Start', 'Where the plan starts.', (r) => r.g.plan.start, 'Changes the plan; needs a reason once check-ins have started'),
  ],
};
export const WEEK_COLUMN = { header: 'Week N', role: 'edit' as Role, means: 'The plan’s number that week, from the week after Plan from week to the due week. Empty before and after. If the plan changed, earlier check-ins were judged against the plan of their day (Plan that week on Check-ins).', loaded: 'Sets the plan numbers by hand; needs a reason once check-ins have started' };
export const isWeekHeader = (h: string) => /^week \d+$/i.test(h.trim());
export const planWeekValue = (r: PlanRow, week: number): Cell => {
  const from = r.g.plan.fromWeek ?? 0, end = planEnd(r.g.plan, r.c.x.cycle.weeks);
  return week <= from || week > end ? null : Number(planAt(r.g.plan, week, r.c.x.cycle.weeks).toFixed(r.g.decimals));
};

/** A check-in's reading, as the sheet's four columns say it. */
const cellsOf = (r: CheckInRow) => readingCells(r.ci, r.g.kind === 'milestone' ? 0 : r.g.decimals);

export const CHECK_INS: SheetSpec<CheckInRow> = {
  kind: 'checkIns', name: 'Check-ins', rowIs: 'check-in', loaded: true,
  about: 'Every check-in: the number or stages reported each week, the owner’s call and their account of it. Add a row with no ID for a new check-in, a past week included.',
  columns: [
    m('ID', 'The check-in’s own identity. Leave it empty to add one.', (r) => r.ci.id, 'Matches the check-in; with none, a row corrects that goal’s latest check-in for the week'),
    m('Goal key', 'The goal’s key.', (r) => or(r.g.key), 'Matches the goal first'),
    m('Goal ID', 'The goal’s ID in this cycle.', (r) => r.g.id, 'Matches the goal when there’s no Goal key'),
    m('Goal', 'The goal’s name.', (r) => r.g.title, 'Matches the goal by name, only when there’s no Goal key or Goal ID'),
    m('Goal ref', 'The goal, by the Ref of its row on Goals in this file: a goal the same file adds. Empty in an export.', blank, 'Matches the goal the Goals row with that Ref adds or changes, first'),
    m('Week', 'The week it reports on, counted from the cycle’s start (week 1 onwards).', (r) => r.ci.week, 'Matches the week; a check-in’s week never changes'),
    w('Week starting', 'The date that week starts.', (r) => weekDate(r.c.x.cycle, r.ci.week)),
    e('Value', 'Number and range goals: the number that week.', (r) => r.ci.value),
    // Where the number came from (MT4 3.3, NR 2.4): facts about the check-in, worked out and never loaded back.
    w('Number from', '“Typed”, or the name of the source the number was filled in from. Empty when no source was read.', (r) => cellsOf(r).from),
    w('Source’s number', 'What the source said, when one was read.', (r) => cellsOf(r).value),
    w('Measured at', 'When the source measured it (ISO, UTC).', (r) => cellsOf(r).at),
    sh('Reason for a different number', 'Why the owner’s number differs from the source’s, in their words.', (r) => cellsOf(r).reason),
    e('Stages', 'Milestone goals: each stage as “Pilot: done week 6”, “Pilot: expected week 8” or “Pilot: due week 7”, separated by semicolons.', (r) => or(stagesText(r.g, r.ci))),
    e('Call', `The owner’s status call: ${oneOf(Object.values(CALL_WORDS.word))}. Empty: the rules decide.`, (r) => CALL_WORDS.word[r.ci.status]),
    e('Cause', `Why it’s ahead or behind: ${oneOf([...new Set(Object.values(CAUSE_WORDS.word))])}.`, (r) => or(r.ci.cause ? causeLabel(r.ci.cause) : null), 'Required when behind or well ahead, as in the app'),
    e('Why', 'The owner’s reason, in their words.', (r) => or(r.ci.why), 'Required when behind or well ahead, as in the app'),
    e('Why greener', `Why the owner’s call is ${lower(FLAG.greener)}.`, (r) => or(r.ci.greenerWhy)),
    e('Path to green', 'What changes to get back on plan.', (r) => or(r.ci.pathToGreen?.what)),
    e('Recovery', `Where getting back stands: ${oneOf(Object.values(RECOVERY_WORDS.word))}.`, (r) => (r.ci.pathToGreen ? RECOVERY_WORDS.word[r.ci.pathToGreen.state ?? 'plan'] : null)),
    e('Back on plan by week', 'The week it’s back on plan by, when there’s a plan.', (r) => r.ci.pathToGreen?.byWeek ?? null),
    e('Needs', 'A decision or help it needs, and from whom.', (r) => or(r.ci.pathToGreen?.needs)),
    e('Next step', 'The owner’s next step.', (r) => or(r.ci.next)),
    w('Calculated', 'What the rules said that week, in the status words.', (r) => LABEL[r.ci.calculated]),
    w('Plan that week', 'Number goals: the plan’s number in that week, as it stood then.', (r) => (r.g.kind === 'metric' ? Number(planAt(planAsOf(r.g, r.ci.week), r.ci.week, r.c.x.cycle.weeks).toFixed(r.g.decimals)) : null)),
    w('Posted at', 'When it was posted.', (r) => r.ci.postedAt),
    w('Posted by', 'Who posted it.', (r) => or(r.c.name(r.ci.authorId))),
    w('Posted by email', 'Who posted it, by email.', (r) => r.c.email(r.ci.authorId)),
    w('Backfilled', '“yes” for history loaded later rather than posted in its week.', (r) => (r.ci.backfilled ? 'yes' : null)),
  ],
};

export const PEOPLE: SheetSpec<PersonRow> = {
  kind: 'people', name: 'People', rowIs: 'person', loaded: true,
  about: 'Everyone in the workspace. Add a row, with an email, for someone new.',
  columns: [
    m('Email', 'Their email: what matches them, and tells two people with the same name apart. Required for someone new.', (r) => r.c.email(r.p.id), 'Matches the person; with their ID in the row, a new email replaces the old one'),
    m('ID', 'The person’s own identity. It never changes.', (r) => r.p.id, 'Matches the person first'),
    e('Name', 'Their full name.', (r) => r.p.name),
    { header: 'Action', role: 'action', means: `Empty to add or change the person. ${PERSON_ACTION_WORDS.word.left} marks them as left; their goals and open asks go to Takes over.`, write: blank },
    e('Job title', 'Their job title.', (r) => or(r.p.role)),
    e('Team', 'Their team, by name.', (r) => or(r.c.team(r.p.teamId))),
    e('Admin', '“yes” for an admin: they can add people, change settings and change any goal.', (r) => (r.p.admin ? 'yes' : null)),
    e('Team objective', 'On the team lead’s row: what the team is for.', (r) => { const t = r.c.x.snapshot.teams.find((v) => v.id === r.p.teamId); return t && t.leadId === r.p.id ? or(t.objective) : null; }, 'Changes the team’s objective (on the lead’s row; empty there clears it)'),
    e('Takes over', `With ${PERSON_ACTION_WORDS.word.left}: who takes over their goals, open asks and teams, by email (or a name only one person has). Empty in an export.`, blank, `Used with ${PERSON_ACTION_WORDS.word.left}`),
  ],
};

export const RESULTS: SheetSpec<GoalRow> = {
  kind: 'results', name: 'Results', rowIs: 'goal', loaded: false,
  about: 'For year-end reporting: each goal’s result for the cycle and each quarter against the owner’s plan. A quarter’s target is the plan’s number at its end.',
  columns: [
    m('Key', 'The goal’s key.', (r) => or(r.g.key)),
    m('ID', 'The goal’s ID in this cycle.', (r) => r.g.id),
    sh('Goal', 'The goal’s name.', (r) => r.g.title),
    sh('Level', 'Its level.', (r) => LEVEL_WORDS.word[r.g.level] ?? r.g.level),
    sh('Team', 'Its team.', (r) => or(r.c.team(r.g.teamId))),
    sh('Owner', 'Who owns it.', (r) => or(r.c.name(r.g.ownerId))),
    sh('Owner email', 'Who owns it, by email.', (r) => r.c.email(r.g.ownerId)),
    sh('Target', 'Its target.', (r) => or(r.s.target)),
    sh('Due week', 'The week it’s due.', (r) => r.s.dueWeek),
    w('Status', 'Where it stands now.', (r) => (r.g.stoppedAt ? STOPPED : r.s.statusLabel)),
    w('Now', 'The latest number, or stages done.', (r) => or(r.s.now)),
    ...RESULT_COLUMNS,
  ],
};

export const ASKS: SheetSpec<AskRow> = {
  kind: 'asks', name: 'Asks', rowIs: 'ask', loaded: false,
  about: 'Every ask on the exported goals: a decision or help, an update, a question or an action, who asked whom, and where it stands. Asks are raised and answered in the app.',
  columns: [
    m('ID', 'The ask’s identity.', (r) => r.a.id),
    sh('Kind', `${oneOf(Object.values(ASK_KIND_LABEL))}.`, (r) => ASK_KIND_LABEL[r.a.kind]),
    sh('Ask', 'What was asked, in their words.', (r) => r.a.ask),
    sh('Goals', 'The goals it’s about.', (r) => r.a.goalIds.map((id) => r.c.goal(id)?.title ?? id).join('; ')),
    sh('Goal keys', 'Their keys.', (r) => or(r.a.goalIds.map((id) => r.c.goal(id)?.key ?? '').filter(Boolean).join('; '))),
    sh('Goal IDs', 'Their IDs.', (r) => r.a.goalIds.join('; ')),
    sh('Asked by', 'Who asked.', (r) => or(r.c.name(r.a.askedBy))),
    sh('Asked of', 'Who must respond.', (r) => (r.a.recipientId ? or(r.c.name(r.a.recipientId)) : 'Anyone')),
    w('Status', `Where it stands: ${oneOf(Object.values(ASK_STATUS_LABEL))}.`, (r) => ASK_STATUS_LABEL[r.a.status]),
    sh('Due week', 'The week it’s due by, if any.', (r) => r.a.dueWeek),
    sh('Review', 'The review it was raised in.', (r) => r.c.x.snapshot.reviews.find((v) => v.id === r.a.reviewId)?.name ?? null),
    sh('Asked at', 'When.', (r) => r.a.createdAt),
    sh('Answer', 'The answer, or the note it was marked done with.', (r) => or(r.a.answer)),
    sh('Answered by', 'Who answered.', (r) => (r.a.answeredBy ? or(r.c.name(r.a.answeredBy)) : null)),
    sh('Answered at', 'When.', (r) => r.a.answeredAt),
  ],
};

export const NOTES: SheetSpec<NoteRow> = {
  kind: 'notes', name: 'Notes', rowIs: 'note, question or action said in a review', loaded: false,
  about: 'What was said in reviews: notes, questions and actions, with their answers.',
  columns: [
    m('Goal key', 'The goal’s key.', (r) => or(r.c.goal(r.d.goalId)?.key)),
    m('Goal ID', 'The goal’s ID.', (r) => r.d.goalId),
    sh('Goal', 'The goal’s name.', (r) => r.c.goal(r.d.goalId)?.title ?? ''),
    sh('Week', 'The week it was said.', (r) => r.d.week),
    sh('Kind', `Note, ${ASK_KIND.question.label.toLowerCase()} or ${ASK_KIND.action.label.toLowerCase()}.`, (r) => (r.d.kind === 'ask' ? ASK_KIND.question.label : r.d.kind === 'action' ? ASK_KIND.action.label : 'Note')),
    sh('Said by', 'Who said it.', (r) => r.c.name(r.d.byId)),
    sh('Text', 'What was said.', (r) => r.d.note),
    sh('Who', 'Who does an action.', (r) => (r.d.kind === 'action' ? or(r.c.name(r.d.assigneeId ?? '')) : null)),
    sh('Due week', 'When an action is due.', (r) => r.d.dueWeek ?? null),
    sh('Review', 'The review it was said in.', (r) => r.c.x.snapshot.reviews.find((v) => v.id === r.d.reviewId)?.name ?? null),
    sh('Answer', 'A question’s or action’s answer.', (r) => (r.d.ask ? answerOf(r.d)?.text ?? null : null)),
    sh('At', 'When.', (r) => r.d.at),
  ],
};

/** The core's sheets, in the workbook's order (a module's sheets follow them; domain/records ModuleSheet). */
export const SHEETS = [GOALS, PLAN, CHECK_INS, PEOPLE, RESULTS, ASKS, NOTES] as const;
/** What is Reviews' in the workbook (RS, spec 5): the Notes sheet, and the Review column on Asks. */
export const REVIEWS_SHEET = NOTES.name;
export const REVIEWS_COLUMN = 'Review';
/** The core's sheets as a workbook has them with Reviews on or off: off, no Notes sheet and no Review column on Asks. */
export const sheetsFor = (reviews: boolean) => (reviews ? [...SHEETS] : SHEETS.filter((v) => v !== NOTES).map((v) => (v === ASKS ? { ...ASKS, columns: ASKS.columns.filter((c) => c.header !== REVIEWS_COLUMN) } : v)));
/** The workbook's first sheet: what the file is, and the field table (it replaced the README, which is still skipped). */
export const START_HERE = 'Start here';
/** Every sheet of the core's workbook, in order. */
export const SHEET_NAMES = [START_HERE, ...SHEETS.map((x) => x.name)] as const;
/** Every sheet's name with the modules' sheets (domain/records) after the core's: Start here first. With Reviews off
    (`reviews` false) there is no Notes sheet (RS1). */
export const sheetNamesWith = (sheets: readonly ModuleSheet[] = [], reviews = true): string[] => [START_HERE, ...sheetsFor(reviews).map((x) => x.name), ...sheets.map((x) => x.spec.name)];
export const specOf = (kind: SheetKind) => SHEETS.find((x) => x.kind === kind)! as SheetSpec<unknown>;
export const headersOf = (kind: SheetKind) => specOf(kind).columns.map((c) => c.header);
export const columnOf = (kind: SheetKind, header: string) => specOf(kind).columns.find((c) => c.header.toLowerCase() === header.toLowerCase());
/** Whether a column of a sheet is one people change (the Data tables let them type into it). */
export const isEditable = (kind: SheetKind, header: string) => (kind === 'plan' && isWeekHeader(header)) || ['edit', 'action'].includes(columnOf(kind, header)?.role ?? '');
/** Whether a column is worked out by the app or only for reading: set apart (greyed) in a workbook. */
export const isWorkedOut = (kind: SheetKind, header: string) => ['worked', 'shown'].includes(columnOf(kind, header)?.role ?? '');

/**
 * The columns that say which record a row is: always written in any export of a table, so it can be loaded back (the
 * Data tables put them at the end, greyed, when the layout leaves them out).
 */
export const KEY_COLUMNS: Record<SheetKind, string[]> = {
  goals: ['Key', 'ID'], plan: ['Key', 'ID'], checkIns: ['ID', 'Goal key', 'Goal ID', 'Week'], people: ['Email', 'ID'],
  results: ['Key', 'ID'], asks: ['ID'], notes: ['Goal key', 'Goal ID'],
};

/**
 * Which sheet a header row is, from its headers alone (a sheet's name is never trusted: a file saved from Data, a CSV
 * named anything). Null for a sheet this format doesn't know, such as the README.
 */
export function sheetKindOf(header: readonly string[]): SheetKind | null {
  const h = new Set(header.map((x) => x.trim().toLowerCase()).filter(Boolean));
  const any = (...l: string[]) => l.some((x) => h.has(x));
  if ([...h].some(isWeekHeader)) return 'plan';
  if (h.has('week') && any('value', 'stages', 'call', 'cause', 'why')) return 'checkIns';
  if (h.has('result') && any('q1', 'q2', 'q3', 'q4') && !h.has('type')) return 'results';
  if (h.has('ask') && any('asked by', 'asked of')) return 'asks';
  if (h.has('said by') || (h.has('text') && h.has('kind') && any('goal', 'goal id'))) return 'notes';
  if (any('goal', 'key') && !h.has('name')) return any('goal', 'type', 'owner', 'owner email', 'target', 'level', 'action', 'status') ? 'goals' : null;
  // A People sheet (C17): Email, or Name with another People column (a Name and a Salary band are no Faro sheet).
  if (any('name', 'email') && !h.has('goal')) return h.has('email') || any('team', 'job title', 'admin', 'id') ? 'people' : null;
  return null;
}

/* ---------- writing the rows ---------- */

/** The lookups every writer uses, from what's exported. */
export function contextOf(x: ExportInput, s: Snapshot): Ctx {
  const people = new Map([...(x.snapshot.archive?.people ?? []).map((p) => [p.id, p] as const), ...x.snapshot.people.map((p) => [p.id, p] as const)]);
  const left = new Set((x.snapshot.archive?.people ?? []).map((p) => p.id));
  const goals = new Map([...s.goals, ...(x.snapshot.archive?.goals ?? [])].map((g) => [g.id, g]));
  return {
    x,
    name: (id) => { const p = id ? people.get(id) : undefined; return !p ? '' : left.has(p.id) && !x.snapshot.people.some((v) => v.id === p.id) ? leftName(p.name) : p.name; },
    email: (id) => (id ? people.get(id)?.email || null : null),
    team: (id) => (id ? x.snapshot.teams.find((t) => t.id === id)?.name ?? null : null),
    goal: (id) => (id ? goals.get(id) : undefined),
  };
}

/** A sheet's rows, header first, from its columns. */
export const rowsOf = <C,>(spec: SheetSpec<C>, items: C[]): Cell[][] => [spec.columns.map((c) => c.header), ...items.map((it) => spec.columns.map((c) => c.write(it)))];

/** Every ask on these goals, and every note, question and action said about them in a review. */
export const asksFor = (s: Snapshot, ids: Set<string>) => asksOf(s).filter((r) => r.goalIds.some((id) => ids.has(id)));
export const notesFor = (s: Snapshot, ids: Set<string>) => saidIn(s).filter((d) => ids.has(d.goalId) && ['note', 'ask', 'action'].includes(d.kind));

/* ---------- the field table (backlog IM1; docs/design/import/spec.md, section 3 and rules 1 and 2) ----------
   For every column a person fills in: whether a new row must have it, its format, an example, and what an empty cell
   does. The template's Start here sheet, every workbook's Start here sheet, docs/export-format.md, Help's "Every column,
   and what it needs" and the Import page's three lines are all made from it. A column added to a sheet above gets its
   row here (a test fails while it has none): that is the whole of adding one.

   It says what Faro does. IM2 changed the defaults the import design marked (C1, C2, round 2's margin): a new goal's
   Type is read from the columns it fills in, a number has no unit unless one is given (asked once a file), and a range
   has no warning margin unless one is given. */

/** A goal's type, said as people say it. */
export const TYPE_NAME: Record<Goal['kind'], string> = { metric: 'number', range: 'range', milestone: 'stages' };

/**
 * Whether a new row must have a column: always; for some types of goal; in some situations (`when`); optional, with what
 * an empty cell gives; left empty (Faro fills it); for reading; or worked out (null).
 */
export type Required =
  | 'required'
  | { for: Goal['kind'][] }
  | { when: string }
  | { optional: string }
  | 'leave-empty'
  | 'reading'
  | null;

export interface Field {
  required: Required;
  /** What the cell holds, in words. */
  format: string;
  example: string;
  /** What an empty cell does on a new row. */
  empty: string;
  /** On a row already here, an empty cell removes the value (most keep it). */
  clears?: boolean;
  /** Columns of which one is enough: Owner or Owner email. */
  oneOf?: string;
  /** Other header names read as this column (backlog IM5 reads them). */
  also?: string[];
}

export interface FieldRow extends Field {
  header: string;
  role: Role;
  means: string;
}

export type FillKind = 'goals' | 'plan' | 'checkIns' | 'people';
/** The sheets that load back, whose columns people fill in. */
export const FILL_SHEETS: FillKind[] = ['goals', 'plan', 'checkIns', 'people'];

const wordList = <C extends string>(w: Words<C>) => oneOf(Object.values(w.word) as string[]);
const causeWords = [...new Set(Object.values(CAUSE_WORDS.word) as string[])];

const FIELDS: Record<FillKind, Record<string, Field>> = {
  goals: {
    Key: { required: 'leave-empty', format: 'G- and a number', example: 'G-12', empty: 'Faro gives a new goal the next key' },
    ID: { required: 'leave-empty', format: 'Faro’s own', example: 'goal_hzde4g', empty: 'Faro gives a new goal its own' },
    Ref: { required: { optional: 'none' }, format: 'Text, each row its own', example: 'top', empty: 'Other rows name it by Goal or Key instead' },
    Goal: { required: 'required', format: 'Text, 3 characters or more', example: 'Deploy lead time', empty: 'Must fix: a new goal needs a name', also: ['goal name', 'title', 'objective'] },
    Action: { required: { optional: 'none' }, format: wordList(GOAL_ACTION_WORDS), example: GOAL_ACTION_WORDS.word.stop, empty: 'The row adds or changes the goal' },
    Level: { required: { optional: EVERYDAY_WORD }, format: wordList(LEVEL_WORDS), example: EVERYDAY_WORD, empty: EVERYDAY_WORD, also: ['goal level'] },
    Team: { required: { optional: 'the owner’s team' }, format: 'A team’s name', example: 'Platform', empty: 'The owner’s team', also: ['team name'] },
    Owner: { required: 'required', oneOf: 'owner', format: 'A name only one person has', example: 'Ben Ortiz', empty: 'Owner email says who; with neither, Must fix', also: ['owner name'] },
    'Owner email': { required: 'required', oneOf: 'owner', format: 'An email', example: 'ben.ortiz@example.com', empty: 'Owner says who; with neither, Must fix', also: ['owner e-mail', 'owner email address'] },
    Type: { required: { optional: 'read from the row' }, format: wordList(TYPE_WORDS), example: TYPE_WORDS.word.metric, empty: 'Read from the columns filled in: Start and Target a number goal, Limit a range goal, Stages a stages goal (none, or two of them, is Must fix). A goal’s type can’t change later', also: ['goal type'] },
    State: { required: { optional: 'active' }, format: 'active or proposed', example: 'proposed', empty: 'As it is' },
    Unit: { required: { optional: 'no unit' }, format: 'Text', example: 'days', empty: 'No unit, never “%” by default: a Check asks once a file whether the numbers are plain counts', clears: true, also: ['units'] },
    Decimals: { required: { optional: 'from the numbers typed' }, format: '0, 1, 2 or 3', example: '1', empty: 'The most decimal places typed in Start, Target or Limit, up to 3' },
    Start: { required: { for: ['metric'] }, format: 'A number', example: '5', empty: 'Must fix for a number goal', also: ['baseline'] },
    'Baseline period': { required: { optional: 'no baseline of its own' }, format: 'Text, at most 60 characters; none to remove it', example: 'June to September 2026', empty: 'As it is', also: ['baseline covers', 'baseline window'] },
    'Baseline is': { required: { optional: FIRMNESS_WORDS.word.firm }, format: wordList(FIRMNESS_WORDS), example: FIRMNESS_WORDS.word.provisional, empty: 'As it is', also: ['provisional'] },
    Target: { required: { for: ['metric'] }, format: 'A number, different from Start', example: '1', empty: 'Must fix for a number goal', also: ['target value', 'goal value'] },
    Plan: { required: { optional: SHAPE_WORDS.word.straight }, format: wordList(SHAPE_WORDS), example: SHAPE_WORDS.word.back, empty: SHAPE_WORDS.word.straight },
    From: { required: { optional: 'this week' }, format: 'A year and a week', example: '2026-W46', empty: 'This week', also: ['from week'] },
    'Plan from week': { required: { optional: 'this week' }, format: 'A whole number of weeks from the cycle’s start', example: '46', empty: 'This week (0 when setting up a workspace)' },
    To: { required: { optional: 'the cycle’s last week' }, format: 'A year and a week, after From', example: '2026-W53', empty: 'The cycle’s last week', also: ['to week'] },
    'Due week': { required: { optional: 'the cycle’s last week' }, format: 'A whole number, after Plan from week; a date in the cycle is read as its week', example: '53', empty: 'The cycle’s last week', clears: true, also: ['due', 'deadline week'] },
    Limit: { required: { for: ['range'] }, format: 'A number, or two (99.5–99.95, 99.5 to 99.95)', example: '5', empty: 'Must fix for a range goal' },
    'Must stay': { required: { optional: BOUND_WORDS.word.atMost }, format: wordList(BOUND_WORDS), example: BOUND_WORDS.word.atMost, empty: BOUND_WORDS.word.atMost },
    Margin: { required: { optional: 'none' }, format: 'A number, zero or more', example: '0.5', empty: 'No warning margin (0)' },
    Stages: { required: { for: ['milestone'] }, format: 'Name@week; Name@week (weeks from the cycle’s start; a date in the cycle is read as its week; each stage its own name)', example: 'Design@48; Pilot@52', empty: 'Must fix for a stages goal' },
    'Feeds into': { required: { optional: 'nothing' }, format: 'A goal’s name', example: 'Deploy lead time', empty: 'It feeds nothing', clears: true },
    'Feeds into key': { required: { optional: 'nothing' }, format: 'A goal’s key', example: 'G-1', empty: 'It feeds nothing', clears: true },
    'Feeds into ref': { required: { optional: 'nothing' }, format: 'The Ref of another row in this file', example: 'top', empty: 'Feeds into or Feeds into key says what it feeds' },
    'Why it helps': { required: { optional: 'empty' }, format: 'Text', example: 'Fewer failed deploys mean fewer rollbacks', empty: 'Nothing said', clears: true },
    Effect: { required: { optional: 'empty' }, format: 'A number, in the fed goal’s unit', example: '1', empty: 'Nothing said', clears: true },
    Source: { required: { optional: 'empty' }, format: 'Text', example: 'CI dashboard', empty: 'Nothing said', clears: true },
    Definition: { required: { optional: 'empty' }, format: 'Text', example: 'Median hours from first commit to production', empty: 'Nothing said', clears: true },
    Reason: { required: { when: `with ${GOAL_ACTION_WORDS.word.stop}, and when a plan changes after check-ins began` }, format: 'Text', example: 'Agreed at the Q4 review', empty: 'The preview asks for one reason for every plan change', also: ['reason for change'] },
  },
  plan: {
    Key: { required: 'required', oneOf: 'goal', format: 'G- and a number', example: 'G-12', empty: 'ID says which goal; with neither, Must fix' },
    ID: { required: 'required', oneOf: 'goal', format: 'Faro’s own', example: 'goal_hzde4g', empty: 'Key says which goal; with neither, Must fix' },
    Goal: { required: 'reading', format: 'Text', example: 'Deploy lead time', empty: 'Never read: change the name on Goals' },
    Unit: { required: 'reading', format: 'Text', example: 'days', empty: 'Never read: change the unit on Goals' },
    Start: { required: { optional: 'the plan’s start' }, format: 'A number', example: '5', empty: 'The plan keeps its start' },
    [WEEK_COLUMN.header]: { required: { optional: 'the plan’s own number' }, format: 'A number, only for weeks inside the plan', example: '4.2', empty: 'The plan keeps its own number that week' },
  },
  checkIns: {
    ID: { required: 'leave-empty', format: 'Faro’s own', example: 'ci_4kd9', empty: 'A new check-in, or a correction of that goal’s check-in for the week' },
    'Goal key': { required: 'required', oneOf: 'goal', format: 'G- and a number', example: 'G-14', empty: 'Goal ID or Goal says which goal; with none of them, Must fix' },
    'Goal ID': { required: 'required', oneOf: 'goal', format: 'Faro’s own', example: 'goal_hzde4g', empty: 'Goal key or Goal says which goal' },
    Goal: { required: 'required', oneOf: 'goal', format: 'The goal’s exact name, when only one goal has it', example: 'Pipeline queue wait (p90)', empty: 'Goal key or Goal ID says which goal' },
    'Goal ref': { required: { optional: 'none' }, format: 'The Ref of a row on Goals in this file', example: 'top', empty: 'Goal key, Goal ID or Goal says which goal' },
    Week: { required: 'required', format: 'A whole number from 1 to this week; a date in the cycle is read as its week', example: '46', empty: 'Must fix' },
    Value: { required: { for: ['metric', 'range'] }, format: 'A number, at the goal’s decimal places', example: '6', empty: 'Must fix for a number or range goal' },
    'Reason for a different number': { required: 'reading', format: 'Text', example: 'The source counts something else: “It leaves out release branches.”', empty: 'Never read: a reason is given in the check-in' },
    Stages: { required: { for: ['milestone'] }, format: '“Pilot: done week 6; Rollout: expected week 9”', example: 'Pilot: done week 6', empty: 'Must fix for a stages goal' },
    Call: { required: { optional: 'the rules decide' }, format: wordList(CALL_WORDS), example: CALL_WORDS.word.risk, empty: 'The rules decide' },
    Cause: { required: { when: 'when it’s behind, or well ahead' }, format: oneOf(causeWords), example: causeWords[0] ?? '', empty: 'Must fix when it’s behind or well ahead', clears: true },
    Why: { required: { when: 'when it’s behind, or well ahead' }, format: `Text, ${MIN_REASON} characters or more`, example: 'Runner pool was halved for the migration', empty: 'Must fix when it’s behind or well ahead', clears: true },
    'Why greener': { required: { when: 'when Call is better than the rules say' }, format: `Text, ${MIN_REASON} characters or more`, example: 'The fix shipped after the number was taken', empty: 'Must fix when the call is greener than calculated', clears: true },
    'Path to green': { required: { when: 'when it’s behind' }, format: `Text, ${MIN_PATH} characters or more`, example: 'Add 20 runners by week 48', empty: 'Must fix when it’s behind', clears: true },
    Recovery: { required: { optional: RECOVERY_WORDS.word.plan }, format: wordList(RECOVERY_WORDS), example: RECOVERY_WORDS.word.plan, empty: RECOVERY_WORDS.word.plan },
    'Back on plan by week': { required: { when: `when Recovery is ${RECOVERY_WORDS.word.plan} and it’s behind` }, format: 'A week after this one', example: '48', empty: 'Must fix when it’s behind with a plan', clears: true },
    Needs: { required: { optional: 'empty' }, format: 'Text', example: 'A decision on runner budget from Amara', empty: 'Nothing needed', clears: true },
    'Next step': { required: { optional: 'empty' }, format: 'Text', example: 'Order runners', empty: 'Nothing said', clears: true },
  },
  people: {
    Email: { required: 'required', format: 'An email', example: 'ana.silva@example.com', empty: 'Must fix for someone new. An email can be changed, not taken away' },
    ID: { required: 'leave-empty', format: 'Faro’s own', example: 'p_ana', empty: 'Faro gives someone new their own' },
    Name: { required: 'required', format: 'Text', example: 'Ana Silva', empty: 'Must fix for someone new' },
    Action: { required: { optional: 'none' }, format: wordList(PERSON_ACTION_WORDS), example: PERSON_ACTION_WORDS.word.left, empty: 'The row adds or changes the person' },
    'Job title': { required: { optional: 'empty' }, format: 'Text', example: 'Platform lead', empty: 'No job title', clears: true },
    Team: { required: { optional: 'no team' }, format: 'A team’s name', example: 'Platform', empty: 'No team', clears: true },
    Admin: { required: { optional: 'no' }, format: wordList(YES_WORDS), example: YES_WORDS.word.yes, empty: 'Not an admin (when setting up, the first person is one)' },
    'Team objective': { required: { optional: 'empty' }, format: 'Text, on the team lead’s row', example: 'Make every deploy safe and fast', empty: 'No objective', clears: true },
    'Takes over': { required: { when: `with ${PERSON_ACTION_WORDS.word.left}, when they own goals, asks or teams` }, format: 'An email, or a name only one person has', example: 'chloe.wu@example.com', empty: `Must fix with ${PERSON_ACTION_WORDS.word.left} when they own anything` },
  },
};

/** Whether a new row must have a column (null when the column has no field facts: worked out). Goal entry's rule 1
    (domain/goalEntry fieldNeed) reads the form's needs from here, so the form and a file can't disagree. */
export const fieldNeedOf = (kind: FillKind, header: string): Required => FIELDS[kind][header]?.required ?? null;

/** The headers a sheet's field table has facts for, as written in it (a test checks each is a real column). */
export const fieldHeaders = (kind: FillKind): string[] => Object.keys(FIELDS[kind]);

/** A sheet's columns as the field table: every column, with its field facts (a worked-out one has none). */
export function fieldTable(kind: FillKind): FieldRow[] {
  const cols = [...specOf(kind).columns.map((c) => ({ header: c.header, role: c.role, means: c.means })), ...(kind === 'plan' ? [{ header: WEEK_COLUMN.header, role: WEEK_COLUMN.role, means: WEEK_COLUMN.means }] : [])];
  return cols.map((c) => {
    const f = FIELDS[kind][c.header];
    return f ? { ...c, ...f } : { ...c, required: null, format: '', example: '', empty: 'Worked out by Faro: never read' };
  });
}

/** "Required", "Required for a number goal", "Optional", "Leave empty", "For reading", "Worked out". */
export function requiredWord(r: Required): string {
  if (r === 'required') return 'Required';
  if (r === 'leave-empty') return 'Leave empty';
  if (r === 'reading') return 'For reading';
  if (r == null) return 'Worked out';
  if ('for' in r) return `Required for a ${oneOf(r.for.map((k) => TYPE_NAME[k]))} goal`;
  if ('when' in r) return `Required ${r.when}`;
  return 'Optional';
}

/** A column's word in the table, naming the columns that can stand in for it: "Required (or Owner email)". */
export function requiredText(row: FieldRow, table: FieldRow[]): string {
  const others = row.oneOf ? table.filter((c) => c.oneOf === row.oneOf && c.header !== row.header).map((c) => c.header) : [];
  return requiredWord(row.required) + (others.length ? ` (or ${others.join(', or ')})` : '');
}

/** What an empty cell does, on a new row and on a row already here: the "If it’s left empty" column. */
export const emptyText = (row: FieldRow) => `${row.empty}${row.clears ? '. On a row already here, empty clears it' : ''}`;

/** Whether a header is one a new row must have (bold in the template), alone or as one of a pair. */
export const isRequiredHeader = (kind: FillKind, header: string) => FIELDS[kind][header]?.required === 'required';

/** A fill-in column: one a person types into (not worked out, not for reading). */
export const isFillIn = (row: FieldRow) => row.required != null && row.required !== 'reading';

/** What a new row must have, in one line per sheet (import spec rule 2): the Import page, Help and Start here say it. */
export function requiredLine(kind: 'goals' | 'checkIns' | 'people'): string {
  const t = fieldTable(kind);
  const req = (h: string) => { if (!t.some((c) => c.header === h && c.required)) throw new Error(`${h} isn’t in the ${kind} field table`); return h; };
  const forType = (k: Goal['kind']) => t.filter((c) => c.required && typeof c.required === 'object' && 'for' in c.required && c.required.for.length === 1 && c.required.for[0] === k).map((c) => c.header);
  if (kind === 'goals') return `${req('Goal')}, and ${req('Owner')} or ${req('Owner email')}. A ${TYPE_NAME.metric} goal also needs ${andList(forType('metric'))}; a ${TYPE_NAME.range} goal, ${andList(forType('range'))}; a ${TYPE_NAME.milestone} goal, ${andList(forType('milestone'))}.`;
  if (kind === 'checkIns') return `${req('Goal key')} (or ${req('Goal')}), ${req('Week')}, and ${req('Value')} or ${req('Stages')}.`;
  return `${req('Name')} and ${req('Email')}.`;
}

/** The template's example rows (C15): their Action says Example, so loading the template back never imports them. */
export const EXAMPLE_ROWS: Partial<Record<FillKind, Record<string, string>[]>> = {
  goals: [
    { Goal: 'Deploy lead time', Action: GOAL_ACTION_WORDS.word.example, Level: EVERYDAY_WORD, Team: 'Platform', Owner: 'Ben Ortiz', 'Owner email': 'ben.ortiz@example.com', Type: TYPE_WORDS.word.metric, Unit: 'days', Decimals: '0', Start: '5', Target: '1', Plan: SHAPE_WORDS.word.straight, Definition: 'Median days from first commit to production' },
    { Goal: 'Canary releases live', Action: GOAL_ACTION_WORDS.word.example, Level: EVERYDAY_WORD, Team: 'Platform', Owner: 'Ben Ortiz', 'Owner email': 'ben.ortiz@example.com', Type: TYPE_WORDS.word.milestone, Stages: 'Design@48; Pilot@52', 'Feeds into': 'Deploy lead time' },
  ],
  people: [
    { Email: 'ana.silva@example.com', Name: 'Ana Silva', Action: PERSON_ACTION_WORDS.word.example, 'Job title': 'Platform lead', Team: 'Platform', Admin: YES_WORDS.word.no },
  ],
};
