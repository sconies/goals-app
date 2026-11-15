// Fields' conformance file (spec/conformance/README.md, tags.csv): the rule's cases on two fields, Stage (a list of
// Discover, Build and Run) and Programme (free text). Every row is computed by the module's rules.
import fs from 'node:fs';
import path from 'node:path';
import { csvCell } from '../../rules.mjs';
import { fieldProblem, valueProblem, pickedOf, filterGoals, unknownValue } from './rules.mjs';

const stage = { id: 'fld_stage', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'], position: 0 };
const programme = { id: 'fld_programme', name: 'Programme', kind: 'text', options: [], position: 1 };

export function tagsRows() {
  const rows = [];
  const value = (c, f, typed) => { const r = valueProblem(f, typed); rows.push(['value', c, f.name, typed, r.kept ?? '', r.problem ?? '']); };
  value('list-exact', stage, 'Build');
  value('list-case', stage, ' build ');
  value('list-unknown', stage, 'Operate');
  value('list-clear', stage, '');
  value('text', programme, 'Payments uplift');
  value('text-long', programme, 'x'.repeat(81));
  value('text-80', programme, 'y'.repeat(80));
  const field = (c, f, others, id = null) => rows.push(['field', c, f.name, f.kind === 'list' ? (f.options || []).join('|') : '', '', fieldProblem(f, others, id) ?? '']);
  const list = (name, options) => ({ name, kind: 'list', options });
  field('ok', list('Stage', ['Discover', 'Build', 'Run']), [programme]);
  field('no-name', list('  ', ['Discover', 'Build', 'Run']), []);
  field('name-taken', list('stage', ['Discover', 'Build', 'Run']), [stage]);
  field('name-of-retired', list('Stage', ['Discover', 'Build', 'Run']), [{ ...stage, retiredAt: '2026-01-01T00:00:00Z' }]);
  const six = ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => ({ id: `f${i}`, name: `Field ${n}`, kind: 'text', options: [], position: i }));
  field('seventh', list('Region', []), six);
  field('list-empty', list('Stage', []), []);
  field('list-twice', list('Stage', ['Build', 'build']), []);
  field('list-21', list('Stage', Array.from({ length: 21 }, (_, i) => `V${i}`)), []);
  field('text-with-values', { name: 'Programme', kind: 'text', options: ['Payments'] }, []);
  // filters: four goals, g1 and g3 in Build, g2 in Discover, g4 with none
  const goals = ['g1', 'g2', 'g3', 'g4'].map((id) => ({ id }));
  const vals = { g1: 'Build', g2: 'Discover', g3: 'Build', g4: '' };
  const filter = (c, typed) => rows.push(['filter', c, 'Stage', typed, filterGoals(goals, [{ field: stage, picked: pickedOf(stage, typed) }], (g) => vals[g]).map((g) => g.id).join('|'), '']);
  filter('one', 'Build'); filter('two', 'Build,Discover'); filter('case', 'build'); filter('not-set', 'Not set'); filter('unknown', 'Operate'); filter('nothing', '');
  const sheet = (c, n, admin) => { const u = unknownValue(stage, 'Operate', n, admin); rows.push(['sheet', c, 'Stage', 'Operate', u.answers.join('|'), u.message]); };
  sheet('unknown-admin', 4, true); sheet('unknown-one-row', 1, true); sheet('unknown-not-admin', 4, false);
  return rows;
}
export function writeTagsCsv(outDir) {
  fs.writeFileSync(path.join(outDir, 'tags.csv'), [['rule', 'case', 'field', 'typed', 'kept', 'problem'], ...tagsRows()].map((r) => r.map(csvCell).join(',')).join('\n') + '\n');
}
