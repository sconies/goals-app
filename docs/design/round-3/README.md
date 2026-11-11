# Round 3: the flows not yet redesigned, and what else can be switched or set

11 November 2026. Design and spec only: no app code is changed, and nothing here is built. Lane asked (11 Nov) to keep going with the redesign reviews and the feature isolations after round 2 (`docs/design/round-2/README.md`). Rounds 1 and 2 stand; this round builds on both.

## Part 1. The plan for the work

### What is in

Four flows that neither round has redesigned, and the two halves of the isolation question.

| Area | What | Folder | Items |
|---|---|---|---|
| The check-in | The thing people do most: one goal at a time, all numbers in a table, correcting a past week, with and without a rhythm | [check-in/](../check-in/README.md) | CK |
| The end of a cycle | The wrap-up, results, and carrying goals into a new year | [cycle-end/](../cycle-end/README.md) | CY |
| Running a review | Preparing, the walkthrough, deciding, finishing, the next session | [reviews/](../reviews/README.md) | RV |
| Home, every week | The owner's, the manager's and the leader's Home after the first week | [home/](../home/README.md) | HM |
| More switches | Which other features can be modules a workspace switches off: Watching, the Map, markup and the Feedback inbox, the wrap-up and results, MCP access, forecasts and trends | [feature-switches/](../feature-switches/README.md) | SW |
| Settings, not switches | What should be a number or a list a workspace sets: levels, the status thresholds, the shape of the year, the streak | [workspace-settings/](../workspace-settings/README.md) | CF |

### What is left for a later round

Telling people things (digests and notifications: platform requirements, R5); a screen-reader pass and dark mode; Data's tables as an editing surface.

### What depends on what

- **Home reads everything**: what the check-in, a review and the cycle's end each ask of a person shows there first. Home is designed last in thought and takes its blocks from the other three.
- **The switches decide what the four flows may assume.** A flow names what it shows only while a feature is on; the switches area says which features those are.
- **Settings change words everywhere** (a level's name, "on track" at 95%): the four flows use the vocabulary and never a fixed word for a level or a threshold.

### Shared decisions for round 3 (added to rounds 1 and 2)

1. **The test for a switch.** A feature can be switched off if no core rule reads its records. A number the core's rules turn on is a setting with values, never a switch. What stays core: goals, check-ins, the status rules, asks and next steps, the change log with undo.
2. **One page for both.** Workspace → Features holds "How you work" (the settings) and the switches, as round 2's toggles design drew it. A setting row says what is set and offers "Change"; a switch says On or Off.
3. **Changing either says what it will do first**, in counts, and can be undone. Changing a setting never rewrites the past: closed weeks and quarters keep the rule of their day (the pattern a plan change already follows).
4. **A flow is designed four ways at once**: rhythm on or off, Reviews on or off. Nothing is drawn greyed out.
5. **Words.** "Switch" for a feature, "setting" for a value; "wrap-up" for the end of a cycle; "check-in" stays the word with or without a rhythm; a level is called whatever the workspace calls it.

### Numbers

Round 2 ended at U109, F21, N22, P19.

| Area | Items | Journeys | Checks | Requirements |
|---|---|---|---|---|
| Check-in | CK1… | U110–U113 | F22, N23 | `CHECK-IN-ONE`, `CHECK-IN-TABLE`, `CHECK-IN-CORRECT` |
| Cycle end | CY1… | U114–U117 | F23, N24 | `WRAP-UP`, `RESULTS`, `CARRY-OVER` |
| Reviews | RV1… | U118–U121 | F24, N25 | `REVIEW-PREPARE`, `REVIEW-WALK`, `REVIEW-FINISH` |
| Home | HM1… | U122–U125 | F25, N26 | `HOME-OWNER`, `HOME-MANAGER`, `HOME-LEADER` |
| Switches | SW1… | U126–U129 | F26, N27 | one `<FEATURE>-OPTIONAL` per switch recommended |
| Settings | CF1… | U130–U133 | F27, N28 | `LEVELS-SET`, `THRESHOLDS-SET`, `YEAR-SHAPE`, `STREAK-SET` |

## Part 2. What came back, and the build plan

*Written last, after the six areas were reviewed.*
