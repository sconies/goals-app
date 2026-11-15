const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:47101/goals?scope=all&view=map&as=amara'); await p.locator('.react-flow__node').first().waitFor();
await p.getByRole('button', { name: 'Unfold all' }).click(); await p.getByRole('button', { name: 'Fit all' }).click();
const n = p.locator('.react-flow__node[data-id="ns-ci"]'); const b0 = await n.boundingBox(); console.log(b0);
console.log(await p.evaluate(([x,y]) => { const e = document.elementFromPoint(x,y); return e.outerHTML.slice(0,120); }, [b0.x+30,b0.y+30]));
await p.mouse.move(b0.x + 30, b0.y + 30); await p.mouse.down(); await p.mouse.move(b0.x + 90, b0.y + 70, { steps: 6 }); await p.mouse.up();
console.log(await n.boundingBox()); await b.close(); })();
