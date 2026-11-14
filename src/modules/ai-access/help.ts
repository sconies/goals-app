/* AI access's Help article (SW2): its Workspace section, what switching it off does, and who can. Help hides it while
   AI access is off, and its address says AI access is switched off. How to connect an AI tool stays the core's article,
   MCP access (ai-assistants). */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'ai',
    title: 'AI access',
    summary: 'The MCP tokens that let Claude or another AI tool act as someone here, and the switch that turns them all off.',
    group: 'you',
    after: 'workspace-access',
    sections: [
      { heading: 'What it’s for', text: ['Letting an AI tool read and act in this workspace as one person, with that person’s rights. Faro has no AI built in: this is the door other AI tools use.'] },
      { heading: 'How to use it', list: [
        'Workspace, AI access lists every MCP token, newest first: what it’s for, whom it acts as, when it was made and last used, and Revoke. Make a token is the section’s one action; the token is shown once.',
        'Every change an AI tool makes is logged as its person’s, marked “via MCP” in Activity.',
        'AI access can be switched off for the whole workspace, on Workspace, Features. Before it goes off, Faro names the tokens that stop working at once and counts what AI tools already changed (that stays). The tokens are kept, not revoked: switch AI access back on and they work again, after Faro names them. To end one for good, revoke it first; See the tokens, in the same message, lists them with Revoke.',
        'While it is off, an AI tool that calls Faro is told “AI access is switched off in” the workspace, and that an admin can switch it on. It still sees the list of tools. No token can be made, and Workspace, Settings and People show no tokens.',
        'An AI tool can switch AI access off (as its admin), but never back on: that is the last thing its token does.',
      ] },
      { heading: 'Who can', text: ['Admins make tokens, revoke any, and switch AI access. Anyone revokes their own in Settings.'] },
    ],
    routes: ['/workspace/ai'],
    screens: [],
    reqs: ['MCP-TOKENS', 'AI-ACCESS-OPTIONAL'],
    keywords: ['ai access', 'mcp token', 'token', 'integrations', 'api access', 'bots', 'key', 'revoke', 'switch off ai'],
    related: ['ai-assistants', 'workspace-access', 'features'],
  },
];

export default help;
