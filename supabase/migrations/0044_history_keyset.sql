-- History paging (AX5 part 2): the app loads a window of the change log and pages older entries newest first, keyset
-- by (at, id) (src/ports/window.ts historyPage; Store.history in src/adapters/supabase/goalsStore.ts). These two
-- indexes answer a page in index order: a workspace's whole history, and one goal's (a goal's History).
-- 0003's okr_changes_ws_at and okr_changes_goal stay: they answer the windowed load's `at >= from` and older reads.
-- Ships one merge ahead of the code that pages with it (AX10); until then nothing reads by these keys, and nothing
-- breaks without them, it is only slower.
-- Runs as faro_owner with search_path faro (supabase/README.md): nothing outside faro. No table, column, function,
-- view, policy or check constraint is created, so no grant and no limit (src/spec/limits.ts) is needed.
-- Safe to run twice: `if not exists`.

create index if not exists okr_changes_ws_history on faro.okr_changes (workspace_id, at desc, id desc);

create index if not exists okr_changes_goal_history on faro.okr_changes (goal_id, at desc, id desc) where goal_id is not null;
