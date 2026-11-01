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
