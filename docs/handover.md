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
| Sign-in links | Supabase, Authentication, URL Configuration. Site URL belongs to the Kerry Lane app (leave it). Redirect URLs list Faro's: `https://goals-app-puce-five.vercel.app/**` and `https://goals-app-*-lanehirschfield-5825s-projects.vercel.app/**` (added 7 Nov) |
| Rules for working here | `CLAUDE.md` |
| What to build next, in order | `docs/backlog.md` |
| What Faro is, generated from the code | `llms.txt` and `spec/` (`npm run spec`; items 8a and 8b) |
| The rebuild kit and its drill | `spec/rebuild/README.md`; the harness is `npm run drill -- <folder>` (item 8k) |

## State on 7 November

- **Live:** the Faro rebrand, goal page scorecard, screen markup and builder inbox, remove/archive/undo for everything, one meaning for every status word, and one spreadsheet format.
- **Just shipped (PR #38):** the small-fixes batch (backlog items 4, 5, 6, 8, with migration 0028), the fix for issue #39 (eval check N6) and the latest backlog and `CLAUDE.md` edits. Nothing else is in flight. One known follow-up: N6's Home progress-ring step also reads at a fixed time and fails under a 4x CPU slowdown; it has never failed in CI.
- **What Faro is for (8 Nov):** a model for an internal rebuild plus demos; never real data. Lane presents it to coworkers on Tuesday 10 Nov.
- **Next in the backlog:** 8k rebuild kit v1 with a drill (building), 8r spec-only requirements, 8c swappable parts (the team will copy the code and plug in their own platform), then 0u and 7 (small fixes), 0a find-and-pick and Workspace tabs, 0b metric library, 0c Faro's own Supabase project, 3a send a markup about a goal. Sign-in, single sign-on, time zones and scale are spec only; observability is dropped.

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
