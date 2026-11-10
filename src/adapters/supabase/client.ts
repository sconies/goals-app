/* One way to make a Supabase client for Faro: its own schema, faro (backlog 0c), the public key only, and no sign-in
   kept in the browser. Every adapter here makes its client with this. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FARO_SCHEMA, faroFetch } from './schema';

export function faroClient(url: string, key: string, opts: { fetch?: typeof fetch } = {}): SupabaseClient {
  return createClient(url, key, {
    db: { schema: FARO_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: faroFetch(opts.fetch) },
  }) as unknown as SupabaseClient;
}
