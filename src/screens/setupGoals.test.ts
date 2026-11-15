// @vitest-environment jsdom
/* Set-up's goals, as the importer reads them (deep dive, 15 Nov, items 3, 4 and 6). */
import { buildWorkspace } from '../domain/importer';
import { baselineShown } from '../domain/baseline';
import { goalsTsv } from './Onboarding';

const NOW = new Date('2026-11-15T10:00:00Z');
const person = (name: string, email: string, team: string, admin = false) => ({ name, email, title: '', team, admin });
const me = person('Grace Achterberg', 'grace@example.com', 'Atlas', true);
const people = [person('Ana Alpha', 'ana@example.com', 'Alpha'), person('Ben Alpha', 'ben@example.com', 'Alpha')];
const peopleTsv = ['Name\tEmail\tJob title\tTeam\tAdmin\tTeam objective', ...[me, ...people].map((p) => [p.name, p.email, '', p.team, p.admin ? 'yes' : '', ''].join('\t'))].join('\n');
const draft = {
  template: 'own', me, people,
  outcome: { title: 'Customer satisfaction score', kind: 'metric' as const, unit: 'points', start: '40', target: '70', owner: 'Grace Achterberg', ownerEmail: 'grace@example.com' },
  goals: [
    { title: 'Faster support replies', kind: 'metric' as const, unit: '%', start: '40', target: '70', owner: 'Ana Alpha', ownerEmail: 'ana@example.com' },
    { title: 'Error rate in a safe band', kind: 'range' as const, unit: '%', start: '', target: '', limit: '5', lower: '1', bound: 'between' as const, owner: 'Ben Alpha', ownerEmail: 'ben@example.com' },
  ],
};
const built = () => {
  const r = buildWorkspace({ name: 'Throwaway', startDate: '2025-12-29', reviewDay: 3, people: peopleTsv, goals: goalsTsv(draft, NOW), now: NOW, idSuffix: 't' });
  expect(r.groups.filter((g) => g.level === 'must')).toEqual([]);
  return r.snapshot;
};

describe('set-up’s goals', () => {
  it('give each goal its owner’s team, by the importer’s one rule: setup names no team (item 3)', () => {
    const s = built();
    const team = (title: string) => s.teams.find((t) => t.id === s.goals.find((g) => g.title === title)!.teamId)!.name;
    expect(team('Customer satisfaction score')).toBe('Atlas');
    expect(team('Faster support replies')).toBe('Alpha');
    expect(team('Error rate in a safe band')).toBe('Alpha');
    // The rule lives once, in the importer: the sheet set-up writes leaves Team empty.
    const rows = goalsTsv(draft, NOW).split('\n').slice(1).map((r) => r.split('\t'));
    expect(rows.every((r) => r[1] === '')).toBe(true);
  });

  it('show a number goal’s Today figure as its number until the first check-in (item 4)', () => {
    const g = built().goals.find((x) => x.title === 'Faster support replies')!;
    expect(g.kind === 'metric' && g.plan.start).toBe(40);
    expect(baselineShown(g, false)).toEqual({ value: 40, period: 'As at set-up, 15 Nov 2026', provisional: false });
  });

  it('keep a range goal between two limits when set-up is given both (item 6)', () => {
    const g = built().goals.find((x) => x.title === 'Error rate in a safe band')!;
    expect(g.kind === 'range' && g.range).toMatchObject({ bound: 'between', lower: 1, limit: 5 });
  });
});
