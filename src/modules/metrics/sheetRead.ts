/* The Metrics sheet read back (MI, round 2's MT6; docs/design/metrics-2/spec.md 3.1, 2.9 and 3.4): the module's reader
   for its declared sheet (domain/records SheetReader), run by the change engine (domain/changeset) in the same pass as
   every other sheet, so a file's metrics get the same dry run, levels, grouped questions, "Leave these rows out", counts,
   save and one Undo as its goals.

   It restates no rule. What a metric needs and its words are rules.ts's (`metricFrom`, `metricProblems`, `saveMetric`);
   the questions a name, a unit or a meaning ask are rule 1's (`metricChecks`, rulesDefine.ts); what kind of change a
   save is, retiring and bringing back are rules 3 and 5's (`changeKinds`, `saveMetricChange`, `retireMetric`,
   `unretireMetric`, rulesChange.ts). This file only reads cells, finds each row's metric, and says each rule's answer
   where the row is, with the engine's kinds and levels.

   How a row finds its metric: by ID (retired metrics included; removed ones never), else by Metric (any case, spaces
   trimmed), else it is a new metric. A row whose ID matches and whose name differs is a rename. Columns a row leaves out
   keep what the metric says; worked-out columns (Still to say, Retired on, Measures, Goal keys) are never read.

   Loaded with the import, not with the first download (records.ts declares it lazily). Pure, like the rules. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import { diffFields } from '../../domain/changes';
import type { Commit } from '../../domain/commit';
import { applyModuleRows, type ModuleRows, type SheetItem, type SheetRead, type SheetReadContext } from '../../domain/records';
import type { Rec } from '../../domain/sheets';
import type { Change, Person, Snapshot } from '../../domain/types';
import { fold } from '../../domain/problemLevels';
import { checkReads } from './checkReads';
import { canEditMetric, METRIC_LIMITS, metricFields, metricFrom, metricProblems, metricRows, metricsOf, MODULE, METRICS_KEY, saveMetric, type Metric, type MetricInput } from './rules';
import { aimingWrong, changeKinds, linkedGoals, retireMetric, saveMetricChange, unretireMetric } from './rulesChange';
import { metricChecks } from './rulesDefine';
import { DIRECTION_WORDS, METRIC_ACTION_WORDS, REFRESH_WORDS } from './sheetWords';

const NOUN: [string, string] = ['metric', 'metrics'];
const has = (r: Rec, k: string) => Object.prototype.hasOwnProperty.call(r, k);
const val = (r: Rec, k: string) => (r[k] ?? '').trim();
const rowOf = (r: Rec, i: number) => Number(r.__row ?? i + 2);
const blankRow = (r: Rec) => Object.entries(r).every(([k, v]) => k === '__row' || !String(v).trim());
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const goalsWord = (n: number) => plural(n, 'goal');

/** The column a rule's sentence is about (metricProblems, saveMetric, saveMetricChange), and its kind. */
function columnOf(message: string): { column: string; kind: 'required-empty' | 'text-length' | 'duplicate' | 'not-a-number' | 'unknown-ref' | 'cant-change' | 'not-allowed' } {
  const kind = /^Only .* can /.test(message) ? 'not-allowed' : /already a metric called/.test(message) ? 'duplicate' : /^(Give|Say)\b/.test(message) ? 'required-empty' : /^Keep the/.test(message) ? 'text-length' : /^Decimals/.test(message) ? 'not-a-number' : /owner isn’t in/.test(message) ? 'unknown-ref' : 'cant-change';
  const column = /reason|Say why/i.test(message) ? 'Reason' : /retired|retire/i.test(message) ? 'Action' : /\bname\b|called/.test(message) ? 'Metric' : /\bunit\b/.test(message) ? 'Unit' : /which way|direction/i.test(message) ? 'Direction' : /^Decimals/.test(message) ? 'Decimals' : /owner isn’t/.test(message) ? 'Owner email' : /meaning/.test(message) ? 'Meaning' : /source’s owner/.test(message) ? 'Source owner' : /source/.test(message) ? 'Source' : /caveats/.test(message) ? 'Caveats' : 'Metric';
  return { column, kind };
}

/** A person in the workspace (the file's new people included) by an email, then by a name only one person has. */
function personBy(people: readonly Person[], cell: string): { one?: Person; many?: number } {
  const t = cell.trim().toLowerCase();
  const byEmail = people.find((p) => (p.email ?? '').trim().toLowerCase() === t);
  if (byEmail) return { one: byEmail };
  const named = people.filter((p) => fold(p.name) === fold(cell.replace(/\s*\(left\)$/i, '')));
  return named.length === 1 ? { one: named[0] } : named.length ? { many: named.length } : {};
}

interface Row { r: Rec; row: number; name: string; id: string; before: Metric | null; action: 'retire' | 'back' | null }

/** The Metrics sheet's rows read through the metric library's rules: what they add and change, with every problem raised. */
export default function readMetricsSheet(rows: Rec[], c: SheetReadContext): SheetRead {
  const { x } = c;
  const fullAtStart = x.full ?? x.snapshot;
  // The library as the file has changed it so far: each row sees the rows above it.
  let snap: Snapshot = x.snapshot;
  let full: Snapshot = fullAtStart;
  const xNow = (): ActionContext => ({ ...x, snapshot: snap, full });
  const apply = (cm: Commit) => {
    snap = { ...snap, modules: applyModuleRows(snap.modules, cm.modules) ?? {} };
    full = { ...full, modules: applyModuleRows(full.modules, cm.modules) ?? {} };
  };
  const items: SheetItem[] = [];
  const changes: Change[] = [];
  const touched = new Map<string, Metric | null>();
  let unchanged = 0, examples = 0;
  const bad = new Set<number>();
  const must = (kind: Parameters<SheetReadContext['raise']>[0], row: number, name: string, message: string, column: string, found?: string) => {
    bad.add(row);
    c.raise(kind, row, name, message, { column, ...(found ? { found } : {}) });
  };
  const refused = (row: number, name: string, e: unknown) => {
    if (!(e instanceof NotAllowed)) throw e;
    const { column, kind } = columnOf(e.message);
    must(kind, row, name, e.message, column);
  };
  const kept = (cm: Commit | null, row: number, name: string, does: SheetItem['does']) => {
    if (!cm) return;
    for (const m of (cm.modules?.[MODULE]?.[METRICS_KEY] ?? []) as Metric[]) if (!touched.has(m.id)) touched.set(m.id, metricsOf(fullAtStart).find((v) => v.id === m.id) ?? null);
    apply(cm);
    changes.push(...cm.changes);
    const head = cm.changes[0]!;
    items.push({ row, name, does, summary: head.summary, diffs: head.diffs, noun: NOUN });
  };

  const known = metricsOf(fullAtStart).filter((m) => !m.removedAt);
  /* Rule 1's questions: a name against every metric, the file's rows above it included ("Deploy frequncy" two rows after
     "Deploy frequency"); a unit against the units in use before the file, so a spelling the file repeats on every row is
     one question for all of them, not answered by its own first row. */
  const unitReads = checkReads(x.snapshot);
  const questions = (next: Metric, was: Metric | null, reads: ReturnType<typeof checkReads>) => [
    ...metricChecks(next, was, reads).filter((q) => q.field !== 'unit'),
    ...metricChecks(next, was, unitReads).filter((q) => q.field === 'unit'),
  ];
  const list = rows.map((r, i) => ({ r, row: rowOf(r, i) })).filter(({ r }) => !blankRow(r));

  /* ---------- each row's metric, and its Action ---------- */
  const read: Row[] = [];
  for (const { r, row } of list) {
    const action = has(r, 'action') ? c.readWord(METRIC_ACTION_WORDS, val(r, 'action'), row, val(r, 'metric') || val(r, 'id')) : null;
    if (action === 'example') { examples++; continue; }
    const id = val(r, 'id');
    const name = val(r, 'metric');
    let before: Metric | null = null;
    if (id) {
      before = known.find((m) => m.id === id) ?? null;
      if (!before) { must('bad-key', row, name || id, `ID “${id}” isn’t a metric in ${c.workspace}. Leave ID empty to add a new metric, or use an ID from an export.`, 'ID', id); continue; }
    } else if (name) before = known.find((m) => m.name.trim().toLowerCase() === name.toLowerCase()) ?? null;
    if (action === undefined) bad.add(row);
    read.push({ r, row, name: name || before?.name || '', id, before, action: action === undefined ? null : action });
  }
  // The same ID, or the same name, on two rows (3.1): a metric is said once in a file.
  const twice = (key: (x: Row) => string, column: string, words: (a: number, b: number, found: string) => string) => {
    const by = new Map<string, Row[]>();
    for (const x of read) { const k = key(x); if (k) by.set(k, [...(by.get(k) ?? []), x]); }
    for (const same of by.values()) if (same.length > 1) for (const x of same) must('duplicate', x.row, x.name, words(same[0]!.row, same[1]!.row, column === 'ID' ? x.id : val(x.r, 'metric')), column, column === 'ID' ? x.id : val(x.r, 'metric'));
  };
  twice((x) => x.id, 'ID', (a, b) => `Rows ${a} and ${b} have the same ID.`);
  twice((x) => (val(x.r, 'metric') && !(x.id && x.before && fold(x.before.name) === fold(val(x.r, 'metric'))) ? fold(val(x.r, 'metric')) : x.before && !x.id ? `id:${x.before.id}` : ''), 'Metric', (a, b, found) => `Rows ${a} and ${b} are both called “${found}”. A metric’s name is used once.`);

  // New rows that name no owner: whoever loads the file owns them, said once when there are two or more (3.1).
  const ownerless = read.filter((x) => !x.before && !bad.has(x.row) && !val(x.r, 'owner email') && !val(x.r, 'owner'));
  const retiring: { x: Row; why: string }[] = [];

  /* ---------- what each row says, through the library's rules ---------- */
  for (const it of read) {
    const { r, row } = it;
    if (bad.has(row)) continue;
    let before = it.before;
    const people = snap.people;
    // The cells as a metric's fields: only the columns the row has; an empty optional cell clears it.
    const input: MetricInput = {};
    if (has(r, 'metric') && (val(r, 'metric') || !before)) input.name = val(r, 'metric');
    if (has(r, 'meaning')) input.meaning = val(r, 'meaning');
    if (has(r, 'unit') && (val(r, 'unit') || !before)) input.unit = val(r, 'unit');
    if (has(r, 'source')) input.source = val(r, 'source');
    if (has(r, 'source owner')) input.sourceOwner = val(r, 'source owner');
    if (has(r, 'caveats')) input.caveats = val(r, 'caveats');
    if (has(r, 'decimals') && val(r, 'decimals')) {
      const d = val(r, 'decimals');
      const n = /^\d+(\.0+)?$/.test(d) ? Number(d) : NaN;
      if (!Number.isInteger(n) || n < 0 || n > METRIC_LIMITS.decimals) { must('not-a-number', row, it.name, `Decimals says “${d}”. Use a whole number from 0 to ${METRIC_LIMITS.decimals}.`, 'Decimals', d); continue; }
      input.decimals = n;
    }
    if (has(r, 'direction') && (val(r, 'direction') || !before)) {
      const d = c.readWord(DIRECTION_WORDS, val(r, 'direction'), row, it.name);
      if (d === undefined) { bad.add(row); continue; }
      if (d) input.direction = d;
    }
    if (has(r, 'refresh')) {
      const f = c.readWord(REFRESH_WORDS, val(r, 'refresh'), row, it.name);
      if (f === undefined) { bad.add(row); continue; }
      input.refresh = f;
    }
    // Its owner: by Owner email, else by Owner (a name only one person has); neither keeps it (a new one: whoever loads it).
    const email = val(r, 'owner email');
    const ownerName = email ? '' : val(r, 'owner');
    if (email || ownerName) {
      const col = email ? 'Owner email' : 'Owner';
      const cell = email || ownerName;
      const answer = c.answerOf('unknown-ref', col, cell);
      const got = answer?.choice === 'choose' && answer.value ? personBy(people, answer.value) : personBy(people, cell);
      if (got.many) { must('ambiguous-ref', row, it.name, `Owner “${cell}” matches ${got.many} people. Give the Owner email.`, col, cell); continue; }
      if (!got.one) {
        c.raise('unknown-ref', row, it.name, `${col} “${cell}” isn’t a person in ${c.workspace}. Add them on the People sheet, or leave it empty to own it yourself.`, { column: col, found: cell, answers: [{ choice: 'choose', label: 'Choose a person', needsValue: true }] });
        bad.add(row);
        continue;
      }
      if (got.one.id !== before?.ownerId && (got.one.leftAt || got.one.removedAt)) { must('unknown-ref', row, it.name, `${got.one.name} has left ${c.workspace}. Choose someone else.`, col, cell); continue; }
      input.ownerId = got.one.id;
    } else if (!before && ownerless.length >= 2) {
      const k = ownerless.length;
      if (c.ask('no-owner', row, it.name, `${k} rows give no Owner email. You will own those ${k} metrics.`, { column: 'Owner email', answers: [{ choice: 'right', label: 'I’ll own them' }, { choice: 'leave', label: `Leave these ${k} rows out` }] }) === 'leave') continue;
    }
    const reason = val(r, 'reason');
    const reads = checkReads(snap);

    /* A new metric: rule 1's needs, then its questions, then saveMetric. */
    if (!before) {
      if (it.action === 'retire' || it.action === 'back') { must('cant-change', row, it.name, it.action === 'back' ? `Bring back: ${it.name || 'this row'} isn’t a metric here yet, so it isn’t retired.` : `Retire: ${it.name || 'this row'} isn’t a metric here yet. Leave Action empty to add it.`, 'Action', val(r, 'action')); continue; }
      const m = metricFrom(input, null, xNow());
      const problems = metricProblems(m, snap);
      if (problems.length) { for (const p of problems) { const { column, kind } = columnOf(p); must(kind, row, it.name, p, column, column === 'Metric' && kind === 'duplicate' ? m.name : undefined); } continue; }
      let as: Metric | null = null;
      let left = false;
      for (const q of questions(m, null, reads)) {
        if (q.field === 'name') {
          const other = q.answers[0]!.choice.slice(4);
          const otherName = reads.metrics.find((v) => v.id === other)?.name ?? '';
          const a = c.ask('near-ref', row, m.name, q.words, { column: 'Metric', found: m.name, suggest: otherName, title: q.words, answers: [{ choice: `use:${other}`, label: `Change “${otherName}” with this row` }, { choice: 'keep', label: `Add “${m.name}” as a new metric` }] });
          if (a === 'leave') left = true;
          else if (a && a.choice === `use:${other}`) as = metricsOf(snap).find((v) => v.id === other) ?? null;
        } else if (q.field === 'unit') {
          const use = /“([^”]+)”/.exec(q.words)![1]!;
          const a = c.ask('near-word', row, m.name, q.words, { column: 'Unit', found: m.unit, suggest: use, answers: [{ choice: 'use', label: `Use “${use}”` }, { choice: 'keep', label: `Keep “${m.unit}”` }] });
          if (a === 'leave') left = true;
          else if (a?.choice === 'use') input.unit = use;
        } else if (c.ask('out-of-what', row, m.name, q.words, { column: 'Meaning', answers: [{ choice: 'as-written', label: 'It’s right as written' }, { choice: 'leave', label: 'Leave these rows out' }] }) === 'leave') left = true;
      }
      if (left) continue;
      if (as) { before = as; delete input.name; }
      else {
        try { kept(saveMetric(xNow(), input).commit, row, m.name, 'added'); } catch (e) { refused(row, m.name, e); }
        continue;
      }
    }

    /* A metric here: bring it back, change it with rule 3's questions, then (after every row) retire it. */
    const name = before.name;
    if (it.action === 'back') {
      if (!before.retiredAt) { must('cant-change', row, name, `Bring back: ${name} isn’t retired.`, 'Action', val(r, 'action')); continue; }
      try { const cm = unretireMetric(xNow(), before.id); kept(cm, row, name, 'back'); before = metricsOf(snap).find((v) => v.id === before!.id)!; } catch (e) { refused(row, name, e); continue; }
    }
    const after = metricFrom(input, before, xNow());
    const diffs = diffFields(metricFields(before, snap), metricFields(after, snap));
    if (diffs.length) {
      if (!canEditMetric(x.actor, before)) { must('not-allowed', row, name, `Only ${people.find((p) => p.id === before!.ownerId)?.name ?? 'the metric’s owner'} or an admin can change ${name}.`, diffs[0]!.field === 'Name' ? 'Metric' : diffs[0]!.field); continue; }
      if (before.retiredAt) { must('cant-change', row, name, `“${name}” is retired. Bring it back before changing it: say Bring back in Action.`, 'Action'); continue; }
      const problems = metricProblems(after, snap);
      if (problems.length) { for (const p of problems) { const { column, kind } = columnOf(p); must(kind, row, name, p, column); } continue; }
      const linked = linkedGoals(full, before.id);
      const n = linked.length;
      const kinds = changeKinds(before, after, linked);
      if (kinds.includes('scale')) { must('cant-change', row, name, `It is in ${before.unit} and ${goalsWord(n)} ${n === 1 ? 'is' : 'are'} measured by it. A file can’t change its unit: change it on the metric’s page, where its goals are shown first.`, 'Unit', after.unit); continue; }
      let left = false;
      for (const q of questions(after, before, reads)) {
        if (q.field === 'unit') {
          const use = /“([^”]+)”/.exec(q.words)![1]!;
          const a = c.ask('near-word', row, name, q.words, { column: 'Unit', found: after.unit, suggest: use, answers: [{ choice: 'use', label: `Use “${use}”` }, { choice: 'keep', label: `Keep “${after.unit}”` }] });
          if (a === 'leave') left = true; else if (a?.choice === 'use') input.unit = use;
        } else if (q.field === 'name') {
          if (c.ask('near-ref', row, after.name, q.words, { column: 'Metric', found: after.name, suggest: /“([^”]+)”\s*\(|now called “([^”]+)”/.exec(q.words)?.slice(1).find(Boolean) ?? '', title: q.words, answers: [{ choice: 'keep', label: `Rename it “${after.name}”` }, { choice: 'leave', label: 'Leave this row out' }] }) === 'leave') left = true;
        } else if (c.ask('out-of-what', row, name, q.words, { column: 'Meaning', answers: [{ choice: 'as-written', label: 'It’s right as written' }, { choice: 'leave', label: 'Leave these rows out' }] }) === 'leave') left = true;
      }
      // Rule 3's questions, as a file asks them (3.1's Check column).
      let comparable: boolean | undefined;
      let needsWhy = false;
      if (kinds.includes('meaning')) {
        const column = before.meaning.trim() !== after.meaning.trim() ? 'Meaning' : 'Source';
        const a = c.ask('changes-goals', row, name, `${name}: ${goalsWord(n)} ${n === 1 ? 'is' : 'are'} measured by it. Is it still the same number?`, { column, found: name, title: `${name}: ${goalsWord(n)} ${n === 1 ? 'is' : 'are'} measured by it. Is it still the same number?`, answers: [{ choice: 'same', label: 'Same number, better words' }, { choice: 'changes', label: 'The number changes from this week' }, { choice: 'leave', label: 'Leave this row out' }] });
        if (a === 'leave') left = true;
        comparable = a && a !== 'leave' ? a.choice !== 'changes' : true;
        if (a && a !== 'leave' && a.choice === 'changes') needsWhy = true;
      }
      if (kinds.includes('direction')) {
        const k = aimingWrong(linked, after.direction).length;
        if (k && c.ask('changes-goals', row, name, `${name}: ${k} of its ${goalsWord(n)} would aim the wrong way.`, { column: 'Direction', found: name, title: `${name}: ${k} of its ${goalsWord(n)} would aim the wrong way.`, answers: [{ choice: 'change', label: 'Change it' }, { choice: 'leave', label: 'Leave this row out' }] }) === 'leave') left = true;
        needsWhy = true;
      }
      if (kinds.includes('decimals')) {
        const k = linked.filter((g) => g.decimals > after.decimals).length;
        if (c.ask('changes-goals', row, name, `${goalsWord(k)} show${k === 1 ? 's' : ''} more decimal places than ${name} will.`, { column: 'Decimals', found: name, title: `${goalsWord(k)} show${k === 1 ? 's' : ''} more decimal places than ${name} will.`, answers: [{ choice: 'change', label: 'Change it' }, { choice: 'leave', label: 'Leave this row out' }] }) === 'leave') left = true;
      }
      if (left) continue;
      if (needsWhy && !reason) { must('required-empty', row, name, `Say why, in the Reason column: ${goalsWord(n)} measured by ${name} will show it.`, 'Reason'); continue; }
      try { kept(saveMetricChange(xNow(), { id: before.id, ...input, comparable, ...(needsWhy ? { reason } : {}) }).commit, row, name, 'changed'); } catch (e) { refused(row, name, e); continue; }
    } else if (it.action !== 'back' && it.action !== 'retire') unchanged++;
    if (it.action === 'retire') {
      if (before.retiredAt) { must('cant-change', row, name, `“${name}” is already retired.`, 'Action', val(r, 'action')); continue; }
      retiring.push({ x: it, why: reason });
    }
  }

  /* ---------- retiring, once every row is read: one question for the goals it leaves on retired metrics ---------- */
  const goalsLeft = retiring.reduce((k, { x: it }) => k + linkedGoals(full, it.before!.id).length, 0);
  for (const { x: it, why } of retiring) {
    const name = it.before!.name;
    if (goalsLeft && c.ask('big-removal', it.row, name, `Retiring ${plural(retiring.length, 'metric')} leaves ${goalsWord(goalsLeft)} measured by a retired metric.`, { column: 'Action', answers: [{ choice: 'right', label: 'Retire them' }, { choice: 'leave', label: 'Leave these rows out' }] }) === 'leave') continue;
    try { kept(retireMetric(xNow(), it.before!.id, why), it.row, name, 'retired'); } catch (e) { refused(it.row, name, e); }
  }

  // The rows saved, once each, as they end up; and what each was before, for the import's Undo.
  const latest = [...touched.keys()].map((id) => metricsOf(full).find((m) => m.id === id)!);
  const modules: ModuleRows | undefined = latest.length ? metricRows({ metrics: latest }).modules : undefined;
  return {
    items, unchanged, examples, changes,
    ...(modules ? { modules } : {}),
    before: touched.size ? [{ module: MODULE, key: METRICS_KEY, rows: [...touched].map(([id, b]) => ({ id, before: b })) }] : [],
  };
}
