/* A goal is never late because of when it was typed in (onboarding spec, OB2). N17: for every set-up template and for
   "Start blank", a workspace set up today has no goal off track, at risk or late before its first check-in; and after a
   first check-in at the template's own start (a number to move), every goal is on track. Built the way set-up builds it
   (domain/importer buildWorkspace from the goals sheet set-up writes; template stages counted from now). */
import { describe, expect, it } from 'vitest';
import { buildWorkspace } from '../src/domain/importer';
import { emptyDraft, toCheckIn } from '../src/domain/checkin';
import { currentWeek } from '../src/domain/plan';
import { goalStatus } from '../src/domain/status';
import { stagesFromNow, TEMPLATES, type TemplateGoal } from '../src/domain/templates';

const R = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-11-11T10:00:00Z');
const startDate = '2025-12-29';
const head = 'Goal\tTeam\tOwner email\tOwner\tType\tUnit\tStart\tTarget\tPlan\tLimit\tMust stay\tMargin\tStages\tFeeds into\tLevel\tEffect\tSource\tDefinition';
const people = 'Name\tEmail\tJob title\tTeam\tAdmin\tTeam objective\nPat Owner\tpat@example.com\t\tPlatform\tyes\t';

function goalsSheet(outcome: TemplateGoal, goals: TemplateGoal[], week: number, weeks: number) {
  const row = (g: TemplateGoal, headline: boolean) => [
    g.title, 'Platform', 'pat@example.com', 'Pat Owner', g.kind, g.kind === 'milestone' ? '' : g.unit, g.kind === 'metric' ? g.start : '', g.kind === 'metric' ? g.target : '',
    g.plan ?? 'straight', g.kind === 'range' ? g.limit ?? '' : '', g.kind === 'range' ? g.bound ?? 'at most' : '', g.kind === 'range' ? g.margin ?? '' : '', g.kind === 'milestone' ? stagesFromNow(g.stages ?? '', week, weeks) : '',
    headline ? '' : outcome.title, headline ? 'north star' : 'team', '', '', '',
  ].join('\t');
  return [head, row(outcome, true), ...goals.map((g) => row(g, false))].join('\n');
}

const cases = [
  ...TEMPLATES.map((t) => ({ id: t.id, outcome: t.outcome, goals: t.goals })),
  { id: 'blank', outcome: { title: 'Our outcome', kind: 'metric' as const, unit: '%', start: '40', target: '60' }, goals: [{ title: 'Our first goal', kind: 'metric' as const, unit: '%', start: '10', target: '30' }] },
];

describe('a goal is never late on day one (N17)', () => {
  for (const c of cases) {
    it(R('NEW-GOAL-TRUTH', `N17: ${c.id}: nothing behind before its first check-in, and on track after one at its start`), () => {
      const weeks = 53;
      const week = currentWeek({ startDate, weeks } as never, today);
      const r = buildWorkspace({ name: 'Day one', startDate, people, goals: goalsSheet(c.outcome, c.goals, week, weeks), now: today, idSuffix: 'n17', weeks });
      expect(r.issues.filter((i) => (i as { severity?: string }).severity !== 'warning' && (i as { severity?: string }).severity !== 'note')).toEqual([]);
      const s = r.snapshot;
      const cycle = s.cycles[0]!;
      for (const g of s.goals) expect([g.title, goalStatus(g, cycle, s.checkIns, today).status]).toEqual([g.title, 'none']);
      // A first check-in at the plan's start, for each number to move: on track.
      for (const g of s.goals.filter((x) => x.kind === 'metric')) {
        const c1 = toCheckIn(g, cycle, week, { ...emptyDraft(g, null), value: String(g.kind === 'metric' ? g.plan.start : '') }, s.checkIns, s.people[0]!.id, today, 'ci-' + g.id);
        expect([g.title, c1.calculated]).toEqual([g.title, 'on']);
      }
    });
  }
});
