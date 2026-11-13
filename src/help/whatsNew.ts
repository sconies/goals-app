/* What's new: each release, for the people using the app (not its developers). Newest first, each with a stable id
   that never changes (the app remembers the last one a person has seen), a date, a title, a few plain lines, and the
   guide articles that explain it.
   What's new is for features only (Lane, 13 Nov): a new feature, or a visible change to how one works, gets an entry
   here; bug fixes, review fixes, polish and wording don't, unless the fix is major (it changes a number people rely
   on, restores something that was broken for many, or changes who may do what). Where a feature was built in parts,
   its parts are one entry, under the latest date.
   Every change people can see updates the guide (src/help/guide.ts). CI checks that a pull request changing the app
   touches this file (scripts/check-whats-new.mjs); src/help/guide.test.ts checks the order, the ids, the dates and
   the links. */

import { entriesAfter } from './match';

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
    id: 'empty-pages-say-when',
    date: '2026-11-13',
    title: 'Empty pages say when you’d want them',
    points: [
      'Metrics, Watching and Activity, while empty, say what is true and when you would want them, with a plain button rather than a big one.',
      'A tab or a menu row with nothing in it no longer shows a 0.',
    ],
    articles: ['watching', 'metrics', 'activity'],
  },
  {
    id: 'look-around-the-demo',
    date: '2026-11-13',
    title: 'Look around the demo from any workspace',
    points: [
      'The workspace switcher has Look around the demo: the example workspace, which you can change freely without touching yours.',
      'On a phone, Home’s review cell uses a shorter label, so the review’s name fits.',
    ],
    articles: ['workspace'],
  },
  {
    id: 'reviews-switch-clock',
    date: '2026-11-13',
    title: 'Check-ins say plainly which day they’re due',
    points: [
      'The day check-ins are due is said one way everywhere: “by Thursday”, or “before Thursday’s review” only when you are in a review held that day. With Reviews off, the week’s receipt says “All 7 of your check-ins are in by Thursday.”',
      'Switching Reviews off now also says how many accepted risks stay on their goals, and that check-ins are still due by the same day.',
      'With Reviews off, an exported spreadsheet has no Notes sheet and no Review column on Asks, and an import that has them says once that they were not read.',
    ],
    articles: ['check-in', 'features'],
  },
  {
    id: 'goals-for-others-asked-in-files',
    date: '2026-11-13',
    title: 'Proposed goals in What feeds it, the year’s start and files',
    points: [
      'A goal’s What feeds it lists the goals proposed to feed it under “Proposed”, counted in nothing.',
      'When the next year starts, proposed goals carry as proposed, counted apart on the start page.',
      'A spreadsheet or an AI assistant that adds goals for other people, with no State, asks once whether they start active or proposed. An admin’s file and set-up aren’t asked.',
    ],
    articles: ['goal-proposed', 'goal-page', 'data'],
  },
  {
    id: 'habit-before-this-review',
    date: '2026-11-13',
    title: 'A review says how many goals were ready for it',
    points: [
      'A review’s page now opens with how many of its goals were checked in before it, and how many without anyone asking.',
      'Links open the goals that came in after an ask for an update, and those with no check-in yet.',
      'The last 8 weeks show as a row of squares: All in, how many came after, or None in. A team’s page has the same.',
      'It counts weeks and goals, never people, and isn’t shown for a set of goals with fewer than three owners.',
    ],
    articles: ['reviews', 'teams'],
  },
  {
    id: 'habit-receipt-and-moment',
    date: '2026-11-13',
    title: 'Your run forgives one missed week, and reaching a target is said, quietly',
    points: [
      'When your week’s check-ins are all in, the last screen says whether they were in before the deadline (or the review, if you are in one that day), and how many weeks in a row you have been on time.',
      'One late or missed week no longer ends your run: if the four weeks before it were on time, it is forgiven, and the next check-in says so once. A goal called Done leaves your run, and a goal you take over counts only from when it became yours.',
      'A check-in that takes a goal to its target says so in one quiet panel, with a way to copy the goal’s share image. One that brings a goal back on track after two weeks or more behind says that too.',
      'The goal’s History marks those weeks “Reached its target” or “Back on track”.',
    ],
    articles: ['check-in', 'home'],
  },
  {
    id: 'state-filter-stopped',
    date: '2026-11-13',
    title: 'Find the goals stopped this year',
    points: [
      'The Filters sheet’s State has a third choice, Stopped: the goals stopped this year, most recently stopped first.',
      'Each says who stopped it, when and why, and opens its page as it stood.',
    ],
    articles: ['goals', 'goal-page'],
  },
  {
    id: 'reviews-switch',
    date: '2026-11-13',
    title: 'Reviews can be switched off, and nothing they saved is lost',
    points: [
      'An admin can switch Reviews off for a workspace on Workspace, Features, under How you work. Before it goes off, Faro says how many reviews, next steps and questions stay, and Undo brings it straight back.',
      'Off, there is no Reviews in the menu or on Home, no walk or “Last time we talked” on a goal, and an old review link says Reviews is switched off. Someone who owns no goals is led to the goals they watch that need attention.',
      'Asks and next steps stay on their goals and on Home. What was said in reviews stays in each goal’s History and in Activity. Switch Reviews back on and every review is as it was.',
      'A check-in coming due now says the day it is due by, “Due by Thu 12 Nov”, whether or not Reviews is on.',
    ],
    articles: ['features', 'home', 'goal-page', 'reviews'],
  },
  {
    id: 'proposed-type-changes',
    date: '2026-11-13',
    title: 'A proposed goal’s type can still change',
    points: [
      'Changing a proposed goal, Type lets you turn it into a number to move, a number to keep in range, or dated stages.',
      'Once it is active, its type stays: add a new goal instead.',
    ],
    articles: ['goal-proposed', 'edit-goal'],
  },
  {
    id: 'asks-follow-owner-by-role',
    date: '2026-11-13',
    title: 'Asks that follow a goal’s new owner are the ones put to the owner',
    points: [
      'When a goal changes owner, the open asks put to its owner — an update asked for, a question — go with it, and the new owner sees “Asked of {name}, now yours”.',
      'An ask put to a person by name — a next step they agreed, a decision asked of them — stays with that person.',
      'If the new owner is the one who asked, the ask closes: nobody answers their own ask.',
    ],
    articles: ['requests', 'goal-page'],
  },
  {
    id: 'propose-in-review',
    date: '2026-11-13',
    title: 'Propose a new goal in a review',
    points: [
      'Walking a review, Propose a new goal saves one with only a name, who will own it and what it will feed. It is proposed: nothing is due on it until its owner sets it up and makes it active.',
      'Its owner’s Home says where it came from: “Rhea proposed a goal for you in Developer Productivity fortnightly”.',
      'The review’s next session lists it under Last time, with whether its owner has made it active yet.',
    ],
    articles: ['goal-proposed', 'reviews'],
  },
  {
    id: 'goal-proposed',
    date: '2026-11-13',
    title: 'Propose a goal before it starts',
    points: [
      'New goal’s last step asks whether the goal is under way. If not, propose it: everyone can see it, nothing is due, and its owner or an admin makes it active once it is agreed.',
      'A goal made active too soon can go back to proposed while it has no check-ins: Make it proposed again, in the goal’s “…” menu.',
      'Proposed goals are counted apart and listed under Goals with the Proposed filter. The Board shows one Proposed column, and the Map draws each proposed goal in its tree with a dashed outline and the word. None has a status, is on the critical path or is counted in what is under a goal.',
      'A goal proposed for you shows on your Home under Needs your response, and leads Home once it has waited a week. After 8 weeks it asks once whether to make it active or withdraw it; Not yet puts it off for 8 more weeks.',
      'A metric’s page lists the proposed goals that name it, as “Proposed · 1”, with no numbers; they join the comparison once they are active.',
      'When someone is marked as left, the goals proposed for them are handed over with the rest.',
    ],
    articles: ['goal-proposed', 'home', 'goals', 'new-goal', 'metrics', 'columns'],
  },
  {
    id: 'metric-change',
    date: '2026-11-13',
    title: 'A metric that changes tells its goals',
    points: [
      'Changing what a metric means, or which way is better, now shows its goals first and asks whether it is still the same number.',
      'When the number itself changes, say why: each goal’s chart gets a dashed line, “Definition changed, week 46”, and its History your reason.',
      'A new unit is either a new label, changed on every goal too, or a different scale, which is a new metric.',
      'A metric that has measured goals is retired, not deleted: its goals keep their numbers and say so, and Bring it back undoes it. Admins can merge two metrics in the same unit.',
    ],
    articles: ['metric-change'],
  },
  {
    id: 'metric-part',
    date: '2026-11-13',
    title: 'Measure a goal by one part of a number',
    points: [
      '“Measured by” now has “Which part”: tier-1 services, a region, release builds. Parts other goals on the metric already use are offered under it.',
      'A goal takes its unit and which way is better from its metric, shown as “From the metric”; its target and dates stay its own.',
      'Once a goal has check-ins, changing what measures it asks why, and its History says so.',
      'A goal’s About lists what its metric says: for whom, what it means, where the number comes from and the goal’s own target.',
    ],
    articles: ['metric-slices', 'metric-measured-by'],
  },
  {
    id: 'asks-follow-owner',
    date: '2026-11-13',
    title: 'Asks say how long they have waited, and follow a goal to its new owner',
    points: [
      'Each ask on Home says how long it has waited, or when it is due, and a late one says so first with the warning mark. The oldest or most pressing ask can be Home’s one main action when nothing comes before it.',
      'When a goal changes owner, its open asks of the old owner go to the new one. Their Home says “Asked of Tunde, now yours”, and the ask’s history says so for whoever asked. Answered asks stay as they were.',
      'A question raised in a review is due before the next session after the one it was raised in, and stays due then.',
      'The AI tools’ “what needs me” lists asks in Home’s order, with Home’s words for how long each has waited and whether it is late.',
    ],
    articles: ['home', 'requests'],
  },
  {
    id: 'older-changes-on-request',
    date: '2026-11-13',
    title: 'Faro opens with the last year of changes, and fetches older ones when asked',
    points: [
      'A workspace opens faster: it brings the last year or so of changes, and every comment, ask and import whatever its age.',
      'Show older changes, at the end of Activity and of a goal’s History, fetches older ones a page at a time.',
      'An import over a year old can no longer be undone, since too much may have changed since.',
    ],
    articles: ['activity'],
  },
  {
    id: 'ended-cycle-stays-as-read',
    date: '2026-11-13',
    title: 'A year that has ended keeps its check-ins as the wrap-up read them',
    points: [
      'Once a cycle has ended, none of its check-ins can be corrected: not from the form, Data’s tables, the AI assistant or a spreadsheet.',
      'A spreadsheet that carries those check-ins unchanged still loads.',
    ],
    articles: ['check-in'],
  },
  {
    id: 'correct-check-in',
    date: '2026-11-13',
    title: 'Correcting a check-in, and checking in again',
    points: [
      'Correct it, under a posted check-in or from the week’s list, replaces that check-in instead of adding a second one for the week. It opens with what the check-in said, asks why you are changing it, and History keeps what it said before and your reason.',
      'Checking in again in the same week adds a check-in beside the first, and is compared with last week, not with your first one.',
      'Correcting a week in Data’s tables, through the AI assistant or from a spreadsheet asks why in the same way, and History says “Corrected week 45” with your reason.',
      'A correction that changes only the words says what it changed, never “37 hours is now 37 hours”. Undo on the message puts the first check-in back.',
    ],
    articles: ['check-in'],
  },
  {
    id: 'check-ins-owner-only',
    date: '2026-11-13',
    title: 'Check-ins are the owner’s',
    points: [
      'Only a goal’s owner checks in on it, in the app, in the one-table check-in and through the AI assistant alike. An admin’s token can no longer post one for someone else.',
      'An admin corrects a past check-in in Data and brings in everyone’s history from a spreadsheet, but not this week’s new check-in for someone else.',
      'Delete this check-in is for the goal’s owner, whoever posted it. A check-in an admin loaded is headed with the admin’s name, not as what the owner said.',
      'Answering an update ask, only the owner is offered Check in for the week; anyone else answers in a sentence.',
      'Setting up a goal for someone else, a stage already past is asked about, and the question says they mark done stages at their first check-in.',
    ],
    articles: ['check-in', 'data', 'requests'],
  },
  {
    id: 'review-who-speaks',
    date: '2026-11-13',
    title: 'Only people in a review, or an admin, decide in it',
    points: [
      'Marking goals reviewed, notes, accepting a risk, and questions and next steps raised in a review are for the people in it, or an admin, in the app and through AI assistants alike.',
      'A review speaks only for the goals it walks: its goals, trees and levels. Anything else is refused, with a sentence that says why.',
      'Anyone can still read every review, and ask a question or agree a next step on the goal’s own page.',
      'A review you’re not in says who can add you, instead of offering a Join button that didn’t work.',
    ],
    articles: ['reviews'],
  },
  {
    id: 'range-between',
    date: '2026-11-13',
    title: 'Keep a number between two others',
    points: [
      'A range can keep a number between two others: “keep it between 99.5% and 99.95%”. Must stay has Between beside At most and At least, in New goal and Change this goal.',
      'It is out of range above the upper limit or below the lower one, and at risk within the warning margin of either. The chart draws both limits, with their labels clear of each other.',
      'A number moving back towards the middle reads as getting better, from either side, in its trend, “Vs last week” and the attention flags. “Will it stay within?” answers for whichever limit the number is likelier to cross.',
      'In a spreadsheet, write both numbers in Limit (99.5–99.95, or 99.5 to 99.95); an export writes them the same way, and two numbers with At most or At least ask whether you meant Between.',
    ],
    articles: ['new-goal', 'edit-goal'],
  },
  {
    id: 'one-list-bar',
    date: '2026-11-13',
    title: 'Every list searches and filters the same way',
    points: [
      'Goals, Activity, Help, Data, Feedback, People and Teams share one bar. Each word you type starts a word in what they find (“back” no longer finds “fallback”), a goal’s key finds it however you type it (G-48, g48 or 48), and one letter off shows the nearest match.',
      'Each list says how many match, in the same words, and when nothing does it says so with Clear the search.',
      'Filters read as words with Remove: “Filtered by: Status Off track · Owner Rhea Kapoor”. A search is never listed as a filter; it stays in the search box.',
      'The search, the filters and the sort are in the address, so Back steps through them and a shared link shows the same list.',
      'Search looks only in the columns shown, and the line under it says so while some are hidden. A number with a point is one word, so 12.5 finds 12.5, and on Data a goal’s key finds its check-ins and asks too.',
    ],
    articles: ['finding', 'activity', 'help', 'data', 'inbox', 'people', 'goals-filters'],
  },
  {
    id: 'metrics-place',
    date: '2026-11-12',
    title: 'A library of metrics, with its own place',
    points: [
      'Metrics is in the menu, beside People (on a phone, under More): every number goals are measured by, defined once, with its meaning, unit, which way is better, source and owner.',
      'Find a metric by its name, unit, owner or meaning, and narrow the list by unit, by the team that uses it, or by what still needs sorting out. Each metric has a page with its meaning and every goal measured by it, side by side.',
      'In New goal, “Measured by” comes first: type to find a metric, or add one there. Choosing one fills in its unit and which way is better.',
      'Adding a metric asks for three things first — a name, a unit and which way is better — and the rest can be said later. Each one says “Fully defined” or what it still lacks, never a score.',
      'A name one letter from another’s, one differing only by case or an accent, a unit spelt differently from one in use, or a percentage that doesn’t say out of what, is questioned before it is saved, wherever a metric is added.',
      'A metric that is removed says which goals it leaves, and Put it back brings it back with them. An AI assistant can list metrics, read one, add one or change one you own, and say which metric measures a goal.',
    ],
    articles: ['metrics', 'metric-define', 'metric-measured-by', 'ai-assistants'],
  },
  {
    id: 'import-preview',
    date: '2026-11-12',
    title: 'A clearer check before an import is saved',
    points: [
      'Counts by sheet first; then what must be fixed; then questions; then the changes, if you want them. It says which sheets and columns it didn’t read.',
      'Paste cells from a spreadsheet straight into Import. A title row above the headers is read, and a header one letter out is asked about once: “Read it as Target?”',
      'A name one letter out is a question, not a refusal: “Did you mean Platform?” The same problem on 14 rows is said once, and one answer covers them all. Numbers that look wrong are asked about before saving.',
      'Download just the rows to fix, or leave them out and save the rest. An answered question stays on the page with Change, and a corrected file keeps your answers.',
      'A big file is checked in a second or two without freezing, showing how far it has got, with Stop. Faro says up front what it reads: up to 30,000 rows a file, and 5,000 changes at a time, offered in parts to save one after the other.',
      'A spreadsheet given at set-up ends on the same preview: what it adds, what must be fixed, and its questions.',
    ],
    articles: ['import', 'set-up', 'columns'],
  },
  {
    id: 'batch-refs',
    date: '2026-11-12',
    title: 'Build a whole tree of goals in one file',
    points: [
      'A spreadsheet, a bulk change or an AI tool can now add goals that feed each other in one go: give each new goal’s row a Ref of your own, and name it in Feeds into ref on the rows below.',
      'A check-in row can name a new goal the same way, with Goal ref, so its first number goes in with it.',
      'Two new goals with the same name stay two goals when each row has its own Ref.',
    ],
    articles: ['import', 'ai-assistants'],
  },
  {
    id: 'past-imports',
    date: '2026-11-12',
    title: 'Past imports, each with Undo',
    points: [
      'Data lists every import, who made it and what it changed: Spreadsheets, then Past imports. Saving an import ends on a page that says what was saved, with Undo beside it.',
      'Undo says first which rows have changed since, and why they will stay; what it puts back stays back — goals it deleted or stopped, people it marked as left, and teams.',
      'In Activity an import is one entry, its changes folded under it. A corrected check-in and a bulk edit on People are named as such.',
      'Undo puts a check-in back only for someone who may check in on that goal: an admin can undo a workbook they loaded, but not an owner’s own correction.',
    ],
    articles: ['past-imports', 'import'],
  },
  {
    id: 'export-one-button',
    date: '2026-11-12',
    title: 'Export is one button',
    points: [
      'Excel by default; other formats one click away.',
      'File names say what’s in them: all, the view’s name, or as-shown.',
      'On Data, Export and Import sit side by side. Past imports and the template are on the Import page.',
    ],
    articles: ['export', 'data'],
  },
  {
    id: 'home-asks-first',
    date: '2026-11-12',
    title: 'Home starts with what is asked of you today, and is quiet when nothing is',
    points: [
      'Home leads with one thing: your check-ins the day before they are due or once late, the wrap-up, or a review you’re in on its day. It is the page’s one big button.',
      'When nothing is asked of you, Home says so in one line, with when your next check-ins are due, and has no big button.',
      'Your goals are counted once, in Your goals, worst first, and each count opens exactly those goals.',
      'What’s new in Faro is now a line at the foot of Home.',
    ],
    articles: ['home'],
  },
  {
    id: 'goal-edit-one-page',
    date: '2026-11-12',
    title: 'Changing a goal is one page',
    points: [
      'Change this goal opens one page in four sections: What it is, Plan and target, Who and where, and More details.',
      'Save changes stays at the foot of the window and never covers what you’re typing.',
      'One way out: Close and keep the draft. What you typed is there when you come back.',
      'Describe it on a goal with no definition opens the page at What it is.',
    ],
    articles: ['edit-goal'],
  },
  {
    id: 'goal-needs-said',
    date: '2026-11-12',
    title: 'New goal says what it needs, and asks in a better order',
    points: [
      'What, then who and where, then how it’s measured, then check. Your browser’s Back steps back a step.',
      'Each step says what is needed and marks what is optional. A problem shows under its field as you leave it, and is counted by the button.',
      'The unit is yours to give: it no longer starts as %. Decimals follow what you type, and you can change them.',
      'Type to find the owner, the team and the goal it feeds. “Also helps” can be set as you create it.',
      'Anyone can add a goal for anyone, at any level, from New goal, a spreadsheet or an AI assistant. Choosing someone else as owner says who can change it afterwards: them, or an admin.',
      'A spreadsheet, set-up and the AI assistant say a goal’s problems in the same words as New goal.',
    ],
    articles: ['new-goal', 'ai-assistants'],
  },
  {
    id: 'goal-questions',
    date: '2026-11-12',
    title: 'Unlikely values are asked about, once',
    points: [
      'Over 100%, below zero, no unit, an owner in another team, a link to a lower level: New goal asks under the field, and remembers your answer.',
      'Change the number and it asks again. Your answers are kept in the goal’s History.',
      'A stage already past is asked about in the same way, and so are the numbers on set-up’s goal cards and the edit page.',
      'A question raised as you type scrolls into view, above an on-screen keyboard, and Continue or Save changes with one open takes you straight to it.',
      'Spreadsheets and assistants are asked the same questions.',
    ],
    articles: ['new-goal', 'edit-goal', 'ai-assistants'],
  },
  {
    id: 'goal-dates-picked',
    date: '2026-11-12',
    title: 'Pick a goal’s weeks, with their dates',
    points: [
      'A number goal now says its baseline, From and To.',
      'Choose each week from a list that shows its dates and year: this year or next.',
      'A goal whose From is still to come isn’t due until then: it reads “No check-in yet · starts week 50”.',
      'Spreadsheets write weeks as 2026-W46; old files still load.',
    ],
    articles: ['new-goal', 'edit-goal', 'import'],
  },
  {
    id: 'goal-read-back',
    date: '2026-11-12',
    title: 'Read your goal back before it’s published',
    points: [
      'The last step says, in sentences, what you typed and what was left as usual.',
      'It says when the first check-in is due and how long you can still delete it.',
      'It names the reviews that will walk the goal, and who sees it if it’s someone else’s.',
    ],
    articles: ['new-goal'],
  },
  {
    id: 'welcome-page',
    date: '2026-11-12',
    title: 'A proper front door',
    points: [
      'Welcome has its own page: set up a workspace, look around the demo, or join one you were invited to.',
      'An invitation opens the right workspace and says who set it up.',
      'Opening Faro on a new device no longer drops you into a workspace you didn’t choose.',
    ],
    articles: ['welcome', 'joining'],
  },
  {
    id: 'workspace-sections',
    date: '2026-11-12',
    title: 'Workspace in sections, and an inbox you can work through',
    points: [
      'Workspace is in sections, each on its own page: About, People, Teams and Inbox, and for admins Cycles, Access, Features, Privacy and Recently removed. On a computer they’re in a menu on the left; on a phone, Workspace opens as a list of them.',
      'It opens on About: for admins, what needs sorting out here, each with one button; then the facts about this workspace, each leading to its section. One line says whose workspace it is and whether you’re an admin or a member here.',
      'The workspace’s name at the top of the sidebar is the switcher: every workspace, and setting up one of your own. Land in another as someone else and one line says so: “You’re Rhea Kapoor here, a member.”',
      'The inbox works like an inbox: New, In hand and Closed, each with its count; search and filters for kind, page and person; 25 at a time. Markups about the same part of a page fold into one row (“6 on this part”) and are handled together.',
      'On a computer, the list and the open item sit side by side, with keys: J and K to move, I for in hand, F for fixed, W for won’t fix. On a phone, one at a time with Next. Tick rows to close a batch at once.',
      'Cycles shows each goal year’s dates, which one is running and its week, and leads to the wrap-up.',
    ],
    articles: ['workspace', 'inbox', 'people', 'teams', 'workspace-cycles', 'settings'],
  },
  {
    id: 'open-inbox',
    date: '2026-11-12',
    title: 'Feedback and the inbox are open to everyone',
    points: [
      'Anyone can read the markups and feedback people send, and send their own, on any device, without signing in. Faro holds no real data, so there is nothing to hide.',
      'Only an admin changes a status. Each change says who made it, and Undo puts back the status it replaced.',
      'Feedback has its own page beside Help, holding what was sent from every workspace and the demo. It names people, never their email, and its address /inbox opens it.',
      'Connect Claude, at the top of the inbox, makes a token and shows the set-up, so an AI assistant can list, open and triage markups and feedback with the inbox’s rules.',
    ],
    articles: ['inbox', 'feedback', 'ai-assistants'],
  },
  {
    id: 'mcp-goal-scopes',
    date: '2026-11-12',
    title: 'MCP access: the goals you mean, lists in one shape, and new goals’ keys',
    points: [
      'AI assistants is now MCP access: Faro has no AI of its own, and this is how you connect Claude or another AI tool to it. Tokens are MCP tokens, and a change made through one says “via MCP”.',
      'Ask for your goals, your team’s or the ones you watch and it finds the same goals as Mine, My team and Watching on Goals. A pasted Goals link finds the goals that link shows.',
      'Every list comes back in one shape, filtered or not: goals, asks, reviews, people, activity, views, tokens, metrics, what you watch, what was removed and feedback. Goals come 50 at a time, with how many match in all.',
      'When an assistant adds a goal, it is told the key the goal holds once saved (G-12) and its ID at once, so it can link or check in on it without searching first. A dry run says the key each new goal would get.',
      'A new tool, describe system, gives a one-page overview of what Faro is, how its rules work and where the spec says the rest.',
    ],
    articles: ['ai-assistants', 'goals'],
  },
  {
    id: 'quarters-before-set-up',
    date: '2026-11-12',
    title: 'Quarters before a goal existed are not judged',
    points: [
      'A goal set up part way through the year no longer shows the quarters that ended before it as Not met. They say Not applicable, with the week it was set up.',
      'Those quarters are in no count of met or not met, and no longer raise “Last quarter not met” on the goal or in the overview.',
    ],
    articles: ['history', 'status'],
  },
  {
    id: 'carry-right',
    date: '2026-11-12',
    title: 'Goals carry on with their history',
    points: [
      'A carried goal keeps its metric, its watchers, its open next steps and asks, and its place in reviews.',
      'Its plan starts in week 1 from its final number, with the same target due at the end of the new year. Stages not done are spread over the new year, never after its last week.',
      'Once next year is set up, a goal stopped, started again, changed or checked in this year updates its copy there, however the change was made, until someone uses that copy.',
      'Stopping a goal and then carrying it on again brings back the same goal in next year, with its key, not a second one.',
    ],
    articles: ['start-next-year', 'wrap-up'],
  },
  {
    id: 'goals-opens-on-yours',
    date: '2026-11-11',
    title: 'Goals opens on yours, with layouts and views by name',
    points: [
      'Goals’ tabs say whose goals: Mine, My team, Watching and All, each with its count. It opens on the one you used last.',
      'How they’re arranged is its own choice, Group (as trees, by team, by level, or one list), and Needs attention is a switch that works on any tab.',
      'Layout and Views are menus, the same on a computer and a phone. Views holds your saved views, Save this view, Copy link and Export these goals; Layout says what each one shows.',
      'On a phone, Goals starts with the goals: View opens one sheet with the layout, the grouping and your saved views.',
      'The menu is four groups: your work, things to look up, New goal, and this workspace and you. Collapsed, each icon names itself; on a phone, More holds the rest in the same groups.',
    ],
    articles: ['goals', 'goals-filters', 'goal-map', 'any-device'],
    fixes: ['mk_3066bf5c5a35402e'],
  },
  {
    id: 'find-anywhere',
    date: '2026-11-11',
    title: 'Find, from anywhere',
    points: [
      'Press Ctrl K (Cmd K on a Mac), or Find in the sidebar, and type a name or a key like G-48.',
      'Goals, people and teams that match come in groups, three each, with “See all” for the rest. On a phone, Find is in the top bar.',
    ],
    articles: ['finding'],
  },
  {
    id: 'find-and-pick',
    date: '2026-11-11',
    title: 'Type to find a person, a team or a goal',
    points: [
      'Wherever Faro asks for a person, a team or a goal, you type to find them, with you and your team suggested first: a goal’s owner, team, what it feeds and what it also helps; who takes part in a review; a next step’s owner; who takes over when someone leaves; the owners in set-up; and the filters on Activity, Data and Feedback.',
      'A goal is found by its words or its key (G-48). Arrow keys and Enter choose; Escape closes. A goal already under the one you’re editing is listed, greyed, with why it can’t feed it.',
      'Someone who has left is found too, marked “(left)”.',
      'On a phone the list of matches opens as a full screen, not half of one.',
    ],
    articles: ['finding', 'new-goal', 'edit-goal', 'reviews', 'data', 'inbox', 'demo'],
  },
  {
    id: 'check-in-queue',
    date: '2026-11-11',
    title: 'See your check-ins before you start',
    points: [
      'Check-in opens on the week’s list. Start with the first, or pick any.',
      'Each goal says its status and what it last said; one you started and closed says Draft kept.',
      'Start check-in on Home still goes straight into the first one.',
    ],
    articles: ['check-in'],
  },
  {
    id: 'check-in-asks',
    date: '2026-11-11',
    title: 'Faro asks about a number that looks wrong',
    points: [
      'Faro asks before it posts a number that looks wrong, such as ten times last week’s, and keeps your answer in the goal’s History.',
      'The same number as last week asks whether you measured it again.',
    ],
    articles: ['check-in'],
  },
  {
    id: 'field-table',
    date: '2026-11-11',
    title: 'What every column needs, in one place',
    points: [
      'Help has a table of every column: required or not, its format, an example.',
      'The template’s first sheet is the same table, and its example rows are never imported.',
      'Import says what a new goal, check-in and person must have before you choose a file.',
    ],
    articles: ['columns', 'import', 'export'],
  },
  {
    id: 'year-ends',
    date: '2026-11-11',
    title: 'A year ends on its last day',
    points: [
      'Results and the last quarter close by themselves on the day after the year’s last day, and nothing is due, late or out of date after the year has ended.',
      'Cycles gives each year’s real first and last day: 2026 runs from 29 Dec 2025 to 3 Jan 2027. It says when a year is ending, and when it ended.',
      'The place line at the top says “2026 · week 53, the last week”, then “2026 has ended”.',
    ],
    articles: ['wrap-up', 'workspace-cycles'],
  },
  {
    id: 'not-born-late',
    date: '2026-11-11',
    title: 'A new goal doesn’t start out late',
    points: [
      'A stage that’s already past asks whether it’s done, and a done one counts as on time.',
      'If your first number isn’t where the plan starts, you can start the plan from it.',
    ],
    articles: ['new-goal', 'check-in'],
  },
  {
    id: 'start-prepares',
    date: '2026-11-11',
    title: 'Starting next year doesn’t move anyone early',
    points: [
      'An admin can set next year up as soon as the wrap-up opens. Everyone stays in this year until its last day; next year opens on its first Monday.',
      'Before starting, you see what will carry on, finish and stop, in counts that add up to every goal. Afterwards Cycles offers Undo, until someone uses the new year.',
      'A goal that met its target finishes instead of carrying on.',
      'Once the next year has begun, last year’s wrap-up can still be finished until it closes, four weeks after the year’s last day. Home, Wrap up and Cycles show it.',
      'Before a year’s first week, Home says when it starts and that nothing is due until then.',
    ],
    articles: ['start-next-year', 'workspace-cycles', 'wrap-up'],
  },
  {
    id: 'cant-open-why',
    date: '2026-11-11',
    title: 'When you can’t open a workspace, it says why',
    points: [
      'If a workspace can’t open you, the page now says which it is: you aren’t signed in, no one there has your email, more than one person has it, or you’re marked as having left.',
      'Copy a message for them writes the note to send whoever set it up, and Try again looks once more once they’ve fixed it.',
      'Nothing of the workspace shows until you can open it.',
    ],
    articles: ['set-up'],
  },
  {
    id: 'goal-page-scorecard',
    date: '2026-11-10',
    title: 'A goal’s page, rebuilt',
    points: [
      'A goal’s page reads in one order on a computer and a phone: how it is, what’s being done and asked, why, then the chart. Links under the scorecard take you down the page.',
      'Under the status and number there’s a scorecard: against plan, against last week, what’s left to the target, and whether it will hit it, in words (Likely, Possible, Unlikely or Very unlikely), never a percentage.',
      'The chart marks the same numbers where they are: the gap to plan at now, where it will likely end, and how far that is from the target. The plan is a broad pale band and the actual a solid dark line, with an arrow saying which way is better.',
      'Every section says in one line what it answers, with a clear rule between sections. Path to green gives the owner’s date in words and whether the trend gets there.',
      'Scrolled down, the bar is one line on a solid panel: status, number, the gap to plan and the “…” menu. “Since you looked” only appears when something has changed.',
      'Check-ins, comments and changes are one stream, with a reason repeated week after week said once. Share image copies a picture of the goal with its link, and on paper a goal fits one A4 page.',
    ],
    articles: ['goal-page', 'status', 'print', 'watching'],
  },
  {
    id: 'goals-page-decisions',
    date: '2026-11-10',
    title: 'Goals: nothing behind is hidden, and one line for its health',
    points: [
      'Filter Goals to Needs attention and the goals being handled are listed below the others, never left out: filter to your team and you see every goal of theirs that is behind. The same in every layout, on the map and for the AI assistant. The tab’s count still counts the goals that need attention, and says so.',
      'A line above the goals says their health, as Home does: how many off track, at risk, on track and so on.',
      'The Board shows up to eight on-track goals before Show all, and each card says which goal it feeds into. History ends each row with the goal’s number now.',
      'Sorted, the Trees tab is one list across every tree. Cards has gone: List shows everything it did, and a link or saved view that opened Cards opens List and says so once.',
      'Being handled now takes a plan: an action with an owner and a date agreed since the latest check-in, or an answer to an at-risk goal’s request. A goal someone only marked reviewed still needs attention, and says who looked.',
      'On Home, each count of goals by status opens just those goals: “11 off track” lists the 11. By team lists the teams worst first.',
    ],
    articles: ['needs-attention', 'goals', 'goals-filters', 'history', 'home'],
  },
  {
    id: 'goal-next-steps-and-asks',
    date: '2026-11-10',
    title: 'Everything asked and agreed on a goal, in one list',
    points: [
      'Next steps and asks replaces Asked of you, What’s being done and Actions on a goal’s page, and an ask is no longer repeated around the page.',
      'If a goal is behind and nobody has said what happens next, its page says so, and its owner’s main button is Add a next step.',
      'Owners always have Check in again. Anyone else has Watch beside the main button.',
    ],
    articles: ['goal-page', 'requests'],
  },
  {
    id: 'goal-history',
    date: '2026-11-10',
    title: 'A goal’s history shows the weeks it missed',
    points: [
      'Activity on a goal is now History: every week is listed, with “No check-in” where there was none.',
      'Reviews and Changes are separate filters, with counts, and a filter can be linked to.',
      'Each week’s entry comes after everything said or changed that week, and an ask raised in a review stays under Reviews.',
    ],
    articles: ['goal-page'],
  },
  {
    id: 'map-at-scale',
    date: '2026-11-10',
    title: 'The map works at the size of a division',
    points: [
      'The map opens on every top goal, with only the critical path drawn beneath the ones in trouble. Fit all now fits: the trees wrap into rows, so all of them are in view at once.',
      'Find a goal on the map by its name or its key (G-48): its tree opens, the goal is outlined and the map moves to it.',
      'Each goal shows its number, its target and how far it is from plan. A goal others feed also shows the worst status of everything under it.',
      'Troubled trees only hides the trees where nothing is off track, at risk or without a recent update. The map fits itself again whenever what it shows changes.',
    ],
    articles: ['goal-map'],
  },
  {
    id: 'decide-in-review',
    date: '2026-11-10',
    title: 'Decide in the review',
    points: [
      'In a review, a goal off track or at risk asks “What happens next, who, by when?” before it’s marked reviewed: a next step with an owner and a date, or “We accept the risk” with a reason.',
      'A goal’s page shows its next steps with who and the date. Anyone can add one, and whoever agreed it can change it there. An overdue one is flagged.',
      'The next session opens with what the last one agreed, and asks if it’s done. Finish review says what was decided and who owns what, with Undo.',
      'A review’s walk keeps the order it started with, and Continue review picks up where you left off. Marking the goals with nothing flagged reviewed asks first, and no longer ends the review on its own.',
    ],
    articles: ['reviews', 'goal-page'],
  },
  {
    id: 'checkin-honest-edges',
    date: '2026-11-10',
    title: 'A check-in that’s honest at its edges',
    points: [
      'The check-in says which week it’s for from the first screen (“Week 46 check-in · 1 of 2”), and keeps your place after a reload.',
      'Behind needs a story, and Post alone no longer tells it: if last week’s reason and plan are still word for word the same, you change what’s different or tick Still true this week.',
      'One number check everywhere: the check-in, the one-table check-in and a spreadsheet refuse and question numbers the same way. A count can’t go below zero, and a count past its target is questioned.',
      'The one-table check-in posts the rows that are ready (and says which aren’t), lands on the same confirmation as the one-by-one check-in, and shares its draft with it.',
      'Home’s and a review’s rings say what they count: check-ins, or reviewed.',
    ],
    articles: ['check-in', 'check-in-table', 'goal-page', 'home'],
  },
  {
    id: 'people-place',
    date: '2026-11-10',
    title: 'People has its own place',
    points: [
      'People and Teams moved out of Workspace to People, in the sidebar (on a phone, under More), for everyone.',
      'Find someone by any word of their name, job title or team; the list is A to Z, 50 at a time.',
      'Open a person or a team to see who they are and how their goals stand, and go straight to their goals.',
      'A team can say what it is here to do. Old links still work.',
    ],
    articles: ['people', 'teams'],
  },
  {
    id: 'admins-on-access',
    date: '2026-11-10',
    title: 'Admins are managed where they are listed',
    points: [
      'Add or remove an admin on Workspace, Access, or from a person’s page. Removing one asks first, and both say what they did, with Undo.',
      'Settings is about you: who you are here and your page, your own choices, the MCP tokens that act as you, and leaving the workspace.',
      'Admins make MCP tokens on Access, or from a person’s page; Settings shows your own.',
      'Everyone can read Cycles and Privacy; only an admin changes them. Recently removed lists what you removed yourself, so you can restore it, and admins see everything.',
    ],
    articles: ['workspace-access', 'settings', 'workspace-cycles', 'removing'],
  },
  {
    id: 'getting-started',
    date: '2026-11-10',
    title: 'A first week that tells you what to do',
    points: [
      'After setting up a workspace, Home lists what’s left: first check-ins, goals to give an owner, and the link to send your team.',
      'Someone you add sees who set it up and what’s theirs to do.',
      'Set-up lets you leave a goal’s owner for later, and its step counter counts the path you chose.',
    ],
    articles: ['home', 'set-up'],
  },
  {
    id: 'feedback-leave-recording',
    date: '2026-11-10',
    title: 'Leaving a workspace, and recording you choose',
    points: [
      'Anyone can leave a workspace, handing over their goals first; the only admin can’t.',
      'Setting up a workspace asks whether to record how the app is used there: off unless you tick it. Turning it on later asks first.',
      'Resetting the example is for admins; the demo’s Start over is for everyone and only touches this browser.',
    ],
    articles: ['workspace', 'recording', 'set-up', 'demo'],
  },
  {
    id: 'home-screen-icon-and-splash',
    date: '2026-11-08',
    title: 'A clearer icon, a lighthouse, a new first page',
    points: [
      'Faro’s icon is now a deep-teal tile with the F in white and a bright amber beam and teal bar, so it stands out on your phone’s home screen and in the browser tab, on light and dark backgrounds.',
      'Faro can be added to your home screen like an app, and opens full screen. Help says how, for Android and iPhone.',
      'The first page of a new Faro says what it’s for: run the company on outcomes, and manage by exception. Its main button opens the demo; setting up your own workspace is just below.',
      'Each time you open Faro, the amber beam sweeps across the screen like a lighthouse’s light and settles into place in the F. It takes about two and a half seconds, the app loads behind it, and a tap or any key skips it. With reduced motion, the logo just fades in.',
    ],
    articles: ['any-device', 'settings', 'set-up'],
  },
  {
    id: 'spreadsheets-on-data',
    date: '2026-11-08',
    title: 'Spreadsheets have one home: Data',
    points: [
      'On Data, the Spreadsheets menu has every way in and out: the table as you’ve laid it out, everything as a workbook or zipped CSVs, a blank template, and Import.',
      'Import lives at Data too, and still shows every change before anything is saved. Old Import links take you there.',
      'Goals keeps one quiet button, Export these goals, for the goals on screen.',
      'Admins can switch parts of Faro on or off for a workspace, under Features on Workspace. Spreadsheets is the first; switching it off loses nothing.',
    ],
    articles: ['import', 'export', 'data', 'features'],
  },
  {
    id: 'numbers-and-names',
    date: '2026-11-08',
    title: 'Numbers kept as typed, and names told apart',
    points: [
      'A number is never rounded quietly. 12.5 in a goal of whole numbers is refused with what it would show as, in a check-in, a new goal, an edit, a spreadsheet and the AI assistant alike.',
      'Letters in a number get one message everywhere, every number has its thousands grouped (1,250), and a number far outside the plan, a negative time or a billion is questioned, not refused.',
      'Two goals can share a name: you’re told when you make one, and each shows its key beside the title wherever both could be on screen. Two people can share a name too: the email tells them apart, with their team or job title beside the name and different avatar colours.',
      'A team’s goal count no longer includes goals that were removed. When the AI assistant is refused, it says who its token acts as.',
    ],
    articles: ['check-in', 'new-goal', 'edit-goal', 'goals', 'people'],
  },
  {
    id: 'one-spreadsheet-format',
    date: '2026-11-07',
    title: 'One spreadsheet format, in and out',
    points: [
      'Export saves one workbook with every sheet (Goals, Plan, Check-ins, People, Results for year-end reporting, Asks and Notes) and a README for each column, or the same sheets as CSVs in a zip, or one table on its own. Whatever you export loads back on Import, and unedited it changes nothing.',
      'Import, set-up, Data and the AI assistant all read the same format: each sheet by its header row, goals by their key (so last cycle’s file still finds them), people by email. Every column you can change counts, line breaks are kept, and a word the app doesn’t know is a problem to fix, never a guess.',
      'An Action column in a spreadsheet stops a goal (with a reason), deletes one set up by mistake, or marks someone as left, with the same rules and preview as the app; Undo this import puts them back.',
      'Everyone now has an email, and someone new needs one. Admins see the people still without one on Workspace, and can add them in one go.',
      'A table saved from Data keeps each row’s key, ID or email at the end, in grey, whatever columns you hid, so it loads back.',
    ],
    articles: ['export', 'import', 'data', 'set-up', 'workspace'],
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
      'When a release fixes something you marked up, or feedback you sent with a mood and a few words, its entry here says “You raised this”.',
      'Workspace has an Inbox to read and triage markups and feedback, with the same statuses: New, In hand, Fixed and Won’t fix.',
    ],
    articles: ['feedback', 'inbox', 'ai-assistants', 'recording'],
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
      'Every ask is answered in the same Respond panel, on the goal and from Home, where they’re grouped by kind. Actions can be marked done, and show as overdue after their week instead of dropping off.',
      'Under the comment box, Ask as a question asks the goal’s owner instead of just commenting.',
      'Watching is part of Goals now, with its search, filters, sort, layouts and export, and what changed this week beside it. Home has one block for the goals you watch.',
      'The demo is one organisation of about 100 people, Platform Engineering, with Amara as its VP. Your changes to it are kept in this browser, and if the browser won’t keep them, the page says so.',
      'On a phone, each thing that needs your response is one short row with its button beside it, so your own goals still start on the first screen.',
    ],
    articles: ['requests', 'watching', 'home', 'goal-page', 'demo', 'reviews'],
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
    id: 'one-account',
    date: '2026-11-03',
    title: 'One short account when something changes',
    points: [
      'When a goal is off plan, the check-in asks for what changed, what happens next and by when, on one screen, starting from last week’s words.',
      'The owner’s date and the app’s projection are shown apart, so one is never read as the other.',
      'Something else is a cause you can describe in your own words.',
    ],
    articles: ['check-in', 'goal-page'],
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
export const newsAfter = (seenId: string | null): NewsEntry[] => entriesAfter(WHATS_NEW, seenId);

/** "5 Nov 2026", the way the app writes a date. */
export function newsDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m! - 1]} ${y}`;
}
