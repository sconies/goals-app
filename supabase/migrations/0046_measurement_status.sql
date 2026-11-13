-- A measurement status for metrics (backlog MS; docs/architecture/module-map.md, the MS row: split, Lane 3a, 13 Nov).
-- The metric library's side: each metric says Measured, Partly or Gap, with a line on what is missing.
-- The core's side: a goal held to no number (`unmeasured_since`), which the metric library fills in when the goal is
-- linked to a Gap metric and clears once that metric is measured. The status rules read the goal's column, never the
-- library's rows.
-- Ships one merge ahead of the code that writes them (AX10): until then nothing sets them, every metric reads as
-- Measured (the default) and no goal is held to no number. Saves pass through okr_upsert, which takes its columns from
-- the rows it is given (0011), so no function changes.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view or
-- policy is created. No redirect in public: 0035's views are fixed select * views and won't show these columns.
-- Grants: the tables' own grants and row rules already cover every column; the column grants below say so explicitly,
-- for the app's public key (anon) only, and widen nothing beyond these columns.
-- Safe to run twice: every column only if missing; constraints dropped and added again; no data moves.

-- Whether the metric is measured today: 'measured', 'partly' (some of it, or not every period) or 'gap' (not yet).
alter table faro.okr_metrics add column if not exists measurement text not null default 'measured';
alter table faro.okr_metrics drop constraint if exists okr_metrics_measurement_ok;
alter table faro.okr_metrics add constraint okr_metrics_measurement_ok check (measurement in ('measured', 'partly', 'gap'));
-- What is missing, and who is sorting it out, in words ('' when measured).
alter table faro.okr_metrics add column if not exists measurement_note text not null default '';
alter table faro.okr_metrics drop constraint if exists okr_metrics_measurement_note_len;
alter table faro.okr_metrics add constraint okr_metrics_measurement_note_len check (length(measurement_note) <= 300);

-- Held to no number since: set when the goal's number isn't measured yet; null when it is held to its plan as usual.
alter table faro.okr_goals add column if not exists unmeasured_since timestamptz;

grant select (measurement, measurement_note), insert (measurement, measurement_note), update (measurement, measurement_note)
  on faro.okr_metrics to anon;
grant select (unmeasured_since), insert (unmeasured_since), update (unmeasured_since) on faro.okr_goals to anon;

comment on column faro.okr_metrics.measurement is 'MS: measured, partly or gap. Goals measured by a gap metric are held to no number.';
comment on column faro.okr_metrics.measurement_note is 'MS: what is missing from the measurement, and who is sorting it out.';
comment on column faro.okr_goals.unmeasured_since is 'MS: held to no number since then (its metric is not measured yet); null otherwise. Set and cleared by the metric library.';
