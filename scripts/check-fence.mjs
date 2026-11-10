/* The fence around Faro (backlog 0c): the role CI's migrations run as can't read or write anything outside Faro's own
   schema, faro, and can't get a stronger role to do it for it. The database it runs on (family-hq) also holds another
   app's real family data.
   DATABASE_URL=postgres://… node scripts/check-fence.mjs
   It looks only at the catalog (roles, owners, grants, pg_cron's job list) and never at any table's rows. It prints
   counts, never another app's names: the repository and its CI logs are public.
   - Before migration 0035 (no faro schema yet), or while DATABASE_URL is still another role (postgres), it says so,
     reports what it can see as warnings, and passes, so migrations can be applied and Lane can then run
     supabase/manual/faro-role.sql and switch the secret.
   - Once DATABASE_URL is faro_owner, it fails, and nothing is migrated, if that role:
       is a superuser or skips row rules, or may make things in public;
       may select, insert, update, delete or truncate any table, view or foreign table outside faro (the redirects
         0035 left in public, which only point into faro, aside);
       may run a security definer function outside faro and the platform's own schemas (another app's function that
         runs as its owner is a way to its rows);
       or if anything in faro belongs to another role (its owner could run code as that role through it), or a pg_cron
         job that runs Faro's code runs as another role (where the role can see pg_cron's jobs). */
import { pathToFileURL } from 'node:url';

/** Faro's own role (supabase/manual/faro-role.sql). */
export const FARO_ROLE = 'faro_owner';

/** The platform's own schemas (Postgres's and Supabase's), where another app's code doesn't live. */
const PLATFORM = ['pg_catalog', 'information_schema', 'auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'realtime', '_realtime',
  'vault', 'pgsodium', 'pgsodium_masks', 'pgbouncer', 'supabase_functions', 'supabase_migrations', 'net', 'cron', 'pgtle', '_analytics'];
const notPlatform = (col) => `${col} <> 'faro' and ${col} not in (${PLATFORM.map((s) => `'${s}'`).join(', ')}) and ${col} not like 'pg\\_%'`;

/** What the fence looks like from the connected role. `query(sql)` returns rows. */
export async function fenceReport(query) {
  const [me] = await query(`
    select current_user as role, r.rolsuper as super, r.rolbypassrls as bypass,
           (select pg_get_userbyid(n.nspowner) from pg_namespace n where n.nspname = 'faro') as owner,
           has_schema_privilege(current_user, 'public', 'CREATE') as create_public
      from pg_roles r where r.rolname = current_user`);
  if (!me.owner) return { state: 'no-schema', role: me.role, problems: [], warnings: [] };
  const fenced = me.role === FARO_ROLE;
  // As the Faro role: what it may run. As anyone else (before the switch): what everyone may run, which the Faro role
  // will be able to as well.
  const [{ definer }] = await query(`
    select count(*)::int as definer
      from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where ${notPlatform('s.nspname')} and p.prosecdef
       and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
       and coalesce(obj_description(p.oid, 'pg_proc'), '') <> 'faro: redirect'
       and ${fenced ? `has_function_privilege(current_user, p.oid, 'EXECUTE')`
                    : `(p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'))`}`);
  const [{ foreign }] = await query(`
    select (select count(*) from pg_class c where c.relnamespace = 'faro'::regnamespace and c.relowner <> n.nspowner)::int
         + (select count(*) from pg_proc p where p.pronamespace = 'faro'::regnamespace and p.proowner <> n.nspowner)::int as foreign
      from pg_namespace n where n.nspname = 'faro'`);
  const [cron] = await query(`
    select coalesce((select has_schema_privilege(current_user, n.oid, 'USAGE') and has_table_privilege(current_user, c.oid, 'SELECT')
                       from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'cron' and c.relname = 'job'), false) as visible`);
  let jobs = null;
  if (cron.visible) [{ n: jobs }] = await query(`select count(*)::int as n from cron.job where command ~ '(faro\\.|okr_)' and username <> '${FARO_ROLE}'`);
  const s = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (!fenced) {
    const warnings = [];
    if (jobs) warnings.push(`${s(jobs, 'pg_cron job runs', 'pg_cron jobs run')} Faro's code as a role other than ${FARO_ROLE}.`);
    if (definer) warnings.push(`${s(definer, 'security definer function', 'security definer functions')} outside faro and the platform's schemas may be run by everyone, so ${FARO_ROLE} could run ${definer === 1 ? 'it' : 'them'} too.`);
    return { state: 'not-fenced', role: me.role, owner: me.owner, definer, jobs, problems: [], warnings };
  }
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
  if (n) problems.push(`${me.role} may read or write ${s(n, 'table', 'tables')} outside the faro schema.`);
  if (definer) problems.push(`${me.role} may run ${s(definer, 'security definer function', 'security definer functions')} outside faro and the platform's schemas.`);
  if (foreign) problems.push(`${s(foreign, 'thing', 'things')} in faro ${foreign === 1 ? 'belongs' : 'belong'} to another role: run supabase/manual/faro-role.sql again.`);
  if (jobs) problems.push(`${s(jobs, 'pg_cron job runs', 'pg_cron jobs run')} Faro's code as another role.`);
  const warnings = cron.visible ? [] : [`${me.role} can't see pg_cron's jobs (it can't make any either); a job postgres schedules is checked while CI still runs as postgres.`];
  return { state: problems.length ? 'leaks' : 'fenced', role: me.role, owner: me.owner, outside: n, definer, foreign, jobs, problems, warnings };
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
    if (r.state === 'no-schema') console.log(`::warning::No faro schema yet (migration 0035 not applied): ${r.role} isn't fenced. Apply 0035, run supabase/manual/faro-role.sql, then switch DATABASE_URL to ${FARO_ROLE}.`);
    else if (r.state === 'not-fenced') console.log(`::warning::DATABASE_URL connects as ${r.role}, not ${FARO_ROLE} (the Faro role), so migrations still run with rights beyond Faro. Run supabase/manual/faro-role.sql if you haven't, then switch the secret to ${FARO_ROLE}.`);
    for (const w of r.warnings) console.log(`::warning::${w}`);
    if (r.state === 'not-fenced') console.log(`Counted as ${r.role}: ${r.definer} security definer function(s) outside faro that everyone may run; ${r.jobs ?? 'unknown'} pg_cron job(s) running Faro's code as another role.`);
    if (r.state === 'fenced') console.log(`Fenced: ${r.role} owns faro and everything in it, and can't read or write any table, or run any other app's security definer function, outside it.`);
    if (r.state === 'leaks') { for (const p of r.problems) console.log(`::error::${p}`); process.exit(1); }
  } finally {
    await client.end();
  }
}
