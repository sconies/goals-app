import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PORT=43020, B=`http://localhost:${PORT}`, DATA=fs.mkdtempSync(path.join(os.tmpdir(),'rv-tags-'));
const ENV={...process.env,STANDIN_PORT:String(PORT),STANDIN_DATA:DATA,NODE_NO_WARNINGS:'1'};
execFileSync(process.execPath,['platform/dist/server.mjs','seed','faro-standin'],{env:ENV,stdio:'ignore'});
const p=spawn(process.execPath,['platform/dist/server.mjs'],{env:ENV,stdio:['ignore','pipe','inherit']});
await new Promise(r=>p.stdout.on('data',d=>/stand-in/.test(String(d))&&r()));
const WS='ws_platform'; const now=()=>new Date().toISOString(); let n=0;
function client(){let cookie='';const c=async(m,u,b)=>{const r=await fetch(B+u,{method:m,redirect:'manual',headers:{...(cookie?{cookie}:{}),...(b!==undefined?{'Content-Type':'application/json'}:{})},body:b===undefined?undefined:JSON.stringify(b)});const s=r.headers.get('set-cookie');if(s)cookie=s.split(';')[0];const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{}return{status:r.status,json:j,text:t}};c.in=e=>c('POST','/api/signin',{email:e,password:'faro-standin'});return c}
const A=client(),R=client(); await A.in('amara.nwosu@example.com'); await R.in('rhea.kapoor@example.com');
const chg=(a,e,g=null)=>({id:`chg_${++n}`,at:now(),actorId:a,goalId:g,entity:'field',entityId:e,action:'edited',summary:'x',diffs:[]});
const commit=(c,body)=>c('POST',`/api/workspaces/${WS}/commit`,body);
const show=(k,r)=>console.log(k.padEnd(62),r.status,String(r.json?.error??r.text).slice(0,90));
let s=(await A('GET',`/api/workspaces/${WS}`)).json;
const theirs=s.goals.find(g=>g.ownerId&&g.ownerId!=='rhea'&&!g.removedAt), mine=s.goals.find(g=>g.ownerId==='rhea'&&!g.removedAt);
const f={id:'fld_s',name:'Stage',kind:'list',options:['A','B'],position:0,createdBy:'amara',createdAt:now(),retiredAt:null,retiredBy:null};
show('admin adds field',await commit(A,{modules:{tags:{fields:[f]}},changes:[chg('amara','fld_s')]}));
const val=(g,v,by='rhea',extra={})=>({id:`${g}:fld_s`,goalId:g,fieldId:'fld_s',value:v,setBy:by,setAt:now(),removedAt:null,removedBy:null,...extra});
show('owner sets own value (ok)',await commit(R,{modules:{tags:{fieldValues:[val(mine.id,'A')]}},changes:[chg('rhea','fld_s',mine.id)]}));
show('member sets other goal value',await commit(R,{modules:{tags:{fieldValues:[val(theirs.id,'A')]}},changes:[chg('rhea','fld_s',theirs.id)]}));
show('member sets other value, forged setBy=owner',await commit(R,{modules:{tags:{fieldValues:[val(theirs.id,'A',theirs.ownerId)]}},changes:[chg('rhea','fld_s',theirs.id)]}));
// admin sets one on theirs, then member clears it
await commit(A,{modules:{tags:{fieldValues:[val(theirs.id,'B','amara')]}},changes:[chg('amara','fld_s',theirs.id)]});
show('member clears (removedAt) other goal value',await commit(R,{modules:{tags:{fieldValues:[val(theirs.id,'B','amara',{removedAt:now(),removedBy:'rhea'})]}},changes:[chg('rhea','fld_s',theirs.id)]}));
show('member empties value on other goal',await commit(R,{modules:{tags:{fieldValues:[val(theirs.id,'','rhea')]}},changes:[chg('rhea','fld_s',theirs.id)]}));
// new goal owned by someone else with a value
const ng={...theirs,id:'g_forge1',title:'forged',createdAt:now(),version:1};
show('member adds goal owned by other + value',await commit(R,{goals:[ng],modules:{tags:{fieldValues:[val('g_forge1','A')]}},changes:[chg('rhea','fld_s','g_forge1')]}));
show('member adds goal (other owner) alone',await commit(R,{goals:[{...ng,id:'g_forge2'}],changes:[chg('rhea','g_forge2','g_forge2')]}));
show('unknown key in tags module',await commit(R,{modules:{tags:{evil:[{id:'x'}]}},changes:[chg('rhea','x')]}));
show('unknown module rows',await commit(R,{modules:{nosuch:{rows:[{id:'x'}]}},changes:[chg('rhea','x')]}));
show('uppercase key Tags',await commit(R,{modules:{Tags:{fields:[{...f,id:'fld_u',createdBy:'rhea'}]}},changes:[chg('rhea','x')]}));
show('field row on a key fields with empty array + member',await commit(R,{modules:{tags:{fields:[]}},changes:[chg('rhea','x')]}));
show('admin forged createdBy=other',await commit(A,{modules:{tags:{fields:[{...f,id:'fld_t',name:'Other',createdBy:'rhea'}]}},changes:[chg('amara','fld_t')]}));
// rename sneaking: member changes only options? 
show('member changes options only',await commit(R,{modules:{tags:{fields:[{...f,options:['A','B','C']}]}},changes:[chg('rhea','fld_s')]}));
// extra property smuggled in value row
show('member value on own goal with extra setAt backdate',await commit(R,{modules:{tags:{fieldValues:[val(mine.id,'B','rhea',{setAt:'2001-01-01T00:00:00Z'})]}},changes:[chg('rhea','fld_s',mine.id)]}));
// off: admin turns module off through settings? find modulesOff
const ws=(await A('GET','/api/workspaces')).json; console.log('ws keys',JSON.stringify(ws).slice(0,200));
p.kill(); 
