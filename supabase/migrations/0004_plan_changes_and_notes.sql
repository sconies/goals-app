-- A goal can hold one plan change waiting for the sponsor; decisions approve or decline it;
-- the change log records proposals, withdrawals and notes between check-ins.

alter table okr_goals add column pending jsonb;

alter table okr_decisions drop constraint okr_decisions_kind_check;
alter table okr_decisions add constraint okr_decisions_kind_check
  check (kind in ('approve-target', 'decline-target', 'approve-change', 'decline-change', 'acknowledge', 'ask'));

alter table okr_changes drop constraint okr_changes_entity_check;
alter table okr_changes add constraint okr_changes_entity_check
  check (entity in ('goal', 'check-in', 'decision', 'workspace', 'note'));

alter table okr_changes drop constraint okr_changes_action_check;
alter table okr_changes add constraint okr_changes_action_check
  check (action in ('created', 'edited', 'posted', 'approved', 'declined', 'acknowledged', 'asked', 'imported', 'reset', 'proposed', 'withdrawn', 'noted'));
