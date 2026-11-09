// @vitest-environment node
/* The Workspace rework (backlog WS, outside review of 9 Nov): the rules behind what Workspace says about cycles, teams and
   the workspace's name, so each says something true. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed, teamPeople, type ActionContext } from './actions';
import { currentCycle, scopeToCycle } from './cycle';
import { currentWeek } from './plan';
import { cycleStanding, leaveWorkspace } from './removal';
import { MAX_WORKSPACE_NAME, nameLength, nameProblem } from './thresholds';
import type { Snapshot } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);

describe('a cycle’s standing (backlog WS)', () => {
  it('says a brand-new workspace’s only cycle has no goals and no check-ins, and stays because it is the only one', () => {
    const fresh: Snapshot = { ...s, goals: [], checkIns: [], cycles: [s.cycles[0]!] };
    const st = cycleStanding(fresh, s.cycles[0]!.id);
    expect(st).toMatchObject({ goals: 0, checkIns: 0, only: true, deletable: false });
    expect(st.says).toBe('No goals and no check-ins yet; it’s the only cycle, so it stays');
  });
  it('counts the goals and check-ins of a cycle that has them, which stays', () => {
    const st = cycleStanding(s, s.cycles[0]!.id);
    expect(st.checkIns).toBeGreaterThan(0);
    expect(st.deletable).toBe(false);
    expect(st.says).toMatch(/^\d+ goals, \d+ check-ins: it stays$/);
  });
  it('lets a second cycle nobody has checked in to be deleted', () => {
    const next = { ...s.cycles[0]!, id: 'c_next', name: '2027' };
    const st = cycleStanding({ ...s, cycles: [...s.cycles, next] }, 'c_next');
    expect(st).toMatchObject({ goals: 0, checkIns: 0, only: false, deletable: true, says: 'No goals and no check-ins yet: it can be deleted' });
  });
});

describe('a team’s people (backlog WS)', () => {
  it('counts the lead as one of the team’s people, even when their own team is another', () => {
    const team = s.teams[0]!;
    const outsider = s.people.find((p) => p.teamId !== team.id)!;
    const led = { ...s, teams: s.teams.map((t) => (t.id === team.id ? { ...t, leadId: outsider.id } : t)) };
    const people = teamPeople({ snapshot: led }, team.id);
    expect(people.map((p) => p.id)).toContain(outsider.id);
    expect(people.length).toBe(s.people.filter((p) => p.teamId === team.id).length + 1);
  });
  it('counts a lead who is in the team once', () => {
    const empty = { ...s, people: [s.people[0]!], teams: [{ ...s.teams[0]!, id: 't_new', name: 'New', leadId: s.people[0]!.id }] };
    expect(teamPeople({ snapshot: empty }, 't_new')).toHaveLength(1);
  });
});

describe('a workspace’s name (backlog WS)', () => {
  it('says the limit while typing near it, and refuses a longer name instead of cutting it', () => {
    expect(nameLength('Platform')).toBeNull();
    expect(nameLength('x'.repeat(MAX_WORKSPACE_NAME - 5))).toBe(`${MAX_WORKSPACE_NAME - 5} of ${MAX_WORKSPACE_NAME} characters`);
    expect(nameProblem('x'.repeat(MAX_WORKSPACE_NAME), 'workspace')).toBeNull();
    expect(nameProblem('x'.repeat(MAX_WORKSPACE_NAME + 3), 'workspace')).toBe(`Keep the name to ${MAX_WORKSPACE_NAME} characters or fewer: it has ${MAX_WORKSPACE_NAME + 3}.`);
    // Goals have no such limit here.
    expect(nameProblem('x'.repeat(120), 'goal')).toBeNull();
  });
});

describe('leaving a workspace yourself (backlog WS, Lane 9 Nov)', () => {
  const ctx = (snapshot: Snapshot, who: string): ActionContext => {
    const cycle = currentCycle(snapshot.cycles, today)!;
    return { snapshot: scopeToCycle(snapshot, cycle), cycle, week: currentWeek(cycle, today), actor: snapshot.people.find((p) => p.id === who)!, now: '2026-11-05T13:00:00.000Z', newId: (p) => `${p}_w`, allGoals: snapshot.goals, full: snapshot };
  };
  it('lets someone who isn’t an admin leave, handing over their goals, and logs it in their own words', () => {
    const rhea = s.people.find((p) => p.id === 'rhea')!;
    expect(rhea.admin).toBe(false);
    expect(() => leaveWorkspace(ctx(s, 'rhea'), {})).toThrow(/owns \d+ goals: choose who takes them over/);
    const c = leaveWorkspace(ctx(s, 'rhea'), { goalsTo: 'tariq', asksTo: 'tariq' });
    expect(c.people?.[0]).toMatchObject({ id: 'rhea', leftBy: 'rhea' });
    expect(c.goals?.every((g) => g.ownerId === 'tariq')).toBe(true);
    expect(c.changes[0]!.summary).toBe('Rhea Kapoor left the workspace');
  });
  it('refuses the only admin, and lets an admin leave while another stays', () => {
    const one = { ...s, people: s.people.map((p) => ({ ...p, admin: p.id === 'grace' })) };
    expect(() => leaveWorkspace(ctx(one, 'grace'), {})).toThrow(NotAllowed);
    expect(() => leaveWorkspace(ctx(one, 'grace'), {})).toThrow('You’re the only admin here: make someone else an admin before you leave.');
    expect(leaveWorkspace(ctx(s, 'grace'), { goalsTo: 'amara', asksTo: 'amara' }).people?.[0]?.id).toBe('grace');
  });
});
