const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('console', m => console.log('console', m.text())); p.on('pageerror', e => console.log('err', e.message));
await p.goto('http://localhost:47342/goals/lead-flaky?as=amara'); const blk = p.locator('[data-part="Fields"]');
console.log(await blk.innerHTML()); await blk.getByRole('button', { name: 'Change Stage' }).click();
console.log(await blk.locator('form').evaluate(f => [f.hidden, getComputedStyle(f).display])); await b.close(); })();
