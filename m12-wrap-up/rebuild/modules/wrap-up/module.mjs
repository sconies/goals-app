// The Wrap-up module (spec/modules/wrap-up/README.md, stage 12). It registers into the core's module platform:
// two routes (/retro, /retro/:goalId), its parts in places (Home, a goal, Goals, Cycles), a Features line and read-back,
// one action (saveRetro, refused in the core's words while off), two AI tools. Its records (retros) are the core's.
// Results, carrying on and starting the next year are the core's (app/cycles.mjs) and never switch off.
import { makeS1 } from '../../rules.mjs';
import { STATUS_WORD } from '../../screens.mjs';
import { withUnit } from '../../readback.mjs';
import { viewOf, laterCycle, canStart, nextName } from '../../app/cycles.mjs';
import * as R from './rules.mjs';

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const today = (app) => (app.now || app.W.builtFor).slice(0, 10);

// the wrap-up as it stands today: its cycle (last year's while its wrap-up is still open), that cycle's rules, goals and wrap-ups
export function wrapUpNow(app) {
  const cycle = R.wrapUpCycle(app.W.cycles, app.W.cycle, today(app));
  const same = cycle.id === app.W.cycle.id;
  const V = same ? app.V : viewOf(app.W, cycle);
  const S1 = same ? app.S1 : makeS1(V);
  const days = R.wrapUpDays(cycle);
  const open = R.wrapUpOpen(cycle, today(app));
  const goals = R.wrapUpGoals(V.goals, cycle).sort((a, b) => S1.goalNum(a.key) - S1.goalNum(b.key));
  const retros = (app.W.retros || []).filter((r) => r.cycleId === cycle.id && !r.removedAt);
  const ws = S1.asOf(app.now);
  const statusOf = (g) => S1.goalStatus(g, ws.ckByGoal.get(g.id) || [], app.now);
  return { cycle, V, S1, days, open, goals, retros, statusOf, retro: (id) => retros.find((r) => r.goalId === id) || null };
}
const endedAt = (g, st) => {
  const v = st.latest && st.latest.value !== null && st.latest.value !== undefined ? withUnit(st.latest.value, g.unit || '') : null;
  return `${v ? `Ended at ${v}` : 'No number yet'} · ${STATUS_WORD[st.status] || st.status}`;
};

// ---------- the action: saveRetro ----------
function saveRetro(app, actor, input) {
  const ref = String(input.goalId || '').toLowerCase();
  const g = wrapUpNow(app).goals.find((x) => x.id === input.goalId || String(x.key).toLowerCase() === ref) || app.W.goals.find((x) => x.id === input.goalId && !x.removedAt);
  if (!g) return { error: `There’s no goal ${input.goalId}.` };
  const cycle = app.W.cycles.find((c) => c.id === (g.cycleId || app.W.cycle.id)) || app.W.cycle;
  const later = laterCycle(app.W.cycles, cycle);
  const copy = later ? app.W.goals.find((x) => x.carriedFrom === g.id && x.cycleId === later.id) : null;
  const used = copy && app.W.checkIns.some((c) => c.goalId === copy.id && !c.removedAt);
  const why = R.retroRefusal({ goal: g, actor: app.person(actor), cycle, todayIso: today(app), input, copyUsedIn: used ? later.name : null });
  if (why) return { error: why };
  app.W.retros = app.W.retros || [];
  const before = R.retroOf(app.W.retros, g.id, cycle.id);
  const at = app.now || app.W.builtFor;
  const rec = { id: before ? before.id : `retro_${g.id}_${cycle.id}`, goalId: g.id, cycleId: cycle.id, result: input.result, learned: String(input.learned).trim(), next: input.next, byId: actor, at };
  if (before) Object.assign(before, rec); else app.W.retros.push(rec);
  // keeping the copy true (carry.md, recarry): an untouched copy leaves when its goal stops, and comes back when it carries on
  if (copy && !used) {
    if (input.next === 'stop' && !copy.removedAt) Object.assign(copy, { removedAt: at, leftByRecarry: true });
    if (input.next === 'carry' && copy.leftByRecarry) { delete copy.removedAt; delete copy.leftByRecarry; }
  }
  const word = (r) => (r ? `${R.RESULT_WORD[r.result]}, ${r.next === 'stop' ? 'stop' : 'carry on'}` : '—');
  return { ok: true, retro: rec, change: { entity: 'retro', entityId: rec.id, goalId: g.id, action: before ? 'edited' : 'created', summary: `Wrapped up ${g.title}: ${word(rec)}`,
    diffs: [{ field: 'How it landed', from: before ? R.RESULT_WORD[before.result] : '—', to: R.RESULT_WORD[rec.result] }, { field: 'What we learned', from: before ? before.learned : '—', to: rec.learned }, { field: 'Next', from: before ? R.NEXT_WORD[before.next] : '—', to: R.NEXT_WORD[rec.next] }] } };
}

// ---------- its pages ----------
function wrapUpPage(app, viewer, url) {
  const N = wrapUpNow(app);
  const { cycle, days, open, goals } = N;
  const mine = goals.filter((g) => g.ownerId === viewer.id);
  const left = mine.filter((g) => !N.retro(g.id));
  const done = goals.filter((g) => N.retro(g.id)).length;
  let top = '';
  const t = R.wrapUpDays(cycle), tn = Math.floor(Date.parse(today(app)) / 86400000);
  if (!open && tn < t.opens) { const wk = Math.ceil((t.opens - tn) / 7); top = `<p class="when">The wrap-up opens in week ${t.opensWeek}, on ${R.dayWithYear(t.opens)}. That’s in ${plural(wk, 'week', 'weeks')}.</p>`; }
  else if (!open) top = `<p class="when">${h(cycle.name)}’s wrap-up closed on ${R.dayWithYear(t.closes)}.</p>`;
  let hero = '';
  if (open && mine.length) {
    const progress = `<progress max="${mine.length}" value="${mine.length - left.length}" aria-label="${mine.length - left.length} of ${mine.length} of your goals wrapped up"></progress> <span>${mine.length - left.length} of ${mine.length} wrapped up</span>`;
    if (left.length) hero = `<section class="hero" aria-label="Your wrap-up" data-part="Your wrap-up"><p class="lead-title">${plural(left.length, 'goal', 'goals')} to wrap up</p><p>${progress}</p><p>For each: how it landed, one thing learned, and carry it on or stop it. About a minute each.</p><a class="btn primary" href="/retro/${h(left[0].id)}">Wrap up ${plural(left.length, 'goal', 'goals')}</a></section>`;
    else hero = `<section class="hero quiet" aria-label="Your wrap-up"><p class="lead-title">Your goals are wrapped up</p><p>${progress}</p><ul class="learned">${mine.map((g) => { const r = N.retro(g.id); return `<li><strong>${h(g.title)}</strong>: ${R.RESULT_WORD[r.result]}, ${r.next === 'stop' ? 'stops here' : 'carries on'}. “${h(r.learned)}”</li>`; }).join('')}</ul></section>`;
  }
  const start = viewer.admin && !canStart(app.W, cycle, viewer, today(app)) ? `<p><a href="/workspace/cycles/next">Start ${h(nextName(cycle))}</a></p>` : viewer.admin ? '<p><a href="/workspace/cycles">See Cycles</a></p>' : '';
  const rows = goals.map((g) => {
    const st = N.statusOf(g); const r = N.retro(g.id);
    return `<li class="retro-row"><p class="gtitle"><a href="/goals/${h(g.id)}">${h(g.title)}</a></p><p>${h(app.person(g.ownerId)?.name)} · ${h(endedAt(g, st))}</p><p>${r ? `Wrapped up: ${R.RESULT_WORD[r.result]}, ${r.next === 'stop' ? 'stops here' : 'carries on'}. “${h(r.learned)}”` : 'Not wrapped up yet.'}</p>${open && !r && (g.ownerId === viewer.id || viewer.admin) ? `<a href="/retro/${h(g.id)}">Wrap up this goal</a>` : ''}</li>`;
  }).join('');
  const list = goals.length ? `<section aria-label="How the year landed"><h2>How the year landed</h2><p class="count-line">${done} of ${goals.length} wrapped up</p><ul class="retro-list">${rows}</ul></section>` : `<p>No goals this year to wrap up.</p>`;
  return { body: `<h1>Wrap up the year</h1><p>Each owner says how their goals landed and what they learned. Then next year’s goals start with the ones that carry on.</p>${top}${hero}${start}${list}`, backParent: { none: true } };
}
function retroGoalPage(app, viewer, goalId, f = null, problem = '') {
  const N = wrapUpNow(app);
  const g = N.goals.find((x) => x.id === goalId || String(x.key).toLowerCase() === String(goalId).toLowerCase());
  const back = '<a href="/retro">Back to the wrap-up</a>';
  if (!g) return { status: 404, focus: true, body: `<div class="focus-body"><h1>This goal isn’t in this year’s wrap-up</h1>${back}</div>` };
  if (g.ownerId !== viewer.id && !viewer.admin) return { focus: true, body: `<div class="focus-body"><h1>Only its owner wraps up this goal</h1><p>${h(app.person(g.ownerId)?.name)} wraps up ${h(g.title)}.</p>${back}</div>` };
  if (!N.open) return { focus: true, body: `<div class="focus-body"><h1>${h(g.title)}</h1><p>${h(R.retroRefusal({ goal: g, actor: viewer, cycle: N.cycle, todayIso: today(app), input: {} }))}</p>${back}</div>` };
  const st = N.statusOf(g);
  const was = N.retro(g.id);
  const result = (f && (f.pick_result || f.result)) || (was ? was.result : R.suggestResult(st.status));
  const next = (f && (f.pick_next || f.next)) || (was ? was.next : 'carry');
  const learned = f ? f.learned || '' : was ? was.learned : '';
  const mine = N.goals.filter((x) => x.ownerId === g.ownerId);
  const i = mine.indexOf(g) + 1;
  const btn = (name, value, label, on) => `<button type="submit" name="${name}" value="${value}" aria-pressed="${on ? 'true' : 'false'}" formnovalidate>${label}</button>`;
  const body = `<div class="focus-body"><form method="post" action="/retro/${h(g.id)}">
    <input type="hidden" name="result" value="${h(result)}"><input type="hidden" name="next" value="${h(next)}">
    <p class="eyebrow">Goal ${i} of ${mine.length} · ${h(N.cycle.name)}</p><h1>${h(g.title)}</h1>
    <p class="chip">${h(endedAt(g, st))}</p>
    <h2 id="res-l">How did it land?</h2>
    <div class="choice" role="group" aria-labelledby="res-l">${btn('pick_result', 'hit', 'Hit', result === 'hit')}${btn('pick_result', 'partly', 'Partly', result === 'partly')}${btn('pick_result', 'missed', 'Missed', result === 'missed')}</div>
    <p class="hint">Suggested from where it ended: ${R.RESULT_WORD[R.suggestResult(st.status)]}.</p>
    <label for="learned">What did you learn?</label><textarea id="learned" name="learned" rows="3">${h(learned)}</textarea>
    ${problem ? `<p class="fix-line" role="alert">${h(problem)}</p>` : ''}
    <h2 id="next-l">Next year</h2>
    <div class="choice" role="group" aria-labelledby="next-l">${btn('pick_next', 'carry', 'Carry it on', next === 'carry')}${btn('pick_next', 'stop', 'Stop it here', next === 'stop')}</div>
    <p><button class="btn primary" type="submit" name="save" value="1">Save and continue</button></p>
    </form>${back}</div>`;
  return { focus: true, name: `Wrap up: ${g.title}`, body };
}
function retroGoalPost(app, viewer, goalId, f) {
  if (!f.save) return { page: retroGoalPage(app, viewer, goalId, f) };
  const result = f.result, next = f.next;
  if (String(f.learned || '').trim().length < 10) return { status: 422, page: retroGoalPage(app, viewer, goalId, f, 'Write a sentence about what you learned.') };
  const r = app.run(viewer.id, 'wrapUp.save', { goalId, result, learned: f.learned, next });
  if (r.error) return { status: 400, page: retroGoalPage(app, viewer, goalId, f, r.error) };
  const N = wrapUpNow(app);
  const g = N.goals.find((x) => x.id === r.retro.goalId);
  const left = N.goals.filter((x) => x.ownerId === (g ? g.ownerId : viewer.id) && !N.retro(x.id));
  return { redirect: left.length ? `/retro/${left[0].id}` : '/retro?done=1' };
}

// ---------- the module, as the core sees it ----------
export const wrapUpModule = {
  id: 'wrap-up', name: 'Wrap-up', group: 'together', needs: [],
  summary: 'At the end of the year, each owner says how their goals landed and what they learned.',
  offWords: 'core', // saving a wrap-up is one of the core's own actions behind a switch: “Wrap-up is off in {workspace}.”
  routes: [{ path: '/retro', name: 'Wrap up', help: 'wrap-up' }, { path: '/retro/:goalId', name: 'Wrap up', help: 'wrap-up' }],
  page(app, viewer, params, url) { return params.goalId ? retroGoalPage(app, viewer, params.goalId) : wrapUpPage(app, viewer, url); },
  post(app, viewer, params, f) { return params.goalId ? retroGoalPost(app, viewer, params.goalId, f) : { status: 405 }; },
  places: {
    // Home: the wrap-up while it is open (the lead itself is Home's rule 3, read from the core's home rule)
    'home.blocks': ({ app }) => { const N = wrapUpNow(app); if (!N.open || !N.goals.length) return '';
      return `<section class="wrapup-card" aria-label="The wrap-up" data-module="wrap-up"><h2>The wrap-up</h2><p>${N.goals.filter((g) => N.retro(g.id)).length} of ${N.goals.length} goals wrapped up.</p><a href="/retro">See the wrap-up</a></section>`; },
    // a goal: Wrap up this goal (its owner or an admin, while open), or how it was wrapped up
    'goal.sections': ({ app, goal, viewer }) => { const N = wrapUpNow(app); if (!N.goals.includes(goal)) return ''; const r = N.retro(goal.id);
      if (r) return `<section class="wrapped" aria-label="Wrap-up" data-module="wrap-up"><h3>Wrap-up</h3><p>${R.RESULT_WORD[r.result]}, ${r.next === 'stop' ? 'stops here' : 'carries on'}. “${h(r.learned)}”</p>${N.open && viewer && (viewer.id === goal.ownerId || viewer.admin) ? `<a href="/retro/${h(goal.id)}">Change the wrap-up</a>` : ''}</section>`;
      return N.open && viewer && (viewer.id === goal.ownerId || viewer.admin) ? `<p data-module="wrap-up"><a href="/retro/${h(goal.id)}">Wrap up this goal</a></p>` : ''; },
    // Goals: Wrap up, while the wrap-up is open
    'goals.header': ({ app }) => (wrapUpNow(app).open ? `<a class="wrapup-link" href="/retro" data-module="wrap-up">Wrap up</a>` : ''),
    // Cycles: Open the wrap-up (open), or See the wrap-up (the current year, before it opens, once any goal has a check-in)
    'cycles.cycle': ({ app, cycle, current }) => { if (R.wrapUpOpen(cycle, today(app))) return `<a href="/retro">Open the wrap-up</a>`;
      const anyCheckIn = current && app.S1.liveCk.length > 0; const before = Date.parse(today(app)) / 86400000 < R.wrapUpDays(cycle).opens;
      return current && before && anyCheckIn ? `<a href="/retro">See the wrap-up</a>` : ''; },
  },
  // Workspace → Features: its third line, and what switching it off reads back first
  featureLine(app) { const N = wrapUpNow(app); if (N.open) return `${N.goals.filter((g) => N.retro(g.id)).length} of ${N.goals.length} goals wrapped up.`;
    const tn = Date.parse(today(app)) / 86400000; return tn < N.days.opens ? `Opens on ${R.dayWithYear(N.days.opens)}.` : ''; },
  offReadBack(app) { const N = wrapUpNow(app); return R.wrapUpOffReadBack({ goals: N.V.goals, retros: app.W.retros || [], cycle: N.cycle, open: N.open }); },
  actions: { 'wrapUp.save': saveRetro },
  aiTools: [
    { name: 'get_wrap_up', title: 'The wrap-up', description: 'The cycle’s wrap-up. At the end of a cycle: which goals are wrapped up (result, what was learned, carry on or stop) and which are still to do.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false },
      run(app) { const N = wrapUpNow(app); const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
        const goals = N.goals.map((g) => { const r = N.retro(g.id); return { id: g.id, title: g.title, owner: app.person(g.ownerId)?.name || '', wrappedUp: !!r, result: r ? r.result : null, learned: r ? r.learned : null, next: r ? r.next : null }; });
        const done = goals.filter((g) => g.wrappedUp).length;
        const text = `${N.cycle.name}’s wrap-up ${N.open ? 'is open' : Date.parse(today(app)) / 86400000 < N.days.opens ? `opens on ${R.dayWithYear(N.days.opens)}` : `closed on ${R.dayWithYear(N.days.closes)}`}. ${done} of ${goals.length} goals wrapped up.\n${goals.map((g) => `- ${g.title} (${g.owner}): ${g.wrappedUp ? `${R.RESULT_WORD[g.result]}, ${g.next === 'stop' ? 'stop' : 'carry on'}. ${g.learned}` : 'not wrapped up yet'}`).join('\n')}`;
        return { text, structured: { open: N.open, opensWeek: N.days.opensWeek, opens: iso(N.days.opens), lastDay: iso(N.days.last), closes: iso(N.days.closes), goals } }; } },
    { name: 'wrap_up_goal', title: 'Wrap up a goal', description: 'Wrap up a goal. In the last two weeks of a cycle, the goal’s owner (or an admin) says how it landed, what was learned, and whether it carries on into the next cycle. Can be changed until the next cycle starts.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['goal_id', 'result', 'learned', 'next'], properties: { goal_id: { type: 'string', description: 'The goal’s ID or its key, e.g. G-12.' }, result: { type: 'string', description: 'How it landed.', enum: ['hit', 'partly', 'missed'] }, learned: { type: 'string', description: 'One thing worth knowing next time (a sentence).' }, next: { type: 'string', description: 'Next cycle.', enum: ['carry', 'stop'] } } },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      run(app, me, a) { const r = app.run(me.id, 'wrapUp.save', { goalId: a.goal_id, result: a.result, learned: a.learned, next: a.next }, 'mcp');
        if (r.error) return { error: /^Only the goal’s owner/.test(r.error) ? `${r.error} This token acts as ${me.name}, who isn’t an admin.` : r.error };
        return { text: `Wrapped up: ${R.RESULT_WORD[r.retro.result]}, ${r.retro.next === 'stop' ? 'stops here' : 'carries on'}.`, structured: { retro: r.retro } }; } },
  ],
  help: [], // its article (“Wrapping up the year, and the next one”, wrap-up) is in the core's guide, marked as the module's; Help leaves it out while off
};
