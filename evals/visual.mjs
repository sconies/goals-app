/* Screenshot comparison: renders the key screens of two builds the same way and reports which changed.
   node evals/visual.mjs capture <url> <dir>          screenshots of every screen into <dir>
   node evals/visual.mjs compare <before> <after> <dir> diff images and a Markdown summary into <dir>
   The clock is frozen and motion reduced, so the same build always draws the same pixels. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const FROZEN = new Date('2026-10-28T10:00:00Z');
const NOISE = 300;
const DEVICES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
/** [name, who is viewing, path]. Each runs on a fresh copy of the demo. */
export const SCREENS = [
  ['lead-home', 'maya', '/'],
  ['check-in', 'maya', '/check-in'],
  ['sponsor-home', 'elena', '/'],
  ['goals-outcomes', 'elena', '/goals'],
  ['goal-headline', 'elena', '/goals/head'],
  ['goal-milestone', 'aisha', '/goals/access'],
  ['goal-edit', 'sam', '/goals/lead/edit'],
  ['review', 'elena', '/review'],
  ['activity', 'maya', '/activity'],
  ['coach-home', 'priya', '/'],
  ['workspace', 'priya', '/workspace'],
  ['contributor-home', 'tom', '/'],
];

async function capture(base, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  for (const [device, viewport] of Object.entries(DEVICES)) {
    for (const [name, who, route] of SCREENS) {
      const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'light' });
      await ctx.addInitScript((v) => { if (!sessionStorage.getItem('visual')) { localStorage.clear(); localStorage.setItem('goals-app-viewer:example', v); sessionStorage.setItem('visual', '1'); } }, who);
      const page = await ctx.newPage();
      await page.clock.setFixedTime(FROZEN);
      await page.goto(base + route);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(dir, `${name}-${device}.png`), fullPage: true });
      await ctx.close();
    }
  }
  await browser.close();
}

function compare(beforeDir, afterDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const names = [...new Set([...fs.readdirSync(beforeDir), ...fs.readdirSync(afterDir)])].filter((f) => f.endsWith('.png')).sort();
  const rows = [];
  for (const f of names) {
    const a = path.join(beforeDir, f), b = path.join(afterDir, f);
    if (!fs.existsSync(a)) { rows.push([f, 'new screen']); continue; }
    if (!fs.existsSync(b)) { rows.push([f, 'removed']); continue; }
    const pa = PNG.sync.read(fs.readFileSync(a)), pb = PNG.sync.read(fs.readFileSync(b));
    if (pa.width !== pb.width || pa.height !== pb.height) { rows.push([f, `size changed ${pa.width}×${pa.height} → ${pb.width}×${pb.height}`]); fs.copyFileSync(b, path.join(outDir, f)); continue; }
    const diff = new PNG({ width: pa.width, height: pa.height });
    const n = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { threshold: 0.1 });
    // Text anti-aliasing can shift a few hundred pixels between identical runs; one changed word is several times that.
    if (n > NOISE) {
      fs.writeFileSync(path.join(outDir, f.replace('.png', '-diff.png')), PNG.sync.write(diff));
      fs.copyFileSync(b, path.join(outDir, f));
      rows.push([f, `${((n / (pa.width * pa.height)) * 100).toFixed(2)}% of pixels changed`]);
    }
  }
  const md = rows.length
    ? `## Screens that look different\n\n${rows.length} of ${names.length} screenshots changed. The new versions and their diffs are in the \`visual-changes\` artifact.\n\n| Screen | Change |\n|---|---|\n${rows.map(([f, c]) => `| ${f.replace('.png', '')} | ${c} |`).join('\n')}\n`
    : `## Screens that look different\n\nNone: all ${names.length} screenshots match the base branch.\n`;
  fs.writeFileSync(path.join(outDir, 'summary.md'), md);
  console.log(md);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'capture') await capture(args[0], args[1]);
else if (cmd === 'compare') compare(args[0], args[1], args[2]);
else { console.error('usage: visual.mjs capture <url> <dir> | compare <before> <after> <dir>'); process.exit(2); }
