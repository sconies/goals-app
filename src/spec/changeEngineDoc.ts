/* The change engine's page, its generated half (rebuild drill, stage 2): every sentence it says, how several missing
   parts of a check-in are said together, the field-by-field differences of its items, the columns it reads, and the
   change log's words. Each table is read from the code (src/spec/engineWords.ts reads the sentences from the engine's
   source) or made by running it on the conformance workspace, so none can say what the code doesn't.

   Node only: it reads files. Used by src/spec/build.ts for spec/core/rules/change-engine.md. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { CHECK_KINDS, MUST_KINDS, NOTE_KINDS } from '../domain/problemLevels';
import { checkInFields, goalFields, type Lookup } from '../domain/changes';
import { fieldTable, FILL_SHEETS, specOf } from '../domain/columns';
import { personChange } from '../domain/people';
import { VIA_LABEL } from '../domain/via';
import type { CheckIn, Goal, Person } from '../domain/types';
import { asOf, changeCases, runCase, type ConformanceWorkspace } from './conformance';
import { engineSentences, FIRST_MUST, wordsOf } from './engineWords';
import { cell, table } from './md';

const KIND_ORDER: readonly string[] = [...MUST_KINDS, FIRST_MUST, ...CHECK_KINDS, ...NOTE_KINDS];
const code = (s: string) => (s ? `\`${cell(s)}\`` : '—');

/** Every sentence, kind by kind: the table and the words around it. */
function sentencesSection(root: string): string[] {
  const all = engineSentences(root).map((x, i) => ({ ...x, i })).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.i - b.i);
  return [
    '## Every sentence it says',
    '',
    `Each problem, question and note is one of these ${all.length} sentences, read by \`src/spec/engineWords.ts\` from the engine’s own source (\`src/domain/changeset.ts\`) and from the rules it shares, where those make the sentence: the goal form’s Must fix and questions (\`goalMustFix\`, \`goalChecks\` in \`src/domain/goalEntry.ts\`), a check-in’s number (\`valueProblem\` in \`src/domain/checkin.ts\`), the people rules (\`personProblems\`) and the removal rules (\`src/domain/removal.ts\`). \`src/spec/engineWords.test.ts\` checks that every sentence the conformance cases raise matches one of them, under its kind.`,
    '',
    '- **{placeholder}**: a value put in: a cell as the row wrote it (`{cell}`), a goal’s or person’s name, a week, a number written as the goal writes it (with its unit, digits grouped: “1,500%”). `{sheet}` is Goals, Plan, Check-ins or People.',
    '- **[words]**: said only sometimes; **{a / b}**: one or the other, as the case is.',
    '- A sentence that takes in another (“Week 45: ” and a number’s problem; “Feeds into ref: ” and why the ref names nothing) is listed whole, once for each sentence it takes in. A person cell the row can’t read is said in the person cell’s own sentence (the rows with sheet `{sheet}`); on People, Takes over’s is “Takes over: ” and that sentence.',
    '- **Group column** and **group value** are the third and fourth parts of the group’s id, `kind:sheet:column:value`, kind by kind: each part is lower-cased with every run of spaces as `-`, and the value is folded first (accents off, “&” as “and”, anything but letters and digits as a space, trimmed). A part with nothing is left empty, so `required-empty:goals:owner:` has no value and `not-allowed:goals::` neither column nor value. The sheet part is the sheet’s name: `goals`, `plan`, `check-ins`, `people`.',
    '- **Headers are lower-cased.** The engine reads a sheet’s headers in lower case (a file’s “Targett” is `targett`), so a sentence that names a header as the row wrote it says it in lower case: “A column on Goals is called “targett”. Read it as Target?”. A column the engine names itself keeps its own words (Target, Owner email).',
    '',
    table(['Kind', 'Level', 'Sheet', 'Group column', 'Group value', 'Words'], all.map((x) => [`\`${x.kind}\``, x.level, cell(x.sheet), code(x.column), code(x.found), cell(x.words)])),
    '',
  ];
}

/** Placeholders the table can't make plain, each with a case that says it in full (stage 2 drill, gaps S2-9 to S2-14). */
function sentencesInFull(w: ConformanceWorkspace): string[] {
  const say = (name: string) => { const c = changeCases(w).find((x) => x.case === name)!; const i = runCase(w, c).issues.find((x) => x.level !== 'note')!; return [`\`${name}\``, `\`${i.kind}\``, code(i.group), cell(i.message)]; };
  return [
    'Where a placeholder could be read more than one way, it is fixed words:',
    '',
    '- **{metric, range or milestone}** names all three types, always, in those words; **{columns filled in}** are the groups the row fills (Start and Target; Limit; Stages), joined by “, and ”.',
    '- **{Owner and Owner email}** names the person columns the row gives, in the order Owner, Owner email, Owner ID, and **{name and name}** the people they name in that order.',
    '- **{its column}** of `plan-order` on Goals is the group’s column `due-week`, whichever of To and Due week the row gave.',
    '- **[ {unit}]** after a number in a check-in’s refusal is the goal’s unit after a space, `%` too (“below zero %”), unlike a number written with its unit, where `%` is attached.',
    '- A number’s example in “isn’t a number” is at the goal’s decimal places (“like 29” for a whole-number goal), except Effect’s on a Goals row, which is always the default `29.4`.',
    '',
    'Said in full, by the cases that raise them:',
    '',
    table(['Case', 'Kind', 'Group', 'Words'], ['conflicting-refs', 'type-unclear', 'plan-order', 'to-before-from', 'effect-not-number', 'impossible-number'].map(say)),
    '',
  ];
}

/** What a check-in row lacks, part by part, and how the parts join (gap 15). */
function missingSection(root: string): string[] {
  const parts = missingParts(root);
  return [
    '## What a check-in row lacks, in one sentence',
    '',
    'A check-in row that the check-in screen would not post (`checkin-incomplete`) is one sentence: “Week {week} needs ” and every part it lacks, joined by “; ”, in the order the check-in rule finds them (`evaluate` in `src/domain/checkin.ts`), then a full stop. A number that can’t be used is said on its own instead (“Week 45: …”, under `not-a-number`, `precision` or `impossible-number`), and an empty Value as “Week 45 needs a Value.” The group’s value is the same parts, so one answer covers every row that lacks the same.',
    '',
    table(['Part (the rule’s code)', 'Said as'], parts.map((p) => [`\`${p.code}\``, cell(p.words)])),
    '',
    'So a week behind plan, called off track, with no cause, why or path is “Week 45 needs a Cause and a Why of 10 characters or more (it’s behind plan); a Path to green and, if it’s a plan, Back on plan by week (after week 45, by week 53).”',
    '',
  ];
}

/** The parts, in the order `evaluate` finds them, with the words the engine's `hint` gives each. */
function missingParts(root: string): { code: string; words: string }[] {
  const read = (f: string) => ts.createSourceFile(f, fs.readFileSync(path.join(root, f), 'utf8'), ts.ScriptTarget.Latest, true);
  const order: string[] = [];
  const visitEval = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'push' && n.expression.expression.getText() === 'codes') {
      const add = (e: ts.Expression): void => { if (ts.isStringLiteral(e)) order.push(e.text); else if (ts.isConditionalExpression(e)) { add(e.whenTrue); add(e.whenFalse); } };
      if (n.arguments[0]) add(n.arguments[0]);
    }
    n.forEachChild(visitEval);
  };
  read('src/domain/checkin.ts').forEachChild((s) => { if (ts.isFunctionDeclaration(s) && s.name?.text === 'evaluate') visitEval(s); });
  const words = wordsOf('src/domain/changeset.ts', 'hint', root);
  const seen = [...new Set(order)];
  return seen.filter((c) => words[c]).map((c) => ({ code: c, words: words[c]! }));
}

/** The field-by-field differences: each field's label, the goals it is on, and how its value is written (gap 6). */
function fieldsSection(w: ConformanceWorkspace): string[] {
  const s = asOf(w, new Date(w.builtFor));
  const lookup: Lookup = { person: (id) => s.people.find((p) => p.id === id), goal: (id) => s.goals.find((g) => g.id === id), teamName: (id) => s.teams.find((t) => t.id === id)?.name ?? id };
  const pick = (k: Goal['kind'], test: (g: Goal) => boolean = () => true) => s.goals.find((g) => g.kind === k && test(g)) ?? s.goals.find((g) => g.kind === k)!;
  const examples: Goal[] = [pick('metric', (g) => !!g.parentId && !!g.whyHelps), pick('range'), pick('milestone')];
  const short = (v: string) => (v.length > 120 ? `${v.slice(0, 117).replace(/\s+\S*$/, '')}…` : v);
  const labels: string[] = [];
  const on = new Map<string, Set<string>>();
  const sample = new Map<string, string>();
  const kindName: Record<Goal['kind'], string> = { metric: 'number', range: 'range', milestone: 'stages' };
  for (const g of examples) for (const [k, v] of Object.entries(goalFields(g, lookup))) {
    if (!labels.includes(k)) labels.push(k);
    on.set(k, new Set([...(on.get(k) ?? []), kindName[g.kind]]));
    if (!sample.has(k) || sample.get(k) === '—') sample.set(k, v);
  }
  const goalRows = labels.map((k) => [k, on.get(k)!.size === 3 ? 'every goal' : [...on.get(k)!].join(', '), cell(short(sample.get(k) ?? '—'))]);
  const checkIn = (k: Goal['kind']): { g: Goal; c: CheckIn } => { const g = examples.find((x) => x.kind === k)!; const c = [...s.checkIns].reverse().find((x) => x.goalId === g.id && x.pathToGreen) ?? [...s.checkIns].reverse().find((x) => x.goalId === g.id)!; return { g, c }; };
  const ciLabels: string[] = [];
  const ciOn = new Map<string, Set<string>>();
  const ciSample = new Map<string, string>();
  for (const k of ['metric', 'milestone'] as const) {
    const { g, c } = checkIn(k);
    for (const [f, v] of Object.entries(checkInFields(c as CheckIn, g))) {
      if (!ciLabels.includes(f)) ciLabels.push(f);
      ciOn.set(f, new Set([...(ciOn.get(f) ?? []), kindName[g.kind]]));
      if (!ciSample.has(f) || ciSample.get(f) === '—') ciSample.set(f, v);
    }
  }
  const before = s.people.find((p) => p.teamId && !p.admin)!;
  const team2 = s.teams.find((t) => t.id !== before.teamId)!;
  const after: Person = { ...before, name: before.name + ' Jones', email: 'new@example.com', role: 'Lead engineer', teamId: team2.id, admin: true };
  const tn = (id: string) => s.teams.find((t) => t.id === id)?.name ?? '';
  const changed = personChange({ ...before, email: 'old@example.com', role: '' }, after, tn, 'x', w.builtFor, 'x')!.diffs;
  const added = personChange(null, after, tn, 'x', w.builtFor, 'x')!.diffs;
  // The other differences, as the conformance cases' items carry them.
  const more = otherDiffs(w);
  const whole = wholeItems(w);
  return [
    '## Field by field',
    '',
    'Every item carries the fields it changes as `Field: before → after`, in the order below, each value in the words a person reads; `—` is nothing. A new record lists only the fields it fills (a field that would be `—` is left out); a changed one lists only the fields that differ. These are the change log’s own differences (`goalFields`, `checkInFields` in `src/domain/changes.ts`; `personChange` in `src/domain/people.ts`): the tables are made by running them on the conformance workspace, so each example is what the code writes.',
    '',
    '**A goal’s fields**, in this order:',
    '',
    table(['Field', 'On', 'Written as, for example'], goalRows),
    '',
    'Its words: State is `Proposed` or `—`; Type is `Move a number`, `Keep a number in range` or `Hit dated stages`; Feeds into is the goal’s name, or `Nothing`; Why it helps is `—` when it feeds nothing; Role is `Input` or `Output`; Guardrail `Yes` or `No`; a number is written as the goal writes it, with its unit (`10%`, `52 hours`, `1,500%`); Target is `Not set` on a proposed goal with none; Plan shape is `Straight line`, `Back-loaded` or `Three steps`; Plan from week and Target due are `Week 45`, or `—`; Plan numbers are `wk 46: 12%, wk 47: 14%`; a range’s Limit is its rule in words (`At most 12%`, `Between 99.5% and 99.95%`); Stages are `Name (wk N)`, by due week, joined by “, ”.',
    '',
    '**A check-in’s fields**, in this order:',
    '',
    table(['Field', 'On', 'Written as, for example'], ciLabels.map((k) => [k, ciOn.get(k)!.size === 2 ? 'every goal' : [...ciOn.get(k)!].join(', '), cell((ciSample.get(k) ?? '—').length > 120 ? `${(ciSample.get(k) ?? '').slice(0, 117).replace(/\s+\S*$/, '')}…` : ciSample.get(k) ?? '—')])),
    '',
    'Status call is the status’s word (`On track`, `At risk`, `Off track`); Path to green is what will be done and, in brackets, `by week N` or the recovery’s word in lower case; Stages are `Name: done wk N`, `Name: expected wk N` or `Name: on schedule`, joined by “; ”.',
    '',
    `**A person’s fields.** A new person: ${added.map((d) => `\`${d.field}\``).join(', ')} (Email only when they have one). A person changed, only what differs, in this order: ${changed.map((d) => `\`${d.field}\``).join(', ')}; Admin is \`Yes\` or \`No\`, and an empty email, job title or team is \`—\`.`,
    '',
    '**Beside them**, an item can carry:',
    '',
    table(['Field', 'When', 'For example'], more),
    '',
    `Via is the door, one of ${Object.values(VIA_LABEL).map((v) => `\`${v}\``).join(', ')}: every change through a door but the check-in form carries it, last.`,
    '',
    '**Whole items**, as the conformance cases make them (changes.csv’s `diffs`). A new goal lists the fields it fills, and also these, whose value is the goal’s own though it reads like nothing: Feeds into (`— → Nothing`), Level, Role, Guardrail, Decimals and Plan from week (this week, when the row gives no From). Target due is left out when it is the cycle’s end. Plan from week and Target due are the bare week of the cycle’s own count, `Week 66` for a week in the next goal year ([years and weeks](years-and-weeks.md)). A goal stopped carries Status, then Why, then Via. Baseline is `Baseline, {period}`, then `, provisional` when it is.',
    '',
    table(['Case', 'Item', 'Diffs'], whole),
    '',
  ];
}

/** One item, in full, from the cases that show how a whole item is written (stage 2 drill, gaps S2-4, S2-5, S2-15, S2-17). */
function wholeItems(w: ConformanceWorkspace): string[][] {
  const pick: [string, number][] = [['saves-new-goal', 0], ['saves-stop', 0], ['baseline-provisional', 0], ['to-next-year', 0]];
  return pick.flatMap(([name, n]) => {
    const c = changeCases(w).find((x) => x.case === name);
    const it = c && runCase(w, c).items[n];
    return it ? [[`\`${name}\``, it.kind, cell(it.diffs.map((d) => `${d.field}: ${d.from} → ${d.to}`).join(' | '))]] : [];
  });
}

/** Fields beside the record's own, with an example from a case that carries each. */
function otherDiffs(w: ConformanceWorkspace): string[][] {
  const runs = changeCases(w).map((c) => ({ c, cs: runCase(w, c) }));
  const find = (f: string) => {
    for (const { c, cs } of runs) for (const it of cs.items) { const d = it.diffs.find((x) => x.field === f || x.field.startsWith(f)); if (d) return { c, d }; }
    return null;
  };
  const when: [string, string][] = [
    ['Why', 'A plan change with its reason (the row’s Reason, else the import’s reason), after the record’s own fields; and a goal stopped, with its Reason.'],
    ['Why corrected', 'A check-in a row corrects, with the reason: first, before the check-in’s own fields.'],
    ['Status', 'A goal stopped (`Stopped`). A deleted goal carries none: its item is `Goal: {name} → —`, then Via.'],
    ['Open asks', 'A goal that changes owner, whose open asks of the old owner go with it.'],
    ['Via', 'Every item, last.'],
  ];
  return when.map(([f, why]) => { const x = find(f); return [`\`${f}\``, why, x ? `${cell(`${x.d.field}: ${x.d.from} → ${x.d.to}`)} (\`${x.c.case}\`)` : '—']; });
}

/** Columns the engine reads that the format doesn't list (gap 13). */
function readColumnsSection(root: string): string[] {
  const src = ts.createSourceFile('c.ts', fs.readFileSync(path.join(root, 'src/domain/changeset.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  const read = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['val', 'has', 'ref'].includes(n.expression.text) && n.arguments[1] && ts.isStringLiteral(n.arguments[1])) read.add(n.arguments[1].text);
    n.forEachChild(visit);
  };
  visit(src);
  const known = new Set(FILL_SHEETS.flatMap((k) => [...specOf(k).columns.map((c) => c.header.toLowerCase()), ...fieldTable(k).flatMap((c) => (c.also ?? []).map((a) => a.toLowerCase()))]));
  const extra = [...read].filter((h) => !known.has(h) && h !== '__row').sort();
  const words: Record<string, string> = {
    'owner id': 'Goals: the owner by their ID, as Owner email names them by email. With Owner or Owner email beside it, they must name the same person (`conflicting-refs`); an ID no one has is `bad-key` (“There’s no person with ID {cell}.”).',
    'feeds into id': 'Goals: the goal it feeds by its ID, as Feeds into key does by key; one that names no goal this cycle is `bad-key`.',
    'reason for change': 'Goals: an older name for Reason, read when Reason is empty.',
    next: 'Check-ins: an older name for Next step, read when there is no Next step column.',
  };
  return [
    '## Columns it reads beyond the format',
    '',
    `The engine also reads ${extra.length === 1 ? 'one column' : `${extra.length} columns`} no sheet in [the export format](../export-format.md) lists, so no export writes ${extra.length === 1 ? 'it' : 'them'}; a file or a tool may give ${extra.length === 1 ? 'it' : 'them'} (read in any case, like every header):`,
    '',
    ...extra.map((h) => `- **${h.replace(/\b\w/, (c) => c.toUpperCase()).replace(/ id$/, ' ID')}**: ${words[h] ?? 'read by the engine; see its sentences above.'}`),
    '',
  ];
}

/** The change log's words for an import, a change, a correction and an undo (gap 19). */
function logSection(root: string): string[] {
  const words = (f: string, n: string) => wordsOf(f, n, root);
  const rows: [string, string][] = [
    ['An import’s one summary entry (`action: imported`)', words('src/domain/changeset.ts', 'summary')['summary'] ?? ''],
    ['What it counts, after the colon (`describe`; nothing: “No changes”)', (words('src/domain/changeset.ts', 'describe')['parts'] ?? '') + ', joined by “, ”'],
    ['A goal added or changed (`goalChange`)', words('src/domain/changes.ts', 'goalChange')['summary'] ?? ''],
    ['A check-in posted or replaced (`checkInChange`)', words('src/domain/changes.ts', 'checkInChange')['summary'] ?? ''],
    ['A check-in a row backfills (an earlier week, not a correction)', '{the check-in’s summary} (loaded later)'],
    ['A check-in corrected (`correctedSummary`; a week added to an ended year: “Added week {week} later: {number}”)', words('src/domain/changeset.ts', 'correctedSummary')['return'] ?? ''],
    ['A person added or changed (`personChange`)', words('src/domain/people.ts', 'personChange')['summary'] ?? ''],
    ['A team an admin’s file adds, or a team objective changed', (words('src/domain/changeset.ts', 'summary')['value'] ?? '').replace(/\{person\}/g, '{team}')],
    ['Undo’s entry (`action: undone`)', words('src/domain/removal.ts', 'undoPlan')['summary:undone'] ?? ''],
    ['What Undo’s entry calls the import (`undoneWhat`)', words('src/domain/removal.ts', 'undoneWhat')['return'] ?? ''],
    ['Why Undo leaves a row (each `{name}: {reason}`, joined by “; ” in its Skipped field)', words('src/domain/removal.ts', 'keptReason')['return'] ?? ''],
    ['When Undo can put nothing back (`nothingToUndo`)', words('src/domain/removal.ts', 'nothingToUndo')['return'] ?? ''],
  ];
  return [
    '## The change log’s words',
    '',
    'The entries a change set writes, and Undo’s, read from the code as the sentences are. A summary entry’s differences are `Via: — → {door}`, then, for a file, `File: — → {its name}` and `Rows: — → {n} changed, {n} unchanged[, {n} left out]`. Undo’s entry has `Import: {the import’s summary} → Undone` and, when rows stay, `Skipped: — → {why each stays}`. A goal’s “Changed …” names its fields in lower case: up to three joined by “, ”, or the first two and “and {n} more”.',
    '',
    table(['Entry', 'Words'], rows.map(([a, b]) => [a, cell(b)])),
    '',
  ];
}

/** The change engine page's generated sections, after its rule. */
export function changeEngineSections(root: string, w: ConformanceWorkspace): string[] {
  return [...sentencesSection(root), ...sentencesInFull(w), ...missingSection(root), ...fieldsSection(w), ...readColumnsSection(root), ...logSection(root)];
}

