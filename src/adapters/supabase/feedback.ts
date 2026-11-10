/* Feedback in the inbox, kept in Supabase (backlog 8c: Supabase only in its adapters). Both pass the feedback store's
   contract (src/ports/contracts/feedback.ts).
   - openFeedback: the inbox, on the app's public key, through the database's functions for it (okr_feedback_inbox
     reads every workspace's feedback, okr_feedback_triage changes one's status);
   - tokenFeedback: the MCP server's feedback tools, with any token, through the database's functions for it
     (okr_feedback_for_token, okr_feedback_triage_for_token), as the markup tools reach markups. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { feedbackFromInboxRow, matches, triageFromRow, triageToRow, type FeedbackInboxRow, type FeedbackStore } from '../../markup/feedback';

export function openFeedback(db: SupabaseClient): FeedbackStore {
  const all = async (limit: number) => {
    const { data, error } = await db.rpc('okr_feedback_inbox', { lim: limit });
    if (error) throw new Error('Feedback: ' + error.message);
    return ((data ?? []) as FeedbackInboxRow[]).map(feedbackFromInboxRow);
  };
  return {
    // The inbox lists the newest of everything; a narrower list is picked from the newest 500.
    list: async (limit, q) => (q?.workspaceId || q?.status ? (await all(500)).filter(matches(q)).slice(0, limit) : all(limit)),
    get: async (id) => (await all(500)).find((f) => f.id === id) ?? null,
    async update(id, t) {
      const { data, error } = await db.rpc('okr_feedback_triage', { fid: id, patch: triageToRow(t) });
      if (error) throw new Error('Saving the feedback: ' + error.message.replace(/^.*?: /, ''));
      const row = ((data ?? []) as FeedbackInboxRow[])[0];
      return row ? triageFromRow(row) : null;
    },
  };
}

/** The MCP server, with any token: through the database's functions for it (migration 0028), on the public key. */
export function tokenFeedback(db: SupabaseClient, hash: string): FeedbackStore {
  const read = async (args: { ws?: string | null; st?: string | null; fid?: string | null; lim: number }) => {
    const { data, error } = await db.rpc('okr_feedback_for_token', { hash, ws: args.ws ?? null, st: args.st ?? null, fid: args.fid ?? null, lim: args.lim });
    if (error) throw new Error('Feedback: ' + error.message);
    return ((data ?? []) as FeedbackInboxRow[]).map(feedbackFromInboxRow);
  };
  return {
    list: (limit, q) => read({ ws: q?.workspaceId, st: q?.status, lim: limit }),
    get: async (id) => (await read({ fid: id, lim: 1 }))[0] ?? null,
    async update(id, t) {
      const { data, error } = await db.rpc('okr_feedback_triage_for_token', { hash, fid: id, patch: triageToRow(t) });
      if (error) throw new Error('Saving the feedback: ' + error.message.replace(/^.*?: /, ''));
      const row = ((data ?? []) as FeedbackInboxRow[])[0];
      return row ? triageFromRow(row) : null;
    },
  };
}
