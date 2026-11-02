/* Walkthroughs: a user journey you do yourself, with a coach beside you. Each step points at the thing to use and
   moves on when you've done it. They run in the demo, as the person the journey is about. */

export interface TourStep {
  /** What to do, in a sentence or two. */
  say: string;
  /** What to point at: a CSS selector, optionally narrowed to an element containing some text. */
  target?: { selector: string; text?: string };
  /** The step is done when the route matches, an element shows, or some text shows. None: a closing step with a Finish button. */
  doneWhen?: { route?: RegExp; selector?: string; text?: string };
  /** What to say and point at instead when the target isn't on screen (the demo has moved on: say, the check-ins are already in). */
  ifMissing?: { say: string; target?: { selector: string; text?: string } };
}
export interface Tour {
  id: string;
  title: string;
  /** Who it's about, and whose eyes it uses. */
  role: string;
  personId: string;
  start: string;
  steps: TourStep[];
}

export const TOURS: Tour[] = [
  {
    id: 'checkin', title: 'Post your weekly check-in', role: 'Goal owner', personId: 'maya', start: '/',
    steps: [
      { say: 'This is Maya’s Home. What she needs to do this week comes first. Start her check-in.', target: { selector: 'a.btn.primary', text: 'check-in' }, doneWhen: { route: /^\/check-in/ },
        ifMissing: { say: 'Maya’s check-ins are already in this week, so Home says she’s all set. You can still check in again whenever something changes: open Check-in.', target: { selector: 'a', text: 'Check-in' } } },
      { say: 'Type this week’s number. The verdict says at once whether it’s on plan, and against which week.', target: { selector: 'input[aria-label="This week’s value"], #value' }, doneWhen: { selector: '.verdict' },
        ifMissing: { say: 'This week is done, and every check-in is kept. Something changed? Pick one of Maya’s goals to check in again.', target: { selector: '.again-links a' } } },
      { say: 'Off plan, it asks why and how it gets back on track. Keep last week’s note if it still holds, or say what changed, then post.', target: { selector: '.focus-foot button[type=submit]' }, doneWhen: { text: 'Check-in saved' } },
      { say: 'Saved, and in the change log. Anyone watching the goal sees it, and the review picks it up. You can check in again any time; every check-in is kept.' },
    ],
  },
  {
    id: 'review', title: 'Run the weekly review', role: 'Leader', personId: 'elena', start: '/',
    steps: [
      { say: 'Elena leads the weekly review. Home tells her it’s on. Open it.', target: { selector: 'a.btn.primary', text: 'review' }, doneWhen: { route: /^\/reviews\/weekly/ } },
      { say: 'The review walks the goals worst first. Start it.', target: { selector: 'button.btn.primary', text: 'review' }, doneWhen: { route: /review=weekly/ } },
      { say: 'Each goal shows its story: why it’s off, the recovery plan, by when. Say something, or press Reviewed & next.', target: { selector: '.decide' }, doneWhen: { text: 'Goal 2 of' } },
      { say: 'That’s the rhythm: a minute a goal, worst first, and what was said is kept on each goal. Close the review at any point; it remembers where you were.' },
    ],
  },
  {
    id: 'quiet', title: 'Chase a goal that’s gone quiet', role: 'Goal owner', personId: 'maya', start: '/watching',
    steps: [
      { say: 'Watching gathers the goals Maya follows. Gone quiet means no check-in for two weeks, so its status can’t be trusted. Open that goal.', target: { selector: '.trow[data-tone="stale"]' }, doneWhen: { route: /^\/goals\/env/ } },
      { say: 'It says when it was last heard of. Ask its owner for an update.', target: { selector: 'button', text: 'Ask' }, doneWhen: { text: 'Asked' } },
      { say: 'Jonas sees the request on his Home. Nothing here goes quiet for long without someone noticing.' },
    ],
  },
  {
    id: 'map', title: 'Find what will sink the north star', role: 'Leader', personId: 'elena', start: '/goals',
    steps: [
      { say: 'Goals can be seen several ways. Open the map.', target: { selector: '[aria-label="Map"]' }, doneWhen: { selector: '.goalmap' } },
      { say: 'The bold red line is the critical path: the inputs most likely to make the north star miss. Open the goal it leads to.', target: { selector: '.map-node.critical' }, doneWhen: { selector: '.map-panel' } },
      { say: 'Its story is beside the map: why it’s off, the recovery plan, by when, and what decision is needed. Drag to move around; fold branches to focus.' },
    ],
  },
  {
    id: 'brief', title: 'Get the leader’s brief', role: 'Leader', personId: 'elena', start: '/goals',
    steps: [
      { say: 'Export the goals: for Excel, for other tools, or as a brief to read or paste into an AI chat.', target: { selector: 'button', text: 'Export' }, doneWhen: { text: 'Export goals' } },
      { say: 'Copy the brief, or save it. It leads with the decisions waiting on people, then each goal that’s off and its story.', target: { selector: 'button', text: 'Save .md' }, doneWhen: { text: 'Brief' } },
      { say: 'The same brief is what an AI assistant reads through the app’s MCP server.' },
    ],
  },
  {
    id: 'import', title: 'Load changes from a spreadsheet', role: 'Goal owner', personId: 'kofi', start: '/goals',
    steps: [
      { say: 'Goals, plan numbers and past weeks can come from a spreadsheet. Open Import.', target: { selector: 'a', text: 'Import' }, doneWhen: { route: /^\/import/ } },
      { say: 'Download the workbook, change it in Excel, then choose it here. Every change is shown before anything is saved, and checked with the app’s own rules.', target: { selector: '.steps-list' } },
    ],
  },
];

const KEY = 'goals-tour';
export interface TourState { id: string; step: number }
export function readTour(): TourState | null {
  try { const v = sessionStorage.getItem(KEY); return v ? (JSON.parse(v) as TourState) : null; } catch { return null; }
}
export function writeTour(t: TourState | null) {
  try { if (t) sessionStorage.setItem(KEY, JSON.stringify(t)); else sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('goals-tour'));
}
