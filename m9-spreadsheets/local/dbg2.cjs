const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ acceptDownloads: true }); await c.addCookies([{ name: 'as', value: 'amara', url: 'http://localhost:4180' }]);
  const p = await c.newPage(); p.on('pageerror', e => console.log('err', e.message));
  await p.goto('http://localhost:4180/goals?scope=all');
  await p.locator('[data-export-open]').first().click();
  const [d] = await Promise.all([p.waitForEvent('download'), p.locator('#exportdlg .export-go').click()]);
  const f = await d.path(); console.log(d.suggestedFilename(), require('fs').statSync(f).size);
  await p.goto('http://localhost:4180/data/import');
  const t0 = Date.now();
  await p.locator('#sheetfile').setInputFiles({ name: d.suggestedFilename(), mimeType: 'application/octet-stream', buffer: require('fs').readFileSync(f) });
  await p.waitForURL(/check|reading/, { timeout: 30000 }).catch((e) => console.log('wait', e.message.split('\n')[0]));
  await p.waitForURL(/check$/, { timeout: 30000 }).catch((e) => console.log('wait2', e.message.split('\n')[0]));
  console.log(Date.now() - t0, p.url()); console.log((await p.locator('body').innerText()).slice(0, 600));
  await b.close();
})();
