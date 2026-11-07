-- The AI triages feedback as it does markups (backlog 5), and "You raised this" for feedback (backlog 6). With a
-- builder token (0024), the MCP server lists, opens and triages feedback through the functions below; the inbox's own
-- (0026) need a builder signed in by email, which a token isn't. What a status needs is the inbox's rule
-- (src/markup/model.ts statusPatch), backed by the table's checks (0026). Builds on 0024 and 0026. Safe to rerun.

-- A piece of feedback's triage columns: shared by the inbox and the token. No key calls it on its own.
create or replace function okr_feedback_patch(fid text, patch jsonb) returns setof okr_feedback
language sql volatile security definer set search_path = public as $$
  update okr_feedback f set
      status = case when patch ? 'status' then patch->>'status' else f.status end,
      fixed_in = case when patch ? 'fixed_in' then patch->>'fixed_in' else f.fixed_in end,
      wont_fix_reason = case when patch ? 'wont_fix_reason' then patch->>'wont_fix_reason' else f.wont_fix_reason end,
      status_by = case when patch ? 'status_by' then patch->>'status_by' else f.status_by end,
      status_at = case when patch ? 'status_at' then (patch->>'status_at')::timestamptz else f.status_at end
    where f.id = fid returning f.*
$$;
revoke execute on function okr_feedback_patch(text, jsonb) from public;

-- The inbox's, as 0026, through it.
create or replace function okr_feedback_triage(fid text, patch jsonb) returns setof okr_feedback
language plpgsql volatile security definer set search_path = public as $$
begin
  if not okr_is_builder() then raise exception 'Only builders, signed in to the inbox, change feedback.' using errcode = 'P0001'; end if;
  return query select * from okr_feedback_patch(fid, patch);
end $$;

-- A builder token's: every workspace's feedback or one's, by status, or one piece by id, newest first, with the
-- workspace's and the sender's names (as okr_feedback_inbox gives them); and a change of status.
create or replace function okr_feedback_for_token(hash text, ws text default null, st text default null, fid text default null, lim int default 50)
returns table (
  id text, workspace_id text, workspace_name text, person_id text, person_name text, path text, mood text, text text,
  at timestamptz, status text, fixed_in text, wont_fix_reason text, status_by text, status_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if okr_token_builder(hash) is null then raise exception 'Only a builder token can read feedback.' using errcode = 'P0001'; end if;
  return query select f.id, f.workspace_id, coalesce(w.name, ''), f.person_id, coalesce(p.name, ''), f.path, f.mood, f.text,
         f.at, f.status, f.fixed_in, f.wont_fix_reason, f.status_by, f.status_at
    from okr_feedback f
    left join okr_workspaces w on w.id = f.workspace_id
    left join okr_people p on p.workspace_id = f.workspace_id and p.id = f.person_id
   where (ws is null or f.workspace_id = ws) and (st is null or f.status = st) and (fid is null or f.id = fid)
   order by f.at desc, f.id desc
   limit least(greatest(coalesce(lim, 50), 1), 500);
end $$;

create or replace function okr_feedback_triage_for_token(hash text, fid text, patch jsonb) returns setof okr_feedback
language plpgsql volatile security definer set search_path = public as $$
begin
  if okr_token_builder(hash) is null then raise exception 'Only a builder token can change feedback.' using errcode = 'P0001'; end if;
  return query select * from okr_feedback_patch(fid, patch);
end $$;

-- Which of a person's own feedback is where, for "You raised this" (as okr_markups_raised). Ids and status only.
create or replace function okr_feedback_raised(ws text, person text) returns table (id text, status text, fixed_in text)
language sql stable security definer set search_path = public as $$
  select f.id, f.status, f.fixed_in from okr_feedback f where f.workspace_id = ws and f.person_id = person order by f.at desc limit 200
$$;

grant execute on function okr_feedback_for_token(text, text, text, text, int), okr_feedback_triage_for_token(text, text, jsonb), okr_feedback_raised(text, text) to anon;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function okr_feedback_patch(text, jsonb) from %I', r);
    end if;
  end loop;
end $$;
