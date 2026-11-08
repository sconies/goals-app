# Handover: start here

Faro is an internal goals (OKR) app for a 15,000-person company, built to be easy for another AI to understand and rebuild. This page is the starting point for a new session. Read it, then `CLAUDE.md`, `docs/architecture.md` and `docs/backlog.md`.

## Where things are

| What | Where |
|---|---|
| Live app | https://goals-app-puce-five.vercel.app (demo at `/demo`) |
| Preview of the `journeys` branch | https://goals-app-git-journeys-lanehirschfield-5825s-projects.vercel.app |
| Design plan (Claude Docs) | https://claude.ai/artifact/6XPyzprnhTVsBSziB4GVwP |
| Repo | github.com/sconies/goals-app, working branch `journeys` |
| Database | Supabase project `wlbetxkmrvwqfxvxntzl` (shared with another app's tables; leave those alone). Migrations 0001–0027 applied. CI applies new ones on merge |
| Sign-in links | No longer used by Faro: the inbox is open with no sign-in since backlog O (8 Nov). Supabase, Authentication, URL Configuration. Site URL belongs to the Kerry Lane app (leave it). Redirect URLs list Faro's: `https://goals-app-puce-five.vercel.app/**` and `https://goals-app-*-lanehirschfield-5825s-projects.vercel.app/**` (added 7 Nov) |
| Rules for working here | `CLAUDE.md` |
| What to build next, in order | `docs/backlog.md` |
| What Faro is, generated from the code | `llms.txt` and `spec/` (`npm run spec`; items 8a and 8b) |
| The rebuild kit and its drill | `spec/rebuild/README.md`; the harness is `npm run drill -- <folder>` (item 8k) |

## State on Sunday 8 November, night

- **What Faro is for:** a model the company's internal team will copy and adapt (copy the code, plug in their own platform), plus demos and an off-site. Never real data. **Lane presents it on Tuesday 10 Nov** to a mixed audience (leaders and engineers), including **building a feature live with AI**.
- **Shipped 7–8 Nov (all on main, CI green):** inbox with Claude (#40), faster tests (#41), feature modules (#42), spec + conformance (#43), rebuild kit and drill harness (#44), spec-only requirements R1–R4 (#45), demo polish (#47), open inbox (#48), set-up polish (#49), Workspace sections + real inbox (#50), numbers and names (#51), metric library back end (#52), Tuesday blockers (#53).
- **Drill 1:** a fresh lighter-model session rebuilt the core rules from the kit alone: 100% of 302,370 values. Gaps in `docs/reviews/2026-11-08-drill-1.md` (8g, after Tuesday).
- **Open now:** PR #54 (backlog I: home-screen icon C, lighthouse splash, new welcome page). **On hold at Lane's request** while its build session (`session_012kbr8ydqVVjmsagyQUHh2d`) makes two more changes he asked for there: hold the finished splash logo longer; welcome page wording options line by line, with no promises about update time or frequency. It tells the planning session when CI is green; Lane has approved merging after that.
- **Monday 9 Nov, before the talk:**
  1. Merge #54 when its build says it's ready.
  2. **Rehearse the live build:** a fresh session runs the brief in `docs/live-build/metrics.md` (screens for the metric library: Metrics page under Data, "Measured by" in the empty `goal.measure` place, the metric on the goal page). Time it; keep the result on an unmerged branch `demo/metrics-live-fallback` with its preview link. Fix the brief if it stumbles. The back end's guide is `src/modules/metrics/README.md`.
  3. **Finalise** `docs/demo-script.md` and `docs/live-build/metrics.md` with what shipped (Workspace sections are in; metric library back end is in; drill 1 result; mention the splash and icon), and send Lane a short dry-run checklist.
- **After Tuesday, in order:** 8g (close drill gaps, drill 2 saving its code in `docs/drills/`), 0c (Faro's own Supabase project: the shared one also holds another app's real family data; Lane creates the project), 8c (swappable parts + number source), 0a (find-and-pick), L (weekly loop + rhythm strip), small batch (0u, 7, 10a, R5 + admin/member polish), 3a, 0t, 11. Tuesday's feedback may change it.
- **Things to know:**
  - The repo is **public** (8 Nov) so CI is free; nothing secret is in it.
  - The live app's health check: `https://goals-app-puce-five.vercel.app/api/mcp?check` (database and pictures should be true; the service role key is on Vercel).
  - Builds run in the cloud environment **goals-app** (it can reach the app and Supabase). The database has **no workspaces** (the "tester" one was deleted on 8 Nov), so no AI token works until Lane makes one in a new workspace.
  - Reviews of the app by an outside reviewer are in `docs/reviews/` with triage; their open points are in the backlog.

## How the planning session should run (lesson of 8 Nov)

- **Keep this session's context small.** Don't subscribe to PR activity or relay CI and bot notices: each build session watches its own PR and reports once, when it's ready or blocked. Read build reports, decide, merge.
- **Merging:** Lane approves each merge (or pre-approves, e.g. "merge when green"). When he pre-approves, merge from here once the build reports green; build sessions won't merge on a relayed approval.
- **Start a fresh planning session** when this one gets long: update this handover first.

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
