# Round 2: entering data, starting a workspace, and optional rhythm

11 November 2026. Design and spec only: no app code is changed, and nothing here is built. Main is locked until after the talk. Round 1 (`docs/design/README.md`, backlog RD) stands; this round builds on it and says plainly where it changes it.

Lane asked for four things:

1. **Goal entry**: New goal, the goal edit page, and adding a goal from set-up or the review.
2. **Workspace set-up**: from the first screen to the first week.
3. **Bulk import and export**: "easy to bulk add data, but difficult to do it incorrectly."
4. **A question**: can reviews, and check-ins on a timed rhythm, be features a workspace switches off?

| Area | Evaluation and design | Build spec | Items |
|---|---|---|---|
| Import and export | [import/README.md](../import/README.md) | [import/spec.md](../import/spec.md) | IM |
| Goal entry | [goal-entry/README.md](../goal-entry/README.md) | [goal-entry/spec.md](../goal-entry/spec.md) | GE |
| Workspace set-up | [setup/README.md](../setup/README.md) | [setup/spec.md](../setup/spec.md) | ST |
| Reviews and the rhythm as switches | [feature-toggles/README.md](../feature-toggles/README.md) | [feature-toggles/spec.md](../feature-toggles/spec.md) | FT |

## Part 1. The plan for the work (written before the walk)

### What the first look found

One read of the code and the round-1 files, and one pass over the live demo, before anything was split:

- **The four asks are one subject seen four ways: how a fact gets into Faro and whether Faro trusts it.** A goal typed into the form, a goal in a set-up template, a goal in row 4,112 of a workbook and a goal added mid-review are the same record, checked by the same rules (`src/domain/changeset.ts` is already the one engine; `src/domain/columns.ts` is already the one list of columns). What differs is how each door says what is required, and what it does when something is wrong. Today each door says it differently.
- **Nowhere says which fields are required.** `columns.ts` gives each column a role (matches, can change, action, worked out) but not whether a new row must have it, its format, or an example. The form finds out by refusing; the import finds out by listing problems; `docs/export-format.md` doesn't say.
- **The import already has the right bones**: one format, a preview, all-or-nothing, undo from Activity, and a file that loads back unchanged. What it lacks is the middle ground between "wrong" and "fine", a way through a big file, and words for the person who made the mistake.
- **Round 1's OB1–OB3 cover the order of New goal's steps, a goal not born late, and day one.** They stop at: the edit page, goals added from set-up and the review, what "required" means, drafts, what set-up asks about how the team works, and set-up's spreadsheet path (named in round 1 as not covered).
- **The rhythm is a parameter of the core, and reviews are a feature.** `RULES.staleDays` (14), the `due` flag, Home's "due by Thursday" and the streak are the rhythm; they live in `src/domain`. Reviews are screens, a table and a walkthrough that `docs/architecture.md` already lists as "still to move" into a module. So the question has two different answers, and they are designed apart.

### The split, and what depends on what

```
feature-toggles ──┐ (what a workspace may switch off decides what set-up asks
                  │  and what a new goal promises)
import ───────────┼──► goal-entry ──► setup
 (the field table │    (the form is the     (set-up is: name, people, how you
  and the three   │     field table, one     work, then goal entry or an import,
  levels are the  │     goal at a time)      then day one)
  base)           │
```

- **Import first in thought, because it owns the field table and the validation model.** Goal entry and set-up refer to both; neither restates them.
- **Toggles beside it**, because its answer changes one step of set-up and a few lines of goal entry.
- **Goal entry before set-up**, because set-up's goal steps are goal entry.
- All four are walked and drawn in parallel, one agent each, on the shared decisions below. The decisions are kept here, and each area's output is reviewed against them before it is accepted.

### Shared decisions for round 2 (every area uses these)

These add to round 1's shared patterns (`docs/design/README.md`, "What is shared"); they replace none of them.

**1. One field table.** Every field a person can give Faro is one row in one table: its name, whether a new record must have it, its format, an example, what it defaults to, and the exact words when it is wrong. The table is specified in `import/spec.md` and would live in `src/domain/columns.ts` (each column gains `required`, `format`, `example`). The form's labels and errors, the import's preview, the template, `docs/export-format.md` and Help are all made from it. A field is one of:

| Word on screen | Means |
|---|---|
| **Required** | A new record can't be saved without it |
| **Required for {type}** | Required when the goal is of that type (Target for a number goal) |
| Optional (said only where a group mixes both) | Can be left out; the default is said |
| Worked out | Faro writes it; never read back |

Forms mark the few optional fields, not the many required ones, when most are required; a step with one required field says nothing. A spreadsheet's header row can't carry marks, so the template and the README sheet say it, and the preview says it first.

**2. Three levels, the same at every door.**

| Level | Word | Mark | What happens |
|---|---|---|---|
| Blocking | **Must fix** | The warning mark, and a wash or full outline on the field or row | It can't be saved. The words say what is wrong, what was found and what would be right |
| Questioned | **Check** | The warning mark, quieter | It can be saved once a person has answered the question. One answer covers every row with the same question |
| Fine | (none; counted) | None | Saved |

- Blocking is for what Faro cannot record truthfully: a missing required field, a word it doesn't know, a number that isn't one, a key used twice, an owner it can't find.
- Questioned is for what is possible but unlikely: a stage dated in the past (round 1's OB2 is the first case of this level), a number ten times the last, a name one letter from an existing one, a team or person the file would create, a goal with the same name in the same team, a start that isn't today's number.
- Neither level is a status, so neither uses a status shape or colour capsule (the design rules).
- An error names the field in the person's words, says what was read, and gives the fix: "Level says “vp”. Use north star, svp or team." Never a code, never only "Invalid".

**3. See it before it is saved.** Every door ends on a read-back: New goal's last step, the edit page's "What will change", set-up's check step, the import's preview. The read-back says what will be added, changed, stopped and left alone, in counts first and rows on request.

**4. Everything entered can be taken back.** One goal: Delete while it has no check-ins (exists). A bulk load: one Undo for the whole load, from where it was done and from Activity, for as long as nothing later depends on it; after that, the rows are named.

**5. Out and back in changes nothing.** Anything exported, loaded back unedited, reads as "Nothing would change". This is already a rule (`roundtrip.test.ts`); round 2 makes it something a person can see.

**6. Two switches, said the same everywhere.** Provisional until the toggles analysis is reviewed; the other areas design for these and nothing finer:
- **Reviews** on or off, for the workspace (a module, on Workspace → Features).
- **The check-in rhythm**: weekly, or none (a core setting). With none, nothing is due or late for want of a check-in; a goal still says when it was last updated.
- Off means absent, not disabled: no menu row, no empty block, no sentence about what isn't there (round 1's rule for a person who can't act).

**7. Words.** "Import" and "Export" for files (as today). "Load" is not used as a second word for import in new wording. A file is "the workbook" or "the file"; a sheet is "the Goals sheet"; a line is "row 14". "Must fix", "Check", "Required", "Optional" as above. The first week is "your first week", the first screen is "Welcome".

### Numbers, so no two specs claim one

Round 1 ended at U86, F16, N17, P18. A build session takes the next free number if another build has taken one since.

| Area | Items | Journeys | Checks | Requirements |
|---|---|---|---|---|
| Import and export | IM1… | U87–U92 | F17, N18, P19 | `FIELD-TABLE`, `IMPORT-LEVELS`, `IMPORT-PREVIEW`, `IMPORT-UNDO`, `IMPORT-LARGE` |
| Goal entry | GE1… | U93–U96 | F18, N19 | `GOAL-ENTRY-REQUIRED`, `GOAL-EDIT-PREVIEW`, `GOAL-ADD-ANYWHERE` |
| Set-up | ST1… | U97–U100 | F19, N20 | `SETUP-FIRST-SCREEN`, `SETUP-HOW-YOU-WORK`, `SETUP-UPLOAD`, `FIRST-WEEK` |
| Toggles | FT1… | U101–U104 | F20, N21 | `REVIEWS-OPTIONAL`, `RHYTHM-OPTIONAL` |

### How each area is written

The same shape as round 1: `README.md` (jobs by role and frequency; findings with evidence; the design; each screen's one primary action; role differences; the phone; wireframes) and `spec.md` (routes; each screen's content in order with exact wording, empty and error states; who sees what, naming the action that enforces it; rules for `src/domain` with worked examples; redirects; evals; Help and What's new; "if Lane decides otherwise"; a build plan). Wireframes are drawn with `docs/design/_shared/kit.cjs` at 1440 and 390 px. Walks use the live demo at `/demo?today=2026-11-11`, and `/?store=browser` with database requests blocked for set-up and importing, so nothing is written to the shared database.

## Part 2. One build plan across the four areas

*Written last, after the four areas were reviewed. See below.*
