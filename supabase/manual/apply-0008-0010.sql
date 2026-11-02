-- Paste into Supabase → SQL editor → Run. Applies migrations 0008, 0009 and 0010 in one transaction and records them,
-- so the CI migrator won't run them again. Safe to run if 0008 was already applied.
begin;
-- 0008: a goal can run past its cycle (to the end of the year), and its plan can be set as numbers by hand.
alter table okr_goals add column if not exists plan_end_week int check (plan_end_week is null or plan_end_week between 1 and 104);
alter table okr_goals add column if not exists plan_points jsonb;
alter table okr_goals drop constraint if exists okr_goals_plan_from_week_check;
alter table okr_goals add constraint okr_goals_plan_from_week_check check (plan_from_week between -104 and 104);
insert into okr_schema_migrations (name) values ('0008_year_goals_and_plan_numbers.sql') on conflict do nothing;
-- 0009: check-ins loaded later rather than posted in their week.
alter table okr_check_ins add column if not exists backfilled boolean not null default false;
insert into okr_schema_migrations (name) values ('0009_backfilled_check_ins.sql') on conflict do nothing;
-- 0010: personal tokens for AI assistants. Only a hash of each token is stored.
create table if not exists okr_api_tokens (
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
create index if not exists okr_api_tokens_workspace on okr_api_tokens (workspace_id);
alter table okr_api_tokens enable row level security;
drop policy if exists "demo: read" on okr_api_tokens;
drop policy if exists "demo: add" on okr_api_tokens;
drop policy if exists "demo: change" on okr_api_tokens;
create policy "demo: read" on okr_api_tokens for select to anon using (true);
create policy "demo: add" on okr_api_tokens for insert to anon with check (true);
create policy "demo: change" on okr_api_tokens for update to anon using (true) with check (true);
grant select, insert, update on okr_api_tokens to anon;
insert into okr_schema_migrations (name) values ('0010_api_tokens.sql') on conflict do nothing;
commit;
