-- The metric library, round 2 (docs/design/metrics-2/spec.md, 6.1, migration A): a link's part, a metric's
-- retirement and its marks. MT2 writes `part`; MT3 writes the retirement columns and `marks`.
-- Ships one merge ahead of the code that writes them (AX10): until then nothing sets them, and saves pass through
-- okr_upsert, which takes its columns from the rows it is given (0011), so no function changes.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view or
-- policy is created. No redirect in public: 0035's views are fixed select * views and won't show these columns, so
-- the code writes them only when they hold something (a link with no part writes no `part`).
-- Grants: the tables' own grants and row rules already cover every column; the column grants below say so
-- explicitly, for the app's public key (anon) only, and widen nothing beyond these columns.
-- Safe to run twice: every column only if missing; no data moves.

-- Which part of a team's or the company's number a goal is measured by ('' for all of it).
alter table faro.okr_goal_metrics add column if not exists part text not null default '';
alter table faro.okr_goal_metrics drop constraint if exists okr_goal_metrics_part_len;
alter table faro.okr_goal_metrics add constraint okr_goal_metrics_part_len check (length(part) <= 60);

-- Retired: out of pickers and the list, its links kept (removed_at would drop them). Brought back by clearing these.
alter table faro.okr_metrics add column if not exists retired_at timestamptz;
alter table faro.okr_metrics add column if not exists retired_by text;
alter table faro.okr_metrics add column if not exists retired_why text not null default '';
alter table faro.okr_metrics drop constraint if exists okr_metrics_retired_why_len;
alter table faro.okr_metrics add constraint okr_metrics_retired_why_len check (length(retired_why) <= 300);
-- The metric that replaced it (a merge, or named on retiring). No foreign key: a deleted replacement still reads.
alter table faro.okr_metrics add column if not exists replaced_by text;

-- Changes of meaning or direction that goals must show: [{ week, at, by, kind, why, was, now }], oldest first.
alter table faro.okr_metrics add column if not exists marks jsonb not null default '[]'::jsonb;
alter table faro.okr_metrics drop constraint if exists okr_metrics_marks_array;
alter table faro.okr_metrics add constraint okr_metrics_marks_array check (jsonb_typeof(marks) = 'array');

grant select (part), insert (part), update (part) on faro.okr_goal_metrics to anon;
grant select (retired_at, retired_by, retired_why, replaced_by, marks),
      insert (retired_at, retired_by, retired_why, replaced_by, marks),
      update (retired_at, retired_by, retired_why, replaced_by, marks)
  on faro.okr_metrics to anon;

comment on column faro.okr_goal_metrics.part is 'MT2: which part of the team''s or company''s number the goal is measured by; empty for all of it.';
comment on column faro.okr_metrics.retired_at is 'MT3: when the metric was retired; null while in use. Its links are kept.';
comment on column faro.okr_metrics.marks is 'MT3: changes of meaning or direction goals show on their chart and History, oldest first.';
