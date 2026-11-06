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
