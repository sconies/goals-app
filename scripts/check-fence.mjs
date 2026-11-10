/* The fence around Faro (backlog 0c): the role CI's migrations run as can't read or write any table outside Faro's own
   schema, faro. The database it runs on (family-hq) also holds another app's real family data.
   DATABASE_URL=postgres://… node scripts/check-fence.mjs
   It looks only at the catalog (which role this is, which schema it owns, what it may do to each table) and never at
   any table's rows. It prints counts, never another app's table names: the repository and its CI logs are public.
   - Before migration 0035 (no faro schema yet), or while DATABASE_URL is still another role (postgres), it says so and
     passes, so 0035 can be applied and Lane can then switch the secret (supabase/manual/faro-role.sql).
   - Once DATABASE_URL is faro_owner, it fails if that role doesn't own faro, is a superuser or skips row rules, may make
     things in public, or may select, insert, update, delete or truncate any table, view or foreign table outside faro
     (the redirects 0035 left in public, which only point into faro, aside). */
import { pathToFileURL } from 'node:url';

/** Faro's own role (supabase/manual/faro-role.sql). */
export const FARO_ROLE = 'faro_owner';

/** What the fence looks like from the connected role. `query(sql)` returns rows. */
export async function fenceReport(query) {
  const [me] = await query(`
    select current_user as role, r.rolsuper as super, r.rolbypassrls as bypass,
           (select pg_get_userbyid(n.nspowner) from pg_namespace n where n.nspname = 'faro') as owner,
           has_schema_privilege(current_user, 'public', 'CREATE') as create_public
      from pg_roles r where r.rolname = current_user`);
  if (!me.owner) return { state: 'no-schema', role: me.role, problems: [] };
  if (me.role !== FARO_ROLE) return { state: 'not-fenced', role: me.role, owner: me.owner, problems: [] };
  const [{ n }] = await query(`
    select count(*)::int as n
      from pg_class c join pg_namespace s on s.oid = c.relnamespace
     where s.nspname <> 'faro' and s.nspname not in ('pg_catalog', 'information_schema') and s.nspname not like 'pg\\_%'
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and coalesce(obj_description(c.oid, 'pg_class'), '') <> 'faro: redirect'
       and has_table_privilege(current_user, c.oid, 'select, insert, update, delete, truncate')`);
  const problems = [];
  if (me.owner !== me.role) problems.push(`${me.role} doesn't own the faro schema (${me.owner} does): run supabase/manual/faro-role.sql.`);
  if (me.super) problems.push(`${me.role} is a superuser.`);
  if (me.bypass) problems.push(`${me.role} skips row rules (bypassrls).`);
  if (me.create_public) problems.push(`${me.role} may make things in the public schema.`);
  if (n) problems.push(`${me.role} may read or write ${n} table${n === 1 ? '' : 's'} outside the faro schema.`);
  return { state: problems.length ? 'leaks' : 'fenced', role: me.role, owner: me.owner, outside: n, problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.log('DATABASE_URL is not set: skipping the fence check.'); process.exit(0); }
  const { default: pg } = await import('pg');
  const local = /sslmode=disable|@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    const r = await fenceReport(async (sql) => (await client.query(sql)).rows);
    if (r.state === 'no-schema') console.log(`::warning::No faro schema yet (migration 0035 not applied): ${r.role} isn't fenced. Apply 0035, run supabase/manual/faro-role.sql, then switch DATABASE_URL to faro_owner.`);
    else if (r.state === 'not-fenced') console.log(`::warning::DATABASE_URL connects as ${r.role}, not ${FARO_ROLE} (the Faro role), so migrations still run with rights beyond Faro. Run supabase/manual/faro-role.sql if you haven't, then switch the secret to ${FARO_ROLE}.`);
    else if (r.state === 'fenced') console.log(`Fenced: ${r.role} owns faro and can't read or write any table outside it.`);
    else { for (const p of r.problems) console.log(`::error::${p}`); process.exit(1); }
  } finally {
    await client.end();
  }
}
