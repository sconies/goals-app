// @vitest-environment node
/* The database's save functions, run as the app's public user (anon) against the real schema:
   a save is one transaction, a stale save is refused, and a workspace is created or deleted whole. */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWorkspace, GOALS_TEMPLATE, PEOPLE_TEMPLATE } from '../domain/importer';
import { emptyDraft, toCheckIn } from '../domain/checkin';
import { planAt } from '../domain/plan';
import type { Snapshot } from '../domain/types';
import {
  changeFromRow, checkInFromRow, commitPayload, decisionFromRow, goalFromRows, personFromRow, reviewFromRow, teamToRow, watchFromRow, workspaceToRow,
  type ChangeRow, type CheckInRow, type DecisionRow, type GoalRow, type PersonRow, type ReviewRow, type WatchRow,
} from './rows';
import { withExpectations, type Commit } from './store';

const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const now = new Date('2026-10-30T12:00:00Z');

describe('database save functions, as the public user', () => {
  let db: PGlite;
  let snap: Snapshot;
  const ws = 'ws_rpc';
  const asAnon = async <T,>(q: string, params: unknown[]) => {
    await db.exec('set role anon');
    try { return await db.query<T>(q, params); } finally { await db.exec('reset role'); }
  };
  const commit = (c: Commit) => asAnon('select okr_commit($1, $2::jsonb)', [ws, JSON.stringify(commitPayload(ws, c))]);
  const count = async (table: string, where = `workspace_id = '${ws}'`) => (await db.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`)).rows[0]!.n;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec('create role anon nologin;');
    await db.exec(sql);
    const built = buildWorkspace({ name: 'Platform', startDate: '2025-12-29', people: PEOPLE_TEMPLATE, goals: GOALS_TEMPLATE, now, idSuffix: 'rpc1' });
    expect(built.issues).toEqual([]);
    snap = built.snapshot;
    const payload = { ...commitPayload(ws, { ...snap, changes: [] }), teams: snap.teams.map((t) => teamToRow(ws, t)), expect: null };
    await asAnon('select okr_create_workspace($1::jsonb, $2::jsonb)', [JSON.stringify(workspaceToRow({ id: ws, name: 'Platform', kind: 'own', createdAt: now.toISOString() })), JSON.stringify(payload)]);
  }, 30_000);

  it('creates a workspace and everything in it', async () => {
    expect(await count('okr_goals')).toBe(snap.goals.length);
    expect(await count('okr_people')).toBe(snap.people.length);
    expect(await count('okr_stages')).toBeGreaterThan(0);
  });

  it('creates nothing at all when any part of a new workspace is wrong', async () => {
    // Everything valid except one goal of a kind that doesn't exist.
    const good = commitPayload('ws_bad', { ...snap, goals: [], checkIns: [], changes: [] });
    const g = commitPayload('ws_bad', { goals: [snap.goals[0]!], changes: [] }).goals[0]!;
    const bad = { ...good, teams: [], people: [], cycles: [{ ...good.cycles[0]!, id: 'cycle_bad' }], goals: [{ ...g, id: 'g_bad', cycle_id: 'cycle_bad', kind: 'nope' }], expect: null };
    await expect(asAnon('select okr_create_workspace($1::jsonb, $2::jsonb)', [JSON.stringify({ id: 'ws_bad', name: 'Bad', kind: 'own', created_at: now.toISOString() }), JSON.stringify(bad)])).rejects.toThrow();
    expect(await count('okr_workspaces', `id = 'ws_bad'`)).toBe(0);
    expect(await count('okr_cycles', `workspace_id = 'ws_bad'`)).toBe(0);
  });

  it('saves a check-in and its change-log entry together, and bumps the goal’s version', async () => {
    const g = snap.goals.find((x) => x.kind === 'metric')!;
    const c = toCheckIn(g, snap.cycles[0]!, 43, { ...emptyDraft(g, null), value: g.kind === 'metric' ? planAt(g.plan, 43, 52).toFixed(3) : '0', why: 'On plan.' }, [], g.ownerId, now, 'ci_rpc_1');
    await commit(withExpectations({ checkIns: [c], changes: [{ id: 'chg_rpc_1', at: now.toISOString(), actorId: g.ownerId, goalId: g.id, entity: 'check-in', entityId: c.id, action: 'posted', summary: 'x', diffs: [] }] }, snap));
    expect(await count('okr_check_ins')).toBe(1);
    expect(await count('okr_changes')).toBe(1);
    await commit(withExpectations({ goals: [{ ...g, title: g.title + ' (renamed)' }], changes: [] }, snap));
    expect((await db.query<{ version: number }>(`select version from okr_goals where id = $1`, [g.id])).rows[0]!.version).toBe(1);
  });

  it('refuses a save based on an old version, and writes none of it', async () => {
    const g = snap.goals.find((x) => x.kind === 'metric')!;
    // snap still has version 0; the database is on 1 after the rename above.
    const stale = withExpectations({ goals: [{ ...g, title: 'Someone else’s title' }], changes: [{ id: 'chg_rpc_stale', at: now.toISOString(), actorId: g.ownerId, goalId: g.id, entity: 'goal', entityId: g.id, action: 'edited', summary: 'x', diffs: [] }] }, snap);
    await expect(commit(stale)).rejects.toThrow(/stale: goal/);
    expect(await count('okr_changes', `id = 'chg_rpc_stale'`)).toBe(0);
    expect((await db.query<{ title: string }>(`select title from okr_goals where id = $1`, [g.id])).rows[0]!.title).toMatch(/renamed/);
  });

  it('keeps a second check-in in the same week alongside the first (ad hoc)', async () => {
    const g = snap.goals.find((x) => x.kind === 'metric')!;
    const again = toCheckIn(g, snap.cycles[0]!, 43, { ...emptyDraft(g, null), value: g.kind === 'metric' ? planAt(g.plan, 43, 52).toFixed(3) : '0', why: 'On plan.' }, [], g.ownerId, now, 'ci_rpc_2');
    await commit(withExpectations({ checkIns: [again], changes: [] }, snap));
    expect(await count('okr_check_ins', `goal_id = '${g.id}' and week = 43`)).toBe(2);
  });

  it('saves a view with the rest of a save, and keeps a deleted one as deleted (0016)', async () => {
    const person = snap.people[0]!.id;
    const v = { id: 'view_rpc_1', personId: person, name: 'Off track in Product', params: 'status=off&team=t1', pinned: false, createdAt: now.toISOString(), updatedAt: now.toISOString(), deletedAt: null };
    await commit({ views: [v], changes: [] });
    await commit({ views: [{ ...v, pinned: true, deletedAt: now.toISOString() }], changes: [] });
    const rows = (await db.query<{ name: string; params: string; pinned: boolean; deleted_at: string | null }>('select name, params, pinned, deleted_at from okr_views where id = $1', ['view_rpc_1'])).rows;
    expect(rows).toEqual([expect.objectContaining({ name: 'Off track in Product', params: 'status=off&team=t1', pinned: true })]);
    expect(rows[0]!.deleted_at).not.toBeNull();
  });

  it('saves a request with its change-log entry, then its answer for every goal waiting on it (0017)', async () => {
    const [g1, g2] = snap.goals;
    const by = snap.people[0]!.id, to = snap.people[1]!.id;
    const r = { id: 'req_rpc_1', kind: 'decision' as const, goalIds: [g1!.id], askedBy: by, recipientId: to, ask: 'Approve the interim scope', status: 'open' as const, dueWeek: null, reviewId: null, week: null, checkInId: null, createdAt: now.toISOString(), updatedAt: now.toISOString(), answer: null, answeredBy: null, answeredAt: null };
    await commit({ requests: [r], changes: [{ id: 'chg_req_1', at: now.toISOString(), actorId: by, goalId: g1!.id, entity: 'request', entityId: r.id, action: 'asked', summary: 'Asked for a decision or help', diffs: [] }] });
    await commit({ requests: [{ ...r, goalIds: [g1!.id, g2!.id], status: 'answered', answer: 'Approved.', answeredBy: to, answeredAt: now.toISOString() }], changes: [{ id: 'chg_req_2', at: now.toISOString(), actorId: to, goalId: g1!.id, entity: 'request', entityId: r.id, action: 'answered', summary: 'Answered the request', diffs: [] }] });
    const rows = (await db.query<{ status: string; goal_ids: string[]; answer: string }>('select status, goal_ids, answer from okr_requests where id = $1', ['req_rpc_1'])).rows;
    expect(rows).toEqual([{ status: 'answered', goal_ids: [g1!.id, g2!.id], answer: 'Approved.' }]);
    expect(await count('okr_changes', `entity = 'request' and workspace_id = '${ws}'`)).toBe(2);
    // An answered request must carry its answer.
    await expect(commit({ requests: [{ ...r, id: 'req_rpc_2', status: 'answered' }], changes: [] })).rejects.toThrow();
  });

  it('saves every kind of ask, and an action marked done (0023)', async () => {
    const [g1] = snap.goals;
    const by = snap.people[0]!.id, to = snap.people[1]!.id;
    const base = { goalIds: [g1!.id], askedBy: by, recipientId: to, checkInId: null, createdAt: now.toISOString(), updatedAt: now.toISOString(), answer: null, answeredBy: null, answeredAt: null, reviewId: null, week: 44 };
    const action = { ...base, id: 'ask_rpc_a', kind: 'action' as const, ask: 'Write the budget case', status: 'open' as const, dueWeek: 46 };
    const question = { ...base, id: 'ask_rpc_q', kind: 'question' as const, ask: 'When does it land?', status: 'open' as const, dueWeek: null };
    const update = { ...base, id: 'ask_rpc_u', kind: 'update' as const, ask: 'Could you post an update?', status: 'withdrawn' as const, dueWeek: null };
    await commit({ requests: [action, question, update], changes: [] });
    await commit({ requests: [{ ...action, status: 'done', answer: '', answeredBy: to, answeredAt: now.toISOString() }], changes: [{ id: 'chg_ask_done', at: now.toISOString(), actorId: to, goalId: g1!.id, entity: 'request', entityId: action.id, action: 'done', summary: 'Marked the action done', diffs: [] }] });
    const rows = (await db.query<{ id: string; kind: string; status: string; due_week: number | null }>(`select id, kind, status, due_week from okr_requests where id like 'ask_rpc_%' order by id`)).rows;
    expect(rows).toEqual([{ id: 'ask_rpc_a', kind: 'action', status: 'done', due_week: 46 }, { id: 'ask_rpc_q', kind: 'question', status: 'open', due_week: null }, { id: 'ask_rpc_u', kind: 'update', status: 'withdrawn', due_week: null }]);
  });

  it('turns asks already in check-ins into open requests, addressed to the person named (0017 backfill)', async () => {
    const goalId = (await db.query<{ goal_id: string }>(`select goal_id from okr_check_ins where workspace_id = '${ws}' limit 1`)).rows[0]!.goal_id;
    const g = snap.goals.find((x) => x.id === goalId)!;
    const asker = snap.people[0]!, named = snap.people[1]!;
    await db.exec(`update okr_check_ins set ptg_needs = '${named.name.replace(/'/g, "''")}: sign off the interim plan' where goal_id = '${g.id}'`);
    const backfill = readFileSync(join(dir, '0017_requests.sql'), 'utf8').match(/insert into okr_requests[\s\S]*?on conflict \(id\) do nothing;/)![0];
    await db.exec(backfill);
    const rows = (await db.query<{ goal_ids: string[]; recipient_id: string; ask: string; status: string }>(`select goal_ids, recipient_id, ask, status from okr_requests where workspace_id = '${ws}' and id like 'req_ci%'`)).rows;
    expect(rows).toEqual([{ goal_ids: [g.id], recipient_id: named.id, ask: 'sign off the interim plan', status: 'open' }]);
    expect(asker.id).toBeTruthy();
  });

  it('renames the workspace and adds, renames and removes a team, each in one save (0020)', async () => {
    const at = now.toISOString();
    const log = (id: string) => ({ id, at, actorId: snap.people[0]!.id, goalId: null, entity: 'workspace' as const, entityId: ws, action: 'edited' as const, summary: 'x', diffs: [] });
    await commit({ workspace: { name: 'Platform Engineering' }, changes: [log('chg_ws_name')] });
    expect((await db.query<{ name: string }>('select name from okr_workspaces where id = $1', [ws])).rows[0]!.name).toBe('Platform Engineering');
    await commit({ teams: [{ id: 'team_rpc', name: 'Data', leadId: '', objective: '' }], changes: [log('chg_team_add')] });
    await commit({ teams: [{ id: 'team_rpc', name: 'Data Platform', leadId: '', objective: '' }], changes: [log('chg_team_rename')] });
    expect((await db.query<{ name: string }>('select name from okr_teams where id = $1', ['team_rpc'])).rows[0]!.name).toBe('Data Platform');
    // A team that still has goals can't go: the whole save is refused, its log entry too.
    const owned = snap.teams.find((t) => snap.goals.some((g) => g.teamId === t.id))!;
    await expect(commit({ removeTeams: [owned.id], changes: [log('chg_team_refused')] })).rejects.toThrow();
    expect(await count('okr_teams', `id = '${owned.id}'`)).toBe(1);
    expect(await count('okr_changes', `id = 'chg_team_refused'`)).toBe(0);
    // Moved first, in the same save, it goes.
    const goals = snap.goals.filter((g) => g.teamId === owned.id).map((g) => ({ ...g, teamId: 'team_rpc' }));
    const people = snap.people.filter((p) => p.teamId === owned.id).map((p) => ({ ...p, teamId: 'team_rpc' }));
    await commit({ goals, people, removeTeams: [owned.id], changes: [log('chg_team_remove')] });
    expect(await count('okr_teams', `id = '${owned.id}'`)).toBe(0);
    expect(await count('okr_goals', `team_id = 'team_rpc'`)).toBe(goals.length);
  });

  it('logs a retried save only once', async () => {
    const entry = { id: 'chg_rpc_retry', at: now.toISOString(), actorId: snap.people[0]!.id, goalId: null, entity: 'note' as const, entityId: 'n1', action: 'noted' as const, summary: 'Commented', diffs: [] };
    await commit({ changes: [entry] });
    await commit({ changes: [entry] });
    expect(await count('okr_changes', `id = 'chg_rpc_retry'`)).toBe(1);
  });

  it('refuses rows that belong to another workspace', async () => {
    const p = commitPayload(ws, { changes: [] });
    await expect(asAnon('select okr_commit($1, $2::jsonb)', [ws, JSON.stringify({ ...p, changes: [{ id: 'x', workspace_id: 'other', at: now.toISOString(), actor_id: 'a', goal_id: null, entity: 'note', entity_id: 'n', action: 'noted', summary: 's', diffs: [] }] })])).rejects.toThrow(/another workspace/);
  });

  it('won’t start the same year twice', async () => {
    const c = { ...snap.cycles[0]!, id: 'cycle_dup' };
    await expect(commit({ cycles: [c], changes: [] })).rejects.toThrow();
  });

  describe('removing, archiving and undoing (0025)', () => {
    const at = now.toISOString();
    const log = (id: string, entity: string, action: string, extra: object = {}) => ({ id, at, actorId: snap.people[0]!.id, goalId: null, entity, entityId: id, action, summary: 'x', diffs: [], ...extra }) as unknown as import('../domain/types').Change;
    const one = async <T,>(q: string, p: unknown[] = []) => (await db.query<T>(q, p)).rows[0]!;

    it('marks a person as left and deletes one outright, keeping both rows, and brings them back', async () => {
      // As they are now (an earlier test moved some to another team).
      const [a, b] = await Promise.all(snap.people.slice(0, 2).map(async (p) => personFromRow(await one<PersonRow>('select * from okr_people where id = $1', [p.id]))));
      await commit({ people: [{ ...a!, leftAt: at, leftBy: b!.id }, { ...b!, removedAt: at, removedBy: a!.id }], changes: [log('chg_left', 'person', 'left'), log('chg_del_p', 'person', 'removed')] });
      const r = await one<{ left_at: string; left_by: string }>('select left_at, left_by from okr_people where id = $1', [a!.id]);
      expect(r.left_by).toBe(b!.id);
      expect(personFromRow({ ...(await one<PersonRow>('select * from okr_people where id = $1', [a!.id])) }).leftAt).toBe(at);
      expect(await count('okr_people', `id = '${b!.id}' and removed_at is not null`)).toBe(1);
      await commit({ people: [{ ...a!, leftAt: null, leftBy: null }, { ...b!, removedAt: null, removedBy: null }], changes: [log('chg_back_a', 'person', 'restored'), log('chg_back_b', 'person', 'restored')] });
      expect(await count('okr_people', `workspace_id = '${ws}' and (left_at is not null or removed_at is not null)`)).toBe(0);
    });

    it('stops a goal with its reason and moves what fed it, in one save; a stop without a reason is refused whole', async () => {
      const parent = snap.goals.find((g) => snap.goals.some((c) => c.parentId === g.id))!;
      const kids = snap.goals.filter((c) => c.parentId === parent.id);
      const fresh = async (id: string) => goalFromRows(await one<GoalRow>('select * from okr_goals where id = $1', [id]), []);
      const p0 = await fresh(parent.id);
      await expect(commit({ goals: [{ ...p0, stoppedAt: at, stoppedBy: p0.ownerId, stopReason: '' }], changes: [log('chg_stop_bad', 'goal', 'stopped')] })).rejects.toThrow(/stop_reason/);
      expect(await count('okr_changes', `id = 'chg_stop_bad'`)).toBe(0);
      const moved = await Promise.all(kids.map(async (k) => ({ ...(await fresh(k.id)), parentId: parent.parentId })));
      await commit({ goals: [{ ...p0, stoppedAt: at, stoppedBy: p0.ownerId, stopReason: 'Merged into another goal.' }, ...moved], changes: [log('chg_stop', 'goal', 'stopped')] });
      const g = await fresh(parent.id);
      expect(g).toMatchObject({ stoppedAt: at, stopReason: 'Merged into another goal.' });
      expect(await count('okr_goals', `parent_id = '${parent.id}'`)).toBe(0);
      await commit({ goals: [{ ...g, stoppedAt: null, stoppedBy: null, stopReason: null }], changes: [log('chg_restart', 'goal', 'restored')] });
      expect((await fresh(parent.id)).stoppedAt).toBeUndefined();
    });

    it('deletes and restores a check-in and a review note, and marks a note edited', async () => {
      const c = (await one<CheckInRow>(`select * from okr_check_ins where workspace_id = '${ws}' limit 1`));
      const ci = checkInFromRow(c);
      await commit({ checkIns: [{ ...ci, removedAt: at, removedBy: ci.authorId }], changes: [log('chg_ci_del', 'check-in', 'removed')] });
      expect(checkInFromRow(await one<CheckInRow>('select * from okr_check_ins where id = $1', [ci.id])).removedAt).toBe(at);
      await commit({ checkIns: [{ ...ci, removedAt: null, removedBy: null }], changes: [log('chg_ci_back', 'check-in', 'restored')] });
      expect(await count('okr_check_ins', `id = '${ci.id}' and removed_at is null`)).toBe(1);
      const d = { id: 'dec_rpc', goalId: ci.goalId, checkInId: null, reviewId: null, week: 44, kind: 'note' as const, byId: ci.authorId, at, note: 'First words' };
      await commit({ decisions: [d], changes: [] });
      await commit({ decisions: [{ ...d, note: 'Better words', editedAt: at }], changes: [log('chg_note_edit', 'decision', 'edited')] });
      await commit({ decisions: [{ ...d, note: 'Better words', editedAt: at, removedAt: at, removedBy: ci.authorId }], changes: [log('chg_note_del', 'decision', 'removed')] });
      expect(decisionFromRow(await one<DecisionRow>('select * from okr_decisions where id = $1', ['dec_rpc']))).toMatchObject({ note: 'Better words', editedAt: at, removedAt: at });
    });

    it('ends and deletes reviews, and keeps a stopped watch so watching again reuses it', async () => {
      const r = { id: 'rev_rpc', name: 'Weekly', everyWeeks: 1, weekday: 3, scope: { goals: [snap.goals[0]!.id], trees: [], levels: [] }, people: [snap.people[0]!.id], createdBy: snap.people[0]!.id, createdAt: at };
      await commit({ reviews: [r], changes: [] });
      await commit({ reviews: [{ ...r, endedAt: at, endedBy: r.createdBy }], changes: [log('chg_rev_end', 'review', 'ended')] });
      expect(reviewFromRow(await one<ReviewRow>('select * from okr_reviews where id = $1', [r.id])).endedAt).toBe(at);
      const w = { id: 'w_rpc', personId: snap.people[0]!.id, kind: 'goal' as const, ref: snap.goals[0]!.id };
      await commit({ watches: [w], changes: [] });
      await commit({ watches: [{ ...w, removedAt: at, removedBy: w.personId }], changes: [log('chg_unwatch', 'watch', 'removed')] });
      expect(watchFromRow(await one<WatchRow>('select * from okr_watches where id = $1', [w.id])).removedAt).toBe(at);
      await commit({ watches: [{ ...w, removedAt: null, removedBy: null }], changes: [log('chg_rewatch', 'watch', 'restored')] });
      expect(await count('okr_watches', `id = 'w_rpc' and removed_at is null`)).toBe(1);
    });

    it('frees a deleted cycle’s start date, so the year can be started again', async () => {
      const c = { ...snap.cycles[0]!, id: 'cycle_rpc_next', name: 'Next', startDate: '2026-12-28' };
      await commit({ cycles: [c], changes: [] });
      await expect(commit({ cycles: [{ ...c, id: 'cycle_rpc_again' }], changes: [] })).rejects.toThrow();
      await commit({ cycles: [{ ...c, removedAt: at, removedBy: snap.people[0]!.id }], changes: [log('chg_cycle_del', 'cycle', 'removed')] });
      await commit({ cycles: [{ ...c, id: 'cycle_rpc_again' }], changes: [] });
      expect(await count('okr_cycles', `start_date = '2026-12-28'`)).toBe(2);
      // …but the deleted one can't come back over it.
      await expect(commit({ cycles: [{ ...c, removedAt: null, removedBy: null }], changes: [] })).rejects.toThrow();
    });

    it('tags every change an import made with its id, keeps what it replaced, and logs its undoing', async () => {
      const g = snap.goals[0]!;
      const undo = { goals: [{ id: g.id, before: g }], checkIns: [], people: [], requests: [] };
      await commit({ changes: [log('chg_imp_row', 'goal', 'edited', { importId: 'imp_rpc' }), log('imp_rpc', 'workspace', 'imported', { importId: 'imp_rpc', undo })] });
      const rows = (await db.query<ChangeRow>(`select * from okr_changes where import_id = 'imp_rpc' order by id`)).rows.map(changeFromRow);
      expect(rows.map((r) => r.id)).toEqual(['chg_imp_row', 'imp_rpc']);
      expect(rows[1]!.undo!.goals[0]!.before!.title).toBe(g.title);
      await commit({ changes: [log('chg_imp_undone', 'workspace', 'undone', { entityId: 'imp_rpc', importId: 'imp_rpc' })] });
      expect(await count('okr_changes', `action = 'undone' and entity_id = 'imp_rpc'`)).toBe(1);
      // The log takes the new kinds of entry and nothing else.
      await commit({ changes: [log('chg_view_del', 'view', 'removed')] });
      await expect(commit({ changes: [log('chg_bad', 'view', 'vanished')] })).rejects.toThrow();
    });
  });

  describe('people’s emails (0027)', () => {
    const one = async <T,>(q: string, p: unknown[] = []) => (await db.query<T>(q, p)).rows[0]!;
    const person = async (id: string) => personFromRow(await one<PersonRow>('select * from okr_people where id = $1', [id]));

    it('keeps the email a new workspace’s people were set up with, and reads it back', async () => {
      const p = await person(snap.people[1]!.id);
      expect(p.email).toBe(snap.people[1]!.email);
      expect(p.email).toMatch(/@example\.com$/);
    });

    it('saves an email, lower case only, and one per person in a workspace', async () => {
      const [a, b] = await Promise.all(snap.people.slice(2, 4).map((p) => person(p.id)));
      await commit({ people: [{ ...a!, email: 'chloe.wu+goals@example.com' }], changes: [] });
      expect((await person(a!.id)).email).toBe('chloe.wu+goals@example.com');
      // Not stored as typed: the app lower-cases it first, and the table refuses anything else.
      await expect(commit({ people: [{ ...a!, email: 'Chloe.Wu@Example.com' }], changes: [] })).rejects.toThrow(/okr_people_email_check/);
      await expect(commit({ people: [{ ...a!, email: 'not an email' }], changes: [] })).rejects.toThrow(/okr_people_email_check/);
      // Two people in one workspace can't share an email.
      await expect(commit({ people: [{ ...b!, email: 'chloe.wu+goals@example.com' }], changes: [] })).rejects.toThrow(/okr_people_ws_email/);
    });

    it('lets someone added before emails existed have none, and frees the email of someone deleted outright', async () => {
      const a = await person(snap.people[2]!.id);
      const without = { ...a, id: 'p_no_email', name: 'Old Timer', initials: 'OT', email: null };
      await commit({ people: [without], changes: [] });
      expect((await person('p_no_email')).email).toBeUndefined();
      const twin = { ...without, id: 'p_twin', name: 'Twin', email: a.email };
      await expect(commit({ people: [twin], changes: [] })).rejects.toThrow(/okr_people_ws_email/);
      await commit({ people: [{ ...a, removedAt: now.toISOString(), removedBy: snap.people[0]!.id }], changes: [] });
      await commit({ people: [twin], changes: [] });
      expect((await person('p_twin')).email).toBe(a.email);
      // Another workspace may have the same address for its own person.
      await db.query(`insert into okr_people (id, workspace_id, name, role, initials, is_admin, email) values ('p_other_ws', 'ws_other_0027', 'Twin', '', 'T', false, $1)`, [a.email]);
      expect(await count('okr_people', `email = '${a.email}'`)).toBe(3);
    });

    it('applies from the paste-in script on its own, as often as it’s run', async () => {
      const paste = readFileSync(join(__dirname, '../../supabase/manual/apply-0027.sql'), 'utf8');
      // The table the CI migrator keeps (scripts/migrate.mjs), which the paste-in script records itself in.
      await db.exec('create table if not exists okr_schema_migrations (name text primary key, applied_at timestamptz not null default now())');
      await db.exec(paste);
      await db.exec(paste);
      expect(await count('okr_schema_migrations', `name = '0027_person_email.sql'`)).toBe(1);
      expect(paste.length).toBeLessThan(5000);
    });
  });

  it('deletes a workspace and everything in it, as the public user', async () => {
    await asAnon('select okr_delete_workspace($1)', [ws]);
    for (const t of ['okr_goals', 'okr_people', 'okr_check_ins', 'okr_changes', 'okr_stages', 'okr_cycles', 'okr_teams']) expect(await count(t)).toBe(0);
    expect(await count('okr_workspaces', `id = '${ws}'`)).toBe(0);
  });
});
