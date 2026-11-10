// @vitest-environment node
/* Migrations 0024 to 0031, run against the real schema with stand-ins for Supabase Auth and Storage: the public key
   can add a markup and upload its pictures under an id the database issued, never replacing or deleting them; since the
   open inbox (0031) anyone reads every markup and piece of feedback, opens the pictures (a public-read bucket nobody
   can list) and changes a status, through the triage columns only; the public key can't read, add or change AI
   assistant tokens (they're made and revoked by functions that keep only the hash) or read the feedback table; the MCP
   server's token lookup still works, and its inbox functions take any live token. */
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commitPayload } from './rows';

const dir = join(__dirname, '../../supabase/migrations');
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');

/** The parts of Supabase Storage the policy uses: buckets, objects with row security, and the two path helpers. */
const STORAGE = `
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, unique (bucket_id, name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
grant usage on schema storage to anon, authenticated;
grant insert on storage.objects to anon;
grant select, insert on storage.objects to authenticated;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
`;

describe('markups, tokens and feedback (0024)', () => {
  let db: PGlite;
  const asAnon = async <T,>(q: string, params: unknown[] = []) => {
    await db.exec('set role anon');
    try { return await db.query<T>(q, params); } finally { await db.exec('reset role'); }
  };
  /** As Supabase Auth's signed-in role, with this email in the token. */
  const asUser = async <T,>(email: string, q: string, params: unknown[] = []) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false)`);
    try { return await db.query<T>(q, params); } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`); }
  };
  const LANE = 'LaneHirschfield@gmail.com';
  const one = async <T,>(q: string, params: unknown[] = [], anon = true) => (anon ? await asAnon<T>(q, params) : await db.query<T>(q, params)).rows[0]!;
  const newId = async () => (await one<{ id: string }>('select okr_markup_new_id() as id')).id;
  const markup = (id: string, o: Record<string, unknown> = {}) => ({ id, workspace_id: 'ws_m', workspace_name: 'Markups', person_id: 'ann', person_name: 'Ann', line: 'The scorecard wraps badly', mood: 'meh', route: '/goals/:goalId', parts: [['Goal page', 'Scorecard']], strokes: [{ kind: 'box', x: 1, y: 2, w: 30, h: 40 }], pictures: ['screen.png', 'ink.png'], ...o });
  /** Adds a markup as the REST API would: only the columns it carries, so the rest take their defaults. */
  const addMarkup = (row: object) => {
    const cols = Object.keys(row).map((k) => `"${k}"`).join(', ');
    return asAnon(`insert into okr_markups (${cols}) select ${cols} from jsonb_populate_record(null::okr_markups, $1::jsonb)`, [JSON.stringify(row)]);
  };
  const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

  beforeAll(async () => {
    db = new PGlite();
    await db.exec('create role anon nologin; create role authenticated nologin;');
    await db.exec(STORAGE);
    await db.exec(sql);
    await db.query(`insert into okr_workspaces (id, name, kind) values ('ws_m', 'Markups', 'own'), ('ws_o', 'Other', 'own')`);
    await db.query(`insert into okr_people (id, name, role, initials, workspace_id, is_admin) values ('ann', 'Ann Admin', '', 'AA', 'ws_m', true), ('bo', 'Bo', '', 'B', 'ws_m', false), ('lane', 'Lane Hirschfield', '', 'LH', 'ws_o', false)`);
  }, 30_000);

  it('lets the public key add a markup under an issued id and read it (0031), never rewrite or delete one', async () => {
    const id = await newId();
    expect(id).toMatch(/^mk_[0-9a-f]{16}$/);
    await addMarkup(markup(id));
    expect((await asAnon<{ id: string }>('select id from okr_markups')).rows.map((r) => r.id)).toContain(id);
    await expect(asAnon(`update okr_markups set line = 'rewritten'`)).rejects.toThrow(/permission denied/);
    await expect(asAnon('delete from okr_markups')).rejects.toThrow(/permission denied/);
    await expect(asAnon('select * from okr_markup_ids')).rejects.toThrow(/permission denied/);
    expect((await one<{ n: number }>('select count(*)::int as n from okr_markups', [], false)).n).toBe(1);
  });

  it('refuses a markup under an id the database didn’t issue, an id used twice, or one that arrives already triaged', async () => {
    await expect(addMarkup(markup('mk_0123456789abcdef'))).rejects.toThrow();
    const id = await newId();
    await addMarkup(markup(id));
    await expect(addMarkup(markup(id))).rejects.toThrow();
    const id2 = await newId();
    await expect(addMarkup(markup(id2, { status: 'fixed' }))).rejects.toThrow();
    await expect(addMarkup(markup(id2, { issue_url: 'https://github.com/sconies/goals-app/issues/1' }))).rejects.toThrow();
    await expect(addMarkup(markup(id2, { line: '   ' }))).rejects.toThrow();
  });

  it('keeps a markup from the demo, marked demo, whose workspace is only in the visitor’s browser', async () => {
    const id = await newId();
    await expect(addMarkup(markup(id, { workspace_id: 'platform-org' }))).rejects.toThrow();
    await addMarkup(markup(id, { workspace_id: 'platform-org', demo: true }));
    expect((await one<{ demo: boolean }>('select demo from okr_markups where id = $1', [id], false)).demo).toBe(true);
  });

  it('tells a person which of their own markups were fixed, and nothing more', async () => {
    const id = await newId();
    await addMarkup(markup(id));
    await db.query(`update okr_markups set status = 'fixed', fixed_in = 'markup-inbox' where id = $1`, [id]);
    const rows = (await asAnon<{ id: string; status: string; fixed_in: string | null }>(`select * from okr_markups_raised('ws_m', 'ann')`)).rows;
    expect(rows.find((r) => r.id === id)).toEqual({ id, status: 'fixed', fixed_in: 'markup-inbox' });
    expect(Object.keys(rows[0]!).sort()).toEqual(['fixed_in', 'id', 'status']);
    expect((await asAnon(`select * from okr_markups_raised('ws_m', 'bo')`)).rows).toEqual([]);
  });

  it('makes a public-read bucket (0031) the public key can only upload a markup’s four pictures into, in a folder named like a markup id (0037)', async () => {
    expect((await one<{ public: boolean }>(`select public from storage.buckets where id = 'markups'`, [], false)).public).toBe(true);
    const id = await newId();
    const up = (name: string, bucket = 'markups') => asAnon('insert into storage.objects (bucket_id, name) values ($1, $2)', [bucket, name]);
    await up(`${id}/screen.png`);
    await up(`${id}/ink.png`);
    await expect(up('mk_0123/screen.png')).rejects.toThrow();
    await expect(up('not-a-markup/screen.png')).rejects.toThrow();
    // Storage's rules call nothing in faro (0037), so the Faro role can't change what they let through.
    expect((await db.query(`select pol.polname from pg_policy pol join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = pol.oid
      join pg_proc f on d.refclassid = 'pg_proc'::regclass and f.oid = d.refobjid where f.pronamespace = 'faro'::regnamespace and pol.polrelid = 'storage.objects'::regclass`)).rows).toEqual([]);
    await expect(up(`${id}/other.png`)).rejects.toThrow();
    await expect(up(`${id}/deeper/screen.png`)).rejects.toThrow();
    await expect(asAnon('select * from storage.objects')).rejects.toThrow(/permission denied/);
    await expect(asAnon('delete from storage.objects')).rejects.toThrow(/permission denied/);
  });

  it('never lets the public key read, add or change AI assistant tokens', async () => {
    await db.query(`insert into okr_api_tokens (id, workspace_id, person_id, name, token_hash, created_by) values ('tok_seed', 'ws_m', 'bo', 'Seed', $1, 'ann')`, [sha('gk_seed')]);
    await expect(asAnon('select * from okr_api_tokens')).rejects.toThrow(/permission denied/);
    await expect(asAnon(`insert into okr_api_tokens (id, workspace_id, person_id, name, token_hash, created_by) values ('tok_x', 'ws_m', 'bo', 'Mine', 'abc', 'ann')`)).rejects.toThrow(/permission denied/);
    await expect(asAnon(`update okr_api_tokens set revoked_at = null`)).rejects.toThrow(/permission denied/);
    // …nor through a save: okr_commit carries no tokens any more.
    await asAnon('select okr_commit($1, $2)', ['ws_m', JSON.stringify({ ...commitPayload('ws_m', { changes: [] }), tokens: [{ id: 'tok_sneak', workspace_id: 'ws_m', person_id: 'ann', name: 'Sneak', token_hash: 'x', created_by: 'ann' }] })]);
    expect((await one<{ n: number }>(`select count(*)::int as n from okr_api_tokens where id = 'tok_sneak'`, [], false)).n).toBe(0);
  });

  it('makes a token in the database, keeps only its hash, returns it once, lists it without the hash, and revokes it', async () => {
    const change = { id: 'chg_tok1', workspace_id: 'ws_m', at: new Date().toISOString(), actor_id: 'ann', goal_id: null, entity: 'person', entity_id: 'bo', action: 'created', summary: 'Gave Bo an AI assistant token', diffs: [] };
    const secret = (await one<{ s: string }>('select okr_token_create($1, $2, $3) as s', ['ws_m', JSON.stringify({ id: 'tok_bob1', person_id: 'bo', name: 'Claude on my laptop', created_by: 'ann' }), JSON.stringify(change)])).s;
    expect(secret).toMatch(/^gk_[A-Za-z0-9]{40}$/);
    const stored = await one<{ token_hash: string }>(`select token_hash from okr_api_tokens where id = 'tok_bob1'`, [], false);
    expect(stored.token_hash).toBe(sha(secret));
    expect((await one<{ n: number }>(`select count(*)::int as n from okr_changes where id = 'chg_tok1'`, [], false)).n).toBe(1);
    const listed = (await asAnon<Record<string, unknown>>(`select * from okr_token_list('ws_m')`)).rows;
    expect(listed.map((t) => t.id)).toContain('tok_bob1');
    expect(listed.every((t) => !('token_hash' in t))).toBe(true);
    // Only an admin makes one, for someone in the workspace.
    await expect(asAnon('select okr_token_create($1, $2)', ['ws_m', JSON.stringify({ id: 'tok_bob2', person_id: 'bo', name: 'Mine', created_by: 'bo' })])).rejects.toThrow(/Only admins/);
    await expect(asAnon('select okr_token_create($1, $2)', ['ws_m', JSON.stringify({ id: 'tok_bob3', person_id: 'lane', name: 'Elsewhere', created_by: 'ann' })])).rejects.toThrow(/no one/);
    // The MCP server finds it by its hash, and notes it was used.
    const found = (await asAnon<Record<string, unknown>>('select * from okr_token_find($1)', [sha(secret)])).rows;
    expect(found.map((t) => t.person_id)).toEqual(['bo']);
    expect(found[0]).not.toHaveProperty('token_hash');
    await asAnon('select okr_token_touch($1)', [sha(secret)]);
    expect((await one<{ used: boolean }>(`select last_used_at is not null as used from okr_api_tokens where id = 'tok_bob1'`, [], false)).used).toBe(true);
    // The token's own person (or an admin) revokes it; a revoked token isn't found.
    await expect(asAnon('select okr_token_revoke($1, $2, $3)', ['ws_m', 'tok_seed', 'lane'])).rejects.toThrow(/Only an admin/);
    expect((await one<{ r: boolean }>('select okr_token_revoke($1, $2, $3) as r', ['ws_m', 'tok_bob1', 'bo'])).r).toBe(true);
    expect((await one<{ r: boolean }>('select okr_token_revoke($1, $2, $3) as r', ['ws_m', 'tok_bob1', 'bo'])).r).toBe(false);
    expect((await asAnon('select * from okr_token_find($1)', [sha(secret)])).rows).toEqual([]);
  });

  it('lets the public key send feedback but not read the table; a workspace’s feedback is read by its function', async () => {
    const fb = { id: 'fb1', workspace_id: 'ws_m', person_id: 'bo', path: '/', mood: 'good', text: 'Nice', at: new Date().toISOString() };
    await asAnon('select okr_commit($1, $2)', ['ws_m', JSON.stringify({ ...commitPayload('ws_m', { changes: [] }), feedback: [fb] })]);
    await expect(asAnon('select * from okr_feedback')).rejects.toThrow(/permission denied/);
    const rows = (await asAnon<{ id: string }>(`select * from okr_feedback_list('ws_m')`)).rows;
    expect(rows.map((r) => r.id)).toEqual(['fb1']);
    expect((await asAnon(`select * from okr_feedback_list('ws_o')`)).rows).toEqual([]);
  });

  it('puts feedback in the inbox: new when sent, read and triaged by anyone (0031), from every workspace', async () => {
    const at = '2026-11-06T09:00:00.000Z';
    // Sent through a save, even claiming a status: it arrives new.
    const fb = { id: 'fb_in1', workspace_id: 'ws_o', person_id: 'lane', path: '/goals', mood: 'bad', text: 'The filters are hard to find', at, status: 'fixed', fixed_in: 'remove-and-undo' };
    await asAnon('select okr_commit($1, $2)', ['ws_o', JSON.stringify({ ...commitPayload('ws_o', { changes: [] }), feedback: [fb] })]);
    expect(await one('select status, fixed_in from okr_feedback where id = $1', ['fb_in1'], false)).toEqual({ status: 'new', fixed_in: null });
    // Straight into the table, the public key can add feedback's own columns, never a status.
    await asAnon(`insert into okr_feedback (id, workspace_id, person_id, path, mood, text) values ('fb_in2', 'ws_o', 'lane', '/', 'good', 'Calm')`);
    await expect(asAnon(`insert into okr_feedback (id, workspace_id, person_id, mood, status) values ('fb_in3', 'ws_o', 'lane', 'good', 'in-hand')`)).rejects.toThrow(/permission denied/);
    // Anyone reads every workspace's, newest first, with the workspace's and the sender's names.
    const listed = (await asAnon<{ id: string; workspace_name: string; person_name: string; status: string }>('select * from okr_feedback_inbox(50)')).rows;
    expect(listed.map((r) => r.id)).toEqual(expect.arrayContaining(['fb_in1', 'fb1']));
    expect(listed.find((r) => r.id === 'fb_in1')).toMatchObject({ workspace_name: 'Other', person_name: 'Lane Hirschfield', status: 'new' });
    // …and triages it: in hand, then fixed in a What's new entry. Fixed needs the entry; won't fix needs a reason.
    const triage = (patch: object) => asAnon<{ status: string; fixed_in: string | null; status_by: string | null }>('select * from okr_feedback_triage($1, $2)', ['fb_in1', JSON.stringify(patch)]);
    expect((await triage({ status: 'in-hand', status_by: 'Bo', status_at: at })).rows[0]).toMatchObject({ status: 'in-hand', status_by: 'Bo' });
    await expect(triage({ status: 'fixed', fixed_in: null })).rejects.toThrow(/okr_feedback_status_check/);
    await expect(triage({ status: 'wont-fix', wont_fix_reason: null })).rejects.toThrow(/okr_feedback_status_check/);
    await expect(triage({ status: 'done' })).rejects.toThrow(/okr_feedback_status_check/);
    expect((await triage({ status: 'fixed', fixed_in: 'remove-and-undo' })).rows[0]).toMatchObject({ status: 'fixed', fixed_in: 'remove-and-undo' });
    // Only through the function: the table itself stays closed to the public key.
    await expect(asAnon(`update okr_feedback set status = 'new'`)).rejects.toThrow(/permission denied/);
    expect((await one<{ status: string }>('select status from okr_feedback where id = $1', ['fb_in1'], false)).status).toBe('fixed');
    // A workspace's own list of feedback still works for it.
    expect((await asAnon<{ id: string }>(`select * from okr_feedback_list('ws_o')`)).rows.map((r) => r.id).sort()).toEqual(['fb_in1', 'fb_in2']);
  });

  it('lets anyone read and triage markups (0031): only the triage columns, under the table’s checks', async () => {
    const id = await newId();
    await addMarkup(markup(id, { workspace_id: 'platform-org', demo: true }));
    await asAnon('insert into storage.objects (bucket_id, name) values ($1, $2)', ['markups', `${id}/screen.png`]);
    expect((await asAnon<{ id: string }>('select id from okr_markups')).rows.map((r) => r.id)).toContain(id);
    await asAnon(`update okr_markups set status = 'in-hand', status_by = 'Bo', status_at = now() where id = $1`, [id]);
    expect((await one<{ status: string; status_by: string }>('select status, status_by from okr_markups where id = $1', [id], false))).toEqual({ status: 'in-hand', status_by: 'Bo' });
    await expect(asAnon(`update okr_markups set status = 'done' where id = $1`, [id])).rejects.toThrow();
    await expect(asAnon(`update okr_markups set person_name = 'Someone else' where id = $1`, [id])).rejects.toThrow(/permission denied/);
    await expect(asAnon(`delete from okr_markups where id = $1`, [id])).rejects.toThrow(/permission denied/);
    // The pictures are opened by their address (a public-read bucket); nobody lists them.
    await expect(asAnon(`select name from storage.objects where bucket_id = 'markups'`)).rejects.toThrow(/permission denied/);
    await expect(asAnon('select * from okr_builders')).rejects.toThrow(/permission denied/);
  });

  it('gives the MCP server’s inbox functions to any live token (0031), and refuses a revoked or unknown one', async () => {
    const listed = (await asAnon<{ id: string }>('select id from okr_markups_for_token($1)', [sha('gk_seed')])).rows;
    expect(listed.length).toBeGreaterThan(0);
    const id = listed[0]!.id;
    const changed = (await asAnon<{ status: string; fixed_in: string }>(`select status, fixed_in from okr_markup_triage_for_token($1, $2, $3)`, [sha('gk_seed'), id, JSON.stringify({ status: 'fixed', fixed_in: 'markup-inbox' })])).rows[0]!;
    expect(changed).toEqual({ status: 'fixed', fixed_in: 'markup-inbox' });
    expect((await asAnon<{ id: string }>('select id from okr_feedback_for_token($1)', [sha('gk_seed')])).rows.length).toBeGreaterThan(0);
    // A builder token made before 0031 still works, as an ordinary one.
    const secret = (await asUser<{ s: string }>(LANE, `select okr_builder_token_create('ws_m', 'ann', 'Claude on Lane’s laptop') as s`)).rows[0]!.s;
    expect((await asAnon<{ id: string }>('select id from okr_markups_for_token($1)', [sha(secret)])).rows.length).toBeGreaterThan(0);
    // An unknown token, or a revoked one, gets nothing.
    await expect(asAnon('select * from okr_markups_for_token($1)', [sha('gk_nobody')])).rejects.toThrow(/isn’t valid/);
    await db.query(`insert into okr_api_tokens (id, workspace_id, person_id, name, token_hash, created_by, revoked_at) values ('tok_old', 'ws_m', 'bo', 'Old', $1, 'ann', now())`, [sha('gk_old')]);
    await expect(asAnon('select * from okr_feedback_triage_for_token($1, $2, $3)', [sha('gk_old'), 'fb_in1', '{"status":"new"}'])).rejects.toThrow(/isn’t valid/);
    await expect(asAnon('select okr_token_live($1)', [sha('gk_seed')])).rejects.toThrow(/permission denied/);
  });
});
