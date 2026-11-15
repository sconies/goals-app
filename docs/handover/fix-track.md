## Fix track (deep dive, 15 Nov), Sunday 15 November (session_012kbr92x3D7z2ksQCAtS8wT): done

Fixed Lane's outside deep-dive findings of 15 Nov, listed in `docs/backlog.md` under "Deep dive, 15 Nov". Each fix has a test that fails without it, or an eval check where it's visual, and the spec and handoff lines planning asked for (each PR body names them).

**Merged:**
- #554, the highs:
  - 1: the chart draws the plan table's weekly steps, both from `planSteps` (`src/domain/plan.ts`).
  - 2: Start over is an admin's everywhere (`mayStartOver`). R1's server table says honestly that `okr_delete_workspace` can't check who asks, because Faro has no sign-in.
- #555, set-up:
  - 3: setup leaves Team empty, so the importer's rule gives each goal its owner's team. It did not reproduce in this build; see the PR.
  - 4: the Today figure becomes the baseline "As at set-up, {date}".
  - 6: Between, with two limits.
- #556, the small ones:
  - 5: the map's screen-reader text (`MAP_ARIA`).
  - 7: a two-sided range target wraps in the Goals table (`TargetWords`).
  - 9: the goal page's status lost its hidden five-tap Easter egg. New design rule: a status is not a control.
- #557, feedback:
  - 8: senders see their own feedback (`withOwnSent`).
  - Recording, Lane's option A: a visit's last 20 steps stay in memory; Privacy and Settings say so; the markup form lists them, unticked. R7 rule 8 and `docs/handoff.md` carry it as a platform promise.

**Not built (placed as ideas in the backlog section):** setup's 4-goal cap; no titles or leads in setup; no per-goal team choice in setup.

**Gotchas:**
- A test file in `src/screens` breaks `spec.test.ts` (every file there must be a screen); put screen tests in `src/ui` or `src/app`.
- `api/mcp.js` bundles `mayStartOver`, the help text and the markup model: rebuild it after touching any of them, and again after merging main.
- Two PRs that each add a What's new entry at the top conflict; keep both, newest first.
