/* The module platform's page (drill 11, fix 1) says what Faro's code says: every sentence it reads from a file is still
   written there, every place has its words, and each spot and hook the core still draws for a module is checked
   against the code that draws it, not a comment (build review of #547): the code each one names, what it says is
   absent, its button words, and the rules behind it that can be run here. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLACES } from '../core/module';
import { buildPlatformOrg } from '../data/platformOrg';
import { startPage } from '../domain/startYear';
import { standingAction } from '../domain/goalPage';
import { CORE_NAV } from '../domain/navigation';
import type { Retro } from '../domain/types';
import { CORE_HOOKS, CORE_SPOTS, DOOR, OFF_SENTENCES, PLACE_WORDS, type CodeSays } from './modulePlatform';
import { STAGE3_BUILD } from './stage3Kit';

const root = path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
/** A file's code with its comments left out (block comments, JSX comments, and line comments not in an address). */
const codeOf = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
const MODULES = fs.readdirSync(path.join(root, 'src/modules')).filter((d) => fs.existsSync(path.join(root, 'src/modules', d, 'module.json')));
const facts = (id: string) => JSON.parse(read(`src/modules/${id}/module.json`)) as { name: string };
const spot = (name: string) => CORE_SPOTS.find((x) => x.name === name)!;
/** What a list of code checks finds wrong: each as `{file}: has|hasNot {text}`. */
const wrong = (code: CodeSays[]) => code.flatMap((c) => {
  const src = codeOf(c.file);
  return [...c.has.filter((x) => !src.includes(x)).map((x) => `${c.file}: has ${x}`), ...(c.hasNot ?? []).filter((x) => src.includes(x)).map((x) => `${c.file}: hasNot ${x}`)];
});

describe('the module platform page', () => {
  it('words every place, and no place that is gone', () => {
    expect(Object.keys(PLACE_WORDS).sort()).toEqual([...PLACES].sort());
  });

  it('finds each sentence it reads from a file still written there', () => {
    const missing = [...OFF_SENTENCES.filter((x) => x.needle), ...DOOR].filter((x) => !read(x.from).includes(x.needle!)).map((x) => `${x.from}: ${x.needle}`);
    expect(missing).toEqual([]);
  });

  it('leaves comments out when it reads code', () => {
    expect(codeOf('src/screens/GoalViews.tsx')).not.toContain('goalMapOn');
    expect(codeOf('src/screens/GoalViews.tsx')).toContain("isLayout(v) && (map || v !== 'map')");
  });

  it('finds what each spot and hook says in the code that draws it, comments left out, and not what it says is absent (build review of #547)', () => {
    const all = [...CORE_SPOTS, ...CORE_HOOKS];
    expect(all.filter((x) => !x.code.length).map((x) => x.name)).toEqual([]);
    expect(all.flatMap((x) => wrong(x.code).map((w) => `${x.name}: ${w}`))).toEqual([]);
    expect(all.flatMap((x) => x.modules.filter((m) => !MODULES.includes(m)).map((m) => `${x.name}: ${m}`))).toEqual([]);
  });

  it('names only buttons the code draws, where a spot lists its button words', () => {
    const names = new Set(MODULES.flatMap((m) => facts(m).name.split(/\s+/)));
    const esc = (l: string) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const x of CORE_SPOTS.filter((s) => s.labels)) {
      const src = x.code.map((c) => codeOf(c.file)).join('\n');
      expect(x.labels!.filter((l) => !new RegExp(`['"\`>]${esc(l)}['"\`<]`).test(src)), x.name).toEqual([]);
      const firsts = new Set(x.labels!.map((l) => l.split(' ')[0]));
      expect((x.faro.match(/\b[A-Z][\w-]*/g) ?? []).filter((w) => !firsts.has(w) && !names.has(w)), x.name).toEqual([]);
    }
  });
});

describe('the spots’ words, against the rules that draw them (build review of #547)', () => {
  it('cycles.start: what carries on, finishes and stops is the same with the Wrap-up and Watching off, and the words say so', () => {
    const s = buildPlatformOrg(new Date('2026-11-05T12:00:00Z'));
    const cycle = s.cycles[0]!;
    const goal = s.goals.find((g) => g.cycleId === cycle.id && !g.stoppedAt && !g.removedAt)!;
    const stop: Retro = { id: 'r-stop', goalId: goal.id, cycleId: cycle.id, result: 'missed', learned: 'Not worth it.', next: 'stop', byId: goal.ownerId, at: '2026-12-21T12:00:00Z' };
    const rows = { ...s, retros: [...(s.retros ?? []).filter((r) => r.goalId !== goal.id), stop] };
    const day = new Date('2026-12-21T12:00:00Z');
    const on = startPage(rows, cycle, day), off = startPage(rows, cycle, day, { wrapUp: false, watching: false });
    expect(on.readBack!.kinds.get(goal.id)).toBe('stop');
    expect([...off.readBack!.kinds]).toEqual([...on.readBack!.kinds]);
    expect(off.counts.map((c) => c.n)).toEqual(on.counts.map((c) => c.n));
    const words = spot('cycles.start').faro;
    expect(words).toContain('whether the Wrap-up is on or off');
    expect(words).toContain('whether Watching is on or off');
    const said = [words, ...STAGE3_BUILD, read('src/modules/wrap-up/module.json')].join('\n');
    expect(said).not.toMatch(/\b(read|carr)\w*[^.;\n]*\bwhile (the Wrap-up|Watching) is on/);
  });

  it('menu.count: only the rows the shell counts are said to have a count', () => {
    const line = codeOf('src/ui/Shell.tsx').match(/const count = \(id: NavId\) => \((.*)\);/)![1]!;
    const counted = [...line.matchAll(/id === '(\w+)'/g)].map((m) => m[1]!);
    expect(counted.length).toBeGreaterThan(0);
    const x = spot('menu.count');
    for (const id of counted) {
      const name = x.modules.includes(id) ? facts(id).name : CORE_NAV[id as keyof typeof CORE_NAV].label;
      expect(x.faro, id).toMatch(new RegExp(`${name}(’s|’)? row`));
    }
    for (const id of x.modules.filter((m) => !counted.includes(m))) {
      expect(x.faro, id).not.toMatch(new RegExp(`${facts(id).name}(’s|’)? row (its|counts|has)`));
      expect(x.faro, id).toContain('no other row has a count');
    }
  });

  it('goal.buttons: the owner never has a watch button, and with Watching off nobody does', () => {
    const s = buildPlatformOrg(new Date('2026-11-05T12:00:00Z'));
    const goal = s.goals.find((g) => !g.stoppedAt)!;
    const owner = s.people.find((p) => p.id === goal.ownerId)!, other = s.people.find((p) => p.id !== goal.ownerId)!;
    const primary = { kind: 'none' } as unknown as Parameters<typeof standingAction>[0]['primary'];
    const at = (viewer: typeof owner, watching: boolean | null) => standingAction({ goal, viewer, primary, watching, status: 'on' as never }).kind;
    expect([at(owner, true), at(owner, false)].filter((k) => k === 'watch' || k === 'watching')).toEqual([]);
    expect(at(other, null)).toBe(null);
    expect([at(other, false), at(other, true)]).toEqual(['watch', 'watching']);
  });
});
