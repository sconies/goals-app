# Workspace: evaluation for a redesign, 10 November 2026

Lane asked for a redesign of the Workspace area and a spec, not a build: its flow, information hierarchy and general usability are poor. This is the evaluation. The design is in `docs/design/workspace/README.md` and the build spec in `docs/design/workspace/spec.md`. No app code was changed.

## How it was done

- **Read:** `CLAUDE.md`, the design rules, the architecture, the backlog (W in #50, WS in #70, 0a's Workspace notes and Lane's decisions of 7 Nov), the reviews (WS's row carries the 9 Nov deep dive; the deep review's U1, U7 and A4), and requirements R1 and R6a.
- **Walked** the live demo at `/demo?today=2026-11-11` with Playwright, at 1440 × 900 and 390 × 844, as Amara Nwosu (admin, leader), Rhea Kapoor (member, manager) and Oskar Lindgren (member, owns no goals): `/workspace` and all eight sections, Settings, Feedback, Help, the switcher, the person and team sheets, Leave, the demo controls and the phone's More sheet.
- **Set up a workspace** ("Field Operations", two people, the Product team template) at `/?store=browser` with every request off the site blocked (8 blocked, nothing written to the shared database), then walked its Workspace on day one, and opened it as the teammate.
- **Read the code** behind each screen: `src/screens/Workspace.tsx`, `src/ui/WorkspaceSwitch.tsx`, `src/screens/Settings.tsx`, `src/screens/Feedback.tsx`, `src/ui/AiAssistants.tsx`, `src/ui/RecentlyRemoved.tsx`, `src/ui/Demo.tsx`, `src/ui/Shell.tsx`, `src/domain/workspaceAttention.ts`. No module registers a Workspace section today (`sections` appears in no `module.json`).

**Not covered:** dark mode, a screen reader pass, the real shared database (only the demo and a browser-only copy), and the inbox's own triage flow (reviewed in WS).

Severity: **Talk** (visible in Wednesday's talk), **High** (people fail or are misled), **Medium** (slower or confusing), **Low** (polish).

## One thing first: a bug on the live site

**F1. The Workspace overview draws a warning mark about 730 px wide. Talk. Not in the backlog.**

- **Saw:** on `/demo/workspace?today=2026-11-11`, as anyone, "To look at here · 1" is a white box about 780 px tall holding one enormous warning triangle, with its sentence squeezed into a column one word wide at the right edge. At 390 px the page also scrolls sideways (the row is 411 px wide). A workspace set up today shows two of them, one above the other (1,100 px of triangle) because it has two things to look at.
- **Why:** `src/styles/notes/workspace.css:123` sizes `.ws-need > .warn-mark`, but `WarnMark` (`src/ui/bits.tsx:28`) is an `<svg>` with no class and no width, so nothing sizes it and it fills the row. Elsewhere the mark sits inside a class that sizes it. The U53 check only asks that the heading is visible (`evals/journeys.cjs:2656`), and P6 has no rule about an icon's size.
- **Why it matters:** WS's own row says "the talk walks Workspace". The example always has at least one thing to look at (a markup sent from the demo three days before is still New), so every role sees it.
- **Before the talk, without code:** mark that markup "In hand" in Feedback, and the example's overview shows "Nothing to look at". That does not help a workspace set up on stage.
- **The fix:** one line (give the mark a size in that row), plus a design check that no icon in a list row is wider than 24 px. It is a bug in a merged release, so `CLAUDE.md` says fix at once; the freeze makes it Lane's call (decision 1 in the design).

## The jobs people come to do

At 15,000 people the numbers matter more than the list: almost everyone comes to look someone or some team up; a handful come to administer.

| Who | Job | How often | Today |
|---|---|---|---|
| Everyone | Find a person: who they are, their team, what they own | Weekly | People lists them; a member's click on a person does nothing, and nothing links to their goals |
| Everyone | Find a team: who leads it, who is in it, how its goals are doing | Weekly | Teams lists them; a row opens People filtered by the team; no goals |
| Everyone | See which workspace this is, and who its admins are | Rarely | Said four times on every Workspace page, and in the switcher |
| Everyone | Read what the app records about them | Once | Privacy, and again (in different words) on Settings |
| Everyone | Switch workspace | Rarely at a company; often in the demo | The switcher: works well |
| Everyone | Undo something they removed | Occasionally | Recently removed: works |
| Manager (Rhea) | Check her team: who is in it, who owns what, who has no goals | Monthly, and at the year's start | Not possible from here; Goals' "By team" is the nearest |
| Admin (Grace, Hamid) | Someone joins, moves team or leaves | Weekly at 100 people; from the directory at 15,000 (R6a) | People, by way of an edit sheet per person |
| Admin | Add, rename or remove a team; name its lead | Monthly | Teams: two buttons on every row |
| Admin | Make or remove an admin | A few times a year | A tick box inside a person's edit sheet; Access only lists them |
| Admin | Give someone an MCP token, or revoke one | Occasionally | Access (and Settings) |
| Admin | Close the year and start the next | Once a year | Cycles, which leads to the wrap-up |
| Admin | Switch a feature or recording on or off | Once | Features, Privacy: work |
| Admin | Rename or delete the workspace | Almost never | Overview |
| Whoever sets it up | Create a workspace, invite people, check it on day one | Once | Set-up is good; day one's Workspace is F1 and F9 |
| Someone trying Faro | Become another person, reset, take a walkthrough | Demo only | Demo controls, plus copies on the overview |

**What this says about the structure.** The weekly jobs, done by everyone, are about people and teams. The rare jobs, done by a few, are about settings. Today both sit behind one door called Workspace, whose first screen is an index of itself, so 15,000 people walk through an admin area to find a colleague, and an admin's rare settings get the same weight as the directory.

## What's wrong

### Structure and flow

**F2. The landing page is a list of the other pages, shown twice. High.**

- **Saw:** on a computer, `/workspace` shows the side menu (Overview, People 97, Teams 14, Cycles, Access, Features, Privacy, Recently removed) and, beside it, "Every section": the same seven links with a line each (`Workspace.tsx:281–288`). On a phone, `/workspace` is a list of sections whose first item is "Overview", which opens a page that lists the sections again (`Workspace.tsx:105`, `187–205`).
- **Why it matters:** the first screen of the area has no content of its own. On a phone, "what needs attention here" is two taps in, behind an item called Overview that sits inside the thing it is an overview of.
- **Backlog:** WS built this ("the overview answers what needs attention here, then lists every section"). The listing is the part to drop.

**F3. No screen in Workspace has a clear main thing to do, and the overview's buttons are about other workspaces. High.**

- **Saw:** the overview's most prominent controls are "Try it with your own team" and "Reset the example" (demo) or "Set up a workspace" and "Try the demo" (real app) (`Workspace.tsx:253–259`). None acts on the workspace that is open. "Rename" is beside them at the same weight. People and Teams do have one primary button; Access has none on the list it shows; Cycles has none.
- **Why it matters:** `CLAUDE.md` asks for one primary action per screen. The page a new admin lands on offers leaving for another workspace as its main choice.

**F4. People and teams can be listed but not opened. High.**

- **Saw:** as Rhea or Oskar, a person's row is a static `div` (`Workspace.tsx:345`): nothing happens on click. As Amara the same click opens "Change Rhea Kapoor", an edit form (`Workspace.tsx:344`). There is no person page and no team page; a team row opens People filtered by team (`Workspace.tsx:517`). Nothing here leads to a person's or a team's goals, though Goals already takes `?owner=` and `?team=` (`GoalsScreen.tsx:347–348`). A team's objective (`Team.objective`) is shown nowhere in Workspace.
- **Why it matters:** the commonest job, "who is this and what do they own", ends at a name. Reading and changing are one control, so an admin who only wants to look is put into a form.
- **Backlog:** not there. R6a (spec only) needs a page per team to scope by; this is where it would live.

**F5. The directory won't hold a company. High for the rebuild; Medium for the demo.**

- **Saw:** People is 5,358 px tall at 1440 for 97 people (5,627 px on a phone): grouped under 14 team headings, 60 at a time, with "Show 37 more" at the very bottom. The team filter is a native select with every team in it (`Workspace.tsx:329–333`). Mark as left, Leave, Team lead and "Who it acts as" are native selects of all 97 people (`RemoveSheets`, `Workspace.tsx:567–570`, `AiAssistants.tsx:85`).
- **Why it matters:** at 15,000 people and 1,500 teams the grouping is 1,500 headings and each select is unusable. Grouping by team also means a search result jumps between groups.
- **Backlog:** the selects are 0a (2), listed there by name. The page's shape (flat, paged, team on the row) is not.

**F6. Teams puts two buttons on every row, one of them destructive. Medium.**

- **Saw:** 14 teams, 28 buttons: Rename and Remove on each (`Workspace.tsx:521–526`). On a phone they wrap under the name and the page is 2,256 px against 1,472 px for a member. "Rename" opens a sheet titled "Change CI/CD" that also changes the lead (`Workspace.tsx:557–571`).
- **Why it matters:** the eye lands on 28 controls instead of 14 names; Remove is one slip from Rename on every row; the button's name undersells what it does.

**F7. Access lists the admins but can't change them, and mixes two subjects. Medium.**

- **Saw:** Access shows "Admins · 3" as a read-only list, then "Make someone an admin, or stop them being one, from their entry in People" (`Workspace.tsx:403–409`). The change is a tick box in the person sheet (`Workspace.tsx:716–719`). Below it, MCP access, with "Make an MCP token" as an unranked button. A member who opens the address is told "Access is for the workspace's admins", then given the admins' names anyway.
- **Why it matters:** the place that answers "who can change things here" is not where you change it. The admins' names are not a secret (they are in the permissions line on every page), so hiding the list from members protects nothing.

**F8. Four doors, and three of them lead to the same index. Medium.**

- **Saw:** the sidebar's Workspace item; the switcher's "Workspace" row (`WorkspaceSwitch.tsx:159–161`); the overview; and on a phone More → Workspace → Overview. "Set up a workspace" is in the switcher and on the overview. Settings is in the sidebar, the person menu and More (`Shell.tsx:79`, `277`, `333`).
- **Why it matters:** each duplicate is something to read and to keep in step. WS moved set-up to the switcher "and Workspace"; one is enough.

**F9. "To look at here" lists the wrong things for the wrong people. Medium.**

- **Saw:** in the example, the only item, for every role including Oskar, is "1 new markup or piece of feedback was sent from this workspace", which opens the inbox of every workspace (`workspaceAttention.ts:51`). In a workspace made a minute ago: "Only 2 people here. Goal owners need to be here to check in" (set-up had just said "You can also add people later") and "1 team has no lead" (set-up never asks for one; U7 in the deep review, still true). Cycles offers "See the wrap-up" in week 46 of a workspace born that day.
- **Why it matters:** feedback about Faro is the builders' business, not a member's, and in the internal app only builders may read it (R1, rule 6). A list that nags on day one about choices the set-up made for you teaches people to ignore it.
- **Backlog:** U7 is in the deep review ("check against WS when it lands"). WS landed; these two remain.

**F10. Leaving and deleting sit at the foot of the landing page. Medium.**

- **Saw:** "Leave this workspace" and, for admins of their own, "Delete this workspace" close the overview (`Workspace.tsx:289–290`). In the demo, Leave says "(in this browser)" and offers a select of 96 people to take over 7 asks.
- **Why it matters:** leaving is about you, and Settings is where "you" lives (Lane, 7 Nov (c)). The landing page of an area should not end in its two most destructive actions. In the internal app leaving is the directory's job (R1, rule 2).

### Information hierarchy and density

**F11. Every section spends its first 170 px saying the same three things. Medium.**

- **Saw:** on all eight sections: the title "Workspace"; a line about the demo ("The example, and any you set up here to try it. All of it stays in this browser."); and "Your permissions: you're a member here. Access and Features, and changing people, teams or settings, are for admins: Amara Nwosu, Grace Achterberg and Hamid Rezaei." (`Workspace.tsx:99–103`, `117–129`). Then the section repeats the admins: People ("Admins can add people: …"), Cycles ("Only admins delete a cycle or start the next: …"), Privacy ("Only admins change it: …").
- **Why it matters:** a member reads the three admins' names twice per page. With 40 admins the sentence is a paragraph. The line about the demo describes the demo, not the page.
- **Backlog:** WS added the permissions line so sections "don't silently appear and vanish". The aim is right; one short role line does it.

**F12. Too dense where people read, too thin where they don't. Medium.**

- **Saw:** People: 97 rows, 14 headings, a page five screens long. Cycles, Access, Features, Privacy and Recently removed: each under one screen, most of it the repeated header, with one to three lines of content. Cycles is a whole section for one row.
- **Why it matters:** the menu gives eight equal entries to pages of very unequal weight, and the two that matter most to most people (People, Teams) are second and third in a list that starts with an index.

**F13. Cycles opens with the rule for deleting one. Medium.**

- **Saw:** "A cycle is a goal year. One nobody has checked in to yet can be deleted with its goals; one with check-ins stays. The next one starts from the wrap-up at the end of the running one." Then the row: "126 goals, 5,347 check-ins: it stays" (`Workspace.tsx:370`, `cycleStanding`).
- **Why it matters:** the page answers "may I delete this?", which nobody asks of a year with 5,347 check-ins. It should answer "where are we in the year, and what happens next": the wrap-up opens in week 52, and the next cycle starts from it.

**F14. Settings repeats Workspace, and offers an admin action. Medium.**

- **Saw:** Settings has "What the app records": four bullets and a sentence, the same facts as Workspace → Privacy in other words (`Settings.tsx:90–109`). "Your MCP access" shows an admin "Make an MCP token", which makes one for anybody (`AiAssistants.tsx:21`), on the page that is "your own choices". The "You" block's only action is "Switch person" (demo) or "Not you?".
- **Why it matters:** Lane's rule of 7 Nov is clean (Settings is about you; Workspace is about everyone); these three blur it. Two wordings of one privacy fact will drift.
- **Backlog:** NAV (4) and (6) cover Settings' section links and its back link; this is not there.

### Wayfinding and wording

**F15. One workspace, three names. Low.**

- **Saw:** the sidebar says "Platform Engineering" with "Example · Week 46 · Q4" under it; the phone's top bar says "Example data, week 4…" (cut off at 390 px); the pages, sheets and toasts say "Example: Platform Engineering" ("Take yourself out of Example: Platform Engineering (in this browser)"). `WorkspaceSwitch.tsx:114`, `129`.
- **Why it matters:** the switcher strips "Example:" and the page puts it back. One name, with "example data" as a quiet second line, everywhere.

**F16. Words that describe the page instead of the thing. Low.**

| Where | Says | Trouble |
|---|---|---|
| Overview's summary | "What to look at here, then every section." | Describes the layout |
| Overview | "To look at here" / "Every section" | Not how anyone talks |
| Overview, Cycles row | "2026 is open" | The sidebar says "Week 46 · Q4"; "open" is used nowhere else |
| Cycles | "126 goals, 5,347 check-ins: it stays" | Answers a question nobody asked |
| Overview, Recently removed | "Nothing of yours" | Reads as a rebuke |
| Overview, Access (demo) | "3 admins; MCP tokens are for the real app" | Two facts, one about a different app |
| Teams | "Rename" | Also changes the lead |
| Header | "Your permissions: you're an admin here, so you see every section…" | 20 words for "Admin" |
| Sidebar | "Feedback" and "Send feedback", one above the other | Two entries, near-identical names (`Shell.tsx:282–283`) |

**F17. The demo's controls leak into Workspace and are named twice. Low.**

- **Saw:** "Reset the example" on the overview (admins) and "Start over" in Demo controls (everyone) do the same thing (`Workspace.tsx:258`, `Demo.tsx`); a member is told "To put the example back as it was, use Start over in Demo controls". On a computer the person button opens the same panel under the title "Switch person", with Settings, walkthroughs, research and Start over inside it; the "Demo" block opens it as "Demo". With the demo block in place, "Collapse sidebar" is cut off at the bottom of a 900 px window.
- **Why it matters:** the admin-only rule on Reset protects nothing while Start over is open to all. One panel should have one name.
- **Backlog:** Lane decided on 9 Nov "reset and delete for admins, the demo's Start over for everyone". This asks him to drop the duplicate (decision 6).

**F18. Feedback is "beside Help" but reads as part of the workspace's work. Low.**

- **Saw:** in the demo, Feedback shows a real markup from "Lane, Pet store" beside the demo's own. The overview counts feedback as something to look at here (F9).
- **Why it matters:** the deep review's P3 calls the inbox "Faro's own workshop, not the product". Lane's placing of it beside Help (9 Nov) is right; what's left is to stop Workspace pointing at it, and to say in the spec that the internal app keeps it to builders.

### Phone

**F19. People is three taps away and the first screen is an index. Medium.**

- **Saw:** More → Workspace → People. `/workspace` at 390 px is the section list (998 px for a member); the title "Workspace" appears in the top bar and again as the page heading. Teams as an admin is 2,256 px (F6). The overview scrolls sideways (F1).
- **Why it matters:** the weekly job is the deepest one.

### Design rules

**F20. Two small departures. Low.**

- The "Admin" mark on a person's row is a small bordered box (`.chip.tag`, `styles.css:189`): not a pastel pill, but a state in a capsule where the rules ask for a word.
- Features and Privacy use a bare tick box for a switch that takes effect at once for everyone. The state should be said in a word ("On", "Off") beside the control, as status is everywhere else.

Nothing in Workspace uses an edge stripe, a quote bar, an emoji or a pastel pill. F1 is the only thing P6 should have caught and didn't.

### For the rebuild

**F21. The organisation has no home. High for the rebuild.**

- **Saw:** teams are a flat list inside an admin area (A4, R6a). There is nowhere to show a team under its parent, or to make a team the scope of Goals.
- **Why it matters:** R6a's tree, managers and scope need a People area that everyone uses, with a page per team. If Faro shows teams as a settings list, that is what gets copied.
- **Backlog:** R6a is spec only (#72). This makes its screens' home part of the model.

## What works and should be kept

- **The switcher** (WS): switching is real navigation, Back returns, a draft is warned about and kept.
- **A section per address** (W): `/workspace/<section>`, and modules can add their own.
- **Set-up:** seven steps, per-field errors, recording asked and off unless chosen, and an honest Check page.
- **Undo on every switch**, and "nothing it saved is lost".
- **Removing a team** moves its people and goals in the same step and says so.
- **Admin-only pages name the admins** instead of a bare refusal.
- **Privacy is readable by everyone.**

## Options, where there is a real choice

### A. Where people and teams live

1. **Recommended: their own place, "People", in the main navigation** (`/people`, `/teams`, a page per person and per team). Workspace keeps what only admins change. It matches the jobs (everyone, weekly, against a few, rarely), gives R6a's tree a home, and puts the weekly job two taps away on a phone. Cost: the largest change; old addresses redirect; one more sidebar item (paid for by merging Feedback and Send feedback, F16).
2. Keep everything under Workspace and fix the landing page, the header and the rows. Smaller, and still a real improvement; but the directory stays inside an admin area, and the rebuild copies that.
3. One long page again. Rejected: Lane asked for sections on 8 Nov because one page was "too busy".

### B. What `/workspace` opens on

1. **Recommended: "About"**: for admins, what needs sorting out, then the facts (name, people, year, admins, features, recording) each linking to its section. No list of sections; the menu is the list. On a phone the other sections follow the facts under "More in Workspace".
2. Keep Overview and drop only "Every section". Less change, but the page is then a name and one list, and the phone still has the list-inside-a-list.

### C. Admins

1. **Recommended: add and remove admins on Access**, where they are listed, and also from a person's page. The tick box in the edit sheet goes.
2. Leave it in the person sheet and make Access's rows links to it.

### D. Leave

1. **Recommended: Settings** ("Leave Platform Engineering"), since it is about you.
2. Leave it on Workspace, at the foot of About.

### E. The word "cycle"

1. **Recommended: keep "Cycles"**, and fix what the page says. The word is in the vocabulary, the spec, the spreadsheets and the MCP tools; "A cycle is a goal year" as the page's first line is enough.
2. Rename the section "Goal years". Clearer to a newcomer, but two words for one thing unless everything follows.

### F. Reset the example

1. **Recommended: only "Start over" in Demo controls.** The overview's admin-only "Reset the example" goes.
2. Keep both, as decided on 9 Nov.

The recommended answers are what the design draws. Each is listed for Lane in the design's "Decisions for Lane".
