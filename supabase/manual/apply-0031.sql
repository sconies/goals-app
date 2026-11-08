-- Paste into Supabase → SQL editor → Run. Applies migration 0031 (deleting a workspace removes its usage records too)
-- and records it, so the CI migrator won't run it again. Safe to run more than once.
begin;
-- Deleting a workspace removes everything kept about it (setup review, 8 Nov, item 11): okr_delete_workspace as 0017
-- left it, plus the usage records the app keeps per workspace (migration 0022's telemetry tables). Its goal-key counter
-- goes with the workspace already (0021's trigger). Markups stay: they are messages to the builders, kept in the builder
-- inbox, not the workspace's data.
-- Safe to run twice: the function is replaced whole.

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
  delete from okr_telemetry_spans where workspace_id = ws;
  delete from okr_telemetry_logs where workspace_id = ws;
  delete from okr_telemetry_metrics where workspace_id = ws;
  delete from okr_telemetry_daily where workspace_id = ws;
  delete from okr_workspaces where id = ws;
end $$;

insert into okr_schema_migrations (name) values ('0031_delete_workspace_fully.sql') on conflict do nothing;
commit;
