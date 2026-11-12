/* Two spec pages for the spreadsheet format (backlog KT, gap 2): spec/core/import-issues.md, every kind of issue the
   change engine raises (its level, what raises it, what it says, the answers it takes, and its case in import.csv), with
   every column's and word's other spellings; and spec/core/export-format.md, the format itself (domain/formatDoc, the
   same text as docs/export-format.md). Made from the code, so neither can say it differently. */
import { CHECK_KINDS, MUST_KINDS, NOTE_KINDS, LEVEL_WORD, groupIssues, type IssueKind, type IssueLevel } from '../domain/problemLevels';
import { ISSUE_KINDS } from '../domain/issueKinds';
import { BOUND_WORDS, CALL_WORDS, CAUSE_WORDS, FILL_SHEETS, GOAL_ACTION_WORDS, PERSON_ACTION_WORDS, RECOVERY_WORDS, SHAPE_WORDS, TYPE_WORDS, YES_WORDS, fieldTable, specOf, type Words } from '../domain/columns';
import { LEVEL_WORDS } from '../domain/levels';
import { exportFormatMarkdown } from '../domain/formatDoc';
import type { ModuleSheet } from '../domain/records';
import { importCases, runCase, type ConformanceWorkspace } from './conformance';
import { cell, table } from './md';

const KINDS_OF: Record<IssueLevel, readonly IssueKind[]> = { must: MUST_KINDS, check: CHECK_KINDS, note: NOTE_KINDS };
const LEVEL_SAYS: Record<IssueLevel, string> = {
  must: 'Faro can’t record it truthfully. Nothing is saved while one is left, unless an answer leaves its rows out.',
  check: 'Possible but unlikely: a question. The change saves once it is answered; one answer covers every row in its group.',
  note: 'How a row was read. Said on the change, never a block.',
};

/** Each kind's case in import.csv (the case named after it, else the first that raises it), with the group it raised there. */
export function kindCases(w: ConformanceWorkspace): Map<IssueKind, { case: string; title: string; answers: string[] }> {
  const out = new Map<IssueKind, { case: string; title: string; answers: string[] }>();
  const runs = importCases(w).map((c) => ({ c, groups: groupIssues(runCase(w, c).issues) }));
  const take = (kind: IssueKind, c: string, g: { title: string; answers: { label: string }[] }) => { if (!out.has(kind)) out.set(kind, { case: c, title: g.title, answers: g.answers.map((a) => a.label) }); };
  for (const { c, groups } of runs) { const g = groups.find((x) => x.kind === c.case); if (g) take(g.kind, c.case, g); }
  for (const { c, groups } of runs) for (const g of groups) take(g.kind, c.case, g);
  return out;
}

const spellings = (w: Words<string>) => (Object.entries(w.word) as [string, string][]).filter(([code]) => (w.also[code] ?? []).length).map(([code, word]) => [cell(w.what), `\`${cell(word)}\``, (w.also[code] ?? []).map((x) => `\`${cell(x)}\``).join(', ')]);

export function importIssuesMarkdown(w: ConformanceWorkspace): string {
  const found = kindCases(w);
  const levels = (['must', 'check', 'note'] as IssueLevel[]).map((level) => [
    `## ${LEVEL_WORD[level]} (\`${level}\`)`, '', LEVEL_SAYS[level], '',
    table(['Kind', 'Raised when', 'What it says, in its case', 'Answers in the preview', 'Case in import.csv'], KINDS_OF[level].map((k) => {
      const f = found.get(k);
      const rule = ISSUE_KINDS[k];
      return [`\`${k}\``, cell(rule.when), f ? cell(f.title) : '—', f?.answers.length ? cell(f.answers.join(' · ')) : '—', f ? `\`${f.case}\`` : `None. ${cell(rule.raisedBy ?? '')}`];
    })), '',
  ].join('\n'));
  const columns = FILL_SHEETS.flatMap((k) => fieldTable(k).filter((c) => c.also?.length).map((c) => [specOf(k).name, cell(c.header), c.also!.map((x) => `\`${cell(x)}\``).join(', ')]));
  const words = [LEVEL_WORDS, TYPE_WORDS, SHAPE_WORDS, BOUND_WORDS, YES_WORDS, CALL_WORDS, CAUSE_WORDS, RECOVERY_WORDS, GOAL_ACTION_WORDS, PERSON_ACTION_WORDS].flatMap((x) => spellings(x as Words<string>));
  return [
    '# Every issue a spreadsheet can raise',
    '',
    'Every problem, question and note the change engine (`planChanges`, [the change engine](rules/change-engine.md)) raises has a **kind**, and its level is fixed by its kind ([kinds, levels and near misses](rules/import-levels.md)). This page lists every kind: what raises it (`src/domain/issueKinds.ts`), what its group says and the answers it takes, run on [its case in import.csv](../conformance/import.csv) (column `kinds` lists every kind a case raised). Then every other spelling a column or a word is read by. The columns themselves are in [the export format](export-format.md).',
    '',
    'A group’s sentence counts its rows, so a file with more rows says the same with another number. A kind with no case is one the engine itself never raises: the table says what does instead.',
    '',
    ...levels,
    '',
    '## Other names for a column',
    '',
    'A header is read as its column when it is the column’s name or one of these, in any case. One within reach of exactly one of them is asked about (`near-header`); two headers read as one column are asked which (`two-columns`).',
    '',
    table(['Sheet', 'Column', 'Also read as'], columns),
    '',
    '## Other spellings of a word',
    '',
    'A word column reads its words, and these, in any case. The export writes the first. A word within reach of exactly one of all of them is asked about (`near-word`); any other is Must fix (`unknown-word`).',
    '',
    table(['Column', 'Word', 'Also read as'], words),
    '',
  ].join('\n');
}

/** The format, as docs/export-format.md has it (the same text, made from the same code), said to be the spec's copy. */
export function exportFormatPage(modules: readonly ModuleSheet[]): string {
  return exportFormatMarkdown(modules).replace(/^<!--[^\n]*-->/, '<!-- Generated by npm run spec from src/domain/columns.ts (src/domain/formatDoc.ts), as docs/export-format.md is. Edit the code, not this file. -->');
}
