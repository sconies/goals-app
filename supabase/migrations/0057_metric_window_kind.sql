-- Metric quality (backlog MQ2), a fix to 0056 from the build review: okr_metrics_time_window_ok let an object with no
-- kind through ('{}' and '{"kind": null}'), because a check whose expression is null passes. Re-added with the kind
-- coalesced to '', so a window is null or an object whose kind is one of the four.
-- Nothing writes time_window yet (the code that does ships with or after this), so no row can break it.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view, policy
-- or grant changes. Safe to run twice: the constraint is dropped if it exists and added again.

alter table faro.okr_metrics drop constraint if exists okr_metrics_time_window_ok;
alter table faro.okr_metrics add constraint okr_metrics_time_window_ok check (
  time_window is null or (jsonb_typeof(time_window) = 'object' and coalesce(time_window ->> 'kind', '') in ('point', 'rolling', 'period', 'cumulative')));
