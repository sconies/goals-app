/* What the spec generator reads from the repository, besides the rules themselves: the tests and their titles, the eval
   journeys and checks, the requirements, the routes and screens, and each module's module.json. Node only (it reads
   files): scripts/spec.mjs and the spec's own tests run it, never the app. Everything is read with nothing run, so the
   spec says what the code says. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { ModuleFacts } from '../core/module';

export interface Repo { root: string }

export const read = (r: Repo, rel: string) => fs.readFileSync(path.join(r.root, rel), 'utf8');
export const exists = (r: Repo, rel: string) => fs.existsSync(path.join(r.root, rel));
/** Files under a folder, relative to the root, sorted, matching a test. */
export function files(r: Repo, dir: string, test: (rel: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    const abs = path.join(r.root, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = rel + '/' + e.name;
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'out') walk(child); }
      else if (test(child)) out.push(child);
    }
  };
  walk(dir);
  return out;
}

/* ---------- tests ---------- */

export interface TestCase {
  file: string;
  /** The describe blocks it sits in, outermost first. */
  within: string[];
  title: string;
  /** Requirement ids the title is tagged with ("[STATUS-BANDS] …"). */
  reqs: string[];
}

/** A title as written: a string, or a template with its `${…}` parts kept as written. */
function textOf(node: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(sf).slice(1, -1);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const a = textOf(node.left, sf), b = textOf(node.right, sf);
    return a != null && b != null ? a + b : null;
  }
  return null;
}

/** Every test in the unit tests (src/**\/*.test.ts) and the evals (evals/*.eval.ts), with its title and requirement tags. */
export function testIndex(r: Repo): TestCase[] {
  const list = [...files(r, 'src', (f) => /\.test\.tsx?$/.test(f)), ...files(r, 'evals', (f) => /\.eval\.ts$/.test(f))].map((f) => f.replace(/^\//, ''));
  const out: TestCase[] = [];
  for (const file of list) {
    const text = read(r, file);
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    // Wrappers that tag a title with a fixed requirement: const R = (text: string) => `[SETTINGS] ${text}`.
    const fixed = new Map<string, string>();
    for (const m of text.matchAll(/const (\w+) = \(text: string\) => `\[([A-Z0-9-]+)\] \$\{text\}`/g)) fixed.set(m[1]!, m[2]!);
    const title = (node: ts.Expression): { title: string; reqs: string[] } | null => {
      const plain = textOf(node, sf);
      if (plain != null) {
        const tag = /^\[([A-Z0-9-]+(?:, ?[A-Z0-9-]+)*)\] /.exec(plain);
        return tag ? { title: plain.slice(tag[0].length), reqs: tag[1]!.split(/, ?/) } : { title: plain, reqs: [] };
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text, args = node.arguments;
        if (args.length === 2) {
          const id = textOf(args[0]!, sf), t = textOf(args[1]!, sf);
          if (id && /^[A-Z0-9-]+$/.test(id) && t != null) return { title: t, reqs: [id] };
        }
        if (args.length === 1) {
          const t = textOf(args[0]!, sf);
          if (t != null) return { title: t, reqs: fixed.has(name) ? [fixed.get(name)!] : [] };
        }
      }
      return null;
    };
    const visit = (node: ts.Node, within: string[]) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const base = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) ? callee.expression.text : ts.isCallExpression(callee) && ts.isPropertyAccessExpression(callee.expression) && ts.isIdentifier(callee.expression.expression) ? callee.expression.expression.text : '';
        const first = node.arguments[0];
        if (first && (base === 'describe')) {
          const t = title(first);
          const inner = [...within, t ? t.title : '…'];
          node.arguments.slice(1).forEach((a) => visit(a, inner));
          return;
        }
        if (first && (base === 'it' || base === 'test')) {
          const t = title(first);
          if (t) out.push({ file, within, title: t.title, reqs: t.reqs });
          return;
        }
      }
      ts.forEachChild(node, (c) => visit(c, within));
    };
    visit(sf, []);
  }
  return out;
}

/* ---------- the eval journeys and checks ---------- */

export interface Check {
  id: string;
  kind: 'journey' | 'platform' | 'finish' | 'note';
  title: string;
  reqs: string[];
  file: string;
  /** Journeys: the steps it may take. */
  budget?: number;
}

const strings = (list: string) => [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
/** A quoted string at the start of `s`, in any of the three quotes. */
const quoted = (s: string) => /^\s*(['`"])((?:\\.|(?!\1).)*)\1/.exec(s)?.[2]?.replace(/\\(.)/g, '$1') ?? '';

export function checks(r: Repo): Check[] {
  const out: Check[] = [];
  const j = 'evals/journeys.cjs';
  const text = read(r, j);
  for (const m of text.matchAll(/^journey\('([A-Z]\d+)', \[([^\]]*)\], /gm)) {
    const rest = text.slice(m.index! + m[0].length);
    const title = quoted(rest);
    const budget = Number(/^\s*(['`"])(?:\\.|(?!\1).)*\1,\s*(\d+)/.exec(rest)?.[2] ?? NaN);
    out.push({ id: m[1]!, kind: 'journey', title, reqs: strings(m[2]!), file: j, budget: Number.isFinite(budget) ? budget : undefined });
  }
  const seen = new Set<string>();
  for (const m of text.matchAll(/add\('(P\d+)', \[([^\]]*)\], /g)) {
    if (seen.has(m[1]!)) continue;
    seen.add(m[1]!);
    out.push({ id: m[1]!, kind: 'platform', title: quoted(text.slice(m.index! + m[0].length)), reqs: strings(m[2]!), file: j });
  }
  for (const dir of ['finish', 'notes'] as const) {
    for (const file of files(r, `evals/${dir}`, (f) => f.endsWith('.cjs')).map((f) => f.replace(/^\//, ''))) {
      const t = read(r, file);
      const id = /\bid: '([A-Z]\d+)'/.exec(t)?.[1];
      if (!id) continue;
      const reqs = /\breqs: \[([^\]]*)\]/.exec(t);
      const title = /\btitle: (['`"])((?:\\.|(?!\1).)*)\1/.exec(t)?.[2] ?? `Fit and finish, ${/\barea: '([^']+)'/.exec(t)?.[1] ?? id}`;
      out.push({ id, kind: dir === 'finish' ? 'finish' : 'note', title, reqs: reqs ? strings(reqs[1]!) : ['FIT-AND-FINISH-AREAS'], file });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

/* ---------- requirements, routes, screens, modules ---------- */

export interface Requirement { id: string; area: string; text: string }
export interface RequirementsFile {
  requirements: Requirement[];
  journeys: { id: string; rank: number; title: string; who: string }[];
  notYetBuilt: string[];
  easeCriteria: { id: string; text: string }[];
}
export const requirements = (r: Repo): RequirementsFile => JSON.parse(read(r, 'evals/requirements.json'));

/** Every module's module.json, read from its folder (whatever this build left out). */
export function moduleFacts(r: Repo): ModuleFacts[] {
  const dir = 'src/modules';
  if (!exists(r, dir)) return [];
  return fs.readdirSync(path.join(r.root, dir)).filter((d) => exists(r, `${dir}/${d}/module.json`)).sort()
    .map((d) => JSON.parse(read(r, `${dir}/${d}/module.json`)) as ModuleFacts);
}

export interface Route {
  path: string;
  /** The component App.tsx renders for it. */
  component: string;
  /** The file it comes from, relative to the root. */
  file: string;
}

/** The core's routes, as src/App.tsx writes them, with the file each screen comes from. */
export function coreRoutes(r: Repo): Route[] {
  const app = read(r, 'src/App.tsx');
  const from = new Map<string, string>();
  for (const m of app.matchAll(/import \{([^}]+)\} from '\.\/(screens\/\w+)'/g)) for (const n of m[1]!.split(',')) from.set(n.trim(), `src/${m[2]}.tsx`);
  // Screens loaded when first opened: const X = lazy(() => import('./screens/File').then((m) => ({ default: m.X }))).
  for (const m of app.matchAll(/const (\w+) = lazy\(\(\) => import\('\.\/(screens\/\w+)'\)/g)) from.set(m[1]!, `src/${m[2]}.tsx`);
  return [...app.matchAll(/<Route path="([^"]+)" element=\{<(\w+)/g)].filter((m) => m[1] !== '*' && from.has(m[2]!)).map((m) => ({ path: m[1]!, component: m[2]!, file: from.get(m[2]!)! }));
}

export interface ScreenParts {
  /** Headings, in the order the file writes them. */
  headings: string[];
  /** Labelled regions: aria-label on a section, nav, aside or form. */
  regions: string[];
  /** The text of its primary buttons and links (class "primary"), where written as plain text. */
  primary: string[];
}

const clean = (s: string) => s.replace(/\{' '\}/g, ' ').replace(/\s+/g, ' ').replace(/&rsquo;|’/g, '’').trim();

/** What a screen file names, read from its markup: headings, labelled regions and primary actions. */
export function screenParts(r: Repo, file: string): ScreenParts {
  const t = read(r, file);
  const uniq = (xs: string[]) => [...new Set(xs.map(clean).filter((x) => x && x.length < 90 && !/[{}<>]/.test(x)))];
  const headings = uniq([...t.matchAll(/<h[1-3][^>]*>([^<{]+)</g)].map((m) => m[1]!));
  const regions = uniq([...t.matchAll(/<(?:section|nav|aside|form)[^>]*\baria-label="([^"]+)"/g)].map((m) => m[1]!));
  const primary = uniq([...t.matchAll(/className="btn primary[^"]*"[^>]*>([^<{]+)</g)].map((m) => m[1]!));
  return { headings, regions, primary };
}
