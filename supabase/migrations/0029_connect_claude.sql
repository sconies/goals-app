-- Connect Claude (backlog -2): a builder signed in to the inbox lists their own live builder tokens, in every
-- workspace, and revokes one. Builds on 0024 (okr_is_builder, okr_api_tokens.builder_email). Only signed-in builders
-- call these; the public key can't. Never returns a token's hash or secret. Safe to rerun.

-- The signed-in builder's live builder tokens, newest first, with the workspace's and the person's names.
create or replace function okr_builder_tokens()
returns table (id text, workspace_id text, workspace_name text, person_id text, person_name text, name text, created_at timestamptz, last_used_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare e text := lower(trim(coalesce(auth.jwt()->>'email', '')));
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

-- Revokes one of the signed-in builder's own builder tokens. False when it was already revoked or isn't theirs.
create or replace function okr_builder_token_revoke(token_id text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare e text := lower(trim(coalesce(auth.jwt()->>'email', '')));
begin
  if not okr_is_builder() then raise exception 'Only builders, signed in to the inbox, revoke builder tokens.' using errcode = 'P0001'; end if;
  update okr_api_tokens set revoked_at = now() where id = token_id and builder_email = e and revoked_at is null;
  return found;
end $$;

revoke execute on function okr_builder_tokens() from public;
revoke execute on function okr_builder_token_revoke(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function okr_builder_tokens() from anon';
    execute 'revoke execute on function okr_builder_token_revoke(text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function okr_builder_tokens() to authenticated';
    execute 'grant execute on function okr_builder_token_revoke(text) to authenticated';
  end if;
end $$;
