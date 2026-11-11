# Build spec: running a review

11 November 2026. For a build session. The reasons and the evidence are in [README.md](README.md); this says what to build. Nothing here is built. Items RV1 to RV10, journeys U118–U121, checks F24 and N25, requirements `REVIEW-PREPARE`, `REVIEW-WALK`, `REVIEW-FINISH` (take the next free number if another build has used one).

Read first: `CLAUDE.md`, `docs/design-rules.md`, `docs/architecture.md` ("Adding a module", "Switching per workspace"), round 2's `feature-toggles/spec.md` (Reviews as a module: FT2, FT3), round 1's `goal/spec.md` (the next-steps-and-asks list, rule 2), `find/spec.md` (2.1 the list bar, 2.3 find-and-pick), `navigation/spec.md` (rule 4), round 2's `goal-entry/spec.md` 2.8 and 2.13 (agree a goal; the week picker).

**Where the code goes.** If FT3 has landed, everything here is in `src/modules/reviews/` (screens, rules, tools, help, evals). If only FT2 has, new files still go in that folder and files that stay in the core are listed in its `module.json` under `elsewhere`. File names below are given as they are today.

## 0. Words

| Say | Never |
|---|---|
| **next step** (who, by when), on every screen of a review | "action", "Open actions", "Add an action" (the stored kind stays `action`) |
| **to discuss**; **nothing flagged** | "exceptions", "healthy" on screen |
| **Needs a decision**; **Being handled**; **Carried over** (agenda groups) | "Still to review" |
| **Reviewed, nothing to add** | "Seen", "acknowledged", "Looked at it" as a button |
| **We accept the risk** (the decision); "The review accepted the risk: …" (read later) | "noted", for an accepted risk |
| **Come back to it later** (in the walk); **Carry them to Tue 24 Nov** (at Finish) | "Skip for now" |
| **Held Wed 11 Nov**; **Was due Tue 10 Nov, yesterday**; **Not held**; **Started Wed 11 Nov, not finished** | "Outstanding", "1 day past" |
| **Finish the review**; **Reopen this session** | "Close", "Undo" as the page's control (Undo stays on the message) |
| A date as weekday and date: "Tue 24 Nov"; a week as "Week 48 · Tue 24 Nov" in a review (the session's day in that week) | A bare weekday ("Tuesday · in 13 days"); "by week 47, 16–22 Nov" beside "by Thu 19 Nov" |
| **as of week 44** (no set rhythm, a status not from this week) | "stale", "No recent update" with no set rhythm |

A session's state is a word. A late session's line carries the warning mark. No square shapes.

## 1. Routes and redirects

All under `/reviews`, all the module's (`module.json` `routes`). With Reviews off each shows FT2's switched-off line.

| Address | Screen |
|---|---|
| `/reviews` | The list (2.1). `?q=`, `?scope=mine\|all` |
| `/reviews/new`, `/reviews/:id/edit` | Set up, change (2.2) |
| `/reviews/:id` | The review: before a session, in progress, or held (2.3) |
| `/reviews/:id/walk` | Goes to the walk's first open step |
| `/reviews/:id/walk/since` | Since last time (2.4) |
| `/reviews/:id/walk/:goalKey` | One goal (2.5). `:goalKey` is the goal's key (`G-6`) or id |
| `/reviews/:id/walk/rest` | Nothing flagged (2.6) |
| `/reviews/:id/finish` | Finish (2.7) |
| `/reviews/:id/sessions/:week` | An earlier session's record (2.8) |
| `/reviews/:id/print` | The one-pager (2.9) |

`?present=1` on any walk address (2.10).

| From | To |
|---|---|
| `/goals/:goalId?review=:id` | `/reviews/:id/walk/:goalKey` when the goal is in the review and Reviews is on; otherwise the goal's page with the parameter dropped |
| `/reviews/:id?finish=:goalId` | `/reviews/:id/finish` |
| `/reviews/:id/summary` | `/reviews/:id/sessions/:week` of the latest finished session, else `/reviews/:id` |
| `/review` | `/reviews` (as today) |

Page names (navigation rule 2): the review's name; in the walk, the review's name (the goal's title is the page's `h1`); "Set up a review". Back links (rule 4): a review → "‹ Reviews"; any walk step, an earlier session, the one-pager → "‹ {review}"; Finish → "‹ Back to the goals" (the last walk step). The lit menu item is Reviews on all of them.

## 2. Screens

Every screen: one column of 760 px (a reading page) unless said. Empty and error states are listed with each.

### 2.1 The list (`/reviews`). Wireframe 1

In order:

1. `h1` "Reviews". Under it: "A review walks a set of goals together on a set day, decides what happens next, and opens next time with what was agreed." At the right an ordinary button, "Set up a review".
2. The list bar (find spec 2.1): search, placeholder "Find a review by name, person or goal"; two choices, "Yours · {n}" and "All · {n}" (`scope`; starts on Yours when the viewer is in any, else All). On a phone: the search, and the scope as one button.
3. The count line: "{n} reviews, yours first, then the soonest." / "1 review." / "{n} reviews match."
4. One list. Group rows "You’re in · {n}" and "Other reviews · {n}" when both have any (scope All). Within a group: a session in progress first; then late ones; then by the session's date; then by name.
5. A row is a link to the review. Three parts:
   - **Name**, and under it "{cadence} · {n} people" (cadence: "Every week, Thursdays", "Every 2 weeks, Tuesdays", "Every 4 weeks, Tuesdays", "Every 13 weeks, Wednesdays").
   - **When**, first line, by rule 4's state:

     | State | First line | Second line |
     |---|---|---|
     | Coming | "Thu 12 Nov, tomorrow" / "Today, Wed 11 Nov" / "Tue 24 Nov, in 13 days" / "Wed 23 Dec, in 6 weeks" (weeks from 21 days) | "Last held Thu 5 Nov" / "Not held yet" (never) |
     | In progress | "In progress · 3 of 10 discussed" | "Started Wed 11 Nov" |
     | Late | warning mark, "Was due Tue 10 Nov, yesterday" / "… {n} days ago" | "Can be held until Mon 23 Nov · then Tue 24 Nov" |
     | Held, next not yet due | "Tue 24 Nov, in 13 days" | "Held Wed 11 Nov" |
     | No session left this year | "No more this year" | "Last held …" |

   - **Agenda and what is open**: "10 to discuss · 25 with nothing flagged" (the live agenda, rule 2); under it "{n} open next steps" / "1 open next step from earlier" / "No open next steps", or with the warning mark "{n} next steps overdue".
6. Paging at 50 (find spec).

States: no reviews at all → "No reviews yet." "A review walks a set of goals, worst first, and keeps what was decided." and the primary button "Set up the first review". None match → find spec's "No review matches “x”." with "Clear the search". An ended review is not listed; its address keeps today's page (`EndedReview`).

Primary action: none, except the empty state's.

### 2.2 Set up and change a review (`/reviews/new`, `/reviews/:id/edit`). Wireframe 2

Focus mode, 620 px. Top: "Set up a review" / "Change {name}"; under it "Anyone can set one up. You can change all of it later."; at the right "Close without saving" (navigation 2.5, with its question when something was typed). The draft is kept as today (`useDraft`).

In order:

1. **Name.** Placeholder "e.g. Platform monthly". Must fix: "Give the review a name."
2. **Which goals.**
   - What is chosen, as rows with "Remove": "**{goal}** and everything under it" · "A goal and what feeds it · {n} goals"; "**{team}**, the team’s goals" · "A team · {n} goals{, {k} of them already counted above}"; "Every **{level}** goal" · "A level · {n} goals"; "**{goal}**" · "Picked · {key} · {owner}".
   - Button "Add goals" opens a chooser in place: the label "Add goals: choose one way, as often as you like"; four radio rows, then that way's control:

     | Way | Under it | Control |
     |---|---|---|
     | "A goal and everything under it" | "Find the goal; the review follows its tree as goals are added under it." | find-and-pick, goal; a row's second line ends "· {n} goals with it" |
     | "A team’s goals" | "Every goal the team owns, now and later." | find-and-pick, team |
     | "Every goal at a level" | The workspace's level names, joined | A short fixed list of the levels (plain, per find spec section 4), as tick rows |
     | "Goals I pick one by one" | "Only these, until you change the list." | find-and-pick, goal, several, with "Done" |

   - Must fix: "Choose the goals it walks."
3. **Who takes part.** Rows with "Remove" (find spec 2.3, several). "Add a person" (find-and-pick; suggestions: you, owners of the chosen goals, your team). A link "Add the {n} other owners of these goals" when any are not yet in. Under it: "People in a review can start it, decide in it and finish it. Everyone else can read it." Whoever set the review up can't be removed by someone else who isn't an admin (as today's `keep`). Must fix: "Add at least one person."
4. **When.** Two selects: "Every week" / "Every 2 weeks" / "Every 4 weeks" / "Every quarter" (13), and Monday to Friday (starting as the cycle's due day). A stored cadence that is none of the four shows as "Every {n} weeks" in the list and is kept. Under them, from rule 4: "The first is Thu 12 Nov, tomorrow; then Thu 19 Nov, Thu 26 Nov." On change, for a review with a session in progress: "The session in progress stays on Tue 10 Nov. The next is …".
5. **What you’re setting up** (the read-back; rule 9), a panel:
   - "**{name}** walks **{n} goals** {cadence in words}, first on **{date}**, with {n} people."
   - "Today that is {d} to discuss ({counts by status}) and {h} with nothing flagged."
   - A Check (the warning mark and the word, round 2's level) when any goal is in another live review: "{k} of the {n} are also in {review}{ and {m} more reviews}. That is allowed: each review keeps its own record, and a goal’s page shows both." It asks nothing; it is information at the Check level and never blocks.
   - "Nothing is asked of anyone until you start it. {Names} see it on Home from {date}."
   - When changing: the heading is "What will change", with only the lines that differ: "{k} goals join, {m} leave." / "{Name} joins; {Name} leaves. {Name}’s {n} open next steps stay theirs." / "It moves from Tuesdays to Thursdays. The next is Thu 26 Nov." / "Nothing would change."
6. Foot: **"Set up the review"** / **"Save changes"** (primary; "Save changes" is disabled when nothing would change).

After saving: the review's page, with the message "Set up {name}. The first is {date}." and Undo (a new review: `deleteReview`; a change: the action table's undo).

Errors from the rule are shown at the foot as today (`role="alert"`). No goals in the workspace: the chooser says "There are no goals yet." and links to New goal.

### 2.3 A review (`/reviews/:id`). Wireframes 3 and 6 (b)

The page has three states, by rule 4. In all: "‹ Reviews"; `h1` the name; under it "{cadence} · {n} people · {n} goals"; then the session's line.

**Before a session, or late (prepare).**

1. The session's line: "Thu 12 Nov, tomorrow." / "Today, Wed 11 Nov." / warning mark "Was due Tue 10 Nov, yesterday." then "It can still be held until Mon 23 Nov. The next is Tue 24 Nov."
2. Buttons: **"Start the review"** (primary; people in it and admins); "Print the one-pager"; "More" (a menu: "Change the review" for those who may; "End this review…" for whoever set it up or an admin, with today's confirm). Not in it: no primary; the line "You’re not in this review. {Names} or an admin can add you." (up to six names, then "and {n} more").
3. **"Before you meet"** (only when a line applies; each line from rule 7):
   - With a rhythm: "**{n} of the {total} goals have no check-in for week {w}.**" · "{Owner (count)}, … Check-ins are due by {date}." / "… were due {date}." · button "Ask them for an update" (one `askForUpdate` per goal not already asked and not the viewer's own; then the line says "Asked {n} owners today." with "Undo").
   - With a rhythm: "**{n} goals have had no check-in since week {w} or earlier.**" · the goals and owners (up to three, then a count) · "Ask {name} for an update" / "Ask them for an update".
   - With no set rhythm, in place of both: "**{n} goals have not been updated since the last session, {date}.**" · owners · "Ask them for an update".
4. **"From last time"** with the last held date beside it (rule 3; nothing when rule 3 is empty): rows, each a state word first ("Open", warning mark "Overdue by 1 week", "Waiting", "Answered", "Done"), then the words, then "{who} · by {date} · {goal}" (a step from an older session adds "· agreed {date}"). One button where the viewer may: "Mark done" / "Answer" / "Set up the goal" (GE6).
5. **"To discuss"** with "{n}, worst first" beside it: one list in rule 2's groups, each with a group row: "Carried over from {date} · {n}", "Needs a decision · {n}", "Being handled · {n} · confirm and move on". A row: status (shape and word); the title; **the reason** (rule 1), one line; "{owner} · {team}"; at the right the number over its gap (or "as of week {n}"). An off-track row has the wash. A row is a link to that goal in the walk.
6. **"Nothing flagged · {n}"**, folded: "{22 on track, 3 done}. Reviewed together at the end." and "Show them" (rows without a reason line).
7. **"People · {n}"**: the names in a sentence, and "Change" for those who may.
8. **"Earlier sessions"**: the last two as links with their counts, "Tue 27 Oct · 3 next steps, 1 question."; "Not held: Tue 13 Oct." as words; "All {n}" opens the full list in place.

**In progress.** As above, with: the line "In progress · {k} of {n} discussed. Started {date}."; the primary button **"Carry on · goal {k+1} of {n}"** (or "Carry on · the {h} with nothing flagged", or "Finish the review" when only Finish is left); "Before you meet" not shown; after "From last time" a section **"Decided so far"** in Finish's order (2.7) without "Change"; "To discuss" lists only what is left.

**Held.**

1. The line: "**Held {date}**, finished by {name}. The next is {date}, {in n days}." (held late adds nothing: the date says it.)
2. Buttons: "Copy the summary", "Print", "Reopen this session" (people in it and admins, until the next session's day; none is primary). "More" as above.
3. The record, as 2.7's read-back without "Change": next steps by who (each with its state now), risks accepted, questions (with answers), a new goal agreed, carried over, "Reviewed with nothing to add · {n}" folded.
4. People; earlier sessions.

"Copy the summary" copies rule 10's text and says "Copied." "Reopen this session" asks in a sheet: "Reopen the session of {date}? Its {n} goals reviewed at Finish go back on the agenda. Everything decided stays as it is." with "Cancel" and "Reopen"; then the message "Reopened." with Undo.

States: the review covers no goals → in place of 5 and 6: "No goal is in this review now. Change the review to choose some." A review that doesn't exist → today's page. Ended → today's `EndedReview`.

### 2.4 Since last time (`/reviews/:id/walk/since`). Wireframe 7

The walk's first step, shown only when rule 3 returns anything; otherwise "Start the review" goes to the first goal.

1. The walk's bar (2.5, item 1) with "{date} · before the {n} goals to discuss".
2. `h1` "Since last time". Under it: "Held {date}. {n} next steps were agreed, {n} risks accepted and {n} questions asked. Here is how each stands today." (only the parts above zero). When a session was not held between: "The session of {date} was not held."
3. **"Next steps"** with the tally "{2 done, 2 open, 2 overdue}": rows as 2.3 item 4, overdue first, then open by date, then done. "Mark done" opens today's small note field in place ("How it went", optional) with "Mark done" and "Cancel".
4. **"Questions"**: waiting, then answered, the answer quoted and labelled "{name} answered {date}:".
5. **"Risks accepted last time"** with "{n}, {k} still behind": each goal with its status now, "Accepted on {date}: “{reason}”", and where it is on today's agenda ("First on today’s agenda." / "Back on track: with the {n} that have nothing flagged.").
6. Primary: **"Go to the first goal"**.

Nobody need press anything else: the step records nothing by itself.

### 2.5 One goal (`/reviews/:id/walk/:goalKey`). Wireframes 4, 8 (a, b), 9

Width: the wide page (1,120 px). From 1,100 px, two columns: the goal, and a side column of 380 px for the decision. Under that, one column in the order below, the decision last.

1. **The bar** (not fixed): "‹ {review}"; under it "Goal {k} of {n} to discuss" (for a goal opened from the nothing-flagged list: "One of the {h} with nothing flagged"). At the right: "‹ Previous", "Next ›" (move without deciding; disabled at the ends), "Agenda" (a sheet listing the walk's steps in order with each one's outcome so far: "Next step · Pavel", "Risk accepted", "Come back to it", nothing; a row jumps there), "Present" (from 1,100 px).
2. **Why**: the warning mark and "On the agenda because:" then rule 1's reason as a sentence. For a carried goal it begins "Carried over from {date}: …".
3. `h1` the goal's title. Under it "{owner}, {team} · {level} · {key} · checked in {date}, week {n}" ("no check-in yet").
4. Status (shape and word) and the number, large. With no set rhythm and a status not from this week: "· as of week {n}".
5. The scorecard's four cells (the core's component).
6. "{Owner} said in week {n}" (a label, no rule beside it), then the latest reason. "How it gets back", then the path to green and its date; when the date has moved: "first said week {n}".
7. `h3` "Next steps and asks": the core's list for this goal (goal spec rule 2), rows and their one button unchanged; rows agreed in this review last time say "· from last time". Empty: "No next step yet. Nobody has said what happens next, who does it and by when." (the core's `gap` words).
8. A small chart (the core's, 120 px; on a phone behind "Show the chart").
9. Other reviews (rule 8), one line each, at most two: "Also in {review} ({next date}): {what it last said, date}." Then the link "Open the goal’s page".

**The decision block**, heading "What happens next?" (`h2`). Which form it takes, by rule 5:

**(a) A goal behind with no decision yet** (off track or at risk, no next step in date). Radio rows; the first is chosen and its fields are open:

| Choice | Fields when chosen | Saves (rule 6) |
|---|---|---|
| **"A next step"** | "What needs doing" (text, required: "Say what needs doing."). "Who": find-and-pick, person, closed on the goal's owner as "{name} · owns this goal" with "Change". "By": round 2's week picker, closed on rule 5's default as "Week 48 · Tue 24 Nov, the next session" with "Change"; its named weeks are "This week", "The next session", "The end of this quarter" | A next step and "reviewed", in one save |
| **"We accept the risk"** · "No action for now, with the reason." | "Why the review accepts it" (required, 5 characters: "Say why, in a few words."). Under it: "It stays on the goal and in the record. The goal still needs attention." | The accepted risk and "reviewed" |
| **"Ask {owner} a question"** · "Open until {they} answer; first on next time’s agenda." (not on the viewer's own goal) | "Your question" (required). Under it: "For someone else to decide? Make it a next step for them." | The question and "reviewed" |
| **"Agree a new goal"** · "Its owner sets it up afterwards." | Goal entry 2.8's four fields | GE6's next step and "reviewed" |
| **"Ask {owner} for an update"** (only for a goal with no recent update, or with no set rhythm one not updated since the last session; then it is the first choice and chosen) | None. "{Owner} sees it on Home. The goal comes back next time." | `askForUpdate` and "reviewed" |

Primary: **"Save and go to the next goal"** (the last goal to discuss: "Save and go on"). Ctrl+Enter (⌘ on a Mac) does the same from any field. Under it two links: "Come back to it later" (moves on and saves nothing; the goal stays open and is offered again after the last goal) and "Add a note" (a text field in place and "Save the note"; it stays on this goal and doesn't move on).

**(b) A goal with a decision already** (made in this session, or a next step in date agreed anywhere since its latest check-in): the decision is shown first, as words: "Next step · {who}, by {date}: {text}" with "Change" (whoever said it, or an admin) and, when it was agreed elsewhere, "Agreed in {review}" / "Agreed on the goal’s page". Primary: **"Reviewed, nothing to add"** (already reviewed: "Go to the next goal"). Under it "Say something about it", which opens (a)'s choices.

**(c) A goal that isn't behind** (on the agenda for a trend, a waiting decision, an overdue step): as (b) without a decision shown. Primary "Reviewed, nothing to add"; "Say something about it" opens the choices, of which "We accept the risk" is left out.

**(d) Someone not in the review** (and not an admin): no block. One line: "You’re reading {review}. People in it decide." The bar's Previous and Next work.

After any save the message names it ("Next step saved for Pavel Novák, by Tue 24 Nov.") with **Undo**, and the page is the next open step (rule 5's `nextStep`): the next goal to discuss not yet left; else a goal come back to; else `rest`; else `finish`.

States: a goal no longer in the review (removed mid-session) → "This goal is no longer in {review}." and "Go to the next goal". A save refused by the rule → the words at the block's foot, `role="alert"`, and nothing moves. A next step whose week has passed can't be chosen (the picker starts at this week).

### 2.6 Nothing flagged (`/reviews/:id/walk/rest`). Wireframes 5, 8 (c)

1. The bar: "All {n} discussed · the {h} with nothing flagged" ("{k} of {n} discussed" when some were left).
2. `h1` "Nothing flagged · {h}". Under it: "{22 on track, 3 done}. None is behind, getting worse, waiting on anyone or overdue. Review them together, or open one to talk about it."
3. Primary: **"Review all {h} and finish"** (saves one "reviewed" per goal in one save, with Undo, and goes to Finish).
4. One list in rule 2's two groups: "Changed since last time · {n}" (each row's second line says what: "reached its target in week 45", "was at risk on Tue 27 Oct", "new since Tue 27 Oct"; with no set rhythm the group is "Updated since last time · {n}" and says "checked in {date}") and "As they were · {n}", of which three rows show and the rest sit behind "{n} more on track or done, as they were · Show them".
5. Under it: "Opening a row walks that goal like the others: say something about it, or mark it reviewed by itself."

No goals with nothing flagged: the step is skipped. Everything already reviewed: it goes to Finish.

### 2.7 Finish (`/reviews/:id/finish`). Wireframe 6 (a)

For people in the review and admins; others are sent to the review's page.

1. "‹ Back to the goals". `h1` "Finish {review}". Under it: "The session of {date}{, held today, {date}}. {n} goals: {a} decided, {b} confirmed, {c} with nothing flagged." (a: goals that left with a decision this session; b: reviewed with nothing to add from the to-discuss list.)
2. Primary, at the right: **"Finish the review"**.
3. The read-back (rule 6), one panel, sections only when they have anything, in this order:
   - **"Not decided · {n}"** (first, with the warning mark; goals to discuss with nothing saved): each goal as a link back to it, then one choice: a tick box, ticked, "Carry them to {next date}" and an optional field "Why (optional)", placeholder "e.g. Pavel was away". Unticked, "Finish the review" is disabled and the line reads "Decide these {n} goals, or carry them."
   - **"Next steps · {n}, by who does them"**: "{Name} · {k}", then each step: "{text} · by {date} · {goal}".
   - **"Risks accepted · {n}"**: "{goal}" / "{reason} It still needs attention."
   - **"Questions asked · {n}"**: "{who it is for}" / "“{question}” · {goal} · open until answered".
   - **"Asked for an update · {n}"**: "{owner} · {goal}".
   - **"From last time"**: "{n} done, {n} still open" and the open ones.
   - **"Reviewed with nothing to add · {n}"**: "{b} being handled and the {c} with nothing flagged." with "Show them". Goals with nothing flagged not yet reviewed are counted here and are marked when Finish is pressed; the line then reads "…and the {c} with nothing flagged, marked when you finish."
   - Each line of the first five has "Change", which opens that goal in the walk.
4. Under the panel: "Each person sees their next steps on Home and on the goal. You can reopen this session until {date}."

Pressing Finish saves once (rule 6) and goes to the review's page (2.3, held) with the message "Finished {review}." and **Undo**.

States: nothing was decided and nothing carried → the panel's first line is "No next steps or accepted risks were recorded in this session."; Finish is still allowed. The session already finished → the review's page.

### 2.8 An earlier session (`/reviews/:id/sessions/:week`)

"‹ {review}"; `h1` "{review}, {date}"; the line "Held {date}, finished by {name}." / "Started {date}, not finished." / "Not held."; then 2.7's read-back without "Change", each next step and question with its state today. No primary action. A week with no session: the review's page.

### 2.9 The one-pager (`/reviews/:id/print`)

As today's print page, with these changes: the bar says "A4 portrait. The {n} to discuss in full; the {h} with nothing flagged as one line each." (no "a page or two"); the order is rule 2's, with its group headings; each goal to discuss leads with rule 1's reason, then "Where it stands", "Why" and "Path to green" only (no "Watch for" list); "From last time" comes before the goals; a held session prints 2.7's record instead. The session's date as "Tue 10 Nov 2026".

### 2.10 Presenting (`?present=1`). Wireframe 9

From 1,100 px, on the walk's steps. The app's menu and top bar are not drawn; the page uses the full width up to 1,340 px; `h1` 40 px, text 19 px, the scorecard's numbers 28 px, the side column 420 px. The bar's "Present" reads "Stop presenting"; Escape does the same. The parameter is kept across the walk's steps and dropped on leaving the walk. Nothing else differs, and the design check (P6, P7) runs on it.

### 2.11 The phone (under 700 px). Wireframe 8

- 2.1: a row's parts stack: name, when, agenda. 2.2: as drawn at 390 px; each chooser and picker is a full sheet (find spec).
- 2.3: the buttons wrap under the session's line, the primary first and full width.
- 2.5: the page's bar carries the review's name and "Goal {k} of {n} to discuss", and "Agenda". Content in 2.5's order through item 6, the owner's words cut to three lines with "More"; item 7 as a count with "Show" when it has rows; the chart behind "Show the chart". **A fixed foot**, 48 px buttons: "‹" (Previous goal), the middle button, "›" (Next goal), each with its name for screen readers. The middle button is **"Decide"** for form (a), which opens the decision block as a full sheet titled "What happens next?" with "Close", "Cancel" and "Save and next" in its foot; for (b) and (c) it is "Reviewed, nothing to add" and "Say something" is a link above the foot. The page's foot padding equals the fixed foot, so nothing is covered.
- 2.6, 2.7: one column; the primary button in the fixed foot.
- Every control is at least 44 px.

## 3. Who sees and does what

Each line names the action that enforces it. Rows marked **new** are not in R1's table today and wait on Lane's decision 1.

| What | Who | Enforced by |
|---|---|---|
| Read any review, its agenda, walk, record and earlier sessions | Everyone in the workspace | Nothing refuses a read (as today) |
| Set a review up | Anyone | `saveReview` (`actions.ts:217`, `before === null`) |
| Change its name, goals, people or day | Someone in it, whoever set it up, or an admin | `saveReview` (`actions.ts:225`): "Only someone in the review, whoever set it up, or an admin can change it." |
| Add yourself to a review you are not in | Nobody (an admin can) | The same line. The screen stops offering it (V6) |
| End or delete it | Whoever set it up, or an admin | `endReview`, `deleteReview` (`removal.ts:337–`) |
| Mark reviewed, add a note, accept a risk, carry over, finish | **New:** someone in the review, or an admin | `reviewCall`, `markReviewed`, `acceptRisk`, and the new `decideAndReview`, `carryOver`, `finishSession`: "Only people in {review}, or an admin, can speak for it." Today these check nothing (`actions.ts:154–190`) |
| Agree a next step or ask a question *in* a review | **New:** the same | The same check, where a `reviewId` is given. Without one, `addAction` and `askQuestion` are unchanged: anyone, on the goal's page |
| Reopen a finished session | **New:** someone in the review, or an admin | `reopenSession`. Today's `unmarkReviewed` allows "whoever marked them, or an admin" (`removal.ts:98`); it stays as it is for the message's Undo |
| Correct or remove what was said | Whoever said it, or an admin | `editCall` (`actions.ts:198`), `deleteNote` |
| Mark a next step done; answer a question; withdraw | As the core has it | `markActionDone` / `canMarkDone` (`asks.ts:67`), `answerRequest` / `canAnswer`, `canWithdraw` |
| Ask an owner for an update | Anyone but the owner | `askForUpdate` (`actions.ts:60`) |

**The parked question, analysed.** "Should only people in a review be able to mark its goals reviewed? Today anyone may."

- *What is true today:* the rule lets anyone (and so does the AI tool); the screen lets only people in the review; and the screen's "Join this review" is refused for everyone it is offered to. So in the app only members can, by accident of the screen, and through a token anyone can.
- *For restricting:* "reviewed", "the review accepts the risk" and "Finish" speak for a group. One of them from someone outside is a false record, and it puts "Looked at by {name} in {review}" on a goal's page. The membership list is otherwise decoration.
- *Against:* Faro has no sign-in, so the check stops mistakes and not intent; and a stand-in for an absent lead must first be added (one edit by anyone in the review).
- *What is not restricted either way:* reading; next steps and questions on a goal's own page; answering and marking done.
- *Recommended:* restrict, in the rule (row "new" above), admins included. If Lane chooses otherwise, section 12.

## 4. Rules for `src/domain`

All pure. New rules take what they read (AR4), never the whole workspace: "said" below means the decisions and asks of one review, as `saidIn` returns them filtered by `reviewId`. Each worked example becomes a unit test; those marked ◆ also become conformance rows (`spec/conformance/review-agenda.csv`, `review-sessions.csv`) or `rules.ts` examples.

Examples use the demo: Developer Productivity fortnightly (`devprod`), every 2 weeks on Tuesdays, sessions in even weeks: week 46 (Tue 10 Nov), 48 (Tue 24 Nov), 50 (Tue 8 Dec). Week 46 is Mon 9 to Sun 15 Nov 2026.

### Rule 1. Why a goal is on the agenda: `agendaReason(a, facts)`

`a` is the goal's `GoalAttention` (the core's, unchanged). `facts` is `{ carriedFrom?: string; decided?: Decided | null; lastAccepted?: { on: string; reason: string } | null; waitingQuestion?: boolean; rhythm: boolean }`. Returns one or two sentences, 140 characters at most, built from the first two that apply, in this order:

| When | Sentence |
|---|---|
| Carried | "Carried over from {date}." (then the next that applies) |
| `a.handled` of kind `action` | "Next step open: {first name}, by {date}." (agreed in this review's last session: "Next step open from last time: …") |
| `a.handled` of kind `answered` | "Its request was answered by {name} in week {n}." |
| An open next step on the goal is past its week | "A next step is overdue by {n} week(s): {first name}." |
| Flag `decision` | "Waiting on {name}: {the ask, cut to 60 characters}, asked {date}." |
| Flag `missed-path` | "It said back on plan by week {n}, and isn’t." |
| Flag `no-path` | "No next step, and nobody has said how it gets back." |
| Behind, a path, no open next step | "No next step." and, when the path's date has moved, "Its back-on-plan date has moved from week {a} to week {b}." |
| Flag `trend` | "Getting worse for {n} check-ins." |
| Flag `greener` | "Called {status}; the numbers say {status}." |
| Flag `stale` (only with a rhythm) | "No check-in for {n} days. Its last was {status}." |
| `lastAccepted`, still behind | "Risk accepted on {date}; it has checked in since." |
| `waitingQuestion` | "A question from last time is waiting." |
| Behind, nothing else | "{Off track / At risk}: {the owner's reason, cut to 80 characters}" |

The `due` flag never gives a reason. With no set rhythm, a status not from this week adds nothing here (the row says "as of week {n}" by the core's `asOfWeek`).

| Given | Then |
|---|---|
| ◆ Merge-to-deploy time: off track, a path dated week 51 first said week 31, no next step | "No next step. Its back-on-plan date has moved from week 31 to week 51." |
| ◆ Autoscaling CI runner pools: off track, waiting on Amara's decision asked 4 Aug | "Waiting on Amara Nwosu: approve the extra CI runner budget for Q4, asked 4 Aug." |
| ◆ Repositories covered by a named review rota: at risk, Tariq's step from the last session open, due week 47 | "Next step open from last time: Tariq, by Thu 19 Nov." |
| ◆ The same on Tue 24 Nov (week 48), still open | "A next step is overdue by 1 week: Tariq." |
| ◆ Changes shipped with automated integration tests: on track, flag `trend` over two check-ins | "Getting worse for 2 check-ins." |
| ◆ Security gate: no check-in since week 44, last on track, a rhythm | "No check-in for 16 days. Its last was on track." |
| The same with no set rhythm | Not on the to-discuss list at all (no flag); in "Nothing flagged", "as of week 44" |

### Rule 2. The agenda's groups: `agendaGroups(plan, facts)`

`plan` is `sessionPlan` (unchanged: the order fixed as the session started). Returns `{ carried, needs, handled, rest: { changed, same } }`, each in the plan's order.

- `carried`: goals to discuss that have a carry mark (rule 6) from this review's previous session and no decision since.
- `handled`: goals to discuss where `a.handled` is set. `needs`: the other goals to discuss.
- `rest`: the plan's healthy goals. `changed` when, since the last held session's date: the status differs from its status then; or it was created; or it reached its target; or (no set rhythm) it has a check-in. Else `same`.
- The walk's order is `carried`, `needs`, `handled`; the list bar's "to discuss" counts all three.

| Given (devprod, 11 Nov) | Then |
|---|---|
| ◆ 10 to discuss, of which the rota goal has Tariq's step in date | `needs` 9, `handled` 1, `carried` 0 |
| ◆ 25 with nothing flagged; one reached its target in week 45, one was at risk on the last session's date | `changed` 2, `same` 23 |
| ◆ Next session, two goals carried on 11 Nov with no decision since | `carried` 2, first in the walk |

### Rule 3. From last time: `fromLastTime(review, said, sessionWeek, week)`

Replaces `lastTime` (`decide.ts:54`). Returns null when every list is empty, else:

```
{ held: { week, on } | null,              // lastHeld, unchanged
  notHeld: string[],                      // dates of sessions due since `held` and not held (rule 4)
  steps: CarriedAction[],                 // every next step said in this review in ANY earlier session that is open or
                                          // overdue now, plus those marked done since `held.on`; overdue first, then open
                                          // by due week, then done
  questions: { ask, goalId, state: 'waiting' | 'answered', answer? }[],   // open ones from any earlier session; answered since held.on
  accepted: { goalId, on, reason, behindNow: boolean }[] }               // risks accepted in the held session only
```

| Given | Then |
|---|---|
| ◆ Session 46 accepted nine risks and agreed no step; Tariq's step from the session before is open, due week 47. Asked in week 48 | `steps`: Tariq's, overdue; `accepted`: nine. (Today: null, V1) |
| ◆ A step agreed in session 44, done in week 45; asked in week 46, last held week 44 | In `steps`, done |
| The same asked in week 48 after session 46 was held | Not listed (done before `held.on`) |
| ◆ Session 46 was not held; asked in week 48 | `held` is session 44's; `notHeld`: ["2026-11-10"] |
| A review never held | null |

### Rule 4. Which session a review is on: `openSession(review, said, cycle, week, today)`

Replaces the use of `sessionWeek` in `reviewSession` (the function `sessionWeek` stays, as "the scheduled week on or after a week").

```
scheduled(k): the review's k-th session week (as today: weeks w with w % everyWeeks === 0, from the first on or after
              the day it was set up)
prev = the latest scheduled week ≤ week;  next = the first scheduled week > prev
if prev exists, is not finished (rule 6), and today < the date of `next`'s session (or there is no next): the session is prev
else: the session is the first scheduled week ≥ week
state: 'coming' (its date is today or later, nothing said) | 'in-progress' (something said, not finished)
     | 'late' (its date has passed, not finished; with `holdUntil` = the day before next's date)
     | 'held' (finished; then the page shows it until the day after, and the list shows the next)
notHeld(review, said, cycle, week): scheduled weeks before the open session, since the last finished one (or since set-up,
     or since Reviews was last switched on), in which nothing was finished
```

`upcomingSessionWeek`, `nextSessionDate`, `daysPast` and `home.ts`'s `missedReviews` read this one function. `missedReviews` keeps to the session's own week (Home's "Not held yet" is not shown through a whole fortnight).

| Given (devprod) | Then |
|---|---|
| ◆ Wed 11 Nov, nothing said | Session 46, `late`, 1 day, `holdUntil` Mon 23 Nov |
| ◆ Tue 17 Nov (week 47), still nothing | Session 46, `late`, 7 days. (Today: session 48, and 46 is forgotten) |
| ◆ Tue 24 Nov, 46 never finished | Session 48, `coming`; `notHeld` ["2026-11-10"] |
| ◆ Wed 11 Nov, finished that day | `held` on 11 Nov; from Thu 12 Nov the list shows session 48 |
| ◆ A weekly Thursday review, Mon 16 Nov, last Thursday's not held | Session of Thu 12 Nov, `late`, `holdUntil` Wed 18 Nov |
| ◆ The quarterly review (every 13 weeks), missed Wed 23 Sept, asked Mon 28 Sept | Still that session, `late`, 5 days |
| Something said in session 46 on Tue 17 Nov | Saved with `week: 46` |

### Rule 5. One goal in the walk: `walkForm`, `defaultDueWeek`, `nextStep`

- `outcomeFor(goal, session, asks, checkIns, cycle, week, today)` extends `decisionFor` (`decide.ts:34`). Returns the latest of, said in this session about the goal: `next-step` (as today, including one agreed elsewhere since the latest check-in and in date, `inSession: false`); `accept-risk`; **`question`** (a question asked in this session, open or answered); **`new-goal`** (GE6's `goalToSetUp`); **`update-asked`** (an open ask for an update raised since the latest check-in); **`carried`** (a carry mark in this session); else null.
- `walkForm(a, outcome, reviewed, viewerIn)`: `'reading'` when the viewer isn't in the review and isn't an admin; `'decide'` when the status is off track, at risk or (with a rhythm) no recent update, and `outcome` is null or `carried`; `'confirm'` otherwise.
- `mayLeave(a, outcome)`: true unless `walkForm` would be `'decide'`. "Reviewed" is refused for a goal that may not leave: "It’s {off track}: agree a next step, accept the risk, ask a question, or come back to it." (moved from the screen, `Inspect.tsx:116`, into `reviewCall`, so the tool obeys it too).
- `defaultDueWeek(review, sessionWeek, cycle, week)`: the review's next scheduled week after `sessionWeek`; if that is past the cycle's end, the cycle's last week; never before `week`.
- `nextStep(order, outcomes, reviewed, at)`: after `at`, the first goal to discuss that is not reviewed and has no outcome and was not come back to in this pass; then goals come back to, in order; then `'rest'` if any goal with nothing flagged is not reviewed; then `'finish'`. "Come back to it later" is kept for the tab (`sessionStorage`, beside the order, as today's order is) and is not a record.

| Given | Then |
|---|---|
| ◆ Off track, nothing said | `decide`; may not leave |
| ◆ Off track, a question asked in this session | outcome `question`; `confirm`; may leave. (Today: must still decide, V19) |
| ◆ At risk, a next step in date agreed in Platform leadership weekly since its last check-in | outcome `next-step`, `inSession: false`; `confirm` |
| ◆ On track with a `trend` flag | `confirm` |
| ◆ No recent update, a rhythm, nothing said | `decide`, with "Ask {owner} for an update" first |
| ◆ `defaultDueWeek` for devprod in session 46 | 48 ("Week 48 · Tue 24 Nov, the next session") |
| ◆ The same for a review in the cycle's last week | That week |
| Goals 1 to 10, goal 3 come back to, goal 10 just saved | Goal 3; after it, `rest` |

### Rule 6. Saving, finishing and reopening (`src/domain/actions.ts`, `decide.ts`)

- `carryNote(reason)`, `carriedReason(note)`: as `acceptNote` and `acceptedReason` (`decide.ts:17–20`), with the vocabulary's new term `DECIDED['carried'].label` = "Carried to the next session"; a note "Carried to the next session: {reason}" or "Carried to the next session." One place writes and reads the prefix.
- `decideAndReview(x, goal, review, week, what)`: `what` is one of `{ kind: 'next-step', text, assigneeId, dueWeek }`, `{ kind: 'accept-risk', reason }`, `{ kind: 'question', text }`, `{ kind: 'new-goal', … }` (GE6's `agreeGoal`), `{ kind: 'update' }`, `{ kind: 'none' }`. Returns one commit: the existing action's commit (`addAction`, `acceptRisk`, `askQuestion`, `agreeGoal`, `askForUpdate`) merged with `reviewCall(…, 'acknowledge')`. `'none'` is "Reviewed, nothing to add" and is refused when `mayLeave` is false. A next step for a goal behind needs a week ("Choose the week it’s due by.", as today).
- `carryOver(x, goals, review, week, reason)`: one `note` decision per goal with `carryNote(reason)`. No "reviewed" mark.
- `finished(session, plan)`: true when every goal in the plan is reviewed or carried in this session. `sessionState`'s "held" becomes this (identical to today when nothing is carried).
- `finishReadBack(session, plan, fromLast)`: `{ notDecided: Goal[], byOwner, accepted, questions, updates, newGoals, lastTime: { done, open }, confirmed: Goal[], rest: { reviewed, toMark } }` — `sessionDecisions` (`decide.ts:64`) extended.
- `finishSession(x, review, week, { carry: boolean, reason? })`: refused while `notDecided` is not empty and `carry` is false ("Decide these {n} goals, or carry them."). One commit: `carryOver` for `notDecided`; `markReviewed` for every goal with nothing flagged not yet reviewed; and **one** change, entity `review`, action `edited`, summary "Finished {review}: {5 next steps, 2 risks accepted, 1 question, 2 carried over, 27 reviewed}" (parts above zero). The per-goal changes `markReviewed` writes today are kept on each goal's History but are grouped under this one in Activity (`activity.ts`'s grouping by save, as an import's rows are).
- `finishMarks(session)`: the decisions written by the latest `finishSession` (they share its `at`).
- `reopenSession(x, review, week)`: sets aside `finishMarks` (as `unmarkReviewed` does, `removal.ts:94`), with one change, "Reopened {review}, {date}". Refused once the next session's day has come: "The next session has begun; this one can’t be reopened." Decisions made in the walk are untouched.

| Given | Then |
|---|---|
| ◆ "A next step" for Pavel, week 48, on an off-track goal | One commit: an action ask (review `devprod`, week 46) and a "reviewed" decision. One Undo takes both |
| ◆ Finish with 8 decided, 2 confirmed, 25 not yet reviewed, none undecided | 25 "reviewed" marks and one Activity entry: "Finished Developer Productivity fortnightly: 5 next steps, 2 risks accepted, 1 question, 27 reviewed" |
| ◆ Finish with 2 undecided, carry ticked, "Pavel was away" | Two notes "Carried to the next session: Pavel was away"; the session is finished; both goals are `carried` in session 48 |
| ◆ The same, carry unticked | Refused |
| ◆ Daniel reopens on 12 Nov what Rhea finished | Allowed; the 25 are back; "Reopened …" by Daniel |
| ◆ Anyone tries on Tue 24 Nov | Refused |
| Tunde (not in the review) calls any of these | Refused: "Only people in Developer Productivity fortnightly, or an admin, can speak for it." (decision 1) |

A carried goal that is behind shows the core's quiet line "Looked at by Rhea in Developer Productivity fortnightly, week 46" with the carry words as what was said (`lookedAtFor` reads notes, unchanged). That is true of it and puts nothing in hand.

### Rule 7. Before you meet: `beforeMeeting(goals, checkIns, updateAsks, cycle, week, lastHeldOn, viewerId)`

Takes the review's goals (as summaries), their check-ins and open update asks. Returns `{ thisWeek: { goals, byOwner, dueOn } | null, quiet: { goals, sinceWeek } | null, notUpdated: { goals, since } | null, canAsk: Goal[] }`.

- `thisWeek` (a rhythm): live goals due a check-in this week (the core's `due` flag) with none. Null when the session's day is after the due day and none is late.
- `quiet` (a rhythm): goals whose status is "No recent update".
- `notUpdated` (no set rhythm): live goals with no check-in since `lastHeldOn`.
- `canAsk`: of all those, the goals the viewer doesn't own and that have no update ask open.

| Given | Then |
|---|---|
| ◆ devprod, Wed 11 Nov, a rhythm: 4 goals with no check-in for week 46 (Pavel 2, Diego 1, Chen 1); one goal quiet since week 44 | `thisWeek` 4 by three owners, due Thu 12 Nov; `quiet` 1 |
| ◆ The same workspace with no set rhythm, last held Tue 27 Oct, 12 goals with no check-in since | `notUpdated` 12; the other two null |
| Rhea owns one of the four | `canAsk` 3 of them |

### Rule 8. A goal in several reviews: `alsoIn(goalId, reviews, goals, said, cycle, week, today, exceptId)` and `overlap(scope, reviews, goals)`

- `alsoIn` returns, for each other live review whose scope covers the goal, `{ reviewId, name, nextOn, last: { on, what } | null }`, soonest next session first. `what` is the latest thing that review said about the goal: "reviewed, nothing added", "a next step for {name}", "accepted the risk", "asked a question", "carried over".
- The goal page's section "Last time we talked" (`lastTalked`, `goalPage.ts:464`) lists up to three reviews from the same function, each "{review}, {date}: {what}" and one line "Next: {review}, {date}; {review}, {date}." An accepted risk reads "The review accepted the risk: {reason}", never "{name} noted".
- `overlap(scope, reviews, goals)` returns `[{ review, count }]`, largest first, for set-up's Check.
- `goalsIn` (`review.ts:26`) takes `scope.teams?: Id[]` as well: every goal whose team is one of them. Watching passes none. The stored scope is JSON, so no migration (`rows.ts:163` reads `teams ?? []`).

| Given | Then |
|---|---|
| ◆ Merge-to-deploy time, in devprod and the leadership weekly, reviewed in the weekly on Thu 5 Nov | In devprod's walk: "Also in Platform leadership weekly (Thu 12 Nov): reviewed there on Thu 5 Nov, nothing added." |
| ◆ A scope of the tree "Lead time for changes" (17 goals) | `overlap`: devprod 17 |
| ◆ `goalsIn({ teams: ['cicd'], … })` | The 9 goals whose team is CI/CD |

### Rule 9. Set-up's read-back: `reviewReadBack(draft, before, goals as attention, reviews, cycle, week, today)`

Returns the sentences of 2.2 item 5 as data: `{ goals, people, cadence, firstOn, nextTwo, discuss, byStatus, nothingFlagged, overlaps, changes }`. `firstOn` is rule 4's first scheduled date for the draft. `changes` (when `before`): goals joining and leaving, people joining and leaving with their open next steps counted, day or cadence. "Nothing would change" when all are empty.

| Given | Then |
|---|---|
| ◆ "CI/CD weekly": the Lead time tree and team CI/CD, 2 people, every week, Thursday, set up Wed 11 Nov | 20 goals; first Thu 12 Nov, then 19 and 26 Nov; 7 to discuss; overlap devprod 17 |
| ◆ Changing devprod from Tuesdays to Thursdays on Wed 11 Nov, session 46 not held | Nothing was said in it, so the session moves: "It moves from Tuesdays to Thursdays. The next is Thu 12 Nov." |
| Removing Diego, who has 2 open next steps | "Diego Ramírez leaves. Diego’s 2 open next steps stay his." |

### Rule 10. The summary as text: `summaryText(review, readBack, cycle)`

Plain text, British dates, for "Copy the summary" and the tool's answer:

```
Developer Productivity fortnightly, held Wed 11 Nov 2026 (finished by Rhea Kapoor)
Next steps
- Pavel Novák: Move the payments monorepo to the merge queue first. By Tue 24 Nov. (Merge-to-deploy time (median), G-6)
…
Risks accepted
- Autoscaling CI runner pools: Nothing to do until the Q4 budget decision on Thu 12 Nov.
Questions
- For Rhea Kapoor: What is the earliest week lead time is back under 30 hours if the budget lands? (Lead time for changes)
Carried to Tue 24 Nov: none
27 goals reviewed with nothing to add. Next session: Tue 24 Nov.
```

### Rule 11. Small ones

- `sessionDayIn(review, cycle, week)`: the review's weekday in that week, for "Week 48 · Tue 24 Nov". A next step's due date on a review's screens is this day; elsewhere it stays the core's form.
- `whenText(date, today)`: "Today, Wed 11 Nov" / "Thu 12 Nov, tomorrow" / "Tue 10 Nov, yesterday" / "Tue 24 Nov, in 13 days" / "Wed 23 Dec, in 6 weeks" (from 21 days) / "{n} days ago". Home's "Next review" cell uses it (V17).
- `DECISION_LABEL` and the Activity words: `acknowledge` → "Reviewed, nothing to add"; a note that is an accepted risk → "Accepted the risk"; a carry note → "Carried to the next session".
- `reviewsCount(viewer, …)` (the menu): reviews the viewer is in whose open session is `in-progress`, `late`, or `coming` today.
- U22: the Finish entry counts goals, not marks (rule 6). U20 (a look that settles a trend flag) is the core's `lookedAtFor` and is **not** changed here; it stays with backlog LP.

## 5. Extension points

None new. The design uses, once FT3 has moved the module:

| Place or contract | For | Exists? |
|---|---|---|
| `routes`, a `work`-group menu item, `ModuleNav.count` | The addresses of section 1; "Reviews 1" | FT3 |
| `home.lead` | A leader's "20 goals to discuss · Open the review"; a member's "Developer Productivity fortnightly was due Tue 10 Nov · Start the review" | FT3 |
| `home.glance` | "Next review · {name} · {whenText}" / "Not held yet" | FT3 |
| `goal.sections` | "Last time we talked" (rule 8) | Exists |
| `goal.facts` | "In {review}, next Tue 24 Nov" (the soonest; "and {n} more") | Exists |
| `people.person` | The reviews a person is in | Exists |
| `finders` | A review's name from its id on core records ("Agreed in {review}") | Exists (AR2) |
| `toSortOut` | "No review is set up" | Exists |

The walk imports from the core: the status shape and word, the scorecard, `stepsAndAsks` and its row, the chart, find-and-pick, the week picker. It registers nothing on the goal's page for the walk. Not added, on purpose: a flag or "handled" contributed by a module; a "review mode" of the goal's page; a session record in the core's types.

## 6. AI tools (MCP)

Parity by `src/mcp/parity.ts`; every tool refuses with FT2's line when Reviews is off. Run `npm run build:mcp` and commit `api/mcp.js`.

| Tool | Change |
|---|---|
| `list_reviews` | Each review gains `session: { week, date, state: coming\|in-progress\|late\|held, holdUntil? }`, `notHeld: [dates]`, `openNextSteps`, `overdueNextSteps`; text in 2.1's words |
| `get_review` | `toDiscuss` in rule 2's groups, each goal with `reason` (rule 1), `outcome` (rule 5), `alsoIn` (rule 8); `nothingFlagged: { changed, same }`; `fromLastTime` (rule 3); `beforeMeeting` (rule 7); optional `week` for an earlier session's record |
| `review_call` | `kind` gains `accept` (exists), `carry` (reason optional), `update` (ask the owner for an update). A decision kind also marks the goal reviewed (rule 6) unless `stay: true`. `acknowledge` on a goal that may not leave answers with rule 5's words. `due_week` defaults to rule 5's default and the answer says which week it used |
| **New: `finish_review`** `{ review_id, carry?: boolean, reason?: string, confirm?: boolean }` | Without `confirm`: rule 6's read-back as text (rule 10), changing nothing. With it: `finishSession` |
| **New: `reopen_review`** `{ review_id }` | `reopenSession` |
| `save_review` | `teams` (names or ids); without `confirm`, returns rule 9's read-back and changes nothing (as `set_rhythm` does in FT1) |
| `edit_call`, `end_review`, `delete_review`, `mark_action_done`, `answer_request`, `ask_for_update` | Unchanged |
| `get_my_work` | `yourReviews` gains `state` and `whenText`; "action" in its text becomes "next step" |

`parity.ts` rows: `decideAndReview`, `carryOver` → `review_call`; `finishSession` → `finish_review`; `reopenSession` → `reopen_review`; the screens `ReviewWalk`, `ReviewFinish`, `ReviewSession` → `get_review`, `review_call`, `finish_review`.

## 7. Migration

**None.** Everything is worked out from records that exist: a carry is a note with a reserved prefix (as an accepted risk already is, `decide.ts:17`); a session's state comes from what was said in it; a team in a scope sits inside the stored JSON; "who finished" is who made the last mark of the finish save.

Two things this cannot do, each offered to Lane (README decisions 6c and 7b) with its SQL in section 12: "We're not holding this one", and choosing which week a fortnightly review starts in.

## 8. Evals

**Requirements** (`evals/requirements.json`; the six `REVIEW…` ids that exist stay, reworded where a word changed):

- `REVIEW-PREPARE`: "A review’s page says, before a session, when it is, who has not checked in, every next step and question still open from earlier sessions, and why each goal is on the agenda, worst first, with the goals that have nothing flagged folded and counted."
- `REVIEW-WALK`: "The walkthrough is the review’s own page for one goal at a time, in an order fixed when the session starts. A goal that is off track or at risk leaves with a next step (an owner and a week), an accepted risk with a reason, a question, a new goal agreed, or is come back to; saving a decision moves on. The goals with nothing flagged are reviewed together."
- `REVIEW-FINISH`: "Finishing reads back everything decided, lets goals not reached be carried to the next session, and records the session as held by one entry. Anyone in the review can reopen it until the next session. The next session opens with what was agreed and how each stands."

**Journeys** (phone and desktop, in the demo, as the person named; the eval sets the clock with `today=`):

| | Journey | Passes when |
|---|---|---|
| U118 | Rhea prepares | Reviews → the row for Developer Productivity fortnightly says "Was due Tue 10 Nov, yesterday" and "10 to discuss · 25 with nothing flagged" → its page: "Before you meet" names the owners with no check-in and "Ask them for an update" turns into "Asked {n} owners today."; "From last time" lists Tariq's step; every row under "To discuss" has a reason line; the count of rows equals the heading; "Nothing flagged · 25" is folded. As Tunde: no "Start the review", and the line naming who can add him |
| U119 | Rhea walks and decides | "Start the review" → goal 1 of 10: the decision's primary button is in view without scrolling at 1440×900; type a sentence, press "Save and go to the next goal" once → goal 2 of 10, and the step is on goal 1's page for Pavel by Tue 24 Nov. Goal 2: "We accept the risk" with a reason. Goal 3: a question, and it moves on. Goal 4: "Come back to it later"; "‹ Previous" returns to goal 3 showing its question. After goal 10 the walk offers goal 4 again, then "Nothing flagged · 25" → "Review all 25 and finish" |
| U120 | Finish, afterwards, reopen | Finish's counts equal what was done in U119; "Change" on a line opens that goal; with goal 4 undecided, "Finish the review" is disabled until "Carry them to Tue 24 Nov" is ticked. After: the page says "Held Wed 11 Nov, finished by Rhea Kapoor"; Activity has one entry beginning "Rhea Kapoor finished"; the goal's "Last time we talked" says "The review accepted the risk"; Home (as Pavel) lists the step. As Daniel: "Reopen this session" puts the 25 back, and Finish again restores them |
| U121 | The next session, and a missed one | `today=2026-11-24`: "Start the review" opens "Since last time" with Tariq's step "Overdue by 1 week", the step from U119, the accepted risk and its goal's status; "Mark done" on one moves it under Done; the first goal is the one carried in U120, with "Carried over from Wed 11 Nov". Without holding it, `today=2026-12-08`: the page lists "Not held: Tue 24 Nov" under Earlier sessions and the opening says so; `today=2026-11-17` in a fresh demo: still "Was due Tue 10 Nov, 7 days ago" |

**Checks:**

- **F24** (finish): on every `/reviews…` route at both widths, none of these words appears: "action" (as a word on screen), "Outstanding", "days past", "Skip for now", "Still to review", "Seen"; every date has a weekday; at 1440×900 and 390×844 the walk's primary button is inside the viewport on load; in `?present=1` at 1920×1080 a goal's page doesn't scroll; with `FARO_WITHOUT=reviews` no route here exists and the goal's page has no "review" in a heading or button.
- **N25** (notes): `/goals/<id>?review=<id>` lands on the walk; a non-member's `decideAndReview`, `finishSession` and `reopenSession` are refused with their words (after decision 1); "reviewed" on an undecided off-track goal is refused through the tool; Finish's read-back equals `finishReadBack`; the reason on each agenda row equals `agendaReason`; `finish_review` without `confirm` changes nothing.
- **P3, P4, P6, P7** extended to every new screen: every status shape has its word (the agenda rows, the opening's accepted risks); the warning mark, not a status shape, for "Was due…", "Overdue by…", "On the agenda because:"; no capsule for a level, a state or a choice.
- Existing journeys that walk a review (U13, U30, U36, U47, U49, U63, U67, U79, U80) are updated to the new addresses and words; `evals/notes/1-reviews.cjs` likewise.

**Unit tests:** each table in section 4; `openSession` across a cycle's end; `finishMarks` after two finishes and a reopen; `goalsIn` with teams; `summaryText`'s exact text.

## 9. Help, What's new, the spec

- **What's new** (top of `src/help/whatsNew.ts`), one per item:
  - RV1: "A review’s agenda says why each goal is on it, and its page shows who hasn’t checked in and what is still open from earlier sessions."
  - RV2: "Walking a review is now its own page: one goal on a screen, and a next step is a sentence and one press."
  - RV3: "Finishing a review reads back everything decided. Goals you didn’t reach can be carried to the next session, and anyone in the review can reopen it."
  - RV4: "The next session opens with what was agreed last time and how each stands."
  - RV5: "Set up a review by team, see its first dates, and read it back before saving."
  - RV6: "Reviews has a search, and a session past its day says how long it can still be held."
  - RV7: "Only people in a review, or an admin, decide in it. Everyone can still read it."
  - RV8: "Present a review on a big screen; a phone gets its own layout."
  - RV10: "A review’s one-pager leads with why each goal is on the agenda."
- **Guide** (`src/help/guide.ts`, article `reviews`, in the module's `help.ts` after FT3): rewritten in the order of section 2 (the list; setting one up; before a session; walking it; deciding; finishing and reopening; a missed session; a goal in two reviews; who may; on a phone; presenting; with no set check-in rhythm). The articles `home` and `goal-page` change one paragraph each (the cell's words; "Last time we talked"). `guide.test.ts`: the new routes map to `reviews`.
- **The spec** (`npm run spec`): `src/spec/rules.ts` gains rules 1 to 6 with the ◆ examples under `review-agenda`, `review-sessions`, `review-decide` (the last replaces today's page); `src/spec/screens.ts` gains the screens of section 1 with their main actions (README's table); the module's `rebuild` stage (FT2's outline) gains "the walk imports the core's goal parts" and the two conformance files. Vocabulary: `SESSION` becomes coming, in progress, late, held, not held; `DECIDED` gains `question`, `carried`.

## 10. What the Home area needs from this one

For `docs/design/home/` to place; this area doesn't draw Home.

| Viewer | Block | Words | Goes to |
|---|---|---|---|
| In a review whose session is today, late or in progress | The lead (`home.lead`), when nothing of their own is more urgent by Home's rule | "{Review} is today" / "… was due Tue 10 Nov, yesterday" / "… is in progress" · "{n} to discuss · {h} with nothing flagged" · **Start the review** / **Carry on** | The review; the walk |
| In a review, session coming | The strip's cell (`home.glance`) | "Next review · {name} · Thu 12 Nov, tomorrow" | The review |
| Has a next step or question from a review | "Needs your response", as today | "You agreed it in {review} on {date}. By {date}." | The goal |
| Owns a goal in a review they are not in | Nothing on Home | (the goal's page says "In {review}, next {date}") | |

## 11. Build plan

Each item is one PR with its section of `spec/`, conformance rows, evals, Help and What's new. None is `[no news]`. Effort: S (under a day), M (a release), S–M between.

| Item | What | Effort | Depends on |
|---|---|---|---|
| **RV1** | The agenda says why; before you meet; from last time (rules 1, 2, 3, 7; 2.3's prepare state; the words of section 0 on the review's page; `get_review`); U118, `REVIEW-PREPARE` | S–M | GT1 (merged). Best after FT2, so it is written behind the switch |
| **RV2** | The walk as the review's page, with the decision in place (2.5, 2.6, rule 5, `decideAndReview`, the redirect from `?review=`, the Agenda sheet, `review_call`'s new kinds); U119, `REVIEW-WALK`, F24's viewport checks | M | RV1; FS1 (merged) for "Who"; GE9's week picker for "By" (a select of weeks with dates is the fallback, as GT1 uses) |
| **RV3** | Finish as a page, carry over, the held page, reopen, one Activity entry, copy the summary, earlier sessions (2.7, 2.8, 2.3 held, rule 6, rule 10, `finish_review`, `reopen_review`); U120, `REVIEW-FINISH` | M | RV2; AR3 (merged) |
| **RV4** | The next session's opening and the session's window (2.4, rule 4, "Not held", `whenText` on Home's cell); U121 | S–M | RV1, RV3 |
| **RV5** | Set-up and change: four ways with a team, the read-back, first dates, "Every quarter", the overlap Check (2.2, rules 8 `overlap` and `goalsIn`, rule 9, `save_review`) | S–M | FS1 (merged); round 2's Check level wording (IM2) for the mark, not its engine |
| **RV6** | The list with its bar (2.1) | S | FS2 (merged for Goals; its bar component); RV4's states |
| **RV7** | Who may speak for a review, in the rule; the join line (section 3; N25) | S | Lane's decision 1. Can go first of all: it is a fix |
| **RV8** | The phone's foot and sheet; presenting (2.10, 2.11) | S–M | RV2 |
| **RV9** | Agree a new goal in the decision block | (in GE6) | GE6 (round 2); RV2 gives it its place. No separate work if GE6 lands after RV2 |
| **RV10** | The one-pager (2.9); a goal in several reviews on the goal's page (rule 8's `lastTalked`) | S | RV1 |

About five releases. **The first cut is RV7, RV1, RV2, RV3**: after it the agenda explains itself, a decision is a sentence and a press, and a review ends properly and can be reopened. FT3 (the real move) is not a dependency of any item: each is written in the module's folder as far as FT2 allows, and FT3 then moves less.

Round 1 and 2 items this waits on, by name: GT1 (merged), FS1 (merged; its held pickers are not the ones used here), FS2 (merged for the bar), AR3 (merged), FT2 (recommended first), GE9 (the week picker; a fallback is given), GE6 (for RV9), IM2 (wording only). It holds nothing in rounds 1 or 2.

## 12. If Lane decides otherwise

| Decision | Then |
|---|---|
| 1 (b): anyone may add themselves | `saveReview` allows a change that only adds the actor to `people`; the review's page shows "Join this review" (ordinary button) and logs "joined"; section 3's "new" rows stand |
| 1 (c): anyone may speak | Drop the check and RV7's rule; the walk's form (d) goes; the review's page offers "Start the review" to everyone; keep the join line out. The record still says who said each thing |
| 2 (b): a question is not a way out | `outcomeFor` drops `question` from what lets a goal leave; the choice stays in the block but saving it doesn't move on, and the block says "It still needs a next step or an accepted risk." |
| 3 (b): no carrying | Drop `carryOver`, the carry prefix and rule 2's `carried`; Finish's "Not decided" has no tick and Finish stays disabled; V7 stands and the README says so |
| 3 (c): mark them reviewed | Finish marks every goal; "Not decided" reads "{n} goals were not discussed and are marked reviewed with nothing said."; not recommended (it is P1 again) |
| 4 (b), (c) | `reopenSession` checks the finisher or an admin; or is dropped, with today's Undo on the message only |
| 5 (b): keep the goal's page | Drop 2.5's layout and the redirect; build rule 5 and the in-place block inside `ReviewCallBar`; the module boundary keeps `Inspect.tsx` in `elsewhere`, and FT3 must still solve the walk |
| 6 (b): today's window | Rule 4 keeps `sessionWeek`; "Not held" is still recorded (it needs no storage) |
| 6 (c): "We're not holding this one", or a full session record | One table, the module's own (listed in `module.json` `tables`; needs AS part 2's records extension point). `supabase/migrations/00NN_review_sessions.sql`, runs as `faro_owner`, safe to run twice: |

```sql
-- A review's sessions (backlog RV, docs/design/reviews): one row per session that was started, finished or skipped.
-- Only needed for "we're not holding this one" and for a record of who was there; everything else is worked out.
-- Runs as faro_owner with search_path faro. A new table gets no default grants: every grant is written out.
create table if not exists okr_review_sessions (
  workspace_id text not null references okr_workspaces (id) on delete cascade,
  review_id text not null references okr_reviews (id) on delete cascade,
  week int not null check (week >= 1),
  cycle_id text not null,
  started_at timestamptz, started_by text,
  finished_at timestamptz, finished_by text,
  skipped_at timestamptz, skipped_by text, skipped_why text,
  present jsonb not null default '[]',
  walk_order jsonb not null default '[]',
  version int not null default 0,
  primary key (review_id, cycle_id, week)
);
create index if not exists okr_review_sessions_ws on okr_review_sessions (workspace_id);
alter table okr_review_sessions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'faro' and tablename = 'okr_review_sessions' and policyname = 'demo: read') then
    create policy "demo: read" on okr_review_sessions for select to anon using (true);
    create policy "demo: add" on okr_review_sessions for insert to anon with check (true);
    create policy "demo: change" on okr_review_sessions for update to anon using (true) with check (true);
  end if;
end $$;
grant select, insert, update on okr_review_sessions to anon;
```

The save function (`okr_write`) would need the table added, which means replacing it whole with `set search_path = faro, pg_temp` restated (toggles README 2.1 explains the cost); do it through the records extension point (AS part 2) and not by hand. This is why it is not recommended now.

| Decision | Then |
|---|---|
| 7 (b): choose the first date | One column; set-up's "When" gains "First on" (a select of the next four dates of that weekday); rule 4's `scheduled` counts every `everyWeeks` weeks from `first_on` instead of by week number. Existing reviews keep today's rule while the column is null. `supabase/migrations/00NN_review_first_on.sql`: |

```sql
-- Which week a review's sessions count from (backlog RV): null keeps the old rule (weeks divisible by every_weeks).
-- A column takes its table's grants and row rules. Seen only through faro (no public redirect). Safe to run twice.
alter table okr_reviews add column if not exists first_on date;
```

| Decision | Then |
|---|---|
| 8 (b): no team | Drop `scope.teams` and the second way; three ways remain |
| 9 (b): no presenting | Drop 2.10 and the bar's button; F24's 1920 check goes |
| 10 (b), (c) | The plan's order stands; (c) builds RV7 and RV1 only, and the walk keeps today's five presses |
