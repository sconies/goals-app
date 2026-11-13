/* The Wrap-up's Help article (SW1). It was the core guide's; with the Wrap-up behind its switch it is the module's,
   so Help hides it while the Wrap-up is off. Starting the next year is the core's article (start-next-year), which
   stays: results, carrying on and the next year never switch off. src/help/guide.ts places it after Activity. */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'wrap-up',
    title: 'Wrapping up the year, and the next one',
    summary: 'In the last two weeks of the year, owners wrap up each goal; then an admin starts the next year.',
    group: 'leading',
    after: 'activity',
    sections: [
      { heading: 'How to use it', list: [
        'A year ends on its last day, the Sunday of its last week, whether or not anyone starts the next. From the day after, nothing in it is due, late or out of date: each goal keeps the last status its owner gave, its result is worked out, and its last quarter closes on the numbers there are.',
        'The wrap-up opens on the Monday of the year’s last two weeks and stays open for four weeks after the year ends, so the last check-ins and the wrap-up can still be done. It stays open once the next year has begun: Home, Wrap up and Cycles show last year’s until it closes.',
        'Home offers the wrap-up when it opens. For each goal: how it landed (suggested from where it ended), one thing learned, and carry on or stop. About a minute each.',
        'Wrap up shows everyone which goals are wrapped up, and how.',
        'An admin starts the next year from its own page, after a read-back of what carries on, finishes and stops (see Starting the next year). A goal that met its target finishes; one its owner stopped stops; the rest carry on from where they ended: number goals from their last number, milestones with what is left. Links to goals that don’t carry on are dropped. Nobody moves into next year until this one’s last day.',
      ] },
      { heading: 'Who can', list: ['A goal’s owner, or an admin, wraps it up.', 'Only admins start the next year.'] },
    ],
    routes: ['/retro', '/retro/:goalId'],
    screens: ['Retro'],
    reqs: ['RETRO', 'YEAR', 'RESULTS'],
    keywords: ['retro', 'retrospective', 'end of year', 'year end', 'year ended', 'last day', 'cycle', 'next year', 'carry on', 'stop', 'learned', 'close'],
    related: ['history', 'workspace', 'start-next-year'],
  },
];

export default help;
