/* Each journey's steps and checks in words (item 11, drill gaps 3.27 and 5.2): the kit had only a journey's title and
   budget, so a rebuild couldn't tell what a journey does. The journeys stay what they are, Playwright code in
   evals/journeys.cjs; this reads that code without running it and says, line by line, where the person goes, what they
   press or type (by the words on the screen where the code names them), and what must then be true. One source: change a
   journey and its page changes with it (npm run spec; the spec's own test fails while a journey has no steps).

   Mechanical, so it says only what the code says: a line the reader doesn't know is left out, never guessed, and the
   journey's own comments (the why, in its author's words) come through as notes. Node only, like sources.ts. */
import ts from 'typescript';
import { read, type Repo } from './sources';

export const JOURNEYS_FILE = 'evals/journeys.cjs';

export interface JourneyLine {
  kind: 'step' | 'action' | 'check' | 'note' | 'branch' | 'row';
  text: string;
  /** A branch's lines (an if, its else, a loop). */
  lines?: JourneyLine[];
}
export interface JourneyDoc {
  id: string;
  title: string;
  reqs: string[];
  budget?: number;
  /** Ease-test points this journey isn't scored on. */
  na: string[];
  /** Who it starts as and where, from its first browser and first address. */
  start: string;
  lines: JourneyLine[];
  /** The parts it finds by CSS selector, each with its words. */
  parts: [selector: string, words: string][];
}

/* ---------- words for values ---------- */

const ROLE: Record<string, string> = {
  button: 'button', link: 'link', tab: 'tab', radio: 'choice', checkbox: 'tick box', option: 'option', dialog: 'dialog',
  heading: 'heading', combobox: 'search field', textbox: 'field', searchbox: 'search field', menuitem: 'menu item',
  group: 'group', tablist: 'tabs', region: 'section', alert: 'alert', status: 'status line', row: 'row', cell: 'cell',
  listitem: 'list item', list: 'list', switch: 'switch', spinbutton: 'number field', navigation: 'menu', img: 'picture',
  table: 'table', columnheader: 'column heading', rowheader: 'row heading', article: 'article', menu: 'menu',
  slider: 'slider', toolbar: 'toolbar', form: 'form', main: 'main area', complementary: 'side panel', banner: 'top bar',
  progressbar: 'progress bar', meter: 'meter', figure: 'figure', tooltip: 'tooltip', grid: 'grid', gridcell: 'cell',
  treeitem: 'tree row', tree: 'tree', application: 'canvas', note: 'note', paragraph: 'paragraph', separator: 'divider',
  textarea: 'text box', marquee: 'ticker', log: 'log', timer: 'timer', presentation: 'part', document: 'document',
};

/** Faro's own names for the parts its journeys find by class, where the class alone doesn't say it. */
const PARTS: Record<string, string> = {
  '.goal-bar': 'the goal’s summary bar',
  '.goal-bar .bar-actions': 'the buttons on the goal’s summary bar',
  '.goal-bar .bar-actions .btn.primary': 'the main button on the goal’s summary bar',
  '.goal-bar .bar-status': 'the status on the goal’s summary bar',
  '.pick.open': 'the open find-and-pick list',
  '.weekpick.open': 'the open week picker',
  '.goals-line': 'the Goals count line',
  '.count-line': 'the count line',
  '.filter-line': 'the filter line',
  main: 'the page',
  'main.work': 'the page',
  'main.work h1': 'the page’s heading',
  body: 'the page',
  '.page.home': 'Home',
  '.home-hero': 'Home’s lead',
  '.hero': 'the page’s lead',
  '.ws-facts': 'the workspace facts',
  '.ibx-row': 'an Inbox row',
  '.ibx-open': 'the open Inbox item',
  '.steps': 'the step counter',
  '.toast-action': 'the button in the message that pops up',
  '.toast': 'the message that pops up',
  '.react-flow__node': 'a goal on the Goal map',
  '.qrow': 'a review question’s row',
  '.qfoot .btn.primary': 'the main button at the foot of the review',
  '.page-head': 'the page’s heading area',
  '.measured-by': 'the Measured by line',
  '.hgrid': 'the History grid',
  '.fix-line': 'the Must fix line',
  '.ci-reading-block': 'the reading of the number in the check-in',
  '[data-part="Home"]': 'Home',
  '.side:visible, .tabbar:visible': 'the menu (the sidebar on a computer, the tab bar on a phone)',
  '.side': 'the sidebar',
  '.tabbar': 'the phone’s tab bar',
  '.mk-status': 'the mark-up’s status line',
  '.focus-top': 'the top of the check-in',
  '.focus-foot button[type=submit]': 'the check-in’s main button',
  '.stream > li': 'an entry in the stream',
  '.status-shape': 'a status shape',
  '.need': 'a “needs” line',
  '.level-check': 'a Check question about a number',
  '.level-check .level-actions button': 'the first answer to a Check question',
  '.import-change': 'a change in the import’s preview',
  '.ci-week': 'a week in the check-in',
  '#history': 'the History section',
  'section.habit': 'the habit section',
  'input[type=file]': 'the file chooser',
  '.setup-me': 'the “Which one is you?” step of set-up',
  '.verdict[data-tone=off]': 'the verdict, marked off plan',
  '.verdict': 'the verdict on the number',
  '.save-note': 'the note about saving',
  '.skeleton': 'the loading skeleton',
  '.demo-entry:visible': 'the Demo button',
  '.ws-switch:visible, .ws-switch-top:visible': 'the workspace switcher',
  '.goals-phone-switch .view-open': 'the phone’s View button',
  '.layout-menu > summary': 'the Layout menu',
  '.views-menu > summary': 'the Views menu',
  '.goal-bar summary[aria-label="More about this goal"]': 'the goal’s “…” menu',
  '.review-home': 'the review’s page',
  '.reviews-list': 'the list of reviews',
  '.ring': 'the progress ring',
  '.checklist': 'the checklist',
};

/** Faro's names for one piece of a selector (a class, or classes on one element), with its article, so a longer selector
    reads as parts a rebuild can build without Faro's CSS: “the row's button in a row under Next steps and asks” rather
    than “the step do in the step row” (drill 11, stage 3 re-run, S3-14). A tone after it (`[data-tone=off]`, or a status
    class such as `.off`) is said as “marked off track”. */
const PIECES: Record<string, string> = {
  '.arow': 'a goal’s attention row (its status shape, title and why)',
  '.arow-who': 'the owner’s name',
  '.arow-why': 'the line saying why',
  '.arow-icon': 'the status shape',
  '.goal-bar': 'the goal’s summary bar',
  '.bar-actions': 'the buttons',
  '.bar-status': 'the status word',
  '.step-row': 'an ask’s row under “Next steps and asks”',
  '.step-row.is-settled': 'a row under “Next steps and asks” that is no longer open (answered or done; a withdrawn ask has no row), kept however old it is',
  '.step-do': 'the row’s button',
  '.step-panel': 'the “Respond” form the row opens',
  '.why-block': 'the goal’s Why section, headed “Why” only while the goal has no check-in (after that, by what the latest one says: “Why it will miss without intervention”, “The latest word” and so on)',
  '.why-pointer': 'the line pointing to Next steps and asks',
  '.page.home': 'Home',
  '.home-mine': 'the “Your goals” block on Home',
  '.home-counts': 'the status counts (each a shape, a number and a word, linking to those goals)',
  '.goal-read-back': 'New goal’s read-back (the list named “Read back”, a row per topic, each with its id and label)',
  '.rr-value': 'the row’s words (one sentence or more)',
  '.after-publish': 'the “After you publish” section',
  '.ciq-row': 'a goal’s row in the check-in’s list',
};
const TONES: Record<string, string> = { off: 'off track', risk: 'at risk', on: 'on track', stale: 'with no recent update', done: 'done', stopped: 'stopped' };

/** The parts named by CSS selector while reading one journey: the selector and its words (gap S3-12). */
let partsNamed = new Map<string, string>();

/** A selector in words: Faro's name for the part when it has one, else the class names read as words, and the selector itself. */
function cssWords(sel: string): string {
  const w = cssWordsOf(sel);
  partsNamed.set(sel, w);
  return w;
}
/** Splits a selector at each of `stops` that is outside brackets, parentheses and quotes (an attribute's value can hold
    spaces: `[data-part="Checked in this week"]` is one part, review of #537). */
function splitSelector(sel: string, stops: RegExp): string[] {
  const out: string[] = [];
  let cur = '', depth = 0, q = '';
  for (const ch of sel) {
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '[' || ch === '(') depth++;
    if (ch === ']' || ch === ')') depth--;
    if (!depth && stops.test(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/** One compound selector in words: a named part (`[data-part="…"]`) by its name, else its class names read as words. */
function compoundWords(c: string): string {
  const named = /\[data-part=(["'])(.*?)\1\]/.exec(c);
  if (named) return `“${named[2]}” part`;
  if (/^\[data-part\]$/.test(c)) return 'each named part';
  const TAGS: Record<string, string> = { li: 'list item', tr: 'table row', td: 'cell', th: 'column heading', a: 'link', p: 'paragraph', ul: 'list', ol: 'list' };
  if (TAGS[c]) return TAGS[c]!;
  return c.replace(/\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g, '').replace(/^[a-z0-9]+(?=[.#])/, '').replace(/[.#]/g, ' ').replace(/[-_]+/g, ' ').trim();
}
/** One piece of a selector in words, with its article: Faro's name for it (PIECES) when it has one, else its classes read as words. */
function pieceWords(c: string): string {
  const tone = /\[data-tone=["']?(\w+)/.exec(c)?.[1];
  const bare = c.replace(/\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g, '');
  const classes = bare.split('.').filter(Boolean);
  const status = classes.length > 1 && TONES[classes.at(-1)!] ? classes.at(-1)! : undefined;
  const named = PIECES[bare] ?? (status ? PIECES['.' + classes.slice(0, -1).join('.')] : undefined);
  const marked = tone ?? status;
  if (named) return marked && TONES[marked] ? `${named}, marked ${TONES[marked]}` : named;
  const w = compoundWords(c);
  return !w ? '' : w === 'each named part' ? w : `the ${w}`;
}
function cssWordsOf(sel: string): string {
  if (PARTS[sel]) return PARTS[sel]!;
  const raw = sel;
  const one = (x: string): string | null => {
    if (PARTS[x]) return PARTS[x]!;
    x = x.replace(/\.btn\.primary\b/g, '.main-button').replace(/\.btn\b/g, '.button');
    const parts = splitSelector(x, /[\s>+~]/).map(pieceWords).filter(Boolean);
    if (!parts.length) return null;
    return parts.reverse().join(' in ');
  };
  const each = splitSelector(sel, /,/).map(one);
  if (each.some((x) => x == null)) return `the part \`${raw}\``;
  return `${each.join(', or ')} (\`${raw}\`)`;
}

/** A regular expression as the words it matches: anchors gone, any run of characters as “…”, a number as N. */
function regexWords(src: string): string {
  let s = src.replace(/^\/|\/[a-z]*$/g, '');
  s = s.replace(/\((\\[?#/&]|\$)(\|(\\[?#/&]|\$))*\)/g, '').replace(/^\^/, '').replace(/\$$/, '').replace(/\(\?:/g, '(').replace(/\(\?[=!<][^)]*\)/g, '')
    .replace(/\\d\+|\\d\{[\d,]+\}|\\d/g, 'N').replace(/\\s[*+?]?/g, ' ').replace(/\\b/g, '')
    .replace(/\[\^[^\]]*\][*+]?\??|\.[*+]\??|\\S[*+]|\\w[*+]/g, '…').replace(/\\(.)/g, '$1').replace(/\?(?=\s|$|\))/g, '').replace(/\|/g, ' / ');
  return s.replace(/\s+/g, ' ').trim();
}

const quote = (s: string) => `“${s}”`;
/** “/demo/people…” as the other lines say a demo address: Faro serves its demo under /demo, a rebuild at its own addresses
    (drill 11, gap S3-15). */
const demoAddress = (v: string) => (/^“\/demo(\/|\?|”)/.test(v) ? `${v.replace(/^“\/demo/, '“').replace(/^“(\?|”)/, '“/$1')} in the demo` : v);
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const person = (id: string) => id.split('-').map(cap).join(' ');

/* ---------- the reader ---------- */

interface Scope {
  /** Names that hold a part of the page, in words. */
  parts: Map<string, string>;
  /** Names that hold plain text or a number. */
  values: Map<string, string>;
  /** Names that hold a page (a browser tab). */
  pages: Set<string>;
  /** The journey's own small helpers that make an address. */
  fns: Map<string, { params: string[]; body: ts.Expression }>;
  /** Lists the journey writes out (an array of literal rows), each row in words: a loop over one shows them (gap S3-14). */
  lists?: Map<string, string[]>;
  /** Every name the journey declares, with its declaration as written: a check or a set-up written as code names them,
      and the page gives each, so it can be followed without the journeys file (review of #537). */
  defs?: Map<string, string>;
}
const child = (s: Scope): Scope => ({ parts: new Map(s.parts), values: new Map(s.values), pages: new Set(s.pages), fns: new Map(s.fns), lists: new Map(s.lists), defs: new Map(s.defs) });

/** Code as inline Markdown: one line, in backticks (two when it holds one). */
const codeSpan = (src: string) => { const one = src.replace(/\s+/g, ' ').trim(); return one.includes('`') ? `\`\` ${one} \`\`` : `\`${one}\``; };

/** A date as words: Sunday 8 November 2026. */
const dayWords = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(',', '');

class Reader {
  sf: ts.SourceFile;
  text: string;
  /** Top-level constants with a literal value (NOW, TODAY…). */
  consts = new Map<string, string>();
  /** Top-level helpers with a doc comment: what each does, in its author's words. */
  docs = new Map<string, string>();
  /** The rest of a helper's doc comment, after its first sentence: what a page adds when it calls it. */
  docsMore = new Map<string, string>();
  modules: Map<string, string>;
  constructor(text: string, modules: Map<string, string>) {
    this.text = text;
    this.modules = modules;
    this.sf = ts.createSourceFile(JOURNEYS_FILE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    for (const st of this.sf.statements) {
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const i = d.initializer;
        if (ts.isStringLiteral(i) || ts.isNumericLiteral(i) || ts.isNoSubstitutionTemplateLiteral(i)) this.consts.set(d.name.text, i.text);
        if (ts.isArrowFunction(i) || ts.isFunctionExpression(i)) this.doc(d.name.text, st);
      }
      if (ts.isFunctionDeclaration(st) && st.name) this.doc(st.name.text, st);
    }
  }
  private doc(name: string, st: ts.Node) {
    const c = this.comments(st).pop();
    if (!c) return;
    const first = c.replace(/\s*\(.*$/, '').split(/(?<=[.:])\s/)[0]!.replace(/[.:]$/, '');
    this.docs.set(name, first);
    // What the first sentence leaves out: a bracket it opened ("(U61's, shared with U176…)") is the file's own bookkeeping.
    const rest = c.slice(c.indexOf(first) + first.length).replace(/^\s*\([^)]*\)\s*/, '').replace(/^[.:,]\s*/, '').trim().replace(/\.$/, '');
    if (rest) this.docsMore.set(name, rest);
  }
  /** The comments written just above a statement, each as one line of text. */
  comments(st: ts.Node): string[] {
    // Lines of // in a row are one comment.
    const out: string[] = [];
    let last = -1;
    for (const c of ts.getLeadingCommentRanges(this.text, st.pos) ?? []) {
      const t = this.text.slice(c.pos, c.end).replace(/^\/\*\*?|\*\/$/g, '').split('\n').map((l) => l.replace(/^\s*(\/\/|\*(?!\*))\s?/, '').trim()).join(' ').replace(/\s+/g, ' ').trim();
      const joined = c.kind === ts.SyntaxKind.SingleLineCommentTrivia && last >= 0 && /^\s*$/.test(this.text.slice(last, c.pos));
      if (joined && out.length) out[out.length - 1] += ' ' + t; else out.push(t);
      last = c.kind === ts.SyntaxKind.SingleLineCommentTrivia ? c.end : -1;
    }
    return out.filter(Boolean);
  }
  src = (n: ts.Node) => n.getText(this.sf);

  /** A value in words: quoted text, a number, a constant's value, or {its name} when only running it would tell. */
  value(n: ts.Expression, s: Scope, bare = false): string {
    n = unwrap(n);
    const q = (t: string) => (bare ? t : quote(t));
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return q(n.text);
    if (ts.isNumericLiteral(n)) return n.text;
    if (ts.isRegularExpressionLiteral(n)) return q(regexWords(n.text));
    if (ts.isTemplateExpression(n)) return q(n.head.text + n.templateSpans.map((x) => this.value(x.expression, s, true) + x.literal.text).join(''));
    if (ts.isIdentifier(n)) {
      if (s.values.has(n.text)) return bare ? s.values.get(n.text)!.replace(/^“|”$/g, '') : s.values.get(n.text)!;
      if (this.consts.has(n.text)) return q(this.consts.get(n.text)!);
      return `{${n.text}}`;
    }
    if (ts.isCallExpression(n)) {
      const f = this.src(n.expression);
      if (f === 'W' && n.arguments[0] && ts.isNumericLiteral(n.arguments[0])) return String(Number(n.arguments[0].text) + Number(this.consts.get('NOW') ?? 45) - 7);
      if (f === 'String' && n.arguments[0]) return this.value(n.arguments[0], s, bare);
      if (f === 'valueAt' && n.arguments[1]) {
        const wk = this.value(n.arguments[1], s, true).replace(/^\{NOW\}$/, this.consts.get('NOW') ?? '45');
        const ratio = n.arguments[2] ? Number(this.src(n.arguments[2])) : 1;
        return ratio === 1 || !Number.isFinite(ratio) ? `{the goal’s planned number for week ${wk}}` : `{a number ${Math.round(ratio * 100)}% of the way from the goal’s start to its plan for week ${wk}}`;
      }
      if (f === 'new RegExp' || f === 'RegExp') return n.arguments[0] ? this.value(n.arguments[0], s, bare) : '{text}';
    }
    if (ts.isNewExpression(n) && this.src(n.expression) === 'RegExp' && n.arguments?.[0]) {
      const a = unwrap(n.arguments[0]);
      if (ts.isStringLiteral(a)) return q(regexWords(a.text));
      if (ts.isBinaryExpression(a)) return q(regexWords(this.value(a.left, s, true) + this.value(a.right, s, true)));
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return q(this.value(n.left, s, true) + this.value(n.right, s, true));
    const t = this.src(n);
    if (t.length <= 40) return `{${t}}`;
    // Longer: the code itself, so the words it works out can still be read (drill 11, gap S3-14); past a line, too long.
    const one = t.replace(/\s+/g, ' ');
    return one.length <= 160 ? `{worked out in the journey as \`${one.replace(/`/g, "'")}\`}` : '{a value worked out in the journey}';
  }

  /** Code the journey runs, with the declarations of the names it reads, and theirs in turn, and the top-level constants
      it reads: what a page needs to follow a check or a set-up that isn't a person's step (review of #537). */
  code(n: ts.Node, s: Scope): string {
    const seen = new Set<string>(), used = new Set<string>(), consts: string[] = [];
    const names = (x: ts.Node): string[] => {
      const got: string[] = [];
      const visit = (y: ts.Node) => {
        if (ts.isIdentifier(y) && !(ts.isPropertyAccessExpression(y.parent) && y.parent.name === y) && !(ts.isPropertyAssignment(y.parent) && y.parent.name === y)) got.push(y.text);
        ts.forEachChild(y, visit);
      };
      visit(x);
      return got;
    };
    const todo = names(n);
    while (todo.length) {
      const id = todo.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const d = s.pages.has(id) ? undefined : s.defs?.get(id);
      if (d) { used.add(id); const f = ts.createSourceFile('d.js', d, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS); todo.push(...names(f)); }
      else if (this.consts.has(id) && id !== 'BASE' && id !== 'DOWN') consts.push(`\`${id}\` is ${this.consts.get(id)}`);
    }
    // In the order the journey declares them, each declaration once (two names can share one).
    const out = [...new Set([...(s.defs ?? new Map<string, string>()).entries()].filter(([k]) => used.has(k)).map(([, v]) => codeSpan(v)))];
    const where = [...out, ...consts];
    return `${codeSpan(this.src(n))}${where.length ? `, where ${where.join('; ')}` : ''}`;
  }

  /** A part of the page in words, or null when the expression isn't one. */
  part(n: ts.Expression, s: Scope): string | null {
    n = unwrap(n);
    if (ts.isIdentifier(n)) return s.parts.get(n.text) ?? null;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && !n.arguments.length) return s.parts.get(n.expression.text) ?? null;
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return null;
    const m = n.expression.name.text;
    const on = n.expression.expression;
    const a = n.arguments as unknown as ts.Expression[];
    const within = (inner: string) => {
      const o = unwrap(on);
      if (ts.isIdentifier(o) && (s.pages.has(o.text) || !s.parts.has(o.text))) return inner;
      const outer = this.part(o, s);
      return outer && outer !== 'the page' ? `${inner} in ${outer}` : inner;
    };
    const name = (o?: ts.Expression) => {
      if (!o || !ts.isObjectLiteralExpression(o)) return '';
      const p = o.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(this.sf) === 'name') as ts.PropertyAssignment | undefined;
      return p ? this.value(p.initializer, s) : '';
    };
    switch (m) {
      case 'getByRole': {
        const role = a[0] && ts.isStringLiteral(a[0]) ? a[0].text : 'element';
        const nm = name(a[1]);
        const w = ROLE[role] ?? role;
        return within(nm ? `the ${nm} ${w}` : `${/^[aeiou]/.test(w) ? 'an' : 'a'} ${w}`);
      }
      case 'getByLabel': return within(`the ${this.value(a[0]!, s)} field`);
      case 'getByText': return within(`the words ${this.value(a[0]!, s)}`);
      case 'getByPlaceholder': return within(`the field showing ${this.value(a[0]!, s)}`);
      case 'getByTitle': case 'getByAltText': return within(`the ${this.value(a[0]!, s)} picture`);
      case 'getByTestId': return within(`the part \`${this.src(a[0]!)}\``);
      case 'locator': {
        const sel = a[0] && (ts.isStringLiteral(a[0]) || ts.isNoSubstitutionTemplateLiteral(a[0])) ? a[0].text : null;
        return within(sel ? cssWords(sel) : 'a part of the page');
      }
      case 'first': case 'last': case 'nth': case 'and': {
        const base = this.part(on, s);
        if (!base) return null;
        return m === 'nth' && a[0] && ts.isNumericLiteral(a[0]) ? `${base} (number ${Number(a[0].text) + 1})` : m === 'last' ? `the last of ${base}` : base;
      }
      case 'filter': {
        const base = this.part(on, s);
        if (!base) return null;
        const o = a[0];
        if (!o || !ts.isObjectLiteralExpression(o)) return base;
        const bits: string[] = [];
        for (const p of o.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const k = p.name.getText(this.sf);
          if (k === 'hasText') bits.push(`showing ${this.value(p.initializer, s)}`);
          if (k === 'hasNotText') bits.push(`not showing ${this.value(p.initializer, s)}`);
          if (k === 'has') { const h = this.part(p.initializer, s); if (h) bits.push(`with ${h}`); }
        }
        return bits.length ? `${base} ${bits.join(' and ')}` : base;
      }
      default: return null;
    }
  }

  /** A condition in words, or null when it would take running the code. */
  cond(n: ts.Expression, s: Scope): string | null {
    n = unwrap(n);
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) {
      const inner = this.cond(n.operand, s);
      if (!inner) return null;
      if (/ is visible$/.test(inner)) return inner.replace(/ is visible$/, ' is not visible');
      if (/ is there$/.test(inner)) return inner.replace(/ is there$/, ' is not there');
      if (/ module is on$/.test(inner)) return inner.replace(/ is on$/, ' is off');
      if (/^the address matches /.test(inner)) return inner.replace(/^the address matches /, 'the address doesn’t match ');
      if (inner === 'on a phone') return 'on a computer';
      return `not (${inner})`;
    }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
        const l = this.cond(n.left, s), r = this.cond(n.right, s);
        return l && r ? `${l} ${op === ts.SyntaxKind.AmpersandAmpersandToken ? 'and' : 'or'} ${r}` : null;
      }
      const eq = op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsToken;
      const ne = op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken;
      const l = unwrap(n.left), r = unwrap(n.right);
      if ((eq || ne) && ts.isIdentifier(l) && l.text === 'device' && ts.isStringLiteral(r)) return (r.text === 'phone') === eq ? 'on a phone' : 'on a computer';
      const counted = this.counted(l, s);
      if (counted && ts.isNumericLiteral(r)) {
        const k = Number(r.text);
        if (eq) return k === 0 ? `${counted} is not there` : `there are ${k} of ${counted}`;
        if (ne) return k === 0 ? `${counted} is there` : `there aren’t ${k} of ${counted}`;
        if (op === ts.SyntaxKind.GreaterThanToken && k === 0) return `${counted} is there`;
      }
      return null;
    }
    if (ts.isCallExpression(n)) {
      const f = this.src(n.expression);
      if (f === 'built' && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) return `the ${this.modules.get(n.arguments[0].text) ?? n.arguments[0].text} module is on`;
      if (f === 'phoneBar') return 'on a phone';
      if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'test' && n.arguments[0] && /\.url\(\)/.test(this.src(n.arguments[0]))) return `the address matches ${this.value(n.expression.expression, s)}`;
      if (ts.isPropertyAccessExpression(n.expression)) {
        const m = n.expression.name.text;
        if (m === 'catch') return this.cond(n.expression.expression, s);
        const what = this.part(n.expression.expression, s);
        if (what && (m === 'isVisible' || m === 'isEnabled' || m === 'isChecked')) return `${what} is ${m === 'isVisible' ? 'visible' : m === 'isEnabled' ? 'enabled' : 'ticked'}`;
        if (what && m === 'isDisabled') return `${what} is disabled`;
        if (what && m === 'isHidden') return `${what} is not visible`;
        if (what && m === 'count') return `${what} is there`;
      }
    }
    return null;
  }
  private counted(n: ts.Expression, s: Scope): string | null {
    n = unwrap(n);
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'count') return this.part(n.expression.expression, s);
    return null;
  }

  /** Where an address goes: the demo (on its day, when it isn't the usual Thursday), the real app (its data in this browser), or another address. */
  address(n: ts.Expression, s: Scope): string {
    n = unwrap(n);
    let kind = 'other' as 'demo' | 'live' | 'base' | 'down' | 'other';
    let text = '';
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 'url' || n.expression.text === 'live') && n.arguments[0]) {
      kind = n.expression.text === 'url' ? 'demo' : 'live';
      text = this.value(n.arguments[0], s, true);
    } else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && s.fns.has(n.expression.text)) {
      // A journey's own address helper (const on = (day, path) => BASE + '/demo' + path + …): its body, with its arguments.
      const f = s.fns.get(n.expression.text)!;
      const inner = child(s);
      f.params.forEach((p, i) => { if (n.arguments[i]) inner.values.set(p, quote(this.value(n.arguments[i]!, s, true))); });
      return this.address(f.body, inner);
    } else {
      const bits: string[] = [];
      const flat = (e: ts.Expression) => {
        e = unwrap(e);
        if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) { flat(e.left); flat(e.right); return; }
        if (ts.isConditionalExpression(e)) { bits.push(bits.join('').includes('?') ? '&' : '?'); return; }
        if (ts.isIdentifier(e) && (e.text === 'BASE' || e.text === 'DOWN')) { kind = e.text === 'BASE' ? 'base' : 'down'; return; }
        bits.push(this.value(e, s, true));
      };
      flat(n);
      text = bits.join('');
    }
    let day = '';
    text = text.replace(/[?&]today=([\d-]{10})/, (_, d: string) => { day = d; return ''; }).replace(/[?&]store=browser/, '').replace(/^([^?]*)&/, '$1?');
    if (kind === 'base' && text.startsWith('/demo')) { kind = 'demo'; text = text.slice(5) || '/'; }
    if (kind === 'down') return `\`${text.replace(/^\/demo/, '') || '/'}\` in the demo, on a build whose database can’t be reached`;
    const on = day && day !== this.consts.get('TODAY') ? ` on ${dayWords(day)}` : '';
    if (kind === 'demo') return `\`${text}\` in the demo${on}`;
    if (kind === 'live' || kind === 'base') return `\`${text}\` in the real app${kind === 'live' ? ', its data kept in this browser' : ''}${on}`;
    return `the address ${quote(text)}`;
  }

  /** A file a journey loads: its name, when the code gives one. */
  file(n: ts.Expression, s: Scope): string {
    n = unwrap(n);
    if (ts.isArrayLiteralExpression(n)) return n.elements.map((e) => this.file(e, s)).join(' and ');
    if (ts.isCallExpression(n)) {
      const lit = n.arguments.map(unwrap).filter((a): a is ts.StringLiteral => ts.isStringLiteral(a));
      const named = lit.find((a) => /\.\w{2,5}$/.test(a.text));
      if (named) return quote(named.text.split('/').pop()!);
    }
    if (ts.isObjectLiteralExpression(n)) {
      const p = n.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(this.sf) === 'name') as ts.PropertyAssignment | undefined;
      if (p) return this.value(p.initializer, s);
    }
    if (ts.isStringLiteral(n)) return quote(n.text.split('/').pop()!);
    return 'a file';
  }
}

/** A part the code holds under a name it worked out as it ran: the name in words (askBtn: the ask button). */
const named = (n: ts.Expression): string => {
  if (ts.isCallExpression(n)) n = n.expression;
  while (ts.isPropertyAccessExpression(n) && ['first', 'last', 'nth'].includes(n.name.text)) n = n.expression;
  if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) return named(n.expression.expression);
  if (!ts.isIdentifier(n)) return 'it';
  const w = n.text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/\bbtn\b/, 'button').replace(/\bopt\b/, 'option').replace(/\d+$/, '').trim();
  return `the ${w}`;
};

/** Typing into a field, or emptying it. */
const typed = (v: string, where: string) => (v === '“”' || !v ? `Empty ${where}.` : `Type ${v} into ${where}.`);

const unwrap = (n: ts.Expression): ts.Expression => {
  while (ts.isAwaitExpression(n) || ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)) n = n.expression;
  return n;
};

/** Comments about the eval machinery, not the journey: left out of the steps. */
const MACHINERY = /\b(runners?|shards?|flak\w*|slow machine|timed? ?out|timeouts?|waitFor\w*|Playwright|selector|locator|headless|Chromium|retr(y|ies)|race)\b/i;

/* ---------- a journey's lines ---------- */

function walk(R: Reader, stmts: readonly ts.Statement[], s: Scope, out: JourneyLine[]): void {
  for (const st of stmts) {
    for (const c of R.comments(st)) if (!MACHINERY.test(c)) out.push({ kind: 'note', text: c });
    statement(R, st, s, out);
  }
}

function statement(R: Reader, st: ts.Statement, s: Scope, out: JourneyLine[]): void {
  if (ts.isBlock(st)) return walk(R, st.statements, s, out);
  if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) if (d.initializer) declare(R, d, s, out);
    return;
  }
  if (ts.isExpressionStatement(st)) return expression(R, st.expression, s, out);
  if (ts.isIfStatement(st)) return ifStatement(R, st, s, out);
  if (ts.isForOfStatement(st) || ts.isForInStatement(st) || ts.isForStatement(st) || ts.isWhileStatement(st)) {
    const inner: JourneyLine[] = [];
    const body = st.statement;
    walk(R, ts.isBlock(body) ? body.statements : [body], child(s), inner);
    if (!inner.some((l) => l.kind !== 'note')) return;
    const over = ts.isForOfStatement(st) && R.src(st.expression).length <= 90 ? `For each of \`${R.src(st.expression).replace(/\s+/g, ' ')}\`:` : 'Repeated, as the code loops:';
    // A loop over a list the journey writes out: its rows first, so the loop can be followed without the code.
    const listed = ts.isForOfStatement(st) ? listRows(R, st.expression, s) : null;
    out.push({ kind: 'branch', text: listed ? over.replace(/:$/, `, ${listed.length} ${listed.length === 1 ? 'row' : 'rows'}:`) : over, lines: listed ? [...listed.map((text) => ({ kind: 'row' as const, text })), ...inner] : inner });
    return;
  }
  if (ts.isTryStatement(st)) { walk(R, st.tryBlock.statements, s, out); return; }
}

function declare(R: Reader, d: ts.VariableDeclaration, s: Scope, out: JourneyLine[]): void {
  const init = unwrap(d.initializer!);
  const declared: string[] = [];
  const bind = (b: ts.BindingName) => { if (ts.isIdentifier(b)) declared.push(b.text); else for (const e of b.elements) if (!ts.isOmittedExpression(e)) bind(e.name); };
  bind(d.name);
  const kw = (d.parent as ts.VariableDeclarationList).flags & ts.NodeFlags.Let ? 'let' : 'const';
  for (const n of declared) (s.defs ??= new Map()).set(n, `${kw} ${R.src(d)}`);
  if (ts.isIdentifier(d.name)) {
    const name = d.name.text;
    if (ts.isArrowFunction(init) && !ts.isBlock(init.body) && /\b(BASE|DOWN)\b/.test(R.src(init.body))) {
      s.fns.set(name, { params: init.parameters.map((p) => p.name.getText(R.sf)), body: init.body });
      return;
    }
    if (ts.isStringLiteral(init) || ts.isNumericLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init) || ts.isTemplateExpression(init)) s.values.set(name, R.value(init, s));
    if (ts.isArrayLiteralExpression(init)) { const rows = literalRows(R, init); if (rows) (s.lists ??= new Map()).set(name, rows); return; }
    const part = R.part(init, s) ?? (ts.isArrowFunction(init) && !ts.isBlock(init.body) && !init.parameters.length ? R.part(init.body, s) : null);
    if (part) { s.parts.set(name, part); return; }
    if (/\bnewPage\(|\.newPage\(|h\.use\(/.test(R.src(init))) s.pages.add(name);
    // A helper that opens something and hands it back: the action, and the name for what it opened.
    if (ts.isCallExpression(init)) {
      const opened = helper(R, init, s, out, false);
      if (opened) s.parts.set(name, opened);
      else expression(R, init, s, out);
    }
    return;
  }
  if (ts.isCallExpression(init)) expression(R, init, s, out);
}

/** A literal list's rows in words, or null when a row needs running the code: each row a value, or the values of a
    literal array (a string quoted, a pattern as the words it matches, null as “none”). */
function literalRows(R: Reader, n: ts.ArrayLiteralExpression): string[] | null {
  const lit = (e: ts.Expression): string | null => {
    e = unwrap(e);
    if (e.kind === ts.SyntaxKind.NullKeyword) return 'none';
    if (e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword) return R.src(e);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return quote(e.text);
    if (ts.isNumericLiteral(e)) return e.text;
    if (ts.isRegularExpressionLiteral(e)) return `${quote(regexWords(e.text))} (a pattern)`;
    return null;
  };
  const rows: string[] = [];
  for (const el of n.elements) {
    const e = unwrap(el);
    const one = ts.isArrayLiteralExpression(e) ? e.elements.map((x) => lit(x)) : [lit(e)];
    if (one.some((x) => x === null)) return null;
    rows.push(one.join(', '));
  }
  return rows.length ? rows : null;
}

/** The rows of the list a loop goes over, when it is one the journey wrote out (by name, or written in the loop). */
function listRows(R: Reader, e: ts.Expression, s: Scope): string[] | null {
  e = unwrap(e);
  if (ts.isIdentifier(e)) return s.lists?.get(e.text) ?? null;
  if (ts.isArrayLiteralExpression(e) && R.src(e).length > 90) return literalRows(R, e);
  return null;
}

/** The parts the helpers open, by helper. */
const OPENS: Record<string, string> = { openSwitcher: 'the Workspaces dialog', demoPanel: 'the Demo panel', viewSheet: 'the View sheet', exportButton: 'the Export these goals button' };

/** A helper of the journeys file in words. Gives the part it opened, when it opens one. */
function helper(R: Reader, n: ts.CallExpression, s: Scope, out: JourneyLine[], top = true): string | null {
  if (!ts.isIdentifier(n.expression)) return null;
  const f = n.expression.text;
  const a = n.arguments as unknown as ts.Expression[];
  const v = (i: number) => (a[i] ? R.value(a[i]!, s) : '');
  const counts = (hArg: number) => !!a[hArg] && ts.isIdentifier(unwrap(a[hArg]!)) && R.src(a[hArg]!) === 'h';
  const say = (kind: JourneyLine['kind'], text: string) => out.push({ kind, text });
  switch (f) {
    case 'newPage': {
      const who = a[1] && ts.isStringLiteral(unwrap(a[1])) ? (unwrap(a[1]) as ts.StringLiteral).text : '';
      say('action', who ? `Open a fresh browser as ${person(who)} (\`${who}\`).` : 'Open a fresh browser, with no one chosen yet.');
      return null;
    }
    case 'navTo': say('step', `Open ${v(2)} from the menu (the sidebar on a computer; the tab bar, or its More, on a phone).`); return null;
    case 'toWatching': say('step', 'Open Goals from the menu, then its Watching tab; the address gets `scope=watching`.'); return null;
    case 'viewAs': say(counts(2) ? 'step' : 'action', `Switch to ${R.value(a[1]!, s, true)} in the Demo panel (the quiet Demo button): a role card’s person, or anyone else by typing their name.`); return null;
    case 'goalMenu': {
      const item = v(2);
      say('step', item === quote('Check in again') ? 'Press Check in again on the goal’s summary bar.' : `From the goal’s “…” menu (More about this goal), choose ${item}.`);
      return null;
    }
    case 'chooseLayout': say('step', `Choose the ${v(2)} layout (the Layout menu on a computer; the View sheet on a phone).`); return null;
    case 'viewsAction': say('step', `Choose ${v(2)} in the Views menu (the View sheet on a phone).`); return null;
    case 'openSaved': say('step', `Open the saved view ${v(2)} (the Views menu; the View sheet’s Saved views on a phone).`); return null;
    case 'exportButton': say('step', 'Open the Views menu (the View sheet on a phone) at its Export these goals button.'); return OPENS[f]!;
    case 'viewSheet': say('step', 'Open the phone’s View sheet.'); return OPENS[f]!;
    case 'openSwitcher': say(counts(1) ? 'step' : 'action', 'Open the workspace switcher (the sidebar’s header on a computer, the top bar’s line on a phone).'); return OPENS[f]!;
    case 'demoPanel': say(counts(1) ? 'step' : 'action', 'Open the Demo panel (the quiet Demo button: the sidebar on a computer, the header on a phone).'); return OPENS[f]!;
    case 'pickIn': {
      const where = R.part(a[0]!, s);
      say('action', `Find and pick: press ${v(1)}${where && where !== 'the page' ? ` in ${where}` : ''}${a[2] && R.src(a[2]) !== "''" && R.src(a[2]) !== 'null' ? `, type ${v(2)}` : ''}, and choose ${v(3)}.`);
      return null;
    }
    case 'pickWeek': say('action', `Open the ${R.value(a[1]!, s)} week picker, type ${v(2)} and press Enter.`); return null;
    case 'answerChecks': say('action', 'Answer every Check question about a number with its yes: the number is meant.'); return null;
    case 'lookAs': say('action', `Look as ${person(R.value(a[1]!, s, true))} at \`${R.value(a[2]!, s, true)}\` in the demo.`); return null;
    case 'see': {
      const where = a[0] ? R.part(a[0], s) : null;
      const why = a[2] && !/^\d+$/.test(R.src(a[2])) ? ` (else: ${R.value(a[2], s, true)})` : '';
      say('check', `${v(1)} is shown${where && where !== 'the page' ? ` in ${where}` : ''}${why}.`);
      return null;
    }
    case 'fail': say('check', `Fails: ${R.value(a[0]!, s, true)}.`); return null;
    case 'writeWorkbook': say('action', `Make the workbook to load, its sheets and rows as ${R.code(n, s)}.`); return null;
  }
  // Any other helper of the file: what its own comment says it does.
  const doc = R.docs.get(f);
  if (top && doc && !MACHINERY.test(doc)) {
    // Its whole comment, and the call when it is given more than the page and the runner (U176's 2 and 12 people).
    const more = R.docsMore.get(f);
    const given = a.some((x) => !['p', 'h', 'page', 'device'].includes(R.src(x)));
    say('action', `${cap(doc)}${more && !MACHINERY.test(more) ? `: ${more}` : ''} (${given ? R.code(n, s) : `\`${f}\``}).`);
    return null;
  }
  return null;
}

function expression(R: Reader, e: ts.Expression, s: Scope, out: JourneyLine[]): void {
  e = unwrap(e);
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    // p = h.use(await newPage(…)) and the like: a new browser for the journey.
    if (ts.isIdentifier(e.left)) { if (/\bnewPage\(|\.newPage\(|h\.use\(/.test(R.src(e.right))) s.pages.add(e.left.text); const part = R.part(e.right, s); if (part) s.parts.set(e.left.text, part); }
    return expression(R, e.right, s, out);
  }
  if (!ts.isCallExpression(e)) return;
  if (ts.isIdentifier(e.expression)) { helper(R, e, s, out); return; }
  if (!ts.isPropertyAccessExpression(e.expression)) return;
  const m = e.expression.name.text;
  const on = unwrap(e.expression.expression);
  const a = e.arguments as unknown as ts.Expression[];
  const isH = ts.isIdentifier(on) && on.text === 'h';
  if (isH) {
    switch (m) {
      case 'use': for (const x of a) expression(R, x, s, out); return;
      case 'click': {
        const target = unwrap(a[0]!);
        if (ts.isCallExpression(target) && ts.isIdentifier(target.expression) && OPENS[target.expression.text]) {
          helper(R, target, s, out);
          out.push({ kind: 'step', text: `Press ${OPENS[target.expression.text]}.` });
          return;
        }
        out.push({ kind: 'step', text: `Press ${R.part(a[0]!, s) ?? named(target)}.` });
        return;
      }
      case 'fill': out.push({ kind: 'step', text: typed(a[1] ? R.value(a[1], s) : '', R.part(a[0]!, s) ?? named(unwrap(a[0]!))) }); return;
      case 'checkpoint': out.push({ kind: 'check', text: `Checkpoint ${a[0] ? R.value(a[0], s) : ''}: the screen is scored for \`one-action\` and \`a11y\`.` }); return;
      case 'inView': out.push({ kind: 'check', text: `(\`${a[1] ? R.value(a[1], s, true) : ''}\`) ${R.part(a[0]!, s) ?? 'it'} is in view without scrolling (above the phone’s tab bar).` }); return;
      case 'progressShown': out.push({ kind: 'check', text: '(`progress`) a progress indicator (a ring, steps, dots, a checklist or a bar) is visible.' }); return;
      case 'set': {
        const k = a[0] ? R.value(a[0], s, true) : '';
        const c = a[1] ? R.cond(a[1], s) : null;
        const always = a[1] && a[1].kind === ts.SyntaxKind.TrueKeyword;
        const msg = a[2] ? R.value(a[2], s, true) : '';
        if (always) { out.push({ kind: 'check', text: `(\`${k}\`) scored as met here.` }); return; }
        // A test the words can't say is given as its code, with what it reads; the failure message is what it says, not the test.
        out.push({ kind: 'check', text: `(\`${k}\`) ${c ? `${c}${msg ? ` (else: ${msg})` : ''}` : a[1] ? `met when ${R.code(a[1], s)}${msg ? `. Else it says: ${msg}` : ''}` : 'as the code checks it'}.` });
        return;
      }
    }
    return;
  }
  // Calls on a page or a part of it.
  const part = R.part(on, s);
  const where = part ?? 'it';
  switch (m) {
    case 'goto': out.push({ kind: 'action', text: `Go to ${R.address(a[0]!, s)}.` }); return;
    case 'reload': out.push({ kind: 'action', text: 'Reload the page.' }); return;
    case 'goBack': out.push({ kind: 'action', text: 'Press the browser’s Back.' }); return;
    case 'goForward': out.push({ kind: 'action', text: 'Press the browser’s Forward.' }); return;
    case 'click': case 'tap': case 'dblclick': if (part) out.push({ kind: 'action', text: `Press ${part}.` }); return;
    case 'fill': case 'pressSequentially': case 'type':
      if (ts.isPropertyAccessExpression(on) && on.name.text === 'keyboard') { out.push({ kind: 'action', text: `Type ${R.value(a[0]!, s)}.` }); return; }
      if (part) out.push({ kind: 'action', text: typed(a[0] ? R.value(a[0], s) : '', part) });
      return;
    case 'press':
      if (ts.isPropertyAccessExpression(on) && on.name.text === 'keyboard') { out.push({ kind: 'action', text: `Press the ${R.value(a[0]!, s, true)} key.` }); return; }
      if (part) out.push({ kind: 'action', text: `Press the ${R.value(a[0]!, s, true)} key in ${part}.` });
      return;
    case 'check': if (part) out.push({ kind: 'action', text: `Tick ${part}.` }); return;
    case 'uncheck': if (part) out.push({ kind: 'action', text: `Untick ${part}.` }); return;
    case 'hover': if (part) out.push({ kind: 'action', text: `Point at ${part}.` }); return;
    case 'focus': if (part) out.push({ kind: 'action', text: `Move the focus to ${part}.` }); return;
    case 'selectOption': if (part) out.push({ kind: 'action', text: `Choose ${a[0] ? R.value(a[0], s) : 'an option'} in ${part}.` }); return;
    case 'setInputFiles': {
      // A file the journey makes: the code that makes it, so its rows can be read (review of #537: U179's, U90's).
      const made = a[0] && !ts.isStringLiteral(unwrap(a[0])) ? `; the file is ${R.code(a[0], s)}` : '';
      out.push({ kind: 'action', text: `Choose ${a[0] ? R.file(a[0], s) : 'a file'} to load${part && !/file chooser/.test(part) ? ` in ${part}` : ''}${made}.` });
      return;
    }
    case 'evaluate': {
      // Set-up done in the page's own script (review of #537: U176's switch to Omar, U90's check-in): said, not dropped.
      const fn = a[0] ? unwrap(a[0]) : null;
      const viewer = fn ? /localStorage\.setItem\(\s*'goals-app-viewer:([^']+)'\s*,\s*'([^']+)'\s*\)/.exec(R.src(fn)) : null;
      if (viewer && R.src(fn!).replace(/\s+/g, ' ').length < 120) {
        out.push({ kind: 'action', text: `Look as ${person(viewer[2]!)} (\`${viewer[2]}\`) in the workspace \`${viewer[1]}\` from here on, as choosing them in the Demo panel does (the browser’s storage: \`goals-app-viewer:${viewer[1]}\` is \`${viewer[2]}\`).` });
        return;
      }
      if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && /\b(localStorage|sessionStorage|__goalsStore|indexedDB)\b/.test(R.src(fn))) {
        out.push({ kind: 'action', text: `Set up in the page’s own script, not a step a person takes: it runs ${R.code(a[0]!, s)}${a[1] ? `, given ${R.code(a[1], s)}` : ''}.` });
      }
      return;
    }
    case 'waitForURL': out.push({ kind: 'check', text: a[0] && (ts.isArrowFunction(unwrap(a[0])) || ts.isFunctionExpression(unwrap(a[0]))) ? 'The address changes.' : `The address becomes ${a[0] ? demoAddress(R.value(a[0], s)) : 'the next page'}.` }); return;
    case 'waitFor': {
      if (!part) return;
      const o = a[0] && ts.isObjectLiteralExpression(a[0]) ? R.src(a[0]) : '';
      out.push({ kind: 'check', text: /hidden|detached/.test(o) ? `${cap(where)} goes away.` : `${cap(where)} shows.` });
      return;
    }
    case 'catch': case 'then': return expression(R, on, s, out);
    case 'close': if (/context\(\)/.test(R.src(on))) out.push({ kind: 'action', text: 'Close this browser.' }); return;
    case 'setViewportSize': out.push({ kind: 'action', text: `Resize the window to ${R.src(a[0]!).replace(/[{}\s]/g, '').replace('width:', '').replace(',height:', ' × ')}.` }); return;
  }
}

function ifStatement(R: Reader, st: ts.IfStatement, s: Scope, out: JourneyLine[]): void {
  const then: JourneyLine[] = [];
  walk(R, ts.isBlock(st.thenStatement) ? st.thenStatement.statements : [st.thenStatement], child(s), then);
  // if (…) fail('…'): a check that fails with those words.
  const only = then.filter((l) => l.kind !== 'note');
  if (only.length === 1 && only[0]!.text.startsWith('Fails: ') && !st.elseStatement) {
    out.push({ kind: 'check', text: `It fails if ${only[0]!.text.slice(7).replace(/\.$/, '')}.` });
    return;
  }
  const c = R.cond(st.expression, s);
  const els: JourneyLine[] = [];
  if (st.elseStatement) {
    if (ts.isIfStatement(st.elseStatement)) ifStatement(R, st.elseStatement, s, els);
    else walk(R, ts.isBlock(st.elseStatement) ? st.elseStatement.statements : [st.elseStatement], child(s), els);
  }
  const has = (l: JourneyLine[]) => l.some((x) => x.kind !== 'note');
  if (!has(then) && !has(els)) return;
  const code = R.src(st.expression).replace(/\s+/g, ' ');
  const when = c ?? (code.length <= 70 ? `\`${code}\`` : 'the case in the code holds');
  if (has(then)) out.push({ kind: 'branch', text: `If ${when}:`, lines: then });
  if (has(els)) {
    const elseIf = st.elseStatement && ts.isIfStatement(st.elseStatement);
    out.push(elseIf && els.length === 1 && els[0]!.kind === 'branch' ? { ...els[0]!, text: `Otherwise, ${els[0]!.text.replace(/^If /, 'if ')}` } : { kind: 'branch', text: has(then) ? 'Otherwise:' : `Unless ${when}:`, lines: els });
  }
}

/* ---------- every journey ---------- */

/** Every journey in evals/journeys.cjs, with its lines. `modules` gives a module's name by its id. */
export function journeyDocs(r: Repo, modules: Map<string, string> = new Map()): JourneyDoc[] {
  const R = new Reader(read(r, JOURNEYS_FILE), modules);
  const out: JourneyDoc[] = [];
  for (const st of R.sf.statements) {
    if (!ts.isExpressionStatement(st) || !ts.isCallExpression(st.expression)) continue;
    const call = st.expression;
    if (!ts.isIdentifier(call.expression) || call.expression.text !== 'journey') continue;
    const [idA, reqA, titleA, budgetA, fnA, naA] = call.arguments as unknown as ts.Expression[];
    if (!idA || !ts.isStringLiteral(idA) || !fnA || !(ts.isArrowFunction(fnA) || ts.isFunctionExpression(fnA))) continue;
    const strs = (n?: ts.Expression) => (n && ts.isArrayLiteralExpression(n) ? n.elements.filter(ts.isStringLiteral).map((x) => x.text) : []);
    const scope: Scope = { parts: new Map(), values: new Map(), pages: new Set(['p']), fns: new Map() };
    const lines: JourneyLine[] = [];
    const body = fnA.body;
    partsNamed = new Map();
    if (ts.isBlock(body)) walk(R, body.statements, scope, lines);
    out.push({
      id: idA.text,
      title: titleA && (ts.isStringLiteral(titleA) || ts.isNoSubstitutionTemplateLiteral(titleA)) ? titleA.text : R.value(titleA!, scope, true),
      reqs: strs(reqA),
      budget: budgetA && ts.isNumericLiteral(budgetA) ? Number(budgetA.text) : undefined,
      na: strs(naA),
      start: startOf(lines),
      lines,
      parts: [...partsNamed],
    });
  }
  return out;
}

/** Where a journey starts: its first browser and its first address. */
function startOf(lines: JourneyLine[]): string {
  const flat: JourneyLine[] = [];
  const f = (ls: JourneyLine[]) => { for (const l of ls) { flat.push(l); if (l.lines && !flat.some((x) => /^Go to /.test(x.text))) f(l.lines); } };
  f(lines);
  const who = flat.find((l) => /^Open a fresh browser/.test(l.text));
  const go = flat.find((l) => /^Go to /.test(l.text));
  const as = who ? (/ as (.*) \(`/.exec(who.text)?.[1] ?? 'no one chosen yet') : 'no one chosen yet';
  const where = go ? go.text.replace(/^Go to /, '').replace(/\.$/, '') : 'the demo';
  return `As ${as}, at ${where}.`;
}

/** The journeys whose page would say nothing a person does or nothing to check: the spec's test fails on any. */
export function withoutSteps(docs: JourneyDoc[]): string[] {
  return docs.filter((j) => { const t = tally(j.lines); return !(t.step + t.action) || !t.check; }).map((j) => j.id);
}

/** How many lines of each kind, the branches' included. */
export function tally(lines: JourneyLine[]): Record<JourneyLine['kind'], number> {
  const t = { step: 0, action: 0, check: 0, note: 0, branch: 0, row: 0 };
  const f = (ls: JourneyLine[]) => { for (const l of ls) { t[l.kind]++; if (l.lines) f(l.lines); } };
  f(lines);
  return t;
}

/* ---------- the pages ---------- */

const LABEL: Record<JourneyLine['kind'], string> = { step: '**Step.** ', action: '', check: '**Check:** ', note: '_Note:_ ', branch: '', row: '_Row:_ ' };

function lineMarkdown(lines: JourneyLine[], depth: number): string[] {
  const pad = '  '.repeat(depth);
  const out: string[] = [];
  for (const l of lines) {
    out.push(`${pad}- ${LABEL[l.kind]}${l.text}`);
    if (l.lines) out.push(...lineMarkdown(l.lines, depth + 1));
  }
  return out;
}

/** The words every journey page shares: what a step is, how the demo starts, how the ease test is scored. */
export const HOW_TO_READ = [
  '## How to read a journey’s steps',
  '',
  'Every journey has a page of its steps and checks (the Id in the table above links to it; a module’s journeys are in its own section). Each line is read from the journey’s code in `evals/journeys.cjs`, in order, by `src/spec/journeySteps.ts`, so it says only what the code does:',
  '',
  '- **Step.** A press or a typed field that counts towards the journey’s **budget**: a *step* is one press of a button, link, tab or menu item, or one field typed into, that the person makes (the eval counts each `h.click` and `h.fill`). A journey passes its budget when it takes no more steps than that on a phone and on a desktop. Lines without the label (going to an address, opening a fresh browser, a key pressed, a press the code makes on the way to something else) are done but not counted.',
  '- **Check:** what must then be true. A check in brackets names the ease-test point it scores (`entry`, `one-action`, `progress`, `errors`, `finish`, `attention`, `a11y`, `logged`); the words after “else:” are what the eval reports when it isn’t. “It fails if …” is a check the journey can’t pass without.',
  '- **Checkpoint:** the screen as it is then is checked for the ease test’s `one-action` (at most one main button in view, or in the open sheet) and `a11y` (no serious or critical axe-core fault, no sideways scrolling, and on a phone the main button at least 44px tall).',
  '- _Note:_ the journey author’s own comment, the why behind the next lines.',
  '- Text in “quotes” is what the screen says; `{name}` is a value the journey works out as it runs (a goal’s planned number, say), and {worked out in the journey as `…`} gives the code that works it out when it is longer than a name. A part named by Faro’s markup is given in words with its CSS class in backticks: a rebuild has its own markup, so it matches the words, not the class. Every part the journeys name, with its words, is in [the parts the journeys name](#the-parts-the-journeys-name).',
  '- **Code in a line.** A check whose test, a file the journey loads, or a set-up done in the page’s own script that words can’t say is given as its code, then “where” the declarations it reads (`const …`, in the order the journey makes them) and the constants (`NOW` is 45, the week). In that code `device` is `phone` or `desktop`; `h.snapshot()` is the workspace as the app has it then (`window.__goalsStore.load`: `goals`, `checkIns`, `modules.<id>.<table>` and the rest of [the data model](data-model.md)); `window.__goalsStore.commit(workspaceId, records)` saves records straight to the store, as the app’s own save does, with no screen and no step; `OUT` is a folder the journey writes its files to; `csvFile(name, text)` is a CSV file of that name and text; `writeWorkbook(sheets, file)` writes an .xlsx file of those sheets, each `{ name, rows }`, its first row the headers. “Else it says: …” is the eval’s report when the test fails, not the test.',
  '- **For each of …, N rows:** a loop over a list the journey writes out; each _Row:_ is one entry, its values in the order the code writes them (the note above the loop, when there is one, says what each value is), then the lines done for every row.',
  '- **If …:** lines that apply only on one width (a phone is 390 × 844, a desktop 1440 × 900), with a module on or off, or in one case the code tests.',
  '',
  '**Where it starts.** “In the demo” is Faro’s example workspace, Platform Engineering, on Thursday 5 November 2026, week 45 unless the line names another day (every demo address carries `?today=2026-11-05`, or that day). It is the workspace [the conformance data](../conformance/workspace.json) is made from, and more: `workspace.json` keeps only what the rules read, and [`demo-extra.json`](../conformance/demo-extra.json) adds what the journeys also read on 5 November (each person’s job title and email, and the change log). Faro builds its demo for the day it is opened, so on a later day the demo has moved on: check-ins planned after 5 November are posted, the story’s later weeks have happened. A journey that runs on another day reads that demo, which the kit doesn’t hold (the journeys that do are [listed below](#journeys-on-another-day)). A fresh browser as someone is that person chosen as the viewer before the app loads (Faro keeps the choice in the browser; a rebuild may take it from a cookie or the address). Faro serves the demo under `/demo` (`/demo/people` is People in the demo); the lines give each address without it. “The real app, its data kept in this browser” is the app at its own addresses with `?store=browser`, starting empty.',
];

/** The days other than 5 November that a journey's lines name (“… in the demo on Sunday 8 November 2026”). */
export function otherDays(j: JourneyDoc): string[] {
  const out = new Set<string>();
  const f = (ls: JourneyLine[]) => { for (const l of ls) { for (const m of l.text.matchAll(/in the demo[^`]*? on ((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d+ \w+ \d{4})/g)) out.add(m[1]!); if (l.lines) f(l.lines); } };
  f(j.lines);
  return [...out];
}

/**
 * Two sections for the journeys' page (drill 11, gaps S3-12 and S3-13): every part a journey finds by Faro's CSS, with
 * its words and the journeys that use it, so a rebuild can name its own parts the same way; and the journeys that run
 * on another day than the demo's 5 November, whose demo the kit doesn't hold.
 */
export function partsAndDays(docs: JourneyDoc[], link: (id: string) => string): string[] {
  const parts = new Map<string, { words: string; ids: string[] }>();
  for (const j of docs) for (const [sel, words] of j.parts) { const p = parts.get(sel) ?? { words, ids: [] }; if (!p.ids.includes(j.id)) p.ids.push(j.id); parts.set(sel, p); }
  const cell = (x: string) => x.replace(/\|/g, '\\|');
  const days = docs.map((j) => [j, otherDays(j)] as const).filter(([, d]) => d.length);
  return [
    '## The parts the journeys name',
    '',
    `Each part of a page a journey finds by Faro’s CSS rather than by its words or role: the selector, the words the journey pages use for it, and the journeys that use it (${parts.size} parts). A rebuild needn’t use Faro’s classes; it needs each part to be there, and its journeys runner to find it by whatever the rebuild calls it. Named regions and \`data-part\` names on each screen are in [the screens](screens.md).`,
    '',
    '| Selector | In words | Journeys |',
    '|---|---|---|',
    ...[...parts].sort(([a], [b]) => a.localeCompare(b)).map(([sel, p]) => `| \`${cell(sel)}\` | ${cell(p.words.replace(/ \(`[^`]*`\)$/, ''))} | ${p.ids.map(link).join(', ')} |`),
    '',
    '## Journeys on another day',
    '',
    'These journeys open the demo on a day other than Thursday 5 November 2026. Faro builds its demo as it stands on the day it is opened: on a later day check-ins planned for the weeks since are posted and the story’s later weeks have happened; on an earlier day they haven’t yet. The kit holds the demo as it stood on 5 November only ([`workspace.json`](../conformance/workspace.json) and [`demo-extra.json`](../conformance/demo-extra.json)), so on those days a rebuild has to post the records the journey expects itself, from what its checks say; it is a gap in the kit.',
    '',
    ...days.map(([j, d]) => `- ${link(j.id)}: ${d.join('; ')}`),
    '',
  ];
}

/**
 * What a journey takes for granted that its lines don't show (drill 11, stage 3 re-run, S3-14): the records it starts
 * from and why the screen asks what it asks, so a rebuild can set the same scene. Keyed by journey id; `{up}` is the
 * path back to spec/.
 */
export const JOURNEY_SET_UP: Record<string, string[]> = {
  U4: [
    'Mateo Fernández (`mateo`) owns goals and leads SRE, which owns north-star goals, so New goal starts with no level ([new goal](rules/new-goal.md), rule 1) until a goal it feeds is chosen.',
    'Typing “restore” under Feeds into offers “Mean time to restore service (P1 and P2)” (G-41, `ns-mttr`), a north star; choosing it makes the goal SVP, one level below. The Level field is a group named “Level” of buttons, one per level, the chosen one pressed (`aria-pressed="true"`).',
  ],
  U78: [
    'Rhea Kapoor (`rhea`) asked Amara Nwosu (`amara`) for a decision, “approve the extra CI runner budget for Q4”, on `ns-lead`, on `lead-ci-time`, the one goal feeding it, and on `lead-runners`, which feeds `lead-ci-time`: request `req_po164` in [`workspace.json`]({up}conformance/workspace.json), open, with no due week. Two older copies of the same words are withdrawn and not shown.',
    '“Look as Amara at …” changes who is viewing in the same browser (Faro’s Demo panel does this) and opens the address; a fresh browser as Amara does the same for a rebuild.',
    'Each ask is one row under “Next steps and asks”: its words, its line, its state and at most one button, the one the viewer may press (for a decision: Respond for the one asked, Withdraw for the asker). For Amara the goal’s summary bar’s main button is “Answer Rhea’s request” ([the goal’s page](rules/goal-act.md)), which opens the same reply form as Respond, in the row: a section named “Respond” with a text box and a submit button. An answered row is settled and stays, with its answer; a withdrawn one goes.',
  ],
  U122: [
    'The demo on each day is the demo as it stands that day. On Monday 9 November Tunde Bakare (`tunde`) owns two goals, `lead-rollback` and `cfr-contract`, with week 46’s check-ins still to do, due Thursday 12 November. By Wednesday 11 November both are posted, on time: `lead-rollback`’s on Tuesday 10 November, `cfr-contract`’s that morning (Faro’s demo has them; a rebuild working from [`workspace.json`]({up}conformance/workspace.json), built for 5 November, posts them itself before the Wednesday step). Friday 13 November adds nothing.',
    'On Wednesday 11 November Rhea Kapoor (`rhea`) still has week 46 check-ins to do, so Check-ins leads her Home ([Home](rules/home.md), lead 2).',
    '“Switch to Rhea in the Demo panel” changes who is viewing in the same browser; a fresh browser as Rhea does the same for a rebuild.',
  ],
  U137: [
    'Tunde Bakare (`tunde`) is in Build & Release (`build`) and adds a goal for CI/CD (`cicd`), with himself as its owner, so New goal asks “Tunde is in Build & Release, not CI/CD. Which team is this goal for?” with “Keep it in CI/CD” first ([goal entry](rules/goal-entry.md), rule 3, `owner-other-team`). The answer is read back under You said, and History keeps it as Checked.',
    'G-41 is “Mean time to restore service (P1 and P2)”, a north star, so the goal starts at SVP. Its reviews (Platform leadership weekly and Reliability weekly) are the ones it joins ([the read-back](rules/read-back.md)).',
    'The read-back’s rows are found by their ids (`what`, `who`, `measured`, `usual`, `said`, as [the read-back](rules/read-back.md) lists them), each row’s sentence by itself; “After you publish” is its own section under that heading.',
    'The loop over `Object.entries(want)` checks four rows, word for word: `what` “A number to move: from 40% in week 46 (9–15 Nov 2026) to 90% by week 53 (28 Dec 2026–3 Jan 2027), the same amount each week. Higher is better.”; `who` “Tunde Bakare owns it, in CI/CD. It’s an SVP goal and feeds “Mean time to restore service (P1 and P2)” (G-41).”; `usual` “Whole numbers. From this week to the end of 2026. Steady. Not a guardrail. Helps no other goal.”; `said` “Tunde is in Build & Release; the goal stays in CI/CD.”',
  ],
};

/** One journey's page. `up` is the path back to spec/ from the page. */
export function journeyPage(j: JourneyDoc, up: string, owner: string): string {
  return [
    `<!-- Generated by npm run spec from ${JOURNEYS_FILE} (src/spec/journeySteps.ts). Edit the journey, not this file. -->`,
    '',
    `# ${j.id}: ${j.title}`,
    '',
    `- **Belongs to:** ${owner}`,
    `- **Requirements:** ${j.reqs.map((x) => `\`${x}\``).join(', ') || 'none'}`,
    `- **Budget:** ${j.budget == null ? 'none' : j.na.includes('budget') ? `${j.budget} steps, not scored: this journey’s ease test leaves \`budget\` out, so it may take more (the steps below are counted all the same)` : `at most ${j.budget} steps on each width`}`,
    `- **Ease test:** ${j.na.length ? `every point but ${j.na.map((x) => `\`${x}\``).join(', ')}` : 'all ten points'} ([the ease test](${up}core/journeys.md#the-ease-test))`,
    `- **Runs on:** a phone (390 × 844) and a desktop (1440 × 900), the same lines on each unless one says otherwise`,
    `- **Starts:** ${j.start}`,
    ...(JOURNEY_SET_UP[j.id] ? [`- **Set-up it takes for granted:**`, ...JOURNEY_SET_UP[j.id]!.map((x) => `  - ${x.replaceAll('{up}', up).replace(/\]\(rules\//g, `](${up}core/rules/`)}`)] : []),
    `- **Source:** \`${JOURNEYS_FILE}\`, the entry for ${j.id}`,
    '',
    '## Steps and checks',
    '',
    ...lineMarkdown(j.lines, 0),
    '',
    `How to read these lines: [the journeys](${up}core/journeys.md#how-to-read-a-journeys-steps).`,
    '',
  ].join('\n');
}
