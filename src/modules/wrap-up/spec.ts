/* The Wrap-up's rules for its switch (SW1), in plain words with worked examples, for its section of the spec
   (spec/modules/wrap-up/rules.md): what goes, what stays core, and the read-back before switching it off. The spec's
   generator reads it through the module registry (src/spec/rules.ts); every example runs against the rules. */
import type { Rule } from '../../spec/rules';
import { wrapUpAsks, wrapUpOffLines, wrapUpOffReadBack } from '../../domain/switchOff';

const goals = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }, { id: 'g4', stoppedAt: '2026-06-01' }, { id: 'g5', removedAt: '2026-06-01' }];
const retros = [{ goalId: 'g1', next: 'carry' as const }, { goalId: 'g2', next: 'stop' as const }, { goalId: 'g5', next: 'stop' as const }];

const rules: Rule[] = [
  {
    id: 'wrap-up-switch',
    title: 'The Wrap-up’s switch: what goes, what stays, and the read-back',
    summary: 'What the Wrap-up switched off takes away, what stays the core’s, and what switching it off reads back first.',
    code: [{ file: 'src/domain/switchOff.ts', names: ['wrapUpOffReadBack', 'wrapUpOffLines', 'wrapUpAsks'] }],
    tests: ['src/domain/switchOff.test.ts', 'src/mcp/switchedTools.test.ts'],
    reqs: ['WRAP-UP-OPTIONAL'],
    body: `
**Off.** Nobody is asked how a goal landed: Home has no wrap-up lead (an owner's lead in the year's last weeks is the check-ins, as in any other week) and no “See the wrap-up”; Goals has no Wrap up; Cycles has no “Open the wrap-up”; /retro and /retro/{goal} are Page not found with “Wrap-up is switched off in {workspace}. An admin can switch it on in Workspace, Features.”; get_wrap_up and wrap_up_goal answer the switched-off module's sentence, and saving a wrap-up refuses with “Wrap-up is off in {workspace}.”. **What stays the core's:** the year still ends on its last day, results are worked out as before, and an admin starts the next year from Cycles (start_next_cycle works either way). Wrap-ups already written stay in each goal's History.

**The read-back.** With a wrap-up written in the running year, or while the wrap-up is open, switching it off first says: “**The wrap-up leaves Home, Goals and Cycles.** Owners aren’t asked how their goals landed.” (while it is open, adding “{n} goals are not wrapped up yet and won’t be asked for.”, the goals not removed or stopped with no wrap-up); “**{n} wrap-ups already written stay** in each goal’s History.” (on goals not removed; left out at nought); “**{k} goals were marked “Stop” at their wrap-up**, and they stop when {next year} starts.” (left out at nought); “**The year still ends.** Results are worked out as before, and an admin starts {next year} from Cycles.”. Otherwise it acts at once.
`,
    examples: [
      { given: 'Week 52, the wrap-up open: 5 goals, one stopped, one removed; wrap-ups on g1 (carry on), g2 (stop) and the removed g5 (stop).', then: 'The wrap-up leaves Home, Goals and Cycles. Owners aren’t asked how their goals landed. 1 goal is not wrapped up yet and won’t be asked for. | 2 wrap-ups already written stay in each goal’s History. | 1 goal was marked “Stop” at its wrap-up, and it stops when 2027 starts. | The year still ends. Results are worked out as before, and an admin starts 2027 from Cycles.',
        run: () => wrapUpOffLines(wrapUpOffReadBack({ retros, goals, open: true, next: '2027' })).map((l) => l.strong + l.rest).join(' | ') },
      { given: 'Week 45, nothing written and the wrap-up not open: does switching off ask first?', then: 'no: it acts at once', run: () => (wrapUpAsks(wrapUpOffReadBack({ retros: [], goals, open: false, next: '2027' })) ? 'yes' : 'no: it acts at once') },
    ],
  },
];

export default rules;
