/* Research sessions: people and AI agents trying the app, with what they thought at first glance, comments on any
   part of any screen, how each task went, and a report at the end. Notes are kept in this browser and, where the
   app has a database, sent to a table nobody can read back through the app. */

export interface ResearchTask { id: string; as: string; start: string; title: string; detail: string }
export interface ResearchSession { id: string; researcher: string; kind: 'person' | 'ai'; startedAt: string; task: number }
export type NoteKind = 'first-glance' | 'comment' | 'task' | 'report';
export interface ResearchNote {
  id: string; sessionId: string; researcher: string; researcherKind: 'person' | 'ai'; kind: NoteKind; persona: string; route: string; target: string;
  taskId?: string; outcome?: 'done' | 'stuck' | 'gave-up'; severity?: 'blocker' | 'major' | 'minor' | 'polish' | 'idea'; rating?: number; text: string; at: string; sent?: boolean;
}

/** The tasks: goals to reach, not steps to follow, each as the person it's about. */
export const TASKS: ResearchTask[] = [
  { id: 'check-in', as: 'maya', start: '/', title: 'Get this week’s check-ins in', detail: 'You’re Maya, a goal owner. The weekly review is on Thursday. Get your goals checked in before it.' },
  { id: 'behind', as: 'maya', start: '/', title: 'Say why a goal is behind, and when it’ll be back', detail: 'One of your goals is behind plan. Make sure your VP can see why, what you’ll do about it and by when.' },
  { id: 'sink', as: 'elena', start: '/', title: 'Find what will sink the north star', detail: 'You’re Elena, VP. Before the review, find the goal most likely to make the north star miss, and what’s being done about it.' },
  { id: 'review', as: 'elena', start: '/', title: 'Run the weekly review', detail: 'Walk this week’s review and leave an action for someone, with a date.' },
  { id: 'year', as: 'elena', start: '/goals', title: 'See how the year is going, quarter by quarter', detail: 'Which goals missed last quarter’s plan? Which are done, late or not going to make it?' },
  { id: 'follow', as: 'tom', start: '/', title: 'Follow goals you don’t own', detail: 'You’re Tom, an engineer. Keep an eye on the goals your work feeds into, without owning any.' },
  { id: 'raise', as: 'sam', start: '/', title: 'Raise a target that’s too easy', detail: 'You’re Sam. One target turned out too easy. Raise it properly, so everyone can see what changed and why.' },
  { id: 'brief', as: 'elena', start: '/goals', title: 'Get a summary for an AI chat', detail: 'Get a short write-up of every goal you could paste into an AI chat, or a file you could open in Excel.' },
  { id: 'history', as: 'kofi', start: '/', title: 'Load past numbers from a spreadsheet', detail: 'You’re Kofi. Load a few weeks of past numbers for one of your goals from a spreadsheet.' },
  { id: 'admin', as: 'priya', start: '/', title: 'Add a new joiner', detail: 'You’re Priya, an admin. Add a new joiner to the right team, and make them an owner of a goal.' },
  { id: 'break', as: 'maya', start: '/', title: 'Try to break it', detail: 'Wrong or silly numbers, empty fields, the back button and a refresh halfway through something, a phone-sized window. Anything that loses work, misleads or confuses is worth a note.' },
];

/** Every screen worth a first glance, by route. */
export const SCREENS: [RegExp, string][] = [
  [/^\/$/, 'Home'], [/^\/check-in/, 'Check-in'], [/^\/quick-check-in/, 'Numbers in one table'], [/^\/watching/, 'Watching'],
  [/^\/reviews\/new|\/edit$/, 'Setting up a review'], [/^\/reviews\/[^/]+$/, 'A review'], [/^\/reviews$/, 'Reviews'],
  [/^\/goals\/new/, 'New goal'], [/^\/goals\/[^/]+\/edit/, 'Changing a goal'], [/^\/goals\/[^/]+/, 'A goal'], [/^\/goals/, 'Goals'],
  [/^\/activity/, 'Activity'], [/^\/workspace\/new/, 'Setting up a workspace'], [/^\/workspace/, 'Workspace'], [/^\/import/, 'Import'], [/^\/retro/, 'Wrap-up'],
];
export const screenName = (path: string) => SCREENS.find(([r]) => r.test(path))?.[1] ?? path;

const SKEY = 'goals-research', NKEY = 'goals-research-notes';
const rid = () => 'rn_' + Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('');

export function readSession(): ResearchSession | null {
  try { const v = sessionStorage.getItem(SKEY) ?? localStorage.getItem(SKEY); return v ? (JSON.parse(v) as ResearchSession) : null; } catch { return null; }
}
export function writeSession(s: ResearchSession | null) {
  try {
    if (s) { sessionStorage.setItem(SKEY, JSON.stringify(s)); localStorage.setItem(SKEY, JSON.stringify(s)); }
    else { sessionStorage.removeItem(SKEY); localStorage.removeItem(SKEY); }
  } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('goals-research'));
}
export function startSession(researcher: string, kind: 'person' | 'ai'): ResearchSession {
  const s: ResearchSession = { id: 'rs_' + rid().slice(3), researcher: researcher.trim(), kind, startedAt: new Date().toISOString(), task: 0 };
  writeSession(s);
  return s;
}
export function readNotes(sessionId?: string): ResearchNote[] {
  try { const all = JSON.parse(localStorage.getItem(NKEY) || '[]') as ResearchNote[]; return sessionId ? all.filter((n) => n.sessionId === sessionId) : all; } catch { return []; }
}
function writeNotes(all: ResearchNote[]) {
  try { localStorage.setItem(NKEY, JSON.stringify(all)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('goals-research'));
}

/** Keeps a note here, and sends it to the research table when the app has a database. */
export async function addNote(s: ResearchSession, n: Omit<ResearchNote, 'id' | 'sessionId' | 'researcher' | 'researcherKind' | 'at'>): Promise<ResearchNote> {
  const note: ResearchNote = { ...n, id: rid(), sessionId: s.id, researcher: s.researcher, researcherKind: s.kind, at: new Date().toISOString() };
  writeNotes([...readNotes(), note]);
  void send(note);
  return note;
}

async function send(n: ResearchNote) {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key } = import.meta.env;
  if (!url || !key) return;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db.from('okr_research_notes').insert({
      id: n.id, session_id: n.sessionId, researcher: n.researcher, researcher_kind: n.researcherKind, kind: n.kind, persona: n.persona, route: n.route, target: n.target,
      task_id: n.taskId ?? null, outcome: n.outcome ?? null, severity: n.severity ?? null, rating: n.rating ?? null, text: n.text.slice(0, 20000), user_agent: navigator.userAgent.slice(0, 300),
    });
    if (!error) writeNotes(readNotes().map((x) => (x.id === n.id ? { ...x, sent: true } : x)));
  } catch { /* kept here; can be downloaded */ }
}

/** Everything from a session as Markdown: to attach to a report, or to read back. */
export function notesMarkdown(s: ResearchSession): string {
  const notes = readNotes(s.id);
  const out = [`# Research notes: ${s.researcher || 'Anonymous'} (${s.kind === 'ai' ? 'AI agent' : 'person'})`, '', `Session ${s.id}, started ${s.startedAt.slice(0, 16).replace('T', ' ')}.`, ''];
  const tasks = notes.filter((n) => n.kind === 'task');
  if (tasks.length) { out.push('## Tasks'); for (const t of tasks) out.push(`- **${TASKS.find((x) => x.id === t.taskId)?.title ?? t.taskId}**: ${t.outcome}${t.rating ? `, confidence ${t.rating}/5` : ''}. ${t.text}`); out.push(''); }
  const glance = notes.filter((n) => n.kind === 'first-glance');
  if (glance.length) { out.push('## First glance'); for (const g of glance) out.push(`- **${screenName(g.route)}** (as ${g.persona}): ${g.text}`); out.push(''); }
  const comments = notes.filter((n) => n.kind === 'comment');
  if (comments.length) { out.push('## Comments'); for (const c of comments) out.push(`- [${c.severity ?? 'note'}] **${screenName(c.route)}**${c.target ? ` · “${c.target}”` : ''}: ${c.text}`); out.push(''); }
  const reports = notes.filter((n) => n.kind === 'report');
  if (reports.length) { out.push('## Report'); for (const r of reports) out.push(r.text, ''); }
  return out.join('\n');
}

export const REPORT_TEMPLATE = `## Summary
(Three or four sentences: could you get things done, and what got in the way most?)

## Top findings
(Most important first. For each: severity (blocker, major, minor, polish), the screen, what you did, what you expected, what happened.)

1.

## Tasks
(Each task: done, stuck or gave up, and why.)

## First impressions
(What the app seemed to be for, at first glance, and whether that turned out right.)

## Ideas
`;
