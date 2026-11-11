# Build spec: settings, not switches

11 November 2026. For a build session. The reasons and the evidence are in [README.md](README.md); this says what to build. Nothing here is built. Items CF1 to CF6, journeys U130–U133, checks F27 and N28, requirements `LEVELS-SET`, `THRESHOLDS-SET`, `YEAR-SHAPE`, `STREAK-SET` (take the next free number if another build has used one).

Read first: `CLAUDE.md`, `docs/design-rules.md`, `docs/architecture.md`, `supabase/README.md`, round 2's shared decisions (`docs/design/round-2/README.md`), round 3's (`docs/design/round-3/README.md`), and `docs/design/feature-toggles/spec.md` (FT1: the rhythm on the cycle, the Features page's "How you work", the read-back and Undo this spec copies).

## 0. Words

| Say | Never |
|---|---|
| **Levels**; a level's own name ("Division"); **the everyday level** (in the Levels sheet and Help only) | "tier", "hierarchy"; "north star", "SVP" or "team" as fixed words anywhere but the defaults |
| **Status thresholds**; **On track from 95% of the progress planned by now** | "tolerance", "sensitivity", "RAG rules" |
| **From week 47 (16–22 Nov)** | "effective", "going forward" |
| **Goal year**; **read in four quarters / three terms / two halves**; Q1, T1, H1 | "fiscal calendar", "periods" on screen |
| **On-time streak**; **Shown**; **Shown, and one late week is forgiven**; **Not shown** | "grace", "freeze", "streak off", "broken" |
| **Setting** for a value, **switch** for a feature; **Change**, **Save** | "configure", "preferences" (those are a person's, in Settings) |

## 1. Data, actions and who may (R1)

Everything is on the cycle, beside `reviewDay` and FT1's `checkInWeeks`. `nextCycle` already spreads the old cycle into the new one (`src/domain/cycle.ts:126`), so each field carries into the next year; `statusRules` is reset there to its last entry with `fromWeek: 0`.

```ts
// src/domain/types.ts
/** A level's stored code: 'north-star' | 'svp' | 'team' for the defaults, 'lv-…' for one a workspace added. */
export type Level = string;
export interface LevelDef {
  id: Level;
  /** What people read. 1–24 characters. */
  name: string;
  /** What it is for, said under the choice in New goal and on a goal's About. Up to 80 characters. */
  hint?: string;
  /** Names it had before, newest first: still read from a spreadsheet. */
  was?: string[];
  /** Removed: kept so history can still name it; in no list or choice. */
  removedAt?: string | null;
  removedBy?: Id | null;
}
export interface StatusRules { onTrack: number; atRisk: number; wellAhead: number; lateWeeks: number }   // shares as fractions: 0.95
export interface StatusRulesFrom extends StatusRules { fromWeek: number }

// on Cycle
/** The workspace's levels, top first; the last live one is the everyday level. Absent: the three defaults. */
levels?: LevelDef[];
/** The status thresholds, by the week each set starts. Absent or empty: RULES all cycle. Sorted by fromWeek. */
statusRules?: StatusRulesFrom[];
/** The on-time streak: 'on' when absent. Unused when checkInWeeks is 0. */
streak?: 'on' | 'grace' | 'off';
/** How a goal year is read: 4 quarters when absent; 3 terms; 2 halves. Unused when the cycle isn't a year. (CF5) */
parts?: 2 | 3 | 4;
```

`src/data/rows.ts`: `cycleToRow` writes `levels`, `status_rules`, `streak`, `parts` only when set and not the default; `cycleFromRow` leaves each off the object when null or the default, so every stored example and conformance fixture is unchanged.

### 1.1 Actions (`src/domain/actions.ts`, each with a row in `src/app/actions.ts` and R1's table; `actions.test.ts` holds the two together)

```ts
setLevels(x: ActionContext, cycle: Cycle, next: LevelDraft[], moves: Record<Level, Level>): Commit | null
setStatusRules(x: ActionContext, cycle: Cycle, to: StatusRules, answered: CheckKind[]): Commit | null
setStreak(x: ActionContext, cycle: Cycle, to: 'on' | 'grace' | 'off'): Commit | null
setYearParts(x: ActionContext, cycle: Cycle, to: 2 | 3 | 4): Commit | null          // CF5
```

`LevelDraft` is `{ id?: Level; name: string; hint?: string }` in the order wanted; a draft with no id is new. A live level missing from `next` is removed and must have an entry in `moves` if any goal has it.

All four: **admins only** (as `setModule` and FT1's `setRhythm`), the running cycle only ("That year is over; its settings can’t change."), `null` when nothing differs, one change with entity `workspace`, action `edited`. Undo, from the toast and from Activity, restores the cycle and every record the commit touched.

| Action | Refused with |
|---|---|
| `setLevels`, not an admin | "Only admins can change the levels." |
| `setStatusRules`, not an admin | "Only admins can change the status thresholds." |
| `setStreak`, not an admin | "Only admins can change the check-in rhythm." (it is part of it) |
| `setYearParts`, not an admin | "Only admins can change how the year is read." |

No new permission is invented: this is the admin-only row `setModule` already has. **A gap, flagged as a decision, not built:** round 2's goal-entry decision 11 (who may set a level above the everyday one) is still open; nothing here depends on it.

**`setLevels` writes, in one commit:**

- `cycles: [after]`. A renamed level gets its old name at the front of `was`. A removed level stays in the list with `removedAt`, `removedBy`. A new one gets `x.newId('lv')`.
- `goals`: each goal at a removed level, with `level: moves[old]`, and one change per goal: entity `goal`, "Level changed from SVP to Team, when SVP was removed" (diff field "Level").
- `reviews`: each review whose `scope.levels` names a removed level: the level is taken out and the ids of the goals it covered then are added to `scope.goals` (no duplicates).
- `watches`: each watch of kind `level` on a removed level gets `removedAt`; for each goal it covered that the person does not already watch, a watch of kind `goal` is added.
- `views`: untouched (section 2.4).
- The workspace change's summary, by what happened: "Renamed the level North star to Company"; "Added the level Group"; "Removed the level SVP and moved its 44 goals to Team"; "Changed the order of the levels to Company, Division, Team"; several joined with "; ". Diffs: field "Levels", from and to as "North star, SVP, Team" → "Company, Team".

**`setStatusRules` writes** `cycles: [after]` where `after.statusRules` is the list with any entry at `fromWeek ≥ x.week + 1` dropped and `{ fromWeek: x.week + 1, …to }` added; when `to` equals the entry then in force before it, that entry is not added (so Undo by hand leaves no trace). In week 0 (a year not begun) `fromWeek` is 0. Summary: "Changed the status thresholds from week 47: on track from 90% (was 95%), at risk from 75% (was 80%)", naming only what differs.

### 1.2 Who sees and does what

| | Admin | Everyone else |
|---|---|---|
| Workspace → Features, and the four sheets | Sees; changes | Not in their menu (as today, `sectionsFor`). The sheets' addresses give the not-found page |
| The settings, to read | Features; Cycles | Cycles' lines (4.6); the status key; Help |
| Enforced by | `setLevels`, `setStatusRules`, `setStreak`, `setYearParts` (each refuses a non-admin; the screen not offering it is not the rule) | |

## 2. Rules in `src/domain`

Each takes only what it reads (AR4). Worked examples become unit tests and, where marked ◆, conformance rows or `src/spec/rules.ts` examples. Examples use the spec's cycle (`src/spec/examples.ts`): starts Mon 7 Sept 2026, 13 weeks, due day Thursday.

### 2.1 Levels (`src/domain/levels.ts`, new; CF1)

```ts
DEFAULT_LEVELS: LevelDef[]            // north-star "North star" · svp "SVP" · team "Team", with today's hints (GoalFields.tsx:8–12)
levelsOf(cycle: Pick<Cycle, 'levels'>): LevelDef[]                 // live ones, top first
levelDef(cycle, id): LevelDef | null                               // live or removed
levelName(cycle, id): string                                       // the name; a removed level's name; the id itself if unknown
everydayLevel(cycle): Level                                        // the last live one
isEveryday(cycle, id): boolean
isTop(cycle, id): boolean                                          // the first live one, when there are two or more
levelRank(cycle, id): number                                       // its place; removed or unknown levels after all live ones
hasLevels(cycle): boolean                                          // two or more live
levelWords(cycle): Words<Level>                                    // for the import (2.3)
levelProblems(next: LevelDraft[], cycle, goalsByLevel: Record<Level, number>, moves): Problem[]   // Must fix and Check (4.2)
levelsReadBack(reads, cycle, next, moves): LevelsReadBack          // 4.2's counts
```

`levelsReadBack` takes `{ goals: Pick<Goal,'id'|'level'>[]; reviews: Pick<Review,'id'|'name'|'scope'>[]; watches: Pick<Watch,'personId'|'kind'|'ref'>[]; views: Pick<SavedView,'id'|'name'|'personId'|'params'|'pinned'>[] }` and returns `{ renamed: { from, to, goals }[]; added: string[]; removed: { name, goals, to, reviews: string[], watchers: number, views: { name, pinned, ownerId }[] }[]; reordered: boolean; everydayChanged: { from, to } | null }`.

Every place in README 1.2's table reads these. In particular:

| Today | Becomes |
|---|---|
| `LEVEL_LABEL[level]` (22 files) | `levelName(cycle, level)`; screens get `levels` from `src/app/reads.ts` (`useLevels()`), never the cycle whole |
| `level !== 'team'` (12 places), `LevelTag` | `!isEveryday(cycle, level)`. With one level nothing is tagged |
| `level === 'north-star'` (`map.ts:86`, `:141`) | `isTop(cycle, level)`; `mapRows` takes `rank: (g) => number` in its `opts`, beside `order` |
| `LEVEL_RANK` (`query.ts:168`, `GoalWizard.tsx:12`), `LEVELS.indexOf` (`GoalBoard.tsx:29`) | `levelRank` |
| `LEVELS` and the eleven other lists | `levelsOf(cycle)` |
| `parseQuery`'s `list(p.get('level'), LEVELS)` (`query.ts:70`), `activity.ts:46` | The ids are kept as given; `matches` compares ids; an id that is not a live level is reported by `unknownLevels(q, cycle)` for 2.4 |
| `watch` (`actions.ts:245`) | "There’s no level called “{ref}” here. The levels are Company, Division and Team." It accepts an id or a name |
| `Watching.tsx:146` (`'svp'`) | The first live level after the top that has goals; with two levels, the top |
| `importer.ts:111` | `levels: levelsOf(cycle).map((l) => l.id)` |
| `rows.ts:104` (`r.headline ? 'north-star' : 'team'`) | Unchanged: it reads rows from before migration 0006 |
| `GoalScreen.tsx:1053` ("SVP, reported at major reviews") | "{name}. {hint}" or "{name}." |
| `GoalFields.tsx` `LevelField` | 4.5 |
| `.level-north-star` (`styles.css:622–623`) | Removed. `.level` is plain small capitals for every level (decision 7) |

| Given | Then |
|---|---|
| ◆ A cycle with no `levels` | "North star, SVP, Team"; everyday `team`; top `north-star` |
| ◆ Levels Company (`north-star`), Group (`lv-1`), Division (`svp`), Team: a goal at `svp` | name "Division", rank 2, tagged; a goal at `team` not tagged |
| ◆ One level, Team | `hasLevels` false; nothing tagged; `isTop` false |
| ◆ SVP removed, its goals moved to Team; a History entry names `svp` | `levelName` "SVP"; `levelsOf` leaves it out |
| ◆ Goals sorted by level with the four levels above | Company, Group, Division, Team |

### 2.2 Thresholds (`thresholds.ts`, `status.ts`; CF3)

```ts
// thresholds.ts
RULES                                  // unchanged values: the defaults. lateWeeksOff stays as an alias of lateWeeks for one release
rulesAt(cycle: Pick<Cycle, 'statusRules'>, week: number): StatusRules     // the last entry with fromWeek ≤ week; RULES' four when none
rulesProblems(to: StatusRules, cycle, week): Problem[]                    // 4.3
rulesLine(r: StatusRules): string       // "On track from 95% of the progress planned by now, at risk from 80%, off track below. A stage is off track when more than 2 weeks late."
rulesSince(cycle, week): { now: StatusRules; before: StatusRules | null; changedWeek: number | null }
```

Signatures that change (the only ones):

| Function | New parameter | Callers |
|---|---|---|
| `assessMetric(goal, weeks, week, actual, history, rules)` | `rules: StatusRules`, last, required | 4: `status.ts:178`, `checkin.ts:183`, `summaryFacts.ts:73`, `trend.ts:89` |
| `assessMilestone(goal, week, updates, rules)` | the same | 13 calls in 8 files: `status.ts:186`, `checkin.ts:187`, `summaryFacts.ts:221`, `:227`, `:257–258`, `cycle.ts:139`, `trend.ts:60`, `scorecard.ts:201`, `changes.ts:56`, `GoalScreen.tsx:980`, `:1012` |
| `assessPosted(goal, cycle, checkIns, week)` | none: it calls `rulesAt(cycle, at)`, where `at` is the latest check-in's week | 15, unchanged |
| `evaluate` (`checkin.ts`), `goalStatus`, `scorecard`, `summaryFacts`, `goalTrend` | none: each has the cycle and passes `rulesAt(cycle, w)` for the week `w` it judges | |
| `onTrackTypeable` | takes `rules` from its caller | 1 |

**The one rule:** a number or a stage is judged by the thresholds of the week it is for. `assessMetric` for a check-in of week 44 gets `rulesAt(cycle, 44)`, whenever it is called. `assessMilestone(goal, week, …)` gets `rulesAt(cycle, week)`.

`CheckInFlow.tsx:21`, `:708` stop importing `RULES`: the stage's word comes from `assessMilestone` (C8).

| Given | Then |
|---|---|
| ◆ A straight plan from 30 to 75 over 13 weeks. Week 4 numbers at 95%, 94%, 80% and 79% of the planned change. No `statusRules` | on, risk, risk, off (today's row, unchanged) |
| ◆ The same, with `statusRules: [{ fromWeek: 0, onTrack: .9, atRisk: .75, wellAhead: 1.2, lateWeeks: 2 }]`; numbers at 95%, 90%, 89%, 75%, 74% | on, on, risk, risk, off |
| ◆ `statusRules: [{ fromWeek: 5, onTrack: .9, … }]`. A check-in for week 4 at 92%, read in week 9; a check-in for week 5 at 92% | risk (week 4's rule); on |
| ◆ The same cycle; in week 9 a spreadsheet loads a check-in for week 3 at 92% | stored `calculated`: risk |
| ◆ `lateWeeks: 3` from week 5. A stage due week 2, expected week 5: read for week 4's check-in; for week 6's | Late (off); Slipping (risk) |
| ◆ Well ahead from 130%: a number at 125% | on, not ahead: no reason asked, no new target offered |
| A check-in for week 4 stored `calculated: risk`, `status: on` with a reason; the rule changes at week 5 | Still "Called greener than calculated": both are stored |

### 2.3 The import's words (`columns.ts`, `changeset.ts`, `formatDoc.ts`)

`LEVEL_WORDS` becomes `levelWords(cycle)`, built as: for each live level, its `name` (normalised as `word` does), its `id`, and each name in `was` unless a live level now has that name; for the three default ids while they still have their default names, today's `also` and `prefix` lists (so every file that loads today loads tomorrow). A removed level contributes nothing.

- The column writes the level's **name** as typed, lower case kept as today for the defaults ("north star", "svp", "team") so an untouched workspace's export is byte for byte the same.
- Unknown word: Must fix, "Level says “vp”. Use Company, Division or Team."
- A removed level's name: Must fix, "Level says “svp”. SVP was removed on 11 Nov. Use Company or Team."
- Empty: the everyday level (the field table's default).
- With one level the Level column is not written and is ignored if present.
- `planChanges` and `rowChange` take `levels: LevelDef[]` with the cycle they already take.

| Given | Then |
|---|---|
| ◆ Defaults; "North Star", "senior vp", "headline", "team" | north-star, svp, north-star, team (as today) |
| ◆ North star renamed Company; a file says "north star"; another "Company" | both `north-star`; "Nothing would change" for an unedited export from before the rename |
| ◆ SVP removed; a file says "svp" | Must fix, with the sentence above |
| ◆ SVP removed, then Team renamed "SVP" (a Check in 4.2 was answered) | "svp" loads as `team` |

### 2.4 Addresses, saved views, Activity (`query.ts`, `activity.ts`, `goalsPage.ts`)

A `level=` value that is not a live level's id matches no goal. The filter line says, for a removed level, "**SVP isn’t a level here any more** (removed 11 Nov). Clear"; for an unknown one, "There’s no level “vp” here. Clear". "Clear" drops the parameter. A saved view keeps its parameters; nothing rewrites it.

### 2.5 The streak (`progress.ts`; CF4)

```ts
onTimeStreak(personId, s, cycle, week): number | null
```

It reads `cycle.streak` (and FT1's rhythm): `null` when the streak is `'off'` or there is no set rhythm; today's number when `'on'`. With `'grace'`:

- walk back from the latest finished week, as today;
- a week that is not on time is **forgiven** when each of the four weeks before it in which the person had something due was on time; a forgiven week is not counted and the walk goes on;
- a week not on time and not forgiven ends the walk;
- "checked in this week, but late" is a week not on time like any other (today it returns 0 at once).

Callers already handle `null` in `Dashboard.streak`; `CheckInFlow.tsx:140`, `Home.tsx:51` and `:71`, `goalPage.ts:307` and `workTools.ts:150` treat `null` as "say nothing".

```ts
streakReadBack(people: Id[], s, cycle, week, to): { have: number; longer: number; shorter: number; longest: { from: number; to: number } | null }
```

| Given (Tunde; week 46 complete and on time) | on | grace |
|---|---|---|
| ◆ Weeks 41 to 44 on time, 45 late | 1 | 5 |
| ◆ Weeks 41 to 43 on time, 44 and 45 late | 1 | 1 |
| ◆ Week 44 on time, 45 late, nothing due before 44 | 1 | 1 (four on-time weeks are needed first) |
| ◆ Weeks 36 to 39 on time, 40 late, 41 to 44 on time, 45 late | 1 | 9 |
| ◆ Every week on time for 5 weeks | 5 | 5 |
| Any, with `streak: 'off'`, or `checkInWeeks: 0` | null | |

### 2.6 How the year is read (`year.ts`; CF5)

`quarters(c)` reads `c.parts ?? 4` for a year:

| Parts | Labels | Weeks (a 52- or 53-week year) | Months (a January year) |
|---|---|---|---|
| 4 | Q1–Q4 | 1–13, 14–26, 27–39, 40–end | Jan–Mar … Oct–Dec (as today) |
| 3 | T1–T3 | 1–17, 18–34, 35–end | Jan–Apr, May–Aug, Sep–Dec |
| 2 | H1, H2 | 1–26, 27–end | Jan–Jun, Jul–Dec |

`Quarter` keeps its name in code. `QUARTER` in the vocabulary gains `partWord(cycle)`: "quarter", "term", "half", used wherever a sentence says the word; labels come from `quarters()`. `dueOptions` offers "End of H1". A goal due at a week that is no longer a part's end keeps its week and reads "week 39 (21–27 Sep)".

```ts
partsReadBack(goals, cycle, to, week): { dueAtOldEnds: number; labels: string[] }
yearLine(cycle, week): string    // "January to December, in four quarters. 2026 is in week 46 of 53."  (round 1's Rule 6, extended)
```

| Given | Then |
|---|---|
| ◆ The demo's 2026 (53 weeks), parts 2: week 26; week 27; week 53 | H1; H2; H2 |
| ◆ Parts 3, an April year: T1's months | Apr–Jul |
| ◆ Parts 2; a goal due in week 39 | still due week 39; `dueAtOldEnds` counts it |

### 2.7 `vocabulary.ts`, Help, exports

- A term's text may hold `{onTrack}`, `{atRisk}`, `{wellAhead}`, `{lateWeeks}`. `say(term, rules)` fills them; the fixed `meaning` and `long` are `say` with `RULES` (so the glossary, the vocabulary check and every existing caller are unchanged). The status key, Help's status article, the check-in's Change sheet and exports' Words section call `say(term, rulesAt(cycle, week))`.
- When `rulesSince(cycle, week).before` is not null, those four places add one line: "Until week 46: on track from 95%, at risk from 80%." (only what differed).
- `STAGE.risk` and `STAGE.off` take `{lateWeeks}` the same way.
- No level name is in the vocabulary: levels are data. `FLAG`, `STATUS` and the rest are untouched.

## 3. Routes and redirects

| Address | What |
|---|---|
| `/workspace/features` | As round 2, with the rows in 4.1 |
| `/workspace/features/rhythm` | The rhythm's sheet (FT1's, given an address), with the streak |
| `/workspace/features/levels` | Levels |
| `/workspace/features/thresholds` | Status thresholds |
| `/workspace/features/year` | Goal year (CF5) |

Each sheet is a page under Workspace with the breadcrumb "Workspace › Features › {name}". Back, Cancel and Escape return to Features with nothing changed; leaving with unsaved changes asks "Leave without saving? Your changes to the levels aren’t saved." (Stay / Leave). A non-admin at any of these gets the not-found page. No redirects: none of these addresses exists today.

## 4. Screens

### 4.1 Workspace → Features. Wireframe 1

Group **"How you work"**, in this order. Each setting row: name, one sentence, **Change**.

| Row | Sentence (the default first) |
|---|---|
| Check-in rhythm | FT1's sentence, then: "Each owner sees their on-time streak." / "Each owner sees their on-time streak; one late week is forgiven." / (off: nothing added). With no set rhythm: FT1's sentence alone |
| Levels | "North star, SVP and Team: 12, 44 and 70 goals." One level: "One level, Team: goals aren’t tagged by level." |
| Status thresholds | `rulesLine(rulesAt(cycle, week))`. When a change is saved for next week: "…From week 47: on track from 90%, at risk from 75%." |
| Goal year (CF5; before it, this row is not drawn) | `yearLine`. A cycle that is not a year: "A cycle of 13 weeks, 7 Sept to 6 Dec 2026." and no Change |
| Reviews | Round 2's switch |

Under the group: "A setting says what is set. Changing one tells you what it will do before it is saved, and never rewrites a week that has passed."

About's Features fact (round 2): "Check-ins every week, due by Thursday. Levels: North star, SVP and Team. Reviews, Metric library and Spreadsheets are on. Features". About's Year fact: "2026, January to December, week 46 of 53. The wrap-up opens on 21 Dec 2026. Cycles".

One primary action: none.

### 4.2 Levels (`/workspace/features/levels`). Wireframe 2

In order:

1. Breadcrumb. Heading "Levels". "How important a goal is, for reporting. A level is a label with an order; it doesn’t decide who may do what or what may feed what."
2. "Top first. The last level is the everyday one: new goals start there and it isn’t tagged on a goal."
3. One block per level, in order: its place; **Name** (a text field); **What it’s for** (a text field, placeholder "Optional: said when someone chooses it"); "{n} goals" and, when renamed in this edit, "· was “North star”"; on the last, "· the everyday level"; **Up**, **Down** (absent at the ends); **Remove** (absent when it is the only level).
4. A level being removed: its name, "Being removed · {n} goals", **Keep it**; when it has goals, "Move its {n} goals to" and a choice of the other levels (none chosen at first; the everyday level is offered first).
5. **Add a level** (absent at six). A new block appears above the everyday level, focused, "No goals yet".
6. Buttons: Cancel, **Save levels** (primary; disabled until something differs).
7. "What changes for everyone here" (beside on a wide screen; above the buttons on a phone), shown once something differs; each line only when its count is above zero:
   - "**{n} goals read “{new}”** where they read “{old}”. Nothing else about them changes."
   - "**“{name}” is added** {above/below} {neighbour}. No goal is at it until someone sets one."
   - "**{n} goals move from {old} to {to}.** Each goal’s History says so. {to} then has {m} goals."
   - "**{n} review(s) walk every {old} goal:** {names}. {It keeps / They keep} the same {m} goals, picked one by one."
   - "**{n} people watch every {old} goal.** Each keeps watching those {m} goals."
   - "**{n} saved view(s) filter by {old}:** “{name}” (pinned){, and {k} of people’s own}. They will match nothing and say why."
   - "**The everyday level becomes {name}.** {n} {name} goals lose their tag, and {m} {old} goals gain one. New goals start at {name}."
   - "**Goals, the Board and the Map are ordered** {a}, {b}, {c}."
   - "A spreadsheet that says “{old name}” still loads as {new}." / "One that says “{removed}” is refused, with the levels to use."
   - Last: "Nothing is deleted. Undo puts every goal, review, watch and name back."

**Must fix** (the block outlined on every side; the words under the field; Save disabled):

| When | Words |
|---|---|
| A name is empty | "Give the level a name." |
| Over 24 characters | "Keep the name to 24 characters or fewer: it has {n}." |
| Two live levels with one name, ignoring case and spaces | "Two levels can’t both be called “{name}”." |
| A level with goals is being removed and nowhere is chosen | "Choose where {name}’s {n} goals go." |
| The hint is over 80 characters | "Keep it to 80 characters or fewer: it has {n}." |

**Check** (the warning mark and a question in the block; Save waits for an answer):

| When | Question and answers |
|---|---|
| A name is one letter from another's, or from its own old name | "“Divison” is close to “Division”. Is it a different level?" · Yes, it’s different / Use “Division” |
| A name is one a removed level had | "“SVP” was a level until 11 Nov. Spreadsheets that say “svp” would load as this one. Is that right?" · Yes / Choose another name |
| The everyday level would change | "New goals would start at {name}, and its {n} goals would lose their tag. Is that right?" · Yes / Put {old} back at the end |
| Six levels | "Six levels is a lot to tell apart on a row. Is each one reported somewhere different?" · Yes / Remove the new one |

After Save: toast "Levels saved: {Company, Team}." with **Undo** ("The levels are North star, SVP and Team again.").

Errors: saved elsewhere meanwhile → "The levels changed while you were here. Reload to see them."; a goal moved level meanwhile → the counts are worked out again on Save and, if any differs, the sheet stays open with "The counts changed: check them and save again."

### 4.3 Status thresholds (`/workspace/features/thresholds`). Wireframe 3

In order:

1. Breadcrumb. Heading "Status thresholds". "What the numbers say about a goal, before its owner makes the call. The same for every goal here."
2. **A number goal**: three number fields with their unit shown in the field.
   - "On track from" · "of the progress planned by now" · [95] %
   - "At risk from" · "below this it is off track" · [80] %
   - "Well ahead from" · "still on track; the owner is asked why" · [120] %
   - Once any differs: "Was 95%, 80% and 120%."
3. **A goal with dated stages**: "A stage is off track when more than" · "weeks late; up to that it is slipping, and the goal at risk" · [2] weeks.
4. **What that means**: "A goal planned to have moved from 40 to 60 by this week (20 planned):" and a table, "Its number", "Now reads", "Would read" (one column, "Reads", until something differs), a row for each band's edge under either set, each cell a status shape with its word. Under it: "It reads the same when lower is better. At {64} or more it is well ahead{, as now}." The rows are worked out by `assessMetric` on that example goal with each set, on every keystroke; an unparseable field leaves the last good table with the field's error.
5. Any Check.
6. Buttons: Cancel, **Save thresholds** (primary; disabled until something differs and every Check is answered).
7. "What changes for everyone here", from `statusRulesReadBack`:
   - "**From week {47} ({16–22 Nov}).** Check-ins for that week and after are judged by the new numbers."
   - "**No status changes today.** A status is its owner’s call at their last check-in, and stays until the next one."
   - "**If this week’s numbers were posted again:** {6} goals would be offered On track where they were offered At risk{, and {3} At risk where Off track}. {73} would read the same." (each pair only above zero; all the same: "every number goal would be offered what it was.")
   - "**{4} owners would not have been asked why they were behind.**" / "**{n} more would have been asked…**" / the same for "why they were ahead"
   - With `lateWeeks` changed: "**{n} stages would read Slipping** where they read Late." (or the reverse)
   - "**Weeks 1 to {46} keep what they said**, and so do the results for {Q1, Q2 and Q3}, which never use these numbers."
   - "Help, the status key and exports say {90% and 75%} from week {47}, and “{95%} until week {46}”."
   - Last: "Undo puts {95%, 80% and 120%} back, from week {47}."

**Must fix:**

| When | Words |
|---|---|
| Not a whole number | "Use a whole number, like 95." |
| At risk not below on track | "At risk starts at {96}%, which isn’t below On track at {95}%. At risk must start lower." |
| Out of range | "On track can start anywhere from 80% to 100%." · "At risk can start anywhere from 50% to 99%." · "Well ahead can start anywhere from 105% to 200%." · "Use 1 to 8 weeks." |

**Check:**

| When | Question and answers |
|---|---|
| On track under 90 | "A goal {10}% short of its plan would read On track. Is that what you mean?" · Yes, {90}% is right / Set it back to {95}% |
| On track minus at risk under 5 | "At risk would cover only {3} points, so most goals would go straight from On track to Off track. Is that what you mean?" · Yes / Set At risk back to {80}% |
| Well ahead under 110 | "Being {5}% ahead of plan would ask the owner why. Is that what you mean?" · Yes / Set it back to {120}% |
| A change already made this year | "The thresholds last changed in week {30}. Each change makes weeks harder to compare. Change them again?" · Yes / Cancel |

After Save: toast "Thresholds saved. They start in week 47 (16–22 Nov)." with **Undo** ("The thresholds stay as they are: on track from 95%.").

```ts
statusRulesReadBack(goals, checkIns, cycle, to: StatusRules, week): {
  fromWeek: number; pairs: { was: Status; would: Status; n: number }[]; same: number;
  behindAsked: number; aheadAsked: number;        // negative: fewer would have been asked
  stages: { was: 'risk' | 'off'; would: 'risk' | 'off'; n: number }[]
}
```

It takes live goals and their check-ins, not the workspace. For each live number goal whose latest check-in has a number: `assessMetric` at that check-in's week with `rulesAt(cycle, week)` and with `to`; tally the two `calc` values and the two `behind` / `ahead` flags. For each live stage goal: `assessMilestone` at `week` with each, per stage not done. Range goals are never counted (they read no threshold).

### 4.4 Goal year (`/workspace/features/year`; CF5). Wireframe 4

(a) On Features, a running year:

1. Heading "Goal year".
2. Two stated facts, not fields: "**Starts in** {January}. {2026} runs {22 Dec 2025} to {27 Dec 2026}, {53} weeks." with the hint "Fixed for a running year: its {5,347} check-ins are filed by week number." · "**Weeks** Monday to Sunday, numbered from the week with the year’s first Thursday."
3. "The year is read in": three radio rows, **Four quarters**, **Three terms**, **Two halves**, each with its labels and months.
4. "What changes for everyone here": "**Charts, results and “By when?” say {H1 and H2}** where they said {Q1 to Q4}." · "**{3} goals are due at the end of {Q3}** (week {39}). They stay due in week {39}, which reads “week 39 (21–27 Sep)”." (omitted at zero) · "**Results are read again by {half}:** {H1} for weeks {1 to 26}. No plan, number or status changes."
5. Cancel, **Save** (primary). Toast: "The year is read in two halves now." with **Undo**.

This is the one setting that re-reads the past (a result "Q1: Met" becomes "H1: …"). It says so in the third line; nothing stored changes, and Undo restores the reading exactly.

(b) In set-up (round 2, ST3, "How you’ll work"), **Change** beside "The goal year: January to December. This is week 46 of 53." opens:

1. **Starts in**: a choice of the twelve months (today's, `Onboarding.tsx:343`).
2. **Read in**: Four quarters · Three terms · Two halves (with CF5; before it, not drawn).
3. What follows, worked out as either changes: "**{Apr 2026–Mar 2027}**, {52} weeks, from {Mon 30 Mar 2026} to {Sun 28 Mar 2027}." · "**{Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar}.**" · "**You join it in week {33} of {52}**, in {Q3}. Nothing before this week is counted late."
4. "The month can’t change once the year has check-ins. Weeks run Monday to Sunday."
5. **Done** (returns to the step; set-up's own read-back says the year).

Not offered, at set-up or after: the week's first day; a cycle shorter than a year; a calendar of unequal months.

### 4.5 Under the workspace's levels. Wireframes 5 and 6

| Place | Says |
|---|---|
| Every goal row, card, map node, print, the check-in's head | The level's name in small capitals, unless it is the everyday level. One style for every level |
| Goals: Group "By level", the filter "Level", the sort "Level", the Board's order | `levelsOf(cycle)`, in order. A level with no goals has no group. With one level none of the four is offered |
| A goal's About | "Level" · "{name}. {hint}" |
| New goal and Edit (`LevelField`) | Up to four levels: the segmented choice, everyday level first and chosen (as today's order, `GoalFields.tsx:7`). Five or six: a list of radio rows. The hint under it is the chosen level's `hint`. One level: the field is absent |
| Bulk edit, Data's Level column, Activity's Level filter, Set up a review ("Every goal at a level"), Watching's chips | The same list |
| Watching, watching nothing | "Watch every {level} goal ({n})" for each level with goals but the everyday one; the primary is 2.1's |
| History and Activity | The words written that day. A diff saved as "SVP" stays "SVP" |
| Find | A level's name finds its goals (`goalWords` uses `levelName`) |
| Exports | The Goals sheet's Level is the name; the brief's `[Company]`; JSON keeps `level` (the id) and gains `levelName` |

### 4.6 Cycles (`/workspace/cycles`)

The running cycle's row gains, after FT1's check-ins line, for everyone: "Levels: {Company, Division and Team}." · "Status: on track from {95}% of the progress planned, at risk from {80}%." · with CF5 and a year: "Read in {four quarters}, from {January}." For an admin each ends with "Change", to its sheet. A past cycle's row shows the same lines from its own fields, without links.

### 4.7 The rhythm's sheet, with the streak (`/workspace/features/rhythm`). Wireframe 7

FT1's sheet, with, under the two choices and only while "Every week" is chosen:

- "**On-time streak**" · "Weeks in a row with every check-in in by {Thursday}. Only the owner sees their own."
- Three radio rows:
  - **Shown**: "One late week sets it back to nothing."
  - **Shown, and one late week is forgiven**: "A late or missed week doesn’t end a streak if the four weeks before it were on time. It isn’t counted."
  - **Not shown**: "Nothing counts weeks. “Due by {Thursday}” and what’s still to do stay."
- In "What changes for everyone here", when the streak's choice differs: to grace, "**{41} owners have a streak today.** None gets shorter." · "**{6} owners’ streaks get longer**: a single late week inside them is forgiven. The longest goes from {3} weeks to {11}."; to on from grace, "**{6} owners’ streaks get shorter**, the longest from {11} weeks to {3}."; to off, "**No one sees a streak**: not on Home, after a check-in or on a goal. {41} owners have one today." Always: "Check-ins, due days and statuses are untouched. A streak is only ever shown to its owner."
- Toast: "Streaks forgive one late week now." / "Streaks are no longer shown." / "Streaks are shown again.", each with **Undo**.

Not shown means absent: no cell on Home's strip (it closes up, as FT1's does), no "weeks in a row on time", no "· 5 weeks on time", nothing in `get_my_work`.

### 4.8 Empty and edge states

- A workspace with no goals: counts read "No goals yet" in each level's block; removing asks for no destination.
- A year in week 0: thresholds start "from the first week".
- Wrap-up open (the last two weeks): the thresholds sheet adds "The year ends in week {53}. To start next year differently, save this now: next year begins with what is in force at its end."
- A past year, opened read-only: Features shows the running cycle's settings only.

## 5. Extension points

None is added. Settings are the core's: no module contributes a level or a threshold. Two notes for modules:

- A module's screen that shows a level reads `useLevels()` from `src/core` (exported with the other reads), never a level's id.
- `src/modules/spreadsheets` gets `levelWords(cycle)` through the engine it already calls; its template and README sheet are written per workspace.

## 6. AI tools (MCP)

| Tool | Change |
|---|---|
| `find_goals`, `create_goal`, `edit_goal`, `bulk_change` | `level` is a free string in the schema: "A level’s name or id. `describe_system` lists them." An unknown one answers "There’s no level called “vp” here. The levels are Company, Division and Team." Each goal in a result gains `levelName` |
| `watch`, `save_review` | The same for a level `ref` and for `levels` |
| `describe_system`, `get_overview` | Gain `levels: [{ id, name, hint, goals }]`, `statusRules: { onTrackFrom, atRiskFrom, wellAheadFrom, stageOffAfterWeeks, sinceWeek }`, `streak`, and with CF5 `yearReadIn` |
| `get_my_work` | `onTimeStreakWeeks` is absent when the streak is not shown |
| **New: `set_levels`** `{ levels: [{ id?, name, hint? }], move?: { [removed]: to }, answers?: [...], confirm?: boolean }` | Admins only. Without `confirm` it returns 4.2's read-back, the Must fix and the Check questions as text and changes nothing; with it, and every question answered, runs `setLevels` |
| **New: `set_status_rules`** `{ on_track_from, at_risk_from, well_ahead_from, stage_off_after_weeks, answers?, confirm? }` | The same pattern, with 4.3's read-back |
| `set_rhythm` (FT1) | Gains `streak?: "shown" | "forgiving" | "not shown"` |
| **New with CF5: `set_year_parts`** `{ read_in: "quarters" | "terms" | "halves", confirm? }` | |

Add each to `src/mcp/parity.ts`. Run `npm run build:mcp` and commit `api/mcp.js`.

## 7. The migration

One file with CF2, `supabase/migrations/0039_workspace_settings.sql` (or the next number). CF1 needs none. CF3 and CF4 use columns this file adds, so if CF3 or CF4 lands first it carries the file.

```sql
-- Settings a workspace sets (backlog CF2–CF5, docs/design/workspace-settings): its levels, its status thresholds,
-- the on-time streak and how its year is read. Kept on the cycle beside review_day, so a past year reads by the
-- settings it ran under. Every column is null or its default for every existing cycle: nothing changes until an
-- admin changes it.
--   levels        jsonb  the levels, top first: [{ "id", "name", "hint", "was", "removedAt", "removedBy" }]. Null: North star, SVP, Team.
--   status_rules  jsonb  thresholds by the week they start: [{ "fromWeek", "onTrack", "atRisk", "wellAhead", "lateWeeks" }]. Null: 0.95, 0.8, 1.2, 2.
--   streak        text   'on' (one late week ends it), 'grace' (one late week forgiven), 'off' (not shown).
--   parts         smallint  a goal year read in 4 quarters, 3 terms or 2 halves.
-- A goal's level is then any level of its cycle, so the fixed list on okr_goals.level goes; the app's action
-- (setLevels, and the change engine) is what keeps a goal's level to the cycle's list.
-- Runs as faro_owner with search_path faro (supabase/README.md). No new table or function, so no grant: a column
-- takes its table's grants and row rules. okr_write is not touched: okr_upsert writes whichever columns a saved
-- row carries. Safe to run twice.

alter table okr_cycles add column if not exists levels jsonb;
alter table okr_cycles add column if not exists status_rules jsonb;
alter table okr_cycles add column if not exists streak text not null default 'on';
alter table okr_cycles add column if not exists parts smallint not null default 4;

do $$
declare c text;
begin
  if not exists (select 1 from pg_constraint where conname = 'okr_cycles_streak_ok' and conrelid = 'okr_cycles'::regclass) then
    alter table okr_cycles add constraint okr_cycles_streak_ok check (streak in ('on', 'grace', 'off'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'okr_cycles_parts_ok' and conrelid = 'okr_cycles'::regclass) then
    alter table okr_cycles add constraint okr_cycles_parts_ok check (parts in (2, 3, 4));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'okr_cycles_levels_ok' and conrelid = 'okr_cycles'::regclass) then
    alter table okr_cycles add constraint okr_cycles_levels_ok check (levels is null or jsonb_typeof(levels) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'okr_cycles_status_rules_ok' and conrelid = 'okr_cycles'::regclass) then
    alter table okr_cycles add constraint okr_cycles_status_rules_ok check (status_rules is null or jsonb_typeof(status_rules) = 'array');
  end if;
  -- The fixed list of levels (0006: check (level in ('north-star', 'svp', 'team'))), whatever it was named.
  for c in select conname from pg_constraint
            where conrelid = 'okr_goals'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%north-star%' loop
    execute format('alter table okr_goals drop constraint %I', c);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'okr_goals_level_ok' and conrelid = 'okr_goals'::regclass) then
    alter table okr_goals add constraint okr_goals_level_ok check (level <> '' and length(level) <= 40);
  end if;
end $$;
```

The build session checks before it writes code:

1. `okr_upsert` still takes its columns from the rows it is given (migration 0011) and nothing later narrowed it for `okr_cycles` (FT1's first check; the same).
2. `faro_owner` owns `okr_goals` and may drop its constraint. `supabase/README.md` says dropping or retyping a **column** a `public` redirect shows fails; a check constraint is not a column and the redirects are `select *` views, so this should pass. Try it on PGlite and the plain-Postgres adapter first; if the live database refuses, ship CF2 limited to the three stored codes (rename and reorder only; "Add a level" and "Remove" absent) and move the constraint to 0c2.
3. The new columns are seen only through `faro` (no redirect is made). Confirm with a read of a cycle's `levels` from the app's client before merging.
4. `storeContract` gains "a cycle's settings are kept whole" (levels with a removed one, two sets of thresholds, streak, parts).
5. `jsonb` through `okr_upsert`'s `jsonb_populate_recordset`: `okr_reviews.scope` is already a jsonb column saved this way; follow it.

Put the SQL in the PR description. Merging applies it.

## 8. Help, What's new, the spec

- **What's new** (top of `src/help/whatsNew.ts`), one entry per item:
  - CF2: "A workspace names its own levels. An admin sets them on Workspace, Features: rename North star, SVP and Team, add a level or remove one. Renaming changes no goal."
  - CF3: "What counts as on track is a workspace’s setting. An admin sets the thresholds on Workspace, Features. They start the following week; weeks already posted keep what they said."
  - CF4: "The on-time streak can forgive one late week, or not be shown. An admin chooses with the check-in rhythm."
  - CF5: "A goal year can be read in halves or terms as well as quarters."
  - CF1 and CF6 are `[no news]`.
- **Guide** (`src/help/guide.ts`):
  - "features": the settings; that each says what it will do first and can be undone; who may.
  - A new article "levels" (the route `/workspace/features/levels` needs one, `guide.test.ts`): what a level is and is not, the everyday level, renaming, adding, removing and what happens to goals, reviews, watches, saved views and spreadsheets.
  - "statuses" (`guide.ts:117`, `:203`): the numbers come from `say(term, rules)`; a paragraph "These numbers are your workspace’s"; the "until week" line.
  - "check-in": the streak's three choices, in one paragraph. "cycles": the lines in 4.6. "goals", "new-goal": "your workspace’s levels" where they name the three.
  - New routes `/workspace/features/thresholds`, `/rhythm`, `/year` are covered by "features" (add them to its `routes`).
- **The spec** (`npm run spec`, never by hand):
  - `src/spec/rules.ts`: the examples marked ◆ under `status`, `check-in`, `goals-page`, `map`, `finding`, `change-engine`, `weeks-and-plans`; a new rule page `levels` (2.1) and a section "The on-time streak" under `check-in` (2.5).
  - `src/spec/build.ts`: "The numbers the rules turn on" in two tables: **a workspace sets** (the four of `StatusRules`, the levels, the streak, the parts, FT1's rhythm) and **set once in code** (`TREND_SPAN`, `PROJECTION_WEEKS`, `MIN_REASON`, `MIN_STOP_REASON`, `RESTORE_DAYS`, `UNDO_MS`, the wrap-up's two weeks, a year is 48 weeks or more, day one's 14 and 28 days, FT1's `staleCheckIns`), each with its file.
  - `src/spec/internal.ts:334–339`: the "fixed three" limit is replaced by "levels are the cycle's list".
  - `src/spec/conformance.ts` writes `spec/conformance/other-settings/{workspace.json,status.csv,checkin.csv,scorecard.csv,flags.csv}`: the demo workspace with `levels` of four (a `lv-group` level holding nine of the `svp` goals) and `statusRules: [{ fromWeek: 30, onTrack: .9, atRisk: .75, wellAhead: 1.3, lateWeeks: 3 }]`. Its README says: rows for weeks 0 to 29 equal the main set's; from week 30 they differ. The existing files stay byte for byte.
  - `llms.txt`: "Levels, the status thresholds and the streak are the cycle's settings; the defaults are…".
- **The rebuild kit:**
  - `spec/rebuild/before-you-build.md` (generated; CF6): what to set once before building (the vocabulary file, locale and zone, the week's first day, the constants above), and what to leave as a unit's settings.
  - `stage-1-core-rules.md`: "score both the main and the other-settings conformance sets"; `scripts/drill-faro` must score 100% on both.
  - `ports-at-scale.md`: the unit's settings travel with its summary rows; a threshold change makes no summary row stale that day (statuses are stored calls), and from its week the server judges new check-ins with it.
  - No new module, so no new stage; `scripts/check-rebuild.mjs` is unaffected.
- **A lint, `scripts/check-settings.mjs`** (CI, with CF1 for levels and CF3 for thresholds): fails on `'north-star'`, `'svp'`, `LEVEL_LABEL`, or a `level` compared with a string literal, outside `src/domain/levels.ts`, `src/data/rows.ts` (the pre-0006 fallback), `src/data/platformOrg/`, `src/spec/examples.ts` and tests; and on `RULES.onTrack`, `RULES.atRisk`, `RULES.wellAhead`, `RULES.lateWeeks`, `RULES.lateWeeksOff` outside `src/domain/thresholds.ts`, `src/spec/` and tests.

## 9. Evals

**Requirements** (`evals/requirements.json`). `LEVELS` (the existing one) is reworded: "Every goal has a level from its workspace’s list, the everyday level by default. The owner sets it; it is separate from what a goal feeds, and changes are logged."

- `LEVELS-SET`: "An admin sets the workspace’s levels: their names, how many (one to six) and their order. Renaming changes no goal. Removing a level in use moves its goals to a level the admin picks, keeps each review’s and watcher’s goals, and says all of it in counts first. A spreadsheet with a level’s earlier name still loads. Every change is logged and can be undone."
- `THRESHOLDS-SET`: "An admin sets what the numbers call on track, at risk, well ahead and a late stage, for the whole workspace. A change starts the following week, changes no status that day, and never re-reads a week already posted. The sheet shows a worked example and says, in counts, what the latest numbers would be offered. It is logged and can be undone."
- `YEAR-SHAPE`: "A workspace says which month its goal year starts in when it is set up, and every screen that names the year says so. A running year’s start can’t move. (CF5: an admin chooses whether the year is read in quarters, terms or halves; no plan, number or status changes.)"
- `STREAK-SET`: "With a check-in rhythm, an admin chooses whether each owner sees an on-time streak, and whether one late week is forgiven. Not shown, there is no streak anywhere. With no set rhythm there is none."

**Journeys** (phone and desktop, in the demo, as the person named):

| | Journey | Passes when |
|---|---|---|
| U130 | Amara renames two levels and adds one | Features → Levels: North star → Company, SVP → Division, Add "Group" above Division. The read-back says 12 and 44 goals read the new names; Save. Goals grouped by level shows Company · 12, Division · 44, Team · 70 (no Group: it has no goals); a goal's page says DIVISION; New goal offers four; Find "division" finds 44; an export from before the rename loads as "Nothing would change"; Activity has one entry; Undo restores all three names |
| U131 | Amara removes a level in use | Remove SVP: Save is disabled with "Choose where SVP’s 44 goals go."; choose Team; the read-back names Platform leadership weekly and the pinned view; Save. Team has 114; the review's agenda count is unchanged; a watcher's Watching count is unchanged; `/goals?level=svp` says "SVP isn’t a level here any more"; a sheet row with "svp" is Must fix with its sentence; one Undo restores 44 goals, the review's scope, the watches |
| U132 | Amara loosens on track to 90% | The table's "Would read" column changes as she types; 96 in At risk is Must fix; 90 asks its Check; the read-back says "From week 47" and "No status changes today"; Save. Goals' count line is unchanged; week 46's History rows are unchanged; with `today=2026-11-18` a check-in at 92% of plan is offered On track and stores it, while a week-46 check-in at 92% still reads At risk and its gap keeps its colour; the status key says "90%… Until week 46: 95%"; Undo before week 47 leaves no change |
| U133 | The streak, three ways; and the year says its month | As Amara, the rhythm's sheet → "one late week is forgiven": the read-back's "longer" count; as Tunde (late once in week 45 in a seeded demo) Home's streak is longer than under "Shown"; → "Not shown": Home's strip has no streak cell, the check-in's last screen no "weeks in a row", `get_my_work` no streak. About and Cycles say "January to December". (With CF5: halves; the chart's bands read H1, H2; a goal due at the end of Q3 reads "week 39 (21–27 Sep)"; Undo) |

**Checks:**

- **F27** (finish): in the demo seeded with levels Company, Group, Division, Team, on every route at both widths, none of "North star", "SVP", "north-star", "svp" appears outside History and Activity entries written before the change; with one level, no "Level" label, filter, sort or group anywhere. With the streak not shown: no "streak", "in a row", "weeks on time".
- **N28** (notes): a non-admin's `setLevels`, `setStatusRules`, `setStreak` are refused with their words; each sheet's counts equal `levelsReadBack`, `statusRulesReadBack`, `streakReadBack`; each Must fix and Check in 4.2 and 4.3 appears with its exact words; the four sheet addresses give the not-found page to a non-admin; the phone shows the read-back above Save.
- **P3/P4/P6** unchanged: the worked example's cells are a shape with its word; a level's tag is text with no fill (P6 gains "no filled level tag").

**CI:**

- `src/spec/conformance.test.ts` recomputes both sets.
- `scripts/check-settings.mjs`.
- A new job "Core journeys with other settings": `FARO_DEMO_SETTINGS=other` seeds the demo with four levels and 90/75 from week 30; the smoke gate runs with a `settings` array in `evals/touches.cjs` naming the journeys that assert a default word or number (those in the 13 eval files that name a level and the 5 that quote 95% or 80%: list them when CF1 lands).
- Unit tests: every table in section 2; each action's refusals; `rows.ts` round trip of a cycle with and without each field; `roundtrip.test.ts` with renamed levels.

## 10. If Lane decides otherwise

| Decision | Then |
|---|---|
| Names only, always three (README 1b) | CF2 without Add, Remove, Up and Down; no constraint dropped (the migration's `for` loop and `okr_goals_level_ok` go); `LevelDef` loses `removedAt`; U131 is dropped. CF1 unchanged |
| Levels stay in code (1c) | Build CF1 only (one file to edit, the lint) and say so in `before-you-build.md`. No migration for levels |
| A level with goals can't be removed (2b) | Remove is absent while a level has goals, with "Move its {n} goals first: Goals, filter by {name}, Change several". No review, watch or goal is written by `setLevels` |
| Retire, not remove (2c) | `LevelDef.retiredAt`: kept on its goals and in filters, not offered in New goal or the import for new rows. No goals move; the read-back is one line |
| Thresholds only at a year's start (3b) | The sheet is offered in week 0 and from the wrap-up for the next year only; `statusRules` is a single object; `rulesAt` ignores the week. The second conformance set uses week 0 |
| Thresholds stay in code (3c) | Drop CF3 and the `status_rules` column; keep `rulesAt` out; list the four in `before-you-build.md` |
| Forgiving is the default (4b) | `streak` defaults to `'grace'` in the type, `rows.ts` and the column; What's new says owners' streaks may be longer today; the demo script's streak numbers are re-read |
| On or off only (4c) | `streak` is `'on' | 'off'`; drop 2.5's grace rule and its examples |
| Halves and terms now (5b) | CF5 moves beside CF3; the Goal year row is drawn from the start |
| Levels asked at set-up (6b) | ST3 gains a third question, "What are your levels called?", three name fields filled with the defaults and "Add a level"; `buildWorkspace` takes `levels` |
| Keep the filled top-level tag (7b) | `.level-top` replaces `.level-north-star`, applied by `isTop`; P6 is unchanged |
| Kept on `Workspace`, not the cycle | As FT1's spec says for the rhythm: `okr_write` is replaced whole with `set search_path = faro, pg_temp` restated, about 40 call sites gain a parameter fed from `reads.ts`, and a past year reads by today's names and numbers (thresholds would then need their own dated history table). About a third more work, and worse for history |

## 11. Build plan

| Item | What | Effort | Depends on |
|---|---|---|---|
| **CF1** | Levels read from one place: `src/domain/levels.ts` with the defaults; every row of 2.1's table; `Level` becomes a string; `useLevels()` in `reads.ts`; the lint for levels; the level tag's one style. No behaviour changes but the tag and Watching's main button. `[no news]` apart from the tag (one What's new line) | S–M | AR4's `reads.ts` (merged). Best ridden with or straight after round 1's GL2 and the goal-entry form work (GE1), which edit the same files |
| **CF2** | Levels set by the workspace: `Cycle.levels`, the migration, `setLevels`, `levelsReadBack`, `levelProblems`, the sheet (4.2), 4.5 and 4.6, the import's words (2.3), addresses (2.4), the tools, the other-settings conformance set's levels half, U130, U131, F27's levels half, `LEVELS-SET`, Help's "levels" | M | CF1. FT2 or FT1 (whichever first draws "How you work" on Features; if neither is built, CF2 draws the group). IM1 (the field table: Level's words) and IM2 (Must fix and Check as data) if landed; else CF2 uses today's `Words` and adds its questions locally. GE1 |
| **CF3** | Status thresholds: `Cycle.statusRules`, `rulesAt`, the two signatures, `setStatusRules`, `statusRulesReadBack`, the sheet (4.3), `say(term, rules)`, the lint for `RULES`, the conformance set's thresholds half, U132, `THRESHOLDS-SET` | M | FT1 (it edits `thresholds.ts` and `status.ts` first: `staleCheckIns`, `rhythmOf`); CF2's migration file, or it carries the file. CK's correcting a past week (round 3) must judge by that week's rules: whichever lands second adds the test |
| **CF4** | The streak: `Cycle.streak`, the grace rule, `setStreak`, `streakReadBack`, the three choices in the rhythm's sheet and its address, U133, `STREAK-SET` | S | FT1 (the sheet). HM (round 3's Home) for the strip closing up |
| **CF5** | How the year is read: `Cycle.parts`, `quarters()` and `partWord`, `setYearParts`, the Goal year row and sheet, set-up's "Read in", the rest of `YEAR-SHAPE` | S–M | ST3 (set-up's step); CY (round 3's cycle end reads quarter results). Only when a team asks |
| **CF6** | The kit: `before-you-build.md`, the completed numbers table, `MIN_REASON` moved into `thresholds.ts`. `[no news]` | S | Nothing. Can ride with CF1 |
| Showing the start month (About, Cycles: "January to December") | Round 1's `yearLine`, extended | S | Rides with CF2's Cycles lines |

Order: CF1 (and CF6) → CF2 → CF3 → CF4; CF5 later. Each item is its own PR, with its SQL (CF2, or the first of CF3 and CF4 to land) in the description, its section of `spec/`, its conformance rows and the kit's pages, per `CLAUDE.md`. No item adds a module, so none adds a rebuild stage; each extends stage 1's drill.
