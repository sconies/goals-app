// @vitest-environment node
import { aiBrief, CHECKIN_EXPORT_COLUMNS, EXPORT_FORMAT, GOAL_EXPORT_COLUMNS, toCsv, toJson, workbook } from './export';
import { currentWeek } from './plan';
import { summarise } from './summary';
import { seed } from '../data/seed';

const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const input = { ws: { id: 'ws', name: 'Platform' }, snapshot: s, cycle, week, today };

describe('exports', () => {
  it('writes a workbook whose goal and check-in sheets use the import’s column names', () => {
    const wb = workbook(input);
    expect(wb.map((t) => t.name)).toEqual(['Goals', 'Plan', 'Check-ins', 'Notes and actions', 'People', 'README']);
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
      const g = s.goals.find((x) => x.id === row[0])!;
      const sum = summarise(g, s, cycle, today, week);
      expect(row[head.indexOf('Status')]).toBe(sum.statusLabel);
      expect(row[head.indexOf('Gap')]).toBe(sum.gap);
    }
  });

  it('puts every week of a number goal’s plan on the Plan sheet, ending at the target', () => {
    const plan = workbook(input)[1]!.rows;
    const g = s.goals.find((x) => x.kind === 'metric')!;
    const row = plan.find((r) => r[0] === g.id)!;
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

  it('writes a brief that leads with what needs attention and names every goal', () => {
    const md = aiBrief(input);
    expect(md.startsWith('# Goals: Platform')).toBe(true);
    expect(md.indexOf('## Needs attention')).toBeLessThan(md.indexOf('## Every goal'));
    for (const g of s.goals) expect(md).toContain(g.title);
    expect(md).toContain('## Weekly history');
  });

  it('gives no forecast for a goal gone quiet, and says each date once (research round 1)', () => {
    const md = aiBrief(input);
    const quiet = s.goals.find((g) => g.id === 'env')!;
    expect(summarise(quiet, s, cycle, today, week).status).toBe('stale');
    // Every line about the quiet goal: none may forecast where it's heading.
    const lines = md.split('\n').filter((l) => l.includes(quiet.title));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).not.toMatch(/[Pp]rojected|on the recent trend/);
    expect(md).not.toMatch(/by week (\d+) by week \1/);
  });
});
