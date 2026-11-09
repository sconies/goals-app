# Wednesday 11 November: presenting Faro

About 45 minutes: 10 for everyone, 5 for the technical half, about 25 for the live build (`docs/live-build/metrics.md`), 5 for questions. Present the app from **https://goals-app-puce-five.vercel.app/demo**. Before you start: open Demo controls → **Start over**, view as **Rhea Kapoor**, light theme, a laptop at full width. Run through `docs/live-build/checklist.md` the evening before and again 15 minutes before.

## The one-line pitch

Faro is a working model of a goals app, built to be copied: weekly check-ins on measured goals, plain-language status, and reviews that only talk about what needs attention. It is a prototype, not a product, and it never holds real data. Today the question is: do we rebuild it here?

## Opening (1 minute)

Open the root page, **https://goals-app-puce-five.vercel.app**, in a tab you loaded beforehand (the first load takes a few seconds). Reload once in front of the room: the lighthouse splash (about 2.5 seconds, tap to skip), then the welcome page for leaders. Read its first line, then go to `/demo`. *Point out:* the home-screen icon is the same lighthouse, if anyone adds it to a phone.

## Part 1, for everyone (10 minutes)

1. **Home, as Rhea, a goal owner.** "What needs me this week": one check-in to do, how late it is, her goals. *Point out:* every number explains itself; the help link on every page goes to the exact article.
2. **Post a check-in.** Start check-in → enter a number on plan → it's one step. Then enter one behind plan → it asks for a cause and a reason, because "behind" needs a story. *Point out:* status is a shape plus a word, never a colour alone.
3. **A goal page.** Open one of Rhea's goals: the scorecard (vs plan, to target, will it hit?), the chart, the forecast in words, how the status was worked out. Pick a lower-is-better goal (build time) to show "over", not "short".
4. **Switch to Amara Nwosu, the VP.** Home recomposes: what needs her across 126 goals, the review ring. *Point out:* nobody built a separate "manager view"; it's the same rules seen by a different person.
5. **Reviews.** Open this week's review → the walkthrough: "Goal 3 of 14 to discuss · 1 of 35 reviewed". Reviews only walk through goals that need attention; healthy ones are listed, not discussed.
6. **Goals.** List → Board → Map. Search, a saved view, the "Needs attention" line explaining its count.
7. **Workspace.** The side menu of sections (People, Teams, Inbox, Cycles, Access, Features, Privacy, Recently removed). Open **Inbox**: anyone can mark up a screen with Send feedback, and it lands here with the picture, ready to triage (New, In hand, Closed). *Point out:* **Features** turns modules on and off; that's the architecture showing through.
8. **Data.** Every table as a spreadsheet, in and out: the same format the import uses. *Point out:* the downloaded workbook already has a Metrics sheet, but Data has no Metrics page. "Hold that thought: we'll build it in a moment."

## Part 2, the technical half (5 minutes)

1. **How it's built, in one breath:** a modular monolith, a small core with features as modules that plug in; the app, the spreadsheet import and the AI tools (MCP) share one set of rules. 51 user journeys, 136 requirements and about 560 unit tests run on every change. `docs/architecture.md`.
2. **The drill, the headline:** `spec/` and `llms.txt` are generated from the code and can't drift. A fresh AI session given only that kit, on the lighter model, rebuilt the core rules and matched **100% of 302,370 values** in about five minutes. Be honest: the scorecard's exact words came from the scorer's differences; that gap list (`docs/reviews/2026-11-08-drill-1.md`) is the first thing we fix.
3. **Specified, not built:** sign-in, single sign-on, time zones, scale (`spec/requirements/internal/`): the internal platform does those.
4. **The metric library, half built on purpose:** the back end shipped yesterday as a module (13 demo metrics, rules, tests, AI tools); the screens are what we build now.

## Part 3, the live build (about 25 minutes)

Follow `docs/live-build/metrics.md`: the request, requirements on screen, refine with the room, paste the brief, narrate while it builds, show the preview. The fallback (the same brief, run on Monday) is linked there.

## Close: the ask

- **How you'd rebuild it:** copy the code, plug in our platform. Next up in Faro is making that a matter of writing about five adapters (database, storage, identity, clock, a number source so metrics fill themselves in), each with a contract test that tells you when it's right.
- Look at the kit and the drill; decide whether we copy and adapt, or rewrite from the spec.
- Pick a pilot team.
- Known gaps, said plainly: no sign-in yet (by design: the internal platform does it), Faro shares a database project with another app (moving next), the phone layout of the Goals toolbar needs work.

## If something goes wrong

- A screen looks odd: Demo controls → Start over, then carry on.
- A page goes blank or says it can't load after the live build merges: reload it once (a deploy replaced the code under an open tab; backlog R, F16).
- Asked "is it real data?": no, the Platform Engineering workspace is generated; nothing here is real.
- Asked "who built it?": built with Claude, in sessions planned and reviewed by me; every change went through the same tests.
