-- Metric quality (backlog MQ2; docs/design/mq2): a metric's stage (Draft, Defined, Verified) is worked out from its
-- definition and its verification, never stored. This migration adds what the stage is worked out from, and the
-- per-slice baselines, all on okr_metrics, plus a goal's own check-in rhythm on okr_goals.
--   calculation      what is measured and how it is aggregated, with a ratio's numerator and denominator (jsonb object)
--   time_window      point in time, rolling N days, per period or cumulative since a date (jsonb object). Not "window":
--                    that is a reserved word.
--   source_link      a link to the exact report or query; without one a metric is not Defined
--   source_query     the query text, optional
--   source_owner_id  the team or person who owns the source, when it is one of the workspace's (the text stays in
--                    source_owner); their people may verify
--   refresh_note     when in the period it refreshes ("Mondays")
--   calc_changed_by  who last changed its calculation, window or source, and when: they may not verify it
--   calc_changed_at
--   baselines        per slice (a team or the company, and an optional part): value, period, date taken, how; old ones
--                    kept with the reason they were replaced (jsonb array)
--   verification     the standing verification: who, when, the period, the figure reproduced, the stored figure, the
--                    note (jsonb object; null when not verified)
--   verify_attempts  "Couldn't reproduce" attempts, newest last (jsonb array)
--   lapse            why it is no longer Verified: what changed, who, when, the reason (jsonb object)
--   verifiers        people an admin named to verify it (jsonb array of person ids)
--   handover         passed to a new owner who hasn't confirmed yet: from whom, when, why (jsonb object)
--   to_confirm       a reworded filter or exclusion the last verifier is asked to confirm (jsonb object)
-- okr_goals.check_in_rhythm: 'monthly' or 'quarterly' when the goal's metric refreshes that often (its check-ins are
-- due then, never "No recent update" in between); null follows the cycle's rhythm. Set by the metric library, as
-- unmeasured_since is (0046); the check-in rules read the goal's column, never the library's rows.
-- All nullable: null is "not said", so every metric reads as Draft or Defined as the code decides, and every goal
-- keeps its cycle's rhythm, until something is set.
-- Ships one merge ahead of the code that writes them (AX10). Saves pass through the module's rows (okr_commit, 0039)
-- and okr_upsert (0011), which take their columns from the rows given, so no function changes.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view or
-- policy is created. No redirect in public: 0035's views are fixed select * views and won't show these columns.
-- Grants: the tables' own grants and row rules already cover every column; the column grants below say so explicitly,
-- for the app's public key (anon) only, and widen nothing beyond these columns.
-- Safe to run twice: every column only if missing; constraints dropped and added again; no data moves.

alter table faro.okr_metrics add column if not exists calculation jsonb;
alter table faro.okr_metrics add column if not exists time_window jsonb;
alter table faro.okr_metrics add column if not exists source_link text;
alter table faro.okr_metrics add column if not exists source_query text;
alter table faro.okr_metrics add column if not exists source_owner_id text;
alter table faro.okr_metrics add column if not exists refresh_note text;
alter table faro.okr_metrics add column if not exists calc_changed_by text;
alter table faro.okr_metrics add column if not exists calc_changed_at timestamptz;
alter table faro.okr_metrics add column if not exists baselines jsonb;
alter table faro.okr_metrics add column if not exists verification jsonb;
alter table faro.okr_metrics add column if not exists verify_attempts jsonb;
alter table faro.okr_metrics add column if not exists lapse jsonb;
alter table faro.okr_metrics add column if not exists verifiers jsonb;
alter table faro.okr_metrics add column if not exists handover jsonb;
alter table faro.okr_metrics add column if not exists to_confirm jsonb;

alter table faro.okr_metrics drop constraint if exists okr_metrics_calculation_ok;
alter table faro.okr_metrics add constraint okr_metrics_calculation_ok check (
  calculation is null or (jsonb_typeof(calculation) = 'object' and length(calculation::text) <= 6000));
alter table faro.okr_metrics drop constraint if exists okr_metrics_time_window_ok;
alter table faro.okr_metrics add constraint okr_metrics_time_window_ok check (
  time_window is null or (jsonb_typeof(time_window) = 'object' and time_window ->> 'kind' in ('point', 'rolling', 'period', 'cumulative')));
alter table faro.okr_metrics drop constraint if exists okr_metrics_source_link_ok;
alter table faro.okr_metrics add constraint okr_metrics_source_link_ok check (
  source_link is null or source_link = '' or (length(source_link) <= 500 and source_link ~* '^https?://'));
alter table faro.okr_metrics drop constraint if exists okr_metrics_source_query_len;
alter table faro.okr_metrics add constraint okr_metrics_source_query_len check (source_query is null or length(source_query) <= 4000);
alter table faro.okr_metrics drop constraint if exists okr_metrics_refresh_note_len;
alter table faro.okr_metrics add constraint okr_metrics_refresh_note_len check (refresh_note is null or length(refresh_note) <= 60);
alter table faro.okr_metrics drop constraint if exists okr_metrics_baselines_ok;
alter table faro.okr_metrics add constraint okr_metrics_baselines_ok check (
  baselines is null or (jsonb_typeof(baselines) = 'array' and jsonb_array_length(baselines) <= 400));
alter table faro.okr_metrics drop constraint if exists okr_metrics_verification_ok;
alter table faro.okr_metrics add constraint okr_metrics_verification_ok check (
  verification is null or (jsonb_typeof(verification) = 'object' and length(verification::text) <= 2000));
alter table faro.okr_metrics drop constraint if exists okr_metrics_verify_attempts_ok;
alter table faro.okr_metrics add constraint okr_metrics_verify_attempts_ok check (
  verify_attempts is null or (jsonb_typeof(verify_attempts) = 'array' and jsonb_array_length(verify_attempts) <= 20));
alter table faro.okr_metrics drop constraint if exists okr_metrics_lapse_ok;
alter table faro.okr_metrics add constraint okr_metrics_lapse_ok check (
  lapse is null or (jsonb_typeof(lapse) = 'object' and length(lapse::text) <= 2000));
alter table faro.okr_metrics drop constraint if exists okr_metrics_verifiers_ok;
alter table faro.okr_metrics add constraint okr_metrics_verifiers_ok check (
  verifiers is null or (jsonb_typeof(verifiers) = 'array' and jsonb_array_length(verifiers) <= 20));
alter table faro.okr_metrics drop constraint if exists okr_metrics_handover_ok;
alter table faro.okr_metrics add constraint okr_metrics_handover_ok check (
  handover is null or (jsonb_typeof(handover) = 'object' and length(handover::text) <= 1000));
alter table faro.okr_metrics drop constraint if exists okr_metrics_to_confirm_ok;
alter table faro.okr_metrics add constraint okr_metrics_to_confirm_ok check (
  to_confirm is null or (jsonb_typeof(to_confirm) = 'object' and length(to_confirm::text) <= 2000));

alter table faro.okr_goals add column if not exists check_in_rhythm text;
alter table faro.okr_goals drop constraint if exists okr_goals_check_in_rhythm_ok;
alter table faro.okr_goals add constraint okr_goals_check_in_rhythm_ok check (check_in_rhythm is null or check_in_rhythm in ('monthly', 'quarterly'));

grant select (calculation, time_window, source_link, source_query, source_owner_id, refresh_note, calc_changed_by, calc_changed_at,
    baselines, verification, verify_attempts, lapse, verifiers, handover, to_confirm),
  insert (calculation, time_window, source_link, source_query, source_owner_id, refresh_note, calc_changed_by, calc_changed_at,
    baselines, verification, verify_attempts, lapse, verifiers, handover, to_confirm),
  update (calculation, time_window, source_link, source_query, source_owner_id, refresh_note, calc_changed_by, calc_changed_at,
    baselines, verification, verify_attempts, lapse, verifiers, handover, to_confirm)
  on faro.okr_metrics to anon;
grant select (check_in_rhythm), insert (check_in_rhythm), update (check_in_rhythm) on faro.okr_goals to anon;

comment on column faro.okr_metrics.calculation is 'MQ2: what is measured (count, sum, value, duration, ratio, other) and how it is aggregated, with a ratio''s numerator and denominator.';
comment on column faro.okr_metrics.time_window is 'MQ2: the window: point in time, rolling N days, per period (week, month, quarter) or cumulative since a date.';
comment on column faro.okr_metrics.source_link is 'MQ2: a link to the exact report or query. Without one the metric is not Defined.';
comment on column faro.okr_metrics.source_query is 'MQ2: the query text, optional.';
comment on column faro.okr_metrics.source_owner_id is 'MQ2: the team or person (id) who owns the source, when it is one of the workspace''s.';
comment on column faro.okr_metrics.refresh_note is 'MQ2: when in the period the source refreshes, in words.';
comment on column faro.okr_metrics.calc_changed_by is 'MQ2: who last changed the calculation, window or source; they may not verify it.';
comment on column faro.okr_metrics.calc_changed_at is 'MQ2: when the calculation, window or source last changed.';
comment on column faro.okr_metrics.baselines is 'MQ2: baselines per slice (team or company, optional part), with History (replaced ones and why).';
comment on column faro.okr_metrics.verification is 'MQ2: the standing verification: who, when, period, figure reproduced, stored figure, note. Null: not verified.';
comment on column faro.okr_metrics.verify_attempts is 'MQ2: Couldn''t reproduce attempts: who, when, period, figure, stored figure, note.';
comment on column faro.okr_metrics.lapse is 'MQ2: why it is no longer Verified: what changed, who, when, their reason.';
comment on column faro.okr_metrics.verifiers is 'MQ2: people an admin named to verify it (person ids).';
comment on column faro.okr_metrics.handover is 'MQ2: passed to a new owner who has not confirmed yet: from whom, when, why.';
comment on column faro.okr_metrics.to_confirm is 'MQ2: a reworded filter or exclusion the last verifier is asked to confirm.';
comment on column faro.okr_goals.check_in_rhythm is 'MQ2: monthly or quarterly when the goal''s metric refreshes that often; null follows the cycle. Set by the metric library.';
