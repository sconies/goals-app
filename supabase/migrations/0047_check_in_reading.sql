-- Where a check-in's number came from (NR1; docs/design/round-4/readings/spec.md rule 2, and docs/design/metrics-2/spec.md
-- 5.3 and 6.2): what the metric's source said, when the source measured it, and, when the owner posted a different
-- number, why ({ "source", "value", "at", "why": { "kind": "behind" | "other-count" | "wrong" | "else", "text" } }).
-- Null when the number was typed with no reading to hand. Nothing in Faro's rules reads it to judge a goal.
-- One nullable column on faro.okr_check_ins. Ships one merge ahead of the code that writes it (AX10): until then nothing
-- sets it, and the app's saves pass through okr_upsert, which takes its columns from the rows it is given (0011), so
-- the commit function needs no change. The code writes it only when it holds something.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro.
-- Grants: the column grants below are for the app's public key (anon) only and widen nothing beyond this column.
-- No table, function, view or policy is created; the check constraint comes with the column. No redirect in public:
-- 0035's views are fixed select * views and won't show it, so the code that reads it ships only where the app reads
-- through faro.
-- Safe to run twice: `if not exists`; the grant and comment are idempotent.

alter table faro.okr_check_ins add column if not exists reading jsonb
  constraint okr_check_ins_reading_ok check (reading is null or (jsonb_typeof(reading) = 'object' and reading ? 'source' and reading ? 'value' and reading ? 'at'));

grant select (reading), insert (reading), update (reading) on faro.okr_check_ins to anon;

comment on column faro.okr_check_ins.reading is 'NR1: what the metric''s source said for this check-in ({source, value, at, why?}); null when typed with no reading. Never read to judge a goal.';
