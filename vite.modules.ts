/* The module registry, made by the build (docs/architecture.md). Every folder in src/modules with a module.json is a
   module; the core reads them through these virtual imports and never imports a module itself:

     virtual:faro-modules        each module's module.json (the facts)
     virtual:faro-modules/help   each module's help.ts (its Help articles)
     virtual:faro-modules/tools  each module's tools.ts (its AI tools)
     virtual:faro-modules/app    each module's app.tsx (its routes, navigation and places on core screens)

   FARO_WITHOUT=spreadsheets[,other] builds Faro with those modules left out, and anything that needs them: CI builds
   it that way for each module and runs the core journeys (.github/workflows/ci.yml). */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const PARTS = { '': 'module.json', '/help': 'help.ts', '/tools': 'tools.ts', '/app': 'app.tsx' } as const;
const PREFIX = 'virtual:faro-modules';

interface Found { id: string; needs: string[]; dir: string }

/** The modules in src/modules, and those left out (asked for, or needing one that was). */
export function findModules(root: string, without: string[] = []): { kept: Found[]; left: string[] } {
  const base = path.join(root, 'src', 'modules');
  const all: Found[] = (fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }) : [])
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, 'module.json')))
    .map((d) => ({ id: d.name, dir: path.join(base, d.name), needs: (JSON.parse(fs.readFileSync(path.join(base, d.name, 'module.json'), 'utf8')) as { needs?: string[] }).needs ?? [] }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const unknown = without.filter((w) => !all.some((m) => m.id === w));
  if (unknown.length) throw new Error(`FARO_WITHOUT names ${unknown.join(', ')}, but src/modules has only ${all.map((m) => m.id).join(', ') || 'no modules'}`);
  const left = new Set(without);
  for (let changed = true; changed;) {
    changed = false;
    for (const m of all) if (!left.has(m.id) && m.needs.some((n) => left.has(n))) { left.add(m.id); changed = true; }
  }
  return { kept: all.filter((m) => !left.has(m.id)), left: [...left].sort() };
}

export function faroModules(): Plugin {
  const without = (process.env.FARO_WITHOUT ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  let root = process.cwd();
  return {
    name: 'faro-modules',
    configResolved(c) {
      root = c.root;
      const { left } = findModules(root, without);
      if (left.length) c.logger.info(`Faro modules left out of this build: ${left.join(', ')}`);
    },
    resolveId(id) {
      return id === PREFIX || id.startsWith(PREFIX + '/') ? '\0' + id : null;
    },
    load(id) {
      if (!id.startsWith('\0' + PREFIX)) return null;
      const part = id.slice(PREFIX.length + 1) as keyof typeof PARTS;
      const file = PARTS[part];
      if (!file) throw new Error(`No such part of the module registry: ${id.slice(1)}`);
      const { kept } = findModules(root, without);
      const lines: string[] = [];
      const entries: string[] = [];
      for (const [i, m] of kept.entries()) {
        const f = path.join(m.dir, file);
        if (!fs.existsSync(f)) continue;
        this.addWatchFile(f);
        lines.push(`import m${i} from ${JSON.stringify(f.split(path.sep).join('/'))};`);
        entries.push(file === 'module.json' ? `m${i}` : `{ id: ${JSON.stringify(m.id)}, part: m${i} }`);
      }
      return `${lines.join('\n')}\nexport default [${entries.join(', ')}];\n`;
    },
  };
}
