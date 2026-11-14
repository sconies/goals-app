// @vitest-environment node
/* post_check_in's reading (NR rule 3): with reading_confirmed or different_because the server asks the same source and
   records the reading under the engine's rule; without them nothing is read; with the metric library off, it says so. */
import { serve, type Deps } from '../../../server/mcp';
import { applyCommit } from '../../data/store';
import { buildPlatformOrg } from '../../data/platformOrg';
import { hashToken, newToken } from '../../mcp/protocol';
import { filledAt } from '../../domain/readingWords';
import type { ApiToken, MetricGoal, Snapshot } from '../../domain/types';

const today = new Date('2026-11-05T12:00:00Z');
const built = buildPlatformOrg(today);
// Week 45's check-in on CI pipeline time taken away, so Daniel's post is this week's first. The source, made from the
// example's check-ins before this week, continues week 44's 20 by its last step: 19 at 09:00 today.
const fresh = (s: Snapshot) => { s.checkIns = s.checkIns.filter((c) => !(c.goalId === 'ns-ci' && c.week === 45)); };

async function setup(modulesOff: string[] = [], edit?: (s: Snapshot) => void) {
  let data: Snapshot = structuredClone(built);
  fresh(data);
  edit?.(data);
  const token = newToken();
  const t: ApiToken = { id: 'tok1', personId: 'daniel', name: 'Test', tokenHash: await hashToken(token), createdBy: 'grace', createdAt: today.toISOString(), lastUsedAt: null, revokedAt: null };
  const deps: Deps = {
    findToken: async (h) => (h === t.tokenHash ? { token: t, workspaceId: 'platform-org' } : null),
    workspaceName: async () => 'Platform Engineering',
    modulesOff: async () => modulesOff,
    load: async () => data,
    commit: async (_ws, c) => { data = applyCommit(data, c); },
    touch: async () => undefined,
    now: () => today,
  };
  let id = 0;
  const call = async (name: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    return (await res.json()).result as { content: { text: string }[]; isError: boolean; structuredContent?: Record<string, unknown> };
  };
  const latest = () => data.checkIns.filter((c) => c.goalId === 'ns-ci').sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1)!;
  return { call, latest };
}

describe('post_check_in reads the goal’s source (NR rule 3)', () => {
  it('records a confirmed reading, the value taken from it', async () => {
    const { call, latest } = await setup();
    const r = await call('post_check_in', { goal_id: 'ns-ci', reading_confirmed: true });
    expect(r.isError, r.content[0]!.text).toBe(false);
    expect(latest()).toMatchObject({ week: 45, value: 19, reading: { source: 'CI analytics', value: 19, at: '2026-11-05T09:00:00.000Z' } });
    expect(latest().reading!.why).toBeUndefined();
  });

  it('refuses a different number with no reason, and records it with one', async () => {
    const { call, latest } = await setup();
    const no = await call('post_check_in', { goal_id: 'ns-ci', value: 20, reading_confirmed: true });
    expect(no.isError).toBe(true);
    expect(no.content[0]!.text).toMatch(/CI analytics said 19\. Say why your number is different\./);
    const yes = await call('post_check_in', { goal_id: 'ns-ci', value: 20, different_because: { kind: 'behind' } });
    expect(yes.isError, yes.content[0]!.text).toBe(false);
    expect(latest()).toMatchObject({ value: 20, reading: { value: 19, why: { kind: 'behind' } } });
  });

  it('reads nothing without them, and says the module-off sentence with the metric library off', async () => {
    const plain = await setup();
    expect((await plain.call('post_check_in', { goal_id: 'ns-ci', value: 20 })).isError).toBe(false);
    expect(plain.latest().reading).toBeUndefined();
    const off = await setup(['metrics']);
    const r = await off.call('post_check_in', { goal_id: 'ns-ci', value: 20, reading_confirmed: true });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/^Metric library is switched off in Platform Engineering/);
  });
});

describe('the AI sees where a number came from, as the screens show it (NR 2.4)', () => {
  it('get_goal says each check-in’s reading in History’s words; get_metric says how each goal fills in and how often it was typed over', async () => {
    const { call } = await setup();
    expect((await call('post_check_in', { goal_id: 'ns-ci', value: 20, different_because: { kind: 'other-count', text: 'It leaves out release branches.' } })).isError).toBe(false);
    const g = await call('get_goal', { goal_id: 'ns-ci' });
    const cis = (g.structuredContent!.goal as { checkIns: { week: number; numberFrom: unknown }[] }).checkIns;
    expect(cis.find((c) => c.week === 45)!.numberFrom).toEqual({ from: 'Typed', sourceSaid: 19, measuredAt: '2026-11-05T09:00:00.000Z', reason: 'The source counts something else: “It leaves out release branches.”', says: 'Typed by Daniel Okafor. CI analytics said 19 min. The source counts something else: “It leaves out release branches.”' });
    expect(cis.find((c) => c.week === 44)!.numberFrom).toBe(null);
    const m = await call('get_metric', { metric: 'metric_ci-time' });
    expect(m.structuredContent).toMatchObject({ goals: [{ goalId: 'ns-ci', inItsCheckIn: 'Filled in from CI analytics · last read 9:00 today' }], differentNumbers: [{ source: 'CI analytics', checkIns: 1, different: 1, weeks: [{ goalId: 'ns-ci', week: 45 }] }] });
    expect(m.content[0]!.text).toMatch(/In the last 8 weeks, 1 of 1 check-in filled in from CI analytics used a different number\. \(G-\d+ week 45\)/);
  });
});

describe('after #437’s review', () => {
  it('refuses reading fields for any week but this one (medium 2): a source reads what it says now', async () => {
    const { call, latest } = await setup();
    const before = latest();
    const r = await call('post_check_in', { goal_id: 'ns-ci', week: 43, reading_confirmed: true });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/for this week’s check-in \(week 45\) only/);
    expect(latest()).toBe(before);
    expect((await call('post_check_in', { goal_id: 'ns-ci', week: 45, reading_confirmed: true })).isError).toBe(false);
  });

  it('compares at the goal’s places, not the metric’s (medium 4): a reason given for 19.4 against 19 is kept', async () => {
    const { call, latest } = await setup([], (s) => { (s.goals.find((g) => g.id === 'ns-ci') as MetricGoal).decimals = 1; });
    const r = await call('post_check_in', { goal_id: 'ns-ci', value: 19.4, different_because: { kind: 'behind' } });
    expect(r.isError, r.content[0]!.text).toBe(false);
    expect(latest()).toMatchObject({ value: 19.4, reading: { value: 19, why: { kind: 'behind' } } });
  });

  it('fills a field at the goal’s places (medium 6)', () => {
    expect(filledAt(20.4567, 0)).toBe('20');
    expect(filledAt(20.4567, 2)).toBe('20.46');
    expect(filledAt(20, 2)).toBe('20');
  });
});
