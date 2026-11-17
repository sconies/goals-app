# Shared patterns: one goal row, one page header, one form footer

17 November 2026. Design and spec only: no app code was changed, and nothing here is built. **Decided:** Lane took the recommended answer to every question (section 6). Lane asked for it after the usability study ([`docs/reviews/2026-11-17-usability-study.md`](../../reviews/2026-11-17-usability-study.md), "Shared patterns to standardize", F05 and F07) and planning's evaluation of it (backlog, "Usability study, 17 Nov", UX2 and UX4: "agree, after a design pass").

These three patterns are what a rebuild copies most, because every list, every page and every form uses one of them. Faro adopts them too. Each is written once here and referred to everywhere else.

Wireframes: `mockups/build.cjs` draws four sheets with the shared kit (`../_shared/kit.cjs`) and renders each at 1440 and 360 px into `wireframes/` (`node docs/design/patterns/mockups/build.cjs`). They show layout, order and wording. They are not app code, and the numbers in them are illustrative.

| Sheet | Shows |
|---|---|
| 01-goal-row | The row's slots, and the four hard cases, on Watching |
| 02-row-places | The same row in the check-in queue (with an action), on Home and on a review's agenda |
| 03-page-headers | A list page, a detail page (a goal with a long title) and a focused task |
| 04-form-footer | A step, the last step, errors and the table check-in's footer |

## What this keeps

These decisions stand. Each pattern below is built on them. Where the study asks for something else, section 4 gives both sides.

- **Status is a shape plus a word, first on every row, card and node** (`docs/design-rules.md`). Off track gets the full-surface wash; nothing else does.
- **A forecast miss needs attention whatever the status** (round 3: the forecast and "Getting worse" are core, "one rule feeding a flag that makes a goal need attention"). An On track goal stays in Needs attention, and its row says why.
- **One primary action per screen** (`CLAUDE.md`), and a goal's summary has the primary action plus one standing button, "Check in again" or "Watch" (goal spec, 2.1 item 6, rule 1).
- **One way out of a form**: one control, top right, worded "Close and keep the draft" or "Close without saving" (navigation spec 2.5, U72 `NAV-FORMS`).
- **The readiness panel sits above "Still to review"** on a review's page (HB2, `round-4/habit/spec.md`). This design does not move it. UX1 folds its eight-week row.
- **The check-in queue's table link sits under the list** (check-in README, K8). Moving it is F02's separate question, not this design's.
- **Rules live once.** What a row says comes from the shared rules (`attentionFor`, the reviews spec's `agendaReason`, `nowText`, `gapBeside`, the vocabulary), which the import and the MCP server already read. This design adds no new rule wording.

---

## 1. The goal summary row

### 1.1 What it is for

A row answers three questions in this order. How is it? What is it? Why is it listed, or what do I do? The goal's page answers everything else. A row never shows the chart, the history or a second reason.

Today there are six row shapes for one goal: `GoalRow`'s `full`, `line` and `brief` densities (`src/ui/goalRows.tsx`), `HandledRow`, the check-in queue's own row, and Home's team table. They put status, value and reason in different places, so a reader relearns each list. They become one row with one set of slots. Each place chooses what fills the reason slot and whether there is an action. A place never chooses where the slots go.

### 1.2 The slots

| Slot | Holds | Always there |
|---|---|---|
| **Status** | The status shape and word, from `goalStatus`. | Yes |
| **Value** | The number now and its gap, in `nowText` and `gapBeside`'s words ("36 hours", "12 behind plan"). For stages: "Stage 2 of 5" and "1 week late" or "On plan". For a stale goal: the last number and "as of week 9". For a done goal: the result in small capitals ("Completed late"). For no check-in yet: "No number yet". | Yes |
| **Name** | The goal's title as a link to its page, then its level where the place shows levels. The key ("G-48") is shown only where a list is searched by key. | Yes |
| **Reason** | One line, and at most two on a phone, giving why the goal is in this list, in the words of the place's rule (1.4). It begins with the warning mark when it is a flag that isn't the status. | When the place has a rule for it |
| **Context** | An optional second line. It is used only for something that changes what the reader decides: an open ask ("Waiting on Amara: a decision on the second runner pool, since week 44"), or what puts a behind goal in hand ("Next step: Rhea, due week 47"). | Only then |
| **Action** | One plain button, where the row is something to do: "Check in", "Carry on", "Correct it", "Respond". | Only in task lists |

**Links open things and buttons act.** The name is the link. A row with an action is not itself a link, because a button inside a link is invalid and reads badly to a screen reader. A row with no action is a link from edge to edge, as today. Either way the link's accessible name is the goal's title.

### 1.3 Layout

**Desktop and tablet (≥ 700 px).** It is a grid of four columns, the same in every list on a page, so values line up down the list:

```
[ Status 140 ] [ Name                          ] [ Value 168, right-aligned ] [ Action auto ]
               [ Reason (one line, then clamp) ]
               [ Context (when there is one)   ]
```

- The status column is 140 px, enough for "No recent update" at 14 px. The words never truncate.
- The value column is 168 px wide and right-aligned, with tabular figures. The number is on the first line and the gap under it, in its tone's colour.
- The reason clamps at two lines. The whole sentence is in the row's `title`, as today.
- The action column exists only in task lists. Its buttons are 40 px tall (44 px on touch).
- The row's height follows its content. Rows are hairline-divided (`design-rules.md`). The off-track wash covers the whole row.

**Phone (360 to 699 px).** The status, the value and the action share the first line. The name gets the full width of its own line:

```
[ Status  value · gap (wraps as one unit) ] [ Action ]
[ Name, full width, wraps                            ]
[ Reason, two lines at most                          ]
[ Context, one line                                  ]
```

- Line 1 is "◯ Off track  36 hours · 12 behind plan". When it doesn't fit beside the action, the value and gap wrap under the status word as one unit. The action never moves off line 1, and it never shrinks below 44 × 44 px.
- At 360 px, inside a list's border, line 1 has about 304 px. Beside an 88 px "Check in", that leaves room for the status word, but usually not for the value as well. In task lists, the value therefore normally sits on its own short line (sheet 02). Without an action it fits on line 1 (sheet 01).
- The name is never squeezed by a control. This is the row's version of F03.

### 1.4 What fills the reason slot, by place

Each place keeps the rule it already has. The row only fixes where the result goes.

| Place | Reason slot | Context slot | Action | Today |
|---|---|---|---|---|
| **Home: Your goals** | The top flag's detail when there is one (`attentionFor`). Otherwise "Checked in {day}" or "Check-in due by {day}". | An open ask on it | "Check in" while due | The `line` density with a sparkline and a separate button |
| **Home: Your team, Watching** | As Watching | As Watching | None | `WatchedGoals`, and the team table, which stays a table: it is about teams, not goals |
| **Watching: Needs attention** | The top attention flag's detail, worst first by `ATTENTION_FLAGS`' order | An open ask, when it isn't the top flag | None | `GoalRow` full |
| **Watching: Being handled** | What puts it in hand (`handledFor`), as `HandledRow` says today | None | None | `HandledRow` |
| **Watching: the rest** | What changed since you last looked (`statusChange`), or the owner and freshness | None | None | `GoalRow` full |
| **Goals: List and trees** | The top attention flag, else the owner and freshness | None | None | `GoalRow` full |
| **Check-in queue** | What it last said: "Last week: 36 hours · 8 behind plan" or "No check-in yet" (navigation 2.4) | "Draft kept" when there is one | "Check in", "Carry on" or "Correct it" | Its own row |
| **A review's agenda** | `agendaReason` (reviews spec, rule 1), as that spec already asks for each row | An open next step from the last session | None | The `brief` density, with no reason |

**One reason, never a list of flags.** The goal's page shows the rest. The reason slot never says "and 2 more", because a count of flags is not a reason. The row's order of flags is `ATTENTION_FLAGS`' order: the shared weight that sorts Needs attention already.

### 1.5 The hard cases, worked

These become unit tests of the row's parts (1.7) and the rows on sheet 01.

| Case | Status | Value | Reason | Context |
|---|---|---|---|---|
| **On track with a forecast miss** (F07): "Pull requests with AI-assisted review", in Watching's Needs attention | ● On track | 64% · 2 pts ahead | ⚠ Getting worse: On track today, but the recent trend heads for 61–66% by week 13, against a target of 70%. | None |
| **Stale with a last known value**: "Flaky test rate" | ◌ No recent update | 4.1% · as of week 9 | ⚠ No check-in for 23 days; the last was week 9 (at risk). | None |
| **Off track with an open ask**: "Lead time for changes" (washed) | ◯ Off track | 36 hours · 12 behind plan | The runner pool is saturated at peak; builds queue for 40 minutes. *(the owner's why: the "off" flag's detail)* | ⚠ Waiting on Amara: a decision on the second runner pool, since week 44. |
| **A milestone**: "Move builds to the new runners" | ◐ At risk | Stage 2 of 5 · 1 week late | Stage 3, Pilot with two teams, was due week 44. | None |
| **Done** | ✓ Done | COMPLETED LATE | Finished week 11; the target was week 10. | None |
| **No check-in yet** | ⊙ No check-in yet | No number yet | The first check-in is due by Friday. | None |

(The shapes above are written as text for this table. On screen they are the app's own SVG shapes from `StatusShape`, never these characters.)

Why the off-track row's reason is the owner's why, and the ask is context: the status already says Off track, so the reason slot's job is to say why in the owner's own words. That is the "off" flag's detail, which is first by weight. The open ask ("decision", fourth by weight) would be hidden behind it. But an open ask changes what the reader does: they may be the one asked. So it takes the context line. When the viewer is the person asked, it says "Waiting on you: …".

### 1.6 Rules

1. **Slots don't move.** No place reorders them, hides the status or the value, or adds a fifth slot. A place may leave out Reason, Context and Action.
2. **Status first** on every width (`design-rules.md`). On a phone, the status shares its line with the value. This is where the study's "group status with value" and the design rules meet (section 4, question 1).
3. **One tone per row.** Colour belongs to the status shape and word, the gap's words, and the off-track wash. The reason's warning mark takes the risk ink. Nothing else on the row is coloured (study, "Evidence and attention").
4. **The words come from the rules.** The row component formats parts. It never writes a sentence of its own. The parts come from one pure function (1.7), so the MCP server's `find_goals` and `get_overview` can say the same as the row.
5. **Counts are not repeated beside the list** (F07). A list's count is said once, in its heading ("Needs attention · 4"), or in the list bar's count line on a list page. It is never said in a button, a summary and a heading all at once (section 2, rule 6).
6. **Long names wrap; they never truncate.** A name is about 140 characters at most (G-48). It wraps in the Name slot and the row grows.

### 1.7 For the code

- **`src/domain/goalRow.ts`** (new, pure): `rowParts(goal, attention, place, viewer) → { status, value, gap, asOf, result, reason, reasonIsFlag, context, action }`, where `place` is one of the eight places in 1.4. It reads only what it is given (AR4). Its worked examples are 1.5's rows, as unit tests and conformance rows in `spec/conformance/goal-row.csv`.
- **`src/ui/GoalRow.tsx`** replaces the three densities with `<GoalRow goal place action? />`. `HandledRow` and the queue's row go. CSS: one `.grow` grid with the phone layout above. The `trow`, `gline` and `agenda-row` classes go.
- **MCP:** `find_goals` and `get_overview` gain `reason` and `context` fields from `rowParts`, so an AI answer names the same reason as the screen. Run `npm run build:mcp`.
- **Requirement** `GOAL-ROW` with its spec section. It is core: the row is part of every list, so it has no switch (its spec says so). The places that belong to modules (Watching, a review's agenda) are switched off with their modules.

### 1.8 Screens that change, and the work

| Screen | Change | Size |
|---|---|---|
| Home: Your goals | The `line` row becomes the row; the sparkline goes (the goal's page has the chart); the separate "Check in" button moves into the Action slot | S |
| Home: Your team, Watching sets | The watched-goals rows become the row; the team table stays | S |
| Watching (the Goals tab) | Needs attention, Being handled and the rest all use the row; F07's repeated count goes | S |
| Goals: List and tree views | The row, indented in trees as today | S |
| A goal's "Contributing goals" list | The row (it uses `GoalRow` today) | Free |
| Check-in queue | Its own row becomes the row with an action | S |
| A review's agenda | `brief` becomes the row, with `agendaReason` | S |
| Board, Cards | Not changed here. A card keeps status first; F05's compact card is backlog item 4 ("Later") and should reuse `rowParts` when built | None now |
| MCP | `reason` and `context` on goal lists | S |
| Evals | One check (1.9); P3, P4 and P6 already cover the shapes; U71 and the Watching journeys re-pointed at the new markup | S |

**In total, M: one release.** Most of the work is one component, one pure function, and re-pointing evals that read the old classes.

### 1.9 Evals

- A design check (next free P number at build): on Home, Watching, Goals List, the check-in queue and an agenda, at 1440 and 360 px, every goal row has, in DOM order, a status with its word, a value, then the name. At ≥ 700 px, the values' right edges in one list are equal within 1 px. At 360 px, the name's box is the row's full content width. No row nests a button in a link.
- A journey (next free U number): Watching as Amara shows the four hard cases of 1.5 with their reasons and context, word for word from `rowParts`.

---

## 2. One page header

### 2.1 Three kinds of page

| | List page | Detail page | Focused task |
|---|---|---|---|
| **Examples** | Goals, Check-in (the queue), Reviews, People, Teams, Metrics, Activity, Data, Feedback, Help | A goal, a person, a team, a metric, a review's agenda, a past import | A check-in, the table check-in, New goal, Change a goal, set-up, a review's set-up and edit, Add or change a metric, Import, a wrap-up |
| **Frame** | Sidebar or tab bar | Sidebar or tab bar | Focus mode: no sidebar, no tab bar |
| **Above the title** | Nothing (a place's first page has no back link: navigation rule 4) | The back link, "‹ {where}" | The task's name and progress, "Check-in · 2 of 7", at the left; the one exit at the right (2.4) |
| **Before the title** | — | The status and number line, for things with a status ("◯ Off track · 36 hours") | — |
| **Title (h1)** | The place's name | The thing's own name | What this step asks: "How is Lead time for changes?" |
| **One line under it** | What's in scope: "Week 46, 10–16 Nov. Check-ins are due by Friday." | Who and where: owner, team, level, key, "Updated {date}" | What to do, or why it's asked |
| **Top-level action** | At most one, filled, at the right: "New goal", "New review", "Add a metric" | One primary, filled, when there is one; at most one standing button, plain; then "More" | None in the header. The primary is in the footer (section 3) |
| **Under the header** | Tabs (whose goals), then the list bar (find spec) | Section links that stick, on long pages (navigation 2.5) | The step list, on stepped forms |

### 2.2 Rules

1. **The title is aligned with the content's left edge,** on every width. Nothing sits to its left.
2. **App utilities never sit in a page header.** Find, Demo, your avatar and Help live in the shell: the sidebar on desktop, the top bar on a phone. This is what squeezed the goal's title to 97 px at 340 px (F03).
3. **A long title gets a full-width line on a phone.** Below 700 px the header stacks: status line, title, the line under it, then the actions in one row (wrapping). The title never shares a line with a control. On desktop the actions sit at the right of the title's first line, and the title wraps before it pushes them.
4. **One filled button per header, at most.** A detail page may add one plain standing button (the goal's "Check in again" or "Watch") and "More". Everything else goes in "More": share, copy link, print, export, change, stop.
5. **List tools are not header actions.** Export, Views and Manage watching belong to the list bar's extras (find spec 2.1), so they stay with the list they act on. This is where the study's "Manage watching with the scope" goes.
6. **A count is said once.** A list page's count is in the count line ("126 goals, worst first."). A section's count is in its heading ("Needs attention · 4"). A count appears in a header's line only when the page is that count ("7 check-ins due this week").
7. **Sticky on scroll, on detail pages only.** It becomes one line: status, title (one line, truncated with its full text in `title`), number, the primary action, "More". This is today's goal bar, made the rule. Its height is subtracted when the page scrolls to an anchor, so a section's heading lands in view (study: "the chart anchor lands below the sticky header").
8. **The phone's top bar names the page only once the title has scrolled away.** Until then it shows the workspace, Find and you, so the page's name isn't said twice on one screen (study, "Page header"). This changes navigation spec 2.3 slightly (question 6).

### 2.3 A goal's header, on a phone (F03)

At 360 px, from the top:

1. The shell's top bar: Faro, the workspace, Find, you. Nothing of the goal's.
2. "‹ Goals" (the back link).
3. "◯ Off track · 36 hours · 12 behind plan".
4. **Lead time for changes on the main monorepo pipeline**, the h1 at 24 px across the full 328 px, wrapping to as many lines as it needs.
5. "Rhea Kapoor, CI/CD · Team goal · G-14 · Updated 14 Nov".
6. One row: **Check in again** (filled, when the owner is behind with nothing newer) · Watch (plain, for others) · More.

UX1 is building item 4's full-width line now (F03). This section makes it the rule for every detail page, so a person's, a team's and a metric's long names get the same treatment.

### 2.4 Focused task header

`[ Check-in · 2 of 7 ]                          [ Close and keep the draft ]`

The exit is the only control. It is worded as section 3.4 says. On a phone, when the progress and the exit don't fit on one line, the exit keeps the right of the first line and the progress goes under it (sheet 03). The title below asks the step's question. There is no back link. "Back" is the footer's job, and the browser's Back does the same (navigation 2.5, steps in the address).

### 2.5 Screens that change, and the work

| Screens | Change | Size |
|---|---|---|
| A goal | Utilities out of the header on a phone; the title's own line (UX1 does the title; this keeps utilities out); the sticky line's anchor offset | S (after UX1) |
| A person, a team, a metric, a past import | Status line where they have one; title's own line; actions under it on a phone; extra buttons into "More" | S |
| A review's agenda | Header as a detail page; "Start the review" as its primary; F08's labels are UX1's | S |
| Goals, Reviews, People and Teams, Metrics, Activity, Data, Feedback, Help, Check-in | One `PageHeader` component; the 20 `page-head` blocks and the other 14 `h1` sites use it; counts said once; list tools into the list bar | S–M |
| Every focused task | One `TaskHeader`: progress at the left, `FormClose` at the right (it already exists) | S |
| The phone's top bar | The page's name appears once the h1 scrolls away | S |
| Evals | One check: at 360 px no control shares a line with an h1, and no utility (Find, Demo, avatar) is inside `main`'s header; at 1090 and 1363 px a header's actions don't wrap below the title alone | S |

**In total, S–M.** Most of the work is moving existing pieces into two components. The goal's phone header is the only page whose layout changes much, and UX1 has started it.

---

## 3. One form and draft footer

### 3.1 Slots

```
[ Status line: what the primary will do, or what's left to fix                    ]
[ Back (plain, only after step 1) ]                     [ Primary: Verb object ]
```

- **The primary** is the only filled button on the page. It is labelled with a verb and an object, saying what happens. It is never "Continue", "Submit", "OK" or "Save" alone.
- **Back** is plain, at the left, on the second step of a stepped form and later. It keeps what was typed (navigation 2.5). A single-page form has no Back and no Cancel in its footer: its exit is the header's (2.4).
- **The status line** is one short line above the buttons. It says what the primary does on the last step, or what is left to fix when there is more than one thing. Otherwise it is empty and takes no space.

### 3.2 Labels

| Form | Steps before the last | The last step's primary | The status line on the last step |
|---|---|---|---|
| A check-in | "Next: why it's behind", "Next: what changes" | **Post check-in** | "Goes on record for week 46. The 3 people watching see it on Home." |
| The table check-in | — | **Post 5 check-ins** | "5 ready. 2 need a reason before they can post." |
| New goal | "Next: who and where", "Next: how it's measured", "Next: check it" | **Publish goal** or **Propose goal** (the choice above it) | "Publishes to everyone in Platform Engineering." / "Listed as Proposed: in no count, no agenda and nobody's check-ins." (goal-entry spec) |
| Change a goal | — | **Save changes** | "Check-ins have started, so this needs a reason. Watchers see it flagged." (only when it does) |
| Set-up | "Next: {step}" | **Create workspace** | "You can change all of this later in Workspace." |
| A review's set-up and edit | — | **Create review** / **Save review** | "12 goals, 6 people." |
| Add or change a metric | — | **Add metric** / **Save metric** | "Defined: every part is filled in." or "Draft: 2 parts still to fill in." |
| Import | "Next: check the changes" | **Import 12 changes** | "12 goals change. You can undo this from Past imports." |
| A wrap-up | "Next: {goal}" | **Finish the wrap-up** | — |

A step's primary names the next step ("Next: why it's behind"), because the study found "Continue" didn't say whether it led to another question or to posting.

### 3.3 Errors

1. **An error sits beside its field**: under the label, above the input, in plain words ("Type this week's number, in hours."). It never says "Enter “”". The field gets a full outline in the off-track ink (`design-rules.md`: errors cover the whole element), and `aria-invalid` with `aria-describedby` pointing at the words.
2. **The primary is never disabled.** Pressing it with something missing shows the errors and moves focus to the first field in error, scrolled into view below any sticky header.
3. **A summary only when it helps**: when there are two or more errors, or the one error is out of view, the status line says "2 things to fix: Target, Owner", each a link that moves focus to its field. One error that is in view needs no summary.
4. **Rows in a table form** (the table check-in, Data's sheet) say their error in the row and count them in the status line ("2 need a reason"). Opening the first such row is the status line's link.

### 3.4 Drafts

1. **"Close and keep the draft" only where a draft exists.** A form that keeps drafts (check-in, the table check-in, New goal, Change a goal, set-up) says **"Close"** until something has been typed, then **"Close and keep the draft"**. A form that keeps none says **"Close without saving"** and asks first when something was typed, as today (navigation 2.5).
2. **The draft's home is said once**, on the first step after it is first saved: "Draft kept in this browser." in the status line, and not again. The study's point: say it only where someone needs to tell a draft from a publication.
3. **A resumed draft** says so in the step line, "Check-in · 2 of 7 · Draft from Tuesday", not in a banner above the title (study: New goal's resumed-draft banner).

### 3.5 Placement

- **Sticky at the bottom of the window** on focused tasks, as today, with the same short-screen exception: below 600 px of height it sits in the page flow (`forms-checkin.css`). Planning found that the study's zoomed views came from this exception.
- **The width of the form's column** (620 px), not the window. On a phone it is full width, with the primary on the right and Back on the left. When both don't fit at 360 px, the primary takes the full width and Back goes above it as a text link.
- **Sheets** (Watch, Add a next step, Respond) use the same footer in the sheet: the primary at the right, plus "Cancel" at the left, because a sheet has no header exit. This is the one place a footer has Cancel.

### 3.6 Screens that change, and the work

| Screen | Change | Size |
|---|---|---|
| Check-in (`CheckInFlow`) | "Continue" becomes "Next: {step}"; the status line on the last step; errors in field words | S |
| Table check-in (`QuickCheckIn`) | "Cancel" goes (the header's exit stays); "Post {n} check-ins" with the ready count | S |
| New goal (`GoalWizard`) | Publish or propose state beside the primary; the resumed-draft banner moves into the step line | S |
| Change a goal (`GoalEdit`) | Primary "Save changes"; the reason beside the fields it concerns | S |
| Set-up (`Onboarding`) | Labels and Back | S |
| A review's set-up and edit (`Review`) | The footer, errors beside fields (F04's wrap is UX1's) | S |
| Metrics (`Metrics`, `VerifyForm`, `BaselineForms`) | The Defined or Draft line beside the primary | S |
| Import (`Import`, `CheckClose`) | Labels; the status line | S |
| A wrap-up (`Retro`) | Labels | S |
| Sheets (13 `sheet-foot` sites) | Primary at the right, Cancel at the left | S |
| `FormClose` | "Close" until something is typed | S |
| Evals | One check: on every focused task, exactly one filled button, in the footer, whose label is not "Continue", "Submit", "OK" or "Save" alone; pressing it empty moves focus to a field with `aria-invalid` and adjacent words. U72 still passes unchanged | S |

**In total, M.** It is many small edits across about twelve screens behind one `FormFooter` component. The one behaviour change is "Close" until something is typed.

---

## 4. Where the study and earlier decisions disagree

| Point | The study | Earlier decision | This design |
|---|---|---|---|
| **The order on a phone row** | Name first, with status and value grouped under the title | Status first on every row (`design-rules.md`) | Status first, sharing line 1 with the value, so they are grouped. Name on its own full line. (Question 1) |
| **The forecast miss's name** | Name it "Forecast miss", apart from tracking status | One flag, "Getting worse", covers both further-behind and on-track-but-heading-short (`vocabulary.ts`, round 3) | Keep the flag's word. The reason sentence already begins "On track today, but…". Splitting the word is a vocabulary change that Help, the MCP server and the import would follow. (Question 2) |
| **A Board card without its status** (F05) | Drop the status on cards, because the column says it | Status first on every card | Keep it. A card is seen alone when the board is stacked on a phone. F05's compact card reuses `rowParts` when it is built. |
| **At most one top-level action** | One action beside the title | A goal has a primary plus one standing button ("Check in again" or "Watch"), approved 10 Nov | Keep the goal spec's pair. Every other detail page has one. (Question 3) |
| **Where a form's exit lives** | One back or cancel in the footer | One closing control, top right (U72 `NAV-FORMS`) | Keep the exit top right. The footer has Back only. Sheets are the exception, with Cancel. (Question 4) |
| **"Close and keep the draft" on an untouched form** | Only where draft persistence exists | Always, on draft forms | "Close" until something is typed. (Question 5) |
| **The readiness panel** (F08) | Move the discussion queue above the readiness history | HB2: the panel sits above the queue | Not changed here. UX1 folds the eight-week row and renames the counts. |
| **Bulk check-in at the top** (F02) | Two equal routes above the queue | K8: the table link under the list | Not this design's question. It is planning's item 2, for Lane. |
| **The phone's page name, said twice** | Don't repeat it in the bar and the title | The phone's top bar names the page (navigation 2.3) | The bar names it once the title has scrolled away. (Question 6) |

---

## 5. Build plan

| # | Item | Size | Depends on |
|---|---|---|---|
| UX2a | **One goal row** (section 1): `rowParts`, `GoalRow`, eight places, MCP fields, the check and the journey | M | Nothing. It can start after UX1 merges, since both touch the agenda |
| UX2b | **One form footer** (section 3): `FormFooter`, labels, errors, "Close" until typed | M | Nothing |
| UX4 | **One page header** (section 2): `PageHeader`, `TaskHeader`, the phone's bar | S–M | UX1's goal title line; UX2b's `TaskHeader` sits on the same pages |

About two and a half releases, in one track: they share CSS and the evals' markup, so two at once would collide. The row comes first because it is what the study's acceptance check 2 tests ("an On track goal with a forecast miss, a stale goal with a last known value, an off-track goal with an unresolved ask").

Each item adds its spec section (`GOAL-ROW`, `PAGE-HEADER`, `FORM-FOOTER`), conformance rows, its rebuild stage notes and Help. The row is a visible change to how lists work, so it gets a What's new entry. The header and footer are polish (`[no news]`) unless Lane wants them announced. All three are core: no switch, and each spec says why. Every list, page and form uses them, so there is nothing to switch off.

## 6. Questions for Lane

**Lane's answers (17 Nov), relayed by planning:** (a) on all seven. Planning decided 4 to 6 on the recommended answers. So:

1. On a phone, status, value and gap come first, and the name has its own line. `design-rules.md` is unchanged.
2. The flag keeps the word "Getting worse", with its "On track today, but…" sentence. The vocabulary is unchanged.
3. A detail page has the primary, one standing button, then "More".
4. A form's exit stays top right (U72). The footer has Back and the primary; sheets have Cancel.
5. A draft form says "Close" until something is typed.
6. The phone's top bar names the page once the title has scrolled away.
7. Build after UX1, as one track: UX2a (the row), then UX2b (the footer), then UX4 (the header). They are in the backlog's "Usability study, 17 Nov" section.

The questions as asked, kept for the record. The recommended answer is first.

1. **A goal row on a phone: what comes first?**
   - (a) Status, value and gap on line 1, then the name on its own full line. This keeps "status first", and the action sits at the right of line 1. *Recommended.*
   - (b) The name first, with status and value under it (the study's order). This changes `design-rules.md`.
2. **"On track" with a forecast miss: what is the flag called?**
   - (a) Keep "Getting worse". The row's reason says "On track today, but the recent trend heads for … against a target of …". *Recommended.*
   - (b) Split it: "Heading short of target" for the on-track case, and "Getting worse" for the further-behind case. Vocabulary, Help, MCP and the import follow.
3. **Buttons in a detail page's header.**
   - (a) As the goal spec says: one primary, at most one standing button ("Check in again" or "Watch"), then "More". Other detail pages have one. *Recommended.*
   - (b) Strictly one button. "Watch" and "Check in again" move into "More" when there is a primary.
4. **Where a form's exit lives.**
   - (a) Top right, as now (U72). The footer has Back and the primary; sheets have Cancel. *Recommended.*
   - (b) Move the exit into the footer, beside the primary (the study's layout). This changes `NAV-FORMS`.
5. **"Close and keep the draft" before anything is typed.**
   - (a) Say "Close" until something is typed. *Recommended.*
   - (b) Keep it as today: always "Close and keep the draft" on draft forms.
6. **The page's name on a phone, said twice.**
   - (a) The top bar shows it only once the title has scrolled away. *Recommended.*
   - (b) Leave it as today.
7. **When to build.**
   - (a) After UX1 merges, as one track: the row (UX2a), then the footer (UX2b), then the header (UX4). *Recommended.*
   - (b) Only the row for now; decide the header and footer later.
   - (c) Hold all three until the off-site.
