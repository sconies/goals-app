// The Wrap-up's rules: pure functions over records, no screens, no store.
// When it opens and closes (rule "A year's end"), what it suggests, and the switch's read-back (wrapUpOffReadBack).
const DAY = 86400000;
const dayNum = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayWithYear = (n) => { const d = new Date(n * DAY); return `${WD[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const WEEKS_BEFORE = 2, WEEKS_AFTER = 4;

// a cycle's days: week 0 is startDate; the wrap-up opens on the Monday of its last two weeks and closes four weeks after its last day
export function wrapUpDays(cycle) {
  const start = dayNum(cycle.startDate);
  const last = start + (cycle.weeks + 1) * 7 - 1;
  const opens = start + 7 * (cycle.weeks - WEEKS_BEFORE + 1);
  return { start, first: start + 7, last, opens, opensWeek: cycle.weeks - WEEKS_BEFORE + 1, closes: last + 7 * WEEKS_AFTER };
}
export const wrapUpOpen = (cycle, todayIso) => { const d = wrapUpDays(cycle); const t = dayNum(todayIso); return t >= d.opens && t <= d.closes; };
export const nextYearName = (cycle) => (/^\d{4}$/.test(cycle.name) ? String(Number(cycle.name) + 1) : `After ${cycle.name}`);

// the cycle whose wrap-up the screens show: the one whose wrap-up is open today, else the current one
export function wrapUpCycle(cycles, current, todayIso) {
  return (cycles || []).filter((c) => !c.removedAt).find((c) => wrapUpOpen(c, todayIso)) || current;
}

// the goals a cycle's wrap-up asks about: live in that cycle (not removed, not stopped)
export const wrapUpGoals = (goals, cycle) => goals.filter((g) => (g.cycleId || cycle.id) === cycle.id && !g.removedAt && !g.stoppedAt && !g.proposedAt);
export const retroOf = (retros, goalId, cycleId) => (retros || []).find((r) => r.goalId === goalId && r.cycleId === cycleId && !r.removedAt) || null;

// "how did it land", suggested from where it ended: on track or done → hit; at risk → partly; anything else → missed
export function suggestResult(status) { return status === 'done' || status === 'on' ? 'hit' : status === 'risk' ? 'partly' : 'missed'; }
export const RESULT_WORD = { hit: 'Hit', partly: 'Partly', missed: 'Missed' };
export const NEXT_WORD = { carry: 'Carry it on', stop: 'Stop it here' };

// saveRetro's checks, in the action's words (spec/core/actions.md, saveRetro)
export function retroRefusal({ goal, actor, cycle, todayIso, input, copyUsedIn }) {
  if (!actor || (goal.ownerId !== actor.id && !actor.admin)) return 'Only the goal’s owner or an admin can wrap it up.';
  const d = wrapUpDays(cycle), t = dayNum(todayIso);
  if (t < d.opens) return `${cycle.name}’s wrap-up opens on ${dayWithYear(d.opens)}.`;
  if (t > d.closes) return `${cycle.name}’s wrap-up closed on ${dayWithYear(d.closes)}.`;
  if (!['hit', 'partly', 'missed'].includes(input.result)) return 'Say how it landed: hit, partly or missed.';
  if (String(input.learned || '').trim().length < 10) return 'Say what was learned, in a sentence (10 characters or more).';
  if (!['carry', 'stop'].includes(input.next)) return 'Say whether it carries on or stops.';
  if (input.next === 'stop' && copyUsedIn) return `It already has check-ins in ${copyUsedIn}. Stop it there instead.`;
  return null;
}

// wrapUpAsks: switching off asks first only with a wrap-up written in the running year, or while it is open
export function wrapUpAsks({ retros, cycle, open }) { return open || (retros || []).some((r) => r.cycleId === cycle.id && !r.removedAt); }

// wrapUpOffReadBack: the lines switching the Wrap-up off reads back first (null: it acts at once)
export function wrapUpOffReadBack({ goals, retros, cycle, open }) {
  if (!wrapUpAsks({ retros, cycle, open })) return null;
  const inCycle = goals.filter((g) => (g.cycleId || cycle.id) === cycle.id);
  const byId = new Map(inCycle.map((g) => [g.id, g]));
  const mine = (retros || []).filter((r) => r.cycleId === cycle.id && !r.removedAt && byId.has(r.goalId) && !byId.get(r.goalId).removedAt);
  const next = nextYearName(cycle);
  const lines = [];
  let first = 'The wrap-up leaves Home, Goals and Cycles. Owners aren’t asked how their goals landed.';
  if (open) {
    const left = inCycle.filter((g) => !g.removedAt && !g.stoppedAt && !mine.some((r) => r.goalId === g.id)).length;
    if (left) first += left === 1 ? ' 1 goal is not wrapped up yet and won’t be asked for.' : ` ${left} goals are not wrapped up yet and won’t be asked for.`;
  }
  lines.push({ bold: 'The wrap-up leaves Home, Goals and Cycles.', text: first });
  if (mine.length) {
    const b = mine.length === 1 ? '1 wrap-up already written stays' : `${mine.length} wrap-ups already written stay`;
    lines.push({ bold: b, text: `${b} in each goal’s History.` });
  }
  const k = mine.filter((r) => r.next === 'stop').length;
  if (k) {
    const b = k === 1 ? '1 goal was marked “Stop” at its wrap-up' : `${k} goals were marked “Stop” at their wrap-up`;
    lines.push({ bold: b, text: `${b}, and ${k === 1 ? 'it stops' : 'they stop'} when ${next} starts.` });
  }
  lines.push({ bold: 'The year still ends.', text: `The year still ends. Results are worked out as before, and an admin starts ${next} from Cycles.` });
  return lines;
}
export const wrapUpOffLines = (rb) => (rb ? rb.map((l) => l.text).join(' | ') : 'no: it acts at once');
