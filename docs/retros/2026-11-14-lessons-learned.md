# Building Faro: what it cost and what to do differently

Written 14 November 2026, about 15:00 UTC, for Lane. A draft: the numbers are from the session records and git, and estimates are marked as estimates.

## 1. What it cost

| | |
|---|---|
| Spend, 7–14 Nov (sessions created in that time) | **$4,153** across **131 sessions** ($3,947 for the 114 created 9–14 Nov) |
| Tokens | 11.58 **billion** cache reads, 193M cache writes, 0.46M fresh input, **19.1M output** |
| Merged pull requests, 7–14 Nov | about **312** (339 in all; 1,998 commits on main) |
| Cost per merged PR | about **$13** |
| Re-read per word written | **607 tokens** read from cache for every token written |

**By day (sessions by the day they started):** 9 Nov $364 · 10 Nov $258 · 11 Nov $1,175 · 12 Nov $967 · 13 Nov $1,085 · 14 Nov $99 so far. Counted by when the money was spent, 13 Nov was about $1,430. PRs merged per day: 16, 34, 19, 91, 110, 21. On 11 Nov $1,175 bought 19 merges, because the reviewer and the redesign reviews started that day. On 13 Nov it was about $13 a merge.

**By role**

| Role | Sessions | Cost | Share |
|---|---|---|---|
| Build tracks (1–7) | 73 | $2,634 | 63% |
| Build reviewer (Fable) | 8 | $563 | 14% |
| Other builds, rehearsals, demo, relays | 34 | $342 | 8% |
| Planning | 6 | $265 | 6% |
| Design reviews (Fable) | 4 | $216 | 5% |
| Fixers (hotfixes, main back to green) | 6 | $134 | 3% |

By model: Opus $3,360, Fable $779, **Sonnet $14 (6 sessions)**. Until 14 Nov almost no mechanical work went to the cheaper model.

**By kind of work (estimate).** Costs are not split by kind, so this uses the usual price ratios: a cache read costs about a tenth of fresh input, and output about five times fresh input. On that basis, about **78% of the money paid for re-reading context**, about 16% for writing it to the cache, and about 6% for output. The code, docs and reviews themselves were the 6%. Most of what Lane paid for was the same context read again on every turn.

Why: 107 of the 131 sessions ended at 300k tokens of context or more, and 41 at 500k or more (median 417k). Ten sessions cost $1,808, 44% of the total. The first reviewer alone cost $439: 59.6 hours, ending at 679k tokens of context, and 691M tokens re-read to write 2.3M. The planning session from 10 Nov re-read 1,160 tokens for each one it wrote.

## 2. What worked

- **Throughput and quality held.** About 312 merges in a week, each with tests, journeys, help, spec and conformance rows. Main was usually green and was fixed quickly when it wasn't.
- **The build reviewer found real bugs.** 18 highs and 262 mediums across 221 reviewed PRs, including tenant isolation (#122), a year-boundary rule (#127) and readings stored against the wrong week. A per-merge review of the diff, with generated files left out, was the right way to do it.
- **Rules that live once** (status, check-ins, the bulk-change engine shared by the app, the import and MCP) and the spec generated from code kept three ways in from drifting apart.
- **Gating by what a change touches** (`evals:changed`, `evals:pr`) plus a full run after the merge with one rolling issue kept CI time under control.
- **Lane's 14 Nov fixes (#455) worked at once.** Fresh sessions cost $10–17 each, and the fresh reviewer cost $3.50 for its first three batches against $439 for the old one.

## 3. What wasted the most, by cost

1. **Re-reading long contexts: about $1,000–1,500 of avoidable spend (estimate).** The 13 Nov rule ("don't hand over at a fixed size … only near 80%") and the earlier view that cached context was cheap let sessions run to 500k–740k tokens. A cached read is cheap per token, but at 600k tokens a turn, 11.6B tokens re-read is about three-quarters of the bill. Evidence: track 4's session (`…fxbNv2QV`) cost $259 and re-read 795M tokens to write 1.26M; track 3's (`…mUDFhXnz`) ended at 741k tokens.
2. **The long-running reviewer: about $350 avoidable.** One Fable session for 2.5 days, re-reading a review log that is now 296 KB (about 75k tokens) plus every diff. Starting fresh each day costs a few dollars a batch.
3. **Too many parallel tracks: about $300–600 (estimate).** Seven tracks plus fixers and side builds meant that **133 merges of main into branches** were needed for 339 PRs. Nearly every one conflicted in `src/help/whatsNew.ts` (240 commits touch it), `api/mcp.js` (311 commits, 2 MB), `spec/` (321 commits, 14 MB) or `llms.txt`. Each conflict was resolved by the strongest model inside a large context. Parallel work also caused collisions: two journeys called U87 (#163), check id N28, two sessions building the same 09:00 fix, and #452's high handed to two tracks. Main went red after near-simultaneous merges left the generated spec stale.
4. **The handover file: about $150–300 (estimate).** `docs/handover.md` is **213 KB, 1,424 lines, 57 sections**, most of them superseded entries ("supersedes the 17:00 entry …"), changed by 140 commits. Every new session read part of it (50k+ tokens) and some picked up a stale entry. Each read-in of 100–150k tokens could have been about 30k.
5. **Review fixes that raised more findings: about $150–250 (estimate).** About 50 of the 221 reviewed PRs were review fixes. About 20 of those raised new findings (2 highs, about 40 mediums, about 70 lows). Until 14 Nov lows were fixed too, each fix became a PR, and each PR needed regenerating, review and a merge of main.
6. **Mechanical work done by Opus: about $300–500 (estimate).** Merging main, rebuilding `api/mcp.js` and `spec/`, eval reruns, watching CI and docs edits were all done inside large Opus contexts. Sonnet subagents would have done them at a fraction of the price.
7. **Designs decided mid-build: hard to price, probably the largest cost after re-reading.** The redesign came in four rounds (RD on 10 Nov, RD2 on 11 Nov, round 4 on 13 Nov), and ideas kept arriving while tracks were building (GB, BL, MS, MI, GR, MQ, TG, MC on 12–13 Nov from loading a metrics register). Tracks reworked screens that had just merged, and every extra item brought its own spec, conformance rows, stage, help article, What's new entry and switch. Design sessions alone cost $216; the rework sits inside the track costs.
8. **Smaller items.** Bundle-size walls (275/334 KB) needed a dedicated piece of work (FD, #471). Nightly readings failed before 09:00 UTC. Session starts stalled on approval prompts while Lane was away (fixed on 13 Nov by pre-approving `create_session` and `send_message`). Together, perhaps $50–100.

These overlap: a smaller context also makes each conflict and each handover cheaper. Together they come to roughly **$2,000–2,500 of the $4,150**. The same work could plausibly have cost **$1,600–2,200**.

## 4. What to do differently next time, ranked by savings

### On day one

1. **Cap context at about 300k from the start, and measure it.** The habit is `get_session`, then `context_usage.used_tokens`. Saves about $1,000–1,500 here. Say in CLAUDE.md that cached reads dominate cost, not that they are cheap.
2. **Start the reviewer fresh each day** with a short "where to start" note, and keep the per-PR log out of its context. Saves about $350.
3. **At most three build tracks, each owning one area**, with the whole list for that area. Saves perhaps $300–600 in conflicts, duplicate work and relays.
4. **Don't commit generated files.** Build `spec/`, `api/mcp.js` and `llms.txt` in CI or at deploy, and check they are current in CI. Release notes as one file per entry, put together at build time. Ids prefixed by module. This removes most merge conflicts. Saves perhaps $200–400.
5. **Sonnet subagents for mechanics** from the first PR. Saves about $300–500.
6. **A short handover note per track** (`docs/handover/track-N.md`, overwritten, under about 150 lines), plus one planning note. Saves about $150–300.
7. **Pre-approve routine tools** before leaving sessions unattended.

### Later, once the shape is clear

8. **Decide designs in fewer, larger batches before the tracks that use them start.** Park mid-build ideas in the backlog and pull them in as a batch between rounds, not into running tracks. Likely the biggest saving after context, but hard to estimate.
9. **Sort review findings by severity from the start:** highs at once to the owner, mediums in one batch per day, lows to the backlog. Lane's 14 Nov rule, applied from the first review.
10. **Set budgets (bundle, page load) with 15–20% headroom and one owner**, and fix the clock in time-dependent checks.
11. **Let the rebuild-kit work grow with the module, not with every PR.** Spec and conformance rows are worth keeping. Regenerating and merging them on every PR is where they cost money.

## 5. What to keep doing on Faro for the rest of the build

Faro is close to handoff; what is left is mostly item 11, the full drill. So:

- **Keep #455's rules exactly:** 300k handovers, Sonnet for mechanics, a daily reviewer, three tracks at most. Don't start new tracks for the drill. One session runs it stage by stage and hands over between stages.
- **Freeze new features** except what the drill or the handoff kit needs. Every new idea goes to the backlog.
- **Fix the handover file now:** move the current state into short per-track files and archive the superseded entries. Next sessions read 30k tokens, not 100k+.
- **Send only highs back to tracks.** Mediums go in one batch; lows go to the backlog.
- **Write the lessons into the kit.** The ones that apply to an internal rebuild are now in `docs/handoff.md` ("How to run the rebuild"). Carrying them into the generated kit, so a drill session sees them, is backlog item KL.
- **Watch cost per merge daily.** On 14 Nov it is about $8–10; above $15, look for a long-context session.

## If I started again tomorrow

- [ ] CLAUDE.md says: hand over at about 300k tokens of context; cached reads are most of the bill.
- [ ] At most three build tracks, each owning one area, plus one planning session and one reviewer.
- [ ] The reviewer starts fresh every day from a 30-line note.
- [ ] Sonnet subagents do merges, regeneration, eval runs, CI watching and docs edits.
- [ ] Generated files are built in CI, not committed. Release notes are one file per entry. Ids are prefixed by module.
- [ ] One short handover file per track, overwritten, never appended.
- [ ] Designs are decided in a batch before the track that builds them starts; new ideas wait in the backlog for the next batch.
- [ ] Review findings: highs at once, mediums batched daily, lows to the backlog.
- [ ] Budgets with headroom and an owner; a fixed clock in tests.
- [ ] Routine tools pre-approved before leaving sessions unattended.
- [ ] Cost per merged PR checked every evening.
