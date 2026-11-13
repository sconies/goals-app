# Round 4: small workspaces, readings, the habit moment and a leader's week

13 November 2026. Design and spec only: no app code, nothing under `spec/` and no backlog row was changed, and nothing here is built. Lane asked for a design pass on four items. Each has a build spec in the house format, mock-ups drawn with the shared kit, and its questions for Lane; all the questions are gathered at the foot of this page, the recommended answer first.

| # | Item | From | Build spec | Size |
|---|---|---|---|---|
| 1 | **SM** Small workspaces | Backlog row SM; Muse's evaluation, row 8 | [small-workspaces/spec.md](small-workspaces/spec.md) | M, in four parts |
| 2 | **NR** Readings fill in the check-in | Backlog row NR, with Lane's four answers | [readings/spec.md](readings/spec.md) | M |
| 3 | **The habit moment** | The evaluation's item 12 and decision 4; backlog L (1), (3), (4); round 3's CF4 | [habit/spec.md](habit/spec.md) | S–M, in three parts |
| 4 | **A leader's week** (the VP portfolio view) | Backlog "Ideas, not yet placed"; product review of 8 Nov | [portfolio/spec.md](portfolio/spec.md) | M |

The mock-ups are rendered from one file (`node docs/design/round-4/build.cjs`) at 1440 and 390 px into each item's `wireframes/`. They show layout, order and wording; they are not app code, and the numbers in them are illustrative. The live demo was read on 13 November at 390, 1024 and 1440 px for what is there today.

## The round in six lines

1. **Small is a result, not a mode.** Nothing asks how big a workspace is. A menu row, a tab or a section is drawn when it has something in it, so five people get ten menu rows and two tabs, and Platform Engineering gets what it has today, from the same rules.
2. **Set-up is four steps for everyone.** "How you'll work" becomes one sentence with "Change" on the first step.
3. **A reading is put in the field, and the person confirms it by name** ("Confirm 12 min"). Typing a different number asks why, from four choices; the reading and the reason are kept beside the check-in and nothing is flagged.
4. **A reading more than seven days old is never filled in,** and its old value is not shown.
5. **The habit is said in sentences, where people already are**: one on the check-in's receipt for the person, one at the top of a review for the team, one cell on a leader's Home. The measure counts goals, never people, and a person is never told whether they had to be asked.
6. **A leader's week is a view of Goals called "This week"**: what moved, forecasts that crossed their target, goals gone quiet, and the teams carrying the most red. It has no menu row of its own, and no person is ever a row, a column or a sort order in it.

## One recommendation for each

| Item | The problem, in a sentence | Recommended |
|---|---|---|
| SM | A team of five gets the frame built for ninety-seven: seven set-up steps, thirteen menu rows, a "Watching 0" tab and an empty Metrics page, so Faro reads as a big tool half filled in | No size mode and no "start simple" preset. Four rules: rows and tabs wait for content; a nought is never printed; set-up is four steps; a review of twelve goals or fewer is one page. The rail's Faro mark is the workspace switcher |
| NR | A metric can name its source, but the check-in still asks the owner to copy the number across by hand, and nothing records where a number came from | Round 2's MT4 design, changed by Lane's four answers: the field is filled in, the button names the number, a different number needs one of four reasons, seven days is the limit, and the source shows in History, on the goal and on the metric's page |
| Habit | The habit Faro most wants (checking in before the review, unasked) is noticed by a streak that one late week zeroes, by no number a leader can read, and by nothing at all when a goal reaches its target | Three sentences in places that exist, a row of eight weeks for a set of goals, a forgiving streak by default, and one calm panel on the receipt when a goal reaches its target or comes back |
| A leader's week | A VP can see how goals stand, but not what changed across the division since Monday without opening them team by team | A sixth view of Goals, "This week", that works over any scope and filter; Home links into it. Not its own screen |

## What all four share

- **No new menu row and no new page.** SM takes rows away; NR adds a block to a step; the habit adds sentences; a leader's week is a view of a page that exists. One new address parameter value (`view=week`) and one changed route count (set-up's steps).
- **Goals and teams are counted; people are not.** The habit measure, the row of weeks and "Where the red is" are all sets of goals. R5's rule 5 ("never shame") is the test each was held to, and each spec has a "must never become" list for the rebuild to copy with it.
- **A count is a link to exactly those goals,** as HM1 made the rule on Home.
- **A nought is not printed** (SM's rule 2): "Watching", never "Watching 0"; a section with nothing in it is not drawn.
- **Status stays a shape plus a word.** The week marks in the habit's row are squares, so a circle still means a goal's status and only that; the warning mark is used for "now forecast to miss" and for a reading that is too old, neither of which is a status.

## The first-download budget

The first download is at about 264.7 of 265 KB (`scripts/check-bundle.mjs`), so nothing in this round may add to it. What each item must load lazily:

| Item | In the first download | Loaded later |
|---|---|---|
| SM | The menu rule's change (a module's row waits) must cost nothing net: `module.json` names the collection the row waits for, so the core counts rows already in the snapshot and no module code is pulled forward. The rail's switcher reuses the control already there | The switcher's panel (the list of workspaces, its search, "Set up a workspace") moves to a chunk loaded when it is first opened, which pays for the rest. Set-up, Goals' tabs and the empty states are in lazy screens already |
| NR | Nothing | All of it: the block belongs to the Metrics module's chunk and is drawn inside the check-in, which is lazy; the source is asked when the number step opens |
| Habit | Nothing. Home is the one screen in the first download, so its cell must not pull the rule in: the cell's second line is fetched after Home paints (a dynamic import of `habit.ts`), and the cell is drawn without it until then | The receipt (check-in), the review's sentence and row of weeks (Reviews), the team's page (People) |
| A leader's week | Nothing | A layout chunk of Goals, loaded when `view=week` is chosen, as Map and History are |

If SM's shell change can't be made to net nought, the build says so before it merges and the switcher's panel moves first, in its own small PR.

## A suggested order

Planning's to decide; this is the order the dependencies suggest.

1. **The habit moment** (HB1 to HB3). Track 1 is holding it for this design. It needs nothing that isn't on main; HB3's Home cell waits for HM7 and is the only part that does.
2. **NR** (NR1 to NR3), after MT2 (merged). It replaces MT4 in round 2's plan rather than adding to it.
3. **SM** (SM1 to SM4), each part separately: the rail's switcher (SM4) and the quiet empty states (SM2) are a day each and need nothing; four-step set-up (SM3) rides with ST2; rows that wait (SM1) touches the shell and wants a quiet week there.
4. **A leader's week** (PF1, PF2), after HM3 and HM4, whose "what moved" rule it reads.

## Questions for Lane

**Decided by Lane, 13 Nov: all recommended (1a–17a),** as relayed by the planning session. The specs are written for those answers, so nothing in them changes.

One batch. The recommended answer is first each time; each spec's "If Lane decides otherwise" says what the other answers change.

**Small workspaces**

1. **How does a small workspace become small?**
   - (a) By rule, with no mode: rows, tabs and sections wait until they have something in them. *Recommended: one product for the rebuild to copy, and a workspace grows into its menu without anyone changing a setting.*
   - (b) A "start simple" preset at set-up that switches Metrics, Reviews and Watching off (feature-switches decision 4b).
   - (c) A size setting on the workspace ("Small team" / "Division").
2. **A module's menu row while it has nothing in it** (Metrics with no metrics).
   - (a) It waits, for everyone. The page is reached from Find, from Workspace → Features and from "Measured by" on a goal; the row appears with the first metric. *Recommended.*
   - (b) It waits for members; admins always see it.
   - (c) It is always there; only the empty page gets quieter.
3. **Set-up's length.**
   - (a) Four steps for everyone: "How you'll work" is a sentence with "Change" on step 1, and is read back on the last step. *Recommended.*
   - (b) ST2's five steps, as designed.
   - (c) One step (a name and you); people and goals come from Home's first week.
4. **A review rhythm sized to the team.**
   - (a) Weekly stays the default for everyone, and a review of twelve goals or fewer is drawn as one page with one button. *Recommended: a small team already meets weekly; what was too big was the review's machinery, not its rhythm.*
   - (b) Set-up proposes "every 2 weeks" when eight people or fewer are added.
   - (c) A workspace of eight or fewer starts with no review, and Home offers one after the second week.
5. **The workspace switcher on the icon rail.**
   - (a) The Faro mark at the top opens it: the same place as on the full sidebar, and no new row. *Recommended.*
   - (b) Inside the menu behind your initials, at the foot.
   - (c) Its own icon at the top, and the Demo box moves into the menu behind your initials.

**Readings**

6. **Confirming a reading.**
   - (a) The field is filled in and the step's button says the number: "Confirm 12 min". *Recommended.*
   - (b) The field is filled in and the button stays "Continue".
   - (c) As MT4 drew it: the number is shown above an empty field, and "Use 12 min" puts it in.
7. **The reason for a different number.**
   - (a) Asked, and needed: one of four choices; words are optional except for "Something else". *Recommended.*
   - (b) Asked, and optional.
   - (c) Needed in the owner's own words (ten characters, as a correction is today).
8. **Seven days, and metrics that refresh monthly or quarterly.** With one limit for every metric, a monthly number is filled in only in the week it is read; the other weeks open on "No new reading" or an empty field.
   - (a) Seven days for every metric, as decided. *Recommended: one rule, and "No new number this week" is the honest answer for a monthly number.*
   - (b) Seven days, or one refresh period if that is longer.
9. **Where a different number shows afterwards** ("recorded only").
   - (a) In the goal's History, in the export, and as one count on the metric's page ("1 of 8 check-ins used a different number"), which is a fact about the source. *Recommended.*
   - (b) History and the export only.

**The habit moment**

10. **What "before the review" means in Faro,** where a review has a day but no hour.
    - (a) By the end of the day check-ins are due, the same clock the streak uses, so a person's line and a leader's number can't disagree. R5 tells the rebuild to use the review's start time. *Recommended.*
    - (b) For each goal, before the day of the first review that includes it that week.
    - (c) Give Faro's reviews a time of day.
11. **The streak's default.** Round 3's decision 5 kept today's strict rule as the default with "one late week forgiven" offered; R5's rule 6 says "streaks forgive".
    - (a) Forgiving by default; strict and "not shown" offered. *Recommended: the model should behave as its own requirement says.*
    - (b) Keep round 3's answer: strict by default.
12. **Where the habit measure is read.**
    - (a) At the top of a review, on a team's page, and beside HM7's cell on a leader's Home. *Recommended.*
    - (b) The review only.
    - (c) Home only.
13. **When a goal reaches its target or comes back on track.**
    - (a) One panel on the check-in's receipt and one row in History, with the share image offered. *Recommended.*
    - (b) Also one line that week on the Home of people who watch the goal.
    - (c) History only.

**A leader's week**

14. **Its own screen, or a view?**
    - (a) A view of Goals, "This week", over any tab and filter; Home links into it; the demo pins it for everyone. *Recommended.*
    - (b) Its own menu row, "Portfolio".
    - (c) More sections on a leader's Home.
15. **"This week" means since when?**
    - (a) Since Monday, the same for everyone who opens it; "Since you last looked" is the other choice in the bar. *Recommended: it is read together in a meeting, so it should say the same thing to everyone.*
    - (b) Since you last looked, as Home does.
16. **"Where the red is".**
    - (a) Only teams with three or more goals off track that are a third or more of their goals, most first, with what those goals lack. *Recommended.*
    - (b) Every team, worst first.
    - (c) Leave it out; Home's "Teams, worst first" is enough.

**The order**

17. **What to build first.**
    - (a) The habit moment now (track 1 is waiting), then NR, then SM in its four parts, then a leader's week after HM3 and HM4. *Recommended.*
    - (b) SM first, because it was the outside review's main complaint.
    - (c) NR first.

## What was not covered or verified

- No app code was run or changed; current behaviour is read from main at `b90fee1` and from the live demo. The first-download sizes are the script's own, not re-measured.
- MT4 (round 2) already designs most of NR. `readings/spec.md` says only what changes and what stays; where the two disagree, the round 4 file is the later decision.
- CF4's forgiven week, HM3, HM4 and HM7 are designed in rounds 2 and 3 and not built. This round reads their rules and does not restate them.
- "Division" is not a thing in the data (teams are flat, and the internal spec says "my division can't be asked"). A leader's week is designed to need no such thing; if the rebuild has an organisation tree, the view takes it as one more scope.
- The mock-ups were checked by eye at both widths against `docs/design-rules.md`; the design check (P6) runs on the app, not on drawings.
