// @vitest-environment node
/* Faro asks Supabase's Data API for its own schema, faro, and falls back to the redirects in public while the Data API
   doesn't offer faro yet (backlog 0c). */
import { faroFetch, resetSchemaFallback, usingFallback } from './schema';

type Seen = { url: string; profile: string | null; body: unknown };

/** A Data API that offers only the schemas given, and answers like PostgREST when asked for another. */
function dataApi(offered: string[]) {
  const seen: Seen[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    const profile = h.get('accept-profile') ?? h.get('content-profile');
    seen.push({ url: String(input), profile, body: init?.body });
    if (profile && !offered.includes(profile)) {
      return new Response(JSON.stringify({ code: 'PGRST106', message: `The schema must be one of the following: ${offered.join(', ')}` }), { status: 406 });
    }
    return new Response('[]', { status: 200 });
  }) as typeof globalThis.fetch;
  return { fetch, seen };
}

describe('asking for Faro’s schema', () => {
  beforeEach(() => resetSchemaFallback());

  it('asks for faro and nothing else once the Data API offers it', async () => {
    const api = dataApi(['public', 'faro']);
    const res = await faroFetch(api.fetch)('https://x.supabase.co/rest/v1/okr_goals', { headers: { 'Accept-Profile': 'faro' } });
    expect(res.status).toBe(200);
    expect(api.seen.map((s) => s.profile)).toEqual(['faro']);
    expect(usingFallback()).toBe(false);
  });

  it('asks again in public when faro isn’t offered yet, with the same body, and stays there for the visit', async () => {
    const api = dataApi(['public']);
    const f = faroFetch(api.fetch);
    const res = await f('https://x.supabase.co/rest/v1/rpc/okr_commit', { method: 'POST', headers: { 'Content-Profile': 'faro' }, body: '{"ws":"a"}' });
    expect(res.status).toBe(200);
    expect(api.seen.map((s) => [s.profile, s.body])).toEqual([['faro', '{"ws":"a"}'], ['public', '{"ws":"a"}']]);
    expect(usingFallback()).toBe(true);
    await f('https://x.supabase.co/rest/v1/okr_goals', { headers: { 'Accept-Profile': 'faro' } });
    expect(api.seen.slice(2).map((s) => s.profile)).toEqual(['public']);
  });

  it('leaves every other answer alone: a 406 for another reason, pictures, and requests that name no schema', async () => {
    const other = (async () => new Response(JSON.stringify({ code: 'PGRST116', message: 'not one row' }), { status: 406 })) as typeof fetch;
    expect((await faroFetch(other)('https://x.supabase.co/rest/v1/okr_goals', { headers: { 'Accept-Profile': 'faro' } })).status).toBe(406);
    expect(usingFallback()).toBe(false);
    const api = dataApi(['public']);
    await faroFetch(api.fetch)('https://x.supabase.co/storage/v1/object/markups/m1/screen.png', { method: 'POST', body: 'png' });
    expect(api.seen.map((s) => s.profile)).toEqual([null]);
    expect(usingFallback()).toBe(false);
  });
});
