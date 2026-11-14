-- TG0: a workspace's own fields on goals, the `tags` module's two tables (docs/design/round-4/tags/spec.md, section 4;
-- Lane's answers 1a–7a, 13 Nov). Shipped one merge ahead of the code that uses it (AX10): nothing reads these yet.
-- A workspace defines up to six fields (the app holds the six; the database holds each field's own limits). A field is
-- a list of values or free text; a goal has at most one value per field. No rule reads a field: they are module
-- records (0039), saved under `modules` like the metric library's, so they are put on faro.module_tables here.
-- A removed field is retired, never deleted (answer 5a): retired_at is set and every value stays.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro, every grant written out, row
-- rules as the workspace's other tables. Safe to run twice: tables, indexes and policies only if missing, rows only if
-- missing, the change log's check replaced whole.
-- Named without `okr_`, as module_tables (0039) is: 0035 makes a redirect view in public for every faro table named
-- okr_…, so a table added after it with that prefix would gain one if 0035 ran again (the fence's run-twice check).

create table if not exists faro.goal_fields (
  id text primary key,
  workspace_id text not null references faro.okr_workspaces (id) on delete cascade,
  name text not null constraint goal_fields_name_check check (length(trim(name)) between 1 and 40),
  kind text not null constraint goal_fields_kind_check check (kind in ('list', 'text')),
  -- A list's values, in order: 1 to 20 of them (a text field has none). Each value's length and their distinctness are
  -- the module's rule (fieldProblem), as a jsonb array's items can't be checked one by one here.
  options jsonb not null default '[]'::jsonb constraint goal_fields_options_check check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) <= 20
    and (kind = 'text' or jsonb_array_length(options) >= 1)
  ),
  position int not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  retired_by text
);
create index if not exists goal_fields_ws on faro.goal_fields (workspace_id);
-- A name is used once among a workspace's live fields; a retired field's name may be used again.
create unique index if not exists goal_fields_ws_name on faro.goal_fields (workspace_id, lower(trim(name))) where retired_at is null;

create table if not exists faro.goal_field_values (
  -- `{goal_id}:{field_id}`: module records are upserted on id, and a goal has one value per field.
  id text primary key,
  workspace_id text not null references faro.okr_workspaces (id) on delete cascade,
  goal_id text not null references faro.okr_goals (id) on delete cascade,
  field_id text not null references faro.goal_fields (id) on delete cascade,
  -- Empty clears it (the row stays, so History and Undo have something to point at).
  value text not null default '' constraint goal_field_values_value_check check (length(value) <= 80),
  set_by text not null,
  set_at timestamptz not null default now(),
  constraint goal_field_values_one check (id = goal_id || ':' || field_id)
);
create index if not exists goal_field_values_ws on faro.goal_field_values (workspace_id);
create index if not exists goal_field_values_field on faro.goal_field_values (field_id);

-- The app's public key reads, adds and changes them, as the workspace's other tables; nothing deletes them.
do $$
declare t text;
begin
  foreach t in array array['goal_fields', 'goal_field_values'] loop
    execute format('alter table faro.%I enable row level security', t);
    execute format('drop policy if exists "demo: read" on faro.%I', t);
    execute format('drop policy if exists "demo: add" on faro.%I', t);
    execute format('drop policy if exists "demo: change" on faro.%I', t);
    execute format('create policy "demo: read" on faro.%I for select to anon using (true)', t);
    execute format('create policy "demo: add" on faro.%I for insert to anon with check (true)', t);
    execute format('create policy "demo: change" on faro.%I for update to anon using (true) with check (true)', t);
    execute format('grant select, insert, update on faro.%I to anon', t);
  end loop;
end $$;

-- A save may write them, fields before the values that point at them (after the metric library's 10 and 20).
insert into faro.module_tables (table_name, module, position) values
  ('goal_fields', 'tags', 30),
  ('goal_field_values', 'tags', 40)
on conflict (table_name) do nothing;

-- History names a change to a field ("Stage added", "Stage retired").
alter table faro.okr_changes drop constraint if exists okr_changes_entity_check;
alter table faro.okr_changes add constraint okr_changes_entity_check
  check (entity in ('goal', 'check-in', 'decision', 'workspace', 'note', 'review', 'person', 'retro', 'cycle', 'request', 'view', 'watch', 'metric', 'field'));
