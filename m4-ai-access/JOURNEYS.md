# AI access journeys

Run: `node modules/ai-access/journeys.mjs` (both widths; exits 1 on any failed check). Last run: 6 of 6 runs pass. Also run by `exit.test.mjs` criterion 2.

| Journey | Tally | What is built | What is not |
|---|---|---|---|
| U22 MCP access | PART | /workspace/ai says what a token is; Make a token; Who it acts as … Change, find Mateo, pick; Make the token disabled until What it’s for is filled; the token (gk_ + 40) shown once with a Claude Code command holding /api/mcp; Done; not used yet; Revoke …; Revoked; the token refused after (401). Stored as its hash only (exit test 1). | The builder token “Inbox on my phone” labelled apart: the label is drawn for a token with `builder: true`, but the demo has no way to seed one (the journey sets it in the browser's own store). The set-up via `localStorage`/`window.__goalsStore` doesn't exist in a server rebuild; the token is checked through the server instead. Checkpoints `one-action`/`a11y` are not scored. |
| U62 Settings is about you | PART | `.ai-block` with “Your MCP tokens”, your own tokens with Revoke, no Make button; Workspace has no Leave. | Your page link, the one recording line leading to Privacy, Leave this workspace… with who takes over, the only admin told why not: core Settings, not built in stage 3. |
| U175 switching AI access off | PART | Its own section with its intro; the switch on Features in view without scrolling, under Beyond this workspace; with no token it acts at once (“AI access is off in”); Access names the admins only; Workspace's menu loses AI access; /workspace/ai is Page not found saying it is switched off; Settings has no “Your MCP tokens”; the switch is logged; back on, the section is back after Access and Settings has “Your MCP tokens”. | The inbox's Connect Claude saying it is switched off: Feedback's inbox (stage 5) isn't built. |

Tally: DONE 0, PART 3, NOT BUILT 0.
