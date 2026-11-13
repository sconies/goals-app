/* The goals contract's cases (the query port, src/ports/goals.ts; AX5), as data: every Goals query in
   spec/conformance/goals.csv, and the four checks spec/rebuild/ports-at-scale.md asks of any query port (their names
   kept: that page cites them), a scope by its name, and the order with no sort. Made from the conformance files, so they
   can't drift from the rules: `npm run spec` writes them to spec/conformance/contracts/goals.json, and
   src/ports/contracts/goals.ts runs them on Faro's adapter. */
import type { Contract, Step, Then } from './format';
import { WORST_FIRST } from './search';

/** Who asks for the scopes: Rhea owns goals in the conformance workspace. */
export const GOALS_VIEWER = 'rhea';
/** What a case starts from: the conformance workspace as it stood at its builtFor, asked by Rhea. */
export interface GoalsGiven { workspace: 'workspace.json'; viewer: string }
/** The statuses a count gives, in the vocabulary's order. */
const STATUSES = ['off', 'risk', 'stale', 'none', 'on', 'planned', 'done'] as const;
const PAGE = 50;

function csv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head!.map((h, i) => [h, r[i] ?? ''])));
}

/** Every page of a Goals query, chained by `next`. */
const all = (ask: object, then: Then, each?: Then, between?: Step['when']): Step => ({ when: { op: 'goals', args: [{ size: PAGE, ...ask }] }, pages: { arg: 0, max: 20, ...(each ? { each } : {}), ...(between ? { between } : {}) }, then });

/** The conformance files the cases are made from, by name: goals.csv, status.csv, flags.csv and workspace.json. */
export function goalsContract(read: (file: string) => string): Contract {
  const queries = csv(read('goals.csv'));
  const status = csv(read('status.csv'));
  const flags = csv(read('flags.csv'));
  const w = JSON.parse(read('workspace.json')) as { builtFor: string; goals: { id: string; key: string; parentId: string | null }[]; checkIns: { goalId: string; postedAt: string }[] };
  const week = status.reduce((m, r) => Math.max(m, Number(r.week ?? 0)), 0);
  const row = (q: string): Record<string, string> => queries.find((r) => r.query === q)!;
  const ids = (q: string) => (row(q).ids ?? '').split(' ').filter(Boolean);
  const keyOf = new Map(w.goals.map((g) => [g.id, g.key]));
  const every = ids('').map((id) => keyOf.get(id)!);
  const statusOf = new Map(status.filter((r) => Number(r.week) === week).map((r) => [r.goal, r.status]));
  const flagsOf = new Map(flags.filter((r) => Number(r.week) === week).map((r) => [r.goal, (r.flags ?? '').split(' ').filter(Boolean)]));
  const top = w.goals.find((g) => !g.parentId)!;
  const added = { ...JSON.parse(JSON.stringify(top)), id: 'aaa-added', key: undefined, title: 'AAA added between pages' };
  const traced = 'ns-lead';
  const given: GoalsGiven = { workspace: 'workspace.json', viewer: GOALS_VIEWER };
  return {
    port: 'goals',
    about: `The query port’s goal calls (\`Goals\`): what Home, Goals and the AI tools read about goals, a page of summary rows at a time, each row what the stage 1 rules say about the goal now. \`given\` names the conformance workspace (\`workspace.json\`, beside this folder) as it stood at its \`builtFor\`, asked by \`viewer\` (for scopes): the shim makes a port over it. An ask is \`{ query, scope?, after?, size? }\`, where \`query\` is a Goals link’s query string (\`status=off&sort=title\`; the Goals screen’s filters and sort, [the Goals page](../../core/rules/goals-page.md)) and \`scope\` names a Goals scope, answered for the viewer. A row is the goal’s summary without its check-ins: \`goal\` (the record), \`status\`, \`attention.flags\` (each with its \`kind\`) and the rest.`,
    ops: {
      given: 'Start a fresh port over this workspace, for this viewer. Answers null.',
      goals: `(ask) One page of the goals the query matches: \`{ rows, next, total, near? }\`, at most ${PAGE} rows whatever \`size\` asks for, in the query’s sort, or worst first then by title with no sort. \`next\` is the key to ask the next page with (\`after\`), null on the last; \`near\` is the near miss a search found nothing for (find rule 5).`,
      counts: '(ask without paging) `{ total, status, attention }` for the same filter: how many match, how many in each status, and how many need attention with the query’s own attention filter left off.',
      goal: '(id) One live goal’s summary with its check-ins (`checkIns`); null for a goal that isn’t live here.',
      add: '(goal) A goal is saved to the workspace by someone else, between two of your calls: later calls see it. Answers null.',
    },
    given,
    cases: [
      ...queries.map((c) => ({
        name: `answers the Goals query ${c.query ? `“${c.query}”` : '(every goal)'} as goals.csv says`,
        steps: [
          all({ query: c.query }, { select: 'rows[].goal.id', equals: ids(c.query ?? '') }, { all: [{ select: 'total', equals: Number(c.total) }, c.near ? { select: 'near', equals: c.near } : { select: 'near', absent: true }] }),
          { when: { op: 'counts', args: [{ query: c.query }] }, then: { equals: { total: Number(c.total), status: Object.fromEntries(STATUSES.map((k) => [k, Number(c[k])])), attention: Number(c.attention) } } },
        ],
      })),
      {
        name: `gives each goal the status and flags the rules give it (status.csv and flags.csv, this week)`,
        steps: [all({ query: '' }, { all: [
          { select: 'rows[].goal.key', equals: every },
          { select: 'rows[].status', equals: every.map((k) => statusOf.get(k)) },
          { select: 'rows[].attention.flags[].kind', equals: every.map((k) => flagsOf.get(k) ?? []) },
        ] })],
      },
      {
        name: 'pages by key: every goal once and none twice, and a goal added between pages doesn’t move the next page',
        steps: [all({ query: 'sort=title', size: 20 }, { all: [{ select: 'rows[].goal.id', length: ids('').length, distinct: true, excludes: ['aaa-added'] }, { select: 'pages', equals: Math.ceil(ids('').length / 20) }] }, { select: 'rows', maxLength: 20 }, { op: 'add', args: [added] })],
      },
      {
        name: 'never gives more than a page, whatever size is asked for',
        steps: [{ when: { op: 'goals', args: [{ query: '', size: 10_000 }] }, then: { all: [{ select: 'rows', length: PAGE }, { select: 'total', equals: ids('').length }] } }],
      },
      {
        name: 'gives a goal’s check-ins only through goal()',
        steps: [
          { when: { op: 'goals', args: [{ query: '' }] }, then: { all: [{ select: 'rows[0].checkIns', absent: true }, { select: 'rows[0].series', absent: true }] } },
          { when: { op: 'goal', args: [traced] }, then: { all: [{ select: 'goal.id', equals: traced }, { select: 'checkIns', length: w.checkIns.filter((c) => c.goalId === traced && c.postedAt <= w.builtFor).length }, { select: 'checkIns[].goalId', excludes: w.goals.filter((g) => g.id !== traced).map((g) => g.id) }] } },
          { when: { op: 'goal', args: ['nowhere'] }, then: { equals: null } },
        ],
      },
      {
        name: 'narrows to a scope by its name, for the person asking, and counts the same filter',
        steps: [
          all({ query: '', scope: 'mine' }, { select: 'rows[].goal.id', equals: ids(`owner=${GOALS_VIEWER}`) }),
          all({ query: '', scope: 'team:cicd' }, { select: 'rows[].goal.id', equals: ids('team=cicd') }),
          all({ query: '', scope: 'all' }, { select: 'rows[].goal.id', equals: ids('') }),
          { when: { op: 'counts', args: [{ query: '', scope: 'mine' }] }, then: { select: 'total', equals: ids(`owner=${GOALS_VIEWER}`).length } },
        ],
      },
      {
        name: 'lists with no sort worst first, then by title',
        steps: [all({ query: '' }, { all: [{ select: 'rows[].status', ordered: { rank: WORST_FIRST } }, { select: 'rows[].goal.id', equals: ids('') }] })],
      },
    ],
  };
}
