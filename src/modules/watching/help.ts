/* Watching's Help article (SW1). It was the core guide's; with Watching behind its switch it is the module's, so Help
   hides it while Watching is off and its address says Watching is switched off. src/help/guide.ts places it after
   Asks, where it always was. */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'watching',
    title: 'Watching goals',
    summary: 'Watch the goals you care about but don’t own, and see what changed in them without opening each one.',
    group: 'week',
    after: 'requests',
    sections: [
      { heading: 'What it’s for', text: ['Following other teams’ goals, or a whole level, the way a leader or a dependent team would.'] },
      { heading: 'How to use it', list: [
        'Watch a single goal from its page, a goal and everything feeding it, or a whole level (North star, SVP or Team). On a goal’s page, Watch first says what watching does: its check-ins, changes of status and new asks show on your Home and under Watching in Goals, your name is listed under Watched by, and Faro sends no email.',
        'Watching is part of Goals (Goals, then the Watching tab; the sidebar’s Watching goes there too), with the same search, filters, sort, layouts and export. In the list it groups them: what needs attention (a goal with no recent update included), then what has nothing flagged, with what changed this week beside them. What is being handled is folded away. To see one level, use the Level filter.',
        'For a goal with no recent update, ask its owner for an update. It’s an ask, open on their Home until they check in; whoever asked can withdraw it.',
        'Stop watching from the same place you started.',
        'Watching nothing yet, the page says what watching is for and offers Pick goals from the list; a whole level is offered only when it has ten goals or more. When every goal is yours or your team’s, it says so, with nothing to press.',
        'A tab or a menu row with nothing in it shows no number, rather than a 0.',
      ] },
      { heading: 'Who can', text: ['Anyone can watch any goal. A goal’s owner has no Watch: it is always on their Home.'] },
    ],
    routes: ['/watching'],
    screens: ['Watching'],
    reqs: ['WATCHING', 'ASK-UNDO', 'ONE-WATCHING', 'GOAL-SAYS', 'SMALL-QUIET'],
    keywords: ['follow', 'subscribe', 'watch', 'unwatch', 'ask for an update', 'quiet', 'no recent update'],
    related: ['needs-attention', 'goal-page', 'home'],
  },
];

export default help;
