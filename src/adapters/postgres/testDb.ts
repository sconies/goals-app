/* A fresh plain-Postgres database for the contract tests: PGlite (Postgres in WebAssembly, no server), with
   bootstrap.sql and then every migration, exactly as a team on plain Postgres would set one up. Faro's tables end up in
   the faro schema (migration 0035), which the session then searches first. `npm run spec` uses the same database to
   write the schema and the access page into the kit (src/spec/schema.ts). Node only. */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The migrations, in the order they run. */
export const migrationFiles = (root: string) => readdirSync(join(root, 'supabase/migrations')).filter((x) => x.endsWith('.sql')).sort();

/** PGlite after bootstrap.sql and every migration in the repository at `root`. */
export async function migratedPostgres(root: string): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, 'src/adapters/postgres/bootstrap.sql'), 'utf8'));
  for (const f of migrationFiles(root)) await db.exec(readFileSync(join(root, 'supabase/migrations', f), 'utf8'));
  return db;
}

export const freshPostgres = (): Promise<PGlite> => migratedPostgres(join(__dirname, '../../..'));
