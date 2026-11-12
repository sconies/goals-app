/* Rule 3: the header row (backlog IM5, C17; docs/design/import/spec.md, section 6). Found in the first ten rows, other
   names read as their column, a header one letter out asked about once, and a People sheet needs more than a Name. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg/generate';
import { planChanges } from './changeset';
import { currentWeek } from './plan';
import { readHeader, readLine, readTables } from './sheets';

describe('rule 3: the header row', () => {
  it('skips a title row above the headers', () => {
    const h = readHeader([['Platform goals FY27', ''], ['Goal', 'Level', 'Team', 'Owner'], ['Lead time', 'team', 'Platform', 'Rhea Kapoor']]);
    expect(h).toMatchObject({ row: 2, kind: 'goals' });
  });
  it('reads other names as their column', () => {
    const h = readHeader([['Goal name', 'Owner name', 'Target value', 'Units']]);
    expect(h.kind).toBe('goals');
    expect(h.columns.map((c) => [c.as, c.how])).toEqual([['Goal', 'also'], ['Owner', 'also'], ['Target', 'also'], ['Unit', 'also']]);
  });
  it('a Name with no other People column is no Faro sheet', () => {
    expect(readHeader([['Name', 'Department', 'Salary band']]).kind).toBeNull();
    expect(readHeader([['Name', 'Email']]).kind).toBe('people');
  });
  it('a header one letter out is near', () => {
    expect(readHeader([['Key', 'Goal', 'Targett']]).columns[2]).toMatchObject({ header: 'Targett', as: 'Target', how: 'near' });
  });
  it('readTables keeps each row’s number in the sheet, says the header row, and doesn’t list a near header as not read', () => {
    const r = readTables([{ name: 'Goals', rows: [['Platform goals FY27'], ['Goal', 'Owner', 'Targett'], ['Lead time', 'Rhea Kapoor', '3']] }]);
    expect(r.headerRows).toEqual([{ sheet: 'Goals', row: 2 }]);
    expect(r.tables.goals![0]).toMatchObject({ __row: '3', goal: 'Lead time', Targett: '3' });
    expect(readLine(r)).toBe('Read Goals.');
  });
});

describe('rule 3 in the engine (every door)', () => {
  const today = new Date('2026-11-05T13:00:00Z');
  const s = buildPlatformOrg(today);
  const cycle = s.cycles[0]!;
  let n = 0;
  const run = (tables: Parameters<typeof planChanges>[0]['tables'], answers = {}) => planChanges({ tables, snapshot: s, cycle, week: currentWeek(cycle, today), actor: s.people.find((p) => p.id === 'amara')!, now: today.toISOString(), newId: (p) => `${p}_h${++n}`, via: 'spreadsheet', answers });
  const row = { __row: '2', 'goal name': 'Pipeline cache hit rate', 'owner name': 'Rhea Kapoor', team: 'CI/CD', units: '%', start: '20', targett: '90' };
  it('asks once about a header one letter out, and reads it once answered', () => {
    const cs = run({ goals: [row] });
    const g = cs.groups.find((x) => x.kind === 'near-header')!;
    expect(g.title).toBe('A column on Goals is called “targett”. Read it as Target?');
    const answered = run({ goals: [row] }, { [g.id]: { choice: 'use' } });
    expect(answered.groups.filter((x) => x.level === 'must' || x.level === 'check').map((x) => x.kind)).toEqual([]);
    expect(answered.commit!.goals![0]).toMatchObject({ title: 'Pipeline cache hit rate', ownerId: 'rhea', unit: '%', plan: { target: 90 } });
  });
  it('reads a header that differs only by punctuation, an accent or spacing as its column (#199 review)', () => {
    const lead = s.goals.find((g) => g.id === 'ns-lead')!;
    const target = lead.kind === 'metric' ? lead.plan.target : 0;
    for (const h of ['target.', 'tárget', 'target_']) {
      const cs = run({ goals: [{ __row: '2', id: 'ns-lead', goal: lead.title, [h]: String(target + 7), reason: 'Agreed at the review with the platform leads.' }] });
      expect(cs.items.find((i) => i.goalId === 'ns-lead')?.diffs.some((d) => /target/i.test(d.field)), h).toBe(true);
    }
  });
});
