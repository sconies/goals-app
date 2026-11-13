-- Where a goal was proposed (goal entry GE10; docs/design/goal-entry/spec.md 2.15, "Home" and "Reviews").
-- One nullable column on faro.okr_goals: the review (okr_reviews.id) a goal was proposed in, so its owner's Home can
-- say "{Name} proposed a goal for you in {review}" and the next session's "Last time" can name it.
-- Ships one merge ahead of the code that writes it (AX10): until then nothing sets it, and the app's saves pass through
-- okr_upsert, which takes its columns from the rows it is given (0011), so the commit function needs no change.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro.
-- Grants: the column grants below are for the app's public key (anon) only and widen nothing beyond this column.
-- No table, function, view, constraint or policy is created. No redirect in public: 0035's views are fixed
-- select * views and won't show it, so the code that reads it ships only where the app reads through faro.
-- Safe to run twice: `if not exists`; the grant and comment are idempotent.

alter table faro.okr_goals add column if not exists proposed_in text;

grant select (proposed_in), insert (proposed_in), update (proposed_in) on faro.okr_goals to anon;

comment on column faro.okr_goals.proposed_in is 'GE10: the review (okr_reviews.id) the goal was proposed in; null when proposed elsewhere or active.';
