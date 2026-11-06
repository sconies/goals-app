/* Feedback in the builder inbox (Lane, 6 Nov): what people send with Send feedback's moods and words is listed beside
   markups and triaged the same way, with the same states (New, In hand, Fixed, Won't fix) and the same rules
   (statusPatch in model.ts). Where it's kept is passed in, as for markups:
   - signedInFeedback: a builder signed in to the inbox, through the database's functions for it (migration 0026:
     okr_feedback_inbox reads every workspace's feedback, okr_feedback_triage changes one's status);
   - localFeedback: with no database, this workspace's feedback from the app, its statuses kept in this browser. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Feedback } from '../domain/types';
import { MarkupError, statusPatch, type MarkupStatus, type Mood, type StatusChange } from './model';

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

type Triage = Pick<InboxFeedback, 'status' | 'fixedIn' | 'wontFixReason' | 'statusBy' | 'statusAt'>;

/** A row of okr_feedback_inbox (or the triage columns of okr_feedback). */
export interface FeedbackInboxRow {
  id: string; workspace_id: string; workspace_name?: string; person_id: string; person_name?: string; path: string; mood: Mood; text: string; at: string;
  status?: MarkupStatus | null; fixed_in?: string | null; wont_fix_reason?: string | null; status_by?: string | null; status_at?: string | null;
}

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
const triageFromRow = (r: Partial<FeedbackInboxRow>): Triage => ({ status: r.status ?? 'new', fixedIn: r.fixed_in ?? null, wontFixReason: r.wont_fix_reason ?? null, statusBy: r.status_by ?? null, statusAt: iso(r.status_at) });
export const feedbackFromInboxRow = (r: FeedbackInboxRow): InboxFeedback => ({
  id: r.id, workspaceId: r.workspace_id, workspaceName: r.workspace_name ?? '', personId: r.person_id, personName: r.person_name ?? '',
  path: r.path ?? '', mood: r.mood, text: r.text ?? '', at: iso(r.at) ?? r.at, ...triageFromRow(r),
});
const triageToRow = (t: Triage) => ({ status: t.status, fixed_in: t.fixedIn, wont_fix_reason: t.wontFixReason, status_by: t.statusBy, status_at: t.statusAt });

/** Where feedback is kept, for the inbox. */
export interface FeedbackStore {
  list(limit: number): Promise<InboxFeedback[]>;
  /** Saves a status; null when there's no such feedback. */
  update(id: string, t: Triage): Promise<Triage | null>;
}

export function feedbackOps(o: { store: FeedbackStore; entries: string[]; now?: () => Date }) {
  return {
    list: (limit = 200) => o.store.list(Math.min(Math.max(limit, 1), 500)),
    /** The same rules as a markup's status: fixed names a What's new entry, won't fix says why. */
    async setStatus(id: string, c: StatusChange): Promise<Triage> {
      const t = await o.store.update(id, statusPatch(c, (o.now?.() ?? new Date()).toISOString(), o.entries));
      if (!t) throw new MarkupError('That feedback isn’t there any more.');
      return t;
    },
  };
}
export type FeedbackOps = ReturnType<typeof feedbackOps>;

export function signedInFeedback(db: SupabaseClient): FeedbackStore {
  return {
    async list(limit) {
      const { data, error } = await db.rpc('okr_feedback_inbox', { lim: limit });
      if (error) throw new Error('Feedback: ' + error.message);
      return ((data ?? []) as FeedbackInboxRow[]).map(feedbackFromInboxRow);
    },
    async update(id, t) {
      const { data, error } = await db.rpc('okr_feedback_triage', { fid: id, patch: triageToRow(t) });
      if (error) throw new Error('Saving the feedback: ' + error.message.replace(/^.*?: /, ''));
      const row = ((data ?? []) as FeedbackInboxRow[])[0];
      return row ? triageFromRow(row) : null;
    },
  };
}

const KEPT = 'faro-feedback-triage';
const readKept = (): Record<string, Triage> => { try { return JSON.parse(localStorage.getItem(KEPT) || '{}') as Record<string, Triage>; } catch { return {}; } };

/** With no database: this workspace's feedback, as the app has it, with the statuses builders set kept in this browser. */
export function localFeedback(o: { workspaceId: string; workspaceName: string; feedback: () => Feedback[]; personName: (id: string) => string }): FeedbackStore {
  return {
    async list(limit) {
      const kept = readKept();
      return o.feedback().map((f): InboxFeedback => ({
        id: f.id, workspaceId: o.workspaceId, workspaceName: o.workspaceName, personId: f.personId, personName: o.personName(f.personId),
        path: f.path, mood: f.mood, text: f.text, at: f.at, ...(kept[f.id] ?? triageFromRow({})),
      })).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).slice(0, limit);
    },
    async update(id, t) {
      if (!o.feedback().some((f) => f.id === id)) return null;
      try { localStorage.setItem(KEPT, JSON.stringify({ ...readKept(), [id]: t })); } catch { throw new MarkupError('This browser won’t keep the status.'); }
      return t;
    },
  };
}
