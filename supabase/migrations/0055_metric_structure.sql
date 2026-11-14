-- Metric structure (backlog MQ; docs/architecture/module-map.md, the MQ row: part of the metric library, no switch of
-- its own). A register says how its metrics relate and how far to trust them; the library keeps that: each metric gets
-- a level (a component, driver, control or breakdown of another), an optional parent metric, a confidence in the number
-- (high, medium or low) and, in words, how it could be gamed. The library shows a metric with its children. Not a
-- second goal tree: goals still feed goals.
-- Four nullable columns on okr_metrics: null is "not said", so every metric reads as before until one is set.
-- The parent is another metric's id in the same workspace; the app checks it (no loops, not itself, not removed), the
-- column only that it isn't the metric itself.
-- Ships one merge ahead of the code that writes them (AX10). Saves pass through the module's rows (okr_commit, 0039),
-- which take their columns from the rows given, so no function changes; the module's row mapper writes all four.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view or
-- policy is created. No redirect in public: 0035's views are fixed select * views and won't show these columns.
-- Grants: the table's own grants and row rules already cover every column; the column grants below say so explicitly,
-- for the app's public key (anon) only, and widen nothing beyond these columns.
-- Safe to run twice: every column only if missing; constraints dropped and added again; no data moves.

alter table faro.okr_metrics add column if not exists level text;
alter table faro.okr_metrics add column if not exists parent_id text;
alter table faro.okr_metrics add column if not exists confidence text;
alter table faro.okr_metrics add column if not exists gaming text;

alter table faro.okr_metrics drop constraint if exists okr_metrics_level_ok;
alter table faro.okr_metrics add constraint okr_metrics_level_ok check (level is null or level in ('component', 'driver', 'control', 'breakdown'));
alter table faro.okr_metrics drop constraint if exists okr_metrics_confidence_ok;
alter table faro.okr_metrics add constraint okr_metrics_confidence_ok check (confidence is null or confidence in ('high', 'medium', 'low'));
alter table faro.okr_metrics drop constraint if exists okr_metrics_parent_not_self;
alter table faro.okr_metrics add constraint okr_metrics_parent_not_self check (parent_id is null or parent_id <> id);
alter table faro.okr_metrics drop constraint if exists okr_metrics_gaming_len;
alter table faro.okr_metrics add constraint okr_metrics_gaming_len check (gaming is null or length(gaming) <= 500);

grant select (level, parent_id, confidence, gaming), insert (level, parent_id, confidence, gaming),
  update (level, parent_id, confidence, gaming) on faro.okr_metrics to anon;

comment on column faro.okr_metrics.level is 'MQ: how it relates to its parent metric: component, driver, control or breakdown. Null: not said.';
comment on column faro.okr_metrics.parent_id is 'MQ: the metric it is a component, driver, control or breakdown of (same workspace). Null: none.';
comment on column faro.okr_metrics.confidence is 'MQ: how far the number can be trusted: high, medium or low. Null: not said.';
comment on column faro.okr_metrics.gaming is 'MQ: how the number could be gamed, in words (at most 500 characters). Null or empty: not said.';
