# Agent skills

Copied from [anthropics/skills](https://github.com/anthropics/skills) at commit `ca45fc4`, so they load in every Claude Code session on this repo. Each skill keeps its own licence file (Apache 2.0).

Not included: `docx`, `pdf`, `pptx` and `xlsx`. Their licence doesn't allow copies outside Anthropic's services, and Claude already has them built in.

To update, copy the folders again from a newer commit of anthropics/skills.

## Open Design

The `open-design*` skills and the design recipes beside them (decks, posters, social cards, frames and more) come from [feimacode/open-design-agent-kit](https://github.com/feimacode/open-design-agent-kit) 0.3.0 (MIT; content Apache-2.0 from open-design), written by `npx @feimacode/open-design-agent-kit@0.3.0 init --tools claude`. The same command registered its MCP server in `.mcp.json`, pinned to 0.3.0, and added a browser-preview entry to `.claude/launch.json`. Re-run it with a newer version to update.
