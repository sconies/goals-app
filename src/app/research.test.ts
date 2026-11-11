import { vi } from 'vitest';

const inserted: [string, Record<string, unknown>][] = [];
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (t: string) => ({ insert: async (row: Record<string, unknown>) => { inserted.push([t, row]); return { error: null }; } }) }),
}));

describe('feedback sent from the demo', () => {
  it('reaches the research table with the screen, the persona and how they felt, and one id per visitor', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_KEY', 'anon');
    // Test files share their workers' modules (vitest.config.ts, isolate: false): if another file already loaded the real
    // Supabase client, the mock above would never reach it and the insert would go to the network. Start afresh.
    vi.resetModules();
    const { sendDemoFeedback } = await import('./research');
    expect(await sendDemoFeedback({ mood: 'bad', text: ' The cause buttons don’t fit my case ', path: '/check-in/head', persona: 'Maya Chen, Product lead' })).toBe(true);
    expect(await sendDemoFeedback({ mood: 'good', text: '', path: '/', persona: 'Maya Chen, Product lead' })).toBe(true);
    expect(inserted).toHaveLength(2);
    const [table, row] = inserted[0]!;
    expect(table).toBe('okr_research_notes');
    expect(row).toMatchObject({ kind: 'feedback', researcher: 'Demo visitor', researcher_kind: 'person', route: '/check-in/head', persona: 'Maya Chen, Product lead', rating: 1, text: 'It gets in the way: The cause buttons don’t fit my case' });
    expect(inserted[1]![1]).toMatchObject({ rating: 5, text: 'It helps' });
    expect(inserted[0]![1].session_id).toBe(inserted[1]![1].session_id);
    expect(String(inserted[0]![1].session_id)).toMatch(/^dv_/);
    vi.unstubAllEnvs();
  });
});
