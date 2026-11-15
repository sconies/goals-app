/* Tags' rules, in plain words with worked examples, for its section of the spec (spec/modules/tags/rules.md). The
   spec's generator reads it through the module registry (src/spec/rules.ts); every example runs against rules.ts. */
import type { Rule } from '../../spec/rules';
import { filterGoals, NOT_SET, pickedOf, pickedText } from './filter';
import { FIELD_LIMITS, fieldProblem, valueProblem, type GoalField } from './rules';
import { unknownValue } from './sheet';

const stage: GoalField = { id: 'f1', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'], position: 0 };
const said = (r: { value: string } | { problem: string }) => ('value' in r ? `kept as “${r.value}”` : r.problem);

const rules: Rule[] = [
  {
    id: 'tags-fields',
    title: 'Fields: a workspace’s own columns on goals',
    summary: 'What a workspace’s own field must say, how many there may be, and what a goal’s value for one may be.',
    code: [{ file: 'src/modules/tags/rules.ts', names: ['fieldProblem', 'valueProblem', 'FIELD_LIMITS'] }, { file: 'src/modules/tags/fields.ts', names: ['addField', 'changeField', 'moveField', 'retireField', 'bringBackField', 'setGoalFields'] }],
    tests: ['src/modules/tags/rules.test.ts', 'src/modules/tags/fields.test.ts', 'src/modules/tags/tools.test.ts'],
    reqs: ['TAGS-FIELDS'],
    body: `
A workspace defines up to **${FIELD_LIMITS.fields} live fields**, for what Faro has no column for: a lifecycle stage, a programme, a funding line. Each is a **list of values** (1 to ${FIELD_LIMITS.values} of them, each 1 to ${FIELD_LIMITS.option} characters, none twice whatever the case) or **free text**, which has no values. A field's **name** is 1 to ${FIELD_LIMITS.name} characters, and no other live field has it, whatever the case. Spaces at either end don't count.

**A goal's value.** A goal has at most one value per field. For a list it is one of the list's values, matched whatever the case and kept as the list writes it; for free text, at most ${FIELD_LIMITS.value} characters. Empty clears it.

**Who may.** Admins add, rename, reorder, retire and bring back fields; a goal's owner or an admin sets its values; everyone reads them. A change of value is said on the goal's History as “Stage: Discover → Build” (“Not set” for none), and no reason is asked.

**Retired, never deleted.** A field that is no longer wanted is retired: every goal keeps its value, and History its changes; it can be brought back, with its values. A retired field's name may be used again.

**No rule reads a field.** No status, flag, needs-attention, check-in or carry rule looks at one: a field is for finding and sorting. That is why it is a module, and why switching it off loses nothing.`,
    examples: [
      { given: 'Stage is a list: Discover, Build, Run. A goal’s Stage is set to “ build ”.', then: 'kept as “Build”', run: () => said(valueProblem(stage, ' build ')) },
      { given: 'The same goal’s Stage is set to “Operate”.', then: '“Operate” isn’t one of Stage’s values: Discover, Build or Run.', run: () => said(valueProblem(stage, 'Operate')) },
      { given: 'A seventh field, “Region”, is added while six are live.', then: 'A workspace has at most 6 fields. Retire one first.', run: () => fieldProblem({ id: 'new', name: 'Region', kind: 'text', options: [] }, Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, name: `Field ${i}` }))) ?? 'saved' },
    ],
    unclear: ['Six fields, twenty values and 80 characters are Lane’s choices (13 Nov, 1a); a rebuild may tune them, keeping the database’s limits in step.'],
  },
  {
    id: 'tags-filter',
    title: 'Fields: filtering goals by a field',
    summary: 'Which goals a filter on a list field keeps, on Goals, in a saved view and through find_goals.',
    code: [{ file: 'src/modules/tags/filter.ts', names: ['filterGoals', 'fieldMatcher', 'pickedOf', 'pickedText', 'NOT_SET'] }, { file: 'src/modules/tags/extras.ts', names: ['family'] }, { file: 'src/modules/tags/find.ts', names: ['fieldParams'] }],
    tests: ['src/modules/tags/filter.test.ts', 'src/modules/tags/tools.test.ts', 'src/domain/query.test.ts'],
    reqs: ['TAGS-FILTER'],
    body: `
Goals' Filters sheet has a row for each live **list** field, its values and **${NOT_SET}** to tick ("Stage: Discover · Build · Run · ${NOT_SET}"). A goal matches when its value is one of those ticked, whatever the case; **${NOT_SET}** matches a goal with no value (never set, or cleared). With several fields filtered, a goal matches **every** one. A field with nothing ticked filters nothing.

The filter line says it as "Stage is Build" ("Stage is Build or Run"), with Remove. The address carries it as \`/goals?f.<field id>=Build,Run\` (the values in the list's order, ${NOT_SET} last), so a link and a saved view keep it; a value the list no longer holds is left out, as a link's unknown values are. The field's id, not its name, so renaming a field keeps every view.

find_goals takes the same filter by name: \`fields: { "Stage": "Build, Run" }\`. A name no live field has, a free-text field, or a value the list doesn't hold is refused in words. **Free text is not a filter** (Lane, 2a); Find searches the goal's own words, not a field's.

With Fields switched off there are no filter rows, a link's \`f.\` parameters narrow nothing (as a switched-off module's filter never does), and find_goals' \`fields\` says the module-off sentence.`,
    examples: [
      { given: 'Four goals: g1 and g3 in Build, g2 in Discover, g4 with no Stage. Filter: Stage is Build.', then: 'g1, g3', run: () => filterGoals(GOALS, HELD, { [stage.id]: ['Build'] }).map((g) => g.id).join(', ') },
      { given: 'The same goals. Filter: Stage is Discover or Not set.', then: 'g2, g4', run: () => filterGoals(GOALS, HELD, { [stage.id]: ['Discover', NOT_SET] }).map((g) => g.id).join(', ') },
      { given: 'A link says f.<Stage’s id>=run,Operate,not set.', then: 'Run,Not set', run: () => pickedText(stage, pickedOf(stage, 'run,Operate,not set')) },
    ],
    unclear: ['A link names a field by its id, so a rename keeps saved views; a rebuild may prefer a readable key, keeping the id behind it.'],
  },
  {
    id: 'tags-sheet',
    title: 'Fields: the Goals sheet’s columns',
    summary: 'How a workbook writes a goal’s fields, and how loading one back reads them.',
    code: [{ file: 'src/modules/tags/sheet.ts', names: ['readFieldColumns', 'unknownValue'] }, { file: 'src/modules/tags/extras.ts', names: ['sheet'] }, { file: 'src/domain/changeset.ts', names: ['planChanges'] }],
    tests: ['src/modules/tags/sheet.test.ts'],
    reqs: ['TAGS-SHEET'],
    body: `
Every export's **Goals** sheet (the workbook, Data's Goals table, the MCP export) has one column per live field after the core's, **headed with the field's name**: the goal's value, or empty for none. Its Start here sheet says what each holds.

**Loading back.** A Goals row's cell under a field's header is read as the goal's page would take it (rule tags-fields): a list's value whatever the case, kept as the list writes it; an empty cell clears the value. Only what differs from what is saved changes anything, so **a workbook exported and loaded back changes nothing**. A change is said on the goal's row of the preview and in History as on the goal's page ("Stage: Discover → Build"), via Spreadsheet.

**A value the list doesn't hold** is a Check, asked **once per field and value**, however many rows say it: "Stage says “Operate” on 4 rows. Add “Operate” to Stage, or leave these cells empty?" An **admin** may add it (the list changes, in History, and every row takes it); anyone else may only leave those cells empty, or fix the file. Free text over ${FIELD_LIMITS.value} characters is a Must fix; a goal the loader may not change is the core's Must fix.

A column headed with a name no live field has is a column nothing reads, named on the file line. With Fields switched off, no export has the columns, a file's are columns nothing reads (named once on the file line), and every value is kept.`,
    examples: [
      { given: 'An admin loads a Goals sheet whose Stage column says “Operate” on 4 rows.', then: 'Stage says “Operate” on 4 rows. Add “Operate” to Stage, or leave these cells empty?', run: () => unknownValue('Stage', 'Operate', 4, true).message },
      { given: 'Someone who isn’t an admin loads the same file.', then: 'empty', run: () => unknownValue('Stage', 'Operate', 4, false).answers.map((a) => a.choice).join(', ') },
    ],
    unclear: ['Undo this import puts goals, plans and check-ins back, but not a field’s values or an added list value (the core’s import undo keeps no module rows yet).'],
  },
];

const GOALS = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }, { id: 'g4' }];
const HELD = [['g1', 'Build'], ['g2', 'Discover'], ['g3', 'Build']].map(([goalId, value]) => ({ goalId: goalId!, fieldId: stage.id, value: value!, removedAt: null }));

export default rules;
