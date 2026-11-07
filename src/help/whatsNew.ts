/* What's new: each release, for the people using the app (not its developers). Newest first, each with a stable id
   that never changes (the app remembers the last one a person has seen), a date, a title, a few plain lines, and the
   guide articles that explain it.
   Every change people can see adds an entry here and updates the guide (src/help/guide.ts). CI checks that a pull
   request changing the app touches this file (scripts/check-whats-new.mjs); src/help/guide.test.ts checks the order,
   the ids, the dates and the links. */

export interface NewsEntry {
  /** Stable: never change or reuse one. */
  id: string;
  /** yyyy-mm-dd, the day it reached people. */
  date: string;
  title: string;
  /** Two to six plain lines. */
  points: string[];
  /** Guide articles that explain it. */
  articles: string[];
  /** The markups (mk_…) and feedback (by its id) this release fixes: whoever sent one sees “You raised this” on the entry. */
  fixes?: string[];
}

export const WHATS_NEW: NewsEntry[] = [
  {
    id: 'shapes-match-words',
    date: '2026-11-07',
    title: 'Every shape matches its word, and feedback hears back',
    points: [
      'On Home and in Goals’ Needs attention, a goal’s shape always matches its status. A goal on track that is getting worse, or called greener than calculated, keeps its on-track circle, and the flag is said in words beside the warning mark, as on the goal’s page.',
      'A dated stage says its state beside its shape: on schedule, slipping, late or done.',
      'When a release fixes feedback you sent with a mood and a few words, its entry here says “You raised this”, as it does for a markup.',
      'On a phone, someone who owns no goals sees the goals they watch on the first screen. Home shows the note about goals waiting for their first check-in only while one you own or watch is waiting; Goals always does.',
      'For the people building Faro: with a builder token, an AI assistant lists, opens and triages feedback as it does markups, with the inbox’s rules.',
    ],
    articles: ['home', 'status', 'needs-attention', 'feedback', 'inbox', 'ai-assistants'],
  },
  {
    id: 'one-meaning-for-every-word',
    date: '2026-11-06',
    title: 'One meaning for every status word',
    points: [
      'Needs attention is one rule everywhere: Home, Watching, the map’s “Only what needs attention”, the Goals filter, reviews and the AI assistant all pick the same goals. It covers off track, at risk, no recent update, getting worse, no path to green or a missed one, a decision waiting, and a call greener than calculated, unless someone is already handling it. The Goals filter can narrow it to why.',
      'Results say Met, Met late or Not met, and so does each quarter. At the wrap-up, the owner’s own words are labelled as their view, so they’re never read as the result.',
      'The gap reads the same in every list, the scorecard, the review, exports and the AI: “9 hours behind plan”, “3 pts ahead of plan”, or On plan. A stage up to two weeks behind is slipping; more is late.',
      'A goal without a check-in for two weeks has no recent update, wherever you look, and the “No update for” filter counts it the same way. One with none yet says No check-in yet, and has a lane of its own on the Board.',
      'Getting worse is one rule for the flag, the goal’s story, its trend and the words under its chart. A group’s status is the worst one in it, never one it doesn’t have.',
      'The AI assistant says the words you see, with the code beside them (“Off track (off)”), and takes either. The export defines every word on its README sheet.',
    ],
    articles: ['status', 'needs-attention', 'goals-filters', 'watching'],
  },
  {
    id: 'remove-and-undo',
    date: '2026-11-06',
    title: 'Take anything away again, and undo it',
    points: [
      'When someone leaves, an admin marks them as left on Workspace: first choosing who takes over their goals and open asks. They leave every list and picker; their history keeps their name, as “Name (left)”.',
      'A goal can be stopped mid-year, with a reason, from its “…” menu. It leaves the numbers, reviews and Home, but its page, history and exports stay, marked Stopped. A goal set up by mistake, with no check-ins, is deleted instead.',
      'Delete your latest check-in, end a review, edit or remove your comments (they say edited, or “Comment removed”), and delete saved views.',
      'Every removal shows Undo for 10 seconds, and admins can restore anything from the last 30 days under Recently removed on Workspace. Nothing is ever erased.',
      'Loaded the wrong spreadsheet? Undo this import, on its entry in Activity, puts every row back as it was.',
      'A stopped goal makes no forecast: its page keeps how it stood, without “Will it hit?” or a projection, and stopping it no longer draws the page again under the Undo message.',
    ],
    articles: ['removing', 'workspace', 'goal-page', 'activity'],
  },
  {
    id: 'mark-up-a-screen',
    date: '2026-11-06',
    title: 'Mark up a screen to say what should change',
    points: [
      'Send feedback now starts with Mark up this screen: draw on a picture of the screen you’re on with a pen, an arrow, a box or a numbered note, and say in one line what should change. On a computer, Ctrl+Shift+M (Cmd+Shift+M on a Mac) does the same from anywhere; Escape cancels.',
      'Before you send, you see the exact picture that goes, with your marks. Your last 20 steps on this visit go with it unless you untick them, so the people building Faro can see what led up to it. Never anything you typed.',
      'When a release fixes something you marked up, its entry here says “You raised this”.',
      'For the people building Faro, Workspace has an Inbox to read and triage markups, after signing in with an email link. Feedback sent with a mood and a few words is there too, with the same statuses: New, In hand, Fixed and Won’t fix. Your admins can’t see markups yet; they will once sign-in comes to the whole app.',
      'AI assistant tokens are now made by the database, which keeps only a fingerprint of each and never hands one back; feedback can only be read by its own workspace. Making and revoking tokens works as before.',
    ],
    articles: ['feedback', 'inbox', 'ai-assistants', 'recording'],
  },
  {
    id: 'fit-fixes-nov-6',
    date: '2026-11-06',
    title: 'Small fixes: on plan to the cent, nothing cut off',
    points: [
      'A number typed to the goal’s decimals can be on plan again. A new goal whose plan moves less than a cent in its first week (CI cost: 0.4067 USD) is on plan at 0.41, instead of reading as behind at 0.41 and well ahead at 0.40.',
      'Projections stay where a number can go: a count of things is never projected below zero.',
      'On a phone, Home keeps each reason a goal needs attention to two lines; the goal’s page now says every flag in full, such as a trend heading short of the target or a call greener than the numbers.',
      'A review’s agenda gives each goal’s name the room, at every width, with the gap to plan wrapping beside it; the review’s name wraps rather than being cut off while you walk it.',
      'On a phone the strip at the top of Home is slimmer for leaders, and in a check-in the box with last week’s words grows to show all of them.',
      'The map’s walkthrough ends with its card beside the story, over the map, instead of in the top corner.',
    ],
    articles: ['status', 'home', 'goal-page', 'reviews', 'check-in', 'goal-map'],
  },
  {
    id: 'goal-page-scorecard',
    date: '2026-11-06',
    title: 'A goal’s page says each thing once, with a scorecard at the top',
    points: [
      'Under a goal’s status and number there’s now a scorecard: against plan, against last week, what’s left to the target, and whether it will hit it, in words (Likely, Possible, Unlikely or Very unlikely), never a percentage.',
      'The chart marks the same numbers where they are: the gap to plan at now, where it will likely end, and how far that is from the target. The rows and the small bar under the chart are gone.',
      'The owner’s reason now opens the Why section under the chart, and how the goals feeding it stand opens What feeds it, instead of both sitting in the bar too.',
      'Every section says in one line what it answers, with a clear rule between sections. Path to green gives the owner’s date in words and whether the trend gets there.',
      'Scrolled down, the bar is one line on a solid panel that stands off the page: status, number, the gap to plan and the “…” menu. “Since you looked” only appears when something has changed.',
      'On paper, a goal fits one A4 page again, and on a 360px phone nothing runs off the side.',
    ],
    articles: ['goal-page', 'print'],
  },
  {
    id: 'faro',
    date: '2026-11-06',
    title: 'Goals is now Faro',
    points: [
      'The app has a name: Faro, the Spanish and Italian word for a lighthouse. Its logo is at the top of the sidebar, on the welcome page and in your browser tab.',
      'A new look to match: warm paper, dark ink and the lighthouse’s teal, in light and in dark.',
      'Status colours haven’t changed, except that Done is now a calm slate teal instead of blue. The logo’s amber is used nowhere else, so amber still only ever means At risk.',
      'Prefer the earlier colours? Cobalt, violet, petrol and graphite are still in Settings → Appearance. If you had chosen violet, petrol or graphite, you keep it.',
    ],
    articles: ['settings', 'help'],
  },
  {
    id: 'one-ask-one-watching',
    date: '2026-11-05',
    title: 'One way to ask, one Watching, and a bigger example',
    points: [
      'Anything that needs someone to respond is now an ask: a decision or help, an update, a question or an action. Each says who asked, who must respond and by when, and stays open until it’s answered, done or withdrawn. A comment no longer answers a question.',
      'Every ask is answered in the same Respond panel, on the goal and from Home, where they’re grouped by kind. Actions can be marked done, and show as overdue after their week instead of dropping off. On Reviews, a session under way is listed first.',
      'Under the comment box, Ask as a question asks the goal’s owner instead of just commenting.',
      'Watching is part of Goals now, with its search, filters, sort, layouts and export, and what changed this week beside it. Home has one block for the goals you watch.',
      'The demo is one organisation of about 100 people, Platform Engineering, with Amara as its VP. Your changes to it are kept in this browser, and if the browser won’t keep them, the page says so.',
      'On a phone, each thing that needs your response is one short row with its button beside it, so your own goals still start on the first screen.',
    ],
    articles: ['requests', 'watching', 'home', 'goal-page', 'demo', 'reviews'],
  },
  {
    id: 'chart-plan-and-better',
    date: '2026-11-05',
    title: 'Charts that are easier to read',
    points: [
      'The plan is now a broad pale band and the actual a solid dark line on it, so the two never look alike, whatever your colour or theme.',
      'Each chart says which way is better, higher or lower, with an arrow in its top-left corner.',
    ],
    articles: ['goal-page'],
  },
  {
    id: 'goal-page-flagship',
    date: '2026-11-05',
    title: 'A goal’s page, rebuilt',
    points: [
      'A summary bar reads in two seconds: the status, the number against plan and target, which way it’s heading, why, and whether anyone is on it. It shrinks to one line as you scroll.',
      'What’s asked of you is answered on the goal, and Home’s Answer, Respond and Reply open it ready to type.',
      'Under the chart: against plan, likely end and target in three short rows, with a bar showing where it will likely land. The Motion lab, at the bottom of Settings, changes how it all moves.',
      'One list of what’s being done, with who, when and whether each is open, done or overdue; and what was said the last time it was discussed.',
      'Check-ins, comments and changes in one stream, a reason repeated week after week said once, and “Since you looked” when you come back.',
      'Share image copies a picture of the goal with its link. Linking to a decision already asked for another goal is now in the check-in.',
    ],
    articles: ['goal-page', 'status', 'requests'],
  },
  {
    id: 'tidier-and-more-consistent',
    date: '2026-11-05',
    title: 'Tidier and more consistent',
    points: [
      'A held review’s page now opens with what was said and the goals reviewed. The separate summary page has gone; its old link opens the review.',
      'One name for each thing: Data (not Data tables), Import, “All your numbers in one table”, and comments on a goal.',
      'In Data, named arrangements of a table are now Saved layouts, so they’re not confused with saved views on Goals.',
      'A goal with no number says “No value yet” everywhere, once.',
      'Every file you save is named the same way: workspace, what it holds, which goals, and the date.',
      'Changing the owner of several goals at once now works when two people share a name.',
    ],
    articles: ['reviews', 'data', 'export'],
  },
  {
    id: 'what-the-app-records',
    date: '2026-11-05',
    title: 'What the app records',
    points: [
      'The app now records how it is used: the pages people open, the buttons they press, where they stop in a task, errors and slow pages. Never anything anyone types.',
      'Settings says exactly what is and isn’t recorded, for how long (90 days, then only daily totals) and who can see it.',
      'Admins can turn recording off for the whole workspace on Workspace. While it is off, nothing is sent.',
      'AI assistants are recorded the same way, and an admin’s assistant can turn recording off too.',
    ],
    articles: ['recording', 'settings', 'workspace'],
  },
  {
    id: 'help-and-whats-new',
    date: '2026-11-05',
    title: 'Help and what’s new',
    points: [
      'Help, at the foot of the sidebar or in More on a phone, says what every page does and how to use it. Search it for what you need.',
      'Every page has a Help link at the bottom that opens the article for that page.',
      'What’s new lists each release in a few plain lines. A small dot beside Help means there is something you haven’t seen.',
      'Your AI assistant can read the guide and what’s new too.',
    ],
    articles: ['help', 'ai-assistants'],
  },
  {
    id: 'goal-page-facts',
    date: '2026-11-05',
    title: 'A goal page that leads with the facts',
    points: [
      'A goal’s page opens with four facts: against plan, the recent trend, the change since the last update, and the projection.',
      'When it is behind, the path to green sits right under them: the owner’s plan, date, needs and next step.',
      'Under the title: what it feeds and its status, how many goals feed it, and how it is measured.',
      'The side column is grouped: asked of you, what the owner says, signals, and what was said in reviews. A slim header stays in view as you scroll.',
    ],
    articles: ['goal-page'],
  },
  {
    id: 'home-at-a-glance',
    date: '2026-11-05',
    title: 'Home at a glance, and goals being handled',
    points: [
      'Home opens with a slim strip: your goals by status, your on-time streak, watched goals that need attention, and your next review.',
      'Needs attention now means something new since anyone looked. A goal that is behind but already reviewed, noted, given an action or answered shows as being handled.',
      'Home, Watching, Goals and review agendas all show the two apart, and say what is in hand.',
    ],
    articles: ['home', 'needs-attention'],
  },
  {
    id: 'reviews-where-they-stand',
    date: '2026-11-05',
    title: 'Reviews say where they stand',
    points: [
      'Reviews shows, for each review, whether this session is not started, in progress or held, when it was last held, and its open actions.',
      'A review’s agenda is one line per goal: status, name, number and gap.',
      'The end of a review shows everything said, with a way back to the review.',
    ],
    articles: ['reviews'],
  },
  {
    id: 'settings-and-back',
    date: '2026-11-05',
    title: 'Settings, a Back link and a tidier sidebar',
    points: [
      'Settings: light, dark or your device’s choice, four accent colours, a full or icons-only sidebar, and your AI assistant tokens.',
      'Goals is a section of the sidebar, with Mine, Watching, All and your saved views under it.',
      'Detail pages have one Back link to where you came from.',
      'Admins can rename the workspace and add, rename or remove teams.',
    ],
    articles: ['settings', 'goals', 'workspace'],
  },
  {
    id: 'table-layouts-and-keys',
    date: '2026-11-05',
    title: 'Data tables you can arrange, and short goal keys',
    points: [
      'In Data, drag columns to reorder and resize them, save the layout as a table view, and export exactly what is shown.',
      'Every goal has a short key, such as G-12, that never changes. You’ll see it on the goal, in tables and exports.',
      'Open a goal straight from its key: /goals/G-12.',
    ],
    articles: ['data', 'keys'],
  },
  {
    id: 'print-and-motion',
    date: '2026-11-05',
    title: 'Print a goal or a review, and a livelier app',
    points: [
      'Print or save as PDF on a goal or a review gives one clean page with everything that matters.',
      'Numbers count up, rings fill, charts draw and rows slide to their new place when sorted. All of it is quick, and off if your device asks for reduced motion.',
    ],
    articles: ['print', 'settings'],
  },
  {
    id: 'ai-parity',
    date: '2026-11-04',
    title: 'Your AI assistant can do what you can',
    points: [
      'An AI assistant connected with your token can now do everything you can in the app: answer requests, take part in reviews, watch goals, save views and more.',
      'It has exactly your rights and meets the same rules, and every change is logged as you, via the assistant.',
    ],
    articles: ['ai-assistants'],
  },
  {
    id: 'fit-and-finish',
    date: '2026-11-04',
    title: 'Fit and finish on every screen',
    points: [
      'Text follows your browser’s text size, and every button and field has one height, bigger on touch screens.',
      'On phones, the Goals table, toolbars and filters stack so nothing is squeezed.',
      'The tablet rail names every icon on hover. Sheets keep their buttons in view.',
    ],
    articles: ['any-device'],
  },
  {
    id: 'one-account',
    date: '2026-11-03',
    title: 'One short account when something changes',
    points: [
      'When a goal is off plan, the check-in asks for what changed, what happens next and by when, on one screen, starting from last week’s words.',
      'The owner’s date and the app’s projection are shown apart, so one is never read as the other.',
      'Something else is a cause you can describe in your own words.',
      'Feedback sent from the demo now reaches the people building the app.',
    ],
    articles: ['check-in', 'goal-page', 'demo'],
  },
  {
    id: 'quarter-results',
    date: '2026-11-03',
    title: 'Quarter results, calendar weeks and Undo',
    points: [
      'History opens on quarter results: each goal’s number at the end of each quarter against the plan, met or missed.',
      'Weekly status has a week you can select and read in words.',
      'Weeks follow the calendar: in a January year, week n is ISO week n.',
      'Asking for an update can be undone, and a check-in can never be posted twice by accident.',
    ],
    articles: ['history', 'watching', 'check-in'],
  },
  {
    id: 'requests',
    date: '2026-11-03',
    title: 'Requests for a decision or help you can answer',
    points: [
      'A request raised in a check-in stays open until it is answered or withdrawn.',
      'The person asked sees it once on Home and can answer it for every goal waiting on it.',
      'An owner can link a goal to a request already raised for another goal.',
      'Home says what the review will discuss, and Goals says how many goals have had a first check-in.',
    ],
    articles: ['requests', 'home', 'reviews'],
  },
  {
    id: 'data-tables',
    date: '2026-11-03',
    title: 'Data tables, record IDs and a filterable Activity',
    points: [
      'Data shows every person, goal, check-in and plan as a table to search, sort and filter by any column.',
      'Admins can change cells across tables and save them together, with the same rules and log as Import.',
      'Every record shows its own ID.',
      'Activity filters by who, goal, team, level, kind of change and dates, and saves what is shown as a .csv.',
    ],
    articles: ['data', 'activity', 'keys'],
  },
  {
    id: 'views-agree',
    date: '2026-11-03',
    title: 'Side columns on laptops, and views that agree',
    points: [
      'Home, a goal, Watching and Workspace put their side column beside the main one from a laptop width.',
      'The map’s “Only what needs attention”, the counts, the link and Export now always agree on what is shown.',
      'Numbers typed in the one-table check-in survive a refresh until posted.',
    ],
    articles: ['goal-map', 'export', 'check-in-table'],
  },
  {
    id: 'exceptions-first',
    date: '2026-11-02',
    title: 'Reviews walk the exceptions first',
    points: [
      'A review walks the goals that need a look one at a time; goals on track with nothing flagged are marked together.',
      'A one-press “Decision or help needed” filter on Goals.',
      'The Goals header is shorter, so the goals start on the first screen.',
    ],
    articles: ['reviews', 'goals-filters', 'needs-attention'],
  },
  {
    id: 'search-and-saved-views',
    date: '2026-11-02',
    title: 'Search, filters, sort and saved views',
    points: [
      'Search the goals by any word in the title, owner, team, reason or recovery plan.',
      'Filter by status, level, team, owner, what needs someone, due date and more; sort eight ways.',
      'Everything is in the link, and you can save a view as your own tab. Admins can pin one for everyone.',
    ],
    articles: ['goals-filters'],
  },
  {
    id: 'every-screen-size',
    date: '2026-11-02',
    title: 'A layout for every screen size',
    points: [
      'Tables, boards and cards use the width of a big screen; the map fills the window; focused tasks stay narrow.',
      'Tables no longer clip, and every status shape has its word.',
      'Earlier plans are kept with the week they stopped applying, so old weeks stay judged against the plan of their day.',
    ],
    articles: ['any-device', 'edit-goal'],
  },
  {
    id: 'goal-map',
    date: '2026-11-02',
    title: 'The goal map, walkthroughs and a quieter demo',
    points: [
      'The map draws every goal and its links, with the critical path in bold.',
      'Walkthroughs take you through the main journeys in the demo, step by step.',
      'One quiet Demo control replaces the demo bar.',
    ],
    articles: ['goal-map', 'demo'],
  },
  {
    id: 'year-and-story',
    date: '2026-11-02',
    title: 'Goals for the year, and the story behind each one',
    points: [
      'Goals run for the year in four quarters, with each ended quarter met or missed against the owner’s plan.',
      'Every goal that is behind or quiet tells its story: why, what will be done, by when, and what is needed from whom.',
      'Once due, a goal shows Completed, Completed late or Did not meet.',
    ],
    articles: ['history', 'goals', 'status'],
  },
  {
    id: 'views-and-export',
    date: '2026-11-02',
    title: 'Views of the same goals, and exports',
    points: [
      'See the goals as a list, a table, a board, a history grid or cards.',
      'Export to Excel, CSV, JSON, or a brief to paste into an AI chat.',
      'Check in as often as you like: every check-in is kept, and the latest in a week counts.',
      'Saves land whole or not at all, and never overwrite someone else’s change.',
    ],
    articles: ['goals', 'export', 'check-in', 'any-device'],
  },
  {
    id: 'import-and-assistants',
    date: '2026-11-02',
    title: 'Import, a one-table check-in, and AI assistants',
    points: [
      'Load goals, plan numbers and past check-ins from a spreadsheet, checked row by row before anything saves.',
      'Type all your numbers for the week in one table.',
      'Connect an AI assistant with a personal token to read goals and post check-ins as you.',
    ],
    articles: ['import', 'check-in-table', 'ai-assistants'],
  },
  {
    id: 'owners-watching-reviews',
    date: '2026-11-01',
    title: 'Owners, watching and reviews',
    points: [
      'No more role labels: owners check in on their goals, everyone can view, watch and comment, and admins manage people.',
      'Watch a goal, a whole tree or a level.',
      'Anyone can set up a review that walks its goals worst and stalest first and keeps what was said.',
      'One Home for everyone, led by what needs your response.',
    ],
    articles: ['watching', 'reviews', 'home', 'workspace'],
  },
  {
    id: 'wrap-up',
    date: '2026-11-01',
    title: 'Wrap up and start the next cycle',
    points: [
      'At the end of a cycle, owners wrap up each goal: how it landed, one thing learned, carry on or stop.',
      'An admin then starts the next cycle, with carried goals starting from where they ended.',
    ],
    articles: ['wrap-up'],
  },
  {
    id: 'demo-and-set-up',
    date: '2026-11-01',
    title: 'Try the demo, or set up your own workspace',
    points: [
      'The demo has example data in your own browser that you can change and reset.',
      'Setting up your own workspace takes about three minutes, one question per screen.',
      'A feedback button on every screen.',
    ],
    articles: ['demo', 'set-up'],
  },
  {
    id: 'shared-data',
    date: '2026-11-01',
    title: 'Everyone sees the same goals',
    points: [
      'Goals, plans and check-ins are kept in one shared place, so everyone in a workspace sees the same thing.',
      'If the data can’t be reached, the app says so plainly and offers Try again.',
    ],
    articles: ['any-device'],
  },
  {
    id: 'first-release',
    date: '2026-10-30',
    title: 'Goals, plans and weekly check-ins',
    points: [
      'Set up a number, range or milestone goal with a weekly plan, and link it to the goal it feeds.',
      'Check in each week: behind plan asks for a reason, and at risk or off track for a path to green.',
      'Each goal’s page shows its status, why, the path back, a chart and its history.',
    ],
    articles: ['new-goal', 'check-in', 'goal-page'],
  },
];

export const latestNews = (): NewsEntry | undefined => WHATS_NEW[0];

/** Entries on or after a date (yyyy-mm-dd), newest first. */
export const newsSince = (date?: string): NewsEntry[] => (date ? WHATS_NEW.filter((e) => e.date >= date) : WHATS_NEW);

/** Entries newer than the one with this id (all of them when the id is unknown or missing). */
export function newsAfter(seenId: string | null): NewsEntry[] {
  const i = seenId ? WHATS_NEW.findIndex((e) => e.id === seenId) : -1;
  return i < 0 ? WHATS_NEW : WHATS_NEW.slice(0, i);
}

/** "5 Nov 2026", the way the app writes a date. */
export function newsDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m! - 1]} ${y}`;
}
