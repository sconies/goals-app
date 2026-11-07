/* Spec scenarios for Lane's review notes (5 Nov), data: readable goal keys and data-table layouts. Each case is tagged
   with its requirement ID. The browser side (dragging, resizing, saving and exporting at phone and desktop widths) is
   checked by evals/notes/5-data-ids.cjs. */
import { describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import * as A from '../src/domain/actions';
import { applyCommit, BrowserStore } from '../src/data/store';
import { goalFromRows, goalToRows } from '../src/data/rows';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import { planChanges, type ChangeInput, type Rec } from '../src/domain/changeset';
import { nextCycle, scopeToCycle } from '../src/domain/cycle';
import { toCsv, toJson, workbook } from '../src/domain/export';
import { findGoal, normalKey, settleKeys, withKeys } from '../src/domain/goalKey';
import { currentWeek } from '../src/domain/plan';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../src/domain/importer';
import { isTableView, layoutParams, moveColumn, parseLayout, shownTable, visibleColumns, type TableLayout } from '../src/domain/tableLayout';
import type { ApiToken, Goal, Snapshot } from '../src/domain/types';
import { hashToken, newToken } from '../src/mcp/protocol';

const R = (id: 'READABLE-IDS' | 'TABLE-LAYOUTS', text: string) => `[${id}] ${text}`;
const OCT = new Date('2026-11-05T12:00:00Z'); // Thursday of week 45
const s = seed(OCT);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, OCT);
const person = (id: string) => s.people.find((p) => p.id === id)!;
let n = 0;
const input = (actor: string, tables: ChangeInput['tables'], snap: Snapshot = s): ChangeInput => ({ tables, snapshot: snap, cycle, week, actor: person(actor), now: OCT.toISOString(), newId: (p) => `${p}_k${++n}`, via: 'mcp' });
const rec = (o: Record<string, string>): Rec => ({ __row: '2', ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
const book = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today: OCT });
const sheet = (name: string) => book.find((t) => t.name === name)!;

async function as(personId: string, start: Snapshot = s) {
  let data: Snapshot = start;
  const token = newToken();
  const t: ApiToken = { id: 'tok-' + personId, personId, name: 'Eval', tokenHash: await hashToken(token), createdBy: 'amara', createdAt: OCT.toISOString(), lastUsedAt: null, revokedAt: null };
  data = { ...data, tokens: [...(data.tokens ?? []), t] };
  const deps: Deps = {
    findToken: async (h) => { const x = (data.tokens ?? []).find((k) => k.tokenHash === h && !k.revokedAt); return x ? { token: x, workspaceId: 'acme' } : null; },
    workspaceName: async () => 'Acme', load: async () => data, commit: async (_ws, c) => { data = applyCommit(data, c); }, touch: async () => undefined, now: () => OCT,
  };
  let id = 0;
  const call = async (name: string, args: object = {}) => {
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }) }), deps);
    const body = await res.json() as { result: { content: { text: string }[]; structuredContent?: Record<string, any>; isError: boolean } };
    return { text: body.result.content[0]!.text, data: body.result.structuredContent, error: body.result.isError };
  };
  return { call, data: () => data };
}

describe('readable goal keys', () => {
  it(R('READABLE-IDS', 'every example goal has a key, G-1 to G-126 in the order they were created, none twice'), () => {
    // The example is written in groups, so the list isn't in creation order; the keys are: G-1 to G-126 with no gap, and a later key never belongs to an earlier goal.
    const byKey = [...s.goals].sort((a, b) => Number(a.key!.slice(2)) - Number(b.key!.slice(2)));
    expect(byKey.map((g) => g.key)).toEqual(Array.from({ length: s.goals.length }, (_, i) => `G-${i + 1}`));
    expect(byKey.every((g, i) => i === 0 || byKey[i - 1]!.createdAt <= g.createdAt)).toBe(true);
    expect(s.goals.find((g) => g.id === 'ns-lead')!.key).toBe('G-1');
    expect(s.goals.find((g) => g.id === 'ci-cost')!.key).toBe('G-126');
  });

  it(R('READABLE-IDS', 'a key is accepted wherever an ID is, in any case and with or without the dash'), () => {
    for (const ref of ['G-6', 'g-6', 'g6', ' G6 ', 'lead-merge']) expect(findGoal(s.goals, ref)?.id).toBe('lead-merge');
    expect(findGoal(s.goals, 'G-999')).toBeUndefined();
    expect(normalKey('g12')).toBe('G-12');
  });

  it(R('READABLE-IDS', 'data from before keys gets them oldest first, the same every time it is read'), () => {
    const bare = s.goals.map(({ key: _k, ...g }) => g as Goal);
    const once = withKeys([...bare].reverse());
    expect(once.find((g) => g.id === 'ns-lead')!.key).toBe('G-1');
    expect(withKeys([...bare].reverse())).toEqual(once);
  });

  it(R('READABLE-IDS', 'a new goal takes the next key; changing a goal never changes its key'), () => {
    const cs = planChanges(input('amara', { goals: [
      rec({ Goal: 'Runbooks with an owner', Owner: 'Mateo Fernández', Type: 'metric', Unit: '%', Start: '20', Target: '90' }),
      { ...rec({ Goal: 'On-call handovers written', Owner: 'Mateo Fernández', Type: 'metric', Unit: '%', Start: '10', Target: '80' }), __row: '3' },
      { ...rec({ ID: 'lead-mq', Level: 'svp' }), __row: '4' },
    ] }));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const goals = cs.commit!.goals!;
    expect(goals.filter((g) => !s.goals.some((x) => x.id === g.id)).map((g) => g.key).sort()).toEqual(['G-127', 'G-128']);
    expect(goals.find((g) => g.id === 'lead-mq')!.key).toBe('G-7');
  });

  it(R('READABLE-IDS', 'a key is never used again: a later cycle starts after the highest key any cycle gave'), () => {
    const older: Goal = { ...s.goals[0]!, id: 'old', cycleId: 'last-year', key: 'G-140', title: 'Something we stopped' };
    const scoped = scopeToCycle({ ...s, goals: [...s.goals, older], cycles: [...s.cycles, { ...cycle, id: 'last-year', startDate: '2025-01-01' }] }, cycle);
    expect(scoped.keysIssued).toBe(140);
    const cs = planChanges(input('amara', { goals: [rec({ Goal: 'A brand new goal', Owner: 'Rhea Kapoor', Type: 'metric', Unit: '%', Start: '1', Target: '2' })] }, scoped));
    expect(cs.commit!.goals![0]!.key).toBe('G-141');
  });

  it(R('READABLE-IDS', 'a goal carried into the next cycle keeps its key there'), () => {
    const next = nextCycle(cycle, s.goals, s.checkIns, [], { cycle: 'y2', goal: (g) => g.id + '-2' }, OCT.toISOString());
    expect(next.goals.find((g) => g.id === 'ns-cfr-2')!.key).toBe('G-35');
  });

  it(R('READABLE-IDS', 'two people adding a goal at once with the same key: the second gets the next one'), () => {
    const make = (id: string): Goal => ({ ...s.goals[1]!, id, title: id, key: 'G-127', createdAt: OCT.toISOString() });
    const a = applyCommit(s, { goals: [make('first')], changes: [] });
    const b = applyCommit(a, { goals: [make('second')], changes: [] });
    expect(['first', 'second'].map((id) => b.goals.find((g) => g.id === id)!.key)).toEqual(['G-127', 'G-128']);
    // And a save that tries to change an existing goal's key keeps the old one.
    expect(settleKeys(s.goals, [{ ...s.goals[2]!, key: 'G-99' }])[0]!.key).toBe('G-3');
  });

  it(R('READABLE-IDS', 'the spreadsheet, the data tables and the assistant match goals by key in ID, Key, Feeds into ID, Goal key and the Plan sheet'), () => {
    const cs = planChanges({ ...input('amara', {
      goals: [rec({ Key: 'G-7', Level: 'svp' }), { ...rec({ ID: 'G-102', 'Feeds into ID': 'G-59' }), __row: '3' }],
      plan: [rec({ Key: 'G-17', 'Week 50': '81' })],
      checkIns: [rec({ 'Goal key': 'G-49', Week: String(week), Value: '61', Cause: 'Change landed early', Why: 'Rules tuned for the noisiest services', 'Path to green': 'Add two reviewers on call', 'Back on plan by week': '48' })],
    }), reason: 'Faster runners arrive in December' });
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const by = (id: string) => cs.commit!.goals!.find((g) => g.id === id)!;
    expect(by('lead-mq').level).toBe('svp');
    expect(by('env-search').parentId).toBe('ns-cost');
    expect(by('lead-cache').key).toBe('G-17');
    expect(cs.commit!.checkIns![0]!.goalId).toBe('mttr-pir');
    const bad = planChanges(input('amara', { goals: [rec({ Key: 'G-999', Level: 'svp' }), { ...rec({ ID: 'lead-mq', Key: 'G-2', Level: 'svp' }), __row: '3' }] }));
    expect(bad.issues.map((i) => i.message)).toEqual([expect.stringMatching(/no goal with key G-999/), expect.stringMatching(/Key G-2 isn’t this goal’s key \(G-7\)/)]);
  });

  it(R('READABLE-IDS', 'exports lead with the key: the Goals and Plan sheets, check-ins, JSON and the brief'), () => {
    expect(sheet('Goals').rows[0]!.slice(0, 3)).toEqual(['Key', 'ID', 'Goal']);
    expect(sheet('Goals').rows[1]!.slice(0, 2)).toEqual(['G-1', 'ns-lead']);
    expect(sheet('Plan').rows[0]!.slice(0, 2)).toEqual(['Key', 'ID']);
    expect(sheet('Check-ins').rows[0]!.slice(0, 3)).toEqual(['ID', 'Goal key', 'Goal ID']);
    expect(toJson({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today: OCT }).goals[0]).toMatchObject({ id: 'ns-lead', key: 'G-1' });
  });

  it(R('READABLE-IDS', 'keys are stored with the goal and come back from the database, and a new workspace numbers its goals from G-1'), async () => {
    const g = s.goals.find((x) => x.id === 'lead-mq')!;
    expect(goalFromRows(goalToRows('ws', g).goal, goalToRows('ws', g).stages).key).toBe('G-7');
    const built = buildWorkspace({ name: 'New', startDate: '2025-12-29', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now: OCT, idSuffix: 'k' }).snapshot;
    expect(built.goals.map((x) => x.key)).toEqual(built.goals.map((_, i) => `G-${i + 1}`));
    // The browser store gives keys to data saved before keys existed, once, and keeps them.
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) } as unknown as Storage;
    const store = new BrowserStore(() => OCT, { key: 'keys-eval', storage });
    mem.set('keys-eval:old', JSON.stringify({ ...s, goals: s.goals.map(({ key: _k, ...x }) => x) }));
    expect((await store.load('old')).goals.map((x) => x.key)).toEqual(s.goals.map((x) => x.key));
    expect((JSON.parse(mem.get('keys-eval:old')!) as Snapshot).goals.every((x) => x.key)).toBe(true);
  });

  it(R('READABLE-IDS', 'the AI assistant finds a goal by its key and accepts the key in every tool that takes a goal'), async () => {
    const mateo = await as('mateo');
    const found = await mateo.call('find_goals', { text: 'G-6' });
    expect(found.data!.goals.map((g: { id: string; key: string }) => [g.key, g.id])).toEqual([['G-6', 'lead-merge']]);
    expect(found.text).toMatch(/^G-6 · lead-merge · Merge-to-deploy time/);
    const full = await mateo.call('get_goal', { goal_id: 'g-102' });
    expect(full.data!.goal).toMatchObject({ id: 'env-search', key: 'G-102' });
    expect((await mateo.call('post_check_in', { goal_id: 'G-49', value: 61, cause: 'Change landed early', why: 'Rules tuned for the noisiest services', path_to_green: 'Add two reviewers on call', back_on_plan_by_week: 48, dry_run: true })).text).toMatch(/Checked, not saved/);
    expect((await mateo.call('add_comment', { goal_id: 'G-6', text: 'Looking better this week' })).error).toBe(false);
    expect(mateo.data().changes.at(-1)!.goalId).toBe('lead-merge');
    expect((await mateo.call('watch', { kind: 'goal', ref: 'G-1' })).text).toMatch(/Watching Lead time for changes/);
    expect(mateo.data().watches.at(-1)!.ref).toBe('ns-lead');
    expect((await mateo.call('bulk_change', { check_ins: [{ 'Goal key': 'G-41', Week: week, Value: 80, Cause: 'Change landed early', Why: 'Warm caches on the new runners', 'Path to green': 'Add two reviewers on call', 'Back on plan by week': 48 }] })).text).toMatch(/Checked, not saved/);
    const missing = await mateo.call('get_goal', { goal_id: 'G-404' });
    expect([missing.error, missing.text]).toEqual([true, expect.stringMatching(/no goal with key G-404/)]);
  });
});

describe('data-table layouts', () => {
  const goals = sheet('Goals');
  const head = goals.rows[0]!.map(String);

  it(R('TABLE-LAYOUTS', 'the name column comes first; then the chosen columns in their order, with the key always there'), () => {
    expect(visibleColumns('goals', head, null).slice(0, 3)).toEqual(['Goal', 'Key', 'Level']);
    expect(visibleColumns('goals', head, ['Owner', 'Status', 'Goal'])).toEqual(['Goal', 'Key', 'Owner', 'Status']);
    expect(visibleColumns('goals', head, ['Status', 'Key', 'Owner', 'Nonsense'])).toEqual(['Goal', 'Status', 'Key', 'Owner']);
    expect(moveColumn(['Goal', 'Key', 'Owner', 'Status'], 'Status', 1)).toEqual(['Goal', 'Status', 'Key', 'Owner']);
  });

  it(R('TABLE-LAYOUTS', 'a layout (columns, widths, search, filters, sort) goes into a query string and comes back the same; widths stay in bounds'), () => {
    const l: TableLayout = { table: 'goals', cols: ['Owner', 'Key', 'Status'], widths: { Owner: 220, Status: 4000, Key: 10 }, q: 'cost', filters: [{ col: 'Level', op: 'is', value: 'team|svp' }], sort: { col: 'Owner', dir: -1 } };
    const back = parseLayout(layoutParams(l))!;
    expect(back).toEqual({ ...l, widths: { Owner: 220, Status: 640, Key: 56 } });
    expect(isTableView({ params: layoutParams(l) })).toBe(true);
    expect(isTableView({ params: 'status=off' })).toBe(false);
  });

  it(R('TABLE-LAYOUTS', 'the table exports exactly as shown: those columns in that order, only the rows that pass, sorted, numbers as numbers'), () => {
    const l: TableLayout = { table: 'goals', cols: ['Owner', 'Key', 'Target'], widths: {}, q: '', filters: [{ col: 'Owner', op: 'is', value: 'Mateo Fernández' }], sort: { col: 'Key', dir: -1 } };
    const out = shownTable(goals, l);
    expect(out[0]).toEqual(['Goal', 'Owner', 'Key', 'Target']);
    expect(out.slice(1).map((r) => r[2])).toEqual(['G-49', 'G-41']);
    expect(out.slice(1).every((r) => r[1] === 'Mateo Fernández')).toBe(true);
    expect(typeof out[1]![3]).toBe('number');
    expect(toCsv(out).split('\r\n')[0]).toBe('Goal,Owner,Key,Target');
  });

  it(R('TABLE-LAYOUTS', 'a layout saves as a table view of the person’s, kept apart from the Goals screen’s views; an unknown column is refused'), () => {
    const x: A.ActionContext = { snapshot: s, cycle, week, actor: person('rhea'), now: OCT.toISOString(), newId: (p) => `${p}_tv` };
    const out = A.saveTableView(x, { name: 'Owners and gaps', layout: { table: 'goals', cols: ['Owner', 'Gap'], widths: { Owner: 200 }, q: '', filters: [], sort: null } }, head);
    const v = out.commit.views![0]!;
    expect([v.personId, v.name, parseLayout(v.params)!.cols]).toEqual(['rhea', 'Owners and gaps', ['Owner', 'Gap']]);
    expect(() => A.saveTableView(x, { name: 'Bad', layout: { table: 'goals', cols: ['Owner', 'Mood'], widths: {}, q: '', filters: [], sort: null } }, head)).toThrow(/no column called “Mood”/);
    expect(() => A.saveView(x, { name: 'Odd', params: 'table=cats' })).toThrow(/one of goals/);
  });

  it(R('TABLE-LAYOUTS', 'the AI assistant saves a table layout, lists it and exports the table as that view shows it'), async () => {
    const rhea = await as('rhea');
    const saved = await rhea.call('save_table_view', { name: 'Mateo’s goals', table: 'goals', columns: ['Key', 'Owner', 'Status'], widths: { Owner: 180 }, query: 'f=Owner~is~Mateo Fernández&s=Key~asc' });
    expect(saved.error).toBe(false);
    const listed = (await rhea.call('list_views')).data!.views.find((v: { name: string }) => v.name === 'Mateo’s goals');
    expect(listed).toMatchObject({ table: 'goals', columns: ['Key', 'Owner', 'Status'], widths: { Owner: 180 } });
    const csv = await rhea.call('export_table', { view: 'Mateo’s goals' });
    // The view's columns, then the goal's ID (a column that says which record a row is), so it loads back.
    expect(csv.text.split('\r\n').slice(0, 2)).toEqual(['Goal,Key,Owner,Status,ID', expect.stringMatching(/^Mean time to restore service \(P1 and P2\),G-41,Mateo Fernández,/)]);
    expect((await rhea.call('export_table', { table: 'goals', columns: ['Mood'] })).text).toMatch(/no column called “Mood”/);
    // A table view isn't one of the Goals screen's views.
    expect((await rhea.call('find_goals', { view: 'Mateo’s goals' })).error).toBe(true);
  });
});
