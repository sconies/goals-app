-- A goal can also help goals other than the one it feeds: a dotted line on the goal map, not part of the tree.
alter table okr_goals add column if not exists also_helps jsonb;
