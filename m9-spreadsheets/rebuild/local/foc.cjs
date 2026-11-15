const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:47911/data?as=amara');
await p.locator('.data-export > summary').click(); await p.getByRole('button', { name: 'Everything…' }).click();
await p.keyboard.press('Escape'); 
console.log(await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)), await p.evaluate(() => document.getElementById('export-everything').open));
await b.close(); })();
