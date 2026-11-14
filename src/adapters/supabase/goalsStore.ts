import type { SupabaseClient } from '@supabase/supabase-js';
import { faroClient } from './client';
import { upgradeAsks } from '../../domain/asks';
import { withKeys } from '../../domain/goalKey';
import type { Snapshot, Workspace } from '../../domain/types';
import {
  changeFromRow, changeToRow, checkInFromRow, commitPayload, cycleFromRow, decisionFromRow, feedbackFromRow, goalFromRows, loadModules, personFromRow,
  requestFromRow, retroFromRow, reviewFromRow, teamFromRow, teamToRow, tokenFromRow, viewFromRow, watchFromRow, workspaceFromRow, workspaceToRow,
  type ChangeRow, type CheckInRow, type CycleRow, type DecisionRow, type FeedbackRow, type GoalRow, type PersonRow, type RequestRow,
  type RetroRow, type ReviewRow, type StageRow, type TeamRow, type TokenRow, type ViewRow, type WatchRow, type WorkspaceRow } from '../../data/rows';
import { EXAMPLE, StaleError, type Commit, type Store } from '../../data/store';
import type { HistoryAsk, HistoryPage, LoadWindow, PersonPref } from '../../ports/store';
import { ANCHOR_ACTIONS, ANCHOR_ENTITIES, historySize, openCycles, wholeOnly } from '../../ports/window';
import { hasModuleRows, type DbRow, type ModuleRecords } from '../../domain/records';
import { MODULE_RECORDS } from '../../core/records';

/** A database function that isn't there: the database is missing migrations. Said apart from a request that failed. */
const missing = (error: { code?: string; message: string }) => error.code === 'PGRST202' || /Could not find the function|function .* does not exist/i.test(error.message);
const MISSING = (fn: string) => `The database has no ${fn}: apply the migrations in supabase/migrations.`;

/** A value in a PostgREST filter, quoted so commas, dots and colons in it (a time, say) read as part of it. */
const quoted = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
/** How many goal ids go in one `in` filter, so a request's address stays short. */
const IDS = 100;
const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
/** What narrows a table read: the query builder's filters, applied after the workspace's. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Narrow = (q: any) => any;

/** Requests give up after this long, so a dead connection shows an error instead of loading forever. */
export const TIMEOUT_MS = 12_000;
/** Supabase returns at most 1,000 rows per request; read in pages below that. */
const PAGE = 900;

const timedFetch: typeof fetch = (input, init) => {
  const ctl = new AbortController();
  // An AbortError, so the client's retry (meant for quick network blips) doesn't wait out three more timeouts.
  const timer = setTimeout(() => ctl.abort(new DOMException('The database did not answer in time.', 'AbortError')), TIMEOUT_MS);
  init?.signal?.addEventListener('abort', () => ctl.abort(init.signal?.reason));
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer));
};

/** Shared records in Supabase's okr_ tables (in Faro's own schema, faro, since migration 0035), one workspace at a time. Seeds the example the first time it is empty. */
export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  private readonly db: SupabaseClient;

  /** `records`: the feature modules' records it keeps (domain/records), the build's unless given (the contract test gives a test module's). */
  constructor(url: string, key: string, client?: SupabaseClient, private readonly records: readonly ModuleRecords[] = MODULE_RECORDS) {
    this.db = client ?? faroClient(url, key, { fetch: timedFetch });
  }

  private async all<T>(table: string, ws: string, narrow: Narrow = (q) => q): Promise<T[]> {
    const out: T[] = [];
    // Keyset paging (after the last id seen), so rows added while loading can't shift a page and be skipped or repeated.
    let after: string | null = null;
    for (;;) {
      let q = narrow(this.db.from(table).select('*').eq('workspace_id', ws)).order('id').limit(PAGE);
      if (after != null) q = q.gt('id', after);
      const { data, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      const rows = (data ?? []) as (T & { id: string })[];
      out.push(...rows);
      if (rows.length < PAGE) return out;
      after = rows[rows.length - 1]!.id;
    }
  }

  async workspaces(): Promise<Workspace[]> {
    const { data, error } = await this.db.from('okr_workspaces').select('*').order('created_at');
    if (error) throw new Error('Workspaces: ' + error.message);
    const list = ((data ?? []) as WorkspaceRow[]).map(workspaceFromRow);
    return list.filter((w) => w.kind !== 'example' && w.id !== EXAMPLE.id);
  }

  /*
   * The narrower load (AX5 part 2), by the rules in ports/window.ts, filtered in the queries. Check-ins are read for the
   * goals of the cycles the window keeps (ports/window openCycles: those that overlap it, and the newest two), a
   * hundred goal ids per request; whether an older cycle has any check-in is asked with one row at most. Entries are read
   * from the window's start on, or as anchors. At company scale okr_changes wants an index on (workspace_id, at), which a
   * migration can add, shipped one merge ahead (AX10); a database function could then read check-ins by cycle in one go.
   */
  private async windowCheckIns(ws: string, w: LoadWindow, cycles: CycleRow[], goals: GoalRow[]) {
    const goalsOf = (cycleIds: Set<string>) => goals.filter((g) => cycleIds.has(g.cycle_id)).map((g) => g.id);
    const open = openCycles(cycles.map((c) => ({ id: c.id, startDate: c.start_date, weeks: c.weeks, removedAt: c.removed_at ?? null })), w);
    const rows = (await Promise.all(chunks(goalsOf(open), IDS).map((ids) => this.all<CheckInRow>('okr_check_ins', ws, (q) => q.in('goal_id', ids))))).flat();
    const cycleOf = new Map(goals.map((g) => [g.id, g.cycle_id]));
    const found = new Set(rows.flatMap((r) => (cycleOf.has(r.goal_id) ? [cycleOf.get(r.goal_id)!] : [])));
    const any = async (cycleId: string) => {
      for (const ids of chunks(goalsOf(new Set([cycleId])), IDS)) {
        const { data, error } = await this.db.from('okr_check_ins').select('id').eq('workspace_id', ws).in('goal_id', ids).limit(1);
        if (error) throw new Error(`okr_check_ins: ${error.message}`);
        if ((data ?? []).length) return true;
      }
      return false;
    };
    const older = cycles.filter((c) => !open.has(c.id));
    for (const [c, has] of await Promise.all(older.map(async (c) => [c, await any(c.id)] as const))) if (has) found.add(c.id);
    return { rows, checkInCycles: [...found].sort() };
  }

  private windowChanges(ws: string, w: LoadWindow) {
    const anchors = `entity.in.(${ANCHOR_ENTITIES.join(',')}),action.in.(${ANCHOR_ACTIONS.join(',')}),undo.not.is.null`;
    return this.all<ChangeRow>('okr_changes', ws, (q) => q.or(`at.gte.${quoted(new Date(w.from).toISOString())},${anchors}`));
  }

  async load(ws: string, window?: LoadWindow): Promise<Snapshot> {
    // Cycles and goals first when there is a window: which check-ins to read depends on them.
    const shape = window ? Promise.all([this.all<CycleRow>('okr_cycles', ws), this.all<GoalRow>('okr_goals', ws)]) : null;
    const [teams, people, cycles, goals, stages, checkIns, decisions, changes, watches, reviews, retros, feedback, tokens, views, requests, modules] = await Promise.all([
      this.all<TeamRow>('okr_teams', ws), this.all<PersonRow>('okr_people', ws),
      shape ? shape.then(([c]) => c) : this.all<CycleRow>('okr_cycles', ws),
      shape ? shape.then(([, g]) => g) : this.all<GoalRow>('okr_goals', ws),
      this.all<StageRow>('okr_stages', ws),
      shape ? shape.then(([c, g]) => this.windowCheckIns(ws, window!, c, g)) : this.all<CheckInRow>('okr_check_ins', ws).then((rows) => ({ rows, checkInCycles: null })),
      this.all<DecisionRow>('okr_decisions', ws), window ? this.windowChanges(ws, window) : this.all<ChangeRow>('okr_changes', ws),
      this.all<WatchRow>('okr_watches', ws), this.all<ReviewRow>('okr_reviews', ws), this.all<RetroRow>('okr_retros', ws),
      // Feedback and tokens are read through functions (the tables can't be read with the public key). Any read that
      // fails fails the load: an empty list would look like a workspace with none.
      this.listed<FeedbackRow>('okr_feedback_list', ws), this.listed<TokenRow>('okr_token_list', ws),
      this.all<ViewRow>('okr_views', ws), this.all<RequestRow>('okr_requests', ws),
      // Each feature module's own tables, as it declares them (domain/records).
      loadModules(this.records, (table) => this.all<DbRow>(table, ws)),
    ]);
    if (!cycles.length) throw new Error('This workspace has no cycle yet.');
    // Questions, actions and asks for an update saved before one ask model (migration 0023 converts them) read as asks.
    return upgradeAsks({
      teams: teams.map(teamFromRow),
      people: people.map(personFromRow),
      cycles: cycles.map(cycleFromRow),
      goals: withKeys(goals.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((g) => goalFromRows(g, stages))),
      checkIns: checkIns.rows.map(checkInFromRow),
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
      ...(window && checkIns.checkInCycles ? { history: { from: window.from, checkInCycles: checkIns.checkInCycles } } : {}),
    });
  }

  /** Older change-log entries, newest first, keyset by (at, id) (ports/window.ts historyPage): at <= before.at and
      (at < before.at or id < before.id), ordered by at desc, id desc, one row more than asked to know if more remain. */
  async history(ws: string, ask: HistoryAsk): Promise<HistoryPage> {
    const size = historySize(ask);
    let q = this.db.from('okr_changes').select('*').eq('workspace_id', ws);
    if (ask.goalId) q = q.eq('goal_id', ask.goalId);
    const b = ask.before;
    if (b) {
      const at = new Date(b.at).toISOString();
      q = q.lte('at', at).or(`at.lt.${quoted(at)},id.lt.${quoted(b.id)}`);
    }
    const { data, error } = await q.order('at', { ascending: false }).order('id', { ascending: false }).limit(size + 1);
    if (error) throw new Error(`okr_changes: ${error.message}`);
    const rows = (data ?? []) as ChangeRow[];
    const changes = rows.slice(0, size).map(changeFromRow);
    const last = changes.at(-1);
    return { changes, next: rows.length > size && last ? { at: last.at, id: last.id } : null };
  }

  /** A workspace's rows from a database function that returns them. */
  private async listed<T>(fn: string, ws: string): Promise<T[]> {
    const { data, error } = await this.db.rpc(fn, { ws });
    if (error) throw new Error(missing(error) ? MISSING(fn) : `${fn}: ${error.message}`);
    return (data ?? []) as T[];
  }

  /** Runs a database function: one call, one transaction. */
  private async rpc<T = unknown>(fn: string, args: Record<string, unknown>, what: string): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (!error) return data as T;
    if (missing(error)) throw new Error(MISSING(fn));
    if (/stale: /.test(error.message)) throw new StaleError(error.message.replace(/^.*stale: /, ''));
    throw new Error(`${what}: ${error.message.replace(/^.*?: /, '')}`);
  }

  /** Saves in one call and one transaction (okr_commit), refused if something it was based on has changed since.
      Revoking a token is its own save, through okr_token_revoke with its change-log entry; a new token comes through
      issueToken, never a save. */
  async commit(ws: string, c: Commit) {
    if (c.tokens?.length) {
      const [t, ...more] = c.tokens;
      const change = c.changes.find((x) => x.entityId === t!.personId && x.diffs.some((d) => /token/i.test(d.field)));
      const rest = Object.entries(c).some(([k, v]) => !['tokens', 'changes', 'expect'].includes(k) && (k === 'modules' ? hasModuleRows(c.modules) : Array.isArray(v) ? v.length : v !== undefined));
      if (!t!.revokedAt || more.length || rest || c.changes.some((x) => x !== change)) throw new Error('Saving the token: revoke one token at a time, on its own; make one with issueToken.');
      await this.rpc('okr_token_revoke', { ws, token_id: t!.id, by_id: change?.actorId ?? '', change: change ? changeToRow(ws, change) : null }, 'Revoking the token');
      return;
    }
    await this.rpc('okr_commit', { ws, payload: commitPayload(ws, c, this.records) }, 'Saving');
  }

  /** A new AI assistant token: the database makes the secret, keeps only its hash, logs the change and returns it once
      (okr_token_create). */
  async issueToken(ws: string, c: Commit): Promise<string> {
    const t = c.tokens?.[0];
    if (!t || c.tokens!.length !== 1) throw new Error('Saving the token: one token at a time.');
    const change = c.changes[0];
    return this.rpc<string>('okr_token_create', { ws, token: { id: t.id, person_id: t.personId, name: t.name, created_by: t.createdBy }, change: change ? changeToRow(ws, change) : null }, 'Saving the token');
  }

  /** A new workspace and everything in it, in one transaction (okr_create_workspace). */
  async createWorkspace(w: Workspace, data: Snapshot) {
    wholeOnly(data);
    const payload = { ...commitPayload(w.id, data, this.records), teams: data.teams.map((t) => teamToRow(w.id, t)), expect: null };
    await this.rpc('okr_create_workspace', { w: workspaceToRow(w), payload }, 'Creating the workspace');
  }

  /** Removes a workspace and everything in it, in one transaction (okr_delete_workspace). */
  async deleteWorkspace(ws: string) {
    if (ws === EXAMPLE.id) throw new Error('The example can’t be deleted.');
    await this.rpc('okr_delete_workspace', { ws }, 'Deleting the workspace');
  }

  /** Every person's server-kept Prefs in a workspace (faro.person_prefs, migration 0053). */
  async personPrefs(ws: string): Promise<PersonPref[]> {
    const { data, error } = await this.db.from('person_prefs').select('person_id, key, value').eq('workspace_id', ws);
    if (error) throw new Error(`person_prefs: ${error.message}`);
    return ((data ?? []) as { person_id: string; key: string; value: unknown }[]).map((r) => ({ personId: r.person_id, key: r.key, value: r.value }));
  }

  /** Keeps one, replacing the person's value for that key. */
  async keepPersonPref(ws: string, p: PersonPref) {
    const { error } = await this.db.from('person_prefs').upsert({ workspace_id: ws, person_id: p.personId, key: p.key, value: p.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(`person_prefs: ${error.message}`);
  }
}
