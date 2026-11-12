/* Pictures of every screen for the kit (KT gap 3): each core screen, and each view with a SHOT in src/spec/screens.ts,
   at 390 and 1440 wide, on the demo as it stands on the conformance day, into spec/core/screens/. spec/core/screens.md
   shows them; npm run spec keeps them (it makes the page, this makes the pictures).
   npm run spec:shots              build the app, then take every picture
   npm run spec:shots -- --no-build  use the build already in dist/
   npm run spec:shots -- Home Find   only these (by screen or view name)
   The clock is frozen and motion reduced, so the same build draws the same pixels, and a picture is rewritten only when
   its bytes change. JPEG at 72, each cut at 2400px tall on a phone and 1800px on a desktop, to keep the kit small. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const OUT = path.join(root, 'spec/core/screens');
const TODAY = '2026-11-05';
const FROZEN = new Date('2026-11-05T10:00:00Z');
const PORT = 4320;

const loader = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
const { SHOTS, WIDTHS, shotFile } = await loader.ssrLoadModule('/src/spec/screens.ts');
await loader.close();

if (!args.includes('--no-build')) {
  const b = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (b.status) process.exit(b.status);
}
const VITE = path.join(root, 'node_modules/vite/bin/vite.js');
const server = spawn(process.execPath, [VITE, 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
const base = `http://localhost:${PORT}`;
for (let i = 0; ; i++) {
  try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ }
  if (i > 100) throw new Error('vite preview did not start');
  await new Promise((r) => setTimeout(r, 200));
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let wrote = 0, same = 0;
try {
  for (const [name, shot] of Object.entries(SHOTS)) {
    if (only.length && !only.includes(name)) continue;
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: 'reduce', colorScheme: 'light' });
      await ctx.addInitScript((v) => { if (!sessionStorage.getItem('shot')) { localStorage.clear(); if (v) localStorage.setItem('goals-app-viewer:platform-org', v); sessionStorage.setItem('shot', '1'); } }, shot.who);
      const page = await ctx.newPage();
      await page.clock.setFixedTime(FROZEN);
      await page.goto(`${base}${shot.live ? '' : '/demo'}${shot.at}${shot.at.includes('?') ? '&' : '?'}${shot.live ? 'store=browser&' : ''}today=${TODAY}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(500);
      if (shot.keys) { await page.keyboard.press(shot.keys); await page.waitForTimeout(400); }
      const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), width < 600 ? 2400 : 1800);
      const buf = await page.screenshot({ fullPage: true, clip: { x: 0, y: 0, width, height }, animations: 'disabled', type: 'jpeg', quality: 72 });
      const file = path.join(OUT, shotFile(name, width));
      if (fs.existsSync(file) && fs.readFileSync(file).equals(buf)) same++;
      else { fs.writeFileSync(file, buf); wrote++; }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`Wrote ${wrote} pictures to spec/core/screens; ${same} unchanged.`);

