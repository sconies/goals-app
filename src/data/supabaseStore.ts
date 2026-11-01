import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Snapshot, Workspace } from '../domain/types';
import {
  changeFromRow, changeToRow, checkInFromRow, checkInToRow, cycleFromRow, cycleToRow, decisionFromRow, decisionToRow, goalFromRows, goalToRows,
  personFromRow, personToRow, teamFromRow, teamToRow, workspaceFromRow, workspaceToRow,
  type ChangeRow, type CheckInRow, type CycleRow, type DecisionRow, type GoalRow, type PersonRow, type StageRow, type TeamRow, type WorkspaceRow, type WatchRow, type ReviewRow, watchFromRow, reviewFromRow, watchToRow, reviewToRow, type RetroRow, retroFromRow, retroToRow, type FeedbackRow, feedbackFromRow, feedbackToRow } from './rows';
import { EXAMPLE, type Commit, type Store } from './store';

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

/** Shared records in Supabase's okr_ tables, one workspace at a time. Seeds the example the first time it is empty. */
export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  /** The real app's data. The example lives in the demo, in each visitor's browser. */
  readonly hasExample = false;
  private readonly db: SupabaseClient;

  constructor(url: string, key: string, client?: SupabaseClient) {
    this.db = client ?? createClient(url, key, { auth: { persistSession: false }, global: { fetch: timedFetch } });
  }

  private async all<T>(table: string, ws: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db.from(table).select('*').eq('workspace_id', ws).order('id').range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) return out;
    }
  }

  private async must(p: PromiseLike<{ error: { message: string } | null }>, what: string) {
    const { error } = await p;
    if (error) throw new Error(`${what}: ${error.message}`);
  }

  async workspaces(): Promise<Workspace[]> {
    const { data, error } = await this.db.from('okr_workspaces').select('*').order('created_at');
    if (error) throw new Error('Workspaces: ' + error.message);
    const list = ((data ?? []) as WorkspaceRow[]).map(workspaceFromRow);
    return list.filter((w) => w.kind !== 'example' && w.id !== EXAMPLE.id);
  }

  async load(ws: string): Promise<Snapshot> {
    const [teams, people, cycles, goals, stages, checkIns, decisions, changes, watches, reviews, retros, feedback] = await Promise.all([
      this.all<TeamRow>('okr_teams', ws), this.all<PersonRow>('okr_people', ws), this.all<CycleRow>('okr_cycles', ws),
      this.all<GoalRow>('okr_goals', ws), this.all<StageRow>('okr_stages', ws), this.all<CheckInRow>('okr_check_ins', ws),
      this.all<DecisionRow>('okr_decisions', ws), this.all<ChangeRow>('okr_changes', ws),
      this.all<WatchRow>('okr_watches', ws), this.all<ReviewRow>('okr_reviews', ws), this.all<RetroRow>('okr_retros', ws), this.all<FeedbackRow>('okr_feedback', ws),
    ]);
    if (!cycles.length) throw new Error('This workspace has no cycle yet.');
    return {
      teams: teams.map(teamFromRow),
      people: people.map(personFromRow),
      cycles: cycles.map(cycleFromRow),
      goals: goals.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((g) => goalFromRows(g, stages)),
      checkIns: checkIns.map(checkInFromRow),
      decisions: decisions.map(decisionFromRow),
      changes: changes.map(changeFromRow).sort((a, b) => a.at.localeCompare(b.at)),
      watches: watches.map(watchFromRow),
      reviews: reviews.map(reviewFromRow).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      retros: retros.map(retroFromRow),
      feedback: feedback.map(feedbackFromRow),
    };
  }

  async commit(ws: string, c: Commit) {
    if (c.cycles?.length) await this.must(this.db.from('okr_cycles').upsert(c.cycles.map((x) => cycleToRow(ws, x))), 'Saving the cycle');
    if (c.people?.length) await this.must(this.db.from('okr_people').upsert(c.people.map((p) => personToRow(ws, p))), 'Saving people');
    for (const g of c.goals ?? []) {
      const { goal, stages } = goalToRows(ws, g);
      await this.must(this.db.from('okr_goals').upsert(goal), 'Saving the goal');
      if (g.kind === 'milestone') {
        const keep = stages.map((s) => s.id);
        let del = this.db.from('okr_stages').delete().eq('goal_id', g.id);
        if (keep.length) del = del.not('id', 'in', `(${keep.map((k) => `"${k}"`).join(',')})`);
        await this.must(del, 'Removing stages');
        if (stages.length) await this.must(this.db.from('okr_stages').upsert(stages), 'Saving stages');
      }
    }
    // One check-in per goal and week: replace whatever was there.
    if (c.checkIns?.length) await this.must(this.db.from('okr_check_ins').upsert(c.checkIns.map((x) => checkInToRow(ws, x)), { onConflict: 'goal_id,week' }), 'Saving the check-in');
    if (c.reviews?.length) await this.must(this.db.from('okr_reviews').upsert(c.reviews.map((x) => reviewToRow(ws, x))), 'Saving the review');
    if (c.feedback?.length) await this.must(this.db.from('okr_feedback').insert(c.feedback.map((x) => feedbackToRow(ws, x))), 'Sending feedback');
    if (c.retros?.length) await this.must(this.db.from('okr_retros').upsert(c.retros.map((x) => retroToRow(ws, x))), 'Saving the retro');
    if (c.decisions?.length) await this.must(this.db.from('okr_decisions').upsert(c.decisions.map((x) => decisionToRow(ws, x))), 'Saving the decision');
    if (c.watches?.length) await this.must(this.db.from('okr_watches').upsert(c.watches.map((x) => watchToRow(ws, x))), 'Watching');
    for (const id of c.unwatch ?? []) await this.must(this.db.from('okr_watches').delete().eq('id', id), 'Stopping watching');
    if (c.changes.length) await this.must(this.db.from('okr_changes').insert(c.changes.map((x) => changeToRow(ws, x))), 'Logging the change');
  }

  private async insertAll(ws: string, s: Snapshot) {
    const chunk = async <T>(table: string, rows: T[], what: string) => {
      for (let i = 0; i < rows.length; i += 500) await this.must(this.db.from(table).insert(rows.slice(i, i + 500) as object[]), what);
    };
    // Teams and people point at each other: add teams without leads, then people, then the leads.
    await chunk('okr_teams', s.teams.map((t) => teamToRow(ws, t, false)), 'Adding teams');
    await chunk('okr_people', s.people.map((p) => personToRow(ws, p)), 'Adding people');
    await this.must(this.db.from('okr_teams').upsert(s.teams.map((t) => teamToRow(ws, t))), 'Setting team leads');
    await chunk('okr_cycles', s.cycles.map((c) => cycleToRow(ws, c)), 'Adding the cycle');
    const rows = s.goals.map((g) => goalToRows(ws, g));
    await chunk('okr_goals', rows.filter((r) => !r.goal.parent_id).map((r) => r.goal), 'Adding goals');
    await chunk('okr_goals', rows.filter((r) => r.goal.parent_id).map((r) => r.goal), 'Adding input goals');
    await chunk('okr_stages', rows.flatMap((r) => r.stages), 'Adding stages');
    await chunk('okr_check_ins', s.checkIns.map((c) => checkInToRow(ws, c)), 'Adding check-ins');
    await chunk('okr_reviews', s.reviews.map((r) => reviewToRow(ws, r)), 'Adding reviews');
    await chunk('okr_decisions', s.decisions.map((d) => decisionToRow(ws, d)), 'Adding decisions');
    await chunk('okr_watches', s.watches.map((w) => watchToRow(ws, w)), 'Adding watches');
    await chunk('okr_retros', (s.retros ?? []).map((r) => retroToRow(ws, r)), 'Adding retros');
    await chunk('okr_changes', s.changes.map((c) => changeToRow(ws, c)), 'Adding the change log');
  }

  async createWorkspace(w: Workspace, data: Snapshot) {
    await this.must(this.db.from('okr_workspaces').insert(workspaceToRow(w)), 'Creating the workspace');
    await this.insertAll(w.id, data);
  }

  async resetExample(): Promise<Snapshot> {
    throw new Error('Only the demo has an example to reset.');
  }

  /** Removes a workspace and everything in it. The tables don't cascade from the workspace, so children go first. */
  async deleteWorkspace(ws: string) {
    if (ws === EXAMPLE.id) throw new Error('The example can’t be deleted.');
    // People and teams point at each other; clear those links before deleting either.
    await this.must(this.db.from('okr_teams').update({ lead_id: null }).eq('workspace_id', ws), 'Unlinking teams');
    await this.must(this.db.from('okr_goals').update({ parent_id: null }).eq('workspace_id', ws), 'Unlinking goals');
    for (const t of ['okr_feedback', 'okr_retros', 'okr_watches', 'okr_decisions', 'okr_check_ins', 'okr_stages', 'okr_changes', 'okr_reviews', 'okr_goals', 'okr_cycles', 'okr_people', 'okr_teams']) {
      await this.must(this.db.from(t).delete().eq('workspace_id', ws), 'Deleting the workspace');
    }
    await this.must(this.db.from('okr_workspaces').delete().eq('id', ws), 'Deleting the workspace');
  }

}
