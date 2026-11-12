/* Bulk changes: the one way in for a spreadsheet, set-up from a spreadsheet, the bulk check-in grid, table actions, the
   data tables and the AI assistant's bulk_change. parse → validate → preview → apply → log. Every row is checked with the
   same rules as the app's own forms (validateGoal, buildGoal, evaluate, toCheckIn, personProblems, and domain/removal for
   a row's Action), and nothing is saved until the whole set is valid.

   The columns are the one format's (domain/columns.ts). Rows find their record by a goal's key, then its ID; a person
   by their email, then (when only one person has it) their name; a team by its name. Columns a row leaves out keep what
   the record says, and worked-out columns are never read. Every column that can be changed counts: a change to any of
   them is applied, or said to be a problem, never quietly dropped. Set-up uses the same engine in "create" mode: an
   empty workspace, and every row is new.

   Every problem is data (backlog IM2, domain/problemLevels): a kind, and the level its kind fixes. Must fix blocks saving; a
   Check is a question that blocks saving until it is answered (`answers`, by group id), and one answer covers every row
   with the same question; a note says how a row was read. A name or word one letter out is asked about ("Did you mean
   Platform?"), never guessed and never silently refused. */
import type { Commit } from './commit';
import type { ActionContext } from './actions';
import { NotAllowed } from './actions';
import { goalChange, checkInChange, type Lookup } from './changes';
import { answeredDiffs, checkInLevels, evaluate, MIN_CORRECT_REASON, MIN_REASON, MISSING_TEXT, parseNumber, toCheckIn, unanswered, VALUE_CODES, valueProblem, type Draft, type Missing } from './checkin';
import {
  BOUND_WORDS, CALL_WORDS, CAUSE_WORDS, codeOf, GOAL_ACTION_WORDS, LEVEL_WORDS, oneOf, PERSON_ACTION_WORDS, RECOVERY_WORDS, SHAPE_WORDS, TYPE_WORDS, unknownWord, wordsAndAlso, YES_WORDS,
  type Words,
} from './columns';
import { blankGoal, buildGoal, draftOf, goalAsOf, planChanged, planQuestion, replanned, stagesDoneAtSetUp, type GoalDraft } from './goal';
import { goalChecks, type GoalCheckId, type GoalField, goalMustFix, type MustFixId } from './goalEntry';
import { mayAddGoal, mayChangeGoal, mayPostCheckIn } from './goalRights';
import { notNumberText, precisionProblem, sameAsWritten, typedDecimals } from './numbers';
import { findGoal, formatKey, isKey, lastKey, normalKey } from './goalKey';
import { fmt } from './format';
import { isEmail, normalEmail, personChange, personProblems, sameNameNote, sameTitleNote } from './people';
import { planAt, planEnd, weekDate } from './plan';
import { readWeekCode, weekUnknownText } from './weeks';
import { checkInsFor } from './status';
import { makesLoop } from './tree';
import { asksOf, requestsAfterCheckIn } from './asks';
import { deleteGoal, markPersonLeft, stopGoal } from './removal';
import { stagesFromNow } from './templates';
import { headerMatch, recordsOf, parseDelimited, type Rec, type Tables } from './sheets';
import { goalMeasureOf, type ModuleRecords } from './records';
import { ANSWERS, fold, groupId, groupIssues, issueOf, near, SHEET_ORDER, type Answer, type Answers, type Choice, type Issue, type IssueGroup, type IssueKind, type Sheet } from './problemLevels';
import type { Ask, Change, CheckIn, Cycle, Diff, Goal, MetricGoal, MetricPlan, Person, Review, Snapshot, StageUpdate, Status, Team } from './types';
import { FLAG, LEFT, lower, STOPPED } from './vocabulary';

export type { Rec, Tables } from './sheets';
export type { Answer, Answers, Choice, Issue, IssueGroup, IssueKind, IssueLevel, Sheet } from './problemLevels';
import { VIA_LABEL, type Via } from './via';
export { VIA_LABEL, VIA_MCP, VIA_MCP_BEFORE, type Via } from './via';

/**
 * How a check-in posted from a screen meets the week's (check-in spec, rule 13): `new` is refused when the week already
 * has one; `again` adds a second beside it; `correct` replaces the week's newest, with a reason, for any week.
 */
export type PostMode = 'new' | 'again' | 'correct';
/** One check-in as a screen posts it: the draft the form holds, not a spreadsheet row. */
export interface CheckInPost { goalId: string; week: number; draft: Draft; mode: PostMode; reason?: string }
/** Why a check-in is corrected or added later, in a sentence (rule 13). */
export { MIN_CORRECT_REASON };
/** The doors where a check-in's unlikely number is asked about here (C6). The bulk check-in grid asks it beside the cell. */
const ASKS_NUMBERS: Via[] = ['spreadsheet', 'mcp', 'table'];
/** Screens where someone types a check-in's number in their own locale: "3,9" there is 3.9, as on the check-in form,
    never a question. The decimal-comma Check is a file's (import spec, section 4). */
const TYPED_ON_SCREEN: Via[] = ['bulk', 'form'];

export type ItemKind = 'new goal' | 'goal' | 'plan' | 'check-in' | 'replaces check-in' | 'person' | 'new person' | 'team' | 'stop goal' | 'delete goal' | 'person left';
export interface Item {
  sheet: Sheet;
  row: number;
  goalId: string;
  /** What the change is to: a goal's name, or a person's or team's. */
  goal: string;
  kind: ItemKind;
  summary: string;
  diffs: Diff[];
  backfilled?: boolean;
  /** A plan change after check-ins started: it needs a reason. */
  needsReason?: boolean;
  /** A plan change that must be confirmed before it's saved (goal planQuestion): what it asks, and the yes. */
  question?: { text: string; confirm: string };
  /** Every question the row asks and nobody has answered yet (goal entry, rule 3): its id, the column, the words. */
  questions?: { id: string; field: string; text: string }[];
}
export interface ChangeSet {
  items: Item[];
  unchanged: number;
  /** The same, by sheet: the preview's counts table. */
  unchangedBy: Record<Sheet, number>;
  /** Rows whose Action says Example (the template's): left out, and said (C15). */
  examples: number;
  /** Every problem, a row each, with its kind and level (domain/problemLevels), in the file's order: sheet, then row. */
  issues: Issue[];
  /** The same, grouped (rule 6): Must fix, then Check, then what was read; largest first. One answer per group. */
  groups: IssueGroup[];
  /** Rows left out by an answer ("Leave these rows out", "Leave it out"): not saved, and said. */
  leftOut: { sheet: Sheet; row: number }[];
  /** Some plan changes need a reason and none was given. */
  needsReason: boolean;
  /** Some plan changes ask a question (a direction flip, a number far outside the old plan) that isn't answered yet. */
  needsConfirm: boolean;
  /** Ready to save: null while a Must fix or an unanswered Check remains, or a reason is missing. */
  commit: Commit | null;
  counts: { newGoals: number; goals: number; plans: number; checkIns: number; backfilled: number; replaced: number; people: number; newPeople: number; teams: number; stopped: number; deleted: number; left: number };
  /** Create mode: everything the new workspace starts with (set-up reads it). */
  created?: Pick<Snapshot, 'people' | 'teams' | 'goals' | 'checkIns' | 'requests' | 'keysIssued'>;
}

export interface ChangeInput {
  tables: Tables;
  snapshot: Snapshot;
  cycle: Cycle;
  week: number;
  /** Who is making the change. In create mode, the first person in the file (whoever is setting up) acts. */
  actor: Person;
  /** Now, as an ISO timestamp. */
  now: string;
  /** A new ID. The hint (a name or title) lets set-up make readable ones. */
  newId: (prefix: string, hint?: string) => string;
  via: Via;
  /** One reason for every plan change that needs one (a row's own Reason column wins). */
  reason?: string;
  /** Yes to every plan question (goal planQuestion) and every unlikely number (odd-number) the change asks, once the
      person has seen them: the one switch the app's older screens and the MCP tools' `confirm` give. */
  confirm?: boolean;
  /** Answers to the groups the preview asked about, by group id (rule 7): one answer covers every row in its group. */
  answers?: Answers;
  /** "update" (the default): change the workspace. "create": set one up from nothing, every row new. */
  mode?: 'update' | 'create';
  /** The whole workspace, for what a row's Action reaches past this cycle (domain/removal). */
  full?: Snapshot;
  /** Check-ins posted from a screen, judged by the same loop as a sheet's rows (rule 13). */
  posts?: CheckInPost[];
  /** The feature modules' records in this build (core/records): what measures a goal, for goal entry's wrong-side question. */
  records?: readonly ModuleRecords[];
  /** The file the rows came from, and how many of its rows the person left out before the engine saw them: the import's
      summary keeps both (rule 9: its File and Rows diffs). */
  file?: { name: string; leftOut?: number };
}

/* ---------- reading files ---------- */

/** Delimited text (a CSV, a paste) as records keyed by lower-case header, with the sheet's row number. */
export const records = (text: string): Rec[] => recordsOf(parseDelimited(text));

/* ---------- helpers ---------- */

const has = (r: Rec, k: string) => Object.prototype.hasOwnProperty.call(r, k);
const val = (r: Rec, k: string) => (r[k] ?? '').trim();
/** A reference cell (a team, an owner, what it feeds): a dash on its own means none. */
const ref = (r: Rec, k: string) => { const v = val(r, k); return /^[—–-]$/.test(v) ? '' : v; };
const rowOf = (r: Rec, i: number) => Number(r.__row ?? i + 2);
const blankRow = (r: Rec) => Object.entries(r).every(([k, v]) => k === '__row' || !String(v).trim());
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
/** A number written with a comma as its decimal mark ("1,5"): read as 1.5, and asked once (decimal-comma). */
const commaDecimal = (raw: string) => /^[-+]?\d+,\d{1,2}(\s*(%|[a-z]+))?$/i.test(raw.trim());
/** A spreadsheet formula left in a number cell. */
const isFormula = (raw: string) => raw.trim().startsWith('=');
/** Which unlikely number a sentence asks about, so the same question on many rows is one group. */
const oddKind = (text: string) => (/below zero/i.test(text) ? 'below zero' : /100 ?times|th of/.test(text) ? 'far from the start' : /100%/.test(text) ? 'over 100%' : /billion/.test(text) ? 'a billion' : /far outside/.test(text) ? 'far outside the plan' : /past the target/.test(text) ? 'past the target' : /Last week was/.test(text) ? 'far from the last number' : /margin/.test(text) ? 'margin' : text);

/** "4 new goals, 2 goals changed, 38 check-ins (36 for past weeks), 1 goal stopped" */
export function describe(cs: Pick<ChangeSet, 'counts'>): string {
  const c = cs.counts;
  const parts = [
    c.newPeople && plural(c.newPeople, 'new person', 'new people'),
    c.people && `${plural(c.people, 'person', 'people')} changed`,
    c.teams && `${plural(c.teams, 'team')} changed`,
    c.newGoals && plural(c.newGoals, 'new goal'),
    c.goals && `${plural(c.goals, 'goal')} changed`,
    c.plans && `${plural(c.plans, 'plan')} changed`,
    c.checkIns && `${plural(c.checkIns, 'check-in')}${c.backfilled ? ` (${c.backfilled} for past weeks)` : ''}`,
    c.replaced && `${c.replaced} replaced`,
    c.stopped && `${plural(c.stopped, 'goal')} ${lower({ label: STOPPED })}`,
    c.deleted && `${plural(c.deleted, 'goal')} deleted`,
    c.left && `${plural(c.left, 'person', 'people')} ${lower({ label: LEFT })}`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No changes';
}

/** Rows whose Action says Example (the template's, C15), in a sentence: left out, never imported. Empty for none. */
export const examplesLine = (n: number): string => (n ? `${plural(n, 'example row')} left out.` : '');

/** The columns a goal form's field is, for its problem on the Goals sheet. */
/** A goal field's column on the Goals sheet, where a Must fix from goal entry's rule 2 (domain/goalEntry) is said. */
const FIELD_COLUMN: Partial<Record<GoalField, string>> = { title: 'Goal', teamId: 'Team', ownerId: 'Owner', level: 'Level', parentId: 'Feeds into', start: 'Start', target: 'Target', limit: 'Limit', margin: 'Margin', decimals: 'Decimals', effect: 'Effect', stages: 'Stages', points: 'Plan', unit: 'Unit', fromWeek: 'Plan from week', endWeek: 'Due week' };
/** Each Must fix's kind among the engine's (domain/problemLevels): every one is a Must fix; the kind says which sort. */
const MUST_KIND: Record<MustFixId, IssueKind> = {
  'name-empty': 'required-empty', 'name-short': 'required-empty', 'owner-empty': 'required-empty', 'team-empty': 'required-empty', 'level-empty': 'required-empty',
  'start-empty': 'required-empty', 'target-empty': 'required-empty', 'limit-empty': 'required-empty', 'stage-none': 'required-empty',
  'feeds-loop': 'loop', 'not-number': 'not-a-number', 'has-words': 'not-a-number', 'too-precise': 'precision', 'plan-point': 'not-a-number', 'decimals-lose': 'precision',
  'decimals-range': 'unknown-word', 'same-as-start': 'impossible-number', 'margin-negative': 'impossible-number',
  'stage-name': 'stage-format', 'stage-week': 'stage-format', 'stage-twice': 'stage-format', 'stage-done-removed': 'cant-change',
  'to-before-from': 'plan-order', 'week-unknown': 'week-wrong', 'week-beyond': 'week-wrong',
};

/** Goal entry's questions (rule 3) as the engine's kinds: the unlikely numbers are one kind, grouped by question. */
const ENGINE_CHECK: Partial<Record<GoalCheckId, IssueKind>> = {
  'below-zero': 'odd-number', 'over-100': 'odd-number', 'wrong-side': 'odd-number', hundredfold: 'odd-number', billion: 'odd-number', 'margin-wide': 'odd-number', 'late-plan': 'odd-number', 'long-plan': 'odd-number',
};
/** The kinds that are goal entry's questions: said on their item, and answered yes, all of them, by `confirm`. */
export const GOAL_QUESTION: readonly IssueKind[] = ['odd-number', 'feeds-lower', 'no-unit', 'plan-question'];
/** What `confirm` (the tools' and older screens' one switch) answers yes: every question of rule 3 the engine asks here. */
const CONFIRMED: IssueKind[] = ['odd-number', 'feeds-lower', 'no-unit'];

/* ---------- the change set ---------- */

/** The import summary's File and Rows diffs (rule 9): "654 changed, 397 unchanged, 5 left out". */
function fileDiffs(file: ChangeInput['file'], changed: number, unchanged: number, left: number): Diff[] {
  if (!file?.name) return [];
  const out = left + (file.leftOut ?? 0);
  return [{ field: 'File', from: '—', to: file.name }, { field: 'Rows', from: '—', to: `${changed} changed, ${unchanged} unchanged${out ? `, ${out} left out` : ''}` }];
}

const TABLE_SHEETS: [keyof Tables, 'goals' | 'plan' | 'checkIns' | 'people', Sheet][] = [['goals', 'goals', 'Goals'], ['plan', 'plan', 'Plan'], ['checkIns', 'checkIns', 'Check-ins'], ['people', 'people', 'People']];
/** The tables with each column under another name, or one letter out and answered, renamed to the column it is (rule 3). */
function namedHeaders(t: Tables, nearOk: (sheet: Sheet, header: string, as: string) => boolean): Tables {
  const out: Tables = { ...t };
  for (const [key, kind, sheet] of TABLE_SHEETS) {
    const recs = t[key];
    if (!recs?.length) continue;
    const keys = [...new Set(recs.flatMap((r) => Object.keys(r)))].filter((k) => k !== '__row');
    const rename = new Map<string, string>();
    for (const k of keys) {
      const m = headerMatch(kind, k);
      if (!m.as || m.how === 'unknown') continue;
      const to = m.as.toLowerCase();
      // A header the same as the column's but for punctuation, an accent or spacing ("Target.", "Owner_email") is read
      // as that column too: only a key that is already the column's own name is left as it is (#199 review, high).
      if (k === to) continue;
      if (keys.includes(to)) continue;
      if (m.how !== 'near' || nearOk(sheet, k, m.as)) rename.set(k, to);
    }
    if (rename.size) out[key] = recs.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [rename.get(k) ?? k, v])) as Rec);
  }
  return out;
}

export function planChanges(input: ChangeInput): ChangeSet {
  const { snapshot: s, cycle, week, now, newId, via } = input;
  const create = input.mode === 'create';
  const answers: Answers = input.answers ?? {};
  const issues: Issue[] = [];
  const items: Item[] = [];
  const leftOut: { sheet: Sheet; row: number }[] = [];
  let unchanged = 0;
  const unchangedBy: Record<Sheet, number> = { Goals: 0, Plan: 0, 'Check-ins': 0, People: 0 };
  /** A row that says what's already there. */
  const same = (sheet: Sheet) => { unchanged++; unchangedBy[sheet]++; };
  let examples = 0;
  const changes: Change[] = [];
  type Extra = { column?: string; found?: string; suggest?: string; answers?: Choice[]; value?: string };
  /** A problem, a question or a note on one row: its level comes from its kind (domain/problemLevels). */
  const raise = (kind: IssueKind, sheet: Sheet, row: number, name: string, message: string, x: Extra = {}) => { issues.push(issueOf(kind, sheet, row, name, message, x)); };
  const note = (kind: IssueKind, sheet: Sheet, row: number, name: string, message: string, x: Extra = {}) => raise(kind, sheet, row, name, message, x);
  /** The answer given to a group, if any (rule 7). */
  const answerOf = (kind: IssueKind, sheet: Sheet, column?: string, found?: string): Answer | undefined => answers[groupId(kind, sheet, column, found)];
  const leave = (sheet: Sheet, row: number) => { if (!leftOut.some((x) => x.sheet === sheet && x.row === row)) leftOut.push({ sheet, row }); };
  // Rule 3, at every door (a file, a paste, MCP): a column under another name the field table gives it ("Goal name") is
  // read as that column; one a letter out ("Targett") is asked about once (near-header), and read so once answered.
  input = { ...input, tables: namedHeaders(input.tables, (sheet, header, as) => {
    const a = answerOf('near-header', sheet, 'Header', header);
    if (a?.choice === 'use') return true;
    if (!a) raise('near-header', sheet, 1, header, `A column on ${sheet} is called “${header}”. Read it as ${as}?`, { column: 'Header', found: header, suggest: as, answers: [{ choice: 'use', label: `Read it as ${as}` }, { choice: 'ignore', label: 'Don’t read it' }] });
    return false;
  }) };
  /**
   * A Check on a row: answered "leave", the row is left out ('leave'); answered otherwise, its answer; unanswered, the
   * question is raised (null) and the row is read on as it says, so nothing else about it waits for the answer.
   */
  const ask = (kind: IssueKind, sheet: Sheet, row: number, name: string, message: string, x: Extra): Answer | 'leave' | null => {
    const given = answerOf(kind, sheet, x.column, x.found);
    // Only an answer the question offers counts ("banana" answers nothing), and one given for some numbers covers only
    // those numbers: a different number, in this file or the next, is asked again (IM2 review).
    const fits = given && (!x.answers?.length || x.answers.some((c) => c.choice === given.choice)) && (!given.covers || x.value == null || given.covers.includes(x.value));
    const a = (fits ? given : undefined) ?? (input.confirm && CONFIRMED.includes(kind) ? { choice: 'right' } : input.confirm && kind === 'other-goal' ? { choice: 'change' } : undefined);
    if (a?.choice === 'leave') { leave(sheet, row); return 'leave'; }
    if (a) return a;
    raise(kind, sheet, row, name, message, x);
    return null;
  };

  /* ---------- people and teams first, so a goal row can name someone this same file adds ---------- */
  const people = new Map<string, Person>(s.people.map((p) => [p.id, p]));
  const teams = new Map<string, Team>(s.teams.map((t) => [t.id, t]));
  const teamNamed = (name: string) => [...teams.values()].find((t) => fold(t.name) === fold(name));
  const byEmail = (e: string) => [...people.values()].find((p) => normalEmail(p.email) === e);
  const named = (n: string) => [...people.values()].filter((p) => fold(p.name) === fold(n));
  const peopleTouched = new Map<string, { before: Person | null; row: number }>();
  const teamsTouched = new Map<string, { before: Team | null; row: number }>();
  // In create mode the first person in the file is whoever is setting up: the workspace's first admin, and the actor.
  let actor = input.actor;
  const admin = () => create || actor.admin;

  /**
   * A word cell read with its column's words (rule 4): its code, null for empty; a word one letter out is asked about
   * (near-word), one it doesn't know is Must fix (unknown-word); either is settled by an answer. Undefined: raised.
   */
  function readWord<C extends string>(w: Words<C>, raw: string, sheet: Sheet, row: number, name: string, tail = ''): C | null | undefined {
    const c = codeOf(w, raw);
    if (c !== undefined) return c;
    const found = raw.trim();
    const words = Object.values(w.word) as string[];
    const m = near(found, wordsAndAlso(w));
    const pick = (a?: Answer) => (a?.choice === 'choose' && a.value ? codeOf(w, a.value) ?? undefined : undefined);
    if ('near' in m) {
      const code = codeOf(w, m.near)!;
      const a = answerOf('near-word', sheet, w.what, found);
      if (a?.choice === 'use') return code;
      if (pick(a)) return pick(a);
      if (a?.choice === 'leave') { leave(sheet, row); return undefined; }
      raise('near-word', sheet, row, name, `${w.what} says “${found}”. Read it as ${m.near}?`, { column: w.what, found, suggest: m.near, answers: ANSWERS.nearWord(m.near, words.filter((x) => codeOf(w, x) !== code)) });
      return undefined;
    }
    const a = answerOf('unknown-word', sheet, w.what, found);
    if (pick(a)) return pick(a);
    if (a?.choice === 'leave') { leave(sheet, row); return undefined; }
    raise('unknown-word', sheet, row, name, unknownWord(w, raw).replace(/\.$/, tail + '.'), { column: w.what, found, answers: ANSWERS.unknownWord(words) });
    return undefined;
  }

  type Found = { p?: Person; byName?: boolean; kind?: IssueKind; problem?: string; extra?: Extra; left?: boolean };
  /** Who a person-cell names: an email, an ID, or a name only one person has; a name or email one letter out is asked. */
  const personFrom = (sheet: Sheet, column: string, kind: 'email' | 'id' | 'name', v: string): Found => {
    const settle = (k: IssueKind, problem: string, extra: Extra, nearOne?: Person): Found => {
      const a = answerOf(k, sheet, extra.column, extra.found);
      if (a?.choice === 'leave') return { left: true };
      if (a?.choice === 'use' && nearOne) return { p: nearOne };
      if (a?.choice === 'choose' && a.value) { const again = personFrom(sheet, column, a.value.includes('@') ? 'email' : 'name', a.value); if (again.p) return again; }
      return { kind: k, problem, extra };
    };
    if (kind === 'email' || (kind === 'name' && v.includes('@'))) {
      const e = normalEmail(v);
      if (!isEmail(e)) return { kind: 'unknown-word', problem: `“${v}” isn’t an email.`, extra: { column, found: v } };
      const p = byEmail(e);
      if (p) return { p };
      // The part before @ one letter out, at the same domain, is asked about (C7).
      const [local, domain] = e.split('@');
      const sameDomain = [...people.values()].filter((x) => x.email && normalEmail(x.email).split('@')[1] === domain);
      const m = near(local!, sameDomain.map((x) => normalEmail(x.email).split('@')[0]!));
      if ('near' in m) {
        const hit = sameDomain.find((x) => normalEmail(x.email).split('@')[0] === m.near)!;
        return settle('near-ref', `No one here has ${e}. Did you mean ${hit.email}?`, { column, found: e, suggest: hit.email ?? '', answers: ANSWERS.nearRef(hit.email ?? '', e, false, false) }, hit);
      }
      return settle('unknown-ref', `No one here has the email ${e}. Add them on the People sheet, or check it.`, { column, found: e, answers: ANSWERS.unknownRef('person', e, false, false) });
    }
    if (kind === 'id') { const p = people.get(v); return p ? { p } : { kind: 'bad-key', problem: `There’s no person with ID ${v}.`, extra: { column: column + ' ID', found: v } }; }
    const list = named(v);
    if (list.length > 1) return settle('ambiguous-ref', `${list.length} people are called “${list[0]!.name}”. Use their email instead (${list.map((p) => p.email || p.id).join(' or ')}).`, { column, found: v, answers: [{ choice: 'choose', label: 'Choose which', needsValue: true, options: list.map((p) => p.email || p.id) }] });
    if (list.length) return { p: list[0]!, byName: true };
    const byId = people.get(v);
    if (byId) return { p: byId };
    const all = [...people.values()].filter((p) => !p.leftAt);
    const m = near(v, all.map((p) => p.name));
    if ('near' in m) {
      const hit = all.find((p) => p.name === m.near)!;
      return settle('near-ref', `“${v}” isn’t here. Did you mean ${hit.name}?`, { column, found: v, suggest: hit.name, answers: ANSWERS.nearRef(hit.name, v, false, false) }, hit);
    }
    return settle('unknown-ref', `“${v}” isn’t in this workspace. Add them on the People sheet, or check the spelling.`, { column, found: v, answers: ANSWERS.unknownRef('person', v, false, false) });
  };
  /**
   * The person a row's columns name (an email, an ID, a name), against who it is now. Only the columns that say someone
   * else count, so a name edited beside an email left as it was is the change; two that name different people are a
   * problem. Undefined: nothing says anything new.
   */
  const pickPerson = (sheet: Sheet, r: Rec, cols: { email?: string; id?: string; name?: string }, current: Person | null, what: string): { person?: Person; byName?: string; kind?: IssueKind; problem?: string; extra?: Extra; left?: boolean } => {
    const header = (k: 'email' | 'id' | 'name') => (k === 'email' ? (cols.name ? `${what} email` : what) : k === 'id' ? `${what} ID` : what);
    const given = (Object.entries(cols) as ['email' | 'id' | 'name', string][]).filter(([, c]) => has(r, c) && ref(r, c)).map(([k, c]) => [k, ref(r, c)] as const);
    const says = (k: 'email' | 'id' | 'name', v: string) => !!current && (k === 'email' ? normalEmail(current.email) === normalEmail(v) : k === 'id' ? current.id === v : fold(current.name) === fold(v) || current.id === v || (v.includes('@') && normalEmail(current.email) === normalEmail(v)));
    let changed = given.filter(([k, v]) => !says(k, v));
    if (!changed.length) return {};
    // An email or ID is exact: a name beside it that's theirs agrees with it, even when others share that name.
    const exact = changed.filter(([k]) => k !== 'name').map(([k, v]) => personFrom(sheet, header(k), k, v).p).find(Boolean);
    if (exact) changed = changed.filter(([k, v]) => k !== 'name' || fold(v) !== fold(exact.name));
    const found = changed.map(([k, v]) => ({ k, v, ...personFrom(sheet, header(k), k, v) }));
    if (found.some((x) => x.left)) return { left: true };
    const bad = found.find((x) => x.problem);
    if (bad) return { kind: bad.kind, problem: bad.problem, extra: bad.extra };
    const ids = new Set(found.map((x) => x.p!.id));
    if (ids.size > 1) { const order = ['name', 'email', 'id']; const said = [...found].sort((x, y) => order.indexOf(x.k) - order.indexOf(y.k)); return { kind: 'conflicting-refs', problem: `${[...new Set(said.map((x) => header(x.k)))].join(' and ')} name different people (${said.map((x) => x.p!.name).join(' and ')}). Change just one of them.`, extra: { column: what } }; }
    const byName = found.every((x) => x.byName) ? found[0]!.v : undefined;
    return { person: found[0]!.p!, byName };
  };
  const matchedByName = new Set<string>();
  const sayByName = (sheet: Sheet, row: number, goal: string, name: string, p: Person) => {
    if (matchedByName.has(p.id)) return;
    matchedByName.add(p.id);
    note('by-name', sheet, row, goal, `“${name}” matched by name: ${p.name}${p.email ? ` (${p.email})` : ''}. An email column is exact.`);
  };

  /** A new team, from a file (C8: an admin's answer "Add it as a new team"; at set-up, every team named). */
  const addTeam = (name: string, row: number): Team => {
    const tm: Team = { id: newId('team', name), name, leadId: '', objective: '' };
    teams.set(tm.id, tm);
    teamsTouched.set(tm.id, { before: null, row });
    return tm;
  };
  /**
   * The team a cell names (folded, so "CI CD" is CI/CD): one one letter out is asked about, one that isn't here is Must
   * fix; an admin may answer either with "Add it as a new team". Set-up adds every team its file names. Undefined: raised.
   */
  const teamFrom = (sheet: Sheet, row: number, name: string, v: string): Team | undefined => {
    const tm = teamNamed(v);
    if (tm) return tm;
    if (create) return addTeam(v, row);
    const m = near(v, [...teams.values()].map((t) => t.name));
    const nearOne = 'near' in m ? [...teams.values()].find((t) => t.name === m.near) : undefined;
    const kind: IssueKind = nearOne ? 'near-ref' : 'unknown-ref';
    const a = answerOf(kind, sheet, 'Team', v);
    if (a?.choice === 'leave') { leave(sheet, row); return undefined; }
    if (a?.choice === 'use' && nearOne) return nearOne;
    if (a?.choice === 'new' && admin()) return addTeam(v, row);
    if (a?.choice === 'choose' && a.value && teamNamed(a.value)) return teamNamed(a.value);
    if (nearOne) raise('near-ref', sheet, row, name, `There’s no team called “${v}”. Did you mean ${nearOne.name}?`, { column: 'Team', found: v, suggest: nearOne.name, answers: ANSWERS.nearRef(nearOne.name, v, true, admin()) });
    else raise('unknown-ref', sheet, row, name, `There’s no team called “${v}”.${admin() ? '' : ' Ask an admin to add it, or check the spelling.'}`, { column: 'Team', found: v, answers: ANSWERS.unknownRef('team', v, true, admin()) });
    return undefined;
  };

  // One person on two rows (C14): both rows are named and neither is applied, unless the answer says which to use.
  const personRows = (input.tables.people ?? []).map((r, i) => ({ r, row: rowOf(r, i) })).filter(({ r }) => !blankRow(r) && codeOf(PERSON_ACTION_WORDS, val(r, 'action')) !== 'example');
  const skipPeople = twice('People', personRows.map(({ r, row }) => {
    const id = create ? '' : val(r, 'id');
    const email = normalEmail(val(r, 'email'));
    const p = id ? people.get(id) : email ? byEmail(email) : undefined;
    return { row, name: val(r, 'name') || email, id: p ? 'p:' + p.id : email ? 'e:' + email : id ? 'i:' + id : val(r, 'name') ? 'n:' + fold(val(r, 'name')) : '' };
  }), (rows) => `${rows.name} is on rows ${rows.list}. Give each person one row.`, 'Email');
  // Three or more people made admins by one file is asked about once.
  const newAdminRows = create ? [] : personRows.filter(({ r }) => codeOf(YES_WORDS, val(r, 'admin')) === 'yes' && (() => { const id = val(r, 'id'); const p = id ? people.get(id) : val(r, 'email') ? byEmail(normalEmail(val(r, 'email'))) : undefined; return !p?.admin; })());
  const adminsAnswer = newAdminRows.length >= 3 ? answerOf('many-admins', 'People', 'Admin') : undefined;

  const leaving: { person: Person; row: number; to: Person }[] = [];
  personRows.forEach(({ r, row }) => {
    if (skipPeople.has(row)) return;
    const name = val(r, 'name');
    const email = normalEmail(val(r, 'email'));
    const action = readWord(PERSON_ACTION_WORDS, val(r, 'action'), 'People', row, name || email, ', or leave it empty');
    if (action === undefined) return;
    if (newAdminRows.some((x) => x.row === row) && newAdminRows.length >= 3) {
      if (adminsAnswer?.choice === 'leave') return leave('People', row);
      if (!adminsAnswer) raise('many-admins', 'People', row, name || email, `${plural(newAdminRows.length, 'person', 'people')} would become admins. Is that right?`, { column: 'Admin', answers: ANSWERS.sure });
    }
    // Which person: their ID; else their email; else a name only one person has. In create mode, everyone is new.
    const id = create ? '' : val(r, 'id');
    let before: Person | undefined;
    // How the row found them: by ID or by a name, its Email column can give them a new (or a first) email.
    let emailSets = false;
    if (id) { before = people.get(id); emailSets = true; if (!before) return raise('bad-key', 'People', row, name || email, `There’s no person with ID ${id}. Leave ID empty to add someone.`, { column: 'ID', found: id }); }
    else if (!create) {
      before = email ? byEmail(email) : undefined;
      if (!before && name) {
        // Someone added before emails existed is found by their name (when only they have it), and given this email.
        const list = named(name).filter((p) => !email || !p.email);
        if (list.length > 1) return raise('ambiguous-ref', 'People', row, name, `${list.length} people are called “${name}”. Add their email or ID to say which.`, { column: 'Name', found: name });
        before = list[0];
        emailSets = !!before;
      }
    }
    if (create && email && byEmail(email)) return raise('duplicate', 'People', row, name, `${byEmail(email)!.name} already has the email ${email}: each person needs their own.`, { column: 'Email' });

    const teamName = has(r, 'team') ? ref(r, 'team') : null;
    const tm = teamName ? teamFrom('People', row, name || before?.name || '', teamName) : undefined;
    if (teamName && !tm) return;
    // An empty Admin cell keeps what is there, as the field table says: only "yes" or "no" changes it.
    const adminWord = has(r, 'admin') && val(r, 'admin') ? codeOf(YES_WORDS, val(r, 'admin')) : null;
    if (adminWord === undefined) return raise('unknown-word', 'People', row, name || before?.name || '', `Admin should be yes or no, not “${val(r, 'admin')}”.`, { column: 'Admin', found: val(r, 'admin'), answers: ANSWERS.unknownWord(Object.values(YES_WORDS.word)) });

    if (action === 'left') {
      if (!before) return raise('removal-refused', 'People', row, name || email, `${LEFT} needs someone already here: their email or ID.`, { column: 'Action' });
      if (!admin()) { if (answerOf('not-allowed', 'People')?.choice === 'leave') return leave('People', row); return raise('not-allowed', 'People', row, before.name, 'Only an admin can mark someone as left.', { answers: ANSWERS.leaveOnly }); }
      // An email, or a name only one person has (the field table), found as an owner is: one one letter out is asked.
      const to = pickPerson('People', r, { name: 'takes over' }, null, 'Takes over');
      if (to.left) return leave('People', row);
      if (to.problem) return raise(to.kind!, 'People', row, before.name, `Takes over: ${to.problem}`, to.extra);
      if (to.person && to.byName) sayByName('People', row, before.name, to.byName, to.person);
      leaving.push({ person: before, row, to: to.person ?? before });
      return;
    }
    if (!before) {
      // Someone new: an admin adds them, with a name, an email and a team.
      if (!admin()) { if (answerOf('not-allowed', 'People')?.choice === 'leave') return leave('People', row); return raise('not-allowed', 'People', row, name, 'Only an admin can add people.', { answers: ANSWERS.leaveOnly }); }
      if (!name) return raise('required-empty', 'People', row, email, 'Add their name.', { column: 'Name' });
      // A name (or a name one letter out) someone here already has (C9): the same person with a new email, or someone new?
      if (!create) {
        const here = [...people.values()].filter((p) => !p.leftAt);
        const m = near(name, here.map((p) => p.name));
        const twin = 'exact' in m ? here.find((p) => p.name === m.exact) : 'near' in m ? here.find((p) => p.name === m.near) : undefined;
        if (twin) {
          const tell = twin.teamId ? teams.get(twin.teamId)?.name : twin.role;
          const a = ask('same-person', 'People', row, name, `“${name}” (${email}) looks like ${twin.name}${tell ? ` (${tell})` : ''}, who is already here.`, { column: 'Name', found: `${name} ${email}`, answers: ANSWERS.samePerson(twin.name) });
          if (a === 'leave') return;
          if (a && typeof a === 'object' && a.choice === 'same') {
            // The same person: the row gives them this email (and whatever else it changes).
            before = twin;
            emailSets = true;
          }
        }
      } else {
        // At set-up a second row with someone's name is allowed (the email is who someone is), and said.
        const same = sameNameNote({ id: '', name }, [...people.values()], (tid) => teams.get(tid)?.name ?? '');
        if (same) note('same-name', 'People', row, name, same);
      }
      if (!email && !before) return raise('required-empty', 'People', row, name, `Add ${name}’s email: everyone new needs one.`, { column: 'Email' });
    }
    if (!before) {
      const p: Person = { id: newId('p', name), name, role: val(r, 'job title'), initials: initialsOf(name), teamId: tm?.id ?? null, admin: adminWord === 'yes', email };
      if (create && !people.size) { p.admin = true; actor = p; }
      if (!p.teamId && create) return raise('required-empty', 'People', row, name, `${name} has no team.`, { column: 'Team' });
      people.set(p.id, p);
      peopleTouched.set(p.id, { before: null, row });
      // A new team's first person leads it, except at set-up, which never asks who leads a team: Workspace said "Led by"
      // someone nobody chose (deep review U7). There a team has no lead until an admin picks one under Teams.
      if (tm && !tm.leadId && via !== 'setup') teams.set(tm.id, { ...teams.get(tm.id)!, leadId: p.id });
      objective(r, row, p);
      return;
    }
    if (peopleTouched.has(before.id)) return raise('duplicate', 'People', row, before.name, `${before.name} has another row in this file. Give each person one row.`, { column: 'Email' });
    const nextName = has(r, 'name') && name ? name : before.name;
    const after: Person = {
      ...before, name: nextName, initials: nextName === before.name ? before.initials : initialsOf(nextName),
      role: has(r, 'job title') ? val(r, 'job title') : before.role,
      teamId: teamName == null ? before.teamId : tm?.id ?? null,
      admin: adminWord == null ? before.admin : adminWord === 'yes',
      // Matched by ID or name, the Email column can change their email; matched by email, it is that email.
      ...(emailSets && has(r, 'email') && email ? { email } : {}),
    };
    if (emailSets && has(r, 'email') && !email && before.email) return raise('cant-change', 'People', row, before.name, 'Their email can be changed, not taken away. Type it back in.', { column: 'Email' });
    objective(r, row, after);
    if (JSON.stringify(after) === JSON.stringify(before)) { same('People'); return; }
    if (!admin()) { if (answerOf('not-allowed', 'People')?.choice === 'leave') return leave('People', row); return raise('not-allowed', 'People', row, before.name, 'Only an admin can change people.', { answers: ANSWERS.leaveOnly }); }
    people.set(before.id, after);
    peopleTouched.set(before.id, { before, row });
  });
  /** A Team objective cell: the team's objective, said on its lead's row (where empty clears it); any other row may set it. */
  function objective(r: Rec, row: number, p: Person) {
    if (!has(r, 'team objective') || !p.teamId) return;
    const t = teams.get(p.teamId);
    const v = val(r, 'team objective');
    if (!t || (t.leadId !== p.id && !v) || t.objective === v) return;
    if (!admin()) { if (answerOf('not-allowed', 'People')?.choice === 'leave') leave('People', row); else raise('not-allowed', 'People', row, p.name, 'Only an admin can change a team’s objective.', { answers: ANSWERS.leaveOnly }); return; }
    if (!teamsTouched.has(t.id)) teamsTouched.set(t.id, { before: t, row });
    teams.set(t.id, { ...t, objective: v });
  }
  for (const [id, t] of peopleTouched) {
    const after = people.get(id)!;
    for (const problem of personProblems(after, [...people.values()], t.before)) {
      const kind: IssueKind = /look like an email/.test(problem) ? 'unknown-word' : /already has the email/.test(problem) ? 'duplicate' : /taken away|only admin/.test(problem) ? 'cant-change' : 'required-empty';
      raise(kind, 'People', t.row, t.before?.name ?? after.name, problem, { column: /admin/.test(problem) ? 'Admin' : /name/.test(problem) && !/email/.test(problem) ? 'Name' : 'Email' });
    }
    // Renamed to a name someone else has: allowed (the email is who someone is, backlog N), and said.
    if (t.before && fold(t.before.name) !== fold(after.name)) {
      const same = sameNameNote(after, [...people.values()], (tid) => teams.get(tid)?.name ?? '');
      if (same) note('same-name', 'People', t.row, after.name, same);
    }
  }
  if (create && !people.size && (input.tables.people ?? []).length && !issues.some((x) => x.level === 'must')) raise('required-empty', 'People', 1, '', 'Add at least one person.', { column: 'Name' });

  /* ---------- goals ---------- */
  // The working set: goals as they will be after this change, by id. Wherever a goal's ID is asked for, its key will do.
  const work = new Map<string, Goal>(s.goals.map((g) => [g.id, g]));
  // Set-up from another workspace's export: its IDs are that workspace's, so they're mapped to the new goals' IDs.
  const fileIds = new Map<string, string>();
  const goalByRef = (r: string) => (r ? work.get(fileIds.get(r) ?? r) ?? findGoal([...work.values()], r) : undefined);
  /** The goal a row says: its key first (a goal carried into this cycle keeps its key, not its ID), then its ID. */
  const goalOf = (keyRef: string, id: string) => goalOfRow(keyRef, id).g;
  /** The same, with a problem when the key and the ID name different goals (an ID from another cycle is just passed over). */
  const goalOfRow = (keyRef: string, id: string): { g?: Goal; problem?: string } => {
    const byKey = keyRef ? goalByRef(normalKey(keyRef) ?? keyRef) : undefined;
    const byId = id ? goalByRef(id) : undefined;
    if (byId && keyRef && byKey?.id !== byId.id) return { problem: `Key ${normalKey(keyRef) ?? keyRef} isn’t this goal’s key (${byId.key ?? 'none'}). A goal’s key never changes.` };
    return { g: byKey ?? byId };
  };
  /** The goals with a name (folded), but one. */
  const titled = (t: string, but = '') => [...work.values()].filter((g) => g.id !== but && fold(g.title) === fold(t));
  /**
   * The goal a name names (Feeds into, a check-in's Goal): the one goal with that name; one one letter out is asked
   * about; several with it, or none, is Must fix. Undefined with the problem raised.
   */
  const goalNamed = (sheet: Sheet, row: number, name: string, column: string, v: string, but = '', none = `There’s no goal called “${v}”.`, several = `Several goals are called “${v}”. Use the key to say which.`): Goal | undefined => {
    const list = titled(v, but);
    if (list.length === 1) return list[0];
    if (list.length > 1) {
      const a = answerOf('ambiguous-ref', sheet, column, v);
      if (a?.choice === 'choose' && a.value && goalByRef(normalKey(a.value) ?? a.value)) return goalByRef(normalKey(a.value) ?? a.value);
      raise('ambiguous-ref', sheet, row, name, several, { column, found: v, answers: [{ choice: 'choose', label: 'Choose which', needsValue: true, options: list.map((g) => g.key ?? g.id) }] });
      return undefined;
    }
    const all = [...work.values()].filter((g) => g.id !== but);
    const m = near(v, all.map((g) => g.title));
    const hit = 'near' in m ? all.find((g) => g.title === m.near) : undefined;
    const kind: IssueKind = hit ? 'near-ref' : 'unknown-ref';
    const a = answerOf(kind, sheet, column, v);
    if (a?.choice === 'leave') { leave(sheet, row); return undefined; }
    if (a?.choice === 'use' && hit) return hit;
    if (a?.choice === 'choose' && a.value) { const g = goalByRef(normalKey(a.value) ?? a.value) ?? titled(a.value, but)[0]; if (g) return g; }
    if (hit) raise('near-ref', sheet, row, name, `“${v}” isn’t a goal here. Did you mean “${hit.title}” (${hit.key ?? hit.id})?`, { column, found: v, suggest: hit.title, answers: ANSWERS.nearRef(`“${hit.title}”`, v, false, false) });
    else raise('unknown-ref', sheet, row, name, none, { column, found: v, answers: ANSWERS.unknownRef('goal', v, false, false) });
    return undefined;
  };
  /**
   * A week cell (Due week, Week, a stage's week): a whole number, or a date in the cycle read as its week and said (C16).
   * A date outside the cycle is never read as a week.
   */
  const weekCell = (raw: string, sheet: Sheet, row: number, name: string, say = true): { n: number | null; problem?: string } => {
    // A goal year and its week (2026-W48; goal entry, rule 13).
    if (/^\d{4}\s*-?\s*W\s*\d{1,2}$/i.test(raw.trim())) { const r = readWeekCode({ startDate: cycle.startDate, weeks: cycle.weeks }, raw); return 'n' in r ? { n: r.n } : { n: null, problem: r.text ?? weekUnknownText(cycle, 'The week', raw) }; }
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim()) ?? (() => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim()); return m ? [m[0], m[3], m[2]!.padStart(2, '0'), m[1]!.padStart(2, '0')] as unknown as RegExpExecArray : null; })();
    if (!iso) return { n: parseNumber(raw) };
    const at = Date.parse(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    const start = Date.parse(cycle.startDate + 'T00:00:00Z');
    const w = Math.floor((at - start) / (7 * 86_400_000));
    if (!Number.isFinite(at) || w < 0 || w > cycle.weeks) return { n: null, problem: `“${raw.trim()}” isn’t in ${cycle.name}, which runs ${cycle.startDate} to ${new Date(start + (7 * (cycle.weeks + 1) - 1) * 86_400_000).toISOString().slice(0, 10)}.` };
    if (say) note('date-as-week', sheet, row, name, `“${raw.trim()}” was read as week ${w}.`);
    return { n: w };
  };
  // A stopped goal (domain/removal) is in a whole-cycle export, marked Stopped; loaded back, its rows are left alone.
  const stoppedByRef = (r: string) => (r && !goalByRef(r) ? findGoal(s.archive?.goals ?? [], r) : undefined);
  const warnedStopped = new Set<string>();
  const leftAlone = (sheet: Sheet, row: number, g: Goal) => {
    same(sheet);
    if (!warnedStopped.has(g.id)) { warnedStopped.add(g.id); note('left-alone', sheet, row, g.title, `“${g.title}” is ${lower({ label: STOPPED })}, so its rows are left as they are.`); }
  };
  // New goals take the next keys, in the order of their rows; no key is used twice in a workspace. In create mode a
  // goal keeps the key the file gives it, so the new workspace's keys match the file.
  const fileKeys = create ? (input.tables.goals ?? []).map((r) => normalKey(val(r, 'key'))).filter((k): k is string => !!k) : [];
  let lastKeyGiven = Math.max(lastKey(s.goals, s.keysIssued), ...fileKeys.map((k) => Number(k.replace(/\D/g, ''))), 0);
  const touched = new Map<string, { before: Goal | null; row: number; sheet: Sheet; reason: string; plan: boolean }>();
  const started = (id: string) => s.checkIns.some((c) => c.goalId === id);
  // R1's row, stated once (domain/goalRights): its owner, or an admin (anyone, while a new workspace is set up).
  const canChange = (g: Goal) => mayChangeGoal({ id: actor.id, admin: admin() }, g);
  const notYours = (g: Goal) => `Only ${people.get(g.ownerId)?.name ?? 'its owner'} (its owner) or an admin can change “${g.title}”.`;
  const parentLinks: { id: string; row: number; r: Rec }[] = [];
  const removals: { g: Goal; how: 'stop' | 'delete'; reason: string; row: number }[] = [];
  // Stages answered "They're done" (C4): recorded as done in their due weeks once the goal exists (onboarding rule 3).
  const doneAtSetUp: { goalId: string; stageIds: string[]; row: number }[] = [];

  /**
   * One record on two rows (C14): every row is named and none is applied, unless the answer says to use the last (or
   * the first) row for each. Returns the rows to skip.
   */
  function twice(sheet: Sheet, list: { row: number; name: string; id: string }[], say: (x: { name: string; list: string }) => string, column: string): Set<number> {
    const by = new Map<string, { row: number; name: string }[]>();
    for (const x of list) if (x.id) by.set(x.id, [...(by.get(x.id) ?? []), x]);
    const skip = new Set<number>();
    const a = answerOf('duplicate', sheet, column);
    for (const rows of by.values()) {
      if (rows.length < 2) continue;
      const keep = a?.choice === 'last' ? rows.at(-1)!.row : a?.choice === 'first' ? rows[0]!.row : null;
      const listText = `${rows.slice(0, -1).map((x) => x.row).join(', ')} and ${rows.at(-1)!.row}`;
      for (const x of rows) {
        if (x.row === keep) continue;
        skip.add(x.row);
        if (keep == null) raise('duplicate', sheet, x.row, x.name, say({ name: x.name, list: listText }), { column, answers: ANSWERS.duplicate });
      }
    }
    return skip;
  }
  const goalRows = (input.tables.goals ?? []).map((r, i) => ({ r, row: rowOf(r, i), i })).filter(({ r }) => !blankRow(r) && codeOf(GOAL_ACTION_WORDS, val(r, 'action')) !== 'example');
  examples += (input.tables.goals ?? []).filter((r) => !blankRow(r) && codeOf(GOAL_ACTION_WORDS, val(r, 'action')) === 'example').length;
  examples += (input.tables.people ?? []).filter((r) => !blankRow(r) && codeOf(PERSON_ACTION_WORDS, val(r, 'action')) === 'example').length;
  const skipGoals = twice('Goals', goalRows.map(({ r, row }) => {
    const keyRef = val(r, 'key'), id = val(r, 'id');
    const g = create ? undefined : goalOfRow(keyRef, id).g;
    const k = normalKey(keyRef);
    return { row, name: val(r, 'goal') || keyRef || id, id: g ? 'g:' + g.id : k ? 'k:' + k : id ? 'i:' + id : val(r, 'goal') ? `n:${fold(val(r, 'goal'))}|${fold(ref(r, 'team'))}` : '' };
  }), (x) => (/^G-/i.test(x.name) ? `Key ${x.name} is on rows ${x.list}. Give each goal one row.` : `“${x.name}” is on rows ${x.list}. Give each goal one row.`), 'Key');
  // Five or more rows that stop, delete or mark someone as left: asked once (big-removal).
  const removalRows = [
    ...goalRows.filter(({ r }) => ['stop', 'delete'].includes(codeOf(GOAL_ACTION_WORDS, val(r, 'action')) ?? '')).map(({ row }) => ({ sheet: 'Goals' as Sheet, row })),
    ...personRows.filter(({ r }) => codeOf(PERSON_ACTION_WORDS, val(r, 'action')) === 'left').map(({ row }) => ({ sheet: 'People' as Sheet, row })),
  ];

  goalRows.forEach(({ r, row, i }) => {
    if (skipGoals.has(row)) return;
    const id = val(r, 'id');
    let keyRef = val(r, 'key');
    const title = val(r, 'goal');
    const action = readWord(GOAL_ACTION_WORDS, val(r, 'action'), 'Goals', row, title || keyRef || id, ', or leave it empty');
    if (action === undefined) return;
    if (keyRef && !isKey(keyRef)) return raise('bad-key', 'Goals', row, title || keyRef, `Key “${keyRef}” should look like G-12.`, { column: 'Key', found: keyRef });
    let existing: Goal | null = null;
    if (create) {
      if (action) return raise('removal-refused', 'Goals', row, title, `${GOAL_ACTION_WORDS.word[action]} is for a goal already in a workspace; leave Action empty when setting one up.`, { column: 'Action' });
    } else {
      const stopped = stoppedByRef(keyRef) ?? stoppedByRef(id);
      if (stopped && !goalOf(keyRef, id)) return leftAlone('Goals', row, stopped);
      const found = goalOfRow(keyRef, id);
      if (found.problem) return raise('cant-change', 'Goals', row, title || keyRef, found.problem, { column: 'Key' });
      existing = found.g ?? null;
      if (keyRef && !existing) return raise('bad-key', 'Goals', row, title || keyRef, `There’s no goal with key ${normalKey(keyRef)} in ${cycle.name}. Leave Key and ID empty to add a new goal.`, { column: 'Key', found: normalKey(keyRef) ?? keyRef });
      if (id && !existing) return raise('bad-key', 'Goals', row, title || id, `There’s no goal with ID ${id} in ${cycle.name}. Leave ID empty to add a new goal.`, { column: 'ID', found: id });
      if (existing && touched.has(existing.id)) return raise('duplicate', 'Goals', row, existing.title, `“${existing.title}” has another row in this file. Give each goal one row.`, { column: 'Key', answers: ANSWERS.duplicate });
      // A key that names a goal that looks like another (C5): its name, and the owner and team it gives, all differ.
      if (existing && !action && title && unrelated(title, existing.title)) {
        const owner = people.get(existing.ownerId);
        const ownerGiven = [ref(r, 'owner'), ref(r, 'owner email')].filter(Boolean);
        const teamGiven = ref(r, 'team');
        // A file's row that gives no owner or team counts them as differing (09h: keys from another workspace). Through
        // the AI tools a call names only what it changes, so a rename by key is a rename: only what it gives counts.
        const given = via !== 'mcp';
        const ownerDiffers = (given || ownerGiven.length > 0) && ownerGiven.every((v) => !owner || (fold(v) !== fold(owner.name) && normalEmail(v) !== normalEmail(owner.email)));
        const teamDiffers = given ? !teamGiven || fold(teamGiven) !== fold(teams.get(existing.teamId)?.name ?? '') : !!teamGiven && fold(teamGiven) !== fold(teams.get(existing.teamId)?.name ?? '');
        if (ownerDiffers && teamDiffers) {
          const k = existing.key ?? existing.id;
          const a = ask('other-goal', 'Goals', row, title, `${k} is “${existing.title}” here, owned by ${owner?.name ?? 'someone'}. Row ${row} calls it “${title}”${ownerGiven.length || teamGiven ? ', with another owner and team' : ''}. Is it the same goal?`, { column: 'Key', found: k, answers: ANSWERS.otherGoal });
          if (a === 'leave' || a === null) return;
          if (a.choice === 'new') { existing = null; keyRef = ''; }
        }
      }
    }
    if (!existing) {
      if (!title) return raise('required-empty', 'Goals', row, '', 'Name the goal in the Goal column.', { column: 'Goal' });
      // A totals row (TOTAL, Sum) with no owner is asked about, never imported as a goal by default.
      if (/^(total|totals|sum|grand total)$/.test(fold(title)) && !ref(r, 'owner') && !ref(r, 'owner email') && !ref(r, 'owner id')) {
        const a = ask('totals-row', 'Goals', row, title, `Row ${row} is called “${title}” and has no owner. It looks like a totals row.`, { column: 'Goal', found: title, answers: ANSWERS.totals });
        if (a === 'leave' || a === null) return;
      }
      // The same name for the same team (or no team) is far more often the same goal again without its key (C10): asked.
      const teamCell = ref(r, 'team');
      const rowTeam = teamCell ? teamNamed(teamCell) : undefined;
      const same = titled(title).find((g) => !teamCell || !rowTeam || rowTeam.id === g.teamId);
      if (same && !create) {
        const k = same.key ?? same.id;
        const a = ask('same-goal', 'Goals', row, title, `A goal called “${same.title}” is already here (${[k, teams.get(same.teamId)?.name].filter(Boolean).join(', ')}). Is this a new goal, or the same one?`, { column: 'Goal', found: title, answers: ANSWERS.sameGoal(k) });
        if (a === 'leave') return;
        if (a && a.choice === 'same') {
          // Two rows answered "the same" for one goal: both are named, as any goal on two rows is (IM2 review).
          if (touched.has(same.id)) return raise('duplicate', 'Goals', row, same.title, `“${same.title}” has another row in this file. Give each goal one row.`, { column: 'Key', answers: ANSWERS.duplicate });
          existing = same;
        }
      } else if (same && create) return raise('duplicate', 'Goals', row, title, `“${title}” is on two rows. Give each goal one row.`, { column: 'Goal' });
    }
    const label = title || existing?.title || '';
    const currentOwner = existing ? people.get(existing.ownerId) ?? null : null;
    const own = pickPerson('Goals', r, { email: 'owner email', id: 'owner id', name: 'owner' }, currentOwner, 'Owner');
    if (own.left) return leave('Goals', row);
    if (own.problem) return raise(own.kind!, 'Goals', row, label, own.problem, own.extra);
    const owner = own.person ?? currentOwner;
    if (own.person && own.byName) sayByName('Goals', row, label, own.byName, own.person);
    if (!existing && !owner) return raise('required-empty', 'Goals', row, title, 'A new goal needs an owner: Owner email, or Owner.', { column: 'Owner' });
    // Anyone may add a goal for anyone, at any level (Lane, 11 Nov; domain/goalRights): the form, a file and the tools agree.
    if (!existing && owner && !mayAddGoal({ id: actor.id, admin: admin() }, owner.id)) return raise('not-allowed', 'Goals', row, title, 'You can’t add this goal.', { answers: ANSWERS.leaveOnly });
    const teamName = ref(r, 'team');
    const tm = teamName ? teamFrom('Goals', row, label, teamName) : null;
    if (teamName && !tm) return;

    const d: GoalDraft = existing ? draftOf(existing) : blankGoal(tm?.id ?? owner?.teamId ?? [...teams.values()][0]?.id ?? '', owner!.id, '');
    if (title) d.title = title;
    if (owner) d.ownerId = owner.id;
    // A default used is said on the change (section 4, "Fine, and said"): the team a new goal takes from its owner.
    if (!existing && !tm && owner?.teamId && teams.get(owner.teamId)) note('default', 'Goals', row, title, `Team: ${teams.get(owner.teamId)!.name} (the owner’s team; the row gave none).`, { column: 'Team' });
    if (tm) d.teamId = tm.id;
    const lvl = readWord(LEVEL_WORDS, val(r, 'level'), 'Goals', row, label);
    if (lvl === undefined) return;
    if (lvl) d.level = lvl;
    const kind = readWord(TYPE_WORDS, val(r, 'type'), 'Goals', row, label);
    if (kind === undefined) return;
    if (kind) {
      if (existing && kind !== existing.kind) return raise('cant-change', 'Goals', row, d.title, 'A goal’s type can’t change. Add a new goal instead.', { column: 'Type' });
      d.kind = kind;
    }
    if (!existing && !kind) {
      // No Type: read from which columns the row fills in (C1); none, or two kinds' columns, is asked to be said.
      const filled = ([['metric', !!(val(r, 'start') || val(r, 'target'))], ['range', !!val(r, 'limit')], ['milestone', !!val(r, 'stages')]] as const).filter(([, on]) => on).map(([k]) => k);
      const a = answerOf('type-unclear', 'Goals', 'Type');
      const chosen = a?.choice === 'choose' && a.value ? codeOf(TYPE_WORDS, a.value) : undefined;
      if (filled.length === 1) {
        d.kind = filled[0]!;
        note('default', 'Goals', row, d.title, `Type: ${TYPE_WORDS.word[d.kind]} (from ${d.kind === 'metric' ? 'Start and Target' : d.kind === 'range' ? 'Limit' : 'Stages'}; the row gave none).`, { column: 'Type' });
      } else if (chosen && (!filled.length || filled.includes(chosen))) d.kind = chosen;
      else {
        const cols = { metric: 'Start and Target', range: 'Limit', milestone: 'Stages' };
        return raise('type-unclear', 'Goals', row, d.title, filled.length ? `Type is empty and the row has ${filled.map((k) => cols[k]).join(', and ')}. Say ${oneOf(Object.values(TYPE_WORDS.word))}.` : `Type is empty and the row has no Start and Target, Limit or Stages. Add them, or say the type.`,
          { column: 'Type', ...(filled.length ? { answers: [{ choice: 'choose', label: 'Choose a type', needsValue: true, options: filled.map((k) => TYPE_WORDS.word[k]) }] } : {}) });
      }
    }
    // A new number has no unit unless the row says one (C2: never "%" by default); none is asked about, once a file.
    if (!existing && d.kind !== 'milestone') d.unit = has(r, 'unit') ? val(r, 'unit') : '';
    else if (has(r, 'unit') && d.kind !== 'milestone') d.unit = val(r, 'unit');
    // A new number with no unit, or one whose unit a row clears, is asked about: the form's no-unit, in its words.
    if ((!existing || (existing.kind !== 'milestone' && !!existing.unit.trim())) && d.kind !== 'milestone' && !d.unit.trim() && ask('no-unit', 'Goals', row, d.title, 'This number has no unit. Is it a plain count?', { column: 'Unit', answers: ANSWERS.noUnit }) === 'leave') return;
    // Numbers as typed: a formula is Must fix; a comma as the decimal mark is read, and asked about once.
    for (const [col, head] of [['start', 'Start'], ['target', 'Target'], ['limit', 'Limit'], ['margin', 'Margin']] as const) {
      const raw = val(r, col);
      if (!raw) continue;
      if (isFormula(raw)) return raise('formula', 'Goals', row, d.title, `${head} holds a formula (“${raw}”), not a number. In Excel, copy the column and paste it as values.`, { column: head });
      if (commaDecimal(raw) && ask('decimal-comma', 'Goals', row, d.title, `“${raw}” was read as ${parseNumber(raw)}: a comma as the decimal mark.`, { answers: ANSWERS.sure, suggest: String(parseNumber(raw)), found: '' }) === 'leave') return;
    }
    if (val(r, 'decimals')) d.decimals = val(r, 'decimals');
    else if (!existing && d.kind !== 'milestone') d.decimals = String(Math.min(3, Math.max(0, ...['start', 'target', 'limit'].map((k) => typedDecimals(val(r, k))))));
    if (val(r, 'start')) d.start = val(r, 'start');
    if (val(r, 'target')) d.target = val(r, 'target');
    const shape = readWord(SHAPE_WORDS, val(r, 'plan'), 'Goals', row, d.title);
    if (shape === undefined) return;
    if (shape && shape !== d.shape) { d.shape = shape; d.points = {}; }
    // From and To (goal entry, rule 13) beside Plan from week and Due week, read as Owner and Owner email are: a column that
    // says what the goal says now is ignored, the one that differs counts, and two that differ and disagree are a Must fix.
    // From and To are a goal year and its week (2026-W46); the old columns are weeks from the cycle's start.
    let dueChanged = false;
    if (d.kind === 'metric') {
      const was = existing?.kind === 'metric' ? existing.plan : null;
      // One pair: the new column (a goal year's week) and the old (the cycle's week); null when neither says anything new.
      const pair = (col: 'from' | 'to', old: 'plan from week' | 'due week', head: string, oldHead: string, cur: number | null): number | null | false => {
        const said: [string, string, number][] = [];
        for (const [c, h] of [[col, head], [old, oldHead]] as const) {
          const raw = has(r, c) ? val(r, c) : '';
          // An empty Due week is the cycle's end (it clears); any other empty cell says nothing.
          if (!raw && !(c === 'due week' && has(r, c))) continue;
          let n: number | null, msg: string | undefined;
          if (c === col) { const x = readWeekCode(cycle, raw); n = 'n' in x ? x.n : null; msg = 'text' in x ? x.text : undefined; }
          else if (c === 'due week' && raw) { const x = weekCell(raw, 'Goals', row, d.title); n = x.n; msg = x.problem; }
          else n = raw ? parseNumber(raw) : cycle.weeks;
          if (n == null || !Number.isInteger(n)) { raise('week-wrong', 'Goals', row, d.title, msg ?? weekUnknownText(cycle, h, raw), { column: h }); return false; }
          if (n !== cur) said.push([h, raw, n]);
        }
        if (said.length === 2 && said[0]![2] !== said[1]![2]) { raise('week-wrong', 'Goals', row, d.title, `${head} says ${said[0]![1]} and ${oldHead} says ${said[1]![1]}. Change just one of them.`, { column: head }); return false; }
        return said[0]?.[2] ?? null;
      };
      const from = pair('from', 'plan from week', 'From', 'Plan from week', was ? was.fromWeek ?? 0 : null);
      if (from === false) return;
      if (from != null) d.fromWeek = String(from);
      if (has(r, 'to') || has(r, 'due week')) {
        const to = pair('to', 'due week', 'To', 'Due week', was ? planEnd(was, cycle.weeks) : null);
        if (to === false) return;
        if (to != null) { const next = to !== cycle.weeks ? String(to) : ''; dueChanged = next !== d.endWeek; d.endWeek = next; }
      }
    }
    if (d.kind === 'metric' && (!existing || d.fromWeek != null || dueChanged)) {
      // The due week against the start the goal will have, always (C3): its own From, else what it has, else this week.
      // One that isn't after it is goal entry's Must fix (to-before-from), said below in its words.
      const from = d.fromWeek != null ? Number(d.fromWeek) : existing?.kind === 'metric' ? existing.plan.fromWeek ?? 0 : week > 0 ? week : 0;
      const end = parseNumber(d.endWeek) ?? cycle.weeks;
      // A new goal whose whole plan is already past: a finished goal added for the record, or a mistake (past-plan).
      if (from < end && !existing && !create && end < week && ask('past-plan', 'Goals', row, d.title, `“${d.title}” has a plan that ended in week ${end}; it’s week ${week}.`, { column: 'Due week', answers: ANSWERS.pastPlan }) === 'leave') return;
    }
    if (val(r, 'limit')) d.limit = val(r, 'limit');
    const bound = readWord(BOUND_WORDS, val(r, 'must stay'), 'Goals', row, d.title);
    if (bound === undefined) return;
    if (bound) d.bound = bound;
    if (val(r, 'margin')) d.margin = val(r, 'margin');
    // A new range has no warning margin unless the row gives one (round 2: none by default).
    else if (!existing && d.kind === 'range') d.margin = '0';
    if (val(r, 'stages')) {
      const parts = val(r, 'stages').split(/;|\n/).map((x) => x.trim()).filter(Boolean);
      const stages: GoalDraft['stages'] = [];
      for (const [k, x] of parts.entries()) {
        const m = /^(.*?)\s*@\s*(?:wk|week)?\s*(.+?)\s*$/i.exec(x);
        if (!m) return raise('stage-format', 'Goals', row, d.title, `“${x}” has no week. Write it as Name@week, like Pilot@52.`, { column: 'Stages' });
        const name = m[1]!.trim();
        if (!name) return raise('stage-format', 'Goals', row, d.title, 'Every stage needs a name.', { column: 'Stages' });
        const read = weekCell(m[2]!, 'Goals', row, d.title);
        if (read.problem) return raise('stage-format', 'Goals', row, d.title, `“${x}”: ${read.problem}`, { column: 'Stages' });
        if (read.n != null && Number.isInteger(read.n) && read.n > cycle.weeks) return raise('stage-format', 'Goals', row, d.title, `“${x}”: week ${read.n} is past the end of ${cycle.name} (week ${cycle.weeks}).`, { column: 'Stages' });
        // Two stages of one name are goal entry's rule 2 (stage-twice), said below in the form's words.
        const old = existing?.kind === 'milestone' ? existing.stages.find((st) => fold(st.name) === fold(name)) : undefined;
        stages.push({ id: old?.id ?? 's' + (k + 1) + '-' + newId('st').slice(-4), name, dueWeek: read.n == null ? m[2]! : String(read.n) });
      }
      d.stages = stages;
    }
    // A new goal's stages already due (C4; onboarding rule 3, in bulk): done, not done, or counted from this week.
    let doneIds: string[] = [];
    if (!existing && !create && d.kind === 'milestone') {
      const past = d.stages.filter((st) => { const w = parseNumber(st.dueWeek); return w != null && w < week; });
      if (past.length) {
        const a = ask('past-stage', 'Goals', row, d.title, `${plural(past.length, 'stage')} of “${d.title}” ${past.length === 1 ? 'is' : 'are'} due before this week (week ${week}): ${past.map((st) => `${st.name}@${st.dueWeek}`).join(', ')}. ${past.length === 1 ? 'Is it' : 'Are they'} done?`, { column: 'Stages', answers: ANSWERS.pastStage });
        if (a === 'leave') return;
        if (a?.choice === 'done') doneIds = past.map((st) => st.id);
        if (a?.choice === 'from-now') {
          const moved = stagesFromNow(d.stages.map((st) => `${st.name}@${st.dueWeek}`).join('; '), week, cycle.weeks).split(';').map((x) => x.trim());
          d.stages = d.stages.map((st, k) => ({ ...st, dueWeek: /@\s*(\d+)$/.exec(moved[k] ?? '')?.[1] ?? st.dueWeek }));
        }
      }
    }
    if (has(r, 'why it helps')) d.whyHelps = val(r, 'why it helps');
    if (has(r, 'effect')) d.effect = val(r, 'effect');
    if (has(r, 'source')) d.source = val(r, 'source');
    if (has(r, 'definition')) d.definition = val(r, 'definition');
    // What can't be saved: goal entry's rule 2, the same rule and words as New goal, the edit page and set-up's cards.
    const ownerNow = people.get(d.ownerId);
    // What it feeds is read once every goal in the file exists (below), but whether it feeds one is known now: a row that
    // names a goal in a Feeds into column, else what the goal feeds already. The Effect is judged with it, as the form does.
    const feedsCols = (['feeds into key', 'feeds into id', 'feeds into'] as const).filter((c) => has(r, c));
    const feeds = feedsCols.length ? feedsCols.some((c) => !!ref(r, c)) : !!d.parentId;
    const fix = goalMustFix({ ...d, parentId: feeds ? d.parentId || '(read below)' : '' }, { cycleWeeks: cycle.weeks, week, existing, startDate: cycle.startDate, checkIns: existing ? s.checkIns.filter((c) => c.goalId === existing!.id) : [], door: 'table', owner: ownerNow ? { name: ownerNow.name, teamId: ownerNow.teamId ?? null } : null });
    if (fix.length) {
      for (const f of fix) raise(MUST_KIND[f.id], 'Goals', row, d.title, f.text, { column: FIELD_COLUMN[f.field] ?? 'Goal' });
      return;
    }
    // Two goals may share a title (two teams can both "Reduce latency"): a new one that does is said, never refused.
    if (!existing) {
      const twin = sameTitleNote(d.title, null, s.goals.filter((g) => g.cycleId === cycle.id && !g.removedAt), (t) => teams.get(t)?.name ?? '');
      if (twin) note('same-name', 'Goals', row, d.title, twin);
    }
    // What is asked (goal entry, rule 3): the same questions, in the same words, as New goal and the edit page. A goal
    // already set up this way isn't asked again (goalChecks asks only what a change makes new). The import keeps its own
    // forms of three of them, with their richer answers: no unit (no-unit), the same name (same-goal) and stages already
    // past (past-stage); a changed plan's question is asked once the change is known (plan-question, below), and a link
    // to a lower level once the links are read (feeds-lower). An owner in another team isn't asked of a file: its Team
    // column says the team in so many words, where the form's team follows the owner until chosen by hand.
    // What measures it is known for a goal already linked to a metric (a new one is linked after it is saved).
    const metric = d.kind === 'metric' && existing ? goalMeasureOf(input.records, s, existing.id) : null;
    const checks = goalChecks(d, { week, cycleWeeks: cycle.weeks, existing, door: 'table', levels: cycle, startDate: cycle.startDate, metric });
    for (const c of checks) {
      const kind = ENGINE_CHECK[c.id];
      if (!kind) continue;
      if (ask(kind, 'Goals', row, d.title, c.question, { column: FIELD_COLUMN[c.field] ?? 'Goal', found: c.id, answers: ANSWERS.odd, ...(kind === 'odd-number' ? { value: val(r, (FIELD_COLUMN[c.field] ?? '').toLowerCase()) } : {}) }) === 'leave') return;
    }

    const gid = existing?.id ?? newId('goal', d.title);
    if (create && id) fileIds.set(id, gid);
    const key = existing ? existing.key : (create && normalKey(keyRef)) || formatKey(++lastKeyGiven);
    parentLinks.push({ id: gid, row, r });
    let built = buildGoal({ ...d, parentId: existing?.parentId ?? '' }, cycle, { id: gid, createdAt: existing?.createdAt ?? new Date(Date.parse(now) + i).toISOString() }, existing, started(gid), week);
    if (existing) built = { ...existing, ...built } as Goal;
    if (key) built = { ...built, key };
    if (existing && d.whyHelps === '' && 'whyHelps' in built) delete (built as { whyHelps?: string }).whyHelps;
    // A row that stops or deletes a goal says only that: its other columns must say what the goal says now.
    if (action) {
      if (existing && goalChange(existing, built, lookupNow(), actor.id, now, 'x')) return raise('cant-change', 'Goals', row, existing.title, `A row that says ${GOAL_ACTION_WORDS.word[action]} can’t also change the goal. Make the change, or the ${GOAL_ACTION_WORDS.word[action].toLowerCase()}, on its own.`, { column: 'Action' });
      parentLinks.pop();
      if (removalRows.length >= 5) {
        const a = ask('big-removal', 'Goals', row, existing!.title, bigRemoval(), { column: 'Action', answers: ANSWERS.sure });
        if (a === 'leave') return;
      }
      removals.push({ g: existing!, how: action as 'stop' | 'delete', reason: val(r, 'reason'), row });
      return;
    }
    if (doneIds.length) doneAtSetUp.push({ goalId: gid, stageIds: doneIds, row });
    work.set(gid, built);
    touched.set(gid, { before: existing, row, sheet: 'Goals', reason: val(r, 'reason') || val(r, 'reason for change'), plan: !!existing && planChanged(existing, built) });
  });
  function lookupNow(): Lookup {
    return { person: (pid) => people.get(pid), goal: (gid) => work.get(gid), teamName: (tid) => teams.get(tid)?.name ?? tid };
  }
  function bigRemoval(): string {
    const stops = goalRows.filter(({ r }) => codeOf(GOAL_ACTION_WORDS, val(r, 'action')) === 'stop').length;
    const deletes = goalRows.filter(({ r }) => codeOf(GOAL_ACTION_WORDS, val(r, 'action')) === 'delete').length;
    const lefts = removalRows.length - stops - deletes;
    const parts = [stops && `stops ${plural(stops, 'goal')}`, deletes && `deletes ${plural(deletes, 'goal')}`, lefts && `marks ${plural(lefts, 'person', 'people')} as left`].filter(Boolean) as string[];
    return `This file ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}. Is that right?`;
  }

  // What each goal feeds, once every goal in the file exists: Feeds into key, Feeds into ID or Feeds into (a name). Only
  // the columns that say something new count, so an edited name beside a key left as it was is the change.
  for (const l of parentLinks) {
    const g = work.get(l.id)!;
    const before = touched.get(l.id)?.before ?? null;
    const current = before?.parentId ? work.get(before.parentId) ?? null : null;
    const cols = (['feeds into key', 'feeds into id', 'feeds into'] as const).filter((c) => has(l.r, c));
    const says = (c: string, v: string) => (!current ? v === '' : c === 'feeds into key' ? normalKey(v) === current.key : c === 'feeds into id' ? v === current.id || fileIds.get(v) === current.id : fold(v) === fold(current.title));
    const changed = cols.map((c) => [c, ref(l.r, c)] as const).filter(([c, v]) => !(before && says(c, v)) && (before || v));
    if (!changed.length) continue;
    let missing = false;
    const found = changed.map(([c, v]) => {
      if (!v) return { c, p: null as Goal | null };
      if (c === 'feeds into') {
        const p = goalNamed('Goals', l.row, g.title, 'Feeds into', v, l.id, `“${g.title}” feeds into “${v}”, which isn’t a goal in ${cycle.name}.`, `Several goals are called “${v}”. Use Feeds into key to say which.`);
        if (!p) missing = true;
        return { c, p: p ?? null };
      }
      const p = goalByRef(c === 'feeds into key' ? normalKey(v) ?? v : v);
      if (!p) { missing = true; raise('bad-key', 'Goals', l.row, g.title, `${c === 'feeds into key' ? 'Feeds into key' : 'Feeds into ID'} ${v} isn’t a goal in ${cycle.name}.`, { column: c === 'feeds into key' ? 'Feeds into key' : 'Feeds into ID', found: v }); }
      return { c, p: p ?? null };
    });
    if (missing) { if (leftOut.some((x) => x.sheet === 'Goals' && x.row === l.row)) touched.delete(l.id); continue; }
    const ids = new Set(found.map((x) => x.p?.id ?? ''));
    if (ids.size > 1) { raise('conflicting-refs', 'Goals', l.row, g.title, 'Feeds into and Feeds into key name different goals. Change just one of them.', { column: 'Feeds into' }); continue; }
    const parentId = [...ids][0] || null;
    if (parentId === l.id) { raise('loop', 'Goals', l.row, g.title, 'A goal can’t feed into itself.', { column: 'Feeds into' }); continue; }
    if (parentId && makesLoop(l.id, parentId, [...work.values()])) { raise('loop', 'Goals', l.row, g.title, 'That link would make a loop: the goal it feeds already feeds into it.', { column: 'Feeds into' }); continue; }
    const next = { ...g, parentId } as Goal;
    // A link to a goal at a lower level is asked about (goal entry, rule 3's feeds-lower), never refused.
    const up = parentId ? work.get(parentId) : undefined;
    if (up) {
      const q = goalChecks(draftOf(next), { week, cycleWeeks: cycle.weeks, existing: before, door: 'table', levels: cycle, parent: { id: up.id, title: up.title, level: up.level } }).find((c) => c.id === 'feeds-lower');
      if (q && ask('feeds-lower', 'Goals', l.row, g.title, q.question, { column: 'Feeds into', found: `${g.level}>${up.level}`, answers: ANSWERS.feedsLower }) === 'leave') { touched.delete(l.id); continue; }
    }
    if (!parentId) { next.effect = null; delete next.whyHelps; }
    else {
      // Why it helps and the effect belong to the link: a goal given one now takes them from its row.
      const why = has(l.r, 'why it helps') ? val(l.r, 'why it helps') : g.whyHelps ?? '';
      if (why) next.whyHelps = why; else delete next.whyHelps;
      if (has(l.r, 'effect')) next.effect = parseNumber(val(l.r, 'effect'));
    }
    work.set(l.id, next);
  }

  /* ---------- plan numbers ---------- */
  (input.tables.plan ?? []).forEach((r, i) => {
    const row = rowOf(r, i);
    if (blankRow(r)) return;
    const keyRef = val(r, 'key'), idRef = val(r, 'id');
    if (!keyRef && !idRef) { if (val(r, 'goal')) raise('required-empty', 'Plan', row, val(r, 'goal'), 'Add the goal’s key or ID so the plan can be matched to it.', { column: 'Key' }); return; }
    const found = goalOfRow(keyRef, idRef);
    if (found.problem) return raise('cant-change', 'Plan', row, val(r, 'goal') || keyRef, found.problem, { column: 'Key' });
    const g = found.g;
    if (!g) {
      const stopped = stoppedByRef(keyRef) ?? stoppedByRef(idRef);
      if (stopped) return leftAlone('Plan', row, stopped);
      return raise('bad-key', 'Plan', row, val(r, 'goal') || keyRef || idRef, keyRef ? `There’s no goal with key ${normalKey(keyRef) ?? keyRef}.` : `There’s no goal with ID ${idRef}.`, { column: keyRef ? 'Key' : 'ID', found: keyRef || idRef });
    }
    const id = g.id;
    if (g.kind !== 'metric') return raise('cant-change', 'Plan', row, g.title, 'Only number goals have plan numbers.', { column: 'Key' });
    // Compared with the plan as it was before this file, so a Goals row's new target isn't undone by the Plan sheet's
    // old numbers: only the weeks typed differently from the plan before count.
    const orig = (touched.get(id)?.before ?? s.goals.find((x) => x.id === id) ?? g) as MetricGoal;
    const origEnd = planEnd(orig.plan, cycle.weeks);
    // A week counts as typed only when it differs from the plan's own number as the export writes it (rule 9, IM0):
    // a tolerance of half a unit misread a number that falls on the half (0.405 written 0.41) as a change.
    const numberAt = (head: string, raw: string): number | null | undefined => {
      if (isFormula(raw)) { raise('formula', 'Plan', row, g.title, `${head} holds a formula (“${raw}”), not a number. In Excel, copy the column and paste it as values.`, { column: head }); return undefined; }
      const n = parseNumber(raw);
      if (n == null) { raise('not-a-number', 'Plan', row, g.title, `${head}: ${notNumberText(raw, g.decimals)}`, { column: head }); return undefined; }
      const precise = precisionProblem(raw, n, g.decimals);
      if (precise) { raise('precision', 'Plan', row, g.title, `${head}: ${precise}`, { column: head }); return undefined; }
      return n;
    };
    const startTyped = val(r, 'start') ? numberAt('Start', val(r, 'start')) : null;
    if (startTyped === undefined) return;
    const typed = new Map<number, number>();
    for (const [k, v] of Object.entries(r)) {
      const m = /^week (\d+)$/.exec(k);
      if (!m || !String(v).trim()) continue;
      const n = numberAt(`Week ${m[1]}`, String(v));
      if (n === undefined) return;
      const w = Number(m[1]);
      const was = w <= (orig.plan.fromWeek ?? 0) || w > origEnd ? null : w === origEnd ? orig.plan.target : planAt(orig.plan, w, cycle.weeks);
      if (!sameAsWritten(n!, was, g.decimals)) typed.set(w, n!);
    }
    const startChanged = startTyped != null && !sameAsWritten(startTyped, orig.plan.start, g.decimals);
    if (!typed.size && !startChanged) { if (!touched.has(id)) unchanged++; unchangedBy.Plan++; return; }
    if (removals.some((x) => x.g.id === id)) return raise('cant-change', 'Plan', row, g.title, `This file also stops or deletes “${g.title}”, so its plan can’t change in it.`);
    if (!create && !canChange(g)) {
      if (answerOf('not-allowed', 'Plan')?.choice === 'leave') return leave('Plan', row);
      return raise('not-allowed', 'Plan', row, g.title, notYours(g), { answers: ANSWERS.leaveOnly });
    }
    const from = g.plan.fromWeek ?? 0, end = planEnd(g.plan, cycle.weeks);
    const outside = [...typed.keys()].filter((w) => w <= from || w > end);
    if (outside.length) return raise('plan-order', 'Plan', row, g.title, `Week ${outside[0]} is outside the plan, which runs from week ${from + 1} to week ${end}. Change Plan from week or Due week on Goals first.`, { column: `Week ${outside[0]}` });
    const start = startChanged ? startTyped! : g.plan.start;
    const target = typed.get(end) ?? g.plan.target;
    if (target === start) return raise('impossible-number', 'Plan', row, g.title, 'The target has to differ from the start.', { column: `Week ${end}` });
    const kept = new Map((g.plan.points ?? []).map((p) => [p.week, p.value]));
    for (const [w, v] of typed) if (w < end) kept.set(w, v);
    // Hand-set weeks are stored with every checkpoint, the rest at the plan's own numbers, as the plan editor does.
    const points = typed.size ? [...new Set([...kept.keys(), ...Array.from({ length: end - from - 1 }, (_, k) => from + 1 + k)])].filter((w) => w > from && w < end).sort((a, b) => a - b)
      .map((w) => ({ week: w, value: kept.get(w) ?? Number(planAt(g.plan, w, cycle.weeks).toFixed(g.decimals + 2)) })) : g.plan.points ?? [];
    const plan: MetricPlan = { ...g.plan, start, target, ...(points.length ? { points } : {}) };
    const before = touched.get(id)?.before ?? s.goals.find((x) => x.id === id) ?? null;
    const next: MetricGoal = { ...g, plan, ...(before?.kind === 'metric' ? replanned(before, plan, started(id), week) : {}) };
    work.set(id, next);
    const t = touched.get(id);
    touched.set(id, { before, row: t?.row ?? row, sheet: t?.sheet ?? 'Plan', reason: t?.reason || val(r, 'reason'), plan: !!before });
  });

  /* ---------- check-ins: which goal each row is, and more decimal places when the answer says to keep them ---------- */
  const ciRows = (input.tables.checkIns ?? []).map((r, i) => ({ r, row: rowOf(r, i) })).filter(({ r }) => !blankRow(r));
  const byTitle = (t: string) => { const l = titled(t); return l.length === 1 ? l[0] : undefined; };
  const goalFor = (r: Rec) => (val(r, 'goal key') || val(r, 'goal id') ? goalOf(val(r, 'goal key'), val(r, 'goal id')) : byTitle(val(r, 'goal')));
  // A Value with more decimal places than its goal keeps: one group for the file, and one answer ("Keep 2 decimal places
  // for these 900 goals") gives each goal the places, as a change to its Decimals that its owner or an admin may make.
  const precise = new Map<string, number>();
  for (const { r } of ciRows) {
    const g = goalFor(r);
    const raw = val(r, 'value');
    if (!g || g.kind === 'milestone' || !raw) continue;
    const n = parseNumber(raw);
    if (n != null && precisionProblem(raw, n, g.decimals)) precise.set(g.id, Math.max(precise.get(g.id) ?? 0, Math.min(3, typedDecimals(raw))));
  }
  const keepPlaces = answerOf('precision', 'Check-ins', 'Value')?.choice === 'keep';
  if (keepPlaces) {
    for (const [gid, places] of precise) {
      const g = work.get(gid)!;
      if (g.kind === 'milestone' || places <= g.decimals || (!create && !canChange(g))) continue;
      work.set(gid, { ...g, decimals: places } as Goal);
      const row = ciRows.find(({ r }) => goalFor(r)?.id === gid)!.row;
      if (!touched.has(gid)) touched.set(gid, { before: s.goals.find((x) => x.id === gid) ?? null, row, sheet: 'Check-ins', reason: '', plan: false });
    }
  }
  const placesAnswer = ANSWERS.precision(Math.max(0, ...precise.values()), precise.size);

  /* ---------- goals: what changed, and the reasons plan changes need ---------- */
  const lookup = lookupNow();
  const goalOut = new Map<string, Goal>();
  let needsReason = false;
  for (const [id, t] of touched) {
    const after = work.get(id)!;
    const ch = goalChange(t.before, after, lookup, actor.id, now, newId('chg'));
    if (!ch) { same(t.sheet); continue; }
    // Rows for other people's goals are fine as long as they don't change anything (a full workbook carries them all).
    if (t.before && !canChange(t.before)) {
      if (answerOf('not-allowed', t.sheet)?.choice === 'leave') { leave(t.sheet, t.row); continue; }
      raise('not-allowed', t.sheet, t.row, t.before.title, notYours(t.before), { answers: ANSWERS.leaveOnly });
      continue;
    }
    const needs = !!t.before && t.plan && planChanged(t.before, after) && started(id);
    const reason = t.reason || input.reason?.trim() || '';
    if (needs && !reason) needsReason = true;
    if (needs && reason) ch.diffs.push({ field: 'Why', from: '—', to: reason });
    // A direction flip or a number far outside the old plan is asked, never saved silently (goal planQuestion).
    const q = planQuestion(t.before, after);
    if (q && !input.confirm) {
      const a = answerOf('plan-question', t.sheet, '', q.code);
      if (a?.choice === 'leave') { leave(t.sheet, t.row); continue; }
      if (!a) raise('plan-question', t.sheet, t.row, after.title, q.text, { found: q.code, answers: ANSWERS.planQuestion(q.confirm) });
    }
    goalOut.set(id, after);
    changes.push(ch);
    // Every question this row asks (goal entry, rule 3), said on its item: the preview's and the tools' questions.
    const asked = issues.filter((x) => x.sheet === t.sheet && x.row === t.row && x.level === 'check' && GOAL_QUESTION.includes(x.kind)).map((x) => ({ id: x.kind === 'plan-question' ? (x.found === 'direction' ? 'direction' : 'far-from-plan') : x.kind === 'no-unit' || !x.found || x.kind === 'feeds-lower' ? x.kind : x.found, field: x.column ?? 'Goal', text: x.message }));
    items.push({ sheet: t.sheet, row: t.row, goalId: id, goal: after.title, kind: !t.before ? 'new goal' : needs || (t.plan && planChanged(t.before, after)) ? 'plan' : 'goal', summary: ch.summary, diffs: ch.diffs, needsReason: needs, ...(q ? { question: { text: q.text, confirm: q.confirm } } : {}), ...(asked.length ? { questions: asked } : {}) });
  }

  /* ---------- check-ins ---------- */
  const ciOut: CheckIn[] = [];
  // What each check-in written replaced (null: it's new), so the import can be undone (domain/removal undoImport).
  const ciBefore = new Map<string, CheckIn | null>();
  // Stages a new goal's row said were done (C4): one check-in in the week of the latest, as set-up records them.
  for (const x of doneAtSetUp) {
    const g = goalOut.get(x.goalId);
    if (!g) continue;
    const c = stagesDoneAtSetUp(g, x.stageIds, actor.id, now, newId('ci'));
    if (!c) continue;
    const ch = checkInChange(null, c, g, actor.id, newId('chg'));
    ciBefore.set(c.id, null);
    ciOut.push(c);
    if (ch) { changes.push(ch); items.push({ sheet: 'Goals', row: x.row, goalId: g.id, goal: g.title, kind: 'check-in', summary: ch.summary, diffs: ch.diffs, backfilled: c.week < week }); }
  }
  // This file's check-ins so far, by goal: later weeks are judged with the earlier ones.
  const imported = new Map<string, CheckIn[]>();
  // One goal and week on two rows (C14), or one check-in's ID twice: every row named, none applied, unless answered.
  // A goal named one letter out and answered ("Use …", or one chosen) is that goal here too, so two rows for it in one
  // week are caught (IM2 review): the answer is read without raising anything.
  const answeredGoal = (r: Rec): Goal | undefined => {
    const v = val(r, 'goal');
    if (!v || val(r, 'goal key') || val(r, 'goal id')) return undefined;
    const a = answerOf('near-ref', 'Check-ins', 'Goal', v) ?? answerOf('unknown-ref', 'Check-ins', 'Goal', v);
    if (a?.choice === 'use') { const all = [...work.values()]; const m = near(v, all.map((g) => g.title)); return 'near' in m ? all.find((g) => g.title === m.near) : undefined; }
    if (a?.choice === 'choose' && a.value) return goalByRef(normalKey(a.value) ?? a.value) ?? byTitle(a.value);
    return undefined;
  };
  const skipCheckIns = twice('Check-ins', ciRows.map(({ r, row }) => {
    const g = goalFor(r) ?? answeredGoal(r);
    const w = weekCell(val(r, 'week'), 'Check-ins', row, '', false).n;
    const cid = create ? '' : val(r, 'id');
    return { row, name: g?.title ?? val(r, 'goal'), id: cid ? 'c:' + cid : g && w != null ? `${g.id}:${w}` : '' };
  }), (x) => `“${x.name}” has the same week on rows ${x.list}. Give each goal one row a week.`, 'Week');
  // Check-ins that replace one someone else posted: said on the change; from ten in one file, asked once (C18).
  const replacing: { row: number; ci: CheckIn; name: string }[] = [];
  // Oldest first, so each week is judged with the weeks before it.
  const rows = [...ciRows].sort((a, b) => (goalFor(a.r)?.id ?? '').localeCompare(goalFor(b.r)?.id ?? '') || (parseNumber(val(a.r, 'week')) ?? 0) - (parseNumber(val(b.r, 'week')) ?? 0));
  // How one check-in is judged and written, whether a sheet's row or a screen's post (rule 13): one way to save.
  type Judged = { g: Goal; w: number; row: number; existing: CheckIn | null; ctx: CheckIn[]; prev: CheckIn | null; draft: Draft; post?: CheckInPost; again?: boolean; reason?: string };
  const judge = ({ g, w, row, existing, ctx, prev, draft, post, again, reason = '' }: Judged): void => {
    // A row that says what's already there is left alone: history that hasn't changed isn't judged again. Every column
    // that can be changed is compared, so a change to any of them counts.
    if (existing && sameCheckIn(existing, draft, g)) {
      if (post) { raise('cant-change', 'Check-ins', row, g.title, `Nothing is different from what week ${w} already says.`); return; }
      same('Check-ins'); imported.set(g.id, [...(imported.get(g.id) ?? []), existing]); return;
    }
    // A goal this file stops or deletes keeps its check-ins as they are: a whole workbook carries them unchanged.
    const removing = removals.find((x) => x.g.id === g.id);
    if (removing) { raise('cant-change', 'Check-ins', row, g.title, `This file also says ${GOAL_ACTION_WORDS.word[removing.how]} for “${g.title}”, so its check-ins can’t change in it. Make the change, or the ${GOAL_ACTION_WORDS.word[removing.how].toLowerCase()}, on its own.`); return; }
    // Check-ins are the owner's (R1; goalRights mayPostCheckIn): an admin may bring others' in only from a workbook.
    if (!create && !mayPostCheckIn({ id: actor.id, admin: admin() }, g, via)) {
      if (!post && answerOf('not-allowed', 'Check-ins')?.choice === 'leave') { leave('Check-ins', row); return; }
      raise('not-allowed', 'Check-ins', row, g.title, `Only ${people.get(g.ownerId)?.name ?? 'its owner'} (its owner) can check in on “${g.title}”.`, post ? {} : { answers: ANSWERS.leaveOnly });
      return;
    }
    // A screen's post answers what it was asked first (rule 2): an unlikely number is never posted unanswered.
    const asked = post ? checkInLevels(g, w, draft, ctx).checks : [];
    const open = unanswered(asked, draft.answers);
    if (open.length) { raise('checkin-incomplete', 'Check-ins', row, g.title, `${open[0]!.question} Answer it first.`); return; }
    if (!post && !TYPED_ON_SCREEN.includes(via) && g.kind !== 'milestone' && commaDecimal(draft.value) && ask('decimal-comma', 'Check-ins', row, g.title, `“${draft.value}” was read as ${parseNumber(draft.value)}: a comma as the decimal mark.`, { answers: ANSWERS.sure, suggest: String(parseNumber(draft.value)), found: '' }) === 'leave') return;
    // A week before the plan was changed is judged against the plan that applied then.
    const asOf: Goal = goalAsOf(g, w);
    const e = evaluate(asOf, cycle, w, draft, ctx);
    // Setting up from another workspace's export, its history is a record: a past week whose account the new plan would
    // ask more of (a cause and a why) is taken as it was written, as long as it says what every check-in must (a path
    // back when the call is behind, a reason when the call is better than the numbers). Its number has to be a number.
    const recorded = create && w < week && !e.canPost && e.codes.every((c) => c === 'reason-behind' || c === 'reason-ahead' || c === 'target' || c === 'path' || c === 'greener-why')
      ? asWritten(asOf, w, draft, e, actor.id, now, 'probe') : null;
    const asRecorded = !!recorded && keepsTheRules(recorded);
    if (asRecorded) note('as-recorded', 'Check-ins', row, g.title, `Week ${w} is taken as it was recorded.`);
    if (!e.canPost && !asRecorded) {
      // The same codes the check-in screens read, said in the spreadsheet's own column names.
      const hint: Record<Missing, string> = {
        value: 'a Value', 'value-not-number': 'a number in Value', 'value-precision': 'a Value at the goal’s decimal places', 'value-impossible': 'a possible Value',
        'greener-why': `Why greener (the call is ${lower(FLAG.greener)})`,
        'reason-behind': `a Cause and a Why of ${MIN_REASON} characters or more (it’s behind plan)`, 'reason-ahead': `a Cause and a Why of ${MIN_REASON} characters or more (it’s ahead of plan)`,
        path: `a Path to green and, if it’s a plan, Back on plan by week (after week ${w}, by week ${cycle.weeks})`,
        'story-unchanged': MISSING_TEXT['story-unchanged'],
        target: MISSING_TEXT.target,
      };
      // A number that can't be used gets the same words as on screen: the one number check (deep review U10).
      const first = e.codes[0];
      const typedValue = g.kind !== 'milestone' && first && first !== 'value' && VALUE_CODES.includes(first) ? valueProblem(draft.value, null, g.unit, g)?.text ?? null : null;
      if (typedValue) {
        const k: IssueKind = first === 'value-precision' ? 'precision' : first === 'value-not-number' ? 'not-a-number' : 'impossible-number';
        raise(k, 'Check-ins', row, g.title, `Week ${w}: ${typedValue}`, { column: 'Value', ...(k === 'precision' && precise.size && !post ? { answers: placesAnswer } : {}) });
      } else if (first === 'value') raise('required-empty', 'Check-ins', row, g.title, `Week ${w} needs a Value.`, { column: 'Value' });
      else raise('checkin-incomplete', 'Check-ins', row, g.title, `Week ${w} needs ${e.codes.map((c) => hint[c]).join('; ')}.`, { found: e.codes.map((c) => hint[c]).join('; ') });
      return;
    }
    // A number that looks unlikely (far from the last, far outside the plan, over 100%, past the target) is asked (C6).
    if (!post && !create && g.kind !== 'milestone' && ASKS_NUMBERS.includes(via)) {
      const soft = valueProblem(draft.value, prev?.value ?? null, g.unit, g);
      if (soft && !soft.block && ask('odd-number', 'Check-ins', row, g.title, `Week ${w}: ${soft.text}`, { column: 'Value', found: oddKind(soft.text), answers: ANSWERS.odd, value: String(draft.value) }) === 'leave') return;
    }
    // A correction from a screen keeps the time and the lateness of what it replaces: it is never an on-time check-in of
    // its own, and never takes one away (rule 12).
    const keeps = post?.mode === 'correct' && existing;
    const backfilled = keeps ? !!existing.backfilled : w < week;
    const due = new Date(Date.parse(weekDate(cycle, w) + 'T09:00:00Z') + cycle.reviewDay * 86_400_000);
    const at = keeps ? new Date(existing.postedAt) : backfilled && due.toISOString() < now ? due : new Date(now);
    const made = asRecorded ? asWritten(asOf, w, draft, e, actor.id, at.toISOString(), existing?.id ?? newId('ci')) : toCheckIn(asOf, cycle, w, draft, ctx, actor.id, at, existing?.id ?? newId('ci'));
    const c: CheckIn = { ...made, ...(backfilled ? { backfilled: true } : {}) };
    const ch = checkInChange(existing, c, g, actor.id, newId('chg'));
    if (!ch) { same('Check-ins'); return; }
    if (again) ch.summary = ch.summary.replace('Checked in for week', 'Checked in again for week');
    ch.diffs.push(...answeredDiffs(asked, draft.answers));
    if (post?.mode === 'correct') {
      ch.summary = existing ? `Corrected week ${w}: ${headlineOf(existing, g)} is now ${headlineOf(c, g)}` : `Added week ${w} later: ${headlineOf(c, g)}`;
      ch.diffs.unshift({ field: 'Why corrected', from: '—', to: reason });
    }
    if (existing && existing.authorId !== actor.id && !post) {
      note('replaces', 'Check-ins', row, g.title, `Replaces ${people.get(existing.authorId)?.name ?? 'someone'}’s check-in for week ${w}.`);
      replacing.push({ row, ci: c, name: g.title });
    }
    ch.at = now;
    if (backfilled && !post) ch.summary += ' (loaded later)';
    ciBefore.set(c.id, existing);
    ciOut.push(c);
    imported.set(g.id, [...(imported.get(g.id) ?? []), c]);
    changes.push(ch);
    items.push({ sheet: 'Check-ins', row, goalId: g.id, goal: g.title, kind: existing ? 'replaces check-in' : 'check-in', summary: ch.summary, diffs: ch.diffs, backfilled });
  };
  for (const { r, row } of rows) {
    if (skipCheckIns.has(row)) continue;
    const refText = val(r, 'goal key') || val(r, 'goal id');
    const clash = refText ? goalOfRow(val(r, 'goal key'), val(r, 'goal id')).problem : undefined;
    if (clash) { raise('cant-change', 'Check-ins', row, val(r, 'goal') || refText, clash.replace(/^Key/, 'Goal key'), { column: 'Goal key' }); continue; }
    const name = val(r, 'goal') || refText;
    let g = goalFor(r);
    const stopped = !g ? (stoppedByRef(val(r, 'goal key')) ?? stoppedByRef(val(r, 'goal id')) ?? (s.archive?.goals ?? []).find((x) => fold(x.title) === fold(val(r, 'goal')))) : undefined;
    if (stopped) { leftAlone('Check-ins', row, stopped); continue; }
    if (!g && refText) { raise('bad-key', 'Check-ins', row, name, `There’s no goal with ${val(r, 'goal key') ? `key ${val(r, 'goal key')}` : `ID ${refText}`}.`, { column: val(r, 'goal key') ? 'Goal key' : 'Goal ID', found: refText }); continue; }
    if (!g) {
      if (!val(r, 'goal')) { raise('required-empty', 'Check-ins', row, '', 'Say which goal: Goal key, or Goal.', { column: 'Goal key' }); continue; }
      g = goalNamed('Check-ins', row, name, 'Goal', val(r, 'goal'), '', `There’s no goal called “${val(r, 'goal')}”. Add the Goal key column to be exact.`, `There’s no goal called “${val(r, 'goal')}” that only one goal has. Add the Goal key column to be exact.`);
      if (!g) continue;
    }
    const weekRaw = val(r, 'week');
    const read = weekRaw ? weekCell(weekRaw, 'Check-ins', row, g.title) : { n: null };
    if (read.problem) { raise('week-wrong', 'Check-ins', row, g.title, read.problem, { column: 'Week' }); continue; }
    const w = read.n;
    if (w == null || !Number.isInteger(w) || w < 1) { raise(weekRaw ? 'week-wrong' : 'required-empty', 'Check-ins', row, g.title, w === 0 ? 'Check-ins start in week 1; week 0 is the start of the year.' : 'Week should be a whole number from 1, counted from the start of the year.', { column: 'Week' }); continue; }
    if (w > week) { raise('week-wrong', 'Check-ins', row, g.title, `Week ${w} hasn’t happened yet; it’s week ${week}.`, { column: 'Week' }); continue; }
    // The check-in's own ID, when the row has one, says exactly which check-in it is: it never changes, nor does its goal
    // or week. Set-up starts afresh: another workspace's IDs mean nothing here.
    const cid = create ? '' : val(r, 'id');
    const byId = cid ? s.checkIns.find((c) => c.id === cid) : undefined;
    if (cid && (!byId || byId.goalId !== g.id)) { raise('bad-key', 'Check-ins', row, g.title, `There’s no check-in with ID ${cid} on this goal. Leave ID empty to add a check-in.`, { column: 'ID', found: cid }); continue; }
    if (byId && byId.week !== w) { raise('cant-change', 'Check-ins', row, g.title, `Check-in ${cid} is for week ${byId.week}; a check-in’s week can’t change.`, { column: 'Week' }); continue; }

    // A row for a week corrects that week's latest check-in (a spreadsheet has one row per goal and week). Columns the
    // row leaves out (a table showing only some) keep what that check-in says.
    const existing = byId ?? checkInsFor(g, s.checkIns).filter((c) => c.week === w).pop() ?? null;
    const ctx = [...checkInsFor(g, s.checkIns).filter((c) => c.week !== w), ...(imported.get(g.id) ?? [])];
    const prev = checkInsFor(g, ctx).filter((c) => c.week < w).pop() ?? null;
    let stages: StageUpdate[] = [];
    if (g.kind === 'milestone') {
      const goal = g;
      stages = has(r, 'stages') || !existing?.stages
        ? goal.stages.map((st) => prev?.stages?.find((u) => u.stageId === st.id) ?? { stageId: st.id, doneWeek: null, forecastWeek: null })
        : existing.stages;
      let bad = false;
      for (const part of (has(r, 'stages') ? val(r, 'stages') : '').split(/;|\n/).map((x) => x.trim()).filter(Boolean)) {
        const m = /^(.*?):\s*(done|expected|due)\s*(?:week|wk)?\s*(\d+)$/i.exec(part);
        let st = m ? goal.stages.find((x) => fold(x.name) === fold(m[1]!)) : undefined;
        if (m && !st) {
          // A stage's name one letter out is asked about, as any name is (C7).
          const hit = near(m[1]!, goal.stages.map((x) => x.name));
          const nearOne = 'near' in hit ? goal.stages.find((x) => x.name === hit.near) : undefined;
          const a = nearOne ? answerOf('near-ref', 'Check-ins', 'Stages', m[1]!) : undefined;
          if (nearOne && a?.choice === 'use') st = nearOne;
          else if (nearOne && a?.choice === 'leave') { leave('Check-ins', row); bad = true; break; }
          else if (nearOne) { raise('near-ref', 'Check-ins', row, goal.title, `“${m[1]}” isn’t a stage of “${goal.title}”. Did you mean ${nearOne.name}?`, { column: 'Stages', found: m[1]!, suggest: nearOne.name, answers: ANSWERS.nearRef(nearOne.name, m[1]!, false, false).filter((x) => x.choice !== 'choose') }); bad = true; break; }
        }
        if (!m || !st) { raise('stage-format', 'Check-ins', row, goal.title, `Stages: “${part}” should look like “Pilot: done week 6” or “Pilot: expected week 8”, using the stage’s name.`, { column: 'Stages' }); bad = true; break; }
        const n = Number(m[3]);
        const sid = st.id;
        stages = stages.map((u) => (u.stageId !== sid ? u : m[2]!.toLowerCase() === 'done' ? { ...u, doneWeek: n, forecastWeek: null } : m[2]!.toLowerCase() === 'expected' ? { ...u, doneWeek: null, forecastWeek: n } : { ...u, doneWeek: null, forecastWeek: null }));
      }
      if (bad) continue;
    }
    const call = readWord(CALL_WORDS, val(r, 'call'), 'Check-ins', row, g.title, ', or leave it empty to let the rules decide');
    if (call === undefined) continue;
    const cause = has(r, 'cause') ? readWord(CAUSE_WORDS, val(r, 'cause'), 'Check-ins', row, g.title) : existing?.cause ?? null;
    if (cause === undefined) continue;
    // Where the owner is with recovery: the row's word, else the old record's, but only when the row gives no week either.
    // A row that gives "Back on plan by week" is a plan, so the week is kept (K6: a correction took the old state and lost it).
    const givesWeek = has(r, 'back on plan by week') && !!val(r, 'back on plan by week');
    const rec = has(r, 'recovery') ? readWord(RECOVERY_WORDS, val(r, 'recovery'), 'Check-ins', row, g.title) : givesWeek ? null : existing?.pathToGreen?.state ?? null;
    if (rec === undefined) continue;
    const pick = (col: string, was: string | null | undefined) => (has(r, col) ? val(r, col) : (was ?? '').trim());
    const byRaw = has(r, 'back on plan by week') ? val(r, 'back on plan by week') : '';
    const by = has(r, 'back on plan by week') ? (byRaw ? weekCell(byRaw, 'Check-ins', row, g.title).n : null) : existing?.pathToGreen?.byWeek ?? null;
    if (byRaw && by == null) { raise('week-wrong', 'Check-ins', row, g.title, `Back on plan by week: “${byRaw}” isn’t a week.`, { column: 'Back on plan by week' }); continue; }
    const valueRaw = g.kind === 'milestone' ? '' : has(r, 'value') ? val(r, 'value') : existing?.value != null ? String(existing.value) : '';
    if (g.kind !== 'milestone' && isFormula(valueRaw)) { raise('formula', 'Check-ins', row, g.title, `Value holds a formula (“${valueRaw}”), not a number. In Excel, copy the column and paste it as values.`, { column: 'Value' }); continue; }
    const draft: Draft = {
      value: valueRaw,
      stages, status: call, cause: cause ?? null,
      why: pick('why', existing?.why), greenerWhy: pick('why greener', existing?.greenerWhy), proposeTarget: '',
      ptgWhat: pick('path to green', existing?.pathToGreen?.what), ptgBy: by, ptgState: rec ?? 'plan', needs: pick('needs', existing?.pathToGreen?.needs),
      next: has(r, 'next step') ? val(r, 'next step') : has(r, 'next') ? val(r, 'next') : (existing?.next ?? '').trim(), dataFlagged: false,
    };
    judge({ g, w, row, existing, ctx, prev, draft });
  }
  // Check-ins posted from a screen (rule 13): the same judgement, with the mode saying how each meets its week's.
  for (const [i, p] of (input.posts ?? []).entries()) {
    const row = i + 1;
    const g = work.get(p.goalId) ?? s.goals.find((x) => x.id === p.goalId);
    if (!g) { raise('bad-key', 'Check-ins', row, p.goalId, 'That goal no longer exists. Reload to see the latest.'); continue; }
    const w = p.week;
    if (!Number.isInteger(w) || w < 1) { raise('week-wrong', 'Check-ins', row, g.title, 'Check-ins start in week 1; week 0 is the start of the year.'); continue; }
    if (w > week) { raise('week-wrong', 'Check-ins', row, g.title, `Week ${w} hasn’t happened yet; it’s week ${week}.`); continue; }
    const own = checkInsFor(g, s.checkIns);
    const newest = own.filter((c) => c.week === w).pop() ?? null;
    if (p.mode !== 'correct' && w < week) { raise('week-wrong', 'Check-ins', row, g.title, `Week ${w} has passed. Correct it, or add it, with a reason.`); continue; }
    if (p.mode === 'new' && newest) { raise('cant-change', 'Check-ins', row, g.title, `Week ${w} already has a check-in. Check in again, or correct it.`); continue; }
    const reason = (p.reason ?? '').trim();
    if (p.mode === 'correct' && reason.length < MIN_CORRECT_REASON) { raise('required-empty', 'Check-ins', row, g.title, `Say why, in a sentence, so anyone reading week ${w} later knows.`); continue; }
    const ctx = [...own.filter((c) => c.week !== w), ...(imported.get(g.id) ?? [])];
    judge({ g, w, row, existing: p.mode === 'correct' ? newest : null, ctx, prev: checkInsFor(g, ctx).filter((c) => c.week < w).pop() ?? null, draft: p.draft, post: p, again: p.mode === 'again' && !!newest, reason });
  }
  // Ten or more check-ins other people posted, replaced by one file: asked once (C18).
  if (replacing.length >= 10 && !create) {
    const a = answerOf('replaces-others', 'Check-ins');
    if (a?.choice === 'leave') {
      const ids = new Set(replacing.map((x) => x.ci.id));
      for (const x of replacing) leave('Check-ins', x.row);
      for (let k = ciOut.length - 1; k >= 0; k--) if (ids.has(ciOut[k]!.id)) ciOut.splice(k, 1);
      for (let k = items.length - 1; k >= 0; k--) if (items[k]!.sheet === 'Check-ins' && replacing.some((x) => x.row === items[k]!.row)) items.splice(k, 1);
      for (let k = changes.length - 1; k >= 0; k--) if (changes[k]!.entity === 'check-in' && ids.has(changes[k]!.entityId)) changes.splice(k, 1);
    } else if (!a) for (const x of replacing) raise('replaces-others', 'Check-ins', x.row, x.name, `${plural(replacing.length, 'row')} replace check-ins other people posted.`, { answers: ANSWERS.replaces });
  }

  /* ---------- asks: a goal's latest check-in raises, continues or withdraws its ask, as in the app (domain/asks) ---------- */
  const reqOut = new Map<string, Ask>();
  const requestsNow = () => [...(s.requests ?? []).filter((x) => !reqOut.has(x.id)), ...reqOut.values()];
  for (const c of ciOut) {
    const later = s.checkIns.some((x) => x.goalId === c.goalId && x.week > c.week) || ciOut.some((x) => x.goalId === c.goalId && x.week > c.week);
    const g = work.get(c.goalId);
    if (later || !g) continue;
    const r = requestsAfterCheckIn(g, c, { ...s, people: [...people.values()], requests: requestsNow() }, actor.id, now, newId);
    for (const x of r.requests) reqOut.set(x.id, x);
    changes.push(...r.changes);
  }

  /* ---------- people and teams: what changed ---------- */
  const peopleOut = new Map<string, Person>();
  const teamName = (tid: string) => teams.get(tid)?.name ?? '';
  for (const [id, t] of peopleTouched) {
    const after = people.get(id)!;
    const ch = personChange(t.before, after, teamName, actor.id, now, newId('chg'));
    if (!ch) continue;
    peopleOut.set(id, after);
    changes.push(ch);
    items.push({ sheet: 'People', row: t.row, goalId: '', goal: after.name, kind: t.before ? 'person' : 'new person', summary: ch.summary, diffs: ch.diffs });
  }
  const teamsOut = new Map<string, Team>();
  for (const [id, t] of teamsTouched) {
    const after = teams.get(id)!;
    teamsOut.set(id, after);
    if (create) continue;
    // A team an admin's file adds (C8), or a team objective changed.
    const added = !t.before;
    const summary = added ? `Added the team “${after.name}”` : `Changed the objective of the team “${after.name}”`;
    const diffs = added ? [{ field: 'Team', from: '—', to: after.name }] : [{ field: 'Team objective', from: t.before?.objective || '—', to: after.objective || '—' }];
    changes.push({ id: newId('chg'), at: now, actorId: actor.id, goalId: null, entity: 'workspace', entityId: id, action: added ? 'created' : 'edited', summary, diffs });
    items.push({ sheet: 'People', row: t.row, goalId: '', goal: after.name, kind: 'team', summary, diffs });
  }

  /* ---------- a row's Action: stop or delete a goal, mark someone as left, with the app's own rules ---------- */
  // Checked in the same pass as every other row (C11), against the workspace as it would be without the faulty rows.
  const reviewsOut = new Map<string, Review>();
  const reviewsBefore = new Map<string, Review>();
  if (removals.length || leaving.length) {
    const xOf = (): ActionContext => ({
      snapshot: { ...s, people: [...people.values()], teams: [...teams.values()], goals: [...work.values()], checkIns: [...s.checkIns.filter((c) => !ciOut.some((o) => o.id === c.id)), ...ciOut], requests: requestsNow(), reviews: s.reviews.map((v) => reviewsOut.get(v.id) ?? v) },
      cycle, week, actor, now, newId, ...(input.full ? { full: input.full, allGoals: input.full.goals } : {}),
    });
    const merge = (c: Commit) => {
      for (const g of c.goals ?? []) {
        if (!touched.has(g.id)) touched.set(g.id, { before: s.goals.find((x) => x.id === g.id) ?? null, row: 0, sheet: 'Goals', reason: '', plan: false });
        work.set(g.id, g);
        goalOut.set(g.id, g);
      }
      for (const r of c.requests ?? []) reqOut.set(r.id, r);
      for (const p of c.people ?? []) { if (!peopleTouched.has(p.id)) peopleTouched.set(p.id, { before: s.people.find((x) => x.id === p.id) ?? null, row: 0 }); people.set(p.id, p); peopleOut.set(p.id, p); }
      for (const v of c.reviews ?? []) { if (!reviewsBefore.has(v.id)) reviewsBefore.set(v.id, s.reviews.find((x) => x.id === v.id)!); reviewsOut.set(v.id, v); }
      for (const t of c.teams ?? []) { if (!teamsTouched.has(t.id)) teamsTouched.set(t.id, { before: s.teams.find((x) => x.id === t.id) ?? null, row: 0 }); teams.set(t.id, t); teamsOut.set(t.id, t); }
      changes.push(...c.changes);
    };
    for (const x of removals) {
      try {
        const c = x.how === 'stop' ? stopGoal(xOf(), x.g.id, x.reason) : deleteGoal(xOf(), x.g.id);
        merge(c);
        items.push({ sheet: 'Goals', row: x.row, goalId: x.g.id, goal: x.g.title, kind: x.how === 'stop' ? 'stop goal' : 'delete goal', summary: c.changes[0]!.summary, diffs: c.changes[0]!.diffs });
      } catch (e) {
        if (!(e instanceof NotAllowed)) throw e;
        raise('removal-refused', 'Goals', x.row, x.g.title, e.message, { column: 'Action' });
      }
    }
    for (const l of leaving) {
      if (removalRows.length >= 5 && ask('big-removal', 'People', l.row, l.person.name, bigRemoval(), { column: 'Action', answers: ANSWERS.sure }) === 'leave') continue;
      try {
        const c = markPersonLeft(xOf(), l.person.id, { goalsTo: l.to.id === l.person.id ? null : l.to.id, asksTo: l.to.id === l.person.id ? null : l.to.id });
        merge(c);
        items.push({ sheet: 'People', row: l.row, goalId: '', goal: l.person.name, kind: 'person left', summary: c.changes[0]!.summary, diffs: c.changes[0]!.diffs });
      } catch (e) {
        if (!(e instanceof NotAllowed)) throw e;
        raise('removal-refused', 'People', l.row, l.person.name, e.message.replace(/choose who takes (them|it) over/, 'say who takes them over in Takes over'), { column: 'Takes over' });
      }
    }
  }

  // A check-in posted from its own screen is no import: no Via mark, and no import to undo unless it corrects a week (rule 8).
  if (via !== 'form') for (const ch of changes) ch.diffs.push({ field: 'Via', from: '—', to: VIA_LABEL[via] });
  const corrects = (input.posts ?? []).some((p) => p.mode === 'correct');
  // Issues carry their row, in the file's order (C13): by sheet, then row. Groups (rule 6) gather them by kind.
  issues.sort((a, b) => SHEET_ORDER.indexOf(a.sheet) - SHEET_ORDER.indexOf(b.sheet) || a.row - b.row);
  const counts = {
    newGoals: items.filter((x) => x.kind === 'new goal').length,
    goals: items.filter((x) => x.kind === 'goal').length,
    plans: items.filter((x) => x.kind === 'plan').length,
    checkIns: items.filter((x) => x.kind === 'check-in' || x.kind === 'replaces check-in').length,
    backfilled: items.filter((x) => x.backfilled).length,
    replaced: items.filter((x) => x.kind === 'replaces check-in').length,
    people: items.filter((x) => x.kind === 'person').length,
    newPeople: items.filter((x) => x.kind === 'new person').length,
    teams: items.filter((x) => x.kind === 'team').length,
    stopped: items.filter((x) => x.kind === 'stop goal').length,
    deleted: items.filter((x) => x.kind === 'delete goal').length,
    left: items.filter((x) => x.kind === 'person left').length,
  };
  const needsConfirm = issues.some((x) => x.kind === 'plan-question');
  // Saved only with no Must fix and every Check answered (rule 7), a reason where one is needed, and something to save.
  const ok = !issues.some((x) => x.level === 'must' || x.level === 'check') && !needsReason && items.length > 0;
  const result: ChangeSet = { items, unchanged, unchangedBy, examples, issues, groups: groupIssues(issues), leftOut, needsReason, needsConfirm, commit: null, counts };
  // New goals before the goals that feed into them, so each link points at a goal that's already saved.
  const ordered: Goal[] = [];
  const pending = [...goalOut.values()];
  while (pending.length) {
    const i = pending.findIndex((g) => !g.parentId || !pending.some((x) => x.id === g.parentId));
    ordered.push(...pending.splice(i < 0 ? 0 : i, 1));
  }
  if (create) {
    result.created = { people: [...people.values()], teams: [...teams.values()], goals: ordered, checkIns: ciOut, requests: [...reqOut.values()], keysIssued: lastKeyGiven };
    return result;
  }
  if (ok && via === 'form' && !corrects) {
    result.commit = { goals: ordered, checkIns: ciOut, ...(reqOut.size ? { requests: [...reqOut.values()] } : {}), changes };
  } else if (ok) {
    const sumId = newId('chg');
    const importId = newId('imp');
    // Every row's change carries the import's id, and the summary keeps what each record was before, so "Undo this
    // import" can put every row back (domain/removal undoImport).
    for (const ch of changes) ch.importId = importId;
    const requestsBefore = asksOf(s);
    const summary: Change = {
      id: sumId, at: now, actorId: actor.id, goalId: null, entity: 'workspace', entityId: importId, action: 'imported', importId,
      summary: `${via === 'spreadsheet' ? 'Loaded a spreadsheet' : via === 'mcp' ? 'Changes via MCP' : via === 'table' ? 'Edited the data tables' : via === 'form' ? 'Corrected a check-in' : 'Bulk edit'}: ${describe(result).toLowerCase()}`, diffs: via === 'form' ? [] : [{ field: 'Via', from: '—', to: VIA_LABEL[via] }, ...fileDiffs(input.file, items.length, unchanged, leftOut.length)],
      undo: {
        goals: ordered.map((g) => ({ id: g.id, before: touched.get(g.id)?.before ?? null })),
        checkIns: ciOut.map((c) => ({ id: c.id, before: ciBefore.get(c.id) ?? null })),
        people: [...peopleOut.values()].map((p) => ({ id: p.id, before: s.people.find((x) => x.id === p.id) ?? null })),
        requests: [...reqOut.values()].map((r) => ({ id: r.id, before: requestsBefore.find((x) => x.id === r.id) ?? null })),
        ...(reviewsOut.size ? { reviews: [...reviewsOut.keys()].map((id) => ({ id, before: reviewsBefore.get(id) ?? null })) } : {}),
        ...(teamsOut.size ? { teams: [...teamsOut.keys()].map((id) => ({ id, before: s.teams.find((x) => x.id === id) ?? null })) } : {}),
      },
    };
    result.commit = {
      ...(peopleOut.size ? { people: [...peopleOut.values()] } : {}),
      ...(teamsOut.size ? { teams: [...teamsOut.values()] } : {}),
      goals: ordered, checkIns: ciOut,
      ...(reqOut.size ? { requests: [...reqOut.values()] } : {}),
      ...(reviewsOut.size ? { reviews: [...reviewsOut.values()] } : {}),
      changes: [...changes, summary],
    };
  }
  return result;
}

/**
 * Whether a row's name for a goal looks like another goal's (C5): no word of four letters or more in common, and not one
 * letter out. A goal renamed keeps a word or two ("Lead time for changes" → "Lead time to production"), so isn't asked.
 */
function unrelated(a: string, b: string): boolean {
  const words = (s: string) => new Set(fold(s).split(' ').filter((w) => w.length >= 4));
  const wa = words(a), wb = words(b);
  return ![...wa].some((w) => wb.has(w)) && !('near' in near(a, [b])) && fold(a) !== fold(b);
}

/**
 * Post one check-in from a screen (check-in spec, rule 13): through the same engine as the table, the import and the AI
 * tools, so a check-in is judged and written one way. Refuses, in the engine's words, what the engine refuses.
 */
export function postCheckIn(x: Pick<ActionContext, 'snapshot' | 'cycle' | 'week' | 'actor' | 'now' | 'newId' | 'full'>, post: CheckInPost): { commit: Commit; checkIn: CheckIn } {
  const set = planChanges({ tables: {}, posts: [post], snapshot: x.snapshot, cycle: x.cycle, week: x.week, actor: x.actor, now: x.now, newId: x.newId, via: 'form', ...(x.full ? { full: x.full } : {}) });
  const problem = set.issues.find((i) => i.level === 'must' || i.level === 'check');
  if (problem || !set.commit) throw new NotAllowed(problem?.message ?? 'That check-in can’t be saved yet.');
  return { commit: set.commit, checkIn: set.commit.checkIns!.find((c) => c.goalId === post.goalId)! };
}

/** A check-in's number in a sentence ("1.9%", "2 of 4 stages done"). */
function headlineOf(c: CheckIn, g: Goal): string {
  if (g.kind === 'milestone') return `${(c.stages ?? []).filter((u) => u.doneWeek != null).length} of ${g.stages.length} stages done`;
  return c.value == null ? 'no number' : fmt(c.value, g);
}

/** Whether a row says what a check-in already says, in every column that can be changed. */
function sameCheckIn(c: CheckIn, d: Draft, g: Goal): boolean {
  const t = (s: string | null | undefined) => (s ?? '').trim();
  const p = c.pathToGreen;
  return (!d.status || c.status === d.status)
    && (g.kind === 'milestone' ? JSON.stringify(c.stages ?? []) === JSON.stringify(d.stages) : c.value === parseNumber(d.value))
    && (c.cause ?? null) === (d.cause ?? null)
    && t(c.why) === t(d.why) && t(c.greenerWhy) === t(d.greenerWhy)
    && t(p?.what) === t(d.ptgWhat) && (p?.byWeek ?? null) === (d.ptgBy ?? null) && t(p?.needs) === t(d.needs)
    && (!t(d.ptgWhat) || (p?.state ?? 'plan') === d.ptgState)
    && t(c.next) === t(d.next);
}

/** A past week's check-in exactly as its row wrote it (set-up from an export): the rules' status and calculation, and
    the owner's own cause, reasons and path back, whether or not the new plan would ask for them. */
function asWritten(g: Goal, week: number, d: Draft, e: ReturnType<typeof evaluate>, authorId: string, at: string, id: string): CheckIn {
  // The workspace it came from judged that week against the plan of its day, which a copy doesn't carry: a call the new
  // plan would call greener, with no reason given, stands as the week's calculation too.
  const rank = (s: Status) => (s === 'off' ? 3 : s === 'risk' ? 2 : 1);
  const calculated = rank(e.status) < rank(e.calc) && !d.greenerWhy.trim() ? e.status : e.calc;
  return {
    id, goalId: g.id, authorId, week, postedAt: at,
    value: g.kind === 'milestone' ? null : parseNumber(d.value), stages: g.kind === 'milestone' ? d.stages : null,
    status: e.status, calculated, cause: d.cause ?? null, why: d.why.trim(), greenerWhy: d.greenerWhy.trim(), proposeTarget: null,
    pathToGreen: d.ptgWhat.trim() ? { what: d.ptgWhat.trim(), byWeek: (d.ptgState ?? 'plan') === 'plan' ? d.ptgBy : null, needs: d.needs.trim(), state: d.ptgState ?? 'plan' } : null,
    next: d.next.trim(), dataFlagged: false,
  };
}

/** What every stored check-in says, whatever the plan (the database checks it too, migrations 0001 and 0007): a path
    back when the call is behind, and a reason when the call is better than the numbers. */
function keepsTheRules(c: CheckIn): boolean {
  const rank = (s: Status) => (s === 'off' ? 3 : s === 'risk' ? 2 : 1);
  const p = c.pathToGreen;
  const wayBack = !['risk', 'off'].includes(c.status) || (!!p && p.what.trim().length >= 8 && ((p.state ?? 'plan') !== 'plan' || (p.byWeek ?? 0) > c.week));
  const greener = rank(c.status) >= rank(c.calculated) || c.greenerWhy.trim().length >= 10;
  return wayBack && greener;
}

/** Initials from a name, as Workspace makes them. */
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).slice(0, 2).join('') || '?';

/** The words a check-in's columns take, for a tool's or a sheet's description. */
export const CALL_CHOICES = oneOf(Object.values(CALL_WORDS.word));
