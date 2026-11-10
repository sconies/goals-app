/* Applies the SQL files in supabase/migrations that the database hasn't had yet, in order, each in a transaction.
   DATABASE_URL=postgres://… node scripts/migrate.mjs [--dry-run]
   It records what it ran in okr_schema_migrations. 0001–0004 were applied by hand before this runner existed,
   so on its first run against a database that already has the okr_ tables it records them without running them.
   Faro's tables live in the faro schema since 0035 (backlog 0c): the runner looks there first, and CI checks before it
   runs that the role it connects as is fenced off from every other table (scripts/check-fence.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const APPLIED_BY_HAND = ['0001', '0002', '0003', '0004'];
const dry = process.argv.includes('--dry-run');
const url = process.env.DATABASE_URL;
if (!url) { console.log('DATABASE_URL is not set: skipping migrations.'); process.exit(0); }

// Supabase needs SSL; a local Postgres (tests) usually has none.
const local = /sslmode=disable|@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  // Faro's schema first (a schema that doesn't exist yet is skipped), so migrations after 0035 land in faro.
  await client.query('set search_path to faro, public');
  // Where the record of applied migrations is: faro since 0035, public before it, or nowhere yet.
  const found = (await client.query("select coalesce(to_regclass('faro.okr_schema_migrations'), to_regclass('public.okr_schema_migrations'))::text as t")).rows[0].t;
  const T = found ?? 'okr_schema_migrations';
  if (!found) await client.query(`create table ${T} (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await client.query(`select name from ${T}`)).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
  if (!done.size && (await client.query("select coalesce(to_regclass('faro.okr_goals'), to_regclass('public.okr_goals')) as t")).rows[0].t) {
    for (const f of files.filter((x) => APPLIED_BY_HAND.includes(x.slice(0, 4)))) {
      console.log(`recorded (applied by hand): ${f}`);
      if (!dry) await client.query(`insert into ${T} (name) values ($1) on conflict do nothing`, [f]);
      done.add(f);
    }
  }
  const todo = files.filter((f) => !done.has(f));
  if (!todo.length) console.log('Database is up to date.');
  for (const f of todo) {
    console.log(`${dry ? 'would apply' : 'applying'}: ${f}`);
    if (dry) continue;
    await client.query('begin');
    try {
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query(`insert into ${T} (name) values ($1)`, [f]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw new Error(`${f} failed and was rolled back: ${e.message}`);
    }
  }
} finally {
  await client.end();
}
