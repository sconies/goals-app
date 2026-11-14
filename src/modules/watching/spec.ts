/* Watching's rules for its switch (SW1), in plain words with worked examples, for its section of the spec
   (spec/modules/watching/rules.md): the read-back before switching it off, and what Goals' tabs are with it off. The
   spec's generator reads it through the module registry (src/spec/rules.ts); every example runs against the rules
   themselves. */
import type { Rule } from '../../spec/rules';
import { watchingOffLines, watchingOffReadBack } from '../../domain/switchOff';
import { scopesFor } from '../../domain/goalsPage';
import { writesWatches } from '../../domain/watchWrites';

const goals = [{ id: 'a', ownerId: 'rhea', teamId: 'ci' }, { id: 'b', ownerId: 'pat', teamId: 'ci' }, { id: 'c', ownerId: 'pat', teamId: 'vp' }];
const tabs = (viewerId: string, last: 'watching' | null, watching: boolean) => {
  const r = scopesFor({ goals, viewerId, teams: viewerId === 'rhea' ? [{ id: 'ci', name: 'CI/CD' }] : [], watched: new Set(['c']) }, last, { watching });
  return `${r.tabs.map((t) => `${t.label} ${t.ids.length}`).join(' · ')}; opens ${r.opens}`;
};

const rules: Rule[] = [
  {
    id: 'watching-switch',
    title: 'Watching’s switch: what goes, and the read-back',
    summary: 'What Watching switched off takes away, how Goals’ tabs and Home’s lead change, and what switching it off reads back first.',
    code: [
      { file: 'src/domain/watchWrites.ts', names: ['writesWatches'] },
      { file: 'src/domain/switchOff.ts', names: ['watchingOffReadBack', 'watchingOffLines', 'watchingAsks'] },
      { file: 'src/domain/goalsPage.ts', names: ['scopesFor'] },
      { file: 'src/domain/home.ts', names: ['homeLead'] },
    ],
    tests: ['src/domain/switchOff.test.ts', 'src/domain/goalsPage.test.ts', 'src/mcp/switchedTools.test.ts'],
    reqs: ['WATCHING-OPTIONAL'],
    body: `
**Off.** Goals has no Watching tab (a remembered Watching opens Mine for someone who owns a goal, else All); Home has no “Goals you watch”, and Getting started never asks anyone to watch goals; a goal's page has no Watch or Watching, no “Watched by”, and a comment reaches its owner only; the bulk bar has no Watch; /watching is Page not found with “Watching is switched off in {workspace}. An admin can switch it on in Workspace, Features.”; list_watching, watch and unwatch answer the switched-off module's sentence. **What is refused** (\`writesWatches\`, build review of #444) is not a list of actions but whatever writes a watch: a save that logs a change to a watch, stops one, or writes watches and nothing else, so Watch, Stop watching, Undo of a stopped watch and restoring one from Recently removed are refused alike, in the app with “Watching is off in {workspace}.” and through an AI tool (restore_removed too) with the switched-off sentence. What a save only carries along still runs: the watches that follow goals into the next year, or go and come back with a year's start and its undoing. Recently removed, and list_removed, leave stopped watches out. Starting the next year reads back no watches either. Someone who owns no goal and has nothing else asked of them is led to “{n} goals need attention · See them”, every goal not removed or stopped that needs attention. Nothing is deleted: every watch is kept, and switching Watching back on restores each person's.

**The read-back.** Before Watching goes off, for everyone here: “**Watching leaves Goals, Home and every goal’s page**: the Watching tab, “Goals you watch” and the Watch button.”; “**{n} people’s {m} watches are kept.** Nobody is shown as watching while it is off.”, counting the people here (not removed, not left) with a watch, and their watches; “**{k} people own no goal and see Home through what they watch.** Their Home will show every goal that needs attention instead.”, of those people the ones who own no goal not removed or stopped, left out at nought; “**Goals don’t change.** Each is still on its owner’s Home, in Goals and in its reviews.” (“and in its reviews” only while Reviews is on); and “Nothing is deleted. Switch Watching back on and each person watches what they did.”. With no watch at all it acts at once.
`,
    examples: [
      { given: 'Three people watch: A a level, B two goals, C one tree; C owns no goal (one of C’s goals was removed). D stopped their only watch.', then: '3 people’s 4 watches are kept. Nobody is shown as watching while it is off. | 1 person owns no goal and sees Home through what they watch. Their Home will show every goal that needs attention instead.',
        run: () => watchingOffLines(watchingOffReadBack({ people: ['a', 'b', 'c', 'd'].map((id) => ({ id })), watches: [{ personId: 'a' }, { personId: 'b' }, { personId: 'b' }, { personId: 'c' }, { personId: 'd', removedAt: '2026-11-01' }], goals: [{ ownerId: 'a' }, { ownerId: 'b' }, { ownerId: 'c', removedAt: '2026-10-01' }] }), true).slice(1, 3).map((l) => l.strong + l.rest).join(' | ') },
      { given: 'Goals’ tabs for Rhea, who owns a goal, last on Watching: Watching on, then off.', then: 'Mine 1 · My team 2 · Watching 1 · All 3; opens watching / Mine 1 · My team 2 · All 3; opens mine', run: () => `${tabs('rhea', 'watching', true)} / ${tabs('rhea', 'watching', false)}` },
      { given: 'The same for someone who owns no goal and is in no team.', then: 'Watching 1 · All 3; opens watching / All 3; opens all', run: () => `${tabs('nobody', 'watching', true)} / ${tabs('nobody', 'watching', false)}` },
      { given: 'With Watching off, four saves: Watch a goal; restore a stopped watch from Recently removed (it logs “Restored”); Undo of Stop watching (the watch alone); starting the next year, whose goal brings its watch along.', then: 'refused, refused, refused, saved',
        run: () => { const w = { id: 'w1', personId: 'p', kind: 'goal' as const, ref: 'g1' }; const log = { id: 'c', at: '', actorId: 'p', goalId: null, entity: 'watch' as const, entityId: 'w1', action: 'restored' as const, summary: '', diffs: [] }; return [writesWatches({ watches: [w], changes: [] }), writesWatches({ watches: [w], changes: [log] }), writesWatches({ watches: [{ ...w, removedAt: null }], changes: [] }), writesWatches({ goals: [{ id: 'g1-2' } as never], watches: [{ ...w, ref: 'g1-2' }], changes: [] })].map((r) => (r ? 'refused' : 'saved')).join(', '); } },
    ],
  },
];

export default rules;
