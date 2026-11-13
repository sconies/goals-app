/* Set-up's upload through the import's preview (IM8; set-up spec SETUP-UPLOAD): create mode with answers, "Add {person}"
   for an owner the People sheet lacks, and stages already due asked about, counted from this week unless changed. */
import { buildWorkspace, GOALS_TEMPLATE, ownerToAdd, PEOPLE_TEMPLATE, setupDefaults } from './importer';
import { records } from './sheets';

// Week 46 of the year from Monday 29 December 2025 (ISO 2026): Tuesday 10 November.
const NOW = new Date('2026-11-10T09:00:00Z');
const START = '2025-12-29';
const build = (goals: Record<string, string>[], answers?: Record<string, { choice: string; value?: string }>, checkIns?: Record<string, string>[]) =>
  buildWorkspace({ name: 'Platform', startDate: START, people: PEOPLE_TEMPLATE, goals: '', tables: { goals, ...(checkIns ? { checkIns } : {}) }, now: NOW, idSuffix: 't', ...(answers ? { answers } : {}) });

describe('set-up’s upload through the preview (IM8)', () => {
  it('asks about a new goal’s stages already due, with “Count them from this week” first; set-up chooses it unless changed', () => {
    const goals = records(GOALS_TEMPLATE);
    const asked = build(goals);
    const g = asked.groups.find((x) => x.kind === 'past-stage')!;
    expect(g.level).toBe('check');
    expect(g.title).toBe('1 new goal has stages due before this week, so it would start late');
    expect(g.answers.map((c) => c.label)).toEqual(['Count them from this week', 'Keep the weeks as typed']);
    // Set-up's default, given once: none a second time for the same group.
    const [d] = setupDefaults(asked.groups, []);
    expect(d).toMatchObject({ id: g.id, answer: { choice: 'from-now' }, label: 'Count them from this week' });
    expect(setupDefaults(asked.groups, [g.id])).toEqual([]);
    // Counted from this week: no stage is due before week 46, and the question is gone.
    const moved = build(goals, { [g.id]: { choice: 'from-now' } });
    const canary = moved.snapshot.goals.find((x) => x.title === 'Canary releases live')!;
    expect(canary.kind === 'milestone' && canary.stages.every((st) => st.dueWeek > 46)).toBe(true);
    expect(moved.groups.some((x) => x.kind === 'past-stage')).toBe(false);
    expect(moved.issues).toEqual([]);
    // Kept as typed: the weeks stay, said by the answer.
    const kept = build(goals, { [g.id]: { choice: 'keep' } });
    const typed = kept.snapshot.goals.find((x) => x.title === 'Canary releases live')!;
    expect(typed.kind === 'milestone' && typed.stages.map((st) => st.dueWeek)).toEqual([2, 6, 10]);
  });

  it('keeps the weeks of a goal with check-ins in the file, unasked: its history happened', () => {
    const goals = [{ goal: 'Canary releases live', key: 'PLAT-3', team: 'Platform', 'owner email': 'ben.ortiz@example.com', type: 'milestone', stages: 'Design@2; Pilot@6; All services@50' }];
    const r = build(goals, undefined, [{ 'goal key': 'PLAT-3', week: '3', stages: 'Design' }]);
    expect(r.groups.some((x) => x.kind === 'past-stage')).toBe(false);
  });

  it('offers “Add {person}” and “Give it to someone here” for an owner the People sheet lacks, and blocks set-up until answered', () => {
    const goals = [{ goal: 'Deploys per day', team: 'Platform', 'owner email': 'nia.okoro@example.com', owner: 'Nia Okoro', type: 'metric', start: '2', target: '6' }];
    const r = build(goals);
    const g = r.groups.find((x) => x.kind === 'unknown-ref')!;
    expect(g.level).toBe('must');
    expect(g.answers.map((c) => c.label)).toEqual(['Add Nia Okoro', 'Give it to someone here']);
    expect(r.issues.length).toBe(1);
    // "Add": the person the row names, with the row's team, for the people step.
    expect(ownerToAdd(goals, g, 'Leadership')).toEqual({ name: 'Nia Okoro', email: 'nia.okoro@example.com', team: 'Platform' });
    expect(ownerToAdd([{ 'owner email': 'sam.lee@example.com' }], { column: 'Owner email', found: 'sam.lee@example.com' }, 'Leadership')).toEqual({ name: 'Sam Lee', email: 'sam.lee@example.com', team: 'Leadership' });
    // "Give it to someone here": the goal is Ben's, and nothing is left to answer.
    const given = build(goals, { [g.id]: { choice: 'choose', value: 'ben.ortiz@example.com' } });
    expect(given.issues).toEqual([]);
    expect(given.snapshot.people.find((p) => p.id === given.snapshot.goals[0]!.ownerId)?.name).toBe('Ben Ortiz');
  });

  it('names an owner given by name only as typed', () => {
    const r = build([{ goal: 'X', team: 'Platform', owner: 'Nobody Here', type: 'metric', start: '1', target: '2' }]);
    expect(r.groups.find((x) => x.kind === 'unknown-ref')!.answers[0]!.label).toBe('Add Nobody Here');
  });
});
