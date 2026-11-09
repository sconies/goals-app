/* Files on Supabase Storage (backlog 8c): the Files port (src/ports/index.ts) over one bucket. Markup pictures use the
   "markups" bucket: adding only (a file is never replaced), read by its public address (migration 0031). */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Files } from '../../ports';

export function supabaseFiles(db: SupabaseClient, bucket: string): Files {
  const url = (path: string) => db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return {
    async put(path, data, type) {
      const { error } = await db.storage.from(bucket).upload(path, data, { contentType: type, upsert: false });
      if (error) throw new Error(error.message);
    },
    url: async (path) => url(path),
    async bytes(path) {
      try {
        const r = await fetch(url(path));
        return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
      } catch { return null; }
    },
  };
}
