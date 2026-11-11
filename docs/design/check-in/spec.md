# The check-in: the build spec

11 November 2026. The design and its evidence are in `README.md` beside this file; wireframe numbers refer to it. Nothing here is built. A build session reads this with `docs/design/navigation/spec.md` 2.4 (NV3), `docs/design/goal/spec.md` (GT1, GT2), `docs/design/onboarding/spec.md` 2.7 and rule 4 (OB2), `docs/design/feature-toggles/spec.md` (FT1, FT2), `docs/design/goal-entry/spec.md` 2.13 and rule 13 (GE9) and `docs/design/metrics-2/spec.md` 2.8 (MT4). Where this spec and one of those disagree, README "What this changes in rounds 1 and 2" says which stands.

Words used throughout: **rhythm on** means `Cycle.checkInWeeks` is 1 (FT1); **rhythm off** means 0. **Reviews on** means the `reviews` module is not in `Workspace.modulesOff` (FT2). Until FT1 and FT2 land, rhythm and Reviews are on.

## 1. Routes

| Route | Screen | Frame |
|---|---|---|
| `/check-in` | The queue (2.1) | The app's frame; narrow (620 px) |
| `/check-in?start=1` | Straight into the first goal to do (Home's "Start check-in"); with nothing to do, the queue | — |
| `/check-in/<goalId>` | One goal: the number or stages (2.2) | Focus mode |
| `/check-in/<goalId>/why` | The story step (2.3) | Focus mode |
| `/check-in/<goalId>/none` | No new number this week (2.5) | Focus mode |
| `/check-in/<goalId>/correct` | Correct or add a week: the week still to choose (2.7) | Focus mode |
| `/check-in/<goalId>/correct/<week>` | The same, for that week. `<week>` is written `2026-W44` (GE9's `weekCode`) | Focus mode |
| `/check-in/table` | All your numbers (2.6) | Focus mode; 920 px |
| `/check-in/done` | The confirmation (2.8) | The app's frame; narrow |

Query: `?walk=1` on a goal's routes means "then the next goal to do" (set by "Start with…" and kept across steps); without it, posting returns to where the person came from (the queue, the goal's page, Home). `?again=1` opens a second check-in on a goal already checked in this week. `?need=1` on `/why` opens the ask field (GT1's "Ask for a decision or help"). `?for=1` is not needed: who is checking in is the viewer.

### Redirects

| From | To |
|---|---|
| `/quick-check-in` | `/check-in/table` |
| `/check-in/<goalId>` when the goal has a check-in this week and no `?again=1` | Stays, and opens as a second check-in with 2.2's first line (it never opens a correction by itself) |
| `/check-in/<goalId>/why` with no number typed | `/check-in/<goalId>` |
| `/check-in/<goalId>/correct/<week>` for a week after this one, before week 1, or not a week | `/check-in/<goalId>/correct` with "That week hasn’t happened yet." / "“{raw}” isn’t a week." |
| `/check-in/done` with nothing posted in this tab | `/check-in` |
| Any check-in route on a stopped or done goal | The goal's page |

Each step is a history entry; the browser's Back goes from `/why` to the number step with what was typed still there. The one way out of a form is the header's "Close and keep the draft" (navigation 2.5); its menu also holds "Discard the draft".

## 2. Screens

Shared by every form screen:

- **The header.** "Check-in · Week {n} · {dates with year}" (`weekSays(cycle, n, 'field')`, GE9 rule 13); under it "Goal {i} of {n}" in a walk, else the goal's title when the title is not the h1. A correction: "Correct a check-in" / "Add a check-in", and the goal's title.
- **The saved line**, at the top of whatever opens after a post: the status as shape and word, "**{goal}** saved for week {n}: {value}." (stages: "{k} of {n} stages"; no number: "no new number") and "Undo" (rule 8). `role="status"`. It stays until the next post or until the person leaves the check-in.
- **The read-back**, a block labelled "This will post" directly above the footer on the screen that posts (rule 4 gives its lines). It is drawn as soon as nothing is left to fix on the number; it is never a step.
- **The footer.** "Back" (not on the first step), then the primary action. Before the number can be judged the primary says "Continue"; once it can, it says what it will do. With a Check unanswered or a Must fix present, pressing it posts nothing, moves focus to the first one, and a line under the footer says rule 3's words.
- **Levels** are drawn as in wireframe 4: a Check is a block with the warning mark, the word "Check", the question in bold, and two plain buttons; a Must fix is a block with the off-track wash and a full outline on the field, the warning mark, "Must fix", what was read in bold and the fix. Neither uses a status shape.

### 2.1 The queue (`/check-in`). Wireframes 1 and 8

Rows come from rule 9 (`checkInQueue`). Content, in order:

| # | Rhythm on | Rhythm off |
|---|---|---|
| 1 | The saved line, when arriving from a post | The same |
| 2 | Title "Check-in" | Title "Check in on a goal" |
| 3 | "Week {n} · {dates with year}. Check-ins are due by {weekday} {date}{, tomorrow \| , today}." After the day: "…were due on {weekday} {date}." | "Week {n} · {dates with year}. Check in when there’s news; nothing is due." |
| 4 | Primary: **"Start with {short title}"** → that goal with `?walk=1`. One to do: **"Check in on {short title}"**. None to do: no button | No primary button |
| 5 | "To do this week · {n}" | "No check-in this week · {n}" (never-checked-in goals first, then oldest first) |
| 6 | "Type all your numbers in one table" → `/check-in/table`, when two or more number goals are in group 5 | The same |
| 7 | "Done this week · {n}" | "Checked in this week · {n}" |
| 8 | Stale drafts (rule 10), one line each: "A draft for week {m} on {goal} was never posted ({value}). Add it to week {m} · Discard it" | The same |
| 9 | "Add or correct an earlier week" → a sheet: your goals as a plain list (a person's own goals are a short fixed list; over 20, round 1's find-and-pick over "Mine"), then `/check-in/<goal>/correct` | The same |

**A row in group 5:** line 1 the title (a link to the goal); line 2 the status as shape and word, then rule 9's `said`: "last week · 1.8%, near the 2.0% limit" / "last week · 75%, 6 pts behind plan" / rhythm off: "as of week 45 · 1.8%" / nothing after "No check-in yet"; line 3 only for a draft: "Draft kept: {value}, typed on {weekday}". Button: "Check in"; with a draft "Carry on"; never checked in "Post the first check-in". A goal that has not started (`notStarted`, GE9) is not listed; under the group: "{k} start later: {title} in week {n}."

**A row in group 7:** line 2 the status, "{value} · checked in {weekday d Mon}" (today: "checked in today"); a check-in posted for the owner: "· by {name}, for you". Line 3 the link "Correct it" → `/check-in/<goal>/correct/<this week>`. Button: "Check in again" → `/check-in/<goal>?again=1`.

**Empty and error states** are NV3's four (navigation 2.4), with these words where they differ:

| When | Says |
|---|---|
| Nothing to do, some done (rhythm on) | "You’re all set for week {n}." and group 7 |
| You own no goal | "You don’t own a goal in {ws}, so there’s nothing to check in." · "See the goals you watch" · "Set up a goal". No ring, no "0/1" (K14) |
| Week 0 | "Check-ins start in week 1 ({dates}). The first are due by {weekday} {date}." Rhythm off: "Check-ins start in week 1 ({dates})." |
| The cycle is over | "{cycle} has ended. Check-ins start again with the next cycle." |
| The save failed | The row keeps its draft; a line at the top: "That didn’t save. Your draft is kept. Try again." |

**Primary action:** row 4.

### 2.2 One goal: the number (`/check-in/<goalId>`). Wireframes 2, 3, 4

Content, in order:

1. The saved line, when there is one. The header.
2. The goal: a small line "{level} · {team}", the title (h1), then the status as shape and word and "at the week {m} check-in · {value}". Never checked in: OB2's head ("First check-in").
3. **Only on a second check-in this week:** "You checked in on {weekday d Mon}: {value}, {status}. This adds a second check-in for week {n}. If that one was wrong, " + the link "correct it instead" (→ `/correct/<this week>`, carrying the number typed).
4. **Only for an admin who isn't the owner:** the block of 2.9.
5. MT4's source block, when the goal has one (metrics-2 2.8), unchanged.
6. The question "What’s the number this week?" and the field, focused, with the unit. Under it: "Week {m} ({dates}): {value with unit}." (never checked in: "This sets where it stands today.", OB2) and "Where to get it: {source}." (no "Typed in by hand."). The goal's definition, when it has one, as today.
7. Must fix or Check blocks (rule 2), under the field, in rule 2's order, one at a time.
8. Once the number can be judged: one sentence, "**{gap}** ({plan} planned for this week). Status {shape and word}, {from the numbers | your call}. " + the link "Change". "Change" opens the status choices in place under the sentence (not a sheet): the three statuses as rows, "from the numbers" beside the calculated one; choosing a greener one adds the field "Why is it better than the numbers?" (Must fix until 10 characters). The forecast line and "Show chart" stay as today, under the sentence.
9. **When rule 1 says a story is needed and last time's can be carried:** the label "You said {last week | in week {m} | earlier this week}", then the reason ("**{cause}.** {why}") and the path ("**Back on plan by week {b} ({dates}).** {what}" or "**{state}.** {what}") at normal weight with no rule beside them. Then, as today, "Answered by {name}: {answer}" when the goal's ask was answered since, and "Still asking: {ask}" with the tick "Keep this request open" (with Reviews off the tick's words are unchanged; it never names a review). When the week given has passed: "The week you gave has passed, so you’ll pick a new one." and the carry is not offered (the story step opens instead).
10. The read-back (rule 4).
11. On plan only: the links "Add a next step" (opens one field, as today) and "Ask for a decision or help" (opens 2.3's ask fields in place; GT1's button lands here with it open when the goal is on plan).
12. The footer: at the left the quiet link "No new number this week" (number goals; hidden once a number is typed) → `/none`. Primary, by rule 1's `path`:

| `path` | Primary | Also |
|---|---|---|
| The number isn't usable yet | "Continue" (does nothing but show rule 3's line) | — |
| `post` (on plan, or nothing more needed) | **"Post check-in"** | — |
| `carry` (a story is needed, last time's can be carried) | **"Still true: post check-in"** | The plain button "Something changed" → `/why` with last time's words in the fields |
| `story` (a story is needed, none to carry) | **"Continue"** → `/why` | — |

Enter in the field presses the primary.

**Stages** (wireframe 9) replace 6 to 8: "Where does each stage stand?"; done stages folded into one line as today ("{k} stages done: {names}. Show"); each open stage a block: its name, "Due week {d} · {dates with year}", and three choices as rows: "On schedule" (not offered once its due week has passed), "Done" (opens "This week" and "An earlier week" with the week picker limited to weeks up to this one; OB2's ticked stages read "Done in week {n}"), "Late: now expected in" with the week picker (`weekChoices(cycle, week, 'late', from)`, from the later of next week and the week after its due week, to the cycle's last week) and under it "{k} weeks after it was due." Then the sentence "**{k} stage{s} slipping | late | All on schedule.** Status {shape and word}, from the stages. Change".

**A keep-in-range goal:** as a number goal; the sentence uses `gapText`'s words ("Inside the 2.0% limit", "Near the 2.0% limit: inside the warning margin", "Over the 2.0% limit: two weeks running makes it off track").

**Primary action:** the table above.

### 2.3 The story (`/check-in/<goalId>/why`). Wireframe 3

Content, in order:

1. The header, with "· step 2 of 2". One line: "**{short title}: {value}, {gap}.** {status}".
2. **Why** (when rule 1 needs a reason): the question "Why is it behind?" / "Why is it ahead?" / stages "Why is it late?"; the causes as six plain choices (rectangular buttons, one pressed; `CAUSES_BEHIND` / `CAUSES_AHEAD`, unchanged); one box, three lines, placeholder as today.
3. **What happens next** (when the status is at risk or off track): the four choices as rows, one chosen ("I have a plan" to start): "I have a plan · And a week it’s back on plan"; "Still investigating · No date yet"; "I need a decision or help · Someone else has to act"; "The target should change · The plan no longer fits".
4. One box whose label follows the choice: "What changes?" / "What are you looking into?" / "What’s needed?" / "Why, and to what?".
5. By the choice:
   - a plan: **"Back on plan by"**, the week picker (GE9 2.13) from next week to the cycle's last week; named weeks "Next week", "The end of this quarter", "The end of {year}"; under the closed field `weekIs`'s line and, when last time gave a week, "Last week you said week {b}{ too}."
   - a decision or help: **"Who can decide or help?"**, round 1's find-and-pick for a person (suggestions: the goal's parent's owner, the team's lead, people asked before on this goal), the viewer left out; then "If it comes, back on plan by · optional", the week picker; then the link "Waiting on a decision already asked for another goal?" as today.
   - otherwise nothing.
6. The links "Add a next step" and, unless the choice is a decision or help, "Also ask for a decision or help" (one field, with the hint "Shown at the top of the goal{ and in reviews}": the last three words only while Reviews is on).
7. Well ahead (`asksTarget`): the hint as today, "Well ahead of plan. If the target should move, change it after posting…".
8. The Check `story-unchanged`, when last time's words are in the fields untouched (rule 2).
9. The read-back. The footer: "Back", **"Post check-in"**.

**Errors** are Must fix lines under their field, in today's words: "Pick a cause, then write a sentence." · "Write a sentence about what happened." · "Say a few words about it." · "Pick the week it’s back on plan, or choose another answer if you don’t know yet." · "Pick who it goes to." · "Write a sentence so people watching know why."

**Primary action:** "Post check-in".

### 2.4 After a post

- In a walk with goals left: the next goal's number step, with the saved line.
- In a walk with none left, or after the table: `/check-in/done`.
- Not in a walk: back to where the person came from, with the saved line there (the queue; the goal's page, where it sits above the summary and the new point lands on the chart as today's `?posted=1` does).
- "Undo" (rule 8) takes the check-in back, withdraws an ask it raised, restores the draft and opens that goal's form at the step that posted. Then a line: "Taken back. Nothing was posted for {goal}."

### 2.5 No new number this week (`/check-in/<goalId>/none`). Wireframe 9

1. The header; the goal as in 2.2.
2. "Why is there no new number?" · "a few words": three choices as rows, "It isn’t measured yet this week", "The source is down or wrong", "Nothing happened to measure"; one line of text (Must fix under 5 characters unless a choice is made: either the choice or the words are enough; both are kept).
3. The Check `no-number-run` (rule 2) when it would be the third week running.
4. The read-back: "**Week {n}: no new number.** It still says {last value}, as of week {m}." (never had one: "It has no number yet.") · "Status stays {shape and word}, your call. Change" (the status choices in place; a goal that was at risk or off track keeps last time's story, shown as in 2.2 item 9, and "Something changed" opens `/why`) · "It counts as this week’s check-in. The chart shows a gap for week {n}."
5. Footer: "Back to the number", **"Post check-in"**.

### 2.6 All your numbers (`/check-in/table`). Wireframe 5

Rows from rule 11 (`tableRows`). Content, in order:

1. Header: "All your numbers · Week {n} · {dates with year}"; under it, rhythm on: "Due by {weekday} {date}. An empty row is left to do." Rhythm off: "An empty row is left as it is." At the right "Close and keep the drafts".
2. The table: a head row "Goal · This week · Reads as" (hidden on a phone), then one row per number goal of the viewer's with no check-in this week, in the queue's order.
   - **Goal:** the title (a link); under it "Plan {plan} · week {m}: {last}" (range: "Limit ≤ {limit} · week {m}: {last}"; never checked in: "· first check-in").
   - **This week:** a field with the unit inside it; a sourced number in the faint ink (MT4).
   - **Reads as:** empty until typed; then the status as shape and word and the gap in words; with a Check unanswered: "Not judged yet"; with a Must fix: nothing.
   - **Under the row**, at most one of: a Must fix block; a Check block; the carried story ("You said last week" and one line of it, cut with "…") with the tick **"Still true this week"** and the link "Something changed"; or the warning mark with "Needs a story before it can post" and the button "Say why". "Something changed" and "Say why" open 2.3 as a sheet titled with the goal; "Done" on the sheet returns to the row, which then says "Story added: {cause}. Back on plan by week {b}." with "Change".
3. A line: "Not in the table: {stages goals, as links to their forms} (stages). Checked in this week already: {titles}. " + the link "Correct one" (the queue's sheet).
4. With sourced numbers: MT4's line "{n} numbers are from their sources; change any that are wrong."
5. The read-back (rule 11's `tableReadBack`).
6. Footer: "Close and keep the drafts", **"Post {n} check-ins"** ("Post 1 check-in"; nothing ready: "Post check-ins", which posts nothing and says the read-back's second line).

**Empty:** one number goal or none to do: "There’s nothing for the table this week." and "Back to Check-in". The table never lists a goal already checked in this week, so it can never replace a posted check-in (K6).

**Primary action:** "Post {n} check-ins".

### 2.7 Correct or add a week (`/check-in/<goalId>/correct[/<week>]`). Wireframe 6

Content, in order:

1. Header "Correct a check-in" (the week has one) / "Add a check-in" (it has none); the goal's title; "Close without saving".
2. **"Which week?"**: the week picker, weeks 1 to this week of the running cycle, each row "Week {n} · {dates} · {value}, {status}" or "· no check-in"; this week is marked "· this week". Under the closed field: "{k} weeks ago. It says {value}, {status}, posted by {name} on {weekday d Mon}." / "{k} weeks ago. It has no check-in."
3. **"The number for week {n}"** (or the stages as in 2.2, limited to weeks up to `{n}`), filled with what the week holds. Under it: "Was {old}. Judged by the {limit | plan} as {it was | they were} in week {n} ({plan at that week})."
4. The sentence: "**{gap} in week {n}.** That week’s status {stays | becomes} {shape and word}{ (why, for a range)}." and "Change" for the call.
5. **The story of that week**, only if the corrected week needs one (rule 1, judged at that week): if the week already has one, "Kept from week {n}: “{cause}. {why}…”" and the link "Change it" (opens 2.3's fields in place, with the path's week picked from the weeks after `{n}`); if it has none, 2.3's fields in place.
6. **"Why are you changing it?"** (adding: "Why is it being added now?"): one box; under it "Shown beside week {n} in History." Must fix under 10 characters: "Say why, in a sentence, so anyone reading week {n} later knows."
7. Checks (rule 2) on the number, judged against the week before `{n}`.
8. **"What this changes"** (rule 6), a list of label and sentence. Drawn once the number and the reason are usable.
9. Footer: "Cancel", **"Save the correction"** / **"Add the check-in"**.

After saving: back to where the person came from, with the line "Week {n} corrected: {old} is now {new}." / "Week {n} added: {value}." and "Undo". The goal's History (GT2) then shows, on that week's row: "Corrected {weekday d Mon} by {name}: was {old}. “{reason}”" or "Added later, on {weekday d Mon}, by {name}: “{reason}”".

**Errors**

| When | Says |
|---|---|
| Nothing was changed | The button posts nothing: "Nothing is different from what week {n} already says." |
| The week is in a cycle that has ended | Not offered. By address: "{cycle} has ended; its check-ins can’t be changed here." |
| The goal's plan was changed after that week | Under item 3: "The plan was changed in week {p}. Week {n} is judged by the plan before that." |
| A newer check-in this week exists and this week is being corrected | The newest is the one corrected; under item 2: "Week {n} has 2 check-ins. This corrects the newer one, posted {when}." |

**Primary action:** "Save the correction" / "Add the check-in".

### 2.8 The confirmation (`/check-in/done`). Wireframe 7

1. Title, from `weekCompletion` (unchanged): rhythm on and complete, "Week {n} is checked in"; otherwise "{done} of {total} checked in for week {n}"; rhythm off, "{k} check-in{s} posted".
2. One line: complete, "All {n} of your goals have a check-in for week {n} ({dates with year}){, a day before | , on | , {k} days after} {weekday} {date}." (the last part only with rhythm on); otherwise `weekDoneText` (FT1's wording with rhythm off).
3. Primary: **"Check in on {next}"** while anything is to do (rhythm on); else **"Back to Home"**.
4. "Posted just now · {k}": one row per check-in posted in this tab since the queue was opened: the status as shape and word; the title; a line "{value} · {gap}" then, as they apply, "· last week’s story, still true", "· back on plan by week {b}", "· asked {name}: “{ask}”", "No new number this week: “{why}”. Still {last}, as of week {m}"; at the right "Undo" (rule 8), or nothing once it can't be undone. After the table, above the rows: "Undo all {k}".
5. From the table, when rows waited: "{k} rows weren’t ready, so they weren’t posted. They’re kept in the table." (link).
6. "What happens next", each line only when true:
   - "{name} sees your ask on {her | his | their} Home and on the goal." (one line per person asked)
   - Reviews on: "{These are | {goal} is} in {review} on {weekday d Mon}." for the next session that walks them (`upcomingSessionWeek`); goals in none: nothing.
   - Rhythm on and complete: "{k} weeks in a row with every check-in in by {weekday}." (two or more); posted after the day: "Posted after {weekday}, so this week doesn’t count towards the run."
   - Rhythm on, not complete: "Still to do by {weekday} {date}: {titles}."
7. Two hints: "Undo takes a check-in back and reopens it as a draft. Once you leave this page, use “Correct it” on Check-in or on the goal." · "Each goal’s page now says “Updated today · week {n}”, and its History starts with this check-in."

### 2.9 Checking in for the owner

On every form screen, when the viewer is an admin and not the owner, a block above the number: "**You’re checking in for {owner}.** It is recorded as “{you}, for {owner}”, {owner's first name} sees it on {her | his | their} Home, and it doesn’t count towards {her | his | their} streak." (the last clause only with rhythm on) and the field **"Why you, not {first name}?"** (Must fix under 5 characters). The reason is the first diff of the change-log entry ("For {owner}: {reason}"). The door is the goal's "…" menu, "Check in for {first name}" (GT1); an admin's `/check-in` lists only their own goals.

Anyone else who types the address: "{Owner} or an admin can check in on this goal." and "Open the goal".

## 3. Who sees what

Consistent with R1 as the engine enforces it today; each line names the action. One gap is flagged, not filled.

| Thing | The owner | An admin | Anyone else | Enforced by |
|---|---|---|---|---|
| The queue, the table | Their goals | Their own goals only | The "you don’t own a goal" state | `checkInQueue` lists `ownerId === viewer` |
| Post a check-in; a second one | Yes | Yes, for the owner (2.9) | No button | `planChanges` (`changeset.ts`: `canChange`, "Only {owner} (its owner) or an admin can change “{goal}”.") |
| No new number | Yes | Yes, for the owner | No | `planChanges` |
| Correct or add a week | Yes | Yes | Not shown | `planChanges` |
| Undo a post | What they posted | Any | No | `deleteCheckIn` (`removal.ts`: its author or an admin, while it is the goal's newest); a correction or a table post: `undoImport` |
| Raise an ask from the check-in | Yes | Yes, for the owner | No | `planChanges` → `requestsAfterCheckIn` |
| Link to another goal's decision | Yes | Yes | No | `linkRequest` |
| "Keep {k} decimal places for this goal" | Yes | Yes | No | `planChanges` (a goal edit) |

**The gap:** today `CheckInFlow.tsx:74` refuses an admin while the engine allows one. This spec follows the engine (decision 3). A deputy, or a team's lead, would be a new right and is not added: it is written into `spec/` as a requirement, "delegation: a person may name someone to check in for them between two dates".

A button that would be refused is not drawn.

## 4. Rules for `src/domain`

All in `src/domain/checkin.ts` unless said; pure; each takes only what it reads (a goal, that goal's own check-ins, the cycle's `startDate`, `weeks`, `reviewDay` and `checkInWeeks`, the week), never the snapshot. Each has tests from its table, a section in `src/spec/rules.ts` and conformance rows. They restate nothing: the judgement is `evaluate`, the number check is `valueProblem`, the asks are `asks.ts`.

The example throughout: cycle 2026 (starts Mon 22 Dec 2025, 53 weeks), today Wed 11 Nov 2026, week 46; Flaky test rate (range, at most 2.0%, warn within 0.4, 1 decimal; week 45: 1.8%, At risk, "Delivery slower", back on plan by week 48); Test suites split (number, plan 81% in week 46; week 45: 80%); Contract tests (count, 4 to 40 pairs; week 45: 29).

### Rule 1. What a check-in still needs, and which way it goes: `checkInPath(goal, cycle, week, draft, own)`

Returns `{ e: Evaluation, previous, path: 'number' | 'post' | 'carry' | 'story' }`.

- `previous` is rule 5's.
- `path` is `'number'` while any of `VALUE_CODES` is in `e.codes`; `'post'` when no reason and no path back is needed; `'carry'` when one is needed and today's `canCarry` holds (the last check-in has the cause, the why and the path this one needs, its week for being back on plan is still ahead, and the draft's words are not the owner's own); else `'story'`.
- Today's `canCarry`, `fromLast` and `stillTrue` move here from `CheckInFlow.tsx:268-352` unchanged, so the table uses them too.

| Given | `path` |
|---|---|
| Test suites, typed 81 | `post` |
| Test suites, typed "lots" | `number` |
| Flaky, typed 1.9 (near the limit; last week's story fits) | `carry` |
| Flaky, typed 1.9, last week's "back on plan by" was week 45 | `story` |
| Flaky, typed 1.2 (inside the limit) | `post` |
| Contract tests, typed 31 (4 behind); last week on plan, no story | `story` |
| Contract tests, typed 300, the Check answered yes | `story` (ahead needs a reason) |
| A stages goal, one stage 2 weeks late, no earlier story | `story` |

### Rule 2. The levels: `checkInLevels(goal, cycle, week, draft, own, answers)`

Returns `{ mustFix: { field, says }[], checks: { id, field, question, yes, no, key }[] }`, in the order the screen asks; `unanswered(checks, answers)` is those whose `answers[id] !== key` (goal-entry rule 3's shape). `key` is the value the question is about, so a changed value asks again.

**Must fix** are `evaluate`'s codes with their existing words (`MISSING_TEXT`, `valueProblem`'s blocking texts, `notNumberText`, `precisionProblem`), plus: `help-nobody` ("Pick who it goes to."), and on a correction `no-reason`.

**Checks**

| id | When | Question | Yes | No |
|---|---|---|---|---|
| `far-from-last` | `valueProblem`'s last case: more than 3 times or under a third of rule 5's last number | "Week {m} was {last with unit}. Is {value with unit} right?" + ", ten times last week’s number" style tail when the ratio is a whole power of ten | "Yes, {value} is right" | "Change the number" |
| `far-outside-plan` | `farOutside` (unchanged) | "That’s far outside this goal’s plan ({start} to {target}). Is {value} right?" | the same | the same |
| `past-target` | A count past its target | "That’s past the target of {target}. Is {value} right?" | the same | the same |
| `over-100` | Over 100% where the goal isn't a share | "That’s over 100%. Is {value} right?" | the same | the same |
| `same-as-last` | The value equals rule 5's last number, on a goal whose number is expected to move (a number goal not yet at its target; a range goal never asks) | "The same as week {m}: {value}. Did you measure it again this week?" | "Yes, measured again" | "No new number this week" (→ 2.5) |
| `story-unchanged` | `unchangedStory` returns any part (today's rule, unchanged) | "{The reason and the plan are | The reason is | The plan is} word for word what you said {when}. {Are they | Is it} still true this week?" | "Yes, still true" | "I’ll change {them | it}" (focus to the first carried field) |
| `no-number-run` | Posting "no new number" when the goal's last two check-ins had none | "This would be the third week with no new number. Is {source | the number} still the right way to measure this goal?" | "Yes, it’s coming" | "Change how it’s measured" (→ the goal's edit page; the draft is kept) |
| `rebase` | OB2's `rebaseOffer` (unchanged) | OB2's words | "Start from {value}" | "Keep {start} and say why" |

Only the first applicable number Check is asked (their order above), as `valueProblem` returns one today. MT4's `stale`, `jump` and `revised` stay in the module's block and are added to `checks` through the `checkin.number` place (section 5), so the footer's line counts them.

- `evaluate` gains nothing; `Missing` loses `story-unchanged` as a blocking code only in what the screens read: `evaluate` keeps returning it (the import and the tools still refuse a carried story with no "still true"), and `checkInLevels` presents it as a Check whose "yes" sets `draft.stillTrue`.
- Answers are saved with the check-in's change-log entry as diffs: `{ field: 'Asked', from: '{question}', to: '{the answer’s label}' }`. No column.

| Given | Then |
|---|---|
| Flaky, typed 18 | Check `far-from-last`: "Week 45 was 1.8%. Is 18.0% right?" |
| → "Yes, 18.0% is right", then the number changed to 19 | Asked again (the key changed) |
| Flaky, typed 1.8 | Nothing (a range goal) |
| Test suites, typed 80 (last week 80) | Check `same-as-last` |
| Contract tests, typed 41 | Check `past-target` |
| Contract tests, typed 300 | Check `far-outside-plan` only (the first that applies) |
| Contract tests, typed −5 | Must fix: "It can’t be below zero pairs: this goal counts things." |
| Flaky, typed 2.15 | Must fix, with "Keep 2 decimal places for this goal" as today |
| "Something changed", nothing edited | Check `story-unchanged`: "The reason and the plan are word for word what you said last week. Are they still true this week?" |
| A greener call, reason "ok" | Must fix: "Write a sentence so people watching know why." |
| Base image build time, "no new number" after two such weeks | Check `no-number-run` |

### Rule 3. Whether the button acts: `stepState(mustFix, unanswered)`

Returns `{ go, focus, says }`.

| Given | Says |
|---|---|
| One Must fix | "1 thing to fix above: {field}." |
| Two or more | "{n} things to fix above: {first two fields}{ and {k} more}." |
| No Must fix, a Check unanswered | "Answer the question above first." |
| Neither | Goes on |

### Rule 4. The read-back: `checkInReadBack(goal, cycle, week, draft, e, previous, mode)`

`mode` is `'new' | 'again' | 'carry' | 'none'`. Returns lines, each `{ strong?, text }`, at most five:

1. "**Week {n}: {value}, {gap}**" + " ({plan} planned for this week)." (range: "({limit words})."; stages: "**Week {n}: {k} of {s} stages done, {slipping words}.**"; none: "**Week {n}: no new number.** It still says {last}, as of week {m}.") On a second check-in it starts "**A second check-in for week {n}:**".
2. "Status {status}, {from the numbers | your call}." A greener call: "Status {status}, your call: “{greenerWhy}”. The numbers say {calc}."
3. A reason, when one is posted: "{cause}: “{why, cut at 80 characters}”"; carried: "The reason{ and the plan} as you gave {them | it} {when}, said to be still true this week."
4. A path, when posted and not carried: "Back on plan by week {b} ({dates with year}): “{what}”" / "Still investigating: “{what}”" / "Asking {name}: “{what}”{, back on plan by week {b} if it comes}" / "The target should change: “{what}”".
5. As they apply: "Next step: “{next}”." · MT4's "{value}, from {source}, measured {when}." · for the owner (2.9) "Recorded as {you}, for {owner}."

On plan with nothing else: line 3 is "On plan, so there’s nothing more to say."

| Given | Lines |
|---|---|
| Test suites, 81 | "Week 46: 81%, on plan (81% planned for this week)." · "Status On track, from the numbers." · "On plan, so there’s nothing more to say." |
| Flaky, 1.9, carried | "Week 46: 1.9%, near the 2.0% limit (inside the warning margin)." · "Status At risk, from the numbers." · "The reason and the plan as you gave them last week, said to be still true this week." |
| Contract tests, 31, new story | "Week 46: 31 pairs, 4 pairs behind plan (35 pairs planned for this week)." · "Status At risk, from the numbers." · "Delivery slower: “Two were reverted and redone.”" · "Back on plan by week 49 (30 Nov–6 Dec 2026): “Pair on the last nine.”" |

### Rule 5. What a new number is compared with: `previousFor(own, week)`

The newest check-in of the latest week before `week` (and, for the last *number*, the newest with a value among weeks before `week`). A check-in of the same week is never "last week". Used by rule 2, rule 4, the form's "Week {m}: {value}" line, and in `src/domain/scorecard.ts` and `goalPage.ts` for "vs last week" (K2). `lastValueOf` keeps its name and takes `week`.

`earlierThisWeek(own, week)` is the newest of this week's, for 2.2's line 3.

| Given | Then |
|---|---|
| Weeks 44: 1.9; 45: 1.8; 46: 18.0 then 1.9 | For week 46: `previousFor` is week 45's 1.8. The goal's page: "VS LAST WEEK · 0.1 pts worse · was 1.8% in week 45" |
| The same, a new number typed as a second check-in | Compared with 1.8; line 3 says "You checked in on Wed 11 Nov: 1.9%, At risk." |
| Week 45 had no number (rule 7), week 44: 10 | The last number is week 44's: "Week 44 (26 Oct–1 Nov): 10 min." |
| No earlier week | `null`: "This sets where it stands today." |

### Rule 6. What a correction changes: `correctionEffect(goal, cycle, week, own, target, after, reviewsSaw)`

In `src/domain/correction.ts` (new). `target` is the week corrected; `after` the check-in as it would be saved (from `toCheckIn` on `goalAsOf(goal, target)`); `reviewsSaw` is `{ review, by, at }[]` for decisions on this goal in `target` (passed in by the screen from the Reviews module's rule, empty while Reviews is off). Returns rows `{ label, text, changed }`, always in this order, computed by running the existing rules on `own` and on `own` with the week's newest replaced (or added):

| Label | From | Says |
|---|---|---|
| "Week {t}" | the two records | "{old} becomes {new}. {old status} becomes {new status}. The {old} stays in History as “corrected”." / adding: "{new}, {status}. Marked “added later”." / status unchanged: "…Its status stays {status}." |
| "Today’s status" | `goalStatus` before and after | "No change: {status}, from the week {m} check-in." / when `target` is the newest week with a check-in: "{old} becomes {new}." |
| "The trend" | `goalTrend` before and after | "No change: “{word}”." / "“{old}” becomes “{new}” ({the last four numbers})." |
| "{quarter} so far" / "{quarter}" | `quarterResult` for the quarter holding `target`, before and after | Running: "No change." / "{old words} becomes {new words}." Closed: "{quarter} closed in week {q}: {old result} becomes {new result}. It will be marked “corrected {date}”." / "No change. {earlier quarter} closed in week {q} and isn’t touched." |
| "Who saw the old number" | `reviewsSaw`; omitted when empty or Reviews is off | "{name} looked at week {t} in {review} on {d Mon}. That record stays, marked “corrected since”." |
| "The streak" | rule 12; omitted with rhythm off | "No change: a correction is never an on-time check-in." |
| "An ask" | `requestsAfterCheckIn` on the corrected record, only when `target` holds the goal's newest check-in | "Your ask to {name} stays open." / "…is withdrawn, as the corrected check-in no longer makes it." |

**The rule of its day:** `after` is judged with `goalAsOf(goal, target)`'s plan and, once round 3's settings exist (CF), the thresholds in force in `target`. Nothing about today's plan or thresholds is read.

| Given (Flaky: 43: 2.1, Off; 44: 1.9, At risk; 45: 1.8; 46: 1.9) | Rows that change |
|---|---|
| Week 44 corrected to 2.4 | Week 44: "1.9% becomes 2.4%. At risk becomes Off track…"; the trend; nothing else |
| Week 46 corrected to 1.2 | Week 46; Today's status: "At risk becomes On track."; the trend |
| Week 30 corrected, Q3 (weeks 27 to 39) closed as Met, the new number breaches for two weeks | "Q3 closed in week 39: Met becomes Not met. It will be marked “corrected 11 Nov”." |
| Week 44 added on a goal with none that week | Week 44: "1.9%, At risk. Marked “added later”."; The streak: "No change…" |
| Week 44 corrected to 1.9 (the same) | Nothing changes: the button says so (2.7) |

### Rule 7. A check-in with no number: `noNumberDraft` and what reads it

- `Draft` gains `noNumber?: { why: 'not-yet' | 'source' | 'nothing' | null; says: string }`. With it set, `evaluate` skips the value codes; `calc` is the previous check-in's `calculated` (none: `on`); `status` is `draft.status ?? previous.status`; a reason and a path are needed as the *status* requires (at risk or off track needs the path; the cause and why are carried from `previous` or asked).
- `toCheckIn` writes `value: null`, `stages: null`, `why` = "No new number: {choice’s words}{. {says}}" when no other reason is posted, else the reason with the no-number line kept in the change-log diff `{ field: 'Number', from: '—', to: 'No new number: …' }`.
- `isNoNumber(c, goal)` is `goal.kind !== 'milestone' && c.value == null`.
- Readers, each already filtering `value != null` for numbers (`trend.ts:planGaps`, `status.ts:assessPosted`'s history, the charts): unchanged. `goalStatus` uses the newest check-in's `status` as today; `assessPosted` takes the newest *valued* check-in for `calc`. The scorecard's first cell says "{last} · as of week {m}" with the warning mark and "No new number in week {n}".
- `weekProgress.done` counts it. `daysWithoutUpdate` counts it (it is an update). `onTimeStreak` counts it.

| Given | Then |
|---|---|
| Base image build time, week 45: 10 min, On track; week 46 "The source is down or wrong" | Week 46: value null, status On track, calculated On track; the goal reads "On track · 10 min, as of week 45"; done for week 46 |
| Flaky (At risk), no number, nothing else said | Carried story offered as in 2.2; without it, the path is a Must fix |
| A stages goal | Not offered |
| The import: a Check-ins row with Value empty and a new column **No number** = "yes" and Why | The same record; without "No number", an empty Value is still "Week {w} needs a Value" |

### Rule 8. Undo: `undoable(checkIn, own, actor, kind)` and `undoPost`

- A new or second check-in: undoable while `deleteCheckIn` would allow it (its author or an admin; it is the goal's newest). `undoPost` is `deleteCheckIn`'s commit; the screen restores the draft from the record (`draftFrom`).
- A correction, an added week, or a table post: saved through the engine with its own `importId` (`via: 'bulk'`), undone with `undoImport`, which restores what each replaced and refuses, naming the rows, once something later depends on them.
- The screens offer it only on the saved line and the confirmation; the goal's History keeps today's "Delete this check-in" for its newest.

| Given | Then |
|---|---|
| Rhea posts 18.0% for Flaky and presses Undo on the next goal's saved line | The check-in is removed (kept, hidden); her draft "18" reopens on the number step |
| She posts, then Amara comments on the goal, then Undo | Allowed (a comment doesn't depend on it) |
| She posts for week 46, then the table posts a second for the same goal (can't: the table leaves it out) | — |
| A correction of week 44, then Undo | Week 44 says 1.9% again; the log keeps both entries |
| An admin's check-in for Rhea; Rhea presses Undo on her queue's saved line | Not offered to her (she isn't its author); the done row offers "Correct it" |

### Rule 9. The queue: `checkInQueue(personId, goals, checkIns, cycle, week, drafts)`

Extends FT1's `checkInList` (one rule, not two): returns `{ todo: Row[], done: Row[], later: { goalId, fromWeek }[] }`, each row `{ goalId, status, said, lastWeek, draft: { value, at } | null, first: boolean, postedAt, byOther: personId | null }`.

- `goals` are the person's live goals (not done, not stopped); a goal with `notStarted` goes to `later`.
- `todo`, rhythm on: `weekProgress(...).due` in today's order; rhythm off: every goal with no check-in this week, never-checked-in first, then oldest `lastWeek` first.
- `said` comes from `gapText` on the last check-in: "{value}, {gap in lower case}".
- `drafts` is passed in by the screen (`{ goalId, week, value, at }[]` from the `Prefs` port); the rule only attaches them.

| Given | Then |
|---|---|
| Rhea, rhythm on, 11 Nov | `todo` 5 in the walk's order, CI cost `first`; `done` 2 |
| The same, rhythm off | `todo` 5, CI cost first, then by oldest check-in |
| Tunde | `todo` 0; `done` 2: "You’re all set for week 46." |
| Grace (owns none) | All empty: the "you don’t own a goal" state |

### Rule 10. Drafts: `staleDrafts(drafts, week, own)`

A draft is kept per goal (not per goal and week) with the week it was typed in. Opening a goal's form in a later week with a draft from an earlier one does not fill the field; the queue lists it (2.1, row 8) while that earlier week has no check-in, and "Add it to week {m}" opens `/correct/<m>` with the draft's number. Drafts older than four weeks, or for a week that has since got a check-in, are dropped silently. `drafts.ts`'s key becomes `{ws}:checkin:{goalId}`; an old key is read once and rewritten.

### Rule 11. The table: `tableRows(goals, checkIns, cycle, week, drafts, answers)` and `tableReadBack(rows)`

- A row per number goal in `checkInQueue(...).todo`; each `{ goalId, plan, last, draft, path (rule 1), levels (rule 2), state: 'empty' | 'must-fix' | 'check' | 'needs-story' | 'needs-still-true' | 'ready' }`.
- `'needs-still-true'` is `path === 'carry'` without the tick; the tick sets `stillTrue` and carries `fromLast()`.
- `tableReadBack` → two lines: "**{n} check-in{s} for week {w} ({dates with year}):** {a} on plan{, {b} behind with last week’s story}{, {c} behind with a new story}{, {d} ahead}." and, when any wait, "{k} row{s} wait{s}: {title} {has a question to answer | needs a story | has a number to fix}; … {They stay | It stays} here as {drafts | a draft}." Rows left empty are not mentioned.
- Posting sends the ready rows to `planChanges` as today with `again: false`; because the table never lists a goal with a check-in this week, no row can replace one.

| Given (wireframe 5) | Then |
|---|---|
| 1.2, 81, 90, 77 with the tick, 0.52 | Ready: 3. "3 check-ins for week 46 (9–15 Nov 2026): 2 on plan, 1 behind with last week’s story." "2 rows wait: Base image build time has a question to answer; CI cost per pipeline run needs a story. They stay here as drafts." |
| The same, "Yes, 90 min is right" | Base image build time becomes `needs-story` (80 min behind) |
| Nothing typed | "Post check-ins" posts nothing: "Type at least one number." |

### Rule 12. The streak and a late record (`progress.ts`)

`onTimeStreak` counts a week only when each goal's check-in for it was posted by the owner, by the due day, and is not `backfilled`. `changeset.ts:707-708` keeps stamping a backfilled record with its week's due day (History reads in order) and now also sets `addedAt` in the change-log entry, which already carries the real time (`ch.at = now`).

| Given | Then |
|---|---|
| Tunde, five weeks on time; week 44 was missed and is added on 11 Nov | The streak is the run after week 44, as before the add |
| An admin posts Rhea's week 46 for her on Wednesday | Not counted for Rhea (true today) |
| Rhea posts "no new number" on Wednesday | Counted |

### Rule 13. One way to save (`changeset.ts`, `app/state.tsx`)

- `postCheckIn` in `state.tsx:593-609` stops calling `toCheckIn` itself: every screen posts through `planChanges` with one or more check-in rows, as the table, the import and `post_check_in` do. It is registered in AR3's action table as `postCheckIn` (`app.run('postCheckIn', { goalId, week, draft, mode, answers, reason })`).
- A check-in row gains two inputs (not spreadsheet columns): `mode: 'new' | 'again' | 'correct'` and `reason`.
  - `'new'`: refused if the week has a check-in ("Week {w} already has a check-in. Check in again, or correct it.").
  - `'again'`: adds a record beside the week's (today's form behaviour; summary "Checked in again for week {w}: …").
  - `'correct'`: replaces the week's newest (today's engine behaviour), needs `reason` (10 characters) for any week, and writes the reason as the entry's first diff `{ field: 'Why corrected', from: '—', to: reason }`; summary "Corrected week {w}: {old} is now {new}" / "Added week {w} later: {value}".
  - A spreadsheet row with no ID for a week that has a check-in stays a correction, as today; the import's preview gains the Check "Row {r} replaces {name}’s check-in for week {w}. Why?" with one answer covering every such row (the import spec's "one answer covers every row with the same question"), so a file needs a reason too.
- A correction keeps the recovery state the *draft* says, not the old record's (K6): `changeset.ts:659` reads `recovery` from the old record only when the row has neither `recovery` nor `back on plan by week`.
- `evaluate`, `toCheckIn` and `requestsAfterCheckIn` are unchanged.

## 5. Extension points

No new extension point. Two existing ones are used:

| Point | Who | For |
|---|---|---|
| `checkin.number` (metrics-2, section 7) | The Metrics module | Its source block above the number field and in a table cell; it may add Checks to rule 2's list. With Metrics off or no source: nothing is drawn |
| The Reviews module's rule for "which review walks this goal next" and "who looked at it in week n" (FT2/FT3) | Reviews | 2.8's review line and rule 6's "Who saw the old number". The check-in imports nothing from Reviews: the screen asks the module registry and gets nothing while it is off |

The check-in itself stays core (round 3's shared decision 1: goals, check-ins, the status rules, asks and next steps are not switchable).

## 6. Data

**No migration.** Everything new is derived or sits where a place already exists:

| Need | Where |
|---|---|
| A check-in with no number | `okr_check_ins.value` is already nullable (`0001`), and no later migration constrains it for number goals. The build's first test posts one against a local database to confirm; if a constraint is found, it is dropped in a migration written per `supabase/README.md` (as `faro_owner`, in `faro`, safe to run twice) and shown in full in the PR |
| Why a week was corrected; a Check's answer; "for {owner}" and why | Diffs on the check-in's change-log entry (`okr_changes`), as a plan change's reason is kept today |
| "Corrected", "added later" | Read from the change log (`entity: 'check-in'`, `action: 'edited'`) and `backfilled` (0009) |
| Who posted for whom | `authorId` ≠ the goal's owner (exists) |
| Drafts | The `Prefs` port (browser storage), as today |

For the internal platform, as requirements in `spec/` and not built: delegation (a named stand-in between two dates); telling the owner when someone checks in for them or corrects their week (R5's notifications); drafts kept on the server so a check-in started on a phone finishes on a laptop.

## 7. AI tools (MCP)

Parity is kept (`src/mcp/parity.ts`); after the change run `npm run build:mcp`.

| Tool | Change |
|---|---|
| `post_check_in` | Gains `mode` (`new`, the default; `again`; `correct`) and `reason`; `no_number: { why, says }`; `answers` (the ids of Checks the person has said yes to). A Check not answered comes back as `questions: [{ id, question, yes, no }]` with nothing saved, as goal entry's tools do (GE2). A week before this one requires `mode: 'correct'` and a `reason`. Its description stops saying "Posting again for the same week corrects that week’s check-in" |
| `post_check_in` with `dry_run: true` | Returns rule 4's lines as `read_back`, and for a correction rule 6's rows as `changes` |
| `delete_check_in` | Unchanged; named in the description as the way to undo |
| `undo_import` | Unchanged; undoes a correction or a table post by its `importId`, which `post_check_in` now returns |
| `get_my_work` | `check_ins` rows carry rule 9's `said`, `first` and `draft: null` (an assistant has no drafts) |
| `bulk_change` | Check-ins rows accept `No number`; a row that replaces a week's check-in needs `reason` (one for the call) |

## 8. Evals

### Journeys

| # | Who | Steps | Holds |
|---|---|---|---|
| U110 | Rhea, 1440 and 390 | Menu → Check-in (the queue: 5 to do, 2 done) → "Start with…" → 1.2 → Post → 81 → Post → on the third goal Undo the second → post it again → finish all five → the confirmation | One screen a goal on plan; the saved line names the goal and number; Undo restores the draft; the confirmation lists five rows with Undo; Home's count goes 5 → 0 |
| U111 | Rhea | Flaky: type 18 → the Check blocks Continue ("Answer the question above first.") → "Change the number" → 1.9 → "Still true: post check-in" → History shows week 46 once, 1.9%, and "vs last week" compares with week 45 | No path posts 18 without "Yes, 18.0% is right"; an answered Check appears in History |
| U112 | Rhea, 390 | The table: five numbers, one tick, "Say why" on one → the sheet → Post → the confirmation → "Undo all" | The table never lists Lead time or Pipeline queue wait; the read-back's counts match what posts; after Undo all five are to do again with their drafts |
| U113 | Rhea, then Grace | Rhea: History → week 44 → "Correct it" → 2.4 → no reason (Must fix) → a reason → "What this changes" names week 44, today's status "No change", the trend → save → History says "Corrected … was 1.9%" → Undo. Grace: the goal's "…" → "Check in for Rhea" → the block says whose it is → post → Rhea's queue says "by Grace, for you" | The streak is unchanged by both; Oskar typing the address sees "{Owner} or an admin can check in on this goal." |

A second run of U110 and U112 with the rhythm off and Reviews off (FT1's second conformance set): the title is "Check in on a goal", no "due", "to do", "x of y", streak or review appears anywhere on the five screens, and posting returns to the list.

### F and N checks

| # | Checks |
|---|---|
| F22 | On every check-in screen at 1440 and 390: exactly one primary button; the week is shown with its dates and year; no status shape without its word; a Check or Must fix block has a full outline or wash and no coloured edge; the footer's primary is in view without scrolling for a goal on plan; every control is at least 44 px high on touch; the table doesn't scroll sideways at 390 |
| N23 | The words: with rhythm off the strings "due", "late", "on time", "streak", "to do this week" appear on no check-in screen; with Reviews off the string "review" appears on none; "path to green", "Typed in by hand", "Last week was" (without a week number) and "0/1" appear nowhere; every week mentioned in a sentence has its dates on first mention |

P3, P4, P6 and P7 are extended to the nine screens.

### Unit tests

Each rule's table; `checkin.test.ts` keeps today's cases for `evaluate` and gains rules 1 to 5, 7; `correction.test.ts` (rule 6); `progress.test.ts` (rule 12); `changeset.test.ts` gains the three modes, the reason, and the recovery-state case of K6 ("a row that gives a week keeps the week"); `roundtrip.test.ts` gains a no-number check-in.

### Requirements (`evals/requirements.json`)

| id | Says | Checked by |
|---|---|---|
| `CHECK-IN-ONE` | One goal's check-in posts in one screen and one press when it is on plan or its story still holds; what will be posted is read back before; it can be undone after; an unlikely number is asked about and can't be posted unanswered | U110, U111, F22, rules 1 to 5, 8 |
| `CHECK-IN-TABLE` | The table applies the same levels, carry and read-back as the form, never replaces a posted check-in, and its post is undone as one | U112, rule 11 |
| `CHECK-IN-CORRECT` | A check-in for any week of the running cycle can be corrected or added by its goal's owner or an admin, with a reason, after a read-back of what changes, judged by the rule of its week; it never counts as on time | U113, rules 6, 12, 13 |

`HONEST-CHECKIN`, `CHECKIN-STATUS-VS-PLAN` and `FIRST-CHECKIN` stay and are not restated.

## 9. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `check-in` | Rewritten to the new path: the list; one number; the read-back; "Still true"; the questions Faro asks and why; Undo; "Check in again" against "Correct it"; no new number. Sections for stages and keep-in-range goals |
| `check-in-table` | Rewritten: what the table lists and doesn't; the tick; "Say why"; "Undo all" |
| New: `check-in-correct` | "Correct or add an earlier week": who may, the reason, what "What this changes" means, what it does to a closed quarter and the streak |
| `status` | One paragraph: a week with no new number |
| `history` | "Corrected" and "added later" on a week's row |
| `removing` | Undo after a check-in; "Delete this check-in" stays for the newest |

`guide.test.ts` needs an article for each new route: `/check-in/table`, `/check-in/done` and `/check-in/<goal>/none` map to `check-in` and `check-in-table`; `/correct` maps to `check-in-correct`.

### What's new (`src/help/whatsNew.ts`), one entry per item, newest first

- CK1: "Checking in again and correcting a check-in are now two different things, and both say what they do."
- CK2: "Faro asks before it posts a number that looks wrong, and keeps your answer."
- CK3: "A goal on plan is one number and one press. You see what will be posted first."
- CK4: "Undo a check-in straight after posting it."
- CK5: "Check-in opens on your list for the week."
- CK6: "Correct or add an earlier week, with a reason; Faro says what it changes first."
- CK7: "No new number this week now counts as your check-in."
- CK8: "The table carries last week's story with one tick."
- CK9: "An admin can check in for someone who is away; it says so on the goal."

## 10. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | (b) Ask only at ten times | Rule 2's `far-from-last` threshold becomes 10 and a tenth; between 3 and 10 the line stays a hint under the field. `valueProblem` gains a `level` |
| 1 | (c) A hint | Rule 2 keeps only `story-unchanged`, `same-as-last` and `rebase` as Checks; CK2 shrinks to S |
| 2 | (b) Every second check-in replaces | `mode: 'again'` is dropped; 2.2's line 3 becomes "This replaces the check-in you posted on {date}." and asks for a reason; migration 0012's ad hoc check-ins stay readable. GT1's "Check in again" opens a correction |
| 2 | (c) As today | No `correct` mode for this week; rule 5 is still built (K2's comparison); the done row's link goes |
| 3 | (b) Also the team's lead | A new line in R1 and in `canChange`; 2.9's block says "as {team}’s lead". Not recommended without the platform's roles |
| 3 | (c) The owner only | `canChange` for check-ins and `post_check_in` are tightened; 2.9 and CK9 are dropped; GT1's "Check in for {owner}" is removed from the goal spec |
| 4 | (b) The last four weeks | 2.7's picker lists four weeks for an owner; older weeks say "An admin can correct week {n}." |
| 4 | (c) Files and tools only | CK6 becomes S: the reason and rule 6's rows in the import's preview and `post_check_in`'s dry run; no screen |
| 5 | (b) The quarter keeps its result | Rule 6's quarter row says "{quarter} keeps the result it closed with, {result}; the corrected number shows beside it." `quarterResult` needs the closed result stored: a column on the cycle or a record per quarter (a migration). Not recommended for Faro |
| 5 | (c) Closed quarters can't be corrected | 2.7's picker starts at the running quarter's first week |
| 6 | (b) A comment | Rule 7 and CK7 are dropped; 2.5 stays as today's sheet with "It stays to do until there’s a number."; `same-as-last`'s "no" opens that sheet |
| 7 | (b) As today | Rule 12 is dropped; rule 6's streak row says what would change |
| 8 | (b) Keep the screen between goals | 2.4's saved line becomes today's "Check-in saved" screen with "Undo" on it; `CHECK-IN-ONE` loses "one screen" |
| 9 | (b) Numbers only | A row that needs words says "Needs a story: open its check-in" (a link, the number kept); no sheet. CK8 becomes S |
| 9 | (c) As today | CK8 is only the Checks, the read-back and leaving out posted goals |

## 11. Build plan

Backlog-sized items, in order. Effort: **S** (under a day), **M** (a release), **S–M** between. Each is one PR with its spec section, conformance rows, its module's rebuild stage, evals, Help and What's new, as `CLAUDE.md` asks. All sit in the "one goal" track.

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| 1 | **CK1** One way to save a check-in | Rule 13 (the form posts through the engine; `new`, `again`, `correct`; the recovery-state fault of K6) and rule 5 (`previousFor`, the goal page's "vs last week"). `[no news]` but for one line: a second check-in is compared with last week | S–M | AR3 (merged). Nothing held |
| 2 | **CK2** The levels in a check-in | Rules 2 and 3; the Check and Must fix blocks in the form and the table; answers in History | S–M | CK1; IM2 for the shared block if it has landed (else this item draws it and IM2 reuses it); GE2 shares the component |
| 3 | **CK3** One screen: the read-back, "Still true", steps as addresses | Rules 1 and 4; 2.2 and 2.3; `/why`; the status choice in place; the week picker for "Back on plan by" and a late stage | M | CK2; NV2 (one way out of a form); GE9 for the picker (until it lands, today's choices plus every week of the cycle as a plain list); OB2 *held* for the first check-in's words |
| 4 | **CK4** Undo, and one confirmation | Rule 8; 2.4's saved line; `/check-in/done` | S–M | CK1, CK3; FT2 for the review line being absent when off |
| 5 | **CK5** The queue, finished | Rule 9 and 10; 2.1 both ways; the stale draft | S–M | NV3 (this item is NV3 with the additions; build them as one if NV3 has not started); FT1 for the rhythm-off way |
| 6 | **CK6** Correct or add an earlier week | Rule 6 and 12; 2.7; History's "Corrected" and "added later"; the import's reason question | M | CK1, CK2; GT2 (merged) for History; GE9; IM2 or IM3 for the question in the preview |
| 7 | **CK7** No new number as a check-in | Rule 7; 2.5; the scorecard's "as of week"; the Check-ins sheet's No number | S–M | CK2, CK3; IM1 for the column |
| 8 | **CK8** The table | Rule 11; 2.6; the sheet for a story; "Undo all" | M | CK2, CK3, CK4; MT4 for sourced cells (absent until then) |
| 9 | **CK9** Checking in for the owner | 2.9; the done row's "by {name}, for you"; the requirement for delegation written into the spec | S | CK3; GT1 (merged) for the "…" row |
| 10 | **CK10** MCP parity | Section 7 | S | CK1, CK2, CK6, CK7; GE2's `questions` shape |

**The first cut is CK1 to CK5: about four releases.** After it a wrong number is asked about and can be undone, a goal on plan is one press, "again" and "correct" mean what they say, and Check-in opens on a list. CK6 is the largest remaining gap (a past week on a screen); CK7 to CK10 can wait for a team asking.

In the backlog: one entry under round 3's, pointing here. It replaces LP's leftover for U12 (the table) and takes NV3 in. No migration.
