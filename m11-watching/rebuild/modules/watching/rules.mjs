// Watching's rules (spec/modules/watching/rules.md): what a watch covers, the read-back before it goes off,
// Goals' scopes with and without it, and which saves write a watch. Pure: no screens, no server.

export const plural = (n, one, many) => (n === 1 ? one : many);

// people still here: not removed, not left
export const hereIds = (W) => new Set((W.people || []).filter((p) => !p.removedAt && !p.leftAt).map((p) => p.id));

// live watches (not stopped), of people still here unless asked otherwise
export function liveWatches(W, { onlyHere = true } = {}) {
  const here = hereIds(W);
  return (W.watches || []).filter((w) => !w.removedAt && (!onlyHere || here.has(w.personId)));
}

// what one watch covers, among the goals given: a goal; a goal and everything feeding it at any depth; every goal at a level
export function coverOf(goals, watch) {
  const ids = new Set();
  const byId = new Set(goals.map((g) => g.id));
  if (watch.kind === 'goal') { if (byId.has(watch.ref)) ids.add(watch.ref); return ids; }
  if (watch.kind === 'level') { for (const g of goals) if (g.level === watch.ref) ids.add(g.id); return ids; }
  const kids = new Map();
  for (const g of goals) if (g.parentId) { if (!kids.has(g.parentId)) kids.set(g.parentId, []); kids.get(g.parentId).push(g.id); }
  const walk = (id) => { if (ids.has(id)) return; ids.add(id); for (const k of kids.get(id) || []) walk(k); };
  if (byId.has(watch.ref)) walk(watch.ref);
  return ids;
}

// every goal a person's live watches cover, each once
export function watchedIds(goals, watches, personId) {
  const ids = new Set();
  for (const w of watches) if (w.personId === personId && !w.removedAt) for (const id of coverOf(goals, w)) ids.add(id);
  return ids;
}

// who watches a goal: the people whose live watches cover it
export function watchersOf(goals, watches, goalId) {
  const out = new Set();
  for (const w of watches) if (!w.removedAt && coverOf(goals, w).has(goalId)) out.add(w.personId);
  return out;
}

// watchingOffReadBack: the people here with a live watch, their watches, and of them the ones who own no goal
// (not removed or stopped)
export function watchingOffReadBack(W) {
  const live = liveWatches(W);
  const people = [...new Set(live.map((w) => w.personId))];
  const owners = new Set((W.goals || []).filter((g) => !g.removedAt && !g.stoppedAt).map((g) => g.ownerId));
  const seeThrough = people.filter((p) => !owners.has(p));
  return { people: people.length, watches: live.length, seeThrough: seeThrough.length, asks: live.length > 0 };
}

// its words, in order; each line is [bold part, rest]
export function watchingOffLines(rb, { reviewsOn = true } = {}) {
  const lines = [['Watching leaves Goals, Home and every goal’s page', ': the Watching tab, “Goals you watch” and the Watch button.']];
  lines.push([`${rb.people} ${plural(rb.people, 'person’s', 'people’s')} ${rb.watches} ${plural(rb.watches, 'watch is', 'watches are')} kept.`, ' Nobody is shown as watching while it is off.']);
  if (rb.seeThrough) lines.push([`${rb.seeThrough} ${plural(rb.seeThrough, 'person owns', 'people own')} no goal and ${plural(rb.seeThrough, 'sees', 'see')} Home through what they watch.`, ` ${plural(rb.seeThrough, 'Their', 'Their')} Home will show every goal that needs attention instead.`]);
  lines.push(['Goals don’t change.', ` Each is still on its owner’s Home, in Goals${reviewsOn ? ' and in its reviews' : ''}.`]);
  lines.push(['', 'Nothing is deleted. Switch Watching back on and each person watches what they did.']);
  return lines;
}
export const lineText = (l) => (l[0] + l[1]).trim();

// scopesFor: Goals' tabs, in order Mine, My team, Watching, All; Mine only for an owner, My team only with a team,
// Watching only while it is on. Opens on the last one when it is still offered, else Mine, Watching, All.
export function scopesFor({ owns, hasTeam, watchingOn, counts = {}, last }) {
  const tabs = [];
  if (owns) tabs.push('mine');
  if (hasTeam) tabs.push('team');
  if (watchingOn) tabs.push('watching');
  tabs.push('all');
  const opens = tabs.includes(last) ? last : ['mine', 'watching', 'all'].find((t) => tabs.includes(t));
  const NAME = { mine: 'Mine', team: 'My team', watching: 'Watching', all: 'All' };
  return { tabs, opens, words: tabs.map((t) => `${NAME[t]}${counts[t] !== undefined ? ` ${counts[t]}` : ''}`).join(' · ') };
}

// writesWatches: a save is refused while Watching is off when it logs a change to a watch, stops one, or writes
// watches and nothing else. What it only carries along (watches following goals into the next year) still saves.
export function writesWatches(save) {
  const changes = save.changes || [];
  if (changes.some((c) => c.entity === 'watch')) return true;
  const w = save.writes || {};
  if ((w.watches || []).some((x) => x.removedAt)) return true;
  const kinds = Object.keys(w).filter((k) => (w[k] || []).length);
  return kinds.length === 1 && kinds[0] === 'watches';
}

// a watch in words
export function watchWords(W, watch, levelName) {
  const g = (W.goals || []).find((x) => x.id === watch.ref);
  if (watch.kind === 'level') return `Every ${levelName(W, watch.ref)} goal`;
  if (watch.kind === 'tree') return `${g ? g.title : watch.ref} and everything feeding it`;
  return g ? g.title : watch.ref;
}
