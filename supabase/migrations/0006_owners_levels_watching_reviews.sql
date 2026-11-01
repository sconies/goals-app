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
