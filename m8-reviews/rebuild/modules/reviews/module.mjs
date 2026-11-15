// The Reviews module (stage 8): its routes, its places on core screens, its actions, its AI tools, its Help, and what
// switching it off reads back. It registers into the core's module platform; the core never names what it draws.
import { hasSession, sessionDay, walkOf, reviewedIn, shortDay, longDay } from '../../home.mjs';
import { STATUS_WORD, levelName } from '../../screens.mjs';
import { agenda, sessionState, openActions, cadenceWords, switchOffReadBack, writesReviews, ACCEPT, dueWords, heldOnDueDay } from './rules.mjs';

const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SHAPE = { on: '●', risk: '▲', off: '■', stale: '◌', none: '○', planned: '○', unmeasured: '○', done: '✓' };
const status = (st) => `<span class="status ${st}"><span aria-hidden="true">${SHAPE[st] || '○'}</span> <span class="word">${STATUS_WORD[st] || st}</span></span>`;
const WD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const live = (r) => r && !r.endedAt && !r.removedAt;
const first = (app, id) => (app.person(id)?.name || 'Someone').split(' ')[0];

const now = (app) => app.now || app.W.builtFor;
const reviewOf = (app, id) => (app.W.reviews || []).find((r) => r.id === id && !r.removedAt);
// a spell while Reviews was off, from the change log (the last off, and the on after it)
export function offSpell(app) {
  const ch = (app.W.changes || []).filter((c) => c.entity === 'workspace' && /^Switched (off|on) Reviews/.test(c.summary || ''));
  const lastOff = [...ch].reverse().find((c) => /^Switched off/.test(c.summary));
  if (!lastOff) return null;
  const onAfter = ch.find((c) => /^Switched on/.test(c.summary) && c.at >= lastOff.at && ch.indexOf(c) > ch.indexOf(lastOff));
  if (!onAfter) return null;
  return { from: app.S1.dayNum(lastOff.at), to: app.S1.dayNum(onAfter.at) };
}
const state = (app, r) => sessionState(app.W, app.S1, r, now(app), offSpell(app));

// REVIEW-SPEAK: only someone in the review, or an admin, speaks for it
function speak(app, actor, r) {
  const p = app.person(actor);
  if (!r) return 'There’s no review like that.';
  if (!live(r)) return `${r.name} has ended, so nothing more can be said in it.`;
  if (!(r.people || []).includes(actor) && !(p && p.admin)) return `Only the people in ${r.name}, or an admin, can speak for it. Ask ${first(app, (r.people || [])[0])} to add you.`;
  return null;
}
function sessionWeek(app, r) { const s = state(app, r); return s.week ?? app.S1.currentWeek(now(app)); }
function say(app, actor, r, goal, kind, note) {
  const d = { id: `dec_r${++app.seq}`, goalId: goal.id, checkInId: null, reviewId: r.id, week: sessionWeek(app, r), kind, byId: actor, at: now(app), note: note || '' };
  app.W.decisions.push(d);
  return d;
}
function decidedThisSession(app, r, g) {
  const w = sessionWeek(app, r);
  return (app.W.requests || []).some((a) => a.reviewId === r.id && a.week === w && a.kind === 'action' && a.goalIds.includes(g.id))
    || (app.W.decisions || []).some((d) => d.reviewId === r.id && d.week === w && d.goalId === g.id && d.kind === 'note' && !d.removedAt && d.note.startsWith(ACCEPT.trim()));
}

function parseScope(input) {
  const list = (s) => String(s || '').split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  return { goals: list(input.goals), trees: list(input.trees), levels: Array.isArray(input.levels) ? input.levels : list(input.levels) };
}

const actions = {
  saveReview(app, actor, input) {
    const r = saveReview(app, actor, input);
    // a refused set-up opens the form again with what was typed and the reason under it
    if (r.error) r.again = { body: setupForm(app, app.person(actor), reviewOf(app, input.reviewId), input, r.error), focus: true };
    else r.redirect = `/reviews/${r.id}`;
    return r;
  },
};
function saveReview(app, actor, input) {
  {
    const name = String(input.name || '').trim();
    if (!name) return { error: 'Give the review a name.' };
    const every = Number(input.everyWeeks || 1);
    if (![1, 2, 4].includes(every)) return { error: 'A review is held every 1, 2 or 4 weeks.' };
    const weekday = Number(input.weekday ?? 3);
    if (!(weekday >= 0 && weekday <= 4)) return { error: 'Pick a weekday, Monday to Friday.' };
    const scope = parseScope(input);
    const goalIds = new Set(app.W.goals.map((g) => g.id));
    const unknown = [...scope.goals, ...scope.trees].filter((x) => !goalIds.has(x) && !app.goal(x));
    if (unknown.length) return { error: `There’s no goal ${unknown[0]}.` };
    scope.goals = scope.goals.map((x) => app.goal(x)?.id || x); scope.trees = scope.trees.map((x) => app.goal(x)?.id || x);
    if (!scope.goals.length && !scope.trees.length && !scope.levels.length) return { error: 'Choose the goals it walks: a level, a tree or single goals.' };
    const people = String(input.people || actor).split(/[,\s]+/).filter(Boolean);
    const bad = people.find((p) => !app.person(p));
    if (bad) return { error: `There’s no one called ${bad}.` };
    if (input.reviewId) {
      const r = reviewOf(app, input.reviewId);
      const no = speak(app, actor, r); if (no) return { error: no };
      const before = { ...r };
      Object.assign(r, { name, everyWeeks: every, weekday, scope, people, version: (r.version || 0) + 1 });
      return { ok: true, entity: 'review', logAction: 'edited', id: r.id, summary: `Changed ${name}`, diffs: [['Name', before.name, name], ['Cadence', cadenceWords(before), cadenceWords(r)]].filter((d) => d[1] !== d[2]).map(([field, from, to]) => ({ field, from, to })) };
    }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `review-${app.seq}`;
    const r = { id: (app.W.reviews || []).some((x) => x.id === id) ? `${id}-${++app.seq}` : id, name, everyWeeks: every, weekday, scope, people: people.includes(actor) ? people : [actor, ...people], createdAt: now(app) };
    app.W.reviews.push(r);
    return { ok: true, entity: 'review', logAction: 'created', id: r.id, summary: `Set up ${name}`, diffs: [{ field: 'Review', from: '—', to: `${name}, ${cadenceWords(r).toLowerCase()}` }] };
  }
}
Object.assign(actions, {
  markReviewed(app, actor, input) {
    const r = reviewOf(app, input.reviewId), g = app.goal(input.goalId);
    const no = speak(app, actor, r); if (no) return { error: no };
    if (!g) return { error: 'There’s no goal like that.' };
    const st = app.S1.goalStatus(g, app.S1.asOf(now(app)).ckByGoal.get(g.id) || [], now(app)).status;
    if ((st === 'off' || st === 'risk') && !decidedThisSession(app, r, g)) return { error: `${g.title} is ${STATUS_WORD[st].toLowerCase()}: agree a next step with who and by when, or accept the risk, before it leaves the walk.` };
    if (reviewedIn(app.W, r, sessionWeek(app, r), now(app)).has(g.id)) return { ok: true, summary: 'Already reviewed', diffs: [] };
    say(app, actor, r, g, 'acknowledge', '');
    return { ok: true, entity: 'review', goalId: g.id, id: r.id, summary: `Marked ${g.title} reviewed in ${r.name}`, diffs: [{ field: 'Reviewed', from: '—', to: r.name }] };
  },
  unmarkReviewed(app, actor, input) {
    const r = reviewOf(app, input.reviewId), g = app.goal(input.goalId);
    const no = speak(app, actor, r); if (no) return { error: no };
    const w = sessionWeek(app, r);
    const d = [...app.W.decisions].reverse().find((x) => x.reviewId === r.id && x.goalId === g?.id && x.week === w && x.kind === 'acknowledge' && !x.removedAt);
    if (!d) return { error: `${g ? g.title : 'That goal'} isn’t marked reviewed in this session.` };
    d.removedAt = now(app);
    return { ok: true, entity: 'review', goalId: g.id, id: r.id, summary: `Unmarked ${g.title} in ${r.name}`, diffs: [{ field: 'Reviewed', from: r.name, to: '—' }] };
  },
  reviewCall(app, actor, input) {
    const r = reviewOf(app, input.reviewId), g = app.goal(input.goalId);
    const no = speak(app, actor, r); if (no) return { error: no };
    if (!g) return { error: 'There’s no goal like that.' };
    const text = String(input.text || '').trim();
    const kind = input.call || 'note';
    if (kind === 'risk') {
      if (text.length < 10) return { error: 'Say why the risk is accepted, in 10 characters or more.' };
      say(app, actor, r, g, 'note', `${ACCEPT}${text}`);
      return { ok: true, entity: 'note', goalId: g.id, summary: `Accepted the risk on ${g.title} in ${r.name}`, diffs: [{ field: 'Decision', from: '—', to: `${ACCEPT}${text}` }] };
    }
    if (!text) return { error: kind === 'note' ? 'Write the note first.' : kind === 'question' ? 'Write the question first.' : 'Say what the next step is.' };
    if (kind === 'note') { say(app, actor, r, g, 'note', text); return { ok: true, entity: 'note', goalId: g.id, summary: `Noted on ${g.title} in ${r.name}`, diffs: [{ field: 'Note', from: '—', to: text }] }; }
    const recipient = kind === 'question' ? g.ownerId : input.who;
    if (!app.person(recipient)) return { error: 'Say who owns the next step: find them by name.' };
    const byWeek = kind === 'action' ? Number(input.byWeek) : null;
    if (kind === 'action' && !(byWeek >= app.S1.currentWeek(now(app)))) return { error: 'Say the week it’s due by: this week or later.' };
    const a = { id: `ask_r${++app.seq}`, kind, goalIds: [g.id], askedBy: actor, recipientId: recipient, ask: text, status: 'open', dueWeek: byWeek, reviewId: r.id, week: sessionWeek(app, r), checkInId: null, createdAt: now(app), updatedAt: now(app), answer: null, answeredBy: null, answeredAt: null };
    app.W.requests.push(a);
    return { ok: true, entity: 'request', logAction: 'asked', goalId: g.id, summary: `${kind === 'question' ? 'Asked' : 'Agreed a next step with'} ${app.person(recipient).name} on ${g.title} in ${r.name}`, diffs: [{ field: kind === 'question' ? 'Question' : 'Next step', from: '—', to: text }] };
  },
  endReview(app, actor, input) {
    const r = reviewOf(app, input.reviewId);
    const no = speak(app, actor, r); if (no) return { error: no };
    r.endedAt = now(app);
    return { ok: true, entity: 'review', logAction: 'ended', id: r.id, summary: `Ended ${r.name}`, diffs: [{ field: 'Review', from: 'Running', to: 'Ended' }] };
  },
  deleteReview(app, actor, input) {
    const r = reviewOf(app, input.reviewId);
    const no = speak(app, actor, r); if (no) return { error: no };
    r.removedAt = now(app);
    return { ok: true, entity: 'review', logAction: 'removed', id: r.id, summary: `Removed ${r.name}`, diffs: [{ field: 'Review', from: r.name, to: 'Removed' }] };
  },
});

// ---------- pages ----------
function listPage(app, viewer) {
  const rs = (app.W.reviews || []).filter(live);
  const rows = rs.map((r) => { const s = state(app, r); const last = (app.W.decisions || []).filter((d) => d.reviewId === r.id && !d.removedAt).map((d) => d.at).sort().pop(); const n = openActions(app.W, r);
    return `<li class="review-row" data-review="${r.id}"><a href="/reviews/${r.id}">${h(r.name)}</a><p>${h(cadenceWords(r))} · <span data-part="state">${h(s.words)}</span>${last ? ` · Last held ${h(shortDay(app.S1.dayNum(last)))}` : ' · Not held yet'} · ${n} open ${n === 1 ? 'action' : 'actions'}</p></li>`; }).join('');
  return `<h1>Reviews</h1><p>${rs.length} ${rs.length === 1 ? 'review is' : 'reviews are'} set up.</p><a class="btn primary" href="/reviews/new">Set up a review</a><ul class="reviews-list">${rows}</ul>`;
}
function setupForm(app, viewer, r = null, typed = null, problem = '') {
  const t = typed || {};
  const sc = typed ? { goals: String(t.goals || '').split(/[,\s]+/).filter(Boolean), trees: String(t.trees || '').split(/[,\s]+/).filter(Boolean), levels: [].concat(t.levels || []) } : r ? r.scope : { goals: [], trees: [], levels: [] };
  const levels = [...new Set(app.W.goals.map((g) => g.level))];
  return `<h1>${r ? `Change ${h(r.name)}` : 'Set up a review'}</h1><form method="post" action="/act/saveReview" class="review-setup">${r ? `<input type="hidden" name="reviewId" value="${r.id}">` : ''}
    ${problem ? `<p class="fix-line" role="alert">${h(problem)}</p>` : ''}<label>Name <input name="name" value="${h(typed ? t.name || '' : r?.name || '')}"></label>
    <fieldset><legend>How often</legend>${[1, 2, 4].map((n) => `<label><input type="radio" name="everyWeeks" value="${n}"${(r?.everyWeeks || 1) === n ? ' checked' : ''}> ${n === 1 ? 'Every week' : `Every ${n} weeks`}</label>`).join('')}</fieldset>
    <label for="rv-day">On</label> <select id="rv-day" name="weekday">${WD.slice(0, 5).map((d, i) => `<option value="${i}"${(r?.weekday ?? app.S1.REVIEW_DAY) === i ? ' selected' : ''}>${d}</option>`).join('')}</select>
    <fieldset><legend>Levels</legend>${levels.map((l) => `<label><input type="checkbox" name="levels" value="${h(l)}"${sc.levels.includes(l) ? ' checked' : ''}> ${h(levelName(app.W, l))}</label>`).join('')}</fieldset>
    <label>Trees (goal keys) <input name="trees" value="${h(sc.trees.join(', '))}"></label>
    <label>Single goals (goal keys) <input name="goals" value="${h(sc.goals.join(', '))}"></label>
    <label>People <input name="people" value="${h((r?.people || [viewer.id]).join(', '))}"></label>
    <button class="primary">${r ? 'Save the review' : 'Set up the review'}</button> <a href="${r ? `/reviews/${r.id}` : '/reviews'}" data-close>Close without saving</a></form>`;
}
function reviewPage(app, viewer, r) {
  const s = state(app, r);
  const ag = agenda(app.W, app.S1, r, now(app));
  const done = s.week != null ? reviewedIn(app.W, r, s.week, now(app)) : new Set();
  const inIt = (r.people || []).includes(viewer.id) || viewer.admin;
  const lastAgreed = (app.W.requests || []).filter((a) => a.reviewId === r.id && a.kind === 'action' && a.status === 'open');
  const firstGoal = ag.find((x) => !done.has(x.g.id)) || ag[0];
  const w = app.S1.currentWeek(now(app));
  const before = heldOnDueDay(app.W, app.S1, w) && r.weekday === app.S1.REVIEW_DAY && hasSession(r, w) ? `<p>${h(`Check-ins are due ${dueWords(app.on('reviews'), app.S1, w, true).label.replace('the review', 'this review')}.`)}</p>` : '';
  return `<h1>${h(r.name)}</h1><p>${h(cadenceWords(r))} · <span data-part="state">${h(s.words)}</span></p><span class="ring" role="img" aria-label="${done.size} of ${ag.length} reviewed">${done.size}/${ag.length}</span>${before}
    ${inIt ? (firstGoal ? `<a class="btn primary" href="/goals/${firstGoal.g.id}?review=${r.id}">${done.size ? 'Carry on the review' : 'Start review'}</a>` : '') : `<p>You’re not in ${h(r.name)}. Ask ${h(first(app, r.people[0]))} to add you.</p>`}
    ${lastAgreed.length ? `<section aria-label="What the last session agreed"><h2>What the last session agreed</h2><ul>${lastAgreed.map((a) => `<li>${h(app.person(a.recipientId)?.name)}: “${h(a.ask)}”${a.dueWeek ? ` · by week ${a.dueWeek}` : ''} · Is it done?</li>`).join('')}</ul></section>` : ''}
    <section aria-label="Agenda"><h2>Agenda · ${ag.length} goals</h2><ol class="agenda">${ag.map((x) => `<li class="agenda-row"><a href="/goals/${x.g.id}?review=${r.id}">${status(x.status)} <span class="gname">${h(x.g.title)}</span> <span class="gkey">${h(x.g.key)}</span></a>${done.has(x.g.id) ? ' · Reviewed' : x.needs ? ' · Needs attention' : ''}</li>`).join('')}</ol></section>
    <p><a href="/reviews/${r.id}/summary">What was said</a> · <a href="/reviews/${r.id}/edit">Change this review</a> · <a href="/reviews/${r.id}/print">Print</a></p>`;
}
function saidIn(app, r, week) {
  const notes = (app.W.decisions || []).filter((d) => d.reviewId === r.id && d.week === week && !d.removedAt && d.kind === 'note');
  const asks = (app.W.requests || []).filter((a) => a.reviewId === r.id && a.week === week);
  const goal = (id) => app.W.goals.find((g) => g.id === id);
  return `${notes.map((d) => `<li>${h(goal(d.goalId)?.title)}: ${h(app.person(d.byId)?.name)} said “${h(d.note)}”</li>`).join('')}${asks.map((a) => `<li>${h(goal(a.goalIds[0])?.title)}: ${a.kind === 'question' ? 'Question for' : 'Next step for'} ${h(app.person(a.recipientId)?.name)}: “${h(a.ask)}”${a.dueWeek ? ` by week ${a.dueWeek}` : ''} · ${a.status === 'open' ? 'Open' : 'Answered'}</li>`).join('')}`;
}
function summaryPage(app, viewer, r, print = false) {
  const weeks = [...new Set([...(app.W.decisions || []).filter((d) => d.reviewId === r.id && !d.removedAt).map((d) => d.week), ...(app.W.requests || []).filter((a) => a.reviewId === r.id).map((a) => a.week)])].sort((a, b) => b - a);
  const latest = weeks[0];
  const body = latest == null ? '<p>Nothing has been said in it yet.</p>' : `<section aria-label="What was said"><h2>Week ${latest} · ${h(longDay(sessionDay(app.S1, r, latest)))}</h2><ul>${saidIn(app, r, latest) || '<li>Every goal marked reviewed; nothing more was said.</li>'}</ul></section>`;
  return `<h1>${h(r.name)}: what was said</h1>${body}${print ? '' : `<p><a class="btn primary" href="/reviews/${r.id}">Back to the review</a> <a href="/reviews/${r.id}/print">Print</a></p>`}`;
}

// ---------- places ----------
function walkPart({ goal: g, app, viewer, url }) {
  const rv = url && url.searchParams.get('review');
  const r = rv ? reviewOf(app, rv) : null;
  if (!r) return lastTalked(app, g);
  const ag = agenda(app.W, app.S1, r, now(app));
  const i = ag.findIndex((x) => x.g.id === g.id);
  const s = state(app, r);
  const done = s.week != null ? reviewedIn(app.W, r, s.week, now(app)).has(g.id) : false;
  const prev = i > 0 ? ag[i - 1].g : null, next = i >= 0 && i < ag.length - 1 ? ag[i + 1].g : null;
  const hid = `<input type="hidden" name="reviewId" value="${r.id}"><input type="hidden" name="goalId" value="${g.id}">`;
  const no = speak(app, viewer.id, r);
  const st = app.S1.goalStatus(g, app.S1.asOf(now(app)).ckByGoal.get(g.id) || [], now(app)).status;
  const needsDecision = (st === 'off' || st === 'risk') && !decidedThisSession(app, r, g);
  return `<section class="walk" aria-label="The walk" data-part="walk"><h2>${h(r.name)} · ${i + 1} of ${ag.length}</h2>
    <p>${prev ? `<a href="/goals/${prev.id}?review=${r.id}" rel="prev">Previous</a>` : ''} ${next ? `<a href="/goals/${next.id}?review=${r.id}" rel="next">Next</a>` : `<a href="/reviews/${r.id}/summary">Finish review</a>`}</p>
    ${no ? `<p>${h(no)}</p>` : `${done ? `<p>Reviewed.</p><form method="post" action="/act/unmarkReviewed">${hid}<button>Unmark</button></form>` : `${needsDecision ? `<p>${h(g.title)} is ${h(STATUS_WORD[st].toLowerCase())}: decide what happens next before it leaves the walk.</p>` : ''}<form method="post" action="/act/markReviewed">${hid}<button>Mark reviewed</button></form>`}
    <form method="post" action="/act/reviewCall">${hid}<input type="hidden" name="call" value="note"><label>Add a note <textarea name="text"></textarea></label><button>Save the note</button></form>
    <form method="post" action="/act/reviewCall">${hid}<input type="hidden" name="call" value="question"><label>Ask ${h(first(app, g.ownerId))} a question <textarea name="text"></textarea></label><button>Ask</button></form>
    <form method="post" action="/act/reviewCall">${hid}<input type="hidden" name="call" value="action"><label>Next step <input name="text"></label><label>Who <input name="who" placeholder="Find them by name"></label><label>By week <input name="byWeek" inputmode="numeric"></label><button>Agree the next step</button></form>
    ${st === 'off' || st === 'risk' ? `<form method="post" action="/act/reviewCall">${hid}<input type="hidden" name="call" value="risk"><label>We accept the risk because <textarea name="text"></textarea></label><button>Accept the risk</button></form>` : ''}`}</section>`;
}
function lastTalked(app, g) {
  const d = (app.W.decisions || []).filter((x) => x.goalId === g.id && x.reviewId && !x.removedAt && x.kind === 'note' && x.at <= now(app)).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  if (!d) return '';
  const r = (app.W.reviews || []).find((x) => x.id === d.reviewId);
  return `<section aria-label="Last time we talked" data-part="last-talked"><h2>Last time we talked</h2><p>${h(r?.name)}, ${h(shortDay(app.S1.dayNum(d.at)))}: ${h(app.person(d.byId)?.name)} said “${h(d.note)}”</p></section>`;
}
function nextReviewCell({ app, viewer }) {
  const mine = (app.W.reviews || []).filter((r) => live(r) && (r.people || []).includes(viewer.id));
  if (!mine.length) return '';
  const today = app.S1.dayNum(now(app));
  const nexts = mine.map((r) => { const s = state(app, r); let day = s.state === 'next' ? s.day : null;
    if (day == null) for (let w = app.S1.currentWeek(now(app)); w <= app.S1.WEEKS + 60; w++) if (hasSession(r, w) && sessionDay(app.S1, r, w) >= today) { day = sessionDay(app.S1, r, w); break; }
    return { r, day }; }).filter((x) => x.day != null).sort((a, b) => a.day - b.day);
  if (!nexts.length) return '';
  const x = nexts[0];
  return `<section aria-label="Next review" data-part="next-review"><h2>Next review</h2><p><a href="/reviews/${x.r.id}">${h(x.r.name)}</a> · ${x.day === today ? 'today' : h(longDay(x.day))}</p></section>`;
}

// ---------- AI tools ----------
const obj = (props, req = []) => ({ type: 'object', properties: props, required: req });
const S = { type: 'string' }, I = { type: 'integer' };
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const rw = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const viaRun = (app, me, action, input) => { const r = app.run(me.id, action, input, 'mcp'); return r.error ? { error: r.error } : { text: `${r.summary || 'Saved'}.`, structured: { id: r.id || null } }; };
const aiTools = [
  { name: 'list_reviews', title: 'List reviews', description: 'Every review: its cadence, where this session stands and its open actions.', inputSchema: obj({}), annotations: ro,
    run: (app) => { const rs = (app.W.reviews || []).filter(live); return { text: rs.map((r) => `${r.id}: ${r.name} · ${cadenceWords(r)} · ${state(app, r).words} · ${openActions(app.W, r)} open actions`).join('\n') || 'No reviews are set up.', structured: { reviews: rs.map((r) => ({ id: r.id, name: r.name, everyWeeks: r.everyWeeks, weekday: r.weekday, state: state(app, r).state })) } }; } },
  { name: 'get_review', title: 'Get a review', description: 'One review: its agenda, worst and stalest first, and what was said last.', inputSchema: obj({ review_id: S }, ['review_id']), annotations: ro,
    run: (app, me, a) => { const r = reviewOf(app, a.review_id); if (!r) return { error: `There’s no review ${a.review_id}.` }; const ag = agenda(app.W, app.S1, r, now(app));
      return { text: `${r.name} · ${cadenceWords(r)} · ${state(app, r).words}\n${ag.map((x) => `${x.g.key} ${x.g.title} — ${STATUS_WORD[x.status]}${x.needs ? ' (needs attention)' : ''}`).join('\n')}`, structured: { review: r, agenda: ag.map((x) => x.g.key) } }; } },
  { name: 'review_call', title: 'Say something in a review', description: 'In a review, on one goal: mark it reviewed, add a note, ask its owner a question, agree a next step (who, by_week) or accept the risk. call is reviewed, note, question, action or risk.', annotations: rw,
    inputSchema: obj({ review_id: S, goal_id: S, call: S, text: S, who: S, by_week: I }, ['review_id', 'goal_id', 'call']),
    run: (app, me, a) => a.call === 'reviewed' ? viaRun(app, me, 'markReviewed', { reviewId: a.review_id, goalId: a.goal_id }) : viaRun(app, me, 'reviewCall', { reviewId: a.review_id, goalId: a.goal_id, call: a.call, text: a.text, who: a.who, byWeek: a.by_week }) },
  { name: 'unmark_reviewed', title: 'Unmark a goal reviewed', description: 'Take back marking a goal reviewed in this session.', inputSchema: obj({ review_id: S, goal_id: S }, ['review_id', 'goal_id']), annotations: rw,
    run: (app, me, a) => viaRun(app, me, 'unmarkReviewed', { reviewId: a.review_id, goalId: a.goal_id }) },
  { name: 'save_review', title: 'Set up or change a review', description: 'A name, every 1, 2 or 4 weeks on a weekday (0 Monday to 4 Friday), the goals (levels, trees, goals) and the people.', annotations: rw,
    inputSchema: obj({ review_id: S, name: S, every_weeks: I, weekday: I, levels: S, trees: S, goals: S, people: S }, ['name']),
    run: (app, me, a) => viaRun(app, me, 'saveReview', { reviewId: a.review_id, name: a.name, everyWeeks: a.every_weeks, weekday: a.weekday, levels: a.levels, trees: a.trees, goals: a.goals, people: a.people }) },
  { name: 'end_review', title: 'End a review', description: 'End a review: it keeps what was said and is no longer due.', inputSchema: obj({ review_id: S }, ['review_id']), annotations: rw,
    run: (app, me, a) => viaRun(app, me, 'endReview', { reviewId: a.review_id }) },
  { name: 'delete_review', title: 'Remove a review', description: 'Remove a review; it can be brought back from Recently removed.', inputSchema: obj({ review_id: S }, ['review_id']), annotations: { ...rw, destructiveHint: true },
    run: (app, me, a) => viaRun(app, me, 'deleteReview', { reviewId: a.review_id }) },
];

export const reviewsModule = {
  id: 'reviews', name: 'Reviews', group: 'together', summary: 'Walk a set of goals together on a cadence.', needs: [],
  // the menu row is still the core's (the kit's gap: "its menu row (src/domain/navigation.ts) ... still the core's")
  routes: [
    { path: '/review', name: 'Reviews' }, { path: '/reviews', name: 'Reviews' }, { path: '/reviews/new', name: 'New review' },
    { path: '/reviews/:reviewId', name: 'Review' }, { path: '/reviews/:reviewId/edit', name: 'Change review' },
    { path: '/reviews/:reviewId/summary', name: 'Review summary' }, { path: '/reviews/:reviewId/print', name: 'Print review' },
  ],
  page: (app, viewer, { path, params }) => {
    if (path === '/review') { const r = (app.W.reviews || []).find((x) => live(x) && (x.people || []).includes(viewer.id)); return { redirect: r ? `/reviews/${r.id}` : '/reviews' }; }
    if (path === '/reviews') return { body: listPage(app, viewer), back: { none: true } };
    if (path === '/reviews/new') return { body: setupForm(app, viewer), focus: true };
    const r = reviewOf(app, params.reviewId);
    if (!r) return { status: 404, title: 'Review not found', body: '<div class="not-found"><h1>Review not found</h1><p>No review is at this address. It may have been removed.</p><a href="/reviews">See every review</a></div>' };
    if (path.endsWith('/edit')) return { body: setupForm(app, viewer, r), focus: true };
    if (path.endsWith('/summary')) return { body: summaryPage(app, viewer, r), back: { to: `/reviews/${r.id}`, label: r.name } };
    if (path.endsWith('/print')) return { body: summaryPage(app, viewer, r, true), focus: true };
    return { body: reviewPage(app, viewer, r), back: { to: '/reviews', label: 'Reviews' } };
  },
  places: { 'goal.sections': walkPart, 'home.blocks': nextReviewCell },
  help: [{ id: 'reviews', after: 'goals', title: 'Reviews', body: 'A review walks a set of goals together on a cadence, worst and stalest first, and keeps what was said.\n\nSet one up from Reviews: a name, every 1, 2 or 4 weeks on a weekday, the goals (levels, trees or single goals) and the people. Start the walk from its page: each goal’s page opens in turn, with Previous and Next. Someone in the review marks it reviewed, adds a note, asks the owner a question, agrees a next step with who and by when, or accepts the risk on a goal behind. A goal off track or at risk leaves the walk with a decision.\n\nQuestions and next steps are asks: they wait on the owner’s Home until answered or done. What was said shows on the review’s summary, and prints.' }],
  actions,
  aiTools,
  // Workspace → Features: the line under its switch, and the read-back before switching it off
  featureLine: (app) => { const n = (app.W.reviews || []).filter(live).length; return `${n} ${n === 1 ? 'review is' : 'reviews are'} set up.`; },
  switchOff: (app) => { const rb = switchOffReadBack(app.W, app.S1); return { lines: rb.lines, readBack: rb }; },
  // whatever would save Reviews' records, from a core action, while it is off (writesReviews)
  // Home: a session whose date passed while Reviews was off, with nothing reviewed in it, doesn't lead (offSpell)
  skipSession: (app, r, w) => { const sp = offSpell(app); const d = sessionDay(app.S1, r, w); return !!sp && d >= sp.from && d <= sp.to && d < app.S1.dayNum(now(app)) && !reviewedIn(app.W, r, w, now(app)).size; },
  writesWhenOff: (app, action, input) => writesReviews(action, input, app.W),
};
