# Workspace, redesigned: the design

10 November 2026. A design, not a build. The reasons are in `docs/reviews/2026-11-10-workspace-redesign.md` (findings F1 to F21); the build spec is `spec.md` beside this file. The wireframes in `wireframes/` are rendered from the HTML mock-ups in `mockups/` (`node docs/design/workspace/mockups/build.cjs`) at 1440 and 390 px. They show layout, order and wording; they are not app code.

## The idea in four lines

1. **People** is its own place, for everyone: the people and the teams, each with a page that leads to their goals.
2. **Workspace** is what only admins change, and it opens on **About**: what needs sorting out, then the facts.
3. **Settings** is about you, and now holds leaving.
4. **The switcher** switches and starts a new workspace, and nothing else.

Today one door leads to an index of eight sections. After: two doors, by job. The weekly job of 15,000 people (find someone, find a team) no longer runs through the area ten admins use a few times a year.

## Information architecture

### What is a page

| Place | Address | For | Pages |
|---|---|---|---|
| **People** (main navigation) | `/people`, `/teams` | Everyone | People (a tab), Teams (a tab), a person `/people/<id>`, a team `/teams/<id>` |
| **Workspace** (lower navigation, beside Settings) | `/workspace`, `/workspace/<section>` | Everyone reads About, Cycles, Privacy and their own removals; admins see all | About (the landing page), Cycles, Access, Features, Privacy, Recently removed, and any a module adds |
| **Settings** | `/settings` | You | One page: You, Appearance, Navigation, Your MCP tokens, Motion lab, Leave |
| **Switcher** (sidebar header; phone top bar) | a sheet | Everyone | Your workspaces, About this one, Set up a new workspace |
| **Feedback** (beside Help) | `/feedback` | Everyone in Faro; builders only in the internal app (R1, rule 6) | Unchanged |
| **Demo controls** | a sheet | The demo | Unchanged, under one name |

### What moves

| Today | Goes to | Why |
|---|---|---|
| Workspace → Overview ("To look at here", "Every section") | Workspace → About. "Every section" goes; the menu is the list | F2 |
| Workspace → People | People → People tab | F4, F5, F21 |
| Workspace → Teams | People → Teams tab, and a page per team | F4, F6 |
| The person edit sheet's Admin tick box | Access ("Add an admin"), and a person's page | F7 |
| Rename and Remove on every team row | The team's page | F6 |
| Overview → Leave this workspace | Settings → Leave | F10 |
| Overview → Delete this workspace | Stays, at the foot of About, under its own label | F10 |
| Overview → "Try it with your own team", "Set up a workspace", "Try the demo" | The switcher only ("Set up a new workspace"); "Try the demo" stays on the welcome page | F3, F8 |
| Overview → "Reset the example" | Demo controls' "Start over" only (decision 6) | F17 |
| The header's demo line and "Your permissions" sentence | One line under the title: "Platform Engineering · you're an admin here" | F11 |
| "New feedback was sent from this workspace" in the needs list | Nowhere: Feedback has its own count | F9, F18 |
| The cycle ending and the wrap-up, in the needs list | Home already says them; About's Year line says the date | F9 |
| Settings → What the app records (four bullets) | Workspace → Privacy; Settings keeps one line and a link | F14 |
| Settings → "Make an MCP token" (admins) | Workspace → Access, and a person's page | F14 |
| Sidebar → "Feedback" and "Send feedback" | One "Feedback" item; the page's button is "Send feedback" (decision 5) | F16 |

Nothing moves to Home. Home is "what needs you this week"; a workspace's set-up gaps are an admin's occasional job and stay on About.

### Navigation

- **Sidebar, main group:** Home, Check-in (if you own goals), Goals, Reviews, Activity, **People**, Data, New goal.
- **Sidebar, lower group:** **Workspace**, Settings, Help, Feedback, then you.
- **Phone:** People and Workspace are in More, in that order, after Data. People is two taps from anywhere (today: three, through an index).
- The switcher's row for the open workspace reads "About Platform Engineering" and opens `/workspace`.

## Each screen and its one primary action

| Screen | Wireframe | Primary action | Everything else |
|---|---|---|---|
| People | 1 | Admin: **Add a person**. Member: none; the search field has the focus | Find, filter by team, Admins only, 50 a page |
| A person | 2 | **See their goals** (opens Goals for that owner). No goals: none | Facts; for admins: Change details, Make an admin, Make an MCP token, Mark as left |
| Teams | 3 | Admin: **Add a team**. Member: none | Find; a row opens the team |
| A team | 4 | **See its goals** (opens Goals for that team) | Purpose, counts by status, people; for admins: Change, Remove |
| Workspace → About | 5, 6 | None as a button. For an admin the first row of "To sort out" is the thing to do, each row with its own plain button | Facts with links; Rename; Delete at the foot |
| Workspace → Cycles | 8 | In the last two weeks of the year: **Wrap it up**. After the wrap-up, for admins: **Start the next cycle**. Otherwise none | "See the wrap-up"; Delete only on a cycle nobody has checked in to |
| Workspace → Access | 7 | **Add an admin** | Remove as admin; Make a token; Revoke |
| Workspace → Features | 9 | None: each switch acts at once, with Undo | — |
| Workspace → Privacy | 9 | None: one switch (admins), with a confirm when turning on | "What's recorded, exactly" |
| Workspace → Recently removed | — | None: each row has Restore | Filter by kind once there are more than 20 |
| Settings | 10 | None: choices save as they are made | Leave, at the foot |
| Switcher | 11 | Pick a workspace | About this one; Set up a new workspace |

"None" is deliberate. A reading page with no primary button is calmer than one with an invented one.

## Wireframes

Each is drawn at 1440 and 390. Status is a shape plus a word; lists are hairline rows; nothing has an edge stripe, a quote bar, an emoji or a pill.

| # | Screen | 1440 | 390 |
|---|---|---|---|
| 1 | People (admin) | ![](wireframes/01-people-1440.png) | ![](wireframes/01-people-390.png) |
| 2 | A person (admin) | ![](wireframes/02-person-1440.png) | ![](wireframes/02-person-390.png) |
| 3 | Teams (admin) | ![](wireframes/03-teams-1440.png) | ![](wireframes/03-teams-390.png) |
| 4 | A team (admin) | ![](wireframes/04-team-1440.png) | ![](wireframes/04-team-390.png) |
| 5 | Workspace → About (admin) | ![](wireframes/05-workspace-about-admin-1440.png) | ![](wireframes/05-workspace-about-admin-390.png) |
| 6 | Workspace → About (member) | ![](wireframes/06-workspace-about-member-1440.png) | ![](wireframes/06-workspace-about-member-390.png) |
| 7 | Workspace → Access | ![](wireframes/07-access-1440.png) | ![](wireframes/07-access-390.png) |
| 8 | Workspace → Cycles | ![](wireframes/08-cycles-1440.png) | ![](wireframes/08-cycles-390.png) |
| 9 | Features, and Privacy's block | ![](wireframes/09-features-privacy-1440.png) | ![](wireframes/09-features-privacy-390.png) |
| 10 | Settings (member) | ![](wireframes/10-settings-1440.png) | ![](wireframes/10-settings-390.png) |
| 11 | The switcher | ![](wireframes/11-switcher-1440.png) | ![](wireframes/11-switcher-390.png) |

The numbers and dates in the wireframes are illustrative (the wrap-up date comes from the rule in the spec; the example has one cycle and no tokens; the second cycle and the tokens are drawn to show the rows).

## Role differences

One rule: **a member sees the same page without the actions, and is told who to ask once.** Nothing for admins is listed and then refused.

| | Amara (admin, leader) | Rhea (member, manager) | Oskar (member) | Setting up |
|---|---|---|---|---|
| People, Teams | Reads; Add a person, Add a team | Reads | Reads | The first admin; People shows who was added |
| A person, a team | Reads; "For admins" block | Reads. Her own team's page is where she checks who is in it and what they own | Reads | — |
| About | "To sort out", facts, Rename, Delete | Facts, and "ask one of the admins" | The same as Rhea | "To sort out" is quiet on day one (see the rule in the spec) |
| Cycles | Reads; Start the next, Delete an empty one | Reads; wraps up her own goals | Reads | "No check-ins yet" and no wrap-up link until it opens |
| Access, Features | Yes | Not in the menu; the address says who the admins are | The same | Yes |
| Privacy | The switch | The state, in words | The same | As chosen at set-up |
| Recently removed | Everything | What she removed | What he removed | Empty |
| Settings | You, look, own tokens, Leave (refused for the only admin, with why) | The same | The same | The same |

Being a manager or a leader changes nothing in Workspace: Faro has no manager rights (R1). What Rhea gains is her team's page.

## The phone

- **People:** the title, the one button full width (admins), the two tabs, the search field, then rows. A row is name, then job title and team, then what they lead and own on a third line. The Team and Admins filters fold into one "Filter" button beside the search.
- **A person, a team:** one column; facts stack as label over value; the primary button is full width under the name.
- **Workspace:** `/workspace` is About itself. After the facts comes "More in Workspace": the other sections as rows with one true line each. A section opens with "‹ Workspace" above its title. There is no list-of-sections page and no Overview item.
- **Teams:** a row is three lines (name; lead and people; counts by status) and has no buttons.
- **Limits** (held by the new F check): at 390 px the first person on People is within 380 px of the top for a member; the first fact on About within 220 px; nothing scrolls sideways.
- Every control is at least 44 px high.

## How modules still add sections

Unchanged in kind: `sections` in a module's `app.tsx`, each at `/workspace/<id>`, with a Help article at that address. Three details change, and two places are added.

- **`after` keeps working.** The landing section keeps the id `overview` in code (label "About"), so `after: 'overview'` still means "first after the landing page". `after: 'people'` or `'teams'` no longer names a Workspace section; such a section goes last, as an unknown `after` does today (`placeSections`).
- **A module's section gives its one line.** `WorkspaceSection` gains an optional `says(app)`: the true line shown under its name in the phone's "More in Workspace" and in About's facts when it has one. Without it the `summary` is used.
- **A module can raise something to sort out.** `WorkspaceSection` gains an optional `needs(snapshot, viewer)` returning the same shape as the core's needs; About lists them after the core's. The metric library would use it for "4 metrics have no owner".
- **New places:** `people.person` and `people.team` (in `PLACES`), rendered after the facts on a person's and a team's page, given the person or team. A module adds a block there without touching the core (the metric library: "Metrics Rhea owns").

Features still lists every installed module with its switch; a module switched off loses its section, its places and its Help article, as now.

## For the rebuild (spec only)

- **Teams as a tree.** The Teams tab is flat in Faro. In the internal app it is R6a's tree: rows indent under their parent, a team's counts include the teams under it, and a team's page is the scope for Goals, Home and reviews. The page per team is the piece Faro builds so there is something to copy.
- **People come from the directory.** "Add a person", "Change details" and "Mark as left" are Faro's stand-ins; the internal app shows the same pages read-only, with "From the company directory" where the buttons are (R6a, rule 1; R1, rule 2).
- **Leave** does not exist in the internal app.
- **The inbox** is for builders only there (R1, rule 6).
- **Search** is the seam: People and Teams ask one function for a page of results, which the internal app answers from its server (0a (1), R4).

## Decisions for Lane

One batch; the recommended answer is first.

1. **The giant warning mark on the live overview (F1), before Wednesday's talk.**
   - (a) Fix it now as a one-line hotfix with its design check, inside the freeze. *Recommended: it is a bug in a merged release on the page the talk walks.*
   - (b) No code: mark the demo's one New markup "In hand" before the talk, don't open Workspace in a workspace made on stage, and fix it after.
   - (c) Leave it until the redesign is built.
2. **Where people and teams live (option A).**
   - (a) Their own place, People, in the main navigation. *Recommended.*
   - (b) Keep them under Workspace; fix the landing page, header and rows only.
3. **What `/workspace` opens on (option B).**
   - (a) About: what to sort out, then the facts; no list of sections. *Recommended.*
   - (b) Keep Overview, drop only "Every section".
4. **Leave (option D).**
   - (a) Move it to Settings. *Recommended.*
   - (b) Keep it at the foot of Workspace.
5. **Feedback and Send feedback in the sidebar.**
   - (a) One item, "Feedback"; the page's button sends. *Recommended.*
   - (b) Keep both.
6. **Reset the example (option F; this revisits your call of 9 Nov).**
   - (a) Only "Start over" in Demo controls. *Recommended.*
   - (b) Keep the admin-only "Reset the example" on Workspace as well.
7. **The word "cycle" (option E).**
   - (a) Keep "Cycles"; fix what the page says. *Recommended.*
   - (b) Rename the section "Goal years".
8. **When to build it.**
   - (a) After 0c and AS, before 0a: 0a's find-and-pick then lands on the new pages once. *Recommended.*
   - (b) As part of 0a (its part (3) is superseded by this design either way).
   - (c) Later, after L and GD.
