/* Fields' rows in the conformance data (TG1): spec/conformance/tags.csv. The demo workspace has no field (a workspace
   adds its own), so the rows are the rule's cases on two fields, Stage (a list: Discover, Build, Run) and Programme
   (free text): what a goal's typed value is kept as or why it is refused (valueProblem), and what stops a field being
   saved (fieldProblem). src/spec/conformance.ts reads this through the module registry and writes the file; its test
   makes it again. */
import type { ModuleConformance } from '../../spec/conformance';
import { FIELD_LIMITS, fieldProblem, valueProblem, type GoalField } from './rules';

export const HEADER = ['rule', 'case', 'field', 'typed', 'kept', 'problem'];

const stage: GoalField = { id: 'f1', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'], position: 0 };
const programme: GoalField = { id: 'f2', name: 'Programme', kind: 'text', options: [], position: 1 };
const six = Array.from({ length: FIELD_LIMITS.fields }, (_, i) => ({ id: `f${i}`, name: `Field ${i}`, retiredAt: null }));

const VALUES: [string, GoalField, string][] = [
  ['list-exact', stage, 'Build'],
  ['list-case', stage, ' build '],
  ['list-unknown', stage, 'Operate'],
  ['list-clear', stage, ''],
  ['text', programme, 'Payments uplift'],
  ['text-long', programme, 'x'.repeat(FIELD_LIMITS.value + 1)],
  ['text-80', programme, 'y'.repeat(FIELD_LIMITS.value)],
];
const FIELDS: [string, Pick<GoalField, 'id' | 'name' | 'kind' | 'options' | 'retiredAt'>, Pick<GoalField, 'id' | 'name' | 'retiredAt'>[]][] = [
  ['ok', { ...stage, id: 'new', name: 'Stage' }, []],
  ['no-name', { ...stage, id: 'new', name: '  ' }, []],
  ['name-taken', { ...stage, id: 'new', name: 'stage' }, [stage]],
  ['name-of-retired', { ...stage, id: 'new' }, [{ ...stage, retiredAt: '2026-11-01T00:00:00.000Z' }]],
  ['seventh', { ...programme, id: 'new', name: 'Region' }, six],
  ['list-empty', { ...stage, id: 'new', options: [] }, []],
  ['list-twice', { ...stage, id: 'new', options: ['Build', 'build'] }, []],
  ['list-21', { ...stage, id: 'new', options: Array.from({ length: FIELD_LIMITS.values + 1 }, (_, i) => `V${i}`) }, []],
  ['text-with-values', { ...programme, id: 'new', options: ['Build'] }, []],
];

export function tagsRows(): string[][] {
  const blank = (cols: Partial<Record<(typeof HEADER)[number], string>>) => HEADER.map((h) => cols[h] ?? '');
  return [
    ...VALUES.map(([id, f, typed]) => { const r = valueProblem(f, typed); return blank({ rule: 'value', case: id, field: f.name, typed, kept: 'value' in r ? r.value : '', problem: 'problem' in r ? r.problem : '' }); }),
    ...FIELDS.map(([id, f, others]) => blank({ rule: 'field', case: id, field: f.name, typed: f.kind === 'list' ? f.options.join('|') : '', problem: fieldProblem(f, others) ?? '' })),
  ];
}

const files: ModuleConformance[] = [{
  file: 'tags',
  header: HEADER,
  keys: ['rule', 'case'],
  about: 'Fields’ rule ([Fields](../modules/tags/README.md), rule tags-fields), not part of stage 1, scored when asked (`"also": ["tags"]`). The demo has no field, so the rows are the rule’s cases on two fields: Stage, a list of Discover, Build and Run, and Programme, free text. Two kinds of row, by `rule`: **value**, a goal’s value as `typed` for `field`, and what it is `kept` as (empty: cleared) or the `problem` that refuses it; **field**, a field named `field` (a list’s values in `typed`, joined by |) and the `problem` that stops it being saved, empty when it saves. Every other column is empty.',
  rows: () => tagsRows(),
}];

export default files;
