/* The spec can't drift (backlog 8a): every file under spec/ and llms.txt is what `npm run spec` makes from the code
   now, every worked example gives what it says, and every core screen has its main action. */
import fs from 'node:fs';
import path from 'node:path';
import { buildSpec } from './build';
import { MORE_RULE_PAGES, RULE_PAGES, systemOverview } from './overview';
import { RULE_LIST, wrongExamples } from './rules';
import { MAIN_ACTION, OTHER_VIEWS, SHOTS, WIDTHS, shotFile } from './screens';
import { screenFacts } from './screenFacts';
import { ARTICLES } from '../help/guide';
import { checks, coreRoutes, requirements } from './sources';
import { HEADERS } from './conformance';

const root = path.resolve(__dirname, '../..');

describe('the spec', () => {
  it('gives what each worked example says, run against the real rules', async () => {
    expect(await wrongExamples()).toEqual([]);
  });

  it('is current: every file is what npm run spec makes now (run it and commit what it writes)', async () => {
    const want = await buildSpec(root);
    const onDisk: string[] = [];
    const walk = (rel: string) => { for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) { const p = `${rel}/${e.name}`; if (e.isDirectory()) walk(p); else onDisk.push(p); } };
    walk('spec');
    const stale = Object.entries(want).filter(([f, text]) => !fs.existsSync(path.join(root, f)) || fs.readFileSync(path.join(root, f), 'utf8') !== text).map(([f]) => f);
    expect({ stale, extra: onDisk.filter((f) => !(f in want) && !/^spec\/core\/screens\/[^/]+\.jpg$/.test(f)) }).toEqual({ stale: [], extra: [] });
  }, 60_000);

  it('says the same overview in llms.txt as the AI assistant’s describe_system', () => {
    expect(fs.readFileSync(path.join(root, 'llms.txt'), 'utf8')).toBe(systemOverview());
  });

  it('names a main action for every core screen, and none for a screen that has gone', () => {
    const screens = [...new Set(coreRoutes({ root }).map((r) => r.file.split('/').pop()!.replace('.tsx', '')))].sort();
    expect(Object.keys(MAIN_ACTION).sort()).toEqual(screens);
  });

  /* The screens a rebuild can draw (kit review, 12 Nov, gap 3): fields, states and buttons, the look and the Help. */
  describe('gives every screen enough to rebuild it', () => {
    const r = { root };
    it('lists every file in src/screens as a route’s screen or a view with no route, and each view’s article exists', () => {
      const routed = new Set(coreRoutes(r).map((x) => x.file));
      const viewed = new Set(OTHER_VIEWS.map((v) => v.file));
      const loose = fs.readdirSync(path.join(root, 'src/screens')).filter((f) => f.endsWith('.tsx')).map((f) => `src/screens/${f}`).filter((f) => !routed.has(f) && !viewed.has(f));
      expect(loose).toEqual([]);
      expect(OTHER_VIEWS.filter((v) => v.help && !ARTICLES.some((a) => a.id === v.help)).map((v) => v.name)).toEqual([]);
      for (const v of OTHER_VIEWS) expect(() => screenFacts(r, v.file, v.component), v.name).not.toThrow();
    });

    it('reads a screen’s fields, states and buttons, and who sees each, from its markup', () => {
      const goal = screenFacts(r, 'src/screens/GoalScreen.tsx');
      expect(goal.buttons).toContainEqual(expect.objectContaining({ words: 'Post the first check-in', kind: 'primary', when: expect.arrayContaining(['isOwner']) }));
      expect(goal.states).toContainEqual(expect.objectContaining({ kind: 'empty', words: 'This goal doesn’t exist', when: '!goal' }));
      expect(goal.fields).toContainEqual(expect.objectContaining({ name: 'Your reply', kind: 'textarea' }));
      expect(screenFacts(r, 'src/App.tsx', 'NotFound').buttons.map((b) => [b.words, b.kind])).toEqual([['Go to Home', 'primary'], ['Help', 'link']]);
      expect(screenFacts(r, 'src/telemetry/react.tsx', 'ErrorBoundary').states.map((x) => x.words)).toContain('Something went wrong on this page');
    });

    it('has a picture of every core screen at both widths, and every picture it names is there', () => {
      expect(Object.keys(MAIN_ACTION).filter((n) => !SHOTS[n])).toEqual([]);
      expect(Object.keys(SHOTS).filter((n) => !(n in MAIN_ACTION) && !OTHER_VIEWS.some((v) => v.name === n) && n !== 'Find')).toEqual([]);
      const missing = Object.keys(SHOTS).flatMap((n) => WIDTHS.map((w) => `spec/core/screens/${shotFile(n, w)}`)).filter((f) => !fs.existsSync(path.join(root, f)));
      expect(missing, 'run npm run spec:shots').toEqual([]);
    });

    it('carries the design rules and every Help article in full', async () => {
      const spec = await buildSpec(root);
      expect(spec['spec/core/design-rules.md']).toContain(fs.readFileSync(path.join(root, 'docs/design-rules.md'), 'utf8').split('\n## Banned')[1]!.split('\n## Every')[0]);
      const guide = spec['spec/core/help-guide.md']!;
      expect(ARTICLES.filter((a) => !guide.includes(`### ${a.title}\n`) || !a.sections.every((s) => guide.includes(`#### ${s.heading}`))).map((a) => a.id)).toEqual([]);
      for (const f of ['spec/README.md', 'llms.txt']) for (const page of ['core/design-rules.md', 'core/help-guide.md']) expect(spec[f], `${f} links ${page}`).toContain(page);
    }, 60_000);
  });

  /* The kit's small errors (kit review, 12 Nov, gap 10): each once tripped a reader in the first hour. */
  describe('has none of the errors a reader trips on first', () => {
    const r = { root };
    let spec: Record<string, string>;
    beforeAll(async () => { spec = await buildSpec(root); }, 60_000);

    it('writes every check’s title as words, never as the code that makes it', () => {
      expect(checks(r).filter((c) => !c.title || /\$\{|\(\[\^|`/.test(c.title)).map((c) => `${c.id}: ${c.title}`)).toEqual([]);
    });

    it('lists every check a requirement or a check cites, such as “(P3, P4, P6)”', () => {
      const listed = new Set(checks(r).map((c) => c.id));
      const texts = [...requirements(r).requirements.map((q) => q.text), ...checks(r).map((c) => c.title)];
      const cited = texts.flatMap((t) => [...t.matchAll(/\(((?:[PFN]\d+, )+[PFN]\d+)\)/g)].flatMap((m) => m[1]!.split(', ')));
      expect([...new Set(cited)].filter((id) => !listed.has(id))).toEqual([]);
    });

    it('gives a module’s rules page every one of its rules, not only the last', () => {
      for (const id of new Set(RULE_LIST.filter((x) => x.module).map((x) => x.module!))) {
        const page = spec[`spec/modules/${id}/rules.md`]!;
        for (const rule of RULE_LIST.filter((x) => x.module === id)) expect(page).toContain(`## ${rule.title}\n`);
      }
    });

    it('names stage 1’s files with the columns the conformance data has, and counts only the five it scores', () => {
      const stage1 = spec['spec/rebuild/stage-1-core-rules.md']!;
      const count = (f: string) => spec[`spec/conformance/${f}.csv`]!.trimEnd().split('\n').length - 1;
      const five = ['status', 'flags', 'projection', 'scorecard', 'checkin'] as const;
      for (const f of five) expect(stage1).toContain(`| \`${f}.csv\` | ${count(f)} | ${HEADERS[f].map((c) => `\`${c}\``).join(', ')} |`);
      const total = five.reduce((a, f) => a + count(f), 0);
      expect(stage1).toContain(`all five files match (${total} rows`);
      expect(spec['spec/rebuild/README.md']).toContain(`(${total} rows in five files`);
    });

    it('indexes every core rule page in llms.txt, by its own title', () => {
      const core = RULE_LIST.filter((x) => !x.module).map((x) => [x.id, x.title]);
      expect([...RULE_PAGES.map(([id, title]) => [id, title]), ...MORE_RULE_PAGES].sort()).toEqual(core.sort());
      for (const [id] of core) expect(spec['llms.txt']).toContain(`(spec/core/rules/${id}.md)`);
    });

    it('says in llms.txt what the flags page says about a goal only looked at: it still needs attention', () => {
      expect(spec['llms.txt']).not.toMatch(/looked at since its latest check-in is being handled/);
      expect(spec['llms.txt']).toMatch(/marking it reviewed or noting it is not enough/);
    });
  });
});
