/* The Goal map's Help article (SW1). It was the core guide's; with the Goal map behind its switch it is the
   module's, so Help hides it while the Goal map is off. src/help/guide.ts places it after History, where it always was. */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'goal-map',
    title: 'The goal map',
    summary: 'The map draws every goal and how they connect, so you can see what feeds what and where the risk runs.',
    group: 'goals',
    after: 'history',
    sections: [
      { heading: 'How to use it', list: [
        'Choose Map from Layout on Goals (in View on a phone). North stars are at the top; solid lines mean feeds into, dotted lines mean also helps.',
        'Choose Map and the goals appear as soon as it is drawn; only a wait you would notice (over about a third of a second) says “Drawing the map…”.',
        'It opens on every top goal, with only the critical path, the inputs most likely to make a top goal miss, drawn bold beneath them. The number on a goal’s fold button says how many goals feeding it are hidden: press it to show them, or the minus to hide them. Unfold all shows every goal; Fold to the top goes back.',
        'Each goal shows its status, its number, its target and how far it is from plan. A goal others feed also says what’s under it: the worst status of everything feeding it, at any depth, and how many are behind, counted the way the List’s tree cards count.',
        'On the Map, the search at the top of Goals finds a goal and takes you to it: type its name or its key (G-48), then choose it from the list under the field. Its tree opens, the goal is outlined and the map moves to it, without hiding any other goal; press Enter on the goal to read its story. Press Enter in the field without choosing, and the map shows only the goals that match, as the other layouts do.',
        'Group and Sort can’t be changed on the Map, which is always the trees.',
        'Fit all shows every goal on the map at once, the trees wrapped into rows; Readable shows the top goals and the critical path at a size you can read. The map fits itself again whenever what it shows changes: a search, a filter or the trees in trouble.',
        'Troubled trees only keeps the trees whose top goal or anything under it is off track, at risk or without a recent update. The Needs attention switch in the bar above narrows the map to those goals and what they feed, every branch unfolded.',
        'Pan, zoom and drag goals about. The map never removes a goal: Delete and Backspace do nothing on it. Goals are removed from their own page, with Undo. Tidy up puts dragged goals back.',
        'Select a goal to read its story beside the map, then Open the goal. On a phone the map is a list, one goal per row.',
        'The map’s walkthrough ends beside the story: on a desktop its card sits over the map, left of the story and level with its foot; on a phone, above the story.',
      ] },
    ],
    routes: ['/goals?view=map'],
    screens: ['GoalMap'],
    reqs: ['GOAL-MAP'],
    keywords: ['map', 'canvas', 'tree', 'critical path', 'also helps', 'feeds into', 'dependencies', 'graph', 'find', 'key', 'fit all', 'troubled', 'roll-up', 'worst status'],
    related: ['goals', 'goal-page'],
  },
];

export default help;
