// The core's read model for the screens: one workspace, judged at a moment through stage 1's rules (S1).
// The screens' rules (navigation, finding, home, read-back) and the app read the workspace only through this.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const ALL_MODULES = ['ai-access', 'feedback', 'goal-map', 'metrics', 'reviews', 'spreadsheets', 'tags', 'watching', 'wrap-up'];

export function makeCore(W, S1) {
  const personById = new Map(W.people.map((p) => [p.id, p]));
  const teamById = new Map(W.teams.map((t) => [t.id, t]));
  const goalById = new Map(W.goals.map((g) => [g.id, g]));
  const goalByKey = new Map(W.goals.map((g) => [g.key, g]));
  const { dayNum, isoOfDay, START, WEEKS, REVIEW_DAY } = S1;
  const cache = new Map();

  const modulesOff = () => {
    const off = W.modulesOff;
    if (off === 'all') return new Set(ALL_MODULES);
    return new Set(off || []);
  };
  const isOn = (id) => !modulesOff().has(id);

  // Every live goal's state at a moment: status, flags, whether it needs attention or is being handled.
  function goalStates(m) {
    if (cache.has(m)) return cache.get(m);
    const ws = S1.asOf(m);
    const out = ws.goals.map((g) => {
      const fl = S1.flagsFor(g, ws, m);
      const handled = S1.handledFor(g, ws, m, fl);
      const others = fl.flags.filter((x) => x !== 'due');
      return { g, status: fl.st.status, latest: fl.st.latest, days: fl.st.days, flags: fl.flags, handled, needs: others.length > 0 && !handled, posted: ws.ckByGoal.get(g.id) || [] };
    });
    out.ws = ws;
    cache.set(m, out);
    return out;
  }
  const stateOf = (id, m) => goalStates(m).find((s) => s.g.id === id) || null;

  const hasGoalToCheckIn = (viewer, m) => goalStates(m).some((s) => s.g.ownerId === viewer && s.status !== 'done');

  const findGoal = (idOrKey) => goalById.get(idOrKey) || goalByKey.get(String(idOrKey).toUpperCase()) || null;
  const names = () => ({
    goal: (id) => { const g = findGoal(id); return g && !g.removedAt ? g : null; },
    review: (id) => (W.reviews || []).find((r) => r.id === id && !r.removedAt) || null,
    person: (id) => personById.get(id) || null,
    team: (id) => teamById.get(id) || null,
  });

  // Dates
  const dayOfWeek = (n) => ((n - START) % 7 + 7) % 7; // 0 = Monday (the cycle starts on one)
  const dueDay = (w) => START + 7 * w + REVIEW_DAY;
  const fmtDay = (n, { weekday = true, year = false } = {}) => {
    const d = new Date(n * 86400000);
    const s = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ''}`;
    return weekday ? `${DAYS[dayOfWeek(n)]} ${s}` : s;
  };
  const shortDay = (n) => `${DAYS[dayOfWeek(n)].slice(0, 3)} ${fmtDay(n, { weekday: false })}`;
  const weekDates = (w) => {
    const a = START + 7 * w, b = a + 6;
    const da = new Date(a * 86400000), db = new Date(b * 86400000);
    if (da.getUTCFullYear() !== db.getUTCFullYear()) return `${fmtDay(a, { weekday: false, year: true })}–${fmtDay(b, { weekday: false, year: true })}`;
    if (da.getUTCMonth() !== db.getUTCMonth()) return `${fmtDay(a, { weekday: false })}–${fmtDay(b, { weekday: false, year: true })}`;
    return `${da.getUTCDate()}–${fmtDay(b, { weekday: false, year: true })}`;
  };

  // A review's walk (goalsIn): goals it names, each tree's goal and all under it, every goal at a level it names.
  function goalsIn(review, goals) {
    const sc = review.scope || {};
    const ids = new Set(sc.goals || []);
    const kids = new Map();
    for (const g of goals) if (g.parentId) { if (!kids.has(g.parentId)) kids.set(g.parentId, []); kids.get(g.parentId).push(g.id); }
    const stack = [...(sc.trees || [])];
    while (stack.length) { const id = stack.pop(); if (ids.has(id) && !(sc.goals || []).includes(id)) continue; ids.add(id); for (const k of kids.get(id) || []) stack.push(k); }
    for (const g of goals) if ((sc.levels || []).includes(g.level)) ids.add(g.id);
    return goals.filter((g) => ids.has(g.id));
  }
  const reviewWeeks = (r, w) => w % (r.everyWeeks || 1) === 0;
  const sessionDay = (r, w) => START + 7 * w + (r.weekday ?? REVIEW_DAY);

  return { W, S1, personById, teamById, goalById, goalByKey, findGoal, modulesOff, isOn, goalStates, stateOf, hasGoalToCheckIn, names,
    DAYS_NAME: (n) => DAYS[dayOfWeek(n)], dayNum, isoOfDay, START, WEEKS, REVIEW_DAY, dayOfWeek, dueDay, fmtDay, shortDay, weekDates, goalsIn, reviewWeeks, sessionDay };
}
