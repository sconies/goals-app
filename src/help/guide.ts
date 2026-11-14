/* The guide: what everything in the app does, one article per screen or feature, as data. The Help screens, the
   contextual Help link on every page and the AI assistant's get_help tool all read it from here.
   Keeping it true is enforced: src/help/guide.test.ts fails when a screen, a route or a requirement has no article,
   and CI fails a pull request that changes the app without a What's new entry (scripts/check-whats-new.mjs).
   Numbers that are rules (status bands, how long until a goal has no recent update) are read from the domain, never
   restated; where the guide says what a status, flag or result means, it reads the vocabulary (domain/vocabulary.ts). */
import { CAUSES_AHEAD, CAUSES_BEHIND } from '../domain/checkin';
import { RULES } from '../domain/thresholds';
import { textMatches } from '../domain/find';
import MODULE_HELP from 'virtual:faro-modules/help';
import { ATTENTION, ATTENTION_FLAGS, FLAG, HANDLED_LINE, GAP, LABEL, lower, OWNER_VIEW_LABEL, QUARTER, RESULT, STAGE, STATUS, TREND } from '../domain/vocabulary';
import { PROTOTYPE_LINE } from './about';
import { closestRoute, routePaths, routeScore } from './match';

/** "Word: what it means", as the vocabulary says it: how the guide states a definition. */
const define = (t: { label: string; long: string }) => `${t.label}: ${t.long}`;

export type GroupId = 'start' | 'week' | 'goals' | 'leading' | 'data' | 'you';

/** The Help page's sections, in order. */
export const GROUPS: { id: GroupId; title: string }[] = [
  { id: 'start', title: 'Getting started' },
  { id: 'week', title: 'Your week' },
  { id: 'goals', title: 'Goals' },
  { id: 'leading', title: 'Reviews and the year' },
  { id: 'data', title: 'Data in and out' },
  { id: 'you', title: 'People, workspace and settings' },
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
  /** Related articles. One from a module that's off or left out is simply not shown. */
  related: string[];
  /** A module's article: the article it comes after (else the end of its group). */
  after?: string;
  /** Set for a module's article: which module it's from (src/modules/<id>/help.ts). */
  module?: string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const causes = (list: [string, string][]) => list.map(([, l]) => l).join(', ');

/** The core's articles. Each module adds its own (its help.ts), and ARTICLES is all of them. */
const CORE_ARTICLES: Article[] = [
  /* ---------- Getting started ---------- */
  {
    id: 'home',
    title: 'Home and your week at a glance',
    summary: 'Home shows what needs you this week: one main thing to do, what people have asked of you, and the goals you own and watch.',
    group: 'start',
    sections: [
      { heading: 'What it’s for', text: ['Home is where you start each day. It answers one question first: what is asked of you today. If something is, it is the one big button on the page; if nothing is, Home says so in one line and has no big button at all.'] },
      { heading: 'How to use it', list: [
        'The lead, under the greeting, is the first of these that is true: your check-ins once their deadline has passed; your check-ins the day before they are due, or on the day of a review you’re in that reads them, or when you left one half done (Pick up where you left off); the wrap-up at the end of the year, once your check-ins are in; and a review you’re in, on its day or after it while it isn’t held (then it says Not held yet). Its ring says what it counts: check-ins, reviewed or wrapped.',
        'With two or more number goals to check in on, a quiet link under the button opens the table, to type all your numbers at once.',
        'This week, above the lead, shows a review you’re in, or one that has passed its day without being held, as one cell. It is left out when the lead is that review; with two reviews on one day, the lead takes one and the cell the other. Once the year has ended, no review is said to be not held.',
        'While someone waits for your response, Home doesn’t say nothing is asked of you: it says how many asks wait. If you’re an admin, a note says when the year is ending or has ended, with Start for the next one.',
        'Needs your response lists every ask waiting on you, grouped by kind: decisions or help, questions, updates asked for, and actions. Each says first how long it has waited or when it is due (a late one with the warning mark), then who asked, where and on what day; one that came to you with a goal you now own also says “Asked of Tunde, now yours”. Five show, then Show all. Each stays until you answer it, mark it done, or it’s withdrawn, and each has one button. Comments ask nothing, so they aren’t here. On a phone each is one short row with its button beside it, and what was asked wraps to a second line rather than being cut off.',
        'When an ask is late, due this week, or has waited a week or more, and nothing comes before it, it is the lead, with its one button (Respond, Answer, Check in or Mark done); the rest are under Also needs your response. A goal someone proposed for you is asked of you like an ask with no date: once a week has passed and no ask comes first, it is the lead, with Open it.',
        'Your goals come next, counted once: how many there are by status, each count opening exactly those goals in Goals (“1 at risk” lists the one). Then the ones that need attention, worst first, each with Check in when that is what it needs; what is being handled, folded away; and the rest, five at a time. Each row opens its goal. Your team and Goals you watch follow.',
        'On a phone, the reason a goal needs attention is kept to two lines, so you see more of the list. The whole reason is on the goal’s page, a tap away.',
        'Getting started, at the top, for your first two weeks in a new workspace: what is true and what to do first, each with one button. Whoever set the workspace up sees their first check-ins, “Give 2 goals an owner” for the goals they left without one, and the link to send their team (or, alone, Add people). Someone added by someone else is told who set it up and what is theirs, then their first check-in, or, owning none, the goals to see and watch and a goal of their own. Hide this removes it.',
        'After a release you haven’t seen, a quiet line at the foot of Home says what’s new in Faro. Open it, or dismiss it with the cross.',
      ] },
      { heading: 'In a workspace that doesn’t hold reviews', list: [
        'When an admin has switched Reviews off, Home leads with your check-ins, the wrap-up and what is asked of you, as above. Someone who owns no goals and watches some is led to the goals they watch that need attention, with See them; watching nothing, Home starts with what needs your response.',
        'A question waits by its own age (“Waiting since 4 Aug, 14 weeks”), and a next step says when you agreed it and the week it’s due.',
      ] },
      { heading: 'Why an ask says how long it has waited', list: [
        'An ask with a week it is due by is due that week’s Sunday. A question raised in a review is due before the review’s next session after the one it was raised in, and stays due then: it doesn’t move on to a later session when that one passes.',
        'An ask with no date says how long it has waited: “Waiting since 4 Aug, 14 weeks”. The oldest come first, after anything late or due this week.',
      ] },
      { heading: 'Your team on Home', list: [
        'If you are in a team, or lead one, and it has goals you don’t own, “Your team · CI/CD · 17 goals” follows your goals (“Your teams · 30 goals in 2 teams” when you lead more than one). It is exactly the My team tab of Goals: the same goals and the same total, and See them in Goals opens it.',
        'Its counts by status each open exactly those goals. Then “2 need attention that aren’t yours” opens Goals with those goals, filtered to Owner not you, and up to four of them are listed, each with its owner’s name first. Your own are in Your goals, so they aren’t listed twice. When nothing needs attention, it says so.',
        'When the goals you watch, or your teams’ goals, are more than twelve goals in two or more teams, they are shown as teams, worst first: the team with the most goals off track, then at risk, then with no recent update, first, as Goals orders By team. Each team’s name, its “3 need attention” and its counts by status open exactly those goals. Five teams show, then a link to the rest, by team. No person’s name is in this table: teams and goals are ranked, never people. On a phone each team is one stacked row.',
      ] },
      { heading: 'When Home has no button', list: [
        'Before the day your check-ins are due, Home says “Nothing is asked of you today.” and when they are due, with Check in early if you want to get ahead. When asks or proposed goals wait for you, it says so instead (“A proposed goal waits for your response.”).',
        'Once all yours are in, it says so in one sentence, with when the next are due. On the day you put the last one in, it says what the check-in’s last screen said: whether they were in before the deadline, and how many weeks in a row you have been on time, from two weeks.',
        'If you own and watch nothing, it says so, with a way to see the goals and to set one up.',
        'It never tells you about a deadline you met.',
      ] },
      { heading: 'Who can', text: ['Everyone has a Home. What is on it depends on the goals you own, the goals you watch and the reviews you’re in. There are no role labels.'] },
    ],
    routes: ['/'],
    screens: ['Home'],
    reqs: ['HOME-OWNER', 'HOME-MANAGER', 'PROFILES', 'SHAPE-MATCHES-WORD', 'DAY-ONE'],
    keywords: ['dashboard', 'start', 'streak', 'needs your response', 'today', 'this week'],
    related: ['check-in', 'needs-attention', 'requests', 'watching'],
  },
  {
    id: 'status',
    title: 'What the statuses mean',
    summary: 'Every goal has a status, always shown as a shape and a word together.',
    group: 'start',
    sections: [
      { heading: 'The statuses', list: (['on', 'risk', 'off', 'stale', 'none', 'planned', 'done'] as const).map((k) => define(STATUS[k])) },
      { heading: 'The shapes', list: [
        `${LABEL.on}: a filled circle.`,
        `${LABEL.risk}: a half-filled circle.`,
        `${LABEL.off}: an open ring. ${LABEL.off} goals also get a quiet wash over the whole row or card.`,
        `${LABEL.stale}: a dashed ring.`,
        `${LABEL.done}: a circle with a tick.`,
        'A shape always means its own word, wherever it is: a goal’s shape comes from its status, never from what flags it. A flag that isn’t a status, such as getting worse or a call greener than calculated, is said in words beside a small warning mark.',
      ] },
      { heading: 'Results, once a goal is due', list: [
        ...(['completed', 'late', 'missed'] as const).map((k) => define(RESULT[k])),
        `Each quarter of a goal year is ${QUARTER.met.label} or ${QUARTER.missed.label} against the owner’s own plan, in the same words; ${lower(QUARTER.open)} while it runs. A quarter that ended before the goal was set up is not applicable: it is never judged and counts nowhere.`,
        `At the wrap-up the owner says how it landed in their own words, shown as “${OWNER_VIEW_LABEL}”. It never changes the result.`,
      ] },
      { heading: 'Against the plan', list: [
        `The gap reads the same whichever way is better: “9 hours ${GAP.behind.label}”, “3 pts ${GAP.ahead.label}”, or ${GAP['on-plan'].label}. ${define(GAP.reached)}`,
        `A dated stage is ${lower(STAGE.planned)}, ${lower(STAGE.risk)} (${STAGE.risk.short}), ${lower(STAGE.off)} (${STAGE.off.short}) or ${lower(STAGE.done)}.`,
        `${define(TREND.worse)}`,
      ] },
      { heading: 'Whose call it is', text: [
        `The status is the owner’s call each week. The app works out what the numbers say and shows it beside the call. A call ${lower(FLAG.greener)} needs a reason, and is flagged.`,
        `A number goal is judged against the plan for that week, whether higher or lower is better. When the plan has moved less than the goal’s decimals can show (a new goal’s first week, say), the plan as written to those decimals counts as on plan. A range goal is at risk inside its warning margin or after one breach, and off track after two weeks out of range. A range between two numbers is out above its upper limit or below its lower one, and at risk within the margin of either. A stage up to ${RULES.lateWeeksOff} weeks late is ${lower(STATUS.risk)}; later than that is ${lower(STATUS.off)}.`,
      ] },
      { heading: 'Where to see it', text: ['The key under the goals on the Goals page has the same words. Open “What these mean” there for the full meanings.'] },
      { heading: 'Where the trend is heading', text: [
        'The app projects a number goal to its due week from a straight line fitted through its numbers of the last eight weeks, not from two weeks alone, so one noisy week can’t swing it. A slope the numbers barely support counts for little.',
        'The projection is a range: about two chances in three that the number lands inside it if nothing changes. A clean trend has no spread, so its range is a single number. It is the app’s estimate, kept apart from the owner’s own date.',
        'A projection only goes where the number can: a count of things (deploys, runbooks, incidents) never below zero, and a share never below 0% or above 100%.',
      ] },
    ],
    routes: [],
    screens: [],
    reqs: ['PROJECTION-RANGE', 'STATUS-BANDS', 'STATUS-DIRECTION', 'RANGE', 'MILESTONE', 'OWNER-CALL', 'STALE', 'GREENER', 'DESIGN-RULES', 'A11Y', 'ONE-VOCABULARY', 'ONE-TREND'],
    keywords: ['legend', 'key', 'on track', 'at risk', 'off track', 'no recent update', 'no check-in yet', 'not started', 'done', 'colour', 'shape', 'met', 'met late', 'not met', 'target reached', 'slipping', 'late', 'getting worse', 'red', 'amber', 'green', 'completed', 'quiet'],
    related: ['check-in', 'goal-page', 'needs-attention'],
  },
  {
    id: 'set-up',
    title: 'Setting up a workspace',
    summary: 'A workspace holds one organisation’s people, teams, goals and history. Setting one up takes four steps and about three minutes.',
    group: 'start',
    sections: [
      { heading: 'What it’s for', text: ['Start your own workspace with goals you type, your own spreadsheet, or none yet: there are no example goals to start from. Whoever sets it up is its first admin.'] },
      { heading: 'How to use it', list: [
        'Start from Welcome’s Set up a workspace (or the workspace switcher’s Set up a new workspace). It takes four steps, each at its own address, so your browser’s Back and Forward move between them and a reload stays put: the workspace and you (its name, three to 80 characters, counted as you near the limit; your name, email and team), people, goals, and Check. Each field says what it needs under it; Continue says where it goes next.',
        'In the team table, leave Team empty for your own team, or choose Same as above. A team typed close to another (“Suport” beside “Support”) is asked about, so a typo doesn’t make a second team: use the other name, or say it’s a different team.',
        'Everyone you add needs an email: it tells two people with the same name apart, in the app, in spreadsheets and through MCP.',
        'Set up from inside the app (from the workspace switcher or Workspace), the first step says “Setting up as” you, in one line; Change opens your name, email and team.',
        'Under the first step, How you’ll work says the usual in one paragraph: check-ins every week, by the review’s day; a weekly review on Thursdays; the year starting in January; Recording off. Change how you’ll work opens a sheet for the month the goal year starts, the review day and whether to record how the app is used (off unless you tick it). Changed, the panel says so. Check has the same Change.',
        'Goals offers three ways to start. Add your own (chosen to begin with) shows the outcome and up to four goals that feed it, to type in. Import a spreadsheet takes the template or a workbook (Choose a spreadsheet; a file with goals uploaded on People is used straight away). Later finishes with no goals: each owner adds theirs from New goal. Not sure what a good goal looks like? The link there opens the demo’s goals in a new tab, and your set-up is kept.',
        'Your spreadsheet can be the Excel template, or a whole workbook exported from another workspace: set-up reads its People (never its Asks), and its goals with their keys, decimals, due weeks, definitions and why each helps, their plans, and their past check-ins. Each sheet is known by its header row. Every row is checked as Import checks it, and Check shows the same preview Import does before anything is created: how many goals and people the file adds (a goal still to fix counted too), what must be fixed, and its questions, each with its answers. A goal owned by someone nobody typed offers “Add {name}” (they join your people, with the row’s team) or “Give it to someone here”; the person you give it to stands for the row’s other owner cells that name no one here, but never for one that names someone else here, which is still Must fix. A goal’s team one letter from a team already named (“Depot” beside “Depots”) is asked about, as a person’s is. A check-in’s “Choose a goal” finds the spreadsheet’s goals. After each answer the next question takes the focus. Create workspace waits until every question is answered.',
        'On the People sheet, a row whose Action says Example (the template’s) is skipped, and someone marked Left isn’t added: a goal they own then asks who has it. The upload says how many were skipped, and the preview how many Example goal rows. A file with no goals sheet, uploaded after one with goals, keeps those goals; a new goals file drops anyone its predecessor’s answers added.',
        'If the preview can’t load (a lost connection), Check says so and offers Try again; nothing you typed or answered is lost.',
        'Uploading a spreadsheet never replaces the people you’ve already typed: its people are added after them, anyone already there (the same email, or the same name) isn’t added twice, and what the file knows fills only fields you left empty. It says what it added; Undo puts the table back as it was.',
        'A goal from your spreadsheet with a stage due before the week you join, and no check-ins in the file, is asked about on Check, already answered “Count them from this week” as a template’s are, so it isn’t late on day one. Change, then Keep the weeks as typed, puts them back.',
        'With Add your own, name the outcome and add up to four goals that feed it (Add a goal stops at four; add more from New goal afterwards, and Undo brings back a goal you removed). Each can say how it’s measured, in one line: optional, but the goal page asks for it until it’s there.',
        'The outcome starts as yours; each goal feeding it starts with No owner yet. Give a teammate one, so they have something to check in on, or leave it: a goal with no owner is made yours, and Home asks you to give it an owner afterwards.',
        'Check (Step 4 of 4) reads back what Create will make: you, the people, the goals, the year, the review and Recording, each with Change. Change on a step brings you straight back to Check (Back to Check). Check each goal’s owner (or “No owner yet”: type a name to find one of the people you added), where it starts and its target before you create the workspace.',
        'Set-up makes the weekly review it describes: everyone, every goal, on the day you chose. It also pins three views for everyone: everything at a glance, off track or at risk, and no update for 2 weeks or more.',
        'Nothing is late on the first day. Set up after this week’s review day (on a Sunday, say), the first check-ins and the review’s first session are next week; before it, they are this week.',
        'Weeks follow the calendar: week 1 is the week with the first Thursday of the starting month, so in a January year week n is ISO week n.',
        'On a phone, the small links in set-up (Start over, Change) are as easy to hit as a button. Close and keep the draft leaves at any step; coming back picks up the set-up you hadn’t finished, at its step, with Start over (which asks first).',
        'The last screen gives you the one next thing to do, and a link to copy for your team: /join/ and the workspace. It opens this workspace and nothing else, and asks them which one they are (see Joining a workspace you were invited to). Faro sends no email: you send the link yourself.',
        'Set up with no goals (Later), nothing is due: no check-ins until there are goals.',
        'Set-up doesn’t ask who leads each team, so no team has a lead yet: an admin picks one under Workspace, Teams.',
        'In the demo, a workspace you made can start over from the Demo panel: it is removed from this browser, drafts and all. The walkthroughs there open the example, whose people and goals they follow.',
      ] },
    ],
    routes: ['/workspace/new', '/workspace/new/:step', '/ready'],
    screens: ['Onboarding', 'Start'],
    reqs: ['ONBOARDING', 'IDENTITY', 'WORKSPACES', 'CALENDAR-WEEKS', 'SETUP-UPLOAD'],
    keywords: ['onboarding', 'new workspace', 'template', 'who are you', 'how you’ll work', 'steps', 'sign in', 'first time', 'goal year', 'email', 'set up from a spreadsheet'],
    related: ['workspace', 'import', 'new-goal'],
  },
  {
    id: 'welcome',
    title: 'Welcome: starting, the demo, or an invitation',
    summary: 'Welcome is Faro’s front door, at its own address: set up a workspace, look around the demo, or join a workspace you were invited to.',
    group: 'start',
    sections: [
      { heading: 'What it’s for', text: ['Opening Faro on a device that remembers no workspace brings you here, at /welcome. It never drops you into a workspace you didn’t choose.'] },
      { heading: 'How to use it', list: [
        'Set up a workspace is the main button: about 5 minutes, and nothing is saved until the last step.',
        'Look around the demo opens a made-up division of about 100 people with a year of goals. It’s example data: change anything, but none of it can be kept or copied into a workspace.',
        'Join a workspace you were invited to: open the link you were sent, or paste it here and choose Open it. Only a Faro invitation (an address with /join/ in it) opens anything.',
        'Coming back, Welcome says Welcome back and lists what this device remembers: each workspace with who you are in it and the week, with Open, and a set-up you didn’t finish, with where it stopped, Carry on and Discard (which asks first: what you typed is lost).',
      ] },
    ],
    routes: ['/welcome'],
    screens: ['Welcome'],
    reqs: ['SETUP-FIRST-SCREEN'],
    keywords: ['welcome', 'front door', 'first screen', 'start', 'invitation', 'carry on', 'draft', 'welcome back'],
    related: ['set-up', 'joining', 'demo'],
  },
  {
    id: 'joining',
    title: 'Joining a workspace you were invited to',
    summary: 'An invitation is a link that opens one workspace: it says who set it up and what it holds, then asks which one you are.',
    group: 'start',
    sections: [
      { heading: 'What it’s for', text: ['Whoever set up a workspace copies its invitation and sends it themselves: Faro sends no email. The link (/join/ and the workspace) opens that workspace and nothing else, whatever your browser had open before. An older link with ?workspace= in it leads to the same place.'] },
      { heading: 'How to use it', list: [
        'Welcome to the workspace: who set it up and when, how many people and goals it has, then Which one are you?, with everyone listed by team and one line each (who set it up, an admin, how many goals they own, or no goals yet). With more than eight people, Find your name narrows the list.',
        'Choose your name: that is the whole step. Home opens as you, and this device remembers your answer. The first time anyone chooses their name, Activity says they opened the workspace for the first time.',
        'Not on the list? Ask whoever set it up to add you: the link writes them an email.',
        'Not you, or opened the wrong link? Go to Welcome, under the list, takes you to the front door, where you can open another workspace or set up your own. The invitation stays waiting until you choose a name.',
        'A link to a workspace that isn’t there says This invitation doesn’t open a workspace (it may have been deleted, or the link was cut short) and opens nothing else; Go to Welcome takes you to the front door.',
      ] },
      { heading: 'Saying who you are', text: ['Until company sign-in arrives, the app asks once on each device which one you are and remembers the answer. Choose Not you? in the person menu to change it. In the internal app, signing in with your company login replaces this step.', 'Where the app has a company sign-in instead, it opens a workspace as the person whose email you signed in with. If it can’t open you, it says you can’t open the workspace yet, and why: you aren’t signed in; no one there has that email; more than one person has it; or you’re marked as having left. Nothing of the workspace is shown. Copy a message for them writes the note to send whoever set it up, and Try again looks once more after they’ve fixed it.'] },
    ],
    routes: ['/join/:workspaceId/*'],
    screens: ['Start'],
    reqs: ['SETUP-FIRST-SCREEN', 'IDENTITY'],
    keywords: ['invitation', 'invite link', 'join', 'who are you', 'which one are you', 'sign in', 'not on the list', 'pick your name'],
    related: ['welcome', 'set-up', 'home'],
  },
  {
    id: 'demo',
    title: 'The demo',
    summary: 'The demo is a full copy of the app with one example organisation, Platform Engineering (about 100 people), kept in your browser, that you can change and reset freely.',
    group: 'start',
    sections: [
      { heading: 'What it’s for', text: [PROTOTYPE_LINE, 'Try everything without touching real data. The demo lives under /demo; the real app never shows the example or the demo controls.', 'The example is one division of about 100 people in 14 teams, with 12 north stars and a year of check-ins, reviews and asks: Amara Nwosu is its VP, Rhea Kapoor runs CI/CD and owns the lead time north star, Grace Achterberg is the admin.'] },
      { heading: 'How to use it', list: [
        'Open Demo (in the sidebar, or the header on a phone) to see the app as someone else: the VP, a director, goal owners, the admin or someone who only watches. Anyone else is found by typing a name, a job title or a team under Everyone else.',
        'Walkthroughs take you through the main journeys as the right person. A card says what to do and points at it; do the step and it moves on, or press Next to move on without doing it, and Back to go back. From a workspace you set up in the demo, they open the example, whose people and goals they follow.',
        'Start over resets the example: every change, drafts you didn’t post, what you’ve marked as seen in What’s new and on goal pages, a walkthrough you were in, and moved map cards and table layouts. Who you’re viewing as and your appearance settings stay. You can also present without the controls, or leave.',
        'In a workspace you set up in the demo, Start over removes it from this browser, drafts and all, and goes back to the example. Only an admin of that workspace sees it; in the example anyone may start over.',
        'Research opens a hub for people and AI agents testing the app: tasks, a protocol and a report. Feedback sent from the demo reaches the people building the app.',
        'Your changes are kept in this browser, on top of the example as it was built. If the browser won’t keep them (it’s full, or a private window blocks storage), a note at the top of the page says so: they last until you reload.',
      ] },
    ],
    routes: ['/research'],
    screens: ['Research'],
    reqs: ['DEMO-MODE', 'WALKTHROUGHS', 'RESEARCH', 'DEMO-FEEDBACK', 'PERSIST', 'DEMO-STORAGE'],
    keywords: ['example', 'try', 'walkthrough', 'tour', 'reset', 'start over', 'present', 'research', 'switch person', 'prototype', 'model', 'product', 'price', 'buy'],
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
        'Check-in in the menu opens on the week’s list: the goals to do this week, in the order the check-in takes them, each with its status and what it last said (“Last week: 36 hours · 8 behind plan”, or “No check-in yet”); then what you’ve done this week, each with Correct it; then a line to type all your numbers in one table.',
        'Start with walks through every goal due this week, one after another, as Start check-in on Home does. Or pick any goal on the list: Check in does just that one, and so does Check in on a goal’s page.',
        'Close a check-in you opened from the list and you’re back on it; what you typed is kept, and that goal’s row says Draft kept, with Carry on.',
        'With nothing left to do it says you’re all set for the week. Before the first check-ins are due it says when they are; if you own no goal it says so, with the goals you watch one click away.',
        'Once all your goals are in, the receipt says when against the deadline: “All 3 of your check-ins are in by Thursday.”, or “…came after Thursday” once the day has passed. When Reviews is on and a review is held on that day it says “before Thursday’s review” instead; with Reviews off, or no review that day, it never names a review.',
        'The top of the check-in says which week it is for and where you are in the week’s goals (“Week 46 check-in · 1 of 2”). A reload keeps your place.',
        'Type the number. The app shows it against this week’s plan, the gap and the status the numbers suggest, as you type. The plan written to the goal’s decimals is always on plan, even when the exact plan has more decimals than you can type.',
        `On plan, that’s it: post. Behind (under ${pct(RULES.onTrack)} of the planned progress) it asks for a cause and a sentence; well ahead (${pct(RULES.wellAhead)} or more) it asks why, and whether the target should change.`,
        `Causes when behind: ${causes(CAUSES_BEHIND)}. When ahead: ${causes(CAUSES_AHEAD)}. Something else lets you say it in your own words.`,
        'At risk and off track need a path to green: what changes, the week it is back on plan by, and any decision or help needed, from whom. All of it is one short account on one screen.',
        'If last week’s reason and path to green still hold, Still true posts them again, with any request still open. Correcting a check-in in the same week asks about this week’s earlier check-in instead. Something changed opens them for editing, in boxes that grow to show all of what you wrote last week.',
        'Behind needs a story, and Post alone never tells it: if what you opened with Something changed is still word for word what you said last time, the check-in asks you to change what’s different or tick Still true this week. The goal page then shows it as the same reason as last week.',
        'Milestone goals ask where each stage stands: done, on schedule, or late with a new week.',
        'What you type is kept as a draft until you post. Back returns to the step before, even in a draft you picked up later, so a wrong number can be corrected first; Discard draft throws it away and starts again.',
        `The status is your call. Change it if the numbers don’t tell the whole story; a call ${lower(FLAG.greener)} needs a reason.`,
        'A number is kept exactly as you type it, never rounded quietly. One with more decimal places than the goal keeps (12.5 in a goal of whole numbers) is refused with what it would show as: type it to the goal’s places, or choose Keep 1 decimal place for this goal, which changes the goal’s decimals in one step, logged on its history.',
        'A number far outside the goal’s plan (more than twice the plan’s width beyond either end), or three times last week’s or a third of it, is questioned, never refused: real numbers can be odd.',
        'Letters in a number get the same message on every screen, sheet and AI tool: type digits only, with an example at the goal’s decimal places (like 29 for a goal of whole numbers). Every number Faro shows has its thousands grouped: 1,250.',
        'The check-in, the one-table check-in and a spreadsheet use one number check, with the same words. Below zero is refused for a percentage, a time, money or a count (pairs, deploys); a count past its target (41 of the top 40) is questioned.',
        'A number that looks wrong (ten times last week’s, say) is a question you answer before posting: “Yes, it’s right” or change it. The same number as last week asks whether you measured it again. Your answer is kept in the goal’s History. A number that can’t be used says what to fix.',
      ] },
      { heading: 'A number filled in from its source', list: [
        'With the Metric library on, a goal measured by a metric whose source Faro can read opens its number step with the latest reading already in the field: “From CI analytics, read 9:02 today.” The button says the number (“Confirm 12 min”), so confirming is something you read, not a reflex. Nothing is posted until you finish the check-in, and a week you don’t check in stays a week with no check-in.',
        'If the number is wrong, type yours. Faro then asks why it’s different: the source is behind, it counts something else, it’s wrong this week, or something else (say more, in at least 10 characters). Your number is the check-in’s; the reading and your reason are kept beside it. It doesn’t change the goal’s status and nobody is told. Put 12 min back undoes it.',
        'A reading more than 7 days old isn’t filled in, and its value isn’t shown: type this week’s number, or say there isn’t one. A source that measures only the whole company never fills in a team’s goal. A source with nothing new since your last check-in, nothing yet, or that can’t be reached just now says so, with Try again.',
        'After posting, the check-in says where its number came from: “12 min, from CI analytics, read 9:02 today. Confirmed by you.”, or “14 min, typed. CI analytics said 12 min: the source counts something else.”',
      ] },
      { heading: 'Ad hoc check-ins and corrections', list: [
        'Check in as often as you like. Every check-in is kept with its time; the latest in a week is that week’s status. A second check-in in a week is compared with last week, not with your first one, and so is the goal’s “vs last week”.',
        'Checking in again adds a check-in beside the week’s first. Correcting one replaces it and needs a reason, kept with it in History.',
        'Got something wrong? The receipt after posting has Correct this check-in. It asks why you are changing it (a sentence, at least 10 characters), replaces the check-in rather than adding a second, and opens the goal, whose History says “Corrected week 45: 60% is now 61%” with your reason. Undo on the message that follows puts the first one back, and History no longer says it was corrected. The form starts from what the check-in said, so you change only what was wrong. A cycle that has ended can’t be corrected here, or anywhere else: Data’s tables, the AI assistant and a spreadsheet refuse it too.',
        'Changing a week’s check-in in Data’s tables, or through the AI assistant, corrects it the same way: it asks why first, and History says “Corrected week 45” with your reason. An admin can correct a past check-in in Data.',
        'A correction never changes whose check-in it is: it stays the person’s who posted it, wherever it was corrected (the form, Data, the AI assistant or a spreadsheet). History names who corrected it, with the reason: “Corrected week 45: 60% is now 61%, by Amara Okafor: …”.',
        'Answers you haven’t posted are kept as a draft and offered back when you return. Posting twice by accident is not possible.',
        'Right after publishing a goal, its owner is offered the first check-in, so everyone sees where it stands from day one.',
        'The first check-in sets where a goal stands today. If the goal was set up in the last four weeks and the number isn’t where its plan starts, you’re asked: start the plan from this number (same target, due week and shape; no reason needed, with Undo), or keep the plan and say why.',
      ] },
      { heading: 'When the week’s are all in', text: [
        'The last screen says whether your check-ins were in before the deadline (“All 4 of your check-ins are in by Thursday.”; if you are in a review held that day, “… before Thursday’s review.”) and, from two weeks, how many weeks in a row you have been on time. If some came after it, it says how many, and when the next are due.',
        'One late or missed week doesn’t end a run: if the four weeks before it were on time, it is forgiven and not counted, and the next check-in says so once. On time means by the deadline day on your own clock. A week added later never counts as on time, a goal called Done leaves your run, and a goal you take over counts only from when it became yours. Only you see your run.',
        'When a check-in takes a goal to its target, the last screen says so quietly, with a way to copy the goal’s share image; when it brings a goal back on track after two weeks or more behind, it says that. The goal’s History marks the week “Reached its target” or “Back on track”. A correction never does.',
      ] },
      { heading: 'Who can', text: ['Only a goal’s owner checks in on it, here, in the one table or through the AI assistant; an admin is no exception. An admin can still correct a check-in that exists in Data, and bring in everyone’s past weeks from a spreadsheet, but not add this week’s new check-in for someone: one pasted row is refused, saying a workbook brings in past weeks. A pasted row that replaces someone’s check-in for this week is a correction: Preview asks why first, and the check-in stays theirs. Anyone can ask the owner for an update from the goal’s page.'] },
    ],
    routes: ['/check-in', '/check-in/:goalId'],
    screens: ['CheckInFlow', 'CheckInQueue', 'CheckInNumber'],
    reqs: ['CHECK-IN-QUEUE', 'NO-SILENT-ROUNDING', 'CARRY-OVER', 'GREENER', 'REASON-BEHIND', 'REASON-AHEAD', 'PATH-TO-GREEN', 'CHECKIN-STATUS-VS-PLAN', 'ONE-PER-WEEK', 'UPDATE-ANYTIME', 'OWNER-ONLY', 'ONE-ACCOUNT', 'OTHER-CAUSE', 'NO-DOUBLE-POST', 'DRAFTS', 'FIRST-CHECKIN', 'HONEST-CHECKIN', 'HABIT-RECEIPT', 'HABIT-MOMENT'],
    keywords: ['update', 'weekly', 'number', 'post', 'list', 'queue', 'source', 'reading', 'filled in', 'confirm', 'streak', 'in a row', 'forgiven', 'target reached', 'back on track', 'start with', 'draft kept', 'cause', 'reason', 'path to green', 'recovery', 'still true', 'correct', 'ad hoc', 'stages', 'milestone', 'behind', 'ahead'],
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
        'Type numbers as you write them: a comma as the decimal mark (3,9) reads as 3.9, as in the one-by-one check-in.',
        'A number that looks wrong (ten times last week’s, say) is asked about under its row, as on the one-by-one check-in, and the row waits until you answer. Your answer is kept in the goal’s History. A number that can’t be posted at all says “Must fix” under its row.',
        'With the Metric library on, a row whose metric’s source has a new reading shows it in faint ink, with “From CI runner metrics, read 9:00 today.” and “Confirm 8 min” under it. A filled-in number isn’t posted until you confirm it, with that button, with “Confirm all readings” for every such row, or by typing your own (then the row asks why it differs).',
        'Post counts the rows that are ready and posts those (“Post 2 check-ins”). A row that still needs something says so under it, and the bar above Post says how many aren’t ready; they stay in the table until they are.',
        'After posting you land on the same confirmation as the one-by-one check-in: the week’s ring, each goal posted with its number and status, and any rows kept back.',
        'The table and the one-by-one check-in share one draft per goal: a number typed in one is there in the other. Drafts are kept across a refresh until you post them. Use the normal check-in for milestones or a longer account.',
      ] },
      { heading: 'Who can', text: ['Owners, for their own number goals.'] },
    ],
    routes: ['/quick-check-in'],
    screens: ['QuickCheckIn'],
    reqs: ['BULK-EDIT', 'DRAFTS', 'NO-DOUBLE-POST', 'HONEST-CHECKIN'],
    keywords: ['quick check-in', 'table', 'all numbers', 'bulk', 'fast'],
    related: ['check-in', 'home'],
  },
  {
    id: 'requests',
    title: 'Asks: decisions, updates, questions and actions',
    summary: 'Anything that needs someone to respond is an ask: a decision or help, an update, a question or an action. Each stays open until it’s answered (an action: done) or withdrawn.',
    group: 'week',
    sections: [
      { heading: 'What it’s for', text: ['An ask names what’s needed, who must respond and, if it matters, by when, so it’s answered once and not lost in a comment. Comments are free conversation: they ask nothing of anyone, and never answer or close an ask.'] },
      { heading: 'The four kinds', list: [
        'A decision or help: an owner needs it from someone, and says so in a check-in that is behind (“Need a decision or help”, and who it’s for).',
        'An update: someone asks a quiet goal’s owner to check in, from the goal’s page. The owner’s next check-in answers it.',
        'A question: for a goal’s owner, asked in a review or from the goal’s page (Ask {owner} a question, under Next steps and asks).',
        'An action: agreed in a review, for someone to do, with a week it’s due by if one is set. Past its week it shows as overdue until it’s marked done or withdrawn.',
      ] },
      { heading: 'How to use it', list: [
        'Whoever must respond sees each ask once on Home under Needs your response, grouped by kind, however many goals it covers. Its button opens the goal with the ask open in Next steps and asks, under For you, in the Respond panel, the box ready.',
        'The Respond panel is the same for every kind: answer it, check in (an update; the goal’s owner only, as check-ins are theirs), or mark it done (an action). Answering closes it for every goal it covers. For a decision, Ask the owner first asks them a question of your own and leaves theirs open.',
        'On a goal’s page, Next steps and asks lists every ask and next step on it once: the kind and its words, who and when, and whether it’s open, overdue (with by how much), answered or done. Each row has at most one button for you: Respond, Answer, Mark done, Check in or Withdraw.',
        'Waiting on a decision already asked for another goal? Say so in the check-in: link to that request instead of asking again, and one answer covers both goals.',
        'Still true in the next check-in carries an open request forward; dropping the ask withdraws it.',
        'When a goal changes owner, its open asks of the old owner go to the new one, who sees them on Home (“Asked of Tunde, now yours”). The ask’s history says so, for whoever asked; answered asks stay as they were. An ask about another goal the old owner keeps stays with them.',
      ] },
      { heading: 'Who can', list: ['Only the person asked, or an admin, answers an ask. One asked of no one in particular can be answered by anyone.', 'Whoever does an action, whoever agreed it, or an admin marks it done.', 'Whoever asked, or an admin, withdraws an ask; for a decision or help, the owner of the goal it was raised on can too.'] },
    ],
    routes: [],
    screens: ['Respond'],
    reqs: ['PATH-TO-GREEN', 'ONE-ASK'],
    keywords: ['ask', 'asks', 'request', 'decision', 'help', 'question', 'action', 'update', 'answer', 'respond', 'mark done', 'overdue', 'withdraw', 'blocked', 'escalate'],
    related: ['check-in', 'home', 'reviews', 'goal-page'],
  },

  /* ---------- Goals ---------- */
  {
    id: 'goals',
    title: 'Goals and its layouts',
    summary: 'Goals opens on yours. Tabs choose whose goals (Mine, My team, Watching, All); Group arranges them, Needs attention narrows them, and layouts choose how they look.',
    group: 'goals',
    sections: [
      { heading: 'What it’s for', text: ['Scanning the whole set of goals, or a slice of it, in whatever shape suits the question you have.'] },
      { heading: 'How to use it', list: [
        'Tabs say whose goals: Mine (the goals you own), My team (your team’s, and those of any team you lead), Watching (the goals you follow) and All, each with its count. A tab is shown once it has goals in it and isn’t the same list as one before it (in a workspace of one team, My team is All, so it isn’t shown); All is always there. The same goes for a feature’s menu row, such as Metrics, which appears with the first metric. Every address still opens. Goals opens on the tab you used last, else Mine, else Watching. A tab you don’t have (Mine when you own nothing) isn’t shown.',
        'Group arranges them: As trees (each top goal with what feeds it; All’s own), By team, By level, or None (one list, worst first; every other tab’s own). Needs attention · {n} is a switch beside it: on, any tab lists the goals that need attention first and those being handled below, and the line under it says why.',
        'One line counts what’s shown and their statuses, worst first (“17 goals, worst first. 2 off track · 4 at risk …”); with Needs attention on it says how many need attention and why.',
        'By team lists the teams worst first: the most goals off track, then the most at risk, then no recent update and no check-in yet. Each team says how many of its goals have each status, with its shape and word.',
        'Layout chooses how they are drawn: List, Table (sortable, with the headings kept in view), Board (lanes by status), History (quarter results and weekly status, each goal’s number now at the end of its row) and Map. Layout is a menu at the end of the bar that says the open layout (“Layout: List”) and what each one shows. Your last layout is remembered and is in the link. A new layout is drawn in place; rows slide only when the order changes within one, after a sort or a filter.',
        'Views, at the right of the tabs, holds your saved views (pinned ones first, the open one marked Current), then Save this view…, Copy link and Export these goals; with a saved view open, also Rename…, Pin for everyone (admins) and Delete this view…. It means the same on every screen.',
        'The title, the tabs and the bar stay exactly where they are whichever layout you choose; only the goals under the count line widen for Table, Board, History and the Map. On the Map, Group and Sort can’t be changed: the Map is always the trees.',
        'On a phone the active filters wrap onto more lines rather than running off the edge, and a saved view’s name is always shown in full. On a wider screen every tab is shown whole.',
        'Old links still work: Trees, By level, By team and Needs attention open All with that group or the switch, /watching opens Watching, and a saved view made before keeps working.',
        'The Board shows up to eight goals in the On track and Done lanes before Show all, and each card says which goal it feeds into. Every card starts with its own status, a shape and its word, so a card still says where it stands on a phone, where the lanes stack and its lane’s heading has scrolled away.',
        'Decision or help needed means the same goals everywhere: the Goals filter and the saved views built on it, the Table’s story line and the Board’s order all ask the one rule, an open ask for a decision or help on a goal that isn’t done.',
        'Cards has gone: List shows everything it did. A link or saved view that opens Cards opens List, and says so once.',
        'Each tab and layout you choose is a step: Back takes you to the one before, with its search as it was.',
        'A link with a tab this workspace doesn’t have opens the one you’d open first, and a short line says so.',
        'On a phone the goals come first. The tabs are one row that scrolls sideways, the open one kept in view; then the search and Filter and sort (Sort is in its sheet); then Needs attention at the left and View at the right, which says the layout and the group (“View: List, as trees”). View opens one sheet: Layout, Group (not on the Map), your saved views, then Save this view…, Copy link and Export these goals. Each choice applies at once; Done closes it. The note about first check-ins is one line, with Why? for the rest.',
        'When two goals have the same title, each shows its key beside it, here and on the Board, History, the map and the check-in.',
        'Every goal that is off track, at risk or quiet tells its story where it is listed: why, what the owner will do, by when, and what they need from whom.',
        'In the Table, select goals to change their owner or level, watch them or export them.',
        'In the sidebar, Goals has your saved views under it.',
        'The status key sits under the goals. New goal is a quiet link at the top right; the sidebar’s New goal opens it from anywhere.',
        'Proposed goals are never among these and never counted with them: the count line adds “· 1 proposed”, a link that lists them. The Filters sheet has State: Active (the default) or Proposed.',
        'Goals is the same whether or not a workspace holds reviews: every list, filter and view works without them, and a link that opened Goals for a review’s goals opens Goals without the review.',
      ] },
      { heading: 'Who can', text: ['Everyone sees every goal. Owners change their own goals from the Table; admins can change any.'] },
    ],
    routes: ['/goals', '/goals?view=list', '/goals?view=table', '/goals?view=board'],
    screens: ['GoalsScreen', 'GoalViews', 'GoalTable', 'GoalBoard', 'BulkEdit', 'StoppedList'],
    reqs: ['GOALS-SCOPE', 'GOALS-ATTENTION', 'GOALS-ADDRESS', 'GOALS-MENUS', 'VIEWS', 'OUTCOME-TREE', 'HIERARCHY', 'STICKY-HEAD', 'NAV-GOALS', 'STORY', 'LEVELS', 'BULK-EDIT', 'SMALL-MENU'],
    keywords: ['list', 'table', 'board', 'cards', 'health', 'trees', 'layout', 'by team', 'by level', 'mine', 'portfolio', 'outcomes', 'story', 'phone', 'views'],
    related: ['goals-filters', 'history', 'goal-map', 'needs-attention'],
  },
  {
    id: 'goals-filters',
    title: 'Search, filters, sort and saved views',
    summary: 'Narrow the goals to what you need, sort them, and save the result as a view you can reopen or share.',
    group: 'goals',
    sections: [
      { heading: 'How to use it', list: [
        'Search finds goals where every word appears in the title, owner, team, level, the owner’s reason, recovery plan or definition. Type or paste as fast as you like: the goals follow a moment after you stop.',
        'Search for a goal’s key to find it, however it’s typed: G-48, g48 or just 48. A key finds only its own goal; a bare number also finds goals with that number in their words.',
        'Clear search and filters, or removing the search, keeps the tab, the layout and the sort you had.',
        `Filters cover status, level, team, owner and type; ${lower(ATTENTION.needs)} (the same goals Home and Watching list, with those ${lower(ATTENTION.handled)} listed below them), narrowed if you like to why: ${ATTENTION_FLAGS.map((k) => lower(FLAG[k])).join(', ')}; due date; no update for some weeks (counted the way ${lower(STATUS.stale)} is); last quarter ${lower(QUARTER.met)} or ${lower(QUARTER.missed)}; result; a goal’s tree; and also-helps links.`,
        'Under the bar, one line counts the goals that match; under it, the filters in words (“Filtered by: Status Off track · Owner Rhea Kapoor”), each with Remove. A search is never listed as a filter.',
        'Owner not you is the goals someone else owns: Home’s “need attention that aren’t yours” opens Goals with it, so your own goals are left out.',
        'Sort by worst first, name, owner, team, level, furthest from plan, longest since a check-in or due soonest. Sorted, the Trees tab is one list across every tree, so worst first means the worst anywhere; clear the sort to see the trees again. By level and By team keep their groups.',
        'Everything is in the link: Copy link, in Views, shares exactly what you see. Save this view…, also in Views (in View on a phone), keeps it under a name: it shows as a tab while it’s open, and Views lists it the rest of the time. Rename or delete it from Views while it’s open.',
      ] },
      { heading: 'Who can', text: ['Anyone saves their own views. Admins can pin a view for everyone.'] },
    ],
    routes: ['/goals?q=*', '/goals?status=*'],
    screens: ['GoalFilters', 'GoalFilterSheet'],
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
      { heading: 'What it’s for', text: ['Keeping attention on the exceptions: what is behind, without a recent update or getting worse, and that nobody has picked up yet.'] },
      { heading: 'What it means', text: [ATTENTION.needs.long, define(ATTENTION.handled), HANDLED_LINE] },
      { heading: 'Why a goal is flagged', list: [...(['off', 'risk', 'stale'] as const).map((k) => `${STATUS[k].label}: ${STATUS[k].meaning}`), ...(['decision', 'no-path', 'missed-path', 'trend', 'greener', 'due'] as const).map((k) => define(FLAG[k]))] },
      { heading: 'How to use it', list: [
        'Each goal leads with its status, its shape and word, and then each flag is one line with its reason, in numbers where there are numbers. A goal on track that is getting worse keeps its on-track shape: the flag is said beside the warning mark, never with another status’s shape.',
        `A new check-in, or a new flag, makes a goal that is ${lower(ATTENTION.handled)} need attention again.`,
        'Nothing is hidden: wherever the goals that need attention are listed, those being handled are listed below them. Filter Goals to your team and Needs attention shows every goal of theirs that is behind, in hand or not.',
        'Being handled takes a plan: an action with an owner and a due week agreed after the latest check-in, or, for a goal at risk, an answer to its request. An off-track goal stays counted until it has an action. A goal someone only marked reviewed or noted still needs attention; pointing at its reason says who looked at it (“Looked at by Amara in Platform leadership weekly, week 45”).',
        'On Goals, the Needs attention tab’s count counts the goals that need attention, not those being handled, and says so if you point at it. One line above the goals says the same for the goals shown (a team filter counts that team); Why? says what the count is made of: how many are off track, at risk or without a recent update, and how many are on track but flagged for something else (getting worse, a missed date, an ask waiting). The health line there counts the same goals. On the Board, a goal being handled says so on its card.',
        'Home, Watching, Goals (the Needs attention switch and filter, on the Map too), the review agenda and MCP all pick the same goals, and list the two apart, saying what is in hand: for example, “Action: Farah, due week 46”.',
      ] },
    ],
    routes: ['/goals?show=attention'],
    screens: [],
    reqs: ['ATTENTION', 'ATTENTION-HANDLED', 'EXCEPTIONS-FIRST', 'ONE-ATTENTION-RULE'],
    keywords: ['attention', 'handled', 'exceptions', 'flag', 'warning', 'slipping', 'worse', 'getting worse', 'decision', 'path to green', 'greener', 'red'],
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
        'In both, the last column, Now, is each goal’s latest number (or stages done), as the list and the table say it.',
        'Weekly status is the other choice: each square is the owner’s call that week, one quarter at a time or the whole year.',
        'Select a square to read it in words beside the grid: the week and its dates, the goal, the call, the number and that week’s plan. The arrow keys move between squares.',
        'Once a goal is done it needs no more check-ins, so the weeks after say “Done since week 37” (its week), not that a check-in is missing.',
        'On a goal on track or done now, a quarter it didn’t meet is shown quietly, as history, rather than as a warning.',
        'A quarter that ended before a goal was set up says Not applicable, with the week it was set up. It is never judged, and is in no count of met or not met. A quarter with nothing due says None due. The key has both, and the goal’s page and its printed page use the same words.',
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
    id: 'goal-page',
    title: 'A goal’s page',
    summary: 'Everything about one goal: how it’s doing, why, what’s being done, where it’s heading, and what has happened.',
    group: 'goals',
    sections: [
      { heading: 'What it’s for', text: ['Understanding one goal in a couple of seconds, then acting on it: checking in, answering what’s asked of you, commenting or watching. Each fact is said once, in one place.', 'A proposed goal’s page is simpler: Proposed above the title, what it would measure, and Make it active, Change it or Withdraw it for those who may (see Proposed goals).'] },
      { heading: 'The summary bar', list: [
        'First line: the goal, its owner, its level and its key (G-12). Then its status as a shape and a word, and the number in the goal’s own units.',
        'A goal whose number isn’t measured yet (the metric that measures it has a gap) says “Not measured yet”, with a broken ring, instead of a status: it is held to no number, so nothing on it is due or late and it projects nothing, until the metric is measured.',
        'Before a goal’s first check-in, a baseline it was given with its period is shown as its number, with “Baseline, June to September 2026, provisional” beside it; lists say “41.5 min (baseline)”. Its status is No check-in yet as before, until someone checks in.',
        'Beside the key: when it was last updated, the latest check-in’s date and its week (“Updated 6 Nov · week 45”).',
        'Under them, the scorecard: four short cells, each with a label, a value and one line to back it up. For a number goal: Vs plan (“9 hours behind”, against this week’s plan), Vs last week (the latest check-in against the one before, worse or better whichever way is good; if a week was skipped it names the week it compares with), To target (what’s left to go; when lower is better, how far over the target it still is: “5 min over”), and Will it hit the target. A gap on the wrong side of a plan says “short” when higher is better and “over” when lower is better, and a number shown equal to its plan counts as met.',
        'Will it hit the target says Likely, Possible, Unlikely or Very unlikely, never a percentage. It comes from where the target sits against the projected range: comfortably on the near side of the likeliest value is Likely; close to it, or inside the range beyond it, is Possible; just beyond the range (within half its width) is Unlikely; further is Very unlikely. Under it, the likeliest end, such as “likely 37 hours by year end”.',
        'A goal that keeps a number within a limit gets Vs the limit, Vs last week, Room to the limit and Will it stay within. Dated stages get Stages done, Stages behind (slipping or late) and Next stage: when it now lands, and the week it was due if it’s late.',
        'One main button, for what you’d most likely do next: answer something asked of you, check in when it’s due, ask a quiet goal’s owner for an update, or watch it. The “…” menu has Share image, Copy link, Print or save as PDF, Change this goal, and Stop this goal (with check-ins, asking why) or Delete this goal (with none).',
        'As you scroll, the bar shrinks to one line on a solid panel at the top: the status, the number and the gap to plan (“Off track · 37 hours · 9 behind plan”), and the “…” menu. On a phone the bar takes the place of the app’s header.',
      ] },
      { heading: 'The buttons', list: [
        'One main button, for what you’d most likely do next, in this order: answer a question or a decision asked of you here; post the first check-in, or check in for this week when it’s due (the owner); mark your next step done; Add a next step, when the goal is behind and its owner has no next step open; ask a quiet goal’s owner for an update.',
        'Beside it, a plain button: the owner always has Check in again (unless the main button is the check-in); anyone else has Watch, or Watching once they do.',
        'The “…” menu has Share image, Copy link, Print or save as PDF, and for the owner or an admin Change this goal and Stop this goal (with check-ins, asking why) or Delete this goal (with none). Only the owner checks in, from the bar.',
      ] },
      { heading: 'In order, on a computer and a phone', list: [
        'Under the scorecard, links to each section: Now, Next steps and asks (with how many are open), Why, Chart, What feeds it, History and About. A goal with no check-in yet says “The scorecard starts with the first check-in.” instead of empty cells.',
        'Next steps and asks: everything asked and agreed on the goal, in one list, shown once. What waits on you comes first, under For you; then the rest that is open, overdue steps first; then the last three answered or done, with Show all for the others. Respond, Answer and Mark done open the Respond panel right in the row.',
        'If the goal is behind and nobody has said what happens next, the list says so, with the warning mark: “No next step yet.” Add a next step asks what, who (find them by name or team; it starts with you, and the owner) and the week it’s due by. Anyone but the owner can Ask the owner a question; the owner’s Ask for a decision or help opens this week’s check-in, where a decision or help is raised.',
        'Why: the owner’s reason from their latest check-in (one an admin loaded is said as theirs, by name), its cause and since when, anything else that flags it, and the owner’s path to green with its date. When it waits on a decision, Why says whose and links to Next steps and asks; the ask’s words are said only there.',
        'The chart: the plan as a broad pale band, the actual as a solid dark line on it, the app’s projection as a shaded range, and the owner’s path to green. It marks the scorecard’s numbers where they are. Drag along it to read any week.',
        'Last time we talked: the last review that discussed it and what was noted (what was agreed is in Next steps and asks), and when it’s next due.',
        'What feeds it: what it feeds into, and how the goals directly feeding it stand, the one most likely to make it miss first.',
        'The comment box is one line, Add a comment, until you press it. Open, it says who will see what you write before you post: everyone in the workspace can read it, and the owner and the people watching see it on Home. Cancel closes it and keeps what you typed.',
        'Watch opens a sheet that says what watching does: the goal’s check-ins, changes of status and new asks show on your Home and under Watching in Goals, your name is listed under Watched by, and Faro sends no email. With goals feeding it, choose this goal, or it and everything feeding it. Watching, the same sheet has Done and Stop watching; each says what it did, with Undo.',
        'This year by quarter, then History: every week from when the goal was set up to this one, newest first, with its check-in or “No check-in” (four or more missed in a row are one line, “Weeks 12 to 17 · No check-ins (6 weeks)”), and the goal’s comments, what reviews said and its changes, with a comment box at the top. This week’s check-in points to Why for its reason rather than saying it twice.',
        'A check-in whose number was filled in from its metric’s source says so on a second line in History: “From CI analytics, read 9:02 on Thu 12 Nov. Rhea Kapoor checked in.”, or, when the owner typed their own, “Typed by Rhea Kapoor. CI analytics said 13 min.” with their reason. It is a fact about the check-in, so it stays when the Metric library is switched off.',
        'History’s filters, each with its count: All, Check-ins, Comments, Reviews (what was said in a review, and asks raised in one, even after the review is renamed) and Changes (edits to the goal, its plan, owner and the rest). The filter is in the address (?history=changes), so a link or a reload shows the same list; Show all is ?all=1. With more than 30 entries, find in the goal’s history, or go to a week. An old link to #activity opens History.',
        'About this goal: what it measures (or Describe it, for the owner, when it isn’t described yet), its plan and target week by week, level, team, what it feeds, who watches it, its key and every plan change, and one link: Change this goal. It’s open the first time you visit, and folded after.',
        'On a computer from about 1,100 px wide, Next steps and asks and Last time we talked sit in a side column; on a phone everything is in one column, in this order.',
      ] },
      { heading: 'In a workspace that doesn’t hold reviews', list: [
        'When an admin has switched Reviews off, the page has Next steps and asks, Why, the chart, What feeds it, History and About, and nothing else in their place. Questions say who asked and when; a next step agreed in a review still says, in words, where it was agreed.',
        'History keeps everything said in reviews, and its Reviews filter is there while it has entries. An address that opened a goal in a review’s walk opens the goal’s own page.',
      ] },
      { heading: 'Changing it', list: [
        'Change this goal (in About, or the “…” menu) opens the goal’s form. Each change asks why once check-ins have started, and the reason goes in the activity for everyone watching.',
        'Your own comments have Edit (they then say edited) and Remove; an admin can remove anyone’s, leaving “Comment removed” in its place. The latest check-in has Delete this check-in, for the goal’s owner (check-ins are theirs, whoever posted it); after a newer one it can only be corrected.',
        'Whoever agreed a next step, or an admin, can change its words, who or when with Change on its row; the log keeps the before and after.',
      ] },
      { heading: 'A done goal', list: [
        'Once the owner calls a goal done, it shows its final result, not a forecast: Result says Done, with the number it closed on and its week, where Will it hit the target was. Its chart has no projection, lists and exports give no forecast, and a quarter after the one it was done in says None due, done in week 38, rather than In progress.',
      ] },
      { heading: 'A stopped goal', list: [
        'A goal stopped mid-year keeps its page, marked Stopped (a ring with a bar across, and the word), with who stopped it, when and why. Its chart, check-ins and activity stay as they were; it has no main button, and Restart it is there for an admin or whoever stopped it.',
        'A stopped goal makes no forecast: its scorecard keeps Vs plan, Vs last week and To target as they stood, without Will it hit the target, and its chart has no projection.',
        'It is out of every list, count, review and Home, but still in exports (Status: Stopped) and Activity. Goals lists the year’s stopped goals with the State filter on Stopped, most recently stopped first, with who stopped each, when and why.',
      ] },
      { heading: 'Sharing it', list: [
        'Share image copies a picture of the summary bar and a small chart, with the goal’s link. Where the browser can’t copy a picture, it saves one instead and copies the link.',
        'The picture has your company’s numbers in it, so share it where they belong. A pasted link shows the goal to people who can sign in.',
      ] },
      { heading: 'Who can', list: ['The owner checks in and changes the goal; admins can change any goal.', `Anyone can add a next step, watch, comment, share, ask the owner a question, or ask for an update when it has ${lower(STATUS.stale)}.`, 'A button you may not press isn’t shown.'] },
    ],
    routes: ['/goals/:goalId'],
    screens: ['GoalScreen'],
    reqs: ['GOAL-ACT', 'GOAL-ASK-ONCE', 'GOAL-HISTORY', 'GOAL-SAYS', 'GOAL-PAGE', 'CHART-READ', 'GOAL-PAGE-BAR', 'GOAL-PAGE-SCORECARD', 'GOAL-PAGE-ONCE', 'GOAL-PAGE-INTENT', 'GOAL-PAGE-ALIVE', 'GOAL-SHARE', 'PROJECTION-RANGE', 'GOAL-SUMMARY', 'NOTES', 'FORECAST', 'STORY', 'ASK-UNDO', 'GOAL-STOP'],
    keywords: ['goal', 'chart', 'summary', 'scorecard', 'will it hit', 'likely', 'vs last week', 'projection', 'forecast', 'range', 'comments', 'activity', 'path to green', 'feeds', 'trend', 'owner', 'share', 'image', 'since you looked', 'next steps and asks', 'next step', 'for you', 'check in again', 'history', 'missed weeks', 'no check-in', 'watch', 'comment', 'who sees it', 'about'],
    related: ['check-in', 'edit-goal', 'keys', 'print', 'removing'],
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
        'Open a goal straight from its key: /goals/G-12. Or type the key in Goals’ search: G-12, g12 and 12 all find it.',
        'Imports and MCP accept a key wherever a goal’s ID goes, and look for the key first: a file from last year still finds the goals carried over, which keep their keys but not their IDs. Check-ins, plans and people have IDs that never change, shown first in Data; people are also matched by their email.',
      ] },
    ],
    routes: [],
    screens: [],
    reqs: ['READABLE-IDS'],
    keywords: ['key', 'id', 'G-1', 'identifier', 'reference', 'link to a goal'],
    related: ['goal-page', 'data', 'import'],
  },
  {
    id: 'finding',
    title: 'Finding and choosing',
    summary: 'A person, a team or a goal is chosen by typing to find it: you and your team are suggested first, and a goal’s key finds it.',
    group: 'goals',
    sections: [
      { heading: 'Choosing someone or something', list: [
        'Wherever you choose a person, a team or a goal (a goal’s owner, team, what it feeds and what it also helps; who takes part in a review; a next step’s owner; who takes over when someone leaves; an owner in Data or in set-up; who sent feedback), the field says your choice in words, with Change. With nothing chosen it says “Choose a person” (or a team, or a goal), or what nothing means there, such as “Nothing: top of its own tree”.',
        'Open it and a few are suggested before you type: you first, then your team, then those you chose lately. Type to find others: a name, a job title, a team, or a goal’s words or its key (G-48, g48 or 48). It says how many match and shows up to 50; keep typing to narrow the rest.',
        'Down and Up move through the rows, Enter chooses, Escape closes and keeps what you had. Where you can choose several, each one chosen is listed with Remove, and Done closes the list.',
        'Someone marked as left is never offered. A goal that can’t be chosen is still listed, greyed, with the reason: a goal already under this one can’t be what it feeds (“Feeds this goal already”).',
        'On a phone the list opens as a full screen of its own, with Close at the top.',
      ] },
      { heading: 'What a search matches', list: [
        'Every word you type must start a word of the row: “roll” finds “Rollback”, “back” doesn’t. Case and accents don’t matter (“lucia” finds Lucía), and “CI/CD” is two words.',
        'A goal is found by its title, key, owner, team, level, status, the owner’s latest reason, its definition and its source.',
      ] },
      { heading: 'Find, from anywhere', list: [
        'Press Ctrl K (Cmd K on a Mac), or choose Find at the top of the sidebar (on a phone, Find in the top bar), and type a name, a few words, or a goal’s key like G-48.',
        'What matches comes in groups: Goals, People, Teams, and Metrics while the metric library is on. Each shows its first three with how many match in all; “See all 8 goals” opens that list with your search filled in.',
        'A goal’s key on its own (G-48, g48 or 48) puts that goal first. Enter opens the first row; Down and Up move to another; Escape closes. Each row is a link, so you can open it in a new tab.',
        'Before you type, it lists what you opened or chose lately. Someone who has left is still found, marked “(left)”. Find only looks in the workspace you have open.',
        'On a computer, a picker opens under its field, or above it when the window has no room below, so a sheet or a table never cuts it off.',
      ] },
      { heading: 'Keys', list: [
        'Ctrl K (Cmd K on a Mac): Find, from any page.',
        'Escape closes Find, a picker or a sheet.',
        'Ctrl+Shift+M (Cmd+Shift+M on a Mac): mark up this screen.',
      ] },
      { heading: 'Searching a list', list: [
        'Goals, Activity, Data, People, Teams, Help and Feedback search the same way. Under the search a line says how many match (“17 goals match.”). People and Teams find through the same search as every person and team picker, so they list people in the same order: those whose name starts with what you typed first, then A to Z.',
        'When nothing matches, it says so (“No goal matches “zzzz”.”) with Clear the search. If one letter is off, it tries the nearest word and says what it shows instead: “No goal matches “rolback”. Showing goals that match “rollback”.”',
        'On Activity, Data and Feedback, the filters that are on read as words under the search, each with Remove (“Filtered by: Kind Check-ins”), and Clear filters when there are two or more.',
        'The address keeps the search and the filters, so a link you share shows the same list, and Back undoes the last choice.',
      ] },
    ],
    routes: [],
    screens: [],
    reqs: ['FIND-AND-PICK', 'LIST-BAR', 'FIND-ANYWHERE'],
    keywords: ['find', 'search', 'pick', 'choose', 'owner', 'person', 'team', 'type to find', 'select', 'ctrl k', 'cmd k', 'shortcut', 'keyboard'],
    related: ['keys', 'reviews', 'goals-filters', 'activity'],
  },
  {
    id: 'new-goal',
    title: 'Setting up a goal',
    summary: 'A new goal takes four short steps: what you want to achieve, whose it is and where it fits, how it’s measured, then a check before publishing.',
    group: 'goals',
    sections: [
      { heading: 'How to use it', list: [
        'Choose New goal. Step 1, what: name it the way your team would say it, and pick a type. Move a number: from where it is to where it should be. Keep a number in range: a limit it mustn’t cross, with a margin that warns you. Hit dated stages: work that is done or not, by a week.',
        'Each step says what it needs: “Everything here is needed unless it says optional”, and an optional field says “· optional” after its name. A problem shows under its own field once you have changed it and moved on, never while you type. Continue is never greyed out: pressed with something to fix, every problem on the step shows, the first field is chosen, and one line above the button counts them (“2 things to fix above: Unit and Target”).',
        'Step 2, who and where: the owner starts as you and the team follows the owner until you change it. Type to find a person, a team or a goal: nothing is chosen from a list of everything. The level starts one below the goal it feeds, else Team; if you lead a team that already has SVP or north-star goals, you’re asked. “Feeds into” suggests the goals one level up in the team first, worst first. “Also helps” can be set here too.',
        'Step 3, how it’s measured: for a number, its unit (optional, and empty to start: type %, days, incidents or whatever it counts), then two rows: Baseline with From (the number, and the week it was true, when the plan starts) and Target with To (the number, and the week it is due). From starts as this week and To as the end of the year (in the year’s last week, the end of next year); the line under them says how many weeks that is. Then how progress will come: the same every week, a slow start (back-loaded), or jumps as each release ships. That sets the weekly plan the status is judged against. “Adjust the plan week by week” opens the plan table, where any week can be typed over. Say how it’s measured and where the number comes from, so everyone reads it the same way.',
        'Under Baseline, Period the baseline covers (optional): when the baseline is a figure you already have, say the period it covers, such as “June to September 2026”, and tick Provisional if it may still be firmed up. The goal then shows it as its number, marked as the baseline, until its first check-in.',
        'Step 4, check: “Does this read right?” Nothing is saved until you publish. The goal is read back in sentences, each with Change to its step: What (the type, the numbers with their weeks and dates, how progress comes, and whether higher or lower is better), Who and where (owner, team, level, what it feeds, what else it helps, a guardrail), Measured by (the metric, or how it’s measured in words), Left as usual (every default you didn’t change, such as “Whole numbers.” or “Not a guardrail.”) and You said (each question you answered). After Change, Continue brings you straight back; a change that leaves a later step needing something (another type, say) opens that step first. The metric you chose stays chosen through a reload or a kept draft, and it is for the goal’s team as it is now: choose another team and Check says the new one.',
        'Under the rows, After you publish says what happens next: when the first check-in is due (“Its first check-in is due by Thursday 12 Nov, then every week”, with what the plan expects the week after), who sees it (for someone else: they see it on their Home next time they open Faro; Faro doesn’t send email), the reviews that will walk it, and how long it can still be changed freely or deleted (until its first check-in; stages you said are already done count as its first check-in, so it can then be stopped, with a reason, but not deleted). With every stage already done, no check-in is due. Publish it: the goal’s page opens with “Published”, and nothing on the form asks again once you have pressed it; the owner is then offered the first check-in.',
        'On a phone the steps take the whole screen, as every form does: the tab bar steps aside, so Back and Continue are always in reach.',
        'Each step has its own address, so your browser’s Back steps back a step and a reload stays where you were. “Close and keep the draft” keeps it; New goal later picks it up where it stopped, with “Start a new one” if you’d rather not. Changing an answer from Check and pressing Continue goes to the first step that no longer holds, with what it needs said there.',
        'A stage due before this week asks whether it’s already done: “Yes, done in week 3” records it done in its own week, so the goal isn’t late on day one; “No, it’s overdue” leaves it late, and Check says so. One of the two must be chosen. Change the stage’s week and it asks again. Setting up a goal for someone else, the question adds that they mark done stages at the first check-in (“Mateo marks done stages at the first check-in.”): a check-in is the owner’s, so the goal is published without it.',
        'Each week is chosen, never typed as a bare number: From, To and a stage’s Due open a short list of weeks, each with its dates and year (“Week 46 · 9–15 Nov 2026”). Up to three named weeks come first (for To: the end of this quarter, the end of the year, the end of Q1 next year); then the years, and that year’s weeks, with this week and each quarter’s end marked. Type in it to jump: “50” is week 50 of the year shown, “14 Dec” the week holding that day, “2027 5” week 5 of 2027. Up and Down move a week, Page Up and Page Down four, Left and Right change the year, Enter chooses (with nothing typed, the week highlighted), Escape or Tab away closes.',
        'To can run into next year: the line under the numbers says “It runs past the end of 2026 and carries into 2027 with this plan.” A From still to come is fine too: until that week nothing is due, and the goal reads “No check-in yet · starts week 50”. A From in the past is asked about (“Week 40 was 6 weeks ago. Has this been running since then?”); “No, start from this week” puts it back. A To already past, and a plan longer than a year, are asked about too. A stage is due within this goal year; a range applies from the week it is published to the end of the year.',
        'An unfinished goal is kept as a draft.',
        'Decimals follow what you type: 12.5 is kept to 1 decimal place, and the line under the numbers says so, with Change to choose whole numbers or 1, 2 or 3 places. Once chosen, a start, target, limit or plan number typed with more is refused, not rounded (with “Keep 1 decimal place” to keep them), so what you see is what was saved.',
        'A number has only the number in it: “12 days” in a goal that counts % is a problem to fix (“the unit goes in Unit”); in a goal that counts days it’s 12. A target the same as the start offers to make it a number to keep in range instead. Each stage needs its own name and a week; two stages with one name, or one with no week, are each said under their own row.',
        'A warning margin for a range is optional: left empty, it warns only once the limit is crossed.',
        'A range keeps a number at most a limit, at least it, or between two numbers: Must stay has At most, At least and Between. Between asks for a lower and an upper limit (“between 99.5% and 99.95%”); the lower must be below the upper. The number is out of range above the upper or below the lower, and at risk within the warning margin of either; the chart shows both limits, Upper above its line and Lower below it. Its trend, “Vs last week” and “Will it stay within?” weigh both limits: a number moving back towards the middle is getting better from either side, and “Will it stay within?” answers for whichever limit it is likelier to cross. In a spreadsheet, two numbers in Limit (99.5–99.95) make a range between them; if Must stay says At most or At least, you’re asked whether to read it as Between.',
        'Some things are possible but unlikely, so they are asked about, never refused. A question sits under the field it is about, marked Check, with two answers: the first keeps what you typed, the second changes it. Asked: a number with no unit (is it a plain count?), a percentage over 100, a time, money or percentage below zero, a target a hundred times the start (or a hundredth of it), a billion or more, a target on the worse side of the start for the metric that measures it, a warning margin as wide as the limit, weeks set by hand that leave most of the change to the end, a goal with the same name in the same team, an owner in another team than the goal’s (“Move it to …” moves it), and a goal feeding one at a lower level (“No, it feeds nothing” removes the link).',
        'A question asked while you type is brought into view, on a phone too, and the cursor stays in the field. Continue waits for the questions on its step: focus goes to the first, and the line above the button says “Answer the question above, under Target.” Answered, a question folds to one line, “You said 150% is right.”, with Change. Your answer holds for the values it was about: change the number and it asks again. Each answer is kept in the goal’s History, as Checked.',
        'Two goals can have the same name (two teams can both “Reduce latency”). You’re told which other goal has it, with its key, team and owner, and wherever both could be on screen each shows its key beside the title.',
        'Check asks “Is it under way?”. “Yes: publish it as active” is judged against its plan and check-ins are due. “Not yet: propose it” saves it as a proposed goal: everyone can see it and comment, nothing is due and it has no status until its owner or an admin makes it active. The block under it then reads After you propose it, and the button Propose goal. A goal for someone else starts on “Not yet”.',
        'A proposed goal may leave how it’s measured unsaid: its numbers or stages become optional, all together, and Who and where offers “Skip: say how it’s measured later”. Check then reads “How it’s measured isn’t said yet.”',
      ] },
      { heading: 'Who can', text: ['Anyone can set up a goal, for themselves or for anyone else, at any level: here, in a spreadsheet, or through an AI assistant, which all follow the same rules and say the same words. Choosing someone else as owner says “Amara will own it. After it is published, only Amara or an admin can change it.” Someone publishing for another person can ask them for the first check-in.'] },
    ],
    routes: ['/goals/new', '/goals/new/:step'],
    screens: ['GoalWizard'],
    reqs: ['GOAL-CREATE', 'GOAL-BASELINE', 'GOAL-ENTRY-REQUIRED', 'GOAL-DATES', 'NEW-GOAL-STEPS', 'NEW-GOAL-TRUTH', 'PLAN-SHAPE', 'LEVELS', 'FIRST-CHECKIN', 'HIERARCHY', 'NO-SILENT-ROUNDING', 'SAME-NAMES'],
    keywords: ['create', 'new goal', 'metric', 'range', 'milestone', 'stages', 'plan', 'target', 'guardrail', 'level', 'north star', 'baseline', 'from', 'to', 'week', 'date', 'year', 'read back', 'check', 'publish', 'first check-in'],
    related: ['edit-goal', 'check-in', 'goals'],
  },
  {
    id: 'goal-proposed',
    title: 'Proposed goals',
    summary: 'A goal can be proposed before anyone is held to it: everyone can see it and comment, it has no status and nothing is due, and its owner or an admin makes it active when it is agreed.',
    group: 'goals',
    sections: [
      { heading: 'What it’s for', text: ['Putting a goal in front of its would-be owner, or a leader, without committing them: a goal for someone else, a level above your team, or next quarter’s idea.'] },
      { heading: 'How to use it', list: [
        'Propose one from New goal: on Check, answer “Is it under way?” with “Not yet: propose it”, then Propose goal. It gets a key and a page at once. How it’s measured may wait.',
        'Its page says Proposed above the title, as a word: it has no status shape, no scorecard and no chart. One block says what it would measure and what it would feed. History lists its changes and comments, with no weeks.',
        'Make it active (its owner or an admin): From starts as this week, whatever was typed when it was proposed, and the line under it reads the plan back with its dates and the day the first check-in is due. A week already past is asked about, here and by the AI assistant. Stages already done are marked at the first check-in. After it, the page is a new goal’s, with “Post the first check-in”, and the toast has Undo. If something an active goal needs is missing, the button is Finish it, which opens Change at it.',
        'A number goal can be proposed with its Baseline and no Target yet, when the number is known but nobody has agreed where it should go. It says “Target not set” (in lists: “0.42 USD now, target not set”), has no status and nothing due, and needs a target before it can be made active: Set the target on its page opens Change it at the plan. Leaving out the Baseline and giving only a Target isn’t enough: the baseline is what such a goal is.',
        'Change it: the same page as any goal, with no reason ever asked, and its type can still change. Withdraw it: it goes to Recently removed for 30 days, with Undo.',
        'Make it proposed again: an active goal with no check-ins, from its “…” menu (its owner or an admin). It then has no status and nothing is due until it is made active; the message has Undo. Once a goal has a check-in the item isn’t there, and its Change page says to stop it instead.',
        'In a review’s walk, Propose a new goal saves one with only a name, who will own it (the goal on screen’s owner to start with) and what it will feed. It isn’t on the agenda, and the next session’s Last time says whether its owner has made it active yet. Only people in the review, or an admin, can propose one there.',
        'On a goal’s page, What feeds it lists any goals proposed to feed it under “Proposed” with how many, with no status and counted in nothing; a goal that feeds a proposed goal says “· Proposed” after its name. When the next year starts, proposed goals carry as proposed, counted apart on the start page.',
        'On its owner’s Home, under Needs your response, Proposed goals lists one proposed for you by someone else until you open it (“Rhea proposed a goal for you: …”, or “… for you in Developer Productivity fortnightly: …” when it was proposed in a review), and one that has waited 8 weeks or more (“… has been proposed for 9 weeks. Make it active, or withdraw it.”). Open it goes to the goal; Not yet puts the second off for 8 more weeks. Both are remembered for you, not for the device: open a goal on your phone and it no longer asks on your laptop. One proposed for you a week or more ago, not yet opened, is Home’s lead when nothing else is asked of you first (“Rhea proposed a goal for you”, with Open it).',
        'Proposed goals are in no count, health line, Needs attention, review agenda, check-in or wrap-up: Goals counts them apart (“· 2 proposed”) and lists them with the State filter, newest first, each with what it would measure. With the filter on, the Board is one column, Proposed, and the Map draws each in its tree with a dashed outline and the word, the goals above it shown for context; opening one goes to its page. Find lists them with the word Proposed.',
        'A spreadsheet’s Goals sheet has a State column (active or proposed), and the AI assistant’s create_goal and update_goal take state; make_goal_active makes one active, and make_goal_proposed makes an active one proposed again. A file or an assistant adding goals for other people with no State is asked once whether they start active or proposed (an admin’s file and set-up aren’t asked). A goal with check-ins can’t go back to proposed: stop it instead.',
      ] },
      { heading: 'Who can', text: ['Anyone can propose a goal, for anyone. Its owner or an admin makes it active. Whoever proposed it may also change or withdraw it while it is proposed. Everyone can comment, ask its owner a question and watch it.'] },
    ],
    routes: ['/goals?state=proposed'],
    screens: ['ProposedGoal', 'ProposedList'],
    reqs: ['GOAL-PROPOSED', 'GOAL-NO-TARGET'],
    keywords: ['proposed', 'propose', 'target not set', 'no target', 'baseline only', 'register', 'proposal', 'not yet', 'make it active', 'activate', 'withdraw', 'draft', 'agreed', 'under way'],
    related: ['new-goal', 'goal-page', 'goals'],
  },
  {
    id: 'edit-goal',
    title: 'Changing a goal or its plan',
    summary: 'Change a goal on one page: what it is, its plan and target, who owns it and where it fits. Once check-ins have started, a plan change needs a reason.',
    group: 'goals',
    sections: [
      { heading: 'How to use it', list: [
        'Open the goal and choose Change this goal, in the “…” menu or at the foot of About this goal.',
        'It is one page in four sections: What it is (the name, what it measures and the metric that measures it), Plan and target, Who and where (the owner, the team, the level, what it feeds and what it also helps) and More details (how much it moves the goal it feeds, whether it’s a guardrail, and the data source).',
        'A link can open the page at a section: add #definition, #plan or #owner to the address. Describe it on a goal with no definition opens What it is. Older links that opened one part of the form land on the matching section.',
        'The owner, the team and the goals are found by typing a name or a key; a goal already under this one is listed but can’t be chosen to feed it.',
        'Plan and target has the same two rows as a new goal: Baseline with From, Target with To, each week chosen from the list of weeks with their dates. Changing From or To after check-ins have started is a plan change, so it asks why.',
        'Under them, Period the baseline covers and Provisional, as on New goal. Firming up a provisional baseline, changing the Baseline number while Provisional is ticked, isn’t a plan change: it asks no reason and keeps no earlier plan. Untick Provisional once the figure is firm.',
        'Plan by week shows the numbers week by week; type over any week.',
        'After check-ins have started, a change to the plan or target asks why, in a sentence: the box appears as soon as the plan differs. Watchers see it flagged, and it is in the goal’s history.',
        'Numbers follow the same rule as a new goal: never rounded quietly, and odd ones asked about. A target on the worse side of the start for the metric that measures the goal is asked about too (“Lead time for changes is better lower, but the target is above today”), here, in a spreadsheet and through the AI assistant, and your answer is kept in the goal’s History as Checked.',
        'A question asked while you type is brought into view, and the cursor stays in the field. Save changes waits for the questions: pressed with one still open, it takes you to the first, wherever it is on the page, and the line above the button says where (“Answer the question above, under Target.”). The second answer, such as “No, I’ll change the numbers”, takes you back to the field.',
        'A target on the other side of the start flips which way is better, so it is never saved quietly: the form says so (“This makes higher better”) and saves once you tick the yes beneath it. A start, target or week’s number far outside the plan it replaces is asked about the same way. The import, Data and the AI assistant ask the same questions.',
        'The original plan stays on the chart, dotted, and earlier weeks and closed quarters stay judged against the plan of their day. There is no approval step.',
        'A range can change between At most, At least and Between under Plan and target, as its limit can; Between asks for the lower limit too.',
        'A goal’s type can’t change once it is active. While it is proposed, Type, under Plan and target, changes it: “It’s proposed, so its type can still change.”',
      ] },
      { heading: 'One way out', list: [
        'Save changes stays at the foot of the window wherever you are on the page, and never covers the field you’re typing in.',
        'Close and keep the draft, top right, is the only other way out. What you typed is kept on this device: open the page again and it says “Restored your unsaved edits”, with Discard them beside it.',
      ] },
      { heading: 'Who can', text: ['The goal’s owner, or an admin.'] },
    ],
    routes: ['/goals/:goalId/edit'],
    screens: ['GoalEdit'],
    reqs: ['PLAN-CHANGE', 'REBASELINE', 'HONEST-NUMBERS', 'GOAL-EDIT-PAGE', 'GOAL-DATES'],
    keywords: ['edit', 'change plan', 're-plan', 'rebaseline', 'target', 'reason', 'owner', 'links'],
    related: ['new-goal', 'goal-page', 'activity'],
  },

  /* ---------- Reviews and the year ---------- */
  {
    id: 'activity',
    title: 'The activity log',
    summary: 'Activity lists every saved change: who made it, when, and each field’s before and after.',
    group: 'leading',
    sections: [
      { heading: 'How to use it', list: [
        'Every save is logged: goals, plans, check-ins, comments, review calls, people and the workspace. Drafts are not.',
        'Filter by who, a goal or its whole tree, team, level, kind of change (check-ins, plans and targets, goal details, reviews, comments, people, imports, via MCP, wrap-ups) and when.',
        'Search finds the words on a change: who, the goal and its key, what was said and the numbers. A line under it says how many match; the filters on read as words with Remove (see Finding and choosing). Choose who and which goal by typing their name. Show the changes opens the before and after.',
        'The search and filters are in the link, so a filtered log can be shared, and Back undoes the last choice. Save .csv exports what is shown.',
        'Every removal is here too: a goal stopped, a person marked as left, a check-in or comment deleted, a view deleted, a watch stopped, and each restore.',
        'An import or bulk edit has Undo this import on its entry, for whoever made it or an admin. It puts every row back as it was; rows changed since are skipped and listed on the entry that says it was undone. An import over a year old can no longer be undone.',
        'The app opens with about the last year of changes, plus every comment, ask and import whatever its age. Show older changes, at the end of the list, fetches older ones a page at a time; a goal’s History has the same.',
      ] },
      { heading: 'When someone else saved first', list: [
        'If someone else changed the same goal or review since you opened it, nothing is half-saved, and nothing of theirs is lost.',
        'A simple change, such as restoring something or ending a review, is made again on the latest and saved. If it no longer applies, you’re told why; if it was already done, you’re told that.',
        'A goal’s form, a review’s settings, a table of changes, and anything you confirmed against what you were shown (making a goal active, stopping or deleting it, marking someone as left, removing a team, undoing an import) is not saved: you’re told, and shown the latest to check and save again. On a goal’s form, the fields you changed stay as you typed them and the rest show the latest.',
      ] },
    ],
    routes: ['/activity'],
    screens: ['Activity'],
    reqs: ['CHANGE-LOG', 'NOTES', 'NO-LOST-UPDATES', 'IMPORT-UNDO'],
    keywords: ['log', 'audit', 'history', 'changes', 'who changed', 'before and after', 'csv', 'undo import'],
    related: ['goal-page', 'data', 'removing'],
  },

  {
    id: 'start-next-year',
    title: 'Starting the next year',
    summary: 'An admin sets up next year from the day the wrap-up opens. Nobody moves into it until this year’s last day, and it can be undone until someone uses it.',
    group: 'leading',
    sections: [
      { heading: 'How to use it', list: [
        'From the day the wrap-up opens, an admin can open Start {next year} from Cycles, Home or the wrap-up. It says how long the next year runs, and that everyone stays in this year until its last day.',
        'Before anything changes it reads back what will happen to every goal, in four counts that add up to all of them: how many carry on, how many finish because they met their target, how many stop because their owners said so, and how many aren’t wrapped up yet (and of those, which carry on as they are and which finish).',
        'Then it says what next year starts with: the goals that carry on, each with its key, owner, team, level and metric; the stages not done that come with them; the open next steps and asks, watches and reviews that follow their goals; any goal that loses its “Feeds into” because the goal above it finishes or stops; plans set by hand that become straight lines; and when the first check-ins are due.',
        'A number goal that carries on starts from its final number in week 1, with the same target, due at the end of next year. Stages not done are spread evenly over next year. A plan that already ran past the year keeps its dates.',
        'A final number or a wrap-up given after next year was set up still counts: the carried goal follows it until someone checks in on it or changes it. After that, stop it in next year instead.',
        'Starting it prepares next year. Everyone stays in this year until its last day, so the last check-ins and the wrap-up carry on; next year opens for everyone on its first Monday. Started after this year has ended, it opens at once.',
        'Cycles then says the next year is ready, when it opens, and offers Undo. Undo works until someone checks in or changes a goal in the new year; after that Cycles says why it can’t.',
        'Next year can be started only once. Before the wrap-up opens, the page says the day it can be started from.',
      ] },
      { heading: 'Who can', list: ['Everyone can read the page.', 'Only admins start the next year, or undo it.'] },
    ],
    routes: ['/workspace/cycles/next'],
    screens: ['StartNext'],
    reqs: ['CARRY-GOALS', 'RESULTS'],
    keywords: ['next year', 'new year', 'start next year', 'carry on', 'finish', 'undo', 'read-back', 'cycle'],
    related: ['wrap-up', 'workspace-cycles'],
  },

  /* ---------- Data in and out ---------- */
  {
    id: 'data',
    title: 'Data',
    summary: 'Every person, goal, check-in, plan and ask as a table you can search, sort, filter, arrange and export, and the home of spreadsheets in and out.',
    group: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'Pick a table. Search it (each word you type starts a word in a shown column, as on Goals, and the line under it says so while columns are hidden; a number like 12.5 is one word; a key like G-48 finds its goal, and on Check-ins and Asks that goal’s rows), sort by any heading, and filter by any column under Filters: a value from its list, a number condition, words, or empty. The line under the search counts the rows and says the sort (Remove the sort undoes it), and the filters read as words, each with Remove. The search, the filters and the sort are in the link, so Back and a shared link show the same table.',
        'Goals are listed in key order (G-1, G-2 … G-124) until you sort. A cell that doesn’t apply to that kind of goal says so: a range goal shows its limit under Target, and a dash with the reason elsewhere.',
        'Columns chooses what shows. Drag a heading to move a column, or drag its edge to set a width; the keyboard works too. Columns start compact, so more fit on the screen: a long value is cut short, and shows whole in its field and when you point at it.',
        'Save this layout keeps the columns, widths, search, filters and sort under a name you reopen from Saved layouts. Back to the usual columns resets it.',
        'Export and Import are where files come and go (when the workspace has Spreadsheets on). Export saves this table as shown, as .xlsx or .csv, with the visible columns in order, filtered and sorted, and says how many rows and columns that is; Everything… opens the one Export, the whole workbook. Import opens the Import page, which has the template (its first sheet, Start here, says what every column needs: Help’s Every column, and what it needs is the same table) and Past imports. The columns that say which record each row is (a goal’s key and ID, a person’s email) are always added, greyed, at the end when the layout hides them, so the file loads back whatever you hid.',
        'IDs, keys and emails never change by accident: they are shown but not typed into, except a person’s email.',
      ] },
      { heading: 'Changing data', list: ['Admins type into cells across tables, then Review changes shows each before and after with any problems: Must fix, or a Check to answer there, as on Import. Save applies them together, with the same rules and change log as Import.', 'A past check-in can be corrected here; it is logged with its old and new values. Columns the layout hides keep what the check-in says, so a value can be corrected without showing its cause.', 'Choices such as Level, Plan, Must stay, Call, Cause and Recovery offer the same words the spreadsheet uses. An owner or a team is found by typing: choose Change in its cell.'] },
      { heading: 'Who can', text: ['Anyone reads the tables. Admins change them; admins can also pin a saved layout for everyone.'] },
    ],
    routes: ['/data'],
    screens: ['DataTables', 'DataFilters', 'DataLayout'],
    reqs: ['DATA-TABLES', 'TABLE-LAYOUTS', 'ROUND-TRIP', 'ONE-FORMAT', 'SHARED-DOWNLOADS'],
    keywords: ['tables', 'data tables', 'spreadsheet', 'columns', 'layout', 'saved layouts', 'resize', 'reorder', 'export', 'csv', 'xlsx', 'edit cells', 'people', 'check-ins', 'plans'],
    related: ['import', 'export', 'keys'],
  },
  {
    id: 'print',
    title: 'Printing a goal or a review',
    summary: 'A goal or a review session on one clean page, ready to print or save as a PDF.',
    group: 'data',
    sections: [
      { heading: 'How to use it', list: [
        'On a goal’s page or a review, choose Print or save as PDF.',
        'A goal prints on one A4 page: status, the number against plan and target, the facts, chart, path to green, latest check-in, requests, the three latest review notes, quarters and contributing goals. The reason is printed once, under Why.',
        'A review prints its session worst first, with what was said.',
        'Print uses black on white with the status shapes kept, and no navigation.',
      ] },
    ],
    routes: ['/goals/:goalId/print'],
    screens: ['Print'],
    reqs: ['PRINT-EXPORT'],
    keywords: ['print', 'pdf', 'one pager', 'a4', 'paper', 'save as pdf'],
    related: ['goal-page', 'reviews', 'export'],
  },

  /* ---------- Workspace, settings and assistants ---------- */
  {
    id: 'removing',
    title: 'Removing, stopping and undoing',
    summary: 'Anything you make can be taken away again: people leave, goals stop, check-ins, reviews, comments and views go, an import can be undone, and nothing is ever lost.',
    group: 'you',
    sections: [
      { heading: 'What it’s for', text: ['Mistakes and changes of plan. A person leaves, a goal stops mattering mid-year, a check-in went to the wrong goal, a spreadsheet loaded the wrong numbers. Each can be put right without losing history.'] },
      { heading: 'What each removal does', list: [
        'A person who has left: an admin opens them on Workspace, under People, and chooses Mark as left. The dialog first asks who takes over their goals and their open asks (the ones they raised and the ones waiting on them). They then disappear from pickers, counts, reviews and Home, and their MCP token stops working. Everything they did keeps their name, as “Maya Patel (left)”. Someone with no goals, check-ins, notes or asks is deleted instead.',
        'A goal with check-ins is stopped, with a reason (“…” menu → Stop this goal). It leaves the numbers, reviews, Home, Watching and the lists of what needs attention, but its page stays, marked Stopped with its reason, and so do its history, its place in exports and Activity. The goals feeding it now feed what it fed; its open asks are withdrawn with a note. A goal with no check-ins is deleted instead.',
        'A check-in: Delete this check-in, under the latest one on the goal’s page, by the goal’s owner. Undoing an import puts a check-in back only for someone who may check in on that goal: an admin can undo a workbook they loaded, but not an owner’s own correction. Once a newer one is posted it can only be corrected. The status goes back to the one before.',
        'A review: End this review, at the foot of its page, by whoever set it up or an admin. It keeps its notes and actions and stops showing as due. One that was never held is deleted.',
        'A comment: its author can edit it (it then says edited), and its author or an admin can remove it; its place in the thread says “Comment removed”, so the conversation still reads. A note said in a review works the same way, leaving “Note removed”.',
        'A saved view: Delete, from its menu. An admin can delete anyone’s. Stopping watching works the same way.',
        'A cycle no one has checked in to yet (started by mistake, say): an admin deletes it under Cycles on Workspace, with its goals.',
        'An import or bulk edit: Undo this import, on its entry in Activity, by whoever made it or an admin. Every row it wrote goes back as it was: goals and check-ins it added are deleted, ones it changed get their earlier version back. A row someone has changed since is skipped and listed.',
      ] },
      { heading: 'Undo, and Recently removed', list: [
        'Every removal shows a message with Undo for 10 seconds. Undo puts everything back as it was a moment before, including what was handed over or moved.',
        'After that, Recently removed on Workspace brings things back: it lists what was removed, stopped, ended or marked as left in the last 30 days, with who did it and when, and Restore. An admin sees everything; anyone else sees what they removed themselves, and can restore it.',
        'Nothing is ever erased. After 30 days a removed record leaves the list, but it’s still kept, and every removal and restore is in Activity.',
      ] },
      { heading: 'Who can', list: [
        'Admins mark people as left, delete people with no history, delete cycles and restore anything from Recently removed; anyone restores what they removed.',
        'A goal’s owner or an admin stops or deletes it. Whoever posted a check-in, or an admin, deletes it. Whoever set up a review, or an admin, ends it.',
        'Only a comment’s author edits it; its author or an admin removes it. Whoever made an import, or an admin, undoes it.',
        'Through MCP, an AI tool can do each of these with the same rules, as the person whose MCP token it uses.',
      ] },
    ],
    routes: ['/workspace/removed'],
    screens: [],
    reqs: ['REMOVE-ANYTHING', 'UNDO-REMOVE', 'PERSON-LEFT', 'GOAL-STOP', 'IMPORT-UNDO'],
    keywords: ['remove', 'delete', 'undo', 'restore', 'stop', 'stopped', 'left', 'leaver', 'archive', 'end review', 'recently removed', 'deleted', 'mistake', 'undo import', 'edit comment'],
    related: ['workspace', 'goal-page', 'activity', 'import', 'reviews'],
  },
  {
    id: 'workspace',
    title: 'Workspace: about this one',
    summary: 'Workspace opens on About: for admins, what needs sorting out; then the facts about this workspace, each leading to its section. Its other sections are Cycles, Privacy and Recently removed for everyone, and Access and Features for admins.',
    group: 'you',
    sections: [
      { heading: 'About', list: [
        'Under Workspace’s title, one line says whose workspace it is and your part in it: “Platform Engineering · you’re an admin here”, or a member.',
        'For admins, first, To sort out: no goals yet in the year, no review set up, being the only admin of five people or more, people with no email, people in no team, and teams of three or more with no lead. Each says why it matters and has one button that leads to where it’s dealt with. Three show at a time; “and 2 more” shows the rest. When there is nothing, the block isn’t there at all.',
        'Then the facts: its name (the example’s says “example data”; one you made in the demo, “kept in this browser”), how many people in how many teams (leading to People), the year and when its wrap-up opens (leading to Cycles), who the admins are (leading to Access, for admins; anyone else is told to ask one of them), which optional features are on (leading to Features) and whether how the app is used is recorded (leading to Privacy).',
        'Admins rename the workspace with Rename, beside About this workspace. A name has at most 80 characters, and the field counts them as you near the limit.',
        'Admins of a workspace of their own (not the example) can delete it at the foot of About, after typing its name. It can’t be undone. The example is put back as it was with Start over, in Demo controls, which only touches this browser.',
      ] },
      { heading: 'Switching, and setting one up', list: [
        'The workspace’s name at the top of the sidebar (on a phone, the line under the page’s name at the top) is the workspace switcher. It lists every workspace you can open with what kind it is; the open one says Open now and your role. Under the list: Look around the demo (outside the demo: it opens the example workspace, which you can change freely without touching yours), About, which opens Workspace, and Set up a new workspace. It says Switch beside its arrow. With the narrow menu of icons, the Faro mark at its top is the switcher.',
        'Land in another workspace as someone else, or with another role, and one line says so: “You’re Rhea Kapoor here, a member.” A workspace you can’t open yet still lists the others, to open one of them.',
        'A workspace is one organisation’s goals and the people who share them: its own people and teams, its own goal year and check-in day, and its own admins. About says so, under its name.',
        'Switching is a page move: Back takes you to the workspace you came from. You land on the same page in the other workspace when it has one (Home, Goals, Reviews, People, a Workspace section), otherwise on Home; from a person’s or a team’s page, on People or Teams. While it opens, the page says so.',
        'Part-way through a check-in, a new goal or a review, switching asks first: what you’ve typed stays as a draft in its own workspace, in this browser, for when you switch back.',
        'Switch person (your name at the foot of the sidebar) is only about people. Where you’re an admin, it says Admin.',
      ] },
      { heading: 'Finding your way', list: [
        'On a computer, the sections are in a menu down the left, About first. On a phone, Workspace is About, and the other sections follow under More in Workspace, each with one line; a section opens with Workspace at the top to go back.',
        'Each section has its own address, so you can bookmark one or send a link to it: /workspace/cycles, /workspace/privacy and so on. /workspace/overview, and older links from a GitHub issue, still open the page they meant.',
        'People and Teams moved out of Workspace to People, in the sidebar, for everyone. See People: finding someone, and Teams.',
        'Cycles: the goal years, for everyone to read; only admins delete one. Privacy: what the app records, for everyone to read; only admins switch it. Recently removed: an admin sees everything removed lately, anyone else what they removed. Access (the admins and MCP access) and Features: for admins. Each has its own article.',
      ] },
      { heading: 'Leaving', list: ['Leaving a workspace is in Settings, at the end: someone takes over your goals and open asks first, then you’re gone from its pickers, counts, reviews and Home; your history stays, under “Name (left)”, and an admin can bring you back from Recently removed for 30 days.', 'The only admin can’t leave until someone else is an admin.'] },
      { heading: 'Who can', list: ['Everyone sees About, Cycles, Privacy and Recently removed (their own removals). Someone who isn’t an admin and opens Access or Features is told who the admins are, with a way back to Workspace.', 'Only admins add or change people and teams, mark people as left, restore what was removed, make tokens, turn recording or features on or off, rename or delete the workspace. Whoever sets up a workspace is its first admin. In the demo, Start over (in Demo controls) is for everyone: it only touches this browser.', 'Feedback, the inbox of markups and feedback, is its own page beside Help, open to anyone. See The inbox.'] },
      { heading: 'For the people building Faro', list: ['Sections are an extension point: a feature module adds its own with `sections` in its app.tsx and module.json, and it appears in the menu, at /workspace/<id>, for as long as the module is on. A section can give a fact for About (`says`) and its own things to sort out (`needs`).'] },
    ],
    routes: ['/workspace', '/workspace/overview'],
    screens: ['Workspace'],
    reqs: ['ADMIN', 'WORKSPACE-ADMIN', 'WORKSPACES', 'WORKSPACE-SECTIONS', 'WORKSPACE-ABOUT', 'WORKSPACE-ONE-PLACE', 'RAIL-SWITCH'],
    keywords: ['admin', 'workspace', 'about', 'sections', 'overview', 'to sort out', 'rename', 'delete workspace', 'switch workspace', 'new workspace', 'set up', 'menu', 'admins'],
    related: ['people', 'teams', 'inbox', 'workspace-access', 'set-up', 'settings'],
  },
  {
    id: 'people',
    title: 'People: finding someone',
    summary: 'Everyone in the workspace, A to Z: find someone by name, job title or team, open them to see their team, their goals and their reviews. Admins add and change people.',
    group: 'you',
    sections: [
      { heading: 'What it’s for', text: ['People is in the sidebar (on a phone, under More), for everyone. It answers who someone is, what team they are in, and how their goals stand.'] },
      { heading: 'How to use it', list: [
        'Type in the search to find someone: each word you type starts a word of their name, job title or team, so “eng man” finds the Engineering Managers. Capitals and accents don’t matter: “lucia” finds Lucía.',
        'Filter by a team (its lead counts as one of its people), or tick Admins only. On a phone both are under Filter.',
        'The list is A to Z (with a search, those whose name starts with it first), 50 at a time; the line under the search says how many, and Next and Previous turn the pages. The search and filters are in the address, so Back and a shared link bring the same list back.',
        'Each row says the person’s job title and team, and beside it whether they are an admin, which team they lead and how many goals they own this year.',
        'Open someone to see their page: their team (and any other team they lead), their email, whether they are an admin, their goals counted by status (each count opens those goals) and the reviews they run or are in. See their goals opens Goals for just them.',
      ] },
      { heading: 'For admins', list: [
        'Add a person is the page’s main action; the new person’s page opens once they are added. Everyone new needs an email, and no two people share one.',
        'When some people have no email yet, a line above the list says how many, with Add them: type the emails you know and save them together.',
        'On a person’s page, under For admins: Change details (name, email, job title and team), Make an admin or Remove as admin (there is always at least one admin), Make an MCP token in the real app, and, apart, Mark as left (on your own page: to leave, use Settings). Marking someone as left asks who takes over their goals and open asks first; history keeps their name as “Name (left)”. Someone with no history is deleted instead.',
        'Two people can have the same name: the email is who someone is, and wherever both could be on screen each shows their team or job title beside the name.',
      ] },
      { heading: 'Who can', text: ['Everyone sees People, Teams and every person’s and team’s page. Only admins see the buttons that change them.'] },
      { heading: 'Moved', text: ['People used to be a section of Workspace. Its old address, /workspace/people, still opens it.'] },
    ],
    routes: ['/people', '/people/:personId', '/workspace/people'],
    screens: ['People'],
    reqs: ['PEOPLE-DIRECTORY', 'OLD-ADDRESSES', 'PROFILES', 'PERSON-LEFT', 'PERSON-EMAIL', 'SAME-NAMES'],
    keywords: ['people', 'directory', 'person', 'find a person', 'add person', 'email', 'missing email', 'admin', 'left', 'leaver', 'job title', 'who is'],
    related: ['teams', 'workspace', 'removing', 'workspace-access'],
  },
  {
    id: 'teams',
    title: 'Teams',
    summary: 'The workspace’s teams, A to Z, each with its lead, its people and its goals by status; a team’s page says what it is here to do. Admins add, change and remove teams.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'Teams is the second tab of People. Find a team by its name or its lead’s.',
        'Each row shows the team’s lead, or No lead (set-up doesn’t ask who leads a team), how many people are in it (its lead counts as one of them, even when their own team is another), and its goals this year counted by status, shape and word. The counts are the same numbers Goals shows by team.',
        'Open a team to see what it is here to do, its goals by status (each count opens those goals), and its people, lead first. See its goals opens Goals for just that team; Show all lists all its people in People.',
        'A team’s page also says how many of its goals were checked in on time this week, without being asked, and the last 8 weeks, under “Week 46, due by Thursday 12 Nov”. When Reviews is on and a review is held that day with the team’s people in it, it is headed “Before this week’s review” and says “before it” instead. Only for a team whose goals have three or more owners: nobody is named.',
      ] },
      { heading: 'For admins', list: [
        'Add a team is the main action. On a team’s page, Change its name, lead or purpose; and, apart, Remove this team. An empty team goes at once; a team with people or goals first moves them to another team, in the same save, and each goal’s history says so.',
      ] },
      { heading: 'Who can', text: ['Everyone sees the teams. Only admins change them.'] },
      { heading: 'Moved', text: ['Teams used to be a section of Workspace. Its old address, /workspace/teams, still opens it, and an old link to one team’s people opens that team.'] },
    ],
    routes: ['/teams', '/teams/:teamId', '/workspace/teams'],
    screens: [],
    reqs: ['PEOPLE-DIRECTORY', 'WORKSPACE-ADMIN', 'HABIT-MEASURE', 'HABIT-NEVER-A-PERSON'],
    keywords: ['teams', 'team', 'team lead', 'add team', 'rename team', 'remove team', 'move goals', 'purpose', 'objective'],
    related: ['people', 'workspace', 'goals'],
  },
  {
    id: 'workspace-cycles',
    title: 'Workspace: Cycles',
    summary: 'The workspace’s goal years, newest first, with their dates, which one is running and the wrap-up; admins can delete one nobody has checked in to yet.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'Each cycle says where it stands in a word (running; ending, in its wrap-up weeks; ended, with its last day; or starts on a date), then its week and dates (the running one) or its dates and weeks, then how many goals and check-ins it has (“no check-ins yet” for none).',
        'A cycle’s dates are its real first and last days: week 1’s Monday to its last week’s Sunday. The demo’s 2026 runs from 29 Dec 2025 to 3 Jan 2027.',
        'The current cycle also says when its wrap-up opens: the first day of its last two weeks. Once it is open, it says how many goals are still to wrap up; once the year has ended, the day it ended and until when the wrap-up stays open.',
        'Its one action: See the wrap-up, before it opens (once any goal has a check-in); Wrap it up, once it’s open; and for admins, once every goal is wrapped up, Start the next cycle.',
        'An admin can delete a cycle nobody has checked in to, with its goals: Delete… asks first (“Delete 2027 and its 4 goals? Nobody has checked in to it.”). It’s listed in Recently removed and can be restored for 30 days. One with check-ins stays, and the only cycle always stays.',
        'A new cycle starts from the wrap-up at the end of this one, where each goal is carried on or stopped.',
      ] },
      { heading: 'Who can', text: ['Everyone reads Cycles and opens the wrap-up. Only admins delete a cycle or start the next one.'] },
    ],
    routes: ['/workspace/cycles'],
    screens: [],
    reqs: ['UNDO-REMOVE', 'RESULTS'],
    keywords: ['cycles', 'year', 'quarter', 'delete cycle', 'new cycle'],
    related: ['workspace', 'removing'],
  },
  {
    id: 'workspace-access',
    title: 'Workspace: Access',
    summary: 'For admins: who the admins are, and MCP access: the MCP tokens Claude or another AI tool uses to act as someone in this workspace.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'Admins lists everyone who is one, A to Z. Add an admin is the page’s main action: find someone by name, job title or team, then Make them an admin. The message that says so has Undo.',
        'Remove as admin, on anyone’s row, asks first (“They keep their goals and history”); on your own row it’s Stop being an admin, which has no Undo: only another admin can make you one again. There is always at least one admin: the only one has no button, and their row says The only admin.',
        'The same two are on a person’s page in People, under For admins, with Make an MCP token for that person.',
        'MCP tokens: Make a token for someone (it’s shown once), and revoke any token. The AI tool using it then acts as that person, with their rights, and every change it makes says “via MCP”. A token made as a builder token, before the inbox opened to everyone, is labelled “builder token”: it works as an ordinary one. See MCP access.',
        'In the demo, MCP tokens don’t work: its data stays in your browser, where an AI tool can’t reach it. Access says so in place of the list.',
      ] },
      { heading: 'Who can', text: ['Admins. Everyone finds their own MCP tokens in Settings.'] },
    ],
    routes: ['/workspace/access'],
    screens: [],
    reqs: ['ADMIN', 'MCP-TOKENS'],
    keywords: ['access', 'admins', 'add an admin', 'make admin', 'remove admin', 'who is an admin', 'revoke', 'assistant access'],
    related: ['workspace', 'ai-assistants', 'people'],
  },
  {
    id: 'getting-around',
    title: 'Getting around',
    summary: 'Every page names itself and lights its place in the menu; one back link above the title agrees with your browser’s Back; and a form has one way out.',
    group: 'start',
    sections: [
      { heading: 'Where you are', list: [
        'The browser’s tab says the page’s own name: a goal’s title, a review’s or a person’s name, “Change {goal}” while you edit it. So two goals open in two tabs are easy to tell apart.',
        'One place in the menu is lit: Goals for a goal and its pages, Reviews for a goal you reach while walking a review, People for a person or a team. On a phone, the tab that holds it is lit, or More.',
        'Goals is called Goals whichever tab (Mine, My team, Watching, All) you’re on.',
      ] },
      { heading: 'Going back', list: [
        'Pages below a place’s first page have one back link above the title, “‹ Goals” or “‹ Lead time for changes”, naming where it goes. A place’s first page (Home, Check-in, Goals, Reviews, People, Activity, Data, Workspace, Settings, Help, Feedback) has none, and nor does a form: it has its closing control instead.',
        'It goes back to the page you came from, the same as your browser’s Back, so Forward still works. Forms you passed through (an edit you saved, a check-in) are stepped over, by the link and by the browser’s Back alike.',
        'Opened from a link or a new tab, it goes up instead: to the goal this one feeds, or Goals; to the review for a goal in its walk; to People, Teams or Help.',
      ] },
      { heading: 'Leaving a form', list: [
        'A form has one way out, at the top right, in words. “Close and keep the draft” (check-in, New goal, changing a goal, setting up a workspace) keeps what you typed for later.',
        '“Close without saving” (setting up or changing a review, wrapping up a goal, starting an import) keeps nothing, so if you typed something it asks first. Keep editing takes you back to it.',
      ] },
      { heading: 'An address that leads nowhere', list: [
        'An old or mistyped link says “Page not found”, with Go to Home and Help. A goal, review or person that isn’t there says so in its own words.',
        'A link to a part of Faro an admin has switched off in this workspace, such as Reviews, says so under it: “Reviews is switched off in {workspace}. An admin can switch it on in Workspace, Features.” For an admin, Workspace, Features is a link.',
      ] },
    ],
    routes: [],
    screens: ['NotFound'],
    reqs: ['NAV-WHERE', 'NAV-BACK', 'NAV-FORMS'],
    keywords: ['back', 'back link', 'title', 'tab', 'where am i', 'lit', 'close', 'draft', 'not found', 'navigation'],
    related: ['settings', 'finding'],
  },
  {
    id: 'settings',
    title: 'Settings',
    summary: 'About you: who you are here and your page, your own choices (light or dark, an accent colour, the sidebar, how a goal’s page moves), your MCP tokens, whether recording is on, and leaving the workspace.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'Light or dark: light, dark, or follow your device.',
        'Accent colour: Faro’s teal (the default), or the earlier cobalt, violet, petrol or graphite. Each is readable in light and dark. Status colours never change.',
        'Motion lab, at the bottom: play with how a goal’s page moves. It is off by default, so a goal’s page shows its chart and number the moment it opens; switch on “Play the story when a goal’s page opens” to watch the chart draw itself in and the number land. Then speed and impact sliders, a landing style (thump, spring, wobble or drop), switches for each effect, an optional “tock” and phone buzz when it lands, and a preview.',
        'Sidebar: full, or icons only. The toggle at the foot of the sidebar does the same; every icon is named on hover.',
        'You, first: your name, job title, team and whether you’re an admin or a member here, with Your page (your page in People). An admin changes your name, job title or team; Settings names the admins.',
        'Recording: one line, whether it’s on here, leading to Workspace, Privacy for what is and isn’t recorded.',
        'Your MCP tokens: the tokens that act as you, which you can revoke. An admin makes them, on Workspace, Access or from your page.',
        'Under the title, links to each part of Settings (You, Appearance, Navigation, Your MCP tokens, Leave) stay at the top as you scroll, with the part you’re in lit.',
        'Settings is a place of its own, so it has no back link: the menu takes you anywhere from here.',
        'Leave, at the very end: leave the workspace that’s open. Someone takes over your goals and open asks first, and your history stays; an admin can bring you back for 30 days. The only admin can’t leave until someone else is an admin, and is told so.',
      ] },
      { heading: 'Good to know', text: ['How the app looks is kept in this browser only. On another device, choose again. Everyday motion is quick and subtle; a goal’s page moves at the pace you choose. All of it switches off when your device asks for reduced motion.'] },
      { heading: 'Faro’s look', text: ['The app is called Faro, the Spanish and Italian word for a lighthouse. Its logo is at the top of the sidebar (the F alone when the sidebar is icons only), at the top left on a phone, on the welcome page and in the browser tab. The workspace you’re in is named beside it (under it in the sidebar); where you choose between workspaces, each is listed by its name.', 'Its look is warm paper, dark ink and the lighthouse’s teal. The logo’s amber beam is used nowhere else, because in the app amber means At risk.', 'On a phone’s home screen and in the browser tab, the F sits on a deep-teal tile so it’s easy to spot. See On a phone, a tablet or a big screen for adding it to your home screen.'] },
    ],
    routes: ['/settings'],
    screens: ['Settings'],
    reqs: ['SETTINGS', 'MOTION', 'MOTION-ALIVE', 'BRAND', 'LEAVE-WORKSPACE'],
    keywords: ['leave', 'leave workspace', 'theme', 'dark mode', 'light mode', 'accent', 'colour', 'sidebar', 'collapse', 'appearance', 'back link', 'faro', 'logo', 'name', 'teal', 'cobalt'],
    related: ['ai-assistants', 'any-device', 'recording'],
  },
  {
    id: 'features',
    title: 'Features: switching parts of Faro on or off',
    summary: 'Faro is a core (people, teams, goals, plans, check-ins and the status rules) plus parts an admin can switch on or off for a workspace, in three groups: working together, tools, and beyond this workspace.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'On Workspace, Features says how this workspace works and lists the optional parts of Faro, each with what it does; About says which are on, from the same list. Goals, check-ins and people are the core and always on.',
        'Working together holds Reviews (walking a set of goals together on a cadence), Watching (following goals you don’t own) and the Wrap-up (each owner saying how their goals landed at the end of the year). Tools holds the Metric library, Spreadsheets and the Goal map. Beyond this workspace holds Feedback, which goes to the people who build Faro. A group this Faro has nothing in isn’t shown. Each has a switch with On or Off beside it.',
        'While a feature is on, its row says what it holds: how many reviews are set up, how many people watch goals here, or when the wrap-up opens and, while it is open, how many goals are wrapped up.',
        'Switching off a feature that keeps something asks first: Reviews always, Watching when anyone watches a goal, the Wrap-up once a wrap-up is written or while it is open. Switching Reviews off asks first. It says, for everyone here, that Reviews leaves the menu and Home, how many reviews stay in the record with what was said in them, how many open next steps and questions raised in a review stay open, how many accepted risks stay on their goals (no new one can be accepted while it is off), that check-ins are still due by the same day, and that nothing is deleted. Cancel changes nothing; Switch off Reviews does it. Switching anything else off that keeps nothing, or anything on, acts at once.',
        'Switching Watching off says that the Watching tab, “Goals you watch” and the Watch button go; how many people’s watches are kept (nobody is shown as watching while it is off); how many people own no goal and see Home through what they watch, whose Home then shows every goal that needs attention; and that goals don’t change. Switch it back on and each person watches what they did.',
        'Switching the Wrap-up off says that owners aren’t asked how their goals landed (and, while it is open, how many goals won’t be asked for), that the wrap-ups already written stay in each goal’s History, and that the year still ends: results are worked out as before, and an admin starts the next year from Cycles.',
        'Switching Feedback off takes Feedback out of the menu, with Send feedback and Mark up this screen, and Ctrl+Shift+M does nothing. What was sent stays in the builders’ inbox. Switching the Goal map off takes Map out of Goals’ layouts: a link or saved view that asked for the Map opens the List and says so once.',
        'Switched off, a feature leaves every screen: its pages (an old link says it is switched off, and who can switch it on), its menus and buttons, its Help and its MCP tools. Anything that needs it goes off with it, and Features says so.',
        'With Reviews off, asks and next steps stay on their goals and on Home, each goal’s History and Activity keep what was said in reviews, and check-ins are still due by the same day. “Before the review” becomes “by Thursday” (or whichever day it is) on Home, in the check-in and in the count of goals checked in on time.',
        'With Reviews off, a spreadsheet you export has no Notes sheet and no Review column on Asks. A workbook that has them still loads; the preview says once that they were not read. An AI assistant’s review tools answer that Reviews is switched off here, in the same words as any switched-off tool.',
        'Nothing a feature saved is deleted. Switch it back on and everything is as it was: every review, its people, its cadence and what was said. A session whose date passed while Reviews was off isn’t said to be not held.',
        'Each switch says what it did, with Undo for 10 seconds, and is logged in Activity, with who did it.',
        'Spreadsheets is one of the tools: Export and Import on Data, the template and Export these goals on Goals. Set-up keeps its own upload whatever the switch says.',
      ] },
      { heading: 'Who can', text: ['Admins switch features. Everyone sees what is on.'] },
      { heading: 'For the people building Faro', list: [
        'Each feature is a module: one folder in src/modules with a module.json saying what it adds and what it needs. docs/architecture.md explains how to add one.',
      ] },
    ],
    routes: ['/workspace/features'],
    screens: [],
    reqs: ['MODULES', 'REVIEWS-OPTIONAL', 'REVIEWS-SWITCH-CLOCK', 'WATCHING-OPTIONAL', 'FEEDBACK-OPTIONAL', 'MAP-OPTIONAL', 'WRAP-UP-OPTIONAL', 'FEATURE-GROUPS'],
    keywords: ['features', 'modules', 'switch off', 'turn off', 'disable', 'enable', 'spreadsheets', 'reviews', 'watching', 'wrap-up', 'goal map', 'feedback', 'working together', 'beyond this workspace', 'tools', 'optional', 'workspace settings', 'due day', 'accepted risk'],
    related: ['workspace', 'data', 'import'],
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
      { heading: 'When you send a markup', list: [
        'A markup is sent only when you press Send. It carries the picture of your screen as it was (nothing on it is hidden, and you see it before sending), your marks, your line, your name, the page, your screen size, light or dark, your accent and the app’s version.',
        'It also carries your last 20 steps on this visit (the pages you opened and the buttons you pressed, never what you typed) unless you untick them, and any errors or saves that didn’t go through on this visit.',
        'Only the people building Faro read markups.',
      ] },
      { heading: 'Turning it off', list: [
        'A workspace records only if whoever set it up chose it: set-up asks, and it is off unless ticked. The example in the demo records. Settings says in one line whether it is on where you are, and leads to Privacy.',
        'Anyone can read what is recorded, and whether it is on (On or Off, in a word), on Workspace, under Privacy. Only an admin can turn it on or off there, for the whole workspace; turning it on asks first, and turning it off says so with Undo. While it is off, nothing is recorded or sent from that workspace, by the app or through MCP.',
      ] },
    ],
    routes: ['/workspace/privacy'],
    screens: [],
    reqs: ['TELEMETRY-SIGNALS', 'TELEMETRY-PRIVACY', 'TELEMETRY-FLOWS', 'TELEMETRY-RETENTION', 'TELEMETRY-SWITCH'],
    keywords: ['recording', 'privacy', 'telemetry', 'analytics', 'tracking', 'observability', 'what is recorded', 'turn off recording', 'errors', 'slow'],
    related: ['settings', 'workspace', 'ai-assistants'],
  },
  {
    id: 'ai-assistants',
    title: 'MCP access',
    summary: 'Connect Claude or another AI tool to Faro through MCP with a personal MCP token, so it can read and do everything you can in the app, as you. Faro has no AI of its own: this is the door other AI tools use.',
    group: 'you',
    sections: [
      { heading: 'What it can do', list: [
        'Read every screen: what needs you, goals, a goal in full, requests, reviews, watching, people, activity, views, the wrap-up, this guide and what’s new.',
        'Do what you can: check in, set up and change goals and plans, answer requests, take part in reviews, watch goals, save views, and (as an admin) manage people and teams and turn recording on or off.',
        'Look after the metric library: list and read the metrics goals are measured by, add one or change one you own, and say which metric measures one of your goals, for a team or the whole company and optionally one part of it (it asks before two goals share one number, and asks why when a goal with check-ins is measured differently).',
        'It meets the same rules as you, with exactly your rights, and every change is logged as you, marked “via MCP”. A goal it can’t save comes back as “Not saved. Must fix:” with each problem in the words New goal uses. A goal that raises a question (over 100%, no unit, a link to a lower level, a plan that flips which way is better) comes back as “Not saved. Check with the person first:” with every question; it saves once you have said yes to each and it calls again with “confirm”.',
        'In one bulk change it can add a whole tree of goals and their first numbers: each new goal’s row has a Ref, and the rows below name it in Feeds into ref or Goal ref. One dry run checks it all.',
        'Adding goals, one at a time or many at once, it is told each new goal’s key (G-12) and ID straight away, so it can link, check in on or change them without searching first. The key is the one the goal holds once saved, even when someone else adds a goal at the same moment. A dry run says the keys the goals would get, and no IDs yet.',
        'Finding goals, it gets 50 at a time, with how many match in all and how to ask for the next page.',
        'Lists (goals it finds, asks, reviews, people, activity, views, metrics and the rest) always come back in one shape, filtered or not, so it reads them the same way every time.',
        'Ask it to describe the system and it gets Faro’s own overview: what the app is, how its rules work, and where its spec says the rest.',
        'Ask for “my goals”, “my team’s goals” or “what I’m watching” and it finds exactly what the Goals tabs Mine, My team and Watching show you.',
        'Paste a Goals link and it finds the same goals the link shows, its tab (Mine, My team, Watching) included.',
      ] },
      { heading: 'How to connect', list: [
        'An admin makes a personal MCP token for you under Workspace, Access, MCP access. The database makes it, keeps only a hash of it, and shows it once; nobody can read tokens back, not even through the app.',
        'Add the server to your AI tool with the address and token shown. For Claude Code: claude mcp add --transport http goals https://<app>/api/mcp --header "Authorization: Bearer gk_…".',
        'See and revoke your MCP tokens in Settings. The full list of tools is in docs/mcp.md.',
      ] },
      { heading: 'Who can', text: ['Only admins make MCP tokens. An admin or the token’s own person can revoke one. Any MCP token, a builder token made before included, also reads and triages the inbox’s markups and feedback, pictures included (Connect Claude, at the top of the inbox, has the set-up).'] },
    ],
    routes: [],
    screens: [],
    reqs: ['MCP-TOKENS', 'MCP-PARITY', 'TOKENS-SERVER-ONLY'],
    keywords: ['ai', 'claude', 'mcp', 'mcp access', 'mcp token', 'ai assistant', 'assistant', 'token', 'api', 'automation', 'agent', 'metric', 'metric library', 'measured by'],
    related: ['workspace', 'settings', 'export'],
  },
  {
    id: 'any-device',
    title: 'On a phone, a tablet or a big screen',
    summary: 'The app works at every size, from a small phone to an ultra-wide monitor, and keeps your work safe as you go.',
    group: 'you',
    sections: [
      { heading: 'The menu', list: [
        'The menu is in four groups: your work (Home, Check-in when you have a goal to check in on, Goals with up to four saved views under it, Reviews), things to look up (People, Activity, Data, and any feature’s own place), New goal, and this workspace and you (Workspace, Settings, Help, Feedback). Your name and role are at the foot; in the demo they open the Demo panel.',
        'Collapsed to icons, each icon names itself when you point at it or move to it with the keyboard. Between a phone and a computer the menu is always icons.',
        'On a phone the tabs are Home, Check-in, Goals and Reviews for someone with a goal to check in on, or Home, Goals, Reviews and People; More holds the rest, in the same groups.',
      ] },
      { heading: 'How it fits', list: [
        'On a phone, the tabs at the bottom hold Home, your main places and More. More has everything else, in the same groups as the sidebar, including Data, Settings, Help and Feedback.',
        'On a tablet the sidebar is a rail of icons, each named on hover. On a desktop you can choose the rail in Settings.',
        'Focused tasks such as a check-in stay narrow; tables, boards and the map use the whole width.',
        'Text follows your browser’s text size, and every control is big enough to tap.',
      ] },
      { heading: 'Your work is safe', list: [
        'Unsaved answers are kept as a draft and offered back. A save either lands whole or not at all, and never overwrites someone else’s change without telling you.',
        'When Faro is updated while you have it open, the page you are on may reload itself once, at the same address, to load the new version. Anything you were typing is kept as a draft. If it still can’t load, you see Reload and Home instead.',
        'Offline, a page Faro hasn’t loaded yet (Help, say) tells you it needs a connection instead of reloading. Try again opens it once you’re back online; Go back returns you to where you were.',
        'The same goes for saving: if the part of Faro that saves a check-in or a change hasn’t loaded, Post check-in tells you so instead of doing nothing. Offline, try again once you’re back online; online, it reloads the page, or offers Reload, and keeps what you typed.',
        'Feedback, in the menu’s last group or in More, has Send feedback: it tells your admins (or, in the demo, the people building the app) how it is working for you, or marks up the screen for the people building Faro.',
      ] },
      { heading: 'On your home screen', list: [
        'Put Faro on your phone’s home screen like an app: in Chrome on Android, open the menu and choose Add to home screen (or Install app); in Safari on an iPhone, tap Share, then Add to Home Screen. It opens full screen, without the browser around it.',
        'Its icon is a deep-teal tile with the F in white and a bright amber beam and teal bar, so it stands out on light and dark wallpapers.',
        'Each time you open Faro, the amber beam sweeps across the screen like a lighthouse’s light, flashing as it points at you, then settles into the F; the teal bar and “aro” are drawn in. It takes about two and a half seconds, the app loads behind it, and a tap or any key skips it. It doesn’t play again as you move around, and with reduced motion on your device the logo simply fades in.',
      ] },
    ],
    routes: [],
    screens: [],
    reqs: ['NAV-PLACES', 'NAV-COLLAPSED', 'LAUNCH', 'PHONE', 'A11Y', 'NO-ERRORS', 'EVERY-WIDTH', 'WIDE-SCREENS', 'FIT-AND-FINISH', 'FIT-AND-FINISH-AREAS', 'NO-LOST-UPDATES', 'DRAFTS', 'PERSIST', 'MOTION', 'NAV-GOALS', 'STALE-RELOAD'],
    keywords: ['phone', 'mobile', 'tablet', 'desktop', 'more', 'tabs', 'feedback', 'drafts', 'offline', 'accessibility', 'keyboard', 'text size', 'home screen', 'install', 'icon', 'app icon', 'splash', 'lighthouse', 'add to home screen'],
    related: ['settings', 'help'],
  },
  {
    id: 'help',
    title: 'Help and what’s new',
    summary: 'This guide says what everything in Faro does. What’s new lists each release, newest first.',
    group: 'you',
    sections: [
      { heading: 'How to use it', list: [
        'Open Help at the foot of the sidebar, in More on a phone, or the Help link at the bottom of any page, which opens the article for that page.',
        'Search finds articles by what they cover. Each article ends with related ones.',
        'What’s new lists each release with a few plain lines and links to the articles that explain it. A small dot beside Help means there is something you haven’t seen; opening What’s new clears it.',
        'An AI tool connected through MCP can read this guide and What’s new too.',
      ] },
    ],
    routes: ['/help', '/help/:id', '/whats-new'],
    screens: ['Help'],
    reqs: ['HELP-GUIDE', 'WHATS-NEW', 'CONSISTENT-WORDS'],
    keywords: ['help', 'guide', 'docs', 'documentation', 'how to', 'whats new', 'release notes', 'changelog', 'updates'],
    related: ['home', 'any-device'],
  },
];

/** Every article: the core's, with each module's (its help.ts) after the article it names, or at the end of its group. */
export const ARTICLES: Article[] = (() => {
  const out = [...CORE_ARTICLES];
  for (const m of MODULE_HELP) for (const a of m.part) {
    const at = a.after ? out.findIndex((x) => x.id === a.after) : out.map((x) => x.group).lastIndexOf(a.group);
    out.splice(at < 0 ? out.length : at + 1, 0, { ...a, module: m.id });
  }
  return out;
})();

const BY_ID = new Map(ARTICLES.map((a) => [a.id, a]));
/** Articles that were renamed: their old ids, from old links and earlier What's new entries, open the new one. */
export const MOVED_ARTICLES: Record<string, string> = { 'workspace-people': 'people', 'workspace-teams': 'teams' };
export const articleById = (id: string): Article | undefined => BY_ID.get(id) ?? BY_ID.get(MOVED_ARTICLES[id] ?? '');

/** All the words of an article, for search. */
export const articleWords = (a: Article): string => textOf(a);
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
    // Find's rule 1, as everywhere: each word must start a word in the article ("eck" finds nothing).
    if (!textMatches(textOf(a), query)) return null;
    const title = norm(a.title), keys = norm(a.keywords.join(' ')), sum = norm(a.summary);
    // Where a word appears counts most; how often it appears breaks ties.
    const score = words.reduce((n, w) => n + (title.includes(w) ? 8 : 0) + (keys.includes(w) ? 4 : 0) + (sum.includes(w) ? 2 : 0) + Math.min(4, all.split(w).length - 1), 0);
    return { a, score };
  }).filter((x): x is { a: Article; score: number } => !!x);
  return scored.sort((x, y) => y.score - x.score || ARTICLES.indexOf(x.a) - ARTICLES.indexOf(y.a)).map((x) => x.a);
}

/** How closely a route matches an address (src/help/match.ts, shared with the light index in src/help/lookup.ts). */
export { routeScore };

/** The article for a page: the one whose route matches the address most closely. */
export const articleForPath = (pathname: string, search = ''): Article | undefined => closestRoute(ARTICLES, (a) => a.routes, pathname, search)?.item;

/** The App.tsx route an address is on, e.g. /goals/:goalId for /goals/G-12: what telemetry records instead of ids. */
let appRoutes: string[] | null = null;
export const appRouteFor = (pathname: string): string | undefined => closestRoute(appRoutes ??= guideRoutes(), (r) => [r], pathname)?.route;

/** The route paths the guide explains, without their queries: for the checks that every route has an article. */
export const guideRoutes = (): string[] => routePaths(ARTICLES);

/** An article as plain text: for the AI assistant. */
export function articleText(a: Article): string {
  return [`# ${a.title}`, a.summary, ...a.sections.map((s) => [`## ${s.heading}`, ...(s.text ?? []), ...(s.list ?? []).map((l) => `- ${l}`)].join('\n'))].join('\n\n');
}
