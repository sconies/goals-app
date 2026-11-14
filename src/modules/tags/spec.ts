/* Tags' rules, in plain words with worked examples, for its section of the spec (spec/modules/tags/rules.md). The
   spec's generator reads it through the module registry (src/spec/rules.ts); every example runs against rules.ts. */
import type { Rule } from '../../spec/rules';
import { FIELD_LIMITS, fieldProblem, valueProblem, type GoalField } from './rules';

const stage: GoalField = { id: 'f1', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'], position: 0 };
const said = (r: { value: string } | { problem: string }) => ('value' in r ? `kept as “${r.value}”` : r.problem);

const rules: Rule[] = [
  {
    id: 'tags-fields',
    title: 'Fields: a workspace’s own columns on goals',
    summary: 'What a workspace’s own field must say, how many there may be, and what a goal’s value for one may be.',
    code: [{ file: 'src/modules/tags/rules.ts', names: ['fieldProblem', 'valueProblem', 'FIELD_LIMITS'] }],
    tests: ['src/modules/tags/rules.test.ts'],
    reqs: [],
    body: `
A workspace defines up to **${FIELD_LIMITS.fields} live fields**, for what Faro has no column for: a lifecycle stage, a programme, a funding line. Each is a **list of values** (1 to ${FIELD_LIMITS.values} of them, each 1 to ${FIELD_LIMITS.option} characters, none twice whatever the case) or **free text**. A field's **name** is 1 to ${FIELD_LIMITS.name} characters, and no other live field has it, whatever the case. Spaces at either end don't count.

**A goal's value.** A goal has at most one value per field. For a list it is one of the list's values, matched whatever the case and kept as the list writes it; for free text, at most ${FIELD_LIMITS.value} characters. Empty clears it.

**Retired, never deleted.** A field that is no longer wanted is retired: every goal keeps its value, and History its changes; it can be brought back, with its values. A retired field's name may be used again.

**No rule reads a field.** No status, flag, needs-attention, check-in or carry rule looks at one: a field is for finding and sorting. That is why it is a module, and why switching it off loses nothing.`,
    examples: [
      { given: 'Stage is a list: Discover, Build, Run. A goal’s Stage is set to “ build ”.', then: 'kept as “Build”', run: () => said(valueProblem(stage, ' build ')) },
      { given: 'The same goal’s Stage is set to “Operate”.', then: '“Operate” isn’t one of Stage’s values: Discover, Build or Run.', run: () => said(valueProblem(stage, 'Operate')) },
      { given: 'A seventh field, “Region”, is added while six are live.', then: 'A workspace has at most 6 fields. Retire one first.', run: () => fieldProblem({ id: 'new', name: 'Region', kind: 'text', options: [] }, Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, name: `Field ${i}` }))) ?? 'saved' },
    ],
    unclear: ['Six fields, twenty values and 80 characters are Lane’s choices (13 Nov, 1a); a rebuild may tune them, keeping the database’s limits in step.'],
  },
];

export default rules;
