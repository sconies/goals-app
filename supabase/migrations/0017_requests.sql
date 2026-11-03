-- Requests for a decision or help (product review, 3 Nov). An owner raises one in a check-in; it stays open until the
-- person asked answers it or the owner withdraws it. goal_ids lists every goal waiting on it: the first is the one it
-- was raised on, and others are linked by their owners, so one answer covers them all. Rows are never deleted.
create table if not exists okr_requests (
  id text primary key,
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  goal_ids text[] not null check (cardinality(goal_ids) >= 1),
  asked_by text not null references okr_people (id) on delete cascade,
  recipient_id text references okr_people (id) on delete set null,
  ask text not null check (length(trim(ask)) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'answered', 'withdrawn')),
  check_in_id text,
  answer text,
  answered_by text references okr_people (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'answered' or (answer is not null and answered_at is not null))
);
create index if not exists okr_requests_workspace on okr_requests (workspace_id);
alter table okr_requests enable row level security;
-- Until sign-in lands, the same open access as the other okr_ tables.
drop policy if exists "demo: read" on okr_requests;
drop policy if exists "demo: add" on okr_requests;
drop policy if exists "demo: change" on okr_requests;
create policy "demo: read" on okr_requests for select to anon using (true);
create policy "demo: add" on okr_requests for insert to anon with check (true);
create policy "demo: change" on okr_requests for update to anon using (true) with check (true);
grant select, insert, update on okr_requests to anon;

-- The change log records requests: asked, edited, answered, linked, withdrawn.
alter table okr_changes drop constraint if exists okr_changes_entity_check;
alter table okr_changes add constraint okr_changes_entity_check
  check (entity in ('goal', 'check-in', 'decision', 'workspace', 'note', 'review', 'person', 'retro', 'cycle', 'request'));
alter table okr_changes drop constraint if exists okr_changes_action_check;
alter table okr_changes add constraint okr_changes_action_check
  check (action in ('created', 'edited', 'posted', 'approved', 'declined', 'acknowledged', 'asked', 'imported', 'reset', 'proposed', 'withdrawn', 'noted', 'actioned', 'removed', 'answered', 'linked'));

-- Requests already asked in check-ins (before this table) carry on as open requests: one per goal, from its latest
-- check-in, addressed to the person named before the colon when they're in the workspace.
insert into okr_requests (id, workspace_id, goal_ids, asked_by, recipient_id, ask, status, check_in_id, created_at, updated_at)
select 'req_' || c.id, c.workspace_id, array[c.goal_id], c.author_id,
       p.id,
       case when p.id is not null then trim(substr(c.ptg_needs, length(p.name) + 2)) else trim(c.ptg_needs) end,
       'open', c.id, c.posted_at, c.posted_at
from (
  select distinct on (goal_id) * from okr_check_ins order by goal_id, week desc, posted_at desc, id desc
) c
-- Only workspaces that exist, asked by someone who's still in them (old example rows can be left without a workspace).
join okr_workspaces w on w.id = c.workspace_id
join okr_people a on a.id = c.author_id and a.workspace_id = c.workspace_id
left join okr_people p on p.workspace_id = c.workspace_id and lower(c.ptg_needs) like lower(p.name) || ':%'
where coalesce(trim(c.ptg_needs), '') <> ''
on conflict (id) do nothing;

-- Saves write requests in the same transaction as everything else.
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
  perform okr_upsert('okr_changes', p->'changes', 'id', 'nothing');
end $$;

create or replace function okr_same_workspace(ws text, p jsonb) returns void
language plpgsql as $$
declare k text; r jsonb;
begin
  for k in select unnest(array['teams', 'people', 'cycles', 'goals', 'check_ins', 'reviews', 'feedback', 'retros', 'decisions', 'watches', 'tokens', 'views', 'requests', 'changes']) loop
    for r in select * from jsonb_array_elements(coalesce(p->k, '[]'::jsonb)) loop
      if (r->>'workspace_id') is distinct from ws then raise exception 'a % row belongs to another workspace', k using errcode = 'P0001'; end if;
    end loop;
  end loop;
end $$;

create or replace function okr_delete_workspace(ws text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if ws = 'example' then raise exception 'The example can’t be deleted.' using errcode = 'P0001'; end if;
  update okr_teams set lead_id = null where workspace_id = ws;
  update okr_goals set parent_id = null where workspace_id = ws;
  delete from okr_requests where workspace_id = ws;
  delete from okr_views where workspace_id = ws;
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
