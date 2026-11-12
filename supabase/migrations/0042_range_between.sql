-- A range kept between two bounds (two-sided range; Lane, 12 Nov). Today a range is one bound and one limit
-- (range_bound 'atMost' or 'atLeast', range_limit, range_margin). A range between two numbers keeps range_limit as its
-- upper bound and adds range_lower, its lower one, with range_bound 'between'. One-sided ranges are unchanged.
-- Ships one merge ahead of the code that writes it (AX10): until then nothing sets 'between' or range_lower, and the
-- app's saves pass through okr_upsert, which takes its columns from the rows it is given (0011), so the commit function
-- needs no change.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view or
-- policy is created. No redirect in public: 0035's views are fixed select * views and won't show range_lower, so the
-- code that reads it ships only where the app reads through faro.
-- Grants: one column grant, for the app's public key (anon) only, on the new column alone.
-- Safe to run twice: `if not exists`, and each check is dropped and added again.

alter table faro.okr_goals add column if not exists range_lower numeric;

grant select (range_lower), insert (range_lower), update (range_lower) on faro.okr_goals to anon;

comment on column faro.okr_goals.range_lower is 'Two-sided range: the lower bound when range_bound is between (range_limit is then the upper one); null otherwise.';

-- range_bound's own check from 0001 allows only atMost and atLeast. Postgres named it; drop it by what it says, so the
-- name it got (okr_goals_range_bound_check, unless renamed) doesn't matter, then add it again, named, with between.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'faro.okr_goals'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%range_bound%' and pg_get_constraintdef(oid) not like '%range_limit%'
      and pg_get_constraintdef(oid) not like '%range_lower%'
  loop
    execute format('alter table faro.okr_goals drop constraint %I', c);
  end loop;
end $$;

alter table faro.okr_goals add constraint okr_goals_range_bound_ok
  check (range_bound in ('atMost', 'atLeast', 'between'));

-- The lower bound is there exactly when the range is between, and below the upper one.
alter table faro.okr_goals drop constraint if exists okr_goals_range_lower_ok;
alter table faro.okr_goals add constraint okr_goals_range_lower_ok
  check (case when range_bound = 'between' then range_lower is not null and range_limit is not null and range_lower < range_limit
              else range_lower is null end);
