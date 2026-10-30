// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seed } from './seed';

const sql = readFileSync(join(__dirname, '../../supabase/migrations/0001_goals_and_check_ins.sql'), 'utf8');

describe('database schema', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(sql);
  }, 30_000);

  it('loads the whole demo data set', async () => {
    const s = seed(new Date('2026-10-30T12:00:00Z'));
    await db.transaction(async (tx) => {
      for (const t of s.teams) await tx.query('insert into teams (id, name, lead_id, objective) values ($1,$2,$3,$4)', [t.id, t.name, t.leadId, t.objective]);
      for (const p of s.people) await tx.query('insert into people (id, name, role, initials, team_id) values ($1,$2,$3,$4,$5)', [p.id, p.name, p.role, p.initials, p.teamId]);
    });
    for (const c of s.cycles) await db.query('insert into cycles (id, name, start_date, weeks) values ($1,$2,$3,$4)', [c.id, c.name, c.startDate, c.weeks]);
    const ordered = [...s.goals].sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId));
    for (const g of ordered) {
      await db.query(
        `insert into goals (id, cycle_id, team_id, owner_id, parent_id, title, kind, io, headline, guardrail, effect, source, definition, unit, decimals,
          plan_start, plan_target, plan_shape, original_plan, rebaselined_week, range_bound, range_limit, range_margin)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [g.id, g.cycleId, g.teamId, g.ownerId, g.parentId, g.title, g.kind, g.io, g.headline, g.guardrail, g.effect, g.source, g.definition,
          g.kind === 'milestone' ? null : g.unit, g.kind === 'milestone' ? null : g.decimals,
          g.kind === 'metric' ? g.plan.start : null, g.kind === 'metric' ? g.plan.target : null, g.kind === 'metric' ? g.plan.shape : null,
          g.kind === 'metric' && g.originalPlan ? JSON.stringify(g.originalPlan) : null, g.kind === 'metric' ? g.rebaselinedWeek : null,
          g.kind === 'range' ? g.range.bound : null, g.kind === 'range' ? g.range.limit : null, g.kind === 'range' ? g.range.margin : null],
      );
      if (g.kind === 'milestone') for (const st of g.stages) await db.query('insert into stages (id, goal_id, name, due_week) values ($1,$2,$3,$4)', [st.id, g.id, st.name, st.dueWeek]);
    }
    for (const c of s.checkIns) {
      await db.query(
        `insert into check_ins (id, goal_id, author_id, week, posted_at, value, stages, status, calculated, cause, why, greener_why, propose_target, ptg_what, ptg_by_week, ptg_needs, next, data_flagged)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [c.id, c.goalId, c.authorId, c.week, c.postedAt, c.value, c.stages ? JSON.stringify(c.stages) : null, c.status, c.calculated, c.cause, c.why, c.greenerWhy,
          c.proposeTarget, c.pathToGreen?.what ?? null, c.pathToGreen?.byWeek ?? null, c.pathToGreen?.needs ?? '', c.next, c.dataFlagged],
      );
    }
    const n = await db.query<{ n: number }>('select count(*)::int as n from check_ins');
    expect(n.rows[0]!.n).toBe(s.checkIns.length);
  });

  const reject = (q: string) => expect(db.query(q)).rejects.toThrow();
  it('allows one check-in per goal per week', () => reject(`insert into check_ins (id, goal_id, author_id, week, status, calculated) values ('dup', 'triage', 'maya', 7, 'on', 'on')`));
  it('refuses an at-risk check-in without a path to green', () => reject(`insert into check_ins (id, goal_id, author_id, week, status, calculated) values ('x1', 'triage', 'maya', 8, 'risk', 'risk')`));
  it('refuses a greener call without a reason', () => reject(`insert into check_ins (id, goal_id, author_id, week, status, calculated) values ('x2', 'triage', 'maya', 8, 'on', 'off')`));
  it('refuses a second headline goal in a cycle', () => reject(`insert into goals (id, cycle_id, team_id, owner_id, title, kind, io, headline, plan_start, plan_target, plan_shape) values ('h2', 'cycle', 'pm', 'maya', 'Another headline', 'metric', 'output', true, 1, 2, 'straight')`));
  it('refuses a metric goal without a plan', () => reject(`insert into goals (id, cycle_id, team_id, owner_id, title, kind, io) values ('m2', 'cycle', 'pm', 'maya', 'No plan', 'metric', 'input')`));
});
