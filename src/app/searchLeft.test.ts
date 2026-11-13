// @vitest-environment node
/* FS1's review, medium 4: someone marked as left is found by Find ("(left)"), though the cycle's snapshot keeps them
   only in its archive. Pickers still leave them out. */
import { buildPlatformOrg } from '../data/platformOrg';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { search, suggest } from '../domain/find';
import { personRows } from './reads';

const today = new Date('2026-11-05T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const gone = full.people.find((p) => !p.admin)!;
const s = scopeToCycle({ ...full, people: full.people.map((p) => (p.id === gone.id ? { ...p, leftAt: '2026-11-01T00:00:00Z' } : p)) }, cycle);
const first = gone.name.split(' ')[0]!;

describe('people who have left, in the app’s search', () => {
  it('Find asks for them too and names them “(left)”', () => {
    const rows = search(personRows(s), { q: first, filters: { left: 'too' }, size: 20 }).rows.map((r) => r.name);
    expect(rows).toContain(`${gone.name} (left)`);
  });
  it('a picker doesn’t offer them', () => {
    expect(search(personRows(s), { q: first, size: 20 }).rows.map((r) => r.name)).not.toContain(gone.name);
    expect(suggest(personRows(s), gone.id, []).map((r) => r.name)).not.toContain(gone.name);
  });
});
