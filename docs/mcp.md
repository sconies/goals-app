# Connecting an AI assistant (MCP)

The app has an MCP server at `/api/mcp`. An assistant such as Claude can use it to do anything the person can do in the app: read every screen, check in, change goals and plans, answer requests, take part in reviews, watch goals, manage people, wrap up the cycle, and more.

## How it works

- **Who it acts as.** An admin makes a personal token for one person under Workspace → AI assistants. The assistant then acts as that person, with exactly their rights. For example:
  - owners change their own goals; admins can change any goal; anyone can comment;
  - only the person asked (or an admin) answers a request;
  - only admins add people, pin views, make tokens, start the next cycle or delete the workspace.
- **The same rules as the app.** The app and the server call the same code:
  - check-ins, goals and plans go through the bulk-change engine, the same as spreadsheet import;
  - everything else goes through the shared actions in `src/domain/actions.ts`, which say who may do what.

  So a number behind plan still needs a cause and a reason, and a plan change after check-ins have started still needs a reason.
- **Parity is checked.** `src/mcp/parity.ts` maps every action in the app, and every screen, to its tools. A test fails if a new action or screen has no tools, or no reason why an assistant doesn't need any.
- **Not for assistants.** A token belongs to one workspace, so an assistant can't create, switch or reset a workspace, or choose who it is. Those stay in the app.
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

**Reading**

| Tool | What it does |
|---|---|
| `get_overview` | A brief of the cycle: what needs attention and why, every goal by what it feeds, open questions, weekly numbers |
| `get_my_work` | What needs the person this week, as their Home shows it: check-ins due, goals needing attention, requests waiting on them, questions and asks for an update on their goals, their actions, their reviews |
| `find_goals` | Goals with status, latest number, plan, target and gap. Filter by name, owner, status, level or your own. Or pass `query`, a Goals link's query string (for example `status=off,risk&needs=decision&sort=gap`), or `view`, the name of a saved view |
| `get_goal` | One goal in full: plan by week, every check-in with reasons, notes and actions |
| `list_requests` | Requests for a decision or help: open, answered or withdrawn; yours to answer; one goal's |
| `list_reviews` / `get_review` | Every review, and one review's current agenda: goals to discuss with why, healthy ones, and what's been said |
| `list_watching` | Your watches and the goals they cover |
| `list_people` | People with job titles, teams and admins; the teams |
| `get_activity` | The change log, filtered like the Activity page (for example `who=maya&kind=checkins&when=this-week`) |
| `list_views` | Your saved views and the pinned ones |
| `list_tokens` | AI assistant tokens: all for an admin, otherwise your own |
| `list_feedback` | Admins: feedback about the app |
| `get_wrap_up` | At the end of a cycle: which goals are wrapped up, and how |
| `export` | JSON, the brief, or CSV |

**Doing**

| Tool | What it does |
|---|---|
| `post_check_in` | Post a week's number or stages, this week or an earlier week. Posting again for a week corrects it |
| `create_goal` / `update_goal` | Add or change a goal |
| `set_plan_numbers` | Set planned values for particular weeks |
| `bulk_change` | Many goals, plan numbers and check-ins at once, using the export's columns. It checks first and saves only with `apply: true` |
| `add_comment` | Comment on a goal |
| `ask_for_update` / `undo_update_ask` | Ask a goal's owner for an update, or take the ask back |
| `answer_request` / `link_request` / `withdraw_request` | Answer a request; say a goal waits on another goal's request; withdraw one |
| `review_call` / `edit_call` | In a review: mark a goal reviewed, add a note, ask the owner, agree an action; correct what was said |
| `save_review` | Set up a review, or change one |
| `watch` / `unwatch` | Watch a goal, a goal and what feeds it, or a level; stop |
| `save_person` | Admins: add someone, or change their name, job title, team or admin rights |
| `wrap_up_goal` / `start_next_cycle` | Wrap up a goal at the end of the cycle; admins start the next cycle (needs `confirm: true`) |
| `save_view` / `delete_view` / `pin_view` | Save, change or delete a view of the goals; admins pin one for everyone |
| `create_token` / `revoke_token` | Admins make a token (shown once); an admin or the token's person revokes it |
| `send_feedback` | Feedback about the app |
| `delete_workspace` | Admins: delete the workspace. Needs its exact name, and can't be undone |

Goal, plan and check-in tools take `dry_run: true` to check a change without saving it. Destructive tools are marked as such, so assistants ask before using them.

## Hosting and security

- **Hosting.** The server is a Vercel function. `server/vercel.ts` is bundled into `api/mcp.js` by `npm run build:mcp`, and CI checks that the bundle matches its source.
- **Database key.** It reads and writes Supabase with `SUPABASE_SERVICE_ROLE_KEY` when that is set, otherwise with the app's public key.
- **Until company sign-in arrives**, the app's public key can still write to every table. A token makes clear who an assistant acts for and can be switched off, but it doesn't stop someone with the public key. The next step is sign-in, then making the public key read-only, so that all writes go through the server.
- **Vercel's deployment protection** must let `/api/mcp` through (for example, a custom domain, or protection for previews only), or assistants will get Vercel's sign-in page instead of the server.
