# Build spec: more switches

11 November 2026. For a build session. The reasons and the evidence are in [README.md](README.md); this says what to build. Nothing here is built. Items SW1 to SW8, journeys U126–U129, checks F26 and N27, requirements `WATCHING-OPTIONAL`, `AI-ACCESS-OPTIONAL`, `FEEDBACK-OPTIONAL`, `MAP-OPTIONAL`, `WRAP-UP-OPTIONAL` (take the next free number if another build has used one).

Read first: `CLAUDE.md`, `docs/design-rules.md`, `docs/architecture.md` ("Switching per workspace", "Adding a module"), and round 2's `docs/design/feature-toggles/spec.md`, which this builds on. Its FT2 brings four things every item here uses and none repeats: the read-back for a module that owns records (its 4.2), the "switched off" line at a module's address (its 3), the grouped Features page (its 4.1) and "one answer, in one place" (`src/app/reads.ts`, its 1.2).

## 0. Words

Round 2's words stand ("Switch off", "Switch on", "{Name} is off in {workspace}"; never "toggle", "enable", "disabled"). Added:

| Say | Never |
|---|---|
| **Watching** (the feature, the tab, the switch); **Watch**, **Watching** (the button); **a watch** (the record) | "follow", "subscribe", "watchlist" |
| **AI access**; **MCP token**, then **token** | "integrations", "API access", "bots", "key" |
| **AI tool** ("Claude or another AI tool") | "assistant" in new wording, "agent" |
| **Feedback** (the feature, the menu row, the switch); **a markup**; **the builders' inbox** when it must be told apart from the workspace | "Markup and inbox", "tickets", "bug report" |
| **Goal map** (the switch and Help); **Map** (the control on Goals) | "canvas", "graph", "tree view" |
| **Wrap-up** (round 3's word); **carry on**, **stop** | "retro", "retrospective", "close out" |
| **kept** (of records while a switch is off) | "archived", "paused", "suspended" |
| **works again**, **stops working** (of a token) | "reactivated", "disabled" |

## 1. Modules, data and who may (R1)

No new field and no migration. A switch is the module's id in `Workspace.modulesOff` (`okr_workspaces.modules_off`, migration 0030), changed by `setModule` (`src/domain/actions.ts`: admins only, "Only admins can switch features on or off.", logged "Switched off Watching"), from Features or the `set_feature` tool. `setModule` refuses an id with no manifest, so each item adds its `module.json` first.

### 1.1 The manifests

Ids never change. Summaries are the Features page's sentences (4.1).

| Id | Name | `tables` | `aiTools` | `requirements` | `journeys` | `help` |
|---|---|---|---|---|---|---|
| `watching` | Watching | `okr_watches` (0006) | `list_watching`, `watch`, `unwatch` | `WATCHING`, `ONE-WATCHING`, `WATCHING-OPTIONAL` | U7, U8, U9, U16, U31, U126 | `watching` |
| `ai-access` | AI access | `okr_api_tokens` (0010) | `list_tokens`, `create_token`, `revoke_token` | `MCP-TOKENS`, `TOKENS-SERVER-ONLY`, `AI-ACCESS-OPTIONAL` | U22, U62, U127 | `ai` |
| `feedback` | Feedback | `okr_markups`, `okr_markup_ids`, `okr_builders` (0024), `okr_feedback` (0007), and `okr_research_notes` (0014) with the research page | `list_markups`, `get_markup`, `review_inbox`, `update_markup`, `list_feedback`, `get_feedback`, `update_feedback`, `send_feedback` | the eight in the area "Feedback", `MCP-PICTURES`, `MCP-FEEDBACK`, `FEEDBACK-OPTIONAL` | U40, U41, U42, U47, U51, U52, U53, half of U128 | the inbox's and markup's articles |
| `goal-map` | Goal map | none | none | `GOAL-MAP`, `MAP-OPTIONAL` | U26, U30, U34, F6, half of U128 | `map` |
| `wrap-up` | Wrap-up | `okr_retros` (0007) | `get_wrap_up`, `wrap_up_goal` | `RETRO`, `WRAP-UP-OPTIONAL` | U10 | `wrap-up` |

- `needs` is `[]` in all five.
- `MCP-PARITY` stays the core's: with AI access off the tools still exist for every screen; the door is shut.
- `CARRY-OVER` stays the core's.
- While a module's code is in the core, `elsewhere` lists every such file (make the list with the search named in README 1.2 to 1.6, keep it exact; the manifest test checks each exists) and `rebuild.status` is `outline` with the gap "its code is still in the core: see elsewhere". A moved module has `elsewhere: []`.
- `U80` and `U16` name more than one feature; a journey that needs two modules is listed by both and left out when either is.

### 1.2 One answer each, in one place

`src/app/reads.ts` gains, beside round 2's `reviewsOn`:

```ts
watchingOn(modulesOn: Set<string>): boolean
aiAccessOn(modulesOn: Set<string>): boolean
wrapUpOn(modulesOn: Set<string>): boolean
```

Screens get them from `useModules()`; rules that need one take a boolean parameter. No other file tests the strings. (Feedback and the Goal map are real moves and need no such answer.) Each is deleted by its move (SW6, SW7, SW8).

### 1.3 Actions that refuse while a module is off

As a module's tools do, with the same sentence, "{Name} is off in {workspace}.":

| Module off | Actions that refuse |
|---|---|
| Watching | `watch`, `unwatch` |
| AI access | `createToken` (revoking stays allowed: `revokeToken` works while it is off, so a token can be ended for good) |
| Wrap-up | `saveRetro` |

`startNextCycle` never refuses for the Wrap-up being off (2.4).

### 1.4 Who sees and does what

| | Admin | Everyone else | Enforced by |
|---|---|---|---|
| Workspace → Features | Sees it; switches | Not in their menu | `sectionsFor`; `setModule` |
| The read-back | Sees it | Never | It is on Features |
| A token, while AI access is off | Listed only in the read-back’s “See the {n} tokens” sheet, where each can be revoked | Their own: not shown | `revokeToken` (an admin, or the token’s person) |
| The server, AI access off | Refuses every token of the workspace | The same | `server/mcp.ts` (6.1) |

No permission is added. The "See the 3 tokens" sheet is the one place a switched-off module's records are shown, to an admin, in the act of switching: it exists so that "off" never leaves an admin unable to revoke.

## 2. Rules in `src/domain` that change

Each worked example becomes a unit test and, where marked ◆, a conformance row or a `src/spec/rules.ts` example. New rules take only what they read (AR4).

### 2.1 The tree rules leave `review.ts` (SW1, `[no news]`)

- `src/domain/scope.ts` (new, core): `treeOf`, `goalsIn`. Reviews and Watching both use them.
- `src/domain/watch.ts` (new): `watchScope`, `watchedGoals`, `watchOf`, `coveringWatches`. `review.ts` re-exports all six for one release.
- This replaces round 2's "all seven to `watch.ts`" (`dayText` still goes to `format.ts`).

### 2.2 Home's lead, as one chain (`home.ts`; SW3)

```
homeLead(viewer facts, opts: { reviews: boolean; watching: boolean }): Lead
  1. an owner with check-ins due, or the wrap-up open        → the core's, as today
  2. reviews on, and the viewer is in a review with goals    → the review's ("20 goals to discuss · Open the review")
  3. watching on, and the viewer watches goals needing attention → "Goals you watch" · "20 need attention" · See them
  4. the viewer owns no goal, and any goal needs attention   → "{n} goals need attention" · See them → /goals?show=all&attention=1
  5. the viewer owns no goal                                 → "You don’t own a goal." · See all goals → /goals?show=all
  6. otherwise                                               → none; Home starts at "Needs your response"
```

It takes counts (`reviewToDiscuss`, `watchedNeeding`, `allNeeding`, `owns`), not the workspace. With FT3 and SW6, steps 2 and 3 become the modules' `home.lead` and the core keeps 1, 4, 5, 6.

| Given (week 46, the demo) | Reviews on, Watching on | Reviews off | Watching off | Both off |
|---|---|---|---|---|
| ◆ Amara: owns none; in a review with 20 to discuss; watches 56, 20 needing; 41 need attention in all | the review's | "Goals you watch · 20 need attention" | the review's | "41 goals need attention" |
| ◆ Oskar: owns none; in no review; watches 3, none needing; 41 in all | "41 goals need attention" | the same | the same | the same |
| ◆ Rhea: 5 check-ins due | "5 check-ins to do" | the same | the same | the same |
| ◆ Oskar, in a workspace where nothing needs attention | "You don’t own a goal." · See all goals | the same | the same | the same |

The second row changes today's screen with everything on: Oskar's lead is now the workspace's goals that need attention, and "Find goals to watch" is the Watching block's empty-state button, below (4.4). Today his lead is "You don’t own a goal. Watch the ones you care about, or set one up in about 3 minutes."

### 2.3 Goals' tabs (`goalsPage.ts`; SW3)

- `scopesFor(f, last, opts: { watching: boolean })`: with `watching` false there is no Watching tab, and `opens` is `mine` when the viewer owns any, else `all`.
- `SCOPES` stays as it is (a stored "last scope" of `watching` falls through to the rule above).
- `movedGoals` (the old `/watching` address): with Watching off it is not applied; the address is the module's and gets the "switched off" line (3).

| Given | Watching on | Watching off |
|---|---|---|
| ◆ Amara, last opened Watching | tabs My team 1 · Watching 56 · All 126; opens Watching | tabs My team 1 · All 126; opens All |
| ◆ Rhea, last opened Mine | Mine 8 · My team 17 · Watching 12 · All 126; opens Mine | Mine 8 · My team 17 · All 126; opens Mine |

### 2.4 Ending a year without the Wrap-up (`cycle.ts`, `actions.ts`; SW8, with the cycle-end area)

```ts
nextCycle(old, goals, checkIns, stops: ReadonlySet<Id>, ids, now)      // was: retros
carryPlan(goals, checkIns, stops, cycle, today): { carry: Id[]; done: Id[]; stopped: Id[] }
```

- `stops` is the goals not to carry. The caller builds it: with the Wrap-up on, every goal whose wrap-up says "stop"; with it off, the empty set.
- **A done goal does not carry**, on or off, unless its wrap-up says "carry on" (today it carries by default: README S3). `carryPlan` is the read-back for "Start 2027" and the cycle-end area's to word.
- `startNextCycle(x, opts: { wrapUp: boolean })`: unchanged checks (an admin; the last two weeks). It does not require wrap-ups, as today; the screen's read-back says how many are still to wrap up while the Wrap-up is on.

| Given (week 52; 126 goals: 8 done, 3 with a wrap-up saying "stop", 115 others) | Wrap-up on | Wrap-up off |
|---|---|---|
| ◆ `carryPlan` | carry 115, done 8, stopped 3 | carry 118, done 8, stopped 0 |
| ◆ One of the 8 done goals has a wrap-up saying "carry on" | it carries: 116 | 118 (the wrap-up is not read) |

### 2.5 The read-backs (`switchOffReadBack(moduleId, reads)`, round 2's rule)

In the module's folder once moved; until then in `src/domain/watch.ts`, `src/domain/actions.ts` (tokens) and `src/domain/cycle.ts`. Each returns counts only.

| Module | Counts |
|---|---|
| Watching | `people`: people with a live watch; `watches`: live watches; `seeThrough`: of those people, the ones who own no live goal |
| AI access | `tokens`: tokens not revoked, with each one's person and name; `changes`: entries in the change log made through MCP (`via` is `mcp`) |
| Feedback | `sent`: markups and feedback sent from this workspace; `open`: of those, the ones not closed. Asked of the module's own store; when it can't be reached, the lines with counts are left out and the sheet still shows |
| Wrap-up | `written`: wrap-ups in the running year; `stops`: of those, the ones saying "stop"; `open`: whether the wrap-up is open now |
| Goal map | `views`: saved views not deleted whose address has `view=map` (for the toast) |

`switchOnReadBack('ai-access', reads)`: the same `tokens` list. Any other module: nothing (it acts at once).

| Given | Then |
|---|---|
| ◆ 3 people watch: A a level (covering 40 goals), B two goals, C one tree; C owns no goal | `people` 3, `watches` 4, `seeThrough` 1 |
| ◆ 3 tokens, one revoked | `tokens` 2 |
| ◆ 4 saved views, one deleted, two with `view=map` (one of them the deleted one) | `views` 1 |

### 2.6 Smaller changes

- `goalPage.ts` `standingAction(o)`: `watching` becomes `boolean | null`; null (the module off) gives no Watch button for anyone but the owner. ◆ As Oskar on Diego's goal: on → "Watching"; off → none.
- `dayOne.ts` `gettingStarted`: the row `watch` is made only with `watching: true` in its facts.
- `home.ts` `dashboard(…, opts)`: `watching` is null when the module is off.
- `activity.ts`: `parseActivity` drops `watching` when the module is off; the filter line says once, "Watching is off here, so this shows every goal. Clear". (S12)
- `query.ts` / `GoalsScreen`: `view=map` with the Goal map off or not installed opens the List and says once, "The Goal map is off here, so this is the List." It is the rule that already handles a layout that was removed (`GONE_LAYOUT`), given a list of layouts that are on.
- `navigation.ts`: no change for Watching (it has no menu row). `menuGroups` puts a module's item with `group: 'you'` after Help. ◆ One `navigation.csv` row: Feedback off, the last group is Workspace, Settings, Help.
- `workspaceAttention.ts`, `removal.ts`, `cycle.ts` `scopeToCycle`: unchanged. A person who leaves still loses their watches and tokens while the module is off (the records are kept true).

## 3. Routes and redirects

| Address | When its module is off |
|---|---|
| `/watching` | Not found, with "**Watching is switched off in {workspace}.** An admin can switch it on in Workspace, Features." |
| `/goals?show=watching` | Goals, on the scope `scopesFor` opens; the filter line says once, "Watching is off here. Showing {All}." |
| `/goals/:id` | Unchanged address; the page without its Watch button |
| `/activity?watching=…` | Activity without that filter, with 2.6's sentence |
| `/workspace/ai` (new with SW2: the section's address) | Not found, with the line for AI access |
| `/workspace/access` | Admins only; no token list |
| `/settings#tokens`, `/workspace?tokens` (old anchors) | The page, with nothing to scroll to |
| `/feedback`, `/workspace/inbox` | Not found, with the line for Feedback |
| `/goals/map` (new with SW5) | Not found, with the line for Goal map |
| `/goals?view=map` | With the module on: leads to `/goals/map` with the rest of the address kept. Off: the List, with 2.6's sentence |
| `/retro`, `/retro/:goalId` | Not found, with the line for Wrap-up |
| `/help/{article}` of an off module | Hidden from Help; the address gives the line |

The "switched off" line is round 2's (feature-toggles spec 3), unchanged: it needs each address in a manifest's `routes`. An honest switch therefore lists its routes in `module.json` while the route's code is still in `src/App.tsx`, and `src/App.tsx` leaves those routes out when the module is off.

**New redirects** (module.json `redirects`): `feedback`: `["/workspace/inbox", "/feedback"]` (moves from `src/App.tsx`). `goal-map`: none as a path (the `view=map` rule above is Goals').

## 4. Screens

Off means absent: no empty block, no greyed control, no sentence about what is not there, except at an address someone asked for by name, and in the read-back.

### 4.1 Workspace → Features (`/workspace/features`, admins). Wireframe 1

In order:

1. Heading "Features". Under it: "How {workspace} works, and the optional parts of Faro. They apply to everyone here." (round 2)
2. Group **"How you work"**: the settings (round 2's Check-in rhythm; the settings area's rows). Each says what is set and offers "Change". No switch is in this group.
3. Group **"Working together"**: Reviews, Watching, Wrap-up.
4. Group **"Tools"**: Metric library, Spreadsheets, Goal map.
5. Group **"Beyond this workspace"**: AI access, Feedback.
6. Under the lists: "Switching one off hides it and keeps what it saved. Recording how the app is used is under Privacy. About features" (two links).

A row: the name; the summary; a third line while it is on and its count is above zero; at the right the switch and its word, "On" or "Off". A module off because another is: "Off until {X} is on." (exists; unused, since no module needs another).

| Module | Summary (`module.json`) | Third line |
|---|---|---|
| Reviews | Walk a set of goals together on a cadence, decide what happens next and keep what was said. | "{n} reviews are set up." |
| Watching | Follow goals you don’t own: they show on your Home and under Watching in Goals. | "{n} people watch goals here." (1: "1 person watches goals here.") |
| Wrap-up | At the end of the year, each owner says how their goals landed and what they learned. | Before it opens: "Opens on {21 Dec 2026}." Open: "Open now: {n} of {m} goals wrapped up." |
| Metric library | Define each number goals are measured by once, and say which metric measures a goal. | "{n} metrics measure {m} goals." |
| Spreadsheets | Download the goals as Excel or CSV, and load changes back from a spreadsheet. | none |
| Goal map | See every goal and what feeds it on one canvas, with the path the risk runs along. | none |
| AI access | Let Claude or another AI tool read and act here through MCP, as one person, with that person’s rights. | "{n} tokens are in use." (1: "1 token is in use.") |
| Feedback | Send feedback about Faro, or mark up a screen. It goes to the people who build Faro. | "{n} sent from here." |

- Which group a module is in: a new optional field of `module.json`, `group`: `together`, `tools` (the default) or `beyond`. It is a word for the Features page only.
- The third line comes from the module (`says` on its section, or, for a module with no section, a new optional `says(reads)` on `AppModule`, the same shape `WorkspaceSection.says` has). Until a module is moved, the core supplies it beside its `…On` answer.
- A group with no installed module is not drawn. With no module installed: group 2 only.
- States: while a switch is saving, every switch is disabled (as today). A refused switch shows the rule's words as today's toast.
- One primary action: none on the page.
- Phone: one column; the switch and its word on their own line under the text, 44 px high.

About's fact line (round 2) lists what is on by group order: "Check-ins every week, due by Thursday. Reviews, Watching, Wrap-up, Metric library, Spreadsheets, Goal map, AI access and Feedback are on. Features". With more than four on, it says: "All eight optional features are on." or "Six of eight optional features are on: all but Goal map and Feedback."

### 4.2 The read-backs. Wireframe 2

Round 2's sheet: title, "For all {n} people here:", lines each shown only when its count is above zero, "Cancel" and the primary button. Escape and Cancel change nothing. After: the toast "{Name} is off in {workspace}. Nothing it saved is lost." with **Undo**; Undo says "{Name} is back on."

**Watching** — title "Switch off Watching in {workspace}?"; primary **"Switch off Watching"**:

- "**Watching leaves Goals, Home and every goal’s page**: the Watching tab, “Goals you watch” and the Watch button."
- "**{31} people’s {74} watches are kept.** Nobody is shown as watching while it is off."
- "**{12} people own no goal and see Home through what they watch.** Their Home will show every goal that needs attention instead." (1: "**1 person owns no goal and sees Home through what they watch.** …")
- "**Goals don’t change.** Each is still on its owner’s Home, in Goals and in its reviews." ("and in its reviews" only while Reviews is on)
- "Nothing is deleted. Switch Watching back on and each person watches what they did."

With no watch at all, it acts at once (nothing would be said).

**AI access, off** — title "Switch off AI access in {workspace}?"; primary **"Switch off AI access"**; a quiet button "See the {3} tokens":

- "**{3} tokens stop working at once**: {Amara Nwosu’s “Claude on my laptop”, Rhea Kapoor’s “Claude”, Hamid Rezaei’s “Weekly brief”}." (more than five: the first five, "and {n} more")
- "**They are kept, not revoked.** Switch AI access back on and they work again. To end one for good, revoke it first."
- "**What AI tools already changed stays**, marked “via MCP” in Activity: {212} changes."
- "**An AI tool can’t switch this back on.** An admin does, here."

With no token, it acts at once.

**AI access, on** — only when tokens were kept. Title "Switch AI access back on in {workspace}?"; primary **"Switch on AI access"**; "See the {3} tokens":

- "**{3} tokens made before will work again at once**: {…}."
- "Each lets an AI tool act as that person, with that person’s rights. Every change is logged as theirs, marked “via MCP”."
- "To stop one for good, revoke it first."

"See the {n} tokens" opens, over the sheet, the list as Access shows it today (person, name, made, last used, **Revoke**). Closing it returns to the sheet with its counts worked out again.

**Feedback** — title "Switch off Feedback in {workspace}?"; primary **"Switch off Feedback"**:

- "**Feedback leaves the menu**, with “Send feedback” and “Mark up this screen”."
- "**{14} things people here sent stay in the builders’ inbox**; {5} are still open. The people who build Faro still see them and can answer."
- "Nothing is deleted."

With nothing sent from here, it acts at once.

**Wrap-up** — title "Switch off the Wrap-up in {workspace}?"; primary **"Switch off the Wrap-up"**:

- "**The wrap-up leaves Home, Goals and Cycles.** Owners aren’t asked how their goals landed." (while it is open: "… {17} goals are not wrapped up yet and won’t be asked for.")
- "**{41} wrap-ups already written stay** in each goal’s History."
- "**{6} goals were marked “Stop” at their wrap-up.** That is not used while it is off: stop them from their own pages if they shouldn’t carry on."
- "**The year still ends.** Results are worked out as before, and an admin starts {2027} from Cycles."

With none written and the wrap-up not open, it acts at once.

**Goal map** — acts at once (it owns nothing). Its toast: "Goal map is off in {workspace}." and, when `views` is above zero, "{2} saved views that opened the Map now open the List." with Undo.

### 4.3 The menu and the phone. Wireframe 3

| Everything on | Everything off |
|---|---|
| Home, Check-in, Goals, Reviews · People, Metrics, Activity, Data · New goal · Workspace, Settings, Help, Feedback | Home, Check-in, Goals · People, Activity, Data · New goal · Workspace, Settings, Help |

- Watching, AI access, the Goal map and the Wrap-up have no menu row; switching them changes no row.
- Phone tabs: round 2's rule for Reviews. More lists what the tabs don't hold; with Feedback off its last group is Workspace, Settings, Help.
- Find: no "Watching" shortcut, and no group, for a module that is off (finders already follow their module).
- The Help dot and What's new are unchanged.

### 4.4 Home. Wireframe 3

| Part (in order) | Change |
|---|---|
| The strip | Round 2's rule: as many cells as it has. No change here |
| The lead | 2.2's chain. One primary action in every case, or none in case 6 |
| The wrap-up's lead (last two weeks) | Only while the Wrap-up is on. Off, an owner's lead is the check-ins as in any other week; an admin sees, in About's "To sort out" and on Cycles, "{2026} ends on {27 Dec}. Start {2027} when you’re ready." |
| Needs your response | Unchanged |
| Your goals | Unchanged |
| **Goals you watch** | Only while Watching is on. When the viewer watches nothing: the block is not drawn for an owner; for someone who owns nothing it is drawn once, with "Watch the goals you care about, and they’ll show here." and the button "Find goals to watch" (an ordinary button; the lead above holds the primary) |
| Getting started | No "Watch the goals you care about" row while Watching is off |
| "New: …" | Unchanged |

### 4.5 Goals

- Tabs: 2.3.
- The layout control: List, Table, Board, History. With the Goal map on, "Map" follows them, drawn by the module in `goals.tools`, and leads to `/goals/map` with the address's filters.
- The bulk bar: no "Watch" (it becomes the module's "Watch these {n} goals" in `goals.tools`, for the goals shown, with SW6; until then it is hidden by `watchingOn`).
- "Wrap up" in the head (last two weeks): only while the Wrap-up is on.
- Saved views: unchanged, but for 2.6's two sentences.

### 4.6 A goal's page. Wireframes 4 and 5

| Part | Watching off | Wrap-up off | Feedback off |
|---|---|---|---|
| The bar | No "Watch" or "Watching". Someone who isn't the owner and has nothing asked of them has "More" alone | No "Wrap up this goal" | — |
| The summary | No "Watched by …" line | — | — |
| Next steps and asks | Unchanged | Unchanged | Unchanged |
| History | Unchanged | Wrap-ups already written stay as entries ("Rhea wrapped it up: partly"); the filter "Wrap-ups" shows while it has any | Unchanged |
| About | "Its definition and its plan week by week." (no "and who watches it"; no "Watched by" list) | — | — |
| Who a comment reaches | The owner, and people named in it (no "and the {n} people watching") | — | — |
| Over the page | — | — | No sheet; Ctrl+Shift+M does nothing |

With Watching on, after SW6: "Watched by {Amara Nwosu and 4 more}" is one line in the summary (`goal.facts`), a link that opens the list; About no longer mentions it.

### 4.7 People, Activity, Settings, Access, Cycles, Help

- **People:** a person's page and sheet say "watches {12}" only while Watching is on. A person's tokens (the sheet's "Make a token", the list) only while AI access is on.
- **Activity:** entries are never hidden: "started watching…", "made a token…", "wrapped up…" stay as written. A kind's filter shows while its count is above zero (round 2's rule for Reviews).
- **Settings:** no "Your MCP tokens" while AI access is off. With SW7 the block leaves Settings for good and becomes a line, "Your MCP tokens are on your page in People.", shown while it is on.
- **Workspace → Access:** "Admins" only, while AI access is off; its summary becomes "Who the admins are." With SW2 the tokens move to their own section, **AI access** (`/workspace/ai`, after Access, admins): "The MCP tokens that let an AI tool act as someone here." and the list as today.
- **Cycles:** the running year's row. Wrap-up on: as today. Off: "{2026} ends on {27 Dec 2026}." and, for an admin in the last two weeks, **Start {2027}**, which opens `carryPlan`'s read-back (the cycle-end area words it): "{118} goals carry on, starting from where they ended. {8} are done and don’t."
- **Help:** a module's articles are hidden when it is off (exists). The topic lists close up. "What you raised" is Feedback's and goes with it.

### 4.8 Set-up

No new question. The last step's read-back gains one line after round 2's two: "**Everything else** optional is on: Watching, the wrap-up, the Metric library, Spreadsheets, the Goal map, AI access and Feedback. An admin can change that in Workspace, Features." (only the installed ones are named).

## 5. Extension points

| Item | Addition | Typed in | User |
|---|---|---|---|
| SW1 | `ModuleFacts.group?: 'together' \| 'tools' \| 'beyond'` | `src/core/module.ts` | The Features page |
| SW1 | `ModuleLink`: draws its children only while the named module is on | `src/core/app.tsx` | "Connect Claude"; the Metrics sheet's entry |
| SW1 | `AppModule.says?(reads): string \| null` (a module with no section says its third line) | `src/core/app.tsx` | Watching, Feedback |
| SW4 | `ModuleNav.group` gains `'you'` | `src/core/app.tsx`, `navigation.ts` | Feedback |
| SW4 | Place **`shell.layer`**: `{ path: string }`, drawn once by the shell over every page | `PLACES`, `PlaceProps` | Feedback (the sheet, the markup, the key) |
| SW6 | `ModuleFilter.tab?: true` and `pick: 'viewer'`: a filter whose value is the person looking, shown as a tab on the list | `src/core/app.tsx` | Watching |
| SW6 | Place **`goal.actions`**: `{ goal: Goal; owner: boolean }`, a plain button on a goal's bar, after the core's | `PLACES`, `PlaceProps` | Watching; the Wrap-up (SW8) |
| SW6, SW7 | Records (AS part 2), as round 1 gives it. SW7 adds "a field the store transforms on the way in" for a token's secret | `records.ts` | Watching, AI access |
| SW6, SW8 | `home.lead` (FT3's) | | Watching, the Wrap-up |

Not added, on purpose: a module's row in day one; a module's filter on Activity; a "settings" place (a person's own things are on their page in People); a module's Activity kind; a way for a module to add to a core tool's answer (`get_my_work` loses its watching and wrap-up parts when they move, and its text points at `list_watching` and `get_wrap_up`).

**The layers lint** gains two lines with SW4: a module may own a port (`src/modules/<id>/ports.ts`) that only it and `src/adapters` import; and `src/ui/Shell.tsx` imports nothing from `src/modules` (it draws `shell.layer`).

## 6. AI tools (MCP)

### 6.1 The door (SW2)

`server/mcp.ts`, where the workspace and its `modulesOff` are already loaded for the token: when `ai-access` is installed and off, every request but `initialize` and `tools/list` is answered with an error whose text is "AI access is switched off in {workspace}. An admin can switch it on in Faro, under Workspace, Features." `tools/list` returns the tools as usual, each call then refusing, so a connected tool learns why and does not see an empty server. The token's `lastUsedAt` is not updated by a refused request. In a build without the module (`FARO_WITHOUT=ai-access`) there is no switch to shut the door, so the server stays open: the core's own tools answer through it (`MCP-PARITY` is the core's), and only the token tools, which are the module's, are missing. Only a workspace's switch shuts the door.

### 6.2 Tool by tool

| Tool | When its module is off |
|---|---|
| `list_watching`, `watch`, `unwatch` | Refused by `callTool`, as any module's tool: "Watching is switched off in {workspace}…" |
| `get_my_work` | No `watching` key; the text has no "Watching" part. With the Wrap-up off, no `wrapUp` part |
| `get_goal` | No `watchedBy` |
| `get_activity` | `watching: true` is refused: "Watching is off here. Leave it out to see every goal." |
| `list_tokens`, `create_token`, `revoke_token` | Unreachable (the door is shut). After SW7 they are the module's |
| `get_wrap_up`, `wrap_up_goal` | Refused: "Wrap-up is switched off in {workspace}…" |
| `start_next_cycle` | Works. Without `confirm: true` it returns `carryPlan` as text and changes nothing (a dry run, new with SW8); with it, it starts the year |
| The seven inbox tools and `send_feedback` | Refused: "Feedback is switched off in {workspace}…" |
| `find_goals` | `view=map` in a query is ignored (it never drew anything) |
| `describe_system`, `get_overview` | List what is on, by the Features page's groups |
| `set_feature` | Works for every id. Switching `ai-access` off through it succeeds and is the last thing that token does; its answer says "AI access is off in {workspace}. This connection stops working now. An admin switches it back on in Faro." Switching it on can't arrive |

`src/mcp/parity.ts`: `Watching` → `list_watching`; the new `Features` rows stay `set_feature`. Run `npm run build:mcp` and commit `api/mcp.js`.

## 7. Migration

**None**, for any item. `okr_workspaces.modules_off` (0030) already holds any id; the server already reads it (`src/adapters/supabase/server.ts:79–81`); no table, column, function or grant is added or moved. A moved module's tables keep their names and their migrations; `module.json` `tables` only names them.

To check before SW6 and SW7 write code (round 1's AS part 2 says the same): whether `okr_commit` names `okr_watches` and `okr_api_tokens`, or takes rows by table from an allowed list. If it names them and the records extension point needs the list, that one migration is AS part 2's, not this design's.

## 8. Help, What's new, the spec

- **What's new** (top of `src/help/whatsNew.ts`), one entry per item that people can see:
  - SW1: "Features is in groups, and says what each feature holds. Workspace, Features."
  - SW2: "AI access can be switched off for a workspace. Tokens stop working at once and are kept; switching it back on names them first."
  - SW3: "Watching can be switched off for a workspace. Everyone’s watches are kept for when it comes back."
  - SW4: "Feedback can be switched off for a workspace. What was sent stays with the people who build Faro."
  - SW5: "The Goal map has its own page, and can be switched off for a workspace."
  - SW8: "The wrap-up can be switched off for a workspace. The year still ends, and an admin starts the next one from Cycles."
  - SW6, SW7: `[no news]` (moves).
- **Guide** (`src/help/guide.ts`):
  - "features": the four groups; for each switch, what it hides and what it keeps; that a switch that owns something says what it will do first; that AI access asks again before it comes back on.
  - "home": the lead for someone who owns no goal (2.2), written as what is there.
  - "goals": tabs "whose goals"; the Map as a page of its own (SW5).
  - "watching", "ai", "wrap-up", "map", the inbox's and markup's: each gains `module:` until it moves into its module's `help.ts`.
  - "cycles": starting the next year without a wrap-up.
  - New route `/workspace/ai` needs its article (the "ai" article takes it); `/goals/map` is the "map" article's.
- **The spec** (`npm run spec`, never by hand): `src/spec/rules.ts` gains the ◆ examples under `navigation`, `goals-page`, `workspace` and a new page `home-lead`; `spec/modules/<id>/` appears for each manifest; `spec/core/rules/map.md` splits: the roll-up stays core, the drawing rules go to `spec/modules/goal-map/rules.md` (SW5).
- **The rebuild kit:** a stage per module from `rebuild` in its manifest: `stage-N-module-watching.md` and the rest, outline first. Watching's becomes a drill with SW6 (conformance: what each person's watches cover, for every person in the demo; the tab's ids). `spec/rebuild/README.md`'s "don’t copy" list gains: the demo, its walkthroughs, the research page, the Motion lab. `ports-at-scale.md`: "which modules are on is part of what a query is asked with; a module's tab is a column of the summary row".

## 9. Evals

**Requirements** (`evals/requirements.json`):

- `WATCHING-OPTIONAL`: "An admin switches Watching off for a workspace. Off, there is no Watching tab, no “Goals you watch”, no Watch button and no watching tool; someone who owns no goal is led to the goals that need attention. Every watch is kept, and switching it on restores each person’s."
- `AI-ACCESS-OPTIONAL`: "An admin switches AI access off for a workspace. Off, the server refuses every token of that workspace with a sentence saying why, and no screen offers a token. Tokens are kept, not revoked. Switching it back on names the tokens that will work again before it acts."
- `FEEDBACK-OPTIONAL`: "An admin switches Feedback off for a workspace. Off, there is no Feedback in the menu, no way to send feedback or mark up a screen, and no inbox tool. What was sent stays in the builders’ inbox."
- `MAP-OPTIONAL`: "An admin switches the Goal map off for a workspace. Off, Goals offers no Map, and a link or saved view that asked for it opens the List and says so."
- `WRAP-UP-OPTIONAL`: "An admin switches the Wrap-up off for a workspace. Off, nobody is asked how a goal landed; results are worked out as before; an admin starts the next year from Cycles after reading how many goals carry on. Wrap-ups already written stay in History."

**Journeys** (phone and desktop, in the demo, as the person named):

| | Journey | Passes when |
|---|---|---|
| U126 | Amara switches Watching off, and on | The read-back's three counts equal `switchOffReadBack`; after: Goals has no Watching tab for Amara, Rhea or Oskar, Home has no "Goals you watch", Diego's goal has no Watch button as Oskar and About has no "watches"; Oskar's lead is "41 goals need attention · See them"; `/watching` says "Watching is switched off in…"; Undo, then Oskar's Home shows "Goals you watch 3" again |
| U127 | Amara switches AI access off, and on | (In `/?store=browser`, with a token made first.) The read-back names the token; after: Access shows admins only, Settings has no token block, a call with the token is answered "AI access is switched off in…", Activity keeps its "via MCP" entries; switching on shows the read-back naming the token; after it, the same call works |
| U128 | Feedback and the Goal map off | No Feedback row on desktop or in More; Ctrl+Shift+M opens nothing; `/feedback` says the line; Goals' layouts are four; a saved view made on the Map opens the List with "The Goal map is off here…"; both back on, the view opens the Map |
| U129 | The smallest Faro | Every installed module off: the menu is the ten rows of 4.3; Rhea checks in on one goal and answers Daniel's question; Amara's Home leads with "41 goals need attention" and "See them" lists 41; a goal's page has the parts of wireframe 4 and no other; every module back on, Home, Goals and the menu are as before the journey |

U129 is in the quick gate and runs in every build.

**Checks:**

- **F26** (finish): for each module in turn, off, on every route at both widths, none of its words appears outside History and Activity entries. Watching: "Watch", "Watching", "watches". AI access: "token", "MCP" (but for "via MCP" in Activity). Feedback: "Feedback", "Mark up", "markup". Goal map: "Map". Wrap-up: "Wrap", "wrap-up". And nothing on any page is disabled or greyed for a module's sake.
- **N27** (notes): each read-back's counts equal its rule; a non-admin's `setModule` is refused with its words; the server's refusal with AI access off, and that `lastUsedAt` did not move; `watch`, `createToken` and `saveRetro` refuse while off; every file in every `elsewhere` exists; no file outside `src/app/reads.ts` tests a module's id as a string (a search over `src/` for `'watching'`, `'ai-access'`, `'wrap-up'` beside `modulesOn` or `has(`).
- **P6** unchanged: the switch's word is beside it; the read-back's bullets are not status shapes.

**CI** (`.github/workflows/ci.yml`, `evals/run.mjs`):

- "Core journeys without <module>" comes with each folder, as today.
- New job **"Core journeys with every module off"**: `FARO_WITHOUT=all` (every folder in `src/modules` left out). It runs the spec scenarios, the core quick gate and P6.
- The quick gate's list splits: `SMOKE_CORE = ['U1', 'U2', 'U5', 'U33', 'U129']`, and each `module.json` may name `smoke` journeys added when it is present (`reviews`: U3; `watching`: U16). U2 and U33 are checked first for words that are a module's, and edited to read them only while it is on.
- `evals/touches.cjs`: a change to `src/app/reads.ts` or `src/domain/home.ts` touches U126 and U129.
- Unit tests: each table in section 2; the three refusals in 1.3; `resolveModules` with all eight (none needs another: switching any one off leaves the other seven on).

## 10. If Lane decides otherwise

| Decision | Then |
|---|---|
| Three switches (README decision 1b) | Drop SW5 and SW8, `MAP-OPTIONAL`, `WRAP-UP-OPTIONAL`, the Map half of U128. The Map stays a layout; `nextCycle` keeps reading wrap-ups |
| Two now (1c) | Build SW1 to SW3; the rest stay written here |
| None (1d) | Add to the handover's checklist a table "could be left out" with wireframe 6, and build 2.1 only |
| Feedback as two switches (2b) | Two manifests, `feedback` (sending: the sheet, the markup, the key) and `feedback-inbox` (the page, the seven tools), the second with `needs: ["feedback"]`: the first real use of `needs`. About a third more work in SW4 |
| Tokens revoked when AI access goes off (3b) | The read-back's second line becomes "**They are revoked and can’t be brought back.** New ones are made after it is switched on."; Undo in the toast can't restore them and says so; no read-back on the way on. Breaks "nothing is deleted" |
| On again with no read-back (3c) | Drop `switchOnReadBack`; the off read-back must then say "…and will work again the moment AI access is switched on, without asking." |
| A preset at set-up (4b) | A third question in set-up's "How you'll work": "What do you want to start with?" · **Everything** · **Just goals and check-ins** ("Watching, the wrap-up, the Metric library, the Goal map, AI access and Feedback start off. Spreadsheets stays on. An admin can switch each on later."). `buildWorkspace` takes `modulesOff`. The set-up area places it |
| AI access off by default (4c) | `buildWorkspace` starts `modulesOff` with `ai-access`; set-up's last line says "AI access is off. An admin can switch it on in Workspace, Features." The demo keeps it on |
| No `goal.actions` (5b) | The Watch control is a line in the summary through `goal.facts`: "Watched by 4 · **Watch**" (or "You and 3 others watch this · **Stop**"). Round 1's GT3 loses its plain button for someone who isn't the owner, whether Watching is on or off |
| The forecast as a switch (6b) | Not designed. It needs: `flagsFor` without `trend`; the vocabulary's "On track" without its last sentence; a second conformance set, as round 2's no-rhythm set; the scorecard with three cells. About the size of FT1, for less |
| The Wrap-up never (7b) | Drop SW8; build 2.4's "a done goal does not carry" with the cycle-end area anyway |
| Only the moves (8b) | SW2 and SW3 are dropped; SW6 and SW7 carry their screens' changes, after AS part 2 |
| CI split from the start (9b) | Pull requests: all on, all off, and the modules a change touches; main after merge: without each |

## 11. Build plan

| Item | What | Effort | Depends on |
|---|---|---|---|
| **SW1** | The page for eight: `group` in the manifest, the four groups, the third line, About's sentence; `ModuleLink`; `scope.ts` and `watch.ts` (2.1); the "every module off" CI job and the split quick gate; U129, part of F26 and N27 | **S** | FT2 (round 2: the read-back, the address line, the grouped page). Rides with it or straight after |
| **SW2** | AI access behind its switch: the manifest with `elsewhere`; `aiAccessOn`; the server's door (6.1); Access, Settings and People without tokens; the section `/workspace/ai`; both read-backs and the token sheet; U127, `AI-ACCESS-OPTIONAL` | **S** | FT2, SW1. Nothing held |
| **SW3** | Watching behind its switch: the manifest with `elsewhere`; `watchingOn`; `homeLead` (2.2), `scopesFor` (2.3), 2.6; every "Watching off" cell of sections 3, 4 and 6; its read-back; U126, `WATCHING-OPTIONAL` | **S–M** | FT2, SW1; round 1's GL2 and FS4 (held: they edit Goals' tabs and Home); round 3's home area for the lead's final words |
| **SW4** | Feedback moved into `src/modules/feedback`: `src/markup`, `Feedback.tsx`, the two tool files and `send_feedback`, the two ports, the shell's sheet, layer and key, Help's "What you raised", the research page; `shell.layer`; `ModuleNav.group: 'you'`; its read-back; half of U128, `FEEDBACK-OPTIONAL` | **M** | SW1. Round 1's FS2 list bar on Feedback (held) lands first or rides with it |
| **SW5** | The Goal map moved into `src/modules/goal-map`: `GoalMap.tsx`, the drawing half of `map.ts`, the page `/goals/map`, the control in `goals.tools`, the `view=map` rule, the walkthrough's `module`, the split rules page; half of U128, `MAP-OPTIONAL` | **S–M** | SW1; round 1's GL2 (held: Goals' view bar) |
| **SW6** | Watching moved into `src/modules/watching`: its records through the extension point; the tab as a filter (`tab`); `goal.actions`; `home.blocks`, `home.lead`, `goal.facts`, `people.person`, `goals.tools`; `elsewhere` emptied; the stage becomes a drill. `[no news]` | **M** | AS part 2 and ML1–ML3 (round 1, held); SW3; FT3's `home.lead` if it has landed, else SW6 adds it and FT3 reuses it |
| **SW7** | AI access moved into `src/modules/ai-access`: the token views, actions and tools; tokens through the records extension point with its secret; `elsewhere` emptied. `[no news]` | **S–M** | AS part 2; SW2; SW6 (the second module on the extension point goes first) |
| **SW8** | The Wrap-up, switch and move: 2.4 (`nextCycle` takes the stops; a done goal does not carry); Cycles' "Start 2027" and its read-back; `start_next_cycle`'s dry run; `goal.actions`, `home.lead`; the module's folder; its read-back; `WRAP-UP-OPTIONAL` | **M** | The cycle-end area's build (round 3: CY); AS part 2; SW6 (`goal.actions`) |

Each item is its own PR, with its section of `spec/`, its conformance rows and its rebuild stage, per `CLAUDE.md`. None has SQL. SW1 to SW5 and SW8 change what people see and each has a What's new entry; SW6 and SW7 are `[no news]`.

**Against round 2's plan** (`docs/design/round-2/README.md`, Part 3): SW1, SW2 and SW3 follow item 4 (FT2) in the "People, Workspace, Metrics" track; SW4 and SW5 can run in the "Lists and the frame" track once GL2 has left Goals; SW6 and SW7 sit after items 28 to 34 (metrics) and before item 38 (FT3); SW8 follows the cycle-end build wherever round 3 places it.
