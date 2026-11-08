// @vitest-environment node
/* Feature modules (docs/architecture.md): which are on, the switch's rule, and every module's manifest agreeing with its
   code, its Help, its AI tools, its requirements and its journeys, so module.json can be read on its own. */
import fs from 'node:fs';
import path from 'node:path';
import APP from 'virtual:faro-modules/app';
import HELP from 'virtual:faro-modules/help';
import TOOLS from 'virtual:faro-modules/tools';
import { NotAllowed, setModule, type ActionContext } from '../domain/actions';
import type { Person, Snapshot } from '../domain/types';
import { ARTICLES } from '../help/guide';
import { TOOLS as ALL_TOOLS } from '../mcp/tools';
import { findModules } from '../../vite.modules.ts';
import { manifestProblems, placeSections, PLACES, resolveModules, type ModuleFacts } from './module';
import { isModuleOn, MODULES, modulesOn } from './registry';

const root = path.join(__dirname, '..', '..');
const KEYS: (keyof ModuleFacts)[] = ['id', 'name', 'summary', 'needs', 'routes', 'redirects', 'navigation', 'places', 'tables', 'aiTools', 'help', 'requirements', 'journeys'];

describe('Which modules are on', () => {
  const mods = [
    { id: 'asks', needs: [] },
    { id: 'reviews', needs: ['asks'] },
    { id: 'review-notes', needs: ['reviews'] },
    { id: 'map', needs: [] },
  ];

  it('is every module, with nothing switched off', () => {
    expect([...resolveModules(mods).on].sort()).toEqual(['asks', 'map', 'review-notes', 'reviews']);
  });

  it('switches off what needs a module along with it, however deep, and says why', () => {
    const r = resolveModules(mods, ['asks']);
    expect([...r.on]).toEqual(['map']);
    expect(r.off.get('asks')).toEqual({ kind: 'switched-off' });
    expect(r.off.get('reviews')).toEqual({ kind: 'needs', missing: ['asks'] });
    expect(r.off.get('review-notes')).toEqual({ kind: 'needs', missing: ['reviews'] });
  });

  it('counts a need that isn’t installed as off, and ignores switches for modules it doesn’t have', () => {
    const r = resolveModules([{ id: 'notes', needs: ['gone'] }, { id: 'map', needs: [] }], ['not-here']);
    expect([...r.on]).toEqual(['map']);
    expect(r.off.get('notes')).toEqual({ kind: 'needs', missing: ['gone'] });
  });

  it('finds clashing ids, bad ids, needs that aren’t installed and loops', () => {
    expect(manifestProblems(mods)).toEqual([]);
    expect(manifestProblems([{ id: 'a', needs: ['b'] }, { id: 'b', needs: ['a'] }]).some((p) => /loop/.test(p))).toBe(true);
    expect(manifestProblems([{ id: 'A b', needs: [] }, { id: 'x', needs: ['y'] }, { id: 'x', needs: [] }])).toEqual(expect.arrayContaining([
      expect.stringMatching(/^A b: a module id/), expect.stringMatching(/x needs y/), expect.stringMatching(/x: two modules/),
    ]));
  });

  it('reads a workspace’s switches', () => {
    expect(isModuleOn({}, 'spreadsheets')).toBe(true);
    expect(isModuleOn({ modulesOff: ['spreadsheets'] }, 'spreadsheets')).toBe(false);
    expect(modulesOn(null).on.has('spreadsheets')).toBe(true);
  });
});

describe('Switching a module on or off (domain/actions setModule)', () => {
  const admin = { id: 'a', name: 'Ada Admin', admin: true } as Person;
  const x = (actor: Person): ActionContext => ({ snapshot: {} as Snapshot, cycle: {} as ActionContext['cycle'], week: 3, actor, now: '2026-11-08T10:00:00.000Z', newId: (p) => `${p}_1` });
  const mods = [{ id: 'asks', name: 'Asks', needs: [] }, { id: 'reviews', name: 'Reviews', needs: ['asks'] }];

  it('is for admins', () => {
    expect(() => setModule(x({ ...admin, admin: false }), { id: 'w' }, mods, 'asks', false)).toThrow(NotAllowed);
  });

  it('saves the whole list, logs it with what goes off along with it, and does nothing when it already is', () => {
    const c = setModule(x(admin), { id: 'w' }, mods, 'asks', false)!;
    expect(c.modulesOff).toEqual(['asks']);
    expect(c.changes[0]).toMatchObject({ entity: 'workspace', entityId: 'w', action: 'edited', summary: 'Switched off Asks, and with it Reviews', diffs: [{ field: 'Asks', from: 'On', to: 'Off' }] });
    expect(setModule(x(admin), { id: 'w', modulesOff: ['asks'] }, mods, 'asks', false)).toBeNull();
    expect(setModule(x(admin), { id: 'w', modulesOff: ['asks', 'reviews'] }, mods, 'asks', true)!.modulesOff).toEqual(['reviews']);
    expect(() => setModule(x(admin), { id: 'w' }, mods, 'nope', false)).toThrow(/no feature called nope/);
  });
});

describe('Every module’s manifest', () => {
  const requirements = (JSON.parse(fs.readFileSync(path.join(root, 'evals/requirements.json'), 'utf8')) as { requirements: { id: string }[] }).requirements.map((r) => r.id);
  const journeys = fs.readFileSync(path.join(root, 'evals/journeys.cjs'), 'utf8');
  const checks = fs.readdirSync(path.join(root, 'evals/finish')).concat(fs.readdirSync(path.join(root, 'evals/notes')).map((f) => 'n' + f));
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'));

  it('is there for every folder in src/modules, and they make a sound set', () => {
    const folders = fs.readdirSync(path.join(root, 'src/modules'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(MODULES.map((m) => m.id)).toEqual(folders);
    expect(manifestProblems(MODULES)).toEqual([]);
  });

  for (const m of MODULES) {
    describe(m.id, () => {
      const app = APP.find((x) => x.id === m.id)?.part;
      it('has every field, its id as its folder’s name, and only known places', () => {
        for (const k of KEYS) expect(m[k], `${m.id}: ${k}`).toBeDefined();
        expect(m.name.length).toBeGreaterThan(2);
        expect(m.summary.length).toBeGreaterThan(30);
        expect(m.places.filter((p) => !(PLACES as readonly string[]).includes(p))).toEqual([]);
      });

      it('lists exactly the routes, navigation and places its app.tsx adds', () => {
        expect((app?.routes ?? []).map((r) => r.path).sort()).toEqual([...m.routes].sort());
        expect((app?.navigation ?? []).map((n) => n.label).sort()).toEqual([...m.navigation].sort());
        expect(Object.keys(app?.places ?? {}).sort()).toEqual([...m.places].sort());
        expect((app?.sections ?? []).map((x) => x.id).sort()).toEqual([...(m.sections ?? [])].sort());
        for (const [, to] of m.redirects) expect(m.routes, `redirect to ${to}`).toContain(to);
      });

      it('lists exactly the Help articles its help.ts adds, and each route has one', () => {
        const mine = HELP.find((x) => x.id === m.id)?.part ?? [];
        expect(mine.map((a) => a.id).sort()).toEqual([...m.help].sort());
        for (const id of m.help) expect(ARTICLES.find((a) => a.id === id)?.module, id).toBe(m.id);
        for (const r of [...m.routes, ...m.redirects.map(([from]) => from), ...(m.sections ?? []).map((id) => `/workspace/${id}`)]) expect(mine.some((a) => a.routes.some((x) => x.split('?')[0] === r)), r).toBe(true);
      });

      it('lists exactly the AI tools its tools.ts adds, and the server offers them', () => {
        const mine = TOOLS.find((x) => x.id === m.id)?.part ?? [];
        expect(mine.map((t) => t.name).sort()).toEqual([...m.aiTools].sort());
        for (const t of m.aiTools) expect(ALL_TOOLS.filter((x) => x.name === t), t).toHaveLength(1);
      });

      it('names requirements, journeys, checks and migrations that exist', () => {
        expect(m.requirements.filter((r) => !requirements.includes(r))).toEqual([]);
        for (const j of m.journeys) {
          if (/^U\d+$/.test(j)) expect(journeys, j).toMatch(new RegExp(`^journey\\('${j}'`, 'm'));
          else if (/^F\d+$/.test(j)) expect(checks.some((f) => f.startsWith(j.slice(1) + '-')), j).toBe(true);
          else if (/^N\d+$/.test(j)) expect(checks.some((f) => f.startsWith('n' + j.slice(1) + '-')), j).toBe(true);
          else throw new Error(`${m.id}: ${j} is neither a journey (U…) nor a check (F…, N…)`);
        }
        for (const t of m.tables) expect(migrations, t.name).toContain(t.migration);
      });
    });
  }
});

describe('Building without a module (vite.modules.ts, FARO_WITHOUT)', () => {
  it('leaves out the module and everything that needs it, and refuses a name it doesn’t know', () => {
    expect(findModules(root, []).left).toEqual([]);
    const all = findModules(root).kept.map((m) => m.id);
    for (const id of all) expect(findModules(root, [id]).kept.map((m) => m.id)).not.toContain(id);
    expect(() => findModules(root, ['no-such-module'])).toThrow(/FARO_WITHOUT names no-such-module/);
  });
});

describe('Workspace sections from modules (backlog W)', () => {
  const core: { id: string; after?: string }[] = ['overview', 'people', 'teams', 'inbox'].map((id) => ({ id }));
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  it('puts a module’s section after the one it names, or at the end', () => {
    expect(ids(placeSections(core, [{ id: 'metrics', after: 'teams' }, { id: 'billing' }]))).toEqual(['overview', 'people', 'teams', 'metrics', 'inbox', 'billing']);
    expect(ids(placeSections(core, [{ id: 'x', after: 'nowhere' }]))).toEqual(['overview', 'people', 'teams', 'inbox', 'x']);
  });
  it('keeps two modules after the same section in their own order, and never adds an id twice', () => {
    expect(ids(placeSections(core, [{ id: 'a', after: 'people' }, { id: 'b', after: 'people' }, { id: 'teams' }]))).toEqual(['overview', 'people', 'a', 'b', 'teams', 'inbox']);
  });
});
