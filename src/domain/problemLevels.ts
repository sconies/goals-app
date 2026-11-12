/* Kinds, levels and near misses (backlog IM2; docs/design/import/spec.md, section 4 and rules 4, 6 and 7).

   Every problem the change engine (domain/changeset) finds is data: a kind, and a level fixed by its kind.

   - **Must fix** ('must'): Faro can't record it truthfully (a required column empty, a word it doesn't know, a number that
     isn't one). Nothing is saved while one remains, unless its rows are left out.
   - **Check** ('check'): possible but unlikely (a name one letter from one that's here, a stage already past, a number a
     hundred times its start). It's a question: saved once a person has answered it, and one answer covers every row with
     the same question.
   - **Fine, and said** ('note'): how a row was read (an owner matched by name, a type read from the columns filled in).

   Issues group by kind, sheet, column and the value found (folded): fourteen rows naming "Platfrom" are one group, one
   question, one answer. A group's id is stable for the same kind, sheet, column and value, so an answer given to one file
   still applies to the corrected one. The app's preview, the import, Data, the bulk actions, set-up and the MCP tools all
   read these: the goal form (GE2) reads the same levels.

   Pure: no screen, network or database code. */
import { fold as foldAccents } from './find';

/* ---------- near misses (rule 4) ---------- */

/**
 * A name or word as it is compared: lower case, accents off, "&" and "and" the same, punctuation and repeated spaces one
 * space. So "CI CD" is CI/CD, and "Build and Release" is Build & Release.
 */
export const fold = (s: string): string => foldAccents(s).replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Edits between two strings, a swap of two letters counting as one (Damerau, optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

export type NearAnswer = { exact: string } | { near: string } | { none: true };

/**
 * Rule 4. What a typed name or word is among the candidates: the one that folds equal (`exact`); else the one within
 * reach (`near`): one edit for folded lengths under 8, two from 8; else `none`. Never near for a value of one or two
 * characters, nor when two candidates are within reach: that is asked by name, never guessed.
 */
export function near(v: string, candidates: readonly string[]): NearAnswer {
  const f = fold(v);
  if (!f) return { none: true };
  const exact = candidates.find((c) => fold(c) === f);
  if (exact != null) return { exact };
  if (f.length <= 2) return { none: true };
  const reach = f.length < 8 ? 1 : 2;
  const within = [...new Set(candidates)].filter((c) => { const g = fold(c); return Math.abs(g.length - f.length) <= reach && editDistance(f, g) <= reach; });
  const names = [...new Set(within.map(fold))];
  return names.length === 1 ? { near: within[0]! } : { none: true };
}

/* ---------- kinds and levels (section 4) ---------- */

/** What can't be saved as it is. */
export const MUST_KINDS = [
  'required-empty', 'not-a-number', 'formula', 'precision', 'impossible-number', 'unknown-word', 'unknown-ref', 'ambiguous-ref',
  'conflicting-refs', 'bad-key', 'duplicate', 'type-unclear', 'plan-order', 'stage-format', 'week-wrong', 'checkin-incomplete',
  'cant-change', 'not-allowed', 'removal-refused', 'loop',
] as const;
/** What is possible but unlikely: asked, once per group. */
export const CHECK_KINDS = [
  'near-ref', 'near-word', 'near-header', 'new-team', 'same-person', 'same-goal', 'other-goal', 'other-workspace', 'past-stage',
  'past-plan', 'odd-number', 'plan-question', 'no-unit', 'decimal-comma', 'replaces-others', 'many-admins', 'totals-row', 'big-removal',
  'feeds-lower',
] as const;
/** How a row was read: fine, and said on the change. */
export const NOTE_KINDS = ['by-name', 'default', 'date-as-week', 'folded', 'same-name', 'left-alone', 'replaces', 'as-recorded', 'example'] as const;

export type MustKind = (typeof MUST_KINDS)[number];
export type CheckKind = (typeof CHECK_KINDS)[number];
export type NoteKind = (typeof NOTE_KINDS)[number];
export type IssueKind = MustKind | CheckKind | NoteKind;
export type IssueLevel = 'must' | 'check' | 'note';

/** The level is fixed per kind. */
export const levelOf = (kind: IssueKind): IssueLevel => ((MUST_KINDS as readonly string[]).includes(kind) ? 'must' : (CHECK_KINDS as readonly string[]).includes(kind) ? 'check' : 'note');
/** The words each level is said with: never a status shape or colour. */
export const LEVEL_WORD: Record<IssueLevel, string> = { must: 'Must fix', check: 'Check', note: 'Read as' };
/** The level as the older three-way severity, for screens not yet rebuilt on levels (IM3 replaces them). */
export const SEVERITY: Record<IssueLevel, 'error' | 'warning' | 'note'> = { must: 'error', check: 'warning', note: 'note' };

export type Sheet = 'Goals' | 'Plan' | 'Check-ins' | 'People';
export const SHEET_ORDER: Sheet[] = ['Goals', 'Plan', 'Check-ins', 'People'];

/**
 * One way to settle a group in the preview. `choice` is the code an answer carries (`use`, `leave`, `right`…); `label` the
 * words on the button; `needsValue`, a choice that also carries a value (a team, a person, a word chosen from a list);
 * `options`, the values it can take when they are few (a column's words).
 */
export interface Choice { choice: string; label: string; needsValue?: boolean; options?: string[] }

/** An answer to one group (rule 7): its choice, a value for a choice that needs one, and rows not covered by it. */
export interface Answer {
  choice: string;
  value?: string;
  except?: number[];
  /** The cells' own values the answer was given for (an unlikely number's): a different number is asked again. */
  covers?: string[];
}
export type Answers = Record<string, Answer>;

/**
 * A problem with one row (rule 6). `message` is the full sentence for that row (MCP and the rows-to-fix file use it);
 * `column` the column at fault in the sheet's own words, `found` what the cell said, `suggest` the near match offered.
 * `answers`: how its group can be settled in the preview, the suggested one first (none for a fix in the file).
 * `group`: its group's id (groupId). `goal` and `severity` are the older names of `name` and `level`, kept for the
 * screens IM3 rebuilds.
 */
export interface Issue {
  sheet: Sheet;
  row: number;
  /** The record the row is about: a goal's or a person's name, or what the row said. */
  name: string;
  kind: IssueKind;
  level: IssueLevel;
  column?: string;
  found?: string;
  suggest?: string;
  message: string;
  answers?: Choice[];
  /** The cell's own text, where the group's `found` is a kind of value (an unlikely number): what an answer covers. */
  value?: string;
  group: string;
  goal: string;
  severity: 'error' | 'warning' | 'note';
}

/** A group's id: the same for the same kind, sheet, column and value found, so an answer survives a corrected file. */
export const groupId = (kind: IssueKind, sheet: Sheet, column?: string, found?: string): string =>
  [kind, sheet, column ?? '', fold(found ?? '')].map((p) => p.replace(/\s+/g, '-')).join(':').toLowerCase();

/** An issue, with its level and group worked out from its kind. */
export function issueOf(kind: IssueKind, sheet: Sheet, row: number, name: string, message: string, x: { column?: string; found?: string; suggest?: string; answers?: Choice[]; value?: string } = {}): Issue {
  const level = levelOf(kind);
  return {
    sheet, row, name, kind, level, message, group: groupId(kind, sheet, x.column, x.found), goal: name, severity: SEVERITY[level],
    ...(x.column ? { column: x.column } : {}), ...(x.found != null && x.found !== '' ? { found: x.found } : {}), ...(x.suggest ? { suggest: x.suggest } : {}), ...(x.answers?.length ? { answers: x.answers } : {}), ...(x.value != null ? { value: x.value } : {}),
  };
}

/* ---------- the answers each kind takes (section 4's Answer columns) ---------- */

export const LEAVE: Choice = { choice: 'leave', label: 'Leave these rows out' };
export const RIGHT: Choice = { choice: 'right', label: 'They’re right' };
export const ANSWERS = {
  nearRef: (suggest: string, found: string, team: boolean, admin: boolean): Choice[] => [
    { choice: 'use', label: `Use ${suggest}` },
    ...(team && admin ? [{ choice: 'new', label: `Add ${found} as a new team` }] : []),
    { choice: 'choose', label: 'Choose another', needsValue: true },
  ],
  unknownRef: (thing: string, found: string, team: boolean, admin: boolean): Choice[] => [
    { choice: 'choose', label: `Choose a ${thing}`, needsValue: true },
    ...(team && admin ? [{ choice: 'new', label: `Add ${found} as a new team` }] : []),
  ],
  nearWord: (suggest: string, words: string[]): Choice[] => [{ choice: 'use', label: `Read it as ${suggest}` }, { choice: 'choose', label: 'Choose another', needsValue: true, options: words }],
  unknownWord: (words: string[]): Choice[] => [{ choice: 'choose', label: 'Choose from the column’s words', needsValue: true, options: words }],
  duplicate: [{ choice: 'last', label: 'Use the last row for each' }, { choice: 'first', label: 'Use the first' }] as Choice[],
  sameGoal: (key: string): Choice[] => [{ choice: 'new', label: 'They’re new goals' }, { choice: 'same', label: `They’re the same: change ${key}` }, { choice: 'leave', label: 'Leave them out' }],
  otherGoal: [{ choice: 'change', label: 'Yes, change it' }, { choice: 'new', label: 'No, add it as a new goal' }, { choice: 'leave', label: 'Leave it out' }] as Choice[],
  samePerson: (name: string): Choice[] => [{ choice: 'same', label: `The same person: give ${name} this email` }, { choice: 'new', label: 'Someone new' }],
  pastStage: [{ choice: 'done', label: 'They’re done' }, { choice: 'not-done', label: 'They’re not done' }, { choice: 'from-now', label: 'Count them from this week' }] as Choice[],
  pastPlan: [{ choice: 'add', label: 'They’re finished goals: add them' }, { choice: 'leave', label: 'Leave them out' }] as Choice[],
  noUnit: [{ choice: 'right', label: 'That’s right' }, { choice: 'leave', label: 'Leave them out' }] as Choice[],
  replaces: [{ choice: 'replace', label: 'Replace them' }, LEAVE] as Choice[],
  totals: [{ choice: 'leave', label: 'Leave it out' }, { choice: 'goal', label: 'It’s a goal' }] as Choice[],
  precision: (d: number, g: number): Choice[] => [{ choice: 'keep', label: `Keep ${d} decimal place${d === 1 ? '' : 's'} for ${g === 1 ? 'this goal' : `these ${g} goals`}` }],
  planQuestion: (yes: string): Choice[] => [{ choice: 'yes', label: yes }, LEAVE],
  sure: [{ choice: 'right', label: 'That’s right' }, LEAVE] as Choice[],
  odd: [RIGHT, LEAVE] as Choice[],
  feedsLower: [{ choice: 'right', label: 'Yes, it feeds that goal' }, LEAVE] as Choice[],
  leaveOnly: [LEAVE] as Choice[],
};

/* ---------- groups (rule 6) ---------- */

/** "Goals, row 5"; "Goals, rows 18 to 31"; "Goals, rows 2 to 4 and 9"; over three runs, the first three and "and 12 more". */
export function whereText(sheet: Sheet, rows: number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  if (sorted.length === 1) return `${sheet}, row ${sorted[0]}`;
  const runs: [number, number][] = [];
  for (const r of sorted) { const last = runs.at(-1); if (last && r === last[1] + 1) last[1] = r; else runs.push([r, r]); }
  const said = (x: [number, number]) => (x[0] === x[1] ? String(x[0]) : `${x[0]} to ${x[1]}`);
  const shown = runs.slice(0, 3);
  const rest = runs.slice(3).reduce((n, x) => n + x[1] - x[0] + 1, 0);
  const list = shown.map(said);
  const text = rest ? `${list.join(', ')} and ${rest} more` : list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]!;
  return `${sheet}, rows ${text}`;
}

export interface IssueGroup {
  /** Stable: the same kind, sheet, column and value found give the same id, in this file and a corrected one. */
  id: string;
  level: IssueLevel;
  kind: IssueKind;
  sheet: Sheet;
  column?: string;
  found?: string;
  suggest?: string;
  /** The group's title: what is wrong for a Must fix, the question for a Check. */
  title: string;
  /** Where its rows are: "Goals, rows 18 to 31". */
  where: string;
  rows: number[];
  count: number;
  /** One row's own sentence, as an example. */
  example: string;
  answers: Choice[];
  /** Its rows' own values, where they differ under one question (an unlikely number): what an answer covers. */
  values?: string[];
}

const n = (k: number, one: string, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const THING: Record<string, string> = { Team: 'team', 'Takes over': 'person', Owner: 'person', 'Owner email': 'person', 'Feeds into': 'goal', Goal: 'goal', Stages: 'stage' };

/** A group's title: section 4's "Title of the group" for a Must fix, its question for a Check. */
export function groupTitle(kind: IssueKind, sheet: Sheet, count: number, first: Issue): string {
  const v = first.found ?? '';
  const col = first.column ?? '';
  const things = sheet === 'Check-ins' ? n(count, 'check-in') : sheet === 'People' ? n(count, 'row') : sheet === 'Plan' ? n(count, 'plan row') : n(count, 'row');
  switch (kind) {
    case 'required-empty': return sheet === 'People' ? `${n(count, 'new person', 'new people')} ${count === 1 ? 'has' : 'have'} no ${col.toLowerCase() || 'value'}` : sheet === 'Goals' ? `${n(count, 'new goal')} ${count === 1 ? 'has' : 'have'} no ${col === 'Owner' ? 'owner' : col || 'value'}` : `${things} ${count === 1 ? 'has' : 'have'} no ${col || 'value'}`;
    case 'not-a-number': return `${things} ${count === 1 ? 'has' : 'have'} text where a number goes${col ? ` (${col})` : ''}`;
    case 'formula': return `${n(count, 'cell')} ${count === 1 ? 'holds' : 'hold'} a formula, not a number`;
    case 'precision': return `${n(count, 'number')} ${count === 1 ? 'has' : 'have'} more decimal places than ${count === 1 ? 'its goal keeps' : 'their goals keep'}`;
    case 'impossible-number': return `${n(count, 'number')} can’t be right`;
    case 'unknown-word': return `${col || 'A column'} says “${v}” on ${n(count, 'row')}`;
    case 'unknown-ref': return `${n(count, 'row')} name${count === 1 ? 's' : ''} a ${THING[col] ?? 'record'} that isn’t here: “${v}”`;
    case 'ambiguous-ref': return `${n(count, 'row')} say “${v}”, and more than one ${THING[col] ?? 'record'} is called that`;
    case 'conflicting-refs': return `${n(count, 'row')} name${count === 1 ? 's' : ''} two different ${THING[col] === 'goal' ? 'goals' : 'people'}`;
    case 'bad-key': return /look like/.test(first.message) ? `${n(count, 'key')} ${count === 1 ? 'doesn’t' : 'don’t'} look like G-12` : `${n(count, col === 'ID' || col === 'Goal ID' ? 'ID' : 'key')} ${count === 1 ? 'isn’t' : 'aren’t'} here`;
    case 'duplicate': return sheet === 'People' ? `${n(count, 'person', 'people')} appear on more than one row` : sheet === 'Check-ins' ? `${n(count, 'check-in')} appear on more than one row` : `${n(count, 'goal')} appear on more than one row`;
    case 'type-unclear': return `${n(count, 'new goal')} ${count === 1 ? 'doesn’t' : 'don’t'} say what type ${count === 1 ? 'it is' : 'they are'}`;
    case 'plan-order': return `${n(count, 'plan')} ${count === 1 ? 'ends' : 'end'} before ${count === 1 ? 'it starts' : 'they start'}, or ${count === 1 ? 'has' : 'have'} weeks outside ${count === 1 ? 'it' : 'them'}`;
    case 'stage-format': return `${n(count, 'row')} ${count === 1 ? 'has' : 'have'} stages that can’t be read`;
    case 'week-wrong': return /hasn’t happened/.test(first.message) ? `${n(count, 'check-in')} ${count === 1 ? 'is' : 'are'} for weeks that haven’t happened` : `${things} ${count === 1 ? 'has' : 'have'} no week Faro can read${col ? ` (${col})` : ''}`;
    case 'checkin-incomplete': return `${n(count, 'check-in')} ${count === 1 ? 'needs' : 'need'} ${v || 'more said'}`;
    case 'cant-change': return `${n(count, 'row')} change${count === 1 ? 's' : ''} something that can’t change`;
    case 'not-allowed': return sheet === 'People' ? `${n(count, 'row')} change${count === 1 ? 's' : ''} people. Only an admin can add or change people` : `${n(count, 'row')} change${count === 1 ? 's' : ''} ${count === 1 ? 'a goal' : 'goals'} you don’t own`;
    case 'removal-refused': return `${n(count, 'row')} can’t be ${sheet === 'People' ? 'marked as left' : 'stopped or deleted'} as ${count === 1 ? 'it stands' : 'they stand'}`;
    case 'loop': return `${n(count, 'goal')} would feed ${count === 1 ? 'itself' : 'themselves'}`;
    case 'near-ref': return `${n(count, 'row')} name${count === 1 ? 's' : ''} a ${THING[col] ?? 'record'} that isn’t here: “${v}”. Did you mean ${first.suggest}?`;
    case 'near-word': return `${col} says “${v}” on ${n(count, 'row')}. Read it as ${first.suggest}?`;
    case 'near-header': return first.message;
    case 'same-person': return first.message;
    case 'same-goal': return `${n(count, 'new goal')} ${count === 1 ? 'has a name its team already uses' : 'have names their teams already use'}: “${v}”. Are they new?`;
    case 'other-goal': return first.message;
    case 'past-stage': return `${n(count, 'new goal')} ${count === 1 ? 'has' : 'have'} stages due before this week. Are they done?`;
    case 'past-plan': return `${n(count, 'new goal')} ${count === 1 ? 'has a plan' : 'have plans'} that ${count === 1 ? 'has' : 'have'} already ended`;
    case 'odd-number': return count === 1 ? first.message : `${n(count, 'number')} look${count === 1 ? 's' : ''} unlikely: ${first.message}`;
    case 'plan-question': return count === 1 ? first.message : `${n(count, 'plan change')} to check: ${first.message}`;
    case 'no-unit': return `${n(count, 'new goal')} ${count === 1 ? 'has' : 'have'} no unit, so ${count === 1 ? 'its' : 'their'} numbers will show bare. ${count === 1 ? 'Is it a plain count' : 'Are they plain counts'}?`;
    case 'decimal-comma': return `${n(count, 'number')} use${count === 1 ? 's' : ''} a comma as the decimal mark. ${first.message} Is that right?`;
    case 'replaces-others': return `${n(count, 'row')} replace check-ins other people posted`;
    case 'many-admins': return `${n(count, 'person', 'people')} would become admins`;
    case 'totals-row': return first.message;
    case 'big-removal': return first.message;
    case 'feeds-lower': return count === 1 ? first.message : `${n(count, 'goal')} feed${count === 1 ? 's' : ''} a goal at a lower level. Is that right?`;
    default: return first.message;
  }
}

const LEVEL_RANK: Record<IssueLevel, number> = { must: 0, check: 1, note: 2 };

/**
 * Rule 6. Issues grouped by kind, sheet, column and the folded value found, each with its title, where its rows are, how
 * many, and the answers it takes; Must fix first, then Check, then what was read; largest first within a level.
 */
export function groupIssues(issues: readonly Issue[]): IssueGroup[] {
  const by = new Map<string, Issue[]>();
  for (const i of issues) by.set(i.group, [...(by.get(i.group) ?? []), i]);
  return [...by.entries()].map(([id, list]) => {
    const first = list[0]!;
    const rows = [...new Set(list.map((x) => x.row))].sort((a, b) => a - b);
    return {
      id, level: first.level, kind: first.kind, sheet: first.sheet,
      ...(first.column ? { column: first.column } : {}), ...(first.found ? { found: first.found } : {}), ...(first.suggest ? { suggest: first.suggest } : {}),
      title: groupTitle(first.kind, first.sheet, list.length, first), where: whereText(first.sheet, rows), rows, count: list.length, example: first.message, answers: first.answers ?? [],
      ...(list.some((x) => x.value != null) ? { values: [...new Set(list.flatMap((x) => (x.value != null ? [x.value] : [])))] } : {}),
    };
  }).sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || b.count - a.count);
}

/** "{q} questions cover {n} rows", as the preview and the MCP result say it. */
export function questionsLine(groups: readonly IssueGroup[]): string {
  const checks = groups.filter((g) => g.level === 'check');
  const rows = checks.reduce((k, g) => k + g.count, 0);
  return `${n(checks.length, 'question')} cover${checks.length === 1 ? 's' : ''} ${n(rows, 'row')}`;
}
