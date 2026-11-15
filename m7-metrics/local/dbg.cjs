const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const c = await b.newContext(); await c.addCookies([{ name: 'as', value: 'rhea', url: 'http://localhost:4176' }]); const p = await c.newPage();
await p.goto('http://localhost:4176/metrics/flaky-rate/edit'); await p.locator('summary', { hasText: 'Where it sits' }).click();
await p.locator('#parent').selectOption({ label: 'Lead time for changes' }); await p.locator('#level').selectOption('control'); await p.locator('#confidence').selectOption('medium');
await p.fill('#gaming', 'Retrying.'); await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForLoadState('load');
console.log(p.url(), (await p.locator('body').innerText()).replace(/\s+/g,' ').slice(0,300));
await p.goto('http://localhost:4176/metrics/lead-time/edit'); console.log(await p.locator('details').getAttribute('open')); await p.locator('summary', { hasText: 'Where it sits' }).click();
console.log(await p.locator('#parent option').allInnerTexts());
await b.close(); })();
