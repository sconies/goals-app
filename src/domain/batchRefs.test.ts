// @vitest-environment node
/* A batch names its own rows (backlog BT, MCP load of 12 Nov): a Goals row's Ref lets Feeds into ref and Goal ref in the
   same file name the goal it adds, before it has a key, so one dry run builds and checks a whole tree. */
import { buildPlatformOrg } from '../data/platformOrg';
import { planChanges, type ChangeInput, type Rec } from './changeset';
import { leaveOut } from './leaveOut';
import { currentWeek } from './plan';

const today = new Date('2026-11-12T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
let n = 0;
const rows = (list: Record<string, string>[]): Rec[] => list.map((o, i) => ({ __row: String(i + 2), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) }));
const run = (tables: ChangeInput['tables'], actor = 'rhea') => planChanges({ tables, snapshot: s, cycle, week, actor: s.people.find((p) => p.id === actor)!, now: today.toISOString(), newId: (p) => `${p}_b${++n}`, via: 'mcp', confirm: true });
const goal = (ref: string, title: string, extra: Record<string, string> = {}) => ({ Ref: ref, Goal: title, Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '10', Target: '50', ...extra });
const musts = (cs: ReturnType<typeof run>) => cs.issues.filter((i) => i.level === 'must').map((i) => `${i.row}: ${i.message}`);

describe('a batch that refers to its own new goals', () => {
  it('builds a whole tree in one dry run, each new goal feeding the one its row names by Ref', () => {
    const cs = run({ goals: rows([goal('top', 'Register: incidents closed'), goal('mid', 'Register: runbooks', { 'Feeds into ref': 'top' }), goal('leaf', 'Register: alerts', { 'Feeds into ref': 'mid' })]) });
    expect(musts(cs)).toEqual([]);
    const made = cs.commit!.goals!;
    const byTitle = (t: string) => made.find((g) => g.title === t)!;
    expect(byTitle('Register: runbooks').parentId).toBe(byTitle('Register: incidents closed').id);
    expect(byTitle('Register: alerts').parentId).toBe(byTitle('Register: runbooks').id);
    expect(byTitle('Register: incidents closed').parentId).toBeNull();
  });

  it('tells apart two new goals with the same name, where a name alone would be one goal on two rows', () => {
    const same = [goal('a', 'Cycle time'), goal('b', 'Cycle time', { 'Feeds into ref': 'a' })];
    const byName = run({ goals: rows(same.map(({ Ref: _r, ...x }) => x)) });
    expect(musts(byName).join(' ')).toMatch(/is on rows 2 and 3/);
    const cs = run({ goals: rows(same) }, 'amara');
    expect(musts(cs)).toEqual([]);
    // Two new goals of one name in a team is still asked, as any same name is; the link is read either way.
    expect(cs.groups.filter((g) => g.level === 'check').map((g) => g.kind)).toEqual(['same-goal']);
    const child = cs.items.find((x) => x.row === 3)!;
    expect(child.diffs.find((d) => d.field === 'Feeds into')?.to).toBe('Cycle time');
  });

  it('checks in on a new goal by its Ref (Goal ref), in the same batch', () => {
    const cs = run({ goals: rows([goal('q', 'Register: queue wait')]), checkIns: rows([{ 'Goal ref': 'q', Week: String(week), Value: '12', 'Next step': 'Start the weekly read-out' }]) });
    expect(musts(cs)).toEqual([]);
    expect(cs.commit!.checkIns![0]!.goalId).toBe(cs.commit!.goals![0]!.id);
  });

  it('refuses a Ref on two rows, a ref no row has, and a ref to a row that isn’t saved', () => {
    expect(musts(run({ goals: rows([goal('x', 'One'), goal('x', 'Two')]) }))).toEqual(['2: Ref “x” is on rows 2 and 3. Give each row its own Ref.', '3: Ref “x” is on rows 2 and 3. Give each row its own Ref.']);
    expect(musts(run({ goals: rows([goal('a', 'Child', { 'Feeds into ref': 'nope' })]) }))).toEqual(['2: Feeds into ref: No row on Goals has the Ref “nope”.']);
    const broken = musts(run({ goals: rows([{ Ref: 'top', Goal: 'Top', Owner: 'Rhea Kapoor', Type: 'metric', Unit: '%' }, goal('a', 'Child', { 'Feeds into ref': 'top' })]) }));
    expect(broken).toContain('3: Feeds into ref: Ref “top” names Goals row 2, which isn’t saved: fix that row first.');
    expect(musts(run({ goals: rows([goal('q', 'Queue')]), checkIns: rows([{ 'Goal ref': 'gone', Week: String(week), Value: '1' }]) }))).toEqual(['2: Goal ref: No row on Goals has the Ref “gone”.']);
  });

  it('an empty Feeds into ref changes nothing: the other columns say what a goal feeds, as in an export', () => {
    const g14 = s.goals.find((g) => g.key === 'G-14')!;
    const cs = run({ goals: rows([{ Key: 'G-14', 'Feeds into ref': '', Ref: '' }]) }, 'amara');
    expect(cs.items).toEqual([]);
    expect(g14.parentId).not.toBeNull();
  });

  it('leaving a new goal out leaves out the rows that name it by Ref', () => {
    const tables = { goals: rows([goal('top', 'Top'), goal('mid', 'Mid', { 'Feeds into ref': 'top' })]), checkIns: rows([{ 'Goal ref': 'mid', Week: String(week), Value: '1' }]) };
    const out = leaveOut(tables, [{ sheet: 'Goals', row: 2 }]);
    expect(out.also.map((x) => `${x.sheet} ${x.row}`)).toEqual(['Goals 3', 'Check-ins 2']);
  });
});
