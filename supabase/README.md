# Faro's database

Faro shares the family-hq Supabase project with another app's real family data, so it keeps to its own schema, `faro` (backlog 0c; `docs/architecture.md`, "The database"). CI applies `migrations/` on merge (`scripts/migrate.mjs`), after `scripts/check-fence.mjs` has checked the role it runs as: it fails if the role reaches a table outside `faro`, except the ones Supabase opens to everyone in `extensions`, `cron` and `net`, which it reports as a warning. `manual/` holds paste-in scripts for Lane, including `faro-role.sql`, which makes the Faro role.

## Writing a migration (from 0036 on)

- **It runs as `faro_owner`, with `search_path` faro.** Plain names land in `faro`; write `faro.` where it helps the reader. Never create anything in `public`, `auth`, `storage` or `cron`: the role can't, and the migration fails.
- **Write every grant out.** Supabase's default grants (everything to `anon`, `authenticated` and `service_role`) apply only to what postgres makes in `public`. A new table in `faro` has none: grant exactly what the app's public key needs (`grant select, insert on faro.okr_x to anon`) and turn on row rules where it reads. A new function is runnable by everyone until you `revoke execute … from public`; grant it to `anon` if the app calls it.
- **No redirect.** 0035 left a view or function under each old name in `public` for the app's fallback, while the Data API doesn't offer `faro` yet. They are fixed `select *` views, and `faro_owner` can't make new ones, so a new table, column or function is seen only through `faro`: add `faro` to the Data API's exposed schemas before such code ships. Dropping or retyping a column a redirect shows fails until the redirects go (backlog 0c2).
- **Nothing outside `faro`.** A function reads only `faro`; a security definer function runs as `faro_owner`. No pg_cron job: anything on a schedule is a CI job (`.github/workflows/nightly.yml`).
- **Safe to run twice**, as before (`if not exists`, `create or replace`, `drop … if exists`), and one transaction per file.

## Looking at Faro's tables as postgres

Supabase's table editor and SQL editor run as postgres. Once `faro_owner` owns `faro`, anything you read there (a table's triggers and rules, a view, a function a query calls) can run code `faro_owner` put behind it, with postgres's rights over the whole project, the other app's data included. So before you read or change Faro's tables in the SQL editor, run `set role faro_owner;` first (and `reset role;` after), and don't browse `faro` in the table editor. Only postgres changes the fence itself (`manual/faro-role.sql`, a migration that must run as postgres, such as 0037).

## What's here

- `migrations/0001`–`0034`: written for `public`, with Supabase's default grants; 0035 moved everything to `faro`; 0036 removed the last things that ran as postgres; 0037 took Faro's functions out of Storage's rules.
- `migrations/0039`: a save takes every feature module's rows under `modules`, by table, from the allowed list `faro.module_tables` (AS part 2). A module with tables of its own adds them to that list in its migration (`insert … on conflict do nothing`); the core's tables stay as they are. It still reads the old `metrics` and `goal_metrics` keys, so it ships one merge ahead of the code that sends `modules` (AX10).
- `manual/faro-role.sql`: makes `faro_owner` and hands it `faro`. Run it after 0035, 0036 and 0037, and again after CI's `DATABASE_URL` becomes `faro_owner`.
- `manual/apply-*.sql`: old paste-ins, from before CI applied migrations.
