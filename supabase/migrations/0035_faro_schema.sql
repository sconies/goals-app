-- Faro's own schema (backlog 0c, Lane, 10 Nov). Faro shares the family-hq database with another app's real family data,
-- so everything Faro keeps moves out of `public` into its own schema, `faro`, where a Faro-only role can own it
-- (supabase/manual/faro-role.sql) and touch nothing else.
--
--   1. Every table, view and sequence named okr_* in public moves to faro, with its rows, indexes, triggers, grants and
--      row rules. Nothing else in public is looked at: only names that start with okr_ are Faro's.
--   2. Every function named okr_* moves too, and now finds its tables in faro (search_path = faro, pg_temp).
--   3. Redirects for the old names, so the app keeps working while it and the database change over: a view in public
--      for each table (security_invoker, so the caller's own rights and row rules still apply), and a function in public
--      for each function that calls the one in faro. The app asks for faro first and uses these only while Supabase's
--      Data API doesn't offer faro yet (src/adapters/supabase/schema.ts). Each is marked 'faro: redirect'. A later
--      release drops them (backlog 0c, step 2).
--   4. The public key's roles may use the schema (anon, authenticated, service_role where they exist); each table and
--      function keeps exactly the grants it had.
--   5. pg_cron's nightly telemetry job calls faro.okr_telemetry_nightly() by its new name.
--
-- The markup pictures' bucket stays where Supabase keeps every bucket (storage.buckets, id 'markups'); its rules already
-- admit only Faro's markup ids, and the Faro role has no rights on storage at all.
-- From 0036 on, migrations run as the Faro role with search_path faro, so their plain names land in faro.
-- Safe to run twice: what has moved is not moved again, and a redirect is made only where none exists.

create schema if not exists faro;

do $$
declare
  r record;
  g record;
  args text;
  call text;
  body text;
begin
  -- 1. Tables first (a table's own sequences go with it), then views, then sequences no table owns.
  for r in
    select c.oid, c.relname, c.relkind
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relname like 'okr\_%'
       and c.relkind in ('r', 'p', 'v', 'm', 'S')
       and coalesce(obj_description(c.oid, 'pg_class'), '') <> 'faro: redirect'
       and not exists (select 1 from pg_class f where f.relnamespace = 'faro'::regnamespace and f.relname = c.relname)
       and not (c.relkind = 'S' and exists (select 1 from pg_depend d where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype in ('a', 'i')))
     order by case c.relkind when 'r' then 0 when 'p' then 0 when 'v' then 1 when 'm' then 1 else 2 end, c.relname
  loop
    execute format('alter %s public.%I set schema faro',
      case r.relkind when 'v' then 'view' when 'm' then 'materialized view' when 'S' then 'sequence' else 'table' end, r.relname);
  end loop;

  -- 2. Functions, by their full signature, unless one with that signature is already in faro.
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as ident
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname like 'okr\_%'
       and coalesce(obj_description(p.oid, 'pg_proc'), '') <> 'faro: redirect'
  loop
    if exists (select 1 from pg_proc f where f.pronamespace = 'faro'::regnamespace and f.proname = r.proname
                 and pg_get_function_identity_arguments(f.oid) = r.ident) then
      continue;
    end if;
    execute format('alter function %s set schema faro', r.oid::regprocedure);
  end loop;
  for r in select p.oid from pg_proc p where p.pronamespace = 'faro'::regnamespace and p.proname like 'okr\_%' loop
    execute format('alter function %s set search_path = faro, pg_temp', r.oid::regprocedure);
  end loop;

  -- 3a. A redirect view in public for each table and view in faro that has no public name yet.
  for r in
    select c.relname
      from pg_class c
     where c.relnamespace = 'faro'::regnamespace and c.relname like 'okr\_%' and c.relkind in ('r', 'p', 'v', 'm')
       and to_regclass(format('public.%I', c.relname)) is null
  loop
    execute format('create view public.%I with (security_invoker = true) as select * from faro.%I', r.relname, r.relname);
    execute format('comment on view public.%I is %L', r.relname, 'faro: redirect');
    -- The caller still needs its own rights on the table in faro: these grants open the redirect, not the data.
    for g in select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role') loop
      execute format('grant select, insert, update, delete on public.%I to %I', r.relname, g.rolname);
    end loop;
  end loop;

  -- 3b. A redirect function in public for each function in faro (not trigger functions) that has no public twin yet.
  for r in
    select p.oid, p.proname, p.pronargs, p.proretset, p.prorettype, p.provolatile,
           pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as result,
           pg_get_function_identity_arguments(p.oid) as ident
      from pg_proc p
     where p.pronamespace = 'faro'::regnamespace and p.proname like 'okr\_%' and p.prokind = 'f'
       and p.prorettype <> 'trigger'::regtype
  loop
    if exists (select 1 from pg_proc f where f.pronamespace = 'public'::regnamespace and f.proname = r.proname
                 and pg_get_function_identity_arguments(f.oid) = r.ident) then
      continue;
    end if;
    select coalesce(string_agg('$' || i, ', ' order by i), '') into args from generate_series(1, r.pronargs) i;
    call := format('faro.%I(%s)', r.proname, args);
    if r.prorettype = 'void'::regtype and not r.proretset then
      body := format('language plpgsql %s as $redirect$ begin perform %s; end $redirect$',
        case r.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end, call);
    else
      body := format('language sql %s as $redirect$ select %s %s $redirect$',
        case r.provolatile when 's' then 'stable' when 'i' then 'immutable' else 'volatile' end,
        case when r.proretset then '* from' else '' end, call);
    end if;
    execute format('create function public.%I(%s) returns %s %s', r.proname, r.args, r.result, body);
    execute format('comment on function public.%I(%s) is %L', r.proname, r.ident, 'faro: redirect');
  end loop;

  -- 4. The public key's roles may look in the schema; what they may do there is each object's own grants.
  for r in select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role') loop
    execute format('grant usage on schema faro to %I', r.rolname);
  end loop;

  -- 5. The nightly telemetry job, by its new name.
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $job$select cron.schedule('okr-telemetry-nightly', '17 3 * * *', 'select faro.okr_telemetry_nightly()')$job$;
  end if;
end $$;

-- The rest of this session (the migrator's later files, a test database) finds Faro's tables in faro first.
set search_path to faro, public;
