-- One save is one transaction, and a save can't silently overwrite someone else's newer change.
--
-- okr_commit(ws, payload) writes everything a save carries (goals and their stages, check-ins, reviews, notes,
-- the change log…) in a single transaction: all of it lands, or none of it does. Before writing it checks
-- what the saver last saw: a goal or review's version, and which check-in (if any) was already there for a
-- goal and week. If someone else changed it in the meantime, the whole save is refused with "stale: …",
-- and the app reloads and asks the person to look again.

-- Versions: bumped on every update, so a save can say which version it was based on.
alter table okr_goals add column if not exists version int not null default 0;
alter table okr_reviews add column if not exists version int not null default 0;

create or replace function okr_bump_version() returns trigger language plpgsql as $$
begin
  new.version := coalesce(old.version, 0) + 1;
  return new;
end $$;
drop trigger if exists okr_goals_version on okr_goals;
create trigger okr_goals_version before update on okr_goals for each row execute function okr_bump_version();
drop trigger if exists okr_reviews_version on okr_reviews;
create trigger okr_reviews_version before update on okr_reviews for each row execute function okr_bump_version();

-- Upsert a JSON array of rows into a table, using only the columns the rows carry.
create or replace function okr_upsert(tbl regclass, rows jsonb, conflict text, mode text default 'update') returns void
language plpgsql as $$
declare cols text; upd text;
begin
  if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then return; end if;
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum),
         string_agg(format('%1$I = excluded.%1$I', a.attname), ', ' order by a.attnum)
    into cols, upd
    from pg_attribute a
   where a.attrelid = tbl and a.attnum > 0 and not a.attisdropped and a.attname <> 'version'
     and exists (select 1 from jsonb_array_elements(rows) r where r ? a.attname);
  if mode = 'nothing' then
    execute format('insert into %s (%s) select %s from jsonb_populate_recordset(null::%s, $1) on conflict (%s) do nothing', tbl, cols, cols, tbl, conflict) using rows;
  else
    execute format('insert into %s (%s) select %s from jsonb_populate_recordset(null::%s, $1) on conflict (%s) do update set %s', tbl, cols, cols, tbl, conflict, upd) using rows;
  end if;
end $$;

-- Refuses the save if anything it was based on has changed since.
create or replace function okr_check_expectations(ws text, expect jsonb) returns void
language plpgsql as $$
declare e jsonb; current_version int; current_id text;
begin
  if expect is null then return; end if;
  for e in select * from jsonb_array_elements(coalesce(expect->'goals', '[]'::jsonb)) loop
    select version into current_version from okr_goals where id = e->>'id' and workspace_id = ws;
    if found and (e->'version' is null or jsonb_typeof(e->'version') = 'null' or current_version <> (e->>'version')::int) then
      raise exception 'stale: goal %', e->>'id' using errcode = 'P0001';
    end if;
  end loop;
  for e in select * from jsonb_array_elements(coalesce(expect->'reviews', '[]'::jsonb)) loop
    select version into current_version from okr_reviews where id = e->>'id' and workspace_id = ws;
    if found and (e->'version' is null or jsonb_typeof(e->'version') = 'null' or current_version <> (e->>'version')::int) then
      raise exception 'stale: review %', e->>'id' using errcode = 'P0001';
    end if;
  end loop;
  for e in select * from jsonb_array_elements(coalesce(expect->'check_ins', '[]'::jsonb)) loop
    select id into current_id from okr_check_ins where goal_id = e->>'goal_id' and week = (e->>'week')::int;
    if (found and (e->>'id') is distinct from current_id) or (not found and e->>'id' is not null) then
      raise exception 'stale: check-in % week %', e->>'goal_id', e->>'week' using errcode = 'P0001';
    end if;
  end loop;
end $$;

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
  perform okr_upsert('okr_check_ins', p->'check_ins', 'goal_id, week');
  perform okr_upsert('okr_reviews', p->'reviews', 'id');
  perform okr_upsert('okr_feedback', p->'feedback', 'id', 'nothing');
  perform okr_upsert('okr_retros', p->'retros', 'id');
  perform okr_upsert('okr_decisions', p->'decisions', 'id');
  perform okr_upsert('okr_watches', p->'watches', 'id', 'nothing');
  delete from okr_watches where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'unwatch', '[]'::jsonb))));
  perform okr_upsert('okr_api_tokens', p->'tokens', 'id');
  -- The change log is append-only; a retried save doesn't log twice.
  perform okr_upsert('okr_changes', p->'changes', 'id', 'nothing');
end $$;

-- Rows must all carry this workspace's id.
create or replace function okr_same_workspace(ws text, p jsonb) returns void
language plpgsql as $$
declare k text; r jsonb;
begin
  for k in select unnest(array['teams', 'people', 'cycles', 'goals', 'check_ins', 'reviews', 'feedback', 'retros', 'decisions', 'watches', 'tokens', 'changes']) loop
    for r in select * from jsonb_array_elements(coalesce(p->k, '[]'::jsonb)) loop
      if (r->>'workspace_id') is distinct from ws then raise exception 'a % row belongs to another workspace', k using errcode = 'P0001'; end if;
    end loop;
  end loop;
end $$;

create or replace function okr_commit(ws text, payload jsonb) returns void
language plpgsql as $$
begin
  if not exists (select 1 from okr_workspaces where id = ws) then raise exception 'no workspace %', ws using errcode = 'P0001'; end if;
  perform okr_same_workspace(ws, payload);
  perform okr_check_expectations(ws, payload->'expect');
  perform okr_write(ws, payload);
end $$;

-- A new workspace and everything in it, in one go: it exists completely or not at all.
create or replace function okr_create_workspace(w jsonb, payload jsonb) returns void
language plpgsql as $$
begin
  insert into okr_workspaces select * from jsonb_populate_record(null::okr_workspaces, w);
  perform okr_same_workspace(w->>'id', payload);
  perform okr_write(w->>'id', payload);
end $$;

-- Deleting a workspace removes everything in it, or nothing. Examples can only be reset.
create or replace function okr_delete_workspace(ws text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if ws = 'example' then raise exception 'The example can’t be deleted.' using errcode = 'P0001'; end if;
  update okr_teams set lead_id = null where workspace_id = ws;
  update okr_goals set parent_id = null where workspace_id = ws;
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

grant execute on function okr_commit(text, jsonb), okr_create_workspace(jsonb, jsonb), okr_delete_workspace(text) to anon;

-- One year per start date in a workspace: two admins starting next year at once can't make two.
create unique index if not exists okr_cycles_ws_start on okr_cycles (workspace_id, start_date);

-- Every table is read by workspace.
create index if not exists okr_teams_ws on okr_teams (workspace_id);
create index if not exists okr_people_ws on okr_people (workspace_id);
create index if not exists okr_cycles_ws on okr_cycles (workspace_id);
create index if not exists okr_stages_ws on okr_stages (workspace_id);
create index if not exists okr_decisions_ws on okr_decisions (workspace_id);
create index if not exists okr_watches_ws on okr_watches (workspace_id);
create index if not exists okr_reviews_ws on okr_reviews (workspace_id);
create index if not exists okr_retros_ws on okr_retros (workspace_id);
create index if not exists okr_feedback_ws on okr_feedback (workspace_id);
