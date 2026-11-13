-- A baseline as a field of its own (backlog BL; docs/architecture/module-map.md, the BL row: core, no switch).
-- A register's baseline is a figure for a period (e.g. June to September 2026), often provisional. Until a goal's first
-- check-in it is shown as the goal's number, marked as the baseline, with its period and "provisional" when it is.
-- Firming up a provisional baseline is not a plan change: the plan (plan_start, plan_from_week) is left as it is.
-- Three nullable columns on the goal: no baseline is the default, and every goal reads as before until one is set.
-- Ships one merge ahead of the code that writes them (AX10). Saves pass through okr_upsert, which takes its columns from
-- the rows it is given (0011), so no function changes; the app's row mapper writes all three on every row.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view or
-- policy is created. No redirect in public: 0035's views are fixed select * views and won't show these columns.
-- Grants: the table's own grants and row rules already cover every column; the column grants below say so explicitly,
-- for the app's public key (anon) only, and widen nothing beyond these columns.
-- Safe to run twice: every column only if missing; constraints dropped and added again; no data moves.

-- The baseline figure, in the goal's unit; null when the goal has no baseline of its own.
alter table faro.okr_goals add column if not exists baseline_value numeric;
-- The period it covers, in words ("June to September 2026"); '' or null when not said.
alter table faro.okr_goals add column if not exists baseline_period text;
-- Whether it is provisional (may still be firmed up); null when there is no baseline.
alter table faro.okr_goals add column if not exists baseline_provisional boolean;

alter table faro.okr_goals drop constraint if exists okr_goals_baseline_period_len;
alter table faro.okr_goals add constraint okr_goals_baseline_period_len check (baseline_period is null or length(baseline_period) <= 60);
-- A period or a provisional flag only goes with a baseline figure.
alter table faro.okr_goals drop constraint if exists okr_goals_baseline_whole;
alter table faro.okr_goals add constraint okr_goals_baseline_whole check (
  baseline_value is not null or (coalesce(baseline_period, '') = '' and coalesce(baseline_provisional, false) = false));

grant select (baseline_value, baseline_period, baseline_provisional),
  insert (baseline_value, baseline_period, baseline_provisional),
  update (baseline_value, baseline_period, baseline_provisional) on faro.okr_goals to anon;

comment on column faro.okr_goals.baseline_value is 'BL: the baseline figure, in the goal''s unit; shown as its number until the first check-in. Null: none.';
comment on column faro.okr_goals.baseline_period is 'BL: the period the baseline covers, in words (at most 60 characters).';
comment on column faro.okr_goals.baseline_provisional is 'BL: true while the baseline may still be firmed up; firming it up is not a plan change.';
