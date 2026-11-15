const B='http://localhost:42020', WS='ws_platform', PW='faro-standin';
function client(){let cookie='';const c=async(m,u,b)=>{const r=await fetch(B+u,{method:m,redirect:'manual',headers:{...(cookie?{cookie}:{}),'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});const s=r.headers.get('set-cookie');if(s)cookie=s.split(';')[0];const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}return{status:r.status,json:j,text:t}};c.in=e=>c('POST','/api/signin',{email:e,password:PW});return c}
const rhea=client(),pavel=client(),amara=client();
await rhea.in('rhea.kapoor@example.com');await pavel.in('pavel.novak@example.com');await amara.in('amara.nwosu@example.com');
const snap=(await rhea('GET',`/api/workspaces/${WS}`)).json;
const commit=(c,b)=>c('POST',`/api/workspaces/${WS}/commit`,b);
const now=()=>new Date().toISOString();let n=0;const id=p=>`${p}_forge_${++n}`;
const pw=snap.watches.find(w=>w.personId==='pavel'&&!w.removedAt&&w.kind!=='level');
const rg=snap.goals.find(g=>g.ownerId==='rhea'&&!g.removedAt);
const pg=snap.goals.find(g=>g.ownerId==='pavel'&&!g.removedAt);
const pwOnRhea=snap.watches.find(w=>w.personId==='pavel'&&w.ref===rg.id); 
const out=(k,r)=>console.log(k.padEnd(70),r.status,(r.json?.error??'').slice(0,80));
const log=(actor,ent,eid,act)=>({id:id('chg'),at:now(),actorId:actor,goalId:null,entity:ent,entityId:eid,action:act,summary:'x',diffs:[]});
// F1: rhea writes own goal edit + victim (pavel) NEW watch on her goal with a key match? new copy needs same-key live watch by pavel on other goal
const keyed=snap.goals.find(g=>g.id===pw.ref);
out('F1 new goal w/ key of pavel-watched goal + forged pavel watch',await commit(rhea,{goals:[{...rg,id:id('g'),key:keyed.key,ownerId:'rhea',title:'forged'}],watches:[{id:id('w'),personId:'pavel',kind:'goal',ref:'__'}],changes:[]}));
const gid=id('g');
out('F1b same, ref=new goal id',await commit(rhea,{goals:[{...rg,id:gid,key:keyed.key,ownerId:'rhea',title:'forged'}],watches:[{id:id('w'),personId:'pavel',kind:'goal',ref:gid}],changes:[]}));
// F2: pavel watches rhea's goal (own act), then rhea stops it riding on her own goal edit, no watch changelog
const w2={id:id('w'),personId:'pavel',kind:'goal',ref:rg.id};
out('F2a pavel watches rhea goal (own)',await commit(pavel,{watches:[w2],changes:[]}));
out('F2b rhea stops pavel watch of her goal riding a goal edit',await commit(rhea,{goals:[{...rg,title:rg.title+' '}],watches:[{...w2,removedAt:now(),removedBy:'rhea'}],changes:[{...log('rhea','goal','x','edited'),goalId:rg.id,entityId:rg.id}]}));
out('F2c rhea RESTORES/creates... pavel watch again riding goal edit',await commit(rhea,{goals:[{...rg,title:rg.title.trimEnd()}],watches:[{...w2,removedAt:null,removedBy:null}],changes:[{...log('rhea','goal','x','edited'),goalId:rg.id,entityId:rg.id}]}));
// F3: forged changelog entry about a watch as rhea for someone else (changes only)
out('F3 forged watch change-log row only',await commit(rhea,{changes:[log('rhea','watch',pw.id,'removed')]}));
// F4: member forges change-log as another actor
out('F4 changelog actor=pavel',await commit(rhea,{changes:[log('pavel','watch',pw.id,'removed')]}));
// F5: level watch for another person
out('F5 level watch for pavel',await commit(rhea,{watches:[{id:id('w'),personId:'pavel',kind:'level',ref:'objective'}],changes:[]}));
// F6: tree kind watch forged as pavel via goal edit carry
const gid2=id('g');
out('F6 tree watch for pavel on rhea new goal w/o key match',await commit(rhea,{goals:[{...rg,id:gid2,key:'ZZ-1',ownerId:'rhea',title:'f6'}],watches:[{id:id('w'),personId:'pavel',kind:'tree',ref:gid2}],changes:[]}));
// F7: any member writes the old watch record with unchanged -> ok; delete w/ unwatch nonexistent
out('F7 unwatch of unknown id',await commit(rhea,{unwatch:['nope'],changes:[]}));
// F8: leaver: rhea marks pavel left? 
out('F8 rhea marks pavel left',await commit(rhea,{people:[{...snap.people.find(p=>p.id==='pavel'),leftAt:now(),leftBy:'rhea'}],changes:[]}));
// F9 rhea sets own watch ON someone's goal fine; rhea watches with personId rhea but mismatched kind garbage
out('F9 own watch garbage ref',await commit(rhea,{watches:[{id:id('w'),personId:'rhea',kind:'goal',ref:'does-not-exist'}],changes:[]}));
// F10 token route: watch tool for others? skip
const after=(await amara('GET',`/api/workspaces/${WS}`)).json.watches;
console.log('pavel watches on rhea goal now:',after.filter(w=>w.personId==='pavel'&&w.ref===rg.id).map(w=>({id:w.id,removed:w.removedAt})));
console.log('forged pavel watches:',after.filter(w=>w.personId==='pavel'&&String(w.id).includes('forge')).length);
const gid3=id('g');
out('F1c new goal w/ pavel-watched key + forged pavel watch SAME kind='+pw.kind,await commit(rhea,{goals:[{...rg,id:gid3,key:keyed.key,ownerId:'rhea',title:'forged c'}],watches:[{id:id('w'),personId:'pavel',kind:pw.kind,ref:gid3}],changes:[]}));
// F11 module-off bypass: is own detection evadable while off? (module on here) -- skip
// F12 member unwatches... deletion of pavel's removed(stopped) watch via ride-along? unwatch checked.
// F13 non-owner restore of stopped watch by riding a goal edit (Pavel stopped his own watch on rhea goal)
const w13={id:id('w'),personId:'pavel',kind:'goal',ref:rg.id};
out('F13a pavel watches again',await commit(pavel,{watches:[w13],changes:[]}));
out('F13b pavel stops own',await commit(pavel,{watches:[{...w13,removedAt:now(),removedBy:'pavel'}],changes:[{...log('pavel','watch',w13.id,'removed')}]}));
out('F13c rhea restores it riding goal edit (no admin, not stopper)',await commit(rhea,{goals:[{...rg,title:rg.title+'  '}],watches:[{...w13,removedAt:null,removedBy:null}],changes:[{...log('rhea','goal',rg.id,'edited'),goalId:rg.id}]}));
