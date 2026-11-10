# The app, area by area: what to redesign first (10 November 2026)

Lane asked for a redesign evaluation of six areas, as design and spec only, fitted to the Workspace redesign (`docs/reviews/2026-11-10-workspace-redesign.md`, PR #81). This is phase 1: a high-level pass over all six and a ranking. Phase 2, the designs and build specs, is in `docs/design/` (start at `docs/design/README.md`). No app code was changed; there is a code freeze until after the talk on Wednesday 11 November.

## How it was done

- **Read:** `CLAUDE.md`, the design rules, the architecture, the backlog (GD, NAV, MAP, 0a, LV, LP, SU, R5, R6), every review in `docs/reviews/` (most of all 9 Nov's Goals and navigation and 10 Nov's deep review), the Workspace redesign and its spec, `llms.txt`, R1 and R6a, and `docs/live-build/metrics.md` (not changed).
- **Walked** the live demo at `/demo?today=2026-11-11` with Playwright at 1440 × 900 and 390 × 844, as Amara Nwosu (leader, admin), Rhea Kapoor (manager, 8 goals), Tunde Bakare (an owner with 2 goals and nobody to manage) and Oskar Lindgren (owns none). Three helper sessions did the walks (Goals and every search, sort and filter; the goal page and navigation; New goal, set-up, the first check-in and the metric library); I looked at their pictures and read the code behind each screen myself. Where a finding rests on the walk alone it says "walk".
- **Set up a workspace** at `/?store=browser` with every request off the site blocked (a font and one telemetry call each run; nothing was written to the shared database), on the template path and the "set goals up later" path, then opened day one as the admin and as a teammate.
- **The metric library:** its back end read in code (`src/domain/metrics.ts`, `src/modules/metrics/`), and the rehearsal's screens read from the branch `demo/metrics-live-run2` (never merged, never checked out). Its screens are not on main, so nothing of it was walked.

**Not covered:** dark mode, a screen-reader pass, the real shared database, the spreadsheet path of set-up, the review walkthrough's own flow (LP), and the Map's drawing (MAP, built 10 Nov).

Effort: **S** (under a day), **M** (a release), **L** (more than one release). "How far" is how much of the area a redesign must change: **reshape** (a new structure), **reorder** (the same parts, differently arranged), **tidy** (wording and small fixes).

## The six verdicts

### 1. The Goals page

- **What works:** rows that lead with a shape and a word and say why; the phone's two menus (5 controls, first goal 281 px down); every tab, filter and sort in the address; group counts that add up (By level 12 + 44 + 70 = 126); the saved view that becomes a tab while it's open; Table's bulk edit; "Why?" on the counts.
- **Worst problems:**
  - **One tab strip holds two different questions**: whose goals (Mine, Watching) and how they are grouped (Trees, By level, By team), with Needs attention, which is a filter, as a third kind. So "my team's goals as trees" or "what I watch, by team" can't be asked, and Needs attention exists as a tab, a filter (`attention=1`), a toggle ("Decision or help needed") and a checkbox on the Map (`GoalsScreen.tsx:41`, `:154–161`).
  - **Everyone lands on all 126 goals as trees**, 11,942 px tall. Tunde, who owns two goals, sees "Needs attention 41" for the whole division; Mine is the fifth of six tabs. Nothing on the page starts from who is looking.
  - **17 controls and 373 px sit above the first goal at 1440** (18 for owners), in four groups; the phone does the same job in 5.
  - **Counts that look wrong while being right:** the tab says 41, the line beside it "11 off track · 23 at risk · 5 no recent update · 2 on track"; Watching says 56 and shows 25 rows. Two explainers ("Why?") stack before the first row on Needs attention.
  - **Back does not restore what you saw:** search, sort and filters replace the history entry (`GoalFilters.tsx:45`); a layout comes from memory when the address has none, so Back lands on the right address drawn as the wrong layout.
  - Three sidebar entries open the same page (Goals, All, and Watching as a tab), and "Views" means saved views on a computer and tabs plus saved views plus Export on a phone.
- **How far:** reshape. The rows and layouts stay; the frame above them changes: a scope (whose), a grouping, the shared find-sort-filter bar, one count line.
- **Effort:** M.
- **Depends on:** the shared find-sort-filter bar (area 4) and the navigation (area 3: what the sidebar lists under Goals).
- **Unblocks:** People's and Metrics' "See its goals" links (they open Goals with a scope), R6a's scope in the rebuild, and LV's leftovers.
- **Backlog:** GP built the grouping and the cut of Cards; 0u's leftovers; LV. The deep review's "six tabs times five layouts times saved views" (P3, "should not copy" 4) is this.

### 2. The goal detail page

- **What works:** the header (status, number, owner, updated), the scorecard, the chart with its projection, a page that adapts to the kind of goal (stages, a limit, no check-in yet, done), Respond in place ("This closes it for all 3 goals"), the print page, drafts that survive, one primary action chosen by rule (`goalPage.ts:129–146`).
- **Worst problems:**
  - **The owner of an off-track goal has no button.** Rhea on her own north star gets only "…"; "Check in again" is the fourth of six menu items, and "Add a next step" is at the foot of a side column (`GoalScreen.tsx:171`). The page reads as a report about her goal, not a place to work on it.
  - **The same thing is said two to four times.** For Amara the open ask is the primary button, a side card, a line inside "Why", and an Actions row; this week's reason is in "Why" and again at the top of Activity; "What it measures" is in the side column and in About.
  - **Three words for one thing** ("Actions", "next step", "Decision or help"), and on a phone the Actions heading disappears: the list is folded into "What's being done" (`GoalScreen.tsx:214–230`).
  - **The order differs by width**, and on a computer the story ("Why") starts at 702 px, under the chart; the page is 3,139 px with About closed and 4,455 px open.
  - **The history can't be trusted to show a gap:** missing weeks leave no row; "Changes" mixes review look-ins with edits; filters have no counts; nothing about the page's state (open sections, filter, "Show all 79") is in the address.
  - Comment has no Cancel and doesn't say who sees it; Watch doesn't say what it does; the browser title is "Goals" on every goal; edit uses selects of 95 people and 126 goals.
- **How far:** reorder, with one new part (a row of things to do under the header). The pieces are good; their order, repetition and names are not.
- **Effort:** M.
- **Depends on:** little. The pickers on edit and "add a next step" come from area 4; the rest stands alone.
- **Unblocks:** the review walkthrough (it is this page in another frame), 3a (markup on a goal), and the metric block.
- **Backlog:** GD (2) to (7), all of it; part of NAV (4) and (6); LP's U11.

### 3. App navigation

- **What works:** the workspace switcher; a tab bar that changes with what you own; "Back to" that knows where you came from and steps over forms (`BackLink.tsx:60–79`); a skip link and a visible focus ring; module items that slot in; addresses for almost everything.
- **Worst problems:**
  - **The sidebar is a list of 15 to 21 rows of five different kinds**: places (Home, Goals), an action (New goal), views of one place (Mine, Watching, All, up to six saved views), tools (Demo, Send feedback) and you. It is 925 to 965 px tall in a 900 px window for three of four roles, so "Collapse sidebar" is cut off.
  - **There is no way to find anything from where you are.** A goal by name is three steps and only from Goals; a person, a team or a metric can't be reached by typing at all. No shortcut exists except the markup key.
  - **Collapsed, the sidebar loses Mine, All and every saved view**, and its labels are browser tooltips only, though Settings promises names on hover and focus (NAV (1)).
  - **Where you are is said badly:** the browser title is "Goals" on every goal, edit and print page and "Workspace" on every section; nothing is highlighted on the table check-in, the wrap-up or Ready; five phrasings close a form ("Close and keep the draft", "Close and save the draft", "Close without saving", "Close and keep what you've typed", "Close the review").
  - **On a phone the Goals tab opens all 126 goals for an owner**; Mine and saved views are two taps away under More, whose sheet is 12 to 16 rows.
  - Role differences are unexplained (Tunde has Check-in, Amara has none; NAV (2)).
- **How far:** reshape the sidebar and More (grouped, shorter, the same everywhere); tidy the rest (titles, back links, close wording).
- **Effort:** S–M.
- **Depends on:** the Workspace redesign's decisions 2 and 5 (People in the main group; one Feedback item). Find-anything needs area 4's picker.
- **Unblocks:** People (WR1) and Metrics get a home; the Goals page can drop its sidebar duplicates; every later screen inherits titles and back links.
- **Backlog:** NAV, all seven parts; R5's Cmd-K (spec only today); WR5.

### 4. Search, sort and filter

- **What works:** Goals' query is one definition used by the screen, exports, saved views and the MCP tool (`src/domain/query.ts`), in the address, with chips in words; the Map's finder is a real combobox; Data sorts by column; Help's search; "Switch person" finds by name, job title or team.
- **Worst problems:**
  - **Nineteen places search, sort, filter or pick, and no two work alike.** The same words match different things: "G-48" finds a goal on Goals, Data and the Map and nothing on Activity or in a review; "off track" finds 0 goals on Goals, 16 rows on Data and 279 changes on Activity. Only two places say what their box searches.
  - **Six ways to pick a person** (a 97-name select; a finder with chips; a finder with buttons; a finder that adds to a list; cards plus a grouped list; a select in a table cell), none with arrow keys and Enter, and **selects of 97 people, 127 goals and 14 teams** in New goal and edit, in directory order.
  - **Five filter models** (a dialog that applies as you tick; a three-step "add a filter"; a dialog with a select and a finder; three inline selects; one select), under "Filters" in three places and "Filter" in one.
  - **Seven ways to say how many** ("2 of 126 goals", "8 people match.", "1–1 of 1", "12 articles"…), **eight ways to say none** (one of them a blank list), and **six ways to clear**, four of them on one empty Goals page.
  - **The address keeps the search on four pages and drops it on four** (the Map, review set-up, Feedback, People's search); sort is `sort=owner` on Goals and `s=Team~asc` on Data.
  - No typo is forgiven anywhere ("rolback": nothing, no suggestion).
- **How far:** reshape, as one pattern built once: one list bar (search, filters, sort, a count line, clear, empty, paging, the address) and one find-and-pick control, then every place moved onto them.
- **Effort:** M–L (the two shared parts are M; moving nineteen places is the L, done area by area).
- **Depends on:** nothing.
- **Unblocks:** every other area here, the Workspace redesign's People and Teams (WR1, WR6), the metric library's picker, and the rebuild's server search (the one function behind each list is its seam, R4).
- **Backlog:** 0a (1), (2) and (4) are this, and it replaces them; 0a (3) is replaced by the Workspace redesign; U29 (typos) and R5's Cmd-K.

### 5. Goal onboarding

- **What works:** New goal is four steps with three typed fields for the simplest goal, a draft that survives closing and reloading, errors that say what to type ("Type 6, or set the goal's Decimals to 1"), and a goal page that asks for the first check-in; set-up is seven honest steps with a "set goals up later" path; the first check-in is one field and one press when on plan.
- **Worst problems:**
  - **Step 3 is three selects of everything**: Feeds into (127 goals), Team (14), Owner (97, in directory order). "Also helps" can't be set at all when creating (only in edit, `GoalEdit.tsx:213`).
  - **The steps aren't in the address**, so the browser's Back leaves the whole wizard (NAV (5)).
  - **Step 2 puts a seven-row plan table and a chart between the target and how it's measured**, with a first-quarter example shown in week 46 (`PlanTable.tsx:62`); the metric picker's slot sits here, before the team is chosen on step 3, and the Check step never mentions it.
  - **A stage due in week 1 is accepted in week 46**: the new goal is "45 weeks late" and its first quarter "Not met" the moment it's published (SU fixed this for set-up's uploads, not for the wizard).
  - **A new goal's page says "No value yet" four times** and asks three times for a description the wizard called optional.
  - **Day one gives the second person nothing to do**: all four template goals belong to the admin; the teammate's Home says "You don't own a goal". Home still says "Add your people" after people were added. A first check-in against a template's made-up start asks "Why is it behind?".
- **How far:** reorder New goal (the same four steps, measure first, pickers, steps in the address); tidy set-up and the first check-in.
- **Effort:** S–M.
- **Depends on:** area 4 (the pickers), area 6 (measured by), area 3 (steps in the address is NAV (5)).
- **Unblocks:** the metric library's adoption (a goal is linked where it is made), and R6c's planning round in the rebuild.
- **Backlog:** NAV (5), 0a (2), SU's leftover ("No value yet"), 0u's set-up touch targets, U6.

### 6. The metrics library

- **What works:** the back end. A metric is defined once (name, meaning, unit, decimals, direction, source and its owner, refresh, owner, caveats); rules that refuse a unit mismatch and warn on direction (`linkProblems`, `src/domain/metrics.ts:206`); a slice per goal; removal that unlinks and can be undone; MCP tools; 13 demo metrics, 12 linked.
- **What Wednesday adds** (read from the rehearsal): a list under Data with a search by name, a page and a form on one address (`/data/metrics?m=`), "Measured by" as a select in the goal forms with create-in-place, and a block on the goal page.
- **Worst problems to design for afterwards:**
  - **It lives under Data**, beside spreadsheet tables, behind a button; the thing "most worth copying" (0b) has no place in the navigation, and a metric has no address of its own.
  - **A metric's page can't answer "who uses this and how are they doing"**: its goals are bare links, with no slice, target or status, and there is no way to see every team's goal on one metric side by side, which is the point of defining it once.
  - **The picker is a select of every metric** (13 now), with no search and no way to read a metric before choosing it; an exact name is the only duplicate caught, so "CI cost per pipeline run" (a goal) and "CI compute cost per pipeline run" (a metric no goal uses) sit unconnected in the demo.
  - **Nothing tells a goal it could use a metric**, or a metric's owner that goals in its unit are unlinked; nothing says a metric is thin (no meaning, no source) or that its owner has left.
  - Remove has no confirmation and doesn't say what it unlinks; the list has no sort or filter; the phone layout is whatever the grid does.
- **How far:** reshape, from a table under Data into a library everyone reads: its own place, a page per metric that leads to its goals, find-and-pick everywhere a metric is chosen, and a short list of things for a metric's owner to sort out.
- **Effort:** M.
- **Depends on:** the live build being merged (or its fallback), areas 3 and 4, and AS part 2 (the records extension point) if it is to stay a clean module.
- **Unblocks:** numbers that fill themselves in (8c's number source reads a metric), and the growth list in `spec/modules/metrics/growth.md`.
- **Backlog:** 0b's "built live" part is the starting point; its dropped list stays dropped (written as growth notes); 0a's "metrics always use find-and-pick".

## The ranking

Ordered by what each unblocks first, then value against effort, as the backlog is.

| # | Area | How far | Effort | Why here |
|---|---|---|---|---|
| 1 | **Search, sort and filter** (with the one picker) | Reshape | M–L | Depends on nothing; every other area, and the Workspace redesign, stands on it. The inconsistency is the app's widest fault: 19 places, no two alike |
| 2 | **App navigation** | Reshape the sidebar; tidy the rest | S–M | The frame the rest hangs in: People and Metrics need their place, Goals needs the sidebar's duplicates gone, and "find from anywhere" is the picker with a door. Cheap, and it keeps a promise the app breaks today |
| 3 | **The Goals page** | Reshape | M | The most used explorer and the page most likely to be copied wrong (two questions in one tab strip). Needs 1 and 2 |
| 4 | **The goal detail page** | Reorder | M | The page opened most. Its parts are good, so it can also run beside 3 in another build: it shares almost no code with it |
| 5 | **The metrics library** | Reshape | M | Waits for Wednesday's build by design; needs 1 and 2; the idea most worth copying deserves more than a table under Data |
| 6 | **Goal onboarding** | Reorder | S–M | The healthiest area. Most of what's wrong is fixed by 1 (pickers), 2 (steps in the address) and 5 (measured by); what's left is small |

**Phase 2 designs them in this order**, as one set: one app, one navigation, one find-sort-filter pattern, one way to pick a person, team, goal or metric. The Workspace redesign (WR0 to WR6) is fitted into the same build plan in `docs/design/README.md`.

## Three things the pass found that cut across the areas

1. **The app answers "what is there" better than "what is mine".** Goals opens on everything; the phone's Goals tab opens everything; the goal page gives its owner no button; day one gives a teammate no task. The redesign starts each screen from who is looking.
2. **Things are said more than once, in different words.** An ask four times on one page; six pickers for a person; eight ways to say "none"; five ways to close a form; three sidebar rows for one page. One place and one wording each is most of the work.
3. **The good patterns already exist somewhere in Faro.** The phone's Goals bar, the Map's combobox, "Switch person"'s finder, the goal query in the address, "Back to" that knows where you came from. The redesign promotes them to the rule rather than inventing new ones.
