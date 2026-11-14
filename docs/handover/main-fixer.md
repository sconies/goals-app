## Main's full evals, Friday 13 November, 16:30 UTC (main-fix session: done)

- **Fixed and merged:** U109 (#392, the week picker's keys outran a render on a slow phone), U98 (#389, Stop clicked after a 6,000-row check had already ended), N12 (#385, Data search re-read the query for every row), the rolling issue for full-eval failures (#390). F8 was already fixed (#336). The 67 per-commit failure issues are closed.
- **Phone CPU:** `evals:changed` and `evals:smoke` slow phone-sized pages 4× and run their journey processes one after another (`evals/phoneCpu.cjs`, Lane, 13 Nov), so a race that only a slow phone shows turns up before the merge. The full suite after the merge runs at full speed. `PHONE_CPU=1` turns it off, to tell a slow phone from a broken one; `PHONE_CPU=4` slows a single `ONLY=`/`FINISH=` run.
- PR CI's smoke job (the required check, name unchanged) runs `npm run evals:pr`: the core journeys plus what the PR's files touch, slowed, about 10 minutes. Shared code no longer means the whole suite before the merge (it meant that for 28 of 40 merges on 13 Nov); backlog TN narrows `evals/touches.cjs` so fewer files count as shared. Reproduce PR CI locally with `npm run evals:pr`.
- Chromium slows a page by keeping its core busy: never run slowed browsers side by side (the full suite slowed, 4 shards on 4 cores, took 70 minutes and failed 38 requirements that pass alone).

**Gotchas**
- `api/mcp.js` bundles more than `server/`: `src/domain` and `src/help/whatsNew.ts` too. Run `npm run build:mcp` after changing either, or the smoke gate fails on the bundle (#385 and #392 both did).
- A PR with a merge conflict gets no CI at all (no merge ref), not a failed run: #383 sat for 25 minutes with only Vercel's check. Read `mergeable_state`; on `dirty`, merge main in.

