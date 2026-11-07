# Backlog

Lane's ideas and the follow-ups found along the way, in the order they should be built. A new idea is added here first, never built straight away; it is built when Lane picks it or approves the next item.

**How items are ordered:** by what they unblock first, then value against effort. Effort: S (under a day), M (a release), L (more than one release).

**In progress:** release 3, one spreadsheet format (approved 6 Nov).

## Up next, in order

| # | Item | Why here | Effort | Depends on | Source |
|---|---|---|---|---|---|
| 0 | **Feature modules: the pattern.** A small core (people, teams, goals, plans, check-ins, status rules, vocabulary, change engine) with named extension points: routes, navigation, Home blocks, goal-page sections, settings, database tables, AI tools, Help articles, requirements and journeys. Each feature (reviews, asks, Watching, the map, markup, spreadsheets, observability…) lives in one folder with a manifest that registers into those points and declares what it depends on, and can be switched on or off per workspace. A CI check builds and runs the core journeys with each optional feature removed. New features are built this way from here on | Release 4 reworks loading and observability is all new, so they should land as modules; today reviews touch about 90 files across 9 folders, while markup already lives mostly in one folder | S for the pattern, then M per existing feature moved over time | Nothing | Lane, 7 Nov |
| 1 | **Release 4a: sign-in and access.** Email-link sign-in for everyone, workspace membership, access rules in the database, server-made AI tokens | Faro can't hold real data until anyone can't read everything; everything after needs real identity | M | Release 3 (person emails) | Plan, 6 Nov; decided 7 Nov |
| 2 | **Release 4b: scale.** Summary rows worked out on the server, paging, code split by screen, only visible rows drawn, speed checks in CI | 15,000 people would download about 1 GB per open today | L | 4a | Plan, 6 Nov |
| 3 | **Time zones (with release 4).** Real moments stored and shown in the viewer's zone, home zone per workspace, the AI in the person's zone, reviews with a time and zone | Cross-region companies see wrong orders and weeks today | S–M | 4a | Lane's question, 7 Nov |
| 3a | **Mark up a goal and send it to someone.** Use the screen markup from release 1 to talk about goals, not only to report bugs. On a goal page (or its chart, scorecard or a review agenda row) anyone can draw and pin notes, pick who it's for (the owner, a teammate, a review) and send it as one of the existing asks: a question, a decision or help needed, or an update request. The recipient sees it in Needs your response with the drawing, answers in the same Respond panel, and it stays on the goal's page and in Activity. In a review, a markup can be added live to that goal's discussion and becomes part of the review notes. Reuses the capture, drawing and named-parts code; the only new thing is where it goes. Open questions for a short grill: is the picture a snapshot or does it link to the live goal; can a markup go to several people; do watchers see it | Turns markup into a way to discuss goals, which is the app's main job; small because the pieces exist | M | 4a (pictures must be readable by the people they're sent to, which needs real sign-in; today only builders can read markup pictures) | Lane, 7 Nov |
| 4 | **On-track goals flagged "Getting worse" or "Greener than calculated" show the At risk half-circle on Home** | Breaks "status is a shape plus a word": the shape says At risk while the word says On track | S | Nothing | Found in release 2, 7 Nov |
| 5 | **The AI can triage feedback** (list, read, update, like markups) | Parity rule: everything a person can do, the AI can do | S | Nothing | Found in release 1b merge, 6 Nov |
| 6 | **"You raised this" for feedback**, as markups already have | Closes the loop for people who send feedback, not just markups | S | Nothing | Found in release 1b merge, 6 Nov |
| 7 | **Exports drop a stopped goal's forecast fields** | Exports still show a forecast the goal page no longer makes | S | Release 3 (one export format) | Found in release 1b merge, 6 Nov |
| 7a | **One home for spreadsheets: the Data page.** Today import and export are scattered: Import and Export buttons on Goals, an Import item in the phone's More menu, a separate Import screen, the Export sheet, and Data's own table export. Move them to Data as one place to work with data in bulk: download the workbook or zipped CSVs, download one table as it's laid out, and import with the preview, plus the blank template. Goals keeps at most a quiet "Export these goals" for the current filter. Set-up keeps its own upload because it's the first-run path. Old links to /import go to Data | Release 3 made one format; this makes one place, so people don't have to hunt | S–M | Nothing (release 3 is merged) | Lane, 7 Nov |
| 8 | **Watching on a phone: Oskar's watched goals start below the first screen** (U9 scores 8.9) | The only journey below 10 | S | Nothing | Evals, since 5 Nov |
| 8a | **Self-describing Faro, step 1: a spec that can't drift.** A `spec/` folder generated from the code and checked in CI: the data model, every rule with worked examples, the vocabulary, every screen (purpose, named parts, one main action) and the journeys and requirements, each linked to its code and tests. Plus `llms.txt` at the root and a `describe_system` AI tool, so an AI can ask Faro what it is | Cheapest while building: each later release then adds its own part, instead of writing it all at the end | M | Nothing | Lane, 7 Nov |
| 8b | **Self-describing Faro, step 2: conformance data.** Demo workspaces with the expected status, flags, projection and scorecard for every goal in every week, as plain files. Any rebuild proves its rules by matching them row by row | The clearest "explanation" of the rules for another AI is examples it can test against | S–M | 8a | Lane, 7 Nov |
| 8c | **Self-describing Faro, step 3: enforced layers and swappable parts** (with feature modules, item 0). The rules layer has no database or screen code, enforced by a lint check (three rules files reach into the data layer today). The database sits behind one store interface with a contract test any adapter must pass (Supabase, plain Postgres, local), and the same goes for clock, sign-in and files | Makes "use a different database" a matter of passing one test suite | M | Release 4 (it reworks loading) | Lane, 7 Nov |
| 9 | **Release 5: observability.** Overlay, Observability page, troubleshoot right, weekly Claude review, alerts | Needs real identity; data protection sign-off needed before recording anyone | M | 4a, data protection sign-off | Plan, 6 Nov |
| 10 | **Company single sign-on** (Entra ID, Okta or Google) in place of email links | When IT is ready; the app doesn't change | S | 4a, IT | Decided 7 Nov |
| 10a | **Rename "AI assistant" to "MCP access".** In the app it sounds like AI built into Faro; it is really the door other AI tools use to work in Faro. Proposed words: the Workspace section "AI assistants" becomes **MCP access** ("Connect Claude or another AI tool to Faro through MCP"), tokens become **MCP tokens**, and the activity tag "via AI assistant (MCP)" becomes **via MCP**. Updated in the vocabulary, Help, What's new, the server's own description and docs/mcp.md | Small and worth doing, but not urgent (Lane, 7 Nov) | S | Nothing | Lane, 7 Nov |
| 11 | **Release 6: rebuild kit.** Packages 8a–8c with a staged rebuild guide: each stage has entry and exit criteria (the requirements and journeys that must pass), so a team can rebuild and ship in stages | Captures the finished product, so it goes last | M | Everything above | Plan, 6 Nov; stages added 7 Nov |

## Done

| Item | Shipped |
|---|---|
| Release 2: one meaning for every status word | PR #32, 7 Nov |
| Release 1b: remove, archive and undo anything | PR #31, 6 Nov |
| Release 1: screen markup, builder inbox, server-made tokens | PR #31, 6 Nov |
| Full evals green again | PR #30, 6 Nov |
| Goal page scorecard | PR #28, 6 Nov |
| Faro rebrand | PR #26, 6 Nov |
