-- Paste into Supabase → SQL editor → Run. Applies migration 0016 (saved views) and records it,
-- so the CI migrator won't run it again. Safe to run more than once.
begin;
-- Saved views of the goals: a name and the filters, sort, grouping and layout, as a query string (the same one a
-- shared link carries). Each is one person's; an admin can pin one for everyone in the workspace. A deleted view keeps
-- its row with deleted_at set, like a revoked token, so a save only ever upserts.
create table if not exists okr_views (
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  person_id text not null references okr_people (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  params text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists okr_views_workspace on okr_views (workspace_id);
alter table okr_views enable row level security;
-- Until sign-in lands, the same open access as the other okr_ tables.
drop policy if exists "demo: read" on okr_views;
drop policy if exists "demo: add" on okr_views;
drop policy if exists "demo: change" on okr_views;
create policy "demo: read" on okr_views for select to anon using (true);
create policy "demo: add" on okr_views for insert to anon with check (true);
create policy "demo: change" on okr_views for update to anon using (true) with check (true);
grant select, insert, update on okr_views to anon;

-- Saves write views in the same transaction as everything else.
create or replace function okr_write(ws text, p jsonb) returns void
language plpgsql as $$
declare s jsonb;
begin
  perform okr_upsert('okr_teams', p->'teams', 'id');
  perform okr_upsert('okr_people', p->'people', 'id');
  perform okr_upsert('okr_cycles', p->'cycles', 'id');
  perform okr_upsert('okr_goals', p->'goals', 'id');
  for s in select * from jsonb_array_elements(coalesce(p->'stages', '[]'::jsonb)) loop
    delete from okr_stages where goal_id = s->>'goal_id' and not (id = any (array(select jsonb_array_elements_text(coalesce(s->'keep', '[]'::jsonb)))));
    perform okr_upsert('okr_stages', s->'rows', 'goal_id, id');
  end loop;
  perform okr_upsert('okr_check_ins', p->'check_ins', 'id');
  perform okr_upsert('okr_reviews', p->'reviews', 'id');
  perform okr_upsert('okr_feedback', p->'feedback', 'id', 'nothing');
  perform okr_upsert('okr_retros', p->'retros', 'id');
  perform okr_upsert('okr_decisions', p->'decisions', 'id');
  perform okr_upsert('okr_watches', p->'watches', 'id', 'nothing');
  delete from okr_watches where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'unwatch', '[]'::jsonb))));
  perform okr_upsert('okr_api_tokens', p->'tokens', 'id');
  perform okr_upsert('okr_views', p->'views', 'id');
  perform okr_upsert('okr_changes', p->'changes', 'id', 'nothing');
end $$;

create or replace function okr_same_workspace(ws text, p jsonb) returns void
language plpgsql as $$
declare k text; r jsonb;
begin
  for k in select unnest(array['teams', 'people', 'cycles', 'goals', 'check_ins', 'reviews', 'feedback', 'retros', 'decisions', 'watches', 'tokens', 'views', 'changes']) loop
    for r in select * from jsonb_array_elements(coalesce(p->k, '[]'::jsonb)) loop
      if (r->>'workspace_id') is distinct from ws then raise exception 'a % row belongs to another workspace', k using errcode = 'P0001'; end if;
    end loop;
  end loop;
end $$;

create or replace function okr_delete_workspace(ws text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if ws = 'example' then raise exception 'The example can’t be deleted.' using errcode = 'P0001'; end if;
  update okr_teams set lead_id = null where workspace_id = ws;
  update okr_goals set parent_id = null where workspace_id = ws;
  delete from okr_views where workspace_id = ws;
  delete from okr_api_tokens where workspace_id = ws;
  delete from okr_feedback where workspace_id = ws;
  delete from okr_retros where workspace_id = ws;
  delete from okr_watches where workspace_id = ws;
  delete from okr_decisions where workspace_id = ws;
  delete from okr_check_ins where workspace_id = ws;
  delete from okr_stages where workspace_id = ws;
  delete from okr_changes where workspace_id = ws;
  delete from okr_reviews where workspace_id = ws;
  delete from okr_goals where workspace_id = ws;
  delete from okr_cycles where workspace_id = ws;
  delete from okr_people where workspace_id = ws;
  delete from okr_teams where workspace_id = ws;
  delete from okr_workspaces where id = ws;
end $$;
insert into okr_schema_migrations (name) values ('0016_saved_views.sql') on conflict do nothing;
commit;
