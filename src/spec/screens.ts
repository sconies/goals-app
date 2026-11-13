/* Each core screen's one main action, in words (spec/core/screens.md). The rest of a screen's entry (its routes, Help
   article, named parts, primary buttons and AI tools) is read from the code; this is the one thing written by hand,
   because a screen's main action is often worked out when it shows. src/spec/spec.test.ts checks every core screen
   has one, and none is left for a screen that's gone. Keyed by the file in src/screens, without .tsx. */
export const MAIN_ACTION: Record<string, string> = {
  Home: 'The lead’s, or none: what is asked of you today (late check-ins, check-ins due tomorrow or before today’s review, the wrap-up, a review on its day), or one quiet line that nothing is.',
  CheckInFlow: 'On the week’s list (/check-in), start with the first goal due, or pick any; then post each check-in, one goal at a time.',
  QuickCheckIn: 'Post every row of the table that is ready, at once, and land on the check-in’s confirmation.',
  Research: 'Start the research session.',
  Review: 'Walk the review’s goals worst first and mark each reviewed; on the list, open a review or set one up.',
  Watching: 'Open a goal you watch that needs attention.',
  Retro: 'Wrap up each goal you own: how it landed, what you learned, and carry it on or stop it.',
  StartNext: 'For an admin, once the wrap-up opens: read what carries on, finishes and stops, then Start the next year (it opens for everyone on its first Monday).',
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
  Settings: 'Change your own choices; see who you are here and go to your page.',
  Help: 'Find an answer: search, or open an article.',
  Start: 'On an invitation, choose which one you are, then go on to Home; on /ready, the one next thing after setting up.',
  Welcome: 'Set up a workspace; coming back, Open the workspace last opened (or Carry on a set-up left unfinished).',
};

/** A view, overlay or page with no route of its own: shown inside a screen, over every screen, or when nothing else
    can be. Each gets an entry in spec/core/screens.md like a route's, its fields, states and buttons read from its
    markup. `file` is where it's drawn, `component` scopes the reading to one function there, `where` how a person
    reaches it, `help` its Help article's id. src/spec/spec.test.ts checks every file in src/screens is a route's
    screen or one of these, and every article named exists. */
export interface OtherView { name: string; file: string; component?: string; where: string; help?: string; mainAction: string }

export const OTHER_VIEWS: OtherView[] = [
  { name: 'The navigation shell', file: 'src/ui/Shell.tsx', where: 'Around every signed-in screen: the sidebar on a desktop, the top bar and menu on a phone.', help: 'getting-around', mainAction: 'None of its own: it lights where you are and takes you to the other screens, Find and Help.' },
  { name: 'Find', file: 'src/ui/Find.tsx', where: 'Over any screen: Ctrl K (Cmd K on a Mac), or Find in the sidebar or the phone’s top bar.', help: 'finding', mainAction: 'Type a name, a few words or a goal’s key, and open what it finds.' },
  { name: 'The workspace switcher', file: 'src/ui/WorkspaceSwitch.tsx', component: 'WorkspaceSwitcher', where: 'In the shell, for someone in more than one workspace.', help: 'workspace', mainAction: 'Choose another workspace; you land on the same page there when it has one, else Home.' },
  { name: 'Goals: the table', file: 'src/screens/GoalTable.tsx', where: '/goals?view=table', help: 'goals', mainAction: 'Read the goals in rows and open one; tick several to change them together.' },
  { name: 'Goals: changing several at once', file: 'src/screens/BulkEdit.tsx', where: 'On the table, once goals are ticked.', help: 'goals', mainAction: 'Change the ticked goals’ owner or level, or watch them, checked and shown before it’s saved.' },
  { name: 'Goals: the board', file: 'src/screens/GoalBoard.tsx', where: '/goals?view=board', help: 'goals', mainAction: 'Read the goals grouped in columns by status, and open one.' },
  { name: 'Goals: the map', file: 'src/screens/GoalMap.tsx', where: '/goals?view=map', help: 'goal-map', mainAction: 'Follow how goals roll up to the ones above them, and open one.' },
  { name: 'Goals: stopped goals', file: 'src/screens/StoppedList.tsx', where: '/goals?state=stopped (the State filter)', help: 'goals', mainAction: 'Read the goals stopped this year in the scope, most recently stopped first, with who stopped each, when and why, and open one.' },
  { name: 'Goals: proposed goals', file: 'src/screens/ProposedList.tsx', where: '/goals?state=proposed (the count line’s “· {n} proposed”, or the State filter)', help: 'goal-proposed', mainAction: 'Read the proposed goals in the scope, newest first, with what each would measure, and open one.' },
  { name: 'A proposed goal’s page', file: 'src/screens/ProposedGoal.tsx', where: '/goals/:goalId, for a goal that is proposed, not yet active', help: 'goal-proposed', mainAction: 'For its owner or an admin, Make it active (or Finish it, when something is missing); for anyone else, comment, ask or watch.' },
  { name: 'Goals: history', file: 'src/screens/GoalHistory.tsx', where: '/goals?view=history', help: 'history', mainAction: 'Read each goal’s status week by week, and open one.' },
  { name: 'Goals: saved views and layouts', file: 'src/screens/GoalViews.tsx', where: 'The layout menu on Goals.', help: 'goals', mainAction: 'Choose how the goals are laid out, or save the filters you have as a view.' },
  { name: 'Goals: filters', file: 'src/screens/GoalFilters.tsx', where: 'The bar above every Goals layout.', help: 'goals', mainAction: 'Narrow the goals: search, scope, status, level and the rest.' },
  { name: 'Goals: the filter sheet', file: 'src/screens/GoalFilterSheet.tsx', where: 'Filters, from the bar on Goals (on a phone, every filter is here).', help: 'goals', mainAction: 'Set the filters, and see the goals they leave.' },
  { name: 'Check-in: the week’s list', file: 'src/screens/CheckInQueue.tsx', where: '/check-in, before a goal is chosen.', help: 'check-in', mainAction: 'Start with the first goal due, or pick any.' },
  { name: 'Check-in: the status sheet', file: 'src/screens/CheckInFlow.tsx', component: 'StatusSheet', where: 'In a check-in, from the status the numbers give, to choose another.', help: 'check-in', mainAction: 'Choose the status, and say why when it is better than the numbers give.' },
  { name: 'A goal: Respond', file: 'src/screens/Respond.tsx', where: 'On a goal’s page, under “Asked of you”; Home’s buttons open it with its box focused.', help: 'goal-page', mainAction: 'Answer what was asked, or mark the step done.' },
  { name: 'A review: one goal at a time', file: 'src/screens/Inspect.tsx', where: 'A review’s walk (/goals/:goalId?review=…), and a goal’s page during one.', help: 'reviews', mainAction: 'Say what the review decided about this goal, and go on to the next.' },
  { name: 'Data: filters', file: 'src/screens/DataFilters.tsx', where: 'Filter, on a table in Data.', help: 'data', mainAction: 'Narrow the rows a table shows.' },
  { name: 'Data: columns and layouts', file: 'src/screens/DataLayout.tsx', where: 'Columns, on a table in Data.', help: 'data', mainAction: 'Choose and order the columns, and save the layout.' },
  { name: 'Page not found', file: 'src/App.tsx', component: 'NotFound', where: 'Any address that leads nowhere.', mainAction: 'Go to Home.' },
  { name: 'The error page', file: 'src/telemetry/react.tsx', component: 'ErrorBoundary', where: 'Instead of a screen that failed to draw, or a part that can’t load while offline, or while a new version loads.', mainAction: 'Reload, or Try again when offline.' },
];

/** The widths every picture is taken at: a phone and a desktop, as the journeys run (KT gap 3). */
export const WIDTHS = [390, 1440] as const;
/**
 * A picture of each screen (by its name in MAIN_ACTION, or a view's in OTHER_VIEWS): who is looking (`who`, a person
 * in the demo; empty for nobody chosen yet), the address in the demo, and a key to press first (an overlay).
 * `npm run spec:shots` takes them into spec/core/screens/; screens.md shows them; src/spec/spec.test.ts checks every
 * one named is there and every core screen has one.
 */
export interface Shot { who: string; at: string; keys?: string; live?: boolean }
export const SHOTS: Record<string, Shot> = {
  Home: { who: 'rhea', at: '/' },
  CheckInFlow: { who: 'rhea', at: '/check-in/lead-flaky' },
  QuickCheckIn: { who: 'rhea', at: '/quick-check-in' },
  Research: { who: 'amara', at: '/research' },
  Review: { who: 'amara', at: '/reviews/weekly' },
  Watching: { who: 'rhea', at: '/goals?scope=watching' },
  Retro: { who: 'rhea', at: '/retro' },
  StartNext: { who: 'amara', at: '/workspace/cycles/next' },
  GoalsScreen: { who: 'amara', at: '/goals' },
  GoalWizard: { who: 'rhea', at: '/goals/new' },
  GoalScreen: { who: 'amara', at: '/goals/ns-lead' },
  GoalEdit: { who: 'rhea', at: '/goals/ns-lead/edit' },
  Print: { who: 'amara', at: '/goals/ns-lead/print' },
  Activity: { who: 'amara', at: '/activity' },
  DataTables: { who: 'amara', at: '/data' },
  Workspace: { who: 'amara', at: '/workspace' },
  People: { who: 'amara', at: '/people' },
  Feedback: { who: 'amara', at: '/feedback' },
  Onboarding: { who: 'amara', at: '/workspace/new' },
  Settings: { who: 'rhea', at: '/settings' },
  Help: { who: 'rhea', at: '/help' },
  Start: { who: '', at: '/join/ws_nope', live: true },
  Welcome: { who: '', at: '/welcome', live: true },
  'Check-in: the week’s list': { who: 'rhea', at: '/check-in' },
  'Goals: the table': { who: 'amara', at: '/goals?view=table' },
  'Goals: the board': { who: 'amara', at: '/goals?view=board' },
  'Goals: the map': { who: 'amara', at: '/goals?view=map' },
  'Goals: history': { who: 'amara', at: '/goals?view=history' },
  Find: { who: 'rhea', at: '/', keys: 'Control+K' },
  'Page not found': { who: 'rhea', at: '/nowhere' },
};
/** A picture's file in spec/core/screens/. */
export const shotFile = (name: string, width: number) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${width}.jpg`;
