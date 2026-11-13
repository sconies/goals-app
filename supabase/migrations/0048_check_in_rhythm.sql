-- The check-in rhythm (backlog FT1, docs/design/feature-toggles): how often every goal is expected to have a check-in,
-- kept on the cycle beside the day they are due by (review_day). 1 = every week (the default: nothing changes for any
-- existing cycle); 0 = no set rhythm; 2 and 4 are allowed for later. rhythm_from is the day the present rhythm began
-- (null: the cycle's start): nothing is due or late for a time before it.
-- Ships one merge ahead of the code that writes it (AX10): until then nothing sets either column, and saves pass
-- through okr_upsert, which takes its columns from the rows it is given (0011); okr_create_workspace passes the
-- cycle's row through okr_write the same way. So no function changes.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No new table or function, so
-- no grant: a column takes its table's grants and row rules. No redirect in public: 0035's views are fixed
-- select * views and won't show these columns, so the code that reads them ships only where the app reads through faro.
-- Safe to run twice.

alter table faro.okr_cycles add column if not exists check_in_weeks smallint not null default 1;
alter table faro.okr_cycles add column if not exists rhythm_from date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'okr_cycles_check_in_weeks_ok' and conrelid = 'faro.okr_cycles'::regclass) then
    alter table faro.okr_cycles add constraint okr_cycles_check_in_weeks_ok check (check_in_weeks in (0, 1, 2, 4));
  end if;
end $$;

comment on column faro.okr_cycles.check_in_weeks is 'FT1: weeks between the check-ins every goal is expected to have; 1 every week, 0 no set rhythm.';
comment on column faro.okr_cycles.rhythm_from is 'FT1: the day the present rhythm began; null for the cycle''s start.';
