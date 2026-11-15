// CORE (added for stage 12, see modules/wrap-up/CORE-CHANGES.md): the year's end the core keeps whether or not the Wrap-up is on.
// Which cycle everyone is in, what happens to each goal at the start of the next year (carryKind), the read-back, startNextCycle,
// and Workspace → Cycles and Start {next year}. Rules: spec/core/rules/start-next-year.md, carry.md, year-end.md.
import { makeS1 } from '../rules.mjs';

const DAY = 86400000;
const dayNum = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const isoOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayWithYear = (n) => { const d = new Date(n * DAY); return `${WD[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dm = (n) => { const d = new Date(n * DAY); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function cycleDays(c) {
  const start = dayNum(c.startDate);
  const last = start + (c.weeks + 1) * 7 - 1;
  return { start, first: start + 7, last, opens: start + 7 * (c.weeks - 1), closes: last + 28 };
}
export function cycleState(c, todayIso) {
  const d = cycleDays(c), t = dayNum(todayIso);
  return t < d.first ? 'before' : t < d.opens ? 'running' : t <= d.last ? 'ending' : t <= d.closes ? 'ended' : 'closed';
}
const live = (cycles) => (cycles || []).filter((c) => !c.removedAt);
// currentCycle: the latest whose week 1 has begun; if none has, the earliest
export function currentCycle(cycles, todayIso) {
  const t = dayNum(todayIso);
  const ls = live(cycles).sort((a, b) => dayNum(a.startDate) - dayNum(b.startDate));
  const begun = ls.filter((c) => dayNum(c.startDate) + 7 <= t);
  return begun.length ? begun[begun.length - 1] : ls[0];
}
export const laterCycle = (cycles, c) => live(cycles).find((x) => dayNum(x.startDate) > dayNum(c.startDate)) || null;
export const nextName = (c) => (/^\d{4}$/.test(c.name) ? String(Number(c.name) + 1) : `After ${c.name}`);
// the next cycle's week 0 is this one's last week; it runs to the Sunday on or after 1 January of the year after its name
export function nextCycleShape(c) {
  const start = dayNum(c.startDate) + 7 * c.weeks;
  const name = nextName(c);
  const jan1 = /^\d{4}$/.test(name) ? dayNum(`${Number(name) + 1}-01-01`) : start + 7 * 53;
  const sun = jan1 + ((6 - ((new Date(jan1 * DAY).getUTCDay() + 6) % 7)) % 7);
  const weeks = Math.round((sun + 1 - start) / 7) - 1;
  return { name, startDate: isoOf(start), weeks, reviewDay: c.reviewDay };
}

// the records of one cycle, as stage 1's rules read them
export function viewOf(W, cycle) {
  const goals = W.goals.filter((g) => (g.cycleId || cycle.id) === cycle.id);
  const ids = new Set(goals.map((g) => g.id));
  return { ...W, cycle, goals, checkIns: W.checkIns.filter((c) => ids.has(c.goalId)) };
}

// carryKind: stop (said so at the wrap-up, unless it finished anyway), keep (a number goal whose plan runs past the year), finish, carry
export function carryKind(S1, g, retro, todayIso) {
  const posted = S1.sortCk(S1.liveCk.filter((c) => c.goalId === g.id));
  const latest = S1.latestPosted(posted);
  const last = [...posted].reverse().find((c) => c.week <= S1.WEEKS && c.value !== null && c.value !== undefined);
  let finished = false;
  if (!g.guardrail) {
    if (latest && latest.status === 'done') finished = true;
    else if (g.kind === 'metric' && g.plan && last) { const up = g.plan.target >= g.plan.start; finished = up ? last.value >= g.plan.target : last.value <= g.plan.target; }
    else if (g.kind === 'milestone' && latest && latest.stages) finished = (g.stages || []).every((s) => latest.stages.some((x) => x.stageId === s.id && x.doneWeek));
  }
  if (retro && retro.next === 'stop' && !finished) return 'stop';
  if (finished) return 'finish';
  if (g.kind === 'metric' && g.plan && g.plan.endWeek && g.plan.endWeek > S1.WEEKS) return 'keep';
  return 'carry';
}
export function startReadBack(W, cycle, todayIso) {
  const V = viewOf(W, cycle);
  const S1 = makeS1(V);
  const goals = V.goals.filter((g) => !g.removedAt && !g.stoppedAt && !g.proposedAt);
  const retros = (W.retros || []).filter((r) => r.cycleId === cycle.id && !r.removedAt);
  const rows = goals.map((g) => { const r = retros.find((x) => x.goalId === g.id); return { g, wrapped: !!r, kind: carryKind(S1, g, r, todayIso) }; });
  const n = (f) => rows.filter(f).length;
  return { S1, rows, total: rows.length,
    carry: n((x) => x.wrapped && (x.kind === 'carry' || x.kind === 'keep')), keep: n((x) => x.wrapped && x.kind === 'keep'),
    finish: n((x) => x.wrapped && x.kind === 'finish'), stop: n((x) => x.kind === 'stop'),
    notYet: n((x) => !x.wrapped && x.kind !== 'stop'), notYetCarry: n((x) => !x.wrapped && (x.kind === 'carry' || x.kind === 'keep')), notYetFinish: n((x) => !x.wrapped && x.kind === 'finish') };
}
// canStart: admins only; from the day the wrap-up opens (or once the year has ended); once
export function canStart(W, cycle, actor, todayIso) {
  if (!actor || !actor.admin) return 'Only admins can start the next cycle.';
  const later = laterCycle(W.cycles, cycle);
  if (later) { const by = (W.people || []).find((p) => p.id === later.startedBy); return `${later.name} has already been started${by ? ` by ${by.name}` : ''}${later.startedAt ? ` on ${dayWithYear(dayNum(later.startedAt))}` : ''}.`; }
  const d = cycleDays(cycle);
  if (dayNum(todayIso) < d.opens) return `${nextName(cycle)} can be started from ${dayWithYear(d.opens)}, when ${cycle.name}’s wrap-up opens.`;
  return null;
}
// startNextCycle: makes the next cycle and a copy of each goal that carries on or keeps its plan; logged as one change on the cycle
export function startNextCycle(W, cycle, actor, todayIso, nowIso) {
  const why = canStart(W, cycle, actor, todayIso);
  if (why) return { error: why };
  const rb = startReadBack(W, cycle, todayIso);
  const shape = nextCycleShape(cycle);
  const c2 = { id: `cycle_${shape.name}`, ...shape, startedBy: actor.id, startedAt: nowIso };
  const S1 = rb.S1;
  const going = rb.rows.filter((x) => x.kind === 'carry' || x.kind === 'keep');
  const map = new Map(going.map((x) => [x.g.id, `${x.g.id}__${shape.name}`]));
  const copies = going.map(({ g, kind }) => {
    const copy = JSON.parse(JSON.stringify(g));
    Object.assign(copy, { id: map.get(g.id), cycleId: c2.id, createdAt: nowIso, carriedFrom: g.id, version: 0 });
    copy.parentId = g.parentId && map.has(g.parentId) ? map.get(g.parentId) : null;
    if (!copy.parentId) copy.effect = null;
    if (g.kind === 'metric' && g.plan && kind === 'carry') {
      const posted = S1.sortCk(S1.liveCk.filter((c) => c.goalId === g.id));
      const last = [...posted].reverse().find((c) => c.week <= S1.WEEKS && c.value !== null && c.value !== undefined);
      copy.plan = { start: last ? last.value : g.plan.start, target: g.plan.target, shape: g.plan.shape || 'straight', fromWeek: 0 };
      copy.originalPlan = null; copy.rebaselinedWeek = null;
    } else if (g.kind === 'metric' && g.plan && kind === 'keep') {
      copy.plan = { ...g.plan, fromWeek: (g.plan.fromWeek || 0) - cycle.weeks, endWeek: g.plan.endWeek - cycle.weeks };
    }
    if (g.kind === 'milestone') {
      const latest = S1.latestPosted(S1.sortCk(S1.liveCk.filter((c) => c.goalId === g.id)));
      const left = (g.stages || []).filter((s) => !(latest && latest.stages && latest.stages.some((x) => x.stageId === s.id && x.doneWeek)));
      copy.stages = left.map((s, i) => ({ ...s, dueWeek: Math.min(c2.weeks, Math.round(((i + 1) * c2.weeks) / left.length)) }));
    }
    return copy;
  });
  return { cycle: c2, copies, readBack: rb, change: { entity: 'cycle', entityId: c2.id, action: 'created', summary: `Started ${c2.name}: ${copies.length} ${copies.length === 1 ? 'goal carries' : 'goals carry'} on`, diffs: [{ field: 'Cycle', from: '—', to: c2.name }, { field: 'Goals carried', from: '—', to: String(copies.length) }] } };
}

// ---------- the screens ----------
export function readBackHtml(rb, cycle) {
  const next = nextName(cycle);
  return `<section aria-label="What happens to each goal" data-part="What happens to each goal"><h2>What happens to each goal</h2><ul class="readback">
    <li><strong>${rb.carry} wrapped up and carrying on</strong>${rb.keep ? `, ${rb.keep} of them keeping their plan` : ''}.</li>
    <li><strong>${rb.finish} finishing</strong>: they met their target.</li>
    <li><strong>${rb.stop} stopping</strong>: their owners said so at the wrap-up.</li>
    <li><strong>${rb.notYet} not wrapped up yet</strong>: ${rb.notYetCarry} carry on as they are, ${rb.notYetFinish} finish.</li></ul>
    <p>${rb.total} goals in all. ${rb.carry + rb.notYetCarry} go into ${h(next)}.</p></section>`;
}
export function cyclesSection(app, viewer, msg = '') {
  const W = app.W, today = app.now.slice(0, 10);
  const cur = W.cycle;
  const rows = live(W.cycles).sort((a, b) => dayNum(b.startDate) - dayNum(a.startDate)).map((c) => {
    const d = cycleDays(c), st = cycleState(c, today);
    const word = { before: 'Not begun', running: 'Running', ending: 'Ending', ended: 'Ended', closed: 'Ended' }[st];
    const goals = W.goals.filter((g) => (g.cycleId || cur.id) === c.id && !g.removedAt).length;
    const later = laterCycle(W.cycles, c);
    const startLink = !later && viewer.admin && !canStart(W, c, viewer, today) ? `<a class="btn primary" href="/workspace/cycles/next">Start ${h(nextName(c))}</a>` : '';
    const ready = st === 'before' ? `<p class="message" role="status">${h(c.name)} is ready. It opens for everyone on ${dayWithYear(d.first)}.</p>` : '';
    const parts = app.registry.place('cycles.cycle', app.on, { app, viewer, cycle: c, current: c.id === cur.id });
    return `<li class="cycle-row" data-cycle="${h(c.id)}"><p class="cname">${h(c.name)}${c.id === cur.id ? ' · current' : ''}</p><p>${word} · ${dm(d.first)} to ${dm(d.last)} · ${c.weeks} weeks · ${goals} goals</p>${ready}${startLink}${parts}</li>`;
  }).join('');
  return `<h1>Cycles</h1>${msg ? `<p class="message" role="status">${h(msg)}</p>` : ''}<section class="cycles-block" aria-label="Cycles"><ul>${rows}</ul></section>`;
}
export function startNextBody(app, viewer, done = null) {
  const W = app.W, today = app.now.slice(0, 10);
  const cycle = done ? W.cycles.find((c) => c.id === done.from) : W.cycle;
  const shape = nextCycleShape(cycle);
  const d2 = cycleDays({ ...shape });
  const dLast = cycleDays(cycle).last;
  const intro = `<p>${h(shape.name)} runs from ${dayWithYear(d2.first)} to ${dayWithYear(d2.last)}: ${shape.weeks} weeks. Everyone stays in ${h(cycle.name)} until ${dayWithYear(dLast)}, so the last check-ins and the wrap-up carry on.</p>`;
  if (done) return `<h1>Start ${h(shape.name)}</h1><section aria-label="${h(shape.name)} is ready"><p class="message" role="status">${h(shape.name)} is ready. ${done.carried} goals carry on into it. It opens for everyone on ${dayWithYear(d2.first)}.</p><a href="/workspace/cycles">See Cycles</a></section>`;
  const why = canStart(W, cycle, viewer, today);
  if (why) return `<h1>Start ${h(shape.name)}</h1>${intro}<p class="message" role="status">${h(why)}</p>`;
  const rb = startReadBack(W, cycle, today);
  return `<h1>Start ${h(shape.name)}</h1>${intro}${readBackHtml(rb, cycle)}<form method="post" action="/workspace/cycles/next" data-part="Start the next year"><button class="btn primary" type="submit">Start ${h(shape.name)}</button> <a href="/workspace/cycles">Not yet</a></form>`;
}
