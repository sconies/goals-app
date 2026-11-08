/* Markups: a picture of the screen with a drawing on it, sent to the people building Faro, and what they do with it.
   The rules live here once and are shared by the app (sending, the inbox), the Vercel function /api/markups and the
   MCP server's markup tools: what a markup carries, which named screen parts a drawing covers, how the inbox groups
   and words markups, the GitHub issue's text, and whether a What's new entry fixed something you raised.

   Screen parts are named in the markup with data-part attributes ("Goal page", "Scorecard", "Will it hit"); a part
   inside another reads as a path: Goal page › Scorecard › Will it hit. */

/** A point on the screen, in CSS pixels from its top left corner. */
export type Pt = [number, number];

/** What was drawn, as vectors. A note is a numbered pin with a few words. */
export type Stroke =
  | { kind: 'pen'; points: Pt[] }
  | { kind: 'arrow'; from: Pt; to: Pt }
  | { kind: 'box'; x: number; y: number; w: number; h: number }
  | { kind: 'note'; n: number; x: number; y: number; text: string };

export type Tool = Stroke['kind'];

export interface Rect { x: number; y: number; w: number; h: number }

/** A named part on screen when the picture was taken: its path of names, outermost first, and where it was. */
export interface PartBox { path: string[]; rect: Rect }

export type MarkupStatus = 'new' | 'in-hand' | 'fixed' | 'wont-fix';
export type Mood = 'good' | 'meh' | 'bad';

/** The words for each status. A status is always shown as its shape and this word together. */
export const STATUS_WORD: Record<MarkupStatus, string> = { new: 'New', 'in-hand': 'In hand', fixed: 'Fixed', 'wont-fix': 'Won’t fix' };
export const STATUSES: MarkupStatus[] = ['new', 'in-hand', 'fixed', 'wont-fix'];
/** How it's working, as Send feedback asks it. */
export const MOODS: [Mood, string][] = [['good', 'It helps'], ['meh', 'It’s OK'], ['bad', 'It gets in the way']];
export const MOOD_WORD: Record<Mood, string> = Object.fromEntries(MOODS) as Record<Mood, string>;

/** One step of the visit, as telemetry keeps it (src/telemetry/client.ts Step). */
export interface MarkupStep { at: string; kind: string; name: string; route?: string; ok?: boolean; flow?: string; step?: string }
/** An error or a save that didn't get through, earlier in the visit. Never what anyone typed. */
export interface MarkupProblem { at: string; kind: 'exception' | 'save'; type: string; route?: string; action?: string; message?: string }

export interface MarkupContext {
  viewport: { w: number; h: number; dpr: number };
  /** The theme on screen (light or dark) and what the person chose (light, dark or system). */
  theme: 'light' | 'dark';
  themeChoice: string;
  accent: string;
  /** The release people see: the newest What's new entry. */
  appVersion: string;
  sessionId: string;
  userAgent?: string;
  /** The address it was sent from (location.host): the live app, a preview build or a laptop. Older markups have none. */
  host?: string;
}

/** A markup as it is sent and stored. Pictures are separate files named by its id. */
export interface Markup {
  id: string;
  workspaceId: string;
  workspaceName: string;
  demo: boolean;
  personId: string;
  personName: string;
  line: string;
  mood: Mood | null;
  route: string;
  path: string;
  goalId: string | null;
  reviewId: string | null;
  /** The parts under each stroke, in stroke order (empty when a stroke covers no named part). */
  parts: string[][][];
  strokes: Stroke[];
  context: MarkupContext;
  steps: MarkupStep[];
  errors: MarkupProblem[];
  pictures: string[];
  status: MarkupStatus;
  issueUrl: string | null;
  fixedIn: string | null;
  wontFixReason: string | null;
  statusBy: string | null;
  statusAt: string | null;
  createdAt: string;
}

/** Where markups' GitHub issues go (FARO_GITHUB_REPO on the server can say otherwise). */
export const MARKUP_REPO = 'sconies/goals-app';
export const LINE_MAX = 500;
export const STEPS_MAX = 20;
export const ERRORS_MAX = 25;
export const PICTURES = ['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg'] as const;
/** How big a numbered pin is on screen, for what it covers. */
export const PIN = 28;

/* ---------- where a drawing is, and what it covers ---------- */

/** The box a stroke covers. A pen line or arrow that's only a dot still covers a few pixels. */
export function strokeBox(s: Stroke): Rect {
  const around = (pts: Pt[], pad: number): Rect => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    return { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 };
  };
  switch (s.kind) {
    case 'pen': return s.points.length ? around(s.points, 2) : { x: 0, y: 0, w: 0, h: 0 };
    case 'arrow': return around([s.from, s.to], 2);
    case 'box': return { x: Math.min(s.x, s.x + s.w), y: Math.min(s.y, s.y + s.h), w: Math.abs(s.w), h: Math.abs(s.h) };
    case 'note': return { x: s.x - PIN / 2, y: s.y - PIN / 2, w: PIN, h: PIN };
  }
}

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const isPrefix = (a: string[], b: string[]) => a.length < b.length && a.every((x, i) => b[i] === x);
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => b[i] === x);

/**
 * The named parts a box covers: the most specific ones (a part is dropped when a part inside it is covered too), most
 * covered first, at most `max`. A part named twice (two goal cards) counts once.
 */
export function partsUnder(box: Rect, parts: PartBox[], max = 3): string[][] {
  const hit = parts.map((p) => ({ p, area: overlap(box, p.rect) })).filter((x) => x.area > 0);
  const deepest = hit.filter((x) => !hit.some((y) => isPrefix(x.p.path, y.p.path)));
  const out: { path: string[]; area: number }[] = [];
  for (const x of deepest.sort((a, b) => b.area - a.area || b.p.path.length - a.p.path.length)) {
    const had = out.find((o) => same(o.path, x.p.path));
    if (had) had.area += x.area; else out.push({ path: x.p.path, area: x.area });
  }
  return out.sort((a, b) => b.area - a.area).slice(0, max).map((o) => o.path);
}

/** The parts under each stroke, in stroke order. */
export const partsOfStrokes = (strokes: Stroke[], parts: PartBox[]) => strokes.map((s) => partsUnder(strokeBox(s), parts));

/** Every part named in a markup once, most mentioned first: what the inbox and the issue list. */
export function namedParts(m: Pick<Markup, 'parts'>): string[][] {
  const seen: { path: string[]; n: number; first: number }[] = [];
  m.parts.forEach((list, i) => list.forEach((path) => {
    const had = seen.find((s) => same(s.path, path));
    if (had) had.n++; else seen.push({ path, n: 1, first: i });
  }));
  return seen.sort((a, b) => b.n - a.n || a.first - b.first).map((s) => s.path);
}

export const partText = (path: string[]) => path.join(' › ');

/** The live app's address; anything else on Vercel is a preview build (handover, 7 Nov). */
export const LIVE_HOST = 'goals-app-puce-five.vercel.app';

/** Which build a markup came from, by its address: the live app, a preview build, a laptop, or unknown (older ones). */
export function buildOf(host: string | undefined): 'live' | 'preview' | 'local' | 'unknown' {
  if (!host) return 'unknown';
  if (host === LIVE_HOST) return 'live';
  if (/^(localhost|127\.0\.0\.1)(:|$)/.test(host)) return 'local';
  return 'preview';
}

/** Where a markup was sent from, in words: “the demo”, “Acme”, with “on a preview build” or “on a laptop” when it
    wasn't the live app, so a test round's markups are easy to tell apart. */
export function sentFrom(m: Pick<Markup, 'demo' | 'workspaceName' | 'context'>, o: { host?: boolean } = {}): string {
  const where = m.demo ? 'the demo' : m.workspaceName || 'a workspace';
  const b = buildOf(m.context?.host);
  return b === 'preview' ? `${where} on a preview build${o.host === false ? '' : ` (${m.context.host})`}` : b === 'local' ? `${where} on a laptop` : where;
}

/* ---------- where it was sent from ---------- */

/** The goal or review a screen is about, from its address. */
export function aboutOf(pathname: string, search = ''): { goalId: string | null; reviewId: string | null } {
  const segs = pathname.split('/').filter(Boolean);
  const q = new URLSearchParams(search);
  const goalId = (segs[0] === 'goals' && segs[1] && segs[1] !== 'new') || segs[0] === 'check-in' ? segs[1] ?? null : null;
  const reviewId = q.get('review') || (segs[0] === 'reviews' && segs[1] && segs[1] !== 'new' ? segs[1] : null);
  return { goalId, reviewId: reviewId || null };
}

/** Everything a markup needs to be built, as the app has it when Send is pressed. */
export interface MarkupInput {
  id: string;
  line: string;
  mood: Mood | null;
  includeSteps: boolean;
  strokes: Stroke[];
  parts: PartBox[];
  pathname: string;
  search: string;
  /** The App.tsx route the address is on (telemetry's http.route), e.g. /goals/:goalId. */
  route: string;
  workspace: { id: string; name: string };
  demo: boolean;
  person: { id: string; name: string };
  context: MarkupContext;
  steps: MarkupStep[];
  errors: MarkupProblem[];
  pictures: string[];
  now: string;
}

export class MarkupError extends Error {}

/** The markup to send: the line and mood, the drawing and what it covers, where it was, and (when ticked) the visit's steps. */
export function buildMarkup(i: MarkupInput): Markup {
  const line = i.line.trim().replace(/\s+/g, ' ');
  if (!line) throw new MarkupError('Say what should change.');
  if (line.length > LINE_MAX) throw new MarkupError(`Keep it to ${LINE_MAX} characters; the picture says the rest.`);
  const round = (n: number) => Math.round(n * 10) / 10;
  const strokes = i.strokes.map((s): Stroke => {
    switch (s.kind) {
      case 'pen': return { kind: 'pen', points: s.points.map(([x, y]) => [round(x), round(y)] as Pt) };
      case 'arrow': return { kind: 'arrow', from: [round(s.from[0]), round(s.from[1])], to: [round(s.to[0]), round(s.to[1])] };
      case 'box': { const b = strokeBox(s); return { kind: 'box', x: round(b.x), y: round(b.y), w: round(b.w), h: round(b.h) }; }
      case 'note': return { kind: 'note', n: s.n, x: round(s.x), y: round(s.y), text: s.text.trim().slice(0, 140) };
    }
  });
  const { goalId, reviewId } = aboutOf(i.pathname, i.search);
  return {
    id: i.id,
    workspaceId: i.workspace.id,
    workspaceName: i.workspace.name,
    demo: i.demo,
    personId: i.person.id,
    personName: i.person.name,
    line,
    mood: i.mood,
    route: i.route,
    path: (i.pathname + i.search).slice(0, 500),
    goalId,
    reviewId,
    parts: partsOfStrokes(strokes, i.parts),
    strokes,
    context: i.context,
    steps: i.includeSteps ? i.steps.slice(-STEPS_MAX) : [],
    errors: i.errors.slice(-ERRORS_MAX),
    pictures: i.pictures,
    status: 'new',
    issueUrl: null,
    fixedIn: null,
    wontFixReason: null,
    statusBy: null,
    statusAt: null,
    createdAt: i.now,
  };
}

/* ---------- stored rows ---------- */

export interface MarkupRow {
  id: string; workspace_id: string; workspace_name: string; demo: boolean; person_id: string; person_name: string; line: string; mood: Mood | null;
  route: string; path: string; goal_id: string | null; review_id: string | null; parts: string[][][]; strokes: Stroke[]; context: MarkupContext;
  steps: MarkupStep[]; errors: MarkupProblem[]; pictures: string[]; status: MarkupStatus; issue_url: string | null; fixed_in: string | null;
  wont_fix_reason: string | null; status_by: string | null; status_at: string | null; created_at: string;
}

/** The row the public key adds: a new markup, untriaged (the database refuses anything else). */
export const markupToRow = (m: Markup): Omit<MarkupRow, 'status' | 'issue_url' | 'fixed_in' | 'wont_fix_reason' | 'status_by' | 'status_at' | 'created_at'> => ({
  id: m.id, workspace_id: m.workspaceId, workspace_name: m.workspaceName, demo: m.demo, person_id: m.personId, person_name: m.personName, line: m.line, mood: m.mood,
  route: m.route, path: m.path, goal_id: m.goalId, review_id: m.reviewId, parts: m.parts, strokes: m.strokes, context: m.context, steps: m.steps, errors: m.errors, pictures: m.pictures,
});

/**
 * A person as the inbox names them: their name only, never an email address (re-review, 8 Nov, backlog T: the inbox is
 * open to anyone, and a status once said who changed it by their email). "Lane Hirschfield <lane@…>" is "Lane
 * Hirschfield"; a bare address is "Someone". Used wherever a markup or a piece of feedback is read, so the app and the AI
 * inbox tools say the same.
 */
export function nameOnly(v: string | null | undefined): string {
  const s = (v ?? '').replace(/<[^>]*@[^>]*>/g, '').replace(/\(?[^\s()<>]+@[^\s()<>]+\)?/g, '').replace(/\s+/g, ' ').trim();
  return s || (v && v.includes('@') ? 'Someone' : '');
}

export const markupFromRow = (r: MarkupRow): Markup => ({
  id: r.id, workspaceId: r.workspace_id, workspaceName: r.workspace_name, demo: !!r.demo, personId: r.person_id, personName: nameOnly(r.person_name), line: r.line, mood: r.mood ?? null,
  route: r.route, path: r.path, goalId: r.goal_id, reviewId: r.review_id, parts: r.parts ?? [], strokes: r.strokes ?? [], context: r.context, steps: r.steps ?? [], errors: r.errors ?? [],
  pictures: r.pictures ?? [], status: r.status, issueUrl: r.issue_url, fixedIn: r.fixed_in, wontFixReason: r.wont_fix_reason, statusBy: r.status_by == null ? null : nameOnly(r.status_by), statusAt: r.status_at,
  createdAt: new Date(r.created_at).toISOString(),
});

/* ---------- triage ---------- */

/** A change of status, as someone in the inbox (or an assistant) asks for it. */
export interface StatusChange { status: MarkupStatus; fixedIn?: string | null; reason?: string | null; by: string }

/** Checks a status change and gives the fields it sets. Fixed names the What's new entry; Won't fix needs a reason. */
export function statusPatch(c: StatusChange, now: string, entries: string[]): Pick<Markup, 'status' | 'fixedIn' | 'wontFixReason' | 'statusBy' | 'statusAt'> {
  if (!STATUSES.includes(c.status)) throw new MarkupError('A status is new, in-hand, fixed or wont-fix.');
  const fixedIn = c.status === 'fixed' ? (c.fixedIn ?? '').trim() : '';
  if (c.status === 'fixed' && !fixedIn) throw new MarkupError('Say which What’s new entry has the fix.');
  if (c.status === 'fixed' && entries.length && !entries.includes(fixedIn)) throw new MarkupError(`There’s no What’s new entry “${fixedIn}”.`);
  const reason = c.status === 'wont-fix' ? (c.reason ?? '').trim() : '';
  if (c.status === 'wont-fix' && !reason) throw new MarkupError('Say why it won’t be fixed.');
  return { status: c.status, fixedIn: fixedIn || null, wontFixReason: reason ? reason.slice(0, 2000) : null, statusBy: nameOnly(c.by).slice(0, 200) || 'Someone', statusAt: now };
}

/** Undoing a status change: the change that puts back the status it replaced (with its What's new entry or reason),
    through the same rule, recorded as whoever undoes it. */
export function undoChange(before: Pick<Markup, 'status' | 'fixedIn' | 'wontFixReason'>, by: string): StatusChange {
  return { status: before.status, fixedIn: before.fixedIn, reason: before.wontFixReason, by };
}

export const ISSUE_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+$/;

/** Markups on the same part of the same page, newest first; the groups newest first. */
export interface MarkupGroup<T extends Markup = Markup> { key: string; route: string; part: string[] | null; markups: T[] }

export function groupMarkups<T extends Markup>(list: T[]): MarkupGroup<T>[] {
  const groups = new Map<string, MarkupGroup<T>>();
  for (const m of [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))) {
    const part = namedParts(m)[0] ?? null;
    const key = `${m.route}\u0000${part ? part.join('\u0000') : ''}`;
    const g = groups.get(key);
    if (g) g.markups.push(m); else groups.set(key, { key, route: m.route, part, markups: [m] });
  }
  return [...groups.values()];
}

/** Where a markup was sent from, in words: the part most drawn on, or the page. */
export function placeOf(m: Pick<Markup, 'parts' | 'route'>): string {
  const p = namedParts(m)[0];
  return p ? partText(p) : m.route || 'Somewhere in the app';
}

/* ---------- the GitHub issue ---------- */

const when = (iso: string) => iso.slice(0, 16).replace('T', ' ') + ' UTC';
const esc = (s: string) => s.replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'));

export function issueTitle(m: Pick<Markup, 'line' | 'parts' | 'route'>): string {
  const line = m.line.length > 90 ? m.line.slice(0, 89).trimEnd() + '…' : m.line;
  return `Markup: ${line}`;
}

/** The issue's text: the line, a link back to the markup (and its picture) in Faro's inbox, the page, the parts named,
    the notes, the steps and the errors. The picture stays in Faro's private storage, so the issue links to it. */
export function issueBody(m: Markup, o: { inboxUrl?: string | null } = {}): string {
  const out: string[] = [];
  out.push(`> ${esc(m.line)}`, '');
  out.push(`${m.personName || 'Someone'} sent this ${m.demo ? 'from the demo' : `from ${m.workspaceName || m.workspaceId}`} on ${when(m.createdAt)}${m.mood ? `, saying “${MOOD_WORD[m.mood]}”` : ''}.`, '');
  out.push(o.inboxUrl ? `**The picture, with the drawing:** [open markup \`${m.id}\` in Faro’s inbox](${o.inboxUrl}) (anyone can open it).` : `The picture is in Faro’s inbox: markup \`${m.id}\`.`, '');
  const parts = namedParts(m);
  out.push('## Parts named', '');
  out.push(...(parts.length ? parts.map((p) => `- ${esc(partText(p))}`) : ['- No named part under the drawing.']), '');
  const notes = m.strokes.filter((s): s is Extract<Stroke, { kind: 'note' }> => s.kind === 'note' && !!s.text);
  if (notes.length) out.push('## Notes on the picture', '', ...notes.map((n) => `${n.n}. ${esc(n.text)}`), '');
  out.push('## Where', '');
  out.push(`- Page: \`${m.path || m.route}\` (route \`${m.route}\`)`);
  if (m.goalId) out.push(`- Goal: \`${m.goalId}\``);
  if (m.reviewId) out.push(`- Review: \`${m.reviewId}\``);
  const c = m.context;
  if (c) out.push(`- Screen: ${c.viewport.w} × ${c.viewport.h} at ${c.viewport.dpr}x, ${c.theme}${c.themeChoice === 'system' ? ' (following the device)' : ''}, accent ${c.accent}`, `- Version: \`${c.appVersion}\`, session \`${c.sessionId}\``);
  out.push(`- Markup: \`${m.id}\``, '');
  out.push('## Steps before it', '');
  out.push(...(m.steps.length ? m.steps.map((s, i) => `${i + 1}. ${stepText(s)}`) : ['Not included.']), '');
  out.push('## Errors and failed saves on this visit', '');
  out.push(...(m.errors.length ? m.errors.map((e) => `- ${problemText(e)}`) : ['None.']), '');
  out.push('When it’s fixed, list this markup’s id in the What’s new entry (`fixes`), so the sender sees “You raised this”.');
  return out.join('\n');
}

/** A step, in words: "Opened /goals/:goalId", "postCheckIn (failed)". */
export function stepText(s: MarkupStep): string {
  const at = s.at.slice(11, 19);
  switch (s.kind) {
    case 'page': return `${at} Opened ${s.name}`;
    case 'action': return `${at} ${s.name}${s.ok === false ? ' (failed)' : ''}${s.route ? ` on ${s.route}` : ''}`;
    case 'flow': return `${at} ${s.flow ?? 'Task'}: ${s.name}${s.step ? ` at ${s.step}` : ''}`;
    case 'error': return `${at} Error: ${s.name}${s.route ? ` on ${s.route}` : ''}`;
    default: return `${at} ${s.name}${s.route ? ` on ${s.route}` : ''}`;
  }
}

export function problemText(e: MarkupProblem): string {
  const what = e.kind === 'save' ? `A save didn’t go through${e.action ? ` (${e.action})` : ''}: ${e.type}` : `${e.type}${e.message ? `: ${e.message}` : ''}`;
  return `${e.at.slice(11, 19)} ${what}${e.route ? ` on ${e.route}` : ''}`;
}

/** A pre-filled new-issue link: the builder presses Submit on GitHub. GitHub caps the address, so long text is cut. */
export function newIssueLink(repo: string, m: Markup, o: { inboxUrl?: string | null } = {}): string {
  let body = issueBody(m, o);
  const make = () => `https://github.com/${repo}/issues/new?${new URLSearchParams({ title: issueTitle(m), body }).toString()}`;
  let url = make();
  while (url.length > 7500 && body.length > 200) { body = body.slice(0, Math.floor(body.length * 0.8)) + '\n\n(cut short: the rest is in the inbox)'; url = make(); }
  return url;
}

/* ---------- closing the loop ---------- */

/**
 * What the app knows about a markup or a piece of feedback this person sent: its id, and (once the builders have marked
 * it) where it was fixed. `kind` says which it is (a markup when not said).
 */
export interface Raised { id: string; personId: string; fixedIn?: string | null; kind?: 'markup' | 'feedback' }

/**
 * What a What's new entry fixed of what this person raised: the markups and feedback they sent that are listed in the
 * entry's `fixes`, or were marked fixed in it. Matched by person and id, so someone else's on the same browser doesn't count.
 */
export function raisedIn(entry: { id: string; fixes?: string[] }, raised: Raised[], personId: string): Raised[] {
  return raised.filter((r) => r.personId === personId && ((entry.fixes ?? []).includes(r.id) || r.fixedIn === entry.id));
}

/** Whether a What's new entry fixed something this person raised (raisedIn). */
export const raisedThis = (entry: { id: string; fixes?: string[] }, raised: Raised[], personId: string): boolean => raisedIn(entry, raised, personId).length > 0;

/** "Thank you: a markup you sent is fixed here." The words for what an entry fixed of yours. */
export function raisedText(mine: Raised[]): string {
  const markups = mine.filter((r) => r.kind !== 'feedback').length, feedback = mine.length - markups;
  const what = markups && feedback ? 'a markup and feedback you sent are' : feedback ? 'feedback you sent is' : 'a markup you sent is';
  return `Thank you: ${what} fixed here.`;
}
