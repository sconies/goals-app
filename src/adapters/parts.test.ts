// @vitest-environment node
/* The other outside parts pass their contracts (src/ports/contracts/parts.ts): markups and feedback on Supabase (its
   real adapters, on a stand-in client over Postgres with Faro's migrations) and in this browser; identity, the clock,
   and files. (The demo's number source is the metric module's: src/modules/metrics/numbers.test.ts.) */
import { feedbackToRow } from '../data/rows';
import { localFeedback } from '../markup/feedback';
import { markupToRow } from '../markup/model';
import type { Feedback, Person } from '../domain/types';
import { clockContract, feedbackContract, filesContract, identityContract, markupContract, pickerContract } from '../ports/contracts/parts';
import { signInIdentity } from './signIn';
import { contractWorkspace } from '../ports/contracts/store';
import { fixedClock, memoryFiles, pickerIdentity, systemClock } from './local';
import { localGoals } from './localGoals';
import { goalsContract } from '../ports/contracts/goals';
import { asOf, type ConformanceWorkspace } from '../spec/conformance';
import conformanceJson from '../../spec/conformance/workspace.json';
import { prefsContract, searchContract } from '../ports/contracts/search';
import { memoryPrefs, seededSearch } from './contractPorts';
import { goalRows, scopeFacts } from '../app/reads';
import { currentWeek } from '../domain/plan';
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
identityContract('the “Who are you?” picker', () => { const kept = memory(); const identity = pickerIdentity('faro-me:', () => kept); return { identity, signIn: (ws, id) => identity.choose(ws, id) }; });
pickerContract('the “Who are you?” picker', () => pickerIdentity('faro-me:', () => storage));
// A sign-in by email, matched to the workspace's person records (adapters/signIn.ts), with a stand-in session.
identityContract('a sign-in, by email', () => {
  let email: string | null = null;
  const people = new Map<string, Person[]>();
  const identity = signInIdentity(async () => email, async (ws) => people.get(ws) ?? []);
  return {
    identity,
    signIn: (ws, id) => {
      email = 'Someone@Example.com';
      // The same person signed in may be a different record in each workspace.
      for (const [w, list] of people) people.set(w, list.filter((p) => p.id !== id));
      people.set(ws, [...(people.get(ws) ?? []).filter((p) => p.email !== 'someone@example.com'), { id, name: id, role: '', initials: '', teamId: null, admin: false, email: 'someone@example.com' } as Person]);
    },
  };
});
clockContract('the system clock', () => systemClock);
clockContract('a fixed clock', () => fixedClock(new Date('2026-11-11T09:00:00Z')));
filesContract('in memory', async () => memoryFiles());

searchContract('over the workspace in this browser', seededSearch);
// The query port over the conformance workspace as it was built for: the moment goals.csv, status.csv and flags.csv read.
const conf = conformanceJson as unknown as ConformanceWorkspace;
const builtFor = new Date(conf.builtFor);
goalsContract('over the workspace in this browser', async () => asOf(conf, builtFor), async (s, viewer) => {
  const rows = goalRows(s, conf.cycle, builtFor, currentWeek(conf.cycle, builtFor));
  const person = s.people.find((p) => p.id === viewer);
  return localGoals(() => rows, () => scopeFacts(s, { id: viewer, teamId: person?.teamId ?? null }));
});
prefsContract('in this browser', memoryPrefs);
