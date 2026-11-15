import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const PORT=41010, B=`http://localhost:${PORT}`, PW='faro-standin', WS='ws_platform';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-'));
const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);
const env=(t)=>({...process.env,STANDIN_PORT:String(PORT),STANDIN_DATA:dir,STANDIN_TODAY:t,NODE_NO_WARNINGS:'1'});
await new Promise((res,rej)=>{const p=spawn(process.execPath,['platform/dist/server.mjs','seed',PW],{env:env('2026-11-15'),stdio:'ignore'});p.on('exit',c=>c?rej():res());});
let d=new DatabaseSync(path.join(dir,'faro.db'));const c0=d.prepare('select start_date, weeks from okr_cycles order by start_date desc limit 1').get();d.close();
const TODAY=addDays(addDays(c0.start_date,(c0.weeks-2+1)*7),1);
const sp=spawn(process.execPath,['platform/dist/server.mjs'],{env:env(TODAY),stdio:['ignore','pipe','inherit']});
await new Promise(r=>sp.stdout.on('data',x=>{if(/stand-in platform/.test(String(x)))r();}));
const NOW=TODAY+'T12:00:00.000Z';
function client(){let ck='';const c=async(m,u,b)=>{const r=await fetch(B+u,{method:m,redirect:'manual',headers:{...(ck?{cookie:ck}:{}),...(b!==undefined?{'Content-Type':'application/json'}:{})},body:b===undefined?undefined:JSON.stringify(b)});const s=r.headers.get('set-cookie');if(s)ck=s.split(';')[0];const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}return{status:r.status,json:j}};c.signIn=e=>c('POST','/api/signin',{email:e,password:PW});return c;}
const amara=client();await amara.signIn('amara.nwosu@example.com');
const snap=(await amara('GET',`/api/workspaces/${WS}`)).json;
const people=new Map(snap.people.map(x=>[x.id,x]));
const cycle=[...snap.cycles].sort((a,b)=>a.startDate<b.startDate?1:-1)[0];
const live=snap.goals.filter(g=>g.cycleId===cycle.id&&!g.removedAt&&g.status!=='proposed');
const goal=live.find(g=>{const o=people.get(g.ownerId);return o&&!o.admin&&!o.leftAt&&o.email});
const owner=people.get(goal.ownerId);
const other=snap.people.find(x=>!x.admin&&!x.leftAt&&x.email&&x.id!==owner.id);
const oth=client();await oth.signIn(other.email);const own=client();await own.signIn(owner.email);
let n=0;const nid=p=>`${p}_forge${++n}`;
const commit=(w,c)=>w('POST',`/api/workspaces/${WS}/commit`,c);
const chg=(by,g,entity,id,summary)=>({id:nid('chg'),at:NOW,actorId:by,goalId:g.id,entity,entityId:id,action:'posted',summary,diffs:[]});
const R=(by,g,x={})=>({id:nid('retro'),goalId:g.id,cycleId:cycle.id,result:'hit',learned:'Small steps each week worked.',next:'carry',byId:by,at:NOW,...x});
const out=[];const t=async(name,w,c)=>{const r=await commit(w,c);out.push(`${r.status===200?'ACCEPTED(forged)':'refused'} ${r.status} ${name} ${r.json?.error??''}`)};
const cnt=(tb)=>{const x=new DatabaseSync(path.join(dir,'faro.db'));const v=x.prepare(`select count(*) n from ${tb}`).get().n;x.close();return v};
// 1 non-owner retro on other's goal
let r1=R(other.id,goal);await t('retro on other goal as self',oth,{retros:[r1],changes:[chg(other.id,goal,'retro',r1.id,'x')]});
// 2 forged as owner
r1=R(owner.id,goal);await t('retro forged byId=owner',oth,{retros:[r1],changes:[chg(other.id,goal,'retro',r1.id,'x')]});
// 3 forged as admin
r1=R('amara',goal);await t('retro forged byId=admin',oth,{retros:[r1],changes:[chg(other.id,goal,'retro',r1.id,'x')]});
// 4 change-log entry only, about someone else's goal, wrap-up text
const before=cnt('okr_changes');
await t('changes-only entry "Wrapped up <others goal>" with no retro (actor=self)',oth,{changes:[chg(other.id,goal,'retro','retro_fake','Wrapped up '+goal.title+': hit it')]});
console.log('changes rows',before,'->',cnt('okr_changes'));
// 5 owner saves legit, then non-owner edits existing row via same id (byId keep owner)
const first=R(owner.id,goal);await t('owner legit',own,{retros:[first],changes:[chg(owner.id,goal,'retro',first.id,'ok')]});
await t('non-owner edits existing retro (byId=owner)',oth,{retros:[{...first,result:'missed',learned:'Rewritten by someone else.'}],changes:[chg(other.id,goal,'retro',first.id,'x')]});
await t('non-owner edits existing retro (byId=self)',oth,{retros:[{...first,result:'missed',learned:'Rewritten by someone else.',byId:other.id}],changes:[chg(other.id,goal,'retro',first.id,'x')]});
// 6 owner forges 'at' in the past and extra field
await t('owner edits own retro with forged at (1999)',own,{retros:[{...first,at:'1999-01-01T00:00:00.000Z',result:'partly'}],changes:[chg(owner.id,goal,'retro',first.id,'ok')]});
// 7 owner moves retro to another of their goals (same id, different goal)
const g2=live.find(g=>g.ownerId===owner.id&&g.id!==goal.id);
if(g2) await t('owner repoints existing retro to another own goal (same id)',own,{retros:[{...first,goalId:g2.id}],changes:[chg(owner.id,g2,'retro',first.id,'ok')]});
// 8 retro for removed/foreign workspace goal id
await t('retro for nonexistent goal',own,{retros:[R(owner.id,{id:'nope'})],changes:[]});
// 9 side effect: non-owner writes a new "copy" goal in a later cycle / modifies carried copy
const later=snap.cycles.find(c=>c.startDate>cycle.startDate);
console.log('later cycle exists',!!later);
// 10 non-owner commits goal edit of other's goal with retro in same commit
await t('non-owner edits others goal title',oth,{goals:[{...goal,title:'hijacked'}],changes:[chg(other.id,goal,'goal',goal.id,'x')]});
// 11 left-out / modules: non-admin sets modulesOff
await t('non-admin modulesOff',oth,{modulesOff:['wrap-up'],changes:[]});
// 12 retro by leaver? skip. Decision/watch/request/feedback kinds (core's) as non-owner:
await t('decision on others goal forged byId=admin',oth,{decisions:[{id:nid('dec'),goalId:goal.id,byId:'amara',at:NOW,choice:'approved',note:''}],changes:[chg(other.id,goal,'decision','d','x')]});
await t('watch for another person',oth,{watches:[{id:nid('w'),goalId:goal.id,personId:owner.id}],changes:[chg(other.id,goal,'watch','w','x')]});
console.log(out.join('\n'));
sp.kill();
