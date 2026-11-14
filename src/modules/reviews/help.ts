/* Reviews' Help article (FT2). It was the core guide's; with Reviews behind its switch it is the module's, so Help
   hides it while Reviews is off and its address says Reviews is switched off. src/help/guide.ts places it after
   Changing a goal, at the head of "Reviews and the year", where it always was. */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'reviews',
    title: 'Reviews',
    summary: 'A review walks a set of goals together on a cadence, worst and stalest first, and keeps what was said.',
    group: 'leading',
    after: 'edit-goal',
    sections: [
      { heading: 'What it’s for', text: ['A regular look at the goals that need it, with notes, questions and actions that stick to the goal.'] },
      { heading: 'Setting one up', list: [
        'Choose Set up a review on Reviews. Give it a name and a cadence: every 1, 2 or 4 weeks, on a weekday.',
        'Pick the goals: every goal at a level, a goal and everything feeding it, or single goals, found by typing their name or key. Then the people taking part, found by typing a name or a team (you and your team are suggested).',
      ] },
      { heading: 'Running it', list: [
        'Reviews says where each session stands (not started, in progress with how many reviewed, or held, with the date), when it was last held, and how many actions are open. A session under way is listed first. A session not held by its date is outstanding: it says “Outstanding from” its date and how many days past, with the next session beside it, so the two are never mixed up. The review’s page and the bar you walk it with say the same.',
        'Walking a review, the bar names the goal you’re on among the goals to discuss, and how many of the whole review are reviewed (the goals with nothing flagged count too). The order is fixed when the session starts: reviewing a goal or saving an action never moves one, Continue review picks up at the goal you left, and Previous goal goes back to ones already reviewed. Opening a goal’s walk from its own address keeps the same order.',
        'Open a review to see its agenda: one line per goal, the ones to discuss first: its status, its name, its number and the gap to plan. The name always has the room; a long gap wraps beside it instead. Goals on track with nothing flagged are marked reviewed together at the end, or walked one at a time instead. Marking them asks first, and the message after it has Undo. While goals to discuss are left, the review carries on; when they’re all that’s left, Finish review marks them and records the session as held.',
        'The walk opens each goal’s page in turn, under a bar with the review’s name (in full, on two lines if it needs them) and how far through you are. Mark it reviewed, add a note, ask the owner a question, or agree an action with who and when. Reviewed & next moves on.',
        'A goal off track or at risk asks first: “What happens next, who, by when?” Add the next step (what, who and the week it’s due by; type to find the person: you and your team are suggested first), or choose We accept the risk and say why. Only then can it be marked reviewed. Skip for now leaves it for later in the session.',
        'A session opens with Last time: what the previous session agreed, who agreed to do it, by when, and whether it’s done. Whoever does it, whoever agreed it, or an admin can mark it done there. Each goal in the walk shows its own. Goals proposed in it are listed after: “Proposed: … Tunde hasn’t made it active yet.”, or the day they did.',
        'A new goal the room agrees on: choose Propose a new goal in the walk. Give it a name, who will own it and what it will feed. It is saved as proposed, and its owner sets it up and makes it active.',
        'Finish review says what was decided (each person’s next steps, the risks accepted, the questions still open) before it records the session as held, and its message has Undo. The walk’s last goal finishes the same way.',
        'Once the session is held, the review’s page leads with what was said, with every goal reviewed. Owners see questions and actions on their goal page and Home. Print or save as PDF makes a copy of the session.',
      ] },
      { heading: 'Before this review', list: [
        'At the top of a review’s page: how many of its goals were checked in before it, and how many of those without being asked (an ask for an update is the only nudge). Before the review’s day it says how many are in so far.',
        'Under it, “came in after an ask” and “have no check-in yet” each open exactly those goals on Goals, worst first. Then the last 8 weeks, one square each: All in, how many came after, None in, or Nothing due.',
        'It is headed “Before this review” only in a week the review is held on the day check-ins are due. A review held on another day, or a fortnightly, monthly or quarterly one in a week it isn’t held, shows the week and its due date instead (“Week 46, due by Thursday 12 Nov”) and counts check-ins on time.',
        'It counts weeks and goals, never people: nobody is named in it, and a set of goals with fewer than three owners doesn’t show it.',
      ] },
      { heading: 'Ending one', list: [
        'End this review, at the foot of its page: it stops showing as due and keeps its notes and actions on each goal and in exports. Its page says Ended, with Reopen. A review that was never held is deleted instead.',
        'A note said in a review can be removed by whoever said it, or an admin; the goal’s activity then says “Note removed” in its place. A corrected note says edited.',
      ] },
      { heading: 'Who can', text: ['Anyone can set up a review, and everyone can read every review. Only people in a review, or an admin, speak for it: mark goals reviewed, add a note, accept a risk, and ask a question or agree a next step in it, and only about the goals it covers. Anyone can still ask a question or agree a next step on a goal’s own page. Someone not in a review is told who can add them: someone in it, whoever set it up, or an admin, who can change it. Whoever set it up, or an admin, can end it. Whoever said something, or an admin, can correct it.'] },
    ],
    routes: ['/reviews', '/reviews/new', '/reviews/:reviewId', '/reviews/:reviewId/edit', '/reviews/:reviewId/summary', '/reviews/:reviewId/print', '/review', '/goals/:goalId?review=*'],
    screens: ['Review', 'Inspect'],
    reqs: ['REVIEW', 'REVIEW-SETUP', 'REVIEW-RUN', 'REVIEW-DECIDE', 'INSPECT-ACT', 'REVIEW-LIST-STATE', 'REVIEW-AGENDA', 'EXCEPTIONS-FIRST', 'REVIEW-SPEAK'],
    keywords: ['review', 'meeting', 'agenda', 'walk', 'notes', 'questions', 'actions', 'summary', 'cadence', 'weekly review', 'before this review', 'checked in before', 'last 8 weeks', 'without being asked'],
    related: ['needs-attention', 'goal-page', 'print', 'requests'],
  },
];

export default help;
