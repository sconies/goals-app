# Build reviewer handover

**22 Nov, about 01:00 UTC: the design-highs track is done.** #603 is cleared at eacfb1f2; planning (session_012kbr8xNpL8ZWL2gSrg1kzT) has the report. Nothing is open but the proposed chart-label item and one low (see the log). When #603 merges, compare the merge with eacfb1f2.

**21 Nov: a fresh reviewer has started** for the design-review fix track. Main is `da24b119` (#600, the design review, docs only). One build track fixes the highs in `docs/reviews/2026-11-design-review.md`: H1 (ring label and count), H2 (projection range and red line), H3 (risk and stale marks under 3:1, plus a P6 check), H4 (the map's red critical-path outline), H5 (Home's two late reviews; name the review in the button), A1 (closing Find loses focus). The build session is session_012kbr8yjEw62z5jD8TFEt5Z ("Faro build: design review highs"); it sends its first PR number when it is up. Highs and mediums go to the build session; lows stay here; one report to planning when the track is done. Planning moved to session_012kbr8xNpL8ZWL2gSrg1kzT ("Faro planning", started by the old planning session) at about 23:16 UTC, 21 Nov: send the report there.

The log is `docs/reviews/2026-11-11-build-reviews.md` on the `build-reviews` branch. Read its sections from "The reviewer of 18 November, afternoon" on.

**18 Nov, about 21:45 UTC: reviewer session_012kbr8zrx4banyBEWNKXLZj stopped.** Its context was 223k, and UX4 had no ready time (CLAUDE.md's prompt-cache habit).
- **#593 (UX2b):** the delta 819b6d55..cb78e4c is cleared. N7 and N8 are not loosened.
- **#596 (UX2c):** cleared at b3f4cce, with no high or medium. Planning was told it can merge on green CI. The build's local evals:changed hadn't finished when it pushed.
  - Open lows: DataFilters' error has no `aria-invalid` on the value field; Markup.tsx:316 is still `aria-disabled` with no picture, and its label is a bare "Send"; FixSummary's links sit inside `role="status"` (the build chose to keep them).
- **No highs or mediums are open.**
- **Next:**
  - UX4, page header, is draft PR #597, from session_012kbr8xTXrVQL92zMzhgMbz. Check it against patterns spec section 2, PAGE-HEADER in the generated spec, its conformance rows and its rebuild stage. Walk it at 360 and 1440.
  - When #596 merges, compare the merge with b3f4cce.
- **Planning:** session_012kbr8yQaHGoDsesfVZhHry is handing over; its successor will say its ID.
- **What found things this time:** grep every `btn primary … disabled={…}` (and `aria-disabled`) across src after a "never disabled" claim, and grep for raw `className="foot-row"` and `sheet-foot` against a "Built" line. The rule's words overclaimed twice.

## Earlier

The log is `docs/reviews/2026-11-11-build-reviews.md` on the `build-reviews` branch (draft PR #134). Read its "Where the next reviewer starts" note, which is this one, and only the sections you need.

**18 Nov, about 10:15 UTC: reviewer session_012kbr939YG6p4SQWQw7sYbd stopped.** Its context was 227k, and UX4 is likely more than an hour away (CLAUDE.md's prompt-cache habit). Its section in the log is "The reviewer of 18 November".
- **Main is reviewed to `b034bf71`.** Two PRs are cleared before merge, with planning told it may merge them:
  - #592 (docs, backlog Open list): no findings;
  - #593 (UX2b, FORM-FOOTER), cleared at head 819b6d55, after two highs and seven mediums were fixed or moved to UX2c (backlog 3a).
- **When those merge, nothing new needs reviewing on main:** compare the merge with 819b6d55 and ed354925.
- **No highs or mediums are open.**
- **Sessions:**
  - the patterns track is now session_012kbr92THq15KYkf3KVSny7 (it took over from …nZCpMz97iHEoe2xU);
  - planning is session_012kbr8yQaHGoDsesfVZhHry.
- **Next:**
  - UX4, page header (patterns spec section 2; PAGE-HEADER in the generated spec, conformance, rebuild stage);
  - then UX2c, the footer's rest (backlog 3a lists what each part must do).
- **Lane's answer, 18 Nov:** N26 checks that the first goal row's status and number are in the first phone screen, not its title (recorded in patterns spec section 6). Don't raise it again.
- **What found things this time:**
  - **Read the spec's "build" table row by row against the diff.** UX2b left five rows of 3.6 unbuilt, and the PR didn't say so.
  - **Ask the walker for `document.activeElement` and `aria-invalid` after an empty press.** That is how the check-in's focus fault turned up.
  - **When a place's props change, check who sees the action.** `act` left undefined fell back to `rowParts`' "Check in" on other people's goals.
- **Watch:** the build reports that N8 [STALE-RELOAD] fails alone on origin/main. It's in my log for planning.

**17 Nov, about 18:10 UTC: reviewer session_012kbr8zsxLnBL2bDKZQ8eoi stopped** (no UX2b PR yet, and a long idle wait with a large context; CLAUDE.md's prompt-cache habit). Main is reviewed to `b034bf71` (#591, UX2a, merged at 3d120e0c, the head I re-checked). No highs or mediums are open. #591's section in the log has a high (the check-in queue collapsed at 1440) and a medium (Home's values not lining up), both closed by 3d120e0c and re-walked at 360 and 1440. It also has one open low for planning: Home's "N need attention" block under Your goals still draws its own older row, not GOAL-ROW. Next: UX2b (form footer, spec section 3), then UX4 (page header, section 2), both from the patterns track session_012kbr92nZCpMz97iHEoe2xU. For each, check the pattern lands in the generated spec (FORM-FOOTER, PAGE-HEADER; conformance; rebuild stage) and walk the screens at 360 and 1440. The #591 walker found what the evals missed: a screen's old wrapper CSS around a new shared component. Look for a parent grid still applying (`.ciq-row` was the case), and compare value edges within each list.

**17 Nov, about 14:50 UTC: this reviewer stopped** (context 244k, and no PR expected for over an hour; CLAUDE.md's prompt-cache habit, #587). Start fresh from here: main is reviewed to `79b02a70` (#589); no highs or mediums are open; the next PRs come from the patterns track below.

**17 Nov, about 11:20 UTC:** a fresh reviewer, session_012kbr92pr7CjFy7aNL9Ejtv, has taken over. Main is `98eaf41f` (#584, docs only, nothing to review). Building resumes with two tracks: UX1 (small usability fixes from `docs/reviews/2026-11-17-usability-study.md`) and a design pass for UX2/UX4 (one shared goal row, page header and form footer; design docs only). UX1 build: session_012kbr8yjMdyy131NTXJSJxw (sends each PR number as it merges). UX2/UX4 design pass: session_012kbr8zkg36ewTBWd5FyWsR (docs only; review its PR against the design rules and Lane's earlier decisions). #585 (patterns spec) was reviewed before merge: 1 medium and 3 lows, all closed by the design session's fix before merge. #586 (UX1 1/3, c05194a6): no findings. #588 (UX1 2/3, d159becc): one low ('flagged' on the review page, 'to discuss' on Home). #589 (UX1 3/3, 79b02a70): no findings. UX1 is done. Main reviewed to 79b02a70. The shared-patterns track (UX2a row, then UX2b footer, then UX4 header) is session_012kbr92nZCpMz97iHEoe2xU: check each PR against docs/design/patterns/spec.md, and check that each pattern lands in the generated spec (GOAL-ROW, FORM-FOOTER, PAGE-HEADER; conformance rows; rebuild stage). The rest of this note is the 16 Nov reviewer's and still holds.

Written 16 November 2026, about 12:30 UTC, by the reviewer of 16 November, afternoon, after #577; updated at about 13:00 UTC. The reviewer is now session_012kbr91MPMFHiESAut3BVig (it carries on from session_012kbr91ft63Kw65jNoeTADG, which has gone). It stopped at about 19:05 UTC, 16 Nov, when building paused.

- **Building is paused** (planning, about 19:00 UTC, 16 Nov: Lane paused after #583). This reviewer stopped after #583. A fresh reviewer starts when building resumes: read this note, then compare `git log origin/main` with `7141ed66`.
- **Last merge fully reviewed:** `7141ed66` (#583). Every code PR merged from #121 up to it has a row in State and a section below. #577 to #583 are at the end, under “The reviewer of 16 November, afternoon”.
- **Merged since, not reviewed:** none at 12:30 UTC. Compare `git log origin/main` with `145d8859` on any message.
- **Highs open:** none.
- **Mediums open:**
  - None. #577’s medium (`get_metric`’s `sourceOwnerInFaro`) and its low are closed by #578. #579’s low is closed by #583. #582’s low (Help’s search reads hidden sections; R-names’ code pointer) is open, with planning for the backlog. The eight from #571, #574 and #576 closed in #577’s section.
- **Watch:** P3 (contrast on Ingrid’s Home row `a[href$="env-tpl-data"]`) failed in the builder’s full local run for #576, #577 and #578 and passed alone each time; none touched that row. Act if it fails on main’s full run.
- **Who gets what.** Highs at once to the owning track, with a copy to planning; mediums to planning once per batch; lows are logged only. **Planning is session_012kbr8yQaHGoDsesfVZhHry** (since about 13:40 UTC, 16 Nov; it has this note’s open list and the reviewer’s ID). Send highs and mediums there. #577’s medium and low were sent straight to the MQ2 builder (session_012kbr8yw65g7pJoQjRG9q19) at about 13:00 UTC; #578 fixed them.
- **Sessions:** MQ2 follow-ups track session_012kbr92uHkZxbfc7oExsQhM (from about 17:30 UTC, 16 Nov: the verifier’s Home line, and passing on metrics when the library is switched back on); drill-bugs track session_012kbr8yxWQV5FLnx6NXBs2f, done with #582; MQ2 builder session_012kbr8yw65g7pJoQjRG9q19, MQ2 finished with #578 (earlier ones: …nQ1Pis1ae for part 3, …QfmzFjm2XKzk for 4a, …DN7WVw5hc for #573, …BvahcmAa4s for #570); the fix session for #575 was session_012kbr91B1kqLGi5oMZv2Etd. Sessions change often: answer whoever sent the merge.
- **Read or walked by a subagent and not looked at again by me:** #577: the Draft page’s links, the form’s store reads, the reword, the agenda, the card and the empty Metrics page were walked by subagents; I looked at the phone To sort out view and the verify page as Tunde and Yuki. Earlier: #568’s doors and journeys; #570’s import walk (text read, no screenshot); #573 (its journey run, no screenshot); #575’s walk; most of #571’s, #574’s and #576’s walks beyond the one or two screenshots each section names. U180 to U183 were never run here. Not probed: a monthly goal through the Goals sheet and through carrying into a new year (#569 read only); a monthly goal waiting for its month on screen (the demo checks them in every week).
- **Lane's answers.** Read fixes against these, and don't raise them again:
  - 15 Nov (deep dive, `docs/backlog.md` "Deep dive, 15 Nov"): Start over is an admin's in every workspace, the example too (this replaces 12 Nov's "anyone may in the example"). A goal takes its owner's team by default; set-up doesn't ask. A visit's steps and errors stay in the browser and go only in a markup whose one box is ticked, shown first (Recording, option A). A status is not a control (`docs/design-rules.md`).
  - 15 Nov (MQ2, `docs/design/mq2`): the stage is worked out, never stored; warn, don't block; baselines are outside Defined and outside lapsing; Verified means someone other than the owner reproduced the figure; a reworded filter or exclusion asks the last verifier to confirm and doesn't lapse; every journey can be done through MCP.
  - 15 Nov (item 11): the drill is redefined around a stand-in platform; R1's "Record kinds the server checks" says what Faro does today and, apart, what a rebuild should add.
  - 14 Nov, late: a "Reached" moment is fixed as of its own week; a build without AI access keeps the MCP server open, and only the workspace's switch shuts it; "Not measured yet" is a status of its own.
  - 14 Nov, 12:33 UTC: an admin's pasted row over this week's check-in is a correction, with a reason and the owner kept as author; "Opened" and "Not yet" on a proposed goal are stored on the server; a check-in added late to an ended year stays as built; "Before this review" is visible to the whole workspace; Help hides a switched-off module's articles; admins-only triage on a browser flag is accepted for Faro (the database lets anyone); the first-download limit stays at 275 KB; PR CI caps very large selections.
  - Earlier: an untouched filled-in reading needs a touch before it posts (13 Nov); readings stay visible with the Metric library off (14 Nov).
- **Method, in short:** per merge, `git diff <merge>^1 <merge> -- . ':!spec' ':!api/mcp.js' ':!llms.txt' ':!evals/report.md'`, piped through `grep '^[+-]' | cut -c1-500`; fix PRs read against the findings they answer, with the first probe run again. A probe is a throwaway vitest file under `src/zz/` (write to stderr, run with `--silent=false`, delete it after) over `buildPlatformOrg(new Date('2026-11-05T12:00:00Z'))`; `src/modules/metrics/rulesQuality.test.ts`'s `world()` shows how to act as someone and apply a commit; a migration is run in PGlite as `src/data/schema.test.ts` does (create role anon, exec every file in order). A screen is a Sonnet subagent with Playwright on `npm run build` served by `npx vite preview`, told to copy `open` and `lookAs` from `evals/journeys.cjs`, to write under the scratchpad and to leave `git status` clean; look at a screenshot yourself. Keep the log in a second worktree (`git worktree add ../br origin/build-reviews -B build-reviews`). PGlite only, never the live database. Before saying a door is open, look for the refusal in the action the tool calls. `npm ci` first: the container starts without `node_modules`.
- **What found things this session:**
  - **A field a module sets on a core record: edit the record by its ordinary door** (#567’s high: `planGoal` rebuilt the goal and dropped `checkInRhythm`). Look for the line that keeps the last such field and see whether the new one is beside it.
  - **A fix: find who draws the thing it changed** (#570 put the notes in a preview component the import doesn’t use). `grep` the importers before believing a fix reaches the screen, then look at the screen.
  - **The same fault at the next door** (#567’s stale `percentile` on the sheet came back on the form in #574). When a rule is patched at one door, try the others the day they are built.
  - **A journey added for a fix: is it in the module’s `journeys`?** (#566: U180 wasn’t, so `touches.cjs` never picked it.) `node -e "require('./evals/touches.cjs').touches([file])"` says in a second.
  - **A sentence that sends someone somewhere: go there as them** (#576: “ask someone in Developer Experience”, who was refused).
  - **On a phone, any new row of buttons or a row with a long second part** (#571’s To sort out, #574’s Window row, #576’s picker line). Ask the walker for `scrollWidth` against `visualViewport.width` and look at one screenshot yourself.
  - Sonnet walkers given numbered steps, the demo date, “read the store after each save” and “quote the text” found most of the mediums; each took 5 to 15 minutes and about 200k of their own tokens. One build at a time: two walkers in one checkout collide on `dist` and on `src/zz`.
  - `ONLY=` picks journeys; the N checks are picked with `FINISH=N30,N7`. `PHONE_CPU=4` slows phone pages as the runs before a merge do.
  - A stop hook complains about untracked files: a walker’s `src/zz` is the usual cause; it goes when the walker finishes. Never commit it.
- **A slip to avoid:** a script that rewrites this note with `open(path, 'w').write(f(open(path).read()))` empties the file when `f` raises. Read first, assert, then write. It cost one commit on this branch (#543), put right in the next.

