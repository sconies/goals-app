# TG: tags on goals (a workspace's own fields), the `tags` module

Backlog TG (Lane, 12 November, loading a metrics register through MCP). Module map: its own module behind a `tags` switch (Lane 1a, 13 November). Written by track 2, 13 November. **Lane answered section 11 with every recommendation, 1a to 7a (Lane, 13 Nov, relayed by planning): build it.**

**Standing rules** (`CLAUDE.md`): its section of `spec/`, conformance rows, its rebuild stage (`rebuild` in `module.json`), its switch, What's new, the guide, its MCP tools in the same PR, evals, and the gate. The migration ships one merge ahead of the code that uses it (AX10), written for the `faro` schema (`supabase/README.md`).

## The problem

Teams track things Faro has no column for: a lifecycle stage (Discover, Build, Run), a programme, a funding line, a region. Today they push them into the title or the definition, where nothing can filter on them, and an import of a register loses the column ("a column nothing reads is named").

## What it is, and what it is not

- A workspace defines a few **fields**. Each is a short **list of values** or **free text**. A goal has at most one value per field.
- Fields show on the goal, filter Goals and saved views, are columns in the sheet, and are read and written by MCP.
- **Not a place for status or anything a rule reads.** No rule in `src/domain` reads a field: no status, no flag, no needs-attention, no check-in rule, no carry rule (a field's value is copied with the goal, as its definition is). This is what makes it a module (module map, "the test for a module").

## 1. Routes

| Address | What |
|---|---|
| `/workspace/fields` | Workspace → Fields: the workspace's fields, for admins to add, rename, reorder and retire; everyone else reads them |
| `/goals?f.<fieldKey>=<value>` | Goals filtered by a field's value; the same parameter in a saved view |

## 2. Screens

### 2.1 Workspace → Fields (admins)

A list of fields in their order: name, kind ("A list: Discover, Build, Run" or "Free text"), how many goals have a value, and Change. "Add a field" (the page's one primary action) opens a sheet: Name ("Stage"), Kind (A list of values / Free text), and for a list its values, one per line. A field is **retired**, never deleted: its values stay on goals and in History, it leaves the goal page, the filters and new exports, and can be brought back. At most `MAX_FIELDS` (6) live fields; a list holds at most 20 values.

Empty: "No fields yet" · "Add one when a team tracks something Faro has no column for, such as a stage or a programme. It isn't read by any rule: it's for finding and sorting." · "Add a field" (plain, per SM2's empty pages).

### 2.2 On a goal

A **Fields** block in About, under the facts: one line per live field, "Stage · Build", or "Stage · Not set". The goal's owner or an admin changes them in place (a select for a list, a text field for free text, 80 characters); the change goes through the change engine and History says "Stage: Discover → Build". No reason is asked: a field is not the plan.

### 2.3 Goals and saved views

The Filters sheet gains one row per live list field ("Stage: Discover · Build · Run · Not set"), multi-select. The filter line says "Filtered by: Stage is Build (Remove)". A saved view keeps the parameters. Free-text fields are searched by Find, not filtered. Data's Goals table gains a column per live field.

### 2.4 The sheet

The Goals sheet gains one column per live field, headed with the field's name. The field table (`src/domain/columns.ts`) is core; the module adds its columns through the module sheet extension it already has (`ModuleSheet`). On import, a value a list doesn't hold is a **Check**, asked once per value: "Stage says “Operate” on 4 rows. Add “Operate” to Stage, or leave these cells empty?" (an admin only may add; for anyone else it is "leave empty" or fix the file). A column headed with an unknown name stays "a column nothing reads".

### 2.5 MCP

`list_fields` (the fields and their values); `set_goal_fields` (`goal_id`, `fields: { name: value }`, `dry_run`); `find_goals` gains `fields: { name: value }`. With the switch off, all three refuse with the module-off sentence.

## 3. Who may

| What | Who |
|---|---|
| Add, rename, reorder, retire a field or a list's values | Admins |
| Set a goal's value | The goal's owner, or an admin (as any change to a goal) |
| See and filter | Everyone |

## 4. Data and the migration

Two tables in `faro`, with RLS as the workspace's other tables and every grant written out:

- `okr_goal_fields` (`workspace_id`, `id`, `name` 1–40, `kind` in ('list','text'), `options` jsonb (a list's 1–20 values), `position`, `created_by`, `created_at`, `retired_at`, `retired_by`), unique (`workspace_id`, lower(trim(`name`))) among live fields;
- `okr_goal_field_values` (`id` = `{goal_id}:{field_id}`, since module records are upserted on `id`; `workspace_id`, `goal_id`, `field_id`, `value` text ≤ 80, empty when cleared, `set_by`, `set_at`).

Both go on `faro.module_tables` (module `tags`, positions 30 and 40), and the change log's `entity` gains `field`. Drafted as migration 0052 (goal fields) on branch `tg0-migration` (track 2, 14 Nov).

Check constraints add their lines to `src/spec/limits.ts`. Module records (`src/core/records.ts`) carry them through save, removal, undo, the carry and the workbook, so no core rule reads them.

## 5. Rules (module code, not `src/domain`)

1. `fieldProblem(field)`: a name of 1–40 characters, unique among live fields; a list has 1–20 distinct values of 1–40 characters.
2. `valueProblem(field, value)`: a list value must be one of its values (case-insensitive, stored as written in the list); text ≤ 80 characters; empty clears it.
3. `filterGoals(goals, values, filters)`: a goal matches every field filtered; "Not set" matches a goal with no value.
4. Retiring a field keeps every value; bringing it back restores them.

## 6. The switch

`tags` off: no Fields block, no Workspace → Fields row (the page says the module is off), no filter rows, no sheet columns (the import says once that it didn't read them), and the three tools refuse. The values stay and come back when it is switched on.

## 7. Evals

| # | Journey or check |
|---|---|
| U-TG1 | As an admin: add "Stage" (Discover, Build, Run); set G-14 to Build on its page; Goals filtered by Stage is Build lists it; save as a view; History says the change |
| U-TG2 | A workbook with a Stage column: an unknown value is asked once; exported and loaded back, nothing changes |
| N-check | `tags` off: the core journeys pass, and none of the module's surfaces is drawn |

Requirements: `TAGS-FIELDS`, `TAGS-FILTER`, `TAGS-SHEET`, `TAGS-OFF`.

## 8. The first download

Everything here is lazy: the Fields page, the goal's block (a `goal.facts` place loaded with the module) and the filter rows. The first download must not grow.

## 9. What the rebuild should copy

- A workspace's own fields are data, not schema: two tables serve any number of fields.
- No rule reads them; that is what lets them be switched off.
- Unknown values in a file are asked, never created silently.

## 10. Build plan

| # | Part | Size | Needs |
|---|---|---|---|
| TG0 | The migration (two tables, grants, RLS, limits) | S | Nothing; one merge ahead |
| TG1 | The module: fields, Workspace → Fields, the goal's block, MCP, switch | M | TG0 |
| TG2 | Filters, saved views, Data's column, the sheet's columns and the import's question | M | TG1 |

## 11. Lane's answers (Lane, 13 Nov: every recommendation)

1. **Up to six fields**, each a list or free text (1a).
2. **Both** lists and free text: a list is filterable; free text is found by Find only (2a).
3. **Admins** define the fields and their values; everyone may set a goal's value as they may change the goal (3a).
4. **A value a list doesn't hold**, in a file or from MCP, is asked once per value: an admin may add it to the list, anyone else leaves those cells empty (4a).
5. **A removed field is retired, never deleted**: its values stay on goals and History, and it can be brought back (5a).
6. **A Fields block in About** on the goal's page, one line per field, changed in place (6a).
7. **New goal doesn't ask** for fields: they are set on the goal's page or in the sheet after (7a).

The questions as asked, kept for the record:

1. **How many fields?**
   - (a) Up to six fields, each a list or free text. *Recommended: a register usually has two or three such columns, and six keeps the goal page calm.*
   - (b) One field only, "Stage", with its values set by the workspace.
   - (c) No limit.
2. **Lists, free text, or both?**
   - (a) Both: a list is filterable; free text is found by Find only. *Recommended.*
   - (b) Lists only.
   - (c) Free text only.
3. **Who defines the fields and their values?**
   - (a) Admins; everyone may set a goal's value as they may change the goal. *Recommended.*
   - (b) Anyone may add a value to a list while setting it.
4. **A value a list doesn't hold, in a file or from MCP:**
   - (a) Asked once per value; an admin may add it to the list, anyone else leaves the cells empty. *Recommended: the import's rule that nothing is created silently.*
   - (b) Added to the list silently.
   - (c) Always refused.
5. **Removing a field:**
   - (a) Retired, never deleted: its values stay on goals and History, and it can be brought back. *Recommended.*
   - (b) Deleted with its values, after typing its name.
6. **Where it shows on the goal:**
   - (a) A Fields block in About, one line per field, changed in place. *Recommended.*
   - (b) Small labels under the goal's title.
   - (c) Only on Goals and in the sheet, not on the goal's page.
7. **Does a new goal ask for its fields?**
   - (a) No: set them on the goal's page or in the sheet after. *Recommended: New goal stays as short as it is.*
   - (b) Yes, an optional step.
