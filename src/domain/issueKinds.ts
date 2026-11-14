/* What raises each kind of issue (docs/design/import/spec.md, section 4; backlog KT, gap 2).

   The kinds and their levels are in domain/problemLevels; this says, once, when the change engine (domain/changeset)
   raises each one, so the spec's page of issue kinds (spec/core/import-issues.md) is made from it and never says it
   differently. Every kind has an entry (the type makes sure). A kind the engine never raises says where it is handled
   instead (`raisedBy`), and has no row in spec/conformance/import.csv; src/spec/conformance.test.ts checks every other
   kind has one.

   Pure: no screen, network or database code. */
import type { IssueKind } from './problemLevels';

export interface KindRule {
  /** When the engine raises it, in a sentence. */
  when: string;
  /** Set when the change engine itself never raises it: what does instead, or that nothing does yet. */
  raisedBy?: string;
}

export const ISSUE_KINDS: Record<IssueKind, KindRule> = {
  // Must fix
  'required-empty': { when: 'A column a new row must have is empty: a goal’s name, owner, Start or Target, Limit or Stages for its type; a person’s name or email.' },
  'not-a-number': { when: 'A number column holds text: “six”, “12 days”, an effect that isn’t a number.' },
  formula: { when: 'A number cell starts with “=”: a formula, not a number.' },
  precision: { when: 'A number has more decimal places than its goal keeps.' },
  'impossible-number': { when: 'A number that can’t be right for its unit: below zero for a count, time, money or share; over 100 for a share.' },
  'unknown-word': { when: 'A word column (Level, Type, Plan, Call, Cause…) holds a word it doesn’t know, with no near miss.' },
  'unknown-ref': { when: 'A person, team or goal that matches nothing here, with no near miss.' },
  'ambiguous-ref': { when: 'A name that two or more people or goals share, so which one is meant can’t be told.' },
  'conflicting-refs': { when: 'Two columns that name the same thing disagree: Owner and Owner ID or Owner email; Feeds into and Feeds into key.' },
  'bad-key': { when: 'A key that isn’t one (“12”), or a key or ID that matches no goal in this cycle (G-999).' },
  duplicate: { when: 'One goal, person, or goal and week, on two rows of one sheet.' },
  'type-unclear': { when: 'A new goal with no Type that fills in none, or more than one, of the type groups (Start and Target; Limit; Stages).' },
  'plan-order': { when: 'A plan that ends before it starts, or a plan week outside the plan; a To before its From.' },
  'stage-format': { when: 'A stage with no name or no week (“Design” with no @week), a week past the cycle, or one name twice.' },
  'week-wrong': { when: 'A check-in for week 0, a week that hasn’t happened, or no week that can be read; a goal year’s week that doesn’t exist.' },
  'checkin-incomplete': { when: 'A check-in the check-in screen would not post: behind plan with no cause or why, off track with no path to green, a better call with no reason.' },
  'cant-change': { when: 'A row changes something that never changes: an existing goal’s Type, a check-in’s week, an email taken away, a goal this file also stops.' },
  'not-allowed': { when: 'The person loading the file may not make the change: a goal they don’t own and aren’t an admin for, people when they aren’t an admin, a goal at a level only its owner may set.' },
  'removal-refused': { when: 'Stop with no reason, Delete on a goal with check-ins, or Left with no one to take over.' },
  'too-long': { when: 'A cell in a module’s own column on Goals longer than it holds: a field’s free text over 80 characters (TG2).', raisedBy: 'Raised by a module’s own Goals columns (src/modules/tags/sheet.ts), never by the core’s columns: its rows are the tags conformance rows (value, text-long).' },
  loop: { when: 'A goal that would feed itself, directly or round a loop of Feeds into links.' },
  // Check
  'near-ref': { when: 'A person, team, goal or stage name within reach of exactly one that is here (one edit under 8 folded characters, two from 8).' },
  'near-word': { when: 'A word column’s word within reach of exactly one of its words or their other spellings.' },
  'near-header': { when: 'A header within reach of exactly one of the sheet’s columns or their other names (“Targett”).' },
  'two-columns': { when: 'Two headers on one sheet read as the same column (“Goal” and “Goal name”): which to read is asked, neither dropped quietly.' },
  'new-team': { when: 'A team that isn’t here, with no near miss, in an admin’s file.', raisedBy: 'Not raised as its own question: an admin settles an unknown team with unknown-ref’s or near-ref’s “Add as a new team” answer.' },
  'same-person': { when: 'A new person whose name is, or is one edit from, someone’s here: the same person, or someone new?' },
  'same-goal': { when: 'A new goal with a name its team already has (or a goal with no team has).' },
  'other-goal': { when: 'A row’s key matches a goal, but its name, owner and team all differ from that goal’s.' },
  'other-workspace': { when: 'The file’s Start here sheet carries another workspace’s id.', raisedBy: 'Asked by the import screen before the engine runs (src/modules/spreadsheets/importPlan.ts): answered “Add its rows as new goals”, the keys and IDs are dropped and the engine sees new rows.' },
  'past-stage': { when: 'A new goal’s stage is due before this week.' },
  'past-plan': { when: 'A new number goal whose plan ended before this week.' },
  'odd-number': { when: 'A number the goal form would ask about: a hundred times the start, a share over 100 when it isn’t one, a typed unit that isn’t the goal’s, a value far from the last.' },
  'plan-question': { when: 'A change to an existing goal’s plan that turns its direction round, or moves its target far.' },
  'no-unit': { when: 'A new number or range goal with no unit, or an existing goal’s unit cleared.' },
  'decimal-comma': { when: 'A number read with a comma as its decimal mark (“1,5” as 1.5).' },
  'replaces-others': { when: 'Ten or more rows replace check-ins other people posted.' },
  'many-admins': { when: 'Three or more people become admins.' },
  'totals-row': { when: 'A row called Total, Totals or Sum with no owner.' },
  'big-removal': { when: 'Five or more rows say Stop, Delete or Left.' },
  'feeds-lower': { when: 'A goal that feeds a goal at a lower level than its own.' },
  'for-someone-else': { when: 'New goals for other people with no State: asked once per file whether they start active or proposed (GE10, decision 16). Set-up never asks; confirm answers active.' },
  'module-value': { when: 'A value a module’s own column on Goals doesn’t hold: a list field’s value that isn’t one of its values (“Stage says “Operate” on 4 rows”), asked once per field and value; an admin may add it to the list, anyone else leaves those cells empty (TG2).', raisedBy: 'Raised by a module’s own Goals columns (src/modules/tags/sheet.ts), never by the core’s columns: its rows are the tags conformance rows (sheet).' },
  // Said
  'by-name': { when: 'An owner or person given by name alone, matched to exactly one person (an email column is exact).' },
  default: { when: 'A cell left empty on a new goal, filled with its default: the owner’s team, or the type read from the columns filled in.' },
  'date-as-week': { when: 'A date in a week column, read as the week of the cycle it falls in.' },
  folded: { when: 'A name matched only once folded (“ci cd” as CI/CD).', raisedBy: 'Not raised: a name that folds equal to one here is read as it, without a word.' },
  'same-name': { when: 'A new goal or person that shares a name with one here, which is allowed: two teams may both have “Reduce latency”; at set-up, the email says who someone is.' },
  'left-alone': { when: 'A row for a goal stopped before (a whole-cycle export carries them): its rows are left as they are.' },
  replaces: { when: 'A check-in row for a goal and week that already has one, which it replaces (fewer than ten of other people’s).' },
  'as-recorded': { when: 'At set-up from another workspace’s export, a past week that today’s plan would ask more of, taken as it was written.' },
  example: { when: 'A row whose Action says Example.', raisedBy: 'Not raised: example rows are counted and skipped (the change set’s `examples`), never an issue.' },
};
