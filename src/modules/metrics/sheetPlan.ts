/* The Metrics sheet loaded back (MI, round 2's MT6; docs/design/metrics-2/spec.md 2.9, 3.1, 3.4): each row adds a
   metric, changes one (found by ID, else by name, any case), retires one or brings one back, through the library's own
   rules (saveMetricChange, retireMetric, unretireMetric), so a file and the form say no in the same words. The engine
   (domain/changeset, through domain/sheetPlan) owns the questions' levels, the answers, leaving rows out and one Undo.
   As on every sheet, a row already here needs no column: an absent column or an empty cell keeps what the metric says. */
import { NotAllowed, type ActionContext } from '../../domain/actions';
import { normalEmail } from '../../domain/people';
import { oneOf } from '../../domain/columns';
import { fold, LEAVE } from '../../domain/problemLevels';
import { applyModuleRows } from '../../domain/records';
import type { SheetPlanApi, SheetPlanItem, SheetPlanResult } from '../../domain/sheetPlan';
import type { Rec } from '../../domain/sheets';
import type { Change, Goal } from '../../domain/types';
import { nameChecks } from './rulesDefine';
import { linkedGoals, retireMetric, saveMetricChange, unretireMetric } from './rulesChange';
import { METRICS_KEY, metricsOf, MODULE, REFRESH_LABEL, type Metric, type MetricInput } from './rules';
import { CONFIDENCE_WORDS, CONFIDENCES, LEVEL_WORDS, LEVELS, parentRefusal, structureProblems } from './rulesStructure';
import { AGGREGATE_LABEL, MEASURE_LABEL, missingLine, similarMetrics, stageOf, STAGE_LABEL, STAGES, windowFrom } from './rulesQuality';
import type { MetricAggregate, MetricCalc, MetricMeasure } from './types';

const goalsWord = (n: number) => `${n} ${n === 1 ? 'goal is' : 'goals are'}`;

/** A column under the export's header, or a name a register often uses for it (3.1, header aliases). */
const ALIASES: Record<string, string[]> = { metric: ['metric', 'name'], meaning: ['meaning', 'description', 'definition'], direction: ['direction', 'better'], 'owner email': ['owner email', 'owner e-mail'], 'part of': ['part of', 'parent', 'parent metric'], 'how it relates': ['how it relates', 'level', 'relation'], 'how it could be gamed': ['how it could be gamed', 'gaming'] };
const cell = (api: SheetPlanApi, r: Rec, col: string): { has: boolean; v: string } => {
  for (const k of ALIASES[col] ?? [col]) if (api.has(r, k)) return { has: true, v: api.val(r, k) };
  return { has: false, v: '' };
};


const DIRECTION_WORDS: Record<string, Metric['direction']> = { 'higher is better': 'higher', higher: 'higher', up: 'higher', 'lower is better': 'lower', lower: 'lower', down: 'lower' };
const REFRESH_WORDS = Object.fromEntries(Object.entries(REFRESH_LABEL).map(([k, v]) => [fold(v), k])) as Record<string, Metric['refresh']>;
const LEVEL_BY_WORD = Object.fromEntries(LEVELS.map((k) => [fold(LEVEL_WORDS[k].label), k]));
const CONFIDENCE_BY_WORD = Object.fromEntries(CONFIDENCES.map((k) => [fold(CONFIDENCE_WORDS[k].label), k]));
const ACTION_WORDS: Record<string, 'retire' | 'back'> = { retire: 'retire', 'bring back': 'back', 'bring it back': 'back' };

/** The fields a row gives that differ from the metric as it is (nothing given: nothing differs). The calculation and the
    window are compared by what they say. */
const canon = (v: unknown): unknown => {
  if (typeof v === 'string') return v.trim() || undefined;
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const o = Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]).filter(([, x]) => x !== undefined && x !== null));
    return Object.keys(o).length ? o : undefined;
  }
  return v ?? undefined;
};
/** A field as it says, whatever the order of its keys or its empty parts: an export loaded back changes nothing. */
const said = (v: unknown) => JSON.stringify(canon(v) ?? null);
const differs = (before: Metric, input: MetricInput) => (Object.keys(input) as (keyof MetricInput)[]).some((k) => said(before[k]) !== said(input[k]));

/* MQ2's columns (sheet.ts): the calculation's, the words each takes, and how a cell is read. */
const CALC_COLUMNS = ['what is measured', 'how aggregated', 'counts', 'filters', 'leaves out', 'numerator', 'numerator filters', 'numerator leaves out', 'denominator', 'denominator filters', 'denominator leaves out', 'formula'];
const PART_COLUMN = { counts: 'counts', filters: 'filters', excludes: 'leaves out' } as const;
const MEASURE_BY_WORD = Object.fromEntries(Object.entries(MEASURE_LABEL).flatMap(([k, v]) => [[fold(v), k], [fold(k), k]])) as Record<string, MetricMeasure>;
const WINDOW_KINDS: string[] = ['point', 'rolling', 'period', 'cumulative'];
const calcOf = (c: MetricCalc | null | undefined): MetricCalc => (c ? JSON.parse(JSON.stringify(c)) as MetricCalc : { measure: '' as MetricMeasure, aggregate: null });
/** "p90", "percentile 90", "mean per day", "Median": the aggregate and its number or per; null for words it doesn't know. */
function aggregateFrom(raw: string): Pick<MetricCalc, 'aggregate' | 'percentile' | 'per'> | null {
  const w = fold(raw);
  let m: RegExpExecArray | null;
  if ((m = /^(?:p|percentile\s*)(\d{1,2})(?:th)?$/.exec(w))) return { aggregate: 'percentile', percentile: Number(m[1]) };
  if ((m = /^mean per (.+)$/.exec(w))) return { aggregate: 'mean', per: m[1]!.trim() };
  const k = (Object.keys(AGGREGATE_LABEL) as MetricAggregate[]).find((a) => a !== 'percentile' && fold(AGGREGATE_LABEL[a]) === w);
  return k ? { aggregate: k } : null;
}

export function planMetricsSheet(api: SheetPlanApi): SheetPlanResult {
  const { x: x0, rows } = api;
  const ws = 'this workspace';
  let snap = x0.snapshot;
  let full = x0.full;
  const ctx = (): ActionContext => ({ ...x0, snapshot: snap, ...(full ? { full } : {}) });
  const apply = (c: { modules?: typeof snap.modules; goals?: Goal[] }) => {
    const goals = (list: Goal[]) => (c.goals?.length ? list.map((g) => c.goals!.find((v) => v.id === g.id) ?? g) : list);
    snap = { ...snap, modules: applyModuleRows(snap.modules, c.modules) ?? {}, goals: goals(snap.goals) };
    if (full) full = { ...full, modules: applyModuleRows(full.modules, c.modules) ?? {}, goals: goals(full.goals) };
  };
  const items: SheetPlanItem[] = [];
  const changes: Change[] = [];
  const goalsOut = new Map<string, Goal>();
  const before = new Map<string, Metric | null>();
  const byName = new Map<string, number>();
  const byId = new Map<string, number>();
  const people = snap.people;

  for (const { r, row } of rows) {
    const idCell = api.val(r, 'id');
    const name = cell(api, r, 'metric');
    const label = name.v || idCell || `Row ${row}`;
    const all = metricsOf(snap).filter((m) => !m.removedAt);
    // Which metric the row is: by ID (a retired one too; a deleted one never), else by name, else a new one.
    let was: Metric | undefined;
    if (idCell) {
      was = all.find((m) => m.id === idCell);
      if (!was) { api.raise('bad-key', row, label, `ID “${idCell}” isn’t a metric in ${ws}. Leave ID empty to add a new metric, or use an ID from an export.`, { column: 'ID', found: idCell }); continue; }
      if (byId.has(idCell)) { api.raise('duplicate', row, label, `Rows ${byId.get(idCell)} and ${row} have the same ID.`, { column: 'ID', found: idCell }); continue; }
      byId.set(idCell, row);
    } else if (name.v) was = all.find((m) => fold(m.name) === fold(name.v));
    if (name.v) {
      const k = fold(name.v);
      if (byName.has(k)) { api.raise('duplicate', row, label, `Rows ${byName.get(k)} and ${row} are both called “${name.v}”. A metric’s name is used once.`, { column: 'Metric', found: name.v }); continue; }
      byName.set(k, row);
    } else if (!was) { api.raise('required-empty', row, label, 'Give the metric a name.', { column: 'Metric' }); continue; }

    const actRaw = api.val(r, 'action');
    const act = actRaw ? ACTION_WORDS[fold(actRaw)] : null;
    if (act === undefined) { api.raise('unknown-word', row, label, `Action says “${actRaw}”. Use Retire or Bring back, or leave it empty.`, { column: 'Action', found: actRaw }); continue; }

    // The fields the row gives, read with their words; a cell that can't be read is a Must fix in section 3.1's words.
    const input: MetricInput = {};
    let bad = false;
    const must = (column: string, message: string, found = '') => { api.raise(found ? 'unknown-word' : 'required-empty', row, label, message, { column, ...(found ? { found } : {}) }); bad = true; };
    if (name.has && name.v) input.name = name.v;
    for (const [col, key] of [['meaning', 'meaning'], ['source', 'source'], ['source owner', 'sourceOwner'], ['caveats', 'caveats'], ['unit', 'unit']] as const) {
      const c = cell(api, r, col);
      if (c.v) input[key] = c.v;
    }
    const dec = cell(api, r, 'decimals');
    if (dec.has && dec.v) {
      if (/^[0-4]$/.test(dec.v)) input.decimals = Number(dec.v);
      else { api.raise('not-a-number', row, label, `Decimals says “${dec.v}”. Use a whole number from 0 to 4.`, { column: 'Decimals', found: dec.v }); bad = true; }
    }
    const dir = cell(api, r, 'direction');
    if (dir.has && dir.v) { const d = DIRECTION_WORDS[fold(dir.v)]; if (d) input.direction = d; else must('Direction', `Direction says “${dir.v}”. Use Higher is better or Lower is better.`, dir.v); }
    const ref = cell(api, r, 'refresh');
    if (ref.v) { { const f = REFRESH_WORDS[fold(ref.v)]; if (f) input.refresh = f; else must('Refresh', `Refresh says “${ref.v}”. Use Live, Hourly, Daily, Weekly, Monthly or Quarterly, or leave it empty.`, ref.v); } }
    const email = cell(api, r, 'owner email');
    const ownerName = cell(api, r, 'owner');
    if (email.v) {
      const p = people.find((v) => normalEmail(v.email) === normalEmail(email.v));
      if (!p) { api.raise('unknown-ref', row, label, `Owner email “${email.v}” isn’t a person in ${ws}. Add them on the People sheet, or leave it empty to own it yourself.`, { column: 'Owner email', found: email.v }); bad = true; }
      else if (p.leftAt) { api.raise('unknown-ref', row, label, `${p.name} has left ${ws}. Choose someone else.`, { column: 'Owner email', found: email.v }); bad = true; }
      else input.ownerId = p.id;
    } else if (ownerName.v && (!was || fold(people.find((p) => p.id === was!.ownerId)?.name ?? '') !== fold(ownerName.v))) {
      const named = people.filter((p) => !p.leftAt && fold(p.name) === fold(ownerName.v));
      if (named.length === 1) input.ownerId = named[0]!.id;
      else { api.raise(named.length ? 'ambiguous-ref' : 'unknown-ref', row, label, named.length ? `Owner “${ownerName.v}” matches ${named.length} people. Give the Owner email.` : `Owner “${ownerName.v}” isn’t a person in ${ws}. Give the Owner email of someone here, or leave it empty to own it yourself.`, { column: 'Owner', found: ownerName.v }); bad = true; }
    }
    // MQ (rulesStructure.ts): where it sits, how far to trust it and how it could be gamed. Part of names a metric in the
    // library or on an earlier row, by ID or name.
    const part = cell(api, r, 'part of');
    if (part.v) {
      const p = all.find((m) => m.id === part.v) ?? all.find((m) => fold(m.name) === fold(part.v));
      if (p) input.parentId = p.id;
      else { api.raise('unknown-ref', row, label, `Part of says “${part.v}”, which isn’t a metric in ${ws}. Give the name or ID of a metric in the library or on an earlier row, or leave it empty.`, { column: 'Part of', found: part.v }); bad = true; }
    }
    const rel = cell(api, r, 'how it relates');
    if (rel.v) { const l = LEVEL_BY_WORD[fold(rel.v)]; if (l) input.level = l; else must('How it relates', `How it relates says “${rel.v}”. Use ${oneOf(LEVELS.map((k) => LEVEL_WORDS[k].label))}, or leave it empty.`, rel.v); }
    const conf = cell(api, r, 'confidence');
    if (conf.v) { const k = CONFIDENCE_BY_WORD[fold(conf.v)]; if (k) input.confidence = k; else must('Confidence', `Confidence says “${conf.v}”. Use ${oneOf(CONFIDENCES.map((c) => CONFIDENCE_WORDS[c].label))}, or leave it empty.`, conf.v); }
    const gaming = cell(api, r, 'how it could be gamed');
    if (gaming.v) input.gaming = gaming.v;
    // MQ2 (rulesQuality.ts): the calculation in two fields and its parts, the window and the source link. A cell given
    // changes only what it says; the rest of the calculation stays as the metric has it.
    if (CALC_COLUMNS.some((c) => cell(api, r, c).v)) {
      const base = calcOf(was?.calculation);
      const what = cell(api, r, 'what is measured').v;
      if (what) { const k = MEASURE_BY_WORD[fold(what)]; if (k) base.measure = k; else must('What is measured', `What is measured says “${what}”. Use ${oneOf(Object.values(MEASURE_LABEL))}, or leave it empty.`, what); }
      const how = cell(api, r, 'how aggregated').v;
      if (how) { const a = aggregateFrom(how); if (a) Object.assign(base, a); else must('How aggregated', `How aggregated says “${how}”. Use ${oneOf(['total', 'mean', 'median', 'latest'])}, a percentile such as p90, or “mean per day”.`, how); }
      for (const [key, prefix] of [['part', ''], ['numerator', 'numerator '], ['denominator', 'denominator ']] as const) {
        const given = (['counts', 'filters', 'excludes'] as const).map((f) => [f, cell(api, r, key === 'part' ? PART_COLUMN[f] : `${prefix}${f === 'counts' ? '' : PART_COLUMN[f]}`.trim()).v] as const).filter(([, v]) => v);
        if (given.length) base[key] = { counts: '', filters: '', excludes: '', ...base[key], ...Object.fromEntries(given) };
      }
      const formula = cell(api, r, 'formula').v;
      if (formula) base.formula = formula;
      if (!base.measure) must('What is measured', `Say what is measured (${oneOf(Object.values(MEASURE_LABEL))}) before its parts.`);
      else input.calculation = base;
    }
    const win = cell(api, r, 'window').v;
    if (win) { const w = windowFrom(win); if (w && WINDOW_KINDS.includes(w.kind) && (w.kind !== 'rolling' || w.days > 0)) input.timeWindow = w; else must('Window', `Window says “${win}”. Use Point in time, Rolling 28 days, Per week, Per month, Per quarter or Cumulative since 2026-01-01.`, win); }
    const link = cell(api, r, 'source link').v;
    if (link) input.sourceLink = link;
    if (bad) continue;

    // One letter from a metric already here (rule 1 nameChecks): asked, never guessed.
    if (!was && name.v) {
      const near = nameChecks(name.v, all.filter((m) => !m.retiredAt).map((m) => ({ id: m.id, name: m.name })))[0];
      if (near) {
        const other = all.find((m) => m.id === near.other.id)!;
        const a = api.ask('near-ref', row, label, `This is one letter from “${other.name}” (${other.unit}, ${linkedGoals(full ?? snap, other.id).length} goals).`, { column: 'Metric', found: name.v, suggest: other.name, answers: [{ choice: 'use', label: `Change “${other.name}” with this row` }, { choice: 'new', label: `Add “${name.v}” as a new metric` }, LEAVE] });
        if (a === 'leave' || a === null) continue;
        if (a.choice === 'use') { was = other; delete input.name; }
      }
    }

    // The library's own refusals (rulesStructure structureProblems), in its words: a parent that would make a loop, or a
    // level with no parent, is a Must fix on this row.
    if ('parentId' in input || 'level' in input || 'gaming' in input) {
      const shape = { id: was?.id ?? '', level: input.level ?? was?.level, parentId: input.parentId ?? was?.parentId, confidence: input.confidence ?? was?.confidence, gaming: input.gaming ?? was?.gaming };
      const problems = structureProblems(shape, { metrics: metricsOf(snap) });
      if (problems.length) {
        const parent = shape.parentId ? metricsOf(snap).find((m) => m.id === shape.parentId) : undefined;
        const loop = !!(was && parent && parentRefusal({ metrics: metricsOf(snap) }, was, parent));
        const noParent = !!shape.level && !shape.parentId;
        api.raise(loop ? 'loop' : noParent ? 'required-empty' : 'cant-change', row, label, problems.join(' '), { column: loop || noParent ? 'Part of' : 'How it could be gamed', ...(loop ? { found: part.v } : {}) });
        continue;
      }
    }

    if (act && !was) { api.raise('cant-change', row, label, `${name.v || label} isn’t a metric in ${ws} yet, so it can’t be ${act === 'retire' ? 'retired' : 'brought back'}. Leave Action empty to add it.`, { column: 'Action', found: actRaw }); continue; }
    if (act === 'back' && was && !was.retiredAt) { api.raise('cant-change', row, label, `Bring back: ${was.name} isn’t retired.`, { column: 'Action', found: actRaw }); continue; }
    const changing = !was || differs(was, input);
    if (!changing && !act) { api.same(); continue; }
    if (!changing && act === 'retire' && was?.retiredAt) { api.same(); continue; }

    // A change to a metric goals are measured by: its unit can't change from a file; its meaning, source or direction asks.
    const reason = api.val(r, 'reason');
    const n = was ? linkedGoals(full ?? snap, was.id).length : 0;
    let comparable: boolean | undefined;
    if (was && n && changing) {
      if (input.unit !== undefined && input.unit.trim() !== was.unit) { api.raise('cant-change', row, label, `It is in ${was.unit} and ${goalsWord(n)} measured by it. A file can’t change its unit: change it on the metric’s page, where its goals are shown first.`, { column: 'Unit', found: input.unit }); continue; }
      const words = (input.meaning !== undefined && input.meaning.trim() !== was.meaning.trim()) || (input.source !== undefined && input.source.trim() !== was.source.trim());
      if (words) {
        const a = api.ask('same-number', row, was.name, `${was.name}: ${goalsWord(n)} measured by it. Is it still the same number?`, { column: 'Meaning', answers: [{ choice: 'same', label: 'Same number, better words' }, { choice: 'changes', label: 'The number changes from this week' }, LEAVE] });
        if (a === 'leave' || a === null) continue;
        comparable = a.choice === 'same';
      }
      if (input.direction && input.direction !== was.direction) {
        const a = api.ask('aim-changes', row, was.name, `${was.name}: its ${goalsWord(n).replace(/ (is|are)$/, '')} would aim the other way.`, { column: 'Direction', answers: [{ choice: 'change', label: 'Change it' }, LEAVE] });
        if (a === 'leave' || a === null) continue;
      }
      if ((comparable === false || (input.direction && input.direction !== was.direction)) && !reason) { api.raise('required-empty', row, label, `Say why, in the Reason column: ${goalsWord(n)} measured by ${was.name} and will show it.`, { column: 'Reason' }); continue; }
    }
    if (act === 'retire' && !reason) { api.raise('required-empty', row, label, 'Say why it is retired, in the Reason column. Its goals will show this.', { column: 'Reason' }); continue; }

    // Saved through the library's own rules, in order: brought back, changed, retired.
    const mark = { snap, full };
    const rowChanges: Change[] = [];
    let saved: Metric | undefined = was;
    try {
      const step = (c: { modules?: typeof snap.modules; goals?: Goal[]; changes: Change[] }) => { apply(c); rowChanges.push(...c.changes); for (const g of c.goals ?? []) goalsOut.set(g.id, g); };
      if (act === 'back') step(unretireMetric(ctx(), was!.id));
      if (changing) {
        const res = saveMetricChange(ctx(), { ...input, ...(was ? { id: was.id } : {}), confirm: true, ...(comparable !== undefined ? { comparable } : {}), ...(reason ? { reason } : {}) });
        if (res.commit) step(res.commit);
        saved = res.metric;
      }
      if (act === 'retire') step(retireMetric(ctx(), saved!.id, reason));
    } catch (e) {
      if (!(e instanceof NotAllowed)) throw e;
      ({ snap, full } = mark);
      api.raise(/^Only /.test(e.message) ? 'not-allowed' : 'cant-change', row, label, e.message, {});
      continue;
    }
    if (!rowChanges.length) { api.same(); continue; }
    const id = saved!.id;
    if (!before.has(id)) before.set(id, was ? metricsOf(x0.snapshot).find((m) => m.id === id) ?? null : null);
    changes.push(...rowChanges);
    const head = rowChanges.find((c) => !c.goalId) ?? rowChanges[0]!;
    items.push({ row, name: saved!.name, act: !was ? 'added' : act === 'retire' ? 'retired' : act === 'back' ? 'back' : 'changed', summary: head.summary, diffs: rowChanges.flatMap((c) => (c.goalId ? [] : c.diffs)) });
  }

  const metrics = metricsOf(snap).filter((m) => before.has(m.id));
  return {
    notes: stageNotes(metrics, metricsOf(snap), [...before].filter(([, b]) => !b).map(([id]) => id), snap.people, x0.now),
    items,
    commit: { modules: metrics.length ? { [MODULE]: { [METRICS_KEY]: metrics } } : undefined, changes, ...(goalsOut.size ? { goals: [...goalsOut.values()] } : {}) },
    undo: before.size ? [{ module: MODULE, key: METRICS_KEY, rows: [...before].map(([id, b]) => ({ id, before: b })) }] : [],
    noun: ['metric', 'metrics'],
  };
}

/**
 * What the preview and a dry run say after the counts (MQ2): the stage each metric the file adds or changes would have,
 * counted ("Stages after loading: 2 Draft, 1 Defined"); each new metric that looks like one already in the library; and
 * each Draft's missing parts. A new metric lands as Draft until its ten parts are said.
 */
export function stageNotes(saved: readonly Metric[], all: readonly Metric[], added: readonly string[], people: readonly { id: string; leftAt?: string | null }[], now: string): string[] {
  if (!saved.length) return [];
  const here = (id: string) => people.some((p) => p.id === id && !p.leftAt);
  const st = saved.map((m) => ({ m, s: stageOf(m, { now, ownerIsHere: here(m.ownerId) }) }));
  const by = STAGES.map((k) => [k, st.filter((x) => x.s.stage === k).length] as const).filter(([, n]) => n);
  const out = [`Stages after loading: ${by.map(([k, n]) => `${n} ${STAGE_LABEL[k]}`).join(', ')}.`];
  for (const id of added) {
    const m = saved.find((v) => v.id === id);
    const like = m ? similarMetrics(m, all.filter((v) => !added.includes(v.id)))[0] : undefined;
    if (m && like) out.push(`“${m.name}” looks like “${like.name}”, already in the library. Change that one instead if they are the same number.`);
  }
  for (const { m, s: x } of st) if (x.stage === 'draft') out.push(`“${m.name}” is Draft: it ${missingLine(x.missing)}.`);
  return out;
}
