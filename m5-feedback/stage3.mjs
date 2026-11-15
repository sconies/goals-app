// Stage 3: the screens' words that are rules (navigation, find, home, read-back), from spec/ alone.
// makeRules(W, S1) gives the functions; writeStage3(...) writes the drill's four CSVs. The server (app.mjs) uses the same.
import fs from 'node:fs';
import path from 'node:path';

export const WORKSPACE_NAME = 'Platform Engineering';
const WD_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WD_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const STATUS_WORD = { on: 'On track', risk: 'At risk', off: 'Off track', stale: 'No recent update', none: 'No check-in yet', planned: 'Not started', unmeasured: 'Not measured yet', done: 'Done' };
export const STATUS_RANK = { off: 0, risk: 1, stale: 1, on: 2, done: 3, planned: 3, none: 3, unmeasured: 3 };
export const LEVEL_WORD = { 'north-star': 'North star', svp: 'SVP', team: 'Team' };
export const FLAG_WORD = { off: 'Off track', 'missed-path': 'Missed its own date', stale: 'No recent update', decision: 'Decision or help needed', 'no-path': 'No path to green', risk: 'At risk', trend: 'Getting worse', greener: 'Greener than calculated', due: 'Due' };

export function fold(s) { return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
// words: break at spaces and / - , . : ( ), except a point or comma between two digits
export function wordsOf(text) {
  const s = fold(text);
  const out = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ((ch === '.' || ch === ',') && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '')) { cur += ch; continue; }
    if (/[\s\/\-,.:()]/.test(ch)) { if (cur) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
export function matches(rowWords, q) {
  const qs = wordsOf(q);
  return qs.every((w) => rowWords.some((rw) => rw.startsWith(w)));
}
function edit1(a, b) {
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    const diff = []; for (let i = 0; i < la; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
    return false;
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0, j = 0, skipped = false;
  while (i < s.length && j < l.length) { if (s[i] === l[j]) { i++; j++; } else { if (skipped) return false; skipped = true; j++; } }
  return true;
}
export function keyOfQuery(q) {
  const m = String(q).trim().match(/^g?-?\s*(\d+)$/i);
  return m ? Number(m[1]) : null;
}

export function makeRules(W, S1) {
  const { START, WEEKS, dayNum, isoOfDay, currentWeek, weekMoment } = S1;
  const REVIEW_DAY = W.cycle.reviewDay;
  const people = W.people || [];
  const teams = W.teams || [];
  const person = new Map(people.map((p) => [p.id, p]));
  const team = new Map(teams.map((t) => [t.id, t]));
  const goals = (W.goals || []).filter((g) => !g.removedAt);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const goalNum = (k) => Number(String(k).replace(/^\D+/, ''));
  const firstName = (id) => (person.get(id)?.name || id).split(' ')[0];

  // ---------- dates ----------
  const dateOf = (d) => new Date(d * 86400000);
  const wd = (d) => ((d % 7) + 7 + 3) % 7; // day 0 (1970-01-01) was a Thursday
  const dayLong = (d) => `${WD_LONG[wd(d)]} ${dateOf(d).getUTCDate()} ${MON[dateOf(d).getUTCMonth()]}`; // Thursday 12 Nov
  const dayShort = (d) => `${WD_SHORT[wd(d)]} ${dateOf(d).getUTCDate()} ${MON[dateOf(d).getUTCMonth()]}`; // Thu 12 Nov
  const dm = (d) => `${dateOf(d).getUTCDate()} ${MON[dateOf(d).getUTCMonth()]}`; // 4 Aug
  const yr = (d) => dateOf(d).getUTCFullYear();
  const weekRange = (w) => {
    const a = START + 7 * w, b = a + 6;
    const A = dateOf(a), B = dateOf(b);
    if (yr(a) !== yr(b)) return `${dm(a)} ${yr(a)}–${dm(b)} ${yr(b)}`;
    if (A.getUTCMonth() !== B.getUTCMonth()) return `${dm(a)}–${dm(b)} ${yr(b)}`;
    return `${A.getUTCDate()}–${B.getUTCDate()} ${MON[B.getUTCMonth()]} ${yr(b)}`;
  };
  const dueDay = (w) => START + 7 * w + REVIEW_DAY;

  // ---------- the workspace as it stood ----------
  const cache = new Map();
  function standing(moment) {
    if (cache.has(moment)) return cache.get(moment);
    const ws = S1.asOf(moment);
    const st = new Map();
    for (const g of ws.goals) {
      const fl = S1.flagsFor(g, ws, moment);
      const handled = S1.handledFor(g, ws, moment, fl);
      st.set(g.id, { status: fl.st.status, flags: fl.flags, handled, latest: fl.st.latest });
    }
    const r = { ws, st, moment };
    cache.set(moment, r);
    return r;
  }
  const ownsToCheckIn = (viewer, moment) => {
    const { ws, st } = standing(moment);
    return ws.goals.some((g) => g.ownerId === viewer && st.get(g.id).status !== 'done');
  };

  // ---------- navigation ----------
  function menuGroups(viewer, opt = {}) {
    const reviewsOn = opt.reviewsOn !== false, feedbackOn = opt.feedbackOn !== false;
    const owns = opt.owns ?? ownsToCheckIn(viewer, W.builtFor);
    const g1 = ['home']; if (owns) g1.push('checkin'); g1.push('goals'); if (reviewsOn) g1.push('reviews');
    const g2 = ['people', ...(opt.modules || []).map((m) => `module:${m}`), 'activity', 'data'];
    const g3 = ['new'];
    const g4 = ['workspace', 'settings', 'help']; if (feedbackOn) g4.push('feedback');
    return [g1, g2, g3, g4];
  }
  function phoneTabs(viewer, opt = {}) {
    const reviewsOn = opt.reviewsOn !== false;
    const owns = opt.owns ?? ownsToCheckIn(viewer, W.builtFor);
    if (reviewsOn) return owns ? ['home', 'checkin', 'goals', 'reviews'] : ['home', 'goals', 'reviews', 'people'];
    return owns ? ['home', 'checkin', 'goals', 'people'] : ['home', 'goals', 'people', 'activity'];
  }
  const parseAddr = (address) => {
    const [p, q = ''] = address.split('?');
    const params = new URLSearchParams(q);
    return { parts: p.split('/').filter(Boolean), params, path: p };
  };
  function findGoal(ref) {
    if (goalById.has(ref)) return goalById.get(ref);
    const k = keyOfQuery(ref);
    if (k !== null) return goals.find((g) => goalNum(g.key) === k) || null;
    return null;
  }
  const reviewById = (id) => (W.reviews || []).find((r) => r.id === id && !r.removedAt);
  function litItem(address, opt = {}) {
    const { parts, params } = parseAddr(address);
    const reviewsOn = opt.reviewsOn !== false;
    const a = parts[0];
    if (!a) return 'home';
    if (a === 'goals') {
      if (parts[1] === 'new') return 'new';
      if (parts[1] && params.get('review') && reviewsOn) return 'reviews';
      return 'goals';
    }
    if (a === 'watching' || a === 'retro') return 'goals';
    if (a === 'check-in' || a === 'quick-check-in') return 'checkin';
    if (a === 'reviews') return reviewsOn ? 'reviews' : '';
    if (a === 'people' || a === 'teams') return 'people';
    if (a === 'activity' || a === 'data' || a === 'settings') return a;
    if (a === 'feedback') return opt.feedbackOn === false ? '' : 'feedback';
    if (a === 'workspace') return parts[1] === 'new' ? '' : 'workspace';
    if (a === 'help' || a === 'whats-new') return 'help';
    if (a === 'example') return 'module:example';
    return '';
  }
  const STEP_TITLES = { what: 'What is the goal?', who: 'Who and where', measure: 'How it’s measured', check: 'Check and publish' };
  const SETUP_TITLES = {};
  function pageName(address, opt = {}) {
    const { parts, params } = parseAddr(address);
    const reviewsOn = opt.reviewsOn !== false;
    const a = parts[0];
    const fixed = { '': 'Home', goals: 'Goals', watching: 'Goals', 'check-in': 'Check-in', 'quick-check-in': 'Check-in, all in one table', reviews: 'Reviews', people: 'People', teams: 'Teams', activity: 'Activity', data: 'Data', workspace: 'Workspace', settings: 'Settings', help: 'Help', 'whats-new': 'What’s new', feedback: 'Feedback', research: 'Research', ready: 'Ready to start' };
    if (!a) return 'Home';
    if (a === 'example') return 'Example';
    if (a === 'goals') {
      if (!parts[1]) return 'Goals';
      if (parts[1] === 'new') return parts[2] ? STEP_TITLES[parts[2]] || 'New goal' : 'New goal';
      const g = findGoal(decodeURIComponent(parts[1]));
      if (!g) return 'Goal not found';
      if (parts[2] === 'edit') return `Change ${g.title}`;
      if (parts[2] === 'print') return `${g.title}, to print`;
      if (parts[2]) return 'Page not found';
      const rv = params.get('review');
      if (rv && reviewsOn) { const r = reviewById(rv); return r ? `${g.title} · ${r.name}` : g.title; }
      return g.title;
    }
    if (a === 'check-in') {
      if (!parts[1]) return 'Check-in';
      const g = findGoal(decodeURIComponent(parts[1]));
      return g ? `Check in: ${g.title}` : 'Goal not found';
    }
    if (a === 'retro') {
      if (parts[1]) { const g = findGoal(decodeURIComponent(parts[1])); return g ? `Wrap up: ${g.title}` : 'Goal not found'; }
      return 'Wrap up';
    }
    if (a === 'reviews') {
      if (!reviewsOn) return 'Page not found';
      if (!parts[1]) return 'Reviews';
      if (parts[1] === 'new') return 'New review';
      const r = reviewById(parts[1]);
      if (!r) return 'Review not found';
      if (parts[2] === 'edit') return `Change ${r.name}`;
      if (parts[2] === 'summary') return `${r.name}: summary`;
      if (parts[2] === 'print') return `${r.name}, to print`;
      return r.name;
    }
    if (a === 'people') {
      if (!parts[1]) return 'People';
      const p = person.get(decodeURIComponent(parts[1]));
      return p ? p.name : 'Person not found';
    }
    if (a === 'teams') {
      if (!parts[1]) return 'Teams';
      const t = team.get(decodeURIComponent(parts[1]));
      return t ? t.name : 'Team not found';
    }
    if (a === 'workspace') {
      if (!parts[1]) return 'Workspace';
      if (parts[1] === 'new') return 'Set up a workspace';
      if (parts[1] === 'cycles' && parts[2] === 'next') return 'Start the next year · Workspace';
      return 'Workspace';
    }
    if (a === 'help') return 'Help';
    if (a === 'feedback' && opt.feedbackOn === false) return 'Page not found';
    if (parts.length === 1 && fixed[a]) return fixed[a];
    return 'Page not found';
  }
  function navigationRow(viewer, address) {
    let opt = {}, addr = address;
    const m = address.match(/^(.*) \((.*)\)$/);
    if (m) {
      addr = m[1];
      if (m[2] === 'Reviews off') opt = { reviewsOn: false };
      else if (m[2] === 'Feedback off') opt = { feedbackOn: false };
      else if (m[2] === 'every feature off') opt = { reviewsOn: false, feedbackOn: false };
    }
    if (/^\/example/.test(addr)) opt.modules = ['example'];
    const owns = ownsToCheckIn(viewer, W.builtFor);
    return {
      viewer, owns_goals: owns ? 'yes' : 'no', address,
      menu: menuGroups(viewer, { ...opt, owns }).map((g) => g.join(' ')).join(' | '),
      tabs: phoneTabs(viewer, { ...opt, owns }).join(' '),
      lit: (() => { const l = litItem(addr, opt); return menuGroups(viewer, { ...opt, owns }).flat().includes(l) ? l : ''; })(), page: pageName(addr, opt),
    };
  }

  // ---------- find ----------
  function goalRows(moment = W.builtFor) {
    const { ws, st } = standing(moment);
    return ws.goals.map((g) => {
      const s = st.get(g.id);
      const latest = s.latest;
      const owner = person.get(g.ownerId), tm = team.get(g.teamId);
      const text = [g.title, g.key, owner?.name, tm?.name, LEVEL_WORD[g.level] || g.level, STATUS_WORD[s.status],
        latest?.why, latest?.pathToGreen ? [latest.pathToGreen.what, latest.pathToGreen.needs].filter(Boolean).join(' ') : '', g.definition, g.source].filter(Boolean).join(' ');
      return { id: g.id, key: g.key, g, status: s.status, flags: s.flags, handled: s.handled, words: wordsOf(text) };
    }).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || fold(a.g.title).localeCompare(fold(b.g.title)));
  }
  const personRows = () => people.filter((p) => !p.leftAt && !p.left).map((p) => ({ id: p.id, p, words: wordsOf([p.name, p.title, team.get(p.teamId)?.name].filter(Boolean).join(' ')) }));
  const teamRows = () => teams.filter((t) => !t.removedAt).map((t) => ({ id: t.id, t, words: wordsOf([t.name, person.get(t.leadId)?.name].filter(Boolean).join(' ')) }))
    .sort((a, b) => fold(a.t.name).localeCompare(fold(b.t.name)));
  function nearOf(rows, q) {
    const qs = wordsOf(q);
    const counts = new Map();
    for (const r of rows) for (const w of new Set(r.words)) counts.set(w, (counts.get(w) || 0) + 1);
    const all = [...counts.keys()];
    const out = [];
    for (const w of qs) {
      if (all.some((x) => x.startsWith(w))) { out.push(w); continue; }
      if (w.length < 4) return null;
      const cands = all.filter((x) => edit1(w, x));
      if (!cands.length) return null;
      cands.sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
      out.push(cands[0]);
    }
    return out.join(' ');
  }
  function search(kind, q, opt = {}) {
    let rows = kind === 'goal' ? goalRows(opt.moment) : kind === 'person' ? personRows() : teamRows();
    if (kind === 'goal') {
      const k = keyOfQuery(q);
      if (k !== null && /^\s*g/i.test(q)) {
        const hit = rows.filter((r) => goalNum(r.key) === k);
        return { total: hit.length, rows: hit, near: '' };
      }
      if (k !== null) {
        const hit = rows.filter((r) => goalNum(r.key) === k || matches(r.words, q));
        // a whole search that is one key: that goal first
        hit.sort((a, b) => (goalNum(b.key) === k) - (goalNum(a.key) === k));
        return { total: hit.length, rows: hit, near: '' };
      }
    }
    if (kind === 'person') {
      const qq = fold(q).trim();
      rows = rows.sort((a, b) => {
        const sa = qq && fold(a.p.name).startsWith(qq) ? 0 : 1, sb = qq && fold(b.p.name).startsWith(qq) ? 0 : 1;
        return sa - sb || fold(a.p.name).localeCompare(fold(b.p.name));
      });
    }
    const hit = rows.filter((r) => matches(r.words, q));
    if (hit.length || keyOfQuery(q) !== null) return { total: hit.length, rows: hit, near: '' };
    const near = nearOf(rows, q);
    if (!near) return { total: 0, rows: [], near: '' };
    const nh = rows.filter((r) => matches(r.words, near));
    return nh.length ? { total: nh.length, rows: nh, near } : { total: 0, rows: [], near: '' };
  }
  function findRow(kind, q) {
    const r = search(kind, q);
    return { kind, q, total: r.total, near: r.near, ids: r.rows.map((x) => x.id).join(' ') };
  }

  // ---------- reviews ----------
  function goalsIn(review, goalList) {
    const sc = review.scope || { goals: [], trees: [], levels: [] };
    const set = new Set(sc.goals);
    const kids = new Map();
    for (const g of goalList) { if (!kids.has(g.parentId)) kids.set(g.parentId, []); kids.get(g.parentId).push(g); }
    const walk = (id) => { set.add(id); for (const k of kids.get(id) || []) walk(k.id); };
    for (const t of sc.trees) walk(t);
    return goalList.filter((g) => set.has(g.id) || sc.levels.includes(g.level));
  }
  const reviewDay = (r, w) => START + 7 * w + r.weekday;
  const meetsIn = (r, w) => w >= 1 && w % r.everyWeeks === 0;
  function reviewHeld(r, w, moment) {
    const { ws } = standing(moment);
    const gl = goalsIn(r, ws.goals);
    if (!gl.length) return false;
    const marked = new Set((W.decisions || []).filter((d) => d.reviewId === r.id && d.week === w && d.at <= moment).map((d) => d.goalId));
    return gl.every((g) => marked.has(g.id));
  }

  // ---------- the habit ----------
  function dueGoalsFor(viewer, w, moment) {
    const { ws } = standing(moment);
    const out = [];
    for (const g of ws.goals) {
      if (g.ownerId !== viewer) continue;
      if (g.proposedAt) continue;
      if (w < S1.firstDueWeek(g)) continue;
      if (g.unmeasuredSince) continue;
      const cks = (ws.ckByGoal.get(g.id) || []);
      const doneBefore = cks.some((c) => c.status === 'done' && c.week < w);
      if (doneBefore) continue;
      out.push(g);
    }
    return out;
  }
  function weekOnTime(viewer, w, moment) {
    const due = dueGoalsFor(viewer, w, moment);
    if (!due.length) return null; // nothing due
    const { ws } = standing(moment);
    let onTime = true, missed = false;
    for (const g of due) {
      const cks = (ws.ckByGoal.get(g.id) || []).filter((c) => c.week === w && !c.backfilled && !c.removedAt);
      const mine = cks.filter((c) => c.authorId === viewer);
      if (!mine.length) missed = true;
      if (!mine.some((c) => dayNum(c.postedAt) <= dueDay(w))) onTime = false;
    }
    return { onTime, missed };
  }
  function onTimeStreak(viewer, moment) {
    const w0 = currentWeek(moment);
    const due0 = dueGoalsFor(viewer, w0, moment);
    const { ws } = standing(moment);
    const allIn = due0.length && due0.every((g) => (ws.ckByGoal.get(g.id) || []).some((c) => c.week === w0));
    let w = allIn ? w0 : w0 - 1;
    let run = 0, forgiven = '';
    const states = new Map();
    const stateOf = (x) => { if (!states.has(x)) states.set(x, x >= 1 ? weekOnTime(viewer, x, moment) : null); return states.get(x); };
    for (; w >= 1; w--) {
      const s = stateOf(w);
      if (!s) break;
      if (s.onTime) { run++; continue; }
      // forgiven?
      let found = 0, ok = true;
      for (let x = w - 1; x >= 1 && found < 4; x--) { const t = stateOf(x); if (!t) continue; found++; if (!t.onTime) { ok = false; break; } }
      if (ok && found === 4) { if (!forgiven) forgiven = `${w} ${s.missed ? 'missed' : 'late'}`; continue; }
      break;
    }
    return { run, forgiven };
  }

  // ---------- asks waiting ----------
  function asksWaiting(viewer, moment) {
    const { ws } = standing(moment);
    const today = dayNum(moment);
    const w = currentWeek(moment);
    const out = [];
    for (const a of ws.asks) {
      if (a.status !== 'open') continue;
      if (a.recipientId !== viewer) continue;
      if (a.askedBy === viewer) continue;
      let due = null;
      if (a.dueWeek !== null && a.dueWeek !== undefined) due = START + 7 * a.dueWeek + 6;
      else if (a.kind === 'question' && a.reviewId) {
        const r = reviewById(a.reviewId);
        if (r) { let x = (a.week ?? currentWeek(a.createdAt)) + 1; while (!meetsIn(r, x) && x <= WEEKS + 1) x++; due = reviewDay(r, x); }
      }
      const asked = dayNum(a.createdAt);
      const late = due !== null && today > due;
      const thisWeek = due !== null && !late && due <= START + 7 * w + 6;
      const waited = today - asked;
      const group = late ? 0 : thisWeek ? 1 : due === null && waited >= 7 ? 2 : 3;
      out.push({ a, due, late, thisWeek, waited, asked, group });
    }
    const kindRank = { decision: 0, question: 1, update: 2, action: 3 };
    out.sort((x, y) => x.group - y.group || (x.group === 2 ? x.asked - y.asked : x.group === 3 ? y.asked - x.asked : 0) || kindRank[x.a.kind] - kindRank[y.a.kind]);
    return out;
  }
  const waitedWords = (n) => (n >= 14 ? `${Math.floor(n / 7)} weeks` : `${n} days`);

  // ---------- Home ----------
  function homeFor(viewer, moment) {
    const { ws, st } = standing(moment);
    const today = dayNum(moment);
    const w = currentWeek(moment);
    const due = dueDay(w);
    const mine = ws.goals.filter((g) => g.ownerId === viewer);
    const dueGoals = dueGoalsFor(viewer, w, moment);
    const toDo = dueGoals.filter((g) => !(ws.ckByGoal.get(g.id) || []).some((c) => c.week === w));
    const myReviews = (W.reviews || []).filter((r) => !r.removedAt && !r.endedAt && r.people.includes(viewer));
    const reviewToday = myReviews.filter((r) => meetsIn(r, w) && reviewDay(r, w) === today && !reviewHeld(r, w, moment));
    const n = toDo.length;
    const cks = (k) => `${k} check-in${k === 1 ? '' : 's'}`;
    let lead = null;
    if (n && today > due) lead = { kind: 'check-in-late', title: `${cks(n)} still to do`, head: `Check-ins were due on ${dayLong(due)}` };
    else if (n && reviewToday.length) lead = { kind: 'check-in', title: `${cks(n)} to do before it`, head: `${reviewToday[0].name} is today` };
    else if (n && due - today <= 1) lead = { kind: 'check-in', title: `${cks(n)} to do`, head: `Check-ins are due by ${dayLong(due)}, ${due === today ? 'today' : 'tomorrow'}` };
    if (!lead && !n) {
      const rv = myReviews.filter((r) => meetsIn(r, w) && today >= reviewDay(r, w) && !reviewHeld(r, w, moment))
        .sort((a, b) => reviewDay(a, w) - reviewDay(b, w) || a.name.localeCompare(b.name));
      if (rv.length) {
        const { ws: ws2 } = standing(moment);
        const marked = new Set((W.decisions || []).filter((d) => d.reviewId === rv[0].id && d.week === w && d.at <= moment).map((d) => d.goalId));
        const left = goalsIn(rv[0], ws2.goals).filter((g) => !marked.has(g.id) && st.get(g.id).flags.some((f) => f !== "due")).length;
        lead = { kind: 'review', title: `${left} goal${left === 1 ? '' : 's'} to discuss`, head: reviewDay(rv[0], w) === today ? `${rv[0].name} is today` : `${rv[0].name} · Not held yet`, review: rv[0] };
      }
    }
    const waiting = asksWaiting(viewer, moment);
    if (!lead) {
      const first = waiting.find((x) => x.group <= 2);
      if (first) {
        const k = first.a.kind;
        const who = firstName(first.a.askedBy);
        const title = k === 'decision' ? `${who} needs a decision` : k === 'question' ? `${who} asked a question` : k === 'update' ? `${who} asked for an update` : 'A next step you agreed is due';
        lead = { kind: 'ask', title, head: 'Needs your response', ask: first };
      }
    }
    const { run, forgiven } = onTimeStreak(viewer, moment);
    if (lead) return { lead: lead.kind, title: lead.title, head: lead.head, review: lead.review, quiet: '', run, forgiven, toDo, waiting };
    // quiet line
    const nAsks = waiting.length;
    let sentence = nAsks === 1 ? 'One ask waits for your response.' : nAsks > 1 ? `${nAsks} asks wait for your response.` : 'Nothing is asked of you today.';
    let line = '';
    const watches = (W.watches || []).filter((x) => x.personId === viewer && !x.removedAt);
    if (n) line = `Check-ins for week ${w} are due by ${dayLong(due)}. You have ${n} to do.`;
    else if (dueGoals.length) {
      const total = dueGoals.length;
      const lastPosted = Math.max(...dueGoals.map((g) => Math.max(...(ws.ckByGoal.get(g.id) || []).filter((c) => c.week === w).map((c) => dayNum(c.postedAt)))));
      const nextDue = dayLong(dueDay(w + 1));
      if (lastPosted === today) {
        const after = dueGoals.filter((g) => {
          const first = (ws.ckByGoal.get(g.id) || []).filter((c) => c.week === w).map((c) => dayNum(c.postedAt)).sort((a, b) => a - b)[0];
          return first > due;
        }).length;
        const yours = total === 1 ? 'Your check-in is' : total === 2 ? 'Both of your check-ins are' : `All ${total} of your check-ins are`;
        const held = myReviews.some((r) => meetsIn(r, w) && reviewDay(r, w) === due);
        const by = held ? `before ${WD_LONG[wd(due)]}’s review` : `by ${WD_LONG[wd(due)]}`;
        const aft = held ? `after ${WD_LONG[wd(due)]}’s review` : `after ${WD_LONG[wd(due)]}`;
        if (!after) {
          line = `${yours} in ${by}.`;
          if (run >= 2) line += ` That is ${run} weeks in a row.`;
          if (run >= 2 && forgiven && Number(forgiven.split(' ')[0]) === w - 1) line += forgiven.endsWith('missed') ? ` Week ${w - 1} was missed; one missed week doesn’t break a run.` : ` Week ${w - 1} came in late; one late week doesn’t break a run.`;
          line += ` The next ${total === 1 ? 'is' : 'are'} due by ${nextDue}.`;
        } else {
          const who = total === 1 ? 'It' : after === total ? (total === 2 ? 'Both' : 'All of them') : after === 1 ? 'One' : String(after);
          line = `${yours} in. ${who} came ${aft}.`;
          if (w < WEEKS) line += ` The next ${total === 1 ? 'is' : 'are'} due by ${nextDue}.`;
        }
        return { lead: '', title: '', quiet: line, run, forgiven, toDo, waiting };
      }
      const allw = total === 1 ? 'Your check-in is' : total === 2 ? 'Both check-ins are' : `All ${total} check-ins are`;
      line = `${allw} in for week ${w}. The next ${total === 1 ? 'is' : 'are'} due by ${nextDue}.`;
      if (!nAsks) return { lead: '', title: '', quiet: line, run, forgiven, toDo, waiting };
    } else if (!mine.length && !watches.length && !nAsks) line = `You don’t own or watch a goal in ${WORKSPACE_NAME} yet.`;
    return { lead: '', title: '', quiet: [sentence, line].filter(Boolean).join(' '), run, forgiven, toDo, waiting, sentence, line };
  }

  return { menuGroups, phoneTabs, litItem, pageName, navigationRow, findGoal, search, findRow, goalRows, personRows, teamRows, homeFor, onTimeStreak, asksWaiting,
    goalsIn, meetsIn, reviewDay, reviewHeld, standing, dayLong, dayShort, dm, weekRange, dueDay, person, team, goalById, firstName, ownsToCheckIn, dueGoalsFor, reviewById, START, WEEKS, REVIEW_DAY };
}

// ---------- the drill's inputs and the files ----------
export const NAV_VIEWERS = ['rhea', 'oskar'];
export function navAddresses(W) {
  return ['/', '/goals', '/goals?scope=watching', '/watching', '/goals/ns-lead', '/goals/G-1', '/goals/ns-lead/edit', '/goals/ns-lead/print', '/goals/ns-lead?review=weekly', '/goals/nope',
    '/goals/new', '/check-in', '/check-in/ns-lead', '/quick-check-in', '/reviews', '/reviews/new', '/reviews/weekly', '/people', '/people/rhea', '/teams', '/teams/cicd', '/activity', '/data',
    '/workspace', '/workspace/people', '/workspace/new', '/workspace/cycles/next', '/settings', '/help', '/whats-new', '/feedback', '/research', '/ready', '/retro', '/example', '/nowhere',
    '/ (Reviews off)', '/ (Feedback off)', '/ (every feature off)'];
}
export const FIND_CASES = [['goal', 'G-48'], ['goal', 'tunde'], ['goal', 'rolback'], ['goal', 'zzzz'], ['person', 'tunde'], ['person', 'LUCIA'], ['team', 'rhea'],
  ['person', 'rhea'], ['goal', '48'], ['goal', 'g48']];
export const HOME_VIEWERS = ['tunde', 'rhea', 'amara', 'oskar'];

const csvCell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const writeCsv = (file, head, rows) => fs.writeFileSync(file, [head, ...rows.map((r) => head.map((h) => r[h]))].map((r) => r.map(csvCell).join(',')).join('\n') + '\n');

export function writeStage3(W, S1, outDir, inputs = {}) {
  const R = makeRules(W, S1);
  const nav = [];
  for (const v of NAV_VIEWERS) for (const a of (inputs.nav || navAddresses(W))) nav.push(R.navigationRow(v, a));
  writeCsv(path.join(outDir, 'navigation.csv'), ['viewer', 'owns_goals', 'address', 'menu', 'tabs', 'lit', 'page'], nav);
  const seen = new Set();
  const find = [];
  for (const [k, q] of (inputs.find || FIND_CASES)) { const key = k + '\u0001' + q; if (seen.has(key)) continue; seen.add(key); find.push(R.findRow(k, q)); }
  writeCsv(path.join(outDir, 'find.csv'), ['kind', 'q', 'total', 'near', 'ids'], find);
  const home = [];
  const end = S1.dayNum(W.builtFor);
  for (const v of HOME_VIEWERS) for (let d = end - 13; d <= end; d++) {
    const day = S1.isoOfDay(d);
    const h = R.homeFor(v, `${day}T12:00:00.000Z`);
    home.push({ viewer: v, day, ...h });
  }
  writeCsv(path.join(outDir, 'home.csv'), ['viewer', 'day', 'lead', 'title', 'quiet', 'run', 'forgiven'], home);
  const rb = [];
  if (inputs.readback) {
    const { readBackRow } = inputs;
    for (const c of inputs.readback) rb.push(readBackRow(R, W, S1, c));
  }
  writeCsv(path.join(outDir, 'readback.csv'), ['case', 'viewer', 'draft', 'rows', 'after'], rb);
  return R;
}
