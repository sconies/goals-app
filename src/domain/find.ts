/* Finding things (docs/design/find/spec.md, section 5): what a search matches, a near miss, and one search function per
   kind. Every list bar, picker and Find reaches these through the Search port (src/ports/search.ts), whose browser
   adapter calls them over the loaded workspace; the internal app's adapter asks its server instead. Pure: each rule takes
   only the rows it reads (src/app/reads.ts makes them), never the whole workspace, and no clock. */
import { fold } from './fold';
import { levelName } from './levels';
import { formatKey, normalKey } from './goalKey';
import { applyQuery, parseQuery, type QueryContext } from './query';
import type { GoalSummary } from './summary';
import type { DisplayStatus, Person, Team } from './types';

/* ---------- Rule 1: does text match ---------- */

/** Lower case, accents gone: "Lucía" reads as "lucia" (domain/fold.ts). */
export { fold };

/**
 * The words of a text: broken at spaces and at / - , . : ( ), folded. A point or comma between two digits stays in its
 * number, so 12.5 is one word and finds 12.5, not every row with a 12 and a 5 (build review of #234).
 */
export const wordsOf = (s: string) => fold(s).split(/[\s/\-:()]+|(?<!\d)[.,]+|[.,]+(?!\d)/).filter(Boolean);

/**
 * Rule 1. True when every word of `q` starts a word of `words`, ignoring case and accents (words break at spaces and at
 * / - , . : ( ), but a number keeps its point: 12.5). A goal's key (`key`) finds it however it is typed ("G-48", "g48", "48"); a whole search that is one key
 * finds only that goal ("G-48" isn't G-4), while a bare number also matches as words. An empty search matches anything.
 */
export function textMatches(words: string, q: string, key?: string | null): boolean {
  return wordsMatch(wordsOf(words), q, key);
}

/** Rule 1 over words already split by `wordsOf` (a long list splits each row once, not on every key). */
export function wordsMatch(have: readonly string[], q: string, key?: string | null): boolean {
  const asked = wordsOf(q);
  if (!asked.length) return true;
  const typedKey = normalKey(q.trim());
  if (typedKey) return !!key && typedKey === key;
  const bare = /^\d{1,9}$/.test(q.trim()) ? formatKey(Number(q.trim())) : null;
  if (bare && key && bare === key) return true;
  return asked.every((w) => have.some((h) => h.startsWith(w)));
}

/* ---------- Rule 5: a near miss ---------- */

/** One letter added, dropped or changed, or two next to each other swapped. */
export function oneEditApart(a: string, b: string): boolean {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0]! + 1 && a[diff[0]!] === b[diff[1]!] && a[diff[1]!] === b[diff[0]!];
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
}

/**
 * Rule 5. Only when rule 1 finds nothing: each word of `q` that starts none of the list's words, and has 4 letters
 * or more, is corrected to the commonest of the list's words one edit away (`oneEditApart`). Returns the corrected search
 * when every such word has a correction and something changed; otherwise null. Never applied to a key, nor to a search
 * with a short word that matches nothing.
 */
export function nearMiss(q: string, vocabulary: string[]): string | null {
  if (normalKey(q.trim()) || /^\d+$/.test(q.trim())) return null;
  const asked = wordsOf(q);
  if (!asked.length) return null;
  const count = new Map<string, number>();
  for (const w of vocabulary.flatMap(wordsOf)) count.set(w, (count.get(w) ?? 0) + 1);
  let changed = false;
  const out: string[] = [];
  for (const w of asked) {
    if ([...count.keys()].some((v) => v.startsWith(w))) { out.push(w); continue; }
    if (w.length < 4) return null;
    const best = [...count.entries()].filter(([v]) => oneEditApart(w, v)).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0];
    if (!best) return null;
    out.push(best[0]);
    changed = true;
  }
  return changed ? out.join(' ') : null;
}

/* ---------- Rule 7: one search function per kind ---------- */

/** What a list, a picker or Find asks for. `filters` are the list's address parameters (a Goals link's, for goals). */
export interface SearchAsk {
  q: string;
  filters?: Record<string, string>;
  /** The list's sort key (a Goals link's `sort=`); each kind has its natural order when none is given. */
  sort?: string | null;
  /** Where the last page ended (the `next` it gave); none for the first page. */
  after?: string | null;
  /** Rows per page; 50 when not given, at most 200. */
  size?: number;
}

/** A thing found: the same two lines for every kind, in a picker, a list and Find (find spec, 2.3). */
export interface FoundRow {
  kind: string;
  id: string;
  /** Line 1: the name (a goal's title). */
  name: string;
  /** Line 2: "{key} · {owner} · {team}", "{job title} · {team}", "Led by {name} · {n} people". */
  detail: string;
  /** A goal's status, shown first as its shape and word. */
  status?: DisplayStatus;
  /** A proposed goal (GE10): the word "Proposed" where the status would be, with no shape. */
  state?: 'proposed';
  /** A goal's key (G-48). */
  key?: string | null;
}

export interface SearchAnswer {
  /** How many match in all, on every page. */
  total: number;
  rows: FoundRow[];
  /** Pass as `after` for the next page; null on the last. */
  next: string | null;
  /** Rule 5's corrected search, when nothing matched and a near miss did. The rows are then that search's. */
  near?: string;
}

/** What each kind's search reads: rows, not the workspace (AR4). src/app/reads.ts makes them. */
export interface GoalRows { kind: 'goal'; summaries: GoalSummary[]; ctx: QueryContext }
export interface PersonRows { kind: 'person'; people: Person[]; teamName: (id: string) => string; /** A team's lead's id, for rule 6's "its lead first". */ teamLead?: (id: string) => string | null }
export interface TeamRows { kind: 'team'; teams: Team[]; people: Pick<Person, 'id' | 'name' | 'teamId' | 'leftAt'>[] }
export interface WorkspaceRows { kind: 'workspace'; workspaces: { id: string; name: string; detail: string }[] }

export const PAGE = 50;
const MAX_PAGE = 200;

/** One page of `all`, from `after` (an offset, as Faro's adapter writes it). */
export function page(all: FoundRow[], ask: SearchAsk): Pick<SearchAnswer, 'rows' | 'next' | 'total'> {
  const size = Math.min(MAX_PAGE, Math.max(1, Math.floor(ask.size ?? PAGE)));
  const from = Math.max(0, Number.parseInt(ask.after ?? '0', 10) || 0);
  const rows = all.slice(from, from + size);
  return { total: all.length, rows, next: from + size < all.length ? String(from + size) : null };
}

/** The words a goal's row is found by (find spec, 2.1): title, key, owner, team, level, status word, this week's reason and path to green, definition, source, and its unit (so "See goals in min" finds them). */
export const goalWords = (s: GoalSummary) => [s.goal.title, s.goal.key ?? '', s.owner, s.team, levelName(null, s.goal.level), s.statusLabel, s.story.why ?? '', s.story.doing ?? '', s.story.needs ?? '', s.goal.definition, s.goal.source, s.goal.kind !== 'milestone' ? s.goal.unit : ''].join(' ');
export const goalRow = (s: GoalSummary): FoundRow => ({ kind: 'goal', id: s.goal.id, name: s.goal.title, detail: [s.goal.key, s.owner, s.team].filter(Boolean).join(' · '), ...(s.state === 'proposed' ? { state: 'proposed' as const } : { status: s.status }), key: s.goal.key ?? null });

/** Goals: the Goals link's filters and sort (query.ts), with rule 1 for the words; worst first unless sorted. */
export function searchGoals(r: GoalRows, ask: SearchAsk): FoundRow[] {
  const query = { ...parseQuery(new URLSearchParams({ ...(ask.filters ?? {}), ...(ask.sort ? { sort: ask.sort } : {}) })), q: '' };
  const listed = applyQuery(r.summaries, { ...query, sort: query.sort ?? 'worst' }, r.ctx);
  return listed.filter((s) => textMatches(goalWords(s), ask.q, s.goal.key)).map(goalRow);
}

/** A person's row: "{job title} · {team}" under the name. */
export const personRow = (r: PersonRows, p: Person): FoundRow => ({ kind: 'person', id: p.id, name: p.name, detail: [p.role, p.teamId ? r.teamName(p.teamId) : ''].filter(Boolean).join(' · ') });

const collator = new Intl.Collator('en-GB', { sensitivity: 'base' });
/** By name A to Z, ignoring case and accents; two people with one name by email, then ID, so they keep their places. */
export const byName = (a: Pick<Person, 'name' | 'email' | 'id'>, b: Pick<Person, 'name' | 'email' | 'id'>) =>
  collator.compare(a.name, b.name) || (a.email ?? '').localeCompare(b.email ?? '') || a.id.localeCompare(b.id);

/**
 * People: name, job title and team; nobody marked as left (Find asks for them too with the filter `left: 'too'`, and
 * names them "{name} (left)", after everyone here); those whose name the search starts first, then by name A to
 * Z (`byName`). Filters, as People's address has them: `team` keeps a team's people (its lead counts, wherever their own
 * team is) or, as `-`, people in no team (or a team that is gone); `admins` (`1`) keeps the admins.
 */
export function searchPeople(r: PersonRows, ask: SearchAsk): FoundRow[] {
  const team = (p: Person) => (p.teamId ? r.teamName(p.teamId) : '');
  const named = (p: Person) => !!wordsOf(ask.q).length && textMatches(p.name, ask.q);
  const f = ask.filters ?? {};
  const left = f.left === 'too';
  const lead = f.team && f.team !== '-' ? r.teamLead?.(f.team) ?? null : null;
  const inTeam = (p: Person) => !f.team || (f.team === '-' ? !p.teamId || !r.teamName(p.teamId) : p.teamId === f.team || p.id === lead);
  return r.people
    .filter((p) => (left || !p.leftAt) && !p.removedAt && inTeam(p) && (f.admins !== '1' || p.admin) && textMatches(`${p.name} ${p.role} ${team(p)}`, ask.q))
    .sort((a, b) => Number(!!a.leftAt) - Number(!!b.leftAt) || Number(named(b)) - Number(named(a)) || byName(a, b))
    .map((p) => (p.leftAt ? { ...personRow(r, p), name: `${p.name} (left)` } : personRow(r, p)));
}

/** A team's row: "Led by {name} · {n} people", or "No lead · {n} people". */
export function teamRow(r: TeamRows, t: Team): FoundRow {
  const here = r.people.filter((p) => !p.leftAt);
  const lead = here.find((p) => p.id === t.leadId)?.name ?? null;
  const n = here.filter((p) => p.teamId === t.id).length;
  return { kind: 'team', id: t.id, name: t.name, detail: `${lead ? `Led by ${lead}` : 'No lead'} · ${n} ${n === 1 ? 'person' : 'people'}` };
}

/** Teams: the name and its lead's name; A to Z, ignoring case and accents. */
export function searchTeams(r: TeamRows, ask: SearchAsk): FoundRow[] {
  const here = r.people.filter((p) => !p.leftAt);
  const lead = (t: Team) => here.find((p) => p.id === t.leadId)?.name ?? '';
  return r.teams
    .filter((t) => textMatches(`${t.name} ${lead(t)}`, ask.q))
    .sort((a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id))
    .map((t) => teamRow(r, t));
}

export function searchWorkspaces(r: WorkspaceRows, ask: SearchAsk): FoundRow[] {
  return r.workspaces.filter((w) => textMatches(w.name, ask.q)).map((w) => ({ kind: 'workspace', id: w.id, name: w.name, detail: w.detail }));
}

/** The words each kind's near miss may correct to. */
function vocabulary(r: GoalRows | PersonRows | TeamRows | WorkspaceRows): string[] {
  switch (r.kind) {
    case 'goal': return r.summaries.map(goalWords);
    case 'person': return r.people.filter((p) => !p.leftAt).map((p) => `${p.name} ${p.role}`);
    case 'team': return r.teams.map((t) => t.name);
    case 'workspace': return r.workspaces.map((w) => w.name);
  }
}

/**
 * Rule 7. One search for a kind: every match in the kind's order, a page of it, and, when nothing matches, rule 5's near
 * miss with its rows. Each kind's rows come from `rows` (the core's four; a module's finder answers its own kind).
 */
export function search(rows: GoalRows | PersonRows | TeamRows | WorkspaceRows, ask: SearchAsk): SearchAnswer {
  const run = (a: SearchAsk) => {
    switch (rows.kind) {
      case 'goal': return searchGoals(rows, a);
      case 'person': return searchPeople(rows, a);
      case 'team': return searchTeams(rows, a);
      case 'workspace': return searchWorkspaces(rows, a);
    }
  };
  const all = run(ask);
  if (all.length || !wordsOf(ask.q).length) return page(all, ask);
  const near = nearMiss(ask.q, vocabulary(rows));
  const again = near ? run({ ...ask, q: near }) : [];
  return near && again.length ? { ...page(again, ask), near } : page([], ask);
}

/**
 * The rows for things already chosen, by id, in the same words a search gives them and in the order asked: what a closed
 * picker shows. Unlike a search it finds someone marked as left (they may still own a goal); an id it can't find is
 * left out.
 */
export function rowsByIds(rows: GoalRows | PersonRows | TeamRows | WorkspaceRows, ids: string[]): FoundRow[] {
  const found = (id: string): FoundRow | null => {
    switch (rows.kind) {
      case 'goal': { const s = rows.summaries.find((x) => x.goal.id === id); return s ? goalRow(s) : null; }
      case 'person': { const p = rows.people.find((x) => x.id === id && !x.removedAt); return p ? personRow(rows, p) : null; }
      case 'team': { const t = rows.teams.find((x) => x.id === id); return t ? teamRow(rows, t) : null; }
      case 'workspace': { const w = rows.workspaces.find((x) => x.id === id); return w ? { kind: 'workspace', id: w.id, name: w.name, detail: w.detail } : null; }
    }
  };
  return ids.map(found).filter((r): r is FoundRow => !!r);
}

/* ---------- Rule 8: Find, across kinds ---------- */

/** The kinds Find looks in, in its order; a module's kinds (the metric library's) follow. Never workspaces. */
export const FIND_KINDS = ['goal', 'person', 'team', 'metric'] as const;
/** Rows Find shows in each group before "See all". */
export const FIND_SIZE = 3;

/** One group of Find's answer: a kind, how many match in all, and its first rows. `near` when rule 5 found them. */
export interface FoundGroup { kind: string; total: number; rows: FoundRow[]; near?: string }

/** The goal key a whole search names ("G-48", "g48", "48"), else null. */
export function keyOf(q: string): string | null {
  const t = q.trim();
  return normalKey(t) ?? (/^\d{1,9}$/.test(t) ? formatKey(Number(t)) : null);
}

/**
 * Rule 8, as the questions it asks: rule 7 for each kind (goal, person, team, then a module's, such as metric) with 3
 * rows, people marked as left included and said to be; the groups that found something, in that order, each with its
 * total. A search that is one goal's key puts that goal first and alone in Goals. `findAll` and `findAllAsync` answer it.
 */
function* findSteps(q: string, kinds: string[]): Generator<[string, SearchAsk], FoundGroup[], SearchAnswer> {
  if (!wordsOf(q).length) return [];
  const core: readonly string[] = FIND_KINDS;
  const order = [...FIND_KINDS.filter((k) => kinds.includes(k)), ...kinds.filter((k) => !core.includes(k) && k !== 'workspace')];
  const key = keyOf(q);
  const groups: FoundGroup[] = [];
  for (const kind of order) {
    if (kind === 'goal' && key) {
      const one = yield ['goal', { q: key, size: 1 }];
      if (one.rows.length) { groups.push({ kind, total: 1, rows: one.rows }); continue; }
    }
    const a = yield [kind, { q, size: FIND_SIZE, ...(kind === 'person' ? { filters: { left: 'too' } } : {}) }];
    if (a.rows.length) groups.push({ kind, total: a.total, rows: a.rows, ...(a.near ? { near: a.near } : {}) });
  }
  return groups;
}

/** Rule 8. Find from anywhere, over a search that answers at once. */
export function findAll(q: string, kinds: string[], run: (kind: string, ask: SearchAsk) => SearchAnswer): FoundGroup[] {
  const it = findSteps(q, kinds);
  let step = it.next();
  while (!step.done) step = it.next(run(...step.value));
  return step.value;
}

/** Rule 8 over the Search port, which answers later. */
export async function findAllAsync(q: string, kinds: string[], run: (kind: string, ask: SearchAsk) => SearchAnswer | Promise<SearchAnswer>): Promise<FoundGroup[]> {
  const it = findSteps(q, kinds);
  let step = it.next();
  while (!step.done) step = it.next(await run(...step.value));
  return step.value;
}

/* ---------- Rule 6: suggestions before typing ---------- */

/** A thing opened or chosen lately: newest first, at most 12, kept per person and workspace (the Prefs port). */
export interface Recent { kind: string; id: string }
export const RECENTS = 12;
export const SUGGESTED = 6;

/** Puts one first in the recents, without repeats, keeping the newest 12. */
export const withRecent = (recents: Recent[], r: Recent): Recent[] => [r, ...recents.filter((x) => !(x.kind === r.kind && x.id === r.id))].slice(0, RECENTS);

/**
 * Rule 6. Up to 6 rows before anything is typed, no repeats, in order. A person: you; your team's people, its lead first
 * (when the rows say who leads it) then A to Z; then people chosen lately. A team: your team; teams you lead; teams chosen lately. A goal: your goals,
 * worst first; the goals they feed; goals opened or chosen lately. Up to two places are kept for those chosen lately
 * when the rest would fill the list. Nobody marked as left; nothing it can't find.
 */
export function suggest(rows: GoalRows | PersonRows | TeamRows, viewerId: string, recents: Recent[]): FoundRow[] {
  const recent = recents.filter((r) => r.kind === rows.kind).map((r) => r.id);
  // Up to two places are kept for what was chosen lately, so it shows even when your own fill the list.
  const pick = (ids: (string | null | undefined)[], row: (id: string) => FoundRow | null) => {
    const out: FoundRow[] = [];
    const add = (id: string | null | undefined, limit: number) => {
      if (!id || out.length >= limit || out.some((r) => r.id === id)) return;
      const r = row(id);
      if (r) out.push(r);
    };
    const lately = recent.filter((id) => !ids.includes(id) && row(id));
    for (const id of ids) add(id, SUGGESTED - Math.min(2, lately.length));
    for (const id of [...recent, ...ids]) add(id, SUGGESTED);
    return out;
  };
  switch (rows.kind) {
    case 'person': {
      const all = searchPeople(rows, { q: '' });
      const by = new Map(all.map((r) => [r.id, r]));
      const me = rows.people.find((p) => p.id === viewerId);
      const lead = me?.teamId ? rows.teamLead?.(me.teamId) ?? null : null;
      const mates = me?.teamId ? rows.people.filter((p) => p.teamId === me.teamId && !p.leftAt).sort((a, b) => Number(b.id === lead) - Number(a.id === lead) || a.name.localeCompare(b.name)).map((p) => p.id) : [];
      return pick([viewerId, ...mates], (id) => by.get(id) ?? null);
    }
    case 'team': {
      const all = searchTeams(rows, { q: '' });
      const by = new Map(all.map((r) => [r.id, r]));
      const mine = rows.people.find((p) => p.id === viewerId)?.teamId;
      return pick([mine, ...rows.teams.filter((t) => t.leadId === viewerId).map((t) => t.id)], (id) => by.get(id) ?? null);
    }
    case 'goal': {
      const all = searchGoals(rows, { q: '' });
      const by = new Map(all.map((r) => [r.id, r]));
      const mine = all.filter((r) => rows.summaries.find((s) => s.goal.id === r.id)?.goal.ownerId === viewerId).map((r) => r.id);
      const fed = mine.map((id) => rows.summaries.find((s) => s.goal.id === id)?.goal.parentId);
      return pick([...mine, ...fed], (id) => by.get(id) ?? null);
    }
  }
}

/* ---------- Rules 2 to 4: the count line, the filter line, and history ---------- */

/** A list's nouns: "goal", "goals"; "person", "people". */
export interface Things { thing: string; things: string }

/**
 * Rule 2. The line under a list bar. Not narrowed: "{n} {things}, {order}." (and "Showing a to b." when paged); one
 * thing: "1 goal."; narrowed: "{n} {things} match." / "1 goal matches."; none: "" (the none-found block or the page's
 * empty state says it).
 */
export function countLine(t: Things, n: number, narrowed: boolean, order?: string | null, shown?: { from: number; to: number } | null): string {
  if (n === 0) return '';
  if (narrowed) return n === 1 ? `1 ${t.thing} matches.` : `${n} ${t.things} match.`;
  const head = n === 1 ? `1 ${t.thing}` : `${n} ${t.things}${order ? `, ${order}` : ''}`;
  return `${head}.${shown && (shown.from > 1 || shown.to < n) ? ` Showing ${shown.from} to ${shown.to}.` : ''}`;
}

/** An active filter as the filter line says it: its label and its values. */
export interface FilterPart { key: string; label: string; values: string[] }

/** Rule 3. "Filtered by: " then each part as "{label} {values joined with ' or '}". Empty with no filter on. */
export const filterText = (p: FilterPart) => `${p.label} ${p.values.join(' or ')}`;
export const filterLine = (parts: FilterPart[]) => (parts.length ? `Filtered by: ${parts.map(filterText).join(' · ')}` : '');

/** Rule 5's words, and the none-found block's (find spec, 2.1). */
export function noneFound(t: Things, q: string, filtered: boolean, near?: string | null): string {
  const words = q.trim();
  if (words && near) return `No ${t.thing} matches “${words}”. Showing ${t.things} that match “${near}”.`;
  if (words && filtered) return `No ${t.thing} matches “${words}” with these filters.`;
  if (words) return `No ${t.thing} matches “${words}”.`;
  return `No ${t.things} match these filters.`;
}

/**
 * Rule 4. What a change does to the browser's history: a choice adds an entry; a search's first key adds one ("started")
 * and later keys replace it, so Back returns to the list before the search; settling replaces (and writes nothing when
 * the address is already what was typed).
 */
export type ListChange = 'choice' | 'started' | 'typing' | 'settled' | 'clear' | 'remembered' | 'dropped';
export const historyStep = (c: ListChange): 'push' | 'replace' => (c === 'typing' || c === 'settled' || c === 'remembered' || c === 'dropped' ? 'replace' : 'push');
