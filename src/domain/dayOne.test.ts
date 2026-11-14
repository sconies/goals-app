/* Day one (app redesign OB3): docs/design/onboarding/spec.md rule 7 and set-up's steps (set-up spec rule S1, small
   workspaces rule 3), each worked example a case. */
import { arrived, creatorOf, gettingStarted, invitedTo, inviteLink, draftStep, firstUnfilled, SETUP_STEPS, stepCounter, type DayOneFacts } from './dayOne';
import { arrivalIntro, arrivalLine, draftStopped, howWeWork, readInvitation } from './arrival';
import { arrive } from './actions';
import type { Goal, Person, Snapshot } from './types';
import { dayOneRows } from '../app/reads';

describe('set-up’s steps (rule S1, small workspaces rule 3)', () => {
  const me = { name: 'Ana Silva', email: 'ana@example.com', team: 'Platform' };
  const done = { name: 'Platform Engineering', me, start: 'own', goals: 2, file: false };
  it('is four steps, whatever way to start is chosen', () => {
    expect(SETUP_STEPS).toEqual(['workspace', 'people', 'goals', 'check']);
    expect(stepCounter('check')).toBe('Step 4 of 4');
    expect(stepCounter('people')).toBe('Step 2 of 4');
  });
  it('sends a later step’s address back to the first step with something missing', () => {
    expect(firstUnfilled({ ...done, name: '' })).toBe('workspace');
    expect(firstUnfilled({ ...done, me: { ...me, email: ' ' } })).toBe('workspace');
    // A name or email step 1 would refuse, reached by Forward or a typed address (build review of #475).
    expect(firstUnfilled({ ...done, name: 'ab' })).toBe('workspace');
    expect(firstUnfilled({ ...done, name: 'x'.repeat(83) })).toBe('workspace');
    expect(firstUnfilled({ ...done, me: { ...me, email: 'not an email' } })).toBe('workspace');
    expect(firstUnfilled({ ...done, goals: 0 })).toBe('goals');
    expect(firstUnfilled({ ...done, start: 'file', goals: 0 })).toBe('goals');
    expect(firstUnfilled({ ...done, start: 'file', goals: 0, file: true })).toBeNull();
    expect(firstUnfilled({ ...done, start: 'later', goals: 0 })).toBeNull();
    // A draft from before held a template's id: it counts as "Add your own".
    expect(firstUnfilled({ ...done, start: 'product', goals: 0 })).toBe('goals');
    expect(firstUnfilled(done)).toBeNull();
  });
  it('opens a draft from before the four steps at the step its answers moved to', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((step) => draftStep({ step }))).toEqual(['workspace', 'workspace', 'people', 'goals', 'goals', 'goals', 'check']);
    expect(draftStep({ step: 1, v: 2 })).toBe('people');
    expect(draftStep({ step: 9, v: 2 })).toBe('check');
  });
  it('says how you’ll work in one paragraph, and whether it is still the usual', () => {
    expect(howWeWork({ reviewDay: 3, startMonth: 0, recording: false })).toEqual({ says: 'Check-ins every week, by Thursday. A weekly review on Thursdays. The year starts in January. Recording is off.', usual: true });
    expect(howWeWork({ reviewDay: 0, startMonth: 3, recording: true })).toEqual({ says: 'Check-ins every week, by Monday. A weekly review on Mondays. The year starts in April. Recording is on.', usual: false });
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
    changes: [{ id: 'c', at: made, actorId: 'ana', goalId: null, entity: 'workspace', entityId: 'w', action: 'imported', summary: 'Created “Field Operations” with 2 people', diffs: [] }],
  });
  const seen: DayOneFacts = { firstSeenAt: made };
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it('who set it up is read from the change set-up writes, even with another admin listed first (review of #285)', () => {
    // createWorkspace (src/app/state.tsx) logs the workspace as `imported`, "Created “…” with …".
    const s = base([], [person('zoe', 'Zoe Admin', true), person('ana', 'Ana Silva', true), person('ben', 'Ben Ortiz')]);
    expect(creatorOf(s.changes, s.people)).toBe('ana');
    // An import into a workspace that was already there names no one: the first admin, as before.
    expect(creatorOf([{ entity: 'workspace', action: 'imported', summary: 'Imported goals.csv', actorId: 'ben' }], s.people)).toBe('zoe');
  });

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
    expect(draftStopped({ step: 1, v: 2, savedAt: '2026-11-09T15:00:00Z' })).toBe('Stopped at step 2 of 4, People, on 9 Nov. Nothing is saved yet.');
    expect(draftStopped({ step: 6 })).toBe('Stopped at step 4 of 4, Check. Nothing is saved yet.');
  });
});
