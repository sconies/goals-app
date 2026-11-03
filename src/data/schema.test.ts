// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seed } from './seed';

const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');

describe('database schema', () => {
  let db: PGlite;
  const s = seed(new Date('2026-10-30T12:00:00Z'));
  beforeAll(async () => {
    db = new PGlite();
    // Supabase's API role, so the demo-access policies apply as they will in production.
    await db.exec(`create role anon nologin;`);
    await db.exec(sql);
  }, 30_000);

  it('loads the whole demo data set', async () => {
    await db.transaction(async (tx) => {
      for (const t of s.teams) await tx.query('insert into okr_teams (id, name, lead_id, objective) values ($1,$2,$3,$4)', [t.id, t.name, t.leadId, t.objective]);
      for (const p of s.people) await tx.query('insert into okr_people (id, name, role, initials, team_id, is_admin) values ($1,$2,$3,$4,$5,$6)', [p.id, p.name, p.role, p.initials, p.teamId, p.admin]);
    });
    for (const c of s.cycles) await db.query('insert into okr_cycles (id, name, start_date, weeks) values ($1,$2,$3,$4)', [c.id, c.name, c.startDate, c.weeks]);
    const ordered = [...s.goals].sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId));
    for (const g of ordered) {
      await db.query(
        `insert into okr_goals (id, cycle_id, team_id, owner_id, parent_id, title, kind, io, headline, guardrail, effect, source, definition, unit, decimals,
          plan_start, plan_target, plan_shape, original_plan, rebaselined_week, range_bound, range_limit, range_margin, level)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
        [g.id, g.cycleId, g.teamId, g.ownerId, g.parentId, g.title, g.kind, g.io, false, g.guardrail, g.effect, g.source, g.definition,
          g.kind === 'milestone' ? null : g.unit, g.kind === 'milestone' ? null : g.decimals,
          g.kind === 'metric' ? g.plan.start : null, g.kind === 'metric' ? g.plan.target : null, g.kind === 'metric' ? g.plan.shape : null,
          g.kind === 'metric' && g.originalPlan ? JSON.stringify(g.originalPlan) : null, g.kind === 'metric' ? g.rebaselinedWeek : null,
          g.kind === 'range' ? g.range.bound : null, g.kind === 'range' ? g.range.limit : null, g.kind === 'range' ? g.range.margin : null, g.level],
      );
      if (g.kind === 'milestone') for (const st of g.stages) await db.query('insert into okr_stages (id, goal_id, name, due_week) values ($1,$2,$3,$4)', [st.id, g.id, st.name, st.dueWeek]);
    }
    for (const c of s.checkIns) {
      await db.query(
        `insert into okr_check_ins (id, goal_id, author_id, week, posted_at, value, stages, status, calculated, cause, why, greener_why, propose_target, ptg_what, ptg_by_week, ptg_needs, next, data_flagged)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [c.id, c.goalId, c.authorId, c.week, c.postedAt, c.value, c.stages ? JSON.stringify(c.stages) : null, c.status, c.calculated, c.cause, c.why, c.greenerWhy,
          c.proposeTarget, c.pathToGreen?.what ?? null, c.pathToGreen?.byWeek ?? null, c.pathToGreen?.needs ?? '', c.next, c.dataFlagged],
      );
    }
    const n = await db.query<{ n: number }>('select count(*)::int as n from okr_check_ins');
    expect(n.rows[0]!.n).toBe(s.checkIns.length);
    await db.query(`insert into okr_workspaces (id, name, kind) values ('example', 'Example', 'example') on conflict do nothing`);
    for (const w of s.watches) await db.query('insert into okr_watches (id, workspace_id, person_id, kind, ref) values ($1,$2,$3,$4,$5)', [w.id, 'example', w.personId, w.kind, w.ref]);
    for (const r of s.reviews) await db.query('insert into okr_reviews (id, workspace_id, name, every_weeks, weekday, scope, people, created_by, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [r.id, 'example', r.name, r.everyWeeks, r.weekday, JSON.stringify(r.scope), JSON.stringify(r.people), r.createdBy, r.createdAt]);
  });

  const reject = (q: string) => expect(db.query(q)).rejects.toThrow();
  it('keeps several check-ins in a week (ad hoc), each by its own id', async () => {
    await db.query(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated) values ('again', 'triage', 'maya', 7, 'on', 'on')`);
    await reject(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated) values ('again', 'triage', 'maya', 8, 'on', 'on')`);
  });
  it('allows an at-risk check-in that is still investigating, with no date', async () => {
    await db.query(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated, ptg_what, ptg_state) values ('inv', 'triage', 'maya', 49, 'risk', 'risk', 'Looking into why intake doubled', 'investigating')`);
  });
  it('still needs a week when the owner says they have a plan', () => reject(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated, ptg_what, ptg_state) values ('pl', 'triage', 'maya', 50, 'risk', 'risk', 'Pairing on the scope', 'plan')`));
  it('refuses an at-risk check-in without a path to green', () => reject(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated) values ('x1', 'triage', 'maya', 51, 'risk', 'risk')`));
  it('refuses a greener call without a reason', () => reject(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated) values ('x2', 'triage', 'maya', 51, 'on', 'off')`));
  it('allows several north-star goals in a cycle', async () => {
    const n = await db.query<{ n: number }>("select count(*)::int as n from okr_goals where level = 'north-star'");
    expect(n.rows[0]!.n).toBeGreaterThan(1);
  });
  it('refuses an unknown goal level', () => reject(`update okr_goals set level = 'vp' where id = 'triage'`));
  it('keeps one retro per goal and cycle, with a lesson', async () => {
    await db.query(`insert into okr_retros (id, workspace_id, goal_id, cycle_id, result, learned, next, by_id) values ('r1', 'example', 'head', 'cycle', 'partly', 'Agree dependency dates in week 1.', 'carry', 'maya')`);
    await reject(`insert into okr_retros (id, workspace_id, goal_id, cycle_id, result, learned, next, by_id) values ('r2', 'example', 'head', 'cycle', 'hit', 'Again for the same goal.', 'carry', 'maya')`);
    await reject(`insert into okr_retros (id, workspace_id, goal_id, cycle_id, result, learned, next, by_id) values ('r3', 'example', 'triage', 'cycle', 'great', 'Not a result we know.', 'carry', 'maya')`);
  });
  it('stores watches and reviews', async () => {
    const w = await db.query<{ n: number }>('select count(*)::int as n from okr_watches');
    const r = await db.query<{ n: number }>('select count(*)::int as n from okr_reviews');
    expect([w.rows[0]!.n, r.rows[0]!.n]).toEqual([s.watches.length, s.reviews.length]);
  });
  it('refuses a metric goal without a plan', () => reject(`insert into okr_goals (id, cycle_id, team_id, owner_id, title, kind, io) values ('m2', 'cycle', 'pm', 'maya', 'No plan', 'metric', 'input')`));
});

describe('moving goal years to calendar weeks (0018)', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const before = files.filter((f) => f < '0018').map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const move = readFileSync(join(dir, files.find((f) => f.startsWith('0018'))!), 'utf8');
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon nologin;`);
    await db.exec(before);
    await db.exec(`
      insert into okr_teams (id, name, lead_id, objective) values ('t', 'Team', 'p', '');
      insert into okr_people (id, name, role, initials, team_id, is_admin) values ('p', 'Pat', '', 'P', 't', true);
      -- A January year under the old rule (week 0 held 1 January 2026), a shorter cycle, and a May year whose
      -- 1st is a Friday, so both rules already agree.
      insert into okr_cycles (id, name, start_date, weeks) values ('y', '2026', '2025-12-29', 52), ('short', 'Q4', '2026-10-26', 13), ('may', 'May 2026–Apr 2027', '2026-04-27', 52);
      insert into okr_goals (id, cycle_id, team_id, owner_id, title, kind, io, unit, decimals, plan_start, plan_target, plan_shape, plan_from_week, plan_end_week, plan_points, original_plan, rebaselined_week, plan_history, level)
        values ('m', 'y', 't', 'p', 'Lead time', 'metric', 'output', 'days', 0, 10, 5, 'straight', 44, 52, '[{"week": 48, "value": 7}]',
          '{"start": 10, "target": 6, "shape": "straight", "fromWeek": 40, "endWeek": 52}', 45,
          '[{"untilWeek": 45, "plan": {"start": 10, "target": 6, "shape": "straight", "points": [{"week": 50, "value": 6}]}}]', 'team'),
        ('s', 'short', 't', 'p', 'Short', 'metric', 'output', '%', 0, 1, 2, 'straight', 3, null, null, null, null, null, 'team'),
        ('f', 'may', 't', 'p', 'May', 'metric', 'output', '%', 0, 1, 2, 'straight', 3, null, null, null, null, null, 'team');
      insert into okr_goals (id, cycle_id, team_id, owner_id, title, kind, io, level) values ('ms', 'y', 't', 'p', 'Launch', 'milestone', 'output', 'team');
      insert into okr_stages (id, goal_id, name, due_week) values ('st', 'ms', 'Ship', 52);
      insert into okr_check_ins (id, goal_id, author_id, week, status, calculated, ptg_what, ptg_by_week) values ('c1', 'm', 'p', 44, 'off', 'off', 'Fix the pipeline', 47), ('c2', 's', 'p', 4, 'on', 'on', null, null), ('c3', 'f', 'p', 4, 'on', 'on', null, null);
      insert into okr_check_ins (id, goal_id, author_id, week, status, calculated, ptg_what, ptg_by_week, stages) values ('c4', 'ms', 'p', 44, 'risk', 'risk', 'Ship it a week late', 52, '[{"stageId": "st", "doneWeek": null, "forecastWeek": 52}]');
      insert into okr_decisions (id, goal_id, week, kind, by_id, note, due_week) values ('d', 'm', 44, 'action', 'p', 'Do it', 50);
    `);
    await db.exec(move);
    await db.exec(move);
  }, 30_000);
  const one = async (q: string) => (await db.query<Record<string, unknown>>(q)).rows[0]!;

  it('starts a January year the week before ISO week 1, and gives 2026 its 53 weeks', async () => {
    expect(await one(`select start_date::text d, weeks from okr_cycles where id = 'y'`)).toEqual({ d: '2025-12-22', weeks: 53 });
    expect(await one(`select start_date::text d, weeks from okr_cycles where id = 'short'`)).toEqual({ d: '2026-10-26', weeks: 13 });
    expect(await one(`select start_date::text d, weeks from okr_cycles where id = 'may'`)).toEqual({ d: '2026-04-27', weeks: 52 });
  });
  it('moves every stored week up by one, once, so each keeps its date', async () => {
    expect(await one(`select plan_from_week, plan_end_week, rebaselined_week, plan_points, original_plan, plan_history from okr_goals where id = 'm'`)).toEqual({
      plan_from_week: 45, plan_end_week: 53, rebaselined_week: 46, plan_points: [{ week: 49, value: 7 }],
      original_plan: { start: 10, target: 6, shape: 'straight', fromWeek: 41, endWeek: 53 },
      plan_history: [{ untilWeek: 46, plan: { start: 10, target: 6, shape: 'straight', points: [{ week: 51, value: 6 }] } }],
    });
    expect(await one(`select week, ptg_by_week from okr_check_ins where id = 'c1'`)).toEqual({ week: 45, ptg_by_week: 48 });
    expect(await one(`select week, stages from okr_check_ins where id = 'c4'`)).toEqual({ week: 45, stages: [{ stageId: 'st', doneWeek: null, forecastWeek: 53 }] });
    expect(await one(`select due_week from okr_stages where id = 'st'`)).toEqual({ due_week: 53 });
    expect(await one(`select week, due_week from okr_decisions where id = 'd'`)).toEqual({ week: 45, due_week: 51 });
  });
  it('leaves shorter cycles and years that already matched alone', async () => {
    expect(await one(`select week from okr_check_ins where id = 'c2'`)).toEqual({ week: 4 });
    expect(await one(`select week from okr_check_ins where id = 'c3'`)).toEqual({ week: 4 });
    expect(await one(`select plan_from_week from okr_goals where id = 's'`)).toEqual({ plan_from_week: 3 });
  });
});
