# Build reviewer handover

The log is `docs/reviews/2026-11-11-build-reviews.md` on the `build-reviews` branch (draft PR #134). Read its "Where the next reviewer starts" note, which is this one, and only the sections you need.

Written 14 November 2026, 15:40 UTC, when the reviewer of 14 November (session …Bn8GD91Ct4dL) stopped after 19 code PRs. The same note is in `docs/handover/reviewer.md` on this branch.

- **Last merge fully reviewed:** `cadff60d` (#488), the head of main at 15:35 UTC, 14 Nov. Every code PR merged from #121 up to it has a row in State and a section below. This session's are #457 to #488, at the end.
- **Merged since, not reviewed:** none.
- **Highs open:** none. #416 is fixed by #432 and #479, #452 by #467; both re-run.
- **Mediums open:** one. **#468** (track 1, session …8xPMKxizxiksy71mcL has it): a workspace with one team has no "Your team" on Home, because Home reads the drawn tabs (`src/ui/HomeSets.tsx:31`). To verify the fix: three goals in one team, one the viewer's, must give a team set; or the design's one section (backlog SM1h).
- **Expected next:** #476 (track 4: a test of `restore_removed` through the MCP server with Reviews off; #424's medium 1 is already closed, this only adds the test); #464 (GR, track 7d: guardrails on a goal. Check `guards` is in `BUILT_KEYS` in `src/domain/changeset.ts`, and that the row mapper writes SQL null or `[]`, never a JSON null, which migration 0051's check refuses); TG1 (track 2: the generic module save must cope with `goal_fields` and `goal_field_values`, which have no `removed_at`).
- **How merges reach you:** no timer works here (scheduling a wake needs an approval nobody answers). Each track messages the reviewer its PR's number when it merges; whenever a message arrives, run `git log --first-parent <last reviewed>..origin/main` and review everything in it, as a track's message can lag or be missed.
- **Who gets what (Lane, 14 Nov):** highs at once to the owning track, with a copy to planning; mediums to planning once per batch; lows are logged here only and sent to nobody (they move to the backlog, #483). Planning is session_012kbr91eefh4gwCAztBncNT.
- **Lane's answers, 14 Nov (relayed by planning, 12:33 UTC).** Read fixes against these, and don't raise them again:
  - #334, an admin's pasted row over this week's check-in: treat it as a correction, with a reason and the owner kept as author (track 1).
  - "Opened" and "Not yet" on a proposed goal: store them on the server now (track 2).
  - A check-in added late to an ended year: keep as built.
  - "Before this review": visible to the whole workspace; the design note's "anyone in a review" is what is wrong.
  - Help hides a switched-off module's articles, Reviews included (track 4).
  - Admins-only triage on a browser flag: accepted for Faro.
  - The first-download limit stays at 275 KB (so #471's low 2 is answered).
  - PR CI caps very large selections of journeys (track 4).
  - Earlier: an untouched filled-in reading needs a touch before it posts (13 Nov, built in #460); readings stay visible with the Metric library off (14 Nov, in #470's spec).
- **Method, in short:** per merge, `git diff <merge>^1 <merge> -- . ':!spec' ':!api/mcp.js' ':!llms.txt' ':!evals/report.md'`, piped through `grep '^[+-]' | cut -c1-500` to keep it small; fix PRs read against the findings they answer; a probe as a throwaway vitest file under `src/zz/` (write to stderr, delete it after) for a rule, and a Sonnet subagent with Playwright for a screen; PGlite only, never the live database. Before saying a door is open, look for the refusal in the action the tool calls, not only in the tool's file (my mistake on #424). Don't read another session's events to check a message arrived: the answer is huge.
