import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CheckIn, Goal, Snapshot } from '../domain/types';
import {
  checkInFromRow, checkInToRow, cycleFromRow, cycleToRow, goalFromRows, goalToRows, personFromRow, personToRow, teamFromRow, teamToRow,
  type CheckInRow, type CycleRow, type GoalRow, type PersonRow, type StageRow, type TeamRow,
} from './rows';
import { seed } from './seed';
import type { Store } from './store';

/** Shared records in Supabase's okr_ tables. Seeds the demo data the first time it finds them empty. */
export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  private readonly db: SupabaseClient;

  constructor(url: string, key: string, private readonly today: () => Date = () => new Date(), client?: SupabaseClient) {
    this.db = client ?? createClient(url, key, { auth: { persistSession: false } });
  }

  private async all<T>(table: string): Promise<T[]> {
    const { data, error } = await this.db.from(table).select('*');
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as T[];
  }

  private async must(p: PromiseLike<{ error: { message: string } | null }>, what: string) {
    const { error } = await p;
    if (error) throw new Error(`${what}: ${error.message}`);
  }

  async load(): Promise<Snapshot> {
    const [teams, people, cycles, goals, stages, checkIns] = await Promise.all([
      this.all<TeamRow>('okr_teams'), this.all<PersonRow>('okr_people'), this.all<CycleRow>('okr_cycles'),
      this.all<GoalRow>('okr_goals'), this.all<StageRow>('okr_stages'), this.all<CheckInRow>('okr_check_ins'),
    ]);
    if (!cycles.length) return this.reset();
    return {
      teams: teams.map(teamFromRow),
      people: people.map(personFromRow),
      cycles: cycles.map(cycleFromRow),
      goals: goals.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((g) => goalFromRows(g, stages)),
      checkIns: checkIns.map(checkInFromRow),
    };
  }

  async saveGoal(goal: Goal) {
    const { goal: row, stages } = goalToRows(goal);
    await this.must(this.db.from('okr_goals').upsert(row), 'Saving the goal');
    if (goal.kind === 'milestone') {
      const keep = stages.map((s) => s.id);
      let del = this.db.from('okr_stages').delete().eq('goal_id', goal.id);
      if (keep.length) del = del.not('id', 'in', `(${keep.map((k) => `"${k}"`).join(',')})`);
      await this.must(del, 'Removing stages');
      if (stages.length) await this.must(this.db.from('okr_stages').upsert(stages), 'Saving stages');
    }
  }

  async saveCheckIn(c: CheckIn) {
    // One per goal and week: replace whatever was there.
    await this.must(this.db.from('okr_check_ins').upsert(checkInToRow(c), { onConflict: 'goal_id,week' }), 'Saving the check-in');
  }

  async reset(): Promise<Snapshot> {
    const s = seed(this.today());
    const wipe = (t: string) => this.must(this.db.from(t).delete().neq('id', ''), 'Clearing ' + t);
    for (const t of ['okr_check_ins', 'okr_stages', 'okr_goals', 'okr_cycles', 'okr_people', 'okr_teams']) await wipe(t);
    // Teams and people point at each other: add teams without leads, then people, then the leads.
    await this.must(this.db.from('okr_teams').insert(s.teams.map((t) => teamToRow(t, false))), 'Adding teams');
    await this.must(this.db.from('okr_people').insert(s.people.map(personToRow)), 'Adding people');
    await this.must(this.db.from('okr_teams').upsert(s.teams.map((t) => teamToRow(t))), 'Setting team leads');
    await this.must(this.db.from('okr_cycles').insert(s.cycles.map(cycleToRow)), 'Adding the cycle');
    const rows = s.goals.map(goalToRows);
    const parents = rows.filter((r) => !r.goal.parent_id), children = rows.filter((r) => r.goal.parent_id);
    await this.must(this.db.from('okr_goals').insert(parents.map((r) => r.goal)), 'Adding goals');
    await this.must(this.db.from('okr_goals').insert(children.map((r) => r.goal)), 'Adding input goals');
    await this.must(this.db.from('okr_stages').insert(rows.flatMap((r) => r.stages)), 'Adding stages');
    await this.must(this.db.from('okr_check_ins').insert(s.checkIns.map(checkInToRow)), 'Adding check-ins');
    return s;
  }
}
