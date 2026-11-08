# Glossary

One word for each thing. Use the term in the first column everywhere people read it: screens, the guide, walkthroughs, toasts and file names. The last column lists words not to use for it. `npm run evals` checks that none of them appears in the app's copy (requirement CONSISTENT-WORDS, `evals/consolidation.eval.ts`): a phrase in backticks is checked exactly as written, plain words are guidance. The check reads the screens and components (`src/screens`, `src/ui`), the walkthroughs and other app text (`src/app`), the rules' own words (`src/domain`) and the guide's articles, leaving out code comments. It reads the AI assistant's tools and words too (`src/mcp`). It doesn't read What's new, which is a record of what was said at the time.

Decided in release 1 of the consolidation (5 Nov 2026). The words for states (statuses, flags, results, quarters, stages, asks, the gap and removals) came in release 2 (6 Nov 2026): they are generated below from `src/domain/vocabulary.ts`, and checked by requirement ONE-VOCABULARY. Routes and AI assistant (MCP) tool names keep their names for now: `/retro`, `add_comment`, `bulk_change`.

## Terms

| Term | What it means | Don't say |
|---|---|---|
| Goal | Something a team is trying to achieve this year, with one owner. Moves a number, keeps one in range, or hits dated stages. | objective, OKR, key result |
| Check-in | The owner's weekly post on a goal: the number, the call, and, when it's off plan, the reason and the path to green. | post an update (as the name of the check-in), status report |
| One-table check-in | Typing every number goal's figure for the week on one screen (`/quick-check-in`). Shown as "All your numbers in one table". | `Type this week’s numbers`, `quick check-in` |
| Call | The status the owner gives in a check-in. The numbers suggest one; a greener call needs a reason. | rating, RAG |
| Status | On track, At risk, Off track, No recent update, No check-in yet, Not started, Done: each defined once under Status words, below. Always a shape and a word together. | green, amber, red, RAG, health |
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
| Import | Loading a spreadsheet of changes (`/data/import`, opened from Data’s Spreadsheets menu): new goals, plan numbers, check-ins and past weeks, all shown before anything is saved. Its button, menu item, page, walkthrough and help say Import. | `Load changes from a spreadsheet`, `upload changes` |
| Export | Saving goals as a workbook, CSV, JSON or a brief for an AI chat. | download (as the name of the action) |
| Markup | A picture of a screen with marks drawn on it and a line saying what should change, sent to the people building Faro from Send feedback (Mark up this screen). Its status is New, In hand, Fixed or Won't fix. | screenshot, annotation, bug report, ticket |
| Builder | One of the people building Faro, whose email is on the builders list; signs in to the inbox on Workspace. | developer, staff |
| Inbox | Where builders read and triage what people send with Send feedback: markups, and feedback (a mood and a few words), each New, In hand, Fixed or Won't fix. | queue, tracker, backlog |
| Left | A person who has left the workspace: out of pickers, counts, reviews and Home, named in history as "Name (left)". Shown as a shape and the word. | departed, deactivated, archived (for a person) |
| Stopped | A goal stopped before the end of its year, with a reason: out of every list, still on its page, in exports and in Activity. Shown as a shape and the word. Not a status. | `Cancelled`, abandoned, archived (for a goal) |
| Ended | A review that has ended: it keeps its notes and actions and is no longer due. | closed (for a review), archived |
| Delete, Remove | Taking something away. Delete for a record (a goal with no check-ins, a check-in, a review, a view, a cycle); Remove for a comment or a note, whose place stays ("Comment removed", "Note removed"). Nothing is erased: it can be undone, and restored for 30 days. | erase, purge, trash |
| Recently removed | The admins' list on Workspace of everything removed, stopped, ended or marked as left in the last 30 days, each with Restore. | trash, bin, archive |
| Undo | The button on a removal's message, for 10 seconds; and "Undo this import" on an import's Activity entry. | revert, roll back |
| File names | Every file the app saves is named `<workspace>-<what>-<scope>-<date>`, for example `platform-engineering-goals-year-2026-2026-11-05.xlsx`, and goes through `saveFile` in `src/app/files.ts` (requirement SHARED-DOWNLOADS). | |

## Kept for now

These use a word from the last column on purpose. The consistency check skips exactly these.

- `Data tables` in `src/domain/changeset.ts`: the "Via" value and summary written into the change log for edits made in Data. They are stored on every such change, so renaming them changes data; a later release can rename them together with a migration.
- `the data tables` in `src/domain/changeset.ts`: the same, in the logged summary "Edited the data tables: …".

## Words that look alike

- "Layout" (Goals) and "saved layout" (Data) are different things: a layout is how goals are drawn; a saved layout is a named arrangement of one of Data's tables.
- "View" on its own means a Goals saved view. Data has no views.
- "Note" on its own means a review note. A note on a goal outside a review is a comment.

<!-- status words: generated from src/domain/vocabulary.ts by `npm run glossary`. Edit the vocabulary, not this. -->

## Status words

One meaning for every word the app uses for a state. Each is defined once, in `src/domain/vocabulary.ts`: the app, the exports, Help and the AI assistant all read it from there, and `npm run evals` fails on a word written anywhere else (requirement ONE-VOCABULARY, `evals/vocabulary.eval.ts`). The code is what is stored and passed (it never changes); the word is what people read. The AI assistant says both: “Off track (off)”.

### A goal’s status

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `on` | On track | On plan so far: at least 95% of the progress planned by now. | `goalStatus` (status.ts) | screens, exports, help, ai |  |
| `risk` | At risk | Could miss without a change: 80%–95% of the planned progress, or close to a limit. | `goalStatus` (status.ts) | screens, exports, help, ai |  |
| `off` | Off track | Will miss without intervention: under 80% of the planned progress, a stage more than 2 weeks late, or over a limit two weeks running. | `goalStatus` (status.ts) | screens, exports, help, ai |  |
| `stale` | No recent update | No check-in for 14 days or more, so its status can’t be trusted. | `goalStatus` (status.ts) | screens, exports, help, ai | `No recent check-in`, `gone quiet`, `goes quiet`, `An update is overdue`, `update is overdue`, `no check-in for 2+ weeks`, `Quiet for` |
| `none` | No check-in yet | Under way, with no check-in yet. | `goalStatus` (status.ts) | screens, exports, help, ai | `Waiting for its first check-in`, `Nothing reported yet` |
| `planned` | Not started | Hasn’t begun: its first week is still to come. | `goalStatus` (status.ts) | screens, exports, help, ai |  |
| `done` | Done | Finished: the owner has called it done. | `goalStatus` (status.ts) | screens, exports, help, ai |  |

### What needs attention, and why

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `off` | Off track | Will miss without intervention: under 80% of the planned progress, a stage more than 2 weeks late, or over a limit two weeks running. The same word, and meaning, as status.off. | `attentionFor` (attention.ts) | screens, exports, help, ai |  |
| `risk` | At risk | Could miss without a change: 80%–95% of the planned progress, or close to a limit. The same word, and meaning, as status.risk. | `attentionFor` (attention.ts) | screens, exports, help, ai |  |
| `stale` | No recent update | No check-in for 14 days or more, so its status can’t be trusted. The same word, and meaning, as status.stale. | `attentionFor` (attention.ts) | screens, exports, help, ai |  |
| `decision` | Decision or help needed | The owner is waiting on a decision or help that nobody has given yet. | `openFor` (asks.ts) | screens, exports, help, ai |  |
| `no-path` | No path to green | Off track or at risk, and the owner hasn’t said how it gets back. | `attentionFor` (attention.ts) | screens, exports, help, ai | `No recovery plan` |
| `missed-path` | Missed its own date | Still behind after the week the owner said it would be back on plan. | `attentionFor` (attention.ts) | screens, exports, help, ai | `Missed path to green` |
| `trend` | Getting worse | Further behind plan at each of the last two check-ins, or on track but heading short of its target. | `gapTrend` (trend.ts) | screens, exports, help, ai | `Worsening trend`, `Falling further behind`, `Losing ground on the plan`, `and slipping`, `Moving towards the limit` |
| `greener` | Greener than calculated | The owner’s call is better than the numbers say, with a reason. | `goalStatus` (status.ts) | screens, exports, help, ai | `Called greener than the numbers`, `greener than the numbers` |
| `due` | Check-in due | No check-in yet this week. It doesn’t, on its own, make a goal need attention. | `attentionFor` (attention.ts) | screens, help, ai |  |

### Needs attention and being handled

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `needs` | Needs attention | Flagged for something new that nobody has picked up yet. | `needsAttention` (attention.ts) | screens, exports, help, ai |  |
| `handled` | Being handled | Behind, but someone has looked since the latest check-in and nothing new has happened. | `handledFor` (attention.ts) | screens, exports, help, ai |  |

### Other warnings on a goal’s story

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `slipped` | Date slipped | The week the owner says it will be back on plan has moved later. | `storyOf` (story.ts) | screens, exports, help, ai | `Recovery date slipped` |
| `same-cause` | Same cause again | The same cause given at three check-ins running. | `storyOf` (story.ts) | screens, exports, help, ai |  |
| `missed-quarter` | Last quarter not met | It didn’t meet the plan for the quarter that has just ended. | `quarterResults` (year.ts) | screens, exports, help, ai |  |

### Which way it’s heading

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `worse` | Getting worse | Further behind plan at each of the last two check-ins, or on track but heading short of its target. The same word, and meaning, as flag.trend. | `gapTrend` (trend.ts) | screens, exports, help, ai |  |
| `better` | Getting better | Closer to plan (or further from its limit, or a stage expected sooner) at each of the last two check-ins. | `gapTrend` (trend.ts) | screens, exports, help, ai | `Closing the gap`, `catching up`, `Gaining ground`, `Moving away from the limit` |
| `flat` | No steady trend | Neither further behind nor closer at each of the last two check-ins. | `gapTrend` (trend.ts) | screens, ai |  |

### Against the plan

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `behind` | behind plan | Short of the plan for its week, by the amount said: “9 hours behind plan”. | `gapText` (format.ts) | screens, exports, help, ai | `below week-`, `above week-`, `On the week-` |
| `ahead` | ahead of plan | Better than the plan for its week, by the amount said: “3 pts ahead of plan”. | `gapText` (format.ts) | screens, exports, help, ai |  |
| `on-plan` | On plan | Exactly the plan for its week, at the goal’s decimals. | `gapText` (format.ts) | screens, exports, help, ai |  |
| `reached` | Target reached | The latest number has reached the target (or every stage is done). | `gapText` (format.ts) | screens, exports, help, ai |  |

### A goal’s result, once it’s due

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `completed` | Met | Hit the target by its due date. | `goalResult` (story.ts) | screens, exports, help, ai | `Completed` |
| `late` | Met late | Hit the target, but after its due date. | `goalResult` (story.ts) | screens, exports, help, ai | `Completed late` |
| `missed` | Not met | The due date passed without hitting the target. | `goalResult` (story.ts) | screens, exports, help, ai | `Did not meet` |
| `open` | Not finished yet | Not due yet, and not done. | `goalResult` (story.ts) | screens, ai |  |

### Each quarter of a goal year

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `met` | Met | At the quarter’s end it was where its plan said, or better. The same word, and meaning, as result.completed. | `quarterResults` (year.ts) | screens, exports, help, ai |  |
| `missed` | Not met | At the quarter’s end it was short of its plan. The same word, and meaning, as result.missed. | `quarterResults` (year.ts) | screens, exports, help, ai | `Missed its plan`, `Missed last quarter` |
| `open` | In progress | The quarter is still running. | `quarterResults` (year.ts) | screens, exports, help, ai |  |

### The owner’s view at the wrap-up

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `hit` | Hit it | The owner’s view at the wrap-up: it landed. | `suggestedResult` (cycle.ts) | screens, exports, help, ai |  |
| `partly` | Partly | The owner’s view at the wrap-up: some of it landed. | `suggestedResult` (cycle.ts) | screens, exports, help, ai |  |
| `missed` | Missed | The owner’s view at the wrap-up: it didn’t land. | `suggestedResult` (cycle.ts) | screens, exports, help, ai |  |

### A dated stage

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `done` | Done | Finished, in the week the owner said. The same word, and meaning, as status.done. | `assessMilestone` (status.ts) | screens, exports, help, ai |  |
| `planned` | On schedule | Not done yet, and not late. | `assessMilestone` (status.ts) | screens, exports, help, ai |  |
| `risk` | Slipping | Expected 1–2 weeks after its due week. | `assessMilestone` (status.ts) | screens, exports, help, ai |  |
| `off` | Late | Expected more than 2 weeks after its due week. | `assessMilestone` (status.ts) | screens, exports, help, ai |  |

### Kinds of ask

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `decision` | Decision or help | What an owner needs from a named person, often raised in a check-in. | `asksOf` (asks.ts) | screens, exports, help, ai |  |
| `update` | Update | An update asked of a goal’s owner. | `asksOf` (asks.ts) | screens, exports, help, ai |  |
| `question` | Question | A question for a goal’s owner. | `asksOf` (asks.ts) | screens, exports, help, ai |  |
| `action` | Action | Something someone agreed to do, by a week. | `asksOf` (asks.ts) | screens, exports, help, ai |  |

### Where an ask stands

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `open` | Open | Waiting for the person asked to respond. | `asksOf` (asks.ts) | screens, exports, help, ai |  |
| `answered` | Answered | The person asked has answered it. | `isResolved` (asks.ts) | screens, exports, help, ai |  |
| `done` | Done | Finished: the action was done. The same word, and meaning, as status.done. | `isResolved` (asks.ts) | screens, exports, help, ai |  |
| `withdrawn` | Withdrawn | Taken back by whoever asked, or an admin. | `asksOf` (asks.ts) | screens, exports, help, ai |  |
| `overdue` | Overdue | Still open after the week it was due by. | `isOverdue` (asks.ts) | screens, exports, help, ai |  |

### A review’s session

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `not-started` | Not started | Hasn’t begun: nothing said or reviewed yet this session. The same word, and meaning, as status.planned. | `sessionState` (review.ts) | screens, exports, help, ai |  |
| `in-progress` | In progress | Under way: some goals reviewed, not all. The same word, and meaning, as quarter.open. | `sessionState` (review.ts) | screens, exports, help, ai |  |
| `held` | Held | Every goal in the session has been marked reviewed. | `sessionState` (review.ts) | screens, exports, help, ai |  |

### Removed, stopped and ended

| Code | Word | What it means | Decided by | Where | Don’t say |
|---|---|---|---|---|---|
| `left` | Left | A person who has left the workspace. | `markPersonLeft` (removal.ts) | screens, exports, help, ai |  |
| `stopped` | Stopped | A goal stopped before the end of its year, with a reason. Not a status. | `stopGoal` (removal.ts) | screens, exports, help, ai |  |
| `ended` | Ended | A review that has ended: it keeps its notes and actions and is no longer due. | `endReview` (removal.ts) | screens, exports, help, ai |  |
| `removed` | Removed | Deleted, and still restorable for 30 days. | `recentlyRemoved` (removal.ts) | screens, exports, help, ai |  |
| `comment-removed` | Comment removed | What a thread shows where a comment was. | `commentsOf` (removal.ts) | screens, exports, help, ai |  |
| `note-removed` | Note removed | What a review’s record shows where a note was. | `commentsOf` (removal.ts) | screens, exports, help, ai |  |
| `edited` | edited | Beside words corrected after they were posted. | `commentsOf` (removal.ts) | screens, exports, help, ai |  |

<!-- status words: end -->
