/* Set-up that tells the truth (backlog SU, deep review U2–U7): the first ten minutes say only what the data backs. */
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE, setupDefaults } from './importer';
import { firstReports } from './progress';
import { mergePeople } from './people';
import { placesToKeep } from './numbers';
import { reportedIn } from './templates';
import { records } from './sheets';
import type { Cycle } from './types';

// Week 46 of the year from Monday 29 December 2025 (ISO 2026), reviews on Thursdays: Tuesday 10 November.
const NOW = new Date('2026-11-10T09:00:00Z');
const START = '2025-12-29';

describe('set-up that tells the truth', () => {
  it('counts an uploaded template’s stages from the joining week by default, so nothing is late on day one (U4, IM8)', () => {
    const goals = records(GOALS_TEMPLATE);
    const at = (answers?: Record<string, { choice: string }>) => buildWorkspace({ name: 'P', startDate: START, people: PEOPLE_TEMPLATE, goals: '', tables: { goals }, now: NOW, idSuffix: 't', ...(answers ? { answers } : {}) });
    const given = setupDefaults(at().groups, []);
    expect(given.map((x) => x.label)).toEqual(['Count them from this week']);
    const out = at(Object.fromEntries(given.map((x) => [x.id, x.answer]))).snapshot.goals;
    const canary = out.find((g) => g.title === 'Canary releases live')!;
    expect(canary.kind === 'milestone' && canary.stages.every((st) => st.dueWeek > 46 && st.dueWeek <= 53)).toBe(true);
  });

  it('keeps the stage weeks of an uploaded goal that has check-ins in the file: its history happened (U4)', () => {
    const g = { goal: 'Canary releases live', key: 'PLAT-3', stages: 'Design@2; Pilot@6' };
    expect(reportedIn([{ 'goal key': 'plat-3', week: '3' }])(g)).toBe(true);
    expect(reportedIn([{ goal: 'canary releases live', week: '3' }])(g)).toBe(true);
    expect(reportedIn([{ goal: 'Another goal', week: '3' }])(g)).toBe(false);
  });

  it('adds an upload’s people after those already typed, never replacing them or adding anyone twice (U5)', () => {
    const p = (name: string, email = '') => ({ name, email });
    const typed = [p('Theo Brandt', 'theo@example.com'), p('Mina Okafor')];
    const merged = mergePeople(typed, [p('Theo B.', 'THEO@example.com'), p('mina okafor', 'mina@example.com'), p('Ana Silva', 'ana@example.com')]);
    expect(merged.map((x) => x.name)).toEqual(['Theo Brandt', 'Mina Okafor', 'Ana Silva']);
    // What the file knows fills only what was left empty: Mina's email, never Theo's name.
    expect(merged.map((x) => x.email)).toEqual(['theo@example.com', 'mina@example.com', 'ana@example.com']);
    // Two people with one name and different emails are two people.
    expect(mergePeople([p('Sam Lee', 'sam1@example.com')], [p('Sam Lee', 'sam2@example.com')])).toHaveLength(2);
  });

  it('offers the decimal places a refused number needs, and nothing for a number that fits (U3)', () => {
    expect(placesToKeep('5.5', 5.5, 0)).toBe(1);
    expect(placesToKeep('5.25', 5.25, 1)).toBe(2);
    expect(placesToKeep('1.23456', 1.23456, 0)).toBe(3);
    expect(placesToKeep('5', 5, 0)).toBeNull();
    expect(placesToKeep('5.5', 5.5, 1)).toBeNull();
  });

  it('counts every goal set up today among the first check-ins, as Ready counts them (U6)', () => {
    const { snapshot: s } = buildWorkspace({ name: 'Day one', startDate: START, reviewDay: 3, people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: NOW, idSuffix: 'd1' });
    const cycle = s.cycles[0] as Cycle;
    const f = firstReports(s, cycle, 46);
    expect(f?.total).toBe(s.goals.length);
    expect(f?.reported).toBe(0);
  });

  it('names no team lead at set-up, which never asks who leads a team (U7)', () => {
    const { snapshot: s } = buildWorkspace({ name: 'Day one', startDate: START, reviewDay: 3, people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: NOW, idSuffix: 'd1' });
    expect(s.teams.length).toBeGreaterThan(0);
    expect(s.teams.every((t) => !t.leadId)).toBe(true);
  });

  // A row one letter out is asked about (IM2), and set-up asks nothing yet (IM8): a row it can't build stops set-up,
  // with the question as its problem, never a goal quietly left out (build review of #145).
  const typo = (from: string, to: string) => GOALS_TEMPLATE.split('\n').map((l) => (l.split('\t').includes('Deploys rolled back') ? l.replace(from, to) : l)).join('\n');
  const build = (goals: string) => buildWorkspace({ name: 'Day one', startDate: START, reviewDay: 3, people: PEOPLE_TEMPLATE, goals, now: NOW, idSuffix: 'd1' });

  it('stops set-up on a goal whose owner is one letter out, and says why', () => {
    const { issues } = build(typo('ben.ortiz@example.com\tBen Ortiz', '\tBen Ortz'));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ table: 'Goals', row: 3 });
    expect(issues[0]!.message).toContain('Ben Ortiz');
  });

  it('stops set-up on a goal whose type is one letter out, and says why', () => {
    const { issues } = build(typo('\trange\t', '\tNumbr\t'));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ table: 'Goals', row: 3 });
    expect(issues[0]!.message).toContain('Numbr');
  });

  it('still builds a row it reads on past a question, and says the question beside it', () => {
    const { issues, notes, snapshot } = build(typo('\t%\t', '\t\t'));
    expect(issues).toEqual([]);
    expect(snapshot.goals).toHaveLength(3);
    expect(notes?.some((n) => n.table === 'Goals' && n.row === 3)).toBe(true);
  });
});
