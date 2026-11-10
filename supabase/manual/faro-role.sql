-- Faro's own database role (backlog 0c, Lane, 10 Nov). Run as postgres, in Supabase → SQL editor, AFTER CI has
-- applied migrations 0035 and 0036 (it stops and says so if not). Put a long random password in place of the
-- placeholder first (it stops if you haven't); keep it only in CI's DATABASE_URL secret. Safe to run again: it changes
-- nothing twice, and a run with another password changes the password.
-- Run it again after you change the secret, with the same password: anything CI's migrations made as postgres in
-- between then passes to faro_owner too (until it does, the fence check fails and says so).
--
-- What it does:
--   1. makes faro_owner, a login with no special powers (not a superuser; can't make databases or roles, can't skip
--      row rules), whose search path is faro;
--   2. lets postgres act for it (so postgres can hand objects over and still repair anything);
--   3. hands it the faro schema and everything in it, so CI's migrations can change Faro and nothing else. Nothing in
--      faro stays with a stronger role (0036 made the last functions that read outside Faro read only Faro), and no
--      stronger role runs Faro's code: pg_cron's nightly job is gone (CI runs it as faro_owner). The Faro role is given
--      no rights on storage, auth or cron;
--   4. grants it nothing outside faro, and never changes another app's tables. scripts/check-fence.mjs checks before
--      every CI migration that it can't read or write any table outside faro.
--
-- Then change CI's DATABASE_URL secret (GitHub → Settings → Secrets and variables → Actions) to the same address as now,
-- with the user faro_owner.wlbetxkmrvwqfxvxntzl (Supabase's pooler names the project after a dot) and this password.

do $$
declare
  pw text := 'REPLACE-WITH-A-LONG-RANDOM-PASSWORD';
  r record;
begin
  if pw like 'REPLACE-WITH-%' then
    raise exception 'Put a long random password in place of REPLACE-WITH-A-LONG-RANDOM-PASSWORD first.';
  end if;
  if to_regclass('faro.okr_goals') is null then
    raise exception 'Migration 0035 hasn''t been applied yet: Faro''s tables are not in the faro schema. Merge it, let CI apply it, then run this.';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'faro'::regnamespace and (p.prosrc like '%auth.%' or p.prosrc like '%storage.%')) then
    raise exception 'Migration 0036 hasn''t been applied yet: some of Faro''s functions still read outside faro. Merge it, let CI apply it, then run this.';
  end if;

  -- 1. The role.
  if not exists (select 1 from pg_roles where rolname = 'faro_owner') then
    execute format('create role faro_owner login password %L nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 10', pw);
  else
    execute format('alter role faro_owner login password %L', pw);
  end if;
  alter role faro_owner set search_path = faro;
  alter role faro_owner set statement_timeout = '5min';

  -- 2. postgres may act for it.
  -- (Postgres 16 and later give a role's maker only the right to manage it, not to act as it, so grant it plainly.)
  execute format('grant faro_owner to %I', current_user);

  -- 3. The schema and everything in it.
  alter schema faro owner to faro_owner;
  for r in
    select c.relname, c.relkind from pg_class c
     where c.relnamespace = 'faro'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'S')
       and not (c.relkind = 'S' and exists (select 1 from pg_depend d where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype in ('a', 'i')))
  loop
    execute format('alter %s faro.%I owner to faro_owner',
      case r.relkind when 'v' then 'view' when 'm' then 'materialized view' when 'S' then 'sequence' else 'table' end, r.relname);
  end loop;
  for r in select p.oid from pg_proc p where p.pronamespace = 'faro'::regnamespace loop
    execute format('alter function %s owner to faro_owner', r.oid::regprocedure);
  end loop;

  -- 4. Nothing outside faro. A new role has no rights on other tables, and this script grants none; it never changes
  --    another app's tables. scripts/check-fence.mjs proves it before every migration.
  revoke create on schema public from faro_owner;

  -- 5. No job runs Faro's code as postgres (0036 removed the nightly one; this is in case it came back).
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $job$select cron.unschedule(jobid) from cron.job where command ~ '(faro\.|okr_)' and username <> 'faro_owner'$job$;
  end if;
end $$;
