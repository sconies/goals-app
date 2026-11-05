# Glossary

One word for each thing. Use the term in the first column everywhere people read it: screens, the guide, walkthroughs, toasts and file names. The last column lists words not to use for it. `npm run evals` checks that none of them appears in the app's copy (requirement CONSISTENT-WORDS, `evals/consolidation.eval.ts`): a phrase in backticks is checked exactly as written, plain words are guidance. The check reads the screens and components (`src/screens`, `src/ui`), the walkthroughs and other app text (`src/app`), the rules' own words (`src/domain`) and the guide's articles, leaving out code comments. It doesn't read What's new, which is a record of what was said at the time, or the AI assistant's tool descriptions (`src/mcp`).

Decided in release 1 of the consolidation (5 Nov 2026). Routes and AI assistant (MCP) tool names keep their names for now: `/retro`, `add_comment`, `bulk_change`.

## Terms

| Term | What it means | Don't say |
|---|---|---|
| Goal | Something a team is trying to achieve this year, with one owner. Moves a number, keeps one in range, or hits dated stages. | objective, OKR, key result |
| Check-in | The owner's weekly post on a goal: the number, the call, and, when it's off plan, the reason and the path to green. | post an update (as the name of the check-in), status report |
| One-table check-in | Typing every number goal's figure for the week on one screen (`/quick-check-in`). Shown as "All your numbers in one table". | `Type this week’s numbers`, `quick check-in` |
| Call | The status the owner gives in a check-in. The numbers suggest one; a greener call needs a reason. | rating, RAG |
| Status | On track, At risk, Off track, No recent update, Done. Always a shape and a word together. | green, amber, red, RAG, health |
| No value yet | A goal that has no number reported yet. Said the same way in every list, card, headline and export, and never twice on one line. | `No number yet`, a dash on its own |
| Reason | The cause and the sentence a check-in gives when it's behind or well ahead of plan. | `last week’s note`, `Last week’s note`, explanation |
| Path to green | What changes, the week it's back on plan by, and any decision or help needed. | recovery path |
| Comment | Free conversation on a goal: anyone, any time, logged in the goal's "Comments and changes". It carries no obligation, and never answers or closes an ask. The code calls it a note (`addNote`, `entity: 'note'`) and the AI assistant's tool is `add_comment`; what people read always says comment. | `post a note`, `note posted`, `notes and changes` |
| Review note | What a review records about a goal, beside its questions and actions ("Add a note" in a review). Kept as "note" because it is the established word in the review, its record, the workbook's "Notes and actions" sheet and the assistant's `review_call`. | `review comment` |
| Ask | Anything that needs someone to respond (one way to ask, 5 Nov): a decision or help, an update, a question for the owner, or an action. Says who asked, who must respond and by when (optional). Open until it's answered (an action: done) or withdrawn, always explicitly; answered in the one Respond panel. Stored in `okr_requests`, and the AI assistant's tools keep their names (`answer_request`, `list_requests`). | follow-up, to-do |
| Request | The decision-or-help kind of ask: what an owner needs from a named person, often raised in a check-in. | blocker, escalation |
| Action | The kind of ask that is something to do: agreed in a review, for someone, by a week. Marked done, never answered; overdue when open past its week. | |
| Watch | Following a goal (or a tree, or a level) you don't own. Watching is a scope of Goals (`/goals?show=watching`; `/watching` goes there). | follow, subscribe |
| Review | A set of goals walked together on a cadence. Each session is not started, in progress or held. Once held, the review's page leads with "What was said". | `Review complete` (the old summary page) |
| Wrap-up | Closing a goal at the end of the year: how it landed, what was learned, whether it carries on. (The route stays `/retro` until a later release.) | retro, retrospective (in copy) |
| Layout | How the Goals screen draws goals: List, Table, Board, History, Cards or Map. | view (for a layout) |
| Saved view | A Goals screen tab of your own: its filters, sort and layout, saved under a name. Opened from Views. | saved filter, saved search |
| Saved layout | One of Data's tables arranged your way (columns, order, widths, search, filters and sort), saved under a name. Opened from Saved layouts. | `table view`, `opens from Views` |
| Data | The screen of every person, goal, check-in, plan and ask as tables (`/data`). Its nav item, page title and help article all say Data. | `Data tables`, `the data tables` |
| Import | Loading a spreadsheet of changes (`/import`): new goals, plan numbers, check-ins and past weeks, all shown before anything is saved. Its button, menu item, page, walkthrough and help say Import. | `Load changes from a spreadsheet`, `upload changes` |
| Export | Saving goals as a workbook, CSV, JSON or a brief for an AI chat. | download (as the name of the action) |
| File names | Every file the app saves is named `<workspace>-<what>-<scope>-<date>`, for example `platform-engineering-goals-year-2026-2026-11-05.xlsx`, and goes through `saveFile` in `src/app/files.ts` (requirement SHARED-DOWNLOADS). | |

## Kept for now

These use a word from the last column on purpose. The consistency check skips exactly these.

- `Data tables` in `src/domain/changeset.ts`: the "Via" value and summary written into the change log for edits made in Data. They are stored on every such change, so renaming them changes data; a later release can rename them together with a migration.
- `the data tables` in `src/domain/changeset.ts`: the same, in the logged summary "Edited the data tables: …".

## Words that look alike

- "Layout" (Goals) and "saved layout" (Data) are different things: a layout is how goals are drawn; a saved layout is a named arrangement of one of Data's tables.
- "View" on its own means a Goals saved view. Data has no views.
- "Note" on its own means a review note. A note on a goal outside a review is a comment.
