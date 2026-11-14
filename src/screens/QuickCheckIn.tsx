/* Type every number for the week in one table. Each row is judged as you type with the same rules as the
   check-in; a row that's behind or ahead opens just the fields it needs. Saved together through the bulk-change engine. */
// The change engine, for this screen's previews (src/app/engineReady.ts).
import '../app/engineReady';
import { useMemo, useRef, useState, type SelectHTMLAttributes } from 'react';
import { checkInDraftKey, checkInStepKey, clearDraft, peekDraft, writeDraft } from '../app/drafts';
import type { FromTable } from './CheckInFlow';
import { Link, useNavigate } from 'react-router';
import { useApp } from '../app/state';
import type { CheckInPost } from '../domain/changeset';
import { CAUSES_AHEAD, CAUSES_BEHIND, checkInLevels, emptyDraft, evaluate, MIN_PATH, MIN_REASON, MISSING_TEXT, numberCheck, REASON_CODES, unanswered, type Answers, type Draft, type Missing } from '../domain/checkin';
import { fmt, targetText } from '../domain/format';
import { planAt, weekDates } from '../domain/plan';
import { checkInsFor } from '../domain/status';
import type { Cause, CheckInReading, Goal, MetricGoal, RangeGoal, ReadingWhyKind } from '../domain/types';
import { Place } from '../core/app';
import { MIN_CORRECT_REASON, parseNumber } from '../domain/checkin';
import { READING_WHY, sameAtPlaces } from '../domain/reading';
import { filledAt, readWhen } from '../domain/readingWords';
import { Chip, Empty, TitleTell } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { CheckBlock, MustFixBlock } from '../ui/Levels';
import { FormClose } from '../ui/FormClose';

/** A select with the app's own chevron, so its text sits where an input's does. */
function Select({ invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <span className="qselect">
      <select className={'input' + (invalid ? ' invalid' : '')} aria-invalid={invalid || undefined} {...rest}>{children}</select>
      <Icon name="chevron-down" className="qselect-chev" />
    </span>
  );
}

/** The words a missing item is shown with here: the same words as the field it points at. */
const missingWords = (c: Missing) => (c === 'path' ? 'how it gets back on plan' : MISSING_TEXT[c]);

type Row = { value: string; cause: Cause | null; why: string; path: string; by: number | null };
const blank: Row = { value: '', cause: null, why: '', path: '', by: null };
const isBlank = (r: Row) => !r.value.trim() && !r.cause && !r.why.trim() && !r.path.trim() && r.by == null;
/** A row as the one-by-one check-in's draft holds it: the table and the flow share one draft per goal (deep review U12). */
const rowOf = (d: Draft | null): Row => (d ? { value: d.value ?? '', cause: d.cause ?? null, why: d.why ?? '', path: d.ptgWhat ?? '', by: d.ptgBy ?? null } : blank);

export function QuickCheckIn() {
  const app = useApp();
  const nav = useNavigate();
  const goals = app.snapshot.goals.filter((g): g is MetricGoal | RangeGoal => g.ownerId === app.viewer.id && g.kind !== 'milestone' && app.statusOf(g).status !== 'done');
  const milestones = app.snapshot.goals.filter((g) => g.ownerId === app.viewer.id && g.kind === 'milestone' && app.statusOf(g).status !== 'done');
  // Kept as you type, in each goal's own check-in draft: a refresh or a wrong turn doesn't lose the numbers (round 3
  // review), and a number typed in the one-by-one check-in is here too, and back again (deep review U12).
  const keyOf = (id: string) => checkInDraftKey(app.ws.id, id, app.week);
  const legacyKey = `${app.ws.id}:bulk:${app.viewer.id}:${app.week}`;
  const [rows, setRowsState] = useState<Record<string, Row>>(() => {
    const legacy = peekDraft<Record<string, Row>>(legacyKey) ?? {};
    return Object.fromEntries(goals.map((g) => [g.id, (() => { const own = rowOf(peekDraft<Draft>(keyOf(g.id))); return isBlank(own) ? { ...blank, ...legacy[g.id] } : own; })()]));
  });
  const [hasDraft, setHasDraft] = useState(() => Object.values(rows).some((r) => r.value.trim()));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  // Questions answered yes, by goal (rule 2): the same Checks as the one-by-one check-in, under each row.
  const [answers, setAnswers] = useState<Record<string, Answers>>({});
  // Numbers a module can read from their sources (place checkin.table; NR 2.3), by goal: shown in faint ink in a row
  // nobody has touched. A filled-in number needs a touch (Lane, 13 Nov): an untouched row isn't posted; the owner
  // confirms it (one tap per row, or "Confirm all readings") or changes it, and a row changed from its reading says why.
  const [readings, setReadings] = useState<Record<string, CheckInReading>>({});
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [whyOf, setWhyOf] = useState<Record<string, { kind: ReadingWhyKind | null; text: string }>>({});
  // A reading as its cell holds it: at the goal's places (review of #437, medium 6).
  const filledOf = (id: string) => filledAt(readings[id]!.value, goals.find((x) => x.id === id)?.decimals ?? 0);
  const suggested = (id: string) => !!readings[id] && !touched.has(id) && !(rows[id]?.value ?? '').trim();
  const touch = (id: string) => {
    if (touched.has(id)) return;
    setTouched((t) => new Set(t).add(id));
    // Confirming or typing in a row filled from its source keeps the number in it, now the owner's.
    if (suggested(id)) set(id, { value: filledOf(id) });
  };
  const set = (id: string, patch: Partial<Row>) => {
    const g = goals.find((x) => x.id === id);
    const next: Row = { ...blank, ...rows[id], ...patch };
    setRowsState((r) => ({ ...r, [id]: next }));
    if (!g) return;
    // The flow then opens at its first step with these numbers, not at a step an older draft was left at.
    try { localStorage.removeItem(checkInStepKey(app.ws.id, id, app.week)); } catch { /* storage blocked */ }
    if (isBlank(next)) { clearDraft(keyOf(id)); return; }
    const was = peekDraft<Draft>(keyOf(id)) ?? emptyDraft(g, null);
    writeDraft<Draft>(keyOf(id), { ...was, value: next.value, cause: next.cause, why: next.why, ptgWhat: next.path, ptgBy: next.by });
  };
  const startOver = () => {
    for (const g of goals) { clearDraft(keyOf(g.id)); try { localStorage.removeItem(checkInStepKey(app.ws.id, g.id, app.week)); } catch { /* storage blocked */ } }
    clearDraft(legacyKey);
    setRowsState({});
    setHasDraft(false);
  };

  const judged = useMemo(() => goals.map((g) => {
    const own = rows[g.id] ?? blank;
    const unconfirmed = suggested(g.id);
    const r = unconfirmed ? { ...own, value: filledOf(g.id) } : own;
    const posted = app.snapshot.checkIns.find((c) => c.goalId === g.id && c.week === app.week) ?? null;
    const read = readings[g.id] ?? null;
    const typed = r.value.trim() ? parseNumber(r.value) ?? NaN : NaN;
    const differs = !!read && Number.isFinite(typed) && !sameAtPlaces(typed, read.value, g.decimals);
    const w = whyOf[g.id];
    const whyOk = !differs || (!!w?.kind && (w.kind !== 'else' || w.text.trim().length >= MIN_CORRECT_REASON));
    const reading: CheckInReading | null = read && r.value.trim() && whyOk ? { ...read, ...(differs && w?.kind ? { why: { kind: w.kind, ...(w.text.trim() ? { text: w.text.trim() } : {}) } } : {}) } : null;
    // Empty, or filled in from its source and not yet confirmed: nothing to post (Lane, 13 Nov).
    if (!r.value.trim() || unconfirmed) return { g, r, posted, d: null, e: null, problem: null, open: [], read, differs, whyOk, reading: null, unconfirmed, rowAnswers: answers[g.id] ?? {} };
    // The number itself comes first: until it's a possible value there's no status to show or reason to ask for.
    const problem = numberCheck(g, r.value, app.snapshot.checkIns, app.week);
    const d: Draft = { ...emptyDraft(g, null), value: r.value, cause: r.cause, why: r.why, ptgWhat: r.path, ptgBy: r.by, ptgState: 'plan' };
    const checks = problem?.block ? [] : checkInLevels(g, app.week, d, checkInsFor(g, app.snapshot.checkIns)).checks;
    // A number its source read, unchanged, was measured again: "the same as last week?" is answered by the reading.
    const rowAnswers: Answers = { ...answers[g.id], ...(read && !differs ? Object.fromEntries(checks.filter((c) => c.id === 'same-as-last').map((c) => [c.id, c.key])) : {}) };
    const open = unanswered(checks, rowAnswers);
    return { g, r, posted, d, e: evaluate(g, app.cycle, app.week, d, app.snapshot.checkIns), problem, open, read, differs, whyOk, reading, unconfirmed, rowAnswers };
  }), [goals, rows, app.snapshot.checkIns, app.cycle, app.week, answers, readings, touched, whyOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const filled = judged.filter((x) => x.e);
  const ready = filled.filter((x) => x.e!.canPost && !x.open.length && x.whyOk);
  const badNumbers = filled.filter((x) => x.problem?.block).length;
  const toAnswer = filled.filter((x) => !x.problem?.block && x.open.length).length;
  const toSayWhy = filled.filter((x) => !x.problem?.block && !x.open.length && x.e!.canPost && !x.whyOk).length;
  const needReasons = filled.length - ready.length - badNumbers - toAnswer - toSayWhy;
  const toConfirm = judged.filter((x) => x.unconfirmed);
  const confirmAll = () => { for (const x of toConfirm) touch(x.g.id); };
  // A second press while saving does nothing (a ref, because state updates too late to stop a quick double tap).
  const inFlight = useRef(false);
  // Post counts the rows that are ready, and posts those; a row that isn't ready stays in the table, as a draft (U12).
  const save = async () => {
    if (inFlight.current) return;
    setTried(true);
    if (!ready.length) return;
    // Each row posts as the form does (rule 13), with what it answered, so History keeps the answer (build review of #160).
    // A number from its source, confirmed or changed, is posted with its reading (NR 2.3; rule 3).
    const posts: CheckInPost[] = ready.map(({ g, d, posted, reading, rowAnswers }) => ({ goalId: g.id, week: app.week, draft: { ...d!, answers: rowAnswers }, mode: posted ? 'again' : 'new', ...(reading ? { reading } : {}) }));
    const cs = app.previewChanges({}, 'bulk', undefined, undefined, undefined, undefined, posts);
    if (!cs.commit) { app.toast(cs.issues[0]?.message ?? 'Nothing to save', 'error'); return; }
    inFlight.current = true;
    setBusy(true);
    try {
      await app.applyChanges(cs);
      for (const { g } of ready) clearDraft(keyOf(g.id));
      clearDraft(legacyKey);
      // The same confirmation as the one-by-one check-in, with what was posted (deep review U12).
      const fromTable: FromTable = { posted: ready.map((x) => x.g.id), kept: filled.length - ready.length };
      nav('/check-in?start=1', { state: { fromTable } });
    } catch { inFlight.current = false; setBusy(false); }
  };
  const weeks = Array.from({ length: Math.max(0, app.cycle.weeks - app.week) }, (_, k) => app.week + 1 + k);

  const notReady = [badNumbers ? `${badNumbers} ${badNumbers === 1 ? 'row needs' : 'rows need'} a possible number` : '', toAnswer ? `${toAnswer} ${toAnswer === 1 ? 'row has' : 'rows have'} a question to answer` : '', toSayWhy ? `${toSayWhy} ${toSayWhy === 1 ? 'row needs' : 'rows need'} to say why it differs from its source` : '', needReasons ? `${needReasons} ${needReasons === 1 ? 'row needs' : 'rows need'} a reason or a path to green` : '', toConfirm.length ? `${toConfirm.length} ${toConfirm.length === 1 ? 'number from its source isn’t' : 'numbers from their sources aren’t'} confirmed` : ''].filter(Boolean).join('; ');
  // Rows that aren't ready are said before Post, so a count that leaves them out is never a surprise.
  const summary = tried && !filled.length
    ? (toConfirm.length ? 'Confirm the numbers from their sources, or type your own.' : 'Type at least one number.')
    : filled.length > ready.length || (ready.length > 0 && toConfirm.length > 0)
      ? (ready.length ? `Not posted until they’re ready: ${notReady}.` : notReady.charAt(0).toUpperCase() + notReady.slice(1) + '.')
      : '';

  return (
    <div className="page narrow quick">
      {/* A form: one way out, top right, in words (navigation spec 2.5). The numbers typed are kept as a draft. */}
      <div className="focus-top quick-top">
        <span className="small strong">Week {app.week} check-in</span>
        <FormClose keeps onClose={() => nav('/check-in')} />
      </div>
      <div className="page-head">
        <h1 className="title-xl">Type all your numbers in one table</h1>
        <span className="hint">Week {app.week}, {weekDates(app.cycle, app.week)}. Leave a row empty to skip it. A row that’s off plan asks why.</span>
      </div>
      {!goals.length && <Empty title="No number goals to update"><Link className="btn" to="/check-in">Use the normal check-in</Link></Empty>}
      {goals.length > 0 && (
        <form className="stack" style={{ gap: 'var(--s3)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
          {hasDraft && <p className="restored small">Picked up the numbers you hadn’t posted yet. <button type="button" className="linkish" onClick={startOver}>Start over</button></p>}
          <div className="glist qgrid">
            {judged.map(({ g, r, posted, e: judgedE, problem, open, read, differs, whyOk, unconfirmed }) => {
              const invalidNumber = !!problem?.block;
              const e = invalidNumber ? null : judgedE;
              const last = checkInsFor(g, app.snapshot.checkIns).filter((c) => c.value != null).pop();
              const plan = g.kind === 'metric' ? fmt(planAt(g.plan, app.week, app.cycle.weeks), g) : targetText(g);
              const behind = e?.reason === 'behind';
              const showWhy = !!e?.reason;
              const showPath = !!e?.needsPath;
              // Once they've pressed Post, outline exactly the fields the row still needs, the empty selects included.
              const missWhy = tried && !!e && e.codes.some((c) => REASON_CODES.includes(c));
              const missPath = tried && !!e && e.codes.includes('path');
              const bad = invalidNumber || (tried && !!e && (!e.canPost || open.length > 0 || !whyOk));
              return (
                <div key={g.id} className={'qrow' + (bad ? ' invalid' : '')}>
                  <div className="qrow-main">
                    <span className="qname">
                      <Link className="qlink strong" to={'/goals/' + g.id}>{g.title}</Link><TitleTell goal={g} />
                      {/* Each part keeps its words together, and a line never ends on a separator. */}
                      <span className="hint">
                        <span className="nobr">Plan {plan}</span>
                        {last && <> <span className="nobr">· last {fmt(last.value!, g)} (week&nbsp;{last.week})</span></>}
                        {posted && <> <span className="nobr">· {posted.value != null ? `${fmt(posted.value, g)} posted this week` : 'already posted this week'}</span></>}
                      </span>
                    </span>
                    {/* The unit stays beside the number once it's typed; the field is empty until you type. */}
                    <label className={'qvalue input' + (invalidNumber ? ' invalid' : '')}>
                      <span className="sr">{g.title}: this week’s number{g.unit ? ` in ${g.unit}` : ''}</span>
                      <input data-q={g.id} inputMode="decimal" autoComplete="off" value={r.value} className={unconfirmed ? 'qsuggested' : undefined} onChange={(ev) => { touch(g.id); set(g.id, { value: ev.target.value }); }} aria-invalid={invalidNumber || undefined} aria-describedby={problem ? `q-${g.id}-problem` : undefined} />
                      {g.unit && <span className="qunit" aria-hidden="true">{g.unit}</span>}
                    </label>
                    <span className={'qstatus' + (e ? '' : ' empty')}>{e ? <Chip k={e.status} /> : <span className="hint">—</span>}</span>
                  </div>
                  {/* A number filled in from its source says so, and is posted only once confirmed (Lane, 13 Nov). */}
                  {unconfirmed && read && (
                    <div className="qrow-more">
                      <p className="hint qfrom">From {read.source}, read {readWhen(read.at, app.today)}. <button type="button" className="linkish tap" onClick={() => touch(g.id)}>Confirm {fmt(Number(r.value), g)}</button></p>
                    </div>
                  )}
                  {/* A number that can't be posted is a Must fix block under the row, as on the form (rule 2). */}
                  {problem?.block && (
                    <div className="qrow-more">
                      <MustFixBlock id={`q-${g.id}-problem`} read={`“${r.value.trim()}”`} fix={problem.text} />
                    </div>
                  )}
                  {open[0] && (
                    <div className="qrow-more">
                      <CheckBlock key={open[0].id + open[0].key} id={`q-${g.id}-check`} question={open[0].question} yes={open[0].yes} no={open[0].no} alert={tried}
                        onYes={() => setAnswers((x) => ({ ...x, [g.id]: { ...x[g.id], [open[0]!.id]: open[0]!.key } }))}
                        onNo={() => { if (open[0]!.id === 'same-as-last') set(g.id, { value: '' }); else document.querySelector<HTMLInputElement>(`[data-q="${g.id}"]`)?.focus(); }} />
                    </div>
                  )}
                  {/* A number changed from its source's says why, before the table can post it (2.2). */}
                  {differs && read && !invalidNumber && (
                    <div className="qrow-more">
                      <div className="pair">
                        <label className="field"><span className="field-label">Why is it different from what {read.source} said ({fmt(read.value, g)})?</span>
                          <Select invalid={tried && !whyOf[g.id]?.kind} value={whyOf[g.id]?.kind ?? ''} onChange={(ev) => setWhyOf((x) => ({ ...x, [g.id]: { text: x[g.id]?.text ?? '', kind: (ev.target.value || null) as ReadingWhyKind | null } }))}>
                            <option value="">Choose why</option>
                            {READING_WHY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </Select>
                        </label>
                        <label className="field"><span className="field-label">Say more <span className="muted" style={{ fontWeight: 400 }}>{whyOf[g.id]?.kind === 'else' ? `at least ${MIN_CORRECT_REASON} characters` : 'optional'}</span></span>
                          <input className={'input' + (tried && !whyOk ? ' invalid' : '')} value={whyOf[g.id]?.text ?? ''} maxLength={500} onChange={(ev) => setWhyOf((x) => ({ ...x, [g.id]: { kind: x[g.id]?.kind ?? null, text: ev.target.value } }))} />
                        </label>
                      </div>
                    </div>
                  )}
                  {(showWhy || showPath) && (
                    <div className="qrow-more">
                      {showWhy && (
                        <div className="pair">
                          <label className="field"><span className="field-label">{behind ? 'Why it’s behind' : 'Why it’s ahead'}</span>
                            <Select invalid={missWhy && !r.cause} value={r.cause ?? ''} onChange={(ev) => set(g.id, { cause: (ev.target.value || null) as Cause | null })}>
                              <option value="">Choose a cause</option>
                              {(behind ? CAUSES_BEHIND : CAUSES_AHEAD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </Select>
                          </label>
                          <label className="field"><span className="field-label">In a sentence</span>
                            <textarea className={'input qtext' + (missWhy && r.why.trim().length < MIN_REASON ? ' invalid' : '')} rows={2} value={r.why} onChange={(ev) => set(g.id, { why: ev.target.value })} />
                          </label>
                        </div>
                      )}
                      {showPath && (
                        <div className="pair">
                          <label className="field"><span className="field-label">How it gets back on plan</span>
                            <textarea className={'input qtext' + (missPath && r.path.trim().length < MIN_PATH ? ' invalid' : '')} rows={2} value={r.path} onChange={(ev) => set(g.id, { path: ev.target.value })} />
                          </label>
                          <label className="field"><span className="field-label">Back on plan by</span>
                            <Select invalid={missPath && r.by == null} value={r.by ?? ''} onChange={(ev) => set(g.id, { by: ev.target.value ? Number(ev.target.value) : null })}>
                              <option value="">Choose a week</option>
                              {weeks.map((w) => <option key={w} value={w}>Week {w} · {weekDates(app.cycle, w)}</option>)}
                            </Select>
                          </label>
                        </div>
                      )}
                      {bad && e && <span className="hint tone-off" role="alert">Still needed: {e.codes.map(missingWords).join(', ')}.</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Place name="checkin.table" goals={goals} week={app.week} onReadings={setReadings} />
          {toConfirm.length > 0 && (
            <p className="hint qsources">
              {toConfirm.length === 1 ? '1 number is filled in from its source. Confirm it, or change it: it isn’t posted until you do.' : `${toConfirm.length} numbers are filled in from their sources. Confirm each, or change it: one nobody confirms isn’t posted.`}
              {toConfirm.length > 1 && <> <button type="button" className="linkish tap" onClick={confirmAll}>Confirm all readings</button></>}
            </p>
          )}
          {milestones.length > 0 && <p className="hint">Stage goals ({milestones.map((g: Goal) => g.title).join(', ')}) use the <Link to="/check-in">normal check-in</Link>.</p>}
          {/* Post stays in sight however long the table gets; what's still wrong is said just above it. */}
          <div className="qfoot">
            {summary && <p className="qsummary" role={tried ? 'alert' : 'status'}>{summary}</p>}
            <div className="foot-row">
              <Link className="btn ghost big-btn" to="/">Cancel</Link>
              <button type="submit" className="btn primary big-btn" disabled={busy}>{busy ? 'Saving…' : ready.length ? `Post ${ready.length} ${ready.length === 1 ? 'check-in' : 'check-ins'}` : 'Post check-ins'}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
