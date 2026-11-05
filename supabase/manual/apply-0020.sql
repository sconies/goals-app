-- Paste into Supabase → SQL editor → Run. Applies migration 0020 (renaming the workspace, and removing teams, in
-- one save) and records it, so the CI migrator won't run it again. Safe to run more than once.
begin;
-- Admins look after the workspace itself (review notes, 5 Nov): rename it, and add, rename and remove teams.
-- Saves already wrote teams; now one save can also remove teams (after moving their people and goals, in the same
-- save) and rename the workspace, all in its one transaction. Safe to run more than once.
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
  perform okr_upsert('okr_requests', p->'requests', 'id');
  -- A removed team's people and goals have moved above; a goal still on it stops the whole save.
  delete from okr_teams where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'remove_teams', '[]'::jsonb))));
  if coalesce(trim(p->>'workspace_name'), '') <> '' then
    update okr_workspaces set name = trim(p->>'workspace_name') where id = ws;
  end if;
  perform okr_upsert('okr_changes', p->'changes', 'id', 'nothing');
end $$;

insert into okr_schema_migrations (name) values ('0020_workspace_admin.sql') on conflict do nothing;
commit;
