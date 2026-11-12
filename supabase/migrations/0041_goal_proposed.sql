-- A goal that is proposed, not yet active (goal entry GE10; docs/design/goal-entry/spec.md, 2.15, rule 14, section 12).
-- Two nullable columns on faro.okr_goals. Null proposed_at: the goal is active, as every goal is today.
-- Ships one merge ahead of the code that writes them (AX10): until then nothing sets them, and the app's saves pass
-- through okr_upsert, which takes its columns from the rows it is given (0011), so the commit function needs no change.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro.
-- Grants: none is new. The columns sit on a table whose grants (to anon) and row rules already cover every column;
-- no table, function, view or policy is created. No redirect in public: 0035's views are fixed select * views and
-- won't show these columns, so the code that reads them ships only where the app reads through faro.
-- Safe to run twice: `if not exists`, and the constraint is dropped and added again.

alter table faro.okr_goals add column if not exists proposed_at timestamptz;
alter table faro.okr_goals add column if not exists proposed_by text;

comment on column faro.okr_goals.proposed_at is 'GE10: when the goal was proposed; null means active. Never set with stopped_at.';
comment on column faro.okr_goals.proposed_by is 'GE10: the person (okr_people.id) who proposed it; set only with proposed_at.';

-- Proposed and stopped never hold together; a proposer is named only with the time.
alter table faro.okr_goals drop constraint if exists okr_goals_proposed_ok;
alter table faro.okr_goals add constraint okr_goals_proposed_ok
  check ((proposed_at is null or stopped_at is null) and (proposed_by is null or proposed_at is not null));
