# Faro's database

Faro shares the family-hq Supabase project with another app's real family data, so it keeps to its own schema, `faro` (backlog 0c; `docs/architecture.md`, "The database"). CI applies `migrations/` on merge (`scripts/migrate.mjs`), after `scripts/check-fence.mjs` has checked the role it runs as. `manual/` holds paste-in scripts for Lane, including `faro-role.sql`, which makes the Faro role.

## Writing a migration (from 0036 on)

- **It runs as `faro_owner`, with `search_path` faro.** Plain names land in `faro`; write `faro.` where it helps the reader. Never create anything in `public`, `auth`, `storage` or `cron`: the role can't, and the migration fails.
- **Write every grant out.** Supabase's default grants (everything to `anon`, `authenticated` and `service_role`) apply only to what postgres makes in `public`. A new table in `faro` has none: grant exactly what the app's public key needs (`grant select, insert on faro.okr_x to anon`) and turn on row rules where it reads. A new function is runnable by everyone until you `revoke execute … from public`; grant it to `anon` if the app calls it.
- **No redirect.** 0035 left a view or function under each old name in `public` for the app's fallback, while the Data API doesn't offer `faro` yet. They are fixed `select *` views, and `faro_owner` can't make new ones, so a new table, column or function is seen only through `faro`: add `faro` to the Data API's exposed schemas before such code ships. Dropping or retyping a column a redirect shows fails until the redirects go (backlog 0c2).
- **Nothing outside `faro`.** A function reads only `faro`; a security definer function runs as `faro_owner`. No pg_cron job: anything on a schedule is a CI job (`.github/workflows/nightly.yml`).
- **Safe to run twice**, as before (`if not exists`, `create or replace`, `drop … if exists`), and one transaction per file.

## What's here

- `migrations/0001`–`0034`: written for `public`, with Supabase's default grants; 0035 moved everything to `faro`; 0036 removed the last things that ran as postgres.
- `manual/faro-role.sql`: makes `faro_owner` and hands it `faro`. Run it after 0035 and 0036, and again after CI's `DATABASE_URL` becomes `faro_owner`.
- `manual/apply-*.sql`: old paste-ins, from before CI applied migrations.
