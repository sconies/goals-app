// The Goal map module (spec/rebuild/stage-6-module-goal-map.md): one of Goals' layouts, a switch, no records of its own.
// It registers a layout (the core's `layouts` extension, CORE-CHANGES.md) and owns its Help article.
import fs from 'node:fs';
import path from 'node:path';
import { criticalPath, onPathSet, rollup, ancestors } from './map.mjs';
import { status, h } from '../../app/pages.mjs';
import { withUnit } from '../../readback.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
// the rules file, run again by the page's own script: the same code, exports dropped
const RULES = fs.readFileSync(path.join(here, 'map.mjs'), 'utf8').replace(/^export /gm, '');
const CLIENT = fs.readFileSync(path.join(here, 'client.js'), 'utf8');
const CSS = fs.readFileSync(path.join(here, 'map.css'), 'utf8');

export const OFF_WORDS = 'The Goal map is off here, so this is the List.';

function nodeFacts(app, r) {
  const g = r.goal;
  const latest = r.st && r.st.latest;
  let nums = '';
  if (g.kind === 'milestone') {
    const done = latest && latest.stages ? latest.stages.filter((s) => s.doneWeek).length : 0;
    nums = `${done} of ${(g.stages || []).length} stages done`;
  } else if (g.plan && g.plan.target !== undefined && g.plan.target !== null) {
    const v = latest && latest.value !== null && latest.value !== undefined ? Number(latest.value) : null;
    const t = Number(g.plan.target);
    nums = v === null ? `No number yet · target ${withUnit(t, g.unit)}` : `${withUnit(v, g.unit)} · target ${withUnit(t, g.unit)} · gap ${withUnit(Math.round(Math.abs(t - v) * 100) / 100, g.unit)}`;
  }
  return { nums, why: latest && latest.why ? latest.why : '' };
}

export function drawMap(app, ctx, Q, url) {
  const rows = Q.index.goalRows;
  const all = rows.map((r) => ({ id: r.id, key: r.goal.key, title: r.title, parentId: r.goal.parentId || null, alsoHelps: r.goal.alsoHelps || [], effect: r.goal.effect ?? null, status: r.goal.proposedAt ? 'none' : r.status, proposed: !!r.goal.proposedAt }));
  const paths = criticalPath(all);
  const onPath = onPathSet(paths);
  const narrowed = !!Q.q || Q.filters.length > 0 || Q.scope !== 'all';
  const keep = new Set();
  if (narrowed) for (const r of Q.rows) { keep.add(r.id); for (const a of ancestors(all, r.id)) keep.add(a); }
  else for (const g of all) keep.add(g.id);
  const people = new Map(app.W.people.map((p) => [p.id, p]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const goals = all.filter((g) => keep.has(g.id)).map((g) => {
    const r = byId.get(g.id); const ru = rollup(all, g.id); const f = nodeFacts(app, r);
    return { ...g, parentId: g.parentId && keep.has(g.parentId) ? g.parentId : null, alsoHelps: g.alsoHelps.filter((x) => keep.has(x)),
      statusHtml: g.proposed ? '' : status(r.status), word: g.proposed ? 'Proposed' : (STATUS_WORDS[r.status] || r.status),
      roll: ru ? { html: status(ru.status), text: ru.text } : null, nums: f.nums, why: f.why, owner: people.get(r.goal.ownerId)?.name || '', onPath: onPath.has(g.id) };
  });
  const data = { goals, paths: paths.map((p) => p.filter((id) => keep.has(id))).filter((p) => p.length), all: narrowed, attention: url.searchParams.get('attention') === '1' };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<style>${CSS}</style>
<section class="goal-map" role="region" aria-label="Goal map">
  <div class="map-bar" role="toolbar" aria-label="Map">
    <button type="button" data-map="unfold">Unfold all</button><button type="button" data-map="fold">Fold to the top</button>
    <button type="button" data-map="fit">Fit all</button><button type="button" data-map="readable">Readable</button>
    <button type="button" class="attention-switch" aria-pressed="${data.attention}">Needs attention</button>
    <label class="map-troubled"><input type="checkbox" data-map="troubled"> Troubled trees only</label>
  </div>
  <div class="map-wrap"><div class="map-canvas"><div class="map-viewport"><svg class="map-edges" aria-hidden="true"></svg><div class="map-nodes"></div></div></div>
  <aside class="map-story" role="complementary" hidden tabindex="-1"></aside></div>
  <p class="map-key">Solid lines: feeds into. Dotted lines: also helps. Bold: the critical path. Drag to move the map or a goal; scroll or pinch to zoom.</p>
</section>
<script type="application/json" id="map-data">${json}</script>
<script>(function(){${RULES}\n${CLIENT}})();</script>`;
}
const STATUS_WORDS = { on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update', none: 'No check-in yet', planned: 'Not started', unmeasured: 'Not measured yet', done: 'Done' };

export const goalMapModule = {
  id: 'goal-map', name: 'Goal map', group: 'tools', summary: 'Every goal on one canvas, with what feeds what.', needs: [],
  // Goals' layouts (the core's `layouts` extension): offered while on; asked for while off, the List says OFF_WORDS once
  layouts: [{ id: 'map', label: 'Map', offWords: OFF_WORDS, draw: drawMap }],
  // its Help article is the kit's guide's “The goal map” (`goal-map`, from the goal-map module), which the core leaves out while it is off
  helpFromGuide: ['goal-map'],
};
