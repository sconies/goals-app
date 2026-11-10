/* The contracts for the Search and Prefs ports (docs/design/architecture.md, 2: AR1). Each takes a way to make the part
   and checks what any replacement must do. src/adapters/parts.test.ts runs them on Faro's adapters; run them on yours.
   The search cases are the find rules' worked examples (spec/core/rules/finding.md) over the demo workspace as built for
   Thursday 5 November 2026, noon UTC (the moment the conformance data is built for). */
import type { Snapshot } from '../../domain/types';
import type { Prefs } from '../prefs';
import type { Search } from '../search';

/** The demo workspace as the contract seeds it: Oskar Lindgren marked as left, so a picker must never list him. */
export const searchContractWorkspace = (s: Snapshot): Snapshot => ({ ...s, people: s.people.map((p) => (p.id === 'oskar' ? { ...p, leftAt: '2026-11-01T09:00:00Z' } : p)) });

/** `make` seeds a search with this workspace (searchContractWorkspace applied) at this moment. */
export function searchContract(name: string, make: () => Promise<Search>) {
  describe(`the search contract: ${name}`, () => {
    let search: Search;
    beforeAll(async () => { search = await make(); }, 60_000);
    const ids = async (kind: string, q: string, more: object = {}) => (await search.search(kind, { q, size: 200, ...more })).rows.map((r) => r.id);

    it('answers the core kinds, and refuses a kind nobody registered', async () => {
      expect(search.kinds()).toEqual(expect.arrayContaining(['goal', 'person', 'team']));
      await expect(search.search('nonsense', { q: '' })).rejects.toThrow();
    });

    it('finds a goal by its key, however it is typed, and a key finds only its own goal', async () => {
      for (const q of ['G-48', 'g48', 'g-48', '48']) expect(await ids('goal', q)).toEqual(['mttr-oncall']);
      expect(await ids('goal', 'G-4')).toEqual(['lead-review-rota']);
    });

    it('matches the words on the row: each word typed starts one of its words, ignoring case and accents', async () => {
      expect(await ids('goal', 'tunde')).toEqual(['cfr-contract', 'lead-rollback']);
      expect(await ids('goal', 'one click roll')).toEqual(['lead-rollback']);
      expect(await ids('goal', 'llback')).toEqual([]);
      expect((await search.search('goal', { q: 'off track' })).total).toBe(13);
      expect(await ids('person', 'tunde')).toEqual(['tunde']);
      expect(await ids('person', 'LUCIA')).toEqual(['lucia']);
      expect(await ids('team', 'rhea')).toEqual(['cicd']);
    });

    it('lists rows in two lines: a goal with its status and key, a person with their job and team, a team with its lead', async () => {
      const [g] = (await search.search('goal', { q: 'G-10' })).rows;
      expect(g).toMatchObject({ kind: 'goal', id: 'lead-rollback', name: 'One-click rollback for every deployable service', detail: 'G-10 · Tunde Bakare · Build & Release', status: 'on', key: 'G-10' });
      expect((await search.search('person', { q: 'rhea' })).rows[0]).toMatchObject({ kind: 'person', id: 'rhea', name: 'Rhea Kapoor', detail: 'Engineering Manager, CI/CD · CI/CD' });
      expect((await search.search('team', { q: 'CI/CD' })).rows[0]).toMatchObject({ kind: 'team', id: 'cicd', name: 'CI/CD', detail: 'Led by Rhea Kapoor · 7 people' });
    });

    it('takes a Goals link’s filters and sort, and orders goals worst first when unsorted', async () => {
      expect((await search.search('goal', { q: '', filters: { status: 'off' } })).total).toBe(11);
      const worst = (await search.search('goal', { q: '', size: 200 })).rows.map((r) => r.status);
      const rank = { off: 3, risk: 2, stale: 2, on: 1, done: 0, planned: 0, none: 0 } as Record<string, number>;
      expect(worst.every((s, i) => i === 0 || rank[worst[i - 1]!]! >= rank[s!]!)).toBe(true);
      const byName = (await search.search('goal', { q: 'tunde', sort: 'title' })).rows.map((r) => r.name);
      expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    });

    it('pages by key: every row once and none twice, with the total on every page', async () => {
      const seen: string[] = [];
      let after: string | null = null, pages = 0;
      do {
        const a = await search.search('person', { q: '', size: 30, after });
        expect(a.total).toBe(96);
        expect(a.rows.length).toBeLessThanOrEqual(30);
        seen.push(...a.rows.map((r) => r.id));
        after = a.next;
        pages++;
      } while (after && pages < 10);
      expect(seen.length).toBe(96);
      expect(new Set(seen).size).toBe(96);
    });

    it('never gives a picker someone marked as left', async () => {
      expect(await ids('person', 'oskar')).toEqual([]);
      expect((await search.search('person', { q: '', size: 200 })).rows.some((r) => r.id === 'oskar')).toBe(false);
    });

    it('may offer a near miss when nothing matches, and says nothing when nothing is near', async () => {
      const a = await search.search('goal', { q: 'rolback' });
      if (a.near !== undefined) { expect(a.near).toBe('rollback'); expect(a.rows.map((r) => r.id)).toContain('lead-rollback'); }
      else expect(a.total).toBe(0);
      const z = await search.search('goal', { q: 'zzzz' });
      expect(z).toMatchObject({ total: 0, rows: [], next: null });
      expect(z.near).toBeUndefined();
    });
  });
}

export function prefsContract(name: string, make: () => Prefs) {
  describe(`the prefs contract: ${name}`, () => {
    it('reads a value back for that person in that workspace, and for nobody else', () => {
      const p = make();
      expect(p.get('ws_a', 'ada', 'recents')).toBeNull();
      p.set('ws_a', 'ada', 'recents', [{ kind: 'goal', id: 'g1' }]);
      p.set('ws_a', 'ada', 'scope', 'mine');
      expect(p.get('ws_a', 'ada', 'recents')).toEqual([{ kind: 'goal', id: 'g1' }]);
      expect(p.get('ws_a', 'ada', 'scope')).toBe('mine');
      expect(p.get('ws_a', 'grace', 'recents')).toBeNull();
      expect(p.get('ws_b', 'ada', 'recents')).toBeNull();
      expect(make().get('ws_a', 'ada', 'scope')).toBe('mine');
      p.set('ws_a', 'ada', 'scope', null);
      expect(p.get('ws_a', 'ada', 'scope')).toBeNull();
    });
  });
}
