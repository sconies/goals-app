/* Each core screen's one main action, in words (spec/core/screens.md). The rest of a screen's entry (its routes, Help
   article, named parts, primary buttons and AI tools) is read from the code; this is the one thing written by hand,
   because a screen's main action is often worked out when it shows. src/spec/spec.test.ts checks every core screen
   has one, and none is left for a screen that's gone. Keyed by the file in src/screens, without .tsx. */
export const MAIN_ACTION: Record<string, string> = {
  Home: 'The week’s one main thing: your check-ins when they’re due, then the wrap-up at the end of the year, then the review you’re in.',
  CheckInFlow: 'Post this week’s check-in, one goal at a time.',
  QuickCheckIn: 'Post every row of the table that is ready, at once, and land on the check-in’s confirmation.',
  Research: 'Start the research session.',
  Review: 'Walk the review’s goals worst first and mark each reviewed; on the list, open a review or set one up.',
  Watching: 'Open a goal you watch that needs attention.',
  Retro: 'Wrap up each goal you own: how it landed, what you learned, and carry it on or stop it.',
  GoalsScreen: 'Find goals (search, filter, sort, lay them out) and open one.',
  GoalWizard: 'Publish the goal, one question a step.',
  GoalScreen: 'The one main button for whoever is looking: answer what’s asked of you, check in when it’s due, mark your next step done, add a next step when it’s behind with none, or ask for an update; beside it the owner’s Check in again, or Watch.',
  GoalEdit: 'Save the change; a plan change after check-ins started needs a reason.',
  Print: 'Print the page.',
  Activity: 'Read what changed, filtered to what you need.',
  DataTables: 'Correct records in a table, every change checked and shown before it’s saved.',
  Workspace: 'For an admin, sort out what About lists; for anyone, read the facts and open the section each leads to.',
  People: 'Find a person or a team and go to their goals; for admins, Add a person on People and Add a team on Teams.',
  Feedback: 'Handle the open markup or feedback (in hand, fixed or won’t fix) and go on to the next.',
  Onboarding: 'Set up a workspace, one question a screen.',
  Settings: 'Change your own settings.',
  Help: 'Find an answer: search, or open an article.',
  Start: 'Say who you are, then go on to Home.',
};
