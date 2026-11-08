-- Open inbox (backlog O, Lane, 8 Nov). Faro never holds real data, so its inbox needs no sign-in: anyone using the app
-- (the live app and the demo) reads every markup and piece of feedback, with their pictures, and changes a status.
-- Each change keeps who made it (status_by, the person using the app, or the token's person via MCP) and when
-- (status_at), and the app offers Undo. What a status needs is still the inbox's rule (src/markup/model.ts
-- statusPatch), backed by the tables' checks. The internal app keeps its inbox restricted (spec R1, rule 6): Faro opens
-- its own on purpose.
--
-- Relaxes 0024, 0026, 0028 and 0029:
--   1. Markups: the public key reads them, and changes their triage columns only (status, issue_url, fixed_in,
--      wont_fix_reason, status_by, status_at). Adding one is unchanged: only under an id the database issued.
--   2. Feedback: okr_feedback_inbox and okr_feedback_triage no longer need a builder signed in; the public key calls them.
--      Adding feedback is unchanged (okr_feedback_add, always new).
--   3. Pictures: the "markups" bucket becomes public-read, so any viewer opens a picture by its address. Uploading is
--      unchanged: only the four pictures, only into the folder of an issued id, never replacing or deleting. Nobody
--      can list the bucket. okr_markup_pictures_open says whether it is open, for the server's check.
--   4. Tokens: the MCP server's inbox functions (okr_markups_for_token and the others) take any live token, not only
--      a builder token.
-- The builders list (okr_builders), okr_is_builder and builder tokens stay in the database, unused by the app; an
-- existing builder token works as an ordinary token. Safe to run twice.

/* ---------- 1. Markups ---------- */

grant select on okr_markups to anon;
grant update (status, issue_url, fixed_in, wont_fix_reason, status_by, status_at) on okr_markups to anon;
drop policy if exists "markups: anyone reads" on okr_markups;
create policy "markups: anyone reads" on okr_markups for select to anon using (true);
drop policy if exists "markups: anyone triages" on okr_markups;
create policy "markups: anyone triages" on okr_markups for update to anon using (true) with check (true);

/* ---------- 2. Feedback ---------- */

-- Every workspace's feedback, newest first, with the workspace's and the sender's names. As 0026, for anyone.
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
   order by f.at desc, f.id desc
   limit least(greatest(coalesce(lim, 200), 1), 500)
$$;

-- A piece of feedback's status: only the triage columns (okr_feedback_patch, 0028), under the table's rules. For anyone.
create or replace function okr_feedback_triage(fid text, patch jsonb) returns setof okr_feedback
language sql volatile security definer set search_path = public as $$
  select * from okr_feedback_patch(fid, patch)
$$;

grant execute on function okr_feedback_inbox(int), okr_feedback_triage(text, jsonb) to anon;

/* ---------- 3. Pictures ---------- */

do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets set public = true where id = 'markups';
    execute $fn$
      create or replace function public.okr_markup_pictures_open() returns boolean
      language sql stable security definer set search_path = public as $body$
        select coalesce((select b.public from storage.buckets b where b.id = 'markups'), false)
      $body$
    $fn$;
  else
    execute $fn$
      create or replace function public.okr_markup_pictures_open() returns boolean
      language sql stable as $body$ select false $body$
    $fn$;
  end if;
end $$;
grant execute on function okr_markup_pictures_open() to anon;

/* ---------- 4. Any live token reaches the inbox through MCP ---------- */

-- Whether this is the hash of a live (not revoked) token. Only the functions below call it.
create or replace function okr_token_live(hash text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from okr_api_tokens t where t.token_hash = hash and t.revoked_at is null)
$$;
revoke execute on function okr_token_live(text) from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function okr_token_live(text) from %I', r);
    end if;
  end loop;
end $$;

create or replace function okr_markups_for_token(hash text, ws text default null, st text default null, lim int default 50) returns setof okr_markups
language plpgsql stable security definer set search_path = public as $$
begin
  if not okr_token_live(hash) then raise exception 'That token isn’t valid or has been revoked.' using errcode = 'P0001'; end if;
  return query select * from okr_markups m
    where (ws is null or (m.workspace_id = ws and not m.demo)) and (st is null or m.status = st)
    order by m.created_at desc limit least(greatest(coalesce(lim, 50), 1), 500);
end $$;

create or replace function okr_markup_for_token(hash text, mid text) returns setof okr_markups
language plpgsql stable security definer set search_path = public as $$
begin
  if not okr_token_live(hash) then raise exception 'That token isn’t valid or has been revoked.' using errcode = 'P0001'; end if;
  return query select * from okr_markups m where m.id = mid;
end $$;

create or replace function okr_markup_triage_for_token(hash text, mid text, patch jsonb) returns setof okr_markups
language plpgsql volatile security definer set search_path = public as $$
begin
  if not okr_token_live(hash) then raise exception 'That token isn’t valid or has been revoked.' using errcode = 'P0001'; end if;
  return query update okr_markups m set
      status = case when patch ? 'status' then patch->>'status' else m.status end,
      issue_url = case when patch ? 'issue_url' then patch->>'issue_url' else m.issue_url end,
      fixed_in = case when patch ? 'fixed_in' then patch->>'fixed_in' else m.fixed_in end,
      wont_fix_reason = case when patch ? 'wont_fix_reason' then patch->>'wont_fix_reason' else m.wont_fix_reason end,
      status_by = case when patch ? 'status_by' then patch->>'status_by' else m.status_by end,
      status_at = case when patch ? 'status_at' then (patch->>'status_at')::timestamptz else m.status_at end
    where m.id = mid returning m.*;
end $$;

create or replace function okr_feedback_for_token(hash text, ws text default null, st text default null, fid text default null, lim int default 50)
returns table (
  id text, workspace_id text, workspace_name text, person_id text, person_name text, path text, mood text, text text,
  at timestamptz, status text, fixed_in text, wont_fix_reason text, status_by text, status_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not okr_token_live(hash) then raise exception 'That token isn’t valid or has been revoked.' using errcode = 'P0001'; end if;
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
  if not okr_token_live(hash) then raise exception 'That token isn’t valid or has been revoked.' using errcode = 'P0001'; end if;
  return query select * from okr_feedback_patch(fid, patch);
end $$;
