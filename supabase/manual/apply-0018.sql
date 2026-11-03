-- Paste into Supabase → SQL editor → Run. Applies migration 0018 (calendar weeks for goal years) and records it,
-- so the CI migrator won't run it again. Safe to run more than once.
begin;
-- Calendar weeks for goal years (product review, 3 Nov). A goal year's week 1 is now the week with the first Thursday
-- of the month it starts in, so in a January year week n is ISO week n; the year runs to the week before the next
-- year's week 1, which makes some years 53 weeks long; week 0 is the week before week 1, for starting numbers.
-- Before this, week 0 was the week with the 1st of the month. Where that was a different week (the 1st fell on a
-- Monday to Thursday), the year's start moves back a week and every stored week number moves up by one, so each
-- check-in, stage and plan keeps its calendar date. Shorter cycles are unchanged. Safe to run more than once.

alter table okr_cycles drop constraint if exists okr_cycles_weeks_check;
alter table okr_cycles add constraint okr_cycles_weeks_check check (weeks between 1 and 53);
alter table okr_decisions drop constraint if exists okr_decisions_due_week_check;
alter table okr_decisions add constraint okr_decisions_due_week_check check (due_week is null or due_week between 0 and 53);

-- The Monday of week 1 of a goal year starting in a month: the week with that month's first Thursday.
create or replace function okr_week_one(y int, m int) returns date language sql immutable as $$
  select make_date(y, m, 1) + ((11 - extract(isodow from make_date(y, m, 1))::int) % 7) - 3
$$;

-- Weeks inside a plan (jsonb): its start week (when set), end week and plan numbers.
create or replace function okr_shift_plan(p jsonb, n int) returns jsonb language sql immutable as $$
  select case when p is null or jsonb_typeof(p) <> 'object' then p else
    p
    || case when coalesce((p->>'fromWeek')::int, 0) > 0 then jsonb_build_object('fromWeek', (p->>'fromWeek')::int + n) else '{}'::jsonb end
    || case when p ? 'endWeek' and p->'endWeek' <> 'null'::jsonb then jsonb_build_object('endWeek', (p->>'endWeek')::int + n) else '{}'::jsonb end
    || case when jsonb_typeof(p->'points') = 'array' then jsonb_build_object('points',
         coalesce((select jsonb_agg(x || jsonb_build_object('week', (x->>'week')::int + n)) from jsonb_array_elements(p->'points') x), '[]'::jsonb)) else '{}'::jsonb end
  end
$$;

do $$
declare
  c record;
  n int;
  y int;
  m int;
  goal_ids text[];
begin
  for c in select * from okr_cycles where weeks >= 48 loop
    y := extract(year from c.start_date + 10)::int;
    m := extract(month from c.start_date + 10)::int;
    n := (c.start_date - (okr_week_one(y, m) - 7)) / 7;
    -- Only the old rule's one-week difference is moved; anything else is left as it is.
    if n <> 1 or (c.start_date - (okr_week_one(y, m) - 7)) % 7 <> 0 then continue; end if;

    update okr_cycles set start_date = okr_week_one(y, m) - 7, weeks = (okr_week_one(y + 1, m) - okr_week_one(y, m)) / 7
      where workspace_id = c.workspace_id and id = c.id;
    select coalesce(array_agg(id), '{}') into goal_ids from okr_goals where workspace_id = c.workspace_id and cycle_id = c.id;

    update okr_goals set
      plan_from_week = case when plan_from_week > 0 then plan_from_week + n else plan_from_week end,
      plan_end_week = plan_end_week + n,
      rebaselined_week = rebaselined_week + n,
      plan_points = case when jsonb_typeof(plan_points) = 'array'
        then (select coalesce(jsonb_agg(x || jsonb_build_object('week', (x->>'week')::int + n)), '[]'::jsonb) from jsonb_array_elements(plan_points) x)
        else plan_points end,
      original_plan = okr_shift_plan(original_plan, n),
      plan_history = case when jsonb_typeof(plan_history) = 'array'
        then (select coalesce(jsonb_agg(v || jsonb_build_object('untilWeek', (v->>'untilWeek')::int + n, 'plan', okr_shift_plan(v->'plan', n))), '[]'::jsonb) from jsonb_array_elements(plan_history) v)
        else plan_history end
      where workspace_id = c.workspace_id and id = any (goal_ids);

    update okr_stages set due_week = due_week + n where workspace_id = c.workspace_id and goal_id = any (goal_ids);

    update okr_check_ins set
      week = week + n,
      ptg_by_week = ptg_by_week + n,
      stages = case when jsonb_typeof(stages) = 'array'
        then (select coalesce(jsonb_agg(u
          || case when u->'doneWeek' is not null and u->'doneWeek' <> 'null'::jsonb then jsonb_build_object('doneWeek', (u->>'doneWeek')::int + n) else '{}'::jsonb end
          || case when u->'forecastWeek' is not null and u->'forecastWeek' <> 'null'::jsonb then jsonb_build_object('forecastWeek', (u->>'forecastWeek')::int + n) else '{}'::jsonb end), '[]'::jsonb)
          from jsonb_array_elements(stages) u)
        else stages end
      where workspace_id = c.workspace_id and goal_id = any (goal_ids);

    update okr_decisions set week = week + n, due_week = due_week + n where workspace_id = c.workspace_id and goal_id = any (goal_ids);
  end loop;
end $$;

drop function okr_shift_plan(jsonb, int);
drop function okr_week_one(int, int);

insert into okr_schema_migrations (name) values ('0018_calendar_weeks.sql') on conflict do nothing;
commit;
