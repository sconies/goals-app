/* Feedback in the inbox (Lane, 6 Nov): what people send with Send feedback's moods and words is listed beside
   markups and triaged the same way, with the same states (New, In hand, Fixed, Won't fix) and the same rules
   (statusPatch in model.ts). Anyone reads and triages it (backlog O, migration 0031). Where it's kept is passed in, as
   for markups:
   - openFeedback and tokenFeedback (src/adapters/supabase/feedback.ts): the inbox, and the MCP server's feedback
     tools, on Supabase;
   - localFeedback: with no database, this workspace's feedback from the app, its statuses kept in this browser. */
import type { Feedback } from '../domain/types';
import { MarkupError, nameOnly, statusPatch, type MarkupStatus, type Mood, type StatusChange } from './model';

export interface InboxFeedback {
  id: string;
  workspaceId: string;
  workspaceName: string;
  personId: string;
  personName: string;
  /** The screen it was sent from. */
  path: string;
  mood: Mood;
  text: string;
  at: string;
  status: MarkupStatus;
  fixedIn: string | null;
  wontFixReason: string | null;
  statusBy: string | null;
  statusAt: string | null;
}

export type Triage = Pick<InboxFeedback, 'status' | 'fixedIn' | 'wontFixReason' | 'statusBy' | 'statusAt'>;

/** A row of okr_feedback_inbox (or the triage columns of okr_feedback). */
export interface FeedbackInboxRow {
  id: string; workspace_id: string; workspace_name?: string; person_id: string; person_name?: string; path: string; mood: Mood; text: string; at: string;
  status?: MarkupStatus | null; fixed_in?: string | null; wont_fix_reason?: string | null; status_by?: string | null; status_at?: string | null;
}

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
export const triageFromRow = (r: Partial<FeedbackInboxRow>): Triage => ({ status: r.status ?? 'new', fixedIn: r.fixed_in ?? null, wontFixReason: r.wont_fix_reason ?? null, statusBy: r.status_by == null ? null : nameOnly(r.status_by), statusAt: iso(r.status_at) });
export const feedbackFromInboxRow = (r: FeedbackInboxRow): InboxFeedback => ({
  id: r.id, workspaceId: r.workspace_id, workspaceName: r.workspace_name ?? '', personId: r.person_id, personName: nameOnly(r.person_name),
  path: r.path ?? '', mood: r.mood, text: r.text ?? '', at: iso(r.at) ?? r.at, ...triageFromRow(r),
});
export const triageToRow = (t: Triage) => ({ status: t.status, fixed_in: t.fixedIn, wont_fix_reason: t.wontFixReason, status_by: t.statusBy, status_at: t.statusAt });

/** Which feedback to list: one workspace's, or one status. */
export interface FeedbackQuery { workspaceId?: string; status?: MarkupStatus }

/** Where feedback is kept, for the inbox and the MCP server's feedback tools. */
export interface FeedbackStore {
  list(limit: number, q?: FeedbackQuery): Promise<InboxFeedback[]>;
  /** One piece of feedback; null when there's no such feedback. */
  get(id: string): Promise<InboxFeedback | null>;
  /** Saves a status; null when there's no such feedback. */
  update(id: string, t: Triage): Promise<Triage | null>;
}

export const matches = (q: FeedbackQuery = {}) => (f: InboxFeedback) => (!q.workspaceId || f.workspaceId === q.workspaceId) && (!q.status || f.status === q.status);

export function feedbackOps(o: { store: FeedbackStore; entries: string[]; now?: () => Date }) {
  return {
    list: (limit = 200, q?: FeedbackQuery) => o.store.list(Math.min(Math.max(limit, 1), 500), q),
    async open(id: string): Promise<InboxFeedback> {
      const f = await o.store.get(id);
      if (!f) throw new MarkupError(`There’s no feedback ${id}.`);
      return f;
    },
    /** The same rules as a markup's status: fixed names a What's new entry, won't fix says why. */
    async setStatus(id: string, c: StatusChange): Promise<Triage> {
      const t = await o.store.update(id, statusPatch(c, (o.now?.() ?? new Date()).toISOString(), o.entries));
      if (!t) throw new MarkupError('That feedback isn’t there any more.');
      return t;
    },
  };
}
export type FeedbackOps = ReturnType<typeof feedbackOps>;

const KEPT = 'faro-feedback-triage';
const readKept = (): Record<string, Triage> => { try { return JSON.parse(localStorage.getItem(KEPT) || '{}') as Record<string, Triage>; } catch { return {}; } };
/** With no database: the What's new entry each piece of feedback was marked fixed in, in this browser ("You raised this"). */
export const keptFixes = (): Record<string, string | null> => Object.fromEntries(Object.entries(readKept()).map(([id, t]) => [id, t.fixedIn ?? null]));

/** With no database: this workspace's feedback, as the app has it, with the statuses set kept in this browser. */
export function localFeedback(o: { workspaceId: string; workspaceName: string; feedback: () => Feedback[]; personName: (id: string) => string }): FeedbackStore {
  const all = (): InboxFeedback[] => {
    const kept = readKept();
    return o.feedback().map((f): InboxFeedback => ({
      id: f.id, workspaceId: o.workspaceId, workspaceName: o.workspaceName, personId: f.personId, personName: nameOnly(o.personName(f.personId)),
      path: f.path, mood: f.mood, text: f.text, at: f.at, ...(kept[f.id] ?? triageFromRow({})),
    })).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  };
  return {
    list: async (limit, q) => all().filter(matches(q)).slice(0, limit),
    get: async (id) => all().find((f) => f.id === id) ?? null,
    async update(id, t) {
      if (!o.feedback().some((f) => f.id === id)) return null;
      try { localStorage.setItem(KEPT, JSON.stringify({ ...readKept(), [id]: t })); } catch { throw new MarkupError('This browser won’t keep the status.'); }
      return t;
    },
  };
}
