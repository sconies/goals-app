# Stand-in rebuild: stage 8, Reviews (drill item 11)
(Saved by the drill session from the builder's reply, condensed.)

Proofs: `platform/prove-reviews.mjs [port]` (in, 35), `--without` (out, 5), `platform/prove.mjs` (core, 36).

## (a) Ported as-is
2,321 of 2,327 files unchanged. All Reviews code unchanged: src/modules/reviews/* (7 AI tools, Help, routes), Review.tsx, Inspect.tsx, ReviewPrint, review.ts, reviewsOff.ts, decide.ts, reviewWrites.ts, progress.ts, the review actions, the off gate in actions.ts and tools.ts, the Workspace read-back, the import's reviewsOffSheets. No new migration (okr_reviews and review_id columns are the core's, stage-8 gap 2). No files or jobs (U155 is worked out from the change log).

## (b) Rewired (6 files, +364 −4)
| Area | File | Why |
|---|---|---|
| Build | package.json (+1 −1) | reviews in; STANDIN_WITHOUT |
| Server access | guardReviews.ts (+137, new), guard.ts (+5 −1), server.ts (+2 −1) | every /commit checks each kind Reviews owns with the domain's rules and wording (canSpeakFor, speakRefusal, scopeRefusal, writesReviews) |
| Proof | guardReviews.test.ts (44), prove-reviews.mjs (176) | |
Enforced: a review set up only as yourself; changed by someone in it, its creator or an admin; ended/deleted by creator or admin; restored by admin or remover; creator and date never change; a leaver dropping out and a carried goal joining let through as side effects. Marks and notes: said as the signed-in person, who speaks for the review, about a goal it walks; corrected or removed by the sayer or an admin; who/goal/review/when never change. Asks raised in a review: by the signed-in person who speaks for it; review never changes. A goal proposed in a review: only new, by its proposer, who speaks for it. While off: any save writing these refused with the switched-off sentence, admins included. /mcp needed no change.

## (c) Platform requirements
| Needed | Status | Where |
|---|---|---|
| Records in the store | NAMED | stage-8 gap 2; schema.sql |
| modulesOff on every save and tool call | NAMED | stage-8 entry; module-platform.md writesWhenOff |
| While off, the server refuses a raw save of Reviews' records | rule NAMED; where GAP | exit 4 names actions and tools only; Faro refuses only in performAny and callTool |
| Who sets up, changes, ends, deletes | NAMED | r1:66-67, 73 |
| Who speaks for a review | NAMED, contradicted | REVIEW-SPEAK and code: someone in it or an admin; r1:68-69 "Anyone" |
| Speaking only about goals the review walks | GAP | code only (maySpeak, scopeRefusal) |
| Correcting, removing, undoing what was said | NAMED | r1:70-72 |
| Restoring | NAMED (generic) | r1:95 |
| Proposing a goal in a review | GAP | code only, goalEntry.ts:601-605 |
| What in a note or raised ask may change | GAP | implied by editCall |
| Side-effect writes (leaver leaves a review, carried goal joins) | GAP | carry.ts, removal.ts |
| While off, are tools still listed? | GAP / tension | stage text "no review tools" vs exit 9; Faro lists all 7 and refuses each |
| Files, jobs | not needed | |

## (d) Behaviour
typecheck passes; npm test (--testTimeout=60000) 203 files, 2,220 pass; drill 100% (reviews.csv 91/91), contracts 56/56; shim 56/56; in: prove-reviews 35/35, core 36/36; out: 5/5, core 36/36 (53 tools).
| Exit | Status | Evidence |
|---|---|---|
| 1 Requirements | MET | 13 server refusals via /commit as a non-admin member, each in the app's words; allowed cases pass; MCP review_call by a non-member refused |
| 2 Journeys | PART | below |
| 3 Off: menu | MET | phone tabs not checked |
| 4 Off: pages and writes | MET | exact sentence; server refuses note, raised ask, admin restore; core saves go through |
| 5 Off: Home | PART | Goals you watch needs Watching (out) |
| 6 Read-back and Undo | PART | U103 fails at Home's lead (Watching out) |
| 7 Back on, as it was | MET | rows identical; U104 10/10 |
| 8 Clock words | MET | reviews.csv; U154 10/10 |
| 9 Closed page, tool sentence | MET | |
| 10 Read-back lines | MET | |
| 11 Workbook while off | MET via change engine | reviewsOffSheets.test.ts |
| 12 Back on after a week | MET | U155 10/10 |
Journeys (/demo, others out): U3, U13, U36, U49, U63, U67, U79, U104, U154, U155 10/10, N1, P5 pass. U30 (goal map), U72 (metrics, import), U80, U103 (Watching) fail on left-out modules; N21 fails only on Feedback and Metric library address checks; none class names or wording; U47 not run (Feedback).

Setup note: rsync missing, so the builder's first `npm ci` ran in /home/user/goals-app (reinstalled node_modules; nothing tracked changed).

## One-line kit fixes
- r1:68-69: "Anyone" → "Someone in the review, or an admin (REVIEW-SPEAK), about a goal it walks".
- r1: row "Propose a goal in a review | Someone in the review, or an admin; only a new proposed goal | goalEntry".
- stage-8 exit 4: "refused by the server too, for a save made without the app's actions".
- stage-8: say whether a switched-off module's tools stay in tools/list.
- module-platform.md writesWhenOff: name the side-effect writes a server guard must let through.
- U30, U72, U80, U103, N21: tag steps that need another module.
