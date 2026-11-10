/* Faro's own schema in the shared database (backlog 0c, migration 0035). Every Faro request to Supabase's Data API
   names the schema `faro` (supabase-js sends it as the Accept-Profile or Content-Profile header), so Faro reads and
   writes its own tables and functions only.
   Supabase answers only for the schemas listed under Data API → Exposed schemas, which Lane changes. Until faro is
   listed there, the answer is 406 with code PGRST106; then faroFetch asks again for the same thing in public, where
   0035 left a redirect for every table and function, and keeps using public for the rest of the visit. So the app
   works before 0035, between 0035 and the setting, and after it, in any order. A later release drops the redirects and
   this fallback once faro is listed (backlog 0c, step 2). No Supabase import: the telemetry exporter uses it too. */

export const FARO_SCHEMA = 'faro';
const PROFILES = ['accept-profile', 'content-profile'];

let fallback = false;
/** Whether this visit has fallen back to public (the Data API doesn't offer faro yet). */
export const usingFallback = () => fallback;
/** For tests: start again as if faro were offered. */
export function resetSchemaFallback() { fallback = false; }

function profiled(init: RequestInit | undefined, schema: string): { init: RequestInit; asked: boolean } {
  const headers = new Headers(init?.headers);
  let asked = false;
  for (const h of PROFILES) if (headers.get(h) === FARO_SCHEMA) { asked = true; headers.set(h, schema); }
  return { init: { ...init, headers }, asked };
}

/** Is this the Data API saying it doesn't offer the schema asked for? */
async function notOffered(res: Response): Promise<boolean> {
  if (res.status !== 406) return false;
  try { return (await res.clone().json() as { code?: string }).code === 'PGRST106'; } catch { return false; }
}

/** A fetch for Supabase clients and raw Data API calls: asks for faro, and falls back to public while faro isn't offered. */
export function faroFetch(base: typeof fetch = (...a) => fetch(...a)): typeof fetch {
  return async (input, init) => {
    if (fallback) return base(input, profiled(init, 'public').init);
    const { asked } = profiled(init, FARO_SCHEMA);
    const res = await base(input, init);
    if (!asked || !(await notOffered(res))) return res;
    fallback = true;
    return base(input, profiled(init, 'public').init);
  };
}
