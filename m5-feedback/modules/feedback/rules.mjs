// Feedback's rules: pure, no screens, no store. The one status rule shared by the inbox, the batch and the AI tools.
export const STATUSES = ['new', 'in-hand', 'fixed', 'wont-fix'];
export const STATUS_WORD = { new: 'New', 'in-hand': 'In hand', fixed: 'Fixed', 'wont-fix': 'Won’t fix' };
export const TAB_OF = { new: 'new', 'in-hand': 'in-hand', fixed: 'closed', 'wont-fix': 'closed' };
export const MOODS = { good: 'It works well', meh: 'It’s OK', bad: 'It gets in the way' };
export const ONLY_ADMIN = 'Only an admin can change the status of feedback.';

// sendFeedback (actions.md): anyone; mood is good, meh or bad.
export function checkFeedback({ mood, text, path }) {
  if (!Object.hasOwn(MOODS, mood || '')) return 'Mood is good, meh or bad.';
  if (typeof text !== 'string') return 'Say a few words.';
  if (!path) return 'Say which page it was sent from.';
  return null;
}

// A markup needs its line (MARKUP: "one required line").
export function checkMarkup(m) {
  if (!String(m.line || '').trim()) return 'Say what should change first';
  if (m.mood && !Object.hasOwn(MOODS, m.mood)) return 'Mood is good, meh or bad.';
  return null;
}

// The one status rule: who may, what each status needs, and the triage columns it writes.
// patch: { status, fixedIn?, reason?, issueUrl? }. Returns { refuse } or { next, before }.
export function triage(item, patch, by, { admin, at, via }) {
  if (!admin) return { refuse: ONLY_ADMIN };
  const before = pick(item);
  const next = { ...before };
  if (patch.issueUrl !== undefined) {
    const u = String(patch.issueUrl || '').trim();
    if (u && !/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+/.test(u)) return { refuse: 'Paste the issue’s address, like https://github.com/owner/repo/issues/12.' };
    next.issueUrl = u || null;
  }
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) return { refuse: 'Status is new, in-hand, fixed or wont-fix.' };
    if (patch.status === 'fixed' && !String(patch.fixedIn || '').trim()) return { refuse: 'Say which What’s new entry fixed it.' };
    if (patch.status === 'wont-fix' && !String(patch.reason || '').trim()) return { refuse: 'Say why it won’t be fixed.' };
    next.status = patch.status;
    next.fixedIn = patch.status === 'fixed' ? String(patch.fixedIn).trim() : null;
    next.wontFixReason = patch.status === 'wont-fix' ? String(patch.reason).trim() : null;
    next.statusBy = by; next.statusAt = at; next.statusVia = via || null;
  }
  return { next, before };
}
export const pick = (x) => ({ status: x.status, fixedIn: x.fixedIn ?? null, wontFixReason: x.wontFixReason ?? null, issueUrl: x.issueUrl ?? null, statusBy: x.statusBy ?? null, statusAt: x.statusAt ?? null, statusVia: x.statusVia ?? null });

// "Marked in hand: “The week strip”" and the status line's "Marked in hand by Amara Nwosu".
export function doneWords(status, what, n = 1) {
  const verb = { new: 'Marked new again', 'in-hand': 'Marked in hand', fixed: 'Marked fixed', 'wont-fix': 'Marked won’t fix' }[status];
  return n > 1 ? `${verb}: ${n} items` : `${verb}: “${what}”`;
}
export const byWords = (status, name) => (status === 'new' ? `Marked new again by ${name}` : `${doneWords(status, '').split(':')[0]} by ${name}`);

// Folding: markups about the same part of the same page, in the same tab, are one row.
export const foldKey = (x) => (x.kind === 'markup' ? `${TAB_OF[x.status]}|${x.route}|${(x.parts || [])[0] || ''}` : `one|${x.id}`);

// "You raised this" (FEEDBACK-RAISED): matched by person and id only.
export function raised(items, personId, entries) {
  const out = new Map();
  for (const e of entries) for (const x of items) {
    if (x.personId !== personId) continue;
    if ((e.fixes || []).includes(x.id) || (x.status === 'fixed' && x.fixedIn === e.id)) out.set(e.id, [...(out.get(e.id) || []), x.id]);
  }
  return out;
}
