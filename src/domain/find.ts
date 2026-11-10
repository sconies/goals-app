/* Finding things (docs/design/find/spec.md, section 5): what a search matches, a near miss, and one search function per
   kind. Every list bar, picker and Find reaches these through the Search port (src/ports/search.ts), whose browser
   adapter calls them over the loaded workspace; the internal app's adapter asks its server instead. Pure: each rule takes
   only the rows it reads (src/app/reads.ts makes them), never the whole workspace, and no clock. */
import { LEVEL_LABEL } from './format';
import { formatKey, normalKey } from './goalKey';
import { applyQuery, parseQuery, type QueryContext } from './query';
import type { GoalSummary } from './summary';
import { LABEL } from './vocabulary';
import type { DisplayStatus, Person, Team } from './types';

/* ---------- Rule 1: does text match ---------- */

/** Lower case, accents gone: "Lucía" reads as "lucia". */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The words of a text: broken at spaces and at / - , . : ( ), folded. */
export const wordsOf = (s: string) => fold(s).split(/[\s/\-,.:()]+/).filter(Boolean);

/**
 * Rule 1. True when every word of `q` starts a word of `words`, ignoring case and accents (words break at spaces and at
 * / - , . : ( )). A goal's key (`key`) finds it however it is typed ("G-48", "g48", "48"); a whole search that is one key
 * finds only that goal ("G-48" isn't G-4), while a bare number also matches as words. An empty search matches anything.
 */
export function textMatches(words: string, q: string, key?: string | null): boolean {
  const asked = wordsOf(q);
  if (!asked.length) return true;
  const typedKey = normalKey(q.trim());
  if (typedKey) return !!key && typedKey === key;
  const bare = /^\d{1,9}$/.test(q.trim()) ? formatKey(Number(q.trim())) : null;
  if (bare && key && bare === key) return true;
  const have = wordsOf(words);
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
export interface PersonRows { kind: 'person'; people: Person[]; teamName: (id: string) => string }
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

/** The words a goal's row is found by (find spec, 2.1): title, key, owner, team, level, status word, this week's reason and path to green, definition, source. */
export const goalWords = (s: GoalSummary) => [s.goal.title, s.goal.key ?? '', s.owner, s.team, LEVEL_LABEL[s.goal.level], LABEL[s.status], s.story.why ?? '', s.story.doing ?? '', s.story.needs ?? '', s.goal.definition, s.goal.source].join(' ');
export const goalRow = (s: GoalSummary): FoundRow => ({ kind: 'goal', id: s.goal.id, name: s.goal.title, detail: [s.goal.key, s.owner, s.team].filter(Boolean).join(' · '), status: s.status, key: s.goal.key ?? null });

/** Goals: the Goals link's filters and sort (query.ts), with rule 1 for the words; worst first unless sorted. */
export function searchGoals(r: GoalRows, ask: SearchAsk): FoundRow[] {
  const query = { ...parseQuery(new URLSearchParams({ ...(ask.filters ?? {}), ...(ask.sort ? { sort: ask.sort } : {}) })), q: '' };
  const listed = applyQuery(r.summaries, { ...query, sort: query.sort ?? 'worst' }, r.ctx);
  return listed.filter((s) => textMatches(goalWords(s), ask.q, s.goal.key)).map(goalRow);
}

/** People: name, job title and team; nobody marked as left; those whose name starts with the search first, then A to Z. */
export function searchPeople(r: PersonRows, ask: SearchAsk): FoundRow[] {
  const team = (p: Person) => (p.teamId ? r.teamName(p.teamId) : '');
  const named = (p: Person) => !!wordsOf(ask.q).length && textMatches(p.name, ask.q);
  return r.people
    .filter((p) => !p.leftAt && !p.removedAt && textMatches(`${p.name} ${p.role} ${team(p)}`, ask.q))
    .sort((a, b) => Number(named(b)) - Number(named(a)) || a.name.localeCompare(b.name))
    .map((p) => ({ kind: 'person', id: p.id, name: p.name, detail: [p.role, team(p)].filter(Boolean).join(' · ') }));
}

/** Teams: the name and its lead's name; A to Z. Line 2: "Led by {name} · {n} people", or "No lead". */
export function searchTeams(r: TeamRows, ask: SearchAsk): FoundRow[] {
  const here = r.people.filter((p) => !p.leftAt);
  const lead = (t: Team) => here.find((p) => p.id === t.leadId)?.name ?? null;
  const people = (t: Team) => { const n = here.filter((p) => p.teamId === t.id).length; return `${n} ${n === 1 ? 'person' : 'people'}`; };
  return r.teams
    .filter((t) => textMatches(`${t.name} ${lead(t) ?? ''}`, ask.q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ kind: 'team', id: t.id, name: t.name, detail: `${lead(t) ? `Led by ${lead(t)}` : 'No lead'} · ${people(t)}` }));
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
