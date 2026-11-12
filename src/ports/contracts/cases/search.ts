/* The search contract's cases (the Search port, src/ports/search.ts), as data: the find rules' worked examples
   (spec/core/rules/finding.md) over a small workspace of their own, written here, so the contract doesn't lean on the
   demo or on workspace.json's shape (planning, 12 Nov). `npm run spec` writes them to
   spec/conformance/contracts/search.json; src/ports/contracts/search.ts runs them on Faro's adapter. */
import type { CheckIn, Cycle, Goal, Person, Status, Team } from '../../../domain/types';
import type { Contract, Then } from './format';

/** The workspace a search contract case starts from: workspace.json's records, with each person's job title (`role`)
    and when they left (`leftAt`), which a person's row and a picker read. */
export interface SearchSeed {
  about: string;
  /** The moment the search is made at: statuses are as they stand then. */
  builtFor: string;
  cycle: Cycle;
  people: (Pick<Person, 'id' | 'name' | 'role' | 'teamId' | 'admin'> & { leftAt?: string | null })[];
  teams: Team[];
  goals: Goal[];
  checkIns: CheckIn[];
}

const cycle: Cycle = { id: 'cycle', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 };

const person = (id: string, name: string, role: string, teamId: string | null, admin = false, leftAt?: string) => ({ id, name, role, teamId, admin, ...(leftAt ? { leftAt } : {}) });

/** A range goal (the plainest kind: its status is its owner's last call). */
const goal = (id: string, key: string, title: string, ownerId: string, teamId: string, definition: string): Goal => ({
  id, key, cycleId: 'cycle', teamId, ownerId, title, io: 'output', level: 'team', guardrail: false, parentId: null, effect: null,
  source: 'The team’s own dashboard', definition, createdAt: '2025-12-20T09:00:00.000Z',
  kind: 'range', unit: '%', decimals: 0, range: { bound: 'atLeast', limit: 90, margin: 5 },
});

/** A check-in: the owner's call in that week, posted on the Wednesday before the review. */
const checkIn = (goalId: string, authorId: string, week: number, postedAt: string, value: number, status: Status, why: string): CheckIn => ({
  id: `ci_${goalId}_${week}`, goalId, authorId, week, postedAt, value, stages: null, status, calculated: status, cause: null, why,
  greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false,
});

export const SEARCH_SEED: SearchSeed = {
  about: 'A small workspace for the search contract: three teams, eight people (Oskar Lindgren marked as left, Sam Okafor in no team) and six goals, one in each status a search ranks. Made at Thursday 5 November 2026, noon UTC: week 45 of the 2026 cycle, its review day.',
  builtFor: '2026-11-05T12:00:00.000Z',
  cycle,
  people: [
    person('ana', 'Ana Souza', 'Engineering Manager, Build & Release', 'build', true),
    person('tunde', 'Tunde Bakare', 'Staff Engineer', 'build'),
    person('mei', 'Mei Chen', 'Software Engineer', 'build'),
    person('oskar', 'Oskar Lindgren', 'Software Engineer', 'build', false, '2026-11-01T09:00:00.000Z'),
    person('kofi', 'Kofi Mensah', 'Engineering Manager, Observability', 'obs'),
    person('priya', 'Priya Nair', 'Site Reliability Engineer', 'obs'),
    person('lucia', 'Lucía Ortega', 'Security Lead', 'sec'),
    person('sam', 'Sam Okafor', 'Product Manager', null),
  ],
  teams: [
    { id: 'build', name: 'Build & Release', leadId: 'ana', objective: 'Ship safely, many times a day' },
    { id: 'obs', name: 'Observability', leadId: 'kofi', objective: 'Know before the customer does' },
    { id: 'sec', name: 'Security', leadId: 'lucia', objective: 'Close the gaps that matter first' },
  ],
  goals: [
    goal('rollback', 'G-1', 'One-click rollback for every service', 'tunde', 'build', 'Share of services that roll back in one click'),
    goal('deploy-time', 'G-2', 'Deploys finish within ten minutes', 'ana', 'build', 'Share of deploys that finish within ten minutes'),
    goal('alert-noise', 'G-3', 'Alerts that need a person', 'priya', 'obs', 'Share of alerts that someone acted on'),
    goal('tracing', 'G-4', 'Tracing across every service', 'kofi', 'obs', 'Share of services that send traces'),
    goal('patching', 'G-5', 'Critical patches within a week', 'lucia', 'sec', 'Share of critical patches applied within seven days'),
    goal('contract-tests', 'G-40', 'Contract tests before each rollback', 'tunde', 'build', 'Share of rollbacks covered by a contract test'),
  ],
  checkIns: [
    checkIn('rollback', 'tunde', 45, '2026-11-04T10:00:00.000Z', 93, 'on', 'Two services left, both booked for next week.'),
    checkIn('deploy-time', 'ana', 44, '2026-10-28T10:00:00.000Z', 86, 'risk', 'The image cache misses on cold runners.'),
    checkIn('alert-noise', 'priya', 45, '2026-11-04T11:00:00.000Z', 61, 'off', 'Half the pages still come from disk alerts.'),
    checkIn('tracing', 'kofi', 38, '2026-09-16T10:00:00.000Z', 92, 'on', 'Every service sends traces.'),
    checkIn('contract-tests', 'tunde', 45, '2026-11-04T12:00:00.000Z', 40, 'off', 'Waiting on the test harness.'),
  ],
};

/** Worst first: off, then at risk and stale (tied), then on track, then the rest. */
export const WORST_FIRST = { off: 3, risk: 2, stale: 2, on: 1, done: 0, planned: 0, none: 0 };

const ids = (equals: string[]): Then => ({ select: 'rows[].id', equals });
const find = (kind: string, q: string, more: object = {}) => ({ op: 'search', args: [kind, { q, size: 200, ...more }] });

export const SEARCH_CONTRACT: Contract = {
  port: 'search',
  about: 'The Search port: one search per kind of thing (goal, person, team, and any a module registers), answered a page at a time; what a list bar, a picker and Find ask. `given` is a workspace (`SearchSeed`: workspace.json’s records, with each person’s job title `role` and `leftAt`), searched as it stands at its `builtFor`. A row is `{ kind, id, name, detail, status?, key? }`; an answer `{ total, rows, next, near? }`.',
  ops: {
    given: 'Start a fresh search over this workspace. Answers null.',
    kinds: 'The kinds it answers, core first.',
    search: '(kind, { q, filters?, sort?, after?, size? }) One page of the things of this kind that match, in the kind’s order: `{ total, rows, next, near? }`. Refuses a kind nobody registered.',
    suggest: '(kind, viewerId, recents) Up to 6 rows offered before anything is typed: you first, then your team, then those chosen lately (`recents`: `[{ kind, id }]`).',
    byIds: '(kind, ids) The rows for things already chosen, in the words a search gives and the order asked, someone marked as left included; an id it can’t find is left out.',
  },
  given: SEARCH_SEED,
  cases: [
    {
      name: 'answers the core kinds, and refuses a kind nobody registered',
      steps: [
        { when: { op: 'kinds' }, then: { includes: ['goal', 'person', 'team'] } },
        { when: find('nonsense', ''), then: { throws: true } },
      ],
    },
    {
      name: 'finds a goal by its key, however it is typed, and a key finds only its own goal',
      steps: [
        ...['G-40', 'g40', 'g-40', '40'].map((q) => ({ when: find('goal', q), then: ids(['contract-tests']) })),
        { when: find('goal', 'G-4'), then: ids(['tracing']) },
      ],
    },
    {
      name: 'matches the words on the row: each word typed starts one of its words, ignoring case and accents',
      steps: [
        { when: find('goal', 'tunde'), then: ids(['contract-tests', 'rollback']) },
        { when: find('goal', 'one click roll'), then: ids(['rollback']) },
        { when: find('goal', 'llback'), then: ids([]) },
        { when: find('goal', 'off track'), then: { select: 'total', equals: 2 } },
        { when: find('person', 'tunde'), then: ids(['tunde']) },
        { when: find('person', 'LUCIA'), then: ids(['lucia']) },
        { when: find('team', 'kofi'), then: ids(['obs']) },
      ],
    },
    {
      name: 'lists rows in two lines: a goal with its status and key, a person with their job and team, a team with its lead',
      steps: [
        { when: find('goal', 'G-1'), then: { select: 'rows[0]', has: { kind: 'goal', id: 'rollback', name: 'One-click rollback for every service', detail: 'G-1 · Tunde Bakare · Build & Release', status: 'on', key: 'G-1' } } },
        { when: find('person', 'ana'), then: { select: 'rows[0]', has: { kind: 'person', id: 'ana', name: 'Ana Souza', detail: 'Engineering Manager, Build & Release · Build & Release' } } },
        { when: find('team', 'Build'), then: { select: 'rows[0]', has: { kind: 'team', id: 'build', name: 'Build & Release', detail: 'Led by Ana Souza · 3 people' } } },
      ],
    },
    {
      name: 'takes a Goals link’s filters and sort, and orders goals worst first when unsorted',
      steps: [
        { when: find('goal', '', { filters: { status: 'off' } }), then: { select: 'total', equals: 2 } },
        { when: find('goal', ''), then: { all: [{ select: 'rows[].status', ordered: { rank: WORST_FIRST } }, { select: 'total', equals: 6 }] } },
        { when: find('goal', 'tunde', { sort: 'title' }), then: { select: 'rows[].name', ordered: 'text', length: 2 } },
      ],
    },
    {
      name: 'pages by key: every row once and none twice, with the total on every page',
      steps: [{
        when: { op: 'search', args: ['person', { q: '', size: 3 }] },
        pages: { arg: 1, max: 10, each: { all: [{ select: 'total', equals: 7 }, { select: 'rows', maxLength: 3 }] } },
        then: { all: [{ select: 'rows[].id', length: 7, distinct: true }, { select: 'pages', equals: 3 }] },
      }],
    },
    {
      name: 'never gives a picker someone marked as left',
      steps: [
        { when: find('person', 'oskar'), then: ids([]) },
        { when: find('person', ''), then: { select: 'rows[].id', excludes: ['oskar'], length: 7 } },
      ],
    },
    {
      name: 'suggests, before anything is typed, you first, then your team, then those chosen lately',
      steps: [
        { when: { op: 'suggest', args: ['person', 'ana', []] }, then: { select: '[].id', all: [{ select: '[0].id', equals: 'ana' }], includes: ['tunde', 'mei'], excludes: ['oskar'], distinct: true } },
        { when: { op: 'suggest', args: ['person', 'ana', [{ kind: 'person', id: 'oskar' }, { kind: 'person', id: 'lucia' }]] }, then: { select: '[].id', includes: ['lucia'], excludes: ['oskar'] } },
        { when: { op: 'suggest', args: ['team', 'kofi', []] }, then: { select: '[0].id', equals: 'obs' } },
        { when: { op: 'suggest', args: ['goal', 'tunde', []] }, then: { select: '[].id', includes: ['rollback', 'contract-tests'] } },
      ],
    },
    {
      name: 'gives the rows for things already chosen by id, in the words a search gives, someone marked as left included',
      steps: [
        { when: { op: 'byIds', args: ['person', ['oskar', 'ana', 'nobody']] }, then: { has: [{ kind: 'person', id: 'oskar', name: 'Oskar Lindgren' }, { kind: 'person', id: 'ana', name: 'Ana Souza', detail: 'Engineering Manager, Build & Release · Build & Release' }] } },
        { when: { op: 'byIds', args: ['goal', ['rollback']] }, then: { equals: [{ kind: 'goal', id: 'rollback', name: 'One-click rollback for every service', detail: 'G-1 · Tunde Bakare · Build & Release', status: 'on', key: 'G-1' }] } },
        { when: { op: 'byIds', args: ['team', ['obs']] }, then: { has: [{ name: 'Observability', detail: 'Led by Kofi Mensah · 2 people' }] } },
      ],
    },
    {
      name: 'may offer a near miss when nothing matches, and says nothing when nothing is near',
      steps: [
        { when: find('goal', 'rolback'), then: { anyOf: [{ all: [{ select: 'near', equals: 'rollback' }, { select: 'rows[].id', includes: ['rollback'] }] }, { select: 'total', equals: 0 }] } },
        { when: find('goal', 'zzzz'), then: { all: [{ has: { total: 0, rows: [], next: null } }, { select: 'near', absent: true }] } },
      ],
    },
  ],
};
