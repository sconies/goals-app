-- Module records, made strict (AS part 3; the build review of 0039). Two things 0039 let through:
--   * a save carrying a metric library table both under `modules` and under its old key (`metrics`, `goal_metrics`)
--     kept one and silently dropped the other: it now stops with the reason;
--   * `"modules": null` failed with "cannot call jsonb_object_keys on an array": null now means no module rows, and
--     anything else that isn't an object stops with the reason.
-- Nothing else changes: both functions are 0039's, with the module rows read once at the top.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. Both functions exist and keep
-- their owner and grants (create or replace changes neither); no new function, table or grant. Safe to run twice.

create or replace function faro.okr_same_workspace(ws text, p jsonb) returns void
language plpgsql set search_path = faro, pg_temp as $$
declare k text; tbl text; r jsonb; s jsonb; ids text[]; clash text;
  mods jsonb;
begin
  -- A module's rows, by table: none when `modules` is missing or null; anything else but an object stops the save.
  mods := case jsonb_typeof(p->'modules') when 'object' then p->'modules' when 'null' then '{}'::jsonb else null end;
  if mods is null and p ? 'modules' then raise exception 'a save''s modules must be an object of tables' using errcode = 'P0001'; end if;
  mods := coalesce(mods, '{}'::jsonb);
  -- Saves from before 0039 sent the metric library's rows under these two keys: read as its two tables. A save naming
  -- a table both ways stops, rather than keeping one and dropping the other without a word.
  if jsonb_typeof(p->'metrics') = 'array' then
    if mods ? 'okr_metrics' then raise exception 'a save names okr_metrics twice (as modules.okr_metrics and as metrics)' using errcode = 'P0001'; end if;
    mods := mods || jsonb_build_object('okr_metrics', p->'metrics');
  end if;
  if jsonb_typeof(p->'goal_metrics') = 'array' then
    if mods ? 'okr_goal_metrics' then raise exception 'a save names okr_goal_metrics twice (as modules.okr_goal_metrics and as goal_metrics)' using errcode = 'P0001'; end if;
    mods := mods || jsonb_build_object('okr_goal_metrics', p->'goal_metrics');
  end if;
  -- Only tables on the allowed list: a module brings its own, and nothing else is written this way.
  for tbl in select jsonb_object_keys(mods) loop
    if not exists (select 1 from module_tables m where m.table_name = tbl) then
      raise exception 'a save can''t write to %: it isn''t a table a module declares', tbl using errcode = 'P0001';
    end if;
  end loop;
  -- Every row says this workspace, as before 0038.
  for k in select unnest(array['teams', 'people', 'cycles', 'goals', 'check_ins', 'reviews', 'feedback', 'retros', 'decisions', 'watches', 'tokens', 'views', 'requests', 'changes']) loop
    for r in select * from jsonb_array_elements(coalesce(p->k, '[]'::jsonb)) loop
      if (r->>'workspace_id') is distinct from ws then raise exception 'a % row belongs to another workspace', k using errcode = 'P0001'; end if;
    end loop;
  end loop;
  for tbl in select jsonb_object_keys(mods) loop
    for r in select * from jsonb_array_elements(coalesce(mods->tbl, '[]'::jsonb)) loop
      if (r->>'workspace_id') is distinct from ws then raise exception 'a % row belongs to another workspace', tbl using errcode = 'P0001'; end if;
    end loop;
  end loop;
  -- As 0038: no row a save updates is stored under another workspace, a module's included. (Feedback and the change log
  -- are only ever added, never updated, and a save carries no tokens, so those three can't reach another workspace's rows.)
  for k, tbl in select * from (values
      ('teams', 'okr_teams'), ('people', 'okr_people'), ('cycles', 'okr_cycles'), ('goals', 'okr_goals'),
      ('check_ins', 'okr_check_ins'), ('reviews', 'okr_reviews'), ('retros', 'okr_retros'), ('decisions', 'okr_decisions'),
      ('watches', 'okr_watches'), ('views', 'okr_views'), ('requests', 'okr_requests')
    ) as t(k, tbl)
    union all select m, m from jsonb_object_keys(mods) m loop
    ids := array(select e->>'id' from jsonb_array_elements(coalesce(case when k = tbl then mods->tbl else p->k end, '[]'::jsonb)) e where e ? 'id');
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

-- Saves: okr_write as 0039 left it, with the module rows read as above.
create or replace function faro.okr_write(ws text, p jsonb) returns void
language plpgsql set search_path = faro, pg_temp as $$
declare s jsonb; m record;
  mods jsonb;
begin
  -- A module's rows, by table: none when `modules` is missing or null; anything else but an object stops the save.
  mods := case jsonb_typeof(p->'modules') when 'object' then p->'modules' when 'null' then '{}'::jsonb else null end;
  if mods is null and p ? 'modules' then raise exception 'a save''s modules must be an object of tables' using errcode = 'P0001'; end if;
  mods := coalesce(mods, '{}'::jsonb);
  -- Saves from before 0039 sent the metric library's rows under these two keys: read as its two tables. A save naming
  -- a table both ways stops, rather than keeping one and dropping the other without a word.
  if jsonb_typeof(p->'metrics') = 'array' then
    if mods ? 'okr_metrics' then raise exception 'a save names okr_metrics twice (as modules.okr_metrics and as metrics)' using errcode = 'P0001'; end if;
    mods := mods || jsonb_build_object('okr_metrics', p->'metrics');
  end if;
  if jsonb_typeof(p->'goal_metrics') = 'array' then
    if mods ? 'okr_goal_metrics' then raise exception 'a save names okr_goal_metrics twice (as modules.okr_goal_metrics and as goal_metrics)' using errcode = 'P0001'; end if;
    mods := mods || jsonb_build_object('okr_goal_metrics', p->'goal_metrics');
  end if;
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
  -- Every module's rows, table by table in the allowed list's order (okr_same_workspace has refused any other table).
  for m in select t.table_name from module_tables t where mods ? t.table_name order by t.position, t.table_name loop
    perform okr_upsert(m.table_name::regclass, mods->m.table_name, 'id');
  end loop;
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
