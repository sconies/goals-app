-- The metric library (backlog 0b, src/domain/metrics.ts): every number a goal is measured by, defined once.
-- okr_metrics holds the definitions; okr_goal_metrics says which metric measures a goal, and for which slice (a team, or
-- the whole company when team_id is null), one per goal. Neither row is ever deleted by the app: removing a metric or
-- unlinking a goal sets removed_at, so it can be undone and restored.
-- Saves write both in the same transaction as everything else (okr_write, as 0030 left it, plus the two tables); a
-- workspace's deletion removes them (okr_delete_workspace, as 0032 left it, plus the two tables).
-- Safe to run twice: tables, indexes and columns only if missing, policies dropped first, functions replaced whole.

create table if not exists okr_metrics (
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  meaning text not null default '' check (length(meaning) <= 2000),
  unit text not null check (length(trim(unit)) between 1 and 20),
  decimals int not null default 0 check (decimals between 0 and 4),
  direction text not null check (direction in ('higher', 'lower')),
  source text not null default '' check (length(source) <= 2000),
  source_owner text not null default '' check (length(source_owner) <= 2000),
  refresh text check (refresh is null or refresh in ('live', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly')),
  owner_id text not null,
  caveats text not null default '' check (length(caveats) <= 2000),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by text
);
create index if not exists okr_metrics_ws on okr_metrics (workspace_id);
-- No two metrics in use in a workspace share a name, whatever the case.
create unique index if not exists okr_metrics_ws_name on okr_metrics (workspace_id, lower(trim(name))) where removed_at is null;

create table if not exists okr_goal_metrics (
  -- The goal's id: one link per goal.
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  goal_id text not null references okr_goals (id) on delete cascade,
  metric_id text not null references okr_metrics (id) on delete cascade,
  -- The slice: a team's number, or null for the whole company. No foreign key, so a removed team's slice still says so.
  team_id text,
  linked_by text not null,
  linked_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by text,
  check (id = goal_id)
);
create index if not exists okr_goal_metrics_ws on okr_goal_metrics (workspace_id);
create index if not exists okr_goal_metrics_metric on okr_goal_metrics (metric_id);

-- Until sign-in lands, the same open access as the other okr_ tables. Rows are never deleted through the API.
do $$
declare t text;
begin
  foreach t in array array['okr_metrics', 'okr_goal_metrics'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "demo: read" on %I', t);
    execute format('drop policy if exists "demo: add" on %I', t);
    execute format('drop policy if exists "demo: change" on %I', t);
    execute format('create policy "demo: read" on %I for select to anon using (true)', t);
    execute format('create policy "demo: add" on %I for insert to anon with check (true)', t);
    execute format('create policy "demo: change" on %I for update to anon using (true) with check (true)', t);
    execute format('grant select, insert, update on %I to anon', t);
  end loop;
end $$;

-- The change log records metrics: added, changed, removed and restored, and goals linked to one or unlinked.
alter table okr_changes drop constraint if exists okr_changes_entity_check;
alter table okr_changes add constraint okr_changes_entity_check
  check (entity in ('goal', 'check-in', 'decision', 'workspace', 'note', 'review', 'person', 'retro', 'cycle', 'request', 'view', 'watch', 'metric'));

-- Every row of a save carries this workspace's id: okr_same_workspace as 0017 left it, plus the two tables.
create or replace function okr_same_workspace(ws text, p jsonb) returns void
language plpgsql as $$
declare k text; r jsonb;
begin
  for k in select unnest(array['teams', 'people', 'cycles', 'goals', 'check_ins', 'reviews', 'feedback', 'retros', 'decisions', 'watches', 'tokens', 'views', 'requests', 'metrics', 'goal_metrics', 'changes']) loop
    for r in select * from jsonb_array_elements(coalesce(p->k, '[]'::jsonb)) loop
      if (r->>'workspace_id') is distinct from ws then raise exception 'a % row belongs to another workspace', k using errcode = 'P0001'; end if;
    end loop;
  end loop;
end $$;

-- Saves: okr_write as 0030 left it, plus metrics and their links, after goals (a link points at both).
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
  if to_regprocedure('okr_feedback_add(text, jsonb)') is not null then
    execute 'select okr_feedback_add($1, $2)' using ws, p->'feedback';
  else
    perform okr_upsert('okr_feedback', p->'feedback', 'id', 'nothing');
  end if;
  perform okr_upsert('okr_retros', p->'retros', 'id');
  perform okr_upsert('okr_decisions', p->'decisions', 'id');
  perform okr_upsert('okr_watches', p->'watches', 'id');
  -- Saves from before 0025 removed a watch's row; the app now sets removed_at instead, and this stays for older clients.
  delete from okr_watches where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'unwatch', '[]'::jsonb))));
  perform okr_upsert('okr_views', p->'views', 'id');
  perform okr_upsert('okr_requests', p->'requests', 'id');
  -- New in 0033: the metric library.
  perform okr_upsert('okr_metrics', p->'metrics', 'id');
  perform okr_upsert('okr_goal_metrics', p->'goal_metrics', 'id');
  -- A removed team's people and goals have moved above; a goal still on it stops the whole save.
  delete from okr_teams where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'remove_teams', '[]'::jsonb))));
  if coalesce(trim(p->>'workspace_name'), '') <> '' then
    update okr_workspaces set name = trim(p->>'workspace_name') where id = ws;
  end if;
  if jsonb_typeof(p->'workspace_recording') = 'boolean' then
    update okr_workspaces set recording = (p->>'workspace_recording')::boolean where id = ws;
  end if;
  if jsonb_typeof(p->'workspace_modules_off') = 'array' then
    update okr_workspaces set modules_off = array(select jsonb_array_elements_text(p->'workspace_modules_off')) where id = ws;
  end if;
  perform okr_upsert('okr_changes', p->'changes', 'id', 'nothing');
end $$;

-- Deleting a workspace removes everything kept about it: okr_delete_workspace as 0032 left it, plus the metric library
-- (links first: they point at goals and metrics).
create or replace function okr_delete_workspace(ws text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if ws = 'example' then raise exception 'The example can’t be deleted.' using errcode = 'P0001'; end if;
  update okr_teams set lead_id = null where workspace_id = ws;
  update okr_goals set parent_id = null where workspace_id = ws;
  delete from okr_goal_metrics where workspace_id = ws;
  delete from okr_metrics where workspace_id = ws;
  delete from okr_requests where workspace_id = ws;
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
  delete from okr_telemetry_spans where workspace_id = ws;
  delete from okr_telemetry_logs where workspace_id = ws;
  delete from okr_telemetry_metrics where workspace_id = ws;
  delete from okr_telemetry_daily where workspace_id = ws;
  delete from okr_workspaces where id = ws;
end $$;
