// @vitest-environment node
/* Find from anywhere (find spec, rule 8) over the demo workspace, through the Search port's browser adapter. */
import { findAllAsync as findAll, keyOf } from '../domain/find';
import { searchRows } from '../app/reads';
import { currentWeek } from '../domain/plan';
import { CHECK_IN_MOMENT } from '../spec/conformance';
import { localSearch } from './localSearch';

const at = new Date(CHECK_IN_MOMENT);

async function demoSearch(left = false) {
  const s = (await import('../data/platformOrg/generate')).buildPlatformOrg(at);
  if (left) s.people = s.people.map((p) => (p.id === 'daniel' ? { ...p, leftAt: '2026-10-01T00:00:00Z' } : p));
  const cycle = s.cycles[0]!;
  return localSearch(searchRows(s, cycle, at, currentWeek(cycle, at)));
}
const find = async (q: string, left = false) => {
  const search = await demoSearch(left);
  return findAll(q, search.kinds(), (k, a) => search.search(k, a));
};

describe('rule 8: Find across kinds (findAll)', () => {
  it('reads a whole key however it is typed', () => {
    expect(['G-48', 'g48', 'g-48', '48', ' 48 ', 'rollback', 'G-48 x'].map(keyOf)).toEqual(['G-48', 'G-48', 'G-48', 'G-48', 'G-48', null, null]);
  });

  it('finds nothing for nothing typed', async () => {
    expect(await find('  ')).toEqual([]);
  });

  it('puts a key’s goal first and alone in Goals', async () => {
    for (const q of ['G-48', 'g48', '48']) {
      const g = await find(q);
      expect(g[0]).toMatchObject({ kind: 'goal', total: 1 });
      expect(g[0]!.rows.map((r) => r.key)).toEqual(['G-48']);
    }
  });

  it('gives the groups that found something, in order, three rows each with their totals', async () => {
    const g = await find('rhea');
    expect(g.map((x) => x.kind)).toEqual(['goal', 'person', 'team']);
    expect(g.find((x) => x.kind === 'person')!.rows.map((r) => r.name)).toEqual(['Rhea Kapoor']);
    expect(g.find((x) => x.kind === 'team')!.rows.map((r) => r.name)).toEqual(['CI/CD']);
    const goals = g.find((x) => x.kind === 'goal')!;
    expect(goals.rows).toHaveLength(3);
    expect(goals.total).toBe(8);
  });

  it('never looks in workspaces, and a kind it isn’t given is left out', async () => {
    const search = await demoSearch();
    const g = await findAll('rhea', ['person', 'workspace'], (k, a) => search.search(k, a));
    expect(g.map((x) => x.kind)).toEqual(['person']);
  });

  it('finds someone marked as left, and says so', async () => {
    const g = await find('daniel okafor', true);
    expect(g.find((x) => x.kind === 'person')!.rows.map((r) => r.name)).toEqual(['Daniel Okafor (left)']);
  });

  it('tries a near miss per kind', async () => {
    const g = await find('rolback');
    expect(g[0]).toMatchObject({ kind: 'goal', near: 'rollback' });
  });

  it('finds nothing for nonsense', async () => {
    expect(await find('zzzz')).toEqual([]);
  });
});
