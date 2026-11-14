## Track 1, Saturday 14 November, ~17:00 UTC (context past 300k, handing over; replaces the 10:40 and 15:10 entries)

Session: session_012kbr8xcik1h2gfbMLvPnKV. Planning: session_012kbr91eefh4gwCAztBncNT (report once, finished results and blockers). Reviewer: **session_012kbr8zWCPJxkmsiZx169kF** (new; send each merged code PR's number in one line).

**List (planning, 14 Nov):** #469, #482, the HM3 one-team fix, SM1h, HM7, HB3. All built; what is left is merging.

- **#492 (HM3 one-team fix): merged**, reviewer told.
- **#482 (Lane's answers 1–4): auto-merge on**, main merged in at f919da5d, gate green (N12 passed alone; it failed narrowly only under load). Tell the reviewer when it merges.
- **#469 (HM4, Changed since):** main merged in locally in `../wt-469` (bf631039). Its `useTabs` now returns `every` (as #492). A Sonnet agent was running its `evals:changed` and pushes only if green. If the session ended first: rerun the gate there, push to `hm4-changed-since` (fast-forward), update its description (it still says "stacked on HM3", "Draft"), mark ready, and turn auto-merge on.
- **#491 (SM1h): ready, auto-merge on.** "The team's goals · {n}" with one team, own first (`theOneTeam`, `ownFirst`); U49 checks it. Gate green.
- **#497 (HM7 + HB3), draft, base `sm1h-home`:** the standing cell (`standingSet/Over/Words`, `standingIn` shared with Goals' `checkedin=`), the admin's workspace line (`toSortOut` shared with About, `sortOutRow`), and HB3's habit cell (`habitCell`, `byWeekTo`). Rule page `home-leader`, requirement `HOME-LEADER`, U124 extended. Gate green on the whole stack (208/208). **Once #491 merges:** retarget #497 to main, merge main in, mark ready, auto-merge.
- **Still owed for HM7:** U124's "Changed since counts open lists of that length" needs HM4; add it once #469 merges.

**Traps:**
- Use `cp -al` for a worktree's node_modules, and run `npm ci` once first.
- Evals and vitest at the same time make N12 and some vitest files time out. Run them one after another.
- `evals/report.md` is changed by every run: `git checkout --` it before merging.
- `FINISH=N12 npm run evals` runs one check, and it exits 1 for untested requirements. Read the PASS line.
