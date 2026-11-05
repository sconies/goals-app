-- One way to ask (consolidation 4, approved 5 Nov). Every ask that puts an obligation on someone is one row in
-- okr_requests: a decision or help (what the table held until now), an update asked of a goal's owner, a question for
-- an owner, or an action someone agreed to do. Each says who asked (asked_by), who must respond (recipient_id), by when
-- (due_week, optional), the goals it covers (goal_ids), and where it was raised (review_id and week, for a review's
-- question or action; check_in_id for a check-in's request). It's open until it's answered, done (an action) or
-- withdrawn, always explicitly. Comments (okr_changes, entity 'note') carry no obligation and never close an ask.
--
-- Why extend okr_requests rather than add okr_asks: the table already has the shape an ask needs (goals, who asked,
-- who's asked, a status, an answer, who answered and when), it is already written in the same transaction as every
-- other save (okr_write), read by the Data screen and the exports, and covered by the same access policies. A new
-- table would mean moving its rows and changing all of that for a different name. Its name stays; the app reads it as
-- asks (src/domain/asks.ts).
--
-- Data from before: a review's questions and actions (okr_decisions, kinds 'ask' and 'action') become asks of kinds
-- question and action, keeping their ids; a question counts as answered by its owner's first comment or check-in after
-- it (the rule it was shown under until now), an action is open. Asks for an update (comments recognised by their
-- summary or words) become update asks, keeping the comment's id: withdrawn if undone, answered if the owner has
-- checked in since, otherwise open; their log entries become the ask's. The app reads any rows this misses the same
-- way (upgradeAsks), so old rows stay readable. Safe to run more than once.

alter table okr_requests add column if not exists kind text not null default 'decision';
alter table okr_requests drop constraint if exists okr_requests_kind_check;
alter table okr_requests add constraint okr_requests_kind_check check (kind in ('decision', 'update', 'question', 'action'));
alter table okr_requests add column if not exists due_week int check (due_week is null or due_week between 0 and 60);
alter table okr_requests add column if not exists review_id text references okr_reviews (id) on delete set null;
alter table okr_requests add column if not exists week int;
-- 'done' is how an action is closed; its note (if any) is the answer.
alter table okr_requests drop constraint if exists okr_requests_status_check;
alter table okr_requests add constraint okr_requests_status_check check (status in ('open', 'answered', 'done', 'withdrawn'));
create index if not exists okr_requests_recipient on okr_requests (workspace_id, recipient_id) where status = 'open';

-- The change log records an action marked done.
alter table okr_changes drop constraint if exists okr_changes_action_check;
alter table okr_changes add constraint okr_changes_action_check
  check (action in ('created', 'edited', 'posted', 'approved', 'declined', 'acknowledged', 'asked', 'imported', 'reset', 'proposed', 'withdrawn', 'noted', 'actioned', 'removed', 'answered', 'linked', 'done'));

-- A review's questions become question asks, for the goal's owner.
insert into okr_requests (id, workspace_id, kind, goal_ids, asked_by, recipient_id, ask, status, review_id, week, created_at, updated_at, answer, answered_by, answered_at)
select d.id, d.workspace_id, 'question', array[d.goal_id], d.by_id, g.owner_id, d.note,
       case when a.id is null then 'open' else 'answered' end, d.review_id, d.week, d.at, coalesce(a.at, d.at),
       case when a.id is null then null else coalesce(
         (select x->>'to' from jsonb_array_elements(a.diffs) x where x->>'field' in ('Comment', 'Note', 'Why', 'Reason') limit 1), a.summary) end,
       a.actor_id, a.at
from okr_decisions d
join okr_goals g on g.id = d.goal_id
join okr_people p on p.id = d.by_id
left join lateral (
  select c.* from okr_changes c
  where c.goal_id = d.goal_id and c.actor_id = g.owner_id and c.at > d.at and c.entity in ('note', 'check-in')
  order by c.at limit 1
) a on true
where d.kind = 'ask' and coalesce(trim(d.note), '') <> ''
on conflict (id) do nothing;

-- A review's actions become action asks, for whoever does them (the owner when no one was named), still open.
insert into okr_requests (id, workspace_id, kind, goal_ids, asked_by, recipient_id, ask, status, due_week, review_id, week, created_at, updated_at)
select d.id, d.workspace_id, 'action', array[d.goal_id], d.by_id, coalesce(d.assignee_id, g.owner_id), d.note, 'open', d.due_week, d.review_id, d.week, d.at, d.at
from okr_decisions d
join okr_goals g on g.id = d.goal_id
join okr_people p on p.id = d.by_id
where d.kind = 'action' and coalesce(trim(d.note), '') <> ''
on conflict (id) do nothing;

delete from okr_decisions d where d.kind in ('ask', 'action') and exists (select 1 from okr_requests r where r.id = d.id);

-- Asks for an update (comments) become update asks for the goal's owner.
insert into okr_requests (id, workspace_id, kind, goal_ids, asked_by, recipient_id, ask, status, created_at, updated_at, answer, answered_by, answered_at)
select c.entity_id, c.workspace_id, 'update', array[c.goal_id], c.actor_id, g.owner_id, coalesce(c.diffs->0->>'to', 'Asked for an update'),
       case when w.id is not null then 'withdrawn' when ci.id is not null then 'answered' else 'open' end,
       c.at, coalesce(w.at, ci.posted_at, c.at),
       case when w.id is null and ci.id is not null then 'Checked in for week ' || ci.week end,
       case when w.id is null then ci.author_id end,
       case when w.id is null then ci.posted_at end
from okr_changes c
join okr_goals g on g.id = c.goal_id
join okr_people p on p.id = c.actor_id
left join lateral (select x.* from okr_changes x where x.entity = 'note' and x.action = 'withdrawn' and x.entity_id = c.entity_id order by x.at limit 1) w on true
left join lateral (select k.* from okr_check_ins k where k.goal_id = c.goal_id and k.posted_at > c.at order by k.posted_at limit 1) ci on true
where c.entity = 'note' and c.action = 'noted' and c.goal_id is not null
  and (c.summary = 'Asked for an update' or coalesce(c.diffs->0->>'to', '') like '%could you post an update%')
on conflict (id) do nothing;

-- …and their log entries are the ask's: asking, and taking it back.
update okr_changes c set entity = 'request', action = case when c.action = 'noted' then 'asked' else c.action end,
  summary = case when c.action = 'noted' then 'Asked for an update' else 'Withdrew the ask for an update' end
where c.entity = 'note' and exists (select 1 from okr_requests r where r.id = c.entity_id and r.kind = 'update');
