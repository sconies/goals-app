/* Spec scenarios for the consolidation's first release: one word for each concept, and one way of saving files.
   CONSISTENT-WORDS reads docs/glossary.md, takes every phrase it says not to use, and checks the app's copy for them
   (screens, components, app text, the rules' own words and the guide), skipping only what the glossary keeps on
   purpose. SHARED-DOWNLOADS checks that every file the app saves goes through saveFile in src/app/files.ts. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileName } from '../src/app/files';
import { seed } from '../src/data/seed';
import { gapBeside, NO_VALUE, nowText } from '../src/domain/format';
import { assessPosted } from '../src/domain/status';
import { summarise } from '../src/domain/summary';
import { currentWeek } from '../src/domain/plan';
import { ARTICLES, articleForPath } from '../src/help/guide';

const W = (text: string) => `[CONSISTENT-WORDS] ${text}`;
const D = (text: string) => `[SHARED-DOWNLOADS] ${text}`;
const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** Every .ts and .tsx file under a folder, tests left out. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(rel));
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}

/** Code without its comments: what people can read is in strings and JSX text, never in a comment. */
const withoutComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/** The glossary: its terms, the phrases it says not to use (in backticks in the last column), and what it keeps on purpose. */
function glossary() {
  const md = read('docs/glossary.md');
  const table = md.slice(md.indexOf('## Terms'), md.indexOf('## Kept for now'));
  const rows = table.split('\n').filter((l) => /^\| [^-|]/.test(l) && !/^\| Term \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const banned = rows.flatMap(([term, , dont]) => [...(dont ?? '').matchAll(/`([^`]+)`/g)].map((m) => ({ term: term!, phrase: m[1]! })));
  const kept = md.slice(md.indexOf('## Kept for now'), md.indexOf('## Words that look alike'))
    .split('\n').filter((l) => l.startsWith('- ')).map((l) => { const [phrase, file] = [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1]!); return { phrase: phrase!, file: file! }; });
  return { rows, banned, kept };
}

describe('One word for each concept', () => {
  const g = glossary();
  const files = ['src/screens', 'src/ui', 'src/app', 'src/domain'].flatMap(sources);

  it(W('the glossary names each term once, says what it means, and lists words not to use'), () => {
    expect(g.rows.length).toBeGreaterThan(15);
    const terms = g.rows.map((r) => r[0]!.toLowerCase());
    expect(new Set(terms).size).toBe(terms.length);
    for (const r of g.rows) expect(r[1]!.length, r[0]).toBeGreaterThan(20);
    for (const t of ['comment', 'review note', 'data', 'import', 'saved layout', 'saved view', 'layout', 'one-table check-in', 'no value yet', 'reason']) expect(terms, t).toContain(t);
    expect(g.banned.length).toBeGreaterThan(12);
  });

  it(W('the app’s copy never uses a word the glossary says not to (screens, components, app text and rules)'), () => {
    const found: string[] = [];
    for (const f of files) {
      const text = withoutComments(read(f));
      for (const b of g.banned) {
        if (!text.includes(b.phrase)) continue;
        if (g.kept.some((k) => k.phrase === b.phrase && k.file === f)) continue;
        found.push(`${f}: “${b.phrase}” (say “${b.term}”)`);
      }
    }
    expect(found).toEqual([]);
  });

  it(W('the guide’s articles use the same words: titles, summaries and every section'), () => {
    const found: string[] = [];
    for (const a of ARTICLES) {
      const text = [a.title, a.summary, ...a.sections.flatMap((s) => [s.heading, ...(s.text ?? []), ...(s.list ?? [])])].join('\n');
      for (const b of g.banned) if (text.includes(b.phrase)) found.push(`${a.id}: “${b.phrase}” (say “${b.term}”)`);
    }
    expect(found).toEqual([]);
  });

  it(W('what the glossary keeps on purpose is still there, so the exceptions never outlive their reason'), () => {
    expect(g.kept.length).toBeGreaterThan(0);
    for (const k of g.kept) expect(withoutComments(read(k.file)), `${k.file}: ${k.phrase}`).toContain(k.phrase);
  });

  it(W('Data is called Data, in the nav and in its help; its named column arrangements are saved layouts, not views'), () => {
    expect(read('src/ui/Shell.tsx')).toMatch(/data: \{ to: '\/data', label: 'Data'/);
    expect(articleForPath('/data')?.title).toBe('Data');
    const data = ['src/screens/DataTables.tsx', 'src/screens/DataLayout.tsx', 'src/screens/DataFilters.tsx'].map((f) => withoutComments(read(f))).join('\n');
    expect(data).toContain('Saved layouts');
    expect(data).not.toMatch(/'Views'|`View: |Save view|from Views/);
  });

  it(W('Import is called Import, and the one-table check-in has one name'), () => {
    expect(withoutComments(read('src/screens/Import.tsx'))).toContain('Import from a spreadsheet');
    expect(withoutComments(read('src/screens/QuickCheckIn.tsx'))).toContain('Type all your numbers in one table');
    expect(withoutComments(read('src/screens/Home.tsx'))).toContain('Or type all your numbers in one table');
    expect(articleForPath('/quick-check-in')?.title).toMatch(/all your numbers in one table/i);
  });

  it(W('a goal with no number says “No value yet”, the same in lists, cards, headlines and exports, and never twice'), () => {
    const today = new Date('2026-10-30T12:00:00Z');
    const s = seed(today);
    const cycle = s.cycles[0]!;
    const week = currentWeek(cycle, today);
    const fresh = { ...s.goals.find((x) => x.kind === 'metric')!, id: 'fresh', title: 'A goal with no check-in yet' };
    const snap = { ...s, goals: [...s.goals, fresh] };
    const a = assessPosted(fresh, cycle, snap.checkIns, week);
    expect(nowText(fresh, a)).toBe(NO_VALUE);
    expect(NO_VALUE).toBe('No value yet');
    expect(summarise(fresh, snap, cycle, today, week).now).toBe(NO_VALUE);
    // The gap would only say it again, so a row leaves it out.
    expect(gapBeside(fresh, a)).toBeNull();
    // Nowhere in the app's copy is the empty value a bare dash or another phrase.
    const rows = ['src/ui/goalRows.tsx', 'src/screens/Home.tsx', 'src/screens/Watching.tsx', 'src/screens/Review.tsx'].map((f) => withoutComments(read(f))).join('\n');
    expect(rows).not.toMatch(/a\.actual == null[^:]*\? '—'/);
  });
});

describe('One way of saving files', () => {
  it(D('every download goes through saveFile: nothing else makes a file link, clicks one or writes a workbook'), () => {
    const found: string[] = [];
    for (const f of sources('src')) {
      if (f === path.join('src', 'app', 'files.ts')) continue;
      const text = withoutComments(read(f));
      for (const [what, re] of [['URL.createObjectURL', /URL\.createObjectURL/], ['an <a download>', /\.download\s*=|\bdownload=\{|\bdownload="/], ['write-excel-file', /write-excel-file/], ['toFile(', /\.toFile\(/]] as const) {
        if (re.test(text)) found.push(`${f}: ${what}`);
      }
    }
    expect(found).toEqual([]);
  });

  it(D('the screens that offer a file save it with saveFile: Export, Import’s workbook, Data, Activity, set-up’s template and research notes'), () => {
    for (const f of ['Export', 'Import', 'DataTables', 'Activity', 'Onboarding', 'Research']) {
      expect(read(`src/screens/${f}.tsx`), f).toMatch(/from '\.\.\/app\/files'/);
      expect(read(`src/screens/${f}.tsx`), f).not.toMatch(/download(Text|Workbook|Template)\(/);
    }
  });

  it(D('one naming rule: <workspace>-<what>-<scope>-<date>, the scope left out when there isn’t one'), () => {
    const date = new Date('2026-11-05T09:00:00Z');
    expect(fileName({ workspace: 'Developer Platform', what: 'goals', scope: 'Year 2026', date }, 'xlsx')).toBe('developer-platform-goals-year-2026-2026-11-05.xlsx');
    expect(fileName({ workspace: 'Developer Platform', what: 'Check-ins', scope: 'Owners first', date }, 'csv')).toBe('developer-platform-check-ins-owners-first-2026-11-05.csv');
    expect(fileName({ workspace: 'Developer Platform', what: 'activity', scope: '', date }, 'csv')).toBe('developer-platform-activity-2026-11-05.csv');
  });
});
