/* The browser's markups and feedback, on Supabase (backlog 8c: Supabase only in its adapters). src/markup/backend.ts
   loads this only when markups go to the database, so the demo's bundle stays small. On the app's public key, with no
   sign-in (backlog O, migration 0031):
   - a markup's id is issued by the database (okr_markup_new_id), its pictures go to the "markups" bucket first
     (files.ts), then the markup itself;
   - "You raised this" asks the database which of a person's markups and feedback were fixed;
   - the inbox reads and triages markups and feedback (markups.ts, feedback.ts). */
import type { Pictures } from '../../markup/ink';
import { markupToRow, type Markup, type Raised } from '../../markup/model';
import { openFeedback } from './feedback';
import { faroClient } from './client';
import { supabaseFiles } from './files';
import { openMarkups } from './markups';

export function supabaseMarkups(url: string, key: string) {
  const db = faroClient(url, key);
  const files = supabaseFiles(db, 'markups');
  return {
    async newId(): Promise<string> {
      const { data, error } = await db.rpc('okr_markup_new_id');
      if (error || typeof data !== 'string') throw new Error('The markup couldn’t be sent: ' + (error?.message ?? 'no id came back') + '.');
      return data;
    },
    /** Its pictures first, then the markup, so a markup never points at pictures that aren't there. */
    async send(m: Markup, pictures: Pictures): Promise<void> {
      for (const name of m.pictures) {
        const file = pictures[name as keyof Pictures];
        try { await files.put(`${m.id}/${name}`, file, file.type); } catch (e) { throw new Error('The picture couldn’t be sent: ' + (e instanceof Error ? e.message : String(e)) + '.'); }
      }
      const { error } = await db.from('okr_markups').insert(markupToRow(m));
      if (error) throw new Error('The markup couldn’t be sent: ' + error.message + '.');
    },
    /** Which of this person's markups and feedback the database says were fixed (okr_markups_raised, okr_feedback_raised). */
    async raised(workspaceId: string, personId: string): Promise<Raised[]> {
      const known = async (fn: string, kind: Raised['kind']): Promise<Raised[]> => {
        try {
          const { data, error } = await db.rpc(fn, { ws: workspaceId, person: personId });
          return error ? [] : ((data ?? []) as { id: string; fixed_in: string | null }[]).map((r) => ({ id: r.id, personId, fixedIn: r.fixed_in, kind }));
        } catch { return []; }
      };
      const [markups, feedback] = await Promise.all([known('okr_markups_raised', 'markup'), known('okr_feedback_raised', 'feedback')]);
      return [...markups, ...feedback];
    },
    inbox: () => openMarkups(db),
    feedback: () => openFeedback(db),
  };
}
