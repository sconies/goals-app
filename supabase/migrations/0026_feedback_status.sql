-- Feedback joins the builder inbox (Lane, 6 Nov). What people send with Send feedback (a mood and a few words, in
-- okr_feedback) is listed in Workspace → Inbox beside markups, and triaged the same way, with the same states: New,
-- In hand, Fixed (in a What's new entry) and Won't fix (with a reason). Builders (okr_is_builder, migration 0024) read
-- every workspace's feedback and change its status through the two functions below; the public key still only adds
-- feedback (okr_feedback_add), always as new, and can't read the table or change a status. Workspace's own list of a
-- workspace's feedback (okr_feedback_list) is unchanged. Builds on 0024. Safe to run more than once.

alter table okr_feedback add column if not exists status text not null default 'new';
alter table okr_feedback add column if not exists fixed_in text;
alter table okr_feedback add column if not exists wont_fix_reason text;
alter table okr_feedback add column if not exists status_by text;
alter table okr_feedback add column if not exists status_at timestamptz;
alter table okr_feedback drop constraint if exists okr_feedback_status_check;
alter table okr_feedback add constraint okr_feedback_status_check check (
  status in ('new', 'in-hand', 'fixed', 'wont-fix')
  and (fixed_in is null or fixed_in ~ '^[a-z0-9][a-z0-9-]{0,79}$')
  and (wont_fix_reason is null or length(trim(wont_fix_reason)) between 1 and 2000)
  and (status_by is null or length(status_by) <= 200)
  and (status <> 'fixed' or fixed_in is not null)
  and (status <> 'wont-fix' or wont_fix_reason is not null)
);
create index if not exists okr_feedback_newest on okr_feedback (at desc, id desc);

-- The public key adds feedback with its own columns only; the status is the builders' to set.
revoke insert on okr_feedback from anon;
grant insert (id, workspace_id, person_id, path, mood, text, at) on okr_feedback to anon;

-- Feedback a save sends arrives new: its status is the builders' to set. As 0024 otherwise.
create or replace function okr_feedback_add(ws text, rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if rows is null or jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) = 0 then return; end if;
  if exists (select 1 from jsonb_array_elements(rows) r where (r->>'workspace_id') is distinct from ws) then
    raise exception 'a feedback row belongs to another workspace' using errcode = 'P0001';
  end if;
  perform okr_upsert('okr_feedback',
    (select jsonb_agg(r - 'status' - 'fixed_in' - 'wont_fix_reason' - 'status_by' - 'status_at') from jsonb_array_elements(rows) r),
    'id', 'nothing');
end $$;
grant execute on function okr_feedback_add(text, jsonb) to anon;

-- Every workspace's feedback, newest first, with the workspace's and the sender's names (as a markup carries them):
-- for a builder signed in to the inbox. Anyone else gets nothing.
create or replace function okr_feedback_inbox(lim int default 200) returns table (
  id text, workspace_id text, workspace_name text, person_id text, person_name text, path text, mood text, text text,
  at timestamptz, status text, fixed_in text, wont_fix_reason text, status_by text, status_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select f.id, f.workspace_id, coalesce(w.name, ''), f.person_id, coalesce(p.name, ''), f.path, f.mood, f.text,
         f.at, f.status, f.fixed_in, f.wont_fix_reason, f.status_by, f.status_at
    from okr_feedback f
    left join okr_workspaces w on w.id = f.workspace_id
    left join okr_people p on p.workspace_id = f.workspace_id and p.id = f.person_id
   where okr_is_builder()
   order by f.at desc, f.id desc
   limit least(greatest(coalesce(lim, 200), 1), 500)
$$;

-- A builder changes a piece of feedback's status: only the triage columns, under the table's rules. The rules for what
-- a status needs (fixed names a What's new entry, won't fix a reason) are the inbox's own (src/markup/model.ts
-- statusPatch), shared with markups; the table refuses a status without them.
create or replace function okr_feedback_triage(fid text, patch jsonb) returns setof okr_feedback
language plpgsql volatile security definer set search_path = public as $$
begin
  if not okr_is_builder() then raise exception 'Only builders, signed in to the inbox, change feedback.' using errcode = 'P0001'; end if;
  return query update okr_feedback f set
      status = case when patch ? 'status' then patch->>'status' else f.status end,
      fixed_in = case when patch ? 'fixed_in' then patch->>'fixed_in' else f.fixed_in end,
      wont_fix_reason = case when patch ? 'wont_fix_reason' then patch->>'wont_fix_reason' else f.wont_fix_reason end,
      status_by = case when patch ? 'status_by' then patch->>'status_by' else f.status_by end,
      status_at = case when patch ? 'status_at' then (patch->>'status_at')::timestamptz else f.status_at end
    where f.id = fid returning f.*;
end $$;

revoke execute on function okr_feedback_inbox(int), okr_feedback_triage(text, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function okr_feedback_inbox(int), okr_feedback_triage(text, jsonb) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function okr_feedback_inbox(int), okr_feedback_triage(text, jsonb) to authenticated';
  end if;
end $$;
