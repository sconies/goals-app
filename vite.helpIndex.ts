/* The Help index, made by the build: each guide article's id, title and routes, and each What's new release's id, date
   and title, without their text. The first download reads this (src/help/lookup.ts) for the Help link on every page,
   page names, telemetry's routes and the unread dot; the full guide and What's new load only when Help is opened.

     virtual:faro-help-index   { articles, moved, news }

   It is read from src/help/guide.ts and src/help/whatsNew.ts themselves (loaded in a small Vite server, the way
   npm run spec reads the code), so they stay the only source, and a build without a module (FARO_WITHOUT) leaves out
   its articles too. src/help/lookup.test.ts checks the index matches them. */
import path from 'node:path';
import { createServer, type Plugin } from 'vite';
import { faroModules } from './vite.modules.ts';

const ID = 'virtual:faro-help-index';
const SOURCES = ['src/help/guide.ts', 'src/help/whatsNew.ts'];

export interface HelpIndex {
  articles: { id: string; title: string; routes: string[]; module?: string }[];
  moved: Record<string, string>;
  news: { id: string; date: string; title: string }[];
}

async function readIndex(root: string): Promise<HelpIndex> {
  const server = await createServer({
    root, configFile: false, plugins: [faroModules()], logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const guide = await server.ssrLoadModule('/src/help/guide.ts') as typeof import('./src/help/guide');
    const news = await server.ssrLoadModule('/src/help/whatsNew.ts') as typeof import('./src/help/whatsNew');
    return {
      articles: guide.ARTICLES.map((a) => ({ id: a.id, title: a.title, routes: a.routes, ...(a.module ? { module: a.module } : {}) })),
      moved: guide.MOVED_ARTICLES,
      news: news.WHATS_NEW.map((e) => ({ id: e.id, date: e.date, title: e.title })),
    };
  } finally {
    await server.close();
  }
}

export function faroHelpIndex(): Plugin {
  let root = process.cwd();
  let made: Promise<string> | null = null;
  return {
    name: 'faro-help-index',
    configResolved(c) { root = c.root; },
    resolveId(id) { return id === ID ? '\0' + ID : null; },
    async load(id) {
      if (id !== '\0' + ID) return null;
      for (const f of SOURCES) this.addWatchFile(path.join(root, f));
      made ??= readIndex(root).then((index) => `export default ${JSON.stringify(index)};\n`);
      return made;
    },
    // In the dev server, a change to the guide or What's new makes the index again.
    watchChange(file) { if (SOURCES.some((f) => file.endsWith(f))) made = null; },
    handleHotUpdate({ file }) { if (SOURCES.some((f) => file.endsWith(f))) made = null; },
  };
}
