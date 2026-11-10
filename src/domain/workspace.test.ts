// @vitest-environment node
/* The Workspace rework (backlog WS, outside review of 9 Nov): the rules behind what Workspace says about cycles, teams and
   the workspace's name, so each says something true. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { NotAllowed, teamPeople, type ActionContext } from './actions';
import { currentCycle, scopeToCycle } from './cycle';
import { currentWeek } from './plan';
import { cycleStanding, leaveWorkspace } from './removal';
import { adminsLine, cycleWhen, workspaceName, workspaceNeeds, yearLine } from './workspaceAttention';
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
    expect(st.says).toMatch(/^\d+ goals, \d{1,3}(,\d{3})* check-ins: it stays$/);
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

describe('what an admin has to sort out (app redesign WR2, rule 3)', () => {
  const cycle = s.cycles[0]!;
  const live = scopeToCycle(s, cycle);
  it('the example on 11 November: nothing, for an admin or a member', () => {
    expect(workspaceNeeds(live, cycle, true)).toEqual([]);
    expect(workspaceNeeds(live, cycle, false)).toEqual([]);
  });
  it('a workspace just set up: two people, one team with no lead, goals and a review: nothing', () => {
    const fresh = { people: [{ ...live.people[0]!, id: 'rosa', admin: true, teamId: 'field' }, { ...live.people[1]!, id: 'omar', admin: false, teamId: 'field' }], teams: [{ id: 'field', name: 'Field', leadId: '', objective: '' }], goals: live.goals.slice(0, 4), reviews: live.reviews.slice(0, 1) };
    expect(workspaceNeeds(fresh, cycle, true)).toEqual([]);
  });
  it('a year on, 12 people, still one admin, three without an email: only-admin, then no-email', () => {
    const people = live.people.slice(0, 12).map((p, i) => ({ ...p, admin: i === 0, email: i < 3 ? undefined : p.email, teamId: live.teams[0]!.id }));
    const grown = { people, teams: [{ ...live.teams[0]!, leadId: people[0]!.id }], goals: live.goals, reviews: live.reviews };
    const out = workspaceNeeds(grown, cycle, true);
    expect(out.map((x) => x.id)).toEqual(['only-admin', 'no-email']);
    expect(out[1]).toMatchObject({ says: '3 people have no email', action: 'Add them', to: '/people?emails=1' });
    expect(workspaceNeeds({ ...grown, people: people.map((p, i) => ({ ...p, email: i ? p.email ?? 'x@y.z' : undefined })) }, cycle, true).find((x) => x.id === 'no-email')?.says).toBe('1 person has no email');
  });
  it('lists everything in order, for admins only', () => {
    const bare = { people: live.people.slice(0, 6).map((p, i) => ({ ...p, admin: i === 0, email: undefined, teamId: i < 2 ? null : 'big' })), teams: [{ id: 'big', name: 'Big', leadId: '', objective: '' }], goals: [], reviews: [] };
    expect(workspaceNeeds(bare, cycle, true).map((x) => x.id)).toEqual(['no-goals', 'no-review', 'only-admin', 'no-email', 'no-team', 'no-lead']);
    expect(workspaceNeeds(bare, cycle, false)).toEqual([]);
  });
});

describe('the workspace in words (rules 1, 2 and 6)', () => {
  it('names a workspace without the example’s own prefix, with its kind', () => {
    expect(workspaceName({ name: 'Example: Platform Engineering', kind: 'example' }, 'demo')).toEqual({ name: 'Platform Engineering', kind: 'example data' });
    expect(workspaceName({ name: 'Field Operations', kind: 'own' }, 'demo')).toEqual({ name: 'Field Operations', kind: 'kept in this browser' });
    expect(workspaceName({ name: 'Growth', kind: 'own' }, 'live')).toEqual({ name: 'Growth', kind: '' });
    expect(workspaceName({ name: 'Example: Tests', kind: 'own' }, 'live').name).toBe('Example: Tests');
  });
  it('says the admins as a sentence, A to Z, with a count beyond three', () => {
    const a = (names: string[]) => names.map((name) => ({ name, admin: true }));
    expect(adminsLine(a(['Rosa Lind']))).toBe('Rosa Lind');
    expect(adminsLine(a(['Grace Achterberg', 'Amara Nwosu']))).toBe('Amara Nwosu and Grace Achterberg');
    expect(adminsLine(a(['Hamid Rezaei', 'Amara Nwosu', 'Grace Achterberg']))).toBe('Amara Nwosu, Grace Achterberg and Hamid Rezaei');
    const forty = a(['Aiko Suzuki', 'Akosua Owusu', ...Array.from({ length: 38 }, (_, i) => `Zed ${String(i).padStart(2, '0')}`)]);
    expect(adminsLine(forty)).toBe('Aiko Suzuki, Akosua Owusu and 38 others');
    expect(adminsLine([{ name: 'Not one', admin: false }])).toBe('');
  });
  it('says where the year stands, and when its wrap-up opens', () => {
    const c = { name: '2026', startDate: '2025-12-22', weeks: 53 };
    expect(yearLine(c, 47, new Date('2026-11-11T12:00:00Z'), 30)).toBe('2026, week 47 of 53. The wrap-up opens on 14 Dec 2026.');
    expect(yearLine(c, 52, new Date('2026-12-15T12:00:00Z'), 31)).toBe('2026, week 52 of 53. The wrap-up is open: 31 goals still to wrap up.');
    expect(yearLine(c, 53, new Date('2026-12-22T12:00:00Z'), 0)).toBe('2026, week 53 of 53. The wrap-up is open: every goal is wrapped up.');
    expect(yearLine({ name: '2027', startDate: '2027-01-04', weeks: 52 }, 1, new Date('2026-11-11T12:00:00Z'), 0)).toBe('2027 starts on 4 Jan 2027.');
  });
});

describe('a cycle’s dates (backlog WS)', () => {
  it('gives a cycle’s dates and where it stands', () => {
    expect(cycleWhen({ startDate: '2025-12-22', weeks: 53 }, true, 45, today)).toEqual({ dates: '22 Dec 2025 to 27 Dec 2026, 53 weeks', now: 'Running: week 45 of 53' });
    expect(cycleWhen({ startDate: '2026-12-28', weeks: 52 }, false, 45, today).now).toBe('Starts 28 Dec 2026');
    expect(cycleWhen({ startDate: '2024-12-23', weeks: 52 }, false, 45, today).now).toBe('Over');
  });
});
