const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const B='http://localhost:47953'; await fetch(B+'/__reset',{method:'POST'});
 const b=await chromium.launch(); const c=await b.newContext(); await c.addCookies([{name:'as',value:'amara',url:B}]); const p=await c.newPage();
 await fetch(B+'/workspace/fields/add',{method:'POST',headers:{cookie:'as=amara','content-type':'application/x-www-form-urlencoded'},body:'name=Stage&kind=list&values=Discover%0ABuild%0ARun'});
 await p.goto(B+'/data/import'); fs.writeFileSync('local/stages.csv','Key,Stage\r\nG-11,Operate\r\nG-23,Operate\r\n');
 await Promise.all([p.waitForNavigation(), p.getByLabel('Choose a spreadsheet').setInputFiles('local/stages.csv')]);
 console.log((await p.locator('main').innerText()).slice(0,800)); await b.close(); })();
