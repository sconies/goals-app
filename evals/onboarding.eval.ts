/* A goal is never late because of when it was typed in (onboarding spec, OB2). N17: for goals added in set-up's form
   (each type, a number going either way, each plan shape), a workspace set up today has no goal off track, at risk or
   late before its first check-in; and after a first check-in at its own start (a number to move), every goal is on
   track. Built the way set-up builds it (domain/importer buildWorkspace from the goals sheet set-up writes; stages
   counted from now). Set-up has no example templates since ST2 (set-up spec 2.6). */
import { describe, expect, it } from 'vitest';
import { buildWorkspace } from '../src/domain/importer';
import { emptyDraft, toCheckIn } from '../src/domain/checkin';
import { currentWeek } from '../src/domain/plan';
import { goalStatus } from '../src/domain/status';
import { stagesFromNow } from '../src/domain/templates';

interface FormGoal { title: string; kind: 'metric' | 'milestone' | 'range'; unit: string; start: string; target: string; plan?: 'straight' | 'back-loaded' | 'stepped'; stages?: string; limit?: string; bound?: 'at most' | 'at least'; margin?: string }

const R = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-11-11T10:00:00Z');
const startDate = '2025-12-29';
const head = 'Goal\tTeam\tOwner email\tOwner\tType\tUnit\tStart\tTarget\tPlan\tLimit\tMust stay\tMargin\tStages\tFeeds into\tLevel\tEffect\tSource\tDefinition';
const people = 'Name\tEmail\tJob title\tTeam\tAdmin\tTeam objective\nPat Owner\tpat@example.com\t\tPlatform\tyes\t';

function goalsSheet(outcome: FormGoal, goals: FormGoal[], week: number, weeks: number) {
  const row = (g: FormGoal, headline: boolean) => [
    g.title, 'Platform', 'pat@example.com', 'Pat Owner', g.kind, g.kind === 'milestone' ? '' : g.unit, g.kind === 'metric' ? g.start : '', g.kind === 'metric' ? g.target : '',
    g.plan ?? 'straight', g.kind === 'range' ? g.limit ?? '' : '', g.kind === 'range' ? g.bound ?? 'at most' : '', g.kind === 'range' ? g.margin ?? '' : '', g.kind === 'milestone' ? stagesFromNow(g.stages ?? '', week, weeks) : '',
    headline ? '' : outcome.title, headline ? 'north star' : 'team', '', '', '',
  ].join('\t');
  return [head, row(outcome, true), ...goals.map((g) => row(g, false))].join('\n');
}

const cases = [
  {
    id: 'lower is better', outcome: { title: 'Lead time from commit to production', kind: 'metric' as const, unit: 'days', start: '5', target: '2', plan: 'back-loaded' as const },
    goals: [
      { title: 'Change failure rate', kind: 'range' as const, unit: '%', start: '', target: '', limit: '15', bound: 'at most' as const, margin: '3' },
      { title: 'Golden path for new services', kind: 'milestone' as const, unit: '', start: '', target: '', stages: 'Design@3; Pilot@7; Launch@12' },
      { title: 'Services on the paved road', kind: 'metric' as const, unit: '%', start: '20', target: '60', plan: 'stepped' as const },
    ],
  },
  {
    id: 'at least', outcome: { title: 'Weekly active users', kind: 'metric' as const, unit: 'users', start: '12000', target: '18000' },
    goals: [{ title: 'Uptime', kind: 'range' as const, unit: '%', start: '', target: '', limit: '99.5', bound: 'at least' as const, margin: '0.2' }],
  },
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
