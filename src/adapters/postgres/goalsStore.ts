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
import {
  changeFromRow, changeToRow, checkInFromRow, commitPayload, cycleFromRow, decisionFromRow, feedbackFromRow, goalFromRows, metricFromRow, metricLinkFromRow, personFromRow,
  requestFromRow, retroFromRow, reviewFromRow, teamFromRow, teamToRow, tokenFromRow, viewFromRow, watchFromRow, workspaceFromRow, workspaceToRow,
  type ChangeRow, type CheckInRow, type CycleRow, type DecisionRow, type FeedbackRow, type GoalMetricRow, type GoalRow, type MetricRow, type PersonRow, type RequestRow,
  type RetroRow, type ReviewRow, type StageRow, type TeamRow, type TokenRow, type ViewRow, type WatchRow, type WorkspaceRow,
} from '../../data/rows';
import { EXAMPLE, StaleError, type Commit, type Store } from '../../data/store';

/** What the adapter needs from a Postgres driver: node-postgres (Pool, Client) and PGlite both have it. */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** The tables a workspace's records are in, and the name of each in the snapshot. */
const TABLES = {
  teams: 'okr_teams', people: 'okr_people', cycles: 'okr_cycles', goals: 'okr_goals', stages: 'okr_stages', checkIns: 'okr_check_ins',
  decisions: 'okr_decisions', changes: 'okr_changes', watches: 'okr_watches', reviews: 'okr_reviews', retros: 'okr_retros', views: 'okr_views',
  requests: 'okr_requests', metrics: 'okr_metrics', metricLinks: 'okr_goal_metrics',
} as const;

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const;
  readonly hasExample = false;

  constructor(private readonly db: Sql) {}

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

  async load(ws: string): Promise<Snapshot> {
    const T = TABLES;
    const [teams, people, cycles, goals, stages, checkIns, decisions, changes, watches, reviews, retros, views, requests, metrics, metricLinks, feedback, tokens] = await Promise.all([
      this.all<TeamRow>(T.teams, ws), this.all<PersonRow>(T.people, ws), this.all<CycleRow>(T.cycles, ws), this.all<GoalRow>(T.goals, ws),
      this.all<StageRow>(T.stages, ws), this.all<CheckInRow>(T.checkIns, ws), this.all<DecisionRow>(T.decisions, ws), this.all<ChangeRow>(T.changes, ws),
      this.all<WatchRow>(T.watches, ws), this.all<ReviewRow>(T.reviews, ws), this.all<RetroRow>(T.retros, ws), this.all<ViewRow>(T.views, ws),
      this.all<RequestRow>(T.requests, ws), this.all<MetricRow>(T.metrics, ws), this.all<GoalMetricRow>(T.metricLinks, ws),
      // Feedback and tokens through the same functions the Supabase adapter reads them with (tokens without their hashes).
      this.json<FeedbackRow>('Feedback', 'select * from okr_feedback_list($1)', [ws]),
      this.json<TokenRow>('Tokens', 'select * from okr_token_list($1)', [ws]),
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
      ...(metrics.length ? { metrics: metrics.map(metricFromRow).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) } : {}),
      ...(metricLinks.length ? { metricLinks: metricLinks.map(metricLinkFromRow) } : {}),
    });
  }

  /** One transaction (okr_commit), refused if something it was based on has changed. A revoked token goes through
      okr_token_revoke with its change-log entry, as in the Supabase adapter. */
  async commit(ws: string, c: Commit) {
    for (const t of c.tokens ?? []) {
      if (!t.revokedAt) continue;
      const change = c.changes.find((x) => x.entityId === t.personId && x.diffs.some((d) => d.field === 'AI assistant token'));
      await this.run('Revoking the token', 'select okr_token_revoke($1, $2, $3, $4::jsonb)', [ws, t.id, c.changes[0]?.actorId ?? '', change ? JSON.stringify(changeToRow(ws, change)) : null]);
      c = { ...c, tokens: c.tokens!.filter((x) => x.id !== t.id), changes: change ? c.changes.filter((x) => x !== change) : c.changes };
    }
    if (Object.entries(c).every(([k, v]) => k === 'expect' || (Array.isArray(v) ? !v.length : v === undefined))) return;
    await this.run('Saving', 'select okr_commit($1, $2::jsonb)', [ws, JSON.stringify(commitPayload(ws, c))]);
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
    const payload = { ...commitPayload(w.id, data), teams: data.teams.map((t) => teamToRow(w.id, t)), expect: null };
    await this.run('Creating the workspace', 'select okr_create_workspace($1::jsonb, $2::jsonb)', [JSON.stringify(workspaceToRow(w)), JSON.stringify(payload)]);
  }

  async resetExample(): Promise<Snapshot> {
    throw new Error('Only the demo has an example to reset.');
  }

  async deleteWorkspace(ws: string) {
    if (ws === EXAMPLE.id) throw new Error('The example can’t be deleted.');
    await this.run('Deleting the workspace', 'select okr_delete_workspace($1)', [ws]);
  }
}
