# The goal page: the build spec

10 November 2026. For a build session to follow without asking. The reasons are in `README.md` beside this file (findings D1 to D10); the whole redesign is in `docs/design/README.md`. It assumes Lane takes the recommended answer to each decision; "If Lane decides otherwise" says what changes.

**Standing rules** (from `CLAUDE.md`): each item adds its section of `spec/` and conformance rows, runs `npm run spec`, adds a What's new entry and updates the guide, comes with its evals, and passes `npm run typecheck`, `npm test` and `npm run evals:changed`. No table, no migration. The goal page is core (`src/screens/GoalScreen.tsx`, `src/domain/goalPage.ts`); modules add to it through places.

**Words used throughout.** `{goal}` is the goal's title; `{owner}` the owner's first name; `{ws}` the workspace's name. "Next step" is the vocabulary's term for an agreed action (`vocabulary.ts`, `next-step`); "ask" covers a question, a decision or help needed, and an ask for an update (`src/domain/asks.ts`). Wording in quotation marks is exact.

## 1. Routes

| Address | Screen | Title (navigation spec, rule 2) |
|---|---|---|
| `/goals/<id or key>` | A goal | The goal's title |
| `/goals/<id>/edit` | Change a goal | "Change {goal}" |
| `/goals/<id>/print` | To print | "{goal}, to print" |
| `/goals/<id>?review=<r>` | The goal in a review's walkthrough | Unchanged by this spec except the names in 2.3 |

**The address's parts** on a goal's page, all optional:

| Part | Meaning |
|---|---|
| `#next`, `#why`, `#chart`, `#feeds`, `#history`, `#about` | Scrolls to the section (the section links) |
| `?history=all\|checkins\|comments\|reviews\|changes` | History's filter (default `all`, left out) |
| `?all=1` | History shows every entry, not the first 12 |
| `?hq=<text>`, `?week=<n>` | History's search; scrolled to that week |
| `?about=1` | About is open |
| `?steps=all` | Next steps and asks lists every done and answered row, not the last three |
| `?ask=<id>` | That row's panel is open in Next steps and asks (what the primary button and Home's links use; today's `openAskedItem`) |
| `?published=1` | As today (the new-goal banner) |

### Redirects

| Old | New |
|---|---|
| `/goals/<id>#activity` | `#history` |
| `/goals/<id>/edit?part=definition\|plan\|owner` | `/goals/<id>/edit#definition\|#plan\|#owner` |
| `?show=changes` and other old Activity filter states (none were in the address) | — |

## 2. Screens

### 2.1 A goal (`/goals/<id>`)

Wireframes 1, 2, 5. One column up to 1,040 px; from 1,100 px a side column of 360 px (design rules, "Every screen size").

**Content, in order.** "Side" marks what sits in the side column at 1,100 px and wider; below that width everything is in this order in one column.

**1. Summary** (the bar, `data-part="Summary bar"`, as today unless said)

1. The back link (navigation spec, rule 4).
2. Status as shape and word, and the number ("Off track · 37 hours"); for stages "2 of 5 stages"; for no check-in yet "No check-in yet".
3. The title (h1).
4. One line: avatar, "{owner's name}, {team}" (links to the person and the team once WR1 is in), the level, the key, "Updated {date} · week {n}".
5. The `goal.facts` place (modules): the metric library's "Measured by {metric} · {unit}, {lower|higher} is better" as a link to the metric.
6. At the right (under the line on a phone): the **primary action** (rule 1) when there is one; then the **standing button** (rule 1): "Check in again" or "Watch" / "Watching"; then "…" ("More about this goal").
7. The wash: off track gets the full-surface wash as today; nothing else does.

The "…" menu, in order: "Share image", "Copy link", "Print or save as PDF", then for those who may change it "Change this goal" and "Stop this goal…". "Check in again" leaves the menu.

On scroll the bar becomes one sticky line (status, title, number, gap, the primary action when there is one, "…"), as today.

**2. Scorecard** (`#now`): unchanged (`scorecard.ts`). For a goal with no check-in yet: one line in its place, "The scorecard starts with the first check-in.", not four cells of "No value yet".

**Section links**, directly under the scorecard, sticky: "Now", "Next steps and asks" (with " · {open}" when any are open), "Why", "Chart", "What feeds it" (when it has feeders or a parent), "History", "About".

**3. Next steps and asks** (`#next`; Side)

1. Heading "Next steps and asks" and, when any are open, " · {n} open". Under it one line: "Who is doing what, by when, and what has been asked."
2. When the goal is off track or at risk and has no open next step (rule 3's `gap`): the warning mark and "No next step yet. Nobody has said what happens next, who does it and by when."
3. "For you" (a small label), when rule 2 puts rows there: those rows.
4. The other open rows, then "Done lately" (a small label) with up to three done or answered rows, then, when there are more, the link "Show all {n}", which lists them all in place (`?steps=all`).
5. The buttons: **"Add a next step"** (plain; anyone); and for anyone but the owner **"Ask {owner} a question"** (plain). For the owner: "Ask for a decision or help" (plain; opens today's request form from the check-in, on its own).

**A row** (rule 2 gives its words):

- Line 1: the kind as a word, then the text: "Decision or help: approve the extra CI runner budget for Q4"; "Question: …"; "Next step: take the runner budget to the finance review"; "Update asked".
- Line 2: who and when: "Asked of Amara by Rhea · 3 weeks ago"; "Amara · by week 47 (Thu 19 Nov) · agreed in Platform leadership weekly".
- State, at the right: "Open"; the warning mark and "Overdue by 1 week"; "Answered"; "Done · week 44".
- One button at most, for the viewer (rule 2): "Respond", "Answer", "Mark done", "Withdraw", "Check in".
- An answered or done row shows its answer or note under line 2 ("Amara: approved for Q4, from the platform reserve."), as today's DONE rows do.

Pressing "Respond" or "Answer" opens today's Respond panel in the row, in place, with its words unchanged ("Answer it / Ask the owner first", "Your answer or decision", "This closes it for all 3 goals", "Leave it open", "Record the answer"). While a panel is open the summary's primary action is hidden, as today.

**4. Why** (`#why`): today's "Why" and "What's being done" sections as one.

1. The heading as today's rule gives it ("Why it will miss without intervention", "Why it's behind", "Why it has no recent update", "The latest word" for a healthy goal).
2. "The owner's reason, from this week's check-in." (or the week it is from), then the reason.
3. The reason's kind as today ("Blocked by a dependency, from Rhea's check-in in week 46").
4. **Not** the ask: today's line "Decision or help needed: Waiting on …" is replaced, when an ask is open, by "Waiting on a decision from Amara: see Next steps and asks" as a link to `#next` (seven words, not the ask's text).
5. "Path to green": the owner's plan and its date, as today; "No date until the decision or help arrives." as today.

**5. Chart** (`#chart`): unchanged; stages or the limit for those kinds.

**6. Last time we talked** (Side): unchanged, but it excludes what is already a row in Next steps and asks (an agreed action shows there; here: the notes and "Next: {review}, {date}").

**7. What feeds it** (`#feeds`): unchanged; a goal with a parent gains a first line "Feeds into {parent}" with its status as shape and word.

**8. This year by quarter:** unchanged.

**9. History** (`#history`): 2.2.

**10. About this goal** (`#about`; a folded section, open when `?about=1` or on `#about`):

1. "What it measures": the definition, once. (The side column's "What it measures" line is removed.) Not described: "Not described yet." and, for those who may change it, the link "Describe it" → edit `#definition`. This is the only prompt for it on the page.
2. The `goal.sections` place (modules): the metric library's block.
3. The facts as today: Measure, Level, Team, Feeds into, Fed by, Key.
4. "Watched by": the names; for the owner the line "You own this goal, so it is always on your Home. Owners don’t need to watch their own goals."
5. "Plan and actual by week" (the table), "How the status is worked out", as today.
6. For those who may: one link, **"Change this goal"** → `/goals/<id>/edit`. The three links go.

**Empty and error states**

| When | Says |
|---|---|
| No such goal | Title "Goal not found". "There’s no goal at this address in {ws}." Primary **"See all goals"**; a Find field (navigation spec, 2.6) |
| A stopped goal | As today (the bar says "Stopped {date}: {reason}"); no primary action; Next steps and asks shows what was open as "Closed when the goal stopped" |
| A done goal | As today (its result); no primary action; the standing button is "Watch" for non-owners |
| Nothing open and nothing done in section 3 | "No next steps or asks yet." and the buttons |
| No check-in yet | Summary "No check-in yet"; the scorecard's one line; primary "Post the first check-in" (rule 1, order 2); Why: "Nothing said yet. The first check-in will say where it stands."; History: the "created" row and "Week {n} · No check-in yet" for the current week only |
| An action fails to save | The rule's own words as a toast, as today; the panel stays open with what was typed |

### 2.2 History

Wireframe 4.

**Content, in order**

1. Heading "History". Under it: "Every week, what was said, and what changed, newest first."
2. **"Add a comment"**: one line. Pressed, it opens: a field (placeholder "Say what you think, or what you know"); the line "Everyone in {ws} can read this. {owner} and the {n} people watching see it on Home." (n = 0: "{owner} sees it on Home."; on your own goal: "The {n} people watching see it on Home."); **"Post comment"** (primary within the box) and "Cancel". Cancel with text asks nothing and keeps the text as a draft, as other drafts are kept; the box closes.
3. Filters as links with counts: "All {n}", "Check-ins {n}", "Comments {n}", "Reviews {n}", "Changes {n}" (rule 4). The current one has `aria-current`.
4. With more than 30 entries in all: a search field "Find in this goal’s history" and a menu "Go to week…" (the cycle's weeks that have entries, newest first).
5. The entries (rule 4), newest first, 12 at first, then "Show all {n}" (`?all=1`).

**An entry**

- A week with a check-in: "Week 46", the number, the status as shape and word, the reason. This week's, when its reason is the one shown in Why: "The reason is above, under Why." in place of the text. Corrections show "Corrected {date}" as today.
- A week with none: "Week 45", then "No check-in". Not folded with others; a run of four or more missed weeks is "Weeks 12 to 17 · No check-ins (6 weeks)".
- A comment: who, the text, when; "Edit" and "Remove" for those who may.
- A review entry: "Amara looked at it in Platform leadership weekly" / "…added a note…" with the note / "…agreed a next step…" with a link to its row.
- A change: "Rhea changed the target from 20 to 24 hours" with its reason, and "Show the change" as today.

The current week is always its own entry at the top of All and Check-ins, never folded (U11).

**Empty and error states**

- A filter with nothing: "No comments yet." / "Nothing was said in a review yet." / "Nothing has been changed since it was set up."
- A search with nothing: "Nothing in this goal’s history matches “{q}”." and "Clear the search".

### 2.3 The goal in a review's walkthrough

Not redesigned here (LP). Two words change so the app says one thing: the section "What happens next, who, by when?" lists the same rows as Next steps and asks (the same component, review mode), and "Add the next step" keeps its name.

### 2.4 Add a next step (sheet)

As today, with these changes.

1. Title "Add a next step: {goal}".
2. "What needs doing" (required: "Say what needs doing.").
3. **"Who"**: find-and-pick for a person. It starts chosen only when the viewer owns the goal (themselves). For anyone else it starts empty, with the suggestions "{viewer} (you)" and "{owner}, who owns this goal" first. Required: "Choose who does it."
4. "By": the select of the next 8 weeks with their dates, as today (a short fixed list). Required: "Choose a week."
5. The line as today: "Whoever does it sees it on Home and on this goal. Once its week has passed it is overdue, and the goal needs attention again."
6. **"Add the next step"**; "Cancel".

### 2.5 Watch (sheet)

Wireframe 3. Opened by "Watch" or "Watching".

1. Title "Watch {goal}" / "You’re watching {goal}".
2. "Its check-ins, changes of status and new asks show on your Home and under Watching in Goals. Your name is listed under “Watched by” on this page. Faro sends no email."
3. When the goal has feeders: the choice, as today: "This goal" / "It and the {n} goals feeding it".
4. **"Watch"** and "Cancel"; when already watching: **"Done"**, and "Stop watching".

After: the toast "Watching {goal}" / "Stopped watching {goal}", with "Undo".

### 2.6 Ask {owner} a question (sheet)

Replaces the comment box's "Ask as a question".

1. Title "Ask {owner} a question about {goal}".
2. The field "Your question" (required: "Type the question.").
3. "It stays open on {owner}’s Home and in Next steps and asks until it’s answered. Everyone in {ws} can read it."
4. **"Ask"**; "Cancel".

### 2.7 Change a goal (`/goals/<id>/edit`)

Focus mode, one page, as today's, with:

1. One exit: "Close and keep the draft" (navigation spec, 2.5). The "Back to {goal}" link goes.
2. Sections with headings and anchors: "What it is" (`#definition`: name, what it measures, the `goal.measure` place), "Plan and target" (`#plan`), "Who and where" (`#owner`: owner, team, level, feeds into, also helps), "More details".
3. Owner, team, "Feeds into" and "Also helps" are find-and-pick (find spec, section 4, row 10).
4. **"Save changes"** sticks to the foot of the window and never covers a field: the page's foot has the bar's height as padding.
5. The notice "Check-ins have started, so a change here needs a reason. Watchers see it flagged." and the reason field, as today.

### 2.8 To print

As today, with the level line reading "North star · a number to move" (the wizard's words for the kind: "a number to move", "a number to keep in range", "dated stages"), not "· Move a number".

## 3. Who sees what

Consistent with R1; each line names the action that already enforces it. Nothing here adds or removes a right.

| Thing | Anyone | The owner | Asked, or doing the step | Admin | R1 |
|---|---|---|---|---|---|
| Read everything on the page | Yes | Yes | Yes | Yes | Rule 3 |
| "Check in for week n", "Check in again", "Post the first check-in" | No button | Yes | — | Yes, from "…" as "Check in for {owner}" | `planChanges` |
| "Add a next step" | Yes | Yes | — | Yes | `addAction` |
| "Mark done" on a next step | No | Only if they do it or asked for it | Yes | Yes | `markActionDone`, `canMarkDone` |
| "Ask {owner} a question" | Yes | Not on their own goal | — | Yes | `askQuestion` |
| "Ask {owner} for an update" | Yes | No | — | Yes | `askForUpdate` |
| "Ask for a decision or help" | No | Yes | — | Yes | `linkRequest` and the check-in's request |
| "Respond" / "Answer" | For an ask to no one in particular | When asked | Yes | Yes | `answerRequest`, `canAnswer` |
| "Withdraw" | Whoever asked | Also on a decision raised on their goal | — | Yes | `withdrawRequest`, `canWithdraw` |
| Comment; edit or remove their own | Yes | Yes | — | Removes any | `addNote`, `editComment`, `deleteComment` |
| Watch; stop watching | Yes | No button; About says why | — | Yes | `watch`, `unwatch` |
| "Change this goal", "Stop this goal…" | Not shown | Yes | — | Yes | `planChanges`, `stopGoal` |
| Share image, Copy link, Print | Yes | Yes | Yes | Yes | Rule 3 |

A button that would be refused is not drawn.

## 4. Rules for `src/domain`

In `src/domain/goalPage.ts`, pure, each with tests from its worked examples, a section in `src/spec/rules.ts` and conformance rows. They restate nothing: asks from `asks.ts`, attention from `attention.ts`, rights from the actions.

### Rule 1. The buttons in the summary: `primaryAction` (changed) and `standingAction` (new)

`primaryAction` keeps its inputs and gains `openSteps` (the open next steps on the goal) and `firstDue` (no check-in yet). In this order:

| # | When | Kind | Label |
|---|---|---|---|
| 1 | The viewer is asked a question here | `answer` | "Answer {name}’s question" |
| 2 | The viewer is asked a decision or help here | `respond` | "Answer {name}’s request" ("Answer your own request" as today) |
| 3 | The viewer owns it and it has no check-in yet | `first-check-in` | "Post the first check-in" |
| 4 | The viewer owns it and this week's check-in is due | `check-in` | "Check in for week {n}" |
| 5 | The viewer has an open next step here | `done` | "Mark your next step done" |
| 6 (new) | The viewer owns it, its status is off track or at risk, and `openSteps` is empty | `add-step` | "Add a next step" |
| 7 | The viewer doesn't own it, it has no recent update, nobody has asked for one | `ask-update` | "Ask {owner} for an update" |
| 8 | Otherwise | none | — |

"Watch" is no longer a primary kind.

`standingAction(viewer, goal, primary, watching)` returns the plain button beside it: for the owner, "Check in again" unless the primary is kind `check-in` or `first-check-in`, and never on a stopped or done goal; for anyone else "Watch" or "Watching"; on a stopped goal, nothing.

| Given (the example, 11 Nov) | Primary | Standing |
|---|---|---|
| Rhea on Lead time for changes (hers; off track; checked in this week; one open next step, Amara's) | None | "Check in again" |
| The same with no open next step | "Add a next step" | "Check in again" |
| Rhea on Flaky test rate (hers; due this week) | "Check in for week 46" | None |
| Amara on Lead time for changes (asked a decision by Rhea) | "Answer Rhea’s request" | "Watching" |
| Oskar on Lead time for changes (watches it) | None | "Watching" |
| Tunde on Developer onboarding (not his; no recent update) | "Ask Julia for an update" | "Watch" |
| Amara on the pen-test goal (done) | None | "Watch" |
| Rhea on her new goal, no check-in yet | "Post the first check-in" | None |
| Tunde on his rollback goal (on track, not due) | None | "Check in again" |

### Rule 2. The list: `stepsAndAsks(goal, viewer, snapshot, week)`

Returns `{ forYou, open, done, openCount, gap }`, each row `{ id, kind, text, line, state, button }`.

- **What is in it:** every ask on the goal that is open (decision or help, question, ask for an update) and every next step (`addAction`'s records) on it; plus those answered or done, newest first, for `done`.
- **`forYou`:** open rows the viewer can act on: asked of them (or of no one in particular, for a decision), or a next step they do.
- **Order of `open`:** overdue next steps (longest overdue first); decisions; questions; next steps by due week; asks for an update.
- **`state`:** "Open"; for a next step past its week, overdue with the weeks ("Overdue by 1 week", "Overdue by 3 weeks"), shown with the warning mark; "Answered"; "Done · week {n}".
- **`button`:** at most one, the first that applies for the viewer: "Respond" (a decision they may answer), "Answer" (a question they may answer), "Mark done" (`canMarkDone`), "Check in" (an ask for an update, the owner), "Withdraw" (`canWithdraw`, and for `undoUpdateAsk`).
- **`openCount`:** `forYou` plus `open`. **`gap`:** true when the status is off track or at risk and no next step is open.
- A decision that waits on another goal's request (`linkRequest`) is one row, with "for 3 goals" in its line, as today's "This closes it for all 3 goals".

| Given (Lead time for changes, 11 Nov) | Then |
|---|---|
| Amara looking | `forYou`: "Decision or help: approve the extra CI runner budget for Q4" (Respond); "Next step: take the runner budget to the finance review · Amara · by week 47 (Thu 19 Nov)" (Mark done). `open`: none. `done`: "Done: one-page case for the Q4 runner budget · Rhea · week 44". `openCount` 2; `gap` false |
| Rhea looking | `forYou`: none. `open`: the decision (Withdraw); Amara's next step, with no button (it was agreed by Amara in the review, so Rhea neither does it nor asked for it). `openCount` 2 |
| Oskar looking | `open`: both rows, no buttons |
| On 23 Nov (week 48), the step still open | Its state: overdue, "Overdue by 1 week" |
| A goal off track with one question open and no next step | `gap` true |
| A goal on track with nothing | All empty; `gap` false |

### Rule 3. What Why says about an ask: `whyPointer(goal, snapshot)`

When a decision or help is open on the goal: "Waiting on a decision from {name}: see Next steps and asks" (several people: "from {name} and {name}"; no one in particular: "Waiting on a decision: see Next steps and asks"). Otherwise nothing. Why never prints the ask's text.

### Rule 4. The history: `goalHistory(goal, snapshot, cycle, week, filter, q)`

Returns `{ counts, entries }`.

- **Week entries:** one for every week from the goal's first week (the week it was created, or week 1 of the cycle if earlier check-ins were imported) to the current week: its check-in, or "No check-in". Runs of four or more missed weeks collapse to one entry. A goal with no check-in yet has one week entry, the current week, "No check-in yet".
- **Kinds:** `checkins` (week entries, missed ones included); `comments`; `reviews` (looked at, a note, a question or next step agreed in a review, an ask answered in one); `changes` (edits to the goal, its plan, target, owner, team, level, links, metric; stopped; restored; each with its reason).
- **`counts`:** per kind and all; a collapsed run counts as its weeks.
- **`q`:** the find spec's `textMatches` over each entry's words.
- **Order:** newest first; a week entry is placed at the end of its week.

| Given | Then |
|---|---|
| Developer onboarding (last check-in week 44), week 46 | Check-ins starts: "Week 46 · No check-in", "Week 45 · No check-in", "Week 44 · …" |
| Lead time for changes, filter `changes` | Only edits: no "looked at it", no notes |
| The same, filter `reviews` | "Amara looked at it in Platform leadership weekly", her note, the next step agreed |
| A goal created in week 40, checked in every week | Seven week entries, 40 to 46, none missed |
| A goal quiet from week 12 to 17 | One entry "Weeks 12 to 17 · No check-ins (6 weeks)", counted as 6 |
| Counts for Lead time for changes | All = the sum of the four kinds |

### Rule 5. Who a comment reaches: `commentReach(goal, viewer, snapshot)`

Returns the sentence of 2.2's item 2 from the owner and the number of people watching the goal (directly, or through a tree or level watch), not counting the viewer or the owner twice.

| Given | Says |
|---|---|
| Oskar on Rhea's goal, 6 others watching | "Everyone in Platform Engineering can read this. Rhea and the 6 people watching see it on Home." |
| Rhea on her own goal | "Everyone in Platform Engineering can read this. The 6 people watching see it on Home." |
| A goal nobody watches, a non-owner | "Everyone in Platform Engineering can read this. Julia sees it on Home." |
| One watcher | "…Rhea and the 1 person watching see it on Home." |

## 5. Extension points

- `PLACES` gains **`goal.facts`** (given the goal; rendered as a line in the summary) beside `goal.sections`, which now renders inside About, after "What it measures" (it was before Activity). `docs/architecture.md`'s table is updated. The metric library uses `goal.facts` for "Measured by …" and `goal.sections` for its block.
- A module adds a row kind to Next steps and asks through a new list in its `app.tsx`: `steps: [{ kind, rows(goal, snapshot, viewer) }]` returning rule 2's row shape (3a's sent markups will use it). The manifest test checks it.
- A module adds an entry kind to History the same way: `history: [{ kind: 'changes' | 'reviews' | 'comments', entries(goal, snapshot) }]` (the metric library: "Rhea linked it to the metric Lead time for changes").

## 6. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U77 | GOAL-ACT | The owner can act: as Rhea on Lead time for changes the summary has "Check in again"; it opens the check-in for this week's correction. Mark Amara's step done as Amara; back as Rhea the goal is off track with no open next step, the section says "No next step yet…" and the primary action is "Add a next step"; add one (who: herself, by next week); the line goes, the row is there, the primary action is gone. On a phone each of these is on the first screen |
| U78 | GOAL-ASK-ONCE | An ask is said once: as Amara on the same goal the ask's text appears exactly once on the page, in Next steps and asks under "For you"; Why has only the pointer; the primary button opens that row's panel; answer it; the row moves to "Done lately" with her answer, Why's pointer goes, and Home's "Needs your response" drops by one. As Rhea the row has "Withdraw" and no other button |
| U79 | GOAL-HISTORY | The history shows the gaps: on Developer onboarding, History lists weeks 46 and 45 as "No check-in"; Changes shows only edits and Reviews only what reviews said, each count matching its rows; choosing Changes puts `?history=changes` in the address and a reload shows the same list; `#history` opens the page there; "Show all" is `?all=1`. This week's check-in on Lead time for changes is one entry that points to Why |
| U80 | GOAL-SAYS | Watch and comments say what they do: as Oskar, Watch opens the sheet with its sentence, then "Watching"; "Stop watching" with Undo; the comment box opens with who reads it and who sees it on Home, and Cancel closes it; "Ask Rhea a question" adds a row to Next steps and asks and to Rhea's Home. As Rhea there is no Watch, and About says why. Add a next step as Oskar starts with nobody chosen |

**Changed:** every journey that opens "Actions", "Check in again" from the menu, the three "Change this goal" links, Activity's filters or "Ask as a question" (U7, U10, U13, U19, U23, U31 and the GD part 1 journeys from #78); the review walkthrough's journeys read the shared list.

### F, N and P checks

| # | Check |
|---|---|
| F14 | The same order at both widths: at 390 the sections' headings appear in 2.1's order for each of the eight demo goals of the walk; at 1440 the main column's and the side column's are each in that order. At 390 × 844 the status, the number, the primary action (when there is one) and the heading "Next steps and asks" are within the first screen; at 1440 × 900 so is the heading of Why. No control sits alone in a row more than 44 px high. Nothing is under the tab bar; nothing scrolls sideways |
| N15 | Said once: on every demo goal with an open ask, the ask's text is in exactly one element of the page; this week's reason is in exactly one; "What it measures" is in exactly one |
| P3, P4 | Extended: every state in Next steps and asks is a word; an overdue step uses the warning mark, never a status shape; week entries carry status as shape and word |
| P6 | Extended to the new section, the Watch sheet and History's filters (no capsules for counts or states) |

### Unit tests

One file per rule with every worked example; `goalPageFix.test.ts` and `asks.test.ts` updated for the kinds.

### Requirements (`evals/requirements.json`)

New: `GOAL-ACT` ("A goal's owner can always check in and say what happens next from its page, and a goal behind with no next step says so"), `GOAL-ASK-ONCE` ("Everything asked and agreed on a goal is in one list, shown once, with the one button each person may press"), `GOAL-HISTORY` ("A goal's history shows every week, checked in or not, tells reviews from changes, and can be linked to"), `GOAL-SAYS` ("Watching and commenting say who will see what before you do them").

## 7. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `goal` (route `/goals/:goalId`) | Rewritten in the page's new order; the buttons and who sees which; Next steps and asks; the section links; what the address remembers |
| `asks` | "Actions" becomes "Next steps and asks" throughout; where to ask a question; Respond in place |
| `watching` | What watching does, in the sheet's words; why owners have no Watch |
| `goal-history` (new section of `goal`) | Every week, the four filters, linking to a filter |
| `goal-edit` (route `/goals/:goalId/edit`) | One page, its sections, one way out |
| `comments` | Who reads a comment and who sees it on Home |

### What's new (`src/help/whatsNew.ts`)

| Item | id | Title | Lines |
|---|---|---|---|
| GT1 | `goal-next-steps-and-asks` | "Everything asked and agreed on a goal, in one list" | "Next steps and asks replaces Actions, and an ask is no longer repeated around the page." "If a goal is behind and nobody has said what happens next, its page says so, and its owner's main button is Add a next step." "Owners always have Check in again." |
| GT1 | `goal-order` | "The reason comes before the chart" | "A goal's page reads in one order on a computer and a phone: how it is, what's being done and asked, why, then the chart." "Section links at the top take you down the page." |
| GT2 | `goal-history` | "A goal's history shows the weeks it missed" | "Activity on a goal is now History: every week is listed, with “No check-in” where there was none." "Reviews and Changes are separate filters, with counts, and a filter can be linked to." |
| GT3 | `watch-and-comment-say` | "Watch and comments say what they do" | "Watch tells you what you'll see and where before you choose." "A comment says who can read it, and has a Cancel." |

## 8. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | Keep "Actions" and the ask in Why | Section 3 keeps the name "Actions" and its place; only the "Asked of you" side card goes (its rows are "For you" at the top of Actions); rule 3 is dropped; N15's first clause allows two |
| 2 | Leave the owner's buttons in the menu | Rule 1 loses order 6 and `standingAction` returns nothing for owners; the `gap` line stays |
| 3 | Keep "Activity" | The heading, the link and the anchor stay "Activity" / `#activity`; `?history=` is still the filter's name |
| 4 | Chart first | Sections 4 and 5 swap in the main column; F14's "heading of Why within the first screen at 1440" is dropped |
| 5 | Keep the one-press Watch | 2.5 opens only for a goal with feeders, as today; a line under the button says the sheet's second sentence; Watch still isn't a primary action |

## 9. Build plan

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| GT1 | **Act on a goal: one list, the owner's buttons, one order** | 2.1 (sections 1 to 8, 10), 2.3, 2.4, 2.6; rules 1, 2, 3; the section links; the `goal.facts` place; U77, U78, F14, N15 | M | Nothing hard. FS1 for "Who" (until then, today's finder); NV2 for the back link and title |
| GT2 | **History that shows the gaps** | 2.2; rule 4; the address's parts; the redirects; U79 | S–M | GT1 (the section's place) |
| GT3 | **Watch and comments say what they do; one door to change a goal** | 2.5, 2.7, 2.8; rule 5; U80 | S | GT1; FS1 for the edit page's pickers |

GT1 can be built beside the Goals page (GL1): they share no screen code. **This replaces backlog GD (2) to (7)** and NAV (4)'s goal-page half. The order across areas is in `docs/design/README.md`.

**For the rebuild kit:** GT1's stage notes say the list is one query over asks and next steps (rule 2), that a delegate presses the owner's buttons "for" them (R6b), and that the primary action is a rule, not a layout choice.
