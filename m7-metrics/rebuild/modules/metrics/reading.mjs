// Where a metric's number comes from in a check-in (NR): the number step drawn in the core's place checkin.number,
// what a check-in records of it, and its words elsewhere. The rules themselves are rules.mjs's (readingState, readingProblem).
import { h } from '../../app/pages.mjs';
import * as R from './rules.mjs';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function readWhen(at, now) {
  const a = new Date(at), n = new Date(now);
  const hm = `${a.getUTCHours()}:${String(a.getUTCMinutes()).padStart(2, '0')}`;
  const day = (d) => Math.floor(d.getTime() / 86400000);
  if (day(a) === day(n)) return `${hm} today`;
  if (day(a) === day(n) - 1) return `${hm} yesterday`;
  return `${hm} on ${WD[a.getUTCDay()]} ${a.getUTCDate()} ${MON[a.getUTCMonth()]}`;
}
const unitAfter = (v, g) => R.fmt(v, g.unit, g.decimals ?? 0);
const nameOf = (W, id) => W.people.find((p) => p.id === id)?.name || 'someone';
const confirmed = (c) => Number(c.value) === Number(c.reading.value) || !c.reading.why;
export function readingThisWeek(W, g, c, now = W.builtFor) {
  const r = c.reading;
  return confirmed(c) ? `${unitAfter(r.value, g)}, from ${r.source}, read ${readWhen(r.at, now)}. Confirmed by ${nameOf(W, c.authorId || c.byId || W.goals.find((x) => x.id === c.goalId)?.ownerId)}.`
    : `${unitAfter(c.value, g)}, typed by ${nameOf(W, c.authorId || c.byId || g.ownerId)}. ${r.source} said ${unitAfter(r.value, g)}.`;
}
export function readingLine(g, c, now) {
  const r = c.reading;
  return confirmed(c) ? `${unitAfter(r.value, g)}, from ${r.source}, read ${readWhen(r.at, now)}. Confirmed by you.` : `${unitAfter(c.value, g)}, typed. ${r.source} said ${unitAfter(r.value, g)}: ${R.READING_WHY[r.why.kind].toLowerCase()}.`;
}
export function differentWords(W, S1, m, src, now) {
  const w = S1.currentWeek(now);
  const goals = new Set(R.lib(W).metricLinks.filter((l) => l.metricId === m.id).map((l) => l.goalId));
  const cks = W.checkIns.filter((c) => goals.has(c.goalId) && !c.removedAt && c.reading && c.reading.source === src && c.week > w - R.READING_WEEKS && c.week <= w);
  const k = cks.filter((c) => { const g = W.goals.find((x) => x.id === c.goalId); const d = g?.decimals ?? 0; return Number(Number(c.value).toFixed(d)) !== Number(Number(c.reading.value).toFixed(d)); });
  return { n: cks.length, k: k.length, words: `In the last ${R.READING_WEEKS} weeks, ${k.length} of ${cks.length} check-ins filled in from ${src} used a different number.`, which: k.map((c) => ({ goalId: c.goalId, week: c.week })) };
}
// what the source says for this goal now, and the state with what is typed
export function readingFor(app, g, typed = null) {
  const mo = R.measureOf(app.W, g.id);
  if (!mo || R.isRetired(mo.metric)) return null;
  const src = R.sourceFor(R.demoSources(app.W, app.S1), mo.metric.id);
  if (!src) return null;
  const now = app.now || app.W.builtFor;
  const asked = R.askSource(src, mo.metric.id, now, { teamId: mo.link.teamId, part: mo.link.part || '' });
  const cks = app.W.checkIns.filter((c) => c.goalId === g.id && !c.removedAt && c.postedAt <= now).sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1));
  const last = cks[cks.length - 1];
  const state = R.readingState(asked, last?.reading || null, last ? last.value : null, now, typed, g.decimals ?? 0);
  return { src, asked, state, last, metric: mo.metric, link: mo.link, now };
}
export function checkInNumberStep(app, g, viewer, f) {
  if (g.kind === 'milestone') return '';
  const typed = f && f.value !== undefined && f.value !== '' && f.reading_value !== undefined && Number(f.value) !== Number(f.reading_value) ? f.value : null;
  const x = readingFor(app, g, typed);
  if (!x) return '';
  const { src, asked, state, last, now } = x;
  const d = g.decimals ?? 0, team = app.W.teams.find((t) => t.id === x.link.teamId);
  const w = app.S1.currentWeek(now);
  const r = asked.reading;
  const lastWords = last ? `Week ${last.week}: ${last.value !== null && last.value !== undefined ? unitAfter(last.value, g) : 'no number'}.` : '';
  const field = (val) => `<label>This week’s value <input name="value" inputmode="decimal" value="${h(val ?? '')}"> ${h(g.unit || '')}</label>`;
  const hidden = r ? `<input type="hidden" name="reading_source" value="${h(src.name)}"><input type="hidden" name="reading_value" value="${h(r.value)}"><input type="hidden" name="reading_at" value="${h(r.at)}">` : '';
  const why = `<fieldset><legend>Why is it different?</legend>${Object.entries(R.READING_WHY).map(([k, l]) => `<label><input type="radio" name="reading_why" value="${k}"${f?.reading_why === k ? ' checked' : ''}> ${h(l)}</label>`).join('')}<label>Say more <input name="reading_more" value="${h(f?.reading_more || '')}"></label></fieldset><p>Kept with this check-in, beside what ${h(src.name)} said. It doesn’t change the goal’s status and nobody is told.</p>`;
  let body;
  if (state === 'fresh') body = `${field(Number(r.value).toFixed(d))}<p>From ${h(src.name)}, read ${h(readWhen(r.at, now))}.</p><p>${h(lastWords)} Change the number if it’s wrong, and you’ll be asked why. You still say what changed: that is the next step.</p><p class="confirm-line">Confirm ${h(unitAfter(r.value, g))}</p>`;
  else if (state === 'changed') body = `${field(typed)}<p>You typed ${h(typed)}. ${h(src.name)} said ${h(Number(r.value).toFixed(d))}, read ${h(readWhen(r.at, now))}.</p>${why}<p class="confirm-line">Use ${h(unitAfter(Number(typed), g))}</p>`;
  else if (state === 'same') body = `${field('')}<p>No new reading since your last check-in: ${h(src.name)} still says ${h(unitAfter(r.value, g))}, read ${h(readWhen(r.at, now))}.</p>`;
  else if (state === 'old') { const n = Math.floor((Date.parse(now) - Date.parse(r.at)) / 86400000); const a = new Date(r.at); body = `${field('')}<p class="warn">${h(src.name)} last read this on ${h(`${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][a.getUTCDay()]} ${a.getUTCDate()} ${MON[a.getUTCMonth()]}`)}, ${n} days ago. That is too old to fill in. Type this week’s number, or say there isn’t one.</p>`; }
  else if (state === 'no-slice') body = `${field('')}<p>${h(src.name)} measures this for the whole company, not for ${h(team?.name || 'this team')} on its own, so it isn’t filled in.</p>`;
  else if (state === 'missing') body = `${field('')}<p>${h(src.name)} has no number for this yet. Type this week’s number.</p>`;
  else if (state === 'unreachable') body = `${field('')}<p>${h(src.name)} couldn’t be reached just now. Type the number, or try again.</p>`;
  else body = `${field(Number(r.value).toFixed(d))}<p class="check">${h(src.name)} says ${h(unitAfter(r.value, g))}. That is ${Math.abs(r.value) >= Math.abs(last?.value || 0) ? 'ten times' : 'a tenth of'} week ${last?.week}’s ${h(unitAfter(last?.value ?? 0, g))}. Is it right?</p>${why}`;
  return `<div class="number-step" data-module="metrics" data-state="${state}"><p>What’s the number this week?</p>${['fresh', 'changed', 'jump'].includes(state) ? hidden : ''}${body}</div>`;
}
export function readingFromForm(app, g, input) {
  const f = input && input.form;
  if (!g || !f || f.reading_value === undefined || f.reading_value === '') return null;
  const x = readingFor(app, g, null);
  if (!x || !x.asked.reading) return null;
  const reading = { source: f.reading_source, value: Number(f.reading_value), at: f.reading_at };
  const d = g.decimals ?? 0;
  const typed = Number(f.value);
  const differs = Number(typed.toFixed(d)) !== Number(reading.value.toFixed(d));
  const why = differs && f.reading_why ? { kind: f.reading_why, ...(f.reading_more ? { text: f.reading_more } : {}) } : null;
  const problem = R.readingProblem({ ...reading, why: differs ? why : null }, differs ? typed : reading.value, app.now || app.W.builtFor);
  return { problem, reading: problem ? null : R.recordReading(reading.source, reading, typed, why) };
}
