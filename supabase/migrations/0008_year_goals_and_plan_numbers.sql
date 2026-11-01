-- A goal can run past its cycle (to the end of the year), and its plan can be set as numbers by hand.
alter table okr_goals add column plan_end_week int check (plan_end_week is null or plan_end_week between 1 and 104);
alter table okr_goals add column plan_points jsonb;
-- A carried year goal's plan started before the current cycle, so its start week can be negative.
alter table okr_goals drop constraint if exists okr_goals_plan_from_week_check;
alter table okr_goals add constraint okr_goals_plan_from_week_check check (plan_from_week between -104 and 104);
