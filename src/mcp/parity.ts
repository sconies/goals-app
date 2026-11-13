/* Parity between the app and its AI assistants: for every action a person can take (each write in AppState, and every
   action the dispatcher runs: app/actions.ts) and every screen they can read, the MCP tools that do the same, or why an
   assistant has no need of it. A test reads AppState, the dispatcher's table and the screens folder, so a new action or
   screen without an entry here fails the build. */

import { MODULES } from '../core/registry';

type Entry = string[] | { notForAssistants: string };

/** Each action in AppState (src/app/state.tsx) that changes something, and each action the dispatcher runs by name
    (src/app/actions.ts ACTIONS) that no AppState member is named for (`planChanges`, the undo toasts, `arrive`). */
export const ACTIONS: Record<string, Entry> = {
  // The change engine itself, which the goal, check-in, people and bulk tools all run (src/mcp/tools.ts planChanges).
  planChanges: ['bulk_change', 'create_goal', 'update_goal', 'set_plan_numbers', 'post_check_in', 'save_person'],
  activate: ['make_goal_active'],
  backToProposed: ['make_goal_proposed'],
  recordStagesDone: { notForAssistants: 'Marking which stages were already done at set-up is the owner’s own first step in the app; an assistant brings a goal in with create_goal or a workbook (bulk_change), and the owner records done stages at the first check-in (post_check_in).' },
  undoRemoval: { notForAssistants: 'Undoing a removal straight after it is the Undo on the app’s toast; an assistant that removed something brings it back with restore_removed (within 30 days).' },
  olderChanges: ['get_activity'],
  postCheckIn: ['post_check_in', 'bulk_change'],
  answerRequest: ['answer_request'],
  markActionDone: ['mark_action_done'],
  askQuestion: ['ask_question', 'review_call'],
  linkRequest: ['link_request'],
  withdrawRequest: ['withdraw_request'],
  saveGoal: ['create_goal', 'update_goal', 'set_plan_numbers', 'bulk_change'],
  addNote: ['add_comment'],
  askForUpdate: ['ask_for_update'],
  undoUpdateAsk: ['undo_update_ask'],
  reviewCall: ['review_call'],
  markReviewed: ['review_call'],
  acceptRisk: ['review_call'],
  addAction: ['add_action'],
  editCall: ['edit_call'],
  unmarkReviewed: ['unmark_reviewed'],
  arrive: { notForAssistants: 'An arrival is a person choosing their own name in the app for the first time; an assistant acts as someone who has already arrived, so there is nothing for it to say.' },
  watch: ['watch'],
  unwatch: ['unwatch'],
  saveReview: ['save_review'],
  savePerson: ['save_person'],
  saveRetro: ['wrap_up_goal'],
  sendFeedback: ['send_feedback'],
  startNextCycle: ['start_next_cycle'],
  previewChanges: ['bulk_change'],
  applyChanges: ['bulk_change'],
  createToken: ['create_token'],
  revokeToken: ['revoke_token'],
  saveView: ['save_view'],
  saveTableView: ['save_table_view'],
  deleteView: ['delete_view'],
  pinView: ['pin_view'],
  deleteWorkspace: ['delete_workspace'],
  renameWorkspace: ['rename_workspace'],
  saveTeam: ['save_team'],
  removeTeam: ['remove_team'],
  setRecording: ['set_recording'],
  setModule: ['set_feature'],
  markPersonLeft: ['mark_person_left'],
  leaveWorkspace: { notForAssistants: 'Leaving is a person’s own choice, made in the app; an assistant acts as someone and never takes them out. An admin’s assistant can mark someone as left.' },
  deletePerson: ['delete_person'],
  stopGoal: ['stop_goal'],
  deleteGoal: ['delete_goal'],
  deleteCheckIn: ['delete_check_in'],
  endReview: ['end_review'],
  deleteReview: ['delete_review'],
  editComment: ['edit_comment'],
  deleteComment: ['delete_comment'],
  deleteNote: ['delete_comment'],
  deleteCycle: ['delete_cycle'],
  undoStart: ['undo_start_cycle'],
  undoImport: ['undo_import'],
  restoreRemoved: ['restore_removed', 'list_removed'],
  run: { notForAssistants: 'The one way every action above is run (app/actions.ts): each action has its own entry here.' },
  createWorkspace: { notForAssistants: 'A token belongs to one workspace; a new workspace is set up in the app.' },
  switchWorkspace: { notForAssistants: 'A token belongs to one workspace: switching is choosing another token.' },
  resetExample: { notForAssistants: 'Only the demo has an example to reset, and tokens are for real workspaces.' },
  exampleSeed: { notForAssistants: 'The demo’s example as it was built is what its number sources are made from, read by the check-in’s number step; post_check_in reads the same source with reading_confirmed.' },
  setViewer: { notForAssistants: 'Saying who you are: a token already acts as one person.' },
};

/** Each core screen (src/screens), and the tools that read or do what it shows. A feature module lists its own screens'
    tools in its module.json `parity` (module map F8), merged in below, so the core names no module's screens or tools. */
const CORE_SCREENS: Record<string, Entry> = {
  Home: ['get_my_work', 'get_overview'],
  GoalsScreen: ['find_goals', 'get_overview'],
  GoalFilters: ['find_goals', 'list_views', 'save_view', 'delete_view', 'pin_view'],
  GoalFilterSheet: ['find_goals'],
  GoalViews: ['find_goals', 'get_goal', 'bulk_change'],
  GoalTable: ['find_goals', 'get_goal'],
  GoalBoard: ['find_goals'],
  GoalHistory: ['find_goals', 'get_goal'],
  BulkEdit: ['bulk_change', 'watch', 'export'],
  GoalMap: ['find_goals', 'get_overview'],
  GoalScreen: ['get_goal', 'add_comment', 'ask_question', 'ask_for_update', 'undo_update_ask', 'withdraw_request', 'mark_action_done', 'watch', 'unwatch', 'stop_goal', 'make_goal_proposed', 'delete_goal', 'delete_check_in', 'edit_comment', 'delete_comment'],
  GoalWizard: ['create_goal'],
  ProposedGoal: ['get_goal', 'make_goal_active', 'update_goal', 'delete_goal', 'add_comment', 'ask_question', 'watch'],
  ProposedList: ['find_goals'],
  StoppedList: ['find_goals'],
  GoalEdit: ['update_goal', 'set_plan_numbers'],
  CheckInFlow: ['post_check_in', 'link_request'],
  CheckInQueue: ['get_my_work', 'post_check_in'],
  QuickCheckIn: ['bulk_change', 'post_check_in'],
  Respond: ['answer_request', 'mark_action_done', 'ask_question', 'list_requests'],
  Watching: ['list_watching', 'find_goals', 'watch', 'unwatch'],
  Activity: ['get_activity', 'undo_import'],
  DataTables: ['list_people', 'bulk_change', 'list_requests', 'list_views', 'save_table_view', 'delete_view', 'pin_view'],
  DataFilters: ['export_table'],
  DataLayout: ['list_views', 'save_table_view', 'delete_view', 'pin_view'],
  Retro: ['get_wrap_up', 'wrap_up_goal', 'start_next_cycle'],
  StartNext: ['start_next_cycle', 'list_people'],
  Workspace: ['list_people', 'list_tokens', 'create_token', 'revoke_token', 'delete_workspace', 'rename_workspace', 'set_recording', 'set_feature', 'list_removed', 'restore_removed', 'delete_cycle', 'undo_start_cycle', 'start_next_cycle'],
  People: ['list_people', 'save_person', 'save_team', 'remove_team', 'mark_person_left', 'delete_person', 'create_token', 'find_goals'],
  Feedback: ['list_markups', 'get_markup', 'update_markup', 'list_feedback', 'get_feedback', 'update_feedback', 'review_inbox', 'send_feedback'],
  Settings: ['list_tokens', 'revoke_token', 'get_help'],
  Print: ['get_goal'],
  Help: ['get_help', 'whats_new'],
  Onboarding: { notForAssistants: 'Setting up a new workspace happens before there is a token for it.' },
  Start: { notForAssistants: 'Saying who you are on an invitation, and the screen right after set-up: a token already acts as one person in one workspace.' },
  Welcome: { notForAssistants: 'The front door, before anyone has chosen a workspace: a token already belongs to one.' },
  Research: { notForAssistants: 'Research sessions in the demo, for the people building the app.' },
  NotFound: { notForAssistants: 'An address that leads nowhere: a tool names what it can’t find in its own answer.' },
};

/** Every screen this build has, the core's and each module's: a core screen a module also adds to (Print shows a review)
    lists both modules' tools after the core's. A module left out of the build (FARO_WITHOUT) adds nothing. */
export const SCREENS: Record<string, Entry> = MODULES.reduce<Record<string, Entry>>((all, m) => {
  for (const [screen, tools] of Object.entries(m.parity ?? {})) {
    const had = all[screen];
    all[screen] = Array.isArray(had) && Array.isArray(tools) ? [...had, ...tools.filter((t) => !had.includes(t))] : tools;
  }
  return all;
}, { ...CORE_SCREENS });
