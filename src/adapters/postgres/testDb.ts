/* A fresh plain-Postgres database for the contract tests: PGlite (Postgres in WebAssembly, no server), with
   bootstrap.sql and then every migration, exactly as a team on plain Postgres would set one up. Faro's tables end up in
   the faro schema (migration 0035), which the session then searches first. Node only. */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../../..');
const MIGRATIONS = join(root, 'supabase/migrations');

export async function freshPostgres(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, 'bootstrap.sql'), 'utf8'));
  for (const f of readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  return db;
}
