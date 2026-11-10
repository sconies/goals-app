# Workspace, redesigned: the build spec

10 November 2026. For a build session to follow without asking. The reasons are in `docs/reviews/2026-11-10-workspace-redesign.md` (F1 to F21); the design and its wireframes are in `README.md` beside this file. This spec assumes Lane takes the recommended answer to each decision there; where another answer changes the build, it says so under "If Lane decides otherwise".

**Standing rules** (from `CLAUDE.md`, not restated per item): each item adds its section of `spec/` and conformance rows, runs `npm run spec`, adds a What's new entry and updates the guide, comes with its evals, and passes `npm run typecheck`, `npm test` and `npm run evals:changed` before it is pushed. People, teams and the workspace are core, not a module; nothing here adds a table or a migration.

**Words used throughout.** `{ws}` is the workspace's name without "Example: " (rule 1). `{admins}` is the admins' line (rule 2). "Member" means anyone who isn't an admin. Wording in quotation marks is exact.

## 1. Routes

| Address | Screen | Title (browser and phone top bar) |
|---|---|---|
| `/people` | People, People tab | People |
| `/people/<personId>` | A person | The person's name |
| `/teams` | People, Teams tab | People |
| `/teams/<teamId>` | A team | The team's name |
| `/workspace` | Workspace → About | Workspace |
| `/workspace/cycles` | Cycles | Workspace |
| `/workspace/access` | Access (admins) | Workspace |
| `/workspace/features` | Features (admins) | Workspace |
| `/workspace/privacy` | Privacy | Workspace |
| `/workspace/removed` | Recently removed | Workspace |
| `/workspace/<id>` | A module's section | Workspace |
| `/workspace/new` | Set-up (unchanged) | Set up |
| `/settings` | Settings | Settings |
| `/feedback` | Feedback (unchanged) | Feedback |

People's query: `?q=` (search), `?team=<id>` or `?team=-` (no team), `?admins=1`, `?page=<n>` (from 1). Teams' query: `?q=`. All are kept in the address, so Back and a shared link restore the list.

### Redirects for old addresses

Each is a replace (no history entry), keeps `?today=` and the demo prefix, and is covered by U58.

| Old | New |
|---|---|
| `/workspace/overview` | `/workspace` |
| `/workspace/people` | `/people` |
| `/workspace/people?team=<id>` | `/teams/<id>` |
| `/workspace/people?team=-` | `/people?team=-` |
| `/workspace/teams` | `/teams` |
| `/workspace#people`, `#teams` | `/people`, `/teams` |
| `/workspace#cycles`, `#ai`, `#tokens`, `#access`, `#features`, `#recording`, `#privacy`, `#removed` | As today (`ANCHORS` in `Workspace.tsx`) |
| `/workspace/inbox`, `/workspace?inbox=1`, `/workspace?markup=<id>`, `/workspace#inbox` | `/feedback` (with `?markup=`), as today |

Also: `SAME_IN_EVERY` in `src/ui/WorkspaceSwitch.tsx` gains `/people` and `/teams`; a person's or a team's page lands on `/people` or `/teams` after a switch (they belong to the old workspace). `workspaceNeeds`' links (`to`) and Help's routes follow the table.

## 2. Screens

### 2.1 People (`/people`)

Reading width 880 px. Wireframe 1.

**Content, in order**

1. Title "People". Under it: "Everyone in {ws}, and the teams they are in."
2. Primary action, admins only: **"Add a person"**. Members: no button.
3. Tabs, as links: "People · {n}" (`/people`) and "Teams · {n}" (`/teams`).
4. A search field, focused on a computer when the page opens: placeholder "Find by name, job title or team", label (for screen readers) "Find a person".
5. Filters. On a computer: "Team: every team" (find-and-pick once 0a lands; until then the existing select) and a toggle "Admins only". On a phone: one "Filter" button opening a sheet with both.
6. A count line, `role="status"`: "{n} people, A to Z. Showing {a} to {b}." With a search or filter: "{n} people match." or "1 person matches."
7. The list: one flat list, by name A to Z (rule 4), 50 a page. A row is a link to the person: avatar; name; under it "{job title} · {team}" ("No team" when none; the job title left out when empty); at the right (a third line on a phone) the person's line (rule 5), for example "Admin · leads the team · 1 goal".
8. Paging: "{a} to {b} of {n}" and "Next {k}" / "Previous 50" as links (`?page=`).
9. Admins only, when anyone lacks an email, above the count line: "{n} people have no email yet. Add them" opening the existing Missing emails block as a sheet. It no longer sits open at the top of the list.

**Empty and error states**

- No match: "No one matches “{q}”." and a link "Clear the search".
- A filter with no one: "No one in {team} yet." / "No one is in no team." (for `?team=-`: "Everyone is in a team.")
- `?team=` naming a team that doesn't exist: the filter is dropped and a line says "That team isn't here any more."
- `?page=` past the end: the last page.

**Add a person** opens the existing sheet without its Admin tick box and without "Mark as left" (both move: 2.2, 2.7). Its errors are unchanged (`personProblems`). After saving: the toast "Added {name}", and the new person's page opens.

### 2.2 A person (`/people/<personId>`)

One column, 880 px. Wireframe 2.

**Content, in order**

1. Back link "People" (to `/people`, or to the team when opened from one: "CI/CD").
2. Avatar, name as the title, job title under it. Someone marked as left: the name with "(left)", and under it "Left {ws} on {date}. Their history stays."
3. Primary action: **"See {first name}’s {n} goals"** → `/goals?owner=<id>`. One goal: "See {first name}’s goal". None: no button. On your own page: "See your {n} goals".
4. Facts, label then value:
   - **Team:** the team as a link; ", which {first name} leads" when they lead it. Leading other teams: "Also leads {team} and {team}." No team: "No team."
   - **Email:** the email. None: "Not added yet."
   - **Role here:** "Admin. Admins change people, teams and settings." or "Member. Admins change people, teams and settings."
   - **Goals:** counts by status as shape plus word, in the order Goals uses (`statusCounts`, `src/domain/order.ts`), each a link to `/goals?owner=<id>&status=<s>`. None: "Owns no goals this year."
   - **Reviews:** "Runs the {review}; in the {review} and {review}." each a link. None: the row is left out.
5. The `people.person` place (modules).
6. Admins only, under the label "For admins": "Change details" (the edit sheet: name, email, job title, team), "Make an admin" / "Remove as admin" (the rule and words of 2.7), "Make an MCP token" (the token sheet with this person chosen; real app only), and, apart and quieter, "Mark as left…" (the existing sheet). On your own page as an admin "Mark as left…" is replaced by the line "To leave, use Settings."

**Empty and error states**

- No such person: "That person isn't in {ws}." and a link "See everyone".
- Every refusal shows the rule's own words (`savePerson`, `markPersonLeft`), as a toast, as today.

### 2.3 Teams (`/teams`)

Wireframe 3.

**Content, in order**

1. Title, line and tabs as on People. Primary action, admins only: **"Add a team"**.
2. A search field, always shown: placeholder "Find a team or its lead".
3. The list, by name A to Z. A row is a link to the team: name; under it "Led by {name} · {n} people" ("No lead" when none); at the right (a third line on a phone) the team's goals by status, shape plus word, only the statuses it has. No goals: "No goals this year." A row whose team has any off-track goal gets no wash: the wash is for a goal, not a team.
4. No buttons on a row.

**Empty and error states**

- No teams: "No teams yet." and, for admins, the primary button stands.
- No match: "No team matches “{q}”."

**Add a team** opens the existing sheet (name, lead, and a new optional field "What it is here to do", saved as `Team.objective`). After saving: "Added {name}", and the team's page opens.

### 2.4 A team (`/teams/<teamId>`)

Wireframe 4.

**Content, in order**

1. Back link "Teams".
2. The name as the title. Under it: "Led by {lead as a link} · {n} people · {n} goals this year".
3. Primary action: **"See its {n} goals"** → `/goals?team=<id>`. None: no button.
4. "What it is here to do": the objective. Empty: left out for members; for admins "Not said yet. Add it" (opens Change).
5. "Goals": counts by status, each a link to `/goals?team=<id>&status=<s>`.
6. "People · {n}": the first 8 as People's rows (lead first, then A to Z), then "Show all {n}" → `/people?team=<id>`.
7. The `people.team` place (modules).
8. Admins only, under "For admins": "Change its name, lead or purpose" (the sheet; its title "Change {team}") and, apart and quieter, "Remove this team…" (the existing sheet, unchanged).

**Empty and error states**

- No such team: "That team isn't in {ws}." and a link "See every team".
- No people: "No one is in {team} yet."

### 2.5 Workspace → About (`/workspace`)

Wide frame, 1060 px: the section menu (196 px) and the body. Wireframes 5 and 6.

**The header, on every Workspace section:** title "Workspace"; one line under it: "{ws} · you’re an admin here" or "{ws} · you’re a member here". Nothing else. The demo line and the "Your permissions" sentence go.

**The menu:** About, Cycles, Access (admins), Features (admins), Privacy, Recently removed, then modules' sections. No counts in the menu.

**Content, in order**

1. Admins only, when there is anything (rule 3): the label "To sort out · {n}" and a hairline list. A row is a sentence in bold, a line of why under it, and one plain button at the right. At most three rows; a fourth becomes "and {k} more" which opens them in place. Nothing to sort out: the block is left out (no "Nothing to look at").
2. "About this workspace", with "Rename" (admins) at the right. Then the facts, label then value:
   - **Name:** {ws}; for the example, " · example data"; for one made in the demo, " · kept in this browser".
   - **People:** "{n} people in {n} teams" → `/people`.
   - **Year:** rule 6's sentence, then "Cycles" as a link.
   - **Admins:** {admins}. For admins, "Access" as a link. For members: "Ask one of them to add someone, change a team or change a setting."
   - **Features:** "{A} and {B} are on." / "{A} is on; {B} is off." / "No optional features are on." For admins, "Features" as a link.
   - **Recording:** on: "Faro records how the app is used here, never what anyone types." Off: "Nothing about how the app is used here is recorded." Then "Privacy" as a link.
   - One row per module section that gives `says`.
3. Phone only: the label "More in Workspace" and the other sections as rows, each with its one line (`says`).
4. Admins of a workspace of their own (not the example): a rule, the label "Delete", "Deleting removes its people, goals, check-ins, reviews and history, for everyone. It can’t be undone." (in the demo: "…and history, from this browser.") and "Delete this workspace…" (the existing type-the-name confirm, unchanged).

**Not here any more:** "Every section", "Try it with your own team", "Set up a workspace", "Try the demo", "Reset the example", "Leave this workspace".

**Rename** edits in place as today (`WorkspaceName`), with the length said while typing.

**Empty and error states**

- The facts are never empty. No admins is impossible (there is always one).
- A member opening an admins-only section's address: the existing page, reworded: "{Section} is for admins. The admins here are {admins}." and a link "Back to Workspace".
- An address that is no section: the app's Not found page.

### 2.6 Cycles (`/workspace/cycles`)

Wireframe 8.

**Content, in order**

1. Heading "Cycles". Under it: "A cycle is a goal year: its goals, plans and check-ins."
2. The cycles, newest first. A row:
   - "{name} · running" / "{name} · over" / "{name} · starts {date}" (the word, not a badge);
   - "Week {w} of {weeks} · {first day} to {last day}" (over or not started: only the dates);
   - "{n} goals · {n} check-ins" ("no check-ins yet" for none);
   - for the running one, rule 6's wrap-up sentence.
3. The row's action, one of: "Wrap it up" (primary; the wrap-up is open) → `/retro`; "See the wrap-up" (plain; before it opens, shown only once any goal has a check-in); for admins after every goal is wrapped up, "Start the next cycle" (primary) → the existing step on `/retro`; for a past cycle, "See its goals" → `/goals?cycle=<id>` if Goals takes it, otherwise no action.
4. Admins, on a cycle `cycleStanding` says can be deleted: a quiet "Delete…" with a confirm: "Delete {name} and its {n} goals? Nobody has checked in to it." The reason it can't be deleted is no longer printed on every row.
5. Members, once, under the list: "Admins start the next cycle and delete an empty one."

**Empty state:** there is always one cycle.

### 2.7 Access (`/workspace/access`, admins)

Wireframe 7.

**Content, in order**

1. Heading "Admins · {n}", and at its right the primary action **"Add an admin"**. Under the heading: "Admins add people, change teams and settings, and make MCP tokens. There is always at least one."
2. The admins, A to Z: avatar, name (with " · you" on your own row), job title, and a quiet "Remove as admin" ("Stop being an admin" on your own row). The only admin's row has no button and says "The only admin".
3. Heading "MCP tokens · {n}", and at its right a plain "Make a token" (real app only). Under it: "A token lets Claude or another AI tool act as one person here, with that person’s rights. Every change it makes is logged as theirs, marked “via MCP”."
4. The tokens, newest first: what it's for; "Acts as {name} · made {when} · last used {when}" ("not used yet"); "Revoke". A builder token keeps its label.

**Add an admin** opens a sheet "Add an admin": find-and-pick a person (members only), then "Make {name} an admin". Toast: "{name} is an admin", with Undo.

**Remove as admin** asks in place: "Stop {name} being an admin? They keep their goals and history." / "Stop being an admin? Another admin can make you one again." Buttons "Yes, remove" and "Cancel". Toast: "{name} is no longer an admin", with Undo. Both go through `savePerson`, so the last-admin rule and its words are unchanged.

**Empty and error states**

- No tokens: "No MCP tokens yet."
- In the demo, in place of the token list and button: "Tokens work in the real app. The demo’s data stays in this browser, where an AI tool can’t reach it."
- Removing the only admin is not offered; if it is tried another way the rule's words show.

### 2.8 Features (`/workspace/features`, admins)

Wireframe 9. As today, with three changes:

1. Under the heading: "The optional parts of Faro, for everyone here. Switching one off hides it and keeps what it saved."
2. Each row: name; summary; and at the right a switch with its state in a word beside it, "On" or "Off". A module waiting on another: "Off until {X} is on."
3. The second paragraph ("Switch one off and it leaves every screen…") goes; the toast already says it, with Undo.

No modules installed: "This build has no optional features."

### 2.9 Privacy (`/workspace/privacy`)

Wireframe 9 (lower block).

1. Heading "Privacy". Under it: "What Faro records about how the app is used in {ws}."
2. One row: "Record how the app is used here"; under it "Pages opened, buttons pressed, errors and slow pages. Never anything anyone types. Kept 90 days, then daily totals. Only the people who build Faro can read it."; at the right, for admins the switch with "On" / "Off"; for members the words "On" or "Off" and, under the row, "Admins change it."
3. "What’s recorded, exactly" → `/help/recording`.

Turning it on still asks first; turning it off acts at once with Undo (unchanged).

### 2.10 Recently removed (`/workspace/removed`)

As today, with:

1. Under the heading, for admins: "Anything removed, stopped, ended or marked as left in the last 30 days. After 30 days it leaves this list; it is never erased." For members: "What you removed in the last 30 days. Admins see everyone’s."
2. More than 20 rows: a search field "Find by name" and a filter "Kind" (the kinds in `REMOVED_LABEL`).
3. Empty: "Nothing was removed in the last 30 days." / "You removed nothing in the last 30 days."

### 2.11 Settings (`/settings`)

Wireframe 10. In order:

1. Title "Settings". Under it: "Your own choices. Nobody else sees them."
2. **You:** avatar, name, "{job title} · {team} · {member|admin} of {ws}", and "Your page" → `/people/<you>`. Under it, for members: "An admin changes your name, job title or team: {admins}." In the demo a second plain button "Switch person" stays; in the real app "Not you?".
3. **Appearance** and **Navigation:** unchanged. The line about this browser moves under Appearance: "Kept in this browser."
4. **Your MCP tokens · {n}:** your own tokens with Revoke. No "Make" button. Members: "An admin makes a token for you." Admins: "Make one on Workspace, Access." (a link). In the demo the same line as Access.
5. **Recording**, one line in place of the block: "Recording is on in {ws}. What’s recorded" / "Recording is off in {ws}." linking to `/workspace/privacy`.
6. **Motion lab:** unchanged.
7. **Leave {ws}**, last, after a rule: "Someone takes over your goals and open asks, and your history stays. An admin can bring you back for 30 days." and "Leave this workspace…" (the existing sheet). The only admin sees the button disabled with "You’re the only admin. Make someone else an admin first, on Workspace, Access."

### 2.12 The switcher

Wireframe 11.

1. Title "Workspaces".
2. From six workspaces up: a search field "Find a workspace".
3. The list. A row: the name ({ws}); under it the kind and your role, "Example data · you’re an admin" / "You’re a member" / "Kept in this browser · you’re an admin"; the open one says "Open now" and isn't a link.
4. Two plain rows: "About {ws}" → `/workspace`; "Set up a new workspace" → `/workspace/new`.

The role sentence above the list goes (it is on the row). Switching itself is unchanged.

### 2.13 The shell

- **Sidebar:** main group Home, Check-in, Goals, Reviews, Activity, People, Data, New goal; lower group Workspace, Settings, Help, Feedback; then you.
- **One Feedback item.** "Send feedback" leaves the sidebar; `/feedback`'s primary button is "Send feedback" (it opens the same sheet, which still records the page you came from: pass the previous address).
- **Phone, More:** Activity, Data, New goal, People, Workspace, Settings, Help, Feedback, then (demo) Demo controls, then you.
- **One name for the workspace** (rule 1) in the sidebar header, the phone's top bar, pages, sheets and toasts. The phone's line is "{ws} · week {w}".
- **Demo:** the person button opens the same panel as "Demo", under the one title "Demo".

## 3. Who sees what

Consistent with R1: reading is open inside a workspace (rule 3); changing follows R1's table, enforced by the same shared actions. This table adds no right and removes none; it only says where each shows.

| Thing | Member | Admin | R1 |
|---|---|---|---|
| People, Teams, a person, a team: read | Yes | Yes | Rule 3 |
| Add a person; change details; mark as left | No button | Yes | `savePerson`, `markPersonLeft` |
| Add, change, remove a team | No button | Yes | `saveTeam`, `removeTeam` |
| Make or remove an admin | No button | Yes; never the only admin | `savePerson` |
| About: the facts | Yes | Yes | Rule 3 |
| About: "To sort out" | Not shown | Yes | — |
| Rename; delete the workspace | No button | Yes | `renameWorkspace`, `canDeleteWorkspace` |
| Cycles: read; wrap up your own goals | Yes | Yes | `saveRetro` |
| Start the next cycle; delete an empty one | No button | Yes | `startNextCycle`, `deleteCycle` |
| Access: the admins' names | On About | On About and Access | Rule 3 |
| Access: every MCP token; make one | No | Yes | Rule 3's exception; `createToken` |
| Your own MCP tokens; revoke one | Yes, in Settings | Yes | `revokeToken` |
| Features: which are on | On About | On About and Features | Rule 3 |
| Features: switch one | No | Yes | `setModule` |
| Privacy: read | Yes | Yes | Rule 3 |
| Privacy: switch recording | No | Yes | `setRecording` |
| Recently removed | Their own; restore | Everything; restore | `canRestore`, `restoreRemoved` |
| Leave the workspace (Settings) | Yes | Yes; never the only admin | `leaveWorkspace` |
| Feedback | Yes in Faro | Yes in Faro | Rule 6: builders only in the internal app |

A member never sees a control that would be refused. Typing an admins-only address gives the page in 2.5, never a blank or an error.

## 4. Rules for `src/domain`

Pure functions, each with tests from its worked examples, a section in `src/spec/rules.ts`, and conformance rows. None restates an existing rule: counts come from `statusCounts` and `goalStatus`, team membership from `teamPeople` and `teamMembers`, rights from the shared actions.

### Rule 1. A workspace's name in words: `workspaceName(ws, mode)`

Returns `{ name, kind }`. `name` is the stored name without a leading "Example: ". `kind` is "example data" for the example, "kept in this browser" for one made in the demo, and nothing for a real one. Screens show `name`; `kind` is a quieter second line.

| Given | Then |
|---|---|
| "Example: Platform Engineering", the example | name "Platform Engineering", kind "example data" |
| "Field Operations", made in the demo | name "Field Operations", kind "kept in this browser" |
| "Growth", in the real app | name "Growth", no kind |
| A real workspace someone named "Example: Tests" | name "Example: Tests": only the example's own prefix is dropped |

### Rule 2. The admins' line: `adminsLine(people, max = 3)`

Admins' names A to Z, joined as a sentence; beyond `max`, the first `max - 1` and a count.

| Admins | Then |
|---|---|
| Rosa Lind | "Rosa Lind" |
| Amara Nwosu, Grace Achterberg | "Amara Nwosu and Grace Achterberg" |
| Amara Nwosu, Grace Achterberg, Hamid Rezaei | "Amara Nwosu, Grace Achterberg and Hamid Rezaei" |
| 40 admins, the first two A to Z being Aiko Suzuki and Akosua Owusu | "Aiko Suzuki, Akosua Owusu and 38 others" |

### Rule 3. What to sort out: `workspaceNeeds` (changed)

For admins only (members get an empty list). In this order:

| id | When | Sentence · why | Button → where |
|---|---|---|---|
| `no-goals` | The running cycle has no goals | "No goals in {cycle} yet" · "Each owner adds theirs from New goal." | "Add one" → `/goals/new` |
| `no-review` | No review that hasn't ended | "No review is set up" · "A review is where the goals that need attention are talked about." | "Set one up" → `/reviews/new` |
| `only-admin` | One admin, and at least 5 people | "You’re the only admin" · "Make a second, so the workspace isn’t stuck when you’re away." | "Choose someone" → `/workspace/access` |
| `no-email` | Anyone without an email | "{n} people have no email" · "An email is how two people with one name are told apart." | "Add them" → `/people` with the sheet open |
| `no-team` | Anyone in no team | "{n} people are in no team" · "Goals are grouped by team." | "See them" → `/people?team=-` |
| `no-lead` | A team of 3 or more people with no lead | "{n} teams have no lead" · "A lead is who people ask about the team’s goals." | "See them" → `/teams` |

Dropped: `feedback` (the builders' business), `few-people` (set-up says people can be added later), `wrap-up` and `cycle-ending` (Home and the Year line say them). `no-lead` no longer fires for a team of one or two, so a workspace fresh from set-up isn't told off for a choice set-up never offered.

| Given | Then |
|---|---|
| The example on 11 Nov 2026, Amara asking | Nothing: the block is left out |
| The example, Oskar asking | Nothing (a member) |
| Field Operations just set up: Rosa (admin) and Omar, one team "Field" with no lead, 4 goals, a weekly review | Nothing |
| The same, a year on: 12 people, still one admin, three without an email | `only-admin`, then `no-email` ("3 people have no email") |
| A workspace with one person without an email | "1 person has no email" |
| Seven things to sort out | The first three shown, then "and 4 more" |

### Rule 4. The directory's order and search: `findPeople(people, teams, ask)`

`ask` is `{ q, teamId, admins, page, size = 50 }`. Returns `{ total, from, to, rows }`. This is the one function People calls: the seam where the internal app plugs in its server search (0a (1), R4).

- People marked as left are never listed.
- Order: by name with `localeCompare` in the workspace's language, ignoring case and accents; ties by email, then id.
- `q` matches when every word of it starts a word of the name, the job title or the team's name, ignoring case and accents.
- `teamId` keeps the team's people as `teamPeople` gives them (the lead counts, wherever their own team is); `-` keeps people in no team.

| Given (the example, 97 people) | Then |
|---|---|
| Nothing asked | total 97; rows 1 to 50; the first is Aiko Suzuki |
| `page: 2` | rows 51 to 97 |
| `page: 9` | the last page (51 to 97) |
| `q: "rhea"` | Rhea Kapoor |
| `q: "eng man"` | everyone whose job title has words starting "eng" and "man" (the Engineering Managers), A to Z |
| `q: "ci/cd"` | the 7 people of CI/CD, and anyone with "CI/CD" in their job title, once each |
| `q: "romero"` and `q: "Romero"` | the same: Lucía Romero |
| `q: "lucia"` | Lucía Romero (accents ignored) |
| `teamId: "-"` in the example | total 0 |
| `admins: true` | Amara Nwosu, Grace Achterberg, Hamid Rezaei |

`findTeams(teams, people, q)` is the same for teams: by name A to Z; `q` matches the team's name or its lead's name.

### Rule 5. A person's line and a team's summary

`personLine(ctx, personId)` returns the parts joined with " · ", in this order, each left out when it doesn't apply: "Admin"; "leads the team" (their own) or "leads {team}" (another, the first A to Z) or "leads {n} teams"; "{n} goals" / "1 goal" / "No goals" (goals they own in the running cycle that aren't stopped).

| Given | Then |
|---|---|
| Amara: admin, leads her own team, owns 1 goal | "Admin · leads the team · 1 goal" |
| Rhea: leads CI/CD (her team), owns 8 | "Leads the team · 8 goals" |
| Oskar: owns none | "No goals" |
| Someone who leads two teams, neither their own, and owns 2 | "Leads 2 teams · 2 goals" |

The first part takes a capital. `teamSummary(ctx, teamId)` returns `{ lead, people, goals, byStatus }`: `people` from `teamPeople`, `goals` the team's current goals from `teamMembers`, `byStatus` from `statusCounts` over their display statuses, so a team's counts here and under Goals' "By team" are the same numbers.

| Given | Then |
|---|---|
| CI/CD in the example | lead Rhea Kapoor, 7 people, 17 goals, and the counts Goals' By team shows for CI/CD that day |
| A team with no goals | goals 0, `byStatus` empty: the row says "No goals this year." |
| A team whose lead is in another team | that lead is one of its people (as `teamPeople` already says) |

### Rule 6. Where the year stands: `yearLine(cycle, week, today)`

Returns the Year fact's sentence and the wrap-up sentence. It reads `wrapUpOpen` (`src/domain/cycle.ts`) for when the wrap-up opens and `cycleWhen` for the dates; it does not work the week out again.

- Running, wrap-up not open: "{name}, week {w} of {weeks}. The wrap-up opens on {date}." where {date} is the first day of the first week for which `wrapUpOpen` is true.
- Wrap-up open: "{name}, week {w} of {weeks}. The wrap-up is open: {n} goals still to wrap up." / "…: every goal is wrapped up."
- Not started: "{name} starts on {date}."

| Given | Then |
|---|---|
| The example on 11 Nov 2026 | "2026, week 46 of 53. The wrap-up opens on {the first day `wrapUpOpen` allows}." (the conformance row pins the date) |
| The example on 22 Dec 2026, 31 goals not wrapped up | "2026, week 52 of 53. The wrap-up is open: 31 goals still to wrap up." |
| A cycle starting 4 Jan 2027, today 11 Nov 2026 | "2027 starts on 4 Jan 2027." |

### Rule 7. Which sections someone sees: `sectionsFor(viewer, sections)`

The core's and the modules' sections in menu order (`placeSections`), without the admins-only ones for a member. Today this lives in the screen (`useSections`); it moves to `src/core/module.ts` beside `placeSections` so the menu, the phone's "More in Workspace" and the admins-only page ask one function.

| Given | Then |
|---|---|
| Amara, no module sections | About, Cycles, Access, Features, Privacy, Recently removed |
| Rhea | About, Cycles, Privacy, Recently removed |
| A module adds "Metrics" with `after: 'access'`, admins only; Amara | About, Cycles, Access, Metrics, Features, Privacy, Recently removed |
| The same; Rhea | About, Cycles, Privacy, Recently removed |
| A module adds a section with `after: 'people'` (no longer a section) | It comes last |

### Rule 8. Old addresses: `movedTo(path, search, hash)`

The redirect table in section 1 as one function, used by the router and tested row by row. It returns the new address or nothing.

## 5. Extension points

- `WorkspaceSection` (`src/core/app.tsx`) gains `says?: (app) => string` and `needs?: (snapshot, viewer) => WorkspaceNeed[]`.
- `PLACES` (`src/core/module.ts`) gains `people.person` (given the person) and `people.team` (given the team), with their `PlaceProps`.
- The landing section keeps the id `overview`; its label is "About". `docs/architecture.md`'s table row for Workspace sections is updated to say so, and gains the two places.
- The manifest test checks `says` and `needs` where given.

## 6. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U58 | PEOPLE-DIRECTORY, OLD-ADDRESSES | Anyone finds a person and a team: as Oskar, open People from the sidebar (More on a phone); search "rhea"; open her page; "See Rhea’s 8 goals" opens Goals for her; back; Teams; open CI/CD; its counts equal Goals' By team for CI/CD; "See its 17 goals" opens them. No button that changes anything is on any of these pages. Then every old address in section 1 lands where the table says |
| U59 | WORKSPACE-ABOUT, WORKSPACE-SECTIONS | Workspace opens on About: as Amara the header is one line, the facts each link to their section, there is no "Every section" list and no button about another workspace; as Rhea the same facts with "Ask one of them…", no "To sort out", and Access's address says who the admins are. On a phone `/workspace` is About, followed by "More in Workspace"; a section opens with a back link |
| U60 | WORKSPACE-ADMIN, CHANGE-LOG | An admin makes someone an admin on Access and takes it back: Add an admin, pick Rhea, the toast, Rhea's row, her page says "Admin"; Undo; then Remove as admin on Grace with the confirm; the only admin has no button; each change is logged |
| U61 | WORKSPACE-ABOUT, ONBOARDING | Day one tells the truth: set up a two-person workspace from the template; About has no "To sort out"; Cycles says "no check-ins yet" and offers no wrap-up; Teams shows the team with "No lead" and no warning. Then, with 12 people and one admin, "You’re the only admin" appears with "Choose someone" |
| U62 | LEAVE-WORKSPACE, SETTINGS | Settings is about you: "Your page" opens your person page; no "Make" button for tokens; one recording line linking to Privacy; Leave at the foot opens the sheet; the only admin sees why they can't. Workspace has no Leave |

**Changed:** U51 (sections: the new list, About at `/workspace`), U53 (the switcher's rows and words; Leave from Settings), U14 (add a person from `/people`; make them an admin on Access), U43 (mark as left from the person's page), U5 and U17 (set-up and delete: the switcher's "Set up a new workspace"; Delete at the foot of About), U22 (tokens from Access and from a person's page), U12 (Start over only in Demo controls).

### F, N and P checks

| # | Check |
|---|---|
| F10 | Phone, 390 px: as a member the first person on People is within 380 px of the top; the first fact on About within 220 px; a Teams row is at most 3 lines and has no button; nothing on People, Teams, a person, a team or any Workspace section scrolls sideways |
| N11 | A 15,000-person, 1,500-team workspace (generated in the browser store): People draws at most 50 rows and answers a search within 200 ms; Teams draws and answers a search; no control on People, Teams, a person, a team, Access or Settings is a select or a list with more than 25 options. (With 0a (4) this becomes its picker check) |
| P16 | Design: on every screen, no icon inside a list row, a button or a link is wider or taller than 24 px, and no row is taller than 240 px for a single line of text. (This would have caught F1) |
| P6 | Extended to the new screens; plus: a switch that acts at once has its state as a word beside it; no state is drawn in a bordered capsule on People, Teams or Workspace |
| P3, P4 | Extended: every status shape on People, Teams, a person and a team has its word beside it |

### Unit tests

One file per rule in section 4, with every worked example as a case; `movedTo` row by row; `src/spec/internal.test.ts` still passes (no action's "who may" changes); `src/help/guide.test.ts` for the new routes.

### Requirements (`evals/requirements.json`)

New: `PEOPLE-DIRECTORY` ("Anyone finds a person or a team, and gets from either to their goals"), `WORKSPACE-ABOUT` ("Workspace opens on what needs an admin, then the facts; a member sees no control they can't use"), `OLD-ADDRESSES` ("Every address that worked before still lands on the right page"). Reworded: `WORKSPACE-SECTIONS`, `WORKSPACE-ONE-PLACE`, `LEAVE-WORKSPACE`.

## 7. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `people` (new; route `/people`) | "People: finding someone": the list, search, filters, a person's page, what admins can change |
| `teams` (new; route `/teams`) | "Teams": the list, a team's page and its counts, what admins can change |
| `workspace` (route `/workspace`) | Rewritten as "Workspace: about this one": the facts, "To sort out", who the admins are, the sections, renaming and deleting |
| `workspace-people`, `workspace-teams` | Removed; their ids redirect to `people` and `teams` (Help's own old links) |
| `workspace-cycles` | The row's words, when the wrap-up opens, who starts the next |
| `workspace-access` | Adding and removing an admin here; tokens |
| `settings` | Your page, your tokens, Leave |
| `removing` | Leave is in Settings; mark as left is on a person's page |
| The group title "Workspace, settings and assistants" | "People, workspace and settings" |

Each new screen's article is checked by `guide.test.ts`; the page-help link ("Help with this page") follows the route.

### What's new (`src/help/whatsNew.ts`), one entry per item, newest first

| Item | id | Title | Lines |
|---|---|---|---|
| WR0 | `overview-mark-fixed` | "Workspace’s warning mark is its proper size" | "The overview drew a huge warning triangle beside anything to look at. It is a small mark again." |
| WR1 | `people-place` | "People has its own place" | "People and Teams moved out of Workspace to People, in the sidebar." "Open a person or a team to see who they are and go straight to their goals." "Old links still work." |
| WR2 | `workspace-about` | "Workspace opens on what matters" | "Workspace now opens on About: for admins, what needs sorting out, then the facts." "Leaving a workspace moved to Settings." |
| WR3 | `admins-on-access` | "Admins are managed where they are listed" | "Add or remove an admin on Workspace, Access, or from a person’s page." "Settings shows your own MCP tokens; admins make them on Access." |
| WR4 | `cycles-plainer` | "Cycles says where the year stands" | "Each cycle shows its week, its dates and when the wrap-up opens." "Features and Privacy say On or Off in words." |
| WR5 | `one-feedback` | "One Feedback item, one name for your workspace" | "Feedback and Send feedback are one item." "Your workspace has the same name everywhere." |

WR6 changes nothing people see: its commit says `[no news]`.

## 8. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 2 | People and Teams stay under Workspace | Routes stay `/workspace/people`, `/workspace/teams`, plus `/workspace/people/<id>` and `/workspace/teams/<id>`; the menu is About, People, Teams, Cycles, …; no People item in the sidebar; no redirects for those two. Everything else in 2.1 to 2.4 stands |
| 3 | Keep Overview | 2.5 keeps the name "Overview" and the needs list for everyone; only "Every section" and the foreign buttons go |
| 4 | Leave stays on Workspace | 2.11's item 7 moves to the foot of About, above Delete; U62 loses its last step |
| 5 | Keep both Feedback items | 2.13's second bullet is dropped |
| 6 | Keep "Reset the example" | It stays on About for admins of the example, as a plain button beside Rename |
| 7 | "Goal years" | The section's label and heading change; the id stays `cycles`; the vocabulary, spec, Help and spreadsheets follow in the same item |

## 9. Build plan

Backlog-sized items, in order. Effort: S (under a day), M (a release). Each is one PR with its spec section, conformance rows, evals, Help and What's new.

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| WR0 | **The warning mark, fixed** | Size the mark in About's rows (`.ws-need`); add P16. A bug on main: Lane decides whether it goes before the talk (decision 1) | S (an hour) | Nothing |
| WR1 | **People has its own place** | `/people`, `/teams`, a person, a team (2.1 to 2.4); rules 4 and 5; the sidebar and More; the redirects (rule 8); the two new places; U58, F10; Help `people`, `teams` | M | Nothing. Uses 0a's find-and-pick where it exists; until then the search list |
| WR2 | **Workspace opens on About** | 2.5; the one-line header; the menu; rules 1, 2, 3 and 7; `says` and `needs` on sections; Delete at the foot; the foreign buttons gone; the switcher (2.12); U59, U61 | S–M | WR1 (About links to People) |
| WR3 | **Admins and tokens where they are listed; Settings about you** | 2.7 and 2.11; the Admin tick box and Settings' Make button removed; Leave moves; U60, U62 | S–M | WR1 (a person's page), WR2 |
| WR4 | **Cycles, Features, Privacy and Recently removed, plainer** | 2.6, 2.8, 2.9, 2.10; rule 6 | S | WR2 |
| WR5 | **The shell: one Feedback, one name, one Demo panel** | 2.13. Rides with backlog NAV if that is built first | S | WR2 |
| WR6 | **Held at company size** | N11 with its 15,000-person fixture; becomes 0a (4)'s check when 0a lands. `[no news]` | S | WR1; best with 0a |

**Where it sits in the backlog (recommended):** WR0 at once if Lane says so; WR1 to WR5 after 0c and AS and before 0a, whose part (3) ("Workspace becomes tabs") this replaces and whose pickers then land once on the new pages; WR6 with 0a. About three releases of work in all: WR1 is one, WR2 with WR3 is one, WR4 to WR6 are one.

**For the rebuild kit:** WR1's stage notes say the Teams tab is the tree's home (R6a) and that the people pages are read-only where a directory feeds them; WR2's say the inbox count is not a workspace's business (R1, rule 6).
