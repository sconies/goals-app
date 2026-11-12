/* The contract for the query port (src/ports/goals.ts; AX5). It takes a way to make the port over a workspace as it
   stood at a moment, and checks the four things spec/rebuild/ports-at-scale.md asks of any query port:
     1. the summaries are the rules: every row's status and flags are those in spec/conformance/status.csv and flags.csv;
     2. keyset paging never skips or repeats a row, even when goals are added between pages;
     3. no read is larger than a page;
     4. only goal() gives a goal's check-ins;
   and that a scope is answered by its name for the person asking, and a list with no sort comes worst first, then by
   title (goals.csv's order).
   Its cases are data in spec/conformance/goals.csv, so a rewrite in any language can run them too.
   src/adapters/parts.test.ts runs it on Faro's adapter; run it on yours. */
import fs from 'node:fs';
import path from 'node:path';
import type { Snapshot } from '../../domain/types';
import { EMPTY_QUERY, parseQuery } from '../../domain/query';
import { STATUS_ORDER } from '../../domain/vocabulary';
import { allGoals, PAGE_MAX, type Goals } from '../goals';

/** Who asks for the scopes: Rhea owns goals in the conformance workspace. */
const VIEWER = 'rhea';
const conformance = path.join(__dirname, '..', '..', '..', 'spec', 'conformance');
function csv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(path.join(conformance, file), 'utf8');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head!.map((h, i) => [h, r[i] ?? ''])));
}

/**
 * `make(s, viewer)` gives the port over workspace `s`, asked by the person `viewer` (for scopes). The contract calls it
 * with the conformance workspace at the moment it was built for, and again with a goal added, to page across the change.
 */
export function goalsContract(name: string, base: () => Promise<Snapshot>, make: (s: Snapshot, viewer: string) => Promise<Goals>) {
  describe(`the query port contract: ${name}`, () => {
    let s: Snapshot, port: Goals;
    beforeAll(async () => { s = await base(); port = await make(s, VIEWER); }, 60_000);
    const cases = csv('goals.csv');
    const week = Number(csv('status.csv').reduce((w, r) => Math.max(w, Number(r.week)), 0));

    it.each(cases.map((c) => [c.query || '(every goal)', c] as const))('answers the Goals query %s as goals.csv says', async (_, c) => {
      const query = parseQuery(new URLSearchParams(c.query));
      const page = await allGoals(port, { query });
      expect(page.total).toBe(Number(c.total));
      expect(page.near ?? '').toBe(c.near);
      expect(page.rows.map((r) => r.goal.id).join(' ')).toBe(c.ids);
      const n = await port.counts({ query });
      expect(n.total).toBe(Number(c.total));
      for (const k of STATUS_ORDER) expect([k, n.status[k]]).toEqual([k, Number(c[k])]);
      expect(n.attention).toBe(Number(c.attention));
    });

    it('gives each goal the status and flags the rules give it (status.csv and flags.csv, this week)', async () => {
      const rows = (await allGoals(port, { query: EMPTY_QUERY })).rows;
      const status = new Map(csv('status.csv').filter((r) => Number(r.week) === week).map((r) => [r.goal, r]));
      const flags = new Map(csv('flags.csv').filter((r) => Number(r.week) === week).map((r) => [r.goal, r]));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        const key = r.goal.key!;
        expect([key, r.status]).toEqual([key, status.get(key)?.status]);
        expect([key, r.attention.flags.map((f) => f.kind).sort().join(' ')]).toEqual([key, (flags.get(key)?.flags ?? '').split(' ').filter(Boolean).sort().join(' ')]);
      }
    });

    it('pages by key: every goal once and none twice, and a goal added between pages doesn’t move the next page', async () => {
      const first = await port.goals({ query: { ...EMPTY_QUERY, sort: 'title' }, size: 20 });
      expect(first.rows.length).toBe(20);
      expect(first.next).not.toBeNull();
      // A goal whose title sorts first is added before the second page is asked for.
      const top = s.goals.find((g) => !g.parentId)!;
      const later = await make({ ...s, goals: [...s.goals, { ...top, id: 'aaa-added', key: undefined, title: 'AAA added between pages' }] }, VIEWER);
      const seen = first.rows.map((r) => r.goal.id);
      let next = first.next;
      while (next) { const p = await later.goals({ query: { ...EMPTY_QUERY, sort: 'title' }, size: 20, after: next }); seen.push(...p.rows.map((r) => r.goal.id)); next = p.next; }
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).not.toContain('aaa-added');
      expect(seen.length).toBe(first.total);
    });

    it('never gives more than a page, whatever size is asked for', async () => {
      const p = await port.goals({ query: EMPTY_QUERY, size: 10_000 });
      expect(p.rows.length).toBeLessThanOrEqual(PAGE_MAX);
      expect(p.total).toBeGreaterThan(PAGE_MAX);
      expect(p.next).not.toBeNull();
    });

    it('gives a goal’s check-ins only through goal()', async () => {
      const p = await port.goals({ query: EMPTY_QUERY });
      for (const r of p.rows) { expect(r).not.toHaveProperty('checkIns'); expect(r).not.toHaveProperty('series'); }
      const id = p.rows.find((r) => r.lastWeek != null)!.goal.id;
      const one = await port.goal(id);
      expect(one?.goal.id).toBe(id);
      expect(one!.checkIns.length).toBeGreaterThan(0);
      expect(one!.checkIns.every((c) => c.goalId === id)).toBe(true);
      expect(await port.goal('nowhere')).toBeNull();
    });

    it('narrows to a scope by its name, for the person asking, and counts the same filter', async () => {
      const ids = async (ask: Parameters<Goals['goals']>[0]) => (await allGoals(port, ask)).rows.map((r) => r.goal.id);
      const owned = await ids({ query: parseQuery(new URLSearchParams(`owner=${VIEWER}`)) });
      expect(owned.length).toBeGreaterThan(0);
      expect(await ids({ query: EMPTY_QUERY, scope: 'mine' })).toEqual(owned);
      expect(await ids({ query: EMPTY_QUERY, scope: 'team:cicd' })).toEqual(await ids({ query: parseQuery(new URLSearchParams('team=cicd')) }));
      expect(await ids({ query: EMPTY_QUERY, scope: 'all' })).toEqual(await ids({ query: EMPTY_QUERY }));
      expect((await port.counts({ query: EMPTY_QUERY, scope: 'mine' })).total).toBe(owned.length);
    });

    it('lists with no sort worst first, then by title', async () => {
      const rows = (await allGoals(port, { query: EMPTY_QUERY })).rows;
      // Worst is off, then at risk and stale together, then on track, then the rest (no check-in, planned, done).
      const worse: Record<string, number> = { off: 3, risk: 2, stale: 2, on: 1, none: 0, planned: 0, done: 0 };
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1]!, b = rows[i]!;
        const ok = worse[a.status]! > worse[b.status]! || (worse[a.status] === worse[b.status] && a.goal.title.localeCompare(b.goal.title) <= 0);
        expect([a.goal.id, b.goal.id, ok]).toEqual([a.goal.id, b.goal.id, true]);
      }
    });
  });
}
