/* The import preview's rules (backlog IM3; docs/design/import/spec.md rules 5 and 8, C19) and the IM2 review's fixes. */
import { buildPlatformOrg } from '../data/platformOrg';
import { GoalSet, planChanges, sheetCounts, showOf, type ChangeInput, type Rec } from './changeset';
import { leaveOut } from './leaveOut';
import { currentWeek } from './plan';
import { readLine, readTables } from './sheets';
import { undoImport } from './removal';
import { applyCommit } from '../data/store';
import type { Snapshot } from './types';

const today = new Date('2026-11-11T12:00:00Z');
const s: Snapshot = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
let n = 0;
const run = (actor: string, tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}) => planChanges({
  tables, snapshot: s, cycle, week, actor: s.people.find((p) => p.id === actor)!, now: today.toISOString(), newId: (p) => `${p}_ip${++n}`, via: 'spreadsheet', ...extra,
});
const rec = (o: Record<string, string>, row = 2): Rec => ({ __row: String(row), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });

describe('rule 5: what was read', () => {
  it('[IMPORT-PREVIEW] names the sheets read, those not read and why, and the columns nothing reads (C19)', () => {
    const read = readTables([
      { name: 'Start here', rows: [['Platform Engineering, 2026. Exported 2026-11-11, week 46 of 52.'], ['File of', 'platform-org', 'y2026']] },
      { name: 'Goals', rows: [['Key', 'Goal', 'Owner', 'Notes', 'Budget'], ['G-1', 'Lead time for changes', 'Rhea Kapoor', 'x', '5']] },
      { name: 'Results', rows: [['Key', 'Goal', 'Result', 'Q1'], ['G-1', 'x', 'y', 'z']] },
      { name: 'Budget', rows: [['Line', 'Amount'], ['Runners', '400']] },
    ]);
    expect(read.origin).toEqual({ workspaceId: 'platform-org', workspaceName: 'Platform Engineering', cycleId: 'y2026' });
    expect(read.unknownColumns).toEqual([{ sheet: 'Goals', headers: ['Notes', 'Budget'] }]);
    expect(read.headers.goals).toEqual(['Key', 'Goal', 'Owner', 'Notes', 'Budget']);
    expect(readLine(read, 2)).toBe('Read Goals. Not read: Results (for reading only); Budget (not a Faro sheet); the columns Notes and Budget on Goals. 2 example rows left out.');
  });
  it('[IMPORT-PREVIEW] a file with everything read says only what it read', () => {
    expect(readLine({ read: [{ name: 'Goals', kind: 'goals' }, { name: 'Check-ins', kind: 'checkIns' }], skipped: [{ name: 'Start here', why: 'start-here' }], unknownColumns: [] })).toBe('Read Goals and Check-ins.');
  });
});

describe('rule 8: leaving rows out', () => {
  it('[IMPORT-PREVIEW] a new goal left out takes its check-ins and the goals that feed into it, each saying why', () => {
    const tables = {
      goals: [rec({ Goal: 'Runner pool size', Owner: 'Rhea Kapoor', Start: '10', Target: '30' }, 44), rec({ Goal: 'Runner spares', Owner: 'Rhea Kapoor', 'Feeds into': 'Runner pool size', Start: '1', Target: '3' }, 45), rec({ Key: 'G-1', Target: '20' }, 46)],
      checkIns: [42, 43, 44, 45].map((w, i) => rec({ Goal: 'Runner pool size', Week: String(w), Value: '12' }, 2 + i)),
    };
    const out = leaveOut(tables, [{ sheet: 'Goals', row: 44 }]);
    expect(out.also).toHaveLength(5);
    expect(out.also.find((x) => x.sheet === 'Goals')).toEqual({ sheet: 'Goals', row: 45, because: 'Feeds into names Goals row 44' });
    expect(out.tables.goals!.map((r) => r.__row)).toEqual(['46']);
    expect(out.tables.checkIns).toEqual([]);
  });
  it('[IMPORT-PREVIEW] a new person left out takes the goals they would own', () => {
    const out = leaveOut({ people: [rec({ Name: 'Ana Silva', Email: 'ana@example.com' }, 2)], goals: [rec({ Goal: 'Fewer pages', 'Owner email': 'ana@example.com' }, 3)] }, [{ sheet: 'People', row: 2 }]);
    expect(out.also).toEqual([{ sheet: 'Goals', row: 3, because: 'its owner is People row 2' }]);
  });
});

describe('the counts by sheet', () => {
  it('[IMPORT-PREVIEW] a row that changes nothing is counted on its own sheet', () => {
    const g = s.goals.find((x) => x.key === 'G-1')!;
    const cs = run('amara', { goals: [rec({ Key: 'G-1', Goal: g.title })] });
    expect(cs.unchangedBy).toEqual({ Goals: 1, Plan: 0, 'Check-ins': 0, People: 0 });
  });
});

describe('the IM2 review, fixed in IM3', () => {
  it('an answer must be one the question offers: “banana” answers nothing', () => {
    const row = { goals: [rec({ Goal: 'Fewer flaky tests', Owner: 'Rhea Kapoor', Start: '10', Target: '2' })] };
    const id = run('amara', row).groups.find((x) => x.kind === 'no-unit')!.id;
    expect(run('amara', row, { answers: { [id]: { choice: 'banana' } } }).groups.some((x) => x.kind === 'no-unit')).toBe(true);
    expect(run('amara', row, { answers: { [id]: { choice: 'right' } } }).groups.some((x) => x.kind === 'no-unit')).toBe(false);
  });
  it('one answer to an unlikely number covers only the numbers it was given for', () => {
    const row = (t: string) => ({ goals: [rec({ Goal: 'Build minutes', Owner: 'Rhea Kapoor', Unit: 'ms', Start: '3', Target: t })] });
    const g = run('amara', row('3000')).groups.find((x) => x.kind === 'odd-number')!;
    expect(g.values).toEqual(['3000']);
    const answers = { [g.id]: { choice: 'right', covers: g.values } };
    expect(run('amara', row('3000'), { answers }).groups.some((x) => x.kind === 'odd-number')).toBe(false);
    expect(run('amara', row('5000'), { answers }).groups.some((x) => x.kind === 'odd-number')).toBe(true);
  });
  it('two rows answered “They’re the same” for one goal are named, not one dropped', () => {
    const same = s.goals.find((x) => x.key === 'G-14')!;
    const team = s.teams.find((t) => t.id === same.teamId)!.name;
    const rows = { goals: [rec({ Goal: same.title, Team: team, Owner: 'Rhea Kapoor', Start: '9', Target: '5' }, 2), rec({ Goal: same.title, Owner: 'Rhea Kapoor', Start: '9', Target: '4' }, 3)] };
    const id = run('amara', rows).groups.find((x) => x.kind === 'same-goal')!.id;
    const cs = run('amara', rows, { answers: { [id]: { choice: 'same' } } });
    // Both rows are named, the earlier one too (IM3 review): neither is dropped without a word.
    expect(cs.issues.filter((x) => x.kind === 'duplicate').map((x) => [x.row, x.level])).toEqual([[2, 'must'], [3, 'must']]);
    expect(cs.commit).toBeNull();
  });
  it('a near-miss goal name answered “Use …” is caught on two rows of one week', () => {
    const g = s.goals.find((x) => x.key === 'G-14')!;
    const typo = g.title.replace('queue', 'qeue');
    const rows = { checkIns: [rec({ Goal: typo, Week: String(week), Value: '6' }, 2), rec({ Goal: g.title, Week: String(week), Value: '7' }, 3)] };
    const id = run('amara', rows).groups.find((x) => x.kind === 'near-ref')!.id;
    expect(run('amara', rows, { answers: { [id]: { choice: 'use' } } }).issues.filter((x) => x.kind === 'duplicate').map((x) => x.row)).toEqual([2, 3]);
  });
  it('a rename by key through MCP is a rename, and confirm answers the other-goal question', () => {
    expect(run('amara', { goals: [rec({ Key: 'G-1', Goal: 'Net revenue retention' })] }, { via: 'mcp' }).groups.some((x) => x.kind === 'other-goal')).toBe(false);
    expect(run('amara', { goals: [rec({ Key: 'G-1', Goal: 'Net revenue retention' })] }, { confirm: true }).groups.some((x) => x.kind === 'other-goal')).toBe(false);
  });
  it('“Leave these rows out” leaves out a non-admin’s Left row', () => {
    const rows = { people: [rec({ Email: s.people.find((p) => p.id === 'rhea')!.email ?? '', Action: 'Left', 'Takes over': 'Amara Okafor' })] };
    const id = run('tunde', rows).groups.find((x) => x.kind === 'not-allowed')!.id;
    expect(run('tunde', rows, { answers: { [id]: { choice: 'leave' } } }).leftOut).toEqual([{ sheet: 'People', row: 2 }]);
  });
  it('undoing an import that added a team removes the team again', () => {
    const rows = { goals: [rec({ Goal: 'Fewer pages at night', Owner: 'Rhea Kapoor', Team: 'Night shift', Unit: 'pages', Start: '10', Target: '2' })] };
    const id = run('amara', rows).groups.find((x) => x.kind === 'unknown-ref')!.id;
    const cs = run('amara', rows, { answers: { [id]: { choice: 'new' } } });
    expect(cs.commit).not.toBeNull();
    const after = applyCommit(s, cs.commit!);
    const team = after.teams.find((t) => t.name === 'Night shift')!;
    const out = undoImport({ snapshot: after, full: after, cycle, week, actor: s.people.find((p) => p.id === 'amara')!, now: today.toISOString(), newId: (p: string) => `${p}_u${++n}` } as never, cs.commit!.changes.find((c) => c.action === 'imported')!.importId!);
    expect(out.commit.removeTeams).toEqual([team.id]);
  });
});

describe('the IM3 and #257 reviews, fixed later', () => {
  it('a row that must be fixed is counted as Must fix on its sheet, not as Added', () => {
    // Row 3's goal is made before its Feeds into is found to name nothing: it is a change, but not one that saves.
    const cs = run('amara', { goals: [rec({ Goal: 'Fewer pages at night', Owner: 'Rhea Kapoor', Unit: 'pages', Start: '10', Target: '2' }, 2), rec({ Goal: 'Faster builds', Owner: 'Rhea Kapoor', Unit: 'min', Start: '10', Target: '5', 'Feeds into': 'Nothing at all here' }, 3)] });
    expect(cs.items.filter((x) => x.kind === 'new goal')).toHaveLength(2);
    expect(sheetCounts(cs, 'Goals')).toMatchObject({ added: 1, must: 1 });
  });
  it('one helper says what a change does, for the counts and the changes list alike', () => {
    expect([showOf('new goal'), showOf('check-in'), showOf('plan'), showOf('replaces check-in'), showOf('delete goal'), showOf('person left')]).toEqual(['added', 'added', 'changed', 'changed', 'stopped', 'stopped']);
  });
  it('with two goals sharing a key, the key names the first in the list, as a scan does, even after either changes', () => {
    const a = { ...s.goals[0]!, id: 'a', key: 'G-900' }, b = { ...s.goals[1]!, id: 'b', key: 'G-900' };
    const set = new GoalSet([a, b]);
    expect(set.byRef('G-900')?.id).toBe('a');
    set.set('a', { ...a, title: 'Renamed' });
    expect(set.byRef('G-900')?.id).toBe('a');
    set.set('b', { ...b, title: 'Also renamed' });
    expect(set.byRef('G-900')?.id).toBe('a');
    set.set('a', { ...a, key: 'G-901' });
    expect(set.byRef('G-900')?.id).toBe('b');
    expect(set.byRef('G-901')?.id).toBe('a');
  });
});
