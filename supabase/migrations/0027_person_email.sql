-- Release 3, one spreadsheet format (Lane's decisions of 7 Nov): people are matched by email. Every person gets an email
-- column: required when someone is added (src/domain/people.ts personProblems), kept lower case, and no two people in a
-- workspace share one. People added before this have none until an admin fills it in (Workspace lists them). A person
-- deleted outright gives their email up; one who left keeps it, so they can be restored. Saves need nothing new:
-- okr_upsert writes whichever columns a row carries. Safe to run more than once.

alter table okr_people add column if not exists email text;

alter table okr_people drop constraint if exists okr_people_email_check;
alter table okr_people add constraint okr_people_email_check check (
  email is null or (email = lower(btrim(email)) and length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create unique index if not exists okr_people_ws_email on okr_people (workspace_id, email)
  where email is not null and removed_at is null;
