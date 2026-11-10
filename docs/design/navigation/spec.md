# App navigation: the build spec

10 November 2026. For a build session to follow without asking. The reasons are in `README.md` beside this file (findings V1 to V10); the whole redesign is in `docs/design/README.md`. It assumes Lane takes the recommended answer to each decision; "If Lane decides otherwise" says what changes. It also assumes the Workspace redesign's decisions 2 and 5 (People in the main group; one Feedback item) and builds that design's shell changes (its section 2.13, item WR5), so they are not built twice.

**Standing rules** (from `CLAUDE.md`): each item adds its section of `spec/` and conformance rows, runs `npm run spec`, adds a What's new entry and updates the guide, comes with its evals, and passes `npm run typecheck`, `npm test` and `npm run evals:changed` (shared layout changes: the full `npm run evals`). No table, no migration. The shell is core (`src/ui/Shell.tsx`).

**Words used throughout.** `{ws}` is the workspace's name (Workspace spec, rule 1). "Owner" means someone who owns at least one goal in the running cycle. Wording in quotation marks is exact.

## 1. Routes

No new page except the queue on `/check-in`. Titles change (rule 2).

| Address | Screen | Change |
|---|---|---|
| `/check-in` | Check-in: the queue (2.4) | Was: straight into the first goal's form |
| `/check-in/<goalId>` | A goal's check-in | Unchanged |
| `/quick-check-in` | The table | Unchanged; lights Check-in |
| `/watching` | → `/goals?scope=watching` | As today's redirect, to the Goals spec's address |
| `*` | Page not found (2.6) | Gains Find |

### Redirects

| Old | New |
|---|---|
| `/check-in?start=1` (new) | The first due goal's form: what today's `/check-in` did, for Home's "Start check-in" |
| `/review` | `/reviews` (as today) |
| Everything in the Workspace spec's and the Goals spec's tables | As they say |

## 2. Screens

### 2.1 The sidebar (a computer, 1100 px and wider)

Wireframes 1 and 2. 236 px wide.

**Content, in order**

1. **Header:** Faro's wordmark. Under it the workspace switcher: `{ws}`, and under it "{kind} · week {w} · Q{q}" where kind is "Example data" or "Kept in this browser" or nothing. At its right, a small button "Collapse the sidebar" (an icon with that name).
2. **"Find"**: a row drawn as a field, with "Ctrl K" ("⌘K" on a Mac) at its right. Opens Find (`docs/design/find`, 2.4). Left out if Find isn't built.
3. A hairline.
4. **Your work:** "Home"; "Check-in" with its count (owners only); "Goals"; "Reviews" with its count. Counts as today (`Shell.tsx:197–200`): check-ins due this week; reviews you're in, held this week, with goals still to cover.
5. Under Goals, indented: up to four saved views (rule 1), each by its name, cut with an ellipsis and named in full by the app's label on hover and focus. No "Mine", "Watching" or "All". With more views than shown: nothing here; the Goals page's Views menu lists them all.
6. A hairline.
7. **Look up:** "People"; then any module's items in the order modules register them ("Metrics"); "Activity"; "Data".
8. A hairline.
9. **"New goal"**.
10. Space, then a hairline.
11. **This workspace and you:** "Workspace"; "Settings"; "Help" (with the dot and ", something new" for screen readers, as today); "Feedback".
12. **You:** avatar, name, and under it "Admin · {team}" or "{team}" ("No team" when none). In the demo it opens the panel "Demo" (the Workspace spec, 2.13); in the real app, "Not you?".

The groups have no visible headings; each is a `role="group"` with the names "Your work", "Look up", "Make" and "This workspace and you" for screen readers.

**Removed:** the "Demo" block; "Send feedback"; "Mine", "Watching", "All"; "{n} more views"; "Collapse sidebar" as a row.

**Which item is lit:** rule 3. Exactly one row has `aria-current="page"`, or none.

**Empty and error states**

- No saved views: nothing under Goals.
- A workspace still opening: the rows are there and inert, as today (`app.opening`).
- A module switched off: its row is gone.

### 2.2 The sidebar, collapsed

Wireframe 3. A 64 px rail; chosen in Settings → Navigation or by the header's button; remembered per browser as today (`look.sidebar`).

**Content, in order:** Faro's F; the workspace's initial in a square (opens the switcher); Find's icon; then every row of 2.1 as its icon, with the same hairlines; counts as small figures at the icon's corner; you as your avatar; at the foot nothing. The header's button becomes "Show the full sidebar", the first focusable thing after the skip link.

**Names.** Each icon shows the app's own label (`src/ui/Label.tsx`, new: a small flat box to the right of the icon, no arrow, no shadow) on pointer hover after 300 ms, at once on keyboard focus, and on a long press. It carries the row's full words: "Check-in, 5 to do", "Help, something new". The native `title` is removed from these rows, so the name isn't said twice.

**Goals' views.** Hovering or focusing the Goals icon opens, beside the label, a panel listing the same saved views as 2.1's item 5, each a link; Right moves into it, Escape closes it. With no saved views there is no panel.

**Empty and error states:** as 2.1.

### 2.3 The phone (under 700 px), and between (700 to 1099 px)

Wireframe 6. Between 700 and 1099 px the app uses the rail (2.2) whatever the setting; under 700 px, this.

**Top bar, in order:** Faro's F (44 px, opens the switcher); the page's name (rule 2's first part) and under it "{ws} · week {w}", wrapping to two lines before it is cut; "Find" (a 44 px button with the word, not only an icon); your avatar (opens what 2.1's item 12 opens).

**On a goal's page:** a slim bar instead: "‹ {where}" (rule 4's back link), "Find", your avatar. The goal's own summary sits under it and sticks when you scroll, as today. The tab bar never covers content: the page's foot has the tab bar's height as padding.

**Tab bar:** for an owner "Home", "Check-in" (count), "Goals", "Reviews" (count), "More"; for anyone else "Home", "Goals", "Reviews", "People", "More". Lit by rule 3; "More" is lit when the lit row is inside More.

**More, in order** (a sheet titled "More"):

1. "Look up": "People" (when not a tab), modules' items ("Metrics"), "Activity", "Data".
2. "Make": "New goal".
3. "This workspace and you": "Workspace", "Settings", "Help", "Feedback".
4. In the demo: "Demo" with the line "Switch person, walkthroughs, start over".
5. You: avatar, name, "Admin · {team}" / "{team}".

Group names are shown here (small labels), since a sheet has room. No saved views, no "Mine", no "Send feedback".

### 2.4 Check-in: the queue (`/check-in`)

Wireframe 4. Narrow (620 px). Not focus mode: the sidebar stays. A goal's form (`/check-in/<id>`) is focus mode as today.

**Content, in order**

1. Title "Check-in". Under it "Week {w}, {dates}. Check-ins are due by {weekday}{, tomorrow | , today | }." (the workspace's deadline, in Home's words).
2. Primary action: **"Start with {first goal's title}"** → that goal's form, which then walks the rest in order as today ("1 of 5"). One due: **"Check in on {title}"**.
3. "To do this week · {n}": one row per due goal, in the order the walk uses. A row: the status as shape and word; the title; under it what it last said, "Last week: 36 hours · 8 behind plan" / "No check-in yet"; at the right a plain button "Check in". A row with a kept draft says "Draft kept" and its button is "Carry on".
4. "Done this week · {n}" (when any): the same rows with this week's number and "Checked in {day}"; at the right "Correct it".
5. A line: "Or type all your numbers in one table" → `/quick-check-in`.

**Empty and error states**

| When | Says |
|---|---|
| Nothing due, some done | Title; "You’re all set for week {w}." No primary button; "Done this week" follows |
| Nothing due because no check-ins are due yet (day one) | "Nothing to check in yet. The first check-ins are due by {weekday} {date}." |
| You own no goal (the address typed by hand) | "You don’t own a goal in {ws}, so there’s nothing to check in." and the links "See the goals you watch" and "Set up a goal" |
| The cycle is over | "{cycle} has ended. Check-ins start again with the next cycle." |

Home's "Start check-in" goes to `/check-in?start=1` and behaves as today: straight into the first form. The sidebar's and the tab bar's Check-in open the queue.

### 2.5 Wayfinding on every page

Wireframe 5.

1. **The back link** (rule 4): above the title, "‹ {where}", a link; on every page below a place's first page; never on a place's first page (Home, Check-in, Goals, Reviews, People, Teams, Metrics, Activity, Data, Workspace → About, Settings, Help, Feedback). On a phone, Workspace's and Settings' sub-pages have "‹ Workspace" (the Workspace spec).
2. **Section links** on a goal's page and on Settings: a row under the title naming the page's sections as links to their anchors; it sticks to the top of the work area on scroll and lights the section in view (`aria-current="true"`). On a phone it scrolls sideways inside itself, the lit one kept in view. Goal: the sections the Goal page spec lists. Settings: "You", "Appearance", "Navigation", "Your MCP tokens", "Leave".
3. **Leaving a form** (focus mode): one control, top right, a button with the words (not only an icon):
   - "Close and keep the draft": check-in, the table check-in, New goal, goal edit, set-up;
   - "Close without saving": a review's set-up and edit, a goal's wrap-up. With something typed it first asks "Close without saving? What you typed here will be lost." with "Keep editing" and "Close without saving".
   Goal edit's second exit ("Back to {goal}") is removed. The review walkthrough keeps "Close the review" (it is not a form: what was said is already saved) and its "‹ {review}".
4. **Steps in the address** for every stepped form: New goal (`docs/design/onboarding`), set-up (`/workspace/new/<step>`), a check-in's second step (`/check-in/<id>/why`). The browser's Back goes back one step and keeps what was typed; Back on the first step leaves the form and keeps the draft.

### 2.6 Page not found

Narrow. Title "Page not found". "There’s nothing at this address. The link may be old, or mistyped." Primary action **"Go to Home"**; then a Find field (find-and-pick over everything, inline) under "Or find what you were looking for"; then "Help". A goal, person, team, metric or review that doesn't exist keeps its own page's words ("That person isn’t in {ws}.") and gains the same Find field.

### 2.7 Settings → Navigation

One block on Settings (the Workspace spec, 2.11), unchanged in place: "Sidebar: Full / Icons only" and, new, two lines: "Icons name themselves when you point at them or reach them with the keyboard." and "Check-in shows when you own a goal. People who own none see Goals, Reviews and People instead."

## 3. Who sees what

Consistent with R1. Navigation shows a place only to someone who can use it; it grants nothing.

| Thing | Owns a goal | Owns none | Admin | R1 |
|---|---|---|---|---|
| Home, Goals, Reviews, People, Activity, Data, New goal, Workspace, Settings, Help | Yes | Yes | Yes | Rule 3 (reading is open); "Add a goal: anyone, for a goal they own" |
| Check-in in the sidebar and tabs | Yes | No; the address explains (2.4) | By the same rule | — |
| Feedback | Yes in Faro | Yes in Faro | Yes | Rule 6: builders only in the internal app |
| Metrics (module on) | Yes | Yes | Yes | Rule 3 |
| Workspace's admin sections | No | No | Yes | The Workspace spec |
| Saved views under Goals | Pinned ones and their own | The same | The same; an admin pins | "Pin a view for everyone: admins" (`pinView`) |
| "Admin" under the name | — | — | Yes | — |
| Demo; "Not you?" | Faro only | Faro only | Faro only | Rule 1: neither exists in the internal app |

## 4. Rules for `src/domain`

In `src/domain/navigation.ts` (new), pure, each with tests from its worked examples, a section in `src/spec/rules.ts` and conformance rows. Today these decisions live in `Shell.tsx` (`sideFor`, `tabsFor`, `isActive`, `title`, `goalsAt`) and `BackLink.tsx` (`placeName`); they move so the sidebar, the rail, the tab bar, More and the tests ask one place.

### Rule 1. The menu: `menuFor(viewer, snapshot, modules, views, recents)`

Returns the groups of 2.1 with their rows, counts and the saved views under Goals.

- Check-in is present when the viewer owns a goal in the running cycle that isn't stopped or done.
- Saved views: those pinned for everyone, A to Z, then the viewer's own, most recently opened first (from `recents`, the Find spec's rule 6); four at most.
- `tabsFor(menu)` gives the phone's four tabs and `moreFor(menu)` the rest in groups.

| Given (the example, 11 Nov) | Then |
|---|---|
| Rhea | Your work: Home, Check-in 5, Goals, Reviews 1. Views: Division at a glance, No update for 2 weeks or more (pinned), My goals by status (hers). Look up: People, Metrics, Activity, Data. Tabs: Home, Check-in, Goals, Reviews |
| Tunde | As Rhea, Check-in with no count, Reviews with none; views: the two pinned |
| Amara | No Check-in. Views: the two pinned, then her two, latest opened first. Tabs: Home, Goals, Reviews, People |
| Oskar | No Check-in. Views: the two pinned, then "AI goals". Tabs as Amara |
| Rhea with seven views of her own | The two pinned and her two latest; the other five only in Goals' Views menu |
| The metric library switched off | No Metrics row, on any width |
| Tunde, whose two goals are both done | No Check-in |

### Rule 2. A page's name: `pageName(path, search, things)`

Returns the name for the browser's title, the phone's top bar and Find's "Opened lately". The title is "{name} · {ws} · Faro".

| Address | Name |
|---|---|
| `/` | "Home" |
| `/goals` | "Goals" (the scope is not in the title) |
| `/goals/G-1` | "Lead time for changes" |
| `/goals/G-1/edit` | "Change Lead time for changes" |
| `/goals/G-1/print` | "Lead time for changes, to print" |
| `/goals/G-1?review=weekly` | "Lead time for changes · Platform leadership weekly" |
| `/goals/new/measure` | "New goal: how it’s measured" |
| `/check-in` | "Check-in" |
| `/check-in/G-1` | "Check in: Lead time for changes" |
| `/quick-check-in` | "Check-in, all in one table" |
| `/reviews/weekly` | "Platform leadership weekly" |
| `/people/rhea` | "Rhea Kapoor" |
| `/teams/cicd` | "CI/CD" |
| `/metrics/lead-time` | "Lead time for changes (metric)" |
| `/workspace/access` | "Access · Workspace" |
| `/help/goals` | The article's title |
| `/retro` | "Wrap up {cycle}" |
| An unknown goal | "Goal not found" |

A goal and a metric can share a name, so a metric's page says "(metric)".

### Rule 3. The lit item: `litItem(path, search, menu)`

Returns one row's id, or nothing.

| Address | Lit |
|---|---|
| `/` | Home |
| `/check-in`, `/check-in/<id>`, `/quick-check-in` | Check-in |
| `/goals` with a saved view's exact address | That view's row (Goals itself not lit) |
| `/goals` otherwise, `/goals/<id>` and its edit and print, `/retro`, `/retro/<id>` | Goals |
| `/goals/<id>?review=<r>` | Reviews |
| `/goals/new/…` | New goal |
| `/reviews…` | Reviews |
| `/people…`, `/teams…` | People |
| `/metrics…` | Metrics |
| `/activity`, `/data…` | Activity, Data |
| `/workspace…` except `/workspace/new` | Workspace |
| `/settings` | Settings |
| `/help…`, `/whats-new` | Help |
| `/feedback` | Feedback |
| `/ready`, `/research`, `/workspace/new`, page not found | Nothing |

On a phone the tab that holds the lit row is lit; a row in More lights More.

### Rule 4. The back link: `backTo(path, search, trail, snapshot)`

Returns `{ label, to, steps }` or nothing. `trail` is the tab's history as `BackLink.tsx` keeps it.

1. On a place's first page (2.5's list): nothing.
2. If the trail has an earlier page in this app that isn't a form and isn't this page: that page, named by rule 2 in the navigation's words ("your goals" for Goals on Mine; a saved view's name; "Home"); `steps` is how many entries back it is.
3. Otherwise the structural parent:

| Page | Parent | Says |
|---|---|---|
| A goal that feeds another | That goal | "‹ {its title}" |
| A goal that feeds nothing | Goals | "‹ Goals" |
| A goal's edit or print page | The goal | "‹ {title}" |
| A review; a review's summary | Reviews; the review | "‹ Reviews"; "‹ {review}" |
| A goal in a review's walkthrough | The review | "‹ {review}" |
| A person; a team | People; Teams (the Workspace spec) | "‹ People"; "‹ Teams" |
| A metric | Metrics | "‹ Metrics" |
| A Help article; What's new | Help | "‹ Help" |
| The table check-in | Check-in | "‹ Check-in" |

4. Pressing it goes back `steps` entries when rule 2 chose it, so the browser's Forward still works; otherwise it navigates to `to`. When `steps` is more than 1 (a form was stepped over), the form's entries are first replaced by the page before them, so one press of the browser's Back afterwards agrees with the link.

| Given | Then |
|---|---|
| Goals on Mine → Lead time for changes | "‹ your goals", one step back |
| Goals → a goal → Edit → Save → the goal | "‹ Goals"; the browser's Back also goes to Goals |
| A link to `/goals/G-7` (Merge-to-deploy time, which feeds G-1) opened in a new tab | "‹ Lead time for changes" |
| A link to `/goals/G-1` in a new tab | "‹ Goals" |
| Settings, from anywhere | Nothing |
| Home → Rhea's page (from an avatar) | "‹ Home" |
| A new tab on `/people/rhea` | "‹ People" |

## 5. Extension points

- A module's `navigation` item (`src/core/app.tsx`) gains an optional `group: 'work' | 'lookup'` (default `'lookup'`); the manifest test checks it. Items keep their place before New goal, now by group.
- A module's route gives its page's name to rule 2 by `title` (as today) or a new `name(params, snapshot)` for a page about one thing (a metric's page).
- `docs/architecture.md`'s Navigation row is updated: "sidebar items in the Look up group (or Your work); also in More on a phone".

## 6. Evals

### Journeys

| # | Requirements | Journey |
|---|---|---|
| U67 | NAV-PLACES | The same menu everywhere: as Rhea at 1440 the sidebar's rows are exactly rule 1's, in its groups, and fit a 900 px window without scrolling; none of Mine, Watching, All, Send feedback or a Demo block is there; her three saved views are under Goals and the one she opens is lit; as Oskar there is no Check-in and Settings → Navigation says why. At 390 the tabs and More are rule 1's for each of them |
| U68 | NAV-COLLAPSED | Collapsed keeps everything: collapse the sidebar; focus each icon with the keyboard and read its label ("Check-in, 5 to do"); focus Goals and open a saved view from its panel; open the switcher and Find; expand again from the header's button. No row has a `title` and a label at once |
| U69 | NAV-WHERE | A page says where it is: for every address in rule 2's and rule 3's tables, the browser's title and the lit item match; six goals opened in turn give six different titles |
| U70 | NAV-BACK | Back agrees: each row of rule 4's examples; after "‹", the browser's Forward returns; after saving an edit, the browser's Back and the link go to the same page; a new tab on a feeder goal goes up the tree |
| U71 | CHECK-IN-QUEUE | The queue can be seen: as Rhea, Check-in lists her 5 due goals with "Start with …"; "Check in" on the third opens it; closing keeps the draft and the row says "Draft kept"; "Or type all your numbers in one table" opens the table, which lights Check-in; Home's "Start check-in" still opens the first form. As Oskar the address says he owns no goal |
| U72 | NAV-FORMS | One way out of a form: every focus-mode page has exactly one closing control, worded by 2.5; New goal's and set-up's steps are in the address and the browser's Back steps back with the fields kept; "Close without saving" asks first when something was typed |

**Changed:** every journey that opens Mine, Watching or a saved view from the sidebar's old rows (they use the Goals page's tabs, or the views under Goals); U12 and U53 (the Demo panel from the person button); U8 and the phone journeys (tabs and More); journeys that start a check-in from the sidebar (the queue first).

### F, N and P checks

| # | Check |
|---|---|
| F12 | At 1440 × 900 and 1280 × 720, for each of the four demo people, the sidebar doesn't scroll and its last row is fully in view; at 390 × 844 More has at most 12 rows and doesn't scroll; the top bar's workspace line isn't cut; on a goal's page nothing is under the tab bar at the first screen |
| P18 | Design: the rail's labels and Goals' panel are flat (no shadow over 1 px, no arrow glyph); no navigation row uses a native `title` for its name; every lit row is lit over its whole surface (no edge bar) |
| P7 | Extended: between 700 and 1099 px the rail is used and no page scrolls sideways |
| N6 | Reads the new tab bar |

### Unit tests

One file per rule with every worked example; `guide.test.ts` for the queue's Help; the manifest test for `group`.

### Requirements (`evals/requirements.json`)

New: `NAV-PLACES` ("The menu lists places in the same groups for everyone, and fits the screen"), `NAV-COLLAPSED` ("Collapsed, every place is still named and reachable by pointer, keyboard and touch"), `NAV-WHERE` ("Every page names itself in the browser's title and lights one place"), `NAV-BACK` ("One back link per page, which agrees with the browser's Back"), `CHECK-IN-QUEUE` ("The week's check-ins can be seen as a list and started from any of them"), `NAV-FORMS` ("A form has one way out, and its steps are in the address").

## 7. Help and What's new

### Help (`src/help/guide.ts`)

| Article | Change |
|---|---|
| `getting-around` (new; listed first under "Getting around") | The groups of the menu; Find and its key; why Check-in may be missing; collapsing the sidebar; the phone's tabs and More; the back link; the browser's title |
| `check-in` (route `/check-in`) | Opens with the queue: the list, "Start with", drafts, the table |
| `goals` | "Mine, Watching and All are tabs on the page"; saved views under Goals and in Views |
| `settings` | The Navigation block's two new lines |
| `feedback`, `workspace` | As the Workspace spec (one Feedback item; the Demo panel) |

### What's new (`src/help/whatsNew.ts`)

| Item | id | Title | Lines |
|---|---|---|---|
| NV1 | `menu-in-groups` | "A shorter menu, in three groups" | "Your work, things to look up, and this workspace and you." "Mine, Watching and All are now tabs on Goals, which opens on the one you used last." "Feedback and Send feedback are one item; the demo's controls are behind your name." |
| NV1 | `collapsed-names` | "The collapsed sidebar names its icons" | "Point at an icon, or reach it with the keyboard, to see its name. Saved views open from the Goals icon." |
| NV2 | `pages-name-themselves` | "Each page has its own name" | "A goal's browser tab says the goal's name." "One back link on each page, which agrees with your browser's Back button." |
| NV3 | `check-in-queue` | "See your check-ins before you start" | "Check-in opens on the week's list. Start with the first, or pick any." |

## 8. If Lane decides otherwise

| Decision | Other answer | What changes |
|---|---|---|
| 1 | Keep Mine, Watching, All in the sidebar | 2.1's item 5 lists them before the views (as links to the Goals spec's scope addresses); rule 3 lights them; F12's limit still holds, so views drop to two |
| 2 | No saved views in the sidebar | Item 5 and the rail's panel go; rule 1 returns no views |
| 2 | Up to six | Rule 1's limit is six; F12 is checked with six (it fits at 900 px, not at 720: the rail's panel is then the only way at 720) |
| 3 | Check-in always shown | Rule 1 always includes it; 2.4's "You don't own a goal" state is its page; the phone's tabs are the owner's for everyone; Settings' second line goes |
| 4 | Keep the Demo block | It sits last in "This workspace and you", after Feedback; F12 is checked with it |
| Find's 1 | Find isn't built | 2.1's item 2, the top bar's Find and 2.6's field are left out |

## 9. Build plan

| # | Item | What | Effort | Depends on |
|---|---|---|---|---|
| NV1 | **The menu in groups, collapsed and on a phone** | 2.1, 2.2, 2.3, 2.7; rule 1; the Workspace spec's 2.13 (WR5: one Feedback, one name, one Demo panel); U67, U68, F12, P18 | M | The Goals page's scope tabs (GL1) must land with or before it, since Mine and Watching leave the sidebar. People's row needs WR1; Metrics' row needs ML1: each appears when its page exists |
| NV2 | **Where you are** | 2.5 (the back link, section links on Settings, leaving a form), 2.6; rules 2, 3, 4; U69, U70, U72 | S–M | Nothing. The goal page's section links are built with GT1 |
| NV3 | **The check-in queue** | 2.4; U71 | S | Nothing |

**This replaces backlog NAV** ((1) to (4), (6), (7); (5) is the onboarding spec's OB1) **and builds WR5**. The order across areas is in `docs/design/README.md`.

**For the rebuild kit:** NV1's stage notes say the menu is one function of the viewer (rule 1), that "Not you?" and Demo don't exist behind sign-in (R1, rule 1), and where R6a's scope sits in the header.
