-- Builds on 0024 (release 1): okr_write below starts from 0024's version (no okr_api_tokens upsert; feedback through
-- okr_feedback_add) and adds only what this release needs.
--
-- Remove, archive and undo (release 1b, Lane's decisions of 6 Nov): every kind of record that can be created can be
-- removed, archived or undone, with one pattern. Nothing is deleted from the database: a removed record keeps its row and
-- says when, and by whom. The app reads them out of every list in one place (src/domain/cycle.ts scopeToCycle), and an
-- admin can restore anything removed in the last 30 days (Workspace → Recently removed); after that it drops off the
-- list but the row stays. The rules for who may remove what, and what happens to whatever depended on it, are in
-- src/domain/removal.ts, shared by the app, the import and the MCP server.
--
--   okr_people      left_at, left_by: marked as left (goals and open asks handed over first, in the same save);
--                   removed_at, removed_by: deleted outright, only someone with no history.
--   okr_goals       stopped_at, stopped_by, stop_reason: stopped mid-cycle (a goal with check-ins);
--                   removed_at, removed_by: deleted (a goal with none).
--   okr_check_ins   removed_at, removed_by: deleted while it's still the goal's latest.
--   okr_decisions   edited_at: a review note's words corrected; removed_at, removed_by: the note deleted.
--   okr_reviews     ended_at, ended_by: ended (keeps its notes and actions); removed_at, removed_by: never held, deleted.
--   okr_cycles      removed_at, removed_by: deleted before anyone checked in.
--   okr_watches     removed_at, removed_by: stopped watching (kept, so it can be undone; watching again reuses the row).
--   okr_views       deleted_by, beside the deleted_at it already had.
--   okr_changes     import_id on every change an import or bulk edit made, and undo on its summary entry (what each
--                   record was before), so "Undo this import" can put every row back.
--
-- Comments stay in the change log (entity 'note'), as they always were: editing, removing and restoring one are new
-- entries for the same comment ('edited', 'removed', 'restored'), so the log stays append-only and old comments read as
-- before. Safe to run more than once.

alter table okr_people add column if not exists left_at timestamptz;
alter table okr_people add column if not exists left_by text;
alter table okr_people add column if not exists removed_at timestamptz;
alter table okr_people add column if not exists removed_by text;

alter table okr_goals add column if not exists removed_at timestamptz;
alter table okr_goals add column if not exists removed_by text;
alter table okr_goals add column if not exists stopped_at timestamptz;
alter table okr_goals add column if not exists stopped_by text;
alter table okr_goals add column if not exists stop_reason text;
alter table okr_goals drop constraint if exists okr_goals_stop_reason_check;
alter table okr_goals add constraint okr_goals_stop_reason_check
  check (stopped_at is null or length(trim(coalesce(stop_reason, ''))) between 1 and 2000);

alter table okr_check_ins add column if not exists removed_at timestamptz;
alter table okr_check_ins add column if not exists removed_by text;

alter table okr_decisions add column if not exists edited_at timestamptz;
alter table okr_decisions add column if not exists removed_at timestamptz;
alter table okr_decisions add column if not exists removed_by text;

alter table okr_reviews add column if not exists ended_at timestamptz;
alter table okr_reviews add column if not exists ended_by text;
alter table okr_reviews add column if not exists removed_at timestamptz;
alter table okr_reviews add column if not exists removed_by text;

alter table okr_cycles add column if not exists removed_at timestamptz;
alter table okr_cycles add column if not exists removed_by text;

alter table okr_watches add column if not exists removed_at timestamptz;
alter table okr_watches add column if not exists removed_by text;

alter table okr_views add column if not exists deleted_by text;

alter table okr_changes add column if not exists import_id text;
alter table okr_changes add column if not exists undo jsonb check (undo is null or jsonb_typeof(undo) = 'object');
create index if not exists okr_changes_import on okr_changes (workspace_id, import_id) where import_id is not null;

-- A deleted cycle no longer holds its start date: the year can be started again.
drop index if exists okr_cycles_ws_start;
create unique index if not exists okr_cycles_ws_start_live on okr_cycles (workspace_id, start_date) where removed_at is null;

-- The change log records removals and their undoing: stopped, ended, left, restored, undone; and saved views and
-- watches as things of their own.
alter table okr_changes drop constraint if exists okr_changes_entity_check;
alter table okr_changes add constraint okr_changes_entity_check
  check (entity in ('goal', 'check-in', 'decision', 'workspace', 'note', 'review', 'person', 'retro', 'cycle', 'request', 'view', 'watch'));
alter table okr_changes drop constraint if exists okr_changes_action_check;
alter table okr_changes add constraint okr_changes_action_check
  check (action in ('created', 'edited', 'posted', 'approved', 'declined', 'acknowledged', 'asked', 'imported', 'reset', 'proposed', 'withdrawn', 'noted', 'actioned', 'removed', 'answered', 'linked', 'done', 'restored', 'stopped', 'ended', 'left', 'undone'));

-- Saves: okr_write builds on 0024's version (release 1): it doesn't write okr_api_tokens, and feedback goes through
-- okr_feedback_add. The one change here: a watch is now updated like any other record (it was insert-only), so stopping
-- watching (removed_at) and watching again land in the same transaction as the rest of the save. The removal columns
-- travel with the rows they belong to, so every removal, restore and import undo is one okr_commit.
-- (okr_feedback_add comes with 0024; until it's there, feedback is written as 0022 wrote it.)
create or replace function okr_write(ws text, p jsonb) returns void
language plpgsql as $$
declare s jsonb;
begin
  perform okr_upsert('okr_teams', p->'teams', 'id');
  perform okr_upsert('okr_people', p->'people', 'id');
  perform okr_upsert('okr_cycles', p->'cycles', 'id');
  perform okr_upsert('okr_goals', p->'goals', 'id');
  for s in select * from jsonb_array_elements(coalesce(p->'stages', '[]'::jsonb)) loop
    delete from okr_stages where goal_id = s->>'goal_id' and not (id = any (array(select jsonb_array_elements_text(coalesce(s->'keep', '[]'::jsonb)))));
    perform okr_upsert('okr_stages', s->'rows', 'goal_id, id');
  end loop;
  perform okr_upsert('okr_check_ins', p->'check_ins', 'id');
  perform okr_upsert('okr_reviews', p->'reviews', 'id');
  if to_regprocedure('okr_feedback_add(text, jsonb)') is not null then
    execute 'select okr_feedback_add($1, $2)' using ws, p->'feedback';
  else
    perform okr_upsert('okr_feedback', p->'feedback', 'id', 'nothing');
  end if;
  perform okr_upsert('okr_retros', p->'retros', 'id');
  perform okr_upsert('okr_decisions', p->'decisions', 'id');
  perform okr_upsert('okr_watches', p->'watches', 'id');
  -- Saves from before 0025 removed a watch's row; the app now sets removed_at instead, and this stays for older clients.
  delete from okr_watches where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'unwatch', '[]'::jsonb))));
  perform okr_upsert('okr_views', p->'views', 'id');
  perform okr_upsert('okr_requests', p->'requests', 'id');
  -- A removed team's people and goals have moved above; a goal still on it stops the whole save.
  delete from okr_teams where workspace_id = ws and id = any (array(select jsonb_array_elements_text(coalesce(p->'remove_teams', '[]'::jsonb))));
  if coalesce(trim(p->>'workspace_name'), '') <> '' then
    update okr_workspaces set name = trim(p->>'workspace_name') where id = ws;
  end if;
  if jsonb_typeof(p->'workspace_recording') = 'boolean' then
    update okr_workspaces set recording = (p->>'workspace_recording')::boolean where id = ws;
  end if;
  perform okr_upsert('okr_changes', p->'changes', 'id', 'nothing');
end $$;
