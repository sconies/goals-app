# The full rebuild drill (backlog item 11), November 2026

The last proof before the handoff: a fresh session rebuilds Faro stage by stage from the rebuild kit alone (`spec/` and `llms.txt`), the core first and then each module on its own, and each stage ships when its exit criteria pass.

- **Pinned to:** main at `dd00ff48` (KL's merge, #508). The kit read by every stage is `spec/` and `llms.txt` from that commit; later merges don't change this run.
- **How each stage runs:** a fresh subagent sees only a scratch folder with a copy of the pinned `spec/` and `llms.txt` (never Faro's source), builds the stage under `rebuild/` on top of the previous stage's passing rebuild, and keeps `GAPS.md`. Stages 1 to 3 are scored by the harness (`npm run drill -- <folder>`, run from the pinned commit). Module stages (4 to 11) are outlines with no harness of their own: the rebuild must still score 100% on stages 1 to 3 with the module in it, and a separate reviewer checks each exit criterion by hand against the rebuild.
- **A gap** is a place where the kit alone wasn't enough. Each one is fixed in the kit itself (`src/spec/*`, a module's `rebuild` stage, conformance rows), never by pointing the drill at the source.

## Scorecard

| Stage | Result | Gaps found | PRs |
|---|---|---|---|
| 1. The core rules | Running | | |
| 2. The core data and the change engine | Waiting | | |
| 3. The core screens and journeys | Waiting | | |
| 4. Module: Feedback | Waiting | | |
| 5. Module: Goal map | Waiting | | |
| 6. Module: Metric library | Waiting | | |
| 7. Module: Reviews | Waiting | | |
| 8. Module: Spreadsheets | Waiting | | |
| 9. Module: Fields (TG1) | Waiting | | |
| 10. Module: Watching | Waiting | | |
| 11. Module: Wrap-up | Waiting | | |

### To add when merged

Modules not on main at `dd00ff48`, each added later as a stage of its own with its section, conformance rows, stage and switch: GR (#464, merged after the pin), MQ (migration #502 merged after the pin; structure #505 to come), FT1 (#465, merged after the pin), TG2 (#493), SW2 (#504), MC and MI.

## Gaps

Each gap: the stage, what the kit didn't say, the evidence, and the fix.

