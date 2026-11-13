/* The goals store on plain Postgres (backlog 8c): the second database adapter, proof that the Store interface is the
   only thing the app needs from a database. It runs the same migrations (supabase/migrations, after bootstrap.sql's
   stand-ins for what Supabase provides) and calls the same database functions as the Supabase adapter, okr_commit and
   the rest, so the save rules stay in one place. It talks SQL through anything with a `query` method: node-postgres's
   Pool or Client on a server, or PGlite in the tests. It passes the same contract test as the Supabase adapter
   (src/ports/contracts/store.ts).

   Rows come back as JSON (json_agg), so they have exactly the shape Supabase's REST interface gives (timestamps as
   text), and src/data/rows.ts converts them for both. */
import { upgradeAsks } from '../../domain/asks';
import { withKeys } from '../../domain/goalKey';
import type { Snapshot, Workspace } from '../../domain/types';
import { hasModuleRows, type DbRow, type ModuleRecords } from '../../domain/records';
import {
  changeFromRow, changeToRow, checkInFromRow, commitPayload, cycleFromRow, decisionFromRow, feedbackFromRow, goalFromRows, loadModules, personFromRow,
  requestFromRow, retroFromRow, reviewFromRow, teamFromRow, teamToRow, tokenFromRow, viewFromRow, watchFromRow, workspaceFromRow, workspaceToRow,
  type ChangeRow, type CheckInRow, type CycleRow, type DecisionRow, type FeedbackRow, type GoalRow, type PersonRow, type RequestRow,
  type RetroRow, type ReviewRow, type StageRow, type TeamRow, type TokenRow, type ViewRow, type WatchRow, type WorkspaceRow,
} from '../../data/rows';
import { EXAMPLE, StaleError, type Commit, type Store } from '../../data/store';
import type { HistoryAsk, HistoryPage, LoadWindow } from '../../ports/store';
import { ANCHOR_ACTIONS, ANCHOR_ENTITIES, historySize } from '../../ports/window';
import { MODULE_RECORDS } from '../../core/records';

/** What the adapter needs from a Postgres driver: node-postgres (Pool, Client) and PGlite both have it. */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** The core's tables, and the name of each in the snapshot. They are closed: a feature module brings its own tables and
    declares them (domain/records), and the adapter reads and writes those as each module says. */
const TABLES = {
  teams: 'okr_teams', people: 'okr_people', cycles: 'okr_cycles', goals: 'okr_goals', stages: 'okr_stages', checkIns: 'okr_check_ins',
  decisions: 'okr_decisions', changes: 'okr_changes', watches: 'okr_watches', reviews: 'okr_reviews', retros: 'okr_retros', views: 'okr_views',
  requests: 'okr_requests',
} as const;

/** A constant list as SQL: the anchor kinds (ports/window.ts), which are plain words. */
const words = (xs: readonly string[]) => xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(', ');

/* The narrower load's queries (AX5 part 2). The rules are ports/window.ts's, put into SQL: a cycle overlaps the window
   when its last day (domain/cycle cycleDates) is on or after the window's first day (UTC); an entry is kept from the
   window's start on, or as an anchor (ANCHOR_ENTITIES, ANCHOR_ACTIONS, or carrying an import's undo). Ids compare in
   the "C" collation, as JavaScript compares them. At company scale okr_changes wants an index on (workspace_id, at),
   which a migration can add, shipped one merge ahead (AX10). */
const OPEN_CYCLES = `select c.id from okr_cycles c where c.workspace_id = $1 and c.start_date + ((c.weeks + 1) * 7 - 1) >= ($2::timestamptz at time zone 'UTC')::date`;
const WINDOW_CHECK_INS = `select ci.* from okr_check_ins ci join okr_goals g on g.id = ci.goal_id
  where ci.workspace_id = $1 and g.cycle_id in (${OPEN_CYCLES}) order by ci.id`;
const CHECK_IN_CYCLES = `select distinct g.cycle_id as id from okr_check_ins ci join okr_goals g on g.id = ci.goal_id where ci.workspace_id = $1 order by 1`;
const WINDOW_CHANGES = `select * from okr_changes where workspace_id = $1
  and (at >= $2::timestamptz or entity in (${words(ANCHOR_ENTITIES)}) or action in (${words(ANCHOR_ACTIONS)}) or undo is not null) order by id`;
const HISTORY = `select * from okr_changes where workspace_id = $1
  and ($2::timestamptz is null or (at, id collate "C") < ($2::timestamptz, $3::text collate "C"))
  and ($4::text is null or goal_id = $4) order by at desc, id collate "C" desc limit $5`;

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const;

  /** `records`: the feature modules' records it keeps (domain/records), the build's unless given (the contract test gives a test module's). */
  constructor(private readonly db: Sql, private readonly records: readonly ModuleRecords[] = MODULE_RECORDS) {}

  /** Runs a statement, turning the database's "stale: …" refusal into StaleError and anything else into a plain message. */
  private async run<T>(what: string, text: string, params: unknown[]): Promise<T[]> {
    try { return (await this.db.query<T>(text, params)).rows; } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/stale: /.test(msg)) throw new StaleError(msg.replace(/^.*stale: /, ''));
      throw new Error(`${what}: ${msg}`);
    }
  }

  /** Rows as JSON, so they read exactly as Supabase's would. */
  private async json<T>(what: string, from: string, params: unknown[]): Promise<T[]> {
    const [r] = await this.run<{ rows: T[] | string }>(what, `select coalesce(json_agg(t), '[]'::json) as rows from (${from}) t`, params);
    const rows = r?.rows ?? [];
    return typeof rows === 'string' ? JSON.parse(rows) as T[] : rows;
  }

  private all<T>(table: string, ws: string) { return this.json<T>(table, `select * from ${table} where workspace_id = $1 order by id`, [ws]); }

  async workspaces(): Promise<Workspace[]> {
    const rows = await this.json<WorkspaceRow>('Workspaces', 'select * from okr_workspaces order by created_at', []);
    return rows.map(workspaceFromRow).filter((w) => w.kind !== 'example' && w.id !== EXAMPLE.id);
  }

  async load(ws: string, window?: LoadWindow): Promise<Snapshot> {
    const T = TABLES;
    const from = window ? new Date(window.from).toISOString() : null;
    const [teams, people, cycles, goals, stages, checkIns, decisions, changes, watches, reviews, retros, views, requests, modules, feedback, tokens, withCheckIns] = await Promise.all([
      this.all<TeamRow>(T.teams, ws), this.all<PersonRow>(T.people, ws), this.all<CycleRow>(T.cycles, ws), this.all<GoalRow>(T.goals, ws),
      this.all<StageRow>(T.stages, ws),
      // With a window, check-ins and change-log entries are trimmed in the query (ports/window.ts's rules, above).
      from ? this.json<CheckInRow>(T.checkIns, WINDOW_CHECK_INS, [ws, from]) : this.all<CheckInRow>(T.checkIns, ws),
      this.all<DecisionRow>(T.decisions, ws),
      from ? this.json<ChangeRow>(T.changes, WINDOW_CHANGES, [ws, from]) : this.all<ChangeRow>(T.changes, ws),
      this.all<WatchRow>(T.watches, ws), this.all<ReviewRow>(T.reviews, ws), this.all<RetroRow>(T.retros, ws), this.all<ViewRow>(T.views, ws),
      this.all<RequestRow>(T.requests, ws),
      // Each feature module's own tables, as it declares them.
      loadModules(this.records, (table) => this.all<DbRow>(table, ws)),
      // Feedback and tokens through the same functions the Supabase adapter reads them with (tokens without their hashes).
      this.json<FeedbackRow>('Feedback', 'select * from okr_feedback_list($1)', [ws]),
      this.json<TokenRow>('Tokens', 'select * from okr_token_list($1)', [ws]),
      from ? this.json<{ id: string }>('Check-in cycles', CHECK_IN_CYCLES, [ws]) : null,
    ]);
    if (!cycles.length) throw new Error('This workspace has no cycle yet.');
    return upgradeAsks({
      teams: teams.map(teamFromRow),
      people: people.map(personFromRow),
      cycles: cycles.map(cycleFromRow),
      goals: withKeys(goals.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((g) => goalFromRows(g, stages))),
      checkIns: checkIns.map(checkInFromRow),
      decisions: decisions.map(decisionFromRow),
      changes: changes.map(changeFromRow).sort((a, b) => a.at.localeCompare(b.at)),
      watches: watches.map(watchFromRow),
      reviews: reviews.map(reviewFromRow).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      retros: retros.map(retroFromRow),
      feedback: feedback.map(feedbackFromRow),
      tokens: tokens.map(tokenFromRow),
      views: views.map(viewFromRow),
      requests: requests.map(requestFromRow),
      ...(modules ? { modules } : {}),
      ...(from && withCheckIns ? { history: { from: window!.from, checkInCycles: withCheckIns.map((r) => r.id).sort() } } : {}),
    });
  }

  /** Older change-log entries, newest first, keyset by (at, id) (ports/window.ts historyPage, in SQL). */
  async history(ws: string, ask: HistoryAsk): Promise<HistoryPage> {
    const size = historySize(ask);
    const b = ask.before ?? null;
    const rows = await this.json<ChangeRow>('History', HISTORY, [ws, b ? new Date(b.at).toISOString() : null, b?.id ?? null, ask.goalId ?? null, size + 1]);
    const changes = rows.slice(0, size).map(changeFromRow);
    const last = changes.at(-1);
    return { changes, next: rows.length > size && last ? { at: last.at, id: last.id } : null };
  }

  /** One transaction (okr_commit), refused if something it was based on has changed. Revoking a token is its own save,
      through okr_token_revoke with its change-log entry; a new token comes through issueToken, never a save. The same
      rule as the Supabase adapter's: a save that carries a token with anything else is refused, not split. */
  async commit(ws: string, c: Commit) {
    if (c.tokens?.length) {
      const [t, ...more] = c.tokens;
      const change = c.changes.find((x) => x.entityId === t!.personId && x.diffs.some((d) => /token/i.test(d.field)));
      const rest = Object.entries(c).some(([k, v]) => !['tokens', 'changes', 'expect'].includes(k) && (Array.isArray(v) ? v.length : v !== undefined));
      if (!t!.revokedAt || more.length || rest || c.changes.some((x) => x !== change)) throw new Error('Saving the token: revoke one token at a time, on its own; make one with issueToken.');
      await this.run('Revoking the token', 'select okr_token_revoke($1, $2, $3, $4::jsonb)', [ws, t!.id, change?.actorId ?? '', change ? JSON.stringify(changeToRow(ws, change)) : null]);
      return;
    }
    if (Object.entries(c).every(([k, v]) => k === 'expect' || (k === 'modules' ? !hasModuleRows(c.modules) : Array.isArray(v) ? !v.length : v === undefined))) return;
    await this.run('Saving', 'select okr_commit($1, $2::jsonb)', [ws, JSON.stringify(commitPayload(ws, c, this.records))]);
  }

  /** The database makes the secret, keeps only its hash and returns it this once (okr_token_create). */
  async issueToken(ws: string, c: Commit): Promise<string> {
    const t = c.tokens?.[0];
    if (!t || c.tokens!.length !== 1) throw new Error('Saving the token: one token at a time.');
    const change = c.changes[0];
    const [r] = await this.run<{ secret: string }>('Saving the token', 'select okr_token_create($1, $2::jsonb, $3::jsonb) as secret', [
      ws, JSON.stringify({ id: t.id, person_id: t.personId, name: t.name, created_by: t.createdBy }), change ? JSON.stringify(changeToRow(ws, change)) : null,
    ]);
    return r!.secret;
  }

  async createWorkspace(w: Workspace, data: Snapshot) {
    const payload = { ...commitPayload(w.id, data, this.records), teams: data.teams.map((t) => teamToRow(w.id, t)), expect: null };
    await this.run('Creating the workspace', 'select okr_create_workspace($1::jsonb, $2::jsonb)', [JSON.stringify(workspaceToRow(w)), JSON.stringify(payload)]);
  }

  async deleteWorkspace(ws: string) {
    if (ws === EXAMPLE.id) throw new Error('The example can’t be deleted.');
    await this.run('Deleting the workspace', 'select okr_delete_workspace($1)', [ws]);
  }
}
