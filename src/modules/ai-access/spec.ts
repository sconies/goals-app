/* AI access's rules for its switch (SW2), in plain words with worked examples, for its section of the spec
   (spec/modules/ai-access/rules.md): the server's door, what is refused, and the read-backs both ways. The spec's
   generator reads it through the module registry (src/spec/rules.ts); every example runs against the rules themselves. */
import type { Rule } from '../../spec/rules';
import { aiAccessAsks, aiAccessOffLines, aiAccessOnLines, aiAccessReadBack } from '../../domain/switchOff';

const people = [{ id: 'a', name: 'Amara Nwosu' }, { id: 'r', name: 'Rhea Kapoor' }, { id: 'h', name: 'Hamid Rezaei', leftAt: '2026-11-01' }];
const tokens = [
  { id: '1', personId: 'a', name: 'Claude on my laptop', createdAt: '2026-11-01' },
  { id: '2', personId: 'r', name: 'Claude', createdAt: '2026-11-03' },
  { id: '3', personId: 'a', name: 'Old', createdAt: '2026-10-01', revokedAt: '2026-10-02' },
  { id: '4', personId: 'h', name: 'Weekly brief', createdAt: '2026-11-04' },
];
const changes = [{ diffs: [{ field: 'Via', to: 'MCP' }] }, { diffs: [{ field: 'Via', to: 'Spreadsheet' }] }];
const text = (ls: { strong: string; rest: string }[]) => ls.map((l) => l.strong + l.rest).join(' | ');

const rules: Rule[] = [
  {
    id: 'ai-access-switch',
    title: 'AI access’s switch: the door, and the read-backs',
    summary: 'What AI access switched off shuts (every token of the workspace, at the MCP server), what still works, and what switching it off and back on names first.',
    code: [
      { file: 'src/domain/switchOff.ts', names: ['aiAccessReadBack', 'aiAccessOffLines', 'aiAccessOnLines', 'aiAccessAsks', 'tokenNames'] },
      { file: 'server/mcp.ts', names: ['serve', 'throughDoor'] },
      { file: 'src/app/reads.ts', names: ['aiAccessOn', 'aiAccessShutWords', 'aiAccessLastWords'] },
    ],
    tests: ['src/domain/switchOff.test.ts', 'src/mcp/aiAccessDoor.test.ts'],
    reqs: ['AI-ACCESS-OPTIONAL'],
    body: `
**Off.** The MCP server, which loads the token's workspace and what is switched off there for every request, answers every request but \`initialize\` and \`tools/list\` with the error “AI access is switched off in {workspace}. An admin can switch it on in Faro, under Workspace, Features.” (code -32001), each message of a batch on its own; \`tools/list\` lists the tools as ever, so a connected tool learns why each call refuses rather than finding an empty server; notifications pass, as they have no answer; a markup's picture is refused with the same sentence. A refused request doesn't move the token's \`lastUsedAt\`. In the app, making a token is refused with “AI access is off in {workspace}.”; revoking one never is, so a token can be ended for good while it is off. Workspace has no AI access section (its address is Page not found, saying AI access is switched off), Settings no “Your MCP tokens”, a person's page no Make an MCP token. Nothing is deleted: tokens are kept, not revoked, and work again once it is back on. \`set_feature\` switching AI access off succeeds and is the last thing that token does: it answers “AI access is off in {workspace}. This connection stops working now. An admin switches it back on in Faro.” A build without the module keeps the server open: the core’s tools answer through it (MCP-PARITY is the core’s) and only the token tools, which are the module’s, are missing; only a workspace’s switch shuts the door.

**The read-backs.** \`aiAccessReadBack\` names the tokens not revoked whose person is still here (not removed, not left), newest first, and counts the changes in the log made through MCP. Off, for everyone here: “**{n} tokens stop working at once**: {the first five as Person’s “name”, then “and {k} more”}.”; “**They are kept, not revoked.** Switch AI access back on and they work again. To end one for good, revoke it first.”; “**What AI tools already changed stays**, marked “via MCP” in Activity: {m} changes.”; “**An AI tool can’t switch this back on.** An admin does, here.” Back on, only when tokens were kept: “**{n} tokens made before will work again at once**: {…}.”, that each acts as its person with their rights, logged as theirs via MCP, and “To stop one for good, revoke it first.” Each offers See the tokens, the list with Revoke. With no token, either way, it acts at once. Features' third line is “{n} tokens are in use.” (“1 token is in use.”), nothing with none.
`,
    examples: [
      { given: 'Amara and Rhea each have a live token (Rhea’s newer); Amara revoked an old one; Hamid, who left, still has one. One change came through MCP, one from a spreadsheet. Switching AI access off.', then: '2 tokens stop working at once: Rhea Kapoor’s “Claude” and Amara Nwosu’s “Claude on my laptop”. | They are kept, not revoked. Switch AI access back on and they work again. To end one for good, revoke it first. | What AI tools already changed stays, marked “via MCP” in Activity: 1 change. | An AI tool can’t switch this back on. An admin does, here.',
        run: () => text(aiAccessOffLines(aiAccessReadBack({ people, tokens, changes }))) },
      { given: 'The same, switching it back on: the first line.', then: '2 tokens made before will work again at once: Rhea Kapoor’s “Claude” and Amara Nwosu’s “Claude on my laptop”.',
        run: () => text(aiAccessOnLines(aiAccessReadBack({ people, tokens, changes })).slice(0, 1)) },
      { given: 'Whether it asks first: with those tokens; with only the revoked one and Hamid’s.', then: 'asks, acts at once',
        run: () => [tokens, tokens.filter((t) => t.id === '3' || t.id === '4')].map((ts) => (aiAccessAsks(aiAccessReadBack({ people, tokens: ts, changes })) ? 'asks' : 'acts at once')).join(', ') },
    ],
  },
];

export default rules;
