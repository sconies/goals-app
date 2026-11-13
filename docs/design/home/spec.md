# Home, every week: the build spec

11 November 2026. Round 3, area HM. Read with [README.md](README.md) (findings H1 to H18, the wireframes) and on top of `docs/design/README.md` (round 1), `docs/design/round-2/README.md` and `docs/design/round-3/README.md`. Nothing here is built. Where this spec and an earlier one differ, the README’s “What this changes in rounds 1 and 2” lists it and this one stands for Home.

Words: the **lead** is the block that holds what is asked of you today and the page's one primary action. A **cell** is one dated fact in "This week". A **set** is one scope of goals as the Goals page defines it (Mine, My team, Watching). "Check-in", "wrap-up", "review", "ask" and "next step" as the earlier rounds use them. A level and a status are called whatever the vocabulary calls them (`src/domain/vocabulary.ts`); nothing below fixes a level's name or a threshold.

## 1. Routes and redirects

| Address | Screen | Title |
|---|---|---|
| `/` | Home | "Home" |

No new route and no redirect. Home's links use the addresses round 1 defined (`/goals?scope=…`), never `show=` and never a bare `/goals`. One addition to the Goals address (rule 5): `moved` (`worse`, `better`, `quiet`, `done`, `any`) with `since` (a date, `2026-11-06`), written after `attention` and before the query's other parts.

`/?today=`, `?store=` and the demo prefix are kept on every link, as today.

## 2. The screen

Frame: one column up to 1040 px; from 1100 px of page a side column of 360 px when it has anything (`docs/design-rules.md`). With nothing for the side, one column.

### 2.1 Content, in order

Order on a phone and for a screen reader. On a computer parts 3 and 8 form the side column and the rest the main one.

| # | Part | Place | Shown when |
|---|---|---|---|
| 1 | Greeting | core | Always |
| 2 | The lead, or the quiet line | `home.lead` | Always (one or the other) |
| 3 | Needs your response | core | An ask waits on you beyond the one in the lead |
| 4 | This week | `home.glance` | A cell exists |
| 5 | Your first week's other rows | core | Rule 8 |
| 6 | Your goals | core | You own a goal in the running cycle |
| 7 | Your team | core | Rule 4 |
| 7b | Watching | `home.blocks` (the Watching module, if round 3's switches make it one; else core) | You watch a goal you don't own |
| 8 | Changed since {day} | core | Something moved (rule 5) |
| 9 | Modules' blocks | `home.blocks` | A module has one |
| 10 | The workspace's line | core | You are an admin and rule 7 returns something |
| 11 | New in Faro | core | Help has an entry you haven't seen or dismissed |

**1. Greeting.** `h1` "Good morning, {first name}" (afternoon, evening as today). Under it "{workspace} · week {w}, {9 to 15 Nov 2026}"; the workspace's name from `workspaceName` (never "Example: …"). With no rhythm and for a cycle that isn't a year the same line. On a phone the second line is left out (the top bar says it).

**2. The lead.** Rule 2 gives one of the rows below, or none.

| Kind | Eyebrow | Title | Line | Primary → where | Quiet link |
|---|---|---|---|---|---|
| `check-in-late` | "Check-ins were due on {Thursday 12 Nov}" | "{n} check-in{s} still to do" | "{titles: one, or the first “and {k} more”}. {It counts \| They count} for week {w} until Sunday." | **Start check-in** → `/check-in?start=1` | "Or type all your numbers in one table" → `/quick-check-in`, when 2 or more are number goals |
| `check-in` | "Check-ins are due by {Thursday 12 Nov}{, tomorrow \| , today \| , in {n} days}" · or, when a review you're in is today and reads them: "{Review} is today" | "{n} check-in{s} to do" · with the review eyebrow: "{n} check-in{s} to do before it" | "{titles}. About {m} minute{s}." · with the review eyebrow: "The review reads them as you post them. The workspace’s own deadline is {Thursday 12 Nov}. About {m} minutes." | **Start check-in** (a kept draft: **Pick up where you left off**) | As above |
| `first-check-in` (rule 8) | "Your first week · {welcome row's sentence, when there is one}" | "Post your first check-in{s}" | Round 2's S4 sentence after its first clause: "It’s due by {date}." / "…due today, {date}." / "It was due on {date}." / "There’s no date to meet." | **Start check-in** ("Check in" with no rhythm) | "Or type them in one table" |
| `wrap-up` | "{2026} ends on {Sunday 3 Jan}" (after it: "{2026} has ended") | "Wrap up your {n} goals" / "Wrap up your goal" | "How each one landed, one thing you learned, and whether it carries on. About a minute each." | **Start the wrap-up** → `/retro/<first unwrapped goal>` (or wherever the cycle-end design starts it) | — |
| `review` | "{Review} is today{ · your {n} check-ins are in}" · not held: warning mark "Not held yet" · "{Review} was on {Tuesday 10 Nov}" | "{n} goal{s} to discuss" / none to discuss: "{n} with nothing flagged to mark reviewed" | "{k} more have nothing flagged: mark them together at the end." · not held: "Hold it now, or it closes when next week starts and these carry to {next session's date}." | **Open the review** → `/reviews/<id>`; begun: **Continue: {goal}** as today | — |
| `ask` | "Needs your response · {waiting line, rule 3}" | By kind: "{First name} needs a decision" · "{First name} asked a question" · "{First name} asked for an update" · "A next step you agreed is due" | "“{ask}”." then "{n} goals are waiting on it: {first}, and {k} more." or "About {goal}." | **Respond** / **Answer** / **Check in** / **Mark done** → the address the ask's button uses today (`/goals/<id>?respond=<ask>`, or `/check-in/<id>` for an update) | — |
| A module's (section 5) | Its own | Its own | Its own | Its own | — |

The ring stays where the lead counts something: "{done}/{total}" with the word under it ("check-ins", "reviewed", "wrapped"), as built (LP, U16). An `ask` lead has none.

**The quiet line** (no lead). One sentence at heading size, an optional second line, and at most one plain button.

| When (first that holds) | Sentence | Second line | Plain button |
|---|---|---|---|
| Weekly; you have check-ins to do, not yet asked (rule 2) | "Nothing is asked of you today." | "Check-ins for week {w} are due by {Thursday 12 Nov}. You have {n} to do." | "Check in early" → `/check-in` |
| Weekly; all yours are in, completed today and on time | "{Your check-in is \| Both check-ins are \| All {n} check-ins are} in for week {w}." | "{That is {k} weeks in a row on time. }The next {is \| are} due by {Thursday 19 Nov}." (the streak clause from 2 weeks, and only if the streak setting allows) | — |
| Weekly; all yours are in | The same | "The next {is \| are} due by {date}." (in the cycle's last week: nothing) | — |
| You own, watch and are asked nothing | "Nothing is asked of you today." | "You don’t own or watch a goal in {ws} yet." | Two: "See the goals" → `/goals?scope=all`, "Set up a goal" → `/goals/new` |
| Otherwise | "Nothing is asked of you today." | — | — |

Never said: "You’re all set", a deadline that has passed for someone who met it, "0 weeks", "No check-ins or reviews due".

**3. Needs your response.** As built (`Home.tsx` `NeedsYou`: one row per ask, grouped by kind, one plain button each), with:

- The ask in the lead is not listed. The heading is then "Also needs your response · {n}"; otherwise "Needs your response · {n}". n is the rows listed.
- The meta line is rule 3's: who asked, where (only while Reviews is on), when as a date, then the waiting line. A late ask carries the warning mark and its words first.
- More than five: the first five by rule 3's order and "Show all {n}", opening in place.
- Empty: the part is absent.

**4. This week.** A row of up to three cells (a computer), a stacked list (a phone). Each cell is one link: a label (the date fact), a value, one line. Rule 6 gives them in order; a cell whose fact the lead is saying is left out; with none the part is absent.

| Cell | Label | Value | Line | Opens |
|---|---|---|---|---|
| A review you're in, this week or next (Reviews) | "Review today" / "Review tomorrow, {Thu 12 Nov}" / "Review on {Tue 24 Nov}" / warning mark "Not held yet · {Tue 10 Nov}" | "{Review's name}" | "{n} to discuss · {k} with nothing flagged" (before any goal in it has a check-in this week: "You’re in it") | `/reviews/<id>` |
| The cycle's or quarter's end | "{Q3} ends on {Sunday 27 Sep}" (in its last two weeks) / "{2026} ends on {Sunday 3 Jan}" (from three weeks out) | Owner: "{n} of your goals {is \| are} due by then" / wrap-up open and not the lead: "Wrap up your {n} goals" · anyone else: "The wrap-up {opens on {Mon 21 Dec} \| is open}" | The first goal's title and where it stands / "Open from today · about a minute each" | `/goals?scope=mine&due=quarter` / the wrap-up |
| How the week's check-ins stand (rule 6; weekly rhythm) | "Checked in for week {w}" | "{a} of {b} goals" | "Due by {Thu 12 Nov}" (after it: "{c} came in after {Thursday}") | `/goals?scope=<set>&checkedin=no` (rule 6) |
| A module's | Its own | | | Its own |

**6. Your goals.** Heading "Your goals · {n}" (n is every goal you own in the running cycle, done ones included) and at its right "See them in Goals" → `/goals?scope=mine`. Then:

1. The counts line: each status that has goals, worst first, "{n} {status in lower case}" with its shape, each a link to `/goals?scope=mine&status=<s>`.
2. With no rhythm: "{k} have a check-in this week.{ {Title} has none yet.}"
3. When any need attention: the link "{k} need attention" → `/goals?scope=mine&attention=1`, then those rows, worst first.
4. "Being handled · {m}", folded, as built.
5. The rest: up to five rows; more are behind "Show the {k} with nothing flagged" (in place). When nothing needs attention there is no sub-heading: just the rows.

A row: status (shape and word) first; the title; one line (the flag's sentence cut to one line, or "Checked in on {Tuesday}", or "No check-in yet · starts at {value}"); at the right the number over its gap, or a plain button when the goal page's rule gives one (`primaryAction`/`standingAction`, goal spec rule 1): "Check in" while it is due (weekly) or has none this week (no rhythm), "Add a next step" when behind with none. The row is a link to the goal. Never "Open".

**7. Your team.** Rule 4. Heading "Your team · {team} · {n} goals" ("Your teams · {n} goals in {k} teams" for several), "See them in Goals" → `/goals?scope=team`. The counts line as part 6, to `/goals?scope=team&status=<s>`. Then the link "{k} need attention that aren’t yours" → `/goals?scope=team&attention=1&owner=-me` (rule 4) and up to four of those rows, each with its owner's name first on the line. No button on these rows. Nothing needing attention: "Nothing in it needs attention." and no rows. Drawn as teams when rule 4 says so.

**7b. Watching.** Heading "Watching · {n}" ("· {n} goals in {k} teams" when drawn as teams), "See them in Goals" → `/goals?scope=watching`. The counts line to `/goals?scope=watching&status=<s>` when there are more than six goals. "{k} need attention" → `/goals?scope=watching&attention=1`, then up to four of those rows and "{j} more need attention" to the same address. Six goals or fewer: every goal is a row and there is no "more". Nothing needing attention and more than six: "Nothing in it needs attention." and the three most lately checked in. With no rhythm a row not from this week says "as of week {w}" (round 2).

**Teams, worst first** (rule 4; for 7 and 7b). A table: "Team" (a link to `/goals?scope=<set>&team=<id>`), "Needs attention" ("{k} need attention" → the same with `&attention=1`; none: "None"), "Its goals {in your teams \| you watch}" (counts by status, each a link with `&status=`), "Since {Thu 5 Nov}" ("1 got worse", "1 recovered", "No change"; each count a link with `&moved=…&since=…`). Five rows, then "{k} more teams, {j} need attention" → `/goals?scope=<set>&group=team`. On a phone each team is a stacked row. No person's name is in this table.

**8. Changed since {Friday 6 Nov}.** Rule 5. A line of counts, each a link: "{n} got worse", "{n} recovered", "{n} went quiet" (weekly only), "{n} done"; then up to four rows, worse first: the title; the status now (shape and word) and "was {status}" with which set ("yours", "your team", "watching", or the team's name when sets are drawn as teams); a goal called behind by its owner while its numbers were still on plan adds "called early by its owner". More than four: "All {n} in Goals" → `/goals?scope=<the widest set>&moved=any&since=<date>`. Nothing moved: the part is absent. Never visited before: the heading is "Changed this week".

**10. The workspace's line** (admins). Heading "{workspace}". One row per rule 7: bold sentence, one line, one plain button. "{n} things to sort out" · "{first need's sentence}{, and {k} more}." · "See them" → `/workspace`. In the cycle's last two weeks, first: "The wrap-up is open" · "{a} of {b} goals are wrapped up. {2026} ends on {date}." · "See the wrap-up" → `/retro`.

**11. New in Faro.** One line at the foot on every width: "New in Faro: {entry's title}. See what’s new" and the dismiss button, as built (`HomeNews`), moved.

### 2.2 Removed from Home

The strip's "Your goals"/"All goals" cell and its streak and "Next review" cells; "You’re all set for week {w}" and its three lines; "See all goals"; "No check-ins or reviews due" and "Find goals to watch"; the paragraph "Across the whole workspace, {k} of {n} goals have had their first check-in…" (`FirstReports`) outside the first week; the `AdminCard`; "{n} more in Watching"; the button "Open" on an owner's own row.

### 2.3 Empty, loading and error states

- Opening: the greeting and inert outlines for the lead and one block, as the shell does today (`app.opening`).
- A workspace with no goals: an admin gets the workspace's line ("No goals in {cycle} yet · Add one"); anyone gets the "own, watch and are asked nothing" quiet line.
- Before the cycle starts (week 0): no lead; the quiet line "Nothing is asked of you today." and "{cycle} starts on {date}. The first check-ins are due by {date}."
- After the cycle ends with nothing to wrap up: "Nothing is asked of you today." and "{cycle} has ended."
- A fact Home can't work out (a module's place throws): that place is left out; the rest of Home is drawn (the `Place` boundary as built).

## 3. Who sees what

Home adds no permission and no action. Each button is one another screen already offers that person, and the rule that enforces it is unchanged.

| On Home | Who sees it | Enforced by |
|---|---|---|
| "Start check-in", "Check in" | The goal's owner | The check-in's own rule (an owner posts for their goal; an admin may correct): `changeset.ts` as the check-in uses it |
| "Respond", "Answer" | Whoever the ask is for, or an admin | `canAnswer` (`src/domain/asks.ts:65`), used by `answerRequest` (`actions.ts:101`) |
| "Mark done" | Whoever is to do it, whoever agreed it, or an admin | `canMarkDone` (`asks.ts:67`), `markActionDone` (`actions.ts:111`) |
| "Open the review" | Anyone in the review (anyone may open one; marking reviewed is `markReviewed`, `actions.ts:183`) | As today |
| "Start the wrap-up" | The goal's owner | `saveRetro` (`actions.ts:287`) |
| "Add a next step" | As the goal page | `addAction` (`actions.ts:88`) |
| The workspace's line | Admins | `workspaceNeeds(…, admin)` returns nothing for a member |
| Every count and row | Everyone (every member reads every goal, R1) | — |

**A gap, flagged and not decided here:** a review has people but nobody who runs it (`Review.people`, `createdBy`). Home therefore offers "Open the review" to everyone in it, as today. If the reviews area gives a review a chair, rule 2's `review` lead is for the chair and others get the cell.

## 4. Rules for `src/domain`

In `src/domain/home.ts` unless said. Pure; each takes only what it reads, never the snapshot; each has tests from its worked examples, a section in `src/spec/rules.ts` and conformance rows (a new file, `home.csv`: one row per demo person per day of two weeks, giving the lead's kind, the quiet sentence and the parts in order). They restate nothing: status from `goalStatus`, attention from `attentionFor` and `splitAttention`, the week's check-ins from `weekProgress`, sessions from `reviewSession`, asks from `openForPerson`, scopes from `scopesFor`, first-week rows from rule S4.

### Rule 1. The plan: `homeFor(facts): HomePlan`

```ts
interface HomeFacts {
  today: string;                       // 2026-11-11
  week: number; lastWeek: number;      // the cycle's
  rhythm: { dueDate: string; nextDueDate: string | null } | null;   // null: no set rhythm
  reviews: boolean;                    // the module is on
  checkIns: { total: number; done: number; due: { id: string; title: string; number: boolean }[]; draft: boolean; allInOnTimeToday: boolean; streak: number | null };
  wrap: { ends: string; ended: boolean; left: string[] } | null;      // null: not open
  sessions: { id: string; name: string; date: string; held: boolean; discuss: number; healthy: number; done: number; total: number; started: boolean; nextGoal: { id: string; title: string } | null }[];   // reviews you're in: this week's, and the next
  asks: Waiting[];                     // rule 3, in its order
  firstWeek: DayOneRow[];              // rule S4; empty after it
  sets: { mine: SetFacts | null; team: SetFacts | null; watching: SetFacts | null };   // rule 4
  moved: Moved[]; since: string | null;                                // rule 5
  cycleEnd: CycleEnd | null;           // rule 6
  standing: { set: 'team' | 'watching' | 'all'; in: number; of: number; late: number } | null;   // rule 6
  workspace: { says: string; why: string; action: string; to: string }[];                  // rule 7
  offers: LeadOffer[];                 // modules', section 5
}
interface HomePlan { lead: Lead | null; quiet: Quiet | null; asks: Waiting[]; cells: Cell[]; parts: PartId[]; since: string | null }
```

`homeFor` calls rule 2 for the lead (and the quiet line when there is none), drops the lead's ask from `asks`, calls rule 6 for the cells, and returns `parts` in section 2.1's order, each present by its "Shown when". The screen draws `parts` and nothing else. The menu's counts (Check-in, Reviews) are read from the same `checkIns.due.length` and `sessions`, so Home and the menu can't disagree.

The app layer builds `facts` (`src/app/reads.ts`, a new read `homeFacts(viewerId)`) from the functions named above; with no set rhythm `rhythm` is null and `weekProgress` already returns no `due` (round 2, FT1); with Reviews off `sessions` is empty.

### Rule 2. The lead: `homeLead(facts): Lead | null`

`LEAD_DAYS = 1`. Candidates, in this order; the first that holds wins. A module's offer (section 5) is placed by its `rank`.

| Rank | Kind | Holds when |
|---|---|---|
| 10 | `check-in-late` | `rhythm` and `checkIns.due.length > 0` and `today > rhythm.dueDate`, and `firstWeek` has no `first-check-in` row |
| 20 | `first-check-in` | `firstWeek` has the row `first-check-in` |
| 30 | `check-in` | `rhythm` and `checkIns.due.length > 0` and (`dueDate − today ≤ LEAD_DAYS` days, or `checkIns.draft`, or a session in `sessions` has `date === today` and isn't held) |
| 40 | `wrap-up` | `wrap` and `wrap.left.length > 0` |
| 50 | `review` | A session with `date ≤ today`, in this week, not held, with `done < total`. Several: the earliest date, then the name |
| 60 | `ask` | `asks[0]` is `late`, `dueThisWeek`, or `waitedDays ≥ 7` (rule 3's order puts the right one first) |

Otherwise null, and `quietLine(facts)` gives section 2.1's sentence.

Worked examples (the demo's people; weekly, due Thursday 12 Nov; Reviews on unless said). ◆ marks a conformance row.

| Given | Lead | Quiet line |
|---|---|---|
| ◆ Tunde, Mon 9 Nov, 2 to do | — | "Nothing is asked of you today." · "Check-ins for week 46 are due by Thursday 12 Nov. You have 2 to do." · "Check in early" |
| ◆ Tunde, Tue 10 Nov, 1 to do, no draft | — | The same, "1 to do" |
| Tunde, Tue 10 Nov, a draft kept | `check-in`, "Pick up where you left off" | |
| ◆ Tunde, Wed 11 Nov, 1 to do | `check-in`: "Check-ins are due by Thursday 12 Nov, tomorrow" · "1 check-in to do" | |
| ◆ Tunde, Thu 12 Nov, posts the last one today, streak 5 | — | "Both check-ins are in for week 46." · "That is 5 weeks in a row on time. The next are due by Thursday 19 Nov." |
| ◆ Tunde, Fri 13 Nov, all in | — | "Both check-ins are in for week 46." · "The next are due by Thursday 19 Nov." |
| ◆ Tunde, Fri 13 Nov, 1 not posted | `check-in-late`: "Check-ins were due on Thursday 12 Nov" · "1 check-in still to do" | |
| ◆ Rhea, Mon 9 Nov, 7 to do; Daniel's question due before Tue 10 Nov's session | `ask`: "Needs your response · due before tomorrow’s session" · "Daniel asked a question" · **Answer** | |
| ◆ Rhea, Tue 10 Nov, 6 to do; Developer Productivity fortnightly today | `check-in`: "Developer Productivity fortnightly is today" · "6 check-ins to do before it" | |
| ◆ Rhea, Tue 10 Nov, all 7 in | `review`: "Developer Productivity fortnightly is today · your 7 check-ins are in" · "14 goals to discuss" | |
| ◆ Rhea, Wed 11 Nov, 5 to do, the session not held | `check-in` (rank 30 before 50); the session is the cell "Not held yet · Tue 10 Nov" | |
| ◆ Rhea, Fri 13 Nov, 1 to do | `check-in-late` | |
| ◆ Amara, Mon 9 Nov; a decision asked 4 Aug; a next step due week 47; review on Thu 12 Nov | `ask`: "Needs your response · waiting since 4 Aug, 14 weeks" · "Rhea needs a decision" · **Respond** | |
| ◆ Amara, Thu 12 Nov | `review`: "Platform leadership weekly is today" · "19 goals to discuss"; both asks listed under "Needs your response · 2" | |
| ◆ Amara, Fri 13 Nov, not held | `review`, "Not held yet" | |
| ◆ Amara, Tue 24 Nov; Security monthly today, Platform leadership weekly on Thu | `review`: Security monthly (the earliest); the weekly is a cell | |
| Amara, Mon 9 Nov, both asks answered | — | "Nothing is asked of you today."; the cell "Review on Thu 12 Nov" |
| ◆ Oskar, any day | — | "Nothing is asked of you today." |
| Grace (admin, in a review 42 days off) | — | "Nothing is asked of you today."; no review cell (rule 6); the workspace's line if rule 7 has any |
| Someone who owns, watches and is asked nothing | — | "Nothing is asked of you today." · "You don’t own or watch a goal in Platform Engineering yet." · two plain buttons |
| ◆ Tunde, Mon 21 Dec (week 52 of 53), 2 to do, wrap-up open | — (Monday), and the cell "2026 ends on Sunday 3 Jan · Wrap up your 2 goals" | "Nothing is asked of you today." … |
| ◆ Tunde, Wed 23 Dec, 2 to do | `check-in`; the wrap-up is the cell | |
| ◆ Tunde, Wed 23 Dec, both in | `wrap-up`: "2026 ends on Sunday 3 Jan" · "Wrap up your 2 goals" | |
| ◆ Rhea, no set rhythm, Tue 10 Nov, review today | `review` | |
| ◆ Rhea, no set rhythm, Reviews off, the question 7 days old | `ask`: "Daniel asked a question" | |
| ◆ Rhea, no set rhythm, Reviews off, no asks | — | "Nothing is asked of you today." |
| ◆ Rhea, weekly, Reviews off, Tue 10 Nov, 6 to do | — (Tuesday, no review to bring it forward); on Wed `check-in` | "Nothing is asked of you today." · "…You have 6 to do." |
| Ben, first week, Thu 19 Nov, first check-in not in | `first-check-in`: "Your first week · Ana Silva set up Field Operations on 11 Nov and gave you 1 goal" · "Post your first check-in" · "It’s due today, Thursday 19 Nov." | |
| Ben, Fri 20 Nov, still not in | `first-check-in` ("It was due on Thursday 19 Nov."); never `check-in-late` in the first week | |

### Rule 3. An ask that waits: `waiting(ask, facts): Waiting`

```ts
interface Waiting { askId: string; kind: AskKind; by: string; goalIds: string[]; said: string; askedOn: string; waitedDays: number;
  due: { date: string; why: 'week' | 'session' } | null; late: boolean; dueThisWeek: boolean; line: string }
```

Takes the ask, today, the week's dates, and for an ask raised in a review that review's session dates (Reviews on only).

- `due`: the ask's own `dueWeek` (its Sunday); else, for a question raised in a review, **the first session after the one it was raised in** (fixed when asked: it does not move to a later session when that one passes); else null.
- `late`: `due` and `today > due.date`. `dueThisWeek`: `due` within this week.
- `line`, said after who asked and when:

| When | Line |
|---|---|
| Late, by week | Warning mark, "Was due week {w} ({dates})" |
| Late, by session | Warning mark, "Was due by {Tue 10 Nov}" (13 Nov: the review is named after it, so the line shows whole on a phone) |
| Due before a session today / tomorrow | Warning mark, "Due before today’s session" / "Due before tomorrow’s session" |
| Due this week | "Due this week ({dates})" |
| Due later | "Due week {w} ({dates})" / "Before its next session, {Tue 24 Nov}" |
| No date, waited 7 days or more | "Waiting since {4 Aug}, {14 weeks \| 9 days}" |
| No date, newer | "Asked {on Tuesday \| yesterday \| today}" |

- Order (replaces "overdue first, then newest"): late; then due this week; then no date and 7 days or more, oldest first; then the rest, newest first. Within each, decisions before questions before updates before next steps.

| Given | Then |
|---|---|
| ◆ Daniel's question, asked on Tue 3 Nov in Developer Productivity fortnightly, whose next session is Tue 10 Nov; today Mon 9 Nov | due Tue 10 Nov, "Due before tomorrow’s session" |
| ◆ The same, today Wed 11 Nov, unanswered | late: "Was due by Tue 10 Nov" (today it reads "Before its next session, Tue 24 Nov", H4) |
| ◆ Rhea's decision for Amara, asked 4 Aug, no date; today 11 Nov | not late; `waitedDays` 99; "Waiting since 4 Aug, 14 weeks" |
| ◆ Amara's next step, due week 47; today in week 46 | "Due week 47 (16 to 22 Nov)" |
| The same, today in week 48 | late: "Was due week 47 (16 to 22 Nov)" |
| Reviews off, Daniel's question | no session date: by its age, "Waiting since 3 Nov, 8 days"; "in Developer Productivity fortnightly" is not said |

### Rule 4. The sets: `homeSets(viewer, scopes, attention, teams): Sets`, and `asTeams(set)`

- `mine`, `team`, `watching` are exactly `scopesFor`'s scopes (goals spec rule 1), so a block's total is its tab's count. `team` is present on Home when the scope exists **and** holds a goal the viewer doesn't own.
- `SetFacts`: `{ total, byStatus, needs: GoalAttention[], handled, rows, teams: TeamRow[] | null }`. `needs` is `splitAttention(…).needs`, so "{k} need attention" equals the Goals switch's count for that scope (goals spec rule 3).
- For `team`, the rows are `needs` without the viewer's own goals, and the link adds `owner=-me`. **New in the goal query:** an owner value of `-me` means "not mine" (one line in `parseQuery`, said in the filter line as "Owner: not you").
- `asTeams(set)` is true when the set's goals belong to three or more teams, or it holds more than twelve goals in two or more teams. Then `teams` is one `TeamRow` per team, `{ teamId, name, total, byStatus, needs, moved: { worse, better, quiet } }`, ordered by `worstGroupsFirst` (as the Goals page orders "By team"), then by name.
- Goals already listed in a set above are not left out of a set below: each block must agree with its page.

| Given (the example, 11 Nov) | Blocks |
|---|---|
| ◆ Tunde: owns 2; Build & Release has other goals; watches 1 | Your goals · 2; Your team · Build & Release; Watching · 1 as one row |
| ◆ Rhea: owns 8; leads CI/CD (17); watches 12 in 5 teams | Your goals · 8; Your team · CI/CD · 17 goals, rows not hers; Watching · 12, as goal rows (12 is not more than twelve) |
| ◆ Amara: owns 0; Office of the VP has no goals; watches 56 in 9 teams | Watching · 56 goals in 9 teams, as teams, worst first, five shown |
| ◆ Oskar: watches 3 | Watching · 3, all three rows |
| A division head who leads four teams | Your teams · {n} goals in 4 teams, as teams |
| Watching switched off | No Watching block for anyone; "Changed since" leaves those goals out |

### Rule 5. What moved: `movement(before, now): Move | null`, `changedSince(rows, since)`, `sinceFor(seen, today)`

- `sinceFor(seen: { last: string | null; prev: string | null }, today)`: the date to count from. `seen.last` is the last day Home was opened; `seen.prev` the last day before that. Opening Home on a new day sets `prev = last`, `last = today` (kept per person and workspace behind the `Prefs` port, key `home-seen`). Returns `prev` when `last === today`, else `last`; never more than 28 days back; null when never opened (then the screen counts from the week's Monday and says "Changed this week").
- `movement` takes a goal's status on `since` and now (the app layer calls `goalStatus` twice, once with `today = since` and the check-ins posted before it), and returns `worse`, `better`, `quiet` (now "no recent update", weekly only), `done`, or null. Rank by the vocabulary's order. A goal created after `since` returns null. `early: true` when it is `worse`, the owner's call is behind and the calculated status is not (the opposite of the `greener` flag).
- `changedSince` returns `{ counts: { worse, better, quiet, done }, rows }`, rows worse first, then quiet, better, done; within each by the set (mine, team, watching) then name. The viewer's own goals are included (they changed for others too).
- **The Goals filter.** `moved=<kind>&since=<date>` in `parseQuery` and `applyQuery` (`src/domain/query.ts`), using the same `movement`. The filter line says "Changed since {Fri 6 Nov}: {got worse \| recovered \| went quiet \| done \| any change} (Remove)". The count line is the find spec's: "2 goals match."

| Given | Then |
|---|---|
| ◆ On track on 6 Nov, at risk now | `worse` |
| ◆ At risk on 6 Nov, on track now | `better` |
| ◆ Last check-in week 44, weekly rhythm, "no recent update" since 9 Nov | `quiet` |
| The same with no set rhythm | null |
| ◆ On plan by the numbers, owner called it at risk on 10 Nov | `worse`, `early: true`: "called early by its owner" |
| Off track on both days, a new check-in between | null (Home is not a feed; History has it) |
| Rhea opened Home Fri 6 Nov and again Tue 10 Nov at 09:00 and 15:00 | Both visits on 10 Nov count from 6 Nov: "Changed since Friday 6 Nov" |
| Last opened 2 Sep | Counts from 28 days back: "Changed in the last 4 weeks" |

### Rule 6. The cells: `homeCells(facts, lead): Cell[]`

At most three, in this order, each left out when the lead is of that kind for that thing:

1. **Reviews** (the module's, section 5): for each session in `facts.sessions` not the lead's: this week's not held (today, later this week, or past: "Not held yet"); and, when none this week, the next one if it is within 7 days. Earliest first; at most two.
2. **The end of the quarter or cycle**, `cycleEnd`: in a quarter's last two weeks when it isn't the cycle's end, and the viewer owns a goal due by then (`due=quarter`); from three weeks before the cycle's end for everyone; the wrap-up's words once `wrap` is open and it isn't the lead.
3. **How the week's check-ins stand**, `standing`, weekly rhythm only: for a viewer with a set drawn as teams (rule 4), over that set; for an admin with none, over all goals. Live goals that are due this week; `in` have this week's check-in; after the due date `late` came in after it. **New in the goal query:** `checkedin=no` (live, due this week, none yet), said as "No check-in for week {w} yet". Never a list of people: the page it opens is goals, worst first.

| Given | Cells |
|---|---|
| ◆ Rhea, Tue 10 Nov, lead `check-in` | "Review today · Developer Productivity fortnightly · 14 to discuss · 21 with nothing flagged" |
| ◆ Rhea, Tue 10 Nov, lead `review` | None |
| ◆ Amara, Wed 11 Nov | "Review tomorrow, Thu 12 Nov · Platform leadership weekly · …"; "Checked in for week 46 · {a} of {b} goals · Due by Thu 12 Nov" |
| ◆ Tunde, any day in week 46 | None (he is in no review) |
| ◆ Grace, 11 Nov; Quarterly business review in 42 days | None for the review; the standing cell (admin) |
| Tunde, Mon 21 Sep (Q3's last week), one goal due this quarter | "Q3 ends on Sunday 27 Sep · 1 of your goals is due by then" |
| Anyone, Mon 14 Dec (three weeks out) | "2026 ends on Sunday 3 Jan · The wrap-up opens on Mon 21 Dec" |
| No set rhythm | No standing cell |

### Rule 7. The workspace's line: `homeWorkspace(needs, wrap)`

For an admin: from `workspaceNeeds` (as round 2's rule S5 leaves it), one row "{n} things to sort out" ("1 thing to sort out") with the first need's `says` and ", and {k} more"; and in the cycle's last two weeks, first, the wrap-up's row with `yearLine`'s counts. For a member: nothing. Never a lead, never a cell.

### Rule 8. The first week on Home (changes round 2's 2.9; rule S4's rows are unchanged)

While S4 returns rows for the viewer:

- `first-check-in` is rule 2's rank-20 lead. Its eyebrow is "Your first week", followed by the `welcome` row's sentence when there is one.
- `first-review` is a cell (rule 6's first), with the line "The first one{, and you’re in it}"; on the day it follows rule 2 like any review, and the lead's eyebrow begins "The first review is today".
- `progress` replaces rule 6's standing cell: "{k} of {n} first check-ins are in" · "Waiting on {names}".
- Every other row (`assign`, `invite`, `add-people`, `first-goal`, `see-goals`, `watch`, `own-goal`, and `welcome` when it isn't in the eyebrow) is listed under the lead in a block "Your first week", with plain buttons and "Hide this". When there is no lead and the first of them has a button, that button is the page's primary (round 2's rule, kept).
- Nothing is called late and no streak clause is said before rule S2's first dates.
- **Hand-over:** a person's Home is the everyday one as soon as S4 returns no row for them; in practice their own first check-in (an owner), their first look at the goals (someone who owns none), everyone arrived and owners chosen (whoever set up), or "Hide this" or 14 days, as S4 has it. No date is shared across people.

## 5. Extension points

| Place | Contract | Who fills it |
|---|---|---|
| `home.lead` | A module registers `lead(viewerId, reads): LeadOffer \| null`, `LeadOffer = Lead & { rank: number }`. The core's rule 2 merges offers by rank; ties go to the core. (Round 2 said "the first module with something wins"; rank replaces registration order.) | Reviews, once a module (FT3): offers the `review` lead at rank 50 and the `sessions` facts |
| `home.glance` | `cells(viewerId, reads): Cell[]`, each `{ label, value, line, to, about?: string }`; `about` names the thing, so the core can drop a cell the lead already says | Reviews (the review cells); Metrics, when a source is registered: "Numbers from sources · {n} have arrived since your last check-in" → `/check-in` (the check-in area owns what happens there) |
| `home.blocks` | As built, with one optional field, `answers: 'goals' \| 'changed' \| 'other'`, which places a block after "Your team" (goals), in the side column after "Changed since" (changed), or last | Watching, if the switches area makes it a module: the Watching block and its goals in rule 5 |

Until FT3 the core fills the Reviews entries itself behind `facts.reviews`. A module that is off registers nothing, so its lead, cell and block are absent: no Home code tests a module's id. The Map has nothing on Home.

Not added: a place inside "Your goals" rows (the goal page's `goal.facts` is not drawn on Home); a module's own count in "Changed since".

## 6. Data and migration

None. `home-seen` is a per-person, per-workspace value behind the `Prefs` port (kept in the browser in Faro). For the internal platform, as a requirement: last-seen is kept per person on the server, so "Changed since" follows a person across devices.

## 7. AI tools (MCP)

`get_my_work` (`src/mcp/workTools.ts:124`) returns `homeFor`'s plan in words: `asked` (the lead's kind, title, line and address, or the quiet sentence), `waiting` (rule 3's rows with `line`), `this_week` (the cells), `goals` (each set's total, counts by status and the needing-attention ids), `changed` (rule 5's counts and rows, with `since`). It takes an optional `since`. The old `dashboard` fields stay for one release. `find_goals` gains `moved`, `since`, `checkedin` and owner `-me` through the query. After the change: `npm run build:mcp` and commit `api/mcp.js`.

## 8. Evals

| Number | What |
|---|---|
| **U122** The owner's week | As Tunde: Mon 9 Nov, Home has no primary button and says "Nothing is asked of you today."; Wed 11 Nov the lead is "1 check-in to do" with **Start check-in**; post it; Home says "Both check-ins are in for week 46." with no button; Fri 13 Nov the passed deadline is not said. "Your goals · 2" appears once; each count opens Goals with the same number |
| **U123** The manager on review day | As Rhea, Tue 10 Nov: the lead's eyebrow names her review and the button starts the check-in; with all in, the lead is "Open the review" and the review cell is gone; Wed 11 Nov her unanswered question reads "Was due by Tue 10 Nov" with the warning mark; "Your team · CI/CD" opens `scope=team` with the same total |
| **U124** The leader | As Amara, Mon 9 Nov: the one primary is **Respond** on Rhea's decision; the review is a cell; Watching is a table of teams, worst first; press a team's "{k} need attention" and Goals' count line says k; "Changed since" counts open lists of that length; on Thu 12 Nov the lead is the review. No person's name appears in the teams table |
| **U125** Four ways, and with nothing | As Rhea with no set rhythm: no "due", no late, no streak, a check-in is never the lead; with Reviews off: no review lead or cell and no review named on an ask; with Watching off: no Watching block; as someone with nothing: one sentence and two plain buttons; as Grace: the workspace's line opens Workspace |
| **F25** Home's numbers agree | For Tunde, Rhea, Amara and Oskar on three days: every count on Home that is a link equals the number in the count line of the page it opens; every count on Home is a link or is the length of a list on Home |
| **N26** One primary, and quiet when quiet | On every day of two weeks for each demo person, at both widths: at most one primary button on Home, and none when `homeFor` gives no lead; the lead is in the first screen at 390×844 and above the fold at 1440×900; Home never shows "0 weeks", "None you’re in", "You’re all set" or a bare `/goals` link |

P3, P4, P6 and P7 are extended to the new blocks (the teams table at 390 px; the side column at 1100 px). Unit tests: each rule's worked examples; `home.csv` in conformance.

Requirements (`evals/requirements.json`); `HOME-DASHBOARD` is replaced by these three.

- `HOME-OWNER`: "Home opens on what is asked of you today, with one primary action, or says that nothing is; a check-in becomes the primary action the day before it is due, when late, or when a review you are in will read it. Your goals are counted once, each count opens exactly those goals, and a completed week is one sentence with the next date."
- `HOME-MANAGER`: "Someone in or leading a team sees that team on Home as the Goals page's My team scope, with the goals that need attention and aren't theirs; a review they are in is the lead on its day once their own check-ins are in, and one cell otherwise; an ask says how long it has waited and is marked once late."
- `HOME-LEADER`: "Someone whose goals span three or more teams sees them as teams, worst first, with counts that open exactly those goals, what moved since they last looked, and how the week's check-ins stand; the oldest thing waiting on them can be the lead. Teams and goals are ranked, never people."

## 9. Help, What's new, the spec

- **Help** (`src/help/guide.ts`): the Home article is rewritten around the three questions; new sections "When Home has no button", "Changed since", "Your team on Home", "Why an ask says how long it has waited". The Goals article gains "Changed since" and "No check-in for the week yet" under filters.
- **What's new** (`src/help/whatsNew.ts`), one per item: "Home starts with what is asked of you today, and is quiet when nothing is" (HM1); "Asks say how long they have waited" (HM2); "Your team is on Home" (HM3); "See what changed since you last looked" (HM4); "A leader's Home: teams, worst first" (HM3, HM7).
- **The spec:** `npm run spec` after each; the rules' words and examples in `src/spec/rules.ts`, Home's main action in `src/spec/screens.ts` ("the lead's, or none"). No module is added, so no new rebuild stage: Home's rules join the core's stage, and the drill scores `home.csv`.

## 10. If Lane decides otherwise

| Decision (README) | Other answer | What changes |
|---|---|---|
| 1 | (b) Primary from Monday | `LEAD_DAYS` becomes 6; the first quiet row of 2.1 is never reached; U122's Monday step asserts the lead |
| 1 | (c) Only on the due day | `LEAD_DAYS = 0` |
| 2 | (b) "Check in on a goal" as primary with no rhythm | A rank-70 lead `check-in-open` when a live goal has none this week; wireframe 8 (a) and (c) change; N26 unchanged |
| 3 | (b) Asks lead only when late or due | Drop `waitedDays ≥ 7` from rank 60; Amara's Monday has no lead |
| 3 | (c) Never | Remove rank 60; the heading is always "Needs your response" |
| 4 | (b) Trees | `asTeams` becomes `asTrees`: rows are top goals with the counts of what feeds them, links `feeds=<key>`; the same table |
| 4 | (c) Goal rows only | Drop `teams`; HM3 is S |
| 5 | (b) This week only | No `home-seen`; `since` is the week's Monday; the Goals filter keeps `since` |
| 5 | (c) Not on Home | Drop HM4; the teams table loses its last column |
| 6 | (b) A cell | Rule 6 gains a fourth cell "On time · {k} weeks", absent under 2 |
| 6 | (c) None | Remove the clause |
| 7 | (b) With last week's share | The cell's line adds "last week {c} of {d} on time" |
| 7 | (c) Not on Home | Drop `standing` and `checkedin`; HM7 is the admin's line only |
| 8 | (b) Round 2's block | Rule 8 is dropped; while S4 returns rows `homeFor` returns no lead and no cells, and the block is drawn above the sets |
| 9 | (b) About only | Drop part 10 and rule 7 |

## 11. Build plan

Effort: S under a day, M a release, S–M between. Each is one PR with its rule sections, conformance rows, evals, Help and What's new.

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| 1 | **HM1** Home asks first, and is quiet when quiet | `homeFor`, `homeLead`, `quietLine`; the lead and quiet line; counts move into "Your goals"; exact links (no bare `/goals`); the strip's goal, streak and "None you’re in" cells, "You’re all set", the first-check-ins paragraph and `AdminCard` removed; "New in Faro" at the foot; `home.csv`; U122, N26, `HOME-OWNER` | M | GL1 (scope addresses; live on the demo on 11 Nov) and NV3 (`/check-in?start=1`). Row buttons use GT1's `standingAction` if landed, else today's "Check in" only. FT1 makes the no-rhythm rows reachable; not needed first |
| 2 | **HM2** Asks say how long they have waited | Rule 3 (`waiting`), the fixed session date, the new order, the `ask` lead, "Also needs your response" | S | HM1. FT2 for the Reviews-off wording |
| 3 | **HM3** Your team, and teams worst first | Rule 4; the "Your team" block; `asTeams` and the table; `owner=-me`; U123's team step, part of U124; `HOME-MANAGER` | S–M | HM1; GL1 (`scope=team`); WR1 (who leads a team) |
| 4 | **HM4** Changed since you last looked | Rule 5; `home-seen`; the block; the Goals filter `moved`/`since` with its filter-line words; the teams table's last column; F25 | M | HM1, HM3; FS2 (the filter line); AR1 (`Prefs`, merged) |
| 5 | **HM5** This week's cells and the places | Rule 6's review and cycle-end cells; `home.lead` offers by rank, `home.glance` cells, `home.blocks`' `answers`; the core fills Reviews' until FT3; U125 | S–M | HM1; FT2 (the Reviews switch). The cycle-end and reviews areas' addresses and words (CY, RV) where they differ from today's. The switches area (SW) for Watching as a module |
| 6 | **HM6** The first week through the same lead | Rule 8 | S | ST8 (round 2); HM1, HM5 |
| 7 | **HM7** A leader's week, and the workspace's line | The standing cell and `checkedin=no`; rule 7; the rest of U124; `HOME-LEADER` | S | HM3, HM5; FT1; WR2 (About's "To sort out"); backlog L (1), which this delivers for Home |
| 8 | **HM8** `get_my_work` says what Home says | Section 7; `api/mcp.js` | S | HM1 to HM4 |

About four releases. **The first cut is HM1 and HM2**: after them Home asks one true thing or none, every link opens what it names, and nothing is said twice. HM3 and HM4 are what a manager and a leader notice. It sits in round 1's "lists and the frame" track after GL1, since it reads Goals' scopes and adds two filters to its query.

In the backlog this replaces LV's "anything Wednesday raises" for Home, delivers L (1) on Home (the habit measure, as goals not people) and takes the idea "a VP portfolio view: what moved this week" as far as Home; "positive-only spotlights" appears only as "called early by its owner" in rule 5. L (4), the rhythm strip per team, is not designed here.
