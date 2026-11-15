// The Watching module (spec/modules/watching/README.md, stage 11): follow goals you don't own.
// It registers into the core's module platform; the core never names it.
import { h, status } from '../../app/pages.mjs';
import { levelName, levelsOf, STATUS_RANK } from '../../screens.mjs';
import { liveWatches, coverOf, watchedIds, watchersOf, watchingOffReadBack, watchingOffLines, plural, watchWords } from './rules.mjs';

const ID = 'watching';
const now = (app) => app.now || app.W.builtFor;
const goalsNow = (app) => app.S1.asOf(now(app)).goals;
const mine = (app, pid) => (app.W.watches || []).filter((w) => w.personId === pid && !w.removedAt);
const words = (app, w) => watchWords(app.W, w, levelName);
const first = (app, pid) => (app.person(pid)?.name || '').split(' ')[0];

// a message with Undo for the next page this person sees (the module's own, kept in memory)
function flash(app, pid, html) { app.flashes = app.flashes || {}; app.flashes[pid] = html; }
function takeFlash(app, pid) { const f = app.flashes && app.flashes[pid]; if (f) delete app.flashes[pid]; return f ? `<p class="message" role="status">${f}</p>` : ''; }
const undoForm = (action, watchId, back) => `<form method="post" action="/act/${action}" class="inline"><input type="hidden" name="watchId" value="${h(watchId)}"><input type="hidden" name="back" value="${h(back || '')}"><button type="submit">Undo</button></form>`;

function needsAttention(app, ws, g) { const fl = app.S1.flagsFor(g, ws, now(app)); return fl.flags.some((x) => x !== 'due') && !app.S1.handledFor(g, ws, now(app), fl); }
function whyOf(app, ws, g) {
  const fl = app.S1.flagsFor(g, ws, now(app));
  const st = fl.st;
  const bits = [];
  if (fl.flags.includes('stale')) bits.push(`No check-in for ${st.days} days`);
  if (fl.flags.includes('no-path')) bits.push('No path to green yet');
  if (fl.flags.includes('decision')) bits.push('Waiting on a decision');
  if (st.latest && st.latest.why) bits.push(st.latest.why);
  const s = bits.join('. ');
  return s.length > 10 ? s : `${s ? s + '. ' : ''}Last check-in week ${st.latest ? st.latest.week : '—'}; ${st.days >= 0 ? st.days : 0} days ago.`;
}
const trow = (app, ws, g) => { const st = app.S1.goalStatus(g, ws.ckByGoal.get(g.id) || [], now(app)).status; return `<a class="trow" data-tone="${st}" href="/goals/${g.id}">${status(st)} <span class="trow-title">${h(g.title)}</span><span class="trow-why">${h(whyOf(app, ws, g))}</span></a>`; };

// ---------- actions (refused while off, with “Watching is off in {workspace}.”) ----------
function watch(app, actor, input) {
  const kind = input.kind || 'goal';
  let ref = String(input.ref || '').trim();
  if (!['goal', 'tree', 'level'].includes(kind)) return { error: 'Watch a goal, a goal and everything feeding it, or a level.' };
  if (kind === 'level') {
    const lv = levelsOf(app.W).find((l) => l.id === ref || l.name.toLowerCase() === ref.toLowerCase());
    if (!lv) { const names = levelsOf(app.W).map((l) => l.name); return { error: `There’s no level called “${ref}” here. The levels are ${names.slice(0, -1).join(', ')} and ${names.slice(-1)[0]}.`, notFound: 'level' }; }
    ref = lv.id;
  } else {
    const g = app.goal(ref);
    if (!g) return { error: 'There’s no goal with that ID in this cycle.', notFound: 'goal' };
    ref = g.id;
  }
  const same = mine(app, actor).find((w) => w.kind === kind && w.ref === ref);
  const w = same || { id: `w_${Date.now().toString(36)}_${(app.W.watches || []).length + 1}`, personId: actor, kind, ref, removedAt: null, removedBy: null };
  const n = coverOf(goalsNow(app), w).size;
  const said = kind === 'tree' ? `Watching all ${n} ${plural(n, 'goal', 'goals')} in ${words(app, w)}` : kind === 'level' ? `Watching ${words(app, w)} (${n})` : `Watching ${words(app, w)}`;
  if (same) return { ok: true, unchanged: true, text: `You already watch ${words(app, w)}.`, watch: w, to: input.back || null };
  app.W.watches = app.W.watches || [];
  app.W.watches.push(w);
  flash(app, actor, `${h(said)}. ${undoForm('unwatch', w.id, input.back)}`);
  return { ok: true, text: `${said}. They show on your Home and under Watching in Goals.`, watch: w, to: input.back || null, summary: `Started watching ${words(app, w)}`, diffs: [{ field: 'Watching', from: '—', to: words(app, w) }], log: { entity: 'watch', entityId: w.id, goalId: kind === 'level' ? undefined : ref, action: 'watched' } };
}
function stop(app, actor, input, back) {
  const w = (app.W.watches || []).find((x) => x.id === input.watchId);
  if (!w || (back ? !w.removedAt : w.removedAt)) return { error: 'There’s no watch with that ID.' };
  if (w.personId !== actor) return { error: 'That’s someone else’s watch.' };
  if (back) Object.assign(w, { removedAt: null, removedBy: null }); else Object.assign(w, { removedAt: now(app), removedBy: actor });
  const what = words(app, w);
  flash(app, actor, back ? `${h(`Watching ${what} again`)}.` : `${h(`Stopped watching ${what}`)}. ${undoForm('rewatch', w.id, input.back)}`);
  return { ok: true, text: back ? `Watching ${what} again.` : `Stopped watching ${what}. Its goals leave your Watching page.`, watch: w, to: input.back || null, summary: back ? `Watched ${what} again` : `Stopped watching ${what}`, diffs: [{ field: 'Watching', from: back ? '—' : what, to: back ? what : '—' }], log: { entity: 'watch', entityId: w.id, goalId: w.kind === 'level' ? undefined : w.ref, action: back ? 'restored' : 'stopped' } };
}

// ---------- the parts it draws ----------
function homeBlock({ app, viewer }) {
  const ws = app.S1.asOf(now(app));
  const ids = watchedIds(ws.goals, app.W.watches || [], viewer.id);
  const list = ws.goals.filter((g) => ids.has(g.id) && g.ownerId !== viewer.id);
  if (!list.length) return '';
  const need = list.filter((g) => needsAttention(app, ws, g));
  const rest = list.filter((g) => !need.includes(g)).sort((a, b) => STATUS_RANK[app.S1.goalStatus(a, ws.ckByGoal.get(a.id) || [], now(app)).status] - STATUS_RANK[app.S1.goalStatus(b, ws.ckByGoal.get(b.id) || [], now(app)).status]);
  const shown = [...need, ...rest].slice(0, 6);
  return `<section class="home-watch" aria-label="Goals you watch"><h2>Goals you watch</h2><p>${list.length} ${plural(list.length, 'goal', 'goals')} · ${need.length} ${plural(need.length, 'needs', 'need')} attention</p><div class="tree">${shown.map((g) => trow(app, ws, g)).join('')}</div><a href="/goals?scope=watching">See all you watch</a></section>`;
}
function goalFacts({ goal: g, app, viewer }) {
  if (!viewer) return '';
  const msg = takeFlash(app, viewer.id);
  if (g.ownerId === viewer.id) return msg;
  const back = `/goals/${g.id}`;
  const direct = mine(app, viewer.id).filter((w) => (w.kind === 'goal' || w.kind === 'tree') && w.ref === g.id);
  if (direct.length) {
    return `${msg}<div class="bar-watch"><button type="button" data-dialog="watch-sheet" aria-haspopup="dialog">Watching</button></div>
      <dialog id="watch-sheet" aria-label="You’re watching ${h(g.title)}"><h2>You’re watching ${h(g.title)}</h2><p>It shows on your Home and under Watching in Goals. Faro sends no email.</p>
      ${direct.map((w) => `<form method="post" action="/act/unwatch"><input type="hidden" name="watchId" value="${h(w.id)}"><input type="hidden" name="back" value="${back}"><p>${h(words(app, w))}</p><button type="submit">Stop watching</button></form>`).join('')}
      <button type="button" class="primary" data-close-dialog>Done</button></dialog>`;
  }
  const feeders = coverOf(goalsNow(app), { kind: 'tree', ref: g.id }).size - 1;
  const choice = feeders > 0 ? `<fieldset><legend>What to watch</legend><label><input type="radio" name="kind" value="goal" checked> This goal</label><label><input type="radio" name="kind" value="tree"> It and the ${feeders} ${plural(feeders, 'goal', 'goals')} feeding it</label></fieldset>` : '<input type="hidden" name="kind" value="goal">';
  return `${msg}<div class="bar-watch"><button type="button" data-dialog="watch-sheet" aria-haspopup="dialog">Watch</button></div>
    <dialog id="watch-sheet" aria-label="Watch ${h(g.title)}"><form method="post" action="/act/watch"><h2>Watch ${h(g.title)}</h2><p>Its check-ins, changes of status and new asks show on your Home and under Watching in Goals, your name is listed under Watched by, and Faro sends no email.</p>
    <input type="hidden" name="ref" value="${g.id}"><input type="hidden" name="back" value="${back}">${choice}<button type="submit" class="primary">Watch</button> <button type="button" data-close-dialog>Cancel</button></form></dialog>`;
}
function goalSections({ goal: g, app, viewer }) {
  const who = [...watchersOf(goalsNow(app), liveWatches(app.W), g.id)].filter((p) => p !== g.ownerId);
  const by = who.length ? `<p class="watched-by">Watched by ${who.length} ${plural(who.length, 'person', 'people')}: ${h(who.slice(0, 5).map((p) => app.person(p)?.name).join(', '))}${who.length > 5 ? ` and ${who.length - 5} more` : ''}.</p>` : '';
  const own = viewer && viewer.id === g.ownerId ? '<p class="watch-why">Owners don’t need to watch their own goals.</p>' : '';
  return by || own ? `<div class="about-watching" data-module="watching">${by}${own}</div>` : '';
}
// Goals' Watching scope: what you watch, and Change to watch a level
function scopeHeader(app, viewer, url, rows) {
  const ws = app.S1.asOf(now(app));
  const here = url.pathname + url.search;
  const list = mine(app, viewer.id);
  const need = rows.filter((r) => needsAttention(app, ws, r.goal)).length;
  // a whole level is offered only when it has ten goals or more
  const levels = levelsOf(app.W).filter((l) => !list.some((w) => w.kind === 'level' && w.ref === l.id) && ws.goals.filter((g) => g.level === l.id).length >= 10);
  return `${takeFlash(app, viewer.id)}<section class="watch-list" aria-label="What you watch"><p class="watch-summary">${rows.length} ${plural(rows.length, 'goal', 'goals')} · ${need} ${plural(need, 'needs', 'need')} attention</p>
    <ul>${list.map((w) => `<li>${h(words(app, w))} <form method="post" action="/act/unwatch" class="inline"><input type="hidden" name="watchId" value="${h(w.id)}"><input type="hidden" name="back" value="${h(here)}"><button type="submit">Stop watching</button></form></li>`).join('') || '<li>Watch goals you don’t own to see what changed in them without opening each one. <a href="/goals?scope=all">Pick goals from the list</a></li>'}</ul>
    <details class="watch-change"><summary role="button">Change</summary>${levels.map((l) => `<form method="post" action="/act/watch" class="inline"><input type="hidden" name="kind" value="level"><input type="hidden" name="ref" value="${l.id}"><input type="hidden" name="back" value="${h(here)}"><button type="submit">Watch ${h(l.name)}</button></form>`).join(' ')}</details></section>`;
}

// ---------- AI tools ----------
const obj = (props, req = []) => ({ type: 'object', additionalProperties: false, ...(req.length ? { required: req } : {}), properties: props });
const aiTools = [
  { name: 'list_watching', title: 'What you watch', description: 'Your watches (a goal, a goal and everything feeding it, or a whole level) and the goals they cover.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false },
    run: (app, me) => {
      const goals = goalsNow(app);
      const list = mine(app, me.id).map((w) => ({ id: w.id, kind: w.kind, ref: w.ref, what: words(app, w), covers: coverOf(goals, w).size }));
      const ids = watchedIds(goals, app.W.watches || [], me.id);
      if (!list.length) return { text: `${me.name} watches nothing in ${app.wsName} yet. Use watch to follow a goal, a tree or a level.`, structured: { watches: [], goals: [] } };
      return { text: `${me.name} watches ${list.length} ${plural(list.length, 'thing', 'things')}, covering ${ids.size} ${plural(ids.size, 'goal', 'goals')}:\n${list.map((x) => `- ${x.id}: ${x.what} (${x.kind}, ${x.covers} ${plural(x.covers, 'goal', 'goals')})`).join('\n')}`, structured: { watches: list, goals: [...ids] } };
    } },
  { name: 'watch', title: 'Watch goals', description: 'Watch a goal, a goal and everything feeding it, or every goal at a level. Watched goals are on the Watching page and in get_my_work.',
    inputSchema: obj({ kind: { type: 'string', description: 'What to watch.', enum: ['goal', 'tree', 'level'] }, ref: { type: 'string', description: 'A goal’s ID or key (G-12), or a level (north-star, svp, team).' } }, ['kind', 'ref']), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: (app, me, a) => {
      const r = app.run(me.id, 'watch', { kind: a.kind, ref: a.ref }, 'mcp');
      if (r.error) return { error: r.notFound === 'goal' ? `There’s no goal with the ID or key ${a.ref} in ${app.wsName}. Use find_goals to get IDs and keys.` : r.error };
      return { text: r.text, structured: { watch: r.watch } };
    } },
  { name: 'unwatch', title: 'Stop watching', description: 'Stop one of your watches: the goals it covered leave your Watching page.', inputSchema: obj({ watch_id: { type: 'string', description: 'The watch’s ID, from list_watching.' } }, ['watch_id']), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: (app, me, a) => { const r = app.run(me.id, 'unwatch', { watchId: a.watch_id }, 'mcp'); return r.error ? r : { text: r.text, structured: { watch: r.watch } }; } },
];

export default {
  id: ID, name: 'Watching', group: 'together', summary: 'Watch goals and see them on Home.', needs: [],
  actionOffWords: 'coreAction', // Watch and Stop watching say “Watching is off in {workspace}.” (module-platform.md)
  routes: [{ path: '/watching', name: 'Watching', help: 'watching', to: '/goals?scope=watching' }],
  scopes: [{ id: 'watching', label: 'Watching', before: 'all', ids: (app, viewer, ws) => watchedIds(ws.goals, app.W.watches || [], viewer.id), header: scopeHeader }],
  places: { 'home.blocks': homeBlock, 'goal.facts': goalFacts, 'goal.sections': goalSections },
  help: [{ id: 'watching', after: 'goals', title: 'Watching goals', body: 'Watch the goals you care about but don’t own, and see what changed in them without opening each one.' }], // the guide’s fuller article wins while it is there
  actions: { watch, unwatch: (app, actor, input) => stop(app, actor, input, false), rewatch: (app, actor, input) => stop(app, actor, input, true) },
  aiTools,
  // Workspace → Features: the third line, and the read-back before it goes off (with no watch it acts at once)
  featureLine: (app) => { const n = watchingOffReadBack(app.W).people; return `${n} ${plural(n, 'person watches', 'people watch')} goals here.`; },
  offReadBack: (app) => {
    const rb = watchingOffReadBack(app.W);
    if (!rb.asks) return null;
    return { title: `Switch off Watching in ${app.wsName}`, lines: watchingOffLines(rb, { reviewsOn: app.on('reviews') }), button: 'Switch off Watching' };
  },
};
