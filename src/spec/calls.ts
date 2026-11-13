/* The command port and the AI tools as contracts (KT gap 4): every action's input, result, who may and the words it
   refuses with, into spec/core/actions.md, and every MCP tool's input schema, what it gives back and its refusals, into
   spec/core/tools.md. Read from the code, so they can't drift:
   - an action's input and result are its types in src/app/actions.ts (and each module's actions.ts), by the TypeScript
     checker;
   - who may is R1's access table (src/spec/internal.ts ACCESS), matched by the rule function each action calls;
   - a refusal is every `NotAllowed` sentence the rule (and the rules it calls, under src/domain and src/modules) can
     throw, read from its syntax;
   - a tool's input is its JSON schema (src/mcp/tools.ts TOOLS), what it gives back the type of the `data` its run
     returns, and its own refusals the sentences its run (and the src/mcp helpers it calls) throws or returns as errors.
   No database, screens or network. */
import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';
import { ACCESS, type Access } from './internal';
import { ACTIONS as PARITY } from '../mcp/parity';
import type { ToolDef } from '../mcp/tools';
import { and, cell, table } from './md';
import type { Repo } from './sources';

/* ---------- reading the code ---------- */

const MODULES_DIR = 'src/modules';
const moduleFiles = (r: Repo, name: string) => fs.readdirSync(path.join(r.root, MODULES_DIR)).map((m) => `${MODULES_DIR}/${m}/${name}`).filter((f) => fs.existsSync(path.join(r.root, f))).sort();
/** Where the tools are written: the core's, then each module's. */
const toolFiles = (r: Repo) => [...['tools', 'workTools', 'removeTools', 'markupTools', 'feedbackTools'].map((f) => `src/mcp/${f}.ts`), ...moduleFiles(r, 'tools.ts')];

interface Program { p: ts.Program; c: ts.TypeChecker; root: string }
let cached: { root: string; prog: Program } | null = null;
function program(r: Repo): Program {
  if (cached?.root === r.root) return cached.prog;
  const cfg = ts.getParsedCommandLineOfConfigFile(path.join(r.root, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  const roots = ['src/app/actions.ts', ...moduleFiles(r, 'actions.ts'), ...toolFiles(r)].map((f) => path.join(r.root, f));
  const p = ts.createProgram(roots, { ...(cfg?.options ?? {}), noEmit: true });
  cached = { root: r.root, prog: { p, c: p.getTypeChecker(), root: r.root } };
  return cached.prog;
}
const sourceOf = (g: Program, rel: string) => g.p.getSourceFile(path.join(g.root, rel)) ?? (() => { throw new Error(`Can't read ${rel}`); })();
const relOf = (g: Program, n: ts.Node) => path.relative(g.root, n.getSourceFile().fileName).split(path.sep).join('/');
const FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType;
/** A type's name in this repository, without the absolute path the checker gives one that isn't in scope. */
const local = (text: string) => text.replace(/import\("[^"]+"\)\./g, '');
const typeText = (g: Program, t: ts.Type, at?: ts.Node) => local(g.c.typeToString(t, at, FLAGS));
const printer = ts.createPrinter({ removeComments: true });
/** A type written out over several lines, as TypeScript, for a code block. */
function typeBlock(g: Program, t: ts.Type, at: ts.Node): string {
  const node = g.c.typeToTypeNode(t, at, ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.MultilineObjectLiterals | ts.NodeBuilderFlags.UseSingleQuotesForStringLiteralType);
  return node ? local(printer.printNode(ts.EmitHint.Unspecified, node, at.getSourceFile())) : typeText(g, t, at);
}

/* ---------- the types the inputs and results name ---------- */

export interface NamedType { name: string; file: string; text: string }
/** Every type declared in this repository (outside src/domain/types.ts, which the data model has) that a type uses,
    added to `found` with what they use in turn. */
function namedTypes(g: Program, t: ts.Type, found: Map<string, NamedType>, seen = new Set<ts.Type>()): void {
  const sym = t.aliasSymbol ?? (t.flags & ts.TypeFlags.Object && t.symbol && !t.symbol.name.startsWith('__') ? t.symbol : undefined);
  const decl = sym?.declarations?.[0];
  if (sym && decl && (ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl) || ts.isEnumDeclaration(decl))) {
    const file = relOf(g, decl);
    for (const a of t.aliasTypeArguments ?? []) namedTypes(g, a, found, seen);
    if (file === 'src/domain/types.ts' || found.has(sym.name)) return;
    if (file.startsWith('src/')) found.set(sym.name, { name: sym.name, file, text: decl.getText() });
  }
  membersOf(g, t, found, seen);
}
/** The types inside one: a union's or intersection's parts, a list's items, an object's fields. */
function membersOf(g: Program, t: ts.Type, found: Map<string, NamedType>, seen: Set<ts.Type>): void {
  if (seen.has(t)) return;
  seen.add(t);
  if (t.isUnionOrIntersection()) { for (const x of t.types) namedTypes(g, x, found, seen); return; }
  if (!(t.flags & ts.TypeFlags.Object)) return;
  if ((t as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) for (const a of g.c.getTypeArguments(t as ts.TypeReference)) namedTypes(g, a, found, seen);
  const decl = t.symbol?.declarations?.[0];
  if (decl && !relOf(g, decl).startsWith('src/')) return;
  for (const p of g.c.getPropertiesOfType(t)) { const d = p.valueDeclaration ?? p.declarations?.[0]; if (d) namedTypes(g, g.c.getTypeOfSymbolAtLocation(p, d), found, seen); }
}
const propName = (n: ts.PropertyName) => (ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : n.getText());
const docOf = (g: Program, s: ts.Symbol) => ts.displayPartsToString(s.getDocumentationComment(g.c)).replace(/\s+/g, ' ').trim();

/** The words a sentence-making expression says: a literal as it is, a template with "…" for what is worked out, both sides
    of a choice. */
function sentences(e: ts.Expression | undefined): string[] {
  if (!e) return [];
  if (ts.isParenthesizedExpression(e)) return sentences(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isTemplateExpression(e)) return [e.head.text + e.templateSpans.map((s) => `…${s.literal.text}`).join('')];
  if (ts.isConditionalExpression(e)) return [...sentences(e.whenTrue), ...sentences(e.whenFalse)];
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const [a, b] = [sentences(e.left), sentences(e.right)];
    return [`${a[0] ?? '…'}${b[0] ?? '…'}`];
  }
  return [];
}

/** The function a call reaches, when it is written in this repository. */
function declarationOf(g: Program, callee: ts.Expression): ts.Node | null {
  let s = g.c.getSymbolAtLocation(ts.isPropertyAccessExpression(callee) ? callee.name : callee);
  if (!s) return null;
  if (s.flags & ts.SymbolFlags.Alias) s = g.c.getAliasedSymbol(s);
  const d = s.declarations?.[0];
  if (!d || d.getSourceFile().fileName.includes('node_modules')) return null;
  if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d)) return d;
  if (ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) return d.initializer;
  return null;
}

/** Every refusal a body can throw, following the functions it calls inside `within` (folders under the root). `no(…)`,
    `new NotAllowed(…)` and, with `errors`, any `new Error(…)` thrown or `{ isError: true, text }` returned. */
function refusals(g: Program, body: ts.Node, within: string[], errors = false): string[] {
  const out = new Set<string>();
  const seen = new Set<ts.Node>();
  const walk = (root: ts.Node) => {
    if (seen.has(root)) return;
    seen.add(root);
    const visit = (n: ts.Node) => {
      if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 'NotAllowed' || (errors && n.expression.text === 'Error'))) sentences(n.arguments?.[0]).forEach((s) => out.add(s));
      if (ts.isCallExpression(n)) {
        if (ts.isIdentifier(n.expression) && n.expression.text === 'no') sentences(n.arguments[0]).forEach((s) => out.add(s));
        const d = declarationOf(g, n.expression);
        if (d && within.some((w) => relOf(g, d).startsWith(w))) walk(d);
      }
      if (errors && ts.isObjectLiteralExpression(n) && n.properties.some((p) => ts.isPropertyAssignment(p) && propName(p.name) === 'isError' && p.initializer.kind === ts.SyntaxKind.TrueKeyword)) {
        const t = n.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propName(p.name) === 'text');
        sentences(t?.initializer).forEach((s) => out.add(s));
      }
      ts.forEachChild(n, visit);
    };
    visit(root);
  };
  walk(body);
  return [...out];
}

/** The rule an action's body calls: its name (`A.addNote` gives addNote). */
function ruleCalled(n: ts.Node): string | null {
  let found: string | null = null;
  const visit = (x: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(x)) {
      const e = x.expression;
      const name = ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : null;
      if (name && !['goalOf', 'askOf', 'reviewOf', 'callOf', 'eng', 'recordsOn', 'gone', 'map', 'filter', 'includes', 'find', 'some'].includes(name)) { found = name; return; }
    }
    ts.forEachChild(x, visit);
  };
  visit(n);
  return found;
}

/* ---------- the actions ---------- */

export interface ActionFact {
  name: string;
  /** The module it belongs to, or none for the core's. */
  module?: string;
  /** Each field of its input: name, type, optional, what it is. */
  input: { name: string; type: string; optional: boolean; doc: string }[];
  /** The input's own type, when it is named (SaveGoalInput). */
  inputType: string;
  result: string;
  /** The result written out over several lines. */
  resultBlock: string;
  /** The rule it calls, as a function name. */
  rule: string;
  who: Access[];
  refuses: string[];
  tools: string[] | { notForAssistants: string };
}

const RULE_DIRS = ['src/domain', 'src/modules'];

function fieldsOf(g: Program, t: ts.Type, at: ts.Node): ActionFact['input'] {
  return g.c.getPropertiesOfType(t).map((s) => ({
    name: s.name,
    type: typeText(g, g.c.getTypeOfSymbolAtLocation(s, at), at).replace(/ \| undefined$/, ''),
    optional: !!(s.flags & ts.SymbolFlags.Optional),
    doc: docOf(g, s),
  }));
}

function actionFact(g: Program, name: string, fn: ts.Expression, types: Map<string, NamedType>, module?: string): ActionFact {
  const sig = g.c.getSignaturesOfType(g.c.getTypeAtLocation(fn), ts.SignatureKind.Call)[0]!;
  const param = sig.parameters[1];
  const it = param ? g.c.getTypeOfSymbolAtLocation(param, fn) : undefined;
  if (it) namedTypes(g, it, types);
  namedTypes(g, g.c.getReturnTypeOfSignature(sig), types);
  const rule = ruleCalled(fn) ?? name;
  const d = (() => { let found: ts.Node | null = null; const v = (x: ts.Node) => { if (!found && ts.isCallExpression(x)) { const f = declarationOf(g, x.expression); const nm = ts.isPropertyAccessExpression(x.expression) ? x.expression.name.text : ts.isIdentifier(x.expression) ? x.expression.text : ''; if (f && nm === rule) found = f; } ts.forEachChild(x, v); }; v(fn); return found; })();
  const parity = PARITY[name];
  return {
    name, module,
    input: it ? fieldsOf(g, it, fn) : [],
    inputType: it && it.aliasSymbol ? it.aliasSymbol.name : it && !(it.flags & ts.TypeFlags.Object && (it as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous) && it.symbol && !it.isIntersection() ? it.symbol.name : '',
    result: typeText(g, g.c.getReturnTypeOfSignature(sig), fn),
    resultBlock: typeBlock(g, g.c.getReturnTypeOfSignature(sig), fn),
    rule,
    who: ACCESS.filter((a) => a.code.some((c) => c.endsWith(`#${rule}`))),
    refuses: d ? refusals(g, d, RULE_DIRS) : [],
    tools: parity ?? [],
  };
}

/** Every action the dispatcher runs: the core's table, then each module's. */
export function actionFacts(r: Repo, types = new Map<string, NamedType>()): ActionFact[] {
  const g = program(r);
  const out: ActionFact[] = [];
  const objectOf = (sf: ts.SourceFile, test: (d: ts.VariableDeclaration) => boolean): ts.ObjectLiteralExpression => {
    let found: ts.ObjectLiteralExpression | null = null;
    const v = (n: ts.Node) => {
      if (!found && ts.isVariableDeclaration(n) && test(n) && n.initializer) {
        let e: ts.Expression = n.initializer;
        while (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression;
        if (ts.isObjectLiteralExpression(e)) found = e;
      }
      ts.forEachChild(n, v);
    };
    v(sf);
    if (!found) throw new Error(`No action table in ${sf.fileName}`);
    return found;
  };
  const core = objectOf(sourceOf(g, 'src/app/actions.ts'), (d) => d.name.getText() === 'ACTIONS');
  for (const p of core.properties) if (ts.isPropertyAssignment(p)) out.push(actionFact(g, propName(p.name), p.initializer, types));
  for (const f of moduleFiles(r, 'actions.ts')) {
    const table = objectOf(sourceOf(g, f), (d) => d.name.getText() === 'actions');
    for (const p of table.properties) {
      if (!ts.isPropertyAssignment(p)) continue;
      let e: ts.Expression = p.initializer;
      while (ts.isSatisfiesExpression(e) || ts.isAsExpression(e)) e = e.expression;
      const run = ts.isObjectLiteralExpression(e) ? e.properties.find((x): x is ts.PropertyAssignment => ts.isPropertyAssignment(x) && propName(x.name) === 'run') : undefined;
      const tools = ts.isObjectLiteralExpression(e) ? e.properties.find((x): x is ts.PropertyAssignment => ts.isPropertyAssignment(x) && propName(x.name) === 'tools') : undefined;
      if (!run) continue;
      const fact = actionFact(g, propName(p.name), run.initializer, types, f.split('/')[2]);
      if (tools && ts.isArrayLiteralExpression(tools.initializer)) fact.tools = tools.initializer.elements.filter(ts.isStringLiteral).map((s) => s.text);
      out.push(fact);
    }
  }
  return out;
}

/* ---------- the tools ---------- */

export interface ToolFact {
  name: string;
  /** What `data` it gives back beside its text, as a type; empty when it gives text only. */
  data: string[];
  refuses: string[];
  /** The actions that do the same in the app (src/mcp/parity.ts, read the other way). */
  actions: string[];
  /** Where it is written, from the root. */
  file: string;
}

/** Each tool's definition in the source: the object literal whose `name` is the tool's. */
function toolNodes(g: Program, r: Repo): Map<string, ts.ObjectLiteralExpression> {
  const out = new Map<string, ts.ObjectLiteralExpression>();
  for (const f of toolFiles(r)) {
    const visit = (n: ts.Node) => {
      if (ts.isObjectLiteralExpression(n)) {
        const nm = n.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propName(p.name) === 'name');
        const run = n.properties.some((p) => (ts.isMethodDeclaration(p) || ts.isPropertyAssignment(p)) && propName(p.name) === 'run');
        if (nm && run && ts.isStringLiteral(nm.initializer)) out.set(nm.initializer.text, n);
      }
      ts.forEachChild(n, visit);
    };
    visit(sourceOf(g, f));
  }
  return out;
}

/** The `data` each return of a tool's run gives, as types. */
function dataOf(g: Program, run: ts.Node): string[] {
  const out = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isReturnStatement(n) && n.expression) {
      let t = g.c.getTypeAtLocation(n.expression);
      t = g.c.getAwaitedType(t) ?? t;
      for (const part of t.isUnion() ? t.types : [t]) {
        const d = part.getProperty('data');
        if (!d) continue;
        const dt = g.c.getTypeOfSymbolAtLocation(d, n.expression);
        const nn = g.c.getNonNullableType(dt);
        const text = typeText(g, nn, n.expression);
        if (text !== 'unknown' && text !== 'never') out.add(typeBlock(g, nn, n.expression));
      }
    }
    if (n !== run && (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n))) return;
    ts.forEachChild(n, visit);
  };
  const body = ts.isMethodDeclaration(run) || ts.isArrowFunction(run) || ts.isFunctionExpression(run) ? run.body : run;
  if (body) ts.forEachChild(body, visit);
  return [...out];
}

export function toolFacts(r: Repo, tools: readonly ToolDef[]): ToolFact[] {
  const g = program(r);
  const nodes = toolNodes(g, r);
  const byTool = new Map<string, string[]>();
  for (const a of actionFacts(r)) if (Array.isArray(a.tools)) for (const t of a.tools) byTool.set(t, [...(byTool.get(t) ?? []), a.name]);
  return tools.map((t) => {
    const n = nodes.get(t.name);
    if (!n) throw new Error(`Can't find where the tool ${t.name} is written (src/spec/calls.ts toolFiles).`);
    const run = n.properties.find((p) => propName(p.name!) === 'run')!;
    const fn = ts.isPropertyAssignment(run) ? run.initializer : run;
    return { name: t.name, data: dataOf(g, fn), refuses: refusals(g, fn, ['src/mcp', 'src/modules'], true), actions: byTool.get(t.name) ?? [], file: relOf(g, n) };
  });
}

/* ---------- the pages ---------- */

const anchor = (s: string) => s.toLowerCase().replace(/[^a-z0-9 _-]/g, '').replace(/ /g, '-');
const code = (s: string) => `\`${s.replace(/`/g, '\\`')}\``;
const quote = (s: string) => `“${s}”`;

/** The record types with their own entry in the data model, so a type here can link to it. */
function recordNames(r: Repo): Set<string> {
  const g = program(r);
  const sf = g.p.getSourceFile(path.join(r.root, 'src/domain/types.ts'));
  const out = new Set<string>();
  if (sf) for (const s of sf.statements) if ((ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) && s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) out.add(s.name.text);
  return out;
}
/** A type, with each record it names linked to the data model. */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** The records a type names, linked to the data model. */
function recordLinks(records: Set<string>, t: string): string {
  const named = [...new Set(t.match(/\b[A-Z][A-Za-z]+\b/g) ?? [])].filter((m) => records.has(m));
  return named.length ? `The records it names: ${named.map((m) => `[${m}](data-model.md#${anchor(m)})`).join(', ')}.` : '';
}
function typeCell(records: Set<string>, t: string): string {
  const named = [...new Set(t.match(/\b[A-Z][A-Za-z]+\b/g) ?? [])].filter((m) => records.has(m));
  return cell(code(t)) + (named.length ? ` (${named.map((m) => `[${m}](data-model.md#${anchor(m)})`).join(', ')})` : '');
}

const ERRORS_EVERY_ACTION = [
  'That goal no longer exists. Reload to see the latest. (and the same for an ask, a review or a note named by an id that isn’t there)',
  '… is switched off in …. An admin can switch it on in Workspace, under Features. (a module’s action, when the workspace has switched the module off)',
];

export function actionsPage(r: Repo, generated: string): string {
  const types = new Map<string, NamedType>();
  const facts = actionFacts(r, types);
  const records = recordNames(r);
  const out = [generated, '# The actions', '',
    'Every change a person makes, as the command port runs it ([the ports at company scale](../rebuild/ports-at-scale.md)): its name, the input it takes, what it gives back, who may run it and the words it refuses with. Faro runs them all through one dispatcher, `run(action, input)`; the internal app’s server takes the same names and inputs. Read from the code by `src/spec/calls.ts`: the input and result are the types in `src/app/actions.ts` (and each module’s `actions.ts`), who may is [R1’s access table](../requirements/internal/r1-sign-in-and-access.md#who-may-change-what), and the refusals are every sentence the action’s rule can refuse with.',
    '',
    '## What every action shares',
    '',
    '- **The input names records by id**, never the records themselves: a goal by its id or its key (`G-12`), an ask, a review or a person by id. It never carries who acts, the time or a new record’s id: the server sets those (the signed-in person, its own clock, ids it makes).',
    '- **The result** is what the rule gives back: a `Commit` (the rows to save and their change-log entries, saved together or not at all), an object carrying one (`{ commit, … }`, with what was made, such as the new goal), or `null` when nothing changed. `planChanges` gives a `ChangeSet`, a preview; it is saved only when the input says `apply`. `createToken`’s caller gets the token’s secret, shown once, in place of the commit.',
    '- **A refusal** is the rule saying no, with words to show the person (`NotAllowed`), and nothing is saved. Its words are listed under each action; “…” marks words worked out when it is said (a name, a week, a number). The change engine’s actions (`planChanges`, `postCheckIn`, `saveGoal`) also hold a change back with issues (Must fix, and questions to answer), which are [every issue kind](import-issues.md), not refusals.',
    `- **Every action can also say:** ${ERRORS_EVERY_ACTION.map(quote).join('; ')}.`,
    '- **Who may** is checked by the rule itself, by the app and the MCP server alike; the server enforces it ([R1](../requirements/internal/r1-sign-in-and-access.md)). The records it names are in [the data model](data-model.md).',
    '',
    table(['Action', 'Does', 'Who may', 'AI tools'], facts.map((f) => [
      `[${f.name}](#${anchor(f.name)})${f.module ? ` (${f.module})` : ''}`,
      cell(f.who.map((w) => w.what).join('; ') || '—'),
      cell([...new Set(f.who.map((w) => w.who))].join('; ') || '—'),
      Array.isArray(f.tools) ? f.tools.map((t) => `[${code(t)}](tools.md#${anchor(t)})`).join(', ') || '—' : `none, on purpose ([why](#${anchor(f.name)}))`,
    ])),
    ''];
  for (const f of facts) {
    out.push(`## ${f.name}`, '');
    if (f.module) out.push(`From the [${f.module}](../modules/${f.module}/README.md) module.`, '');
    out.push(`**Does:** ${f.who.map((w, i) => (i ? lower(w.what) : w.what)).join('; ') || '—'}.`, '');
    out.push(`**Input**${f.inputType ? ` (${code(f.inputType)})` : ''}:`, '');
    out.push(f.input.length ? table(['Field', 'Type', 'Needed', 'What it is'], f.input.map((i) => [code(i.name), typeCell(records, i.type), i.optional ? 'no' : 'yes', cell(i.doc || '')])) : 'Nothing.', '');
    out.push(f.result.length < 60 ? `**Result:** ${typeCell(records, f.result)}` : `**Result:**\n\n\`\`\`ts\n${f.resultBlock}\n\`\`\`\n\n${recordLinks(records, f.result)}`, '');
    out.push(`**Who may:** ${f.who.length === 1 ? f.who[0]!.who : f.who.length ? f.who.map((w) => `${w.who} (to ${lower(w.what)})`).join('; ') : '—'}.`, '');
    out.push(`**The rule:** ${code(f.rule)}${f.who[0] ? `, in ${and([...new Set(f.who.flatMap((w) => w.code).filter((c) => c.endsWith(`#${f.rule}`)).map((c) => code(c.split('#')[0]!)))])}` : ''}.`, '');
    out.push(f.refuses.length ? `**Refuses with:**\n\n${f.refuses.map((s) => `- ${quote(s)}`).join('\n')}` : '**Refuses with:** nothing of its own beyond who may and the shared refusals above.', '');
    out.push(`**AI tools that do the same:** ${Array.isArray(f.tools) ? (f.tools.map((t) => `[${code(t)}](tools.md#${anchor(t)})`).join(', ') || 'none') : `none. ${f.tools.notForAssistants}`}`, '');
  }
  const named = [...types.values()].sort((a, b) => a.name.localeCompare(b.name));
  out.push('## The types the actions name', '', `Each type an action’s input or result names that isn’t a record in [the data model](data-model.md), as the code declares it (with its comments), in A to Z order. ${named.length} types.`, '');
  for (const t of named) out.push(`### ${t.name}`, '', `In \`${t.file}\`.`, '', '```ts', t.text, '```', '');
  return out.join('\n');
}

const ERRORS_EVERY_TOOL = [
  'There’s no tool called ….',
  '… is switched off in …, so … can’t be used there. An admin can switch it on in Workspace, under Features.',
];

/** A JSON schema property as a type: string, integer, one of a list, a list of … */
function schemaType(s: Record<string, unknown>): string {
  if (Array.isArray(s.enum)) return `one of ${(s.enum as unknown[]).map((v) => code(String(v))).join(', ')}`;
  if (s.type === 'array') return `list of ${s.items ? schemaType(s.items as Record<string, unknown>) : 'anything'}`;
  if (s.type === 'object') return 'object';
  if (Array.isArray(s.type)) return (s.type as string[]).join(' or ');
  return String(s.type ?? 'anything');
}
/** Each argument, with an object's (or a list of objects') fields under it as `name.field` / `name[].field`. */
function schemaRows(props: Record<string, unknown>, required: string[], prefix = ''): string[][] {
  const out: string[][] = [];
  for (const [k, v] of Object.entries(props)) {
    const s = v as Record<string, unknown>;
    out.push([code(prefix + k), cell(schemaType(s)), required.includes(k) ? 'yes' : 'no', cell(String(s.description ?? ''))]);
    const inner = s.type === 'object' ? s : s.type === 'array' && (s.items as Record<string, unknown> | undefined)?.type === 'object' ? (s.items as Record<string, unknown>) : null;
    if (inner?.properties) out.push(...schemaRows(inner.properties as Record<string, unknown>, (inner.required as string[]) ?? [], `${prefix}${k}${s.type === 'array' ? '[]' : ''}.`));
  }
  return out;
}

export function toolsPage(r: Repo, tools: readonly ToolDef[], moduleOf: (name: string) => string | undefined, generated: string): string {
  const records = recordNames(r);
  const facts = new Map(toolFacts(r, tools).map((f) => [f.name, f]));
  const kind = (t: ToolDef) => (t.annotations.readOnlyHint ? 'reads' : t.annotations.destructiveHint ? 'changes; removes something' : 'changes');
  const out = [generated, '# The AI tools', '',
    'Every tool Faro’s MCP server offers an AI assistant: what it does, the arguments it takes (its JSON schema), what it gives back, the words it refuses with, and the actions that do the same in the app. An assistant can do whatever its person can, and no more: a token acts as one person in one workspace, with that person’s rights ([R1](../requirements/internal/r1-sign-in-and-access.md), rule 5), so who may run a tool is who may run [the actions](actions.md) it does. Read from the code by `src/spec/calls.ts`: the schemas are `TOOLS` in `src/mcp/tools.ts` (with each module’s tools), what a tool gives back is the type of the `data` its run returns, and the refusals are every sentence its run can throw or return as an error.',
    '',
    '## What every tool shares',
    '',
    '- **The protocol** is MCP over HTTP (JSON-RPC 2.0): `tools/list` gives every tool below with its schema, `tools/call` runs one. The token is a bearer token, made by an admin for one person and kept only as its hash.',
    '- **The arguments** are checked against the schema; no argument outside it is accepted (`additionalProperties: false`). A goal is named by its id or its key (`G-12`), a person by name or id.',
    '- **What it gives back:** a text for the assistant to read, in plain words with each status’s code beside its word (“Off track (off)”), and, for most tools, `data` beside it (MCP structured content), typed below. A tool that sends pictures sends them after the text.',
    '- **A change** goes through the same rules as the app’s: the change engine for check-ins, goals, plans, bulk changes and spreadsheets, so it raises [the same issues](import-issues.md) and asks the same questions. `dry_run: true` shows what would change and saves nothing; `confirm: true` goes ahead past a question once the person has said so; `answers` answers the engine’s questions. Every change is logged as the token’s person, marked via MCP, and can be undone as the app’s can.',
    `- **A refusal** comes back as a tool error (\`isError\`) with words to show; nothing is saved. A refusal by a rule ends with who the token acts as: ${quote('This token acts as …, who is an admin.')} or ${quote('… who isn’t an admin.')} Every tool can also say: ${ERRORS_EVERY_TOOL.map(quote).join('; ')}. Its own refusals are listed under each tool, and the refusals of the actions it does the same as are on [the actions](actions.md).`,
    '- **The hints** (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) are MCP annotations: shown below as reads, changes, or changes and removes something.',
    '',
    table(['Tool', 'Title', 'Kind', 'Actions it does the same as'], tools.map((t) => [
      `[${code(t.name)}](#${anchor(t.name)})${moduleOf(t.name) ? ` (${moduleOf(t.name)})` : ''}`,
      cell(t.title), kind(t),
      (facts.get(t.name)!.actions.map((a) => `[${a}](actions.md#${anchor(a)})`).join(', ')) || '—',
    ])),
    ''];
  for (const t of tools) {
    const f = facts.get(t.name)!;
    const a = t.annotations;
    out.push(`## ${t.name}`, '', `**${t.title}.** ${t.description}`, '');
    if (moduleOf(t.name)) out.push(`From the [${moduleOf(t.name)}](../modules/${moduleOf(t.name)}/README.md) module: switched off with it.`, '');
    out.push(`**Kind:** ${kind(t)}. Hints: ${[`readOnlyHint ${a.readOnlyHint}`, a.destructiveHint !== undefined ? `destructiveHint ${a.destructiveHint}` : '', a.idempotentHint !== undefined ? `idempotentHint ${a.idempotentHint}` : '', `openWorldHint ${a.openWorldHint}`].filter(Boolean).join(', ')}.`, '');
    const rows = schemaRows(t.inputSchema.properties, t.inputSchema.required ?? []);
    out.push('**Input:**', '', rows.length ? table(['Argument', 'Type', 'Needed', 'What it is'], rows) : 'No arguments.', '');
    out.push('<details><summary>The input schema, as JSON</summary>', '', '```json', JSON.stringify(t.inputSchema, null, 2), '```', '', '</details>', '');
    out.push(f.data.length ? `**Gives back:** the text, and \`data\`${f.data.length > 1 ? ', one of' : ''}:\n\n${f.data.map((d) => `\`\`\`ts\n${d}\n\`\`\``).join('\n\n')}\n\n${recordLinks(records, f.data.join(' '))}`.trimEnd() : '**Gives back:** the text only.', '');
    out.push(f.refuses.length ? `**Refuses with:**\n\n${f.refuses.map((s) => `- ${quote(s)}`).join('\n')}` : '**Refuses with:** nothing of its own beyond the shared refusals above.', '');
    out.push(`**Does the same as:** ${f.actions.length ? `${f.actions.map((x) => `[${x}](actions.md#${anchor(x)})`).join(', ')}, so it refuses with their words too` : 'no action: it reads, or does something only an assistant needs'}.`, '');
  }
  return out.join('\n');
}
