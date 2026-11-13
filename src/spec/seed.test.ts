// @vitest-environment node
/* The company-size seed (KT gap 9, spec/rebuild/scale.md): scripts/seed.mjs, copied into the kit, writes a workspace of
   copies of the demo that holds together (every reference lands on a record of its own copy), is the same every time,
   and reaches R4's 30,000 goals by default. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copiesFor, writeSeed, COMPANY_GOALS } from '../../scripts/seed.mjs';
import { companyCopies } from './scaleKit';

const root = path.resolve(__dirname, '../..');
const w = JSON.parse(fs.readFileSync(path.join(root, 'spec/conformance/workspace.json'), 'utf8'));
const rows = (dir: string, kind: string) => fs.readFileSync(path.join(dir, `${kind}.jsonl`), 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));

describe('the company-size seed', () => {
  it('copies the demo into divisions whose records point only at their own copy', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'));
    const seed = writeSeed(w, dir, 3);
    expect(seed.counts.goals).toBe(w.goals.length * 3);
    expect(seed.counts.checkIns).toBe(w.checkIns.length * 3);
    const people = rows(dir, 'people'), teams = rows(dir, 'teams'), goals = rows(dir, 'goals'), checkIns = rows(dir, 'checkIns');
    for (const list of [people, teams, goals, checkIns]) expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    const ids = (l: { id: string }[]) => new Set(l.map((r) => r.id));
    const [P, T, G] = [ids(people), ids(teams), ids(goals)];
    expect(goals.every((g) => P.has(g.ownerId) && T.has(g.teamId) && (g.parentId == null || G.has(g.parentId)))).toBe(true);
    expect(checkIns.every((c) => G.has(c.goalId) && c.goalId.endsWith(c.id.match(/_x\d+$/)?.[0] ?? '') )).toBe(true);
    // Copy 0 is the demo, unchanged; the others have names of their own.
    expect(people.slice(0, w.people.length)).toEqual(w.people);
    expect(new Set(people.map((p) => p.name)).size).toBeGreaterThan(people.length / 2);
    expect(new Set(teams.map((t) => t.name)).size).toBe(teams.length);
    // The same input gives the same files, byte for byte.
    const again = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'));
    expect(writeSeed(w, again, 3).sha256).toEqual(seed.sha256);
    for (const d of [dir, again]) fs.rmSync(d, { recursive: true });
  });

  it(`reaches ${COMPANY_GOALS.toLocaleString('en-GB')} goals by default, as the kit's page says`, () => {
    expect(copiesFor(w)).toBe(companyCopies(w.goals.length));
    expect(copiesFor(w) * w.goals.length).toBeGreaterThanOrEqual(COMPANY_GOALS);
    expect((copiesFor(w) - 1) * w.goals.length).toBeLessThan(COMPANY_GOALS);
  });
});
