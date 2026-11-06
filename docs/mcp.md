# Connecting an AI assistant (MCP)

Faro has an MCP server at `/api/mcp` (it introduces itself as Faro; its id stays `goals`). An assistant such as Claude can use it to do anything the person can do in the app: read every screen, check in, change goals and plans, answer asks, take part in reviews, watch goals, manage people, wrap up the cycle, and more.

## How it works

- **Who it acts as.** An admin makes a personal token for one person under Workspace → AI assistants (each person sees and revokes their own under Settings). The assistant then acts as that person, with exactly their rights. For example:
  - owners change their own goals; admins can change any goal; anyone can comment;
  - only the person asked (or an admin) answers an ask, and only whoever does an action, whoever agreed it, or an admin marks it done;
  - only admins add people, change teams, pin views, make tokens, start the next cycle, or rename or delete the workspace.
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
| `get_my_work` | What needs the person this week, as their Home shows it: check-ins due, goals needing attention, and every open ask waiting on them by kind (decisions or help, questions, asks for an update, actions, overdue ones marked), their reviews |
| `find_goals` | Goals with status, latest number, plan, target and gap. Filter by name, owner, status, level or your own. Or pass `query`, a Goals link's query string (for example `status=off,risk&needs=decision&sort=gap`), or `view`, the name of a saved view |
| `get_goal` | One goal in full: plan by week, every check-in with reasons, notes and actions |
| `list_requests` | Every ask (one way to ask): a decision or help, an update, a question or an action; open, answered, done or withdrawn; by kind; yours to answer; one goal's |
| `list_reviews` / `get_review` | Every review, and one review's current agenda: goals to discuss with why, healthy ones, and what's been said |
| `list_watching` | Your watches and the goals they cover |
| `list_people` | People with job titles, teams and admins; the teams, with how many people and goals each has |
| `get_activity` | The change log, filtered like the Activity page (for example `who=maya&kind=checkins&when=this-week`) |
| `list_views` | Your saved views and the pinned ones |
| `list_tokens` | AI assistant tokens: all for an admin, otherwise your own |
| `list_feedback` | Admins: feedback about the app |
| `get_wrap_up` | At the end of a cycle: which goals are wrapped up, and how |
| `export` | JSON, the brief, or CSV |
| `get_help` | The app's own guide, as its Help pages show it: an article by `id` (for example `check-in`), a `search`, or every article |
| `whats_new` | The app's release notes, newest first; `since` a date (yyyy-mm-dd) |

**Doing**

| Tool | What it does |
|---|---|
| `post_check_in` | Post a week's number or stages, this week or an earlier week. Posting again for a week corrects it |
| `create_goal` / `update_goal` | Add or change a goal |
| `set_plan_numbers` | Set planned values for particular weeks |
| `bulk_change` | Many goals, plan numbers and check-ins at once, using the export's columns. It checks first and saves only with `apply: true` |
| `add_comment` | Comment on a goal |
| `ask_for_update` / `undo_update_ask` | Ask a goal's owner for an update (an ask, open until they check in or answer it), or withdraw it |
| `ask_question` | Ask a goal's owner a question, outside a review: open until they answer it |
| `answer_request` | Answer an ask: a decision or help, a question or an ask for an update. One answer covers every goal it applies to. A comment never answers an ask |
| `mark_action_done` | Mark an action done, with an optional note. Until then it stays open, and overdue past its week |
| `link_request` / `withdraw_request` | Say a goal waits on another goal's decision or help; withdraw any ask (or stop a goal waiting on another's) |
| `review_call` / `edit_call` | In a review: mark a goal reviewed, add a note, ask the owner a question, agree an action (the last two are asks); correct what was said |
| `save_review` | Set up a review, or change one |
| `watch` / `unwatch` | Watch a goal, a goal and what feeds it, or a level; stop |
| `save_person` | Admins: add someone, or change their name, job title, team or admin rights |
| `save_team` / `remove_team` | Admins: add a team, or rename one or change its lead; remove one. A team with people or goals (in any cycle) needs `move_to`, another team they all move to in the same save |
| `rename_workspace` | Admins: give the workspace a new name |
| `set_recording` | Admins: turn on or off recording of how the app is used in the workspace (`on: true` or `false`). Off, nothing is recorded or sent for it, from the app or the server |
| `wrap_up_goal` / `start_next_cycle` | Wrap up a goal at the end of the cycle; admins start the next cycle (needs `confirm: true`) |
| `save_view` / `delete_view` / `pin_view` | Save, change or delete a view of the goals; admins pin one for everyone |
| `create_token` / `revoke_token` | Admins make a token (shown once); an admin or the token's person revokes it |
| `send_feedback` | Feedback about the app |
| `delete_workspace` | Admins: delete the workspace. Needs its exact name, and can't be undone |

**The builder inbox** (builder tokens only)

| Tool | What it does |
|---|---|
| `list_markups` | Markups people sent (a picture of a screen with a drawing, and a line saying what should change), newest first, from every workspace and the demo. Filter by `status` (`new`, `in-hand`, `fixed`, `wont-fix`) or `workspace` |
| `get_markup` | One markup in full: its line, the named screen parts under the drawing, its notes, where it was sent from (page, goal or review, screen size, theme, accent, app version), the steps before it and the visit's errors. With a link to its picture that works for ten minutes, when the server can sign one (see below); otherwise it points to the inbox |
| `update_markup` | Set a markup's `status` (`fixed` needs `fixed_in`, the What's new entry's id; `wont-fix` needs a `reason`) and keep its GitHub issue's address (`issue_url`). The same rules as the inbox |

These need a **builder token**: a builder signs in to the inbox (Workspace → Inbox, an email link) and makes one there, acting as themselves in a workspace. An ordinary token, which an admin can make for anyone, gets "only builders" instead. A builder token stops counting as one if its email leaves `okr_builders`. The tools reach markups through the database's functions for builder tokens (`okr_markups_for_token`, `okr_markup_for_token`, `okr_markup_triage_for_token`, migration 0024), so they need no secret beyond the token.

Goal, plan and check-in tools take `dry_run: true` to check a change without saving it. Destructive tools are marked as such, so assistants ask before using them.

## Hosting and security

- **Hosting.** The server is a Vercel function. `server/vercel.ts` is bundled into `api/mcp.js` by `npm run build:mcp`, and CI checks that the bundle matches its source.
- **Database key.** It reads and writes Supabase with `SUPABASE_SERVICE_ROLE_KEY` when that is set, otherwise with the app's public key. Today the Vercel project has only the public key.
- **Tokens** (migration 0024). The public key can't read, add or change `okr_api_tokens`. The server finds a token by its hash with `okr_token_find` and notes its use with `okr_token_touch`; `create_token` goes through `okr_token_create`, which makes the secret in the database and keeps only its SHA-256 hash. All of these work with either key.
- **Markup pictures** live in the private Storage bucket `markups`. Only Storage's own access can sign a link to one: the inbox does it as the signed-in builder; the MCP server can only with `SUPABASE_SERVICE_ROLE_KEY`. Without that key, `get_markup` says to open the picture in the inbox.
- **Telemetry.** Each tool call is recorded as a SERVER span in `okr_telemetry_spans` (migration 0022), with CLIENT spans for the database reads and saves inside it, unless the workspace has turned recording off. Send a W3C `traceparent` header and the spans join your trace. Spans carry the tool's name, the person's and workspace's ids and the class of any failure, never a tool's arguments or answers. A failure to store them never changes an answer.
- **Until company sign-in arrives**, the app's public key can still write to most tables (not tokens, and it can only add markups and feedback). A token makes clear who an assistant acts for and can be switched off, but it doesn't stop someone with the public key. The next step is sign-in, then making the public key read-only, so that all writes go through the server.
- **Vercel's deployment protection** must let `/api/mcp` through (for example, a custom domain, or protection for previews only), or assistants will get Vercel's sign-in page instead of the server.
