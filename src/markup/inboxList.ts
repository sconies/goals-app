/* The inbox as an inbox (backlog W, Lane, 8 Nov: "Imagine 75 pieces of feedback"). The rules for its list live here
   once: which tab a status is in, how markups on the same part fold into one row, the filters and the search, the
   counts, the pages of 25, and which row comes next once one is handled. Pure: the inbox screen (src/markup/Inbox.tsx)
   and its tests use it; it reads nothing from the network or the page. */
import type { InboxFeedback } from './feedback';
import { MOOD_WORD, namedParts, partText, type Markup, type MarkupStatus } from './model';
import { textMatches } from '../domain/find';

/** The inbox's three tabs: New, In hand, and Closed (fixed or won't fix). */
export type InboxTab = 'new' | 'in-hand' | 'closed';
export const TABS: [InboxTab, string][] = [['new', 'New'], ['in-hand', 'In hand'], ['closed', 'Closed']];
export const tabOf = (s: MarkupStatus): InboxTab => (s === 'new' ? 'new' : s === 'in-hand' ? 'in-hand' : 'closed');

/** Rows a page shows. */
export const PAGE_SIZE = 25;

/** One row of the inbox: markups on the same part of the same page, in the same tab (newest first), or one piece of feedback. */
export type InboxItem<M extends Markup = Markup> =
  | { kind: 'markup'; key: string; tab: InboxTab; at: string; page: string; person: string; markups: M[] }
  | { kind: 'feedback'; key: string; tab: InboxTab; at: string; page: string; person: string; feedback: InboxFeedback };

/** The page a piece of feedback was sent from, without its query: what the page filter offers. */
const pageOfPath = (path: string) => (path || '/').split(/[?#]/)[0]!.replace(/^\/demo(?=\/|$)/, '') || '/';

/**
 * Every row, newest first. Markups on the same part of the same page fold into one row, within a tab: once a row is
 * handled together, its markups move tab together. A row's date is its newest markup's.
 */
export function inboxItems<M extends Markup>(markups: readonly M[], feedback: readonly InboxFeedback[]): InboxItem<M>[] {
  const groups = new Map<string, Extract<InboxItem<M>, { kind: 'markup' }>>();
  for (const m of [...markups].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))) {
    const tab = tabOf(m.status);
    const part = namedParts(m)[0];
    const key = `m:${tab}\u0000${m.route}\u0000${part ? part.join('\u0000') : ''}`;
    const g = groups.get(key);
    if (g) g.markups.push(m);
    else groups.set(key, { kind: 'markup', key, tab, at: m.createdAt, page: m.route || '/', person: m.personName || 'Someone', markups: [m] });
  }
  const fb = feedback.map((f): InboxItem<M> => ({ kind: 'feedback', key: `f:${f.id}`, tab: tabOf(f.status), at: f.at, page: pageOfPath(f.path), person: f.personName || 'Someone', feedback: f }));
  return [...groups.values(), ...fb].sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}

/** How many pieces a row holds: a folded row counts each markup in it. */
export const itemSize = (i: InboxItem) => (i.kind === 'markup' ? i.markups.length : 1);

/** The ids a row stands for: what handling it changes. */
export const itemIds = (i: InboxItem) => (i.kind === 'markup' ? i.markups.map((m) => m.id) : [i.feedback.id]);

/** A row's status, as shown: its newest markup's, or the feedback's. */
export const itemStatus = (i: InboxItem): MarkupStatus => (i.kind === 'markup' ? i.markups[0]!.status : i.feedback.status);

/** What a row says, in a line: the newest markup's line, or the feedback's words (its mood when it has none). */
export const itemLine = (i: InboxItem) => (i.kind === 'markup' ? i.markups[0]!.line : i.feedback.text.trim() || MOOD_WORD[i.feedback.mood]);

/** Which rows to show: one tab, a kind, a page, a person, and words to find. */
export interface InboxFilter { tab: InboxTab; kind: 'all' | 'markup' | 'feedback'; page: string; person: string; q: string }
export const NO_FILTER: Omit<InboxFilter, 'tab'> = { kind: 'all', page: '', person: '', q: '' };

/** The words a row is found by: what it says, the part, the page, who sent it and from where. */
function haystack(i: InboxItem): string {
  if (i.kind === 'feedback') { const f = i.feedback; return [f.text, MOOD_WORD[f.mood], f.path, f.personName, f.workspaceName, 'feedback'].join(' '); }
  return i.markups.flatMap((m) => [m.line, m.route, m.path, m.personName, m.workspaceName, m.demo ? 'demo' : '', ...namedParts(m).map(partText), ...m.strokes.flatMap((s) => (s.kind === 'note' ? [s.text] : []))]).join(' ');
}

/** The rows a filter shows, newest first. Search is find's rule 1: each word typed starts a word in the row, in any order. */
export function filterItems<M extends Markup>(items: readonly InboxItem<M>[], f: InboxFilter): InboxItem<M>[] {
  const q = f.q.trim();
  return items.filter((i) => i.tab === f.tab && (f.kind === 'all' || i.kind === f.kind) && (!f.page || i.page === f.page) && (!f.person || i.person === f.person)
    && (!q || textMatches(haystack(i), q)));
}

/** How many pieces each tab holds, with the filter's kind, page, person and search (a folded row counts each markup). */
export function tabCounts(items: readonly InboxItem[], f: Omit<InboxFilter, 'tab'> = NO_FILTER): Record<InboxTab, number> {
  const out: Record<InboxTab, number> = { new: 0, 'in-hand': 0, closed: 0 };
  for (const [t] of TABS) for (const i of filterItems(items, { ...f, tab: t })) out[t] += itemSize(i);
  return out;
}

/** The New count beside Inbox in Workspace's menu: every new markup and piece of feedback. */
export const newCount = (markups: readonly Pick<Markup, 'status'>[], feedback: readonly Pick<InboxFeedback, 'status'>[]) =>
  markups.filter((m) => m.status === 'new').length + feedback.filter((f) => f.status === 'new').length;

/** The pages, people and kinds the rows have, for the filters: each once, pages and people in order. */
export function filterChoices(items: readonly InboxItem[]) {
  const sorted = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
  return { pages: sorted(items.map((i) => i.page)), people: sorted(items.map((i) => i.person)) };
}

/** One page of rows (page counts from 0), and how many pages there are. A page past the end shows the last one. */
export function pageOf<T>(rows: readonly T[], page: number, size = PAGE_SIZE): { rows: T[]; page: number; pages: number; from: number; to: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  const shown = rows.slice(p * size, p * size + size);
  return { rows: shown, page: p, pages, from: shown.length ? p * size + 1 : 0, to: p * size + shown.length };
}

/**
 * The row to open once one is handled and has left the list: the one that took its place (the next), or, when it was
 * the last, the one before it. Null when the list is empty. `before` is the list as it was, `after` as it is now.
 */
export function nextAfter(before: readonly { key: string }[], after: readonly { key: string }[], handled: string): string | null {
  if (after.some((i) => i.key === handled)) return handled;
  const at = before.findIndex((i) => i.key === handled);
  const left = new Set(after.map((i) => i.key));
  for (let k = at + 1; k < before.length; k++) if (left.has(before[k]!.key)) return before[k]!.key;
  for (let k = Math.min(at, before.length) - 1; k >= 0; k--) if (left.has(before[k]!.key)) return before[k]!.key;
  return after[0]?.key ?? null;
}

/** The row a key moves to: J the next, K the one before, staying put at either end. */
export function stepKey(rows: readonly { key: string }[], current: string | null, by: 1 | -1): string | null {
  if (!rows.length) return null;
  const at = rows.findIndex((r) => r.key === current);
  if (at < 0) return rows[0]!.key;
  return rows[Math.min(rows.length - 1, Math.max(0, at + by))]!.key;
}

/** The address of a row in the inbox (its first id), and the row an address names. */
export const itemParam = (i: InboxItem) => (i.kind === 'markup' ? i.markups[0]!.id : i.feedback.id);
export const itemFor = <M extends Markup>(items: readonly InboxItem<M>[], id: string | null): InboxItem<M> | undefined =>
  id ? items.find((i) => (i.kind === 'markup' ? i.markups.some((m) => m.id === id) : i.feedback.id === id)) : undefined;
