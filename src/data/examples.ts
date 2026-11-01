/* More example workspaces for the demo, built from short descriptions. Each one is seven weeks into a
   13-week cycle, with check-ins, reasons, a review and some watches. Dates are relative to today; all
   names and numbers are invented. */
import { emptyDraft, evaluate, toCheckIn, type Draft } from '../domain/checkin';
import { checkInChange, goalChange } from '../domain/changes';
import type { Cause, Change, CheckIn, Cycle, Goal, Level, Person, Review, Snapshot, StageUpdate, Team, Watch, Workspace } from '../domain/types';
import { seed, SEED_WEEK } from './seed';

const DAY = 86_400_000;

interface Note { cause: Cause; why: string }
interface GoalSpec {
  id: string; team: string; owner: string; title: string; source: string; definition?: string;
  level?: Level; parent?: string; guardrail?: boolean; whyHelps?: string;
  /** A number to move. */
  metric?: { unit: string; decimals?: number; start: number; target: number; shape?: 'straight' | 'back' | 'stepped' };
  /** A number to keep on one side of a limit. */
  range?: { unit: string; decimals?: number; bound: 'atMost' | 'atLeast'; limit: number; margin: number };
  /** Dated stages: name, due week, the week it was done (or null), and where it's forecast if late. */
  stages?: [string, number, number | null, number?][];
  /** Weekly values from week 1 (metrics and ranges). Fewer than seven means the owner stopped checking in. */
  values?: number[];
  /** The last week checked in, for milestones (default: last week). */
  lastWeek?: number;
  behind?: Note; ahead?: Note; path?: { what: string; in: number; needs?: string };
}
interface ExampleSpec {
  workspace: Workspace;
  cycleName: string;
  reviewDay: number;
  teams: Team[];
  people: (Omit<Person, 'initials' | 'admin'> & { admin?: boolean })[];
  goals: GoalSpec[];
  watches: Omit<Watch, 'id'>[];
  reviews: Omit<Review, 'createdAt'>[];
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]!.toUpperCase()).slice(0, 2).join('');
function mondayOf(d: Date): number {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;
}

/** Turns a description into a full workspace: goals, check-in history, change log, watches and reviews. */
export function buildExample(spec: ExampleSpec, today: Date): Snapshot {
  const start = mondayOf(today) - SEED_WEEK * 7 * DAY;
  const cycle: Cycle = { id: 'cycle', name: spec.cycleName, startDate: new Date(start).toISOString().slice(0, 10), weeks: 13, reviewDay: spec.reviewDay };
  const people: Person[] = spec.people.map((p) => ({ ...p, initials: initials(p.name), admin: !!p.admin }));
  const goals: Goal[] = spec.goals.map((g, i): Goal => {
    const base = {
      id: g.id, cycleId: cycle.id, teamId: g.team, ownerId: g.owner, title: g.title, source: g.source, definition: g.definition ?? '',
      io: (g.parent ? 'input' : 'output') as Goal['io'], level: g.level ?? 'team', guardrail: !!g.guardrail, parentId: g.parent ?? null, effect: null,
      createdAt: new Date(start - 5 * DAY + i * 1000).toISOString(), ...(g.whyHelps ? { whyHelps: g.whyHelps } : {}),
    };
    if (g.metric) return { ...base, kind: 'metric', unit: g.metric.unit, decimals: g.metric.decimals ?? 0, plan: { start: g.metric.start, target: g.metric.target, shape: g.metric.shape ?? 'straight' }, originalPlan: null, rebaselinedWeek: null };
    if (g.range) return { ...base, kind: 'range', unit: g.range.unit, decimals: g.range.decimals ?? 0, range: { bound: g.range.bound, limit: g.range.limit, margin: g.range.margin } };
    return { ...base, kind: 'milestone', stages: (g.stages ?? []).map(([name, due], k) => ({ id: `${g.id}_s${k}`, name, dueWeek: due })) };
  });
  const postedAt = (week: number) => new Date(Math.max(start + week * 7 * DAY, Math.min(start + week * 7 * DAY + 2 * DAY + 10 * 3_600_000, today.getTime() - 60_000)));

  const checkIns: CheckIn[] = [];
  for (const g of goals) {
    const s = spec.goals.find((x) => x.id === g.id)!;
    const weeks = g.kind === 'milestone' ? Array.from({ length: s.lastWeek ?? SEED_WEEK - 1 }, (_, k) => k + 1) : (s.values ?? []).map((_, k) => k + 1);
    for (const week of weeks) {
      const draft: Draft = emptyDraft(g, null);
      if (g.kind === 'milestone') {
        draft.stages = g.stages.map((st, k): StageUpdate => {
          const [, due, done, forecast] = s.stages![k]!;
          const isDone = done != null && done <= week;
          return { stageId: st.id, doneWeek: isDone ? done : null, forecastWeek: isDone ? null : forecast != null && week >= due - 1 ? forecast : null };
        });
      } else draft.value = String(s.values![week - 1]);
      const e = evaluate(g, cycle, week, draft, checkIns);
      const note = e.reason === 'ahead' ? s.ahead : e.reason === 'behind' ? s.behind : undefined;
      Object.assign(draft, note ?? (e.reason ? { cause: e.reason === 'ahead' ? 'early' : 'slower', why: e.reason === 'ahead' ? 'A change landed earlier than planned.' : 'Delivery is slower than planned this week.' } : {}));
      if (e.needsPath) Object.assign(draft, { ptgWhat: s.path?.what ?? 'Re-plan the work with the team this week.', ptgBy: Math.min(cycle.weeks, week + (s.path?.in ?? 3)), needs: s.path?.needs ?? '' });
      if (!e.reason && !draft.why) draft.why = 'On plan.';
      checkIns.push(toCheckIn(g, cycle, week, draft, checkIns, g.ownerId, postedAt(week), `ci_${g.id}_${week}`));
    }
  }

  const lookup = { person: (id: string) => people.find((x) => x.id === id), goal: (id: string) => goals.find((x) => x.id === id), teamName: (id: string) => spec.teams.find((t) => t.id === id)?.name ?? id };
  const changes: Change[] = [
    ...goals.map((g) => goalChange(null, g, lookup, g.ownerId, g.createdAt, 'chg_goal_' + g.id)!),
    ...checkIns.map((c) => checkInChange(null, c, goals.find((g) => g.id === c.goalId)!, c.authorId, 'chg_' + c.id)!),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return {
    people, teams: spec.teams, cycles: [cycle], goals, checkIns, decisions: [], changes,
    watches: spec.watches.map((w, i) => ({ ...w, id: `w_${i}` })),
    reviews: spec.reviews.map((r) => ({ ...r, createdAt: new Date(start - 4 * DAY).toISOString() })),
    retros: [],
  };
}

const ws = (id: string, name: string): Workspace => ({ id, name, kind: 'example', createdAt: '2026-01-01T00:00:00.000Z' });

const SUPPORT: ExampleSpec = {
  workspace: ws('example-support', 'Example: Customer Support'),
  cycleName: 'Support cycle', reviewDay: 1,
  teams: [
    { id: 'lead', name: 'Support leadership', leadId: 'hana', objective: 'Customers get the right answer the first time' },
    { id: 'frontline', name: 'Frontline', leadId: 'diego', objective: 'Answer fast, without making customers repeat themselves' },
    { id: 'kb', name: 'Knowledge', leadId: 'mira', objective: 'Answers people can find for themselves' },
    { id: 'tools', name: 'Support tooling', leadId: 'olu', objective: 'Bots and routing that take the routine work' },
  ],
  people: [
    { id: 'hana', name: 'Hana Okafor', role: 'VP Customer Support', teamId: 'lead', admin: true },
    { id: 'diego', name: 'Diego Alvarez', role: 'Frontline manager', teamId: 'frontline' },
    { id: 'mira', name: 'Mira Sato', role: 'Knowledge lead', teamId: 'kb' },
    { id: 'olu', name: 'Olu Adeyemi', role: 'Support tooling lead', teamId: 'tools' },
    { id: 'beth', name: 'Beth Lowe', role: 'Support analyst', teamId: 'lead' },
    { id: 'raj', name: 'Raj Mehta', role: 'Support engineer', teamId: 'frontline' },
  ],
  goals: [
    { id: 'csat', team: 'lead', owner: 'hana', title: 'Customer satisfaction (CSAT)', source: 'Zendesk satisfaction survey', level: 'north-star', definition: 'Share of rated conversations scored good or great, rolling 4 weeks',
      metric: { unit: '%', start: 78, target: 88, shape: 'back' }, values: [78, 79, 79, 80, 80, 79, 80],
      behind: { cause: 'slower', why: 'Billing questions doubled after the price change and those score lowest.' }, path: { what: 'Billing macros and a billing FAQ in the help centre.', in: 3, needs: 'Hana Okafor: agree a temporary billing escalation path with Finance' } },
    { id: 'frt', team: 'frontline', owner: 'diego', parent: 'csat', level: 'svp', title: 'First response time', source: 'Zendesk SLA report', definition: 'Median minutes to first human or bot reply, business hours',
      metric: { unit: 'min', start: 45, target: 15 }, values: [44, 40, 36, 33, 30, 27, 25],
      whyHelps: 'Customers who hear back within 15 minutes rate the whole conversation higher.' },
    { id: 'fcr', team: 'frontline', owner: 'diego', parent: 'csat', title: 'Resolved on first contact', source: 'Zendesk tags', metric: { unit: '%', start: 62, target: 75 }, values: [62, 62, 63, 63, 62, 63],
      behind: { cause: 'blocked', why: 'Two-thirds of repeat contacts are refunds that need Finance to approve.' }, path: { what: 'Refunds under £50 approved by the agent.', in: 4, needs: 'Hana Okafor: approve agent refunds under £50' } },
    { id: 'deflect', team: 'kb', owner: 'mira', parent: 'csat', title: 'Questions answered by the help centre', source: 'Help centre analytics', metric: { unit: '%', start: 18, target: 35 }, values: [18, 21, 24, 27, 29, 32, 34],
      ahead: { cause: 'early', why: 'The new search launched two weeks early and people find articles first time.' } },
    { id: 'backlog', team: 'frontline', owner: 'raj', title: 'Tickets older than 3 days', source: 'Zendesk views', guardrail: true, range: { unit: 'tickets', bound: 'atMost', limit: 40, margin: 8 }, values: [28, 31, 35, 38, 42, 44, 39] },
    { id: 'bot', team: 'tools', owner: 'olu', parent: 'frt', title: 'Order-status bot live in chat', source: 'Jira SUP-12',
      stages: [['Intents mapped', 2, 2], ['Order API access', 4, 4], ['Pilot on 10% of chats', 6, null, 8], ['All chats', 10, null]] },
  ],
  watches: [{ personId: 'hana', kind: 'level', ref: 'north-star' }, { personId: 'hana', kind: 'level', ref: 'svp' }, { personId: 'beth', kind: 'tree', ref: 'csat' }],
  reviews: [{ id: 'weekly', name: 'Support weekly', everyWeeks: 1, weekday: 1, scope: { goals: [], trees: ['csat'], levels: [] }, people: ['hana', 'diego', 'mira', 'olu', 'beth'], createdBy: 'hana' }],
};

const SALES: ExampleSpec = {
  workspace: ws('example-sales', 'Example: B2B Sales'),
  cycleName: 'Sales quarter', reviewDay: 0,
  teams: [
    { id: 'rev', name: 'Revenue leadership', leadId: 'sofia', objective: 'Hit the quarter without discounting our way there' },
    { id: 'ae', name: 'Account executives', leadId: 'marcus', objective: 'Win more of the deals we start' },
    { id: 'sdr', name: 'Sales development', leadId: 'nia', objective: 'A full, qualified pipeline every week' },
    { id: 'ops', name: 'Revenue operations', leadId: 'ken', objective: 'Clean data and a forecast people trust' },
  ],
  people: [
    { id: 'sofia', name: 'Sofia Lindqvist', role: 'Chief Revenue Officer', teamId: 'rev', admin: true },
    { id: 'marcus', name: 'Marcus Webb', role: 'Head of Sales', teamId: 'ae' },
    { id: 'nia', name: 'Nia Thompson', role: 'SDR manager', teamId: 'sdr' },
    { id: 'ken', name: 'Ken Ito', role: 'RevOps lead', teamId: 'ops' },
    { id: 'aaron', name: 'Aaron Cole', role: 'Account executive', teamId: 'ae' },
  ],
  goals: [
    { id: 'arr', team: 'rev', owner: 'sofia', title: 'New ARR booked', source: 'Salesforce closed-won', level: 'north-star', definition: 'Annual recurring revenue from deals closed-won this quarter, £k',
      metric: { unit: '£k', start: 0, target: 1200, shape: 'back' }, values: [40, 95, 150, 190, 260, 300, 340],
      behind: { cause: 'slower', why: 'Three enterprise deals slipped to procurement; pipeline is there but closing late.' }, path: { what: 'Exec sponsor calls on the three enterprise deals this week.', in: 3, needs: 'Sofia Lindqvist: join the Northwind and Acme exec calls' } },
    { id: 'win', team: 'ae', owner: 'marcus', parent: 'arr', level: 'svp', title: 'Win rate on qualified deals', source: 'Salesforce opportunities', metric: { unit: '%', start: 22, target: 30 }, values: [22, 23, 24, 25, 25, 27, 28],
      whyHelps: 'Winning more of the deals already in the pipeline is the cheapest ARR there is.' },
    { id: 'pipe', team: 'sdr', owner: 'nia', parent: 'arr', title: 'Qualified pipeline created', source: 'Salesforce opportunities', metric: { unit: '£k', start: 0, target: 3600 }, values: [250, 520, 790, 1080, 1340, 1610, 1900],
      ahead: { cause: 'early', why: 'The webinar series brought in twice the leads we planned for.' } },
    { id: 'discount', team: 'rev', owner: 'sofia', title: 'Average discount on closed deals', source: 'CPQ reports', guardrail: true, level: 'svp', range: { unit: '%', bound: 'atMost', limit: 15, margin: 2 }, values: [11, 12, 12, 13, 14, 14, 15] },
    { id: 'forecast', team: 'ops', owner: 'ken', title: 'Forecast accuracy', source: 'Clari', metric: { unit: '%', start: 70, target: 90 }, values: [70, 72, 73] },
    { id: 'cpq', team: 'ops', owner: 'ken', parent: 'win', title: 'New pricing in CPQ', source: 'Jira REV-7',
      stages: [['Pricing signed off', 2, 2], ['CPQ configured', 5, 6], ['Reps trained', 7, null, 9], ['Old price books retired', 11, null]] },
  ],
  watches: [{ personId: 'sofia', kind: 'level', ref: 'north-star' }, { personId: 'sofia', kind: 'level', ref: 'svp' }, { personId: 'aaron', kind: 'goal', ref: 'win' }],
  reviews: [{ id: 'forecast', name: 'Monday forecast call', everyWeeks: 1, weekday: 0, scope: { goals: ['discount'], trees: ['arr'], levels: [] }, people: ['sofia', 'marcus', 'nia', 'ken'], createdBy: 'sofia' }],
};

const GROWTH: ExampleSpec = {
  workspace: ws('example-growth', 'Example: Product Growth'),
  cycleName: 'Growth cycle', reviewDay: 2,
  teams: [
    { id: 'prod', name: 'Product', leadId: 'ines', objective: 'More people get to the moment the product clicks' },
    { id: 'onb', name: 'Onboarding', leadId: 'theo', objective: 'New sign-ups reach their first project in a day' },
    { id: 'mon', name: 'Monetisation', leadId: 'lara', objective: 'Free teams upgrade because they want to' },
    { id: 'data', name: 'Data', leadId: 'sven', objective: 'Numbers the whole team trusts' },
  ],
  people: [
    { id: 'ines', name: 'Inès Moreau', role: 'VP Product', teamId: 'prod', admin: true },
    { id: 'theo', name: 'Theo Grant', role: 'Onboarding PM', teamId: 'onb' },
    { id: 'lara', name: 'Lara Kim', role: 'Monetisation PM', teamId: 'mon' },
    { id: 'sven', name: 'Sven Olsen', role: 'Analytics lead', teamId: 'data' },
    { id: 'zoe', name: 'Zoe Brennan', role: 'Designer', teamId: 'onb' },
  ],
  goals: [
    { id: 'wau', team: 'prod', owner: 'ines', title: 'Weekly active teams', source: 'Amplitude', level: 'north-star', definition: 'Teams with three or more active members in the week',
      metric: { unit: 'teams', start: 4200, target: 5200, shape: 'back' }, values: [4210, 4240, 4300, 4350, 4420, 4500, 4560] },
    { id: 'activation', team: 'onb', owner: 'theo', parent: 'wau', level: 'svp', title: 'New teams reaching a first project', source: 'Amplitude funnel', metric: { unit: '%', start: 31, target: 45 }, values: [31, 31, 32, 31, 32, 32, 33],
      behind: { cause: 'aggressive', why: 'The new checklist helps, but the empty-state redesign slipped and that was most of the plan.' },
      path: { what: 'Ship the template picker in the empty state.', in: 3 }, whyHelps: 'Teams that finish a first project in week one are three times as likely to be active a month later.' },
    { id: 'upgrade', team: 'mon', owner: 'lara', parent: 'wau', title: 'Free teams upgrading within 30 days', source: 'Stripe + Amplitude', metric: { unit: '%', decimals: 1, start: 2.5, target: 4.0 }, values: [2.5, 2.7, 2.9, 3.0, 3.2, 3.4] },
    { id: 'churn', team: 'mon', owner: 'lara', title: 'Paid teams cancelling per month', source: 'Stripe', guardrail: true, level: 'svp', range: { unit: '%', decimals: 1, bound: 'atMost', limit: 3, margin: 0.4 }, values: [2.4, 2.5, 2.6, 2.7, 2.8, 2.8, 2.9] },
    { id: 'events', team: 'data', owner: 'sven', title: 'Product events with a definition', source: 'Event catalogue', metric: { unit: '%', start: 55, target: 95 }, values: [55, 60, 66, 71, 77, 82, 88],
      ahead: { cause: 'cautious', why: 'Auto-generated definitions covered the long tail; we only had to write the important ones.' } },
    { id: 'templates', team: 'onb', owner: 'zoe', parent: 'activation', title: 'Template picker in the empty state', source: 'Figma + Jira GRO-31',
      stages: [['Research done', 2, 2], ['Design approved', 4, 5], ['Built and tested', 7, null, 9], ['Rolled out to all', 9, null]] },
  ],
  watches: [{ personId: 'ines', kind: 'level', ref: 'north-star' }, { personId: 'ines', kind: 'level', ref: 'svp' }, { personId: 'zoe', kind: 'tree', ref: 'activation' }],
  reviews: [{ id: 'growth', name: 'Growth review', everyWeeks: 2, weekday: 2, scope: { goals: ['churn'], trees: ['wau'], levels: [] }, people: ['ines', 'theo', 'lara', 'sven'], createdBy: 'ines' }],
};

export const EXAMPLE_PLATFORM: Workspace = { id: 'example', name: 'Example: Developer Platform', kind: 'example', createdAt: '2026-01-01T00:00:00.000Z' };

/** Every example workspace in the demo, and how to build its data. The first is the default. */
export const EXAMPLES: { workspace: Workspace; build: (today: Date) => Snapshot }[] = [
  { workspace: EXAMPLE_PLATFORM, build: seed },
  ...[SUPPORT, SALES, GROWTH].map((s) => ({ workspace: s.workspace, build: (today: Date) => buildExample(s, today) })),
];
