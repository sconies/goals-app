# Wednesday 11 November: presenting Faro

About 45 minutes: 10 for everyone, 5 for the technical half, about 25 for the live build (`docs/live-build/metrics.md`), 5 for questions. Present the app from **https://goals-app-puce-five.vercel.app/demo?today=2026-11-11** (the date is pinned so the dry run and the talk show the same numbers; without it the demo follows the real clock). Before you start: open Demo controls → **Start over**, view as **Rhea Kapoor**, light theme, a laptop at full width. Run through `docs/live-build/checklist.md` the evening before and again 15 minutes before.

## The one-line pitch

Faro is a working model of a goals app, built to be copied: weekly check-ins on measured goals, plain-language status, and reviews that only talk about what needs attention. It is a prototype, not a product, and it never holds real data. Today the question is: do we rebuild it here?

## Opening (1 minute)

Open the root page, **https://goals-app-puce-five.vercel.app**, in a tab you loaded beforehand (the first load takes a few seconds). Reload once in front of the room: the lighthouse splash (about 2.5 seconds, tap to skip), then the welcome page for leaders. Read its first line, then go to `/demo?today=2026-11-11`. *Point out:* the home-screen icon is the same lighthouse, if anyone adds it to a phone.

## Part 1, for everyone (10 minutes)

1. **Home, as Rhea, a goal owner.** "What needs me this week": 5 check-ins to do (2 of 7 in), "Check-ins are due by Thursday, tomorrow", a question waiting on her, and her 8 goals (2 off track, 2 at risk). The strip also says honestly that Tuesday's Developer Productivity review was not held. *Point out:* every number explains itself; the help link on every page goes to the exact article.
2. **Post a check-in.** Start check-in → enter a number on plan → it's one step. Then enter one behind plan → it asks for a cause and a reason, because "behind" needs a story; "Something changed" can't be posted with last week's words unedited. Use plan numbers for the on-plan ones and skip the flaky-test row (at 1.8% against a 2.0% limit it reads At risk and asks why). *Point out:* status is a shape plus a word, never a colour alone.
3. **A goal page.** Open one of Rhea's goals (the check-in you just posted shows at the top of its history): the scorecard (vs plan, to target, will it hit?), the chart, the forecast in words, how the status was worked out. Pick a lower-is-better goal (build time) to show "over", not "short".
4. **Switch to Amara Nwosu, the VP.** Home recomposes: 126 goals (11 off track, 23 at risk), tomorrow's Platform leadership weekly (20 goals to discuss), a decision waiting on her and an action she agreed. Each count opens its own goals: click "11 off track". *Point out:* nobody built a separate "manager view"; it's the same rules seen by a different person.
5. **Reviews.** Open Platform leadership weekly → the walkthrough: 20 goals to discuss, 36 with nothing flagged to mark together at the end. Reviews only walk through goals that need attention. *The new part:* an off-track or at-risk goal asks "What happens next, who, by when?" before you move on: **Add the next step** (what, a person found by typing, a week), or **We accept the risk** with a reason. Decide one goal, then skip on (each takes three clicks). The goal now shows "Being handled": a goal leaves the leader's count only with an action that has an owner and a date, never because someone clicked "reviewed". **Finish review** shows what was decided and who owns what, with Undo. *Optional:* as Daniel, Developer Productivity fortnightly opens with "Last time": what Tariq agreed, with Done?.
6. **Goals.** Needs attention (41) is one line with Why?; goals being handled are listed below, never hidden. Search "G-48" finds it by key. Board cards carry their own status. Then **Map**: it opens on every tree, folded to the top with the critical path in red; find a goal and it opens its tree and pans to it; each node shows value, target and gap, and a parent shows the worst status under it. New goal is in the sidebar.
7. **Workspace and Feedback.** As Amara (an admin). *Point out:* the workspace switcher at the top of the sidebar (the workspace's name; it lists every workspace and says "Open now" on this one), "Admin" under her name, and the one line under Workspace's title: "Platform Engineering · you're an admin here". Workspace opens on **About**: anything an admin has to sort out would come first (nothing today), then the facts, each leading to its section: 97 people in 14 teams, the year and when its wrap-up opens, the admins, which features are on, and recording. The side menu: About, Cycles, Access, Features, Privacy, Recently removed. People and Teams have their own place: **People**, in the sidebar, for everyone (open Rhea to show her page and "See Rhea’s 8 goals"; the Teams tab shows each team's goals by status). **Features** turns modules on and off: that's the architecture showing through. Then open **Feedback**, beside Help: "From every workspace and the demo". Anyone can mark up a screen with Send feedback, and it lands here with the picture, ready to triage (New, In hand, Closed). Optional: switch to Rhea to show the member view (About with "Ask one of them…", four sections; People reads the same, without Add a person).
8. **Data.** Every table as a spreadsheet, in and out: the same format the import uses. *Point out:* the downloaded workbook already has a Metrics sheet, but Data has no Metrics page. "Hold that thought: we'll build it in a moment."

## Part 2, the technical half (5 minutes)

1. **How it's built, in one breath:** a modular monolith, a small core with features as modules that plug in; the app, the spreadsheet import and the AI tools (MCP) share one set of rules. 54 user journeys, 143 requirements and about 680 unit tests run on every change. `docs/architecture.md`.
2. **The drill, the headline:** `spec/` and `llms.txt` are generated from the code and can't drift. A fresh AI session given only that kit, on the lighter model, rebuilt the core rules and matched **100% of 302,370 values** in about five minutes, but the scorecard's exact words came from the scorer's differences. We closed those gaps, and **drill 2** (9 Nov, a fresh session, kit only) matched **100% of 360,109 values** across five files in three rounds, with the words coming from the kit. One detail (how "-0" is written) still came from the scorer, and is now in the kit too (`docs/reviews/2026-11-09-drill-2.md`).
3. **Specified, not built:** sign-in, single sign-on, time zones, scale (`spec/requirements/internal/`): the internal platform does those.
4. **The metric library, half built on purpose:** the back end shipped on Sunday as a module (13 demo metrics, rules, tests, AI tools); the screens are what we build now. Be honest if an engineer opens the diff: a module with its own records still adds them to the core's types and store; making that an extension point is the next step (`docs/reviews/2026-11-10-deep-review.md`, A3).

## Part 3, the live build (about 25 minutes)

Follow `docs/live-build/metrics.md`: the request, requirements on screen, refine with the room, paste the brief, narrate while it builds, show the preview. The fallback (the same brief, run on Monday) is linked there.

## Close: the ask

- **How you'd rebuild it:** copy the code, plug in our platform. That is already a matter of writing about five adapters (database, storage, identity, clock, a number source so metrics fill themselves in), each with a contract test that tells you when it's right; a plain-Postgres adapter passes the same tests as Supabase (`spec/rebuild/adapters.md`). Said plainly: those ports are demo-scale (load a workspace, save what the browser wrote); at company scale the save rules move to your server, as the requirements R1 and R4 say.
- Look at the kit and the drill; decide whether we copy and adapt, or rewrite from the spec.
- Pick a pilot team.
- Known gaps, said plainly: no sign-in yet (by design: the internal platform does it), Faro shares a database project with another app (moving next).

## If something goes wrong

- A screen looks odd: Demo controls → Start over, then carry on.
- A page goes blank or says it can't load after the live build merges: reload it once (a deploy replaced the code under an open tab; backlog R, F16).
- The numbers look different from the dry run: the date pin fell off the address (moving between pages drops `?today=` from the address bar, so a reload goes back to the real clock). Open `/demo?today=2026-11-11` again from its tab.
- Asked "is it real data?": no, the Platform Engineering workspace is generated; nothing here is real.
- Asked "who built it?": built with Claude, in sessions planned and reviewed by me; every change went through the same tests.
