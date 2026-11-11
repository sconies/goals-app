// @vitest-environment node
import { aiBrief, CHECKIN_EXPORT_COLUMNS, EXPORT_FORMAT, GOAL_EXPORT_COLUMNS, toCsv, toJson, workbook } from './export';
import { currentWeek, planAsOf, planAt } from './plan';
import { summarise } from './summary';
import { buildPlatformOrg } from '../data/platformOrg';
import { MODULE_SHEETS } from '../core/records';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
// With the sheets the modules in this build add (the metric library's Metrics), as the app exports it.
const input = { ws: { id: 'ws', name: 'Platform' }, snapshot: s, cycle, week, today, sheets: MODULE_SHEETS };

describe('exports', () => {
  it('writes a workbook whose goal and check-in sheets use the import’s column names', () => {
    const wb = workbook(input);
    expect(wb.map((t) => t.name)).toEqual(['Goals', 'Plan', 'Check-ins', 'People', 'Results', 'Asks', 'Notes', 'Metrics', 'README']);
    const goals = wb[0]!.rows;
    expect(goals[0]!.slice(0, GOAL_EXPORT_COLUMNS.length)).toEqual([...GOAL_EXPORT_COLUMNS]);
    expect(goals.length - 1).toBe(s.goals.length);
    expect(wb[2]!.rows[0]).toEqual([...CHECKIN_EXPORT_COLUMNS]);
    expect(wb[2]!.rows.length - 1).toBe(s.checkIns.length);
  });

  it('agrees with what the screens show for each goal', () => {
    const wb = workbook(input);
    const head = wb[0]!.rows[0]!;
    for (const row of wb[0]!.rows.slice(1)) {
      const g = s.goals.find((x) => x.id === row[head.indexOf('ID')])!;
      expect(row[head.indexOf('Key')]).toBe(g.key);
      expect(row[head.indexOf('Owner email')]).toBe(s.people.find((p) => p.id === g.ownerId)!.email);
      const sum = summarise(g, s, cycle, today, week);
      expect(row[head.indexOf('Status')]).toBe(sum.statusLabel);
      expect(row[head.indexOf('Gap')]).toBe(sum.gap);
    }
  });

  it('puts every week of a number goal’s plan on the Plan sheet, ending at the target', () => {
    const plan = workbook(input)[1]!.rows;
    const g = s.goals.find((x) => x.kind === 'metric')!;
    const row = plan.find((r) => r[plan[0]!.indexOf('ID')] === g.id)!;
    expect(row[0]).toBe(g.key);
    expect(row[plan[0]!.indexOf(`Week ${cycle.weeks}`)]).toBe(g.kind === 'metric' ? g.plan.target : null);
  });

  it('can export just the goals in a view', () => {
    const some = s.goals.slice(0, 3);
    const wb = workbook({ ...input, goals: some });
    expect(wb[0]!.rows.length).toBe(4);
    expect(toJson({ ...input, goals: some }).goals.map((g) => g.id)).toEqual(some.map((g) => g.id));
  });

  it('quotes CSV safely and stops spreadsheet formulas', () => {
    const csv = toCsv([['a', 'b,c', 'say "hi"', '=SUM(A1)', -3, null]]);
    expect(csv).toBe('a,"b,c","say ""hi""",\'=SUM(A1),-3,\r\n');
  });

  it('writes JSON with a format, the cycle and each goal’s check-ins inside it', () => {
    const j = toJson(input);
    expect(j.format).toBe(EXPORT_FORMAT);
    expect(j.cycle.currentWeek).toBe(week);
    const withCi = j.goals.find((g) => g.checkIns.length)!;
    expect(withCi.checkIns[0]).toEqual(expect.objectContaining({ week: expect.any(Number), call: expect.any(String) }));
    const metric = j.goals.find((g) => g.type === 'metric')!;
    expect(metric.plan!.byWeek.at(-1)!.value).toBe(metric.plan!.target);
    expect(JSON.parse(JSON.stringify(j))).toEqual(j);
  });

  it('puts every ask on the Asks sheet, with its kind, who must respond, its state and due week', () => {
    const sheet = workbook(input).find((t) => t.name === 'Asks')!.rows;
    const head = sheet[0]!;
    expect(head.slice(0, 3)).toEqual(['ID', 'Kind', 'Ask']);
    expect(sheet.length - 1).toBe(s.requests!.length);
    const kinds = new Set(sheet.slice(1).map((r) => r[head.indexOf('Kind')]));
    expect(kinds).toEqual(new Set(['Decision or help', 'Update', 'Question', 'Action']));
    const done = sheet.find((r) => r[head.indexOf('Status')] === 'Done')!;
    expect(done[head.indexOf('Kind')]).toBe('Action');
    // The brief lists the open questions and actions, an overdue one said so.
    expect(aiBrief(input)).toMatch(/## Open questions and actions[\s\S]*Action for Pavel Novák by week 44, overdue/);
  });

  it('writes a brief that leads with what needs attention and names every goal', () => {
    const md = aiBrief(input);
    expect(md.startsWith('# Goals: Platform')).toBe(true);
    expect(md.indexOf('## Needs attention')).toBeLessThan(md.indexOf('## Every goal'));
    for (const g of s.goals) expect(md).toContain(g.title);
    expect(md).toContain('## Weekly history');
  });

  it('gives no forecast for a goal gone quiet, and says each date once (research round 1)', () => {
    const md = aiBrief(input);
    const quiet = s.goals.find((g) => g.id === 'env-search')!;
    expect(summarise(quiet, s, cycle, today, week).status).toBe('stale');
    // Every line about the quiet goal: none may forecast where it's heading.
    const lines = md.split('\n').filter((l) => l.includes(quiet.title));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).not.toMatch(/[Pp]rojected|on the recent trend/);
    expect(md).not.toMatch(/by week (\d+) by week \1/);
  });

  it('judges every exported check-in against the plan of its own week, as the goal page does (round 3 review)', () => {
    const g = s.goals.find((x) => x.id === 'ns-ai')!;
    if (g.kind !== 'metric') throw new Error('ns-ai is a number goal');
    const at = (plan: typeof g.plan, w: number) => Number(planAt(plan, w, cycle.weeks).toFixed(g.decimals));
    // A check-in from before the plan changed, where the old and new plans differ.
    const early = s.checkIns.filter((c) => c.goalId === 'ns-ai' && at(planAsOf(g, c.week), c.week) !== at(g.plan, c.week))[0]!;
    const then = at(planAsOf(g, early.week), early.week);
    const now = at(g.plan, early.week);
    expect(then).not.toBe(now); // the plan really did change since
    // The brief's weekly history
    expect(aiBrief(input)).toContain(`w${early.week} ${early.value} [${then}]`);
    // The workbook's check-ins
    const rows = workbook(input)[2]!.rows;
    const col = rows[0]!.indexOf('Plan that week');
    const col_ = (h: string) => rows[0]!.indexOf(h);
    const row = rows.find((r) => r[col_('ID')] === early.id)!;
    expect(row[col_('Goal ID')]).toBe('ns-ai');
    expect(row[col_('Week')]).toBe(early.week);
    expect(row[col]).toBe(then);
    // The JSON
    const json = toJson(input) as { goals: { id: string; checkIns: { week: number; planThatWeek: number | null }[] }[] };
    expect(json.goals.find((x) => x.id === 'ns-ai')!.checkIns.find((c) => c.week === early.week)!.planThatWeek).toBe(then);
  });
});

describe('a stopped goal in an export (backlog 7)', () => {
  // An active number goal that makes a forecast today, then the same goal stopped and kept in the archive.
  const live = s.goals.find((g) => g.kind === 'metric' && !g.stoppedAt && summarise(g, s, cycle, today, week).forecast)!;
  const stopped = { ...live, stoppedAt: today.toISOString(), stoppedBy: live.ownerId, stopReason: 'No longer needed' };
  const own = s.checkIns.filter((c) => c.goalId === live.id);
  const snap = { ...s, goals: s.goals.filter((g) => g.id !== live.id), checkIns: s.checkIns.filter((c) => c.goalId !== live.id), archive: { goals: [stopped], checkIns: own, decisions: [], people: [], reviews: [] } };
  const x = { ...input, snapshot: snap };

  it('the live goal has a forecast to drop', () => {
    expect(summarise(live, s, cycle, today, week).forecast).toBeTruthy();
  });

  it('the workbook and CSV leave its Forecast empty', () => {
    const goals = workbook(x)[0]!.rows;
    const head = goals[0]!;
    const row = goals.find((r) => r[head.indexOf('ID')] === live.id)!;
    expect(row[head.indexOf('Status')]).toBe('Stopped');
    expect(row[head.indexOf('Forecast')] ?? null).toBeNull();
  });

  it('the JSON says no forecast and no projection', () => {
    const j = toJson(x) as unknown as { goals: { id: string; now: { forecast: unknown; projection: unknown } }[] };
    const g = j.goals.find((y) => y.id === live.id)!;
    expect(g.now.forecast).toBeNull();
    expect(g.now.projection).toBeNull();
  });
});
