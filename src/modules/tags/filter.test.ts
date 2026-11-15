/* Tags' rule 3 (TG2, spec section 5): filterGoals, and the filter's text a link and a saved view carry. Each worked
   example on the module's spec page (spec.ts, tags-filter) is a case here. */
import { describe, expect, it } from 'vitest';
import { filterGoals, NOT_SET, pickedOf, pickedText } from './filter';
import { fieldProblem, type GoalField } from './rules';

const stage: GoalField = { id: 'stage', name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'], position: 0 };
const area: GoalField = { id: 'area', name: 'Programme', kind: 'list', options: ['Data, AI', 'Data', 'Cloud'], position: 1 };
const goals = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }, { id: 'g4' }];
const v = (goalId: string, fieldId: string, value: string, removedAt: string | null = null) => ({ goalId, fieldId, value, removedAt });
const values = [v('g1', 'stage', 'Build'), v('g2', 'stage', 'Discover'), v('g3', 'stage', 'Build'), v('g3', 'area', 'Cloud'), v('g4', 'stage', 'Run', '2026-11-01'), v('g2', 'area', '')];
const ids = (gs: { id: string }[]) => gs.map((g) => g.id);

describe('filterGoals (rule 3)', () => {
  it('keeps the goals whose value is one of those picked, whatever the case', () => {
    expect(ids(filterGoals(goals, values, { stage: ['Build'] }))).toEqual(['g1', 'g3']);
    expect(ids(filterGoals(goals, values, { stage: ['build', 'discover'] }))).toEqual(['g1', 'g2', 'g3']);
  });
  it('matches “Not set” to a goal with no value, a cleared one, or one taken away', () => {
    expect(ids(filterGoals(goals, values, { stage: [NOT_SET] }))).toEqual(['g4']);
    expect(ids(filterGoals(goals, values, { area: [NOT_SET] }))).toEqual(['g1', 'g2', 'g4']);
  });
  it('a goal matches every field filtered; a field with nothing picked filters nothing', () => {
    expect(ids(filterGoals(goals, values, { stage: ['Build'], area: ['Cloud'] }))).toEqual(['g3']);
    expect(ids(filterGoals(goals, values, { stage: ['Build'], area: [] }))).toEqual(['g1', 'g3']);
    expect(ids(filterGoals(goals, values, {}))).toEqual(['g1', 'g2', 'g3', 'g4']);
  });
});

describe('a filter’s text (the link and the saved view)', () => {
  it('reads the values a list holds, a value with a comma in it as one, and leaves out what it doesn’t hold', () => {
    expect(pickedOf(stage, 'Build,Run')).toEqual(['Build', 'Run']);
    expect(pickedOf(stage, 'build, not set,Operate')).toEqual(['Build', NOT_SET]);
    expect(pickedOf(area, 'Data, AI,Data')).toEqual(['Data, AI', 'Data']);
    expect(pickedOf(stage, 'Operate')).toEqual([]);
  });
  it('writes the values picked in the list’s order, Not set last', () => {
    expect(pickedText(stage, [NOT_SET, 'Run', 'Discover'])).toBe('Discover,Run,Not set');
    expect(pickedOf(area, pickedText(area, ['Data', 'Data, AI']))).toEqual(['Data, AI', 'Data']);
  });
  it('a list can’t hold a value called “Not set”', () => {
    expect(fieldProblem({ ...stage, options: ['Discover', 'not set'] }, [])).toBe('“Not set” is what a goal with no value says. Call the value something else.');
  });
});
