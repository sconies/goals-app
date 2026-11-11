-- The workspace check holds (backlog AX1; architecture readiness review, 11 Nov, finding 1).
-- okr_same_workspace checked only what each incoming row says its workspace is. The upserts then match on id alone,
-- so a save addressed to workspace A that carried one of workspace B's ids (with A's workspace_id) moved B's row into
-- A; and a save that named one of B's milestones emptied its stages, which were never checked at all.
-- From here, before anything is written, a save is refused if:
--   * any row it carries says another workspace (as before), stages included;
--   * any row it would update is already stored under another workspace;
--   * any milestone whose stages it rewrites is a goal stored under another workspace.
-- And the stage delete itself is limited to the workspace being saved to.
-- Runs as faro_owner with search_path faro (supabase/README.md). Both functions already exist and keep their grants
-- (create or replace changes neither owner nor grants); each sets its own search_path, as 0035 left them.
-- Safe to run twice: functions replaced whole.

create or replace function faro.okr_same_workspace(ws text, p jsonb) returns void
language plpgsql set search_path = faro, pg_temp as $$
declare k text; tbl text; r jsonb; s jsonb; ids text[]; clash text;
begin
  -- Every row says this workspace, as before 0038.
  for k in select unnest(array['teams', 'people', 'cycles', 'goals', 'check_ins', 'reviews', 'feedback', 'retros', 'decisions', 'watches', 'tokens', 'views', 'requests', 'metrics', 'goal_metrics', 'changes']) loop
    for r in select * from jsonb_array_elements(coalesce(p->k, '[]'::jsonb)) loop
      if (r->>'workspace_id') is distinct from ws then raise exception 'a % row belongs to another workspace', k using errcode = 'P0001'; end if;
    end loop;
  end loop;
  -- New in 0038: no row a save updates is stored under another workspace. (Feedback and the change log are only ever
  -- added, never updated, and a save carries no tokens, so those three can't reach another workspace's rows.)
  for k, tbl in select * from (values
      ('teams', 'okr_teams'), ('people', 'okr_people'), ('cycles', 'okr_cycles'), ('goals', 'okr_goals'),
      ('check_ins', 'okr_check_ins'), ('reviews', 'okr_reviews'), ('retros', 'okr_retros'), ('decisions', 'okr_decisions'),
      ('watches', 'okr_watches'), ('views', 'okr_views'), ('requests', 'okr_requests'), ('metrics', 'okr_metrics'),
      ('goal_metrics', 'okr_goal_metrics')
    ) as t(k, tbl) loop
    ids := array(select e->>'id' from jsonb_array_elements(coalesce(p->k, '[]'::jsonb)) e where e ? 'id');
    if cardinality(ids) > 0 then
      execute format('select t.id from %I t where t.id = any ($1) and t.workspace_id is distinct from $2 limit 1', tbl) into clash using ids, ws;
      if clash is not null then raise exception 'a % row belongs to another workspace', k using errcode = 'P0001'; end if;
    end if;
  end loop;
  -- Stages: each milestone's goal is this workspace's (or new), and every stage row says this workspace.
  for s in select * from jsonb_array_elements(coalesce(p->'stages', '[]'::jsonb)) loop
    if exists (select 1 from okr_goals g where g.id = s->>'goal_id' and g.workspace_id is distinct from ws) then
      raise exception 'a stages row belongs to another workspace' using errcode = 'P0001';
    end if;
    for r in select * from jsonb_array_elements(coalesce(s->'rows', '[]'::jsonb)) loop
      if (r->>'workspace_id') is distinct from ws or (r->>'goal_id') is distinct from (s->>'goal_id') then
        raise exception 'a stages row belongs to another workspace' using errcode = 'P0001';
      end if;
    end loop;
  end loop;
end $$;

-- Saves: okr_write as 0033 left it, with the stage delete limited to this workspace.
create or replace function faro.okr_write(ws text, p jsonb) returns void
language plpgsql set search_path = faro, pg_temp as $$
declare s jsonb;
begin
  perform okr_upsert('okr_teams', p->'teams', 'id');
  perform okr_upsert('okr_people', p->'people', 'id');
  perform okr_upsert('okr_cycles', p->'cycles', 'id');
  perform okr_upsert('okr_goals', p->'goals', 'id');
  for s in select * from jsonb_array_elements(coalesce(p->'stages', '[]'::jsonb)) loop
    delete from okr_stages where workspace_id = ws and goal_id = s->>'goal_id'
      and not (id = any (array(select jsonb_array_elements_text(coalesce(s->'keep', '[]'::jsonb)))));
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

-- Supabase's Data API reloads its schema cache (a no-op where nothing listens).
notify pgrst, 'reload schema';
