// @vitest-environment node
/* One way to run an action (AR3): the dispatcher's table is the command port's list of actions, both ways, so the
   rebuild's page (spec/rebuild/ports-at-scale.md) can't drift from the code; and an action run by name, with records
   named by id, does what the rule does. */
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed } from '../domain/actions';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import { commandNames } from '../spec/rebuild';
import { actionNames, commitOf, loadEngine, MODULE_ACTIONS, perform, performAny, type RunContext } from './actions';

const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_t${++n}`;

function as(who: string): RunContext {
  const full = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const snapshot = scopeToCycle(full, cycle);
  const actor = full.people.find((p) => p.id === who)!;
  return { snapshot, cycle, week: currentWeek(cycle, today), actor, now: '2026-11-05T13:00:00Z', newId, allGoals: full.goals, full, workspace: { id: 'w', name: 'Platform' }, modules: [] };
}

describe('one way to run an action', () => {
  it('has every action the command port lists, and nothing the list leaves out', () => {
    // The core's and every module's (the metric library registers its four through its actions.ts).
    expect(actionNames().sort()).toEqual([...commandNames()].sort());
  });

  it('runs a rule by name, with the goal named by its id or its key', () => {
    const x = as('rhea');
    const goal = x.snapshot.goals[0]!;
    for (const ref of [goal.id, goal.key!]) {
      const c = perform(x, 'addNote', { goalId: ref, text: 'Looks good' });
      expect(c.changes[0]).toMatchObject({ goalId: goal.id, actorId: 'rhea', at: x.now });
      expect(commitOf('addNote', c, {})).toBe(c);
    }
  });

  it('runs a module’s action from the same table, as its module says, and refuses it while the module is off', () => {
    expect(MODULE_ACTIONS.saveMetric?.module).toBe('metrics');
    const x = as('oskar');
    const out = performAny(x, 'saveMetric', { name: 'Build time', unit: 'min', direction: 'lower' }) as { commit: unknown; metric: { name: string } };
    expect(out.metric.name).toBe('Build time');
    expect(commitOf('saveMetric', out, {})).toBe(out.commit);
    expect(() => performAny({ ...x, workspace: { ...x.workspace, modulesOff: ['metrics'] } }, 'saveMetric', { name: 'Build time', unit: 'min', direction: 'lower' })).toThrow(/switched off/);
    expect(() => performAny(x, 'noSuchAction', {})).toThrow(/no action called noSuchAction/);
  });

  it('refuses what the rule refuses, in the rule’s words', () => {
    const x = as('rhea');
    const notMine = x.snapshot.goals.find((g) => g.ownerId !== 'rhea')!;
    const someone = x.snapshot.people.find((p) => !p.admin && p.id !== notMine.ownerId)!;
    expect(() => perform(as(someone.id), 'stopGoal', { goalId: notMine.id, reason: 'Not needed' })).toThrow(NotAllowed);
    expect(() => perform(x, 'addNote', { goalId: 'no-such-goal', text: 'Hi' })).toThrow(/no longer exists/);
  });

  it('previews a change set without saving it, and saves it only when asked to apply', async () => {
    await loadEngine();
    const x = as('rhea');
    const goal = x.snapshot.goals.find((g) => g.ownerId === 'rhea')!;
    const input = { tables: { goals: [{ __row: '2', id: goal.id, goal: `${goal.title}, renamed` }] }, via: 'bulk' as const };
    const cs = perform(x, 'planChanges', input);
    expect(cs.commit).not.toBeNull();
    expect(commitOf('planChanges', cs, input)).toBeNull();
    expect(commitOf('planChanges', cs, { ...input, apply: true })).toBe(cs.commit);
  });
});
