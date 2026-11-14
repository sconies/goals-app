/* Tags' rules 1 and 2 (docs/design/round-4/tags/spec.md section 5), each worked example a case. */
import { describe, expect, it } from 'vitest';
import { fieldProblem, valueProblem, type GoalField } from './rules';

const stage: GoalField = { id: 'f1', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'], position: 0 };
const notes: GoalField = { id: 'f2', name: 'Programme', kind: 'text', options: [], position: 1 };

describe('a field (rule 1)', () => {
  it('needs a name of 1 to 40 characters that no other live field has', () => {
    expect(fieldProblem({ ...stage, name: '  ' }, [])).toBe('Give the field a name.');
    expect(fieldProblem({ ...stage, name: 'x'.repeat(41) }, [])).toBe('Keep the name to 40 characters.');
    expect(fieldProblem({ ...stage, id: 'new', name: 'stage ' }, [stage])).toBe('There’s already a field called “Stage”.');
    // A retired field's name may be used again, and a field is never its own duplicate.
    expect(fieldProblem({ ...stage, id: 'new' }, [{ ...stage, retiredAt: '2026-11-01' }])).toBeNull();
    expect(fieldProblem(stage, [stage])).toBeNull();
  });
  it('holds at most six live fields', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, name: `Field ${i}`, retiredAt: null }));
    expect(fieldProblem({ ...notes, id: 'new', name: 'Region' }, six)).toBe('A workspace has at most 6 fields. Retire one first.');
    expect(fieldProblem({ ...notes, id: 'f3', name: 'Field 3' }, six)).toBeNull();
    expect(fieldProblem({ ...notes, id: 'new', name: 'Region' }, six.map((f, i) => (i ? f : { ...f, retiredAt: '2026-11-01' })))).toBeNull();
  });
  it('gives a list 1 to 20 distinct values of 1 to 40 characters', () => {
    expect(fieldProblem({ ...stage, options: [] }, [])).toBe('A list needs at least one value.');
    expect(fieldProblem({ ...stage, options: ['Build', ' '] }, [])).toBe('Remove the empty value, or type one.');
    expect(fieldProblem({ ...stage, options: Array.from({ length: 21 }, (_, i) => `V${i}`) }, [])).toBe('A list holds at most 20 values.');
    expect(fieldProblem({ ...stage, options: ['Build', 'y'.repeat(41)] }, [])).toBe(`Keep each value to 40 characters: “${'y'.repeat(20)}…” is longer.`);
    expect(fieldProblem({ ...stage, options: ['Build', 'build'] }, [])).toBe('“build” is in the list twice.');
    expect(fieldProblem(notes, [])).toBeNull();
  });
  it('gives free text no values (migration 0054 holds the same)', () => {
    expect(fieldProblem({ ...notes, options: ['Build'] }, [])).toBe('A free-text field has no values: choose A list of values, or leave the values out.');
  });
});

describe('a goal’s value (rule 2)', () => {
  it('keeps a list’s value as the list writes it, and refuses one it doesn’t hold', () => {
    expect(valueProblem(stage, ' build ')).toEqual({ value: 'Build' });
    expect(valueProblem(stage, 'Operate')).toEqual({ problem: '“Operate” isn’t one of Stage’s values: Discover, Build or Run.' });
  });
  it('clears with an empty value, and keeps free text to 80 characters', () => {
    expect(valueProblem(stage, '  ')).toEqual({ value: '' });
    expect(valueProblem(notes, 'Payments rebuild')).toEqual({ value: 'Payments rebuild' });
    expect(valueProblem(notes, 'z'.repeat(81))).toEqual({ problem: 'Keep Programme to 80 characters.' });
  });
});
