/* A screen's fields, states and buttons, read from its markup's syntax (spec/core/screens.md, KT gap 3). Node only, like
   sources.ts: nothing is run. Each fact is what the markup writes; a word worked out when the screen shows is written
   “…”, and the condition a button or state shows under is given as the code writes it, with a plain word for the
   conditions every screen shares (an admin, the goal's owner). */
import ts from 'typescript';
import { read, type Repo } from './sources';

export interface Control {
  /** Its words, or its aria-label when it has none; “…” where a word is worked out when it shows. */
  words: string;
  kind: 'primary' | 'button' | 'link';
  /** When it shows: the conditions around it in the markup, outermost first; empty when it always shows. */
  when: string[];
}

export interface Field {
  /** Its label, aria-label or placeholder. */
  name: string;
  /** text, number, checkbox, select, textarea, a picker component's name… */
  kind: string;
  when: string[];
}

export interface ScreenState {
  kind: 'empty' | 'loading' | 'error' | 'refused' | 'whole screen';
  /** Its words (a heading, an empty state's title, an alert). */
  words: string;
  /** The condition it shows under, where the markup writes one. */
  when: string;
}

export interface ScreenFacts {
  fields: Field[];
  states: ScreenState[];
  buttons: Control[];
}

const MAX = 110;
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const short = (s: string) => { const t = squash(s); return t.length > MAX ? t.slice(0, MAX - 1) + '…' : t; };

/** A string the expression always is, or null. A choice between two strings is “a / b”. */
function staticString(e: ts.Expression | undefined): string | null {
  if (!e) return null;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isParenthesizedExpression(e)) return staticString(e.expression);
  if (ts.isConditionalExpression(e)) {
    const a = staticString(e.whenTrue), b = staticString(e.whenFalse);
    if (a != null && b != null) return a && b ? `${a} / ${b}` : a || b;
  }
  if (ts.isTemplateExpression(e)) return [e.head.text, ...e.templateSpans.map((s) => '…' + s.literal.text)].join('');
  return null;
}

type El = ts.JsxElement | ts.JsxSelfClosingElement;
const opening = (el: El) => (ts.isJsxElement(el) ? el.openingElement : el);
const tagOf = (el: El) => opening(el).tagName.getText();

function attr(el: El, name: string): { text: string | null; present: boolean } {
  for (const a of opening(el).attributes.properties) {
    if (!ts.isJsxAttribute(a) || a.name.getText() !== name) continue;
    const init = a.initializer;
    if (!init) return { text: 'true', present: true };
    if (ts.isStringLiteral(init)) return { text: init.text, present: true };
    if (ts.isJsxExpression(init)) return { text: staticString(init.expression), present: true };
    return { text: null, present: true };
  }
  return { text: null, present: false };
}

/** The words an element writes: its text and static strings, with “…” for what is worked out when it shows. */
function wordsOf(node: ts.Node): string {
  const parts: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) { const t = squash(n.getText()); if (t) parts.push(t.replace(/&nbsp;/g, ' ')); return; }
    if (ts.isJsxExpression(n)) {
      if (!n.expression) return;
      const s = staticString(n.expression);
      if (s != null) { parts.push(s); return; }
      // An element inside a condition still writes its words; anything else is worked out when it shows.
      let hadJsx = false;
      const inner = (m: ts.Node) => { if (ts.isJsxElement(m) || ts.isJsxSelfClosingElement(m) || ts.isJsxFragment(m)) { hadJsx = true; visit(m); } else ts.forEachChild(m, inner); };
      ts.forEachChild(n.expression, inner);
      if (!hadJsx) parts.push('…');
      return;
    }
    if (ts.isJsxSelfClosingElement(n)) return; // an icon, a shape: no words
    if (ts.isJsxElement(n)) {
      // A label's error message is a state of its own, not part of its name.
      if (n !== node && (attr(n, 'role').text === 'alert' || /\berror\b/.test(attr(n, 'className').text ?? ''))) return;
      n.children.forEach(visit);
      return;
    }
    if (ts.isJsxFragment(n)) { n.children.forEach(visit); return; }
  };
  visit(node);
  return short(parts.join(' ').replace(/(…\s*)+/g, '… ').replace(/\s+([.,;:!?’”)])/g, '$1').replace(/([“(‘])\s+/g, '$1'));
}

/** The conditions around a node, outermost first, up to (not past) the root: `a && <x/>` and `a ? <x/> : <y/>`. */
function conditions(node: ts.Node, root: ts.Node): string[] {
  const out: string[] = [];
  let child: ts.Node = node;
  for (let p = node.parent; p && child !== root; child = p, p = p.parent) {
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && child === p.right) out.push(squash(p.left.getText()));
    else if (ts.isConditionalExpression(p) && child === p.whenTrue) out.push(squash(p.condition.getText()));
    else if (ts.isConditionalExpression(p) && child === p.whenFalse) out.push(negate(squash(p.condition.getText())));
  }
  // `a && b && <x/>` is two conditions, so each gets its plain word.
  return out.reverse().flatMap((c) => (/[()?|]/.test(c) ? [c] : c.split(' && '))).map(short);
}

/** Whether a statement is in a component's own body (a top-level function, or a class's render), not a helper inside one. */
function componentLevel(n: ts.Node): boolean {
  let p = n.parent;
  while (p && !ts.isFunctionLike(p)) p = p.parent;
  if (!p) return false;
  if (ts.isFunctionDeclaration(p)) return ts.isSourceFile(p.parent);
  if (ts.isMethodDeclaration(p)) return p.name.getText() === 'render';
  return ts.isVariableDeclaration(p.parent) && ts.isSourceFile(p.parent.parent.parent.parent);
}

const negate = (c: string) => (/^!\w[\w.]*$/.test(c) ? c.slice(1) : /^[\w.]+$/.test(c) ? `!${c}` : `!(${c})`);

/** A plain word for a condition every screen shares, else the code as written. */
export function whoWords(when: string[]): string {
  if (!when.length) return 'always';
  return when.map((c) => {
    if (/^(app\.viewer\.admin|viewer\.admin|admin|isAdmin|me\.admin)$/.test(c)) return 'an admin';
    if (/^!(app\.viewer\.admin|viewer\.admin|admin|isAdmin|me\.admin)$/.test(c)) return 'not an admin';
    if (/^(isOwner|mine|owner)$/.test(c) || /^(\w+\.)?ownerId === (app\.)?viewer\.id$/.test(c)) return 'the goal’s owner';
    if (/^!(isOwner|mine)$/.test(c)) return 'not the goal’s owner';
    return `\`${c.replace(/`/g, "'")}\``;
  }).join(' and ');
}

/** The function, class or variable named `component` in the file, or the whole file. */
function rootOf(sf: ts.SourceFile, component?: string): ts.Node {
  if (!component) return sf;
  let found: ts.Node | undefined;
  const visit = (n: ts.Node) => {
    if (found) return;
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === component) found = n;
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === component) found = n;
    else ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!found) throw new Error(`No ${component} in ${sf.fileName}`);
  return found;
}

const BUTTON_LINKS = new Set(['Link', 'NavLink', 'a']);
const FIELD_TAGS = new Set(['input', 'select', 'textarea']);
const REFUSAL = /^(Only (an admin|admins|the owner|its owner|the goal’s owner|the lead)|You can’t|You can't|You don’t have|Ask an admin)/;
const ERROR = /^(Couldn’t|Could not|Something went wrong|That didn’t work|Not saved)/;

/** Everything a screen's markup says about its fields, states and buttons. `component` scopes it to one function. */
export function screenFacts(r: Repo, file: string, component?: string): ScreenFacts {
  const sf = ts.createSourceFile(file, read(r, file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const root = rootOf(sf, component);
  const fields: Field[] = [], states: ScreenState[] = [], buttons: Control[] = [];
  const labelFor = new Map<string, string>();
  const elements: El[] = [];
  const strings: ts.Node[] = [];
  const ifs: ts.IfStatement[] = [];
  const collect = (n: ts.Node) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) elements.push(n);
    if (ts.isJsxText(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) strings.push(n);
    if (ts.isIfStatement(n) && componentLevel(n)) ifs.push(n);
    ts.forEachChild(n, collect);
  };
  collect(root);

  for (const el of elements) if (tagOf(el) === 'label') { const f = attr(el, 'htmlFor').text; if (f) labelFor.set(f, wordsOf(el)); }

  for (const el of elements) {
    const tag = tagOf(el);
    const when = conditions(el, root);
    const cls = attr(el, 'className');
    const clsText = cls.text ?? (cls.present ? (opening(el).attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'className') as ts.JsxAttribute).initializer!.getText() : '');
    if (FIELD_TAGS.has(tag)) {
      const type = attr(el, 'type').text;
      if (type === 'hidden' || type === 'file' && !attr(el, 'aria-label').text) continue;
      let name = attr(el, 'aria-label').text ?? (attr(el, 'id').text ? labelFor.get(attr(el, 'id').text!) : undefined) ?? null;
      if (!name) for (let p: ts.Node | undefined = el.parent; p && p !== root; p = p.parent) if ((ts.isJsxElement(p)) && tagOf(p) === 'label') { name = wordsOf(p); break; }
      name ??= attr(el, 'placeholder').text;
      if (!name || name === '…') continue;
      fields.push({ name: short(name), kind: tag === 'input' ? type ?? 'text' : tag, when });
      continue;
    }
    if (/^[A-Z]/.test(tag) && !BUTTON_LINKS.has(tag) && attr(el, 'label').text && /Pick|Field|Select|Input|Choice|Toggle|Switch/.test(tag)) {
      fields.push({ name: short(attr(el, 'label').text!), kind: tag, when });
      continue;
    }
    if (tag === 'Empty' || tag === 'EmptyResult') {
      states.push({ kind: 'empty', words: short(attr(el, 'title').text ?? '…'), when: when.join(' and ') });
      continue;
    }
    if (tag === 'PageWait') { states.push({ kind: 'loading', words: 'a quiet wait (PageWait), drawn only after 300 ms', when: when.join(' and ') }); continue; }
    if (attr(el, 'role').text === 'alert' || /\berror\b/.test(clsText)) {
      const w = wordsOf(el);
      if (w && w !== '…') states.push({ kind: REFUSAL.test(w) ? 'refused' : 'error', words: w, when: when.join(' and ') });
      continue;
    }
    if (tag === 'button' || (BUTTON_LINKS.has(tag) && /\bbtn\b/.test(clsText))) {
      let words = wordsOf(el);
      if (!words || words === '…') words = attr(el, 'aria-label').text ? `(${attr(el, 'aria-label').text})` : /\bbtn\b/.test(clsText) ? '… (worked out when it shows)' : '';
      if (!words) continue;
      buttons.push({ words, kind: /\bprimary\b/.test(clsText) ? 'primary' : tag === 'button' ? 'button' : 'link', when });
    }
  }

  // Refusals and errors written as plain sentences anywhere in the markup.
  for (const n of strings) {
    const t = squash(ts.isJsxText(n) ? n.getText() : (n as ts.StringLiteral).text);
    const kind = REFUSAL.test(t) ? 'refused' : ERROR.test(t) ? 'error' : null;
    if (kind && !states.some((s) => s.words.startsWith(t.slice(0, 30)))) states.push({ kind, words: short(t), when: conditions(n, root).join(' and ') });
  }

  // A whole screen drawn instead of the usual one: `if (cond) return <…/>` (not found, not allowed, nothing yet).
  for (const s of ifs) {
    const ret = ts.isReturnStatement(s.thenStatement) ? s.thenStatement : ts.isBlock(s.thenStatement) && s.thenStatement.statements.length === 1 && ts.isReturnStatement(s.thenStatement.statements[0]!) ? s.thenStatement.statements[0] as ts.ReturnStatement : undefined;
    let e = ret?.expression;
    while (e && ts.isParenthesizedExpression(e)) e = e.expression;
    if (!e || !(ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e))) continue;
    const inside = elementsIn(e);
    const empty = inside.find((x) => tagOf(x) === 'Empty' || tagOf(x) === 'EmptyResult');
    const heading = inside.find((x) => /^h[1-3]$/.test(tagOf(x)) || tagOf(x) === 'Header');
    const go = inside.find((x) => tagOf(x) === 'Navigate');
    const words = empty ? attr(empty, 'title').text ?? '…'
      : heading ? (tagOf(heading) === 'Header' ? attr(heading, 'title').text ?? '…' : wordsOf(heading))
      : go ? `goes to ${attr(go, 'to').text ?? '…'}`
      : inside.some((x) => tagOf(x) === 'PageWait') ? 'a quiet wait (PageWait)' : '';
    if (!words || words === '…') continue;
    const cond = short(squash(s.expression.getText()));
    const same = states.find((x) => x.words === short(words) && x.kind !== 'whole screen');
    if (same) { same.when ||= cond; continue; }
    states.push({ kind: 'whole screen', words: short(words), when: cond });
  }

  const key = (x: { words?: string; name?: string; when: string[] | string }) => `${x.words ?? x.name}|${String(x.when)}`;
  const uniq = <T extends { when: string[] | string }>(xs: T[]) => { const seen = new Set<string>(); return xs.filter((x) => { const k = key(x as never); if (seen.has(k)) return false; seen.add(k); return true; }); };
  return { fields: uniq(fields), states: uniq(states), buttons: uniq(buttons) };
}

function elementsIn(n: ts.Node): El[] {
  const out: El[] = [];
  const visit = (m: ts.Node) => { if (ts.isJsxElement(m) || ts.isJsxSelfClosingElement(m)) out.push(m); ts.forEachChild(m, visit); };
  visit(n);
  return out;
}
