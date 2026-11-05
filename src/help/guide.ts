/* The guide: what everything in the app does, one article per screen or feature, as data. The Help screens, the
   contextual Help link on every page and the AI assistant's get_help tool all read it from here.
   Keeping it true is enforced: src/help/guide.test.ts fails when a screen, a route or a requirement has no article,
   and CI fails a pull request that changes the app without a What's new entry (scripts/check-whats-new.mjs).
   Numbers that are rules (status bands, how long until a goal goes quiet) are read from the domain, never restated. */
import { CAUSES_AHEAD, CAUSES_BEHIND } from '../domain/checkin';
import { LABEL, RULES } from '../domain/status';
import { MEANING, RESULT_MEANING, RESULT_TEXT } from '../domain/story';

export type GroupId = 'start' | 'week' | 'goals' | 'leading' | 'data' | 'you';

/** The Help page's sections, in order. */
export const GROUPS: { id: GroupId; title: string }[] = [
  { id: 'start', title: 'Getting started' },
  { id: 'week', title: 'Your week' },
  { id: 'goals', title: 'Goals' },
  { id: 'leading', title: 'Reviews and the year' },
  { id: 'data', title: 'Data in and out' },
  { id: 'you', title: 'Workspace, settings and assistants' },
];

export interface GuideSection {
  /** "What it's for", "How to use it", "Who can", or a heading of its own. */
  heading: string;
  text?: string[];
  list?: string[];
}

export interface Article {
  id: string;
  title: string;
  /** One sentence: what it is and what it's for. */
  summary: string;
  group: GroupId;
  sections: GuideSection[];
  /** The routes it explains, as App.tsx writes them. A query (`/goals?view=map`) makes a route more specific; `*` means any value. */
  routes: string[];
  /** The files in src/screens it covers, without .tsx. */
  screens: string[];
  /** The requirement IDs (evals/requirements.json) it explains. */
  reqs: string[];
  /** Other words people might search for. */
  keywords: string[];
  related: string[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const causes = (list: [string, string][]) => list.map(([, l]) => l).join(', ');

export const ARTICLES: Article[] = [
  /* ---------- Getting started ---------- */
  {
    id: 'home',
    title: 'Home and your week at a glance',
    summary: 'Home shows what needs you this week: one main thing to do, what people have asked of you, and the goals you own and watch.',
    group: 'start',
    sections: [
      { heading: 'What it’s for', text: ['Home is where you start each week. It leads with the one thing most worth doing now, so you don’t have to hunt for it.'] },
      { heading: 'How to use it', list: [
        'The strip at the top is your week at a glance: your goals by status, your on-time streak, the goals you watch that need attention, and your next review. Each part opens the page behind it.',
        'Below it is the week’s main action. It is your check-ins when they are due, then the wrap-up at the end of the year, then the review you’re in.',
        'Needs your response lists what people have asked of you: questions from reviews, requests for a decision or help, actions agreed in a review and comments on your goals. Each has one button.',
        'Your goals come next, with what needs attention first and what is being handled folded away. Goals you watch follow.',
        'After a release you haven’t seen, a quiet line says what’s new. Open it, or dismiss it with the cross.',
      ] },
      { heading: 'Who can', text: ['Everyone has a Home. What is on it depends on the goals you own, the goals you watch and the reviews you’re in. There are no role labels.'] },
    ],
    routes: ['/'],
    screens: ['Home'],
    reqs: ['HOME-DASHBOARD', 'PROFILES'],
    keywords: ['dashboard', 'start', 'streak', 'needs your response', 'today', 'this week'],
    related: ['check-in', 'needs-attention', 'requests', 'watching'],
  },
  {
    id: 'status',
    title: 'What the statuses mean',
    summary: 'Every goal has a status, always shown as a shape and a word together.',
    group: 'start',
    sections: [
      { heading: 'The statuses', list: (['on', 'risk', 'off', 'stale', 'done'] as const).map((k) => (MEANING[k].startsWith(LABEL[k]) ? MEANING[k] : `${LABEL[k]}: ${MEANING[k]}`)) },
      { heading: 'The shapes', list: [
        `${LABEL.on}: a filled circle.`,
        `${LABEL.risk}: a half-filled circle.`,
        `${LABEL.off}: an open ring. Off track goals also get a quiet wash over the whole row or card.`,
        `${LABEL.stale}: a dashed ring.`,
        `${LABEL.done}: a circle with a tick.`,
      ] },
      { heading: 'Results, once a goal is due', list: (['completed', 'late', 'missed'] as const).map((k) => `${RESULT_TEXT[k]}: ${RESULT_MEANING[k]}`) },
      { heading: 'Whose call it is', text: [
        `The status is the owner’s call each week. The app works out what the numbers say and shows it beside the call. A call greener than the numbers needs a reason, and is flagged.`,
        `A number goal is judged against the plan for that week, whether higher or lower is better. A range goal is at risk inside its warning margin or after one breach, and off track after two weeks out of range. A stage up to ${RULES.lateWeeksOff} weeks late is at risk; later than that is off track.`,
      ] },
      { heading: 'Where to see it', text: ['The key under the goals on the Goals page has the same words. Open “What these mean” there for the full meanings.'] },
    ],
    routes: [],
    screens: [],
    reqs: ['STATUS-BANDS', 'STATUS-DIRECTION', 'RANGE', 'MILESTONE', 'OWNER-CALL', 'STALE', 'GREENER', 'DESIGN-RULES', 'A11Y'],
    keywords: ['legend', 'key', 'on track', 'at risk', 'off track', 'no recent update', 'done', 'colour', 'shape', 'completed late', 'did not meet', 'red', 'amber', 'green'],
    related: ['check-in', 'goal-page', 'needs-attention'],
  },
  {
    id: 'set-up',
    title: 'Setting up a workspace',
    summary: 'A workspace holds one organisation’s people, teams, goals and history. Setting one up takes about three minutes.',
    group: 'start',
    sections: [
      { heading: 'What it’s for', text: ['Start your own workspace from a template, your own spreadsheet, or nothing at all. Whoever sets it up is its first admin.'] },
      { heading: 'How to use it', list: [
        'Choose Set up your workspace. It asks one question per screen: the workspace’s name and the month its goal year starts, who you are, your team (typed, pasted or uploaded), and a starting point.',
        'A starting point can be one of four templates, your spreadsheet, a blank workspace, or goals set up later.',
        'Name the outcome, add the goals that feed it, then check each goal’s owner and target before you create the workspace.',
        'Weeks follow the calendar: week 1 is the week with the first Thursday of the starting month, so in a January year week n is ISO week n.',
        'The last screen gives you the one next thing to do, and a link to share with your team.',
      ] },
      { heading: 'Saying who you are', text: ['Until company sign-in arrives, the app asks “Who are you?” once on each device and remembers the answer. Choose Not you? in the person menu to change it.'] },
    ],
    routes: ['/workspace/new', '/ready'],
    screens: ['Onboarding', 'Start'],
    reqs: ['ONBOARDING', 'IDENTITY', 'WORKSPACES', 'CALENDAR-WEEKS'],
    keywords: ['onboarding', 'new workspace', 'template', 'who are you', 'sign in', 'first time', 'goal year'],
    related: ['workspace', 'import', 'new-goal'],
  },
  {
    id: 'demo',
    title: 'The demo',
    summary: 'The demo is a full copy of the app with example data, kept in your browser, that you can change and reset freely.',
    group: 'start',
    sections: [
      { heading: 'What it’s for', text: ['Try everything without touching real data. The demo lives under /demo; the real app never shows the example or the demo controls.'] },
      { heading: 'How to use it', list: [
        'Open Demo (in the sidebar, or the header on a phone) to see the app as someone else: a leader, a goal owner, an admin or a team member.',
        'Walkthroughs take you through the main journeys as the right person. A card says what to do and points at it; do the step and it moves on.',
        'Start over resets the example. You can switch to other example data sets, present without the controls, or leave.',
        'Research opens a hub for people and AI agents testing the app: tasks, a protocol and a report. Feedback sent from the demo reaches the people building the app.',
      ] },
    ],
    routes: ['/research'],
    screens: ['Research'],
    reqs: ['DEMO-MODE', 'WALKTHROUGHS', 'RESEARCH', 'DEMO-FEEDBACK', 'PERSIST'],
    keywords: ['example', 'try', 'walkthrough', 'tour', 'reset', 'start over', 'present', 'research', 'switch person'],
    related: ['home', 'set-up'],
  },

  /* ---------- Your week ---------- */
  {
    id: 'check-in',
    title: 'Checking in on a goal',
    summary: 'A check-in is the owner’s weekly word on a goal: the number or stages, the status, and, when something changed, why and what happens next.',
    group: 'week',
    sections: [
      { heading: 'What it’s for', text: ['Check-ins are how everyone knows where a goal stands. Reviews, Home, charts, quarter results and exports all read from them.'] },
      { heading: 'How to use it', list: [
        'Start check-in on Home walks through every goal due this week. From a goal’s page, Check in does just that goal.',
        'Type the number. The app shows it against this week’s plan, the gap and the status the numbers suggest, as you type.',
        `On plan, that’s it: post. Behind (under ${pct(RULES.onTrack)} of the planned progress) it asks for a cause and a sentence; well ahead (${pct(RULES.wellAhead)} or more) it asks why, and whether the target should change.`,
        `Causes when behind: ${causes(CAUSES_BEHIND)}. When ahead: ${causes(CAUSES_AHEAD)}. Something else lets you say it in your own words.`,
        'At risk and off track need a path to green: what changes, the week it is back on plan by, and any decision or help needed, from whom. All of it is one short account on one screen.',
        'If last week’s reason and path to green still hold, Still true posts them again, with any request still open. It’s changed opens them for editing.',
        'Milestone goals ask where each stage stands: done, on schedule, or late with a new week.',
        'The status is your call. Change it if the numbers don’t tell the whole story; a call greener than the numbers needs a reason.',
      ] },
      { heading: 'Ad hoc check-ins and corrections', list: [
        'Check in as often as you like. Every check-in is kept with its time; the latest in a week is that week’s status.',
        'Got something wrong? The receipt after posting links to correcting it. An admin can also correct a past check-in in Data.',
        'Answers you haven’t posted are kept as a draft and offered back when you return. Posting twice by accident is not possible.',
        'Right after publishing a goal, its owner is offered the first check-in, so everyone sees where it stands from day one.',
      ] },
      { heading: 'Who can', text: ['Only a goal’s owner checks in on it. Anyone can ask the owner for an update from the goal’s page.'] },
    ],
    routes: ['/check-in', '/check-in/:goalId'],
    screens: ['CheckInFlow'],
    reqs: ['CARRY-OVER', 'GREENER', 'REASON-BEHIND', 'REASON-AHEAD', 'PATH-TO-GREEN', 'CHECKIN-STATUS-VS-PLAN', 'ONE-PER-WEEK', 'UPDATE-ANYTIME', 'OWNER-ONLY', 'ONE-ACCOUNT', 'OTHER-CAUSE', 'NO-DOUBLE-POST', 'DRAFTS', 'FIRST-CHECKIN'],
    keywords: ['update', 'weekly', 'number', 'post', 'cause', 'reason', 'path to green', 'recovery', 'still true', 'correct', 'ad hoc', 'stages', 'milestone', 'behind', 'ahead'],
    related: ['check-in-table', 'requests', 'status', 'goal-page'],
  },
  {
    id: 'check-in-table',
    title: 'Typing all your numbers in one table',
    summary: 'If you own several number goals, type this week’s numbers for all of them on one screen.',
    group: 'week',
    sections: [
      { heading: 'What it’s for', text: ['A faster weekly check-in when most of your goals are on plan.'] },
      { heading: 'How to use it', list: [
        'On Home, choose “Or type all your numbers in one table” under Start check-in.',
        'Each row is judged as you type. A row that is off plan asks for a cause, a sentence and, when behind, how it gets back on plan.',
        'Post sends every row with a number. A row that still needs something says so under it, and nothing posts until it’s fixed.',
        'Numbers you typed are kept across a refresh until you post them. Use the normal check-in for milestones or a longer account.',
      ] },
      { heading: 'Who can', text: ['Owners, for their own number goals.'] },
    ],
    routes: ['/quick-check-in'],
    screens: ['QuickCheckIn'],
    reqs: ['BULK-EDIT', 'DRAFTS', 'NO-DOUBLE-POST'],
    keywords: ['quick check-in', 'table', 'all numbers', 'bulk', 'fast'],
    related: ['check-in', 'home'],
  },
  {
    id: 'requests',
    title: 'Requests for a decision or help',
    summary: 'When a goal needs someone else to act, its owner raises a request in the check-in. It stays open until it’s answered or withdrawn.',
    group: 'week',
    sections: [
      { heading: 'What it’s for', text: ['A request names what’s needed and from whom, so it can be answered once and not lost in a note.'] },
      { heading: 'How to use it', list: [
        'Owners: in a check-in that is behind, add “Need a decision or help”, say what is needed and pick who it goes to.',
        'The person asked sees it once on Home under Needs your response, however many goals wait on it. Respond opens the exact ask.',
        'Answer it closes the request for every goal waiting on it. Ask the owner first leaves it open and puts your question on the goal.',
        'On a goal’s page, open requests show with Respond and Withdraw. An owner whose goal waits on a request already raised for another goal can link to it instead of asking again.',
        'Still true in the next check-in carries an open request forward; dropping the ask withdraws it.',
      ] },
      { heading: 'Who can', list: ['Only the goal’s owner, or an admin, raises, links or withdraws a request.', 'Only the person asked, or an admin, answers it. A request to no one in particular can be answered by anyone.'] },
    ],
    routes: [],
    screens: ['Respond'],
    reqs: ['PATH-TO-GREEN'],
    keywords: ['decision', 'help', 'ask', 'answer', 'respond', 'withdraw', 'blocked', 'escalate'],
    related: ['check-in', 'home', 'reviews'],
  },
  {
    id: 'watching',
    title: 'Watching goals',
    summary: 'Watch the goals you care about but don’t own, and see what changed in them without opening each one.',
    group: 'week',
    sections: [
      { heading: 'What it’s for', text: ['Following other teams’ goals, or a whole level, the way a leader or a dependent team would.'] },
      { heading: 'How to use it', list: [
        'Watch a single goal from its page, a goal and everything feeding it, or a whole level (North star, SVP or Team).',
        'Watching (under Goals) groups them: what needs attention, what has gone quiet, what changed this week, then what is on track or done. What is being handled is folded away.',
        'For a goal with no recent update, ask its owner for an update. It shows as asked until they check in; whoever asked can undo it.',
        'Stop watching from the same place you started.',
      ] },
      { heading: 'Who can', text: ['Anyone can watch any goal.'] },
    ],
    routes: ['/watching'],
    screens: ['Watching'],
    reqs: ['WATCHING', 'ASK-UNDO'],
    keywords: ['follow', 'subscribe', 'watch', 'unwatch', 'ask for an update', 'quiet', 'gone quiet'],
    related: ['needs-attention', 'goal-page', 'home'],
  },

  /* ---------- Goals ---------- */
  {
    id: 'goals',
    title: 'Goals and its layouts',
    summary: 'Goals lists every goal this year. Tabs choose which goals and how they’re grouped; layouts choose how they look.',
    group: 'goals',
    sections: [
      { heading: 'What it’s for', text: ['Scanning the whole set of goals, or a slice of it, in whatever shape suits the question you have.'] },
      { heading: 'How to use it', list: [
        'Tabs: Trees (each top goal with what feeds it, worst first), Needs attention, By level, By team, Mine, and your saved views. Goals not linked to anything are flagged.',
        'Layouts: List, Table (sortable, with the headings kept in view), Board (lanes by status), History (quarter results and weekly status), Cards and Map. Your last layout is remembered and is in the link.',
        'Every goal that is off track, at risk or quiet tells its story where it is listed: why, what the owner will do, by when, and what they need from whom.',
        'In the Table, select goals to change their owner or level, watch them or export them.',
        'In the sidebar, Goals has Mine, Watching, All and your saved views under it.',
        'The status key sits under the goals. New goal is at the top right.',
      ] },
      { heading: 'Who can', text: ['Everyone sees every goal. Owners change their own goals from the Table; admins can change any.'] },
    ],
    routes: ['/goals', '/goals?view=list', '/goals?view=table', '/goals?view=board', '/goals?view=cards'],
    screens: ['GoalsScreen', 'GoalViews', 'GoalTable', 'GoalBoard', 'GoalCards', 'BulkEdit'],
    reqs: ['VIEWS', 'OUTCOME-TREE', 'HIERARCHY', 'STICKY-HEAD', 'NAV-GOALS', 'STORY', 'LEVELS', 'BULK-EDIT'],
    keywords: ['list', 'table', 'board', 'cards', 'trees', 'layout', 'by team', 'by level', 'mine', 'portfolio', 'outcomes', 'story'],
    related: ['goals-filters', 'history', 'goal-map', 'needs-attention'],
  },
  {
    id: 'goals-filters',
    title: 'Search, filters, sort and saved views',
    summary: 'Narrow the goals to what you need, sort them, and save the result as a view you can reopen or share.',
    group: 'goals',
    sections: [
      { heading: 'How to use it', list: [
        'Search finds goals where every word appears in the title, owner, team, level, the owner’s reason, recovery plan or definition.',
        'Filters cover status, level, team, owner and type; what needs someone (a decision, no recovery plan, a slipped or missed date, a call greener than the numbers); due date; weeks since the last check-in; last quarter met or missed; result; a goal’s tree; and also-helps links.',
        'Decision or help needed is one press. Each active filter shows as words you can remove.',
        'Sort by worst first, name, owner, team, level, furthest from plan, longest since a check-in or due soonest.',
        'Everything is in the link: Copy link shares exactly what you see. Save view keeps it as a tab of your own; rename or delete it from Views.',
      ] },
      { heading: 'Who can', text: ['Anyone saves their own views. Admins can pin a view for everyone.'] },
    ],
    routes: ['/goals?q=*', '/goals?status=*'],
    screens: ['GoalFilters'],
    reqs: ['SAVED-VIEWS'],
    keywords: ['search', 'filter', 'sort', 'saved view', 'pin', 'copy link', 'share', 'find'],
    related: ['goals', 'data'],
  },
  {
    id: 'needs-attention',
    title: 'Needs attention, and being handled',
    summary: 'Needs attention means something new since anyone looked. A goal that is behind but already in hand is shown as being handled.',
    group: 'goals',
    sections: [
      { heading: 'What it’s for', text: ['Keeping attention on the exceptions: what is off track, quiet or slipping, and that nobody has picked up yet.'] },
      { heading: 'How to use it', list: [
        'A goal is flagged when it is off track, has no recent update, is getting worse, has no path to green or has missed one. The reason is one line.',
        'An off track or at risk goal is being handled when, since its latest check-in, someone else marked it reviewed or noted it, an action was agreed (and isn’t overdue), or its request was answered.',
        'A new check-in, or a new warning, makes it need attention again.',
        'Home, Watching, Goals (Needs attention) and the review agenda all list the two apart, and say what is in hand: for example, “Action: Aisha, due week 46”.',
      ] },
    ],
    routes: ['/goals?show=attention'],
    screens: [],
    reqs: ['ATTENTION', 'ATTENTION-HANDLED', 'EXCEPTIONS-FIRST'],
    keywords: ['attention', 'handled', 'exceptions', 'flag', 'warning', 'slipping', 'worse', 'red'],
    related: ['status', 'home', 'reviews', 'watching'],
  },
  {
    id: 'history',
    title: 'History: quarter results and weekly status',
    summary: 'History shows how each goal did at the end of each quarter, and the owner’s weekly calls week by week.',
    group: 'goals',
    sections: [
      { heading: 'What it’s for', text: ['Seeing results over the year without mistaking a week’s confidence for a quarter’s result.'] },
      { heading: 'How to use it', list: [
        'Choose History among the Goals layouts. It opens on quarter results: each goal’s number at the end of each quarter against the owner’s plan, met or missed, with this quarter in progress.',
        'Weekly status is the other choice: each square is the owner’s call that week, one quarter at a time or the whole year.',
        'Select a square to read it in words beside the grid: the week and its dates, the goal, the call, the number and that week’s plan. The arrow keys move between squares.',
        'A goal year is about 52 weeks from the month the workspace picked, in four quarters. Quarter targets are read off the owner’s plan.',
      ] },
    ],
    routes: ['/goals?view=history'],
    screens: ['GoalHistory'],
    reqs: ['QUARTER-RESULTS', 'WEEK-INSPECTOR', 'YEAR', 'CALENDAR-WEEKS'],
    keywords: ['quarters', 'results', 'met', 'missed', 'weekly status', 'grid', 'year', 'Q1', 'Q2', 'Q3', 'Q4'],
    related: ['goals', 'wrap-up'],
  },
  {
    id: 'goal-map',
    title: 'The goal map',
    summary: 'The map draws every goal and how they connect, so you can see what feeds what and where the risk runs.',
    group: 'goals',
    sections: [
      { heading: 'How to use it', list: [
        'Choose Map among the Goals layouts. North stars are at the top; solid lines mean feeds into, dotted lines mean also helps.',
        'Pan, zoom and drag goals about. Branches fold and unfold; Fold all and Unfold all do every branch at once, and Tidy up puts dragged goals back.',
        'The critical path, the inputs most likely to make a top goal miss, is drawn bold. Only what needs attention narrows the map to that.',
        'Fit all shows everything small; Readable shows the critical path at a size you can read.',
        'Select a goal to read its story beside the map, then Open the goal. On a phone the map is a list, one goal per row.',
      ] },
    ],
    routes: ['/goals?view=map'],
    screens: ['GoalMap'],
    reqs: ['GOAL-MAP'],
    keywords: ['map', 'canvas', 'tree', 'critical path', 'also helps', 'feeds into', 'dependencies', 'graph'],
    related: ['goals', 'goal-page'],
  },
  {
    id: 'goal-page',
    title: 'A goal’s page',
    summary: 'Everything about one goal: where it stands, why, what’s being done, its chart and every check-in.',
    group: 'goals',
    sections: [
      { heading: 'What it’s for', text: ['Understanding one goal fully, and acting on it: checking in, answering, commenting or watching.'] },
      { heading: 'How to use it', list: [
        'Under the title: its key (G-12), what it feeds and its status, how many goals feed it, and how it’s measured.',
        'The status block leads with four facts: against plan, the trend over the last check-ins, the change since the last update, and the projection to the target.',
        'When the goal is behind, the path to green follows: the owner’s plan, their date, what they need and the next step. The owner’s date and the app’s projection are kept apart.',
        'The side column groups what is asked of you, what the owner says, signals worth knowing, and what was said in reviews.',
        'The chart shows the plan, the actual and the forecast; an earlier plan stays dotted. Below are the check-ins, contributing goals and what is most likely to make it miss.',
        'Comments and changes keeps every comment and saved change. Anyone can comment or ask a question.',
        'A slim header with the status and number stays in view as you scroll. Print or save as PDF makes a one-page copy.',
      ] },
      { heading: 'Who can', list: ['The owner checks in and edits; admins can edit any goal.', 'Anyone can watch, comment, or ask the owner for an update when it has gone quiet.'] },
    ],
    routes: ['/goals/:goalId'],
    screens: ['GoalScreen'],
    reqs: ['GOAL-PAGE', 'GOAL-SUMMARY', 'NOTES', 'FORECAST', 'STORY', 'ASK-UNDO'],
    keywords: ['goal', 'chart', 'facts', 'projection', 'forecast', 'comments', 'path to green', 'contributing', 'trend', 'owner'],
    related: ['check-in', 'edit-goal', 'keys', 'print'],
  },
  {
    id: 'keys',
    title: 'Goal keys and record IDs',
    summary: 'Every goal has a short key, such as G-12, that never changes. Every record also has an ID of its own.',
    group: 'goals',
    sections: [
      { heading: 'How to use it', list: [
        'Keys are given in the order goals are created, per workspace, and are never reused. A goal carried into the next year keeps its key.',
        'You’ll see the key on the goal’s page, in the Goals table, in Data and in exports.',
        'Open a goal straight from its key: /goals/G-12.',
        'Imports and AI assistants accept a key wherever a goal’s ID goes. Check-ins, plans and people have IDs that never change, shown first in Data.',
      ] },
    ],
    routes: [],
    screens: [],
    reqs: ['READABLE-IDS'],
    keywords: ['key', 'id', 'G-1', 'identifier', 'reference', 'link to a goal'],
    related: ['goal-page', 'data', 'import'],
  },
  {
    id: 'new-goal',
    title: 'Setting up a goal',
    summary: 'A new goal takes a few short steps: what you want to achieve, the type, the numbers or stages, and where it fits.',
    group: 'goals',
    sections: [
      { heading: 'How to use it', list: [
        'Choose New goal. Name it the way your team would say it.',
        'Pick a type. Move a number: from where it is to where it should be. Keep a number in range: a limit it mustn’t cross, with a margin that warns you. Hit dated stages: work that is done or not, by a week.',
        'For a number, say how progress will come: the same every week, a slow start (back-loaded), or jumps as each release ships. That sets the weekly plan the status is judged against. Any week can be typed over.',
        'Say what it feeds into and, optionally, why it is expected to help. Set its level: Team, SVP or North star, for goals reported at major reviews.',
        'Check and publish. The owner is then offered the first check-in.',
        'A goal is due at the end of the year or at the end of a quarter still to come. An unfinished goal is kept as a draft.',
      ] },
      { heading: 'Who can', text: ['Anyone can set up a goal, for themselves or for someone else. Someone publishing for another person can ask them for the first check-in.'] },
    ],
    routes: ['/goals/new'],
    screens: ['GoalWizard'],
    reqs: ['GOAL-CREATE', 'PLAN-SHAPE', 'LEVELS', 'FIRST-CHECKIN', 'HIERARCHY'],
    keywords: ['create', 'new goal', 'metric', 'range', 'milestone', 'stages', 'plan', 'target', 'guardrail', 'level', 'north star'],
    related: ['edit-goal', 'check-in', 'goals'],
  },
  {
    id: 'edit-goal',
    title: 'Changing a goal or its plan',
    summary: 'Edit a goal’s details, owner, links or plan. Once check-ins have started, a plan change needs a reason.',
    group: 'goals',
    sections: [
      { heading: 'How to use it', list: [
        'Open the goal and choose Edit.',
        'Change the title, definition, data source, owner, level, what it feeds and what it also helps.',
        'Plan by week shows the numbers week by week; type over any week.',
        'After check-ins have started, a change to the plan or target asks why, in a sentence. Watchers see it flagged, and it is in the goal’s activity.',
        'The original plan stays on the chart, dotted, and earlier weeks and closed quarters stay judged against the plan of their day. There is no approval step.',
        'A goal’s type can’t change once check-ins have started.',
      ] },
      { heading: 'Who can', text: ['The goal’s owner, or an admin.'] },
    ],
    routes: ['/goals/:goalId/edit'],
    screens: ['GoalEdit'],
    reqs: ['PLAN-CHANGE', 'REBASELINE', 'HONEST-NUMBERS'],
    keywords: ['edit', 'change plan', 're-plan', 'rebaseline', 'target', 'reason', 'owner', 'links'],
    related: ['new-goal', 'goal-page', 'activity'],
  },

  /* ---------- Reviews and the year ---------- */
  {
    id: 'reviews',
    title: 'Reviews',
    summary: 'A review walks a set of goals together on a cadence, worst and stalest first, and keeps what was said.',
    group: 'leading',
    sections: [
      { heading: 'What it’s for', text: ['A regular look at the goals that need it, with notes, questions and actions that stick to the goal.'] },
      { heading: 'Setting one up', list: [
        'Choose Set up a review on Reviews. Give it a name and a cadence: every 1, 2 or 4 weeks, on a weekday.',
        'Pick the goals: every goal at a level, a goal and everything feeding it, or single goals. Then the people taking part.',
      ] },
      { heading: 'Running it', list: [
        'Reviews says where each session stands (not started, in progress with how many reviewed, or held, with the date), when it was last held, and how many actions are open.',
        'Open a review to see its agenda: one line per goal, the ones to discuss first. Goals on track with nothing flagged are marked reviewed together at the end, or walked one at a time instead.',
        'The walk opens each goal’s page in turn. Mark it reviewed, add a note, ask the owner a question, or agree an action with who and when. Reviewed & next moves on.',
        'Once the session is held, the review’s page leads with what was said, with every goal reviewed. Owners see questions and actions on their goal page and Home. Print or save as PDF makes a copy of the session.',
      ] },
      { heading: 'Who can', text: ['Anyone can set up a review or join one. Someone in the review, whoever set it up, or an admin can change it. Whoever said something, or an admin, can correct it.'] },
    ],
    routes: ['/reviews', '/reviews/new', '/reviews/:reviewId', '/reviews/:reviewId/edit', '/reviews/:reviewId/summary', '/review', '/goals/:goalId?review=*'],
    screens: ['Review', 'Inspect'],
    reqs: ['REVIEW', 'REVIEW-SETUP', 'REVIEW-RUN', 'INSPECT-ACT', 'REVIEW-LIST-STATE', 'REVIEW-AGENDA', 'EXCEPTIONS-FIRST'],
    keywords: ['review', 'meeting', 'agenda', 'walk', 'notes', 'questions', 'actions', 'summary', 'cadence', 'weekly review'],
    related: ['needs-attention', 'goal-page', 'print', 'requests'],
  },
  {
    id: 'activity',
    title: 'The activity log',
    summary: 'Activity lists every saved change: who made it, when, and each field’s before and after.',
    group: 'leading',
    sections: [
      { heading: 'How to use it', list: [
        'Every save is logged: goals, plans, check-ins, comments, review calls, people and the workspace. Drafts are not.',
        'Filter by who, a goal or its whole tree, team, level, kind of change (check-ins, plans and targets, goal details, reviews, comments, people, imports, AI assistant, wrap-ups) and when.',
        'Search finds names, reasons and numbers. Show the changes opens the before and after.',
        'The filters are in the link, so a filtered log can be shared. Save .csv exports what is shown.',
      ] },
      { heading: 'Safe saves', text: ['If someone else changed the same goal, review or week since you opened it, your save is refused whole, you’re told, and shown the latest. Nothing is half-saved.'] },
    ],
    routes: ['/activity'],
    screens: ['Activity'],
    reqs: ['CHANGE-LOG', 'NOTES', 'NO-LOST-UPDATES'],
    keywords: ['log', 'audit', 'history', 'changes', 'who changed', 'before and after', 'csv'],
    related: ['goal-page', 'data'],
  },
  {
    id: 'wrap-up',
    title: 'Wrapping up the year, and the next one',
    summary: 'In the last two weeks of the year, owners wrap up each goal; then an admin starts the next year.',
    group: 'leading',
    sections: [
      { heading: 'How to use it', list: [
        'Home offers the wrap-up when it opens. For each goal: how it landed (suggested from where it ended), one thing learned, and carry on or stop. About a minute each.',
        'Wrap up shows everyone which goals are wrapped up, and how.',
        'An admin starts the next year. Carried goals start from where they ended: number goals from their last number, milestones with what is left. Links to stopped goals are dropped. Both are logged.',
      ] },
      { heading: 'Who can', list: ['A goal’s owner, or an admin, wraps it up.', 'Only admins start the next year.'] },
    ],
    routes: ['/retro', '/retro/:goalId'],
    screens: ['Retro'],
    reqs: ['RETRO', 'YEAR'],
    keywords: ['retro', 'retrospective', 'end of year', 'cycle', 'next year', 'carry on', 'stop', 'learned', 'close'],
    related: ['history', 'workspace'],
  },

  /* ---------- Data in and out ---------- */
  {
    id: 'data',
    title: 'Data',
    summary: 'Every person, goal, check-in, plan and request as a table you can search, sort, filter, arrange and export.',
    group: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'Pick a table. Search it, sort by any heading, and filter by any column: a value from its list, a number condition, words, or empty. The filters and sort are in the link.',
        'Columns chooses what shows. Drag a heading to move a column, or drag its edge to set a width; the keyboard works too.',
        'Save this layout keeps the columns, widths, search, filters and sort under a name you reopen from Saved layouts. Back to the usual columns resets it.',
        'Export saves CSV or Excel of exactly what is shown: the visible columns, in order, filtered and sorted.',
        'IDs and keys come first and never change.',
      ] },
      { heading: 'Changing data', list: ['Admins type into cells across tables, then Review changes shows each before and after with any problems. Save applies them together, with the same rules and change log as Import.', 'A past check-in can be corrected here; it is logged with its old and new values.'] },
      { heading: 'Who can', text: ['Anyone reads the tables. Admins change them; admins can also pin a saved layout for everyone.'] },
    ],
    routes: ['/data'],
    screens: ['DataTables', 'DataFilters', 'DataLayout'],
    reqs: ['DATA-TABLES', 'TABLE-LAYOUTS'],
    keywords: ['tables', 'data tables', 'spreadsheet', 'columns', 'layout', 'saved layouts', 'resize', 'reorder', 'export', 'csv', 'xlsx', 'edit cells', 'people', 'check-ins', 'plans'],
    related: ['import', 'export', 'keys'],
  },
  {
    id: 'import',
    title: 'Importing from a spreadsheet',
    summary: 'Load a workbook or CSV to add or change goals, set plan numbers and add check-ins, past weeks included.',
    group: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'Choose Import (on Goals, or in More on a phone). Download the workbook to start from what is already there.',
        'Change it in Excel, then drop it in or choose the file: .xlsx, .csv or tab-separated.',
        'Every row is checked with the app’s own rules and shown before anything is saved. Nothing saves while a row needs fixing; plan changes after check-ins need a reason.',
        'Past weeks are marked as loaded later, so history never looks like a fresh update. Rows that change nothing are left alone.',
      ] },
      { heading: 'Who can', text: ['Owners change their own goals; admins can change any. Rows for other people’s goals are fine if you leave them as they are.'] },
    ],
    routes: ['/import'],
    screens: ['Import'],
    reqs: ['BULK-IMPORT', 'WORKSPACES', 'HONEST-NUMBERS'],
    keywords: ['import', 'upload', 'excel', 'csv', 'spreadsheet', 'workbook', 'load', 'bulk'],
    related: ['export', 'data', 'keys'],
  },
  {
    id: 'export',
    title: 'Exporting',
    summary: 'Take the goals out as an Excel workbook, CSV, JSON, or a brief to paste into an AI chat.',
    group: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'Choose Export on Goals. Pick everything this year, or just what is shown now (it starts there when the goals are filtered).',
        'Excel workbook: goals, plan by week, check-ins, review notes and actions, requests, people and a README.',
        'CSV: one table per file. JSON: everything, with each goal’s plan and check-ins inside it, in a stated format.',
        'Brief for an AI chat: Markdown that leads with decisions waiting on people, then each goal’s story, then results. Copy it or save it.',
        'Every file the app saves, here and elsewhere, is named the same way: the workspace, what it holds, which goals, and the date, such as platform-goals-year-2026-2026-11-05.xlsx.',
      ] },
    ],
    routes: [],
    screens: ['Export'],
    reqs: ['EXPORT', 'SHARED-DOWNLOADS'],
    keywords: ['export', 'download', 'excel', 'xlsx', 'csv', 'json', 'markdown', 'brief', 'ai chat'],
    related: ['import', 'print', 'data'],
  },
  {
    id: 'print',
    title: 'Printing a goal or a review',
    summary: 'A goal or a review session on one clean page, ready to print or save as a PDF.',
    group: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'On a goal’s page or a review, choose Print or save as PDF.',
        'A goal prints on one A4 page: status, the number against plan and target, the facts, chart, path to green, latest check-in, requests, review notes, quarters and contributing goals.',
        'A review prints its session worst first, with what was said.',
        'Print uses black on white with the status shapes kept, and no navigation.',
      ] },
    ],
    routes: ['/goals/:goalId/print', '/reviews/:reviewId/print'],
    screens: ['Print'],
    reqs: ['PRINT-EXPORT'],
    keywords: ['print', 'pdf', 'one pager', 'a4', 'paper', 'save as pdf'],
    related: ['goal-page', 'reviews', 'export'],
  },

  /* ---------- Workspace, settings and assistants ---------- */
  {
    id: 'workspace',
    title: 'Running the workspace',
    summary: 'Workspace is the directory of people and teams, with the settings admins look after.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'Find a person, or filter by team. Each shows their job title, team and whether they are an admin.',
        'Admins add a person, change their details, or make them an admin. There is always at least one admin.',
        'Rename the workspace; add, rename and remove teams. A team with people or goals moves them to another team in the same save.',
        'AI assistants: make a personal token for someone (shown once) and revoke tokens. Feedback: read what people sent with the feedback button.',
        'What the app records: recording of how the app is used is on for everyone. Untick it to turn it off for the whole workspace; while it’s off, nothing is recorded or sent.',
        'Delete the workspace, after typing its name. It can’t be undone; an example can only be reset.',
      ] },
      { heading: 'Who can', list: ['Everyone can see the people and teams.', 'Only admins add or change people and teams, make tokens, turn recording on or off, rename or delete the workspace. Whoever sets up a workspace is its first admin.'] },
    ],
    routes: ['/workspace'],
    screens: ['Workspace'],
    reqs: ['ADMIN', 'WORKSPACE-ADMIN', 'PROFILES', 'WORKSPACES', 'TELEMETRY-SWITCH'],
    keywords: ['admin', 'people', 'teams', 'add person', 'rename', 'delete workspace', 'directory', 'feedback', 'tokens', 'recording'],
    related: ['ai-assistants', 'set-up', 'settings', 'recording'],
  },
  {
    id: 'settings',
    title: 'Settings',
    summary: 'Your own choices: light or dark, an accent colour, the sidebar, and your AI assistant tokens. It also says what the app records.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'Light or dark: light, dark, or follow your device.',
        'Accent colour: cobalt, violet, petrol or graphite. Each is readable in light and dark. Status colours never change.',
        'Sidebar: full, or icons only. The toggle at the foot of the sidebar does the same; every icon is named on hover.',
        'You: your name, job title and team. An admin changes these.',
        'What the app records: what is and isn’t recorded about how you use the app, for how long, who can see it, and whether it’s on in this workspace.',
        'Your AI assistants: the tokens that act as you, which you can revoke.',
        'Detail pages have a Back link to where you came from.',
      ] },
      { heading: 'Good to know', text: ['How the app looks is kept in this browser only. On another device, choose again. Motion is subtle and switches off when your device asks for reduced motion.'] },
    ],
    routes: ['/settings'],
    screens: ['Settings'],
    reqs: ['SETTINGS', 'MOTION', 'MOTION-ALIVE'],
    keywords: ['theme', 'dark mode', 'light mode', 'accent', 'colour', 'sidebar', 'collapse', 'appearance', 'back link'],
    related: ['ai-assistants', 'any-device', 'recording'],
  },
  {
    id: 'recording',
    title: 'What the app records',
    summary: 'The app records how it is used, never what you type, so the people building it can see what is slow, broken or hard to use.',
    group: 'you',
    sections: [
      { heading: 'What is recorded', list: [
        'The pages you open, and how long each takes to show.',
        'The buttons you press that do something, such as posting a check-in, saving a goal or answering a request, and whether it worked.',
        'How far you get in a task: a check-in, a new goal, changing a goal, a review, answering a request, an import, the wrap-up or setting up a workspace. Where you start, each step you reach, and whether you finish or stop.',
        'Errors, saves that didn’t go through (and whether a rule said no or the connection failed), and how long loading took.',
        'With each: an id for this browser tab, your id in the workspace and the workspace’s id. Not your name.',
      ] },
      { heading: 'What is never recorded', list: [
        'Anything you type: notes, numbers, names, goal titles, comments, answers or searches.',
        'What a page shows you.',
        'The app only sends things it names itself, from a fixed list. Anything else is dropped in your browser before it is sent.',
      ] },
      { heading: 'How long, and who can see it', list: [
        'Each record is kept for 90 days. After that only daily totals are kept: how many, how many failed, how long they took and where people stopped, with nothing about any one visit.',
        'Only the people who build and run the app, and the AI that helps them, can read it. No one in your workspace can, admins included.',
        'It is kept in the app’s own database, in a standard format (OpenTelemetry), so it could later go to your company’s own monitoring tool.',
      ] },
      { heading: 'Turning it off', list: [
        'Everyone is recorded by default. Settings says whether it is on where you are.',
        'An admin can turn it off for the whole workspace on Workspace, under What the app records. While it is off, nothing is recorded or sent from that workspace, by the app or by an AI assistant.',
      ] },
    ],
    routes: [],
    screens: [],
    reqs: ['TELEMETRY-SIGNALS', 'TELEMETRY-PRIVACY', 'TELEMETRY-FLOWS', 'TELEMETRY-RETENTION', 'TELEMETRY-SWITCH'],
    keywords: ['recording', 'privacy', 'telemetry', 'analytics', 'tracking', 'observability', 'what is recorded', 'turn off recording', 'errors', 'slow'],
    related: ['settings', 'workspace', 'ai-assistants'],
  },
  {
    id: 'ai-assistants',
    title: 'AI assistants (MCP)',
    summary: 'Connect an AI assistant such as Claude with a personal token, so it can read and do everything you can in the app, as you.',
    group: 'you',
    sections: [
      { heading: 'What it can do', list: [
        'Read every screen: what needs you, goals, a goal in full, requests, reviews, watching, people, activity, views, the wrap-up, this guide and what’s new.',
        'Do what you can: check in, set up and change goals and plans, answer requests, take part in reviews, watch goals, save views, and (as an admin) manage people and teams and turn recording on or off.',
        'It meets the same rules as you, with exactly your rights, and every change is logged as you, via the AI assistant.',
      ] },
      { heading: 'How to connect', list: [
        'An admin makes a personal token for you under Workspace, AI assistants. It is shown once; only a hash is stored.',
        'Add the server to your assistant with the address and token shown. For Claude Code: claude mcp add --transport http goals https://<app>/api/mcp --header "Authorization: Bearer gk_…".',
        'See and revoke your tokens in Settings. The full list of tools is in docs/mcp.md.',
      ] },
      { heading: 'Who can', text: ['Only admins make tokens. An admin or the token’s own person can revoke one.'] },
    ],
    routes: [],
    screens: [],
    reqs: ['MCP-TOKENS', 'MCP-PARITY'],
    keywords: ['ai', 'claude', 'mcp', 'assistant', 'token', 'api', 'automation', 'agent'],
    related: ['workspace', 'settings', 'export'],
  },
  {
    id: 'any-device',
    title: 'On a phone, a tablet or a big screen',
    summary: 'The app works at every size, from a small phone to an ultra-wide monitor, and keeps your work safe as you go.',
    group: 'you',
    sections: [
      { heading: 'How it fits', list: [
        'On a phone, the tabs at the bottom hold Home, your main places and More. More has everything else, including Import, Settings, Help and Send feedback.',
        'On a tablet the sidebar is a rail of icons, each named on hover. On a desktop you can choose the rail in Settings.',
        'Focused tasks such as a check-in stay narrow; tables, boards and the map use the whole width.',
        'Text follows your browser’s text size, and every control is big enough to tap.',
      ] },
      { heading: 'Your work is safe', list: [
        'Unsaved answers are kept as a draft and offered back. A save either lands whole or not at all, and never overwrites someone else’s change without telling you.',
        'Send feedback, at the foot of the sidebar or in More, tells your admins (or, in the demo, the people building the app) how it is working for you.',
      ] },
    ],
    routes: [],
    screens: [],
    reqs: ['PHONE', 'A11Y', 'NO-ERRORS', 'EVERY-WIDTH', 'WIDE-SCREENS', 'FIT-AND-FINISH', 'FIT-AND-FINISH-AREAS', 'NO-LOST-UPDATES', 'DRAFTS', 'PERSIST', 'MOTION', 'NAV-GOALS'],
    keywords: ['phone', 'mobile', 'tablet', 'desktop', 'more', 'tabs', 'feedback', 'drafts', 'offline', 'accessibility', 'keyboard', 'text size'],
    related: ['settings', 'help'],
  },
  {
    id: 'help',
    title: 'Help and what’s new',
    summary: 'This guide says what everything does. What’s new lists each release, newest first.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'Open Help at the foot of the sidebar, in More on a phone, or the Help link at the bottom of any page, which opens the article for that page.',
        'Search finds articles by what they cover. Each article ends with related ones.',
        'What’s new lists each release with a few plain lines and links to the articles that explain it. A small dot beside Help means there is something you haven’t seen; opening What’s new clears it.',
        'Your AI assistant can read this guide and What’s new too.',
      ] },
    ],
    routes: ['/help', '/help/:id', '/whats-new'],
    screens: ['Help'],
    reqs: ['HELP-GUIDE', 'WHATS-NEW', 'CONSISTENT-WORDS'],
    keywords: ['help', 'guide', 'docs', 'documentation', 'how to', 'whats new', 'release notes', 'changelog', 'updates'],
    related: ['home', 'any-device'],
  },
];

const BY_ID = new Map(ARTICLES.map((a) => [a.id, a]));
export const articleById = (id: string): Article | undefined => BY_ID.get(id);

/** All the words of an article, for search. */
function textOf(a: Article): string {
  return [a.title, a.summary, ...a.keywords, ...a.sections.flatMap((s) => [s.heading, ...(s.text ?? []), ...(s.list ?? [])])].join(' ').toLowerCase();
}
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}-]+/gu, ' ').trim();

/**
 * Articles where every word of the query appears, best first: in the title, then the keywords, then the summary,
 * then anywhere. An empty query returns nothing.
 */
export function searchGuide(query: string): Article[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = ARTICLES.map((a) => {
    const all = norm(textOf(a));
    if (!words.every((w) => all.includes(w))) return null;
    const title = norm(a.title), keys = norm(a.keywords.join(' ')), sum = norm(a.summary);
    // Where a word appears counts most; how often it appears breaks ties.
    const score = words.reduce((n, w) => n + (title.includes(w) ? 8 : 0) + (keys.includes(w) ? 4 : 0) + (sum.includes(w) ? 2 : 0) + Math.min(4, all.split(w).length - 1), 0);
    return { a, score };
  }).filter((x): x is { a: Article; score: number } => !!x);
  return scored.sort((x, y) => y.score - x.score || ARTICLES.indexOf(x.a) - ARTICLES.indexOf(y.a)).map((x) => x.a);
}

/** A route pattern's path and the query values it needs. */
function parseRoute(r: string): { segs: string[]; query: [string, string][] } {
  const [path = '/', q = ''] = r.split('?');
  return { segs: path.split('/').filter(Boolean), query: [...new URLSearchParams(q).entries()] };
}

/**
 * How closely a route (as App.tsx and the guide write it) matches an address: null when it doesn't. Fixed path
 * segments beat parameters (/goals/new over /goals/:goalId), and a route that needs a query value beats one that
 * doesn't. Shared by the Help link on every page and by the named flows (src/help/flows.ts).
 */
export function routeScore(route: string, pathname: string, search = ''): number | null {
  const segs = pathname.split('/').filter(Boolean);
  const p = parseRoute(route);
  if (p.segs.length !== segs.length) return null;
  if (!p.segs.every((s, i) => s.startsWith(':') || s === segs[i])) return null;
  const q = new URLSearchParams(search);
  if (!p.query.every(([k, v]) => (v === '*' ? q.has(k) && q.get(k) !== '' : q.get(k) === v))) return null;
  return p.segs.filter((s) => !s.startsWith(':')).length * 10 + p.query.length * 100;
}

/** The article for a page: the one whose route matches the address most closely. */
export function articleForPath(pathname: string, search = ''): Article | undefined {
  let best: { a: Article; score: number } | undefined;
  for (const a of ARTICLES) {
    for (const r of a.routes) {
      const score = routeScore(r, pathname, search);
      if (score !== null && (!best || score > best.score)) best = { a, score };
    }
  }
  return best?.a;
}

/** The App.tsx route an address is on, e.g. /goals/:goalId for /goals/G-12: what telemetry records instead of ids. */
let appRoutes: string[] | null = null;
export function appRouteFor(pathname: string): string | undefined {
  let best: { r: string; score: number } | undefined;
  for (const r of (appRoutes ??= guideRoutes())) {
    const score = routeScore(r, pathname);
    if (score !== null && (!best || score > best.score)) best = { r, score };
  }
  return best?.r;
}

/** The route paths the guide explains, without their queries: for the checks that every route has an article. */
export const guideRoutes = (): string[] => [...new Set(ARTICLES.flatMap((a) => a.routes.map((r) => r.split('?')[0]!)))];

/** An article as plain text: for the AI assistant. */
export function articleText(a: Article): string {
  return [`# ${a.title}`, a.summary, ...a.sections.map((s) => [`## ${s.heading}`, ...(s.text ?? []), ...(s.list ?? []).map((l) => `- ${l}`)].join('\n'))].join('\n\n');
}
