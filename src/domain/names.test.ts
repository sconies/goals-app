// @vitest-environment node
/* Names (backlog N, 8 Nov): two goals may share a title and two people a name; Faro tells them apart instead of refusing. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { planChanges, type ChangeInput, type Rec } from './changeset';
import { buildWorkspace } from './importer';
import { currentWeek } from './plan';
import { avatarHues, AVATAR_HUES, duplicateTitles, goalTell, nameWithTell, personProblems, personTell, sameNameNote, sameTitleNote } from './people';
import { MIN_NAME, nameProblem } from './thresholds';
import type { Person } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const admin = s.people.find((p) => p.admin)!;
const teamName = (id: string) => s.teams.find((t) => t.id === id)?.name ?? '';
let n = 0;
const rec = (o: Record<string, string>): Rec => ({ __row: '2', ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
const base = (tables: ChangeInput['tables']): ChangeInput => ({ tables, snapshot: s, cycle, week, actor: admin, now: today.toISOString(), newId: (p) => `${p}_m${++n}`, via: 'table' });
const person = (o: Partial<Person>): Person => ({ id: 'x', name: 'Sam Lee', role: '', initials: 'SL', teamId: s.teams[0]!.id, admin: false, email: 'sam@example.com', ...o });

describe('people with the same name', () => {
  const sam1 = person({ id: 'sam1', teamId: s.teams[0]!.id, email: 'sam.lee@example.com' });
  const sam2 = person({ id: 'sam2', teamId: s.teams[1]!.id, email: 'sam.lee2@example.com' });
  const people = [...s.people, sam1];

  it('are allowed: the email is who someone is', () => {
    expect(personProblems(sam2, people, null)).toEqual([]);
    expect(sameNameNote(sam2, people, teamName)).toBe(`Sam Lee (${teamName(sam1.teamId!)}) is already here. That’s fine: their email tells you apart, and Faro shows a team or job title beside the name.`);
    expect(sameNameNote({ id: 'new', name: 'Nobody Else' }, people, teamName)).toBeNull();
  });

  it('are told apart by team, else job title, else email, wherever both could be on screen', () => {
    const both = [...people, sam2];
    expect(nameWithTell(sam1, both, teamName)).toBe(`Sam Lee (${teamName(sam1.teamId!)})`);
    expect(nameWithTell(admin, both, teamName)).toBe(admin.name);
    const sameTeam = [sam1, { ...sam2, teamId: sam1.teamId, role: 'Designer' }];
    expect(personTell(sameTeam[1]!, sameTeam, teamName)).toBe('Designer');
    expect(personTell({ ...sam2, teamId: sam1.teamId }, [sam1, { ...sam2, teamId: sam1.teamId }], teamName)).toBe('sam.lee2@example.com');
  });

  it('get avatar colours that differ when their initials match', () => {
    const many = Array.from({ length: AVATAR_HUES }, (_, k) => person({ id: 'p' + k, initials: 'SL' }));
    const hues = avatarHues(many);
    expect(new Set(many.map((p) => hues.get(p.id))).size).toBe(AVATAR_HUES);
    expect(avatarHues(many).get('p3')).toBe(hues.get('p3'));
  });

  it('can be set up together, with a note on the second one’s row', () => {
    const people = 'Name\tEmail\tTeam\tAdmin\nGrace Achterberg\tgrace@example.com\tLeadership\tyes\nGrace Achterberg\t\tLeadership\t\n';
    const r = buildWorkspace({ name: 'Two Graces', startDate: '2026-01-05', people, goals: '', now: today, idSuffix: 'graces' });
    expect(r.notes?.find((x) => x.table === 'People' && x.row === 3)?.message).toMatch(/Grace Achterberg \(Leadership\) is already here/);
  });

  it('can be added by spreadsheet, with a note', () => {
    // Someone here already has the name: asked, once (C9). "Someone new" adds them; "the same person" gives them the email.
    const t = { people: [rec({ Name: admin.name, Email: 'another.one@example.com', Team: teamName(admin.teamId!) })] };
    const cs = planChanges(base(t));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.groups).toEqual([expect.objectContaining({ kind: 'same-person', level: 'check', title: expect.stringMatching(/looks like .*who is already here/) })]);
    expect(cs.commit).toBeNull();
    const added = planChanges({ ...base(t), answers: { [cs.groups[0]!.id]: { choice: 'new' } } });
    expect(added.counts.newPeople).toBe(1);
    expect(added.commit).not.toBeNull();
    const same = planChanges({ ...base(t), answers: { [cs.groups[0]!.id]: { choice: 'same' } } });
    expect(same.counts).toMatchObject({ newPeople: 0, people: 1 });
  });
});

describe('goals with the same title', () => {
  const g = s.goals.find((x) => x.cycleId === cycle.id && !x.removedAt && x.key)!;

  it('are allowed with a note when the team differs, and asked about when it is the same (C10)', () => {
    expect(sameTitleNote(g.title.toUpperCase() + ' ', null, s.goals, teamName)).toBe(`Another goal is called “${g.title}” (${g.key}, ${teamName(g.teamId)}). That’s allowed; Faro shows each one’s key beside the title so people can tell them apart.`);
    expect(sameTitleNote(g.title, g.id, [g], teamName)).toBeNull();
    const owner = s.people.find((p) => p.id === g.ownerId)!;
    const other = s.teams.find((t) => t.id !== g.teamId)!;
    const asked = planChanges({ ...base({ goals: [rec({ Goal: g.title, 'Owner email': owner.email ?? '', Unit: 'days', Start: '1', Target: '2' })] }), actor: admin });
    expect(asked.issues.find((i) => i.kind === 'same-goal')).toMatchObject({ level: 'check', message: expect.stringMatching(/is already here .*Is this a new goal, or the same one\?/) });
    expect(asked.commit).toBeNull();
    const cs = planChanges({ ...base({ goals: [rec({ Goal: g.title, 'Owner email': owner.email ?? '', Team: other.name, Unit: 'days', Start: '1', Target: '2' })] }), actor: admin });
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.issues.find((i) => i.kind === 'same-name')?.message).toMatch(/Another goal is called/);
  });

  it('show their key (or team) beside the title, and only when another goal has it', () => {
    const twin = { ...g, id: 'twin', key: 'G-999' };
    const dups = duplicateTitles([g, twin, ...s.goals.filter((x) => x.id !== g.id)]);
    expect(goalTell(g, dups, teamName)).toBe(g.key);
    expect(goalTell({ ...twin, key: undefined }, dups, teamName)).toBe(teamName(g.teamId));
    const other = s.goals.find((x) => x.title !== g.title)!;
    expect(goalTell(other, duplicateTitles(s.goals.filter((x) => x.title !== g.title || x.id === g.id)), teamName)).toBeNull();
  });
});

describe('one shortest name', () => {
  it('holds a workspace, a goal and an outcome to the same minimum', () => {
    expect(MIN_NAME).toBe(3);
    expect(['workspace', 'goal', 'outcome'].map((t) => nameProblem('Ab', t as 'goal'))).toEqual(['Give the workspace a name of at least three characters.', 'Give the goal a name of at least three characters.', 'Give the outcome a name of at least three characters.']);
    expect(nameProblem('Abc', 'workspace')).toBeNull();
  });
});
