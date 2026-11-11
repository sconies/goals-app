/* Day one (app redesign OB3): docs/design/onboarding/spec.md rules 6 and 7, each worked example a case. */
import { creatorOf, gettingStarted, setupSteps, stepCounter, type DayOneFacts } from './dayOne';
import type { Goal, Person, Snapshot } from './types';

describe('set-up’s steps (rule 6)', () => {
  it('counts the path chosen', () => {
    expect(setupSteps('product')).toHaveLength(7);
    expect(setupSteps('blank')).toHaveLength(7);
    expect(setupSteps('later')).toEqual(['workspace', 'you', 'team', 'start', 'check']);
    expect(setupSteps('file')).toHaveLength(5);
    expect(stepCounter('check', 'product')).toBe('Step 7 of 7');
    expect(stepCounter('check', 'later')).toBe('Step 5 of 5');
    expect(stepCounter('you', '')).toBe('Step 2');
  });
});

describe('getting started (rule 7)', () => {
  const person = (id: string, name: string, admin = false): Person => ({ id, name, role: '', initials: name.slice(0, 2).toUpperCase(), teamId: 't', admin, email: `${id}@x.com` });
  const goal = (id: string, ownerId: string): Goal => ({ id, ownerId, title: id } as unknown as Goal);
  const made = '2026-11-11T09:00:00Z';
  const now = new Date('2026-11-11T15:00:00Z');
  const ws = { name: 'Field Operations', kind: 'own', createdAt: made };
  const base = (goals: Goal[], people = [person('ana', 'Ana Silva', true), person('ben', 'Ben Ortiz')]): Pick<Snapshot, 'people' | 'goals' | 'checkIns' | 'watches' | 'changes'> => ({
    people, goals, checkIns: [], watches: [],
    changes: [{ id: 'c', at: made, actorId: 'ana', goalId: null, entity: 'workspace', entityId: 'w', action: 'created', summary: 'Created “Field Operations” with 2 people', diffs: [] }],
  });
  const seen: DayOneFacts = { firstSeenAt: made };
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it('Ana set it up with Ben, gave Ben one goal and left two unowned', () => {
    const s = base([goal('g1', 'ana'), goal('g2', 'ana'), goal('g3', 'ana'), goal('g4', 'ben')]);
    expect(creatorOf(s)).toBe('ana');
    const rows = gettingStarted('ana', s, ws, { ...seen, unowned: ['g2', 'g3'] }, now, 'Thursday');
    expect(ids(rows)).toEqual(['first-check-in', 'assign', 'invite']);
    expect(rows[0]!.says).toBe('Post your first check-ins. They’re due by Thursday.');
    expect(rows[1]!.says).toBe('Give 2 goals an owner.');
  });
  it('Ben opens it for the first time: who set it up and what’s his', () => {
    const s = base([goal('g1', 'ana'), goal('g4', 'ben')]);
    const rows = gettingStarted('ben', s, ws, { firstSeenAt: '2026-11-11T14:00:00Z' }, now, 'Thursday');
    expect(ids(rows)).toEqual(['welcome', 'first-check-in']);
    expect(rows[0]!.says).toBe('Ana Silva set up Field Operations on 11 Nov and gave you 1 goal.');
    expect(rows[1]!.says).toBe('Post your first check-in. It’s due by Thursday.');
  });
  it('Ben owning none: see, watch and set up a goal', () => {
    const rows = gettingStarted('ben', base([goal('g1', 'ana')]), ws, seen, now, 'Thursday');
    expect(ids(rows)).toEqual(['welcome', 'see-goals', 'watch', 'own-goal']);
    expect(rows[0]!.says).toBe('Ana Silva set up Field Operations on 11 Nov.');
  });
  it('Ana alone, goals set up later: add people, then the first goal', () => {
    expect(ids(gettingStarted('ana', base([], [person('ana', 'Ana Silva', true)]), ws, seen, now, 'Thursday'))).toEqual(['add-people', 'first-goal']);
  });
  it('once there is a second person, no add-people; a copied link, no invite', () => {
    const rows = gettingStarted('ana', base([goal('g1', 'ben')]), ws, { ...seen, inviteCopied: true }, now, 'Thursday');
    expect(ids(rows)).toEqual([]);
  });
  it('a goal given an owner leaves the assign count', () => {
    const rows = gettingStarted('ana', base([goal('g1', 'ana'), goal('g2', 'ben')]), ws, { ...seen, unowned: ['g1', 'g2'], inviteCopied: true }, now, 'Thursday');
    expect(rows.find((r) => r.id === 'assign')?.says).toBe('Give 1 goal an owner.');
  });
  it('nothing 15 days on, when hidden, or in the example', () => {
    const s = base([goal('g1', 'ana')]);
    expect(gettingStarted('ana', s, ws, seen, new Date('2026-11-26T15:00:00Z'), 'Thursday')).toEqual([]);
    expect(gettingStarted('ana', s, ws, { ...seen, hidden: true }, now, 'Thursday')).toEqual([]);
    expect(gettingStarted('ana', s, { ...ws, kind: 'example' }, seen, now, 'Thursday')).toEqual([]);
  });
});
