/* Research notes and the demo's feedback, added to Supabase's okr_research_notes (backlog 8c: Supabase only in its
   adapters). Anyone can add; nobody can read back through the app. */
import { faroClient } from './client';

export async function addResearchNote(url: string, key: string, row: Record<string, unknown>): Promise<boolean> {
  const db = faroClient(url, key);
  const { error } = await db.from('okr_research_notes').insert(row);
  return !error;
}
