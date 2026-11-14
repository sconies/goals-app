/* Goals' filters and sort (item 11, drill gap 3.30): every filter and sort a Goals link, a saved view, an export and the
   AI tools' find_goals can say, read from src/domain/query.ts, so a rebuild needn't read the source to know them. The
   parameters are found by asking the code: each field of the query set alone, written as a link by queryEntries. */
import { EMPTY_QUERY, KIND_OPTIONS, NEED_OPTIONS, QUERY_KEYS, RESULT_OPTIONS, SORT_OPTIONS, STATUS_OPTIONS, queryEntries, type GoalQuery } from '../domain/query';
import { RANK } from '../domain/status';
import { LABEL } from '../domain/vocabulary';
import type { DisplayStatus } from '../domain/types';
import { cell, table } from './md';
import { declarations } from './model';
import type { Repo } from './sources';

/** One example value for each field of the query, to find the parameter the code writes it as. */
const SAMPLE: { [K in keyof GoalQuery]-?: GoalQuery[K] } = {
  q: 'lead time', status: ['off', 'risk'], level: ['team'], team: ['cicd'], owner: ['-me'], kind: ['metric'], attention: true, needs: ['no-path'],
  due: 'quarter', quiet: 2, quarter: 'missed', result: ['late'], feeds: 'ns-lead', helps: true, sort: 'gap', dir: -1, cols: { metric: 'lead-time' },
  checkedin: 'no', inreview: 'weekly', moved: 'worse', since: '2026-11-06',
};

/** The statuses by rank, worst first, those of equal rank together. */
function ranks(): string {
  const by = new Map<number, DisplayStatus[]>();
  for (const [k, n] of Object.entries(RANK) as [DisplayStatus, number][]) by.set(n, [...(by.get(n) ?? []), k]);
  return [...by.entries()].sort((a, b) => b[0] - a[0]).map(([, ks]) => ks.map((k) => LABEL[k]).join(', ')).map((x) => (x.includes(',') ? `${x} (equal)` : x)).join(', then ');
}

export function goalsQueryPage(r: Repo, generated: string): string {
  const q = declarations(r, 'src/domain/query.ts').decls.find((d) => d.name === 'GoalQuery');
  if (!q) throw new Error('src/domain/query.ts has no GoalQuery');
  const rows = q.fields.map((f) => {
    const key = f.name as keyof GoalQuery;
    // A field on its own, written as a link; dir and since only mean something beside sort and moved.
    const alone = { ...EMPTY_QUERY, [key]: SAMPLE[key], ...(key === 'dir' ? { sort: SAMPLE.sort } : {}), ...(key === 'since' ? { moved: SAMPLE.moved } : {}) } as GoalQuery;
    const said = queryEntries(alone).filter(([k]) => !(key === 'dir' && k !== 'sort') && !(key === 'since' && k !== 'since'));
    return [`\`${f.name}\``, said.map(([k, v]) => `\`${k}=${v}\``).join(' ') || '(none)', cell(f.doc || '')];
  });
  const opts = (name: string, list: readonly (readonly [string, string])[]) => `- **${name}:** ${list.map(([k, v]) => `\`${k}\` “${v}”`).join(', ')}`;
  return generated + [
    '# Goals’ filters and sort',
    '',
    'One definition of what each filter and sort means (`src/domain/query.ts`), used by the Goals screen in every layout, by exports, saved views and shared links (as the address’s query string), by Home’s and the habit panel’s links into Goals, by Find’s goals ([finding things](rules/finding.md)), and by the AI tools’ `find_goals`. A link holds only what differs from no filter, in one fixed order, so equal queries make equal links.',
    '',
    '## Each filter, and how a link writes it',
    '',
    'Each field of the query with the parameter the code writes for it (the example values are the code’s own, set one at a time), and what the field means in the comment written beside it. Several values of one filter are joined with commas and mean any of them; different filters all apply.',
    '',
    table(['Field', 'In the address', 'What it means'], rows),
    '',
    `Every parameter a query reads, in the order a link writes them: ${QUERY_KEYS.map((k) => `\`${k}\``).join(', ')}. The last are modules’ own: a module filters by the column it fills for each goal (\`metric=\` for Measured by), and a switched-off module’s parameter narrows nothing. An unknown value is no filter.`,
    '',
    '## The values each filter takes, and their words',
    '',
    opts('Status (`status`)', STATUS_OPTIONS),
    opts('Needs attention because (`needs`, with `attention=1`)', NEED_OPTIONS),
    opts('Result (`result`)', RESULT_OPTIONS),
    opts('Kind (`kind`)', KIND_OPTIONS),
    opts('Sort (`sort`)', SORT_OPTIONS),
    '- **Owner:** a person’s id, or `-me` for “Owner: not you” (the goals someone else owns).',
    '- **Due:** `quarter` (by the end of this quarter) or a week’s number (by that week).',
    '',
    '## The order',
    '',
    `**Worst first** (\`sort=worst\`, and Find’s goals unless sorted) is by the status’s rank, worst first: ${ranks()}; then by title A to Z, ignoring case. With another \`sort\`, its natural order (A to Z, the longest since a check-in first, the soonest due first, the furthest behind plan first), \`.desc\` reversing it (\`sort=gap.desc\`), and ties worst first, then by title. With no \`sort\` the query keeps the order it is given: the screens give goals worst first by how much each needs attention (its worst flag, [the flags](rules/flags.md)), then the status’s rank, then the title (\`worstFirst\`, \`src/domain/order.ts\`).`,
    '',
  ].join('\n');
}
