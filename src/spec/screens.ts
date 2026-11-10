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
  GoalScreen: 'For its owner, check in; for anyone else, respond: ask, note or watch.',
  GoalEdit: 'Save the change; a plan change after check-ins started needs a reason.',
  Print: 'Print the page.',
  Activity: 'Read what changed, filtered to what you need.',
  DataTables: 'Correct records in a table, every change checked and shown before it’s saved.',
  Workspace: 'Run the workspace one section at a time, each with its own main action: Add a person on People, Add a team on Teams; the overview says what needs attention here.',
  Feedback: 'Handle the open markup or feedback (in hand, fixed or won’t fix) and go on to the next.',
  Onboarding: 'Set up a workspace, one question a screen.',
  Settings: 'Change your own settings.',
  Help: 'Find an answer: search, or open an article.',
  Start: 'Say who you are, then go on to Home.',
};
