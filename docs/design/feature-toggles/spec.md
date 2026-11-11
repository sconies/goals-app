# Build spec: reviews and the check-in rhythm as switches

11 November 2026. For a build session. The reasons and the evidence are in [README.md](README.md); this says what to build. Nothing here is built. Items FT1 to FT4, journeys U101–U104, checks F20 and N21, requirements `REVIEWS-OPTIONAL` and `RHYTHM-OPTIONAL` (take the next free number if another build has used one).

Read first: `CLAUDE.md`, `docs/design-rules.md`, `docs/architecture.md` ("Switching per workspace", "Adding a module"), `supabase/README.md`, and round 2's shared decisions (`docs/design/round-2/README.md`).

## 0. Words

| Say | Never |
|---|---|
| **Check-in rhythm**; **Every week**; **No set rhythm** | "cadence" for check-ins (a review has a cadence); "weekly/none"; "rhythm off"; "disabled" |
| **due by Thursday**, **due by Thu 12 Nov** | "due before the review" (a review is not what makes it due) |
| **as of week 44** (beside a status that is not this week's, with no set rhythm) | "stale", "old", "out of date" |
| **Reviews is off** / **is back on** (a module's name takes "is") | "Reviews are disabled" |
| **Switch off**, **Switch on** | "toggle", "enable", "deactivate" |

A record is still a **check-in** with no set rhythm. The menu row is still **Check-in**.

## 1. Data, actions and who may (R1)

### 1.1 The rhythm

```ts
// src/domain/types.ts, on Cycle, beside reviewDay
/** Weeks between the check-ins every goal is expected to have: 1 (every week) when absent; 0 = no set rhythm.
    2 and 4 are valid stored values kept for FT4; FT1's screens offer 1 and 0. */
checkInWeeks?: number;
/** The day (yyyy-mm-dd) the present rhythm began. Nothing is due or late for a time before it. The cycle's start when absent. */
rhythmFrom?: string;
```

- `reviewDay` keeps its name and column. Its comment becomes: "The weekday check-ins are due by, 0 = Monday (named for the weekly review it was first tied to). Unused when `checkInWeeks` is 0."
- `src/data/rows.ts`: `cycleToRow` writes `check_in_weeks` and `rhythm_from` only when set; `cycleFromRow` reads `Number(r.check_in_weeks ?? 1)` and leaves `checkInWeeks` off the object when it is 1 (so every stored example and conformance fixture is unchanged), and `rhythmFrom` when not null. Both adapters and the browser store carry the cycle whole already.
- `startNextCycle` (`src/domain/actions.ts:309`, `year.ts`) copies `checkInWeeks` to the new cycle and sets `rhythmFrom` to its start.

**Helpers** (`src/domain/thresholds.ts`; pure, take what they read):

```ts
RULES.staleCheckIns = 2                      // replaces RULES.staleDays: 14
type Rhythm = { weeks: number; dueDay: number; from: string } | null
rhythmOf(cycle: Pick<Cycle, 'checkInWeeks' | 'reviewDay' | 'rhythmFrom' | 'startDate'>): Rhythm   // null when checkInWeeks === 0
staleAfterDays(cycle): number | null         // RULES.staleCheckIns × 7 × weeks; null with no rhythm
```

`RULES.staleDays` stays exported as a deprecated alias of `staleAfterDays` for a weekly cycle (14) until the vocabulary and spec pages are moved to the helper, then goes.

**The action** (`src/domain/actions.ts`, and a row in `src/app/actions.ts` and R1's access table; `actions.test.ts` holds the two together):

```ts
setRhythm(x: ActionContext, cycle: Cycle, to: { weeks: number; dueDay?: number }): Commit | null
```

| Rule | Words when refused |
|---|---|
| Admins only | "Only admins can change the check-in rhythm." |
| `weeks` is 0 or 1 (FT1) | "Faro checks in every week, or on no set rhythm." |
| `dueDay` 0–6, used only when `weeks > 0` | "Choose a day of the week." |
| The running cycle only | "That year is over; its rhythm can’t change." |
| Nothing changed | returns `null` (as `setModule`) |

- The commit is `{ cycles: [after], changes: [one] }`. `after.rhythmFrom` is today's date **when the rhythm goes from none to some**; unchanged otherwise (changing only the due day does not restart it).
- The change: entity `workspace`, action `edited`, summary one of "Changed the check-in rhythm from every week to no set rhythm", "… from no set rhythm to every week, due by Thursday", "Changed the day check-ins are due by from Thursday to Friday"; one diff, field "Check-in rhythm", from and to in the same words.
- Undo (from the toast, and from Activity as for any change) restores the cycle as it was, `rhythmFrom` included.

### 1.2 Reviews

- **FT2:** `src/modules/reviews/module.json`: id `reviews`, name "Reviews", summary "Walk a set of goals together on a cadence, decide what happens next and keep what was said.", `needs: []`, the seven routes, navigation `["Reviews"]`, `tables: [{ name: "okr_reviews", migration: "0006_owners_levels_watching_reviews.sql", purpose: "Each review: its cadence, scope and people" }]`, `aiTools` (the six in section 6), `help: ["reviews"]`, `requirements` (the six `REVIEW…` ids), `journeys` (U3, U13, U30, U36, U47, U49, U63, U67, U79, U80 and N-checks in `evals/notes/1-reviews.cjs`), `elsewhere` (every core file that still holds its code: generate the list with the search in README 1.3 and keep it exact; the manifest test checks each exists), and `rebuild: { status: "outline", … }`.
- Switched by `setModule` (exists: admins only, "Only admins can switch features on or off.", logged "Switched off Reviews").
- **One answer, in one place.** `src/app/reads.ts` gains `reviewsOn(modulesOn: Set<string>): boolean`. Screens get it from `useModules()`; rules that need it take `reviews: boolean` as a parameter. No file tests the string `'reviews'` but that one. (This is the debt `elsewhere` declares; FT3 removes it.)
- With Reviews off, the core's review actions refuse as a module's tools do: `reviewCall`, `markReviewed`, `saveReview`, `newReview`, `endReview`, `deleteReview` → "Reviews is off in {workspace}."

### 1.3 Who sees and does what

| | Admin | Everyone else |
|---|---|---|
| Workspace → Features | Sees it; changes both | Not in their menu (as today, `sectionsFor`) |
| The rhythm, to read | Features, and a line on Cycles | The line on Cycles: "Check-ins: every week, due by Thursday." or "Check-ins: no set rhythm." |
| Enforced by | `setModule`, `setRhythm` (both refuse a non-admin; the screen not offering it is not the rule) | |

## 2. Rules in `src/domain` that change

No signature changes: every rule below already takes the cycle. Each worked example becomes a unit test and, where marked ◆, a conformance row or a `rules.ts` example.

Examples use the spec's cycle (`src/spec/examples.ts`): starts Mon 7 Sept 2026, 13 weeks, due day Thursday. Week 4 starts Mon 5 Oct.

### 2.1 `daysWithoutUpdate` and `goalStatus` (`status.ts`)

```
daysWithoutUpdate(goal, cycle, latest, today):
  since = the latest of: latest.postedAt (if any); the goal's start (as today); rhythmOf(cycle)?.from
  return days from since to today

goalStatus, step 4 becomes:
  after = staleAfterDays(cycle)
  if after == null or quiet < after: status = latest ? latest.status : 'none'
  else: status = 'stale'
```

`GoalStatus` gains `asOfWeek: number | null`: the latest check-in's week when it is not `week`, else null. It is worked out whatever the rhythm; screens show it only with no set rhythm (with one, "No recent update" does that job).

| Given | Every week | No set rhythm |
|---|---|---|
| ◆ Latest check-in on track, posted Mon 14 Sept (week 1). Today Thu 8 Oct (week 4): 24 days | `stale` | `on`, `asOfWeek` 1 |
| ◆ No check-in at all; the goal began with the cycle. Today Thu 8 Oct | `stale` | `none` |
| ◆ Latest check-in off track, posted Mon 5 Oct. Today Thu 8 Oct | `off` | `off`, `asOfWeek` null |
| ◆ The first row, but the rhythm was switched on on Mon 5 Oct (`rhythmFrom`). Today Thu 8 Oct: 3 days from the 5th | `on`, `asOfWeek` 1 | |
| ◆ The same, on Mon 19 Oct: 14 days from the 5th | `stale` | |
| Week 0; done | `planned`; `done` (unchanged) | the same |

`projects(goal, status)` is unchanged: with no set rhythm `status` is never `stale`, so it projects.

### 2.2 `flagsFor` (`attention.ts`)

- `stale` is raised only when the status is `stale`: so never with no set rhythm. No code change beyond 2.1.
- `due` is raised only when `rhythmOf(cycle)` is not null, and its sentence becomes **"Due by Thu 8 Oct."** (`dayText(reviewDate(cycle, week))`), whatever Reviews is.
- `firstDueWeek(goal, cycle)` (`progress.ts`): the later of today's answer and `firstWeekFrom(cycle, rhythm.from, dueDay)`. With no set rhythm it is not called; it returns `Infinity` if it is.
- `WEIGHT`, `ATTENTION_FLAGS`, `handledFor`, `needsAttention`: unchanged.
- `lookedAtFor(…, opts?: { link: boolean })`: the text is unchanged ("Looked at by Amara in Platform leadership weekly, week 4"); `reviewId` is returned null when Reviews is off, so nothing links to it.

| Given (week 4, Thu 8 Oct) | Every week | No set rhythm |
|---|---|---|
| ◆ On track at week 3, no check-in for week 4 | `due` | (none) |
| ◆ At risk at week 1, nothing since, no path to green | `stale`, `due` | `no-path`, `risk` |
| ◆ Off track at week 3; said back on plan by week 3 | `off`, `missed-path`, `due` | `off`, `missed-path` |
| ◆ Off track at week 4; the lead agreed a next step due week 6 | being handled | being handled |

The second row is the important one: with no set rhythm the goal is judged by what it last said, so its real flags come back.

### 2.3 `progress.ts`

- `weekProgress`: with no set rhythm, `due` and `upcoming` are empty; `goals` and `done` as today ("done" is "checked in this week").
- `weekDoneText`: with no set rhythm, "{done} of {total} have a check-in for week {w}." No "still due", no "after the review day". With a rhythm, "after the review day" becomes "after Thursday".
- `onTimeStreak`: null with no set rhythm (`Dashboard.streak` is already `number | null`). With one, it never counts a week before `firstWeekFrom(cycle, rhythm.from)`.
- `reviewDate` is renamed `dueDate` (an alias stays for one release); `daysToReview` → `daysToDue`; `firstReview` → `firstDue`. They return null with no set rhythm.
- `firstReports`: `due` is null with no set rhythm; the count and the people are unchanged.
- New: `checkInList(personId, goals, checkIns, week): { waiting: Row[]; thisWeek: Row[] }`, each row `{ goalId, lastWeek: number | null, lastPostedAt: string | null }`, `waiting` oldest first with never-checked-in goals first, done and stopped goals left out. It is NV3's list (`docs/design/navigation/spec.md`) without its due group; if NV3 has landed, extend its rule and do not write a second.

| Given | Then |
|---|---|
| ◆ Rhea owns 8 goals, 1 done, 2 checked in for week 46, 1 never. No set rhythm | `waiting` 5, the never-checked-in one first; `thisWeek` 2 |
| ◆ Tunde, every week, all in by Thursday for 5 weeks; the rhythm was switched on 2 weeks ago | streak 2 |

### 2.4 `home.ts`, `dayOne.ts`

- `dashboard(…, opts: { reviews: boolean })`: `next` is null and `missed` empty when Reviews is off; `streak` null with no set rhythm. With FT3 the two review fields leave `Dashboard` for the module.
- `gettingStarted(…, due: string | null)`: with null, the row says "Post your first check-in, so everyone can see where it starts." (plural: "Post your first check-ins, so everyone can see where each starts.").

### 2.5 `goalPage.ts`, `story.ts`, `scorecard.ts`, `summaryFacts.ts`, `summary.ts`

- `primaryAction`: `ask-update` stays the primary only when the status is `stale` (so only with a rhythm). New field on the page's reads, `canAskUpdate`: not the owner, the goal live, the latest check-in not this week's, no update ask open. With no set rhythm the screen shows it as an ordinary button.
- `goalHistory`: "Week 45 · No check-in" entries are made only for weeks from `firstWeekFrom(cycle, rhythm.from)` on, and not at all with no set rhythm.
- `scorecard` and `summaryFacts` take `stale` as today; callers pass `status === 'stale'`, which is now never true with no set rhythm. The hit cell's sub-line gains, when `asOfWeek` is not null and there is no set rhythm: "on the pace to week {asOfWeek}".
- `GoalSummary` gains `asOfWeek`. `quietDays` is unchanged (a fact).

| Given (Julia's goal: 4.0 days at week 44, on track; today week 46) | Every week | No set rhythm |
|---|---|---|
| ◆ Status line | No recent update | On track · as of week 44 |
| ◆ "Will it hit 3.0?" | Can’t say · no recent update to go on | (the projection's word) · on the pace to week 44 |
| History, weeks 45 and 46 | "Week 46 · No check-in", "Week 45 · No check-in" | no rows |
| Primary action, as Amara | Ask Julia for an update | none; "Ask Julia for an update" is an ordinary button |

### 2.6 `query.ts`, `goalsPage.ts`, `order.ts`, `map.ts`, `export.ts`, `importer.ts`

- `STATUS_OPTIONS` becomes `statusOptions(cycle)`: without `stale` when there is no set rhythm. A link carrying `status=stale` then matches nothing and the filter line says "No recent update isn’t used here: there is no set check-in rhythm. Clear".
- `quiet` (the filter) is unchanged in the address; its label becomes "Last check-in: {n} weeks ago or more" in both modes (today "No update for {n}+ weeks").
- `goalsLine` and the count line never name a status with no goals, so "no recent update" drops out by itself; check the "(3 with no recent update)" bracket is skipped at zero.
- `order.ts`, `map.ts`, `worst`: no change.
- `export.ts`: the README sheet's list of status words leaves out "No recent update" when the workspace has no set rhythm, and says "Check-in rhythm: none. A status is the latest check-in’s." The Goals sheet gains nothing; `days_without_update` stays. Round trip is unaffected: status is worked out.
- `importer.ts` `buildWorkspace({ …, checkInWeeks?: number, weeklyReview?: boolean })`: sets the cycle's `checkInWeeks`; makes "Weekly review" only when `weeklyReview` (default true until set-up asks); pins "No update for 2 weeks or more" only with a rhythm.

### 2.7 `vocabulary.ts`

- `STATUS.stale`: short "no check-in for two check-ins’ time", meaning "No check-in for {staleAfterDays} days or more…" worked out per cycle where it is shown (`meaningFor(cycle)`); in the generated spec: "two missed check-ins: 14 days when check-ins are every week. Never used when there is no set rhythm."
- `STATUS.none.long` loses its second sentence with no set rhythm.
- `FLAG.due`: long "The goal has no check-in for this week yet and the due day hasn’t passed…". No mention of the review.
- `ASK.action.long`: "Something to do, for someone, by a week." ("agreed in a review" goes: it is agreed anywhere.)
- New term `asOf`: label "as of week {n}", meaning "The week a goal’s status and numbers are from, said when it isn’t this week and there is no set check-in rhythm."

### 2.8 Reviews' rules (FT2)

- `src/domain/watch.ts` (new) takes `treeOf`, `goalsIn`, `watchScope`, `watchedGoals`, `watchOf`, `coveringWatches`; `dayText` goes to `format.ts`. `review.ts` re-exports them for one release. `[no news]`.
- `workspaceNeeds(…, opts: { reviews: boolean })`: `no-review` only when true.
- `asksOnGoal`, `stepsAndAsks` (`goalPage.ts:191–239`): given `reviews: []` when Reviews is off, so "in {review}" and "Before its next session…" are not said. The ask and its state are unchanged.
- `lastTalked`: not called when off.
- `removal.ts` (`leaving`): still takes a leaver out of reviews when off (the records are kept true for when it comes back).

## 3. Routes and redirects

| Address | Reviews off | No set rhythm |
|---|---|---|
| `/reviews`, `/reviews/new`, `/reviews/:id`, `/reviews/:id/edit`, `/reviews/:id/summary`, `/reviews/:id/print`, `/review` | The not-found page, with the line below | unchanged |
| `/goals/:id?review=:id` | The goal's page; the parameter is dropped | unchanged |
| `/check-in` | unchanged | "Check in on a goal" (4.6). `/check-in/:goalId` is unchanged |
| `/quick-check-in` | unchanged | Lists every live goal you own (not "the due ones") |
| `/goals?status=stale` | unchanged | The list, empty, with the sentence in 2.6 |
| `/help/reviews` | Hidden from Help (as for any module); the address says the line below | unchanged |

**A switched-off module's address** (generic, in `src/App.tsx`'s not-found route; N21): when the path matches a route in the `module.json` of a module that is installed and off, the not-found page's title and first line stay ("Page not found", "There’s nothing at this address") and a second line is added: "**{Name} is switched off in {workspace}.** An admin can switch it on in Workspace, Features." For an admin, "Workspace, Features" is a link. In a build without the module (`FARO_WITHOUT`), the plain page.

## 4. Screens

Off means absent: no empty block, no greyed control, no sentence about what is not there, except the address case above and the read-back.

### 4.1 Workspace → Features (`/workspace/features`, admins). Wireframe 1

In order:

1. Heading "Features". Under it: "How {workspace} works, and the optional parts of Faro. They apply to everyone here."
2. Group **"How you work"**, a list of two rows:
   - **Check-in rhythm.** One line: "Every week, due by {Thursday}. A goal with no check-in for 14 days reads “No recent update”." or "No set rhythm. Owners check in when there’s news; nothing is due or late for want of a check-in." At the right, a button **Change**.
   - **Reviews** (only when the module is installed). Its summary, then, when on and any exist, "{n} reviews are set up." At the right the switch and its word, "On" or "Off".
3. Group **"Tools"**: every other installed module, as today (name, summary, switch and word; "Off until {X} is on.").
4. Under the lists: "Switching one off hides it and keeps what it saved. About features" (the link as today).

With no modules installed: group 2 has the rhythm row only and group 3 is not drawn.
The section's summary in Workspace's menu (`Workspace.tsx:40`) becomes: "How this workspace works, and the optional parts of Faro."
About's fact line: "Check-ins every week, due by Thursday. Reviews, Metric library and Spreadsheets are on. Features".

One primary action: none on this page until a sheet is open.

### 4.2 The read-back. Wireframe 2

**A module that owns records** (it lists `tables`; Reviews, Metric library) asks before it is switched **off**. One without (Spreadsheets) acts at once, as today. Switching **on** acts at once for all.

Reviews, a sheet over the page:

- Title: "Switch off Reviews in {workspace}?"
- "For all {n} people here:"
- Lines, each only when its count is above zero:
  - "**Reviews leaves the menu**, and Home’s “Next review”."
  - "**{n} reviews stay in the record**, with the {n} things said or marked in them. Each goal’s History still shows them."
  - "**{n} open next steps agreed in a review stay open** on their goals and on Home."
  - "**{n} questions waiting for a review** stay open; they no longer name a session."
  - "Nothing is deleted. Switch Reviews back on and every review is as it was."
- Buttons: "Cancel", **"Switch off Reviews"** (primary). Escape and Cancel change nothing.
- After: toast "Reviews is off in {workspace}. Nothing it saved is lost." with **Undo** (as today's). Undo: "Reviews is back on."

The counts come from a pure rule, `switchOffReadBack(moduleId, reads)`, in the module's folder with FT3 and in `src/domain/review.ts` until then: reviews not removed or ended; changes with entity `review` or `decision` (the number Activity shows under Reviews); open asks of kind `action` with a `reviewId`; open asks of kind `question` with a `reviewId`.

The rhythm, the sheet behind **Change**:

- Title: "Check-in rhythm".
- Two choices (radio rows, the whole row outlined when chosen):
  - **Every week**: "Check-ins are due by a day you choose. A goal with none for 14 days reads “No recent update”." With it, under the choices: "Due by" and a select of the seven days.
  - **No set rhythm**: "Owners check in when there’s news. Nothing is due or late for want of a check-in."
- "What changes for everyone here", shown once the choice differs from what is saved.
  - To no set rhythm:
    - "**{n} goals have nothing due.** Home and Check-in stop counting what’s due, and on-time streaks stop."
    - "**{n} goals stop reading “No recent update”.** Each shows its last check-in’s status and the week it is from: {3 on track, 1 at risk, 1 off track}." (omitted at zero; a goal with no check-in at all is counted as "{n} with no check-in yet")
    - "**Nothing is flagged for going quiet.** Goals’ “Last check-in” filter still finds them."
    - "Dates people chose stay: stage dates, next steps’ weeks and “back on plan by”."
    - "Every check-in already posted stays as it is."
  - To every week:
    - "**Check-ins are due by {Thursday}**, the first by {Thu 12 Nov}."
    - "**Nothing is late today.** A goal reads “No recent update” after 14 days without a check-in, counted from today."
    - "Streaks start from this week."
  - Only the day: "Check-ins are due by {Friday} from this week. Streaks count the new day from this week."
- Buttons: "Cancel", **"Save"** (primary; disabled until something differs).
- After: toast "Check-ins have no set rhythm now." / "Check-ins are due every week, by Thursday." / "Check-ins are due by Friday now.", each with **Undo**.

The counts come from `rhythmReadBack(goals as summaries, cycle, to, today)` in `src/domain/status.ts`: it runs `goalStatus` for each live goal under the cycle as it is and as it would be, and tallies. It takes summaries and check-ins, not the whole workspace (AR4).

### 4.3 Cycles (`/workspace/cycles`)

The running cycle's row gains one line: "Check-ins: every week, due by Thursday." or "Check-ins: no set rhythm." For an admin it ends with the link "Change", to Features.

### 4.4 Home. Wireframe 3

| Part (in order) | Every week, Reviews on (today) | No set rhythm | Reviews off |
|---|---|---|---|
| Strip: goals by status | As today | No "no recent update" count | As today |
| Strip: On-time streak | As today | Not there | As today |
| Strip: Next review / Not held yet | As today | As today | Not there |
| Owner's lead | "Check-ins are due by Thursday, tomorrow" · "5 check-ins to do" · **Start check-in** | "Your goals" · "{n} have a check-in this week." (and, when one never has: "{Title} has none yet.") · **Check in on a goal** → `/check-in`. When every live goal has one this week: "All {n} have a check-in this week." and no button | As today |
| Leader's lead (owns no goal, in a review) | "{Review}" · "20 goals to discuss" · **Open the review** | As today | "Goals you watch" · "20 need attention" · **See them** → `/goals?show=watching&attention=1`. Watching nothing: no lead; Home starts at "Needs your response" |
| "You’re all set for week 46" | As today, with the streak | Not there (nothing was owed) | As today; "Anyone reviewing it sees it as you wrote it." becomes "Anyone reading it sees it as you wrote it." |
| Needs your response | As today | As today | A question says "{Daniel} asked 8 days ago." A next step says "You agreed it on 22 Oct. Due week 47 (16–22 Nov)." |
| Your goals: a row's button | "Check in" when due | "Check in" on every live row that has none this week (an ordinary button) | As today |
| "124 of 126 goals have had their first check-in…" | "…this week’s are due Thu 12 Nov." | Ends at "…nobody has reported. Waiting on Astrid and Rhea." | As today |
| Goals you watch | "5 need attention (1 with no recent update)" | "5 need attention"; a row not from this week says "as of week 40" where today it says so | As today |
| Getting started | "It’s due by Thursday." | 2.4's sentence | As today |

The strip is a grid of as many cells as it has: three, two or one. With one, it is full width. One primary action per Home in every column of the table.

### 4.5 Goals. Wireframe 5

- Filters, Status: without "No recent update" when there is no set rhythm.
- Filters, **Last check-in**: "Any time", "2 weeks ago or more", "4 weeks ago or more", "8 weeks ago or more" (the `quiet` values 2, 4, 8), in both modes. It replaces "No update for…" in the filter sheet and in the filter line ("Last check-in 2 weeks ago or more").
- Sort: "Longest since a check-in" stays.
- The count line and the Needs attention line: as 2.6.
- A row, with no set rhythm and `asOfWeek` not null: under the status, in the hint style, "as of week 40". On the Board and Table, the same words in the status cell. Not shown with a rhythm.
- Saved views that carry `status=stale` keep working with a rhythm; with none, 2.6's sentence.
- Reviews off: nothing on Goals changes (no part of it names a review).

### 4.6 Check-in (`/check-in`) with no set rhythm. Wireframe 6

- Title "Check in on a goal". Under it: "Week {w}. Check in when there’s news; nothing is due."
- One list, two groups from `checkInList`:
  - "No check-in this week · {n}": status (shape and word), title, "Last check-in week 45 · {value}" or "No check-in yet"; button "Check in" or "Post the first check-in".
  - "Checked in this week · {n}": "Checked in Mon 9 Nov · {value}"; button "Check in again".
- Under it: "Or type all your numbers in one table" (when two or more number goals).
- No primary button. Each row's button is at least 44 px on touch.
- Owns no live goal: "You don’t own any goals this year." (as today).
- After posting one: back to this list, with a toast "Checked in on {title} for week {w}." No "x of y", no streak.
- With a rhythm, `/check-in` is as today (or NV3's list when that lands).

### 4.7 A goal's page. Wireframe 4

| Part | No set rhythm | Reviews off |
|---|---|---|
| Status line | "{status} · as of week 44 · last check-in 28 Oct" when not this week's; otherwise as today | As today |
| Scorecard | 2.5 | As today |
| "Why it has no recent update" | Not there; "Why" shows the last reason, labelled "Julia said in week 44" | As today |
| Chart | "No projection: the last check-in is too old to project from." is not said; the projection is drawn from the last number | As today |
| Buttons | Owner: "Check in for week 46" is an ordinary button, not primary, unless there has never been one ("Post the first check-in" stays primary). Others: "Ask {Julia} for an update" as an ordinary button, when `canAskUpdate` | As today |
| Next steps and asks | As today | No "in {review}", no "Before its next session" |
| Last time we talked | As today | Not there |
| History | No "No check-in" rows; "Every check-in, what was said, and what changed, newest first." | The Reviews tab shows only when it has entries; entries keep their words and are not links |
| The review walk (`?review=`) | As today | Not there |

### 4.8 The menu and the phone

- Check-in: no count with no set rhythm (`count('checkin')` is 0). The row's rule is unchanged: for someone with a live goal.
- Reviews: no row when off. `menuFor` and `tabsFor` (`src/domain/navigation.ts:40`, `:49`) take `reviews: boolean`; phone tabs become Home, Check-in, Goals, People, More for an owner, and Home, Goals, People, Activity, More otherwise. ◆ Two `navigation.csv` rows.
- Find: no "Reviews" group when off.

### 4.9 Activity, People, Watching, Print, Settings, Help

- **Activity:** the "Reviews" filter shows while its count is above zero, whatever the switch. Entries are unchanged. The rhythm change is an entry under "People and admins" (where feature switches are).
- **People:** a person's page lists the reviews they are in only when on.
- **Watching:** a row says "as of week 40" as on Goals. Nothing else changes; nothing on it is a review's.
- **Print:** a goal's one-pager drops "Next: {review}, Thu 12 Nov" when off. With no set rhythm it prints the status with "as of week 44".
- **Settings:** nothing (no setting is about either).
- **Help:** as section 8.

### 4.10 Set-up's step (for the set-up area to place). Wireframe 7

Heading "How will you keep goals up to date?"

1. **"How often do owners check in?"**
   - **Every week** (chosen): "Each owner posts a number and a sentence for each goal, by a day you choose. A goal with none for two weeks says so." With it: "Due by" and the day (Thursday).
   - **No set rhythm**: "Owners check in when there’s news. Nothing is due or late for want of a check-in."
2. **"Will you go through the goals together?"** (only when the module is installed)
   - **Yes, in a weekly review** (chosen): "Everyone, every goal, on {Thursdays}. You can change who and when, or add more reviews, later."
   - **Not in Faro**: "Reviews stays off. An admin can switch it on later, in Workspace, Features."

What each writes into the last step's read-back:

| Answer | Sentence |
|---|---|
| Every week | "**Check-ins** Every week, due by Thursday. The first are due by Thu 12 Nov." |
| No set rhythm | "**Check-ins** Whenever there’s news. Nothing is due or late." |
| Yes, in a weekly review | "**Reviews** A weekly review for everyone, every goal, on Thursdays. The first is on Thu 12 Nov." |
| Not in Faro | "**Reviews** Off. An admin can switch them on in Workspace, Features." |

With no set rhythm and a weekly review, the review's day is asked in question 2 ("on" and the day), since there is no due day to borrow.

**A new goal's read-back** (goal entry): with a rhythm, "Its first check-in is due by {Thu 12 Nov}."; with none, "Check in when there’s news. Nothing is due."; and, only when Reviews is on and a review's scope covers the goal, "It will be in {Weekly review} on {Thu 12 Nov}."

## 5. Extension points

| Item | Addition | Typed in |
|---|---|---|
| FT2 | None to the contract. The generic "switched off" line at a module's address; the read-back for a module with `tables` | `src/App.tsx`, `Workspace.tsx` |
| FT3 | `ModuleNav.count?(reads): number` | `src/core/app.tsx` |
| FT3 | Place `home.lead` (given the viewer; the first module with something to show wins, else the core's lead) | `PLACES`, `PlaceProps` |
| FT3 | Place `home.glance` (a cell in Home's strip) | `PLACES`, `PlaceProps` |
| FT3 | Records: "what a new workspace starts with" (`seed`), added to AS part 2's records contract | `records.ts` |
| FT3 | `tabsFor`: a `work`-group module item takes the next tab after Goals | `src/domain/navigation.ts` |

Not added, on purpose: flags, "handled" or "looked at" contributed by a module; a module's Activity kind; a place for a walk on the goal page (README 3.1).

## 6. AI tools (MCP)

| Tool | Reviews off | No set rhythm |
|---|---|---|
| `list_reviews`, `get_review`, `review_call`, `save_review`, `end_review`, `delete_review` | Refused by `callTool` as for any module's tool: "Reviews is off in {workspace}. An admin can switch it on with set_feature." | unchanged |
| `edit_call` | Works for an ask's words; for a review note: the line above | unchanged |
| `ask_question` | Its description loses "In a review, use review_call…" | unchanged |
| `add_action` | Description: "Agree a next step on a goal…" (no "outside a review") | unchanged |
| `get_my_work` | No `reviews`, no `nextReview` | `checkInsDue` is `[]` and gains `"rhythm": "none"`; no `streak`; the text says "No set check-in rhythm: nothing is due." and lists `noCheckInThisWeek` |
| `get_goal`, `find_goals` | unchanged | Status never `stale`; each goal gains `asOfWeek`; `find_goals`' status choices leave out `stale`, and asking for it answers "No recent update isn’t used here: there is no set check-in rhythm." |
| `ask_for_update`, `undo_update_ask` | unchanged | unchanged |
| `describe_system`, `get_overview` | Reviews not listed among what is on | Says "Check-in rhythm: none" or "every week, due by Thursday" |
| `set_feature` | Works for `reviews` (it is generic) | |
| **New: `set_rhythm`** `{ every: "week" | "none", due_by?: weekday, confirm?: boolean }` | | Admins only. Without `confirm`, returns the read-back of 4.2 as text and changes nothing; with it, runs `setRhythm`. Add its row to `src/mcp/parity.ts` |

Run `npm run build:mcp` and commit `api/mcp.js`.

## 7. The migration

One file, `supabase/migrations/0038_check_in_rhythm.sql` (or the next number), for FT1. FT2 needs none.

```sql
-- The check-in rhythm (backlog FT1, docs/design/feature-toggles): how often every goal is expected to have a check-in,
-- kept on the cycle beside the day they are due by (review_day). 1 = every week (the default: nothing changes for any
-- existing cycle); 0 = no set rhythm; 2 and 4 are allowed for later. rhythm_from is the day the present rhythm began
-- (null: the cycle's start): nothing is due or late for a time before it.
-- Runs as faro_owner with search_path faro (supabase/README.md). No new table or function, so no grant: a column takes
-- its table's grants and row rules. okr_write is not touched: okr_upsert writes whichever columns a saved row carries.
-- Safe to run twice.

alter table okr_cycles add column if not exists check_in_weeks smallint not null default 1;
alter table okr_cycles add column if not exists rhythm_from date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'okr_cycles_check_in_weeks_ok' and conrelid = 'okr_cycles'::regclass) then
    alter table okr_cycles add constraint okr_cycles_check_in_weeks_ok check (check_in_weeks in (0, 1, 2, 4));
  end if;
end $$;
```

The build session checks before it writes code:

1. `okr_upsert` still takes its columns from the rows it is given (migration 0011, lines 24–38) and no later migration narrowed it for `okr_cycles`.
2. `okr_create_workspace` passes the cycle's row through the same way (so a workspace set up with no rhythm is saved in one go). If it names columns, set-up saves `setRhythm` as a second commit and says so in the PR.
3. The redirects in `public` are fixed `select *` views (0035): the new columns are seen only through `faro`. The handover says the Data API offers `faro`; confirm with a read of a cycle's `check_in_weeks` from the app's client before merging, and reload the Data API's schema cache if it is not seen.
4. The plain-Postgres adapter (`src/adapters/postgres/`) and PGlite contract tests run the same migration; add "a cycle's rhythm is kept whole" to `storeContract`.

Put the SQL in the PR description. Merging applies it.

## 8. Help, What's new, the spec

- **What's new** (top of `src/help/whatsNew.ts`), one entry per item:
  - FT1: "Check-ins can have no set rhythm. An admin chooses on Workspace, Features: every week, or no set rhythm. With none, nothing is due or late, and each goal says which week its status is from."
  - FT2: "Reviews can be switched off for a workspace, on Workspace, Features. What was said in reviews stays in each goal’s history."
- **Guide** (`src/help/guide.ts`):
  - "features": the two groups; what each switch does and keeps; who may; that the rhythm and Reviews say what will change before they do.
  - "check-in": a section "With no set rhythm" (the list, "as of week", nothing due).
  - "home", "goals", "goal": one paragraph each on what is not there, written as what is there.
  - "reviews": moves to the module's `help.ts` with FT3; with FT2 it is hidden when off by the same rule (give the article `module: 'reviews'` until it moves).
  - The topic "Reviews and the year" becomes "The year" when Reviews is off.
- **The spec** (`npm run spec`, never by hand): `src/spec/rules.ts` gains the examples marked ◆ under `status`, `flags`, `weeks-and-plans`, `scorecard`, `navigation`; `src/spec/conformance.ts` writes `spec/conformance/no-rhythm/{status,flags,scorecard,projection}.csv` from the same workspace with `checkInWeeks: 0`, and leaves the existing files byte for byte; `src/spec/build.ts`'s numbers table says `RULES.staleCheckIns` 2 and "× 7 × the cycle's check-in weeks"; `llms.txt` line 10 says "No recent update (only with a check-in rhythm)".
- **The rebuild kit:** `stage-1-core-rules.md` gains "the rhythm is a field of the cycle; score both conformance sets"; `scripts/drill-faro` must score 100% on both; `src/modules/reviews/module.json`'s `rebuild` writes `spec/rebuild/stage-6-module-reviews.md` (outline with FT2; a drill with FT3). `ports-at-scale.md`: the summary row's status is worked out with the unit's rhythm.

## 9. Evals

**Requirements** (`evals/requirements.json`):

- `RHYTHM-OPTIONAL`: "An admin chooses the check-in rhythm for a workspace: every week, or none. With none, nothing is due or late for want of a check-in, no goal reads No recent update, and a status that isn’t this week’s says which week it is from. Dates people set still count. The change says what it will do first, is logged, and can be undone."
- `REVIEWS-OPTIONAL`: "An admin switches Reviews off for a workspace. Off, there is no Reviews in the menu, on Home, on a goal or in the AI’s tools; asks and next steps are unchanged; what was said in reviews stays in history. Nothing is deleted, and switching it on restores it."

**Journeys** (phone and desktop, in the demo, as the person named):

| | Journey | Passes when |
|---|---|---|
| U101 | Amara sets the rhythm to none | Features → Change → "No set rhythm": the read-back's counts equal the list's before and after (the five goals; 126); Save; Home has no streak cell and no "due"; Goals' count line has no "no recent update"; Julia's goal reads "On track · as of week 44"; Activity has the entry; Undo restores every one |
| U102 | Rhea checks in with nothing due | Menu "Check-in" with no count → "Check in on a goal" lists 5 and 2 → check in on one → it moves to "Checked in this week"; no "x of y", no streak anywhere |
| U103 | Amara switches Reviews off | The read-back names 6 reviews; after: no Reviews row or tab, Home's lead is "20 need attention · See them", `/reviews` says "Reviews is switched off in…", a goal's History still shows "looked at it in Platform leadership weekly", the open next step is still on Home without "in {review}"; Undo restores |
| U104 | Both off, then both on | Home is 4.4's last column; switching the rhythm back on makes nothing late that day (no "No recent update", "the first by Thu 12 Nov"); Reviews back on shows six reviews as before, none "Not held yet" for a date passed while off |

**Checks:**

- **F20** (finish): with no set rhythm, on every route at both widths, none of these strings appears: "No recent update", "due by", "to do", "streak", "on time", "No check-in" as a History row, "Can’t say". With Reviews off: no "review" in any menu, button or heading outside History and Activity entries.
- **N21** (notes): the switched-off address line for each installed module's routes; a non-admin's `setRhythm` and `setModule` are refused with their words; the read-back's counts match `rhythmReadBack` and `switchOffReadBack`.
- **P3/P4/P6** unchanged: every shape still has its word; "as of week 44" is text, not a badge.

**CI:**

- "Core journeys without reviews": comes with the folder (FT2). The smoke gate must pass with `FARO_WITHOUT=reviews`; the demo script's step 5 is among the journeys left out.
- New job "Core journeys with no rhythm": `FARO_DEMO_RHYTHM=0` makes the example's cycle `checkInWeeks: 0`; the smoke gate runs without the journeys listed in a new `rhythm` array in `evals/touches.cjs` (U1, U2, U8, U19, U33, U38 and the rhythm halves of U3, U49, U63, U80, which split).
- `src/spec/conformance.test.ts` recomputes both sets.
- Unit tests: each table in section 2; `setRhythm`'s five refusals; `rows.ts` round trip of a cycle with and without the fields.

## 10. If Lane decides otherwise

| Decision | Then |
|---|---|
| Reviews only (README decision 1b) | Build FT2 and the "Due by Thu" wording; drop FT1, U101, U102, the migration and `RHYTHM-OPTIONAL` |
| Neither | Add two lines to R-requirements for the internal app ("the rhythm is a field of the unit; reviews are a module") and build only the wording fix and `watch.ts` |
| A plain on/off (2b) | The same build; the column is `boolean`-shaped in words only: keep the integer, offer no more values, drop FT4 |
| All four values now (2c) | FT1 grows by FT4: periods of N weeks from `rhythmFrom`'s week; `due` is "no check-in in this period"; a streak counts periods; History's gaps are per period; Home says "due by Thu 19 Nov". Add ◆ examples at 2 |
| Last status with nothing beside it (3b) | Drop `asOfWeek` from screens (keep it in the tools and exports). The read-back must then say "A status may be months old and will not say so." |
| Keep a grey "No recent update" on an admin's number (3c) | That is a rhythm with no due day: store it as `checkInWeeks` and hide the due day, the streak and the queue. Not recommended |
| Kept on `Workspace`, not the cycle | Field `Workspace.checkInWeeks`; migration replaces `okr_write` whole (start from 0033's, add the `workspace_check_in_weeks` branch, and state `set search_path = faro, pg_temp` on it); about 25 rule signatures gain a `rhythm` parameter, fed by `src/app/reads.ts`. Roughly a third more work in FT1 |
| Act at once with Undo (5b) | Drop the two sheets for switching off; the rhythm still needs its sheet to choose a value, without "What changes" |
| Only the real move (4b) | Drop FT2's manifest-with-`elsewhere`; Reviews has no switch until FT3 |

## 11. Build plan

| Item | What | Effort | Depends on |
|---|---|---|---|
| **FT2** | Reviews behind its switch: `src/modules/reviews/module.json` with `elsewhere`; `reviewsOn` in `reads.ts`; every "Reviews off" cell of sections 3, 4 and 6; the read-back for modules with tables; the switched-off address line; `watch.ts`; "Due by Thu" for `due`; U103, half of U104, N21, `REVIEWS-OPTIONAL`; Help and What's new; the spec and an outline stage | S–M | AR2, AR3 (merged). After track 1's GL2 and FS4 and track 2's goal-page items have left Home, Goals and the goal page (held until 12 Nov in `docs/handover.md`) |
| **FT1** | The rhythm: section 1.1, all of section 2, the migration, every "No set rhythm" cell of sections 4 and 6, `set_rhythm`, both conformance sets, the CI job, U101, U102, the rest of U104, F20, `RHYTHM-OPTIONAL` | M | NV3 (the check-in list; if NV3 is not built, FT1 builds the list and NV3 adopts it); OB2 (it changes `firstDueWeek`: land it first); AR4's `reads.ts` |
| **ST** (set-up area) | 4.10's two questions | — | FT1, FT2; `buildWorkspace`'s two new inputs (2.6) can ride with whichever lands first |
| **FT3** | Reviews into `src/modules/reviews`: section 5's additions; the routes, screens, rules, tools, Help and journeys moved; `elsewhere` emptied; the stage becomes a drill | L | AS part 2 (records) and ML1–ML3, both held; FT2. This is the architecture's "reviews last", unchanged |
| **FT4** | Every two weeks and every month | S–M | FT1; a team asking |

Each item is its own PR, with its SQL (FT1 only) in the description, its section of `spec/`, its conformance rows and its rebuild stage, per `CLAUDE.md`. FT2 and FT1 each change words people see, so neither is `[no news]`; the `watch.ts` move is.
