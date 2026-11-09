// @vitest-environment node
/* The goal page hotfix (outside review, 9 Nov): plan changes confirmed, never silent; a done goal shows its result, not a
   forecast; feeder counts labelled; a repeated reason points the right way; and when a goal was last updated. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg';
import { planChanges, type ChangeInput, type Rec } from './changeset';
import { planQuestion } from './goal';
import { activityStream, feederHead, feedsLine, updatedLine } from './goalPage';
import { currentWeek } from './plan';
import { goalScorecard } from './scorecard';
import { doneCheckIn, goalStatus, projects } from './status';
import { summarise } from './summary';
import type { MetricGoal } from './types';
import { quarterResults } from './year';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
let n = 0;
const rec = (o: Record<string, string>): Rec => ({ __row: '2', ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
const down = s.goals.find((g): g is MetricGoal => g.kind === 'metric' && !g.stoppedAt && g.plan.target < g.plan.start && s.checkIns.some((c) => c.goalId === g.id))!;
const owner = s.people.find((p) => p.id === down.ownerId)!;
const input = (tables: ChangeInput['tables'], extra: Partial<ChangeInput> = {}): ChangeInput => ({ tables, snapshot: s, cycle, week, actor: owner, now: today.toISOString(), newId: (p) => `${p}_f${++n}`, via: 'table', reason: 'Checking the plausibility rule', ...extra });

describe('plan changes: confirmed, never silent', () => {
  it('asks when the target flips which way is better, naming the consequence', () => {
    const q = planQuestion(down, { ...down, plan: { ...down.plan, target: down.plan.start + 1000 } });
    expect(q?.code).toBe('direction');
    expect(q?.text).toMatch(/^This makes higher better: /);
    expect(q?.confirm).toBe('Yes, make higher better');
  });

  it('asks when a number is far outside the plan it replaces, and not for a modest change or an unchanged plan', () => {
    const width = down.plan.start - down.plan.target;
    expect(planQuestion(down, { ...down, plan: { ...down.plan, target: down.plan.target - 3 * width } })?.code).toBe('far');
    expect(planQuestion(down, { ...down, plan: { ...down.plan, target: down.plan.target - width / 4 } })).toBeNull();
    expect(planQuestion(down, down)).toBeNull();
    expect(planQuestion(null, down)).toBeNull();
  });

  it('holds the change in the import and the AI tools until it is confirmed', () => {
    const tables = { goals: [rec({ ID: down.id, Target: String(down.plan.start + 1000) })] };
    const asked = planChanges(input(tables));
    expect(asked.needsConfirm).toBe(true);
    expect(asked.commit).toBeNull();
    expect(asked.items[0]!.question?.text).toMatch(/higher better/);
    const yes = planChanges(input(tables, { confirm: true }));
    expect(yes.needsConfirm).toBe(false);
    expect(yes.commit).not.toBeNull();
  });

  it('asks about a hand-set week on the Plan sheet too', () => {
    const width = down.plan.start - down.plan.target;
    const end = down.plan.endWeek ?? cycle.weeks;
    const cs = planChanges(input({ plan: [rec({ ID: down.id, [`Week ${end}`]: String(down.plan.target - 5 * width) })] }));
    expect(cs.needsConfirm).toBe(true);
  });
});

describe('a done goal shows its result, not a forecast', () => {
  const done = s.goals.find((g) => doneCheckIn(g, s.checkIns, week) && g.kind === 'metric')!;
  const at = doneCheckIn(done, s.checkIns, week)!;
  const st = goalStatus(done, cycle, s.checkIns, today);

  it('has a Result cell, no likelihood, and no likely end on the chart', () => {
    const card = goalScorecard(done, cycle, s.checkIns, week, false);
    expect(card.cells.some((c) => c.key === 'hit')).toBe(false);
    expect(card.cells.find((c) => c.key === 'result')).toMatchObject({ label: 'Result', value: 'Done', tone: 'good' });
    expect(card.cells.find((c) => c.key === 'result')!.sub).toMatch(new RegExp(`in week ${at.week}$`));
    expect(card.marks?.end ?? null).toBeNull();
    expect(projects(done, st.status)).toBe(false);
  });

  it('makes no forecast in lists and exports', () => {
    expect(summarise(done, s, cycle, today, week)).toMatchObject({ forecast: null, projection: null });
    const stopped = s.goals.find((g) => g.stoppedAt && g.kind === 'metric');
    if (stopped) expect(summarise(stopped, s, cycle, today, week)).toMatchObject({ forecast: null, projection: null });
  });

  it('has no quarter still running after the one it was done in', () => {
    const rs = quarterResults(done, cycle, s.checkIns, week);
    for (const r of rs.filter((x) => x.quarter.from > at.week)) expect(r).toMatchObject({ kind: 'none', doneWeek: at.week });
    expect(rs.filter((x) => x.quarter.from <= at.week && at.week <= x.quarter.to).every((x) => x.kind !== 'open')).toBe(true);
  });
});

describe('feeder counts are labelled', () => {
  it('says direct feeders on the goal page and the whole tree on a card', () => {
    const parent = s.goals.find((g) => s.goals.filter((c) => c.parentId === g.id).length > 1)!;
    const line = feedsLine(s.goals.filter((c) => c.parentId === parent.id), () => 'off')!;
    expect(line.head).toMatch(/^Directly feeding it \(/);
    expect(line.text.startsWith(line.head)).toBe(true);
    expect(feederHead('tree', 16)).toBe('Everything under it (16 goals)');
    expect(feederHead('direct', 1)).toBe('Directly feeding it (one goal)');
  });
});

describe('history and the header', () => {
  it('points a repeated reason the way it is in the list', () => {
    let seen = 0;
    for (const g of s.goals) {
      const items = activityStream(g, s);
      items.forEach((x, i) => {
        if ((x.kind !== 'checkin' && x.kind !== 'checkins') || x.sameAs == null) return;
        seen++;
        const j = items.findIndex((y) => (y.kind === 'checkin' && y.checkIn.week === x.sameAs) || (y.kind === 'checkins' && y.checkIns.some((c) => c.week === x.sameAs)));
        expect(x.sameAsWhere).toBe(j > i ? 'below' : 'above');
      });
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('says when the goal was last updated, and the week', () => {
    const g = s.goals.find((x) => s.checkIns.some((c) => c.goalId === x.id))!;
    expect(updatedLine(g, s)).toMatch(/^Updated \d{1,2} [A-Z][a-z]{2} · week \d+$/);
    expect(updatedLine({ ...g, id: 'none-yet' }, s)).toBeNull();
  });
});
