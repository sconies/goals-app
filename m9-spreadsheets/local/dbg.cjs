const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const c = await b.newContext(); await c.addCookies([{ name: 'as', value: 'amara', url: 'http://localhost:4180' }]);
  const p = await c.newPage(); p.on('console', m => console.log('console', m.text())); p.on('pageerror', e => console.log('err', e.message));
  await p.goto('http://localhost:4180/data/import');
  await p.getByRole('button', { name: 'or paste rows from a spreadsheet' }).click();
  await p.getByLabel('Paste rows from a spreadsheet').fill('Goal name\tOwner\tTeam\tUnit\tStart\tTargett\nPasted cache hit rate\tRhea Kapoor\tCI/CD\t%\t20\t90\n');
  await p.getByRole('button', { name: 'Check these rows' }).click(); await p.waitForLoadState();
  console.log(p.url()); console.log((await p.locator('body').innerText()).slice(0, 1500));
  await b.close();
})();
