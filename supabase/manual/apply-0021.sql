-- Paste into Supabase → SQL editor → Run. Applies migration 0021 (readable goal keys: G-1, G-2 … per workspace) and
-- records it, so the CI migrator won't run it again. Safe to run more than once.
begin;
-- Readable goal keys (Lane's review notes, 5 Nov): every goal gets a short key in its workspace, G-1, G-2 …, in the
-- order goals were created. A key never changes and is never given to another goal. A goal carried into the next cycle
-- keeps its key there (the copy is the same goal, a year on), so a key is unique within a workspace's cycle, and the
-- numbers come from one counter per workspace, so a key a stopped goal had isn't handed out again.
--
-- Saving a goal (okr_commit, okr_create_workspace, or a plain insert) goes through okr_goal_key(): a new goal keeps
-- the key the app gave it when that key is free in its cycle, and otherwise takes the next number. The counter row is
-- locked while it does, so two people adding goals at the same moment get different keys. An existing goal's key is
-- kept whatever a save says. Safe to run more than once.

alter table okr_goals add column if not exists key text;

-- The last key number given in each workspace. Read and written only by okr_goal_key(), never through the API.
create table if not exists okr_goal_keys (
  workspace_id text primary key,
  last int not null default 0 check (last >= 0)
);
alter table okr_goal_keys enable row level security;

-- Existing goals, oldest first in each workspace. A goal in a later cycle with the same title as one that already has
-- a key (it was carried on) takes that key, unless its own cycle already uses it.
do $$
declare
  g record;
  n int;
  k text;
begin
  alter table okr_goals disable trigger okr_goals_version;
  for g in select id, workspace_id, cycle_id, title from okr_goals where key is null order by workspace_id, created_at, id loop
    select o.key into k from okr_goals o
      where o.workspace_id = g.workspace_id and o.cycle_id <> g.cycle_id and o.title = g.title and o.key is not null
        and not exists (select 1 from okr_goals x where x.workspace_id = g.workspace_id and x.cycle_id = g.cycle_id and x.key = o.key)
      order by o.created_at, o.id limit 1;
    if k is null then
      select coalesce(max(substring(key from 3)::int), 0) + 1 into n from okr_goals where workspace_id = g.workspace_id and key ~ '^G-[0-9]+$';
      k := 'G-' || n;
    end if;
    update okr_goals set key = k where id = g.id;
  end loop;
  alter table okr_goals enable trigger okr_goals_version;
end $$;

insert into okr_goal_keys (workspace_id, last)
  select workspace_id, max(substring(key from 3)::int) from okr_goals where key ~ '^G-[0-9]+$' group by workspace_id
  on conflict (workspace_id) do update set last = greatest(okr_goal_keys.last, excluded.last);

create or replace function okr_goal_key() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  last_n int;
  wanted text;
begin
  if tg_op = 'UPDATE' then
    -- A key never changes.
    if old.key is not null then new.key := old.key; end if;
    if new.key is not null then return new; end if;
  end if;
  -- One goal at a time per workspace: wait for anyone else adding a goal here.
  insert into okr_goal_keys (workspace_id, last) values (new.workspace_id, 0) on conflict (workspace_id) do nothing;
  select last into last_n from okr_goal_keys where workspace_id = new.workspace_id for update;
  if last_n = 0 then
    select coalesce(max(substring(key from 3)::int), 0) into last_n from okr_goals where workspace_id = new.workspace_id and key ~ '^G-[0-9]+$';
  end if;
  -- "g12" or "G-12": the same key.
  wanted := case when new.key ~* '^\s*g-?[0-9]{1,9}\s*$' then 'G-' || regexp_replace(new.key, '[^0-9]', '', 'g')::int else null end;
  if wanted is null or wanted = 'G-0' or exists (
    select 1 from okr_goals o where o.workspace_id = new.workspace_id and o.cycle_id = new.cycle_id and o.key = wanted and o.id <> new.id
  ) then
    last_n := last_n + 1;
    new.key := 'G-' || last_n;
  else
    new.key := wanted;
    last_n := greatest(last_n, substring(wanted from 3)::int);
  end if;
  update okr_goal_keys set last = last_n where workspace_id = new.workspace_id;
  return new;
end $$;

drop trigger if exists okr_goals_key on okr_goals;
create trigger okr_goals_key before insert or update of key on okr_goals for each row execute function okr_goal_key();

-- A deleted workspace's counter goes with it.
create or replace function okr_goal_keys_forget() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from okr_goal_keys where workspace_id = old.id;
  return old;
end $$;
drop trigger if exists okr_workspaces_goal_keys on okr_workspaces;
create trigger okr_workspaces_goal_keys after delete on okr_workspaces for each row execute function okr_goal_keys_forget();

alter table okr_goals alter column key set not null;
alter table okr_goals drop constraint if exists okr_goals_key_check;
alter table okr_goals add constraint okr_goals_key_check check (key ~ '^G-[1-9][0-9]*$');
create unique index if not exists okr_goals_cycle_key on okr_goals (workspace_id, cycle_id, key);

insert into okr_schema_migrations (name) values ('0021_goal_keys.sql') on conflict do nothing;
commit;
