const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const c = await b.newContext(); await c.addCookies([{ name: 'as', value: 'mateo', url: 'http://localhost:4180' }]);
  const p = await c.newPage(); p.on('pageerror', e => console.log('err', e.message)); p.on('console', m => console.log('console', m.text()));
  await fetch('http://localhost:4180/__reset', { method: 'POST' });
  await p.goto('http://localhost:4180/data/import');
  const f = (n, t) => ({ name: n, mimeType: 'text/csv', buffer: Buffer.from(t) });
  await p.locator('#sheetfile').setInputFiles(f('goals.csv', 'Goal,Owner,Unit,Start,Target,Plan from week,Feeds into\nRunbooks with an owner,Mateo Fernández,%,40,90,40,Mean time to restore service (P1 and P2)\n'));
  await p.waitForURL(/check/); await p.getByRole('button', { name: 'Save 1 change' }).click(); await p.waitForLoadState();
  console.log(p.url());
  await p.goto('http://localhost:4180/data/import');
  await p.locator('#sheetfile').setInputFiles(f('history.csv', 'Goal,Week,Value\nRunbooks with an owner,43,52\nRunbooks with an owner,47,58\n'));
  await p.waitForURL(/check/); console.log('count sheetfile', await p.locator('#sheetfile').count(), await p.locator('#pick').count());
  await p.locator('#sheetfile').setInputFiles(f('history.csv', 'Goal,Week,Value\nRunbooks with an owner,43,52\nRunbooks with an owner,44,55\n'));
  await p.waitForTimeout(1500); console.log(p.url(), (await p.locator('body').innerText()).slice(0, 700));
  const j = await (await fetch('http://localhost:4180/export/json?scope=all', { headers: { cookie: 'as=mateo' } })).json();
  console.log(JSON.stringify(j.goals.find(g => g.title === 'Runbooks with an owner').plan).slice(0, 300));
  await b.close();
})();
