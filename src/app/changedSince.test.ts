// @vitest-environment node
/* Home rule 5 on the example workspace (HM4): what "Changed since" counts is what its links open in Goals and what
   find_goals answers, worked out by the status rule on the day it counts from (movesSince). */
import { buildPlatformOrg } from '../data/platformOrg';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import { changedSet, changedSince } from '../domain/changed';
import { scopesFor } from '../domain/goalsPage';
import { asTeams } from '../domain/homeSets';
import { EMPTY_QUERY, applyQuery } from '../domain/query';
import { callTool, type McpContext } from '../mcp/tools';
import { browserPrefs } from '../adapters/local';
import { homeSince, markHomeSeen } from './homeSeen';
import { goalRows, scopeFacts } from './reads';
import { movesSince } from './moved';

const today = new Date('2026-11-11T12:00:00Z');
const full = buildPlatformOrg(today);
const cycle = currentCycle(full.cycles, today)!;
const s = scopeToCycle(full, cycle);
const week = currentWeek(cycle, today);
const moves = movesSince(s, cycle, today);
const changedFor = (who: string, since: string | null, watching = true) => {
  const { tabs } = scopesFor(scopeFacts(s, s.people.find((p) => p.id === who)!), null, { watching });
  const set = changedSet(tabs, who, s.goals, (id) => s.teams.find((t) => t.id === id)?.name ?? '', asTeams);
  if (!set) return null;
  const goals = set.goals.map((x) => { const g = s.goals.find((y) => y.id === x.id)!; return { ...x, title: g.title, teamId: g.teamId, was: moves.was(g, since), now: moves.now(g) }; });
  return { scope: set.scope, ids: new Set(tabs.find((t) => t.id === set.scope)!.ids), ...changedSince(goals, since) };
};

describe('Changed since on the example workspace, Wed 11 Nov', () => {
  it('Amara, since Fri 6 Nov: her Watching set, 1 recovered and 2 went quiet, each said with its team', () => {
    const c = changedFor('amara', '2026-11-06')!;
    expect(c.scope).toBe('watching');
    expect(c.counts).toEqual({ worse: 0, better: 1, quiet: 2, done: 0 });
    expect(c.rows.map((r) => r.kind)).toEqual(['quiet', 'quiet', 'better']);
    expect(c.rows.every((r) => s.teams.some((t) => t.name === r.setName))).toBe(true);
  });
  it('each count is what Goals lists for its link, and find_goals says the same', async () => {
    const rows = goalRows(s, cycle, today, week);
    const c = changedFor('amara', '2026-11-06')!;
    const actor = full.people.find((p) => p.id === 'amara')!;
    const ctx: McpContext = { ws: { id: 'w', name: 'Platform', modulesOff: [] }, snapshot: s, cycle, week, today, actor, now: '2026-11-11T13:00:00Z', newId: (p) => p, allGoals: full.goals, full, save: async () => {}, issueToken: async () => 'secret' };
    for (const kind of ['better', 'quiet', 'worse', 'done'] as const) {
      const listed = applyQuery(rows.summaries.filter((x) => c.ids.has(x.goal.id)), { ...EMPTY_QUERY, moved: kind, since: '2026-11-06' }, rows.ctx).length;
      expect(listed).toBe(c.counts[kind]);
      const r = await callTool('find_goals', { query: `scope=watching&moved=${kind}&since=2026-11-06`, limit: 200 }, ctx);
      expect(JSON.parse(r.text).total).toBe(c.counts[kind]);
    }
  });
  it('with Watching off, those goals are left out: Amara’s widest set is then her team’s one goal, and nothing in it moved', () => {
    const c = changedFor('amara', '2026-11-06', false)!;
    expect([c.scope, c.ids.size, c.rows.length]).toEqual(['team', 1, 0]);
  });
  it('Rhea counts her widest set, My team, its goals said as yours or your team', () => {
    const c = changedFor('rhea', '2026-11-06')!;
    expect(c.scope).toBe('team');
    expect(c.rows.length).toBe(c.counts.better + c.counts.worse + c.counts.quiet + c.counts.done);
    expect(c.rows.every((r) => r.setName === 'yours' || r.setName === 'your team')).toBe(true);
  });
});

describe('home-seen behind the Prefs port', () => {
  const store = new Map<string, string>();
  const memory = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as unknown as Storage;
  const prefs = browserPrefs('faro-prefs:', () => memory);
  it('opening Home on a new day keeps the day before; the same day again changes nothing; each person and workspace apart', () => {
    markHomeSeen('ws', 'rhea', '2026-11-06', prefs);
    expect(homeSince('ws', 'rhea', '2026-11-06', prefs)).toBeNull();
    markHomeSeen('ws', 'rhea', '2026-11-10', prefs);
    expect(store.get('faro-prefs:ws:rhea:home-seen')).toBe('{"last":"2026-11-10","prev":"2026-11-06"}');
    markHomeSeen('ws', 'rhea', '2026-11-10', prefs);
    expect(homeSince('ws', 'rhea', '2026-11-10', prefs)).toBe('2026-11-06');
    expect(homeSince('ws', 'amara', '2026-11-10', prefs)).toBeNull();
    expect(homeSince('other', 'rhea', '2026-11-10', prefs)).toBeNull();
  });
});
