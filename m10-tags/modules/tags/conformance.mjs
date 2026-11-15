// Writes Fields' conformance file, tags.csv (spec/conformance/README.md: rows value, field, filter, sheet), from the
// module's own rules. The cases are in CASES (cases.json): the kit gives the rows' inputs only in the expected file.
// node modules/tags/conformance.mjs <out folder>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fieldProblem, valueProblem, cleanField } from './rules.mjs';
import { pickedOf, filterGoals } from './filter.mjs';
import { unknownValue } from './sheet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CASES = JSON.parse(fs.readFileSync(path.join(here, 'cases.json'), 'utf8'));
const STAGE = { id: 'stage', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'], position: 0 };
const PROGRAMME = { id: 'programme', name: 'Programme', kind: 'text', options: [], position: 1 };
const FIELDS = { Stage: STAGE, Programme: PROGRAMME };
const csv = (v) => { const t = String(v ?? ''); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const expand = (s) => String(s).replace(/\{([a-z])(\d+)\}/g, (_, ch, n) => ch.repeat(Number(n)));

export function rows() {
  const out = [];
  for (const c of CASES) {
    const r = { rule: c.rule, case: c.case, field: '', typed: '', kept: '', problem: '' };
    if (c.rule === 'value') {
      const f = FIELDS[c.field]; r.field = c.field; r.typed = expand(c.typed);
      const v = valueProblem(f, r.typed); if (v.problem) r.problem = v.problem; else r.kept = v.kept;
    } else if (c.rule === 'field') {
      r.field = expand(c.field); r.typed = c.kind === 'text' ? '' : (c.values || []).map(expand).join('|');
      const others = [];
      for (let i = 0; i < (c.live ?? 1); i++) others.push(i === 0 ? { ...STAGE, retiredAt: c.retired ? '2026-11-01T00:00:00.000Z' : null } : { id: `f${i}`, name: `Field ${i}`, kind: 'text', options: [], position: i });
      const f = cleanField({ id: null, name: r.field, kind: c.kind || (c.values ? 'list' : 'text'), options: (c.values || []).map(expand) });
      r.problem = fieldProblem(f, others) || '';
    } else if (c.rule === 'filter') {
      r.field = 'Stage'; r.typed = c.typed;
      const goals = ['g1', 'g2', 'g3', 'g4'].map((id) => ({ id }));
      const values = [{ goalId: 'g1', fieldId: 'stage', value: 'Build' }, { goalId: 'g2', fieldId: 'stage', value: 'Discover' }, { goalId: 'g3', fieldId: 'stage', value: 'Build' }];
      r.kept = filterGoals(goals, values, [{ field: STAGE, picked: pickedOf(STAGE, c.typed) }]).map((g) => g.id).join('|');
    } else if (c.rule === 'sheet') {
      r.field = 'Stage'; r.typed = 'Operate';
      const q = unknownValue(STAGE, 'Operate', c.rows, c.admin);
      r.problem = q.message; r.kept = q.choices.map(([k]) => k).join('|');
    }
    out.push(r);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] || '.';
  fs.mkdirSync(dir, { recursive: true });
  const head = ['rule', 'case', 'field', 'typed', 'kept', 'problem'];
  fs.writeFileSync(path.join(dir, 'tags.csv'), [head.join(','), ...rows().map((r) => head.map((h) => csv(r[h])).join(','))].join('\n') + '\n');
}
