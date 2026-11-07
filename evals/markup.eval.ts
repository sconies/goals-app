/* Spec scenarios for markups and the builder inbox (Faro's plan, release 1), and for AI assistant tokens made only by
   the database. Run against the real schema (every migration) with stand-ins for Supabase Auth and Storage; the
   browser end is checked by journeys U41 (marking up and sending) and U42 (a builder triaging in the inbox). */
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { serve, type Deps } from '../server/mcp';
import { commitPayload, tokenFromRow, type TokenRow } from '../src/data/rows';
import { applyCommit } from '../src/data/store';
import { buildPlatformOrg } from '../src/data/platformOrg';
import type { Snapshot } from '../src/domain/types';
import { hashToken } from '../src/mcp/protocol';
import { WHATS_NEW } from '../src/help/whatsNew';
import { feedbackOps, tokenFeedback } from '../src/markup/feedback';
import { raisedIn, raisedText } from '../src/markup/model';

const M = (t: string) => `[MARKUP] ${t}`;
const I = (t: string) => `[MARKUP-INBOX] ${t}`;
const T = (t: string) => `[TOKENS-SERVER-ONLY] ${t}`;
const F = (t: string) => `[FEEDBACK-INBOX] ${t}`;
const dir = path.join(__dirname, '../supabase/migrations');
const sql = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const STANDINS = `
create role anon nologin; create role authenticated nologin;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
grant usage on schema storage to anon, authenticated; grant insert on storage.objects to anon; grant select on storage.objects to authenticated;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
`;

let db: PGlite;
const as = async <T,>(role: 'anon' | string, q: string, params: unknown[] = []) => {
  if (role === 'anon') await db.exec('set role anon');
  else await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email: role })}', false)`);
  try { return await db.query<T>(q, params); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`); }
};
const addMarkup = (row: Record<string, unknown>) => {
  const cols = Object.keys(row).map((k) => `"${k}"`).join(', ');
  return as('anon', `insert into okr_markups (${cols}) select ${cols} from jsonb_populate_record(null::okr_markups, $1::jsonb)`, [JSON.stringify(row)]);
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STANDINS);
  await db.exec(sql);
  await db.query(`insert into okr_workspaces (id, name, kind) values ('acme', 'Acme', 'own')`);
  await db.query(`insert into okr_people (id, name, role, initials, workspace_id, is_admin) values ('amara', 'Amara', '', 'A', 'acme', true), ('mateo', 'Mateo', '', 'M', 'acme', false)`);
}, 30_000);

describe('Marking up a screen', () => {
  it(M('the public key adds a markup, untriaged, under an id the database issued, and uploads its pictures to a private bucket; it can never read them back'), async () => {
    const id = (await as<{ id: string }>('anon', 'select okr_markup_new_id() as id')).rows[0]!.id;
    await addMarkup({ id, workspace_id: 'platform-org', demo: true, line: 'The strip should say the week', route: '/', parts: [[['Home', 'Week at a glance']]], strokes: [{ kind: 'box', x: 1, y: 1, w: 9, h: 9 }], pictures: ['screen.png', 'ink.png'] });
    for (const f of ['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg']) await as('anon', 'insert into storage.objects (bucket_id, name) values ($1, $2)', ['markups', `${id}/${f}`]);
    await expect(as('anon', 'insert into storage.objects (bucket_id, name) values ($1, $2)', ['markups', 'mk_0000000000000000/screen.png'])).rejects.toThrow();
    await expect(addMarkup({ id: 'mk_0000000000000000', workspace_id: 'acme', line: 'Made-up id' })).rejects.toThrow();
    await expect(addMarkup({ id: (await as<{ id: string }>('anon', 'select okr_markup_new_id() as id')).rows[0]!.id, workspace_id: 'acme', line: 'Already fixed', status: 'fixed' })).rejects.toThrow();
    await expect(as('anon', 'select * from okr_markups')).rejects.toThrow(/permission denied/);
    await expect(as('anon', 'select * from storage.objects')).rejects.toThrow(/permission denied/);
    expect((await db.query<{ public: boolean }>(`select public from storage.buckets where id = 'markups'`)).rows[0]!.public).toBe(false);
  });
});

describe('The builder inbox', () => {
  it(I('a builder signed in by email reads and triages markups and their pictures; anyone else signed in, or the public key, cannot'), async () => {
    expect((await as<{ id: string }>('lanehirschfield@gmail.com', 'select id from okr_markups')).rows.length).toBeGreaterThan(0);
    expect((await as<{ name: string }>('lanehirschfield@gmail.com', `select name from storage.objects where bucket_id = 'markups'`)).rows.length).toBeGreaterThan(0);
    await as('lanehirschfield@gmail.com', `update okr_markups set status = 'in-hand', status_by = 'Lane', status_at = now()`);
    expect((await db.query<{ s: string }>('select status as s from okr_markups')).rows.every((r) => r.s === 'in-hand')).toBe(true);
    expect((await as('admin@acme.example', 'select id from okr_markups')).rows).toEqual([]);
    expect((await as<{ b: boolean }>('admin@acme.example', 'select okr_is_builder() as b')).rows[0]!.b).toBe(false);
    expect((await as<{ b: boolean }>('lanehirschfield@gmail.com', 'select okr_is_builder() as b')).rows[0]!.b).toBe(true);
  });

  it(I('the MCP server’s markup tools need a builder token, which only a signed-in builder makes'), async () => {
    await expect(as('anon', `select okr_builder_token_create('acme', 'amara', 'Claude')`)).rejects.toThrow();
    const secret = (await as<{ s: string }>('lanehirschfield@gmail.com', `select okr_builder_token_create('acme', 'amara', 'Claude on Lane’s laptop') as s`)).rows[0]!.s;
    expect((await as<{ id: string }>('anon', 'select id from okr_markups_for_token($1)', [sha(secret)])).rows.length).toBeGreaterThan(0);
    await expect(as('anon', 'select * from okr_markups_for_token($1)', [sha('gk_not-a-builder')])).rejects.toThrow(/builder token/);
  });
});

describe('Feedback joins the builder inbox', () => {
  it(F('feedback a save sends arrives New whatever it claims; builders read every workspace’s with the sender’s and the workspace’s names, and nobody else can'), async () => {
    const fb = { id: 'fb_e1', workspace_id: 'acme', person_id: 'mateo', path: '/check-in', mood: 'bad', text: 'The reason box is too small', at: '2026-11-06T08:00:00.000Z', status: 'in-hand' };
    await as('anon', 'select okr_commit($1, $2)', ['acme', JSON.stringify({ ...commitPayload('acme', { changes: [] }), feedback: [fb] })]);
    const rows = (await as<{ id: string; status: string; person_name: string; workspace_name: string }>('lanehirschfield@gmail.com', 'select * from okr_feedback_inbox(100)')).rows;
    expect(rows.find((r) => r.id === 'fb_e1')).toMatchObject({ status: 'new', person_name: 'Mateo', workspace_name: 'Acme' });
    expect((await as('admin@acme.example', 'select * from okr_feedback_inbox(100)')).rows).toEqual([]);
    await expect(as('anon', 'select * from okr_feedback_inbox(100)')).rejects.toThrow(/permission denied/);
    await expect(as('anon', `insert into okr_feedback (id, workspace_id, person_id, mood, status) values ('fb_e2', 'acme', 'mateo', 'good', 'fixed')`)).rejects.toThrow(/permission denied/);
  });

  it(F('a builder triages feedback with the markups’ states, New, In hand, Fixed (in a What’s new entry) and Won’t fix (with a reason); nobody else can'), async () => {
    const triage = (who: string, patch: object) => as<{ status: string; fixed_in: string | null; wont_fix_reason: string | null }>(who, 'select * from okr_feedback_triage($1, $2)', ['fb_e1', JSON.stringify(patch)]);
    expect((await triage('lanehirschfield@gmail.com', { status: 'in-hand', status_by: 'Lane' })).rows[0]!.status).toBe('in-hand');
    await expect(triage('lanehirschfield@gmail.com', { status: 'fixed' })).rejects.toThrow();
    await expect(triage('lanehirschfield@gmail.com', { status: 'wont-fix' })).rejects.toThrow();
    expect((await triage('lanehirschfield@gmail.com', { status: 'wont-fix', wont_fix_reason: 'It grows as you type since release 1.' })).rows[0]).toMatchObject({ status: 'wont-fix', wont_fix_reason: 'It grows as you type since release 1.' });
    expect((await triage('lanehirschfield@gmail.com', { status: 'fixed', fixed_in: 'remove-and-undo', wont_fix_reason: null })).rows[0]).toMatchObject({ status: 'fixed', fixed_in: 'remove-and-undo' });
    await expect(triage('admin@acme.example', { status: 'new' })).rejects.toThrow(/Only builders/);
    await expect(as('anon', `select * from okr_feedback_triage('fb_e1', '{"status":"new"}')`)).rejects.toThrow(/permission denied/);
    expect((await db.query<{ status: string }>(`select status from okr_feedback where id = 'fb_e1'`)).rows[0]!.status).toBe('fixed');
  });
});

describe('AI assistant tokens are made only by the database', () => {
  it(T('the public key can’t read, add or change tokens, or read feedback; a save carrying a token writes nothing'), async () => {
    await expect(as('anon', 'select * from okr_api_tokens')).rejects.toThrow(/permission denied/);
    await expect(as('anon', `insert into okr_api_tokens (id, workspace_id, person_id, name, token_hash, created_by) values ('tok_x', 'acme', 'amara', 'x', 'h', 'amara')`)).rejects.toThrow(/permission denied/);
    await expect(as('anon', `update okr_api_tokens set revoked_at = null`)).rejects.toThrow(/permission denied/);
    await expect(as('anon', 'select * from okr_feedback')).rejects.toThrow(/permission denied/);
    await as('anon', 'select okr_commit($1, $2)', ['acme', JSON.stringify({ ...commitPayload('acme', { changes: [] }), tokens: [{ id: 'tok_sneak', workspace_id: 'acme', person_id: 'amara', name: 'Sneak', token_hash: 'h', created_by: 'amara' }] })]);
    expect((await db.query(`select 1 from okr_api_tokens where id = 'tok_sneak'`)).rows).toEqual([]);
  });

  it(T('an admin’s token is made in the database, which keeps only its hash, lists tokens without it, and the MCP server still finds it'), async () => {
    const secret = (await as<{ s: string }>('anon', 'select okr_token_create($1, $2) as s', ['acme', JSON.stringify({ id: 'tok_mateo1', person_id: 'mateo', name: 'Claude', created_by: 'amara' })])).rows[0]!.s;
    expect(secret).toMatch(/^gk_[A-Za-z0-9]{40}$/);
    expect((await db.query<{ h: string }>(`select token_hash as h from okr_api_tokens where id = 'tok_mateo1'`)).rows[0]!.h).toBe(sha(secret));
    expect(sha(secret)).toBe(await hashToken(secret));
    const listed = (await as<Record<string, unknown>>('anon', `select * from okr_token_list('acme')`)).rows;
    expect(listed.some((t) => t.id === 'tok_mateo1') && listed.every((t) => !('token_hash' in t))).toBe(true);
    await expect(as('anon', 'select okr_token_create($1, $2)', ['acme', JSON.stringify({ id: 'tok_mateo2', person_id: 'mateo', name: 'Mine', created_by: 'mateo' })])).rejects.toThrow(/Only admins/);
    // The MCP server, through okr_token_find, acting as Mateo.
    let data: Snapshot = buildPlatformOrg(new Date('2026-11-05T12:00:00Z'));
    const deps: Deps = {
      async findToken(hash) { const row = (await as<TokenRow & { builder: boolean }>('anon', 'select * from okr_token_find($1)', [hash])).rows[0]; return row ? { token: { ...tokenFromRow({ ...row, person_id: 'mateo' } as TokenRow) }, workspaceId: 'platform-org', builder: row.builder } : null; },
      workspaceName: async () => 'Platform Engineering', load: async () => data, commit: async (_w, c) => { data = applyCommit(data, c); }, touch: async () => undefined,
      now: () => new Date('2026-11-05T12:00:00Z'),
    };
    const res = await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_tokens', arguments: {} } }) }), deps);
    expect(res.status).toBe(200);
    expect((await res.json() as { result: { isError: boolean } }).result.isError).toBe(false);
    // Revoked, it's no longer found.
    await as('anon', 'select okr_token_revoke($1, $2, $3)', ['acme', 'tok_mateo1', 'amara']);
    expect((await as('anon', 'select * from okr_token_find($1)', [sha(secret)])).rows).toEqual([]);
  });
});

describe('The AI triages feedback, as it does markups (migration 0028)', () => {
  const MF = (t: string) => `[MCP-FEEDBACK] ${t}`;
  const R = (t: string) => `[FEEDBACK-RAISED] ${t}`;
  const send = (fb: object) => as('anon', 'select okr_commit($1, $2)', ['acme', JSON.stringify({ ...commitPayload('acme', { changes: [] }), feedback: [fb] })]);
  const builderSecret = async () => (await as<{ s: string }>('lanehirschfield@gmail.com', `select okr_builder_token_create('acme', 'amara', 'Claude, triaging feedback') as s`)).rows[0]!.s;
  /** The public key's client as the MCP server holds it: rpc calls the database's functions, as anon. */
  const client = { rpc: async (fn: string, args: Record<string, unknown>) => {
    const keys = Object.keys(args);
    try {
      const r = await as('anon', `select * from ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`, keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k])));
      return { data: r.rows, error: null };
    } catch (e) { return { data: null, error: { message: (e as Error).message } }; }
  } } as unknown as Parameters<typeof tokenFeedback>[0];

  it(MF('a builder token lists every workspace’s feedback with the sender’s and workspace’s names, by status or workspace, opens one, and triages it under the table’s rules'), async () => {
    await send({ id: 'fb_m1', workspace_id: 'acme', person_id: 'mateo', path: '/goals', mood: 'meh', text: 'The filters are hard to find', at: '2026-11-07T08:00:00.000Z' });
    const hash = sha(await builderSecret());
    const rows = (await as<{ id: string; status: string; person_name: string; workspace_name: string }>('anon', 'select * from okr_feedback_for_token($1)', [hash])).rows;
    expect(rows[0]).toMatchObject({ id: 'fb_m1', status: 'new', person_name: 'Mateo', workspace_name: 'Acme' });
    expect((await as<{ id: string }>('anon', `select id from okr_feedback_for_token($1, st => 'fixed')`, [hash])).rows.map((r) => r.id)).toEqual(['fb_e1']);
    expect((await as<{ id: string }>('anon', `select id from okr_feedback_for_token($1, fid => 'fb_m1')`, [hash])).rows.map((r) => r.id)).toEqual(['fb_m1']);
    expect((await as('anon', `select id from okr_feedback_for_token($1, ws => 'elsewhere')`, [hash])).rows).toEqual([]);
    const triage = (patch: object) => as<{ status: string }>('anon', 'select * from okr_feedback_triage_for_token($1, $2, $3)', [hash, 'fb_m1', JSON.stringify(patch)]);
    expect((await triage({ status: 'in-hand', status_by: 'Lane via AI assistant (MCP)' })).rows[0]!.status).toBe('in-hand');
    await expect(triage({ status: 'fixed' })).rejects.toThrow();
    await expect(triage({ status: 'wont-fix' })).rejects.toThrow();
    // The inbox's own triage still works, through the same change.
    expect((await as<{ status: string }>('lanehirschfield@gmail.com', 'select * from okr_feedback_triage($1, $2)', ['fb_m1', JSON.stringify({ status: 'new' })])).rows[0]!.status).toBe('new');
  });

  it(MF('an ordinary token, a made-up one or the public key on its own can’t read or change feedback'), async () => {
    const secret = (await as<{ s: string }>('anon', 'select okr_token_create($1, $2) as s', ['acme', JSON.stringify({ id: 'tok_mateo3', person_id: 'mateo', name: 'Claude', created_by: 'amara' })])).rows[0]!.s;
    for (const h of [sha(secret), sha('gk_made-up')]) {
      await expect(as('anon', 'select * from okr_feedback_for_token($1)', [h])).rejects.toThrow(/builder token/);
      await expect(as('anon', 'select * from okr_feedback_triage_for_token($1, $2, $3)', [h, 'fb_m1', '{"status":"in-hand"}'])).rejects.toThrow(/builder token/);
    }
    await expect(as('anon', `select * from okr_feedback_patch('fb_m1', '{"status":"in-hand"}')`)).rejects.toThrow(/permission denied/);
    await expect(as('admin@acme.example', `select * from okr_feedback_patch('fb_m1', '{"status":"in-hand"}')`)).rejects.toThrow(/permission denied/);
    expect((await db.query<{ status: string }>(`select status from okr_feedback where id = 'fb_m1'`)).rows[0]!.status).toBe('new');
  });

  it(MF('the MCP server’s list_feedback, get_feedback and update_feedback reach it with a builder token, on the public key, with the inbox’s rules'), async () => {
    const secret = await builderSecret();
    let data: Snapshot = buildPlatformOrg(new Date('2026-11-05T12:00:00Z'));
    const deps: Deps = {
      async findToken(hash) { const row = (await as<TokenRow & { builder: boolean }>('anon', 'select * from okr_token_find($1)', [hash])).rows[0]; return row ? { token: { ...tokenFromRow({ ...row, person_id: 'amara' } as TokenRow) }, workspaceId: 'platform-org', builder: row.builder } : null; },
      workspaceName: async () => 'Platform Engineering', load: async () => data, commit: async (_w, c) => { data = applyCommit(data, c); }, touch: async () => undefined,
      feedback: (hash) => feedbackOps({ store: tokenFeedback(client, hash), entries: WHATS_NEW.map((e) => e.id) }),
      now: () => new Date('2026-11-05T12:00:00Z'),
    };
    let n = 0;
    const call = async (name: string, args: object) => (await (await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }) }), deps)).json() as { result: { content: { text: string }[]; isError: boolean } }).result;
    expect((await call('list_feedback', { status: 'new' })).content[0]!.text).toContain('fb_m1 · New · It’s OK · “The filters are hard to find” · /goals · Mateo, Acme');
    expect((await call('get_feedback', { id: 'fb_m1' })).content[0]!.text).toContain('From Mateo in Acme');
    expect((await call('update_feedback', { id: 'fb_m1', status: 'fixed', fixed_in: 'no-such-entry' })).isError).toBe(true);
    expect((await call('update_feedback', { id: 'fb_m1', status: 'fixed', fixed_in: WHATS_NEW[0]!.id })).content[0]!.text).toBe(`fb_m1 is Fixed, fixed in ${WHATS_NEW[0]!.id}.`);
    expect((await db.query<{ status: string; fixed_in: string; status_by: string }>(`select status, fixed_in, status_by from okr_feedback where id = 'fb_m1'`)).rows[0]).toMatchObject({ status: 'fixed', fixed_in: WHATS_NEW[0]!.id, status_by: expect.stringMatching(/via AI assistant/) });
  });

  it(R('a sender sees “You raised this” on the entry that fixed their feedback: the database gives a person their own feedback’s statuses only, and What’s new matches by person and id'), async () => {
    const mine = (await as<{ id: string; status: string; fixed_in: string | null }>('anon', `select * from okr_feedback_raised('acme', 'mateo')`)).rows;
    expect(mine.find((r) => r.id === 'fb_m1')).toMatchObject({ status: 'fixed', fixed_in: WHATS_NEW[0]!.id });
    expect(Object.keys(mine[0]!).sort()).toEqual(['fixed_in', 'id', 'status']);
    expect((await as('anon', `select * from okr_feedback_raised('acme', 'amara')`)).rows).toEqual([]);
    const raised = mine.map((r) => ({ id: r.id, personId: 'mateo', fixedIn: r.fixed_in, kind: 'feedback' as const }));
    expect(raisedIn(WHATS_NEW[0]!, raised, 'mateo').map((r) => r.id)).toContain('fb_m1');
    expect(raisedText(raisedIn(WHATS_NEW[0]!, raised, 'mateo'))).toBe('Thank you: feedback you sent is fixed here.');
    expect(raisedIn(WHATS_NEW[0]!, raised, 'amara')).toEqual([]);
    // An entry naming the feedback in its fixes says it too, before anyone marks it.
    expect(raisedIn({ id: 'later', fixes: ['fb_m1'] }, [{ id: 'fb_m1', personId: 'mateo', kind: 'feedback' }], 'mateo')).toHaveLength(1);
  });
});

describe('Connect Claude (backlog -2, migration 0029)', () => {
  const C = (t: string) => `[CONNECT-CLAUDE] ${t}`;
  const P = (t: string) => `[MCP-PICTURES] ${t}`;
  /** The first builder, as migration 0024 lists them. */
  const LANE = /insert into okr_builders \(email\) values \('([^']+)'\)/.exec(sql)![1]!;
  const make = async (who: string, name: string) => (await as<{ s: string }>(who, `select okr_builder_token_create('acme', 'amara', $1) as s`, [name])).rows[0]!.s;

  it(C('a signed-in builder lists their own live builder tokens, with the workspace’s and person’s names and never a hash, and revokes one; nobody else can'), async () => {
    await db.query(`insert into okr_builders (email) values ('other@builder.example') on conflict do nothing`);
    const mine = await make(LANE, 'Claude, reviewing markups');
    await make('other@builder.example', 'Someone else’s Claude');
    const listed = (await as<Record<string, unknown>>(LANE, 'select * from okr_builder_tokens()')).rows;
    const row = listed.find((t) => t.name === 'Claude, reviewing markups')!;
    expect(row).toMatchObject({ workspace_name: 'Acme', person_name: 'Amara', last_used_at: null });
    expect(listed.every((t) => !('token_hash' in t) && t.name !== 'Someone else’s Claude')).toBe(true);
    await expect(as('admin@acme.example', 'select * from okr_builder_tokens()')).rejects.toThrow(/Only builders/);
    await expect(as('anon', 'select * from okr_builder_tokens()')).rejects.toThrow(/permission denied/);
    await expect(as('anon', `select okr_builder_token_revoke($1)`, [row.id])).rejects.toThrow(/permission denied/);
    // Someone else's token isn't theirs to revoke.
    const theirs = (await as<{ id: string }>('other@builder.example', 'select id from okr_builder_tokens()')).rows[0]!.id;
    expect((await as<{ r: boolean }>(LANE, 'select okr_builder_token_revoke($1) as r', [theirs])).rows[0]!.r).toBe(false);
    expect((await as<{ r: boolean }>(LANE, 'select okr_builder_token_revoke($1) as r', [row.id])).rows[0]!.r).toBe(true);
    expect((await as('anon', 'select * from okr_token_find($1)', [sha(mine)])).rows).toEqual([]);
    expect((await as<{ id: string }>(LANE, 'select id from okr_builder_tokens()')).rows.map((r) => r.id)).not.toContain(row.id);
  });

  it(P('with the service role key, get_markup and review_inbox send a builder token the markup’s picture as image content; without it, they say what to add where'), async () => {
    const { markupOps } = await import('../src/markup/ops');
    const { tokenMarkups } = await import('../src/markup/stores');
    const secret = await make(LANE, 'Claude, pictures');
    const id = (await as<{ id: string }>('anon', 'select okr_markup_new_id() as id')).rows[0]!.id;
    await addMarkup({ id, workspace_id: 'platform-org', demo: true, line: 'The week strip needs the week', route: '/', parts: [[['Home', 'Week at a glance']]], strokes: [], pictures: ['screen.png', 'marked.jpg'], context: { viewport: { w: 390, h: 844, dpr: 3 }, theme: 'light', themeChoice: 'light', accent: 'faro', appVersion: 'x', sessionId: 's', host: 'goals-app-git-journeys-x.vercel.app' } });
    const client = { rpc: async (fn: string, args: Record<string, unknown>) => {
      const keys = Object.keys(args);
      try { return { data: (await as('anon', `select * from ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`, keys.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k])))).rows, error: null }; } catch (e) { return { data: null, error: { message: (e as Error).message } }; }
    } } as unknown as Parameters<typeof tokenMarkups>[0];
    // Storage, as the service role key reads it.
    const signer = { storage: { from: () => ({ download: async (path: string) => ({ data: new Blob([`bytes of ${path}`]), error: null }), createSignedUrl: async () => ({ data: null, error: { message: 'no' } }) }) } } as unknown as Parameters<typeof tokenMarkups>[0];
    let data: Snapshot = buildPlatformOrg(new Date('2026-11-05T12:00:00Z'));
    const deps = (withKey: boolean): Deps => ({
      async findToken(hash) { const r = (await as<TokenRow & { builder: boolean }>('anon', 'select * from okr_token_find($1)', [hash])).rows[0]; return r ? { token: { ...tokenFromRow({ ...r, person_id: 'amara' } as TokenRow) }, workspaceId: 'platform-org', builder: r.builder } : null; },
      workspaceName: async () => 'Platform Engineering', load: async () => data, commit: async (_w, c) => { data = applyCommit(data, c); }, touch: async () => undefined,
      markups: (hash) => markupOps({ store: tokenMarkups(client, hash, withKey ? signer : null), entries: WHATS_NEW.map((e) => e.id), repo: 'sconies/goals-app' }),
      now: () => new Date('2026-11-05T12:00:00Z'),
    });
    type Out = { result: { content: { type: string; text?: string; data?: string; mimeType?: string }[]; isError: boolean } };
    const call = async (withKey: boolean, name: string, args: object) => (await (await serve(new Request('https://x/api/mcp', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }), deps(withKey))).json() as Out).result;
    const got = await call(true, 'get_markup', { id });
    const img = got.content.find((c) => c.type === 'image')!;
    expect(img.mimeType).toBe('image/jpeg');
    expect(Buffer.from(img.data!, 'base64').toString()).toBe(`bytes of ${id}/marked.jpg`);
    expect(got.content[0]!.text).toContain('the demo on a preview build (goals-app-git-journeys-x.vercel.app)');
    const review = await call(true, 'review_inbox', {});
    expect(review.content[0]!.text).toContain('## Home › Week at a glance');
    expect(review.content.filter((c) => c.type === 'image').length).toBeGreaterThan(0);
    const nokey = await call(false, 'get_markup', { id });
    expect(nokey.content.some((c) => c.type === 'image')).toBe(false);
    expect(nokey.content[0]!.text).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
