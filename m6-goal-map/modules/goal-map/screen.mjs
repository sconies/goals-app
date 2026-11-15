// The Map layout's markup: the server sends the goals and the toolbar; public/map.js draws them with rules.mjs.
// q (from the core's Goals query): { rows, matchIds, narrowed, troubled }
//   rows: [{ id, key, title, parentId, alsoHelps, effect, level, status, value, vsPlan, target, owner, why, flags }]
// h: the core's screen helpers { esc, shape, STATUS_WORD }

export const MAP_CSS = `
.goal-map [hidden]{display:none!important}
.map-wrap{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;margin-top:8px}
.map-wrap.has-story{grid-template-columns:minmax(0,1fr) 340px}
.map-wrap>*{min-width:0}
.map-list .map-row>div{min-width:0;overflow-wrap:anywhere}
.map-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
.map-tools label{display:inline-flex;gap:6px;align-items:center;margin:0;font-weight:400}
.map-canvas{position:relative;height:480px;min-height:360px;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--bg);touch-action:none;cursor:grab}
.map-stage{position:absolute;left:0;top:0;transform-origin:0 0}
.map-stage svg.edges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.edges path{fill:none;stroke:var(--muted);stroke-width:1.4}
.edges path.helps{stroke-dasharray:4 4}
.edges path.critical{stroke:var(--ink);stroke-width:3.5}
.map-stage>.react-flow__node{position:absolute}
.map-stage .map-node{position:relative;width:240px;height:124px;border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:8px 10px;font-size:.85rem;line-height:1.3;cursor:pointer;overflow:hidden;color:var(--ink)}
.map-node.on-path{border:2px solid var(--ink)}
.map-node.is-off{background:var(--off-wash)}
.map-node.context{opacity:.55}
.map-node.found,.map-node[aria-pressed="true"]{outline:3px solid var(--focus);outline-offset:2px}
.map-node .t{font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.map-stage .map-node .meta{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.8rem}
.map-list .map-node{position:relative;padding-right:60px!important}.map-list .t{display:block;font-weight:600}.map-list .meta{display:block}
.map-node .fold{position:absolute;right:6px;bottom:6px;min-height:28px;min-width:36px;padding:0 6px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;cursor:pointer}
.map-node .north{font-variant:small-caps;letter-spacing:.03em;color:var(--muted)}
.map-story{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:16px;align-self:start}
.map-story h2{margin:0 0 8px}
.map-list{list-style:none;margin:8px 0;padding:0;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
.map-list li{border-top:1px solid var(--line)}.map-list li:first-child{border-top:none}
.map-list .map-node.map-row{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;cursor:pointer;min-height:44px}
.map-list .map-row .fold{margin-left:auto;min-height:36px;min-width:44px;border:1px solid var(--line);border-radius:6px;background:var(--bg);font:inherit;color:var(--ink)}
.map-list .map-row.on-path .t{text-decoration:underline;text-decoration-thickness:2px}
.map-list .map-row.context{opacity:.6}
.map-find{list-style:none;margin:4px 0;padding:0;border:1px solid var(--line);border-radius:8px;max-width:520px;background:var(--panel);position:absolute;z-index:6;width:min(520px,calc(100vw - 32px))}
.map-find li{padding:8px 10px;cursor:pointer;min-height:44px}.map-find li[aria-selected="true"]{outline:2px solid var(--focus)}
.map-key{display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem;color:var(--muted);margin:4px 0}
@media (max-width:760px){.map-wrap.has-story{grid-template-columns:minmax(0,1fr)}.map-canvas{display:none}.map-tools .wide-only{display:none}}
@media (min-width:761px){.map-list{display:none}}
`;

export function renderMap(ctx, q, h) {
  const shapes = Object.fromEntries(Object.keys(h.STATUS_WORD).map((s) => [s, h.shape(s)]));
  const data = { rows: q.rows, matchIds: q.narrowed ? q.matchIds : null, troubled: !!q.troubled, shapes, words: h.STATUS_WORD };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<style>${MAP_CSS}</style>
<section class="goal-map" aria-label="Goal map">
<div class="map-tools" role="toolbar" aria-label="The map">
<button type="button" class="btn" data-act="unfold">Unfold all</button>
<label><input type="checkbox" data-act="troubled"${q.troubled ? ' checked' : ''}> Troubled trees only</label>
<button type="button" class="btn wide-only" data-act="fit">Fit all</button>
<button type="button" class="btn wide-only" data-act="readable">Readable</button>
<button type="button" class="btn wide-only" data-act="zoomout" aria-label="Zoom out">−</button>
<button type="button" class="btn wide-only" data-act="zoomin" aria-label="Zoom in">+</button>
<button type="button" class="btn" data-act="tidy" hidden>Tidy up</button>
</div>
<p class="map-key"><span>North stars at the top.</span><span>Solid line: feeds into.</span><span>Dotted line: also helps.</span><span>Bold: the critical path.</span>${q.narrowed ? '<span>Greyed goals are drawn only for context.</span>' : ''}</p>
<p class="meta map-count" role="status"></p>
<div class="map-wrap">
<div><div class="map-canvas" tabindex="0" aria-label="The map: drag to pan, Ctrl and the wheel to zoom"><div class="map-stage"><svg class="edges" aria-hidden="true"></svg></div></div>
<ul class="map-list" aria-label="The map, one goal per row"></ul></div>
<aside class="map-story" hidden></aside>
</div>
<script type="application/json" id="map-data">${json}</script>
<script type="module" src="/modules/goal-map/map.js"></script>
</section>`;
}
