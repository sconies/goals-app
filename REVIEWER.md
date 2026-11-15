# Kit-only module reviewer (drill item 11)
Do NOT read Faro's app source (/home/user/goals-app src/, server/ etc.); judge only from the kit and the rebuild. S = /tmp/claude-0/-home-user-goals-app/8ddaa217-c92b-5e8f-a1b8-4bccda268de4/scratchpad.
- Rebuild under review: S/<folder> (rebuild/ is the app; GAPS.md, JOURNEYS.md, CORE-CHANGES.md are the builder's notes). Don't modify it; copy to S/rev-<folder>/ to run anything that writes files.
- Kit: S/kit (752d6c97). Harness: `cd S/pin && npm run drill -- <abs rebuild path>` (README flags; `--files` if needed). Never `npm run spec` in S/pin; `git -C S/pin checkout -- spec` if it changes. Ports 49xxx.
Do:
1. Score with the harness, including the module's own CSV if the kit has one.
2. Run the module's exit.test.mjs and journey tests; check they fail when a check fails (break one thing in your copy, confirm non-zero exit), no filtering, no stale results, and that a failed app start is a failure.
3. Rate each of the stage's exit criteria (spec/rebuild/ page for that stage) VERIFIED / WEAK / NOT MET, one line of evidence each.
4. Check core journeys still pass with the module on and with it left out (FARO_WITHOUT or the rebuild's equivalent).
5. For each gap in GAPS.md and each CORE-CHANGES.md item: real kit gap, or builder's mistake (cite kit file/line).
Write S/<folder>-REVIEW.md. Report under 300 words: scores, test honesty, criteria ratings compact, builder-mistake gaps, top kit gaps.
