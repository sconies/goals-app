# Connecting an AI assistant (MCP)

The app has an MCP server at `/api/mcp`. An assistant such as Claude can use it to read the goals and post check-ins or changes.

## How it works

- **Who it acts as.** An admin makes a personal token for one person under Workspace → AI assistants. The assistant then acts as that person, with the same rights:
  - owners change their own goals;
  - admins can change any goal;
  - anyone can comment.
- **The same rules as the app.** Every write goes through the same engine as spreadsheet import:
  - a number behind or ahead of plan needs a cause and a reason;
  - a goal at risk or off track needs a path to green;
  - a plan change after check-ins have started needs a reason.
- **Logged.** Each change is logged as that person, marked "via AI assistant (MCP)".
- **Tokens.** A token is shown once. Only its SHA-256 hash is stored, and it can be revoked at any time.

## Connecting

Claude Code:

```sh
claude mcp add --transport http goals https://<app>/api/mcp --header "Authorization: Bearer gk_…"
```

Other assistants:

- use the server URL `https://<app>/api/mcp` with the header `Authorization: Bearer gk_…`;
- an assistant that only takes a web address can use `https://<app>/api/mcp?token=gk_…`. Keep that address private.

## Tools

| Tool | What it does |
|---|---|
| `get_overview` | A brief of the cycle: what needs attention and why, every goal by what it feeds, open questions, weekly numbers |
| `find_goals` | Goals with status, latest number, plan, target and gap. Filter by name, owner, status, level or your own. Or pass `query`, the query string of a Goals link (every filter and sort the Goals screen has, for example `status=off,risk&needs=decision&sort=gap`), or `view`, the name of a saved view you can see |
| `get_goal` | One goal in full: plan by week, every check-in with reasons, notes and actions |
| `post_check_in` | Post a week's number or stages, this week or an earlier week (marked as loaded later) |
| `update_goal` / `create_goal` | Change or add a goal |
| `set_plan_numbers` | Set planned values for particular weeks |
| `add_comment` | Comment on a goal |
| `bulk_change` | Many goals, plan numbers and check-ins at once, using the export's columns. Checks first; saves only with `apply: true` |
| `export` | JSON, the brief, or CSV |

The write tools take `dry_run: true` to check a change without saving it.

## Hosting and security

- **Hosting.** The server is a Vercel function. `server/vercel.ts` is bundled into `api/mcp.js` by `npm run build:mcp`, and CI checks that the bundle matches its source.
- **Database key.** It reads and writes Supabase with `SUPABASE_SERVICE_ROLE_KEY` when that is set, otherwise with the app's public key.
- **Until company sign-in arrives**, the app's public key can still write to every table. A token makes clear who an assistant acts for and can be switched off, but it doesn't stop someone with the public key. The next step is sign-in, then making the public key read-only, so that all writes go through the server.
- **Vercel's deployment protection** must let `/api/mcp` through (for example, a custom domain, or protection for previews only), or assistants will get Vercel's sign-in page instead of the server.
