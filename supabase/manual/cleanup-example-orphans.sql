-- One-off clean-up (3 Nov 2026): rows left under workspace "example" from early testing, before workspaces had their
-- own record. There is no okr_workspaces row for "example", so nothing in the app can reach them. At the time:
-- 6 teams, 9 people, 1 cycle, 10 goals, 8 stages, 63 check-ins, 7 review decisions, 80 change-log entries.
-- Children first. Only runs while "example" still has no workspace record. Safe to run more than once.
begin;
do $$
begin
  if exists (select 1 from okr_workspaces where id = 'example') then
    raise notice 'Workspace "example" exists: nothing deleted.';
    return;
  end if;
  delete from okr_changes where workspace_id = 'example';
  delete from okr_decisions where workspace_id = 'example';
  delete from okr_requests where workspace_id = 'example';
  delete from okr_check_ins where workspace_id = 'example';
  delete from okr_stages where workspace_id = 'example';
  delete from okr_retros where workspace_id = 'example';
  delete from okr_watches where workspace_id = 'example';
  delete from okr_reviews where workspace_id = 'example';
  update okr_goals set parent_id = null where workspace_id = 'example';
  delete from okr_goals where workspace_id = 'example';
  delete from okr_cycles where workspace_id = 'example';
  delete from okr_people where workspace_id = 'example';
  delete from okr_teams where workspace_id = 'example';
end $$;
commit;
