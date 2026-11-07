-- Paste into Supabase → SQL editor → Run. Applies migration 0027 (an email for every person: lower case, no two people
-- in a workspace with the same one) and records it, so the CI migrator won't run it again. Needs 0025 first. Safe to
-- run more than once.
begin;

alter table okr_people add column if not exists email text;

alter table okr_people drop constraint if exists okr_people_email_check;
alter table okr_people add constraint okr_people_email_check check (
  email is null or (email = lower(btrim(email)) and length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create unique index if not exists okr_people_ws_email on okr_people (workspace_id, email)
  where email is not null and removed_at is null;

insert into okr_schema_migrations (name) values ('0027_person_email.sql') on conflict do nothing;
commit;
