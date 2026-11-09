/* Research notes and the demo's feedback, added to Supabase's okr_research_notes (backlog 8c: Supabase only in its
   adapters). Anyone can add; nobody can read back through the app. */
import { createClient } from '@supabase/supabase-js';

export async function addResearchNote(url: string, key: string, row: Record<string, unknown>): Promise<boolean> {
  const db = createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: false } });
  const { error } = await db.from('okr_research_notes').insert(row);
  return !error;
}
