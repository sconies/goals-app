-- Personal tokens for AI assistants (the MCP server). An admin gives one to a person; the assistant then acts
-- as that person, with the same rights, and every change it makes is logged as theirs, "via AI assistant (MCP)".
-- Only a SHA-256 hash of the token is stored: the token itself is shown once, when it's made.
create table okr_api_tokens (
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  person_id text not null references okr_people (id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  created_by text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index okr_api_tokens_workspace on okr_api_tokens (workspace_id);
alter table okr_api_tokens enable row level security;
-- Until sign-in lands, the same open access as the other okr_ tables; tokens are revoked, never deleted.
create policy "demo: read" on okr_api_tokens for select to anon using (true);
create policy "demo: add" on okr_api_tokens for insert to anon with check (true);
create policy "demo: change" on okr_api_tokens for update to anon using (true) with check (true);
grant select, insert, update on okr_api_tokens to anon;
