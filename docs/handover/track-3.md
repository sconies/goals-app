## Track 3 (import), Friday 13 November, 03:30 UTC: IM8 and the review lows done (supersedes the 01:10 entry's list)

**Done**
- **#336, IM8** (merged). Set-up's upload goes through the import preview: create mode takes answers (`buildWorkspace`), the group block is shared from `src/ui/IssueGroup.tsx`, and the set-up preview (`src/ui/SetupFilePreview.tsx`) loads lazily. An owner the People sheet lacks offers "Add {name}" (`ownerToAdd`) or "Give it to someone here". `past-stage` is asked in create mode, answered "Count them from this week" by default (`setupDefaults`); `keepFileWeeks` and `stagesFromJoining` are gone. Journey **U147** (U146 was taken), `SETUP-UPLOAD`. The PR also:
  - fixed F8 on main: the hidden View sheet holds a copy of the toast;
  - gave the speed tests timeouts above their own limits;
  - removed Export's dead standalone button.
- **#347, the review lows** (auto-merge on; check it merged): IM3's two engine findings and the shared count helper, every IM4 and IM5 low, the #257 and #248 lows, and U29 on a phone (the walkthrough now lazy-loads). Two lows were left as they are: the year is already in the file name, and the zipped CSVs stay three clicks away. The full suite passed except U12 (8.8) and U31 (9), which are not import's.

**Next for track 3:** nothing open from the reviews. U99 (the set-up design's whole SETUP-UPLOAD journey: People paste, a team typo at set-up) belongs to the set-up track's ST6.

**Gotchas (new)**
- Don't run `npm test` and `evals:changed` at once: the container restarted.
- The newest What's new entry and a lazy route's dependency list both sit in the first download. A new shared chunk adds its name to the list, and so does a hash change. Near the budget, measure to two decimals: `sed 's/toFixed(0)/toFixed(2)/' scripts/check-bundle.mjs`.

