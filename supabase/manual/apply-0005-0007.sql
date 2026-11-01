-- Paste into Supabase → SQL editor → Run, in one go. Applies migrations 0005–0007 in a single transaction,
-- then records 0001–0007 so the CI migrator (scripts/migrate.mjs) won't run them again.
begin;

-- ===== 0005_several_outcomes =====
-- A workspace can have several outcomes (headline goals), each with its own tree of goals feeding it.
drop index if exists okr_one_headline;
alter table okr_goals drop constraint if exists okr_one_headline;

-- ===== 0006_owners_levels_watching_reviews =====
-- No roles: owners edit their goals, everyone else views. The person who sets up a workspace is an admin.
-- Every goal has a level (north star, SVP, team) for reporting at major reviews, separate from what it feeds.
-- People watch goals, whole trees or levels; reviews walk a set of goals on a cadence and record notes.

alter table okr_people add column is_admin boolean not null default false;
-- Kept for old rows only; the app no longer reads it.
alter table okr_people alter column profile set default 'contributor';

alter table okr_goals add column level text not null default 'team' check (level in ('north-star', 'svp', 'team'));
update okr_goals set level = 'north-star' where headline;
-- "Headline" no longer means anything; the app writes false. (Its 0001 check stays and is then always true.)

create table okr_watches (
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  person_id text not null references okr_people (id) on delete cascade,
  kind text not null check (kind in ('goal', 'tree', 'level')),
  ref text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, person_id, kind, ref)
);

create table okr_reviews (
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) >= 1),
  every_weeks int not null default 1 check (every_weeks between 1 and 13),
  weekday int not null default 3 check (weekday between 0 and 6),
  scope jsonb not null default '{"goals": [], "trees": [], "levels": []}',
  people jsonb not null default '[]',
  created_by text not null,
  created_at timestamptz not null default now()
);

-- What was said about a goal in a review: a note, a question for the owner, an action, or seen.
alter table okr_decisions add column review_id text references okr_reviews (id) on delete set null;
alter table okr_decisions drop constraint okr_decisions_kind_check;
alter table okr_decisions add constraint okr_decisions_kind_check
  check (kind in ('approve-target', 'decline-target', 'approve-change', 'decline-change', 'acknowledge', 'ask', 'note', 'action'));

alter table okr_changes drop constraint okr_changes_entity_check;
alter table okr_changes add constraint okr_changes_entity_check
  check (entity in ('goal', 'check-in', 'decision', 'workspace', 'note', 'review', 'person'));
alter table okr_changes drop constraint okr_changes_action_check;
alter table okr_changes add constraint okr_changes_action_check
  check (action in ('created', 'edited', 'posted', 'approved', 'declined', 'acknowledged', 'asked', 'imported', 'reset', 'proposed', 'withdrawn', 'noted', 'actioned', 'removed'));

-- Same open access as the other okr_ tables until sign-in arrives with SSO.
do $$
declare t text;
begin
  foreach t in array array['okr_watches', 'okr_reviews'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "demo: read" on %I for select to anon using (true)', t);
    execute format('create policy "demo: add" on %I for insert to anon with check (true)', t);
    execute format('create policy "demo: change" on %I for update to anon using (true) with check (true)', t);
    execute format('create policy "demo: remove" on %I for delete to anon using (true)', t);
    execute format('grant select, insert, update, delete on %I to anon', t);
  end loop;
end $$;

-- ===== 0007_retros_cycles =====
-- Closing a cycle: each owner's retro on their goals, and the next cycle carrying the goals that continue.

create table okr_retros (
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  goal_id text not null references okr_goals (id) on delete cascade,
  cycle_id text not null references okr_cycles (id) on delete cascade,
  result text not null check (result in ('hit', 'partly', 'missed')),
  learned text not null check (length(trim(learned)) >= 3),
  next text not null check (next in ('carry', 'stop')),
  by_id text not null,
  at timestamptz not null default now(),
  unique (goal_id, cycle_id)
);

alter table okr_changes drop constraint if exists okr_changes_entity_check;
alter table okr_changes add constraint okr_changes_entity_check
  check (entity in ('goal', 'check-in', 'decision', 'workspace', 'note', 'review', 'person', 'retro', 'cycle'));

-- Same open demo access as every other table until sign-in comes with SSO.
alter table okr_retros enable row level security;
create policy "demo: read" on okr_retros for select to anon using (true);
create policy "demo: add" on okr_retros for insert to anon with check (true);
create policy "demo: change" on okr_retros for update to anon using (true) with check (true);
create policy "demo: remove" on okr_retros for delete to anon using (true);
grant select, insert, update, delete on okr_retros to anon;

-- The feedback button: what people say about the app, and which screen they were on.
create table okr_feedback (
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  person_id text not null,
  path text not null default '',
  mood text not null check (mood in ('good', 'meh', 'bad')),
  text text not null default '',
  at timestamptz not null default now()
);
alter table okr_feedback enable row level security;
create policy "demo: read" on okr_feedback for select to anon using (true);
create policy "demo: add" on okr_feedback for insert to anon with check (true);
grant select, insert on okr_feedback to anon;

-- A goal set up mid-cycle plans from the week it was set up, not week 0.
alter table okr_goals add column plan_from_week int not null default 0 check (plan_from_week between 0 and 52);

-- Actions agreed in a review have someone to do them and, optionally, a week they're due.
alter table okr_decisions add column assignee_id text;
alter table okr_decisions add column due_week int check (due_week is null or due_week between 0 and 52);

-- Getting back on plan: an owner can be still investigating, need a decision, or think the target should
-- change. Only a plan needs a week it's back by. The original check (unnamed in 0001) is found by its text.
alter table okr_check_ins add column ptg_state text check (ptg_state is null or ptg_state in ('plan', 'investigating', 'help', 'target'));
do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'okr_check_ins'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%ptg_by_week%'
  loop
    execute format('alter table okr_check_ins drop constraint %I', c.conname);
  end loop;
end $$;
alter table okr_check_ins add constraint okr_check_ins_way_back check (
  status not in ('risk', 'off')
  or (length(trim(coalesce(ptg_what, ''))) >= 8
      and (coalesce(ptg_state, 'plan') <> 'plan' or coalesce(ptg_by_week, 0) > week))
);

-- Optional: why a goal is expected to help the one it feeds (a hypothesis, shown with the link).
alter table okr_goals add column why_helps text;

create table if not exists okr_schema_migrations (name text primary key, applied_at timestamptz not null default now());
insert into okr_schema_migrations (name) values
  ('0001_goals_and_check_ins.sql'),  ('0002_demo_access.sql'),  ('0003_workspaces_profiles_change_log.sql'),  ('0004_plan_changes_and_notes.sql'),  ('0005_several_outcomes.sql'),  ('0006_owners_levels_watching_reviews.sql'),  ('0007_retros_cycles.sql')
on conflict do nothing;
commit;
