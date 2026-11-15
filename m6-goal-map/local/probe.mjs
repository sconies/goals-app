import { App } from '../rebuild/app/state.mjs';
import { makeIndex } from '../rebuild/screens.mjs';
const app = new App(); app.now = app.now || app.W.builtFor;
const ix = makeIndex(app.W, app.S1, app.now);
const r = ix.goalRows.find(x=>x.id==='lead-merge'); console.log(Object.keys(r.st), r.st.status, r.st.value, ix.goalRows.length);
for (const id of ['ns-lead','lead-merge','lead-mq','lead-review']) { const x=ix.goalRows.find(y=>y.id===id); console.log(id, x.status, x.goal.effect); }
console.log(ix.goalRows.filter(x=>x.goal.parentId==='ns-lead').map(x=>[x.id,x.status,x.goal.effect]));
console.log(ix.goalRows.filter(x=>x.goal.parentId==='lead-merge').map(x=>[x.id,x.status,x.goal.effect]));
console.log(app.S1.latestPosted.toString().slice(0,200));
