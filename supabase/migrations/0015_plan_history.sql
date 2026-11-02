-- Every earlier plan of a number goal, oldest first, each with the week it stopped applying.
-- Old weeks and closed quarters are judged against the plan of their day, even after several re-plans.
alter table okr_goals add column if not exists plan_history jsonb;
