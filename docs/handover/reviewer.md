# Build reviewer handover

The log is `docs/reviews/2026-11-11-build-reviews.md` on the `build-reviews` branch (draft PR #134). Read its "Where the next reviewer starts" note, which is this one, and only the sections you need.

Written 14 November 2026, 20:45 UTC, when the reviewer of 14 November afternoon (session …iZx169kF) stopped after 14 code PRs, at about 395k tokens of context. The same note is in `docs/handover/reviewer.md` on this branch.

- **Last merge fully reviewed:** `65fd1421` (#465), the head of main at 20:40 UTC, 14 Nov. Every code PR merged from #121 up to it has a row in State and a section below. This session's are #492 to #465, at the end, under "The reviewer of 14 November, afternoon".
- **Merged since, not reviewed:** none.
- **Highs open:** none.
- **Mediums open:** none. #468's was fixed by #492 (and #491 built the design's one section); #475's by #495.
- **Expected next:** #505 (MQ's code, track 7d, on migration 0055: check the row mapper writes SQL null, never an empty string, for a `level` or `confidence` that isn't said, which 0055's checks refuse; and that the parent's rules, no loops, same workspace, not removed, are in the module's rule, since the database only refuses a metric that is its own parent). #497 (HM7 and HB3, track 1). U124's "Changed since" check (track 1).
- **Read, not walked on screen by this session:** #469 (HM4), #491 (SM1h), #487 (TG1), #464 (GR) and #465 (FT1); their own journeys are the only browser runs. #465's thirteen screen files were skimmed. If the full suite on main goes red on one of them, start there.
- **How merges reach you:** no timer works here (scheduling a wake needs an approval nobody answers). Each track messages the reviewer its PR's number when it merges; whenever a message arrives, run `git log --first-parent <last reviewed>..origin/main` and review everything in it. Messages lag and repeat: about half of this session's were for PRs already reviewed, and a track's message can give a stale migration number (#502 was announced as 0054 and is 0055).
- **Who gets what (Lane, 14 Nov):** highs at once to the owning track, with a copy to planning; mediums to planning once per batch; lows are logged here only and sent to nobody (deferred to after the handoff, #483). Planning is session_012kbr91eefh4gwCAztBncNT until a new planning session says it has moved.
- **Lane's answers, 14 Nov (relayed by planning, 12:33 UTC).** Read fixes against these, and don't raise them again:
  - #334, an admin's pasted row over this week's check-in: a correction, with a reason and the owner kept as author (built, #482).
  - "Opened" and "Not yet" on a proposed goal: stored on the server (built, #485 and #488).
  - A check-in added late to an ended year: keep as built (#482 makes every door ask the reason the form asks).
  - "Before this review": visible to the whole workspace.
  - Help hides a switched-off module's articles, Reviews included (built, #498).
  - Admins-only triage on a browser flag: accepted for Faro.
  - The first-download limit stays at 275 KB.
  - PR CI caps very large selections of journeys, and since #501 checks too (planning's call, 14 Nov).
  - Earlier: an untouched filled-in reading needs a touch before it posts (13 Nov); readings stay visible with the Metric library off (14 Nov).
- **Method, in short:** per merge, `git diff <merge>^1 <merge> -- . ':!spec' ':!api/mcp.js' ':!llms.txt' ':!evals/report.md'`, piped through `grep '^[+-]' | cut -c1-500` to keep it small; fix PRs read against the findings they answer; a probe as a throwaway vitest file under `src/zz/` (write to stderr, delete it after) for a rule or a save (PGlite through `freshPostgres`, with `SupabaseStore` over `pgSupabase` and `PostgresStore`, as `src/adapters/stores.test.ts` builds them); a Sonnet subagent with Playwright for a screen (a production build served by `vite preview`, pages opened with `?store=browser&today=…`, which is how #475's medium was found in a minute). PGlite only, never the live database. Keep the log in a second worktree (`git worktree add ../br origin/build-reviews -B build-reviews`) so main stays checked out. Before saying a door is open, look for the refusal in the action the tool calls, not only in the tool's file. Don't read another session's events to check a message arrived: the answer is huge.
