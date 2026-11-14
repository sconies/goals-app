/* "Measured by" in the goal forms (ML2, docs/design/metrics/spec.md 2.4): the module's part of the goal.measure place on
   New goal's measure step and on Change a goal's "What it is". Find-and-pick for a metric ("No metric" first; metrics in
   the form's unit offered first; "Add “…” as a new metric" last), then what was chosen: its meaning, the unit, decimals
   and direction it fills in (rule 5), and "For": the goal's team or the whole company. What to save goes back to the
   form as one of the module's actions (linkGoalMetric or unlinkGoalMetric), run after the goal. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../../app/state';
import type { MeasurePick, PlaceProps } from '../../core/app';
import { parseNumber } from '../../domain/checkin';
import { WarnMark } from '../../ui/bits';
import { PickOne } from '../../ui/Pick';
import { canLinkGoal, DIRECTION_LABEL, linkOf, metricsOf, type Metric, type MetricDirection } from './rules';
import { MENU_NOW } from './names';
import { checkReads } from './reads';
import { metricChecks, unansweredChecks, unitChecks, type CheckField } from './rulesDefine';
import { linkReads } from './rulesLink';
import { metricPath } from './rulesLibrary';
import { FROM_METRIC_NOTE, fromMetricWords, measureDefaults, measuredBySays, measureFormProblems } from './rulesMeasure';
import { LINK_REASON_MAX, linkChanges, linkChecks, partsOf, PART_MAX, type LinkCheck } from './rulesParts';
import './metrics.css';

/** The choice as the form's draft keeps it: the metric (null: "No metric") and whether it's for the whole company. */
function readKept(kept: string | undefined): { metricId: string | null; company: boolean; part: string; reason: string } | null {
  if (!kept) return null;
  try {
    const v = JSON.parse(kept) as { metricId?: unknown; company?: unknown; part?: unknown; reason?: unknown };
    return { metricId: typeof v.metricId === 'string' ? v.metricId : null, company: v.company === true, part: typeof v.part === 'string' ? v.part : '', reason: typeof v.reason === 'string' ? v.reason : '' };
  } catch { return null; }
}

/** A metric being added in place, from what was typed in the picker. */
interface Adding { name: string; unit: string; direction: MetricDirection | ''; meaning: string }

export function MeasuredBy({ goal, kind, unit, decimals, teamId, untouched, onChange, fill, onNone, kept, onKeep, quiet }: PlaceProps['goal.measure']) {
  const app = useApp();
  const link = goal ? linkOf(app.snapshot, goal.id) : undefined;
  // The choice lives in the form's draft (kept), so Back, a reload and "Close and keep the draft" don't lose it.
  const was = readKept(kept);
  const [metricId, setMetricId] = useState<string | null>(was ? was.metricId : link?.metricId ?? null);
  // "For": the goal's team, or the whole company. A goal already measured keeps the slice it has.
  const [company, setCompany] = useState(was ? was.company : link ? link.teamId == null : false);
  // "Which part" (MT2): one part of that number, empty for all of it; and, on a goal with check-ins, why it changes.
  const [part, setPart] = useState(was ? was.part : link?.part ?? '');
  const [reason, setReason] = useState(was ? was.reason : '');
  // Questions show a moment after "Which part" is left, so a click on the button under them isn't moved (as MT1's
  // form); at once when it is left for Save, and from the start when nothing is being typed there.
  const [shown, setShown] = useState(true);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [addErr, setAddErr] = useState('');
  // Rule 1's answers for the metric being added here: the same Checks as Add a metric asks (#281's review).
  const [addAnswers, setAddAnswers] = useState<Partial<Record<CheckField, string>>>({});
  const [busy, setBusy] = useState(false);
  // What the form held before a metric filled it, so "No metric" gives it back (rule 5); null when nothing was filled.
  const before = useRef<{ unit: string; decimals: string } | null>(null);
  const [hidden, setHidden] = useState(false);

  const metric: Metric | undefined = metricsOf(app.snapshot).find((m) => m.id === metricId);
  const team = app.team(teamId);
  const slice = company || !team ? null : team.id;
  const dp = parseNumber(decimals) ?? 0;
  const problems = metric ? measureFormProblems(metric, { kind, unit, decimals: dp }) : { errors: [], warnings: [] };
  // Rule 2's questions about the part and the reason (the unit and aim are the form's own problems above).
  const reads = goal && metric ? linkReads({ snapshot: app.snapshot }, goal, metric.id) : metric ? linkReads({ snapshot: app.snapshot }, { id: '' }, metric.id) : null;
  const checks = metric && reads ? linkChecks(goal ?? { id: '' }, metric, { teamId: slice, part }, { errors: [], warnings: [] }, reads, reason) : [];
  const [answered, setAnswered] = useState<string[]>([]);
  const partChecks = checks.filter((c) => c.field === 'part' && (c.kind === 'fix' || !answered.includes(c.words)));
  // A Check still open holds the save as a Must fix does, as link_goal_metric holds it (#308's review).
  const openCheck = partChecks.find((c) => c.kind === 'check');
  const whyFix = checks.find((c) => c.field === 'why');
  const changing = !!goal && !!metric && !!reads && reads.hasCheckIns && linkChanges(reads.present, metric.id, slice, part);
  const inUse = metric && reads ? partsOf(reads.others).filter((x) => x !== part.trim()).slice(0, 5) : [];

  // Kept in the draft whenever the choice or the slice changes.
  useEffect(() => {
    if (was?.metricId === metricId && was?.company === company && was?.part === part && was?.reason === reason) return;
    if (!was && metricId === (link?.metricId ?? null) && company === (link ? link.teamId == null : false) && part === (link?.part ?? '') && !reason) return;
    onKeep?.(JSON.stringify({ metricId, company, part, reason }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricId, company, part, reason]);
  // A metric found again in the draft: the form's unit and decimals it filled are said in one line again, as before.
  useEffect(() => {
    if (!was || !fill) return;
    const m = metricsOf(app.snapshot).find((x) => x.id === was.metricId);
    onNone?.(!m);
    if (m && !goal && unit.trim().toLowerCase() === m.unit.trim().toLowerCase()) { fill({ unit, decimals, hidden: true }); setHidden(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What to save with the goal, said back to the form whenever the choice, the slice or the form's unit changes.
  useEffect(() => {
    let pick: MeasurePick | undefined;
    if (metric) {
      const same = link && link.metricId === metric.id && link.teamId === slice && (link.part ?? '').trim() === part.trim();
      const fix = checks.find((c) => c.kind === 'fix');
      pick = same ? undefined : {
        action: 'linkGoalMetric', input: { metricId: metric.id, teamId: slice, part: part.trim(), reason: reason.trim() },
        // Check's row is labelled "Measured by" already: its value is the rest of the sentence.
        // Quiet (New goal's Check step, after the goal is saved): the field isn't drawn and the choice is worked out
        // silently, so a Check doesn't hold the save — otherwise the new goal's own saved link reads as a second goal
        // on the same number and bounces Publish back (#308's review).
        says: measuredBySays(metric, slice ? team?.name ?? null : null, part).replace(/^Measured by /, ''), blocks: problems.errors[0] ?? fix?.words ?? (!quiet && openCheck ? `Answer the question about the part first: ${openCheck.words}` : undefined),
        metric: { name: metric.name, direction: metric.direction },
      };
    } else if (link) pick = { action: 'unlinkGoalMetric', input: {} };
    onChange(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric?.id, slice, part, reason, problems.errors[0], checks.find((c) => c.kind === 'fix')?.words, quiet ? '' : openCheck?.words, team?.name]);

  // Quiet (New goal's Check): the choice is worked out from the draft for the goal's team now, and nothing is drawn.
  if (quiet || kind === 'milestone' || (goal && !canLinkGoal(app.viewer, goal))) return null;

  const choose = (id: string | null) => pickMetric(metricsOf(app.snapshot).find((x) => x.id === id));
  const pickMetric = (m: Metric | undefined) => {
    setMetricId(m?.id ?? null);
    onNone?.(!m);
    if (!fill) return;
    if (m) {
      // A new goal's own unit and decimals (or ones a metric filled and nobody changed since) take the new metric's.
      const d = measureDefaults(m, { isNew: !goal, untouched: !!untouched || hidden, unit, decimals: dp });
      if (d.set) {
        if (!before.current) before.current = { unit, decimals };
        fill({ unit: d.set.unit, decimals: String(d.set.decimals), hidden: true });
        setHidden(true);
      }
    } else if (before.current) {
      // "No metric" after a metric: the fields come back with what they held.
      fill({ ...before.current, hidden: false });
      before.current = null;
      setHidden(false);
    }
  };
  const different = () => {
    if (!metric || !fill) return;
    fill({ unit: metric.unit, decimals: String(metric.decimals), hidden: false });
    before.current = null;
    setHidden(false);
  };

  const addChecks = adding ? metricChecks({ id: '', name: adding.name, unit: adding.unit, meaning: adding.meaning }, null, checkReads(app.snapshot)) : [];
  const addOpen = unansweredChecks(addChecks, addAnswers);
  const answerAdd = (field: CheckField, choice: string) => {
    if (!adding) return;
    if (choice.startsWith('use:')) { pickMetric(metricsOf(app.snapshot).find((x) => x.id === choice.slice(4))); setAdding(null); setAddAnswers({}); return; }
    if (field === 'unit' && choice === 'use') { const u = unitChecks(adding.unit, metricsOf(app.snapshot).filter((m) => !m.removedAt).map((m) => m.unit)); if (u) setAdding({ ...adding, unit: u.use }); return; }
    setAddAnswers({ ...addAnswers, [field]: choice });
  };
  const addIt = async () => {
    if (!adding || busy) return;
    if (addOpen.length) { setAddErr('Answer the question above first.'); return; }
    setBusy(true); setAddErr('');
    try {
      // The first metric draws the Metrics row (small workspaces, rule 1): the toast says so.
      const first = !metricsOf(app.snapshot).some((m) => !m.removedAt);
      const out = await app.run('saveMetric', { name: adding.name, unit: adding.unit, direction: (adding.direction || undefined) as MetricDirection, meaning: adding.meaning, decimals: dp, ownerId: app.viewer.id, answers: addAnswers }) as { metric: Metric };
      setAddAnswers({});
      setAdding(null);
      app.toast(`Added ${out.metric.name}. Say more about it on its page when you can.${first ? ` ${MENU_NOW}` : ''}`);
      pickMetric(out.metric);
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : 'It couldn’t be added just now.');
    } finally { setBusy(false); }
  };

  // Metrics in the unit the form already has, offered first (find spec, rule 6), when someone typed it.
  const inUnit = !untouched && unit.trim() ? metricsOf(app.snapshot).filter((m) => !m.removedAt && m.unit.trim().toLowerCase() === unit.trim().toLowerCase()).slice(0, 3) : [];

  return (
    <div className="stack measured-by" style={{ gap: 'var(--s2)' }} id="measured-by">
      <PickOne kind="metric" label="Measured by" none="No metric" value={metricId} onChange={choose}
        hint={metric ? undefined : 'A metric says exactly what the number means. Choose one, add one, or say there isn’t one.'}
        first={inUnit.map((m) => ({ id: m.id, note: `in ${m.unit}` }))} invalid={problems.errors.length > 0}
        add={{ label: (q) => `Add “${q}” as a new metric`, onAdd: (q) => { setAddErr(''); setAdding({ name: q, unit: untouched ? '' : unit, direction: '', meaning: '' }); } }} />

      {adding && (
        <div className="metric-add-here stack" role="group" aria-labelledby="metric-add-h" style={{ gap: 'var(--s3)' }}>
          <h3 className="label" id="metric-add-h">A new metric</h3>
          <label className="field"><span className="field-label">Name</span><input className="input" value={adding.name} maxLength={120} onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></label>
          <label className="field"><span className="field-label">Unit</span><input className="input" value={adding.unit} maxLength={20} onChange={(e) => setAdding({ ...adding, unit: e.target.value })} /><span className="hint">As it follows a number: hours, %, USD, deploys</span></label>
          <div className="field"><span className="field-label" id="metric-add-dir">Which way is better</span>
            <div className="seg" role="group" aria-labelledby="metric-add-dir">
              {(['lower', 'higher'] as const).map((k) => <button key={k} type="button" aria-pressed={adding.direction === k} onClick={() => setAdding({ ...adding, direction: k })}>{DIRECTION_LABEL[k]}</button>)}
            </div>
          </div>
          <label className="field"><span className="field-label">What it means <span className="hint">optional</span></span><input className="input" value={adding.meaning} maxLength={2000} onChange={(e) => setAdding({ ...adding, meaning: e.target.value })} /></label>
          {addOpen.map((c) => <LinkQuestion key={c.field} c={{ field: c.field, kind: 'check', words: c.words, answers: c.answers }} onAnswer={(choice) => answerAdd(c.field, choice)} />)}
          {addErr && <span className="hint tone-off" role="alert">{addErr}</span>}
          <div className="row"><button type="button" className="btn" disabled={busy} onClick={() => void addIt()}>{busy ? 'Adding…' : 'Add this metric'}</button><button type="button" className="btn ghost" onClick={() => { setAdding(null); setAddAnswers({}); }}>Cancel</button></div>
        </div>
      )}

      {metric && (
        <div className="stack measured-chosen" style={{ gap: 'var(--s2)' }}>
          {metric.meaning
            ? <p className="small measured-meaning">{metric.meaning} <Link to={metricPath(metric)} target="_blank" rel="noopener">Read more</Link></p>
            : <p className="small hint">Its meaning hasn’t been written yet.</p>}
          {hidden && <p className="small">{measureDefaults(metric, { isNew: true, untouched: true, unit, decimals: dp }).line} <button type="button" className="linkish" onClick={different}>Use different ones</button></p>}
          {!hidden && <div className="small from-metric"><span className="label">From the metric</span> {fromMetricWords(metric)} <span className="hint">{FROM_METRIC_NOTE}</span></div>}
          <div className="field"><span className="field-label" id="measured-for">For</span>
            <div className="seg" role="group" aria-labelledby="measured-for">
              {team && <button type="button" aria-pressed={!company} onClick={() => setCompany(false)}>{team.name}</button>}
              <button type="button" aria-pressed={company || !team} onClick={() => setCompany(true)}>The whole company</button>
            </div>
            {!team && <span className="hint">Choose the goal’s team to measure it for that team.</span>}
          </div>
          <label className="field" htmlFor="measured-part"><span className="field-label">Which part <span className="hint">optional: leave empty for all of it</span></span>
            <input id="measured-part" className="input" value={part} maxLength={PART_MAX + 20} aria-invalid={partChecks.some((c) => c.kind === 'fix') || undefined}
              placeholder="Tier-1 services, a region, release builds" onChange={(e) => { setPart(e.target.value); setShown(false); }}
              onBlur={(e) => { if ((e.relatedTarget as HTMLElement | null)?.getAttribute('type') === 'submit') setShown(true); else setTimeout(() => setShown(true), 250); }} />
          </label>
          {inUse.length > 0 && <p className="small">Parts other goals on this metric use: {inUse.map((x, i) => <span key={x}>{i ? ', ' : ''}<button type="button" className="linkish" onClick={() => { setPart(x); setShown(true); }}>{x}</button></span>)}</p>}
          {(shown || part.trim().length > PART_MAX) && partChecks.map((c) => <LinkQuestion key={c.words} c={c} onAnswer={(choice) => { if (choice.startsWith('use:')) setPart(choice.slice(4)); setAnswered([...answered, c.words]); }} />)}
          {changing && (
            <div className="field"><label className="field-label" htmlFor="measured-why">Why <span className="hint">Required</span></label>
              <textarea id="measured-why" className="input" rows={2} maxLength={LINK_REASON_MAX} value={reason} aria-label="Why" aria-invalid={!!whyFix || undefined} aria-describedby="measured-why-hint" onChange={(e) => setReason(e.target.value)} />
              <span className="hint" id="measured-why-hint">It shows in its History.</span>
            </div>
          )}
          {changing && whyFix && <LinkQuestion c={whyFix} onAnswer={() => undefined} />}
          {problems.errors.map((p) => <span key={p} className="hint tone-off" role="alert">{p}</span>)}
          {problems.warnings.map((p) => <span key={p} className="hint tone-risk" role="status">{p}</span>)}
        </div>
      )}
    </div>
  );
}

/** One of rule 2's questions under "Which part" (or rule 1's, for a metric added here): a Must fix outlined and washed, a Check with its answers as plain buttons. */
function LinkQuestion({ c, onAnswer }: { c: Pick<LinkCheck, 'kind' | 'words' | 'answers'> & { field: string }; onAnswer: (choice: string) => void }) {
  return (
    <div className={`level-block ${c.kind === 'fix' ? 'level-fix' : 'level-check'}`} role={c.kind === 'fix' ? 'alert' : 'group'} data-check={c.field} tabIndex={-1}>
      <span className="level-head"><WarnMark /><span className="level-word">{c.kind === 'fix' ? 'Must fix' : 'Check'}</span></span>
      {c.kind === 'fix' ? <span>{c.words}</span> : <strong className="level-q">{c.words}</strong>}
      {c.answers.length > 0 && <span className="level-actions">{c.answers.map((a) => <button key={a.choice} type="button" className="btn" onClick={() => onAnswer(a.choice)}>{a.label}</button>)}</span>}
    </div>
  );
}
