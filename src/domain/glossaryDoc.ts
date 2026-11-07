/* The status words section of docs/glossary.md, made from the vocabulary (domain/vocabulary.ts) so the glossary can't
   say a word differently from the app. `npm run glossary` writes it between the markers; evals/vocabulary.eval.ts fails
   when the file isn't current. */
import { GROUPS, STATUS, withCode, type GroupKey, type Term } from './vocabulary';

export const GLOSSARY_START = '<!-- status words: generated from src/domain/vocabulary.ts by `npm run glossary`. Edit the vocabulary, not this. -->';
export const GLOSSARY_END = '<!-- status words: end -->';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const rule = (r: string) => { const [file, fn] = r.split('#'); return `\`${fn}\` (${file}.ts)`; };

/** The generated section, markers included. */
export function glossaryMarkdown(): string {
  const out: string[] = [GLOSSARY_START, '', '## Status words', ''];
  out.push('One meaning for every word the app uses for a state. Each is defined once, in `src/domain/vocabulary.ts`: the app, the exports, Help and the AI assistant all read it from there, and `npm run evals` fails on a word written anywhere else (requirement ONE-VOCABULARY, `evals/vocabulary.eval.ts`). The code is what is stored and passed (it never changes); the word is what people read. The AI assistant says both: “' + withCode(STATUS.off) + '”.');
  out.push('');
  for (const key of Object.keys(GROUPS) as GroupKey[]) {
    const g = GROUPS[key];
    out.push(`### ${g.title}`, '');
    out.push('| Code | Word | What it means | Decided by | Where | Don’t say |');
    out.push('|---|---|---|---|---|---|');
    for (const t of Object.values(g.terms as Record<string, Term>)) {
      const same = t.same ? ` The same word, and meaning, as ${t.same}.` : '';
      out.push(`| \`${t.code}\` | ${cell(t.label)} | ${cell(t.meaning + same)} | ${rule(t.rule)} | ${t.where.join(', ')} | ${(t.retired ?? []).map((w) => `\`${w}\``).join(', ')} |`);
    }
    out.push('');
  }
  out.push(GLOSSARY_END);
  return out.join('\n');
}

/** The glossary with its generated section replaced (or added at the end). */
export function withGlossary(md: string): string {
  const at = md.indexOf(GLOSSARY_START), end = md.indexOf(GLOSSARY_END);
  if (at < 0 || end < 0) return md.trimEnd() + '\n\n' + glossaryMarkdown() + '\n';
  return md.slice(0, at) + glossaryMarkdown() + md.slice(end + GLOSSARY_END.length);
}
