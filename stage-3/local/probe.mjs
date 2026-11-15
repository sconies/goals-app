import fs from 'node:fs';
import { load } from '../s1.mjs';
import { makeRules } from '../stage3.mjs';
const wsPath = '../spec/conformance/workspace.json';
const W = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
const { S1 } = await load(wsPath);
const R = makeRules(W, S1);
for (const [rid, day] of [['security', '2026-10-27'], ['weekly', '2026-10-29'], ['weekly', '2026-11-05']]) {
  const m = `${day}T12:00:00.000Z`;
  const { ws, st } = R.standing(m);
  const r = W.reviews.find((x) => x.id === rid);
  const gl = R.goalsIn(r, ws.goals);
  const needs = gl.filter((g) => { const s = st.get(g.id); return s.flags.some((f) => f !== 'due') && !s.handled; });
  const flagged = gl.filter((g) => st.get(g.id).flags.some((f) => f !== 'due'));
  const offrisk = gl.filter((g) => ['off', 'risk'].includes(st.get(g.id).status));
  console.log(rid, day, gl.length, 'needs', needs.length, 'flagged', flagged.length, 'offrisk', offrisk.length);
}
