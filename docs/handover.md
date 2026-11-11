# Handover: start here

Faro is an internal goals (OKR) app for a 15,000-person company, built to be easy for another AI to understand and rebuild. This page is the starting point for a new session. Read it, then `CLAUDE.md`, `docs/architecture.md` and `docs/backlog.md`.

## Where things are

| What | Where |
|---|---|
| Live app | https://goals-app-puce-five.vercel.app (demo at `/demo`) |
| Preview of the `journeys` branch | https://goals-app-git-journeys-lanehirschfield-5825s-projects.vercel.app |
| Design plan (Claude Docs) | https://claude.ai/artifact/6XPyzprnhTVsBSziB4GVwP |
| Repo | github.com/sconies/goals-app, working branch `journeys` |
| Database | Supabase project `wlbetxkmrvwqfxvxntzl` (shared with another app's tables; leave those alone). Every migration in `supabase/migrations` is applied: CI applies new ones on merge |
| Sign-in links | No longer used by Faro: the inbox is open with no sign-in since backlog O (8 Nov). Supabase, Authentication, URL Configuration. Site URL belongs to the Kerry Lane app (leave it). Redirect URLs list Faro's: `https://goals-app-puce-five.vercel.app/**` and `https://goals-app-*-lanehirschfield-5825s-projects.vercel.app/**` (added 7 Nov) |
| Rules for working here | `CLAUDE.md` |
| What to build next, in order | `docs/backlog.md` |
| What Faro is, generated from the code | `llms.txt` and `spec/` (`npm run spec`; items 8a and 8b) |
| The rebuild kit and its drill | `spec/rebuild/README.md`; the harness is `npm run drill -- <folder>` (item 8k) |
| Handing Faro to the internal team: the checklist | `docs/handoff.md` (hand-written; keep it in step with 8g, 0c, 8c, 11) |

## Planning state, Wednesday 11 November, 14:10 UTC

- **There was no talk; the freeze is lifted.** Lane (11 Nov): "Do all the recommended work." Tracks merge their own green PRs (CLAUDE.md's gate); migrations carry their SQL in the PR. Nothing waits for Thursday any more.
- **Decided today:** redesign rounds 2 and 3, all 34 decisions plus 18–23 (#118, #119; backlog RD2, with GE10 "Proposed" in the first cut). Architecture readiness review (#120, `docs/reviews/2026-11-11-architecture-readiness.md`): scale 2/5, handoff 3/5, items AX1–AX10.
- **Five build tracks are running (Opus), each reporting once to the planning session, with a handover when half full:**
  - track 1: find and navigation are done (#110–#117, #116, #148); a fresh session builds CK1, CK2, HM1, HM2, RV7 and N12's timing of Find: session_012kbr922sdhQdcALvU6MR5D.
  - track 2, OB1, GT3's edit page, goal sections into About, the reviewId fix, GE1, GE2, GE9, GE3, GE10 (after IM1), ST1: session_012kbr91unF5Yyjk5zfSVQhg (OB2 #103 merged).
  - track 3, AS part 2 (early, for AX5), ML1–ML3 (the metric screens: today there is no Metrics page or menu item), AS part 3, IM0–IM3 (IM1 early, for GE10): session_012kbr8zHkYVKNmqmUDFhXnz (#121 merged).
  - track 4, AX8 (#131 merged), AX9, then FT2, FT1, SW1, SW2, AX2, AX6, AX5 as their dependencies land: session_012kbr8zVSFsTiiHmPysyfxb. #141 fixed Lane's bug (Undo after switching a feature off said "back on" but stayed off) and main's red Data checks since #128.
  - track 5, CY1, CY2, CY4 (before 3 Jan 2027), CF1: session_012kbr8xyk325FDxMK7DoLsU.
- **Reviewer:** a Fable 5.2 session reviews every merge from #121 on, sends high findings straight to the owning track, and summarises to the planning session at the end: session_012kbr8y4Bh3MudNC1bdo3RN (log on branch `build-reviews`).
- **CI (#143):** when apt can't reach Ubuntu's mirror (an outage on 11 Nov, 14:13–17:15 UTC), Playwright installs Chromium alone with a warning; the telemetry privacy eval matches the typed number only on its own.
- **Fence check (#125):** Supabase's own tables in extensions, cron and net, open to every role by default, are a warning; a direct grant to `faro_owner` still fails. 0038 is live.
- **Open with Lane:** the demo-script corrections offered after the motion video (step 6 reads 40 after a review decision; where "Being handled" shows) were never answered; with no talk they may not matter. Parked: should only a review's members mark its goals reviewed; Home's count links on phones. 0c2 (drop the public redirects) about 18 Nov.
- **For the next planning session:** read reports with `ReadNotifications`; start a fresh session for any track that hands over (its handover is in its last PR); keep U9, U23, U73 (scoring 8.6–8.9 locally) and U20's load timeout in view.

## Track 4 (architecture and feature switches), Wednesday 11 November, 19:40 UTC (session full, handing over)

- **Merged today:** AX1 (#122), AX3 (#123), AX10 (#124), AX7 (#126), AX4 (#128); then this session's AX8 (#131: `spec/core/schema.sql` and `spec/rebuild/access-today.md` generated from a migrated PGlite by `src/spec/schema.ts`; a contract for the MCP endpoint's `Deps`, `src/ports/contracts/deps.ts`, run in memory with `storeDeps`, on plain Postgres with `postgresDeps` and on the Supabase adapter); the feature-Undo fix (#141: a toast's Undo ran against the workspace as it was before the switch, so switching back on did nothing; actions now get the workspace as it is now; U48 covers it; the eval helpers' goto and reload wait for a screen that loads when opened, which fixed F7, N5 and P10 on main; `research.test` resets modules, as test files share workers); AX9 (#154: layers lint rule 7, browser storage only in `src/adapters` and `src/ports`, with the shrinking list `scripts/browser-storage.json` shown as a table in `spec/rebuild/adapters.md`; record stamps from the `Clock`; `goalSeen` behind `Prefs`), with both build reviews folded in (the bundle budget sums the entry and its preloads, 427 KB on main, limit 430; column grants on the access page; `touch` keyed by token id; the signed-out page's words; plain Postgres refuses a token saved with other rows; doc corrections).
- **Next for a fresh track-4 session, in order:** FT2 (now free: GL2 #112 and FS4 #117 are merged), then FT1 (free: NV3 #114 merged), SW1 and SW2 after FT2. AX2 waits for track 2's GE1; AX6 after AX2; AX5 after track 3's AS part 2. The build plans: `docs/design/feature-toggles/spec.md` section 11 and `docs/design/feature-switches/`; Lane's answers in `docs/design/round-2/README.md` and `round-3/README.md`.
- **Left from the build reviews:** keep the workspace switcher on the "can't open … yet" page (`WhoAreYou` without a picker, `src/screens/Start.tsx`), so someone can reach another workspace from it; small UI change, not done.
- **Watch items:** U20 and N6 fail under local load only (a 30 s `waitForURL`; rows still sliding 400 ms after a sort) and pass alone and on CI. U87 had no entry in `evals/shards.cjs` (issue #150); check it was fixed.
- **Habits that helped:** a worktree per item, but `npm run build:mcp` in the main checkout: in a worktree with linked `node_modules` the bundle's path comments change (fix with `sed 's#^// \.\./goals-app/node_modules/#// node_modules/#' api/mcp.js`). Main moves fast: merge main into a PR before expecting CI (a conflicted PR gets no run), and take What's new from main and add the PR's entry back rather than resolving it by hand. Don't run heavy tests beside `evals:changed`. The full local gate takes about 13 minutes.

## State on Tuesday 10 November, evening

- **The talk is Wednesday 11 Nov.** Present from `/demo?today=2026-11-11`; `docs/demo-script.md` was checked against the live demo at 18:15 UTC (Rhea 5 check-ins to do; Amara 126 goals, 20 to discuss; Goals tabs My team 1 · Watching 56 · All 126; Needs attention 41; About's wrap-up 21 Dec 2026). Dry run from `docs/live-build/checklist.md`; run the metric live build once, as main changed a lot today.
- **0c is done:** Faro lives in the `faro` schema (0035–0037), owned by `faro_owner`, which can't read or write the family tables; CI's `DATABASE_URL` is `faro_owner` (tested by the Nightly workflow, 17:38 UTC). Exposed schemas include `faro`; `SUPABASE_SERVICE_ROLE_KEY` is gone from Vercel. Next: 0c2 (drop the public redirects) about a week on. Read `supabase/README.md` before any migration.
- **The redesign (backlog RD, `docs/design/`) is being built in three tracks, each merging its own green PRs:** merged so far AR1/AR4, FS1, FS2 (part), AR2, GL1+NV1, AR3, GT1, GT2, GT3, WR1–WR4, OB3, plus fixes (#87–#107). **Held until Thursday 12 Nov** (after the live build): track 1 FS3, GL2, FS4 and FS2's GoalWizard/GoalEdit/Data pickers and list bars; track 2 OB2 (#103, green), OB1, GT3's edit page, goal sections into About; track 3 AS part 2, ML1–ML3, AS part 3, and #104's day-one rule taking only what it reads plus the AR4 lint gap. Track sessions: 1 session_012kbr8zbTuEu8jJZWUD4ENu, 2 session_012kbr8xYENVqYZuZ5Znt5Sq, 3 session_012kbr8z72rbVyFgvmF6P4e3.
- **Track 1, Wednesday 11 November, late evening (session past half, handing over):** merged CK1 (#156: the form posts through the engine, `postCheckIn` in `changeset.ts` with `new`/`again`/`correct`; `previousFor`, so a second check-in is compared with last week; K6's kept week). CK2 (#160: rules 2 and 3, `checkInLevels`/`unanswered`/`stepState`, the Check and Must fix blocks in `src/ui/Levels.tsx`, answers in History as `Asked`, journey U111) is open with the gate passed; merge it once CI is green. **Next for a fresh track-1 session:** HM1, HM2, RV7, then N12's "Find from anywhere" timing, in that order (`docs/design/home/spec.md` rules 1–3 and 11; `docs/design/reviews/spec.md` for RV7, decision 9 (a)). Notes: IM2 (#145, track 3) rewrites `changeset.ts` and adds an engine-side levels module; whichever of it and CK2 lands second reuses `src/ui/Levels.tsx` and rebases. Evals that type a number which raises a Check answer it with `answerChecks(p)` in `evals/journeys.cjs`. U20 and P9 time out under parallel load and pass alone; don't run two eval runs or vitest beside an eval run. `npm run evals` with `CHECKS=` (not `FINISH=`) runs a platform check alone.
- **Track 1, Wednesday 11 November, evening (session full, handing over):** merged FS3 (#110), GL2 (#112), NV2 (#113), NV3 (#114), FS1's held pickers (#111), FS2's list bar on Data and Feedback (#115), FS4 / N12 at company size (#117); find_goals' scope (#116) is green and merging. `scripts/pickers-left.json` lists nothing outside Goals' filters, which GL2 moved. Loose ends closed: #91's lows (closed pickers and Find's "lately" ask the Search port by id, so `rowFor` is gone; the team lead first; the phone's full-height picker); Goals' browser title is "Goals" on every tab (NV2, navigation rule 2 says the scope is not in it). Fixed on the way: NV2's back link imported the Workspace screen and undid AX4's lazy load (first download back to 248 KB). **Left:** N12 doesn't yet time Find from anywhere (FS3 has landed, so it can join). **Next for a fresh track-1 session:** round 3's CK1, CK2, HM1, HM2, RV7, in the plan's order (`docs/design/round-3/README.md`, part 3; Lane chose (a) on every decision). Notes: evals read Goals' `.goals-line` and `.filter-line`; `navTo` in evals/journeys.cjs matches a label from the start, after a tab's count; the Data checks (F7, N5, P10, U20) fail on main since AX4 until #141 lands.
- **Outside review:** a Fable 5.2 session reviewed every merge (#86, `docs/reviews/2026-11-10-rd-pr-reviews.md` on branch rd-reviews): 1 high, 17 medium, all fixed but #104's. Its three patterns for builds: weeks counted from 1 where the app counts from 0; a rule written again beside the one it should call; a lint that matches a spelling, not the thing. Start a reviewer again on Thursday for the held items.
- **Parked for Lane after the talk:** should only people in a review be able to mark its goals reviewed (today anyone may); Home's count links are about 22 px tall on phones.
- **Build sessions block on Send Message permission prompts** when nobody is watching; read reports from `list_events`. Merge main into a branch in the main checkout, never a worktree with linked `node_modules` (it puts absolute paths in `api/mcp.js`).

## State on Tuesday 10 November, early morning

- **Everything approved for Wednesday has merged** (see the backlog's Done table, #68–#79): Lane's "Being handled needs an action" rule, Decide in the review, the Map at scale, set-up and check-in honesty, talk-path polish, the small batch (migration 0034), engineer docs (ports at company scale, R6). **Code freeze: Tuesday 14:00 UTC.**
- **The demo is pinned:** present from `/demo?today=2026-11-11`; `docs/demo-script.md` has the numbers read from it on 10 Nov (Rhea 5 check-ins to do, Amara 126 goals and 20 to discuss, Needs attention 41).
- **The "Pet store" workspace was deleted** (Lane, 9 Nov), so the live root shows the welcome page again. Any workspace made on the live site brings the name picker back.
- **Build sessions still block on Send Message prompts** when nobody is watching: all five did on the night of 9 Nov. Read their reports from `list_events` and check their PRs' CI directly; merge main into later branches in the main checkout (a worktree with linked `node_modules` puts absolute paths in `api/mcp.js`).
- **Open after Wednesday:** the backlog's "After Wednesday" line. 0c is decided (10 Nov): Faro stays in family-hq, fenced off by its own schema and a Faro-only role; no new project, no paid plan. Lane changes CI's `DATABASE_URL` once the role exists.

## State on Monday 9 November, night

- **What Faro is for:** a model the company's internal team will copy and adapt, plus demos and an off-site. Never real data. **Lane presents it on Wednesday 11 Nov** (moved from Tuesday) to leaders and engineers, including **building the metric library's screens live** (`docs/live-build/metrics.md`, script `docs/demo-script.md`, dry-run `docs/live-build/checklist.md`).
- **Merged 9 Nov (main, CI green):** live-build kit and rehearsal lessons (#56, #60), 8c swappable parts (#58: `src/ports`, `src/adapters`, a plain-Postgres store, `spec/rebuild/adapters.md`), G phone Goals page (#61), Goals search/URL/history hotfix (#62), goal-page hotfix (#63: plan sanity check, Done goals show their result, "Updated" date), review triage GP/GD/NAV/MAP (#65), R review leftovers (#64: F16 reload after deploy, F03, F07, F08–F10, F13, F14).
- **Live-build rehearsals:** run 1 (answer 3 "with a reason") 21 min to preview, 41 to green CI (#55); **run 2, the fallback** (#57, brief as on stage) 13 min to preview, 16 to green. Neither is merged; never merge them. Previews are behind Vercel sign-in.
- **Building on the night of 9 Nov (each reports once to the planning session; Lane pre-approved "merge any time" when green and reviewed):**
  - **8g** (#59): drill gaps closed; **drill 2 scored 100% (360,109 values) from the kit alone**, no answers read from the scorer. Being brought up to date with main.
  - **GP** (branch `goals-decisions`): Needs attention shows handled goals in a "Being handled" group (Lane), Cards layout cut (Lane), health line, worst-first across trees, Board tweaks, History values; plus Lane's evening asks: "Being handled" explains itself everywhere, and New goal is no longer the Goals page's big button (the sidebar entry stays).
  - **faro-mark** (branch `faro-mark`): the workspace initial top-left becomes Faro's F mark (Lane).
  - **WS** (branch `workspace-rework`, Lane: before Wednesday): Workspace truthfulness bugs, the Inbox moved out of Workspace as a global "Feedback" place (open, never emails), reset admin-only plus Leave, recording asked at set-up, a persistent workspace switcher, "Admin" on badges and a permissions line, a real Overview and Cycles, Home's set-up prompt moved. Review: an outside deep dive of Workspace on 9 Nov (in Lane's chat, summarised in WS's brief).
- **When GP and WS land:** update `docs/demo-script.md` with the changes they list (Needs attention numbers, Inbox location, review walkthrough's "Outstanding" line from R, the first-check-in note), then Lane's dry run on Tuesday evening.
- **After Wednesday, in order:** 0c (own database: free Supabase tier allows 2 active projects and Lane has 2; options are Supabase Pro or plain Postgres via 8c's adapter), 0a, L, GD, NAV, MAP, small batch (0u, 10a, R5), 3a, 0t, 11. Wednesday's feedback may change it.
- **Things to know:**
  - The repo is **public** so CI is free; nothing secret is in it.
  - Health check: `https://goals-app-puce-five.vercel.app/api/mcp?check`.
  - Builds run in the cloud environment **goals-app**. The database has no workspaces, so no AI token works until Lane makes one.
  - **Build sessions block on permission prompts** (Send Message, Send Later) when nobody is watching; several sat for hours on 9 Nov. Their reports can be read from their transcripts (`list_events`, assistant kind). Pre-approving those tools in `.claude/settings.json` is Lane's to do. Tell builds not to use scheduling tools.
  - Lane's Telegram bot (Keel, @Lane_claude_bot, token in the `api.telegram.org.` environment) didn't receive messages through a relay session on 9 Nov; parked.
  - Outside reviews and their triage are in `docs/reviews/`; open points are in the backlog.

## How the planning session should run (lesson of 8 Nov)

- **Keep this session's context small.** Don't subscribe to PR activity or relay CI and bot notices: each build session watches its own PR and reports once, when it's ready or blocked. Read build reports, decide, merge.
- **Merging:** Lane approves each merge (or pre-approves, e.g. "merge when green"). When he pre-approves, merge from here once the build reports green; build sessions won't merge on a relayed approval.
- **Recommend a fresh planning session unprompted** as soon as this one starts to fill up (about half full): update this handover, then give Lane a ready-to-paste prompt (CLAUDE.md, "Fresh planning sessions").

## How we work (Lane, 7 November)

- **Two kinds of session.**
  - **The planning session** takes Lane's ideas, runs grills, keeps the backlog in order and decides merges.
  - **A build session** builds one release, starting from a short brief. Only one build runs at a time in any area.
- **Ideas go to the backlog first.** Build only what Lane picks or has approved as next.
- **Backlog edits** ride with the next feature PR.
- **Be quiet while waiting.** Report merges, failures and decisions; nothing else.
- **Use models to match the work.**
  - **Strongest model:** planning, architecture and review.
  - **Lighter model:** mechanical work.
- **Database changes** apply through CI on merge. Show the full SQL in the PR description.
- **Commits and PRs** follow `CLAUDE.md`:
  - **Author:** Lane.
  - **Committer:** Claude.
  - **Trailers:** the session trailers.
  - **Merging:** merge when CI is green, then post the PR and live links.

## Brief for a build session

> Build backlog item <N> of Faro, as described in `docs/backlog.md`, following `CLAUDE.md`, `docs/architecture.md` and `docs/design-rules.md`. Base it on `origin/main`, work on branch `journeys`, run the full quality gate, open a draft PR with any SQL in its description, and merge when CI is green. Report back with the PR, the live link, screenshots of what changed, and any decision you had to make.
