/* The data model section of the spec, read from src/domain/types.ts with the TypeScript parser: every record, its
   fields, their types and the comment written beside each. Plus the database tables, read from the migrations. Node only. */
import ts from 'typescript';
import { files, read, type Repo } from './sources';
import { cell, table } from './md';

interface Field { name: string; type: string; optional: boolean; doc: string }
interface Decl { name: string; kind: 'interface' | 'type'; doc: string; extends: string[]; fields: Field[]; text: string; exported: boolean }

const docOf = (node: ts.Node, sf: ts.SourceFile): string => {
  // The comment written just before it: /** … */ or /* … */ or // lines.
  const ranges = ts.getLeadingCommentRanges(sf.text, node.getFullStart()) ?? [];
  return ranges.map((c) => sf.text.slice(c.pos, c.end))
    .map((c) => c.startsWith('//') ? c.replace(/^\/\/\s?/gm, '') : c.replace(/^\/\*\*?/, '').replace(/\*\/$/, '').split('\n').map((l) => l.replace(/^\s*\*?\s?/, '')).join(' '))
    .join(' ').replace(/\s+/g, ' ').trim();
};

export function declarations(r: Repo, file = 'src/domain/types.ts'): { header: string; decls: Decl[] } {
  const text = read(r, file);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  const decls: Decl[] = [];
  const first = sf.statements[0];
  const header = first ? docOf(first, sf) : '';
  for (const s of sf.statements) {
    const exported = ts.canHaveModifiers(s) && !!ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isInterfaceDeclaration(s)) {
      const fields: Field[] = s.members.filter(ts.isPropertySignature).map((m) => ({
        name: m.name.getText(sf), type: (m.type?.getText(sf) ?? '').replace(/\s+/g, ' '), optional: !!m.questionToken, doc: docOf(m, sf),
      }));
      const ext = (s.heritageClauses ?? []).flatMap((h) => h.types.map((t) => t.getText(sf)));
      decls.push({ name: s.name.text, kind: 'interface', doc: s === first ? '' : docOf(s, sf), extends: ext, fields, text: '', exported });
    } else if (ts.isTypeAliasDeclaration(s)) {
      decls.push({ name: s.name.text, kind: 'type', doc: s === first ? '' : docOf(s, sf), extends: [], fields: [], text: s.type.getText(sf).replace(/\s+/g, ' '), exported });
    }
  }
  return { header, decls };
}

/** The tables the migrations create, each with the migration that first creates it. */
export function tables(r: Repo): { name: string; migration: string }[] {
  const out = new Map<string, string>();
  for (const f of files(r, 'supabase/migrations', (x) => x.endsWith('.sql'))) {
    for (const m of read(r, f.replace(/^\//, '')).matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/gi)) if (!out.has(m[1]!)) out.set(m[1]!, f.split('/').pop()!);
  }
  return [...out].map(([name, migration]) => ({ name, migration }));
}

export function dataModelMarkdown(r: Repo): string {
  const { header, decls } = declarations(r);
  const out: string[] = [
    '# The data model',
    '',
    `Generated from \`src/domain/types.ts\` (every record, field and the comment written beside it) and the migrations in \`supabase/migrations\`. ${header}`,
    '',
    'Every screen, export and AI tool derives what it shows from these records with the pure rules in `src/domain` (see [the rules](rules/README.md)). Ids are strings. Dates are ISO 8601: a day is `yyyy-mm-dd`, a moment a full UTC timestamp. Weeks are counted from a cycle’s start: week 0 is the first seven days.',
    '',
    '## The records the core rules read',
    '',
    'A rebuild of the core rules needs these: a **Cycle**, **Goal** (one of three kinds), **CheckIn**, **Person**, **Team**, **Decision** (what was said in a review), **Ask** and **Review**. The **Snapshot** holds a workspace’s records together. The rest (change log, watches, views, tokens, feedback, retros) belong to features around the rules.',
    '',
  ];
  for (const d of decls) {
    out.push(`### ${d.name}`, '');
    if (d.doc) out.push(d.doc, '');
    if (d.kind === 'type') { out.push('```ts', `type ${d.name} = ${d.text}`, '```', ''); continue; }
    if (d.extends.length) out.push(`Has every field of ${d.extends.map((e) => `[${e}](#${e.toLowerCase()})`).join(', ')}, and:`, '');
    if (d.fields.length) out.push(table(['Field', 'Type', 'Required', 'Meaning'], d.fields.map((f) => [`\`${f.name}\``, `\`${cell(f.type)}\``, f.optional ? 'no' : 'yes', cell(f.doc)])), '');
  }
  out.push('## Where they are stored', '', 'One Postgres database (Supabase). Each table holds one kind of record for every workspace (a `workspace_id` column), created by the migration named. `src/adapters/supabase/goalsStore.ts` maps rows to the records above; `src/data/rows.ts` does the field-by-field conversion.', '');
  out.push(table(['Table', 'First created by'], tables(r).map((t) => [`\`${t.name}\``, `\`supabase/migrations/${t.migration}\``])), '');
  return out.join('\n');
}
