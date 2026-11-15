import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const B = 'http://localhost:47102';
const b = await chromium.launch();
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  p.on('console', (m) => console.log('console', m.text()));
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(`${B}/goals/ns-lead?as=rhea`);
  await p.waitForTimeout(300);
  const live = await p.screenshot();
  const t0 = Date.now();
  await p.keyboard.press('Control+Shift+M');
  await p.locator('.markup-root').waitFor();
  console.log('capture ms', Date.now() - t0);
  const shot = await p.locator('.mk-shot').getAttribute('src');
  const diff = await p.evaluate(async ([a, bb]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [x, y] = await Promise.all([load(a), load(bb)]);
    const c = (i) => { const k = document.createElement('canvas'); k.width = x.width; k.height = x.height; const g = k.getContext('2d'); g.drawImage(i, 0, 0, x.width, x.height); return g.getImageData(0, 0, x.width, x.height).data; };
    const A = c(x), Bd = c(y); let n = 0;
    for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - Bd[i]) + Math.abs(A[i + 1] - Bd[i + 1]) + Math.abs(A[i + 2] - Bd[i + 2]) > 48) n++;
    return [n / (A.length / 4), x.width, x.height, y.width, y.height];
  }, ['data:image/png;base64,' + live.toString('base64'), shot]);
  console.log(vp.width, 'differs', diff);
  await p.screenshot({ path: `/tmp/claude-0/-home-user-goals-app/8ddaa217-c92b-5e8f-a1b8-4bccda268de4/scratchpad/m5-feedback/local/mk-${vp.width}.png` });
}
await b.close();
