-- Paste into Supabase → SQL editor → Run. Applies migration 0030 (feature modules: each workspace's switched-off
-- modules) and records it, so the CI migrator won't run it again. Needs 0025 first. Safe to run more than once.
begin;
-- Feature modules (backlog item 0, docs/architecture.md): an admin switches each optional module on or off for a
-- workspace. okr_workspaces.modules_off lists the ones switched off, by id; empty or null (the default) means every module is on.
-- The app reads it with the workspace; the MCP server reads it to refuse a switched-off module's tools.
-- Safe to run twice: the column is added only if it isn't there, and okr_write is replaced whole.

alter table okr_workspaces add column if not exists modules_off text[] default '{}';

-- Saves: okr_write as 0025 left it, plus the modules switch, saved in the same transaction as the rest of the save
-- (and its change-log entry).
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
  -- A removed team's people and goals have moved above; a goal still on it stops the whole save.
  delete from okr_teams where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'remove_teams', '[]'::jsonb))));
  if coalesce(trim(p->>'workspace_name'), '') <> '' then
    update okr_workspaces set name = trim(p->>'workspace_name') where id = ws;
  end if;
  if jsonb_typeof(p->'workspace_recording') = 'boolean' then
    update okr_workspaces set recording = (p->>'workspace_recording')::boolean where id = ws;
  end if;
  -- New in 0030: the feature modules switched off, all of them (an empty list switches everything back on).
  if jsonb_typeof(p->'workspace_modules_off') = 'array' then
    update okr_workspaces set modules_off = array(select jsonb_array_elements_text(p->'workspace_modules_off')) where id = ws;
  end if;
  perform okr_upsert('okr_changes', p->'changes', 'id', 'nothing');
end $$;

insert into okr_schema_migrations (name) values ('0030_feature_modules.sql') on conflict do nothing;
commit;
