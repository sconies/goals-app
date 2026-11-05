// @vitest-environment node
/* Keeping the named flows true, like the guide: every flow's article exists, every step's route is a real App.tsx
   route, every action is one AppState has (the same list the MCP parity test checks), and every mark is set by a
   screen. A flow renamed, a route moved or a mark dropped fails here rather than quietly recording nothing. */
import fs from 'node:fs';
import path from 'node:path';
import { ACTIONS } from '../mcp/parity';
import { FLOWS, MARKS } from './flows';
import { articleById } from './guide';

const root = path.join(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const routes = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]!);
const screens = fs.readdirSync(path.join(root, 'src/screens')).filter((f) => f.endsWith('.tsx')).map((f) => fs.readFileSync(path.join(root, 'src/screens', f), 'utf8')).join('\n');

describe('The named flows', () => {
  it('have unique ids, a title, an article that exists, and at least two steps with unique ids', () => {
    expect(new Set(FLOWS.map((f) => f.id)).size).toBe(FLOWS.length);
    expect(FLOWS.map((f) => f.id)).toEqual(expect.arrayContaining(['check-in', 'quick-check-in', 'review', 'new-goal', 'change-goal', 'answer-request', 'import', 'wrap-up', 'set-up']));
    for (const f of FLOWS) {
      expect(articleById(f.article), `${f.id}: article ${f.article}`).toBeDefined();
      expect(f.title.length, f.id).toBeGreaterThan(5);
      expect(f.steps.length, f.id).toBeGreaterThanOrEqual(2);
      expect(new Set(f.steps.map((s) => s.id)).size, f.id).toBe(f.steps.length);
      for (const s of f.steps) expect((s.routes?.length ?? 0) + (s.actions?.length ?? 0) + (s.marks?.length ?? 0), `${f.id}: ${s.id} has no way to reach it`).toBeGreaterThan(0);
    }
  });

  it('reach their steps only by real App.tsx routes', () => {
    for (const f of FLOWS) for (const s of f.steps) for (const r of s.routes ?? []) expect(routes, `${f.id}: ${s.id} ${r}`).toContain(r.split('?')[0]);
  });

  it('name only actions AppState has (the ones MCP parity maps)', () => {
    for (const f of FLOWS) for (const s of f.steps) for (const a of s.actions ?? []) expect(Object.keys(ACTIONS), `${f.id}: ${s.id} ${a}`).toContain(a);
  });

  it('use only marks that exist, each set by a screen', () => {
    const used = new Set(FLOWS.flatMap((f) => [...f.steps.flatMap((s) => s.marks ?? []), ...(f.closedBy ?? [])]));
    expect([...used].filter((m) => !(MARKS as readonly string[]).includes(m))).toEqual([]);
    expect(MARKS.filter((m) => !used.has(m))).toEqual([]);
    expect(MARKS.filter((m) => !screens.includes(`'${m}'`))).toEqual([]);
  });

  it('can always be started and finished: a first step that starts it, a last step that finishes it', () => {
    for (const f of FLOWS) {
      const last = f.steps.at(-1)!;
      expect((last.actions?.length ?? 0) + (last.routes?.length ?? 0), `${f.id} finishes by an action or a page`).toBeGreaterThan(0);
      expect(last.entry, `${f.id}: the last step can't start it`).toBeFalsy();
    }
  });
});
