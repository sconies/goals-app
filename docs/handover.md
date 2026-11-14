# Handover: index

Faro is an internal goals (OKR) app. Read your role's file below, then `CLAUDE.md`, `docs/architecture.md` and `docs/backlog.md`.

| Role | Reads |
|---|---|
| Planning | `docs/handover/planning.md` |
| Track 1, 2, 3, 4 | `docs/handover/track-1.md` to `track-4.md` |
| Track 7 (metrics) | `docs/handover/track-7.md` |
| Build reviewer | `docs/handover/reviewer.md` |
| Main-fix session | `docs/handover/main-fixer.md` |

**Rule:** write your handover into your own file, replacing your previous entry (keep the still-valid habits, about 20 lines at most, under 8 KB), not appending above it.

The old full log, `docs/handover/archive-2026-11.md`, is not read.

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
