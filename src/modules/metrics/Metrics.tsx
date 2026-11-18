/* The metric library as a place (ML1, docs/design/metrics/spec.md sections 1, 2.1, 2.2): every metric in one list with
   the list bar, and a page per metric with what it means and every goal measured by it side by side. Reading is open to
   everyone; the controls that change a metric are shown only to its owner and admins, and the rules (rules.ts) still
   decide.
     /metrics               the library: find, filter and sort, 50 a page; anyone adds a metric
     /metrics/<id>          a metric: its meaning, its goals as a table, its facts, what it needs; its owner changes it
     /metrics/new           add a metric (focus mode)
     /metrics/<id>/edit     change a metric (focus mode)
   What is listed and in what order, a metric's goals and what it needs come from rulesLibrary.ts (rules 1 to 3). */
import './qualityHooks';
import { MeasureMark } from './measureMark';
import { StageMark } from './stageMark';
import { CalcFields, StillNeeded, WindowField } from './DefineFields';
import { Baselines, Calculation, QualityNotices, QualityTop, Source, stageFor, Verification } from './MetricQuality';
import { calcWords, missingLine, onDay, QUALITY_LIMITS, windowWords, type DefinedPart, type MetricStage, type Stage } from './rulesQuality';
import { CONFIDENCE_WORDS, CONFIDENCES, GAMING_MAX, LEVEL_WORDS, LEVELS, parentRefusal, placeWords, childrenOf, type MetricConfidence, type MetricLevel } from './rulesStructure';
import { MEASUREMENT_MEANING, MEASUREMENT_NOTE_MAX, MEASUREMENTS, measurementOf } from './rulesMeasured';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useApp } from '../../app/state';
import { useDraft } from '../../app/drafts';
import { canRestore } from '../../domain/removal';
import type { FilterPart } from '../../domain/find';
import type { DisplayStatus } from '../../domain/types';
import { LABEL } from '../../domain/vocabulary';
import { newId } from '../../data/store';
import { BackLink } from '../../ui/BackLink';
import { EmptyResult, Sheet, StatusShape, StatusWord, WarnMark } from '../../ui/bits';
import { TaskHeader } from '../../ui/PageHeader';
import { CountLine, FilterLine, ListBar, ListSearch, NoneFound, SortMenu } from '../../ui/ListBar';
import { MenuButton } from '../../ui/MenuButton';
import { PickOne } from '../../ui/Pick';
import { useWidth } from '../../ui/useWidth';
import { canEditMetric, DIRECTION_LABEL, everUsed, liveMetrics, linksOf, METRIC_LIMITS, metricFrom, metricProblems, metricsOf, REFRESH_LABEL, REFRESHES, type Metric, type MetricDirection, type MetricInput, type MetricRefresh } from './rules';
import type { MetricCalc, MetricMeasurement, MetricWindow } from './types';
import { decimalsWords, findMetrics, goalsByStatus, LIBRARY_PAGE, LIBRARY_SORTS, metricAt, metricNeeds, metricPath, movedMetrics, needsLine, ownerName, stageCounts, summaryLine, unitsInUse, type LibraryAsk, type LibraryRow, type LibrarySort, type MetricGoalRow } from './rulesLibrary';
import { checkReads, goalsOfMetric, libraryReads, lineOf, proposedOfMetric } from './reads';
import { countLine, metricChecks, STILL_FIELD, unitChecks, type CheckField, type MetricCheck } from './rulesDefine';
import { CheckSaid, FixLine } from '../../ui/Levels';
import { FormFooter } from '../../ui/FormFooter';
import { changeKinds, linkedGoals } from './rulesChange';
import { lapseChecks } from './rulesSave';
import { readWhen } from '../../domain/readingWords';
import { checkInsFor } from '../../domain/status';
import { differentNumbers, differentWords, fillsIn, fillsInWords } from './rulesReading';
import { sliceOf, type NumberSource } from './source';
import { sourcesFrom } from './sources';
import './metrics.css';
import { PageHeader } from '../../ui/PageHeader';

const METRICS = { thing: 'metric', things: 'metrics' };
/** Below this width the filters fold into one Filter button (a phone). */
const NARROW = 620;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const firstOf = (name: string) => name.split(/\s+/)[0] ?? name;
const wsName = (ws: { name: string; kind?: string }) => (ws.kind === 'example' ? ws.name.replace(/^Example:\s*/, '') : ws.name);
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The library's rows, as the rules read them, for the open workspace. */
function useReads() {
  const app = useApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => libraryReads(app.snapshot, app.stamp()), [app.snapshot]);
}

/** A metric's goals by status as shape and word, worst first: "1 off track · 2 on track". */
export function StatusCounts({ statuses, label }: { statuses: DisplayStatus[]; label: string }) {
  const counts = goalsByStatus(statuses);
  return (
    <span className="team-counts metric-counts" aria-label={`${label}: ${counts.map((c) => `${c.n} ${LABEL[c.status].toLowerCase()}`).join(', ')}`}>
      {counts.map((c) => <span key={c.status} className={'team-count tone-' + c.status}><StatusShape k={c.status} />{c.n} {LABEL[c.status].toLowerCase()}</span>)}
    </span>
  );
}

/* ---------- the library (/metrics) ---------- */

export function MetricsLibrary() {
  const app = useApp();
  const { search } = useLocation();
  const [params, setParams] = useSearchParams();
  const [ref, width] = useWidth<HTMLDivElement>();
  const narrow = width > 0 && width < NARROW;
  const [filtering, setFiltering] = useState(false);
  const reads = useReads();
  // Wednesday's addresses (?m=, ?new, &edit) lead to the library's own (spec section 1).
  const moved = movedMetrics('/metrics', search);
  const q = params.get('q') ?? '';
  const unit = params.get('unit') ?? '';
  const teamId = params.get('team') ?? '';
  const ownerId = params.get('owner') ?? '';
  const dir = (['lower', 'higher'] as const).find((d) => d === params.get('dir'));
  const unused = params.get('unused') === '1';
  const sortout = params.get('sortout') === '1';
  // MQ2 sketch 1: one segmented control picks the stage, To verify or To sort out; only one at a time.
  const stage = (['verified', 'defined', 'draft'] as const).find((k) => k === params.get('stage'));
  const toVerify = !stage && !sortout && params.get('verify') === '1';
  const view: StageView = stage ?? (toVerify ? 'verify' : sortout ? 'sortout' : 'all');
  // Retired metrics (MT3) are left out of the list; ?retired=1 lists only them, so one can be found and brought back.
  const retired = params.get('retired') === '1';
  // Best stage first, so trusted numbers lead; Draft and To sort out are work lists, most goals first (journey 2).
  const sortDefault: LibrarySort = view === 'draft' || view === 'sortout' ? 'goals' : 'stage';
  const sort = (LIBRARY_SORTS.find(([k]) => k === params.get('sort'))?.[0] ?? sortDefault) as LibrarySort;
  const page = Number(params.get('page') ?? 1) || 1;
  const ask: LibraryAsk = { q, unit, teamId, ownerId, dir, unused, sortout, retired, sort, page, stage, toVerify };
  const counts = stageCounts(reads);
  const found = findMetrics(reads, ask);
  const live = reads.metrics.filter((m) => !m.removedAt).length;
  /** One history entry per choice; typing in the search replaces the entry as it goes. */
  const set = (changes: Record<string, string | null>, replace = false) => setParams((p) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(changes)) { if (v) n.set(k, v); else n.delete(k); }
    if (!('page' in changes)) n.delete('page');
    return n;
  }, { replace });
  const teamName = (id: string) => (id === 'company' ? 'The whole company' : app.team(id)?.name ?? 'a removed team');
  // The teams some goal measures a metric for: "Used by" lists only those, after the whole company.
  const usedBy = useMemo(() => [...new Set(reads.links.filter((l) => !l.removedAt && l.teamId && reads.goalIds.has(l.goalId)).map((l) => l.teamId!))].map((id) => ({ id, name: teamName(id) })).sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reads]);
  const parts: FilterPart[] = [
    ...(unit ? [{ key: 'unit', label: 'Unit', values: [unit] }] : []),
    ...(teamId ? [{ key: 'team', label: 'Used by', values: [teamName(teamId)] }] : []),
    ...(ownerId ? [{ key: 'owner', label: 'Owner', values: [app.person(ownerId)?.name ?? 'someone who has left'] }] : []),
    ...(dir ? [{ key: 'dir', label: 'Which way is better', values: [dir] }] : []),
    ...(unused ? [{ key: 'unused', label: 'No goals use it', values: ['yes'] }] : []),
    ...(retired ? [{ key: 'retired', label: 'Retired', values: ['yes'] }] : []),
  ];
  const clearFilters = () => set({ unit: null, team: null, owner: null, dir: null, unused: null, retired: null });
  const pickView = (v: StageView) => set({ stage: v === 'verified' || v === 'defined' || v === 'draft' ? v : null, verify: v === 'verify' ? '1' : null, sortout: v === 'sortout' ? '1' : null, sort: null });
  const retiredCount = reads.metrics.filter((m) => !m.removedAt && m.retiredAt).length;
  const unitMenu = <MenuButton label="Unit" display={`Unit: ${unit || 'any'}`} items={[{ label: 'Any unit', current: !unit, onClick: () => set({ unit: null }) }, ...unitsInUse(reads.metrics).map((u) => ({ label: u, current: u === unit, onClick: () => set({ unit: u }) }))]} />;
  const teamMenu = <MenuButton label="Used by" display={`Used by: ${teamId ? teamName(teamId) : 'any team'}`} items={[{ label: 'Any team', current: !teamId, onClick: () => set({ team: null }) }, { label: 'The whole company', current: teamId === 'company', onClick: () => set({ team: 'company' }) }, ...usedBy.map((t) => ({ label: t.name, current: t.id === teamId, onClick: () => set({ team: t.id }) }))]} />;
  const sortMenu = <SortMenu options={LIBRARY_SORTS} value={sort} onSort={(v) => set({ sort: v === sortDefault ? null : v })} />;
  const more = (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      {narrow && <div className="row metric-filter-menus">{unitMenu}{teamMenu}{sortMenu}</div>}
      <PickOne kind="person" label="Owner" none="Anyone" value={ownerId || null} onChange={(id) => set({ owner: id })} />
      <div className="field"><span className="field-label" id="metric-dir">Which way is better</span>
        <div className="seg" role="group" aria-labelledby="metric-dir">
          {([['', 'Either'], ['lower', 'Lower'], ['higher', 'Higher']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={(dir ?? '') === k} onClick={() => set({ dir: k || null })}>{l}</button>)}
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={unused} onChange={(e) => set({ unused: e.target.checked ? '1' : null })} /><span>No goals use it</span></label>
      <label className="check"><input type="checkbox" checked={retired} onChange={(e) => set({ retired: e.target.checked ? '1' : null })} /><span>Retired metrics only</span></label>
    </div>
  );
  if (moved) return <Navigate to={moved} replace />;
  const filtered = parts.length > 0;
  const order = (LIBRARY_SORTS.find(([k]) => k === sort)?.[1] ?? 'Best stage first').replace(/^(?!A to Z)./, (c) => c.toLowerCase());
  const views: [StageView, string, number][] = [['all', 'All', counts.all], ['verified', 'Verified', counts.verified], ['defined', 'Defined', counts.defined], ['draft', 'Draft', counts.draft], ['verify', 'To verify', counts.toVerify], ['sortout', 'To sort out', counts.sortout]];
  return (
    <div className="page metrics-page" ref={ref}>
      {/* The empty library has its own Add a metric: one primary action a screen. */}
      <PageHeader className="metrics-head" title="Metrics" line="Each number goals are measured by, defined once, so two teams’ “build time” mean the same thing."
        actions={metricsOf(app.snapshot).some((x) => !x.removedAt) ? <Link className="btn primary" to="/metrics/new">Add a metric</Link> : null} />
      {live > 0 && (
        <ListBar search={<ListSearch value={q} onSearch={(t, change) => set({ q: t || null }, change !== 'started')} label="Find a metric" placeholder="Find by name, unit, owner or meaning" autoFocus />}>
          {!narrow && unitMenu}
          {!narrow && teamMenu}
          <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setFiltering(true)}>Filters{parts.length ? ` · ${parts.length}` : ''}</button>
          {!narrow && sortMenu}
          {/* On a phone the stage control folds into a menu beside Filters, so the first metric stays near the top. */}
          {narrow && !retired && <MenuButton className="metric-stage-menu" label="Stage" display={`${views.find(([k]) => k === view)![1]} ${views.find(([k]) => k === view)![2]}`} items={views.map(([k, l, n]) => ({ label: `${l} ${n}`, current: view === k, onClick: () => pickView(k) }))} />}
        </ListBar>
      )}
      {live > 0 && !retired && !narrow && (
        <div className="seg metric-stages" role="group" aria-label="Stage">
          {views.map(([k, l, n]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => pickView(k)}>{l} <span className="metric-stage-n">{n}</span></button>)}
        </div>
      )}
      {live > 0 && <CountLine things={METRICS} n={found.total} narrowed={!!q.trim() || filtered} order={order} shown={found.total > LIBRARY_PAGE ? { from: found.from, to: found.to } : null} />}
      <FilterLine parts={parts} onRemove={(key) => set({ [key]: null })} onClear={clearFilters} />
      {live === 0 && <EmptyLibrary />}
      {live > 0 && !found.total && (view !== 'all' && !parts.length && !q.trim()
        ? <p className="hint" role="status">{EMPTY_VIEW[view]} <button type="button" className="linkish" onClick={() => pickView('all')}>See all metrics</button></p>
        : <>
          <NoneFound things={METRICS} q={q} filtered={filtered} onClearSearch={() => set({ q: null })} onClearFilters={clearFilters} />
          {q.trim() && <p><Link to={`/metrics/new?name=${encodeURIComponent(q.trim())}`}>Add “{q.trim()}” as a new metric</Link></p>}
        </>)}
      {found.total > 0 && (
        <>
          {!narrow && <div className={view === 'sortout' ? 'metric-cols metric-cols-sortout small' : 'metric-cols small'} aria-hidden="true">{(view === 'sortout' ? ['Stage', 'Metric', 'What’s needed', 'Who', 'Goals'] : ['Stage', 'Metric', 'Refresh', 'Window', 'Owner', 'Goals']).map((h) => <span key={h}>{h}</span>)}</div>}
          <ul className={narrow ? 'metric-list' : 'metric-list metric-list-wide'} aria-label="Metrics">
            {found.rows.map((r) => <li key={r.metric.id}><MetricRow row={r} wide={!narrow} sortout={view === 'sortout'} needs={canEditMetric(app.viewer, r.metric) ? needsLine(r.needs) : ''} /></li>)}
          </ul>
        </>
      )}
      {found.pages > 1 && (
        <nav className="metric-pages row" aria-label="Pages">
          <span className="hint">{found.from} to {found.to} of {found.total}</span>
          {found.page > 1 && <Link className="btn sm" to={`?${pageParams(params, found.page - 1)}`}>Previous {LIBRARY_PAGE}</Link>}
          {found.page < found.pages && <Link className="btn sm" to={`?${pageParams(params, found.page + 1)}`}>Next {Math.min(LIBRARY_PAGE, found.total - found.to)}</Link>}
        </nav>
      )}
      {!retired && retiredCount > 0 && <p className="hint metric-retired-link"><Link to="/metrics?retired=1">{retiredCount === 1 ? 'See the retired metric' : `See the ${retiredCount} retired metrics`}</Link></p>}
      <Sheet open={filtering} onClose={() => setFiltering(false)} title="Filters">{more}</Sheet>
    </div>
  );
}

const pageParams = (params: URLSearchParams, page: number) => { const n = new URLSearchParams(params); if (page > 1) n.set('page', String(page)); else n.delete('page'); return n.toString(); };

function EmptyLibrary() {
  // Small workspaces 2.4, and Lane, 16 Nov: Metrics is in the menu from the first day, so its empty page says calmly
  // how to add the first metric, with the page's one primary action.
  return <EmptyResult title="No metrics yet" action={<Link className="btn primary" to="/metrics/new">Add a metric</Link>}>A metric says once what a number means, where it comes from and who owns it. Add one when a goal is measured by a number, and every goal that shares it means the same thing.</EmptyResult>;
}

type StageView = 'all' | MetricStage | 'verify' | 'sortout';
const EMPTY_VIEW: Record<StageView, string> = {
  all: 'No metrics yet.', verified: 'No metric is Verified yet. Someone other than its owner verifies it by reproducing its figure from the source link.',
  defined: 'No metric is Defined but not yet verified.', draft: 'No Draft metrics: every metric is fully defined.',
  verify: 'Nothing to verify. A metric joins this list once it is Defined, and again 30 days before its year is up.',
  sortout: 'Nothing to sort out. Every metric is defined, has an owner, and a goal that uses it.',
};

/** A metric in the library (MQ2 sketch 1): its stage first, as the shape and word; its name with its type, unit and what
    stops it reaching Defined (or that it was Verified until a date); its refresh, window and owner; and its goals by
    status. On "To sort out" (sketch 11) the refresh and window give way to what's needed and who should do it. */
function MetricRow({ row, wide, sortout, needs }: { row: LibraryRow; wide: boolean; sortout: boolean; needs: string }) {
  const app = useApp();
  const { metric: m, owner, goalIds, stage: st } = row;
  const statuses = goalIds.map((id) => app.goal(id)).filter((g) => !!g).map((g) => app.statusOf(g!).status);
  const sub = [calcWords(m.calculation), m.unit, st.stage === 'draft' ? (sortout ? '' : missingLine(st.missing)) : st.lapsed?.kind === 'change' ? `was Verified until ${onDay(st.lapsed.at)}` : st.lapsed ? `Verified until ${onDay(st.lapsed.at)}` : st.dueBy && st.toVerify ? `due again ${onDay(st.dueBy)}` : ''].filter(Boolean).join(' · ');
  // The stage's own reasons first (a Draft's missing parts, a Gap, a handover…), then rule 3's that they don't cover.
  const reasons = [...row.sortOut.map((x) => ({ words: x.words, who: x.who })), ...row.needs.filter((n) => n.id === 'partly' || n.id === 'unused').map((n) => ({ words: n.sentence, who: m.ownerId }))];
  const goals = statuses.length ? <StatusCounts statuses={statuses} label={`${m.name}’s goals`} /> : <span className="metric-none">No goals yet</span>;
  const name = (
    <span className="metric-text">
      <span className="metric-name">{m.name}</span>
      {wide
        ? <span className="hint">{sub}{measurementOf(m) !== 'measured' && <> · <MeasureMark k={measurementOf(m)} /></>}{m.retiredAt ? ' · retired' : ''}</span>
        // A phone: one line, the stage first, then what a Draft needs, or the refresh and window.
        : <span className="hint metric-phone-line"><StageMark k={st.stage} />{sortout && st.stage === 'draft' ? '' : ' · '}{st.stage === 'draft' ? (sortout ? '' : missingLine(st.missing)) : `${m.refresh ? REFRESH_LABEL[m.refresh] : 'Refresh not said'} · ${windowWords(m.timeWindow)}`}{m.retiredAt ? ' · retired' : ''}</span>}
    </span>
  );
  const whyCell = <span className="metric-why">{(reasons.length ? reasons : needs ? [{ words: needs, who: null }] : []).map((r, i) => <span key={i} className="metric-needs"><WarnMark />{r.words}</span>)}</span>;
  const whoCell = <span className="small">{[...new Set(reasons.map((r) => (r.who ? app.person(r.who)?.name : null)).filter(Boolean))].join(', ') || owner || 'No owner'}</span>;
  if (sortout) {
    return (
      <Link className={wide ? 'metric-row metric-row-wide metric-row-sortout' : 'metric-row'} to={metricPath(m)}>
        {wide && <StageMark k={st.stage} />}
        {name}
        {whyCell}
        {wide ? whoCell : null}
        <span className="metric-side small">{goals}</span>
      </Link>
    );
  }
  return (
    <Link className={wide ? 'metric-row metric-row-wide' : 'metric-row'} to={metricPath(m)}>
      {wide && <StageMark k={st.stage} />}
      {name}
      {wide && <span className="small">{m.refresh ? REFRESH_LABEL[m.refresh] : 'Not said'}</span>}
      {wide && <span className="small">{windowWords(m.timeWindow)}</span>}
      {wide && <span className="small">{owner ?? 'No owner'}</span>}
      <span className="metric-side small">
        {goals}
        {needs && <span className="metric-needs"><WarnMark />{needs}</span>}
      </span>
    </Link>
  );
}

/* ---------- a metric (/metrics/<id>) ---------- */

export function MetricPage() {
  const app = useApp();
  const nav = useNavigate();
  const { metricId = '' } = useParams();
  const reads = useReads();
  const [removing, setRemoving] = useState<null | 'delete' | 'retire' | 'merge'>(null);
  const all = metricsOf(app.full ?? app.snapshot);
  const m = metricAt(all, metricId);
  if (!m) {
    return (
      <div className="page metric-page">
        <BackLink to="/metrics" label="Metrics" />
        <PageHeader title="Metric not found" line={`There’s no metric at this address in ${wsName(app.ws)}.`} actions={<Link className="btn primary" to="/metrics">See all metrics</Link>} />
      </div>
    );
  }
  if (m.removedAt) return <RemovedMetric metric={m} />;
  const edit = canEditMetric(app.viewer, m);
  const owner = app.person(m.ownerId);
  const ownerLive = ownerName(reads.people, m);
  const rows = goalsOfMetric(app.snapshot, app.cycle, app.today, app.week, m.id);
  const proposed = proposedOfMetric(app.snapshot, m.id);
  const line = summaryLine(rows);
  // MQ: where it sits, its parent and the metrics under it.
  const lib = { metrics: metricsOf(app.snapshot) };
  const place = placeWords(m, lib);
  const parent = m.parentId ? lib.metrics.find((x) => x.id === m.parentId) ?? null : null;
  const kids = childrenOf(lib, m.id);
  const needs = edit ? metricNeeds(m, reads) : [];
  const by = (id: string, at: string) => `by ${app.person(id)?.name ?? 'someone who has left'} on ${dateOf(at)}`;
  const one = rows.length === 1 ? rows[0]! : null;
  const retired = !!m.retiredAt;
  const used = everUsed(m.id, linksOf(app.full ?? app.snapshot));
  const replaced = m.replacedBy ? all.find((v) => v.id === m.replacedBy) : undefined;
  const st = stageFor(app, m);
  const bringBack = async () => { try { await app.run('unretireMetric', { metricId: m.id }); } catch { /* the rule's message is shown */ } };
  return (
    <div className="page metric-page">
      <BackLink to="/metrics" label="Metrics" />
      {retired && (
        <div className="metric-retired stack" role="note" style={{ gap: 'var(--s2)' }}>
          <p>Retired on {dateOf(m.retiredAt!)} by {app.person(m.retiredBy ?? '')?.name ?? 'someone who has left'}: “{m.retiredWhy}”.{replaced && <> Replaced by <Link to={metricPath(replaced)}>{replaced.name}</Link>.</>}</p>
          {edit && <div><button type="button" className="btn primary" onClick={() => void bringBack()}>Bring it back</button></div>}
        </div>
      )}
      {/* Its stage before the title, as a detail page's status line (PAGE-HEADER 2.1). */}
      <PageHeader className="metric-head" above={<QualityTop metric={m} st={st} />} title={m.name} line={<span className="hint">{decimalsWords(m.decimals).replace(/^./, (x) => x.toUpperCase())} · {ownerLive && owner ? <>owned by <Link to={`/people/${encodeURIComponent(owner.id)}`}>{owner.name}</Link></> : 'no owner'} · {retired ? <span className="metric-still">Retired</span> : <StillLine metric={m} links={edit} st={st} />}</span>}
        /* Goals, filtered to this metric (the module's Goals filter, ?metric=): the same goals as the table below (N16). */
        actions={rows.length > 0 ? <Link className={retired ? 'btn' : 'btn primary'} to={`/goals?scope=all&metric=${encodeURIComponent(m.id)}`}>{one ? 'See its goal' : `See its ${rows.length} goals`}</Link> : null} />
      {!retired && <QualityNotices metric={m} st={st} />}
      <section className="stack metric-meaning" style={{ gap: 4 }} aria-labelledby="metric-meaning">
        <h2 className="label" id="metric-meaning">What it means and how it’s calculated</h2>
        {m.meaning ? <p className="metric-prose">{m.meaning}</p> : <p className="hint">Not said yet.{edit && <> <Link to={`${metricPath(m)}/edit?field=meaning`}>Say what it means</Link></>}</p>}
        {/* MQ: how it could be gamed sits beside its definition. */}
        {m.gaming && <><h3 className="label" id="metric-gaming">How it could be gamed</h3><p className="metric-prose" aria-labelledby="metric-gaming">{m.gaming}</p></>}
      </section>
      {(place || kids.length > 0) && (
        <section className="stack metric-structure" style={{ gap: 4 }} aria-labelledby="metric-structure" data-part="Structure">
          <h2 className="label" id="metric-structure">Where it sits</h2>
          {place && parent && <p className="small">{place.slice(0, place.length - parent.name.length - 1)}<Link to={metricPath(parent)}>{parent.name}</Link>.</p>}
          {kids.length > 0 && (
            <ul className="metric-children">
              {kids.map((k) => <li key={k.id}><Link to={metricPath(k)}>{k.name}</Link>{k.level && <span className="hint"> · {LEVEL_WORDS[k.level].label}</span>}</li>)}
            </ul>
          )}
        </section>
      )}
      <Calculation metric={m} />
      <Source metric={m} />
      <Baselines metric={m} />
      <Verification metric={m} st={st} />
      <section className="stack" id="goals" style={{ gap: 'var(--s2)' }} aria-labelledby="metric-goals">
        <h2 className="label" id="metric-goals">Goals measured by it · {rows.length}</h2>
        {rows.length ? <GoalsTable rows={rows} /> : <p className="hint">No goal uses this metric yet. A goal’s owner links it under “Measured by” when they make or change the goal.</p>}
        {/* Proposed goals (GE10) that name it: apart, with no numbers, in no comparison. */}
        {proposed.length > 0 && (
          <div className="metric-proposed" data-part="Proposed goals measured by it">
            <h3 className="label">Proposed · {proposed.length}</h3>
            <ul>
              {proposed.map((g) => (
                <li key={g.id}><Link to={`/goals/${encodeURIComponent(g.id)}`}>{g.title}</Link> <span className="hint">{[g.key, app.person(g.ownerId)?.name].filter(Boolean).join(' · ')}</span></li>
              ))}
            </ul>
          </div>
        )}
        {line && <p className="small metric-summary">{line}</p>}
      </section>
      <dl className="metric-facts">
        <dt>Confidence in the number</dt><dd>{m.confidence ? <>{CONFIDENCE_WORDS[m.confidence].label}<span className="hint"> {CONFIDENCE_WORDS[m.confidence].meaning}</span></> : 'Not said'}</dd>
        <dt>Measured today</dt><dd><MeasureMark k={measurementOf(m)} />{measurementOf(m) !== 'measured' && m.measurementNote ? <span className="hint"> {m.measurementNote}</span> : null}</dd>
        {m.caveats && <><dt>Caveats</dt><dd>{m.caveats}</dd></>}
        <dt>Added</dt><dd>{by(m.createdBy, m.createdAt)}</dd>
        <dt>Last changed</dt><dd>{by(lastChangedBy(app.snapshot.changes, m), m.updatedAt)}</dd>
      </dl>
      {rows.length > 0 && !!m.source.trim() && <ReadingsTable metric={m} rows={rows} />}
      {needs.length > 0 && (
        <section className="stack metric-sortout" style={{ gap: 'var(--s2)' }} aria-labelledby="metric-sortout">
          <h2 className="label" id="metric-sortout">To sort out</h2>
          <ul className="metric-need-list">
            {needs.map((n) => <li key={n.id} className="metric-need"><span className="metric-needs"><WarnMark />{n.sentence}</span><Link className="btn sm" to={n.to}>{n.button}</Link></li>)}
          </ul>
        </section>
      )}
      {edit ? (
        <section className="people-admin stack metric-admin" aria-labelledby="metric-admin">
          <h2 className="label" id="metric-admin">{ownerLive && owner ? `For ${owner.id === app.viewer.id ? 'you' : firstOf(owner.name)} and admins` : 'For admins'}</h2>
          {!retired && <div className="row"><Link className="btn" to={`${metricPath(m)}/edit`}>Change this metric</Link></div>}
          {!retired && (
            <div className="people-admin-quiet row">
              {used ? <button type="button" className="btn ghost" onClick={() => setRemoving('retire')}>Retire this metric…</button> : <button type="button" className="btn ghost" onClick={() => setRemoving('delete')}>Delete this metric…</button>}
              {used && app.viewer.admin && <button type="button" className="btn ghost" onClick={() => setRemoving('merge')}>Merge into another metric…</button>}
            </div>
          )}
        </section>
      ) : <p className="hint">{ownerLive && owner ? `${owner.name} or an admin can change this.` : 'An admin can change this.'}</p>}
      <MetricHistory metric={m} />
      {removing === 'delete' && <RemoveMetricSheet metric={m} rows={rows} onClose={() => setRemoving(null)} onRemoved={() => void nav('/metrics')} />}
      {removing === 'retire' && <RetireSheet metric={m} onClose={() => setRemoving(null)} />}
      {removing === 'merge' && <MergeSheet metric={m} onClose={() => setRemoving(null)} onMerged={(into) => void nav(metricPath(into))} />}
    </div>
  );
}

/** Rule 1's line under a metric's title: “Fully defined”, or what it still needs to say. For its owner and admins each item
    opens the form at its field. Words only: never a number or a bar. */
function StillLine({ metric: m, links, st }: { metric: Metric; links: boolean; st: Stage }) {
  const app = useApp();
  // A Draft says the parts MQ2's Defined still needs, each opening the form at its field (#571 review: a Draft page
  // said “Fully defined” beside its stage, since rule 6's line asks less than Defined does).
  if (st.stage === 'draft') return (
    <span className="metric-still">Still needs: {st.missing.map((x, i) => <span key={x.part}>{i ? ', ' : ''}{links ? <Link to={`${metricPath(m)}/edit?field=${PART_FIELD[x.part]}`}>{x.words}</Link> : x.words}</span>)}.</span>
  );
  const s = lineOf(app.snapshot, m);
  if (!links || s.full) return <span className="metric-still">{s.line}</span>;
  const to = (f: string) => `${metricPath(m)}/edit?field=${f}`;
  return (
    <span className="metric-still">
      {s.missing.length > 0 && <>Still to say: {s.missing.map((w, i) => <span key={w}>{i ? ', ' : ''}<Link to={to(STILL_FIELD[w])}>{w}</Link></span>)}.</>}
      {s.ownerLeft && <>{s.missing.length ? ' ' : ''}<Link to={to('owner')}>Its owner has left.</Link></>}
    </span>
  );
}

/** The form's field for each part Defined needs (DefineFields.tsx and the form's own ids). */
const PART_FIELD: Record<DefinedPart, string> = { meaning: 'meaning', calculation: 'calculation', scope: 'calculation', unit: 'unit', direction: 'direction', window: 'window', source: 'sourceLink', sourceOwner: 'sourceOwner', refresh: 'refresh', owner: 'owner' };

/** Who changed a metric last: the latest change logged for it, else whoever added it. */
function lastChangedBy(changes: readonly { entity: string; entityId: string; actorId: string; at: string; goalId: string | null }[], m: Metric): string {
  const mine = changes.filter((c) => c.entity === 'metric' && c.entityId === m.id && !c.goalId);
  return mine.length ? mine.reduce((a, b) => (b.at > a.at ? b : a)).actorId : m.createdBy;
}

/** The goals a metric measures, side by side (rule 2): a table on a computer, rows on a phone. */
function GoalsTable({ rows }: { rows: MetricGoalRow[] }) {
  return (
    <table className="metric-goals">
      <thead>
        <tr><th scope="col">Status</th><th scope="col">Goal</th><th scope="col">For</th><th scope="col">Now</th><th scope="col">Target</th><th scope="col">Against plan</th><th scope="col">Owner</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.goal.id} className={r.status === 'off' ? 'is-off' : undefined}>
            <td className="mg-status"><StatusWord k={r.status} /></td>
            <td className="mg-goal"><Link to={`/goals/${encodeURIComponent(r.goal.id)}`}>{r.goal.title}</Link>{r.goal.key && <span className="hint gkey-text">{r.goal.key}</span>}</td>
            <td className="mg-for" data-label="For">{r.slice}</td>
            <td className="mg-now" data-label="Now">{r.now}</td>
            <td className="mg-target" data-label="Target">{r.target}</td>
            <td className="mg-plan" data-label="Against plan">{r.vsPlan}</td>
            <td className="mg-owner" data-label="Owner">{r.owner}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The sources registered for the open workspace (the demo's in the example; none in a workspace of your own). Null
    until known: the example's seed loads once. */
function useSources(): NumberSource[] | null {
  const app = useApp();
  const [sources, setSources] = useState<NumberSource[] | null>(null);
  useEffect(() => {
    let live = true;
    void app.exampleSeed().catch(() => null).then((seed) => { if (live) setSources(sourcesFrom(seed, app.cycle)); });
    return () => { live = false; };
  }, [app.ws.id, app.cycle.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return sources;
}

/** Under “Where the number comes from” (NR 2.4, rule 4): how each goal's check-in gets its number, then how often a
    number filled in from the source was typed over in the last 8 weeks, with those goals and weeks. Goals, never people. */
function ReadingsTable({ metric: m, rows }: { metric: Metric; rows: MetricGoalRow[] }) {
  const app = useApp();
  const sources = useSources();
  const [open, setOpen] = useState(false);
  if (!sources) return null;
  const links = linksOf(app.snapshot).filter((l) => l.metricId === m.id && !l.removedAt);
  const cells = rows.map((r) => {
    const link = links.find((l) => l.goalId === r.goal.id);
    return { r, words: link ? fillsInWords(fillsIn(sources, m, sliceOf(link), checkInsFor(r.goal, app.snapshot.checkIns)), (at) => readWhen(at, app.today)) : '' };
  });
  const decimals = new Map(rows.map((r) => [r.goal.id, r.goal.kind === 'milestone' ? 0 : r.goal.decimals] as [string, number]));
  const counts = differentNumbers(app.snapshot.checkIns, decimals, app.week);
  const title = (id: string) => rows.find((r) => r.goal.id === id)?.goal.title ?? id;
  return (
    <section className="stack metric-readings" style={{ gap: 'var(--s2)' }} aria-labelledby="metric-readings" data-part="In each goal’s check-in">
      <h2 className="label" id="metric-readings">In each goal’s check-in</h2>
      <table className="metric-reads">
        <thead><tr><th scope="col">Goal</th><th scope="col">For</th><th scope="col">In its check-in</th></tr></thead>
        <tbody>
          {cells.map(({ r, words }) => (
            <tr key={r.goal.id}>
              <td className="mg-goal"><Link to={`/goals/${encodeURIComponent(r.goal.id)}`}>{r.goal.title}</Link></td>
              <td className="mg-for" data-label="For">{r.slice}</td>
              <td className="mg-read" data-label="In its check-in">{words}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {counts.map((d) => (
        <div key={d.source} className="stack" style={{ gap: 'var(--s1)' }}>
          <p className="small metric-different">{differentWords(d)}{d.k > 0 && <> <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide them' : 'See them'}</button></>}</p>
          {open && d.k > 0 && (
            <ul className="metric-mini metric-different-weeks">
              {d.weeks.map((w) => <li key={`${w.goalId}-${w.week}`}><Link to={`/goals/${encodeURIComponent(w.goalId)}?history=checkins&week=${w.week}#history`}>{title(w.goalId)}, week {w.week}</Link></li>)}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

/** A removed metric's page: when and by whom, and Put it back for those who may. */
function RemovedMetric({ metric: m }: { metric: Metric }) {
  const app = useApp();
  const nav = useNavigate();
  const may = canRestore(app.viewer, { by: m.removedBy ?? '' });
  const put = async () => {
    try { await app.run('restoreRemoved', { kind: 'metric', id: m.id }); app.toast(`Put back ${m.name}`); void nav(metricPath(m), { replace: true }); } catch { /* the rule's message is shown */ }
  };
  return (
    <div className="page metric-page">
      <BackLink to="/metrics" label="Metrics" />
      <h1 className="title-xl">{m.name}</h1>
      <p>“{m.name}” was removed on {dateOf(m.removedAt!)} by {app.person(m.removedBy ?? '')?.name ?? 'someone'}.</p>
      {may ? <div><button type="button" className="btn primary" onClick={() => void put()}>Put it back</button></div> : <p className="hint">Its owner or an admin can put it back from Recently removed.</p>}
    </div>
  );
}

/** Removing a metric: which goals stop being measured by it, then the save (with Undo, from the action). */
function RemoveMetricSheet({ metric: m, onClose, onRemoved }: { metric: Metric; rows: MetricGoalRow[]; onClose: () => void; onRemoved: () => void }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  // Every goal removing it unlinks (removeMetric): a stopped goal's link too, not only the goals its page lists.
  // The whole workspace's, as removeMetric reads them: a stopped goal, or one in another cycle, is unlinked too.
  const rows = linksOf(app.full).filter((l) => l.metricId === m.id && !l.removedAt).map((l) => app.full.goals.find((g) => g.id === l.goalId)).filter((g): g is NonNullable<typeof g> => !!g && !g.removedAt).map((goal) => ({ goal }));
  const titles = rows.slice(0, 3).map((r) => r.goal.title);
  const rest = rows.length - titles.length;
  const go = async () => {
    setBusy(true);
    try { await app.run('removeMetric', { metricId: m.id }, { said: `Deleted ${m.name}` }); onClose(); onRemoved(); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Delete “${m.name}”?`}>
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        <p className="small">{rows.length ? `${plural(rows.length, 'goal stops', 'goals stop')} being measured by it: ${titles.join(', ')}${rest ? ` and ${rest} more` : ''}. They keep their numbers and plans.` : 'No goal has been measured by it.'}</p>
        <p className="small">You can put it back for 30 days from Recently removed.</p>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn danger big-btn" type="button" disabled={busy} onClick={() => void go()}>{busy ? 'Deleting…' : 'Delete the metric'}</button></div>
      </div>
    </Sheet>
  );
}

/** The goals a metric measures now, named as the read-backs name them: the first six, then “and {k} more”. */
function goalNames(titles: string[]) {
  const shown = titles.slice(0, 6);
  return `${shown.join(', ')}${titles.length > shown.length ? ` and ${titles.length - shown.length} more` : ''}`;
}
function liveGoalTitles(app: ReturnType<typeof useApp>, metricId: string): string[] {
  const s = app.full ?? app.snapshot;
  const ids = new Set(linksOf(s).filter((l) => l.metricId === metricId && !l.removedAt).map((l) => l.goalId));
  return s.goals.filter((g) => ids.has(g.id) && !g.removedAt && !g.stoppedAt).map((g) => g.title);
}

/** Retiring a metric (MT3, spec 2.3): its goals stay measured by it and say so; it leaves the pickers; Undo, or Bring it back. */
function RetireSheet({ metric: m, onClose }: { metric: Metric; onClose: () => void }) {
  const app = useApp();
  const [why, setWhy] = useState('');
  const [by, setBy] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const titles = liveGoalTitles(app, m.id);
  const other = by ? liveMetrics(app.snapshot).find((v) => v.id === by) : undefined;
  const apart = !!other && (other.id === m.id || other.unit.trim().toLowerCase() !== m.unit.trim().toLowerCase());
  const go = async () => {
    setTried(true);
    if (!why.trim() || apart) return;
    setBusy(true);
    try { await app.run('retireMetric', { metricId: m.id, why, replacedBy: by || null }, { said: `Retired ${m.name}` }); onClose(); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Retire “${m.name}”?`}>
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        <p className="small">{titles.length ? <><strong>{plural(titles.length, 'goal stays', 'goals stay')} measured by it</strong> and keep{titles.length === 1 ? 's' : ''} {titles.length === 1 ? 'its' : 'their'} numbers and plans: {goalNames(titles)}. They will say “Measured by {m.name}, retired {new Date(app.today).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}”.</> : 'No goal is measured by it now.'}</p>
        <p className="small">It leaves the pickers and the library’s list. It can be brought back at any time.</p>
        <label className="field">
          <span className="label">Why <span className="hint">Required</span></span>
          <textarea className={tried && !why.trim() ? 'is-fix' : undefined} rows={2} maxLength={300} value={why} onChange={(e) => setWhy(e.target.value)} aria-invalid={tried && !why.trim()} />
          {tried && !why.trim() && <FixLine>Say why it is retired, in a line. Its goals will show this.</FixLine>}
        </label>
        <div className="field">
          <PickOne kind="metric" label="Replaced by (optional)" none="Not said" value={by || null} onChange={(id) => setBy(id ?? '')} invalid={apart} />
          {apart ? <FixLine>{other!.id === m.id ? 'Choose another metric.' : `${m.name} is in ${m.unit} and ${other!.name} is in ${other!.unit}. It can only be replaced by a metric in the same unit.`}</FixLine> : <span className="hint">Its goals’ owners are offered this one.</span>}
        </div>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="button" disabled={busy} onClick={() => void go()}>{busy ? 'Retiring…' : 'Retire the metric'}</button></div>
      </div>
    </Sheet>
  );
}

/** Merging a metric into another in the same unit (MT3, spec 2.3; admins): its goals move, it is retired pointing there. */
function MergeSheet({ metric: m, onClose, onMerged }: { metric: Metric; onClose: () => void; onMerged: (into: Metric) => void }) {
  const app = useApp();
  const [into, setInto] = useState('');
  const [why, setWhy] = useState('');
  const [anyway, setAnyway] = useState(false);
  const [busy, setBusy] = useState(false);
  const other = into && into !== m.id ? liveMetrics(app.snapshot).find((v) => v.id === into) : undefined;
  const apart = other && other.unit.trim().toLowerCase() !== m.unit.trim().toLowerCase();
  const n = liveGoalTitles(app, m.id).length;
  const k = other ? liveGoalTitles(app, other.id).length : 0;
  const wrong = other && !apart && other.direction !== m.direction;
  const go = async () => {
    if (!other || apart || (wrong && !anyway)) return;
    setBusy(true);
    try { await app.run('mergeMetrics', { fromId: m.id, intoId: other.id, why }, { said: `Merged ${m.name} into ${other.name}. ${plural(n, 'goal', 'goals')} moved.` }); onClose(); onMerged(other); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Merge “${m.name}” into another metric`}>
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        <div className="field">
          <PickOne kind="metric" label="Into" value={into || null} onChange={(id) => { setInto(id ?? ''); setAnyway(false); }} invalid={!!apart} />
          {apart && <FixLine>{m.name} is in {m.unit} and {other!.name} is in {other!.unit}. Only metrics in the same unit can be merged.</FixLine>}
        </div>
        {other && !apart && <p className="small">“{m.name}” ({plural(n, 'goal', 'goals')}) becomes “{other.name}” ({plural(k, 'goal', 'goals')}). Both are in {m.unit}. The {plural(n, 'goal', 'goals')} will be measured by {other.name} from today, and their History will say so. “{m.name}” is retired, pointing to {other.name}.</p>}
        {wrong && !anyway && (
          <div className="level-check stack" style={{ gap: 'var(--s2)' }}>
            <span className="row" style={{ gap: 6 }}><WarnMark /><strong>Check</strong></span>
            <span className="small">{m.name}: {DIRECTION_LABEL[m.direction].toLowerCase()}. {other!.name}: {DIRECTION_LABEL[other!.direction].toLowerCase()}. {plural(n, 'goal', 'goals')} will aim the wrong way.</span>
            <div className="row"><button type="button" className="btn sm" onClick={() => setAnyway(true)}>Merge anyway</button><button type="button" className="btn sm ghost" onClick={onClose}>Cancel</button></div>
          </div>
        )}
        <label className="field">
          <span className="label">Why <span className="hint">optional</span></span>
          <input type="text" maxLength={300} value={why} placeholder={other ? `The same number as ${other.name}.` : ''} onChange={(e) => setWhy(e.target.value)} />
        </label>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary big-btn" type="button" disabled={busy || !other || !!apart || (!!wrong && !anyway)} onClick={() => void go()}>{busy ? 'Merging…' : 'Merge them'}</button></div>
      </div>
    </Sheet>
  );
}

/** A metric's History (MT3, spec 2.4): the change log's entries for it, newest first, 20 then Show earlier. */
function MetricHistory({ metric: m }: { metric: Metric }) {
  const app = useApp();
  const [all, setAll] = useState(false);
  const entries = app.snapshot.changes.filter((c) => c.entity === 'metric' && c.entityId === m.id && !c.goalId).slice().reverse();
  const shown = all ? entries : entries.slice(0, 20);
  return (
    <section className="stack metric-history" id="history" style={{ gap: 'var(--s2)' }} aria-labelledby="metric-history">
      <h2 className="label" id="metric-history">History</h2>
      {shown.length ? (
        <ul className="metric-history-list">
          {shown.map((c) => <li key={c.id} className="small"><span>{app.person(c.actorId)?.name ?? 'Someone'}: {c.summary.charAt(0).toLowerCase()}{c.summary.slice(1)}</span> <span className="hint">{dateOf(c.at)}</span></li>)}
        </ul>
      ) : <p className="hint small">{app.person(m.createdBy)?.name ?? 'Someone'} added this metric on {dateOf(m.createdAt)}.</p>}
      {!all && entries.length > 20 && <div><button type="button" className="btn ghost sm" onClick={() => setAll(true)}>Show earlier</button></div>}
    </section>
  );
}

/* ---------- add or change a metric (/metrics/new, /metrics/<id>/edit) ---------- */

/** The rule's messages shown under their own field; the rest go above the button. */
const FIELD_PROBLEM = /metric a name|already a metric|keep the name|unit|which way|owner isn’t/i;
/** The fields the rule can find wrong, in the form's order, each with the words its problems use. */
const FIELD_ORDER: [string, RegExp][] = [['name', /metric a name|already a metric|keep the name/i], ['unit', /unit/i], ['direction', /which way/i], ['owner', /owner isn’t/i]];
/** Where a metric's form keeps its draft: one for a new metric, one for each metric being changed. */
const metricDraftKey = (ws: string, id: string | null) => `${ws}:metric:${id ?? 'new'}`;

type Draft = { name: string; meaning: string; unit: string; decimals: number; direction: MetricDirection | ''; source: string; sourceOwner: string; refresh: MetricRefresh | ''; ownerId: string; caveats: string; measurement?: MetricMeasurement; measurementNote?: string; level?: MetricLevel | ''; parentId?: string; confidence?: MetricConfidence | ''; gaming?: string; calculation?: MetricCalc | null; timeWindow?: MetricWindow | null; sourceLink?: string; sourceQuery?: string; refreshNote?: string };

export function MetricForm() {
  const app = useApp();
  const nav = useNavigate();
  const { metricId } = useParams();
  const [params] = useSearchParams();
  const before = metricId ? metricAt(metricsOf(app.snapshot), metricId) ?? null : null;
  const live = before && !before.removedAt ? before : null;
  // Kept as other drafts are (src/app/drafts.ts): Close, Back or a reload never loses what was typed.
  const [d, set, clearDraft, restored, touched] = useDraft<Draft>(metricDraftKey(app.ws.id, live?.id ?? null), () => live
    ? { name: live.name, meaning: live.meaning, unit: live.unit, decimals: live.decimals, direction: live.direction, source: live.source, sourceOwner: live.sourceOwner, refresh: live.refresh ?? '', ownerId: live.ownerId, caveats: live.caveats, measurement: measurementOf(live), measurementNote: live.measurementNote ?? '', level: live.level ?? '', parentId: live.parentId ?? '', confidence: live.confidence ?? '', gaming: live.gaming ?? '', calculation: live.calculation ?? null, timeWindow: live.timeWindow ?? null, sourceLink: live.sourceLink ?? '', sourceQuery: live.sourceQuery ?? '', refreshNote: live.refreshNote ?? '' }
    : { name: (params.get('name') ?? '').slice(0, METRIC_LIMITS.name), meaning: '', unit: '', decimals: 0, direction: '', source: '', sourceOwner: '', refresh: '', ownerId: app.viewer.id, caveats: '' });
  const [tried, setTried] = useState(false);
  // Fields left once: their errors show from then on, not while the first thing is being typed.
  const [left, setLeft] = useState<Set<string>>(() => new Set());
  // Shown a moment after the field is left, so what appears above the button never moves it under a click already on
  // its way (leaving the meaning by pressing Add the metric).
  const leave = (k: string) => () => { window.setTimeout(() => setLeft((x) => (x.has(k) ? x : new Set(x).add(k))), 250); };
  const [busy, setBusy] = useState(false);
  // Changing the unit or direction goals use is asked first (spec 2.3).
  const [asking, setAsking] = useState(false);
  // MT3's read-back (spec 2.2): is it still the same number, a new unit's label or scale, and why.
  const [comparable, setComparable] = useState<boolean | undefined>(undefined);
  const [unitIs, setUnitIs] = useState<'label' | 'scale' | undefined>(undefined);
  const [why, setWhy] = useState('');
  const [whyTried, setWhyTried] = useState(false);
  // Rule 1's Checks answered, each with the field's value it was answered for: a new value asks again.
  const [answered, setAnswered] = useState<Partial<Record<CheckField, { choice: string; at: string }>>>({});
  // Saving was tried with a Check unanswered: the Check is outlined and the button says so.
  const [waiting, setWaiting] = useState(false);
  const field = params.get('field');
  const top = useRef<HTMLDivElement>(null);
  // Opened at a field ("Say what it means", "Choose an owner"): that field is in view and focused.
  useEffect(() => {
    if (!field) return;
    const focus = () => {
      const el = document.getElementById(`metric-${field}`);
      el?.scrollIntoView({ block: 'center' });
      (el?.querySelector('input, textarea, select, button') as HTMLElement | null ?? el as HTMLElement | null)?.focus?.();
    };
    focus();
    // The owner's picker draws its choice a moment later (it asks the Search port), replacing the button focused first.
    const later = window.setTimeout(focus, 200);
    return () => window.clearTimeout(later);
  }, [field]);
  if (metricId && !live) return <Navigate to={metricId ? `/metrics/${encodeURIComponent(metricId)}` : '/metrics'} replace />;
  if (live && !canEditMetric(app.viewer, live)) {
    return (
      <div className="focus metric-form">
        <TaskHeader name="Change a metric" close={{ keeps: false, onClose: () => void nav(metricPath(live)) }} />
        <div className="focus-body"><h1 className="qtitle big">Change {live.name}</h1><p>Only {app.person(live.ownerId)?.name ?? 'its owner'} or an admin can change this metric.</p></div>
      </div>
    );
  }
  const input: MetricInput = { name: d.name, meaning: d.meaning, unit: d.unit, decimals: d.decimals, direction: (d.direction || undefined) as MetricDirection, source: d.source, sourceOwner: d.sourceOwner, refresh: d.refresh || null, ownerId: d.ownerId, caveats: d.caveats, measurement: d.measurement ?? 'measured', measurementNote: d.measurementNote ?? '', level: d.level || null as never, parentId: d.parentId || null as never, confidence: d.confidence || null as never, gaming: d.gaming ?? '', ...('calculation' in d ? { calculation: d.calculation ?? null } : {}), ...('timeWindow' in d ? { timeWindow: d.timeWindow ?? null } : {}), sourceLink: d.sourceLink ?? '', sourceQuery: d.sourceQuery ?? '', refreshNote: d.refreshNote ?? '' };
  const next = metricFrom(input, live, { actor: app.viewer, now: app.stamp(), newId });
  const problems = metricProblems(next, app.snapshot);
  const shows = (k?: string) => tried || (!!k && left.has(k));
  const about = (re: RegExp, k?: string) => (shows(k) ? problems.filter((p) => re.test(p)) : []);
  // A Must fix under its field (spec 2.1): outlined on every side and washed, the warning mark and “Must fix”.
  const err = (re: RegExp, k?: string) => about(re, k).map((p) => <div key={p} className="level-block level-fix" role="alert"><span className="level-head"><WarnMark /><span className="level-word">Must fix</span></span><span>{p}</span></div>);
  // Rule 1's questions (rulesDefine.ts): a close name, a unit spelt another way, a share that doesn't say out of what.
  // The same Checks the save asks (rulesSave openChecks), so none is refused unseen: MQ2's similar metric (on name, source
  // and meaning) and the lapse of a Verified metric too (#564 review, high).
  const checks = [...metricChecks({ id: live?.id ?? '', name: d.name, unit: d.unit, meaning: d.meaning, source: d.source }, live, checkReads(app.snapshot)), ...(live ? lapseChecks({ snapshot: app.snapshot, now: app.stamp() }, live, next) : [])];
  const valueOf = (f: CheckField) => (f === 'similar' ? `${d.name}|${d.source}|${d.meaning}` : f === 'lapse' ? '' : d[f]).trim();
  const open = checks.filter((c) => !(answered[c.field] && answered[c.field]!.at === valueOf(c.field)));
  const shownChecks = open.filter((c) => shows(c.field));
  const shownFixes = problems.filter((p) => tried || FIELD_ORDER.some(([k, re]) => left.has(k) && re.test(p)));
  const count = countLine(shownFixes.length, shownChecks.length);
  // The goals the metric measures now, and how many of them a new unit or direction would set apart (linkProblems).
  // Rule 3: what kind of change this is, for the goals the metric measures now. `words` saves at once.
  const linked = live ? linkedGoals(app.full ?? app.snapshot, live.id) : [];
  const kinds = live ? changeKinds(live, next, linked, { relabel: unitIs === 'label' }) : ['none'];
  const unitChanging = !!live && linked.length > 0 && live.unit.trim().toLowerCase() !== next.unit.trim().toLowerCase();
  const question = live && (unitChanging || kinds.some((k) => k === 'meaning' || k === 'direction' || k === 'decimals')) ? kinds : null;
  const marking = !!question && ((question.includes('meaning') && comparable === false) || question.includes('direction'));
  const back = () => void nav(live ? metricPath(live) : '/metrics');
  const answer = (c: MetricCheck, choice: string) => {
    if (choice.startsWith('use:')) { const m = metricsOf(app.snapshot).find((x) => x.id === choice.slice(4)); if (m) void nav(metricPath(m)); return; }
    if (c.field === 'unit' && choice === 'use') { const u = unitChecks(d.unit, unitsInUse(metricsOf(app.snapshot).filter((m) => m.id !== live?.id))); if (u) set({ unit: u.use }); return; }
    setAnswered((a) => ({ ...a, [c.field]: { choice, at: valueOf(c.field) } }));
    // The question closes to one line: its Change takes the focus, so it isn't lost to the page (#281's review).
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-said="${c.field}"] button`)?.focus(), 0);
  };
  const said = (f: CheckField) => (f === 'name' || f === 'similar' ? 'You said: mine is different.' : f === 'unit' ? `You said: keep “${d.unit.trim()}”.` : f === 'lapse' ? 'You said: change it, and lapse Verified.' : 'You said: it’s right as written.');
  const checkFor = (f: CheckField) => {
    const c = checks.find((x) => x.field === f);
    if (!c) return null;
    const a = answered[f];
    if (a && a.at === valueOf(f)) return <div data-said={f}><CheckSaid onChange={() => setAnswered((x) => { const y = { ...x }; delete y[f]; return y; })}>{said(f)}</CheckSaid></div>;
    if (!shows(f)) return null;
    if (f === 'similar') return <SimilarCheck c={c} waiting={waiting} onAnswer={(choice) => answer(c, choice)} />;
    return (
      <div className={'level-block level-check metric-check' + (waiting ? ' level-alert' : '')} role="group" aria-labelledby={`metric-check-${f}`} tabIndex={-1} data-check={f}>
        <span className="level-head"><WarnMark /><span className="level-word">Check</span></span>
        <strong id={`metric-check-${f}`} className="level-q">{c.words}</strong>
        <span className="level-actions">{c.answers.map((x) => <button key={x.choice} type="button" className="btn" onClick={() => answer(c, x.choice)}>{x.label}</button>)}</span>
      </div>
    );
  };
  const save = async (confirmed = false) => {
    setTried(true);
    if (problems.length || busy) {
      // The first field in error takes the focus; anything else shows above the button.
      const first = FIELD_ORDER.find(([, re]) => problems.some((p) => re.test(p)));
      const el = first && document.getElementById(`metric-${first[0]}`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.querySelector<HTMLElement>('input, textarea, select, button')?.focus(); } else top.current?.scrollIntoView({ block: 'start' });
      return;
    }
    if (open.length) {
      // An unanswered Check: scrolled to, and named under the button.
      setWaiting(true);
      window.setTimeout(() => { const el = document.querySelector<HTMLElement>(`[data-check="${open[0]!.field}"]`); el?.scrollIntoView({ block: 'center' }); el?.focus(); }, 0);
      return;
    }
    setWaiting(false);
    if (question && !confirmed) { setAsking(true); return; }
    if (question && (unitIs === 'scale' || (unitChanging && !unitIs) || (question.includes('meaning') && comparable === undefined) || (marking && !why.trim()))) { setWhyTried(true); return; }
    setAsking(false);
    setBusy(true);
    try {
      // The answers go with the save: the action asks the same Checks and refuses while one is open.
      const answers = Object.fromEntries(checks.flatMap((c) => (answered[c.field] && answered[c.field]!.at === valueOf(c.field) ? [[c.field, answered[c.field]!.choice]] : [])));
      // A change says so with Undo (the action's `said`), which takes back its marks too; adding one says it here.
      const name = d.name.trim() || live?.name || '';
      const said = live ? (marking || unitIs === 'label' ? `Changed ${name}. ${plural(linked.length, 'goal says', 'goals say')} so.` : `Saved ${name}`) : undefined;
      const out = await app.run('saveMetric', { ...input, answers, ...(live ? { id: live.id, ...(question ? { comparable, relabel: unitIs === 'label', ...(why.trim() ? { reason: why.trim() } : {}) } : {}) } : {}) }, said ? { said } : {}) as { metric: Metric; commit: unknown };
      clearDraft();
      if (!live) app.toast(`Added ${out.metric.name}`);
      else if (!out.commit) app.toast(`Saved ${out.metric.name}`);
      void nav(metricPath(out.metric), { replace: true });
    } catch { setBusy(false); }
  };
  const text = (k: 'name' | 'unit' | 'source' | 'sourceOwner', label: ReactNode, max: number, hint?: string, re?: RegExp, placeholder?: string) => (
    <div className="field" id={`metric-${k}`}>
      <label className="field"><span className="field-label">{label}</span>
        <input className={'input' + (re && about(re, k).length ? ' invalid' : '')} aria-invalid={re && about(re, k).length ? true : undefined} maxLength={max} value={d[k]} placeholder={placeholder} onChange={(e) => set({ [k]: e.target.value })} onBlur={leave(k)} autoFocus={k === 'name' && !field} />
      </label>
      {hint && <span className="hint">{hint}</span>}
      {re && err(re, k)}
      {k === 'name' && retiredSame && <Link className="small" to={metricPath(retiredSame)}>Open {retiredSame.name} to bring it back</Link>}
      {(k === 'name' || k === 'unit') && checkFor(k)}
      {k === 'name' && checkFor('similar')}
    </div>
  );
  const owner = app.person(d.ownerId);
  // A retired metric with this name: the form links to it, so it can be brought back rather than made twice.
  const retiredSame = d.name.trim() ? liveMetrics(app.snapshot, { retired: true }).find((v) => v.retiredAt && v.id !== live?.id && !v.name.localeCompare(d.name.trim(), 'en', { sensitivity: 'base' })) : undefined;
  const slow = d.refresh === 'monthly' || d.refresh === 'quarterly';
  return (
    <div className="focus metric-form">
      {/* A form: one closing control, top right, and no back link (navigation spec 2.5; build review of #282). */}
      <TaskHeader name={live ? 'Change a metric' : 'Add a metric'} close={{ keeps: true, dirty: touched, onClose: back }} />
      <form className="focus-body stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <div ref={top}><h1 className="qtitle big">{live ? `Change ${live.name}` : 'Add a metric'}</h1></div>
        {restored && <div className="restored small" role="status">Picked up what you hadn’t saved. <button type="button" className="linkish" onClick={() => { clearDraft(); window.location.reload(); }}>Start again</button></div>}
        {text('name', 'Name', METRIC_LIMITS.name, undefined, /metric a name|already a metric|keep the name/i)}
        <div className="metric-unit-row">
          {text('unit', 'Unit', METRIC_LIMITS.unit, 'As it follows a number: hours, %, USD, deploys', /unit/i)}
          <div className="field" id="metric-decimals">
            <label className="field"><span className="field-label">Decimal places <span className="hint">optional, 0 if left</span></span>
              <select className="input" value={d.decimals} onChange={(e) => set({ decimals: Number(e.target.value) })}>
                {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="field" id="metric-direction"><span className="field-label" id="metric-direction-l">Which way is better</span>
          <div className={'seg' + (about(/which way/i, 'direction').length ? ' invalid' : '')} role="group" aria-labelledby="metric-direction-l" aria-invalid={about(/which way/i, 'direction').length ? true : undefined}>
            {(['lower', 'higher'] as const).map((k) => <button key={k} type="button" aria-pressed={d.direction === k} onClick={() => { set({ direction: k }); leave('direction')(); }}>{DIRECTION_LABEL[k]}</button>)}
          </div>
          {err(/which way/i, 'direction')}
        </div>
        <div className="field" id="metric-meaning">
          <label className="field"><span className="field-label">What it means and how it’s calculated <span className="hint">optional</span></span>
            <textarea className="input" rows={3} maxLength={METRIC_LIMITS.text} value={d.meaning} onChange={(e) => set({ meaning: e.target.value })} onBlur={leave('meaning')} />
          </label>
          <span className="hint">What is counted, out of what or over what period, and what is left out.</span>
          {checkFor('meaning')}
        </div>
        <fieldset className="metric-later stack" style={{ gap: 'var(--s3)' }}>
          <legend className="label">How it’s calculated · can be said later</legend>
          <CalcFields calc={d.calculation} onChange={(c) => set({ calculation: c })} />
          <WindowField w={d.timeWindow} onChange={(w) => set({ timeWindow: w })} />
        </fieldset>
        <fieldset className="metric-later stack" style={{ gap: 'var(--s3)' }}>
          <legend className="label">Where the number comes from · can be said later</legend>
          {text('source', 'Source', METRIC_LIMITS.text, undefined, undefined, 'A dashboard, a query, a report')}
          <div className="field" id="metric-sourceLink">
            <label className="field"><span className="field-label">Link to the report or query</span>
              <input className="input" type="url" maxLength={QUALITY_LIMITS.link} value={d.sourceLink ?? ''} placeholder="Paste a link" onChange={(e) => set({ sourceLink: e.target.value })} />
            </label>
            <span className="hint">Without it the number can’t be checked, so the metric stays Draft.</span>
          </div>
          <details className="metric-query-field"><summary className="small">Add the query <span className="hint">optional</span></summary>
            <label className="field"><span className="field-label">Query</span><textarea className="input" rows={3} maxLength={QUALITY_LIMITS.query} value={d.sourceQuery ?? ''} onChange={(e) => set({ sourceQuery: e.target.value })} /></label>
          </details>
          {text('sourceOwner', 'Who owns that source', METRIC_LIMITS.text, undefined, undefined, 'A team or a person')}
          <div className="field" id="metric-refresh">
            <label className="field"><span className="field-label">How often it refreshes</span>
              <select className="input" value={d.refresh} onChange={(e) => set({ refresh: e.target.value as MetricRefresh | '' })}>
                <option value="">Not said</option>
                {REFRESHES.map((r) => <option key={r} value={r}>{REFRESH_LABEL[r]}</option>)}
              </select>
            </label>
            {d.refresh && <label className="field"><span className="field-label">When in the period <span className="hint">optional</span></span><input className="input" maxLength={QUALITY_LIMITS.refreshNote} value={d.refreshNote ?? ''} placeholder="Mondays" onChange={(e) => set({ refreshNote: e.target.value })} /></label>}
            {slow && <span className="hint">A goal measured by this checks in {d.refresh === 'monthly' ? 'monthly' : 'quarterly'}, after each refresh.</span>}
          </div>
          <div className="field" id="metric-measurement"><span className="field-label" id="metric-measurement-l">Is it measured today</span>
            <div className="seg" role="group" aria-labelledby="metric-measurement-l">
              {MEASUREMENTS.map((k) => <button key={k} type="button" aria-pressed={(d.measurement ?? 'measured') === k} onClick={() => set({ measurement: k })}><MeasureMark k={k} /></button>)}
            </div>
            <span className="hint">{MEASUREMENT_MEANING[d.measurement ?? 'measured']}</span>
            {(d.measurement ?? 'measured') !== 'measured' && (
              <label className="field metric-measure-note"><span className="field-label">What’s missing, and who is sorting it out <span className="hint">optional</span></span>
                <input className="input" maxLength={MEASUREMENT_NOTE_MAX} value={d.measurementNote ?? ''} placeholder="No feed from the data warehouse yet; the data team is adding one" onChange={(e) => set({ measurementNote: e.target.value })} autoFocus={field === 'measurement'} />
              </label>
            )}
          </div>
        </fieldset>
        <fieldset className="stack metric-structure-fields" style={{ gap: 'var(--s3)' }}>
          <legend className="label">Where it sits <span className="hint">optional</span></legend>
          <div className="field" id="metric-parent">
            <PickOne kind="metric" label="Part of" none="Nothing: it stands on its own" value={d.parentId || null} onChange={(id) => set({ parentId: id ?? '', ...(id ? {} : { level: '' }) })}
              hide={live ? [live.id] : []} refuse={(row) => { const o = metricsOf(app.snapshot).find((x) => x.id === row.id); return o && live ? parentRefusal({ metrics: metricsOf(app.snapshot) }, live, o) : null; }} />
            {err(/parent/i)}
          </div>
          {d.parentId && (
            <div className="field" id="metric-level"><span className="field-label" id="metric-level-l">How it relates</span>
              <div className="seg" role="group" aria-labelledby="metric-level-l">
                {LEVELS.map((k) => <button key={k} type="button" aria-pressed={d.level === k} onClick={() => set({ level: d.level === k ? '' : k })}>{LEVEL_WORDS[k].label}</button>)}
              </div>
              <span className="hint">{d.level ? LEVEL_WORDS[d.level].meaning : 'Choose one, or leave it unsaid.'}</span>
            </div>
          )}
          <div className="field" id="metric-confidence"><span className="field-label" id="metric-confidence-l">Confidence in the number</span>
            <div className="seg" role="group" aria-labelledby="metric-confidence-l">
              {CONFIDENCES.map((k) => <button key={k} type="button" aria-pressed={d.confidence === k} onClick={() => set({ confidence: d.confidence === k ? '' : k })}>{CONFIDENCE_WORDS[k].label}</button>)}
            </div>
            <span className="hint">{d.confidence ? CONFIDENCE_WORDS[d.confidence].meaning : 'Not said.'}</span>
          </div>
          <label className="field" id="metric-gaming-field"><span className="field-label">How it could be gamed</span>
            <textarea className="input" rows={2} maxLength={GAMING_MAX} value={d.gaming ?? ''} placeholder="Deploying tiny changes to raise the count without shipping more" onChange={(e) => set({ gaming: e.target.value })} />
            {err(/gamed/i)}
          </label>
        </fieldset>
        <div className="field" id="metric-owner">
          <PickOne kind="person" label="Owner" value={d.ownerId || null} onChange={(id) => set({ ownerId: id ?? '' })} invalid={about(/owner isn’t/i).length > 0} />
          <span className="hint">{owner && owner.id === app.viewer.id ? `${owner.name} (you). ` : ''}Answers for what it means. Can change it and retire it.</span>
          {err(/owner isn’t/i)}
        </div>
        <div className="field" id="metric-caveats">
          <label className="field"><span className="field-label">Caveats <span className="hint">optional</span></span>
            <textarea className="input" rows={2} maxLength={METRIC_LIMITS.text} value={d.caveats} onChange={(e) => set({ caveats: e.target.value })} />
          </label>
        </div>
        {/* Anything else the rule says (a length, decimals), together above the button. */}
        {tried && <div className="stack">{problems.filter((p) => !FIELD_PROBLEM.test(p)).map((p) => <div key={p} className="level-block level-fix" role="alert"><span className="level-head"><WarnMark /><span className="level-word">Must fix</span></span><span>{p}</span></div>)}</div>}
        {asking && question && live && (
          <ChangeReadBack before={live} after={next} kinds={question} linked={linked} unitChanging={unitChanging} comparable={comparable} setComparable={setComparable} unitIs={unitIs} setUnitIs={setUnitIs} why={why} setWhy={setWhy} tried={whyTried} marking={marking}
            onSave={() => void save(true)} onClose={() => setAsking(false)} onKeep={() => { setAsking(false); setComparable(undefined); setUnitIs(undefined); setWhy(''); setWhyTried(false); set({ unit: live.unit, direction: live.direction, meaning: live.meaning, source: live.source, decimals: live.decimals }); }} />
        )}
        <StillNeeded metric={next} ownerIsHere={!!ownerName(app.snapshot.people, next)} />
        <div className="stack metric-foot" style={{ gap: 'var(--s1)' }}>
          {checkFor('lapse')}
        </div>
        <FormFooter status={count || undefined}><button className="btn primary big-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : live ? 'Save metric' : 'Add metric'}</button></FormFooter>
        {waiting && open.length > 0 && <FixLine>Answer the question above first.</FixLine>}
      </form>
    </div>
  );
}

/** The change read-back (MT3, spec 2.2): what a change does to the goals a metric measures, before it is saved. A sheet,
    so it takes the focus, scrolls on a phone and is the one primary action while it is open. */
function ChangeReadBack(p: {
  before: Metric; after: Metric; kinds: string[]; linked: { title: string; decimals: number; aimsUp: boolean | null }[]; unitChanging: boolean;
  comparable: boolean | undefined; setComparable: (v: boolean) => void; unitIs: 'label' | 'scale' | undefined; setUnitIs: (v: 'label' | 'scale') => void;
  why: string; setWhy: (v: string) => void; tried: boolean; marking: boolean; onSave: () => void; onKeep: () => void; onClose: () => void;
}) {
  const { before: b, after: a, kinds, linked } = p;
  const n = linked.length;
  const meaning = kinds.includes('meaning');
  const sourceOnly = meaning && b.meaning.trim() === a.meaning.trim();
  const title = meaning ? (sourceOnly ? `Change where “${b.name}” comes from?` : `Change what “${b.name}” means?`) : p.unitChanging ? `Change “${b.unit}” to “${a.unit}” on ${b.name} and its ${plural(n, 'goal', 'goals')}?` : kinds.includes('direction') ? `Change which way is better for ${b.name}?` : `Change the decimal places of ${b.name}?`;
  const wrong = kinds.includes('direction') ? linked.filter((g) => g.aimsUp != null && (g.aimsUp ? 'higher' : 'lower') !== a.direction) : [];
  const more = linked.filter((g) => g.decimals > a.decimals);
  const names = goalNames(linked.map((g) => g.title));
  const primary = kinds.filter((k) => k !== 'words').length > 1 ? 'Save these changes' : meaning ? (sourceOnly ? 'Change the source' : 'Change the meaning') : p.unitChanging ? 'Change the unit' : kinds.includes('direction') ? 'Change the direction' : 'Save changes';
  return (
    <Sheet open onClose={p.onClose} title={title}>
    <div className="metric-readback stack" style={{ gap: 'var(--s3)' }}>
      {meaning && (
        <>
          <dl className="metric-facts">
            <dt>Was</dt><dd>{sourceOnly ? b.source || 'Not said' : b.meaning || 'Not said'}</dd>
            <dt>Will be</dt><dd><strong>{sourceOnly ? a.source || 'Not said' : a.meaning || 'Not said'}</strong></dd>
          </dl>
          <fieldset className="stack" style={{ gap: 'var(--s1)' }}>
            <legend className="label">Is it still the same number?</legend>
            <label className="row"><input type="radio" name="comparable" checked={p.comparable === true} onChange={() => p.setComparable(true)} /> Same number, better words <span className="hint">Nothing is marked.</span></label>
            <label className="row"><input type="radio" name="comparable" checked={p.comparable === false} onChange={() => p.setComparable(false)} /> The number itself changes, from this week <span className="hint">Earlier weeks were measured the old way, and every goal says so.</span></label>
            {p.tried && p.comparable === undefined && <FixLine>Say whether it is still the same number.</FixLine>}
          </fieldset>
        </>
      )}
      {p.unitChanging && (
        <fieldset className="stack" style={{ gap: 'var(--s1)' }}>
          <legend className="label">{plural(n, 'goal is', 'goals are')} measured by {b.name} in {b.unit}. Is “{a.unit}” a new label for the same numbers, or a different scale?</legend>
          <label className="row"><input type="radio" name="unit-is" checked={p.unitIs === 'label'} onChange={() => p.setUnitIs('label')} /> A new label: change it on the goals too</label>
          <label className="row"><input type="radio" name="unit-is" checked={p.unitIs === 'scale'} onChange={() => p.setUnitIs('scale')} /> A different scale</label>
          {p.unitIs === 'scale' && <FixLine>A metric in {a.unit} is a different number. Add it as a new metric and move goals to it, or retire this one.</FixLine>}
          {p.unitIs === 'label' && <p className="small">{plural(n, 'goal', 'goals')} will show “{a.unit}” instead of “{b.unit}”. No number changes.</p>}
        </fieldset>
      )}
      {kinds.includes('direction') && <p className="small">{wrong.length ? `For ${wrong.length} of its ${plural(n, 'goal', 'goals')} the target now lies the wrong way: ${goalNames(wrong.map((g) => g.title))}. Each will show a Check until its owner has looked.` : `All ${plural(n, 'goal', 'goals')} already aim that way.`}</p>}
      {kinds.includes('decimals') && more.length > 0 && <p className="small">{plural(more.length, 'goal shows', 'goals show')} more decimal places than {b.name} will: {goalNames(more.map((g) => g.title))}. They keep theirs until their owners change them.</p>}
      {p.marking && (
        <label className="field">
          <span className="label">Why <span className="hint">Required</span></span>
          <textarea rows={2} maxLength={300} value={p.why} onChange={(e) => p.setWhy(e.target.value)} aria-invalid={p.tried && !p.why.trim()} />
          {p.tried && !p.why.trim() && <FixLine>Say why, in a line. Every goal measured by it will show this.</FixLine>}
        </label>
      )}
      <div className="small stack" style={{ gap: 'var(--s1)' }}>
        <strong>{plural(n, 'goal is', 'goals are')} measured by it</strong>
        <span>{names}</span>
        <span>{p.marking ? `Each goal’s chart and History will say “${meaning && p.comparable === false ? 'Definition' : 'Direction'} changed”, with your reason. Their numbers and plans don’t change.` : meaning && p.comparable === true ? 'Nothing changes on these goals but the words they show.' : ''}</span>
      </div>
      <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={p.onKeep}>Keep it as it was</button><button type="button" className="btn primary big-btn" disabled={p.unitIs === 'scale'} onClick={p.onSave}>{primary}</button></div>
    </div>
    </Sheet>
  );
}

/** MQ2 sketch 12: adding a metric shows the similar one first, as a card: its name and stage, its meaning, where it
    comes from, who owns it and how many goals it measures, with Use this one and It’s different, carry on. The words
    of the check (rulesDefine.ts) stay the card's label, so the import and MCP say the same. */
function SimilarCheck({ c, waiting, onAnswer }: { c: MetricCheck; waiting: boolean; onAnswer: (choice: string) => void }) {
  const app = useApp();
  const id = c.answers.find((a) => a.choice.startsWith('use:'))?.choice.slice(4);
  const row = id ? findMetrics(libraryReads(app.snapshot, app.stamp()), { size: 100_000 }).rows.find((r) => r.metric.id === id) : undefined;
  if (!row) return null;
  const m = row.metric;
  const n = row.goalIds.length;
  const from = [m.source.trim(), row.owner ?? '', `measures ${n} ${n === 1 ? 'goal' : 'goals'}`].filter(Boolean).join(' · ');
  return (
    <div className={'level-block level-check metric-check metric-similar' + (waiting ? ' level-alert' : '')} role="group" aria-labelledby="metric-check-similar" aria-describedby="metric-similar-card" tabIndex={-1} data-check="similar">
      <span className="level-head"><WarnMark /><span className="level-word">Check</span></span>
      <strong id="metric-check-similar" className="level-q">A similar metric in the library</strong>
      <div id="metric-similar-card" className="metric-box stack" data-part="Similar metric">
        <p className="metric-box-head metric-similar-name"><Link to={metricPath(m)} target="_blank" rel="noreferrer">{m.name}</Link> <StageMark k={row.stage.stage} /></p>
        {m.meaning.trim() && <p className="small">{m.meaning.trim()}</p>}
        <p className="small hint">{from}</p>
      </div>
      <span className="level-actions">{c.answers.map((x) => <button key={x.choice} type="button" className="btn" onClick={() => onAnswer(x.choice)}>{x.label}</button>)}</span>
      <span className="small hint">Matched on name, source and meaning. The same check runs on a spreadsheet import and through MCP.</span>
    </div>
  );
}
