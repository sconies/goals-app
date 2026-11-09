// @vitest-environment node
/* The other outside parts pass their contracts (src/ports/contracts/parts.ts): markups and feedback on Supabase (its
   real adapters, on a stand-in client over Postgres with Faro's migrations) and in this browser; identity, the clock,
   files, and the demo's number source. */
import { feedbackToRow } from '../data/rows';
import { buildExample } from '../data/examples';
import { localFeedback } from '../markup/feedback';
import { markupToRow } from '../markup/model';
import type { Feedback } from '../domain/types';
import { clockContract, feedbackContract, filesContract, identityContract, markupContract, numberSourceContract } from '../ports/contracts/parts';
import { contractWorkspace } from '../ports/contracts/store';
import { DEMO_SOURCE, demoNumbers } from './demo/numbers';
import { fixedClock, memoryFiles, pickerIdentity, systemClock } from './local';
import { freshPostgres } from './postgres/testDb';
import { openFeedback } from './supabase/feedback';
import { SupabaseStore } from './supabase/goalsStore';
import { openMarkups } from './supabase/markups';
import { pgSupabase } from './supabase/testClient';

/** A browser's localStorage, in memory. */
const memory = (): Storage => {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
};

markupContract('Supabase', async () => {
  const db = await freshPostgres();
  const client = pgSupabase(db);
  return {
    store: openMarkups(client),
    async add(m) {
      const { error } = await client.from('okr_markups').insert(markupToRow(m));
      if (error) throw new Error(error.message);
      await db.query('update okr_markups set status = $2, created_at = $3 where id = $1', [m.id, m.status, m.createdAt]);
    },
  };
});

feedbackContract('Supabase', async () => {
  const db = await freshPostgres();
  const client = pgSupabase(db);
  const ws = contractWorkspace('fb1');
  await new SupabaseStore('https://stand-in.supabase.co', 'public-key', client).createWorkspace({ id: 'ws_feedback', name: 'Feedback', kind: 'own', createdAt: '2026-11-01T00:00:00Z' }, ws);
  return {
    store: openFeedback(client), workspaceId: 'ws_feedback', personId: ws.people[0]!.id,
    async add(w, f) { const { error } = await client.from('okr_feedback').insert(feedbackToRow(w, f)); if (error) throw new Error(error.message); },
  };
});

feedbackContract('in this browser', async () => {
  vi.stubGlobal('localStorage', memory());
  const kept: Feedback[] = [];
  return {
    store: localFeedback({ workspaceId: 'ws_here', workspaceName: 'Here', feedback: () => kept, personName: () => 'Ada Lovelace' }),
    workspaceId: 'ws_here', personId: 'ada',
    async add(_w, f) { kept.push(f); },
  };
});

const storage = memory();
identityContract('the “Who are you?” picker', () => pickerIdentity('faro-me:', () => storage));
clockContract('the system clock', () => systemClock);
clockContract('a fixed clock', () => fixedClock(new Date('2026-11-11T09:00:00Z')));
filesContract('in memory', async () => memoryFiles());

numberSourceContract('the demo’s CI analytics', async () => {
  const s = await buildExample(new Date('2026-11-05T12:00:00Z'));
  const metric = (s.metrics ?? []).find((m) => m.source === DEMO_SOURCE)!;
  return { source: demoNumbers(() => s), metric, before: new Date('2025-01-01T00:00:00Z'), after: new Date('2026-11-05T12:00:00Z') };
});
