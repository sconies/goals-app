-- A goal with a baseline and nothing else yet (backlog GB; docs/architecture/module-map.md, the GB row: core, no switch,
-- inside GE10's proposed state). Loading a metrics register, many rows have a known current value but no agreed target
-- or date. While a number goal is proposed, its target may be left unset: it keeps its baseline (plan_start) and unit,
-- has no status and nothing due (as any proposed goal), says "Target not set", and is made active only once a target
-- is set. So plan_target may be null, but only on a proposed goal (proposed_at set); an active number goal keeps a
-- target that differs from its start, as before.
-- Ships one merge ahead of the code that writes a null target (AX10): until then every number goal has one, and this
-- check holds for every existing row. Saves pass through okr_upsert, which takes its columns from the rows it is given
-- (0011), so no function changes; the app's row mapper writes plan_target on every row (null when unset).
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view, policy
-- or grant is created or widened (plan_target and proposed_at are already granted).
-- Safe to run twice: the old check is dropped by what it says, the new one dropped by name and added again.

-- The number goal's check from 0001 (start, target and shape set; start differs from target). Postgres named it
-- (okr_goals_check, unless renamed); drop it by what it says, so the name it got doesn't matter.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'faro.okr_goals'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%plan_start <> plan_target%'
      and conname <> 'okr_goals_metric_plan'
  loop
    execute format('alter table faro.okr_goals drop constraint %I', c);
  end loop;
end $$;

-- A number goal has a start and a shape; a target that differs from its start, unless it is proposed with none yet.
alter table faro.okr_goals drop constraint if exists okr_goals_metric_plan;
alter table faro.okr_goals add constraint okr_goals_metric_plan check (
  kind <> 'metric' or (plan_start is not null and plan_shape is not null
    and ((plan_target is not null and plan_start <> plan_target) or (plan_target is null and proposed_at is not null))));

comment on column faro.okr_goals.plan_target is 'A number goal''s target. Null only while the goal is proposed with its target not set yet (GB).';
