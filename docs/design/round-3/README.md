# Round 3: the flows not yet redesigned, and what else can be switched or set

11 November 2026. Design and spec only: no app code is changed, and nothing here is built. Lane asked (11 Nov) to keep going with the redesign reviews and the feature isolations after round 2 (`docs/design/round-2/README.md`). Rounds 1 and 2 stand; this round builds on both.

## Part 1. The plan for the work

### What is in

Four flows that neither round has redesigned, and the two halves of the isolation question.

| Area | What | Folder | Items |
|---|---|---|---|
| The check-in | The thing people do most: one goal at a time, all numbers in a table, correcting a past week, with and without a rhythm | [check-in/](../check-in/README.md) | CK |
| The end of a cycle | The wrap-up, results, and carrying goals into a new year | [cycle-end/](../cycle-end/README.md) | CY |
| Running a review | Preparing, the walkthrough, deciding, finishing, the next session | [reviews/](../reviews/README.md) | RV |
| Home, every week | The owner's, the manager's and the leader's Home after the first week | [home/](../home/README.md) | HM |
| More switches | Which other features can be modules a workspace switches off: Watching, the Map, markup and the Feedback inbox, the wrap-up and results, MCP access, forecasts and trends | [feature-switches/](../feature-switches/README.md) | SW |
| Settings, not switches | What should be a number or a list a workspace sets: levels, the status thresholds, the shape of the year, the streak | [workspace-settings/](../workspace-settings/README.md) | CF |

### What is left for a later round

Telling people things (digests and notifications: platform requirements, R5); a screen-reader pass and dark mode; Data's tables as an editing surface.

### What depends on what

- **Home reads everything**: what the check-in, a review and the cycle's end each ask of a person shows there first. Home is designed last in thought and takes its blocks from the other three.
- **The switches decide what the four flows may assume.** A flow names what it shows only while a feature is on; the switches area says which features those are.
- **Settings change words everywhere** (a level's name, "on track" at 95%): the four flows use the vocabulary and never a fixed word for a level or a threshold.

### Shared decisions for round 3 (added to rounds 1 and 2)

1. **The test for a switch.** A feature can be switched off if no core rule reads its records. A number the core's rules turn on is a setting with values, never a switch. What stays core: goals, check-ins, the status rules, asks and next steps, the change log with undo.
2. **One page for both.** Workspace → Features holds "How you work" (the settings) and the switches, as round 2's toggles design drew it. A setting row says what is set and offers "Change"; a switch says On or Off.
3. **Changing either says what it will do first**, in counts, and can be undone. Changing a setting never rewrites the past: closed weeks and quarters keep the rule of their day (the pattern a plan change already follows).
4. **A flow is designed four ways at once**: rhythm on or off, Reviews on or off. Nothing is drawn greyed out.
5. **Words.** "Switch" for a feature, "setting" for a value; "wrap-up" for the end of a cycle; "check-in" stays the word with or without a rhythm; a level is called whatever the workspace calls it.

### Numbers

Round 2 ended at U109, F21, N22, P19.

| Area | Items | Journeys | Checks | Requirements |
|---|---|---|---|---|
| Check-in | CK1… | U110–U113 | F22, N23 | `CHECK-IN-ONE`, `CHECK-IN-TABLE`, `CHECK-IN-CORRECT` |
| Cycle end | CY1… | U114–U117 | F23, N24 | `WRAP-UP` (replaces `RETRO`), `RESULTS`, `CARRY-GOALS` (`CARRY-OVER` is already the check-in's) |
| Reviews | RV1… | U118–U121 | F24, N25 | `REVIEW-PREPARE`, `REVIEW-WALK`, `REVIEW-FINISH` |
| Home | HM1… | U122–U125 | F25, N26 | `HOME-OWNER`, `HOME-MANAGER`, `HOME-LEADER` |
| Switches | SW1… | U126–U129 | F26, N27 | one `<FEATURE>-OPTIONAL` per switch recommended |
| Settings | CF1… | U130–U133 | F27, N28 | `LEVELS-SET`, `THRESHOLDS-SET`, `YEAR-SHAPE`, `STREAK-SET` |

## Part 2. What came back, reconciled

Six agents walked, wrote and drew one area each against Part 1; each report was read against the shared decisions and its wireframes looked at on both widths before it was accepted. The walks ran on the live demo between 10:53 and 11:20 UTC on 11 Nov.

### The verdicts on isolation

| Thing | Verdict | Why |
|---|---|---|
| AI access (MCP) | **Switch now** | An admin can't stop AI tools in a workspace today except token by token; the server already loads which modules are off |
| Watching | **Switch now**, real move later | Its rules sit in the reviews file and are read in 36 files, but no status rule reads a watch |
| Feedback, with screen markup | **Switch now**, as the real move | One module; it goes to the people who build Faro, not to the workspace |
| The Goal map | **Switch later** (the real move only) | It reads goals and nothing reads it back; it becomes a page of its own |
| The Wrap-up | **Switch later**, after the end of a cycle is rebuilt | A year must be able to end without it: that part becomes core first |
| Asks, Activity, saved views, Table/Board/History, Print, What's new | **Core** | Asks are read by "Being handled"; the rest are views of the core's own records |
| The forecast and "Getting worse" | **Core** | One rule feeding a flag that makes a goal need attention |
| Levels | **A setting now**: names, number (one to six) and order | Today a type and a database constraint, named in 54 files |
| Status thresholds | **A setting**, from the next week, never re-reading posted weeks | The numbers the rules turn on; an owner's posted call is stored and stays |
| The streak | **A setting under the rhythm**: shown, one late week forgiven, or not shown | One late week zeroes it today, against "streaks forgive" |
| The year's start month | **Already a setting**, asked once and never shown again | Show it; halves or terms later, only when asked |
| Vocabulary, locale, the week's first day, reason lengths, the trend's span, the projection's weeks | **Rebuild-time constants** | Written into the kit as "decide before you build", left in code |
| Who may do what; retention | **Platform requirements** | R1 as data is the platform's |

No module needs another, so any combination can be off; the smallest Faro that is still Faro is drawn in `feature-switches/` wireframes 3 and 4. CI gains one job, "Core journeys with every module off".

### The ten worst things found

| # | What | Where |
|---|---|---|
| 1 | **Starting the next year moves everyone at once, two weeks early, and last year becomes unreachable.** Pressed on 21 Dec: Home says "week 0 · Q1", weeks 52 and 53 can't be checked in, a 2026 goal's address says "This goal doesn't exist", Data shows "Check-ins 0" and the export holds 2027 only | cycle end Y1, Y2 |
| 2 | **A carried goal arrives with no past and a wrong plan.** None of 12 metric links, 62 watches or 18 open asks follow; the From week is kept; direction flips on 11 of 92 goals; 18 stage goals are due in week 53 of a 52-week year; finished goals are carried | Y3, Y4 |
| 3 | **A year never ends by itself.** On 11 Jan 2027: "week 53 · Q4", "11 days late"; results empty for running goals | Y5 |
| 4 | **An unlikely number is shown, not asked.** Typing 18 where last week was 1.8 shows "Is 18.0 right?" beside a working Continue; once corrected, the goal still says "16.1 pts better, was 18.0%" | check-in K1, K2 |
| 5 | **No screen can correct or add a past week**; only a spreadsheet or an AI tool, with no reason and no read-back | K4 |
| 6 | **Three answers to who may check in**: the screen refuses an admin; the engine, the AI tool and round 1's goal design allow one | K3 |
| 7 | **Four of Home's links open a list other than the one named.** "All goals · 126" lands on Watching: 56 for Amara, 3 for Oskar | Home H2 |
| 8 | **Home's lead is not what is true today.** On a Monday a leader's main button is Thursday's review while a decision 14 weeks old is a plain button; an ask's "before its next session" date slides silently and is never late | H1, H4 |
| 9 | **A review's next session can open with nothing from the last; Finish is refused while one goal is undecided, and can be undone only from a message that disappears** | reviews V1, V7, V2 |
| 10 | **Levels are one company's job titles**, fixed in a type and a database constraint and written out 13 times; and nothing a workspace works by can be changed after set-up | settings C1, C3, C4 |

Close behind: the wrap-up pre-selects "Hit it" for a goal whose last stage was late and is hidden while check-ins are due (Y6, Y7); a next step in a review costs five presses in a sheet (V3); "No new number this week" is a comment and the check-in stays due (K5); "Join this review" is the main button for a non-member and is always refused, while the rule lets anyone decide (V6).

### Where areas met, and what stands

| Where | What stands |
|---|---|
| The Features page (drawn by round 2's toggles, by settings and by switches) | **The switches area's groups**: "How you work" holds settings only, each a row with "Change" (the rhythm with the streak, levels, status thresholds, the goal year); then "Working together" (Reviews, Watching, Wrap-up), "Tools" (Metrics, Spreadsheets, Goal map), "Beyond this workspace" (AI access, Feedback) |
| The library's name | "Metrics" (round 2), not "Metric library" |
| Home's doors into the check-in, a review and the wrap-up | Home was drawn before the three flows finished. **The flows' words win**: the check-in's queue and saved line (check-in spec), the review's "before you meet" and "from last time" (reviews spec), and the year-end rows the cycle-end spec hands over in its 2.9. HM5 builds them |
| Home's lead with Reviews off | Review, then watched goals, then all goals needing attention: one fallback chain (switches), ranked by Home's rule (HM1) |
| A correction after a quarter or year has closed | The week is judged by the rule of its own week; a changed result is said and marked (check-in), and late check-ins and wrap-ups re-derive untouched carried goals for four weeks after the year ends (cycle end) |
| What a new year inherits | The rhythm, levels, thresholds, streak setting and reviews carry as they are; the read-back before "Start 2027" says so (cycle end 2.5, with the settings area's columns) |
| The trend's span and the projection's weeks | Handed by switches to settings; settings' verdict stands: rebuild-time constants, listed in the kit (CF6) |
| Result words | "Met", "Met late", "Not met" (the vocabulary's current words), not the three in the design rules' line 35, which should be corrected when CY5 is built |
| Who may mark a review's goals | Put to Lane (decision 9); the reviews spec is written for "people in the review, or an admin" |
| Requirement ids | `CARRY-GOALS`, not `CARRY-OVER`; `WRAP-UP` replaces `RETRO`; journey U10 retires for U114 and U115 |
| The Goals page in wireframes | No button of its own (Lane, 9 Nov); one settings wireframe drew "New goal" there and was corrected |

## Part 3. One build plan for round 3

Effort as before: **S** (under a day), **M** (a release), **S–M**, **L**. Round 1 and round 2 items are named under "Depends on"; *held* means waiting for Thursday 12 Nov.

| # | Item | What | Effort | Depends on | Spec |
|---|---|---|---|---|---|
| 1 | **CY1** A year ends on its last day | The clock, not a button, ends a year; results are worked out for every goal | S–M | WR4 (merged) | cycle end |
| 2 | **CY2** Starting the next year only prepares it | A read-back in counts; nobody moves until the old year's last day; Undo | M | CY1, AR3 (merged) | cycle end |
| 3 | **CY4** The carry rule, and what comes with a goal | From, baseline, direction, stages and dates set right; metric, watchers, open asks and reviews follow; finished goals finish | M | CY2 | cycle end |
| 4 | **CK1** One way to save a check-in | The form posts through the engine the table, import and tools use | S–M | AR3 (merged) | check-in |
| 5 | **CK2** The levels in a check-in | An unlikely number is asked; the corrected one is the comparison | S–M | CK1; shares IM2 and GE2's block | check-in |
| 6 | **HM1** Home leads with what is true today | The lead as one rule; a quiet line; every count a link to exactly that list | M | GL1 (merged), NV3 *held* | home |
| 7 | **HM2** An ask says how long it has waited | Late is said; an ask can be the lead | S | HM1 | home |
| 8 | **RV7** Who may speak for a review | The rule and the join line agree | S | Decision 9 | reviews |
| 9 | **CF1** Levels read from one place | One list, one lint; no change anyone sees | S–M | AR4 (merged); best with GL2 *held* and GE1 | settings |
| 10 | **SW1** Features for eight, and "every module off" in CI | The page's groups; the job; Watching's rules out of the reviews file | S | FT2 | switches |
| 11 | **SW2** AI access behind a switch | Off refuses every tool with one sentence; tokens kept | S | FT2, SW1 | switches |
| 12 | **CY3** Another year stays reachable | A year choice on Goals, Data, Export; old links and keys open the goal as it ended | M | CY1, GL1, GT1 (merged); FS1, FS2 *held* | cycle end |
| 13 | **CK3** One screen, the read-back, steps as addresses | An on-plan goal is one field and one press | M | CK2, NV2, OB2 *held*, GE9 | check-in |
| 14 | **CK4** Undo, and one confirmation at the end | No screen between goals | S–M | CK1, CK3, FT2 | check-in |
| 15 | **CK5** The queue | With NV3, as one build | S–M | NV3 *held*, FT1 | check-in |
| 16 | **RV1** Why each goal is on the agenda; before you meet; from last time | — | S–M | GT1 (merged); best after FT2 | reviews |
| 17 | **RV2** The walk, with the decision in place | The review's own page; a next step open by default | M | RV1, FS1, GE9 (or its fallback) | reviews |
| 18 | **RV3** Finish, carry, reopen, earlier sessions | — | M | RV2, AR3 (merged) | reviews |
| 19 | **SW3** Watching behind a switch | — | S–M | FT2, SW1; GL2, FS4 *held* | switches |
| 20 | **CF2** Levels set by the workspace | Names, number, order; removing one in use; the migration | M | CF1; FT1 or FT2; IM1, IM2 if landed | settings |
| 21 | **CK6** Correct or add a past week | A reason; what it changes, said first | M | CK1, CK2, GT2 (merged), GE9, IM2, IM3 | check-in |
| 22 | **CY5** The wrap-up | The rules' result with the owner's view and reason beside it; open four weeks after the year ends | M | CY1, CY4, GE2, NV2 | cycle end |
| 23 | **HM3** Your team; teams worst first | — | S–M | GL1, WR1 (merged) | home |
| 24 | **HM4** Changed since you last looked | With the Goals filter | M | HM3, FS2, AR1 | home |
| 25 | **CF3** Status thresholds | From next week; the read-back | M | FT1 | settings |
| 26 | **CF4** The streak | Three values, in the rhythm's sheet | S | FT1, HM1 | settings |
| 27 | **CK7** No new number is a check-in | — | S–M | CK2, CK3, IM1 | check-in |
| 28 | **CK8** The table | Numbers, a tick, a sheet for a new story | M | CK2–CK4, MT4 | check-in |
| 29 | **CY6** A carried goal says what was assumed | This is round 2's GE8, built here | S–M | CY3, CY4, OB2 *held* | cycle end |
| 30 | **CY7** Results, as a page and a sheet | — | S–M | CY1, CY5, IM1 | cycle end |
| 31 | **RV4** The opening and the session window | A late session; "Not held" | S–M | RV1, RV3 | reviews |
| 32 | **RV5** Setting a review up, with team and a read-back | — | S–M | FS1 | reviews |
| 33 | **HM5** Home's cells and places | The flows' doors; modules fill places | S–M | FT2; the CK, RV, CY and SW items it names | home |
| 34 | **SW4** Feedback moved into its module | — | M | SW1 | switches |
| 35 | **SW5** The Goal map moved | — | S–M | SW1, GL2 *held* | switches |
| 36 | The small ones: **CK9** checking in for the owner, **CK10** and **HM8** AI tools, **CY8** a quarter closing, **RV6** the list's bar, **RV8** phone and presenting, **RV10** the one-pager, **HM6** the first week through the lead, **HM7** the leader's check-in standing, **CF6** the kit's "before you build" page | — | S to S–M each | As each spec says | each |
| 37 | The real moves: **SW6** Watching, **SW7** AI access, **SW8** the Wrap-up, with round 2's **FT3** Reviews last | — | M, S–M, M, L | AS part 2 *held*; ML1–ML3; each one's switch | switches |
| 38 | **CF5** The year read in halves or terms | Only when asked | S–M | ST3, CY1 | settings |

**About thirty-five releases of work** (check-in 7, cycle end 7, reviews 6, Home 5, switches 6, settings 4). With round 2's thirty that is far more than Faro needs to be a good model; the point of the three rounds is that Lane can choose from a designed set.

**The first cut is items 1 to 11: about seven releases.** After it: a year ends and starts truthfully; a check-in asks about an unlikely number; Home leads with what is asked and its links are exact; the review rule and its screen agree; levels are ready to be set; AI access can be switched off and Features has its final shape.

**Three items have a date.** The demo's year ends on Sunday 3 January 2027. CY1, CY2 and CY4 are what stops "Start 2027" doing damage and a January that reads "week 53, 11 days late"; if anyone will show Faro across the new year, they go first.

### How it slots into the tracks

After round 1's held items, and woven with round 2's first cut:

- **Lists and the frame** (round 2: IM): HM1 → HM2 → HM3 → HM4 → HM5; CF1 with the next Goals build.
- **One goal** (round 2: GE): CK1 → CK2 → CK3 → CK4 → CK5 → CK6 → CK7 → CK8; RV7 → RV1 → RV2 → RV3 → RV4.
- **People, Workspace, Metrics** (round 2: FT, ST, MT): CY1 → CY2 → CY4 → CY3 → CY5; SW1 → SW2 → SW3 after FT2; CF2 → CF3 → CF4 after FT1; the real moves last.

Round 2's **IM2** (the levels in the engine) and **FT1** (the rhythm) still set the pace: CK2 shares IM2's block, and CK5, CF3, CF4 and HM's cells wait on FT1. **FT2** (the Reviews switch) now holds SW1 to SW3 as well.

### In the backlog

- **Adds:** one entry, "RD3: redesign round 3", pointing here, after RD2.
- **Replaces:** L's parts 1, 3 and 4 (HM4, HM7 and RV1 carry them), LP's U20 and U22 (RV2, RV3), R's F15 (RV1), and the parked question on who may mark a review (RV7).
- **Changes in rounds 1 and 2,** each said in its area: round 1's walkthrough on the goal page (goal spec 2.3) becomes the review's own page; NV3's queue gains "Check in again" and "Correct it"; toggles' Home strip and its "Check in on a goal" lead are redefined; ST8's first-week rows feed Home's lead; GE8 is built as CY6; FT1's `rhythmFrom` becomes week 1's Monday; set-up's ST10 spike is answered by CY2.
- **Migrations:** check-in, reviews, Home and switches need none. Settings needs four columns on the cycles table and drops the fixed list on a goal's level (CF2). Cycle end needs one nullable column for the owner's reason (CY5). SQL is in each spec.

## Decisions for Lane

**Lane's answers (11 Nov):** (a) on every decision, 1–16. On 17, round 3's first cut woven with round 2's after round 1's held items, with CY1, CY2 and CY4 built before the demo's year ends on Sunday 3 January 2027.

One batch; the recommended answer is first. Finer lists are in each area's README.

1. **More switches** (switches 1, 2, 7).
   - (a) AI access, Watching and Feedback (with markup, as one) now; the Goal map and the Wrap-up later. *Recommended.*
   - (b) AI access and Watching only.
   - (c) None beyond Reviews, the rhythm and Metrics.
2. **Tokens when AI access goes off** (switches 3).
   - (a) Kept, and named before it is switched back on. *Recommended.*
   - (b) Revoked.
3. **Levels** (settings 1, 2).
   - (a) A workspace sets their names, number and order; removing one in use moves its goals to a level you pick. *Recommended.*
   - (b) Names only.
   - (c) Leave them in code; say so in the kit.
4. **Status thresholds** (settings 3).
   - (a) Per workspace, from the next week; posted weeks keep what they said. *Recommended.*
   - (b) Changeable only at the start of a year.
   - (c) Leave them in code.
5. **The streak** (settings 4, Home 6).
   - (a) Today's rule by default, with "one late week forgiven" and "not shown" offered; on Home a clause, not a block. *Recommended.*
   - (b) Forgiving by default.
   - (c) On or off only.
6. **When everyone moves into a new year** (cycle end 1).
   - (a) On the old year's last day; "Start 2027" only prepares it. *Recommended.*
   - (b) At the press, but never before the last week.
   - (c) As today.
7. **Whose word is a goal's result** (cycle end 2, 3, 4).
   - (a) The rules', with the owner's view and reason beside it; a goal that met its target finishes; one nobody wrapped up follows the rule and says so. *Recommended.*
   - (b) The owner may override the result.
   - (c) As today.
8. **What comes across with a carried goal** (cycle end 6).
   - (a) Its metric, watchers, open asks and reviews. *Recommended.*
   - (b) Without open asks.
   - (c) The goal alone.
9. **Who marks and decides in a review** (reviews 1; the question parked on 10 Nov).
   - (a) People in the review, or an admin; enforced in the rule. *Recommended.*
   - (b) The same, and anyone may add themselves.
   - (c) Anyone, as today.
10. **A review that runs out of time** (reviews 2, 3, 4).
    - (a) Goals not reached are carried at Finish; a question lets a troubled goal leave the walk and puts it first next time; anyone in the review can reopen until the next session. *Recommended.*
    - (b) Finish is refused until every goal is decided, as today.
11. **The walkthrough** (reviews 5).
    - (a) The review's own page, with the decision beside the goal. *Recommended.*
    - (b) Keep it on the goal's page.
12. **An unlikely number in a check-in** (check-in 1).
    - (a) A question that must be answered, at three times last week's. *Recommended.*
    - (b) Only at ten times, as the import.
    - (c) A hint, as today.
13. **Fixing a check-in** (check-in 2, 4, 5).
    - (a) Undo straight after; "Correct it" replaces with a reason; the owner or an admin may correct or add any week of the running year, judged by that week's rule. *Recommended.*
    - (b) Only the last four weeks.
    - (c) Files and tools only, as today.
14. **Who may check in** (check-in 3).
    - (a) The owner, or an admin for the owner with a reason; a deputy is a platform requirement. *Recommended.*
    - (b) Also the team's lead.
    - (c) The owner only.
15. **Home's main action** (Home 1, 2, 3).
    - (a) The check-in from the day before it is due; an ask when it is late, due this week or a week old; never a check-in when there is no set rhythm. *Recommended.*
    - (b) The check-in from Monday.
    - (c) As today.
16. **A leader's Home** (Home 4, 5).
    - (a) Teams worst first, and what changed since her last visit. *Recommended.*
    - (b) Trees, not teams.
    - (c) Goal rows, as today.
17. **How much of round 3, and when.**
    - (a) The first cut (items 1 to 11), woven with round 2's first cut, with CY1, CY2 and CY4 before January. *Recommended.*
    - (b) Only the dated three (CY1, CY2, CY4) and the faults (CK1, CK2, HM1, RV7).
    - (c) Hold round 3 until round 2's first cut has landed.

## What was not covered or verified

Nobody was timed: every "presses" and "screens" figure is a count. No workspace exists with the rhythm off or Reviews off, so those states are designed from round 2's specs, not walked. The year-end walk needed the demo pinned by hand (a bare `today=2026-12-21` rebuilds the example as March to February), and five week-52 check-ins were added in the browser to do it. Counts of files, tools and journeys are from search (78 AI tools counted here; round 2 said 82). Read from code, not run: a late-loaded week counting as on time for the streak; hand-set plan points surviving a carry; the import of a past week; the AI tools. Home's team figures and the read-backs' counts in wireframes are examples. Still not looked at: notifications and digests, a screen-reader pass, dark mode, Data's tables as an editing surface.
