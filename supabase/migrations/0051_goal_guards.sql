-- Guardrails on a goal (backlog GR; docs/architecture/module-map.md, the GR row: split, Lane 2a, 13 November).
-- A goal can name the counter-metrics that guard it: a range goal in the workspace (core: the limit is that goal's own
-- range), or, with the metric library on, a metric with a limit of its own. When a guard's latest number is past its
-- limit, the status rules turn the goal's calculated status off track and say which guard and by how much.
-- One nullable column on the goal: a JSON list, null or [] for none, so every goal reads as before until one is named.
-- Each entry is {"goal": "<goal id>"} or {"metric": "<metric id>", "slice": "<slice id or null>",
-- "bound": "atMost" | "atLeast", "limit": <number>}; the app checks the entries (domain/guards.ts), the column only its
-- shape and size.
-- Ships one merge ahead of the code that writes it (AX10). Saves pass through okr_upsert, which takes its columns from
-- the rows it is given (0011), so no function changes; the app's row mapper writes it on every row.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, function, view or
-- policy is created. No redirect in public: 0035's views are fixed select * views and won't show this column.
-- Grants: the table's own grants and row rules already cover every column; the column grant below says so explicitly,
-- for the app's public key (anon) only, and widens nothing beyond this column.
-- Safe to run twice: the column only if missing; the constraint dropped and added again; no data moves.

alter table faro.okr_goals add column if not exists guards jsonb;

-- A list of at most five guards.
alter table faro.okr_goals drop constraint if exists okr_goals_guards_shape;
alter table faro.okr_goals add constraint okr_goals_guards_shape check (
  guards is null or (jsonb_typeof(guards) = 'array' and jsonb_array_length(guards) <= 5));

grant select (guards), insert (guards), update (guards) on faro.okr_goals to anon;

comment on column faro.okr_goals.guards is 'GR: the guardrails on this goal, a JSON list of at most five: {"goal": id} (a range goal) or {"metric": id, "slice": id|null, "bound": "atMost"|"atLeast", "limit": n}. Null or []: none.';
