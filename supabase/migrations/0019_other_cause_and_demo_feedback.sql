-- Two small widenings (research notes, 3 Nov).
-- 1. A check-in's cause can be "other" (shown as "Something else") when none of the named causes fits; the owner's
--    words then carry it.
-- 2. Feedback sent from the demo is kept with the research notes (kind 'feedback'), so the people building the app can
--    read it. Before, it stayed in the sender's browser. Nobody can read this table through the app.
-- Both checks are found by what they say, as the original constraints were unnamed. Safe to run more than once.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'okr_check_ins'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%cause%' and pg_get_constraintdef(oid) like '%oneoff%' loop
    execute format('alter table okr_check_ins drop constraint %I', c);
  end loop;
  for c in select conname from pg_constraint where conrelid = 'okr_research_notes'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%first-glance%' loop
    execute format('alter table okr_research_notes drop constraint %I', c);
  end loop;
end $$;
alter table okr_check_ins add constraint okr_check_ins_cause_check
  check (cause in ('aggressive', 'slower', 'blocked', 'external', 'data', 'cautious', 'early', 'oneoff', 'other'));
alter table okr_research_notes add constraint okr_research_notes_kind_check
  check (kind in ('first-glance', 'comment', 'task', 'report', 'feedback'));
