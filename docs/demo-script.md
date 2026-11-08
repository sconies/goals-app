# Tuesday 10 November: presenting Faro

About 25 minutes: 10 for everyone, 10 for the technical half, 5 for questions. Present from **https://goals-app-puce-five.vercel.app/demo** (never the root page). Before you start: open Demo controls → **Start over**, view as **Rhea Kapoor**, light theme, a laptop at full width.

## The one-line pitch

Faro is a working model of a goals app, built to be copied: weekly check-ins on measured goals, plain-language status, and reviews that only talk about what needs attention. It is a prototype, not a product, and it never holds real data. Today the question is: do we rebuild it here?

## Part 1, for everyone (10 minutes)

1. **Home, as Rhea, a goal owner.** "What needs me this week": one check-in to do, how late it is, her goals. *Point out:* every number explains itself; the help link on every page goes to the exact article.
2. **Post a check-in.** Start check-in → enter a number on plan → it's one step. Then enter one behind plan → it asks for a cause and a reason, because "behind" needs a story. *Point out:* status is a shape plus a word, never a colour alone.
3. **A goal page.** Open one of Rhea's goals: the scorecard (vs plan, to target, will it hit?), the chart, the forecast in words, how the status was worked out. Pick a lower-is-better goal (build time) to show "over", not "short".
4. **Switch to Amara Nwosu, the VP.** Home recomposes: what needs her across 126 goals, the review ring. *Point out:* nobody built a separate "manager view"; it's the same rules seen by a different person.
5. **Reviews.** Open this week's review → the walkthrough: "Goal 3 of 14 to discuss · 1 of 35 reviewed". Reviews only walk through goals that need attention; healthy ones are listed, not discussed.
6. **Goals.** List → Board → Map. Search, a saved view, the "Needs attention" line explaining its count.
7. **Workspace.** *(If W has merged:)* the sections, and the Inbox: anyone can mark up a screen with Send feedback, and it lands here with the picture, ready to triage. *(If not:)* skip to Data.
8. **Data.** Every table as a spreadsheet, in and out: the same format the import uses.

## Part 2, the technical half (10 minutes)

1. **How it's built:** a modular monolith. A small core (people, teams, goals, check-ins, the status rules, the change engine) with features as modules that plug in; CI proves the core works with each module removed. `docs/architecture.md`.
2. **Rules live once:** the app, the spreadsheet import and the AI tools (MCP) all use the same rules and the same change engine.
3. **Tested like a product:** 48 user journeys, 132 requirements and about 480 unit tests, run on every change; the full suite runs after every merge and opens an issue if anything breaks.
4. **The rebuild kit.** `spec/` is generated from the code and can't drift; `llms.txt` points an AI at it. Expected results for every demo goal in every week (about 300,000 values) prove a rebuild is right.
5. **The drill, the headline:** a fresh AI session given only the kit, on the lighter model, rebuilt the core rules from scratch and matched **100% of 302,370 values** in about five minutes. Be honest: the rules came from the kit; the scorecard's exact words came from the scorer's differences, and that gap list (35 points, `docs/reviews/2026-11-08-drill-1.md`) is the first thing we fix.
6. **What Faro deliberately doesn't build, but specifies** (`spec/requirements/internal/`): R1 sign-in and access (a who-may-change-what table kept true by a test), R2 single sign-on, R3 time zones, R4 scale and safety (15,000 people, page-load budgets, backups).
7. **How you'd rebuild it:** copy the code, plug in our platform. Next up in Faro is making that a matter of writing about five adapters (database, storage, identity, clock, a number source for metrics that fill themselves in), each with a contract test that tells you when it's right.

## Close: the ask

- Look at the kit and the drill; decide whether we copy and adapt, or rewrite from the spec.
- Pick a pilot team.
- Known gaps, said plainly: no sign-in yet (by design: the internal platform does it), Faro shares a database project with another app (moving), phone layout of the Goals toolbar needs work.

## If something goes wrong

- A screen looks odd: Demo controls → Start over, then carry on.
- Asked "is it real data?": no, the Platform Engineering workspace is generated; nothing here is real.
- Asked "who built it?": built with Claude, in sessions planned and reviewed by you; every change went through the same tests.
