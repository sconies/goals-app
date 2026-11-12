// @vitest-environment node
/* The layers lint (scripts/check-layers.mjs), so npm test keeps it as CI does: the rules layer imports only itself and
   uses no browser, network or clock, new rules take only what they read, browser storage stays behind the ports, the core never imports a module, and a module imports only what it needs. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error: a plain JavaScript script, run by CI with node, has no type declarations.
import { checkLayers } from '../../scripts/check-layers.mjs';

const root = path.join(__dirname, '..', '..');
const check = checkLayers as (root: string) => string[];

describe('The layers', () => {
  it('hold in this repository', () => {
    expect(check(root)).toEqual([]);
  });

  it('are caught when broken', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-'));
    const put = (f: string, text: string) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
    put('src/domain/a.ts', "import type { Commit } from '../data/store';\nimport { b } from './b';\n// fetch('x') in a comment is fine\nexport const go = () => fetch('/api');\n");
    put('src/domain/b.ts', "export const b = 'window.location is only words here';\nexport const c = () => localStorage.getItem('x');\n");
    put('src/domain/b.test.ts', "import { x } from '../data/examples';\n");
    put('src/screens/S.tsx', "import { Import } from '../modules/sheets/Import';\n");
    put('src/modules/sheets/module.json', '{ "id": "sheets", "needs": [] }');
    put('src/modules/sheets/Import.tsx', "import { m } from '../maps/Map';\nexport const Import = 1;\n");
    put('src/modules/maps/module.json', '{ "id": "maps", "needs": ["sheets"] }');
    put('src/modules/maps/Map.tsx', "import { Import } from '../sheets/Import';\nexport const m = 1;\n");
    put('src/data/leak.ts', "import type { SupabaseClient } from '@supabase/supabase-js';\nexport const db = () => import('@supabase/supabase-js');\n");
    put('src/adapters/supabase/store.ts', "import { createClient } from '@supabase/supabase-js';\n");
    put('src/domain/c.ts', "import type { Snapshot } from './types';\nexport const now = () => new Date();\nexport const at = (iso: string) => new Date(iso);\nexport const old = (s: Snapshot, t = Date.now()) => s;\n");
    put('src/domain/d.ts', "import type { Snapshot } from './types';\nexport const ok = (s: Snapshot) => s;\nexport const more = (w: Snapshot) => w;\n");
    put('src/domain/e.ts', "import type { Snapshot } from './types';\nexport const p = (s: Pick<Snapshot, 'people' | 'checkIns'>) => s;\nexport const q = (s: Pick<Snapshot, 'people' | 'teams'>) => s;\nexport const r = (x: object) => x as unknown as Snapshot;\n");
    put('scripts/whole-workspace.json', '{ "files": { "src/domain/d.ts": 1 } }');
    put('src/ui/Keep.tsx', "export const a = () => localStorage.getItem('x');\nexport const b = () => sessionStorage.setItem('y', '1');\n// localStorage in a comment is fine\n");
    put('src/adapters/kept.ts', "export const k = () => indexedDB.open('x');\n");
    put('src/ui/Gone.tsx', 'export const nothing = 1;\n');
    // Spellings a regular expression missed: inside a template literal, after a string holding //, in JSX after an
    // apostrophe, by a string index, and in a .jsx and a .mts file; and index.html's own script.
    put('src/ui/Sly.tsx', "export const a = `${localStorage.getItem('k')}`;\nexport const b = ['http://x', sessionStorage.length];\nexport const C = () => <p>Don't {String(indexedDB)}</p>;\nexport const d = (window as never)['localStorage'];\n");
    put('src/ui/Old.jsx', "export const e = () => localStorage.clear();\n");
    put('src/ui/New.mts', "export const f = 'indexedDB' in globalThis;\nexport const g = 'not localStorage at all';\n");
    put('index.html', "<html><script>try{localStorage.getItem('t')}catch(e){}</script><script src=\"/src/main.tsx\"></script></html>");
    // A listed file using storage fewer times than listed: its count must come down.
    put('src/ui/Less.tsx', "export const h = () => localStorage.getItem('x');\n");
    put('scripts/browser-storage.json', '{ "files": { "src/ui/Keep.tsx": { "uses": 1 }, "src/ui/Gone.tsx": { "uses": 1 }, "src/ui/Less.tsx": { "uses": 3 } } }');
    const found = check(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    expect(found).toEqual([
      expect.stringMatching(/^src\/data\/leak\.ts:1: imports @supabase\/supabase-js; only src\/adapters\/supabase\/ may import Supabase/),
      expect.stringMatching(/^src\/data\/leak\.ts:2: imports @supabase\/supabase-js; only src\/adapters\/supabase\//),
      expect.stringMatching(/^src\/domain\/a\.ts:1: the rules layer \(src\/domain\) imports \.\.\/data\/store/),
      expect.stringMatching(/^src\/domain\/a\.ts:4: the rules layer \(src\/domain\) uses fetch/),
      expect.stringMatching(/^src\/domain\/b\.ts:2: the rules layer \(src\/domain\) uses localStorage/),
      expect.stringMatching(/^src\/domain\/c\.ts:2: a rule reads the clock/),
      expect.stringMatching(/^src\/domain\/c\.ts:4: a rule reads the clock/),
      expect.stringMatching(/^src\/modules\/sheets\/Import\.tsx:1: the sheets module imports \.\.\/maps\/Map from maps, which its module\.json doesn't list/),
      expect.stringMatching(/^src\/screens\/S\.tsx:1: imports \.\.\/modules\/sheets\/Import from the sheets module; the core never depends on a module/),
      expect.stringMatching(/^src\/domain\/c\.ts: takes the whole workspace \(Snapshot.*\) 1 time\(s\); a new rule takes only/),
      expect.stringMatching(/^src\/domain\/d\.ts: takes the whole workspace \(Snapshot.*\) 2 time\(s\), more than the 1/),
      // A Pick naming a whole list counts, and so does a cast; a Pick of people and teams doesn't.
      expect.stringMatching(/^src\/domain\/e\.ts: takes the whole workspace \(Snapshot.*\) 2 time\(s\); a new rule takes only/),
      // Browser storage only behind the ports (AX9): the adapters may; a listed file no more than listed; a listed file that stopped leaves the list.
      expect.stringMatching(/^src\/domain\/b\.ts: uses browser storage .* 1 time\(s\); keep it behind a port/),
      expect.stringMatching(/^src\/ui\/Keep\.tsx: uses browser storage .* 2 time\(s\), more than the 1 scripts\/browser-storage\.json allows/),
      expect.stringMatching(/^src\/ui\/Less\.tsx: uses browser storage 1 time\(s\), fewer than the 3 scripts\/browser-storage\.json lists; lower its count to 1/),
      expect.stringMatching(/^src\/ui\/New\.mts: uses browser storage .* 1 time\(s\); keep it behind a port/),
      expect.stringMatching(/^src\/ui\/Old\.jsx: uses browser storage .* 1 time\(s\); keep it behind a port/),
      expect.stringMatching(/^src\/ui\/Sly\.tsx: uses browser storage .* 4 time\(s\); keep it behind a port/),
      expect.stringMatching(/^index\.html: uses browser storage .* 1 time\(s\); keep it behind a port/),
      expect.stringMatching(/^src\/ui\/Gone\.tsx: no longer uses browser storage; take it off scripts\/browser-storage\.json/),
    ]);
  });
});

// @ts-expect-error: a plain JavaScript script, run by CI with node, has no type declarations.
import { checkPickers, selectsOfEverything } from '../../scripts/check-pickers.mjs';

describe('The pickers lint (find spec, N12)', () => {
  it('holds in this repository: nothing new is chosen from a list of everything', () => {
    expect((checkPickers as (r: string) => string[])(root)).toEqual([]);
  });
  it('finds a <select> of people, teams or goals, and not one of weeks', () => {
    const find = selectsOfEverything as (s: string) => number[];
    expect(find('<label>\n<select value={x}>{app.snapshot.people.map((p) => <option key={p.id}>{p.name}</option>)}</select>')).toEqual([2]);
    expect(find('<select>{weeks.map((w) => <option key={w}>{w}</option>)}</select>')).toEqual([]);
  });
});

// @ts-expect-error: a plain JavaScript script, run by CI with node, has no type declarations.
import { checkSettings, lineProblems } from '../../scripts/check-settings.mjs';

describe('The settings lint (workspace settings, CF1)', () => {
  it('holds in this repository: a level is read from src/domain/levels.ts only', () => {
    expect((checkSettings as (r: string) => string[])(root)).toEqual([]);
  });
  it("tells a goal's level from an import problem's level (must, check, note)", () => {
    const flags = lineProblems as (code: string) => string[];
    expect(flags("if (g.level === 'team') x();")).toHaveLength(1);
    expect(flags("if ('svp' !== goal.level) x();")).toHaveLength(2);
    expect(flags("issues.some((x) => x.level === 'must' || x.level === 'check')")).toEqual([]);
    expect(flags("if ('note' === i.level) x();")).toEqual([]);
  });
});
