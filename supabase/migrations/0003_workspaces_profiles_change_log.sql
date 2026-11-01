-- Workspaces (the example and your own), profiles, the review day, sponsor decisions and the change log.

create table okr_workspaces (
  id text primary key,
  name text not null check (length(trim(name)) >= 1),
  kind text not null check (kind in ('example', 'own')),
  created_at timestamptz not null default now()
);

-- Every existing row belongs to the example.
alter table okr_teams add column workspace_id text not null default 'example';
alter table okr_people add column workspace_id text not null default 'example';
alter table okr_cycles add column workspace_id text not null default 'example';
alter table okr_goals add column workspace_id text not null default 'example';
alter table okr_stages add column workspace_id text not null default 'example';
alter table okr_check_ins add column workspace_id text not null default 'example';

alter table okr_people add column profile text not null default 'contributor'
  check (profile in ('lead', 'sponsor', 'coach', 'contributor'));
update okr_people set profile = 'sponsor' where workspace_id = 'example' and id = 'elena';
update okr_people set profile = 'lead' where workspace_id = 'example' and id in ('maya', 'sam', 'kofi', 'jonas', 'aisha', 'leo');

alter table okr_cycles add column review_day int not null default 3 check (review_day between 0 and 6);

create table okr_decisions (
  id text primary key,
  workspace_id text not null default 'example',
  goal_id text not null references okr_goals (id) on delete cascade,
  check_in_id text references okr_check_ins (id) on delete set null,
  week int not null,
  kind text not null check (kind in ('approve-target', 'decline-target', 'acknowledge', 'ask')),
  by_id text not null references okr_people (id),
  at timestamptz not null default now(),
  note text not null default ''
);

-- The change log is append-only: no update or delete policy is ever granted on it.
create table okr_changes (
  id text primary key,
  workspace_id text not null default 'example',
  at timestamptz not null default now(),
  actor_id text not null,
  goal_id text,
  entity text not null check (entity in ('goal', 'check-in', 'decision', 'workspace')),
  entity_id text not null,
  action text not null check (action in ('created', 'edited', 'posted', 'approved', 'declined', 'acknowledged', 'asked', 'imported', 'reset')),
  summary text not null,
  diffs jsonb not null default '[]'::jsonb
);

create index okr_goals_ws on okr_goals (workspace_id);
create index okr_check_ins_ws on okr_check_ins (workspace_id);
create index okr_changes_ws_at on okr_changes (workspace_id, at);
create index okr_changes_goal on okr_changes (goal_id);
create index okr_decisions_goal on okr_decisions (goal_id);

alter table okr_workspaces enable row level security;
alter table okr_decisions enable row level security;
alter table okr_changes enable row level security;

-- Demo access, as in 0002, until sign-in lands. The change log can be added to and read, never edited.
do $$
declare t text;
begin
  foreach t in array array['okr_workspaces', 'okr_decisions'] loop
    execute format('create policy "demo: read" on %I for select to anon using (true)', t);
    execute format('create policy "demo: add" on %I for insert to anon with check (true)', t);
    execute format('create policy "demo: change" on %I for update to anon using (true) with check (true)', t);
    execute format('create policy "demo: remove" on %I for delete to anon using (true)', t);
    execute format('grant select, insert, update, delete on %I to anon', t);
  end loop;
end $$;
create policy "demo: read" on okr_changes for select to anon using (true);
create policy "demo: add" on okr_changes for insert to anon with check (true);
-- Resetting the example clears its log; nothing else may delete from it.
create policy "demo: reset the example" on okr_changes for delete to anon using (workspace_id = 'example');
grant select, insert, delete on okr_changes to anon;
