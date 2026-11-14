/* The demo's storage (DEMO-STORAGE): the Platform Engineering example is millions of characters, more than a browser
   lets a page keep, so the demo keeps only the visitor's own saves on top of the example rebuilt from its description.
   A change survives a reload; when the browser won't keep it (full, or blocked in a private window), it still applies
   for the visit and the store says so; starting over clears it. One Watching and the end of the four-tab trial are
   checked here too (ONE-WATCHING), as far as code can say it; the journeys check the screens. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../src/data/platformOrg';
import { EXAMPLE } from '../src/data/examples';
import { BrowserStore, SAVE_PROBLEM, type Commit } from '../src/data/store';
import { groupWatched } from '../src/domain/home';
import { attentionFor } from '../src/domain/attention';
import { currentWeek } from '../src/domain/plan';
import { applyQuery, parseQuery } from '../src/domain/query';
import { watchedGoals } from '../src/domain/review';
import { summariseAll } from '../src/domain/summary';

const R = (id: string, text: string) => `[${id}] ${text}`;
const TODAY = new Date('2026-11-05T12:00:00Z');
const today = () => TODAY;

class Browser implements Storage {
  data = new Map<string, string>();
  constructor(private limit = 5_000_000, private blocked = false) {}
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { if (this.blocked) throw new DOMException('no', 'SecurityError'); return this.data.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (this.blocked) throw new DOMException('no', 'SecurityError');
    const used = [...this.data].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0);
    if (used + k.length + v.length > this.limit) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}
const comment = (text: string): Commit => ({ changes: [{ id: 'chg_' + text.length, at: TODAY.toISOString(), actorId: 'oskar', goalId: 'ns-lead', entity: 'note', entityId: 'note_' + text.length, action: 'noted', summary: 'Commented', diffs: [{ field: 'Comment', from: '—', to: text }] }] });
const has = (s: { changes: Commit['changes'] }, text: string) => s.changes.some((c) => c.diffs[0]?.to === text);

describe('the demo keeps your changes', () => {
  it(R('DEMO-STORAGE', 'a comment survives a reload, at the example’s full size, in a browser with 5 million characters of room'), async () => {
    const browser = new Browser();
    const a = new BrowserStore(today, { storage: browser });
    expect(JSON.stringify(await a.load(EXAMPLE.id)).length).toBeGreaterThan(4_000_000);
    await a.commit(EXAMPLE.id, comment('Kept after a reload'));
    expect(a.saveProblem()).toBeNull();
    expect(has(await new BrowserStore(today, { storage: browser }).load(EXAMPLE.id), 'Kept after a reload')).toBe(true);
  });
  it(R('DEMO-STORAGE', 'a full browser keeps the change for the visit and says it will be lost on reload'), async () => {
    const store = new BrowserStore(today, { storage: new Browser(300) });
    await store.commit(EXAMPLE.id, comment('x'.repeat(400)));
    expect(store.saveProblem()).toBe(SAVE_PROBLEM.full);
    expect(SAVE_PROBLEM.full).toMatch(/last only until you reload/);
    expect(has(await store.load(EXAMPLE.id), 'x'.repeat(400))).toBe(true);
  });
  it(R('DEMO-STORAGE', 'a private window that blocks storage is said at once, and the demo still works'), async () => {
    const store = new BrowserStore(today, { storage: new Browser(5_000_000, true) });
    expect(store.saveProblem()).toBe(SAVE_PROBLEM.blocked);
    await store.commit(EXAMPLE.id, comment('Only for this visit'));
    expect(has(await store.load(EXAMPLE.id), 'Only for this visit')).toBe(true);
  });
  it(R('DEMO-STORAGE', 'starting over clears the saves and the note'), async () => {
    const browser = new Browser(600);
    const store = new BrowserStore(today, { storage: browser });
    await store.commit(EXAMPLE.id, comment('y'.repeat(700)));
    expect(store.saveProblem()).not.toBeNull();
    const fresh = await store.resetExample();
    expect(has(fresh, 'y'.repeat(700))).toBe(false);
    expect(store.saveProblem()).toBeNull();
    expect([...browser.data.keys()].some((k) => k.includes(EXAMPLE.id))).toBe(false);
  });
  it(R('DEMO-STORAGE', 'the example is the only one, and its builder isn’t in the main bundle'), () => {
    const src = readFileSync(join(__dirname, '../src/data/examples.ts'), 'utf8');
    expect(src).toMatch(/await import\('\.\/platformOrg\/generate'\)/);
    for (const old of ['seed.ts', 'yearStory.ts']) expect(existsSync(join(__dirname, '../src/data', old))).toBe(false);
  });
});

describe('one Watching', () => {
  const s = buildPlatformOrg(TODAY);
  const cycle = s.cycles[0]!;
  const week = currentWeek(cycle, TODAY);
  it(R('ONE-WATCHING', 'Watching is a Goals scope: /watching goes to /goals?scope=watching, and there is no four-tab trial'), () => {
    expect(existsSync(join(__dirname, '../src/app/navMode.ts'))).toBe(false);
    const watching = readFileSync(join(__dirname, '../src/screens/Watching.tsx'), 'utf8');
    expect(watching).toMatch(/<Navigate to=\{'\/goals\?' \+ p\.toString\(\)\} replace \/>/);
    expect(watching).toMatch(/p\.set\('scope', 'watching'\)/);
    const goals = readFileSync(join(__dirname, '../src/screens/GoalsScreen.tsx'), 'utf8');
    const page = readFileSync(join(__dirname, '../src/domain/goalsPage.ts'), 'utf8');
    expect(page).toMatch(/every\.push\(\{ id: 'watching', label: 'Watching'/);
    expect(goals).not.toMatch(/navMode/);
    const shell = readFileSync(join(__dirname, '../src/ui/Shell.tsx'), 'utf8');
    expect(shell).not.toMatch(/navMode|NavMode/);
    const home = readFileSync(join(__dirname, '../src/screens/Home.tsx'), 'utf8');
    expect(home).not.toMatch(/dash-watch/);
  });
  it(R('ONE-WATCHING', 'the Level filter does what the level tabs did, and Watching’s groups read what the filter leaves'), () => {
    const sums = summariseAll(s.goals, s, cycle, TODAY, week);
    const mine = new Set(watchedGoals('rhea', s).map((g) => g.id));
    const q = parseQuery(new URLSearchParams('show=watching&level=team'));
    expect(q.level).toEqual(['team']);
    const shown = applyQuery(sums, q, { goals: s.goals, cycle, week }).filter((x) => mine.has(x.goal.id)).map((x) => x.goal);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((g) => g.level === 'team')).toBe(true);
    expect(shown.length).toBe(watchedGoals('rhea', s).filter((g) => g.level === 'team').length);
    const groups = groupWatched(shown.map((g) => attentionFor(g, s, cycle, TODAY)));
    expect(groups.quiet.map((a) => a.goal.id)).toContain('env-search');
  });
});
