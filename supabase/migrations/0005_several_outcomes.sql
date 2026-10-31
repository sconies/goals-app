-- A workspace can have several outcomes (headline goals), each with its own tree of goals feeding it.
drop index if exists okr_one_headline;
alter table okr_goals drop constraint if exists okr_one_headline;
