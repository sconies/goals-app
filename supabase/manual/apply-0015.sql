-- Paste into Supabase → SQL editor → Run. Applies migration 0015 and records it,
-- so the CI migrator won't run it again. Safe to run more than once.
begin;
-- 0015: every earlier plan of a number goal, with the week it stopped applying.
alter table okr_goals add column if not exists plan_history jsonb;
insert into okr_schema_migrations (name) values ('0015_plan_history.sql') on conflict do nothing;
commit;
