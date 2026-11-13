// @vitest-environment node
/* #336's review, medium 3: set-up's finder is a search over the draft. Given the draft's year it finds the file's goals,
   so a check-in row's "Choose a goal" at set-up is no longer a dead end ("Couldn't search just now"). */
import { buildWorkspace, PEOPLE_TEMPLATE } from '../domain/importer';
import { searchOver } from './search';

const now = new Date('2026-11-10T09:00:00Z');
const r = buildWorkspace({ name: 'Platform', startDate: '2025-12-29', people: PEOPLE_TEMPLATE, goals: '', tables: { goals: [{ goal: 'Canary releases live', team: 'Platform', 'owner email': 'ben.ortiz@example.com', type: 'metric', start: '0', target: '10' }] }, now, idSuffix: 't' });
const cycle = r.snapshot.cycles[0]!;

describe('set-up’s search over its draft', () => {
  it('finds the file’s goals when given the draft’s year', async () => {
    const found = await searchOver(r.snapshot, { cycle, today: now, week: 46 }).search('goal', { q: 'canary', size: 10 });
    expect(found.rows.map((x) => x.name)).toEqual(['Canary releases live']);
  });
  it('still finds people and teams', async () => {
    const s = searchOver(r.snapshot);
    expect((await s.search('person', { q: 'ben', size: 10 })).rows.map((x) => x.name)).toContain('Ben Ortiz');
    expect((await s.search('team', { q: 'plat', size: 10 })).rows.map((x) => x.name)).toContain('Platform');
  });
});
