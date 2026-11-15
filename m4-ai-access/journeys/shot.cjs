const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addCookies([{ name: 'as', value: process.argv[3] || 'rhea', url: 'http://localhost:4173' }]);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('pageerror', e.message));
    await p.goto('http://localhost:4173' + (process.argv[2] || '/'));
    await p.screenshot({ path: `local/shot-${w}.png`, fullPage: false });
    await ctx.close();
  }
  await b.close();
})();
