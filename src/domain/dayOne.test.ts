/* Day one (app redesign OB3): docs/design/onboarding/spec.md rules 6 and 7, each worked example a case. */
import { arrived, creatorOf, gettingStarted, invitedTo, inviteLink, setupSteps, stepCounter, type DayOneFacts } from './dayOne';
import { arrivalIntro, arrivalLine, draftStopped, readInvitation } from './arrival';
import { arrive } from './actions';
import type { Goal, Person, Snapshot } from './types';
import { dayOneRows } from '../app/reads';

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
    expect(creatorOf(s.changes, s.people)).toBe('ana');
    const rows = gettingStarted('ana', dayOneRows(s), ws, { ...seen, unowned: ['g2', 'g3'] }, now, 'Thursday');
    expect(ids(rows)).toEqual(['first-check-in', 'assign', 'invite']);
    expect(rows[0]!.says).toBe('Post your first check-ins. They’re due by Thursday.');
    expect(rows[1]!.says).toBe('Give 2 goals an owner.');
  });
  it('Ben opens it for the first time: who set it up and what’s his', () => {
    const s = base([goal('g1', 'ana'), goal('g4', 'ben')]);
    const rows = gettingStarted('ben', dayOneRows(s), ws, { firstSeenAt: '2026-11-11T14:00:00Z' }, now, 'Thursday');
    expect(ids(rows)).toEqual(['welcome', 'first-check-in']);
    expect(rows[0]!.says).toBe('Ana Silva set up Field Operations on 11 Nov and gave you 1 goal.');
    expect(rows[1]!.says).toBe('Post your first check-in. It’s due by Thursday.');
  });
  it('Ben owning none: see, watch and set up a goal', () => {
    const rows = gettingStarted('ben', dayOneRows(base([goal('g1', 'ana')])), ws, seen, now, 'Thursday');
    expect(ids(rows)).toEqual(['welcome', 'see-goals', 'watch', 'own-goal']);
    expect(rows[0]!.says).toBe('Ana Silva set up Field Operations on 11 Nov.');
  });
  it('Ana alone, goals set up later: add people, then the first goal', () => {
    expect(ids(gettingStarted('ana', dayOneRows(base([], [person('ana', 'Ana Silva', true)])), ws, seen, now, 'Thursday'))).toEqual(['add-people', 'first-goal']);
  });
  it('once there is a second person, no add-people; a copied link, no invite', () => {
    const rows = gettingStarted('ana', dayOneRows(base([goal('g1', 'ben')])), ws, { ...seen, inviteCopied: true }, now, 'Thursday');
    expect(ids(rows)).toEqual([]);
  });
  it('a goal given an owner leaves the assign count', () => {
    const rows = gettingStarted('ana', dayOneRows(base([goal('g1', 'ana'), goal('g2', 'ben')])), ws, { ...seen, unowned: ['g1', 'g2'], inviteCopied: true }, now, 'Thursday');
    expect(rows.find((r) => r.id === 'assign')?.says).toBe('Give 1 goal an owner.');
  });
  it('nothing 15 days on, when hidden, or in the example', () => {
    const s = base([goal('g1', 'ana')]);
    expect(gettingStarted('ana', dayOneRows(s), ws, seen, new Date('2026-11-26T15:00:00Z'), 'Thursday')).toEqual([]);
    expect(gettingStarted('ana', dayOneRows(s), ws, { ...seen, hidden: true }, now, 'Thursday')).toEqual([]);
    expect(gettingStarted('ana', dayOneRows(s), { ...ws, kind: 'example' }, seen, now, 'Thursday')).toEqual([]);
  });
  it('asks for no first check-in once the year has ended (cycle-end rule 2)', () => {
    const rows = gettingStarted('ben', { ...dayOneRows(base([goal('g1', 'ben')])), ended: true }, ws, seen, now, 'Thursday');
    expect(rows.some((r) => r.id === 'first-check-in')).toBe(false);
  });
});

describe('Welcome and the arrival (set-up spec ST1: 2.1, 2.8, rules S4 and S9)', () => {
  const ana = { id: 'ana', name: 'Ana Silva', admin: true }, ben = { id: 'ben', name: 'Ben Carter', admin: false }, cara = { id: 'cara', name: 'Cara Diaz', admin: false };
  const made = { entity: 'workspace' as const, action: 'created' as const, entityId: 'ws', summary: 'Created “Field Operations”', actorId: 'ana' };

  it('the invitation is /join/<workspace>, under /demo in the demo (rule S9)', () => {
    expect(inviteLink('https://faro.example', 'live', 'ws_n0g3rv')).toBe('https://faro.example/join/ws_n0g3rv');
    expect(inviteLink('https://faro.example', 'demo', 'ws_n0g3rv')).toBe('https://faro.example/demo/join/ws_n0g3rv');
  });

  it('reads the workspace an address invites to: /join/<id>, or the old /?workspace=<id>', () => {
    expect(invitedTo('/join/ws_a', '')).toBe('ws_a');
    expect(invitedTo('/demo/join/ws_a', '?today=2026-11-11')).toBe('ws_a');
    expect(invitedTo('/', '?workspace=ws_b&store=browser')).toBe('ws_b');
    expect(invitedTo('/goals', '')).toBeNull();
  });

  it('takes a pasted invitation to this site, and says what isn’t one', () => {
    const o = 'https://faro.example';
    expect(readInvitation('https://faro.example/join/ws_a', o)).toEqual({ id: 'ws_a', demo: false });
    expect(readInvitation(' https://faro.example/demo/join/ws_a ', o)).toEqual({ id: 'ws_a', demo: true });
    expect(readInvitation('https://faro.example/?workspace=ws_b', o)).toEqual({ id: 'ws_b', demo: false });
    const no = { problem: 'That isn’t a Faro invitation. It looks like https://faro.example/join/…' };
    expect(readInvitation('https://elsewhere.example/join/ws_a', o)).toEqual(no);
    expect(readInvitation('https://faro.example/goals', o)).toEqual(no);
    expect(readInvitation('', o)).toEqual(no);
  });

  it('says one true line under each name, and who set it up, on the arrival (2.8)', () => {
    expect(arrivalLine(ana, 'ana', 2)).toBe('Set this up · admin');
    expect(arrivalLine({ id: 'dev', admin: true }, 'ana', 0)).toBe('Admin');
    expect(arrivalLine(ben, 'ana', 1)).toBe('Owns 1 goal');
    expect(arrivalLine(cara, 'ana', 0)).toBe('No goals yet');
    expect(arrivalIntro({ name: 'Field Operations', createdAt: '2026-11-11T10:00:00Z' }, 'Ana Silva', 3, 3)).toBe('Ana Silva set this up on 11 Nov to keep the team’s goals in one place: 3 people, 3 goals.');
    expect(arrivalIntro({ name: 'Field Operations', createdAt: '2026-11-11T10:00:00Z' }, 'Ana Silva', 1, 0)).toBe('Ana Silva set this up on 11 Nov to keep the team’s goals in one place: 1 person, no goals yet.');
  });

  it('a person has arrived once the log has their arrival; whoever set it up has (rule S4)', () => {
    expect(arrived('ana', [made], [ana, ben])).toBe(true);
    expect(arrived('ben', [made], [ana, ben])).toBe(false);
    expect(arrived('ben', [made, { entity: 'person', action: 'acknowledged', entityId: 'ben', summary: 'Ben Carter opened Field Operations for the first time', actorId: 'ben' }], [ana, ben])).toBe(true);
  });

  it('logs the arrival once, as the person who arrived, and changes no record', () => {
    const people = [ana, ben].map((p) => ({ ...p, role: '', initials: '', teamId: 't' })) as Person[];
    const x = (actor: Person, changes: unknown[]) => ({ snapshot: { people, changes } as unknown as Snapshot, cycle: {} as never, week: 46, actor, now: '2026-11-12T09:00:00Z', newId: (p: string) => `${p}_1` });
    const first = arrive(x(people[1]!, [made]), { name: 'Field Operations' })!;
    expect(Object.keys(first)).toEqual(['changes']);
    expect(first.changes[0]).toMatchObject({ actorId: 'ben', entity: 'person', entityId: 'ben', action: 'acknowledged', summary: 'Ben Carter opened Field Operations for the first time' });
    expect(arrive(x(people[1]!, [made, first.changes[0]]), { name: 'Field Operations' })).toBeNull();
    expect(arrive(x(people[0]!, [made]), { name: 'Field Operations' })).toBeNull();
  });

  it('says where a set-up left unfinished stopped (Welcome, 2.1)', () => {
    expect(draftStopped({ step: 2, template: '', savedAt: '2026-11-09T15:00:00Z' })).toBe('Stopped at step 3, Your team, on 9 Nov. Nothing is saved yet.');
    expect(draftStopped({ step: 6, template: 'later' })).toBe('Stopped at step 5 of 5, Check. Nothing is saved yet.');
  });
});
