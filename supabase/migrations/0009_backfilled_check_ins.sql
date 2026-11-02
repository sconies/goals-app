-- Check-ins loaded later (from a spreadsheet or another tool) rather than posted in their week.
alter table okr_check_ins add column backfilled boolean not null default false;
