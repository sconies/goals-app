/* Every sentence the change engine can say (rebuild drill, stage 2, gap 2), read from the engine's own source, so the
   spec's table of them can't say anything the code doesn't.

   The engine (src/domain/changeset.ts) raises each problem, question and note with `raise`, `ask` or `note`: a kind, a
   sheet, and the sentence. Most sentences are written right there, as text with values put in; the rest come from the
   rules the engine shares (the goal form's checks, the check-in rule, the removal rules, the people rules), and are read
   from those files the same way. This reads each call with the TypeScript parser, follows a sentence made elsewhere to
   where it is written (a constant, a helper's return, a parameter's default and the arguments its callers pass, a
   property of an object a helper returns), and writes each value put in as a {placeholder}. A sentence made somewhere this
   can't follow is an error, so a new one can't go missing from the table: name where it is made in FOLLOW below.

   Node only: it reads files. Used by src/spec/build.ts. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { levelOf, type IssueKind, type IssueLevel } from '../domain/problemLevels';
import { MUST_KIND, ENGINE_CHECK, FIELD_COLUMN } from '../domain/changeset';

export interface EngineSentence {
  kind: IssueKind;
  level: IssueLevel;
  /** The sheet it is raised on (a {placeholder} when the sheet is passed in). */
  sheet: string;
  /** The column its group is known by (its id's third part), as written in the code: empty for none. */
  column: string;
  /** What its group's id takes as the value found (its fourth part), as written: empty for none. */
  found: string;
  /** The sentence, with {placeholders} for the values put in; [ ] around words said only sometimes; {a / b} for one or the other. */
  words: string;
  /** Where it is said: file and line. */
  at: string;
}

const ENGINE = 'src/domain/changeset.ts';

/* ---------- reading files ---------- */

const files = new Map<string, ts.SourceFile>();
let rootDir = '';
function source(file: string): ts.SourceFile {
  let sf = files.get(file);
  if (!sf) {
    sf = ts.createSourceFile(file, fs.readFileSync(path.join(rootDir, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    files.set(file, sf);
  }
  return sf;
}
const lineOf = (n: ts.Node) => n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1;
const fileOf = (n: ts.Node) => n.getSourceFile().fileName;
const textOf = (n: ts.Node) => n.getText().replace(/\s+/g, ' ');

/** Every node under `n`, depth first. */
function walk(n: ts.Node, visit: (x: ts.Node) => void) { visit(n); n.forEachChild((c) => walk(c, visit)); }

/* ---------- placeholders ---------- */

/**
 * The placeholder for a value put into a sentence, by the code that puts it in. A value not named here is called by its
 * last word ("g.title" is {title}); one that would read badly that way is named here.
 */
const NAMES: Record<string, string> = {
  v: 'cell', raw: 'cell', 'raw.trim()': 'cell', found: 'cell', x: 'stage as written', part: 'stage as written', byRaw: 'cell', valueRaw: 'cell', 'draft.value': 'cell',
  w: 'week', week: 'this week', end: 'due week', 'read.n': 'week', 'outside[0]': 'week', 'from + 1': 'first week', 'byId.week': 'its week',
  'cycle.name': 'year', 'cycle.weeks': 'weeks in the year', 'cycle.startDate': 'first day of the year',
  prefix: '=[Week {week}: ]', sheet: 'sheet', header: 'header', as: 'column', head: 'column', oldHead: 'other column', h: 'column', k: 'key', 'w.what': 'column',
  e: 'email', email: 'email', id: 'ID', cid: 'ID', idRef: 'ID', refText: 'ID', keyRef: 'key', 'normalKey(keyRef)': 'key', 'normalKey(keyRef) ?? keyRef': 'key',
  name: 'name', title: 'name in the row', 'd.title': 'goal', 'g.title': 'goal', 'goal.title': 'goal', 'existing.title': 'goal', 'existing!.title': 'goal', 'same.title': 'goal here', 'hit.title': 'goal here', 'twin.title': 'goal here', 'after.title': 'goal',
  'nearOne.name': 'name here', 'hit.name': 'name here', 'hit.email': 'email here', 'm.near': 'word', 'twin.name': 'person here', 'before.name': 'person', 'p.name': 'person', 'after.name': 'person', 'l.person.name': 'person',
  'm[1]': 'stage as written', 'list.length': 'how many', 'list[0]!.name': 'name',
  'people.get(g.ownerId)?.name ?? \'its owner\'': 'owner', 'people.get(owned.ownerId)?.name ?? \'its owner\'': 'owner', 'people.get(d.ownerId)?.name ?? \'someone else\'': 'owner', 'people.get(existing!.ownerId)?.name ?? \'Its owner\'': 'owner', 'owner?.name ?? \'someone\'': 'owner', 'people.get(existing.authorId)?.name ?? \'someone\'': 'whose it was',
  'byEmail(email)!.name': 'person here',
  'GOAL_ACTION_WORDS.word[action]': 'action', 'GOAL_ACTION_WORDS.word[removing.how]': 'action', 'GOAL_ACTION_WORDS.word[removing.how].toLowerCase()': 'action',
  'TYPE_WORDS.word[d.kind]': 'type', 'oneOf(Object.values(TYPE_WORDS.word))': 'metric, range or milestone', LEFT: 'Left',
  'plural(newAdminRows.length, \'person\', \'people\')': 'n people', 'plural(replacing.length, \'row\')': 'n rows', 'plural(past.length, \'stage\')': 'n stages',
  'past.map((st) => `${st.name}@${st.dueWeek}`).join(\', \')': 'stages as Name@week', 'headers.map((h) => `“${h}”`).join(\' and \')': '“header” and “header”',
  'fix.map((f) => f.text).join(\' \')': 'what it lacks, in the goal form’s words', 'e.codes.map((c) => hint[c]).join(\'; \')': 'what it lacks, joined by “; ”',
  'parseNumber(raw)': 'number read', 'parseNumber(draft.value)': 'number read', 'teams.get(owner.teamId)!.name': 'team',
  '[k, teams.get(same.teamId)?.name].filter(Boolean).join(\', \')': 'key, team', 'hit.key ?? hit.id': 'key',
  'at.join(\' and \')': 'rows', 'val(r, \'ref\')': 'ref', 'val(r, \'state\')': 'cell', 'val(r, \'goal\')': 'goal as written', 'val(r, \'admin\')': 'cell', 'val(r, \'goal key\')': 'key',
  'filled.map((k) => cols[k]).join(\', and \')': 'columns filled in', 'said[0]![1]': 'week', 'said[1]![1]': 'other week',
  'said.slice(0, -1).join(\', \')': 'column', 'said[said.length - 1]': 'other column', 'c === \'feeds into key\' ? \'Feeds into key\' : \'Feeds into ID\'': 'Feeds into key | Feeds into ID',
  row: 'row', 'x.name': 'name', 'x.list': 'rows', ago: 'weeks ago', 'cycle.weeks)': 'weeks in the year',
  'lower({ label: STOPPED })': 'stopped', 'FLAG.greener': 'greener', 'lower(FLAG.greener)': 'greener',
  'ADMIN_DOOR_LIMIT(via)': 'what that door is for', limit: 'what that door is for', marks: 'who may say they are done',
  'normalEmail(v)': 'email', 'tell': 'their email or team',
  '[...new Set(sorted.map((x) => header(x.k)))].join(\' and \')': 'Owner and Owner email', 'sorted.map((x) => x.p!.name).join(\' and \')': 'name and name',
  'list.map((p) => p.email || p.id).join(\' or \')': 'email or email', where: 'their team or job title', '[twin.key, teamName(twin.teamId)].filter(Boolean).join(\', \')': 'key, team',
  'Math.min(3, has)': 'places typed', u: 'unit', 'goal.plan.start': 'start', 'goal.plan.target': 'target', n: 'cell', last: 'last number',
  'new Date(start + (7 * (cycle.weeks + 1) - 1) * 86_400_000).toISOString().slice(0, 10)': 'last day of the year', 'cycleYear(c) + 1': 'next year',
  'goalEntry.ts:k': 'how many', 'said(neg[2])': 'number', 'said(t)': 'target', 'said(s)': 'start', 'said(big[2])': 'number', 'over[1]': 'start or target', 'over[2]': 'number',
  'said(limit)': 'limit', 'said(margin)': 'margin', 'Math.round(late.share * 100)': 'share', 'goalEntry.ts:n': 'weeks in the plan', 'said(Number(now.toFixed(decimalsFor(d) ?? 0)))': 'number',
  'describe(result).toLowerCase()': 'what it counts', 'removal.ts:week': 'week', 'removal.ts:on': 'day, as 12 Nov', 'removal.ts:who': 'who',
  'changeset.ts:what': 'Owner / Takes over', 'changeset.ts:what[0]': 'what changed', 'changeset.ts:what[what.length - 1]': 'what changed', "changeset.ts:what.slice(0, -1).join(', ')": 'what changed', 'list(diffs)': 'fields', 'after.week': 'week', 'lower({ label: LEFT })': 'marked as left', headline: 'number · status call', 'changeset.ts:from': 'old number', 'changeset.ts:to': 'new number',
  'GOAL_ACTION_WORDS.word[action].toLowerCase()': 'action', 'q.code': 'direction / far', 'ctx.cycleWeeks': 'weeks in the year', 'datesOf(c, end)': 'its dates', 'datesOf(c, from)': 'its dates', 'datesOf(c, to)': 'its dates',
  'd.decimals.trim()': 'cell', 'seen.get(fold(name).replace(/\\s+/g, \' \'))': 'name', 'hi': 'upper number', lo: 'lower number', 'keyRef || idRef': 'key or ID', "byId.key ?? 'none'": 'its key',
  't.length': 'its length', 'n(far[1])': 'number', 'n(now.start)': 'new start', 'n(now.target)': 'new target', 'n(was.start)': 'old start', 'n(was.target)': 'old target', 'ctx.owner.name': 'owner',
  'oddKind(soft.text)': 'over 100% / far outside the plan / past the target / far from the last number', 'parts.slice(0, -1).join(\', \')': 'what it does', 'RULES.readingMaxDays': 'days', 'first.row': 'row', s: 'start', 't.sheet': 'sheet', 'r.source': 'source', 'thing': 'goal / person / team…',
  "ctx.parent?.title ?? 'that goal'": 'goal it feeds', 'u(n)': 'unit', 'd.unit.trim()': 'unit', "val(r, 'goal ref')": 'ref',
  "((span.bad === 'fromWeek' ? d.fromWeek : d.endWeek) ?? '').trim()": 'cell', "FIELD_COLUMN[f.field] ?? 'Goal'": 'column', 'NUMBER_WORDS[MIN_NAME] ?? MIN_NAME': 'two', 'at[0]': 'row', "column + ' ID'": 'column ID',
  'far[0]': 'start or target', 'm[1]!': 'cell', "name || 'This stage'": 'stage', 'own - 1': 'previous year', 'parts[0]': 'what it does', 'r.value': 'their number', 'said[0]!': 'column', 'year + 1': 'next year', 'last.week': 'week',
  'weekCode(c, Math.max(now, 1))': 'this week as 2026-W45', 'weekCode(cycle, Math.max(week, 1))': 'this week as 2026-W45', "weekSays(c, end, 'short')": 'week', "weekSays(c, from, 'short')": 'week', "weekSays(c, to, 'short')": 'week',
  "weeks.join(', ')": 'weeks', 'BOUND_WORDS.what': 'Must stay', what: 'what they do', 'x.ref': 'row', 'parts.at(-1)': 'what else it does',
};
/** The values named by their last word, by their code: for checking the names read well. */
export const FALLBACK = new Map<string, string>();
/** A value's placeholder, from the code that puts it in. */
function placeholder(e: ts.Expression): string {
  const t = textOf(e);
  const named = NAMES[`${path.posix.basename(fileOf(e))}:${t}`] ?? NAMES[t];
  if (named) return named.startsWith('=') ? named.slice(1) : `{${named}}`;
  if (ts.isNumericLiteral(e)) return e.text;
  // A number the code keeps as a constant: its value.
  if (ts.isIdentifier(e)) { const d = declarationOf(e.text, e); if (d && ts.isVariableDeclaration(d) && d.initializer && ts.isNumericLiteral(d.initializer)) return d.initializer.text; }
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    const [a, b, c] = e.arguments;
    const f = e.expression.text;
    if (f === 'plural' && b) return `{n ${literal(c) ?? (literal(b) ?? 'thing') + 's'}}`;
    if (['fixed', 'fmt', 'groupDigits', 'withUnit', 'String'].includes(f) && a) return placeholder(a);
    if (f === 'placesText') return '{n decimal places}';
    if (f === 'oneOf') return '{its words, as “a, b or c”}';
  }
  // The last name in it, spaced, after any tidying a value gets (trim, join, slice…): g.plan.targetText → target text.
  let base = t.replace(/\s*\?\?.*$/, '').replace(/[!?]/g, '');
  for (let k = 0; k < 6; k++) base = base.replace(/\.(trim|join|toLowerCase|toUpperCase|slice|toISOString|map|filter|at|toFixed|replace)\((?:[^()]|\([^()]*\))*\)\s*$/, '');
  const m = /([A-Za-z_][A-Za-z0-9_]*)\s*(?:\((?:[^()]|\([^()]*\))*\))?\s*$/.exec(base);
  const word = (m?.[1] ?? 'value').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  FALLBACK.set(t, word);
  return `{${word}}`;
}

/* ---------- following a sentence to where it is written ---------- */

type Ctx = { depth: number; seen: Set<ts.Node> };

/** A declaration of `name` visible from `at`: a local, a parameter, a function, or an import followed to its file. */
function declarationOf(name: string, at: ts.Node): ts.Node | undefined {
  for (let n: ts.Node | undefined = at; n; n = n.parent) {
    if (ts.isFunctionLike(n)) for (const p of n.parameters) if (ts.isIdentifier(p.name) && p.name.text === name) return p;
    if (ts.isFunctionLike(n)) for (const p of n.parameters) if (ts.isObjectBindingPattern(p.name)) for (const el of p.name.elements) if (ts.isIdentifier(el.name) && el.name.text === name) return el;
    if (ts.isForOfStatement(n) && ts.isVariableDeclarationList(n.initializer)) for (const d of n.initializer.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) return d;
    const statements = ts.isBlock(n) || ts.isSourceFile(n) || ts.isModuleBlock(n) || ts.isCaseClause(n) ? n.statements : undefined;
    if (!statements) continue;
    for (const s of statements) {
      if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) return d;
      if (ts.isFunctionDeclaration(s) && s.name?.text === name) return s;
      if (ts.isImportDeclaration(s) && s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings)) {
        const spec = s.importClause.namedBindings.elements.find((x) => x.name.text === name);
        if (spec && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text.startsWith('.')) {
          const from = path.posix.normalize(path.posix.join(path.posix.dirname(fileOf(s)), s.moduleSpecifier.text)) + '.ts';
          if (fs.existsSync(path.join(rootDir, from))) return declarationOf((spec.propertyName ?? spec.name).text, source(from));
        }
      }
    }
  }
  return undefined;
}

/** A function's body, as the expressions it returns (a returned null or undefined says nothing). */
function returnsOf(fn: ts.Node): ts.Expression[] {
  if (ts.isVariableDeclaration(fn) && fn.initializer) return returnsOf(fn.initializer);
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body];
  if (!ts.isFunctionLike(fn) || !('body' in fn) || !fn.body) return [];
  const out: ts.Expression[] = [];
  const visit = (n: ts.Node) => {
    if (n !== fn && ts.isFunctionLike(n)) return;
    if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
    n.forEachChild(visit);
  };
  visit(fn.body as ts.Node);
  return out.filter((e) => e.kind !== ts.SyntaxKind.NullKeyword && !(ts.isIdentifier(e) && e.text === 'undefined'));
}

/** The calls to a function in its own file, with `name` as their callee. */
function callsTo(name: string, file: string): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  walk(source(file), (n) => { if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name) out.push(n); });
  return out;
}
const functionName = (fn: ts.Node): string | undefined =>
  ts.isFunctionDeclaration(fn) ? fn.name?.text : ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name) ? fn.parent.name.text : undefined;

/** A value in a sentence: its words when it is words (a literal, a choice between words), else its {placeholder}. */
function inline(e: ts.Expression): string {
  if (ts.isParenthesizedExpression(e)) return inline(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((s) => inline(s.expression) + s.literal.text).join('');
  if (ts.isConditionalExpression(e)) {
    const a = inline(e.whenTrue), b = inline(e.whenFalse);
    if (!b) return a ? `[${a}]` : '';
    if (!a) return `[${b}]`;
    return a === b ? a : `{${unbrace(a)} / ${unbrace(b)}}`;
  }
  // Words joined with +: both; a sum of numbers is one value.
  const words = (x: ts.Expression): boolean => ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) || ts.isTemplateExpression(x) || (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken && (words(x.left) || words(x.right)));
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken && words(e)) return inline(e.left) + inline(e.right);
  return placeholder(e);
}
const unbrace = (s: string) => (/^\{[^{}]*\}$/.test(s) ? s.slice(1, -1) : s);

/** Every sentence an expression can be, followed to where each is written. Throws on one it can't follow. */
function sentences(e: ts.Expression, ctx: Ctx): string[] {
  if (ctx.depth > 6 || ctx.seen.has(e)) return [];
  const next: Ctx = { depth: ctx.depth + 1, seen: new Set([...ctx.seen, e]) };
  if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) return sentences(e.expression, next);
  if ((ts.isIdentifier(e) && e.text === 'undefined') || e.kind === ts.SyntaxKind.NullKeyword) return [];
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [inline(e)];
  // A sentence that takes in another (“Week 4: ” and a number's problem): each of the other's sentences in its place.
  if (ts.isTemplateExpression(e)) {
    let out = [e.head.text];
    for (const span of e.templateSpans) {
      const parts = TAKES_IN.test(textOf(span.expression)) ? sentences(span.expression, next) : [inline(span.expression)];
      out = out.flatMap((a) => parts.map((b) => a + b + span.literal.text));
    }
    return out;
  }
  if (ts.isConditionalExpression(e)) return [...sentences(e.whenTrue, next), ...sentences(e.whenFalse, next)];
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(e.operatorToken.kind)) return [...sentences(e.left, next), ...sentences(e.right, next)];
  // a + b: each of a's sentences with each of b's; a value that isn't words is its placeholder.
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const part = (x: ts.Expression) => (ts.isIdentifier(x) || ts.isStringLiteral(x) || ts.isTemplateExpression(x) ? [inline(x)] : sentences(x, next));
    return part(e.left).flatMap((a) => part(e.right).map((b) => a + b));
  }
  // X['key'] and X.key, where X is an object of words: that property's.
  if (ts.isElementAccessExpression(e) && ts.isIdentifier(e.expression) && ts.isStringLiteral(e.argumentExpression)) {
    const d = declarationOf(e.expression.text, e);
    if (d && ts.isVariableDeclaration(d) && d.initializer) return propertyOf(d.initializer, e.argumentExpression.text, next);
  }
  // x[1], where x is a parameter its callers pass a list for ([id, words]): that item of each list passed.
  if (ts.isElementAccessExpression(e) && ts.isIdentifier(e.expression) && ts.isNumericLiteral(e.argumentExpression)) {
    const d = declarationOf(e.expression.text, e);
    const i = Number(e.argumentExpression.text);
    if (d && ts.isParameter(d)) return passedTo(d).flatMap((a) => (ts.isArrayLiteralExpression(a) && a.elements[i] ? sentences(a.elements[i]!, next) : []));
  }
  const followed = FOLLOW[textOf(e)];
  if (followed) return followed(next);
  // x.replace(…): the words of x (a replacement only adds a tail or changes a phrase).
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'replace') return sentences(e.expression.expression, next);
  if (ts.isIdentifier(e)) return wordsOfDeclaration(declarationOf(e.text, e), e, next);
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    const d = declarationOf(e.expression.text, e);
    // say(…), where say is a parameter: what each function its callers pass returns.
    if (d && ts.isParameter(d)) return passedTo(d).flatMap((a) => (ts.isArrowFunction(a) || ts.isFunctionExpression(a) ? returnsOf(a) : [])).flatMap((r) => sentences(r, next));
    if (d) return returnsOf(d).flatMap((r) => sentences(r, next));
  }
  // x.prop, where x is what a helper returns: that property of each object it returns.
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
    const d = declarationOf(e.expression.text, e);
    const init = d && ts.isVariableDeclaration(d) ? d.initializer : undefined;
    if (init) return propertyOf(init, e.name.text, next);
  }
  if (ts.isPropertyAccessExpression(e) && ts.isCallExpression(e.expression)) {
    const got = propertyOf(e.expression, e.name.text, next);
    if (got.length) return got;
  }
  throw new Error(`${fileOf(e)}:${lineOf(e)}: can’t follow the sentence “${textOf(e)}” to where it is written. Name where it is made in FOLLOW (src/spec/engineWords.ts).`);
}

/** What a function's callers pass for one of its parameters. */
function passedTo(d: ts.ParameterDeclaration): ts.Expression[] {
  const fn = d.parent;
  const i = fn.parameters.indexOf(d);
  const name = functionName(fn);
  return name ? callsTo(name, fileOf(fn)).map((c) => c.arguments[i]).filter((a): a is ts.Expression => !!a && !(ts.isIdentifier(a) && a.text === 'undefined')) : [];
}

/** The words a declaration holds: a constant's, a parameter's default and what its callers pass. */
function wordsOfDeclaration(d: ts.Node | undefined, at: ts.Node, ctx: Ctx): string[] {
  if (!d) throw new Error(`${fileOf(at)}:${lineOf(at)}: no declaration of “${textOf(at)}”.`);
  if (ts.isVariableDeclaration(d) && d.initializer) return sentences(d.initializer, ctx);
  // let msg; … msg = …: every value it is given.
  if (ts.isVariableDeclaration(d) && ts.isVariableDeclarationList(d.parent) && !ts.isForOfStatement(d.parent.parent)) {
    const name = d.name.getText();
    const out: string[] = [];
    walk(d.parent.parent.parent, (n) => { if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left) && n.left.text === name) out.push(...sentences(n.right, ctx)); });
    return out;
  }
  // for (const problem of personProblems(…)): every sentence the helper pushes onto the list it returns.
  if (ts.isVariableDeclaration(d) && ts.isForOfStatement(d.parent.parent) && ts.isCallExpression(d.parent.parent.expression) && ts.isIdentifier(d.parent.parent.expression.expression)) {
    const fn = declarationOf(d.parent.parent.expression.expression.text, d);
    const out: string[] = [];
    if (fn) walk(fn, (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'push' && n.arguments[0]) out.push(...sentences(n.arguments[0], ctx)); });
    return out;
  }
  if (ts.isParameter(d)) {
    const fn = d.parent;
    const i = fn.parameters.indexOf(d);
    const name = functionName(fn);
    const passed = name ? callsTo(name, fileOf(fn)).map((c) => c.arguments[i]).filter((a): a is ts.Expression => !!a && !(ts.isIdentifier(a) && a.text === 'undefined')) : [];
    return [...(d.initializer ? sentences(d.initializer, ctx) : []), ...passed.flatMap((a) => (ts.isArrowFunction(a) ? returnsOf(a) : [a])).flatMap((a) => sentences(a, ctx))];
  }
  throw new Error(`${fileOf(at)}:${lineOf(at)}: can’t read the words of “${textOf(at)}”.`);
}

/** A property of what an expression gives: an object literal's, or each object a called helper returns. */
function propertyOf(e: ts.Expression, prop: string, ctx: Ctx): string[] {
  if (ts.isObjectLiteralExpression(e)) {
    const p = e.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText().replace(/^['"]|['"]$/g, '') === prop);
    return p && ts.isPropertyAssignment(p) ? sentences(p.initializer, ctx) : [];
  }
  if (ts.isConditionalExpression(e)) return [...propertyOf(e.whenTrue, prop, ctx), ...propertyOf(e.whenFalse, prop, ctx)];
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return propertyOf(e.left, prop, ctx);
  if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) return propertyOf(e.expression, prop, ctx);
  if (ts.isCallExpression(e)) {
    const callee = ts.isIdentifier(e.expression) ? e.expression : ts.isPropertyAccessExpression(e.expression) && ['find'].includes(e.expression.name.text) ? null : null;
    if (callee) { const d = declarationOf(callee.text, e); if (d) return returnsOf(d).flatMap((r) => propertyOf(r, prop, ctx)); }
  }
  if (ts.isIdentifier(e)) { const d = declarationOf(e.text, e); if (d && ts.isVariableDeclaration(d) && d.initializer) return propertyOf(d.initializer, prop, ctx); }
  return [];
}

/* ---------- sentences made beyond a simple reach ---------- */

/** Every `text` (or other property) of the objects pushed through a helper in a file: `add(field, id, text)` and the like. */
function argsOf(file: string, fn: string, call: string, arg: number, kindOf?: (c: ts.CallExpression) => IssueKind | undefined): { kind?: IssueKind; field?: string; words: string[] }[] {
  const scope = declarationOf(fn, source(file));
  if (!scope) throw new Error(`No ${fn} in ${file}.`);
  const out: { kind?: IssueKind; field?: string; words: string[] }[] = [];
  walk(scope, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== call || !n.arguments[arg]) return;
    const a = n.arguments[arg]!;
    const words = ts.isObjectLiteralExpression(a) ? propertyOf(a, 'question', { depth: 0, seen: new Set() }) : sentences(a, { depth: 0, seen: new Set() });
    const f = ts.isObjectLiteralExpression(a) ? a.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText() === 'field') : undefined;
    out.push({ kind: kindOf?.(n), field: f && ts.isPropertyAssignment(f) ? literal(f.initializer) : undefined, words });
  });
  return out;
}
const literal = (e: ts.Expression | undefined) => (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : undefined);
const idOf = (c: ts.CallExpression) => { const o = c.arguments[0]; if (o && ts.isObjectLiteralExpression(o)) { const p = o.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText() === 'id'); return p && ts.isPropertyAssignment(p) ? literal(p.initializer) : undefined; } return undefined; };

/** A value put into a sentence that is itself a sentence made elsewhere: followed, not named. */
const TAKES_IN = /^(\w+(\[0\]!?)?\.(problem|question|text)|typedValue|precise|notNumberText\(.*\)|open\[0\]!\.question)$/;

/** Where a sentence the engine passes on is made, by the code that passes it. Each gives its sentences' words. */
const FOLLOW: Record<string, (ctx: Ctx) => string[]> = {
  // The goal form's Must fix (goalMustFix and proposedMustFix: add(field, id, text)); their kinds are MUST_KIND's.
  'f.text': () => mustFixes().map((x) => x.words),
  // A goal form's question (goalChecks: ask({ id, question })).
  'c.question': () => goalQuestions().map((x) => x.words),
  'q.question': () => goalQuestions().filter((x) => x.id === 'feeds-lower').map((x) => x.words),
  // The removal rules' refusals (src/domain/removal.ts: throw new NotAllowed(sentence)).
  'e.message': () => thrown('src/domain/removal.ts', ['stopGoal', 'deleteGoal']),
  'e.message.replace(/choose who takes (them|it) over/, \'say who takes them over in Takes over\')': () => thrown('src/domain/removal.ts', ['markPersonLeft']).map((m) => m.replace(/choose who takes (them|it) over/, 'say who takes them over in Takes over')),
  // A screen's check-in questions left unanswered (src/domain/checkin.ts checkInLevels).
  'open[0]!.question': () => checkInQuestions(),
  'soft.text': () => valueWords(false),
  typedValue: () => valueWords(true),
};

/**
 * The goal form's Must fix, each with its id: `add(field, id, text)` in goalMustFix and proposedMustFix. An id and its
 * words that come in a pair (a list passed for a parameter, `[id, words]`; an object a helper returns, `{ id, text }`)
 * are read as pairs.
 */
function mustFixes(): { id?: string; field?: string; words: string }[] {
  const out: { id?: string; field?: string; words: string }[] = [];
  const ctx = (): Ctx => ({ depth: 0, seen: new Set() });
  for (const fn of ['goalMustFix', 'proposedMustFix']) {
    const scope = declarationOf(fn, source('src/domain/goalEntry.ts'));
    if (!scope) throw new Error(`No ${fn} in src/domain/goalEntry.ts.`);
    walk(scope, (n) => {
      if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== 'add' || n.arguments.length < 3) return;
      const id = n.arguments[1]!, text = n.arguments[2]!;
      // add(field, empty[0], empty[1]): each [id, words] its callers pass.
      if (ts.isElementAccessExpression(id) && ts.isElementAccessExpression(text) && ts.isIdentifier(id.expression)) {
        const d = declarationOf(id.expression.text, id);
        const fn = d && ts.isParameter(d) ? d.parent : undefined;
        const name = fn && functionName(fn);
        const i = fn && d && ts.isParameter(d) ? fn.parameters.indexOf(d) : -1;
        if (name) for (const c of callsTo(name, fileOf(fn!))) { const a = c.arguments[i]; if (a && ts.isArrayLiteralExpression(a)) for (const w of sentences(a.elements[1]!, ctx())) out.push({ id: literal(a.elements[0]), field: literal(c.arguments[0]), words: w }); }
        return;
      }
      // add(field, p.id, p.text): each { id, text } the helper returns.
      if (ts.isPropertyAccessExpression(id) && ts.isPropertyAccessExpression(text) && ts.isIdentifier(id.expression)) {
        const d = declarationOf(id.expression.text, id);
        const init = d && ts.isVariableDeclaration(d) ? d.initializer : undefined;
        const call = init && ts.isCallExpression(init) && ts.isIdentifier(init.expression) ? declarationOf(init.expression.text, init) : undefined;
        for (const r of call ? returnsOf(call) : []) {
          const objs = ts.isObjectLiteralExpression(r) ? [r] : ts.isConditionalExpression(r) ? [r.whenTrue, r.whenFalse].filter(ts.isObjectLiteralExpression) : [];
          for (const o of objs) {
            const prop = (k: string) => { const x = o.properties.find((y) => ts.isPropertyAssignment(y) && y.name.getText() === k); return x && ts.isPropertyAssignment(x) ? x.initializer : undefined; };
            const pid = prop('id'), ptext = prop('text');
            if (ptext) for (const w of sentences(ptext, ctx())) out.push({ id: literal(pid), words: w });
          }
        }
        return;
      }
      const ids = ts.isConditionalExpression(id) ? [literal(id.whenTrue), literal(id.whenFalse)] : [literal(id)];
      for (const w of sentences(text, ctx())) out.push({ id: ids.find(Boolean), field: literal(n.arguments[0]), words: w });
    });
  }
  return out;
}
function goalQuestions(): { id?: string; field?: string; words: string }[] {
  const out: { id?: string; field?: string; words: string }[] = [];
  for (const x of argsOf('src/domain/goalEntry.ts', 'checksOf', 'ask', 0, (c) => idOf(c) as IssueKind | undefined)) for (const w of x.words) out.push({ id: x.kind, field: x.field, words: w });
  return out;
}
/** The refusals the named functions of a file throw (`no(sentence)`, `new NotAllowed(sentence)`), and the file's own helpers they call. */
function thrown(file: string, fns: string[]): string[] {
  const out: string[] = [];
  const done = new Set<string>();
  const visit = (name: string) => {
    if (done.has(name)) return;
    done.add(name);
    const fn = declarationOf(name, source(file));
    if (!fn || fileOf(fn) !== file) return;
    walk(fn, (n) => {
      if ((ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'NotAllowed') || (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'no')) {
        if (n.arguments?.[0]) out.push(...sentences(n.arguments[0], { depth: 0, seen: new Set() }));
      } else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) visit(n.expression.text);
    });
  };
  for (const f of fns) visit(f);
  return [...new Set(out)];
}
function checkInQuestions(): string[] {
  const out: string[] = [];
  walk(source('src/domain/checkin.ts'), (n) => {
    if (ts.isPropertyAssignment(n) && n.name.getText() === 'question') out.push(...sentences(n.initializer, { depth: 0, seen: new Set() }));
  });
  return [...new Set(out)];
}
/** A number's problems (src/domain/checkin.ts valueProblem), those that block or those that only ask; not the empty cell's, said apart. */
function valueWords(block: boolean): string[] {
  const d = declarationOf('valueProblem', source('src/domain/checkin.ts'));
  if (!d) throw new Error('No valueProblem in src/domain/checkin.ts.');
  const out: string[] = [];
  const take = (o: ts.Expression) => {
    if (ts.isConditionalExpression(o)) { take(o.whenTrue); take(o.whenFalse); return; }
    if (!ts.isObjectLiteralExpression(o)) return;
    const b = o.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'block');
    if (b && ts.isPropertyAssignment(b) && (b.initializer.kind === ts.SyntaxKind.TrueKeyword) === block) out.push(...propertyOf(o, 'text', { depth: 0, seen: new Set() }));
  };
  for (const r of returnsOf(d)) {
    const guard = r.parent && ts.isIfStatement(r.parent.parent) ? r.parent.parent.expression.getText() : '';
    if (!/^!raw\.trim\(\)$/.test(guard)) take(r);
  }
  return [...new Set(out)];
}

/* ---------- the calls ---------- */

/** The kinds an expression can be: a word, a choice between words, a regular expression's test of the sentence. */
function kindsOf(e: ts.Expression, words: string, call: ts.CallExpression): IssueKind[] {
  if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) return kindsOf(e.expression, words, call);
  const lit = literal(e);
  if (lit) return [lit as IssueKind];
  if (ts.isConditionalExpression(e)) {
    // /look like an email/.test(problem) ? … : …: decided by the sentence itself.
    const said = decided(e.condition, words);
    if (said != null) return kindsOf(said ? e.whenTrue : e.whenFalse, words, call);
    const all = [...kindsOf(e.whenTrue, words, call), ...kindsOf(e.whenFalse, words, call)];
    // A number's problem, whose kind the code takes from the check's code beside it: told apart by its words.
    const hinted = all.filter((k) => BY_WORDS[k]?.test(words));
    return all.length > 1 && hinted.length ? [hinted[0]!] : all;
  }
  if (ts.isIdentifier(e)) {
    const d = declarationOf(e.text, e);
    if (d && ts.isVariableDeclaration(d) && d.initializer) return kindsOf(d.initializer, words, call);
  }
  // MUST_KIND[fix[0]!.id]: the kind of the goal form's first Must fix.
  if (ts.isElementAccessExpression(e) && e.expression.getText() === 'MUST_KIND') return [FIRST_MUST];
  return [];
}

/** The kind of a sentence that takes the kind of the goal form's first Must fix it names. */
export const FIRST_MUST = '{its first Must fix’s kind}' as IssueKind;
const levelFor = (k: IssueKind): IssueLevel => (k === FIRST_MUST ? 'must' : levelOf(k));

/** A condition on the sentence's own words (`/admin/.test(problem)`, with !, && and ||), decided; undefined when it isn't one. */
function decided(c: ts.Expression, words: string): boolean | undefined {
  if (ts.isParenthesizedExpression(c)) return decided(c.expression, words);
  if (ts.isPrefixUnaryExpression(c) && c.operator === ts.SyntaxKind.ExclamationToken) { const x = decided(c.operand, words); return x == null ? undefined : !x; }
  if (ts.isBinaryExpression(c) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(c.operatorToken.kind)) {
    const a = decided(c.left, words), b = decided(c.right, words);
    if (a == null || b == null) return undefined;
    return c.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? a && b : a || b;
  }
  if (ts.isCallExpression(c) && ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === 'test' && ts.isRegularExpressionLiteral(c.expression.expression)) {
    const src = c.expression.expression.text;
    return new RegExp(src.slice(1, src.lastIndexOf('/')), src.slice(src.lastIndexOf('/') + 1)).test(words);
  }
  return undefined;
}

/** Kinds told apart by their words, where the code chooses between them by something beside the sentence. */
const BY_WORDS: Partial<Record<IssueKind, RegExp>> = { precision: /decimal place/, 'not-a-number': /isn’t a number|words in it/, 'impossible-number': /./ };

/** A property of the call's last argument (`{ column, found }`), as written. */
function extra(call: ts.CallExpression, at: number, prop: string, words = ''): string {
  const x = call.arguments[at];
  if (!x || !ts.isObjectLiteralExpression(x)) return '';
  const p = x.properties.find((y) => (ts.isPropertyAssignment(y) || ts.isShorthandPropertyAssignment(y)) && y.name.getText() === prop);
  if (!p || !ts.isPropertyAssignment(p)) return p && ts.isShorthandPropertyAssignment(p) ? placeholder(p.name) : '';
  let v = p.initializer;
  for (let said = ts.isConditionalExpression(v) ? decided(v.condition, words) : undefined; said != null && ts.isConditionalExpression(v); said = ts.isConditionalExpression(v) ? decided(v.condition, words) : undefined) v = said ? v.whenTrue : v.whenFalse;
  return literal(v) ?? (ts.isTemplateExpression(v) || ts.isConditionalExpression(v) ? inline(v) : placeholder(v));
}

const ISSUE_CALLS = ['raise', 'note', 'ask'];

/** Every sentence the engine can say, in the order its source says them. */
export function engineSentences(root: string): EngineSentence[] {
  rootDir = root;
  files.clear();
  const sf = source(ENGINE);
  const out: EngineSentence[] = [];
  const push = (kind: IssueKind, call: ts.CallExpression, sheetArg: ts.Expression, words: string, x = 5) => {
    const sheet = literal(sheetArg) ?? placeholder(sheetArg);
    out.push({ kind, level: levelFor(kind), sheet, column: extra(call, x, 'column', words), found: extra(call, x, 'found', words), words, at: `${ENGINE}:${lineOf(call)}` });
  };
  walk(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return;
    const fn = n.expression.text;
    if (!ISSUE_CALLS.includes(fn) || n.arguments.length < 5) return;
    const [kindArg, sheetArg, , , msg] = n.arguments as unknown as ts.Expression[];
    // The helpers' own forwarding (note and ask pass their sentence on to raise): said where they are called.
    if (ts.isIdentifier(msg!) && msg.text === 'message') return;
    // A person cell's problem passed on (`raise(own.kind!, …, own.problem)`): its sentences are pickPerson's, below.
    if (/^\w+\.kind!?$/.test(textOf(kindArg!))) return;
    // The goal form's Must fix and questions: each with its own kind.
    if (textOf(msg!) === 'f.text') {
      for (const f of mustFixes()) {
        const kind = MUST_KIND[f.id as keyof typeof MUST_KIND];
        if (!kind) throw new Error(`The goal form’s Must fix “${f.words}” has no kind in MUST_KIND (src/domain/changeset.ts).`);
        push(kind, n, sheetArg!, f.words);
        out[out.length - 1]!.column = (f.field && FIELD_COLUMN[f.field as keyof typeof FIELD_COLUMN]) || '{its column}';
      }
      return;
    }
    if (textOf(msg!) === 'c.question') {
      for (const q of goalQuestions()) {
        const k = ENGINE_CHECK[q.id as keyof typeof ENGINE_CHECK];
        if (!k) continue;
        push(k, n, sheetArg!, q.words);
        Object.assign(out[out.length - 1]!, { column: (q.field && FIELD_COLUMN[q.field as keyof typeof FIELD_COLUMN]) || '{its column}', found: q.id });
      }
      return;
    }
    for (const words of [...new Set(sentences(msg!, { depth: 0, seen: new Set() }))]) {
      for (const kind of [...new Set(kindsOf(kindArg!, words, n))]) push(kind, n, sheetArg!, words);
      if (!kindsOf(kindArg!, words, n).length) throw new Error(`${ENGINE}:${lineOf(n)}: can’t tell the kind “${textOf(kindArg!)}”.`);
    }
  });
  // A person cell the row can't read (pickPerson's problems: settle(kind, problem, …) and { kind, problem }), raised as
  // `raise(own.kind!, …, own.problem)` and “Takes over: …”.
  walk(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'settle' && n.arguments.length >= 2) {
      const kind = literal(n.arguments[0]) as IssueKind | undefined;
      if (kind) for (const w of sentences(n.arguments[1]!, { depth: 0, seen: new Set() })) out.push({ kind, level: levelOf(kind), sheet: '{sheet}', column: extra(n, 2, 'column'), found: extra(n, 2, 'found'), words: w, at: `${ENGINE}:${lineOf(n)}` });
    }
    if (ts.isObjectLiteralExpression(n)) {
      const k = n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'kind');
      const pr = n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'problem');
      const kind = k && ts.isPropertyAssignment(k) ? literal(ts.isAsExpression(k.initializer) ? k.initializer.expression : k.initializer) as IssueKind | undefined : undefined;
      if (kind && pr && ts.isPropertyAssignment(pr)) for (const w of sentences(pr.initializer, { depth: 0, seen: new Set() })) {
        const ex = n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'extra');
        const xo = ex && ts.isPropertyAssignment(ex) && ts.isObjectLiteralExpression(ex.initializer) ? ex.initializer : undefined;
        const prop = (name: string) => { const p = xo?.properties.find((y) => (ts.isPropertyAssignment(y) || ts.isShorthandPropertyAssignment(y)) && y.name.getText() === name); return !p ? '' : ts.isShorthandPropertyAssignment(p) ? placeholder(p.name) : ts.isPropertyAssignment(p) ? literal(p.initializer) ?? placeholder(p.initializer) : ''; };
        out.push({ kind, level: levelOf(kind), sheet: '{sheet}', column: prop('column'), found: prop('found'), words: w, at: `${ENGINE}:${lineOf(n)}` });
      }
    }
  });
  // One sentence per kind, sheet and words.
  const seen = new Set<string>();
  return out.filter((x) => { const k = `${x.kind}|${x.sheet}|${x.words}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** A sentence's words as a pattern a sentence the engine says matches: a {placeholder} stands for any words, [ ] for words said or not. */
export function wordsPattern(words: string): RegExp {
  let re = '';
  let depth = 0;
  for (const ch of words) {
    if (ch === '{') { if (depth++ === 0) re += '[\\s\\S]*?'; continue; }
    if (ch === '}') { depth = Math.max(0, depth - 1); continue; }
    if (depth) continue;
    if (ch === '[') { re += '(?:'; continue; }
    if (ch === ']') { re += ')?'; continue; }
    re += ch.replace(/[.*+?^${}()|\\/]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/**
 * The words a name holds in a file, read as the sentences are: for an object (`hint = { value: 'a Value', … }`), each
 * property's; for a function, what it returns (`return`), each list it builds (by the list's name) and each `summary` it
 * writes; for any other value, its own (`value`). Alternatives are joined by “ / ”.
 */
export function wordsOf(file: string, name: string, root = rootDir): Record<string, string> {
  rootDir = root;
  const out: Record<string, string> = {};
  const ctx = (): Ctx => ({ depth: 0, seen: new Set() });
  const say = (e: ts.Expression) => { try { return [...new Set(sentences(e, ctx()))].join(' / '); } catch { return ''; } };
  const add = (k: string, v: string) => { if (v) out[k] = out[k] ? `${out[k]} / ${v}` : v; };
  walk(source(file), (n) => {
    const decl = (ts.isVariableDeclaration(n) && n.name.getText() === name && n.initializer) || (ts.isFunctionDeclaration(n) && n.name?.text === name) ? n : undefined;
    if (!decl) return;
    const init: ts.Node = ts.isVariableDeclaration(decl) ? decl.initializer! : decl;
    if (ts.isObjectLiteralExpression(init)) {
      for (const p of init.properties) if (ts.isPropertyAssignment(p)) add(p.name.getText().replace(/^'|'$/g, ''), say(p.initializer));
      return;
    }
    if (ts.isFunctionLike(init)) {
      add('return', [...new Set(returnsOf(init).flatMap((r) => { try { return sentences(r, ctx()); } catch { return []; } }))].join(' / '));
      walk(init, (x) => {
        // const parts = [a && 'words', …].filter(Boolean): each item's words.
        let list = x && ts.isVariableDeclaration(x) ? x.initializer : undefined;
        while (list && ts.isCallExpression(list) && ts.isPropertyAccessExpression(list.expression)) list = list.expression.expression;
        if (ts.isVariableDeclaration(x) && list && ts.isArrayLiteralExpression(list)) add(x.name.getText(), list.elements.map((el) => inline(ts.isBinaryExpression(el) && el.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? el.right : el)).join(', '));
        if (ts.isPropertyAssignment(x) && x.name.getText() === 'summary') {
          add('summary', say(x.initializer));
          // The entry's action beside it (`action: 'undone'`), so one entry's words can be told from the others'.
          const action = ts.isObjectLiteralExpression(x.parent) ? x.parent.properties.find((y) => ts.isPropertyAssignment(y) && y.name.getText() === 'action') : undefined;
          const a = action && ts.isPropertyAssignment(action) ? literal(action.initializer) : undefined;
          if (a) add(`summary:${a}`, say(x.initializer));
        }
      });
      return;
    }
    add('value', say(init as ts.Expression));
  });
  return out;
}
