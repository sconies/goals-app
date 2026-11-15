import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PORT = 42020, B = `http://localhost:${PORT}`, WS = 'ws_platform', PW='faro-standin';
const srv={kill(){}};
function client() { let cookie=''; const c = async (m,u,b)=>{ const r = await fetch(B+u,{method:m,redirect:'manual',headers:{...(cookie?{cookie}:{}),...(b!==undefined?{'Content-Type':'application/json'}:{})},body:b===undefined?undefined:JSON.stringify(b)}); const s=r.headers.get('set-cookie'); if(s)cookie=s.split(';')[0]; const t=await r.text(); let j=null; try{j=JSON.parse(t)}catch{} return {status:r.status,json:j,text:t}; }; c.signIn=e=>c('POST','/api/signin',{email:e,password:PW}); return c; }
const now=()=>new Date().toISOString(); let n=0; const id=p=>`${p}_forge${++n}`;
const rhea=client(); await rhea.signIn('rhea.kapoor@example.com');
const amara=client(); await amara.signIn('amara.nwosu@example.com');
const snap=(await rhea('GET',`/api/workspaces/${WS}`)).json;
const me=snap.people.find(p=>p.email?.startsWith('rhea')||p.id==='rhea'); console.log('rhea', me?.id, me?.admin);
const chg=(actor,entity,eid,goalId,summary)=>({id:id('chg'),at:now(),actorId:actor,goalId,entity,entityId:eid,action:'edited',summary,diffs:[]});
const commit=(c)=>rhea('POST',`/api/workspaces/${WS}/commit`,c);
const out=(name,r)=>console.log((r.status===200?'FORGEABLE (200)':'refused '+r.status).padEnd(18),name,r.status===200?'':'- '+String(r.json?.error??r.text).slice(0,90));
const someoneElsesGoal=snap.goals.find(g=>g.ownerId!=='rhea'&&!g.removedAt);
// 1 decision removed by someone else's: find removed review decision
const sec=snap.reviews.find(r=>r.id==='security'); const dev=snap.reviews.find(r=>r.id==='devprod');
console.log('rhea in', snap.reviews.filter(r=>r.people.includes('rhea')).map(r=>r.id));
// A: a removed note by someone else: forge removedBy -> self, then restore
let removed = snap.decisions.find(d=>d.reviewId&&d.removedAt&&d.removedBy!=='rhea');
console.log('removed note exists:', !!removed);
if(!removed){ // admin makes one
  const d=snap.decisions.find(d=>d.reviewId&&d.kind==='note'&&!d.removedAt&&d.byId!=='rhea'&&d.byId!=='amara');
  console.log('note to remove', d?.id,d?.byId,d?.reviewId); if(!d){console.log(snap.decisions.filter(x=>x.kind==='note').length)}
  const r=await amara('POST',`/api/workspaces/${WS}/commit`,{decisions:[{...d,removedAt:now(),removedBy:'amara'}],changes:[chg('amara','decision',d.id,d.goalId,'Removed a note')]});
  console.log('admin removes note',r.status); removed={...d,removedAt:now(),removedBy:'amara'};
}
const sn2=(await rhea('GET',`/api/workspaces/${WS}`)).json; removed=sn2.decisions.find(d=>d.id===removed.id);
let r=await commit({decisions:[{...removed,removedBy:'rhea'}],changes:[chg('rhea','decision',removed.id,removed.goalId,'x')]}); out('A1 rewrite removedBy of someone else\'s removed note to self',r);
r=await commit({decisions:[{...removed,removedBy:'rhea',removedAt:null}],changes:[chg('rhea','decision',removed.id,removed.goalId,'x')]}); out('A2 restore it (after A1)',r);
// B: existing review-raised ask: change askedBy / ask text / goalIds
const ask=(sn2.requests??sn2.asks??[]).find(a=>a.reviewId&&a.askedBy!=='rhea');
console.log('ask', ask?.id, ask?.askedBy, Object.keys(sn2).join(','));
if(ask){
  r=await commit({requests:[{...ask,ask:'forged text',askedBy:'rhea'}],changes:[chg('rhea','request',ask.id,ask.goalIds[0],'x')]}); out('B1 rewrite someone else\'s review ask (text, askedBy)',r);
  const outside=sn2.goals.find(g=>!ask.goalIds.includes(g.id));
  r=await commit({requests:[{...ask,goalIds:[...ask.goalIds,outside.id]}],changes:[chg('rhea','request',ask.id,ask.goalIds[0],'x')]}); out('B2 add goal outside review scope to existing review ask',r);
  r=await commit({requests:[{...ask,status:'done',answer:'forged',answeredBy:'amara'}],changes:[chg('rhea','request',ask.id,ask.goalIds[0],'x')]}); out('B3 answer a review ask as amara',r);
}
// C: non-review decision forgery (core): approve-target on others goal as admin
r=await commit({decisions:[{id:id('dec'),goalId:someoneElsesGoal.id,checkInId:null,reviewId:null,week:46,kind:'approve-target',byId:'amara',at:now(),note:'forged'}],changes:[chg('rhea','decision','x',someoneElsesGoal.id,'x')]}); out('C1 core decision forged byId=admin',r);
// D: carried watch for other person
r=await commit({watches:[{id:id('watch'),personId:'amara',kind:'goal',ref:someoneElsesGoal.id,createdAt:now()}],changes:[chg('rhea','watch','x',someoneElsesGoal.id,'x')]}); out('D1 watch for another person (carry side effect kind)',r);
// E: scope injection: add goal to a review rhea isn't in, via carried-along path
const notIn=snap.reviews.find(r=>!r.people.includes('rhea')&&r.createdBy!=='rhea'&&!r.endedAt&&!r.removedAt);
const g=someoneElsesGoal;
r=await commit({reviews:[{...notIn,scope:{...notIn.scope,goals:[...notIn.scope.goals,g.id]}}],goals:[g],changes:[chg('rhea','review',notIn.id,null,'x')]}); out('E1 add a goal to a review she is not in (goal listed unchanged in same commit)',r);
// F: remove someone from review people, who has not left
const victim=notIn.people[0];
r=await commit({reviews:[{...notIn,people:notIn.people.filter(p=>p!==victim)}],changes:[chg('rhea','review',notIn.id,null,'x')]}); out('F1 drop a person from a review she is not in (not a leaver)',r);
// G: drop someone who left (marked leftAt) 
const leftP=snap.people.find(p=>(p.leftAt||p.removedAt)); console.log('left person', leftP?.id);
// H: review: change content fields not in content(): version
r=await commit({reviews:[{...notIn,version:(notIn.version??0)+5}],changes:[chg('rhea','review',notIn.id,null,'x')]}); out('H1 bump version of a review she is not in',r);
// I: feedback/retros/modules still core
r=await commit({retros:[{id:id('retro'),goalId:g.id,byId:'amara',at:now(),text:'forged'}],changes:[chg('rhea','retro','x',g.id,'x')]}); out('I1 retro as admin (not Reviews)',r);
// J: ask raised in review via new request with another review but in a review she is in, askedBy others
r=await commit({requests:[{id:id('req'),kind:'question',goalIds:[g.id],askedBy:'amara',recipientId:null,ask:'f',status:'open',dueWeek:null,reviewId:null,week:null,checkInId:null,createdAt:now(),updatedAt:now(),answer:null,answeredBy:null,answeredAt:null}],changes:[chg('rhea','request','x',g.id,'x')]}); out('J1 new ask (no review) with askedBy=admin',r);
srv.kill();
