// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPlatformOrg } from './platformOrg';
import { metricLinkToRow, metricToRow } from '../modules/metrics/records';

const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');

describe('database schema', () => {
  let db: PGlite;
  const s = buildPlatformOrg(new Date('2026-10-30T12:00:00Z'));
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
        `insert into okr_check_ins (id, goal_id, author_id, week, posted_at, value, stages, status, calculated, cause, why, greener_why, propose_target, ptg_what, ptg_by_week, ptg_needs, next, data_flagged, ptg_state, backfilled)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [c.id, c.goalId, c.authorId, c.week, c.postedAt, c.value, c.stages ? JSON.stringify(c.stages) : null, c.status, c.calculated, c.cause, c.why, c.greenerWhy,
          c.proposeTarget, c.pathToGreen?.what ?? null, c.pathToGreen?.byWeek ?? null, c.pathToGreen?.needs ?? '', c.next, c.dataFlagged, c.pathToGreen?.state ?? null, !!c.backfilled],
      );
    }
    const n = await db.query<{ n: number }>('select count(*)::int as n from okr_check_ins');
    expect(n.rows[0]!.n).toBe(s.checkIns.length);
    await db.query(`insert into okr_workspaces (id, name, kind) values ('example', 'Example', 'example') on conflict do nothing`);
    for (const w of s.watches) await db.query('insert into okr_watches (id, workspace_id, person_id, kind, ref) values ($1,$2,$3,$4,$5)', [w.id, 'example', w.personId, w.kind, w.ref]);
    for (const r of s.reviews) await db.query('insert into okr_reviews (id, workspace_id, name, every_weeks, weekday, scope, people, created_by, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [r.id, 'example', r.name, r.everyWeeks, r.weekday, JSON.stringify(r.scope), JSON.stringify(r.people), r.createdBy, r.createdAt]);
    // Thousands of rows, one query each: a busy machine (the suite in parallel, an eval run beside it) takes longer than 5s.
  }, 30_000);

  const reject = (q: string) => expect(db.query(q)).rejects.toThrow();
  it('keeps several check-ins in a week (ad hoc), each by its own id', async () => {
    await db.query(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated) values ('again', 'lead-flaky', 'rhea', 7, 'on', 'on')`);
    await reject(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated) values ('again', 'lead-flaky', 'rhea', 8, 'on', 'on')`);
  });
  it('allows an at-risk check-in that is still investigating, with no date', async () => {
    await db.query(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated, ptg_what, ptg_state) values ('inv', 'lead-flaky', 'rhea', 49, 'risk', 'risk', 'Looking into why intake doubled', 'investigating')`);
  });
  it('still needs a week when the owner says they have a plan', () => reject(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated, ptg_what, ptg_state) values ('pl', 'lead-flaky', 'rhea', 50, 'risk', 'risk', 'Pairing on the scope', 'plan')`));
  it('refuses an at-risk check-in without a path to green', () => reject(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated) values ('x1', 'lead-flaky', 'rhea', 51, 'risk', 'risk')`));
  it('refuses a greener call without a reason', () => reject(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated) values ('x2', 'lead-flaky', 'rhea', 51, 'on', 'off')`));
  it('allows several north-star goals in a cycle', async () => {
    const n = await db.query<{ n: number }>("select count(*)::int as n from okr_goals where level = 'north-star'");
    expect(n.rows[0]!.n).toBeGreaterThan(1);
  });
  it('refuses an unknown goal level', () => reject(`update okr_goals set level = 'vp' where id = 'lead-flaky'`));
  it('keeps one retro per goal and cycle, with a lesson', async () => {
    await db.query(`insert into okr_retros (id, workspace_id, goal_id, cycle_id, result, learned, next, by_id) values ('r1', 'example', 'ns-lead', 'cycle', 'partly', 'Agree dependency dates in week 1.', 'carry', 'rhea')`);
    await reject(`insert into okr_retros (id, workspace_id, goal_id, cycle_id, result, learned, next, by_id) values ('r2', 'example', 'ns-lead', 'cycle', 'hit', 'Again for the same goal.', 'carry', 'rhea')`);
    await reject(`insert into okr_retros (id, workspace_id, goal_id, cycle_id, result, learned, next, by_id) values ('r3', 'example', 'lead-flaky', 'cycle', 'great', 'Not a result we know.', 'carry', 'rhea')`);
  });
  it('stores watches and reviews', async () => {
    const w = await db.query<{ n: number }>('select count(*)::int as n from okr_watches');
    const r = await db.query<{ n: number }>('select count(*)::int as n from okr_reviews');
    expect([w.rows[0]!.n, r.rows[0]!.n]).toEqual([s.watches.length, s.reviews.length]);
  });
  it('refuses a metric goal without a plan', () => reject(`insert into okr_goals (id, cycle_id, team_id, owner_id, title, kind, io) values ('m2', 'cycle', 'cicd', 'rhea', 'No plan', 'metric', 'input')`));
  it('keeps a range between two bounds: between needs a lower bound below the limit, one-sided ranges none (0042)', async () => {
    const add = (id: string, bound: string, limit: number, lower: number | null) => db.query(
      `insert into faro.okr_goals (id, cycle_id, team_id, owner_id, title, kind, io, headline, unit, decimals, range_bound, range_limit, range_margin, range_lower, level)
       select $1, cycle_id, team_id, owner_id, 'Range ' || $1, 'range', io, false, '%', 2, $2, $3, 0, $4, level from faro.okr_goals where kind = 'range' limit 1`, [id, bound, limit, lower]);
    await add('rb-ok', 'between', 99.95, 99.5);
    await expect(add('rb-none', 'between', 99.95, null)).rejects.toThrow(/okr_goals_range_lower_ok/);
    await expect(add('rb-upside', 'between', 99.5, 99.95)).rejects.toThrow(/okr_goals_range_lower_ok/);
    await expect(add('rb-side', 'atMost', 99.5, 98)).rejects.toThrow(/okr_goals_range_lower_ok/);
    await expect(add('rb-what', 'around', 99.5, null)).rejects.toThrow(/okr_goals_range_bound_ok/);
    await db.exec(readFileSync(join(dir, '0042_range_between.sql'), 'utf8'));
    expect((await db.query<{ n: number }>(`select count(*)::int as n from pg_constraint where conrelid = 'faro.okr_goals'::regclass and pg_get_constraintdef(oid) like '%range_bound%' and pg_get_constraintdef(oid) not like '%range_limit%' and pg_get_constraintdef(oid) not like '%range_lower%'`)).rows[0]!.n).toBe(1);
  });
  it('keeps a link’s part, a metric’s retirement and its marks, and runs twice (0043)', async () => {
    const cols = await db.query<{ table_name: string; column_name: string }>(`select table_name, column_name from information_schema.columns
      where table_schema = 'faro' and ((table_name = 'okr_goal_metrics' and column_name = 'part') or (table_name = 'okr_metrics' and column_name in ('retired_at', 'retired_by', 'retired_why', 'replaced_by', 'marks')))`);
    expect(cols.rows.length).toBe(6);
    await db.exec(readFileSync(join(dir, '0043_metric_parts_and_retirement.sql'), 'utf8'));
    expect((await db.query<{ n: number }>(`select count(*)::int as n from pg_constraint where conname in ('okr_goal_metrics_part_len', 'okr_metrics_retired_why_len', 'okr_metrics_marks_array')`)).rows[0]!.n).toBe(3);
  });
  it('saves retired and live metrics in one batch: a live one is written with an empty reason and no marks, never null (MT3)', async () => {
    const at = '2026-10-30T12:00:00.000Z';
    const base = { name: '', meaning: '', unit: '%', decimals: 0, direction: 'lower' as const, source: '', sourceOwner: '', refresh: null, ownerId: 'rhea', caveats: '', createdBy: 'rhea', createdAt: at, updatedAt: at };
    const rows = [
      metricToRow('example', { ...base, id: 'm-retired', name: 'Retired one', retiredAt: at, retiredBy: 'rhea', retiredWhy: 'Gone', replacedBy: null, marks: [{ week: 44, at, by: 'rhea', kind: 'definition', why: 'Changed', was: 'a', now: 'b' }] }),
      metricToRow('example', { ...base, id: 'm-live', name: 'Live one' }),
    ];
    expect(rows[1]).toMatchObject({ retired_why: '', marks: [] });
    await db.query(`select okr_upsert('okr_metrics', $1::jsonb, 'id')`, [JSON.stringify(rows)]);
    const saved = await db.query<{ id: string; retired_why: string; marks: unknown[] }>(`select id, retired_why, marks from okr_metrics where id in ('m-retired', 'm-live') order by id`);
    expect(saved.rows.map((r) => [r.id, r.retired_why, (r.marks as unknown[]).length])).toEqual([['m-live', '', 0], ['m-retired', 'Gone', 1]]);
  });
  it('saves links with and without a part in one batch: a link with no part is written as empty, never null (build review of #308)', async () => {
    await db.query(`insert into okr_metrics (id, workspace_id, name, unit, direction, owner_id, created_by) values ('m-mixed', 'example', 'Mixed batch', '%', 'lower', 'rhea', 'rhea')`);
    const [a, b] = s.goals.slice(0, 2);
    const at = '2026-10-30T12:00:00.000Z';
    const rows = [
      metricLinkToRow('example', { id: a!.id, goalId: a!.id, metricId: 'm-mixed', teamId: null, part: 'EU', linkedBy: 'rhea', linkedAt: at }),
      metricLinkToRow('example', { id: b!.id, goalId: b!.id, metricId: 'm-mixed', teamId: null, linkedBy: 'rhea', linkedAt: at }),
    ];
    expect(rows[1]).toHaveProperty('part', '');
    await db.query(`select okr_upsert('okr_goal_metrics', $1::jsonb, 'id')`, [JSON.stringify(rows)]);
    const saved = await db.query<{ id: string; part: string }>(`select id, part from okr_goal_metrics where metric_id = 'm-mixed' order by part desc`);
    expect(saved.rows.map((r) => r.part)).toEqual(['EU', '']);
  });
});

describe('other causes and demo feedback (0019)', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon nologin;`);
    await db.exec(sql);
    await db.exec(`insert into okr_teams (id, name, lead_id, objective) values ('t', 'Team', 'p', '');
      insert into okr_people (id, name, role, initials, team_id, is_admin) values ('p', 'Pat', '', 'P', 't', true);
      insert into okr_cycles (id, name, start_date, weeks) values ('c', 'Q', '2026-10-26', 13);
      insert into okr_goals (id, cycle_id, team_id, owner_id, title, kind, io, unit, decimals, plan_start, plan_target, plan_shape, level) values ('g', 'c', 't', 'p', 'Deploys per week', 'metric', 'output', '%', 0, 1, 2, 'straight', 'team');`);
  }, 30_000);
  it('keeps a check-in whose cause is something else, and nothing outside the list', async () => {
    await db.query(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated, cause, why) values ('c1', 'g', 'p', 2, 'on', 'on', 'other', 'A reorg moved the team')`);
    await expect(db.query(`insert into okr_check_ins (id, goal_id, author_id, week, status, calculated, cause) values ('c2', 'g', 'p', 3, 'on', 'on', 'whatever')`)).rejects.toThrow();
  });
  it('keeps feedback from the demo with the research notes', async () => {
    await db.query(`insert into okr_research_notes (id, session_id, researcher, kind, persona, route, target, rating, text) values ('n1', 'dv_1', 'Demo visitor', 'feedback', 'Maya', '/', '', 5, 'It helps')`);
    await expect(db.query(`insert into okr_research_notes (id, session_id, researcher, kind, persona, route, target, text) values ('n2', 'dv_1', 'x', 'gossip', 'Maya', '/', '', 'x')`)).rejects.toThrow();
  });
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

describe('readable goal keys (0021)', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const before = files.filter((f) => f < '0021').map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const keys = readFileSync(join(dir, files.find((f) => f.startsWith('0021'))!), 'utf8');
  let db: PGlite;
  const goal = (id: string, cycle: string, title: string, at: string, key: string | null = null, ws = 'w') =>
    `insert into okr_goals (id, workspace_id, cycle_id, team_id, owner_id, title, kind, io, unit, decimals, plan_start, plan_target, plan_shape, level, created_at${key ? ', key' : ''})
     values ('${id}', '${ws}', '${cycle}', 't', 'p', '${title}', 'metric', 'output', '%', 0, 1, 2, 'straight', 'team', '${at}'${key ? `, '${key}'` : ''})`;
  const keyOf = async (id: string) => (await db.query<{ key: string }>(`select key from okr_goals where id = '${id}'`)).rows[0]!.key;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon nologin;`);
    await db.exec(before);
    await db.exec(`insert into okr_workspaces (id, name, kind) values ('w', 'W', 'own'), ('v', 'V', 'own');
      insert into okr_teams (id, name, lead_id, objective, workspace_id) values ('t', 'Team', 'p', '', 'w');
      insert into okr_people (id, name, role, initials, team_id, is_admin, workspace_id) values ('p', 'Pat', '', 'P', 't', true, 'w');
      insert into okr_cycles (id, name, start_date, weeks, workspace_id) values ('y1', '2025', '2024-12-30', 52, 'w'), ('y2', '2026', '2025-12-29', 53, 'w'), ('z', '2026', '2025-12-29', 53, 'v');`);
    // Last year's goals, then this year's: one carried on (same title), one new. Another workspace counts on its own.
    await db.exec([goal('a', 'y1', 'Lead time', '2025-01-01'), goal('b', 'y1', 'Stopped goal', '2025-01-02'), goal('c', 'y2', 'Lead time', '2026-01-01'), goal('d', 'y2', 'Brand new', '2026-01-02'), goal('e', 'z', 'Other place', '2026-01-01', null, 'v')].join(';\n'));
    await db.exec(keys);
    await db.exec(keys);
  }, 30_000);

  it('gives existing goals keys in the order they were made, per workspace; a carried goal keeps its key', async () => {
    expect([await keyOf('a'), await keyOf('b'), await keyOf('c'), await keyOf('d'), await keyOf('e')]).toEqual(['G-1', 'G-2', 'G-1', 'G-3', 'G-1']);
  });
  it('gives a new goal the next key, never one used before, and keeps the key a carried goal brings', async () => {
    await db.exec(goal('f', 'y2', 'Another', '2026-02-01'));
    expect(await keyOf('f')).toBe('G-4');
    // The app chose G-4 too (someone else added a goal a moment earlier): this one gets the next.
    await db.exec(goal('g', 'y2', 'At the same time', '2026-02-01', 'G-4'));
    expect(await keyOf('g')).toBe('G-5');
    // Into next year, carried with its key: kept.
    await db.query(`insert into okr_cycles (id, name, start_date, weeks, workspace_id) values ('y3', '2027', '2026-12-28', 52, 'w')`);
    await db.exec(goal('h', 'y3', 'Another', '2027-01-01', 'G-4'));
    expect(await keyOf('h')).toBe('G-4');
  });
  it('never changes a key, and refuses two goals with one key in a cycle', async () => {
    await db.exec(`update okr_goals set key = 'G-9' where id = 'd'`);
    expect(await keyOf('d')).toBe('G-3');
    await db.exec(`update okr_goals set title = 'Renamed' where id = 'd'`);
    expect(await keyOf('d')).toBe('G-3');
    await db.exec('alter table okr_goals disable trigger okr_goals_key');
    await expect(db.query(`update okr_goals set key = 'G-1' where id = 'd'`)).rejects.toThrow();
    await expect(db.query(`update okr_goals set key = 'X-1' where id = 'd'`)).rejects.toThrow();
  });
});

describe('one way to ask (0023)', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const before = files.filter((f) => f < '0023').map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
  const asks = readFileSync(join(dir, files.find((f) => f.startsWith('0023'))!), 'utf8');
  let db: PGlite;
  const one = async (q: string) => (await db.query<Record<string, unknown>>(q)).rows[0]!;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon nologin;`);
    await db.exec(before);
    await db.exec(`insert into okr_workspaces (id, name, kind) values ('w', 'W', 'own');
      insert into okr_teams (id, name, lead_id, objective, workspace_id) values ('t', 'Team', 'o', '', 'w');
      insert into okr_people (id, name, role, initials, team_id, is_admin, workspace_id) values ('o', 'Olu Owner', '', 'OO', 't', false, 'w'), ('v', 'Vera VP', '', 'VV', 't', true, 'w');
      insert into okr_cycles (id, name, start_date, weeks, workspace_id) values ('c', '2026', '2025-12-22', 53, 'w');
      insert into okr_goals (id, workspace_id, cycle_id, team_id, owner_id, title, kind, io, unit, decimals, plan_start, plan_target, plan_shape, level)
        values ('g', 'w', 'c', 't', 'o', 'Lead time', 'metric', 'output', 'h', 0, 50, 20, 'straight', 'team'), ('q', 'w', 'c', 't', 'o', 'Quiet', 'metric', 'output', '%', 0, 1, 2, 'straight', 'team');
      insert into okr_reviews (id, workspace_id, name, every_weeks, weekday, scope, people, created_by) values ('r', 'w', 'Weekly', 1, 3, '{"goals":["g"],"trees":[],"levels":[]}', '["v"]', 'v');
      insert into okr_decisions (id, workspace_id, goal_id, review_id, week, kind, by_id, at, note, assignee_id, due_week) values
        ('d1', 'w', 'g', 'r', 40, 'ask', 'v', '2026-10-01T10:00:00Z', 'When does the queue land?', null, null),
        ('d2', 'w', 'g', 'r', 40, 'ask', 'v', '2026-10-01T10:05:00Z', 'Anything blocking?', null, null),
        ('d3', 'w', 'g', 'r', 40, 'action', 'v', '2026-10-01T10:10:00Z', 'Write the budget case', null, 43),
        ('d4', 'w', 'g', 'r', 40, 'note', 'v', '2026-10-01T10:15:00Z', 'Fine for now', null, null);
      insert into okr_changes (id, workspace_id, at, actor_id, goal_id, entity, entity_id, action, summary, diffs) values
        ('c1', 'w', '2026-10-01T09:00:00Z', 'o', 'g', 'note', 'n0', 'noted', 'Commented', '[{"field":"Comment","from":"—","to":"Before the review"}]'),
        ('c2', 'w', '2026-10-01T11:00:00Z', 'o', 'g', 'note', 'n1', 'noted', 'Commented', '[{"field":"Comment","from":"—","to":"Week 49, if MergeFlow ship"}]'),
        ('c3', 'w', '2026-10-02T09:00:00Z', 'v', 'q', 'note', 'n2', 'noted', 'Asked for an update', '[{"field":"Comment","from":"—","to":"Olu, could you post an update?"}]'),
        ('c4', 'w', '2026-10-02T09:30:00Z', 'v', 'q', 'note', 'n2', 'withdrawn', 'Withdrew the request for an update', '[]'),
        ('c5', 'w', '2026-10-03T09:00:00Z', 'v', 'q', 'note', 'n3', 'noted', 'Asked for an update', '[{"field":"Comment","from":"—","to":"Olu, could you post an update? The last check-in was week 38."}]'),
        ('c6', 'w', '2026-10-05T09:00:00Z', 'v', 'g', 'note', 'n4', 'noted', 'Commented', '[{"field":"Comment","from":"—","to":"Olu, could you post an update? There is no check-in yet."}]');
      insert into okr_check_ins (id, workspace_id, goal_id, author_id, week, posted_at, status, calculated) values ('k1', 'w', 'q', 'o', 41, '2026-10-06T09:00:00Z', 'on', 'on');`);
    await db.exec(asks);
    await db.exec(asks);
  }, 30_000);

  it('turns a review’s questions into asks for the owner, answered by the first thing the owner said after them', async () => {
    expect(await one(`select kind, recipient_id, status, answer, review_id, week from okr_requests where id = 'd1'`)).toEqual({ kind: 'question', recipient_id: 'o', status: 'answered', answer: 'Week 49, if MergeFlow ship', review_id: 'r', week: 40 });
    expect(await one(`select status from okr_requests where id = 'd2'`)).toEqual({ status: 'answered' });
  });
  it('turns a review’s actions into open action asks, with who and when, and keeps notes as notes', async () => {
    expect(await one(`select kind, recipient_id, status, due_week from okr_requests where id = 'd3'`)).toEqual({ kind: 'action', recipient_id: 'o', status: 'open', due_week: 43 });
    expect((await db.query(`select id from okr_decisions order by id`)).rows).toEqual([{ id: 'd4' }]);
  });
  it('turns asks for an update into update asks: withdrawn, answered by a check-in since, or open', async () => {
    expect(await one(`select kind, status from okr_requests where id = 'n2'`)).toEqual({ kind: 'update', status: 'withdrawn' });
    expect(await one(`select status, answer, answered_by from okr_requests where id = 'n3'`)).toEqual({ status: 'answered', answer: 'Checked in for week 41', answered_by: 'o' });
    expect(await one(`select status, recipient_id from okr_requests where id = 'n4'`)).toEqual({ status: 'open', recipient_id: 'o' });
    expect(await one(`select entity, action from okr_changes where id = 'c5'`)).toEqual({ entity: 'request', action: 'asked' });
    expect(await one(`select entity from okr_changes where id = 'c2'`)).toEqual({ entity: 'note' });
  });
  it('keeps the states and kinds to the ones the app knows, and lets an action be done', async () => {
    await db.query(`update okr_requests set status = 'done', answer = '', answered_by = 'o', answered_at = now() where id = 'd3'`);
    await expect(db.query(`update okr_requests set kind = 'chore' where id = 'd3'`)).rejects.toThrow();
    await expect(db.query(`update okr_requests set status = 'closed' where id = 'd3'`)).rejects.toThrow();
  });
});
