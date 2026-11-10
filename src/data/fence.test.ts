// @vitest-environment node
/* Faro fenced off inside a shared database (backlog 0c, migration 0035, supabase/manual/faro-role.sql): its tables and
   functions move to their own schema, faro, with redirects for the old names; the Faro role owns that schema and can't
   read or write anything else; and the other app's tables are never touched. "chores" stands in for the other app. */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error: a plain JavaScript script, run by CI with node, has no type declarations.
import { fenceReport } from '../../scripts/check-fence.mjs';
// @ts-expect-error: a plain JavaScript script, run with node, has no type declarations.
import { exportFaro, resetFaro } from '../../scripts/faro-data.mjs';

const root = join(__dirname, '../..');
const dir = join(root, 'supabase/migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const read = (f: string) => readFileSync(join(dir, f), 'utf8');
const FENCE = '0035_faro_schema.sql';
const roleSql = readFileSync(join(root, 'supabase/manual/faro-role.sql'), 'utf8');
const withPassword = roleSql.replace('REPLACE-WITH-A-LONG-RANDOM-PASSWORD', 'a-test-password');

describe('Faro fenced off in a shared database', () => {
  let db: PGlite;
  const rows = async <T,>(q: string) => (await db.query<T>(q)).rows;
  const as = async <T,>(role: string, q: string) => {
    await db.exec(`set role ${role}`);
    try { return (await db.query<T>(q)).rows; } finally { await db.exec('reset role'); }
  };
  const report = (role?: string) => fenceReport(async (q: string) => (role ? as(role, q) : rows(q)));
  const family = () => rows<{ id: number; who: string }>('select id, who from public.chores order by id');
  const familyShape = () => rows(`select a.attname, a.atttypid::regtype::text as t, c.relacl::text as acl, c.relowner::regrole::text as owner
    from pg_attribute a join pg_class c on c.oid = a.attrelid where c.oid = 'public.chores'::regclass and a.attnum > 0 order by a.attnum`);
  let before: unknown;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(readFileSync(join(root, 'src/adapters/postgres/bootstrap.sql'), 'utf8'));
    // The other app: its own table in public, open to the public key's roles as Supabase makes them.
    await db.exec(`create table public.chores (id int primary key, who text not null);
      insert into public.chores values (1, 'a real family row'), (2, 'another');
      grant select, insert, update, delete on public.chores to anon, authenticated;`);
    for (const f of files.filter((x) => x < FENCE)) await db.exec(read(f));
    before = { rows: await family(), shape: await familyShape() };
    for (const f of files.filter((x) => x >= FENCE)) await db.exec(read(f));
    await db.exec('reset search_path');
  }, 60_000);

  it('moves every Faro table and function into faro, and leaves only marked redirects in public', async () => {
    const left = await rows<{ relname: string; relkind: string; note: string | null }>(`select relname, relkind, obj_description(oid, 'pg_class') as note
      from pg_class where relnamespace = 'public'::regnamespace and relname like 'okr\\_%' and relkind in ('r', 'v', 'm', 'S')`);
    expect(left.length).toBeGreaterThan(20);
    expect(left.filter((r) => r.relkind !== 'v' || r.note !== 'faro: redirect')).toEqual([]);
    const tables = await rows<{ relname: string }>(`select relname from pg_class where relnamespace = 'faro'::regnamespace and relkind = 'r'`);
    expect(tables.map((t) => t.relname)).toEqual(expect.arrayContaining(['okr_goals', 'okr_check_ins', 'okr_workspaces', 'okr_markups', 'okr_telemetry_spans']));
    const fns = await rows<{ proname: string; note: string | null }>(`select proname, obj_description(oid, 'pg_proc') as note from pg_proc where pronamespace = 'public'::regnamespace and proname like 'okr\\_%'`);
    expect(fns.filter((f) => f.note !== 'faro: redirect')).toEqual([]);
    const loose = await rows(`select proname from pg_proc where pronamespace = 'faro'::regnamespace and not ('search_path=faro, pg_temp' = any(coalesce(proconfig, '{}')))`);
    expect(loose).toEqual([]);
  });

  it('never touches the other app’s table: same rows, columns, owner and grants', async () => {
    expect({ rows: await family(), shape: await familyShape() }).toEqual(before);
  });

  it('runs twice without changing anything', async () => {
    const snapshot = () => rows(`select n.nspname, c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relname like 'okr\\_%' or c.relname = 'chores' order by 1, 2`);
    const fns = () => rows(`select pronamespace::regnamespace::text as s, proname, pg_get_function_identity_arguments(oid) as a from pg_proc where proname like 'okr\\_%' order by 1, 2, 3`);
    const [a, b] = [await snapshot(), await fns()];
    await db.exec(read(FENCE));
    await db.exec('reset search_path');
    expect(await snapshot()).toEqual(a);
    expect(await fns()).toEqual(b);
  });

  it('keeps the old names working for the public key, with the same rights and row rules as before', async () => {
    const id = (await as<{ id: string }>('anon', 'select public.okr_markup_new_id() as id'))[0]!.id;
    expect(id).toMatch(/\w/);
    expect((await as<{ id: string }>('anon', 'select faro.okr_markup_new_id() as id'))[0]!.id).not.toBe(id);
    await as('anon', `insert into public.okr_research_notes (id, session_id, kind, text) values ('n-redirect', 's1', 'comment', 'through the old name')`);
    expect(await rows(`select text from faro.okr_research_notes where id = 'n-redirect'`)).toEqual([{ text: 'through the old name' }]);
    // The public key still can't read research notes or tokens, by either name.
    await expect(as('anon', 'select * from public.okr_research_notes')).rejects.toThrow(/permission denied/);
    await expect(as('anon', 'select * from faro.okr_api_tokens')).rejects.toThrow(/permission denied/);
  });

  it('won’t make the role with the placeholder password, or before 0035, 0036 and 0037', async () => {
    await expect(db.exec(roleSql)).rejects.toThrow(/password/);
    const early = new PGlite();
    await expect(early.exec(withPassword)).rejects.toThrow(/0035/);
    // Nor before 0036, while a Faro function still reads outside faro.
    await db.exec(`create function faro.okr_old_builder() returns jsonb language sql as 'select auth.jwt()'`);
    await expect(db.exec(withPassword)).rejects.toThrow(/0036/);
    await db.exec('drop function faro.okr_old_builder()');
    // Nor before 0037, while a rule outside faro calls a Faro function.
    await db.exec(`create policy "old upload" on storage.objects for insert to anon with check (faro.okr_markup_id_ok(name))`);
    await expect(db.exec(withPassword)).rejects.toThrow(/0037/);
    await db.exec(`drop policy "old upload" on storage.objects`);
  });

  it('gives the Faro role faro and nothing else, however often the script is run', async () => {
    await db.exec(withPassword);
    await db.exec(withPassword);
    const owners = await rows<{ owner: string; n: number }>(`select relowner::regrole::text as owner, count(*)::int as n from pg_class where relnamespace = 'faro'::regnamespace group by 1`);
    expect(owners.map((o) => o.owner)).toEqual(['faro_owner']);
    // It can change Faro: read, write, and make new tables in faro (later migrations).
    expect(await as('faro_owner', 'select count(*)::int as n from faro.okr_goals')).toEqual([{ n: 0 }]);
    await as('faro_owner', 'create table faro.okr_probe (id text primary key)');
    await as('faro_owner', 'drop table faro.okr_probe');
    // It can't read, write or empty the other app's table, or make anything outside faro.
    for (const q of ['select * from public.chores', `insert into public.chores values (3, 'x')`, `update public.chores set who = 'x'`, 'delete from public.chores', 'truncate public.chores', 'create table public.sneaky (i int)']) {
      await expect(as('faro_owner', q), q).rejects.toThrow(/permission denied/);
    }
    expect(await family()).toEqual((before as { rows: unknown }).rows);
  });

  it('checks the fence the way CI does: fenced as the Faro role, a warning as anyone else, a failure if it leaks', async () => {
    expect(await report('faro_owner')).toMatchObject({ state: 'fenced', role: 'faro_owner', outside: 0, problems: [] });
    expect(await report()).toMatchObject({ state: 'not-fenced', problems: [] });
    await db.exec('grant select on public.chores to faro_owner');
    const leak = await report('faro_owner');
    expect(leak.state).toBe('leaks');
    expect(leak.problems).toEqual(['faro_owner may read or write 1 table outside the faro schema.']);
    // It reports counts, never the other app's table names.
    expect(JSON.stringify(leak)).not.toMatch(/chores/);
    await db.exec('revoke select on public.chores from faro_owner');
    expect((await report('faro_owner')).state).toBe('fenced');
  });

  it('exports every Faro table, and resets the shared app in one step as the Faro role, keeping the inbox', async () => {
    await db.exec(`insert into faro.okr_workspaces (id, name, kind) values ('ws-a', 'A', 'own'), ('ws-b', 'B', 'own');
      insert into faro.okr_teams (id, workspace_id, name, objective) values ('t1', 'ws-a', 'Team', ''), ('t2', 'ws-b', 'Team', '');
      insert into faro.okr_markup_ids (id) values ('m-kept');`);
    const asFaro = async (q: string, params?: unknown[]) => {
      await db.exec('set role faro_owner');
      try { return (await db.query(q, params)).rows; } finally { await db.exec('reset role'); }
    };
    const data = await exportFaro(asFaro) as Record<string, { id: string }[]>;
    expect(data.okr_workspaces!.map((w) => w.id)).toEqual(['ws-a', 'ws-b']);
    expect(Object.keys(data)).toContain('okr_check_ins');
    expect(Object.keys(data)).not.toContain('chores');
    expect(await resetFaro(asFaro)).toBe(2);
    expect(await rows('select id from faro.okr_workspaces')).toEqual([]);
    expect(await rows('select id from faro.okr_teams')).toEqual([]);
    expect(await rows(`select id from faro.okr_markup_ids where id = 'm-kept'`)).toEqual([{ id: 'm-kept' }]);
    expect(await family()).toEqual((before as { rows: unknown }).rows);
  });

  it('leaves nothing in faro to a stronger role: the builder functions read the request’s claims, and nothing reads storage', async () => {
    expect(await rows(`select proname from pg_proc where pronamespace = 'faro'::regnamespace and (prosrc like '%auth.%' or prosrc like '%storage.%')`)).toEqual([]);
    expect(await rows(`select to_regprocedure('faro.okr_markup_pictures_open()') as f, to_regprocedure('public.okr_markup_pictures_open()') as p`)).toEqual([{ f: null, p: null }]);
    const others = await rows(`select 1 from pg_proc where pronamespace = 'faro'::regnamespace and proowner <> 'faro_owner'::regrole
      union all select 1 from pg_class where relnamespace = 'faro'::regnamespace and relowner <> 'faro_owner'::regrole`);
    expect(others).toEqual([]);
    await db.exec(`insert into faro.okr_builders (email) values ('lane@example.com') on conflict do nothing`);
    const asBuilder = async (email: string) => {
      await db.exec(`set request.jwt.claims = '${JSON.stringify({ email })}'`);
      try { return (await as<{ b: boolean }>('authenticated', 'select faro.okr_is_builder() as b'))[0]!.b; } finally { await db.exec(`reset request.jwt.claims`); }
    };
    expect(await asBuilder('Lane@Example.com ')).toBe(true);
    expect(await asBuilder('someone@example.com')).toBe(false);
  });

  it('fails the fence when anything in faro belongs to another role, or the Faro role may run another app’s security definer function', async () => {
    await db.exec(`create function faro.okr_stronger() returns int language sql as 'select 1'`);
    expect((await report('faro_owner')).problems).toEqual(['1 thing in faro belongs to another role: run supabase/manual/faro-role.sql again.']);
    await db.exec(withPassword);
    expect((await report('faro_owner')).state).toBe('fenced');
    await db.exec(`drop function faro.okr_stronger()`);
    // The other app's function that runs as its owner, open to everyone (as functions are unless revoked): a way to its rows.
    await db.exec(`create function public.family_all() returns setof public.chores language sql security definer as 'select * from public.chores'`);
    expect(await report()).toMatchObject({ state: 'not-fenced', definer: 1 });
    expect((await report()).warnings.join(' ')).toMatch(/1 security definer function outside faro/);
    const leak = await report('faro_owner');
    expect(leak.problems).toEqual(['faro_owner may run 1 security definer function outside faro and the platform’s schemas.'.replace('’', "'")]);
    expect(JSON.stringify(leak)).not.toMatch(/family|chores/);
    await db.exec(`revoke execute on function public.family_all() from public`);
    expect((await report('faro_owner')).state).toBe('fenced');
    await db.exec(`drop function public.family_all()`);
  });

  it('fails the fence when a row rule outside faro calls a function in faro (Storage’s rules ran as the other app’s users)', async () => {
    expect(await rows(`select polname from pg_policy where polrelid = 'storage.objects'::regclass and polname = 'markups: builders read'`)).toEqual([]);
    expect((await report('faro_owner')).state).toBe('fenced');
    await db.exec(`create policy "sneaky read" on storage.objects for select to authenticated using (faro.okr_is_builder())`);
    expect(await report()).toMatchObject({ state: 'not-fenced', rules: 1 });
    expect((await report('faro_owner')).problems).toEqual(['1 row rule outside faro calls a function in faro: apply migration 0037 as postgres.']);
    await db.exec(`drop policy "sneaky read" on storage.objects`);
    expect((await report('faro_owner')).state).toBe('fenced');
  });

  it('fails the fence when a pg_cron job runs Faro’s code as another role, where the Faro role can see the jobs', async () => {
    // pg_cron's job list, as the extension keeps it (PGlite has no pg_cron).
    await db.exec(`create schema cron; create table cron.job (jobid serial primary key, jobname text, command text, username text);
      insert into cron.job (jobname, command, username) values ('okr-telemetry-nightly', 'select faro.okr_telemetry_nightly()', 'postgres'),
        ('family-tidy', 'select 1', 'postgres');`);
    expect(await report()).toMatchObject({ state: 'not-fenced', jobs: 1 });
    expect((await report('faro_owner')).warnings.join(' ')).toMatch(/can't see pg_cron's jobs/);
    await db.exec(`grant usage on schema cron to faro_owner; grant select on cron.job to faro_owner`);
    // (Reading the job list is itself a table outside faro, so that counts too.)
    expect((await report('faro_owner')).problems).toContain('1 pg_cron job runs Faro\'s code as another role.');
    await db.exec(`update cron.job set username = 'faro_owner' where jobname = 'okr-telemetry-nightly'`);
    expect((await report('faro_owner')).problems).toEqual(['faro_owner may read or write 1 table outside the faro schema.']);
    await db.exec(`drop schema cron cascade`);
  });

  it('says there is nothing to fence before 0035', async () => {
    const early = new PGlite();
    expect(await fenceReport(async (q: string) => (await early.query(q)).rows)).toMatchObject({ state: 'no-schema' });
  });
});
