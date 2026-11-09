-- Paste into Supabase → SQL editor → Run. Applies migration 0034 (builder tokens labelled apart: okr_token_list
-- says which tokens were made as builder tokens) and records it, so the CI migrator won't run it again. Safe to run more than once.
begin;
-- Builder tokens labelled apart from ordinary ones (backlog 10a, Lane, 8 Nov). Faro makes no builder tokens any more
-- (0031): one made before works as an ordinary token. okr_token_list now also says which tokens were made as builder
-- tokens (`builder`, true when okr_builder_token_create made it), so Workspace, Access and Settings can label them; it
-- still never returns the hash or the builder's email. Its result gains a column, so it is dropped and made again,
-- with its grant. Safe to run twice.

drop function if exists okr_token_list(text);
create function okr_token_list(ws text)
returns table (id text, workspace_id text, person_id text, name text, created_by text, created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz, builder boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.workspace_id, t.person_id, t.name, t.created_by, t.created_at, t.last_used_at, t.revoked_at, t.builder_email is not null
    from okr_api_tokens t where t.workspace_id = ws order by t.created_at, t.id
$$;
grant execute on function okr_token_list(text) to anon;

insert into okr_schema_migrations (name) values ('0034_token_kind.sql') on conflict do nothing;
commit;
