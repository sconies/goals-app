/* Writes Faro's icons from the mark's paths (src/ui/brandIcons.ts): public/favicon.svg, public/manifest.webmanifest and
   the PNGs in public/icons (rendered in Chromium, so they match the SVG exactly).
   npm run icons            rewrite them
   src/ui/brandIcons.test.ts fails when the committed files no longer match the code. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (f) => path.join(root, 'public', f);
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { iconSvg, ICON_FILES, manifest } = await server.ssrLoadModule('/src/ui/brandIcons.ts');
  fs.writeFileSync(pub('favicon.svg'), iconSvg('favicon'));
  fs.writeFileSync(pub('manifest.webmanifest'), JSON.stringify(manifest(), null, 2) + '\n');
  fs.mkdirSync(pub('icons'), { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const { file, size, kind } of ICON_FILES) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${iconSvg(kind)}`);
      await page.locator('svg').screenshot({ path: pub(file), omitBackground: true });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(`Wrote public/favicon.svg, public/manifest.webmanifest and ${ICON_FILES.length} icons.`);
} finally {
  await server.close();
}
