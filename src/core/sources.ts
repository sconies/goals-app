/* For the tests that keep the app's lists true (the guide, the named flows, MCP parity): where its routes and screens
   are, now that feature modules add their own. Node only: it reads the source files. */
import fs from 'node:fs';
import path from 'node:path';
import type { Article } from '../help/guide';
import type { ModuleFacts } from './module';
import { MODULES } from './registry';

/** Every route: App.tsx's own, each module's (module.json `routes`), the old addresses modules lead on, and the
    Workspace sections modules add (/workspace/<id>). */
export function appRoutes(root: string): string[] {
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  return [...[...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]!), ...MODULES.flatMap((m) => [...m.routes, ...m.redirects.map(([from]) => from), ...(m.sections ?? []).map((id) => `/workspace/${id}`)])];
}

/** Every screen file, by name without .tsx: src/screens, and each module's components (a capitalised .tsx in its folder). */
export function screenFiles(root: string): { name: string; file: string }[] {
  const dir = (d: string) => (fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)) : []).filter((f) => /^[A-Z].*\.tsx$/.test(f)).map((f) => ({ name: f.replace('.tsx', ''), file: path.join(root, d, f) }));
  return [...dir('src/screens'), ...MODULES.flatMap((m) => dir(`src/modules/${m.id}`))];
}

/** Every module in src/modules, read from its module.json, whether this build has it or not. */
export function allModules(root: string): ModuleFacts[] {
  const dir = path.join(root, 'src/modules');
  return (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((d) => fs.existsSync(path.join(dir, d, 'module.json'))).sort()
    .map((d) => JSON.parse(fs.readFileSync(path.join(dir, d, 'module.json'), 'utf8')) as ModuleFacts);
}

/** What this build leaves out (FARO_WITHOUT): the modules, and their Help articles, requirements, AI tools and screens,
    so the checks that a list is complete excuse exactly those, and the scenarios that need a module skip without it. */
export function leftOut(root: string) {
  const built = new Set(MODULES.map((m) => m.id));
  const gone = allModules(root).filter((m) => !built.has(m.id));
  return {
    modules: new Set(gone.map((m) => m.id)),
    help: new Set(gone.flatMap((m) => m.help)),
    requirements: new Set(gone.flatMap((m) => m.requirements)),
    aiTools: new Set(gone.flatMap((m) => m.aiTools)),
  };
}

/** The Help articles of the modules this build leaves out, read from their help.ts: the screens those articles explain
    are the module's, even where (until FT3) the files still sit in src/screens. */
export async function leftOutArticles(root: string): Promise<Article[]> {
  const gone = [...leftOut(root).modules].map((id) => path.join(root, 'src/modules', id, 'help.ts')).filter((f) => fs.existsSync(f));
  return (await Promise.all(gone.map(async (f) => ((await import(/* @vite-ignore */ f)) as { default: Article[] }).default))).flat();
}
