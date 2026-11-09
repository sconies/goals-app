# Review of 9 November: the Goals page, and navigation

Two passes by an outside reviewer, 09:29–09:52 UTC, desktop at 1919 px (no phone pass: the reviewer's browser couldn't change width), as Amara, Rhea and Alex. Nothing was created or changed. Triage by the planning session; Lane's calls marked.

## Fixed now (the Goals hotfix, branch `goals-search-fix`)

- The search box loses characters when typing fast or pasting ("Kafka" became "aka"). Reproduced on the live demo: at no delay "a", at 30 ms a key "Aara".
- Clearing search resets the tab and sort; switching to List replaces the history entry, so Back skips states.
- A bad `show=` value renders a blank page; a bad team becomes a filter labelled "a team".
- Search on the Trees tab only searches the 12 north stars ("0 of 12" for "canary"; By level finds 2).
- Voss: the Watching tab says 0 while Cards shows a watched north star. Amara has no Mine tab though she owns a north star.
- The tab strip clips Watching to a "W" at 1920 px. The Map deletes a focused node with the Delete key, unasked.

## Decided (Lane, 9 Nov) and backlogged as GP

- **Needs attention shows handled goals, grouped** below the goals needing action; the badge counts the first group. Today the filter hides them, so a manager filtering her team missed her two Off track goals, and the badge (40) disagrees with the rows (64).
- **Cut the Cards layout:** it shows less than List and adds nothing.
- With them: a health summary line on Goals, "Worst first" across trees, Board's On track column and parent names, History showing current values.

## Kept as they are

List (hierarchy, roll-up, trend, Why), Table (column sort, sparklines, the page's only bulk actions), History (quarter results and the weekly heatmap). URL-based tabs (Goals, Data, Inbox, Workspace) are the best navigation pattern in the app.

## Backlogged

- **MAP:** the Map at scale. Fit all doesn't fit (two of twelve trees at 1920 px), no numbers on nodes, no roll-up, search leaves matches folded, a staged four-second draw. Its critical-path edges are worth keeping.
- **NAV:** collapsed sidebar has no hover labels and loses Mine, All and saved views; role-dependent nav unexplained; the check-in queue has no list and the bulk mode isn't in the nav; no section links on Settings or the goal page; New goal's steps aren't in the URL; Settings' back link follows history.
- **0a (already planned):** New goal's Owner and Feeds-into are still plain selects over 97 people and 127 goals; a person is picked four different ways. Switch person's grouped search list is the model.
- **R5 (spec only):** app-wide search (Cmd-K).

## Not a defect

Workspace shows five sections to members (Overview, People, Teams, Inbox, Privacy): Cycles, Access, Features and Recently removed are for admins (decided 7 Nov).

## Not tested

Phone widths. G (the phone Goals page) is in build; a phone pass follows it.

## Third pass: the goal page (10:22–10:34)

**Fixed now (hotfix, branch `goal-page-fix`):** target and plan edits had no sanity check (a target of 999 on a lower-is-better goal starting at 14 saved and flipped the goal to "Higher is better"); a Done goal still showed a live forecast and its Q4 row "In progress"; "Why it's behind" headed a recovering goal; direct and whole-tree feeder counts disagreed unlabelled; "same reason as week X, above" pointed the wrong way; no last-updated date in the header.

**Backlogged as GD:** dated, owned action rows on every goal, editable from the page; one place for the open ask; a Changes filter without review look-ins, missing weeks shown, searchable history; real Cancel and a "who sees this" line; what Watch does; structural Back; a first screen that leads with the decision when a goal is in trouble.

**Strengths to keep:** the page adapts to goal type (stages, ranges, no check-in yet, healthy goals' "latest word"); the ask-respond panel; the print page; drafts restored after a reload; reason-for-change now asked inline.

**Note:** the reviewer used the demo's Start over once to undo the 999 test. The demo keeps its data in the browser, so that touched only the reviewer's browser.
