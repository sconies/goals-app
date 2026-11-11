# Round 2: entering data, starting a workspace, and optional rhythm

11 November 2026. Design and spec only: no app code is changed, and nothing here is built. Main is locked until after the talk. Round 1 (`docs/design/README.md`, backlog RD) stands; this round builds on it and says plainly where it changes it.

Lane asked for four things, and on the morning of 11 Nov added a fifth:

1. **Goal entry**: New goal, the goal edit page, and adding a goal from set-up or the review.
2. **Workspace set-up**: from the first screen to the first week.
3. **Bulk import and export**: "easy to bulk add data, but difficult to do it incorrectly."
4. **A question**: can reviews, and check-ins on a timed rhythm, be features a workspace switches off?
5. **The metrics feature**, deeper than round 1's ML1–ML3: defining a metric well, a goal measured by one with slices and targets, a metric that changes or is retired, numbers arriving from a source, comparing goals that share a metric, metrics in the import and export, and whether Metrics is itself a switch.

| Area | Evaluation and design | Build spec | Items |
|---|---|---|---|
| Import and export | [import/README.md](../import/README.md) | [import/spec.md](../import/spec.md) | IM |
| Goal entry | [goal-entry/README.md](../goal-entry/README.md) | [goal-entry/spec.md](../goal-entry/spec.md) | GE |
| Workspace set-up | [setup/README.md](../setup/README.md) | [setup/spec.md](../setup/spec.md) | ST |
| Reviews and the rhythm as switches | [feature-toggles/README.md](../feature-toggles/README.md) | [feature-toggles/spec.md](../feature-toggles/spec.md) | FT |
| Metrics, deeper | [metrics-2/README.md](../metrics-2/README.md) | [metrics-2/spec.md](../metrics-2/spec.md) | MT |

## Part 1. The plan for the work (written before the walk)

### What the first look found

One read of the code and the round-1 files, and one pass over the live demo, before anything was split:

- **The four asks are one subject seen four ways: how a fact gets into Faro and whether Faro trusts it.** A goal typed into the form, a goal in a set-up template, a goal in row 4,112 of a workbook and a goal added mid-review are the same record, checked by the same rules (`src/domain/changeset.ts` is already the one engine; `src/domain/columns.ts` is already the one list of columns). What differs is how each door says what is required, and what it does when something is wrong. Today each door says it differently.
- **Nowhere says which fields are required.** `columns.ts` gives each column a role (matches, can change, action, worked out) but not whether a new row must have it, its format, or an example. The form finds out by refusing; the import finds out by listing problems; `docs/export-format.md` doesn't say.
- **The import already has the right bones**: one format, a preview, all-or-nothing, undo from Activity, and a file that loads back unchanged. What it lacks is the middle ground between "wrong" and "fine", a way through a big file, and words for the person who made the mistake.
- **Round 1's OB1–OB3 cover the order of New goal's steps, a goal not born late, and day one.** They stop at: the edit page, goals added from set-up and the review, what "required" means, drafts, what set-up asks about how the team works, and set-up's spreadsheet path (named in round 1 as not covered).
- **The rhythm is a parameter of the core, and reviews are a feature.** `RULES.staleDays` (14), the `due` flag, Home's "due by Thursday" and the streak are the rhythm; they live in `src/domain`. Reviews are screens, a table and a walkthrough that `docs/architecture.md` already lists as "still to move" into a module. So the question has two different answers, and they are designed apart.

### The split, and what depends on what

```
feature-toggles ──┐ (what a workspace may switch off decides what set-up asks
                  │  and what a new goal promises)
import ───────────┼──► goal-entry ──► setup
 (the field table │    (the form is the     (set-up is: name, people, how you
  and the three   │     field table, one     work, then goal entry or an import,
  levels are the  │     goal at a time)      then day one)
  base)           │
```

- **Import first in thought, because it owns the field table and the validation model.** Goal entry and set-up refer to both; neither restates them.
- **Toggles beside it**, because its answer changes one step of set-up and a few lines of goal entry.
- **Goal entry before set-up**, because set-up's goal steps are goal entry.
- **Metrics (added 11 Nov) hangs off three of them**: its sheet is part of the field table (import), "Measured by" is a field of goal entry, and whether it can be switched off is the toggles question asked of a third feature. It is already a module, so its switch exists; the design says what switching it off shows.
- All five are walked and drawn in parallel, one agent each, on the shared decisions below. The decisions are kept here, and each area's output is reviewed against them before it is accepted.

### Shared decisions for round 2 (every area uses these)

These add to round 1's shared patterns (`docs/design/README.md`, "What is shared"); they replace none of them.

**1. One field table.** Every field a person can give Faro is one row in one table: its name, whether a new record must have it, its format, an example, what it defaults to, and the exact words when it is wrong. The table is specified in `import/spec.md` and would live in `src/domain/columns.ts` (each column gains `required`, `format`, `example`). The form's labels and errors, the import's preview, the template, `docs/export-format.md` and Help are all made from it. A field is one of:

| Word on screen | Means |
|---|---|
| **Required** | A new record can't be saved without it |
| **Required for {type}** | Required when the goal is of that type (Target for a number goal) |
| Optional (said only where a group mixes both) | Can be left out; the default is said |
| Worked out | Faro writes it; never read back |

Forms mark the few optional fields, not the many required ones, when most are required; a step with one required field says nothing. A spreadsheet's header row can't carry marks, so the template and the README sheet say it, and the preview says it first.

**2. Three levels, the same at every door.**

| Level | Word | Mark | What happens |
|---|---|---|---|
| Blocking | **Must fix** | The warning mark, and a wash or full outline on the field or row | It can't be saved. The words say what is wrong, what was found and what would be right |
| Questioned | **Check** | The warning mark, quieter | It can be saved once a person has answered the question. One answer covers every row with the same question |
| Fine | (none; counted) | None | Saved |

- Blocking is for what Faro cannot record truthfully: a missing required field, a word it doesn't know, a number that isn't one, a key used twice, an owner it can't find.
- Questioned is for what is possible but unlikely: a stage dated in the past (round 1's OB2 is the first case of this level), a number ten times the last, a name one letter from an existing one, a team or person the file would create, a goal with the same name in the same team, a start that isn't today's number.
- Neither level is a status, so neither uses a status shape or colour capsule (the design rules).
- An error names the field in the person's words, says what was read, and gives the fix: "Level says “vp”. Use north star, svp or team." Never a code, never only "Invalid".

**3. See it before it is saved.** Every door ends on a read-back: New goal's last step, the edit page's "What will change", set-up's check step, the import's preview. The read-back says what will be added, changed, stopped and left alone, in counts first and rows on request.

**4. Everything entered can be taken back.** One goal: Delete while it has no check-ins (exists). A bulk load: one Undo for the whole load, from where it was done and from Activity, for as long as nothing later depends on it; after that, the rows are named.

**5. Out and back in changes nothing.** Anything exported, loaded back unedited, reads as "Nothing would change". This is already a rule (`roundtrip.test.ts`); round 2 makes it something a person can see.

**6. Two choices, said the same everywhere.** (Settled by the toggles analysis; the provisional "weekly or none, on the workspace" became this.)
- **Reviews** on or off, for the workspace: a module, switched on Workspace → Features (`reviews` in `Workspace.modulesOff`).
- **The check-in rhythm**: "Every week" (with the day check-ins are due by) or "No set rhythm". It is a number of weeks on the cycle, `Cycle.checkInWeeks` (1 or 0 now; 2 and 4 later), beside the due day the cycle already holds, so no rule changes its inputs. With no set rhythm nothing is due or late for want of a check-in, "No recent update" goes, and a status that isn't this week's says "as of week 44".
- **Metrics** is already a module and stays switchable, on by default; switching it off says what it will do first.
- Off means absent, not disabled: no menu row, no empty block, no sentence about what isn't there (round 1's rule for a person who can't act). Nothing saved is deleted, and switching back on brings it back as it was.
- Before a switch acts on a feature that owns records, it says what will happen in counts; after, Undo.

**7. Words.** "Import" and "Export" for files (as today). "Load" is not used as a second word for import in new wording. A file is "the workbook" or "the file"; a sheet is "the Goals sheet"; a line is "row 14". "Must fix", "Check", "Required", "Optional" as above. The first week is "your first week", the first screen is "Welcome".

### Numbers, so no two specs claim one

Round 1 ended at U86, F16, N17, P18. A build session takes the next free number if another build has taken one since.

| Area | Items | Journeys | Checks | Requirements |
|---|---|---|---|---|
| Import and export | IM1… | U87–U92 | F17, N18, P19 | `FIELD-TABLE`, `IMPORT-LEVELS`, `IMPORT-PREVIEW`, `IMPORT-UNDO`, `IMPORT-LARGE` |
| Goal entry | GE1… | U93–U96, U109 (dates) | F18, N19 | `GOAL-ENTRY-REQUIRED`, `GOAL-EDIT-PREVIEW`, `GOAL-ADD-ANYWHERE` |
| Set-up | ST1… | U97–U100 | F19, N20 | `SETUP-FIRST-SCREEN`, `SETUP-HOW-YOU-WORK`, `SETUP-UPLOAD`, `FIRST-WEEK` |
| Toggles | FT1… | U101–U104 | F20, N21 | `REVIEWS-OPTIONAL`, `RHYTHM-OPTIONAL` |
| Metrics | MT1… | U105–U108 | F21, N22 | `METRIC-DEFINED`, `METRIC-CHANGE`, `METRIC-SOURCE`, `METRIC-COMPARE`, `METRIC-SHEET` |

### How each area is written

The same shape as round 1: `README.md` (jobs by role and frequency; findings with evidence; the design; each screen's one primary action; role differences; the phone; wireframes) and `spec.md` (routes; each screen's content in order with exact wording, empty and error states; who sees what, naming the action that enforces it; rules for `src/domain` with worked examples; redirects; evals; Help and What's new; "if Lane decides otherwise"; a build plan). Wireframes are drawn with `docs/design/_shared/kit.cjs` at 1440 and 390 px. Walks use the live demo at `/demo?today=2026-11-11`, and `/?store=browser` with database requests blocked for set-up and importing, so nothing is written to the shared database.

## Part 2. What came back, reconciled

Each area was walked, written and drawn by its own agent against Part 1, then reviewed here: every report read against the shared decisions, the wireframes looked at on both widths, and the places where two areas disagreed settled below. During the day Lane added three things, which are in: the metrics area; **dates in goal entry** (baseline, from and to, picked by year and week: goal-entry wireframe 8, GE9); and **every choice of a person, team, goal or metric is search-to-find** (goal-entry spec 2.14 and wireframe 9, on round 1's find-and-pick).

### The answer on switches

**Yes to both, per workspace, both on by default.** They are different kinds of thing. Reviews is a feature: no status or attention rule reads a review record, so it can go behind a switch now (FT2) and move into its own module folder later (FT3). The rhythm is not a feature but a number the core's rules already turn on (`RULES.staleDays`, the `due` flag, the streak), so it becomes a choice with "No set rhythm" as one value (FT1). What people dated themselves (stage dates, next steps, "back on plan by") stays either way. Full analysis: [feature-toggles/README.md](../feature-toggles/README.md).

### The ten worst things found

| # | What | Where |
|---|---|---|
| 1 | **The form doesn't run the rules the import runs.** Tunde, not an admin, published a north star owned by Amara, feeding a team goal; the import refuses the same row | goal entry E1 |
| 2 | **An unedited export doesn't load back unchanged on the live demo**: "1 plan changed. 5569 rows are the same as now." | import I7 |
| 3 | **Another workspace's file rewrites this one's goals**: rows match by key alone, so G-1 would be renamed and re-targeted | import I5 |
| 4 | **Nothing says which fields are required, and the doors disagree.** A file with no Unit column saves 3 → 9 as "3%"; no Type means a number goal; the same name in a team is noted by the form and refused by the import | import I1, I2; goal entry E2 |
| 5 | **A 30,000-row file takes 5 min 36 s, freezes the page twice for over 160 s and uses 1.5 GB**; one typo repeated gives "27000 rows need fixing first" | import I6, I3 |
| 6 | **Questions are shown but never asked.** "Is that right?" sits beside an enabled Save in the import; New goal lets −5 → 5 %, 50 → 150 % and a billion through | import I4; goal entry E3 |
| 7 | **Changing a goal hands it over in one press**: owner, level and name changed, "Saved.", the old owner locked out at once, the new one not told, no way back | goal entry E8 |
| 8 | **Set-up hides a bad spreadsheet until after "Create workspace"**, then shows one fault at a time; its Check step miscounts the goals | set-up W3; import I10 |
| 9 | **The day check-ins are due can never be changed after set-up, and a workspace set up on a Wednesday has its first check-ins due the next day, or the same day** | set-up W6, W7; toggles finding 3 |
| 10 | **Removing a metric unlinks every goal and a restore doesn't bring the links back; a metric's meaning, unit or direction can change under its goals with no mark** | metrics M2-4, M2-5 |

Close behind: set-up's steps aren't addresses, so a reload on step 4 returns to Welcome (W19); dates in New goal are bare week numbers with no year, "By when?" is fixed text and the start week can't be chosen (E14); the who step is still selects of 97 people, 127 goals and 14 teams (E15).

### Where two areas disagreed, and what stands

The field table lives in `import/spec.md` section 3. These rows are settled here; a build session reads the import spec with these on top.

| Field or rule | Import said | Goal entry or metrics said | What stands |
|---|---|---|---|
| Unit | Optional; none is a Check | Required | **No default, ever** (never "%"). Empty is a **Check** at every door: "This number has no unit. Is it a plain count?" Asked once per goal in the form, once per file in an import |
| Warning margin (range goals) | Optional, defaults to 1 | Defaults to none; a margin as large as the limit is a Check | **None by default**; the Check stands at every door |
| Decimals | Worked out from what was typed, up to 3 | The same, and changeable on the edit page | Agreed |
| Type | Read from the filled columns when the column is empty | The form always asks | Both: a form can ask, a file says it by its columns; ambiguous is Must fix |
| Same name in the same team | Check | Check | Agreed (today: Must fix in the import, a note in the form) |
| Two stages with one name | Not listed | Must fix | **Must fix** at every door: the Check-ins sheet matches stages by name |
| A stage or date in the past | Check, three answers | Check (round 1's OB2) | Agreed; the import adds "Count them from this week" |
| Dates | Week numbers from the cycle's start | Year and week, picked; From and To | **The sheet gains From and To written `2026-W46`**; Plan from week and Due week still load; when both are given and disagree, the one changed counts (the rule Owner and Owner email already use) |
| Also helps, Guardrail | Not columns | Needed for the form to round-trip | **Added to the Goals sheet**, optional |
| Measured by, Measured for, Part; the Metrics sheet | Read-only sheet | Loads back, with Action Retire / Bring back | **As the metrics spec section 3 gives them**, present only while Metrics is on |
| Who may add a team | An admin, from a file | Not covered | An admin, at every door; for others an unknown team is Must fix with the nearest name offered |
| Rhythm wording | "No rhythm" (set-up's draft) | "No set rhythm" | **"No set rhythm"**; set-up's files were corrected |

Journey U109 is goal entry's fifth (the dates), since it was given four.

## Part 3. One build plan across the five areas

Backlog-sized items in order. Effort as in round 1: **S** (under a day), **M** (a release), **S–M** between, **L** (more than one release). Each is one PR with its spec section, conformance rows, evals, Help and What's new. RD items named under "Depends on" are round 1's; those marked *held* are waiting for Thursday 12 Nov (`docs/handover.md`).

| # | Item | What | Effort | Depends on | Spec |
|---|---|---|---|---|---|
| 1 | **IM0** Round trip is exact | The rounding fault that makes an unedited export read as a change | S | Nothing. A fault on the live demo: first after the talk | import |
| 2 | **GE1** The form runs the engine's rules, and says what it needs | New goal, Edit and set-up's cards save through the same rule as the import; required and optional said; no "%" default | S–M | Nothing | goal entry |
| 3 | **IM1** The field table | Required, format, example and wording per column in `columns.ts`; the template, the README sheet, `docs/export-format.md` and Help made from it | M | Nothing | import |
| 4 | **FT2** Reviews behind its switch | The module's manifest, the read-back before a switch acts, the "switched off" line, "Due by Thu 12 Nov" wording | S–M | AR2, AR3 (merged); after the held track 1 and 2 items leave Home and Goals | toggles |
| 5 | **IM2** Kinds, levels and near misses in the engine | Must fix and Check as data; one question per kind; near names asked | M | IM1; OB2 *held* | import |
| 6 | **GE2** Questions in place | The Check block in the form; answers kept in History; the tools carry every question | S–M | GE1, IM2, OB2 *held* | goal entry |
| 7 | **FT1** The rhythm as a choice | `Cycle.checkInWeeks`, "No set rhythm", an action that changes the due day, the screens without due and late, a second conformance set | M | NV3, OB2 *held* | toggles |
| 8 | **IM3** The preview | What was read, counts by sheet, Must fix by kind, Check questions, the rows to fix as a file, "Leave these rows out" | M | IM2; FS1's pickers *held* (a fallback is given) | import |
| 9 | **GE9** The three dates, picked | Baseline, From and To; the year-and-week picker, also for a stage's due week; the conversion rule; From and To in the sheet | M | GE1, GE2, OB1 *held*, IM1, FT1 | goal entry |
| 10 | **GE3** The read-back | New goal's last step in sentences, with dates and what is due | S | GE1, GE2, OB1 *held*, FT1 | goal entry |
| 11 | **ST1** Welcome and arrival | `/welcome`, `/join/<id>`, an invitation that opens the right workspace | S–M | Nothing | set-up |
| 12 | **ST2** Set-up in five steps, each an address | Name and you; how you'll work; people; goals; check | M | NV2 if landed | set-up |
| 13 | **ST3** How you'll work | The rhythm and reviews asked once, with first dates; two clear days before a first check-in; About says the same | M | FT1, FT2, ST2 | set-up |
| 14 | **GE4** Change a goal: what will change, and Undo | The edit page's read-back, a reason for a plan change, hand-over with a note and Undo, unit and decimals | M | GT3's edit page and FS1's pickers *held*; GE1, GE2 | goal entry |
| 15 | **IM4** Imported, Undo and past imports | One Undo per import; `/data/imports` from the change log | S–M | AR3 (merged); FS2 on Data *held* | import |
| 16 | **IM5** The way in, with paste | The Import page's one action; paste from a spreadsheet; the header row found | S–M | IM1, IM3 | import |
| 17 | **ST4** People, with the three levels | Count line, paste, duplicate emails, near names | S–M | IM2, IM3, FS1, ST2 | set-up |
| 18 | **ST5** Goals in set-up: four doors, one list | An example, your own (the goal form), a spreadsheet, later | M | GE1 (the form usable outside `/goals/new`), OB1, OB2 *held*, ST2 | set-up |
| 19 | **IM8** with **ST6** The import inside set-up | The preview in "every row is new" mode; people the file doesn't add | S–M + S–M | IM3, ST4, ST5 | import, set-up |
| 20 | **ST7** The read-back, the invitation and Undo | Check in counts and sentences; "Copy the invitation"; undo a set-up nobody has joined | S–M | ST1, ST2, ST3 | set-up |
| 21 | **ST8** Your first week | Dated rows for each person; nothing late in week one; unfinished work moves to About | M | OB3, WR2 (merged); ST1, ST3; FT1, FT2 | set-up |
| 22 | **IM6** Large files | Reading off the page's thread, progress, Stop, 50 rows at a time, the 5,000-row limit said first; the server job written as a platform requirement | M | IM3 | import |
| 23 | **GE5** Add a goal from where you are | Under a goal, on a team's page, as a copy; "Adding several?" to the paste door | S–M | OB1 *held*, GE1, IM5 | goal entry |
| 24 | **GE6** Agree a goal in a review; ask someone to set one up | A next step "Set up a goal: {name}" that opens the form filled in | S–M | GE5, FS1, FT2 | goal entry |
| 25 | **GE7** Several drafts, listed | Up to five, 30 days, on New goal and under Goals, Mine | S–M | OB1 *held*, NV2 | goal entry |
| 26 | **IM7** Export | One sheet from Goals and from Data; file names | S | FS2 on Data *held* | import |
| 27 | **IM9** MCP | `bulk_change`, `export`, `undo_import` with the same levels and a dry run | S | IM2, IM4 | import |
| 28 | **MT1** Defining a metric well | Three things first, the rest later; "Fully defined" or "Still to say: …"; close names asked | S–M | ML3 *held*, IM1 | metrics |
| 29 | **MT2** For, which part, and what a goal takes from its metric | The slice as "Which part"; unit and direction from the metric | S–M | ML2, OB1 *held*; FS1; GE3; 0c2 | metrics |
| 30 | **MT3** Changing, retiring, merging | A read-back naming the goals; marks on charts and History; Retire keeps links | M | ML1, ML3 *held*; GT1–GT3; MT2 | metrics |
| 31 | **MT5** Comparing goals on one metric | Worst first, each against its own plan on one scale; never a ranking of people | S–M | ML1 *held*, MT2 | metrics |
| 32 | **MT4** Numbers from the source | The check-in offers the source's number with where and when; the owner confirms and still says what changed | M | MT2, FT1 | metrics |
| 33 | **MT6** The Metrics sheet in and out | Loads back; Goals sheet's Measured by; Retire by Action | M | IM1–IM4, AS part 2 *held*, MT1–MT3 | metrics |
| 34 | **MT7** Metrics behind its switch, honestly | The read-back in counts; the sheet and columns absent when off | S | FT2, MT6 | metrics |
| 35 | **GE8** A carried goal says what was assumed | After a new cycle, where each goal starts and its dates | S | GE4, GE9, OB2 | goal entry |
| 36 | **ST9** A second workspace | "Bring people from {ws}"; no invitation in a browser copy | S | ST2, ST4, ST7 | set-up |
| 37 | **ST10** Starting late in the year | "Start now" or "Start with 2027" (a spike first) | S–M | ST3 | set-up |
| 38 | **FT3** Reviews moved into `src/modules/reviews` | The real move; three additions to the module contract | L | AS part 2, ML1–ML3 *held*; FT2. Still "reviews last" | toggles |
| 39 | **FT4** Every two weeks, every month | The other two values of the rhythm | S–M | FT1, and a team asking | toggles |

**About thirty releases of work**, roughly: import 7, goal entry 7, set-up 8, toggles 4 to 5 (two without the real move of reviews), metrics 6. That is more than round 1's eighteen, and it should not all be built: Faro is a model, and several items teach the rebuild little beyond the first of their kind.

**The first cut is items 1 to 11: about nine releases.** After it: an export loads back unchanged; the form and the import run one set of rules and say what is required; a wrong row is refused with a fix and an unlikely one is asked about, once; Reviews and the rhythm can be switched; dates are picked by year and week; a goal is read back before it is published; and Welcome exists. Everything Lane named is visible in it except set-up's new shape.

**The second cut is set-up (12, 13, 17 to 21)** and the edit page (14); the third is the rest of import and goal entry; metrics (28 to 34) follows round 1's ML1–ML3 wherever they land.

### How it slots into RD's three tracks

Round 1's held items go first, as planned for Thursday. Then, one build at a time per area:

- **Lists and the frame** (after FS3, GL2, FS4 and FS2's Data bar): IM0 → IM1 → IM2 → IM3 → IM4, IM5, IM7 → IM6 → IM9.
- **One goal** (after OB2, OB1 and GT3's edit page): GE1 → GE2 → GE9 → GE3 → GE4 → GE5 → GE6, GE7 → GE8. GE1 needs nothing and can start at once.
- **People, Workspace, Metrics** (after AS part 2 and ML1–ML3): FT2 → FT1 → ST1 → ST2 → ST3 → ST4 → ST5 → IM8 with ST6 → ST7 → ST8, then MT1 → MT2 → MT3 → MT5 → MT4 → MT6 → MT7, then ST9, ST10; FT3 last of all.

Two items cross tracks and set the pace: **IM2** (the levels) holds GE2, ST4 and MT6; **FT1** (the rhythm) holds GE3, GE9, ST3, ST8 and MT4. Build those two early.

### In the backlog

- **Adds:** one entry, "RD2: redesign round 2", pointing here, after RD.
- **Replaces:** SU's leftover ("No value yet" at set-up), the backlog's N leftovers on import questions, and round 1's "set-up's spreadsheet path, not covered".
- **Changes in round 1, said in each area's "What this changes in round 1":** OB1's Check step becomes the read-back and its unit starts empty; OB3's seven steps become five and "Getting started" becomes "Your first week"; GT3's edit page gains "What will change"; ML2 loses "Use different ones" and gains "Which part"; ML3's Remove becomes Retire; ML1's "Lowest now / Highest" line becomes a spread that names no team. FS1 is unchanged, and four more items now wait on its held part.
- **Migrations:** import, goal entry and set-up need none. Toggles needs two columns on `okr_cycles` (FT1). Metrics needs seven columns and no table (MT2, MT3, MT4). The SQL is in each spec, written for the `faro` schema with its grants.
- **For the internal platform, written as requirements, not built:** a server-side import job above 5,000 rows; invitations and sign-in; who may create a workspace; real connectors behind the number source; a log of exports.

## Decisions for Lane

One batch; the recommended answer is first. Each area's README has its own finer list, and each spec says what changes for another answer.

1. **Reviews and the rhythm as switches** (toggles 1, 2, 4).
   - (a) Both, per workspace, both on by default: Reviews as a switch now and a real module later; the rhythm as "Every week" or "No set rhythm". *Recommended.*
   - (b) Reviews only.
   - (c) Neither in Faro; write both into the spec as requirements.
2. **A quiet goal when there is no set rhythm** (toggles 3).
   - (a) Its last status, with "as of week 44". *Recommended.*
   - (b) Its last status alone.
   - (c) Keep a grey "No recent update" after a number of days an admin sets.
3. **A file with rows that must be fixed** (import 1).
   - (a) Nothing saves by default; "Leave these n rows out and save the rest" is an explicit choice, and the rows left out come back as a file. *Recommended.*
   - (b) Always all or nothing.
   - (c) Save the good rows by default.
4. **A name one letter out** ("Platfrom", "Rhea Kapor") (import 4, 5).
   - (a) Ask, offering the nearest; an admin may add it as new. *Recommended.*
   - (b) Refuse, naming the nearest.
   - (c) Accept the nearest and say so.
5. **Large files in Faro** (import 3).
   - (a) Check any size; save up to 5,000 changed rows at a time and offer the file back in parts; the server job is a platform requirement. *Recommended.*
   - (b) Save any size from the browser, in batches.
6. **A number with no unit** (reconciled above).
   - (a) No default; empty is asked about once. *Recommended.*
   - (b) Required.
   - (c) As today ("%").
7. **Dates in goal entry** (goal entry 10, 13).
   - (a) Baseline's date and From are one date; From and To are picked by year and week; the sheet writes `2026-W46`. *Recommended.*
   - (b) Baseline's date and From as two dates (a data change).
   - (c) Pick weeks, but keep bare week numbers in the sheet.
8. **A goal that hasn't started yet** (goal entry 14).
   - (a) "No check-in yet · starts week 50", and nothing is due until then. *Recommended.*
   - (b) A new status, "Planned".
9. **Handing a goal to someone else** (goal entry 6).
   - (a) A read-back, an optional note to them, and Undo for ten minutes. *Recommended.*
   - (b) The same, with a required reason.
   - (c) The new owner must accept (spec only).
10. **A goal agreed in a review** (goal entry 1).
    - (a) A next step for its owner, "Set up a goal: {name}", that opens the form filled in. No migration. *Recommended.*
    - (b) A real unpublished goal (a migration).
    - (c) Open New goal inside the review.
11. **Who may set a level above Team, or make a goal for someone else** (goal entry 2, 8).
    - (a) Anyone may propose it; a non-admin is asked, and "Ask {name} to set it up" covers other people's goals. *Recommended.*
    - (b) Admins only: a new row in R1.
    - (c) As today: unasked.
12. **Set-up's shape** (set-up 1, 2, 4, 6).
    - (a) Five steps; Welcome's main action "Set up a workspace"; two clear days before a first check-in; after set-up the main action is "Copy the invitation". *Recommended.*
    - (b) The same, keeping "Try the demo" as Welcome's main action.
    - (c) Keep today's seven steps; take only the dates and the invitation.
13. **Starting late in the year** (set-up 5).
    - (a) With eight weeks or fewer left, ask: "Start now" or "Start with 2027". *Recommended, after a spike.*
    - (b) Say how many weeks are left; don't ask.
    - (c) As today.
14. **Metrics: slices, and stopping use** (metrics 1, 2, 4).
    - (a) "Which part" as a label on the link; Retire keeps a metric's goals linked, Delete only if never used; a change of meaning asks "is it the same number?" and marks charts when it isn't. Seven new columns. *Recommended.*
    - (b) The same without marks (five columns).
    - (c) Team-only slices and today's Remove; no migration.
15. **Numbers from a source** (metrics 5).
    - (a) The owner always confirms the number and says what changed. *Recommended.*
    - (b) Recorded by themselves where there is no set rhythm (a platform requirement only).
    - (c) Always recorded by themselves.
16. **Metrics as a switch** (metrics 9).
    - (a) Switchable, on by default, with a read-back before it goes off. *Recommended.*
    - (b) Always on.
    - (c) Off by default.
17. **How much to build, and when.**
    - (a) The first cut (items 1 to 11) after round 1's held items, in the three tracks; decide the second cut when it lands. *Recommended.*
    - (b) The first and second cuts (adds set-up and the edit page).
    - (c) Only IM0 and GE1 now, as fixes; the rest after the talk's feedback.
    - (d) Hold all of it.

## What was not covered

No person was timed; minutes are step and field counts. The live root with real workspaces was read from code, not walked. Saving and undoing an import above 1,000 rows was not seen through (the demo's browser storage filled). No metric screens were live when the metrics walk ran (10:03 UTC), so they were read from round 1 and the fallback PR #57. The import's and the AI tools' refusals cited in goal entry were read from `changeset.ts`, not run. "Start with 2027" and carrying a goal's dates into a new cycle are untested and each begins with a spike. Wireframes are drawings; numbers in them are illustrative.
