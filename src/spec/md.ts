/* Markdown helpers for the spec. Pure. */

/** Text safe inside a table cell: one line, pipes escaped. */
export const cell = (s: string) => s.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();

export function table(head: string[], rows: string[][]): string {
  if (!rows.length) return '_None._';
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** A link from a spec file to a repository file: `depth` folders below the root. */
export const link = (depth: number, file: string, text = file) => `[${text}](${'../'.repeat(depth)}${file})`;

/** A short marker the spec puts on anything a rebuild could not take from it alone. */
export const UNCLEAR = '**Not self-explanatory:**';

/** "a, b and c". */
export const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
