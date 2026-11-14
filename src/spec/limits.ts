/**
 * The limits the stored records hold (backlog KT, gap 7). Faro's database
 * checks some things nothing else in the kit said: a title of at least 3
 * characters, goal decimals 0 to 3 against a metric's 0 to 4, a review every
 * 1 to 13 weeks. `spec/core/schema.sql` is a dump not to copy, so each limit is
 * said here in words and shown on its rule's page; `wrongLimits` fails the spec
 * test when a check constraint on a record the kit describes is in neither list.
 */

export interface Limit {
  /** The constraint's name in spec/core/schema.sql. */
  constraint: string;
  /** Text the constraint's SQL contains, so a changed number fails the test. */
  holds: string[];
  /** The rule whose page lists it (an id in src/spec/rules.ts). */
  rule: string;
  /** The limit, in words. */
  words: string;
  /** Where the app's code holds the same limit too, `file#text it contains` (checked). Absent: not traced to the code. */
  code?: string;
}

export const LIMITS: Limit[] = [
  // Check-ins
  { constraint: 'okr_check_ins_week_check', holds: ['week >= 1'], rule: 'check-in', words: 'A check-in’s week is 1 or later.' },
  { constraint: 'okr_check_ins_check1', holds: ['>= 10'], rule: 'check-in', words: 'A status greener than the calculated one has a reason of at least 10 characters (spaces at either end not counted).', code: 'src/domain/checkin.ts#MIN_REASON' },
  { constraint: 'okr_check_ins_way_back', holds: ['>= 8', 'ptg_by_week'], rule: 'check-in', words: 'At risk or Off track has a path to green of at least 8 characters, and either a state other than “a plan” or a back-on-plan week after the check-in’s week.', code: 'src/domain/checkin.ts#MIN_PATH' },
  // Years
  { constraint: 'okr_cycles_weeks_check', holds: ['weeks >= 1', 'weeks <= 53'], rule: 'years-and-weeks', words: 'A goal year has 1 to 53 weeks.' },
  { constraint: 'okr_cycles_review_day_check', holds: ['review_day >= 0', 'review_day <= 6'], rule: 'years-and-weeks', words: 'A year’s review day is a day of the week, 0 to 6 (Monday is 0).' },
  { constraint: 'okr_cycles_check_in_weeks_ok', holds: ['check_in_weeks', 'ARRAY[0, 1, 2, 4]'], rule: 'years-and-weeks', words: 'A year’s check-in rhythm is 1 (every week) or 0 (no set rhythm); 2 and 4 are kept for later. (The app offers 1 and 0.)' },
  // Goals
  { constraint: 'okr_goals_title_check', holds: ['>= 3'], rule: 'goal-entry', words: 'A goal’s title has at least 3 characters (spaces at either end not counted).', code: 'src/domain/thresholds.ts#MIN_NAME' },
  { constraint: 'okr_goals_decimals_check', holds: ['decimals >= 0', 'decimals <= 3'], rule: 'goal-entry', words: 'A goal keeps 0 to 3 decimal places. (A metric may keep 4: a goal measured by it keeps fewer, and is warned.)' },
  { constraint: 'okr_goals_metric_plan', holds: ["kind <> 'metric'", 'plan_start <> plan_target', 'plan_target IS NULL', 'proposed_at IS NOT NULL'], rule: 'goal-entry', words: 'A number goal has a start, a target and a plan shape, and its start and target differ; only a proposed one may have no target yet.' },
  { constraint: 'okr_goals_check1', holds: ["kind <> 'range'", 'range_margin IS NOT NULL'], rule: 'goal-entry', words: 'A range goal has a bound (at most, at least or between), a limit and a warning margin.' },
  { constraint: 'okr_goals_range_lower_ok', holds: ["range_bound = 'between'", 'range_lower < range_limit', 'range_lower IS NULL'], rule: 'goal-entry', words: 'A range goal kept between two numbers has a lower number below its limit; any other range goal has no lower number.' },
  { constraint: 'okr_goals_range_margin_check', holds: ['range_margin >='], rule: 'goal-entry', words: 'A range goal’s warning margin is 0 or more.' },
  { constraint: 'okr_goals_check2', holds: ['NOT headline', 'parent_id IS NULL'], rule: 'goal-entry', words: 'A headline goal feeds nothing.' },
  { constraint: 'okr_goals_plan_from_week_check', holds: ['plan_from_week >=', '104'], rule: 'weeks-and-plans', words: 'A plan’s first week is between −104 and 104 (a plan carried from an earlier year starts before week 0).' },
  { constraint: 'okr_goals_baseline_period_len', holds: ['<= 60'], rule: 'goal-entry', words: 'The period a goal’s baseline covers has at most 60 characters.' },
  { constraint: 'okr_goals_guards_shape', holds: ['jsonb_array_length(guards) <= 5'], rule: 'status', words: 'A goal names at most five guardrails.' },
  { constraint: 'okr_goals_baseline_whole', holds: ['baseline_value IS NOT NULL', 'baseline_provisional'], rule: 'goal-entry', words: 'A baseline’s period and its “provisional” flag only go with a baseline figure.' },
  { constraint: 'okr_goals_plan_end_week_check', holds: ['plan_end_week >= 1', 'plan_end_week <= 104'], rule: 'weeks-and-plans', words: 'A plan’s due week, when it has one, is 1 to 104.' },
  { constraint: 'okr_stages_due_week_check', holds: ['due_week >= 1'], rule: 'weeks-and-plans', words: 'A milestone stage is due in week 1 or later.' },
  { constraint: 'okr_goals_key_check', holds: ['^G-[1-9][0-9]*$'], rule: 'numbers-and-names', words: 'A goal’s key is “G-” and a whole number from 1, with no leading zero (G-1, G-27).', code: 'src/domain/goalKey.ts#nextKey' },
  { constraint: 'okr_goal_keys_last_check', holds: ['last >= 0'], rule: 'numbers-and-names', words: 'Keys are given from one counter per workspace that only goes up, starting after 0, so a key is never given twice, even after its goal is removed. Give them in one place, the server.' },
  { constraint: 'okr_goals_proposed_ok', holds: ['proposed_at IS NULL', 'stopped_at IS NULL'], rule: 'proposed', words: 'A proposed goal isn’t stopped, and only a proposed goal names who proposed it.' },
  { constraint: 'okr_goals_stop_reason_check', holds: ['stopped_at IS NULL', '<= 2000'], rule: 'goal-act', words: 'A stopped goal has a reason of 1 to 2,000 characters. (The app asks for at least 10.)', code: 'src/domain/thresholds.ts#MIN_STOP_REASON' },
  // Asks and reviews
  { constraint: 'okr_requests_ask_check', holds: ['>= 1', '<= 2000'], rule: 'goal-act', words: 'An ask says something: 1 to 2,000 characters.' },
  { constraint: 'okr_requests_check', holds: ["status <> 'answered'", 'answered_at IS NOT NULL'], rule: 'goal-act', words: 'An answered ask has its answer and when it was answered.' },
  { constraint: 'okr_requests_due_week_check', holds: ['due_week >= 0', 'due_week <= 60'], rule: 'goal-act', words: 'An ask’s due week, when it has one, is 0 to 60.' },
  { constraint: 'okr_requests_goal_ids_check', holds: ['cardinality(goal_ids) >= 1'], rule: 'goal-act', words: 'An ask is about at least one goal.' },
  { constraint: 'okr_decisions_due_week_check', holds: ['due_week >= 0', 'due_week <= 53'], rule: 'review-decide', words: 'A decision’s due week, when it has one, is 0 to 53.' },
  { constraint: 'okr_reviews_every_weeks_check', holds: ['every_weeks >= 1', 'every_weeks <= 13'], rule: 'review-decide', words: 'A review is held every 1 to 13 weeks. (Its set-up screen offers 1, 2 or 4; the rule allows any of 1 to 13.)', code: 'src/domain/actions.ts#Hold it every 1 to 13 weeks' },
  { constraint: 'okr_reviews_weekday_check', holds: ['weekday >= 0', 'weekday <= 6'], rule: 'review-decide', words: 'A review’s day is a day of the week, 0 to 6. (The app’s rule asks for Monday to Friday, 0 to 4.)', code: 'src/domain/actions.ts#Pick a weekday, Monday to Friday' },
  { constraint: 'okr_reviews_name_check', holds: ['>= 1'], rule: 'review-decide', words: 'A review has a name.' },
  { constraint: 'okr_retros_learned_check', holds: ['>= 3'], rule: 'year-end', words: 'A wrap-up says what was learned in at least 3 characters. (The app asks for at least 10.)', code: 'src/domain/actions.ts#MIN_LEARNED' },
  // People, views, the workspace
  { constraint: 'okr_people_email_check', holds: ['lower(btrim(email))', '<= 254'], rule: 'directory', words: 'A person’s email, when they have one, is lower case with no spaces at either end, 3 to 254 characters, of the form name@place.domain.' },
  { constraint: 'okr_views_name_check', holds: ['>= 1', '<= 80'], rule: 'finding', words: 'A saved view’s name has 1 to 80 characters.', code: 'src/domain/actions.ts#slice(0, 80)' },
  { constraint: 'okr_workspaces_name_check', holds: ['>= 1'], rule: 'workspace', words: 'A workspace has a name. (The app asks for 3 to 80 characters.)', code: 'src/domain/thresholds.ts#MAX_WORKSPACE_NAME' },
  // The metric library (a module)
  { constraint: 'okr_metrics_gaming_len', holds: ['<= 500'], rule: 'metric-defined', words: 'How a metric could be gamed has at most 500 characters.' },
  { constraint: 'okr_metrics_parent_not_self', holds: ['parent_id <> id'], rule: 'metric-defined', words: 'A metric is never its own parent.' },
  { constraint: 'goal_fields_name_check', holds: ['>= 1', '<= 40'], rule: 'tags-fields', words: 'A field’s name has 1 to 40 characters (spaces at either end not counted).', code: 'src/modules/tags/rules.ts#FIELD_LIMITS' },
  { constraint: 'goal_fields_options_check', holds: ["jsonb_typeof(options) = 'array'", 'jsonb_array_length(options) <= 20', 'jsonb_array_length(options) >= 1'], rule: 'tags-fields', words: 'A list field has 1 to 20 values; a free-text field has none. (Each value’s length, and that none is there twice, are the rule’s: the database can’t check a list’s items one by one.)', code: 'src/modules/tags/rules.ts#FIELD_LIMITS' },
  { constraint: 'goal_fields_text_no_options', holds: ["kind = 'list'", 'jsonb_array_length(options) = 0'], rule: 'tags-fields', words: 'A free-text field has no values.', code: 'src/modules/tags/rules.ts#fieldProblem' },
  { constraint: 'person_prefs_key_check', holds: ["'proposals'"], rule: 'proposed', words: 'A preference kept on the server for a person is one of the listed keys: today only what they opened and put off among proposed goals. Everything else a person chose stays in their browser.' },
  { constraint: 'person_prefs_value_check', holds: ['<= 16384'], rule: 'proposed', words: 'A preference kept on the server for a person is at most 16 KB.' },
  { constraint: 'goal_field_values_value_check', holds: ['length(value) <= 80'], rule: 'tags-fields', words: 'A goal’s value for a field has at most 80 characters; empty means not set.', code: 'src/modules/tags/rules.ts#FIELD_LIMITS' },
  { constraint: 'goal_field_values_one', holds: ['id = ', 'goal_id', 'field_id'], rule: 'tags-fields', words: 'A goal has one value per field: the value’s id is the goal’s id and the field’s, joined by a colon.' },
  { constraint: 'okr_metrics_name_check', holds: ['>= 1', '<= 120'], rule: 'metric-defined', words: 'A metric’s name has 1 to 120 characters.', code: 'src/modules/metrics/rules.ts#METRIC_LIMITS' },
  { constraint: 'okr_metrics_unit_check', holds: ['>= 1', '<= 20'], rule: 'metric-defined', words: 'A metric’s unit has 1 to 20 characters.', code: 'src/modules/metrics/rules.ts#METRIC_LIMITS' },
  { constraint: 'okr_metrics_decimals_check', holds: ['decimals >= 0', 'decimals <= 4'], rule: 'metric-defined', words: 'A metric keeps 0 to 4 decimal places (a goal keeps at most 3).', code: 'src/modules/metrics/rules.ts#METRIC_LIMITS' },
  { constraint: 'okr_metrics_meaning_check', holds: ['<= 2000'], rule: 'metric-defined', words: 'A metric’s meaning, source, source owner and caveats each have at most 2,000 characters.', code: 'src/modules/metrics/rules.ts#METRIC_LIMITS' },
  { constraint: 'okr_metrics_source_check', holds: ['<= 2000'], rule: 'metric-defined', words: '', code: 'src/modules/metrics/rules.ts#METRIC_LIMITS' },
  { constraint: 'okr_metrics_source_owner_check', holds: ['<= 2000'], rule: 'metric-defined', words: '', code: 'src/modules/metrics/rules.ts#METRIC_LIMITS' },
  { constraint: 'okr_metrics_caveats_check', holds: ['<= 2000'], rule: 'metric-defined', words: '', code: 'src/modules/metrics/rules.ts#METRIC_LIMITS' },
  { constraint: 'okr_goal_metrics_part_len', holds: ['<= 60'], rule: 'metric-measured-by', words: 'The part of a metric a goal is measured by (“Which part”) has at most 60 characters; empty means all of it.' },
  { constraint: 'okr_metrics_measurement_ok', holds: ["'measured'", "'partly'", "'gap'"], rule: 'metric-defined', words: 'A metric is measured, partly measured or a gap (not measured yet); measured unless someone says otherwise.' },
  { constraint: 'okr_metrics_measurement_note_len', holds: ['<= 300'], rule: 'metric-defined', words: 'What is missing from a metric’s measurement has at most 300 characters.' },
  { constraint: 'okr_metrics_retired_why_len', holds: ['<= 300'], rule: 'metric-care', words: 'Why a metric was retired has at most 300 characters.' },
];

/** Check constraints that aren't a rule for the rebuild, and why. A table name stands for every constraint on it. */
export const NOT_LIMITS: Record<string, string> = {
  okr_changes_undo_check: 'How Faro stores an undo; the change log’s shape is in the data model.',
  okr_check_ins_reading_ok: 'How Faro stores a check-in’s reading (one jsonb value with its source, value and time); NR1 gives the check-in a `reading` (readings spec, rule 2).',
  okr_metrics_marks_array: 'How Faro stores a metric’s marks (a list); the data model gives `marks` as a list of changes.',
  okr_goal_metrics_check: 'How Faro stores a goal’s metric beside the goal (one row per goal); the data model has `metricId` on the goal.',
  okr_markups: 'Markups go to the builders’ inbox, which R1 replaces (MARKUP-INBOX is tagged replace).',
  okr_feedback: 'Feedback is kept per workspace by R5 (FEEDBACK-INBOX is tagged replace).',
  okr_builders: 'The builders are a directory group in the internal app (R1).',
  okr_research_notes: 'The research hub is the demo’s own (RESEARCH is tagged demo only).',
  okr_telemetry_spans: 'Telemetry in the app’s own database is replaced by the platform’s observability (R9; the TELEMETRY requirements are tagged replace).',
  okr_telemetry_logs: 'As the spans: R9.',
  okr_telemetry_metrics: 'As the spans: R9.',
  okr_telemetry_daily: 'As the spans: R9.',
};

/** Every check constraint in the dump, by name and table, with its SQL. */
export function checkConstraints(schemaSql: string): { name: string; table: string; sql: string }[] {
  const out: { name: string; table: string; sql: string }[] = [];
  for (const t of schemaSql.matchAll(/create table (?:\w+\.)?(\w+) \(([\s\S]*?)\n\);/gi)) {
    const body = t[2]!;
    const parts = body.split(/\n\s*constraint /i).slice(1);
    for (const p of parts) {
      const m = /^(\w+) CHECK ([\s\S]*?),?\s*$/.exec(p);
      if (m) out.push({ name: m[1]!, table: t[1]!, sql: m[2]!.replace(/::\w+/g, '') });
    }
  }
  return out;
}

/** What's wrong between LIMITS and the dump: a constraint in neither list, a limit that names none, or text it no longer holds. */
export function wrongLimits(schemaSql: string, ruleIds: string[], readFile: (path: string) => string): string[] {
  const all = checkConstraints(schemaSql);
  const isEnum = (sql: string) => /^\(*\(?\w+ = ANY \(ARRAY\[[^\]]*\]\)\)*$/.test(sql.trim()) || /^\(*\(\w+ IS NULL\) OR \(\w+ = ANY \(ARRAY\[[^\]]*\]\)\)\)*$/.test(sql.trim());
  const out: string[] = [];
  for (const c of all) {
    if (isEnum(c.sql) || NOT_LIMITS[c.name] || NOT_LIMITS[c.table]) continue;
    if (!LIMITS.some((l) => l.constraint === c.name)) out.push(`${c.name} (${c.table}) is in neither LIMITS nor NOT_LIMITS (src/spec/limits.ts)`);
  }
  for (const l of LIMITS) {
    const c = all.find((x) => x.name === l.constraint);
    if (!c) { out.push(`${l.constraint}: no such check constraint in spec/core/schema.sql`); continue; }
    for (const h of l.holds) if (!c.sql.includes(h)) out.push(`${l.constraint}: its SQL no longer holds “${h}”`);
    if (!ruleIds.includes(l.rule)) out.push(`${l.constraint}: no rule ${l.rule}`);
    if (l.code) {
      const [file, name] = l.code.split('#') as [string, string];
      if (!readFile(file).includes(name)) out.push(`${l.constraint}: ${file} no longer says ${name}`);
    }
  }
  return out;
}

/** A rule page's section on the limits its records hold (none: no section). */
export function limitsSection(ruleId: string): string[] {
  const mine = LIMITS.filter((l) => l.rule === ruleId && l.words);
  if (!mine.length) return [];
  return ['## Limits the records hold', '',
    'Faro’s database holds these as well as the rule; a rebuild holds them wherever it stores the records. The constraint names are in `spec/core/schema.sql`, which is for reading, not copying.', '',
    ...mine.map((l) => `- ${l.words} (\`${l.constraint}\`${l.code ? `; the code holds it too, in \`${l.code.split('#')[0]}\`` : ''})`), ''];
}
