-- The fence, hardened (backlog 0c, outside review of PR #89, 10 Nov). Nothing in faro may be owned by a role stronger
-- than the Faro role, and no stronger role may run Faro's code as itself, so that whoever holds CI's DATABASE_URL
-- (faro_owner) can't reach beyond faro:
--   1. The old builder sign-in functions asked auth.jwt() who is signed in, which kept them with postgres. They now read
--      the same claims from the request setting directly (what auth.jwt() does), so faro_owner can own them like the rest.
--   2. okr_markup_pictures_open read storage.buckets as postgres. It goes: the app and the MCP server now ask Storage
--      itself whether the markups bucket is public, by a picture address (src/adapters/supabase/markups.ts).
--   3. pg_cron no longer runs Faro's nightly telemetry roll-up as postgres; a scheduled CI job runs it as the Faro role
--      (.github/workflows/nightly.yml, npm run faro:nightly).
--   4. Supabase's Data API reloads its view of the schema (the redirects 0035 made included).
-- Plain names below are found in faro (0035 set the search path). Steps that need postgres (pg_cron, the redirect in
-- public) are skipped when whoever runs this can't do them. Safe to run twice.

create or replace function faro.okr_is_builder() returns boolean
language plpgsql stable security definer set search_path = faro, pg_temp as $$
declare e text;
begin
  e := lower(trim(coalesce(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email', '')));
  return e <> '' and exists (select 1 from okr_builders b where b.email = e);
end $$;

create or replace function faro.okr_builder_tokens()
returns table (id text, workspace_id text, workspace_name text, person_id text, person_name text, name text, created_at timestamptz, last_used_at timestamptz)
language plpgsql stable security definer set search_path = faro, pg_temp as $$
declare e text := lower(trim(coalesce(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email', '')));
begin
  if not okr_is_builder() then raise exception 'Only builders, signed in to the inbox, list builder tokens.' using errcode = 'P0001'; end if;
  return query
    select t.id, t.workspace_id, coalesce(w.name, t.workspace_id), t.person_id, coalesce(p.name, t.person_id), t.name, t.created_at, t.last_used_at
      from okr_api_tokens t
      left join okr_workspaces w on w.id = t.workspace_id
      left join okr_people p on p.id = t.person_id and p.workspace_id = t.workspace_id
     where t.builder_email = e and t.revoked_at is null
     order by t.created_at desc;
end $$;

create or replace function faro.okr_builder_token_revoke(token_id text) returns boolean
language plpgsql security definer set search_path = faro, pg_temp as $$
declare e text := lower(trim(coalesce(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email', '')));
begin
  if not okr_is_builder() then raise exception 'Only builders, signed in to the inbox, revoke builder tokens.' using errcode = 'P0001'; end if;
  update okr_api_tokens set revoked_at = now() where id = token_id and builder_email = e and revoked_at is null;
  return found;
end $$;

create or replace function faro.okr_builder_token_create(ws text, person text, token_name text) returns text
language plpgsql security definer set search_path = faro, pg_temp as $$
declare
  nm text := trim(coalesce(token_name, ''));
  e text := lower(trim(coalesce(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'email', '')));
  secret text;
begin
  if not okr_is_builder() then raise exception 'Only builders, signed in to the inbox, make a builder token.' using errcode = 'P0001'; end if;
  if not exists (select 1 from okr_people p where p.id = person and p.workspace_id = ws) then
    raise exception 'There’s no one with that ID in this workspace.' using errcode = 'P0001';
  end if;
  if length(nm) < 2 or length(nm) > 120 then raise exception 'Say what the token is for.' using errcode = 'P0001'; end if;
  secret := okr_token_secret();
  insert into okr_api_tokens (id, workspace_id, person_id, name, token_hash, created_by, created_at, builder_email)
    values ('tok_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), ws, person, nm, encode(sha256(convert_to(secret, 'UTF8')), 'hex'),
      person, now(), e);
  return secret;
end $$;

drop function if exists faro.okr_markup_pictures_open();

do $$
begin
  -- 2. Its redirect in public, made by 0035 (owned by postgres; skipped when this is run as the Faro role).
  if to_regprocedure('public.okr_markup_pictures_open()') is not null
     and pg_has_role(current_user, (select proowner from pg_proc where oid = to_regprocedure('public.okr_markup_pictures_open()')), 'usage') then
    drop function public.okr_markup_pictures_open();
  end if;
  -- 3. The nightly job, out of pg_cron (where this role can see it).
  if exists (select 1 from pg_extension where extname = 'pg_cron') and has_schema_privilege(current_user, 'cron', 'usage') then
    execute $job$select cron.unschedule(jobid) from cron.job where jobname = 'okr-telemetry-nightly'$job$;
  end if;
end $$;

-- 4. Supabase's Data API reloads its schema cache (a no-op where nothing listens).
notify pgrst, 'reload schema';
