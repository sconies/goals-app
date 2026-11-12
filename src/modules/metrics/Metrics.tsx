/* The metric library as a place (ML1, docs/design/metrics/spec.md sections 1, 2.1, 2.2): every metric in one list with
   the list bar, and a page per metric with what it means and every goal measured by it side by side. Reading is open to
   everyone; the controls that change a metric are shown only to its owner and admins, and the rules (rules.ts) still
   decide.
     /metrics               the library: find, filter and sort, 50 a page; anyone adds a metric
     /metrics/<id>          a metric: its meaning, its goals as a table, its facts, what it needs; its owner changes it
     /metrics/new           add a metric (focus mode)
     /metrics/<id>/edit     change a metric (focus mode)
   What is listed and in what order, a metric's goals and what it needs come from rulesLibrary.ts (rules 1 to 3). */
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
import { Icon } from '../../ui/Icon';
import { CountLine, FilterLine, ListBar, ListSearch, NoneFound, SortMenu } from '../../ui/ListBar';
import { MenuButton } from '../../ui/MenuButton';
import { PickOne } from '../../ui/Pick';
import { useWidth } from '../../ui/useWidth';
import { canEditMetric, DIRECTION_LABEL, metricChangeQuestion, linksOf, METRIC_LIMITS, metricFrom, metricProblems, metricsOf, REFRESH_LABEL, REFRESHES, type Metric, type MetricDirection, type MetricInput, type MetricRefresh } from './rules';
import { decimalsWords, directionWords, findMetrics, goalsByStatus, LIBRARY_PAGE, LIBRARY_SORTS, metricAt, metricNeeds, metricPath, movedMetrics, needsLine, ownerName, summaryLine, unitsInUse, type LibraryAsk, type LibrarySort, type MetricGoalRow } from './rulesLibrary';
import { checkReads, goalsOfMetric, libraryReads, lineOf } from './reads';
import { countLine, metricChecks, STILL_FIELD, stillToSay, unitChecks, type CheckField, type MetricCheck } from './rulesDefine';
import { CheckSaid, FixLine } from '../../ui/Levels';
import './metrics.css';

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
  const sort = (LIBRARY_SORTS.find(([k]) => k === params.get('sort'))?.[0] ?? 'name') as LibrarySort;
  const page = Number(params.get('page') ?? 1) || 1;
  const ask: LibraryAsk = { q, unit, teamId, ownerId, dir, unused, sortout, sort, page };
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
    ...(sortout ? [{ key: 'sortout', label: 'Something to sort out', values: ['yes'] }] : []),
  ];
  const clearFilters = () => set({ unit: null, team: null, owner: null, dir: null, unused: null, sortout: null });
  const unitMenu = <MenuButton label="Unit" display={`Unit: ${unit || 'any'}`} items={[{ label: 'Any unit', current: !unit, onClick: () => set({ unit: null }) }, ...unitsInUse(reads.metrics).map((u) => ({ label: u, current: u === unit, onClick: () => set({ unit: u }) }))]} />;
  const teamMenu = <MenuButton label="Used by" display={`Used by: ${teamId ? teamName(teamId) : 'any team'}`} items={[{ label: 'Any team', current: !teamId, onClick: () => set({ team: null }) }, { label: 'The whole company', current: teamId === 'company', onClick: () => set({ team: 'company' }) }, ...usedBy.map((t) => ({ label: t.name, current: t.id === teamId, onClick: () => set({ team: t.id }) }))]} />;
  const sortMenu = <SortMenu options={LIBRARY_SORTS} value={sort} onSort={(v) => set({ sort: v === 'name' ? null : v })} />;
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
      <label className="check"><input type="checkbox" checked={sortout} onChange={(e) => set({ sortout: e.target.checked ? '1' : null })} /><span>Something to sort out</span></label>
    </div>
  );
  if (moved) return <Navigate to={moved} replace />;
  const filtered = parts.length > 0;
  const order = LIBRARY_SORTS.find(([k]) => k === sort)?.[1] ?? 'A to Z';
  return (
    <div className="page metrics-page" ref={ref}>
      <div className="page-head metrics-head">
        <div className="row between metrics-title">
          <h1 className="title-xl">Metrics</h1>
          {/* The empty library has its own Add a metric: one primary action a screen. */}
          {metricsOf(app.snapshot).some((x) => !x.removedAt) && <Link className="btn primary" to="/metrics/new">Add a metric</Link>}
        </div>
        <span className="hint">Each number goals are measured by, defined once, so two teams’ “build time” mean the same thing.</span>
      </div>
      {live > 0 && (
        <ListBar search={<ListSearch value={q} onSearch={(t, change) => set({ q: t || null }, change !== 'started')} label="Find a metric" placeholder="Find by name, unit, owner or meaning" autoFocus />}>
          {!narrow && unitMenu}
          {!narrow && teamMenu}
          <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setFiltering(true)}>Filters{parts.length ? ` · ${parts.length}` : ''}</button>
          {!narrow && sortMenu}
        </ListBar>
      )}
      {live > 0 && <CountLine things={METRICS} n={found.total} narrowed={!!q.trim() || filtered} order={order} shown={found.total > LIBRARY_PAGE ? { from: found.from, to: found.to } : null} />}
      <FilterLine parts={parts} onRemove={(key) => set({ [key]: null })} onClear={clearFilters} />
      {live === 0 && <EmptyLibrary />}
      {live > 0 && !found.total && (sortout && parts.length === 1 && !q.trim()
        ? <p className="hint" role="status">Nothing to sort out. Every metric has a meaning, a source and an owner, and a goal that uses it. <button type="button" className="linkish" onClick={clearFilters}>Clear filters</button></p>
        : <>
          <NoneFound things={METRICS} q={q} filtered={filtered} onClearSearch={() => set({ q: null })} onClearFilters={clearFilters} />
          {q.trim() && <p><Link to={`/metrics/new?name=${encodeURIComponent(q.trim())}`}>Add “{q.trim()}” as a new metric</Link></p>}
        </>)}
      {found.total > 0 && (
        <ul className="metric-list" aria-label="Metrics">
          {found.rows.map((r) => <li key={r.metric.id}><MetricRow metric={r.metric} owner={r.owner} goalIds={r.goalIds} needs={canEditMetric(app.viewer, r.metric) ? needsLine(r.needs) : ''} /></li>)}
        </ul>
      )}
      {found.pages > 1 && (
        <nav className="metric-pages row" aria-label="Pages">
          <span className="hint">{found.from} to {found.to} of {found.total}</span>
          {found.page > 1 && <Link className="btn sm" to={`?${pageParams(params, found.page - 1)}`}>Previous {LIBRARY_PAGE}</Link>}
          {found.page < found.pages && <Link className="btn sm" to={`?${pageParams(params, found.page + 1)}`}>Next {Math.min(LIBRARY_PAGE, found.total - found.to)}</Link>}
        </nav>
      )}
      <Sheet open={filtering} onClose={() => setFiltering(false)} title="Filters">{more}</Sheet>
    </div>
  );
}

const pageParams = (params: URLSearchParams, page: number) => { const n = new URLSearchParams(params); if (page > 1) n.set('page', String(page)); else n.delete('page'); return n.toString(); };

function EmptyLibrary() {
  return <EmptyResult title="No metrics yet." action={<Link className="btn primary" to="/metrics/new">Add a metric</Link>}>A metric says exactly what a number means, so every goal that uses it means the same thing.</EmptyResult>;
}

/** A metric in the library: a link to it, its unit, direction and owner, its goals by status, and (for its owner and
    admins) the first thing to sort out. */
function MetricRow({ metric: m, owner, goalIds, needs }: { metric: Metric; owner: string | null; goalIds: string[]; needs: string }) {
  const app = useApp();
  const statuses = goalIds.map((id) => app.goal(id)).filter((g) => !!g).map((g) => app.statusOf(g!).status);
  return (
    <Link className="metric-row" to={metricPath(m)}>
      <span className="metric-text">
        <span className="metric-name">{m.name}</span>
        <span className="hint">{m.unit} · {directionWords(m.direction)} · {owner ? `owned by ${owner}` : 'no owner'}</span>
      </span>
      <span className="metric-side small">
        {statuses.length ? <StatusCounts statuses={statuses} label={`${m.name}’s goals`} /> : <span className="metric-none">No goals yet</span>}
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
  const [removing, setRemoving] = useState(false);
  const all = metricsOf(app.full ?? app.snapshot);
  const m = metricAt(all, metricId);
  if (!m) {
    return (
      <div className="page metric-page">
        <BackLink to="/metrics" label="Metrics" />
        <div className="page-head row between">
          <div className="stack" style={{ gap: 4 }}>
            <h1 className="title-xl">Metric not found</h1>
            <span className="hint">There’s no metric at this address in {wsName(app.ws)}.</span>
          </div>
          <Link className="btn primary" to="/metrics">See all metrics</Link>
        </div>
      </div>
    );
  }
  if (m.removedAt) return <RemovedMetric metric={m} />;
  const edit = canEditMetric(app.viewer, m);
  const owner = app.person(m.ownerId);
  const ownerLive = ownerName(reads.people, m);
  const rows = goalsOfMetric(app.snapshot, app.cycle, app.today, app.week, m.id);
  const line = summaryLine(rows);
  const needs = edit ? metricNeeds(m, reads) : [];
  const by = (id: string, at: string) => `by ${app.person(id)?.name ?? 'someone who has left'} on ${dateOf(at)}`;
  const one = rows.length === 1 ? rows[0]! : null;
  return (
    <div className="page metric-page">
      <BackLink to="/metrics" label="Metrics" />
      <div className="page-head row between metric-head">
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h1 className="title-xl">{m.name}</h1>
          <span className="hint">{m.unit}, {decimalsWords(m.decimals)} · {directionWords(m.direction)} · {ownerLive && owner ? <>owned by <Link to={`/people/${encodeURIComponent(owner.id)}`}>{owner.name}</Link></> : 'no owner'} · <StillLine metric={m} links={edit} /></span>
        </div>
        {/* Goals, filtered to this metric (the module's Goals filter, ?metric=): the same goals as the table below (N16). */}
        {rows.length > 0 && <Link className="btn primary" to={`/goals?scope=all&metric=${encodeURIComponent(m.id)}`}>{one ? 'See its goal' : `See its ${rows.length} goals`}</Link>}
      </div>
      <section className="stack metric-meaning" style={{ gap: 4 }} aria-labelledby="metric-meaning">
        <h2 className="label" id="metric-meaning">What it means and how it’s calculated</h2>
        {m.meaning ? <p className="metric-prose">{m.meaning}</p> : <p className="hint">Not said yet.{edit && <> <Link to={`${metricPath(m)}/edit?field=meaning`}>Say what it means</Link></>}</p>}
      </section>
      <section className="stack" id="goals" style={{ gap: 'var(--s2)' }} aria-labelledby="metric-goals">
        <h2 className="label" id="metric-goals">Goals measured by it · {rows.length}</h2>
        {rows.length ? <GoalsTable rows={rows} /> : <p className="hint">No goal uses this metric yet. A goal’s owner links it under “Measured by” when they make or change the goal.</p>}
        {line && <p className="small metric-summary">{line}</p>}
      </section>
      <dl className="metric-facts">
        <dt>Where the number comes from</dt><dd>{m.source || 'Not said'}</dd>
        <dt>Who owns that source</dt><dd>{m.sourceOwner || 'Not said'}</dd>
        <dt>How often it refreshes</dt><dd>{m.refresh ? REFRESH_LABEL[m.refresh] : 'Not said'}</dd>
        {m.caveats && <><dt>Caveats</dt><dd>{m.caveats}</dd></>}
        <dt>Added</dt><dd>{by(m.createdBy, m.createdAt)}</dd>
        <dt>Last changed</dt><dd>{by(lastChangedBy(app.snapshot.changes, m), m.updatedAt)}</dd>
      </dl>
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
          <div className="row"><Link className="btn" to={`${metricPath(m)}/edit`}>Change this metric</Link></div>
          <div className="people-admin-quiet"><button type="button" className="btn ghost" onClick={() => setRemoving(true)}>Remove this metric…</button></div>
        </section>
      ) : <p className="hint">{ownerLive && owner ? `${owner.name} or an admin can change this.` : 'An admin can change this.'}</p>}
      {removing && <RemoveMetricSheet metric={m} rows={rows} onClose={() => setRemoving(false)} onRemoved={() => void nav('/metrics')} />}
    </div>
  );
}

/** Rule 1's line under a metric's title: “Fully defined”, or what it still needs to say. For its owner and admins each item
    opens the form at its field. Words only: never a number or a bar. */
function StillLine({ metric: m, links }: { metric: Metric; links: boolean }) {
  const app = useApp();
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
    try { await app.run('removeMetric', { metricId: m.id }, { said: `Removed ${m.name}` }); onClose(); onRemoved(); } catch { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Remove “${m.name}”?`}>
      <div className="stack" style={{ gap: 'var(--s4)' }}>
        <p className="small">{rows.length ? `${plural(rows.length, 'goal stops', 'goals stop')} being measured by it: ${titles.join(', ')}${rest ? ` and ${rest} more` : ''}. They keep their numbers and plans.` : 'No goal uses it.'}</p>
        <p className="small">You can put it back for 30 days from Recently removed.</p>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={onClose}>Cancel</button><button className="btn danger big-btn" type="button" disabled={busy} onClick={() => void go()}>{busy ? 'Removing…' : 'Remove the metric'}</button></div>
      </div>
    </Sheet>
  );
}

/* ---------- add or change a metric (/metrics/new, /metrics/<id>/edit) ---------- */

/** The rule's messages shown under their own field; the rest go above the button. */
const FIELD_PROBLEM = /metric a name|already a metric|keep the name|unit|which way|owner isn’t/i;
/** The fields the rule can find wrong, in the form's order, each with the words its problems use. */
const FIELD_ORDER: [string, RegExp][] = [['name', /metric a name|already a metric|keep the name/i], ['unit', /unit/i], ['direction', /which way/i], ['owner', /owner isn’t/i]];
/** Where a metric's form keeps its draft: one for a new metric, one for each metric being changed. */
const metricDraftKey = (ws: string, id: string | null) => `${ws}:metric:${id ?? 'new'}`;

type Draft = { name: string; meaning: string; unit: string; decimals: number; direction: MetricDirection | ''; source: string; sourceOwner: string; refresh: MetricRefresh | ''; ownerId: string; caveats: string };

export function MetricForm() {
  const app = useApp();
  const nav = useNavigate();
  const { metricId } = useParams();
  const [params] = useSearchParams();
  const before = metricId ? metricAt(metricsOf(app.snapshot), metricId) ?? null : null;
  const live = before && !before.removedAt ? before : null;
  // Kept as other drafts are (src/app/drafts.ts): Close, Back or a reload never loses what was typed.
  const [d, set, clearDraft, restored] = useDraft<Draft>(metricDraftKey(app.ws.id, live?.id ?? null), () => live
    ? { name: live.name, meaning: live.meaning, unit: live.unit, decimals: live.decimals, direction: live.direction, source: live.source, sourceOwner: live.sourceOwner, refresh: live.refresh ?? '', ownerId: live.ownerId, caveats: live.caveats }
    : { name: (params.get('name') ?? '').slice(0, METRIC_LIMITS.name), meaning: '', unit: '', decimals: 0, direction: '', source: '', sourceOwner: '', refresh: '', ownerId: app.viewer.id, caveats: '' });
  const [tried, setTried] = useState(false);
  // Fields left once: their errors show from then on, not while the first thing is being typed.
  const [left, setLeft] = useState<Set<string>>(() => new Set());
  const leave = (k: string) => () => setLeft((x) => (x.has(k) ? x : new Set(x).add(k)));
  const [busy, setBusy] = useState(false);
  // Changing the unit or direction goals use is asked first (spec 2.3).
  const [asking, setAsking] = useState(false);
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
        <div className="focus-top"><BackLink to={metricPath(live)} label={live.name} /><span /></div>
        <div className="focus-body"><h1 className="qtitle big">Change {live.name}</h1><p>Only {app.person(live.ownerId)?.name ?? 'its owner'} or an admin can change this metric.</p></div>
      </div>
    );
  }
  const input: MetricInput = { name: d.name, meaning: d.meaning, unit: d.unit, decimals: d.decimals, direction: (d.direction || undefined) as MetricDirection, source: d.source, sourceOwner: d.sourceOwner, refresh: d.refresh || null, ownerId: d.ownerId, caveats: d.caveats };
  const next = metricFrom(input, live, { actor: app.viewer, now: app.stamp(), newId });
  const problems = metricProblems(next, app.snapshot);
  const shows = (k?: string) => tried || (!!k && left.has(k));
  const about = (re: RegExp, k?: string) => (shows(k) ? problems.filter((p) => re.test(p)) : []);
  // A Must fix under its field (spec 2.1): outlined on every side and washed, the warning mark and “Must fix”.
  const err = (re: RegExp, k?: string) => about(re, k).map((p) => <div key={p} className="level-block level-fix" role="alert"><span className="level-head"><WarnMark /><span className="level-word">Must fix</span></span><span>{p}</span></div>);
  // Rule 1's questions (rulesDefine.ts): a close name, a unit spelt another way, a share that doesn't say out of what.
  const checks = metricChecks({ id: live?.id ?? '', name: d.name, unit: d.unit, meaning: d.meaning }, live, checkReads(app.snapshot));
  const valueOf = (f: CheckField) => d[f].trim();
  const open = checks.filter((c) => !(answered[c.field] && answered[c.field]!.at === valueOf(c.field)));
  const shownChecks = open.filter((c) => shows(c.field));
  const shownFixes = problems.filter((p) => tried || FIELD_ORDER.some(([k, re]) => left.has(k) && re.test(p)));
  const count = countLine(shownFixes.length, shownChecks.length);
  const still = stillToSay(next, true);
  // The goals the metric measures now, and how many of them a new unit or direction would set apart (linkProblems).
  const question = live ? metricChangeQuestion(live, next, app.snapshot.goals, linksOf(app.snapshot)) : null;
  const back = () => void nav(live ? metricPath(live) : '/metrics');
  const answer = (c: MetricCheck, choice: string) => {
    if (choice.startsWith('use:')) { const m = metricsOf(app.snapshot).find((x) => x.id === choice.slice(4)); if (m) void nav(metricPath(m)); return; }
    if (c.field === 'unit' && choice === 'use') { const u = unitChecks(d.unit, unitsInUse(metricsOf(app.snapshot).filter((m) => m.id !== live?.id))); if (u) set({ unit: u.use }); return; }
    setAnswered((a) => ({ ...a, [c.field]: { choice, at: valueOf(c.field) } }));
  };
  const said = (f: CheckField) => (f === 'name' ? 'You said: mine is different.' : f === 'unit' ? `You said: keep “${d.unit.trim()}”.` : 'You said: it’s right as written.');
  const checkFor = (f: CheckField) => {
    const c = checks.find((x) => x.field === f);
    if (!c) return null;
    const a = answered[f];
    if (a && a.at === valueOf(f)) return <CheckSaid onChange={() => setAnswered((x) => { const y = { ...x }; delete y[f]; return y; })}>{said(f)}</CheckSaid>;
    if (!shows(f)) return null;
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
    setAsking(false);
    setBusy(true);
    try {
      const out = await app.run('saveMetric', live ? { ...input, id: live.id, ...(confirmed ? { confirm: true } : {}) } : input) as { metric: Metric };
      clearDraft();
      app.toast(live ? `Saved ${out.metric.name}` : `Added ${out.metric.name}`);
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
      {(k === 'name' || k === 'unit') && checkFor(k)}
    </div>
  );
  const owner = app.person(d.ownerId);
  const slow = d.refresh === 'monthly' || d.refresh === 'quarterly';
  return (
    <div className="focus metric-form">
      <div className="focus-top">
        <BackLink to={live ? metricPath(live) : '/metrics'} label={live ? live.name : 'Metrics'} />
        <span />
        <button className="iconbtn" type="button" onClick={back} aria-label="Close and keep the draft"><Icon name="close" /></button>
      </div>
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
          <legend className="label">Where the number comes from · can be said later</legend>
          {text('source', 'Source', METRIC_LIMITS.text, undefined, undefined, 'A dashboard, a query, a report')}
          {text('sourceOwner', 'Who owns that source', METRIC_LIMITS.text, undefined, undefined, 'A team or a person')}
          <div className="field" id="metric-refresh">
            <label className="field"><span className="field-label">How often it refreshes</span>
              <select className="input" value={d.refresh} onChange={(e) => set({ refresh: e.target.value as MetricRefresh | '' })}>
                <option value="">Not said</option>
                {REFRESHES.map((r) => <option key={r} value={r}>{REFRESH_LABEL[r]}</option>)}
              </select>
            </label>
            {slow && <span className="hint">Check-ins here are weekly. Most weeks a goal measured by this will have no new number, and that is fine.</span>}
          </div>
        </fieldset>
        <div className="field" id="metric-owner">
          <PickOne kind="person" label="Owner" value={d.ownerId || null} onChange={(id) => set({ ownerId: id ?? '' })} invalid={about(/owner isn’t/i).length > 0} />
          <span className="hint">{owner && owner.id === app.viewer.id ? `${owner.name} (you). ` : ''}Answers for what it means. Can change it and remove it.</span>
          {err(/owner isn’t/i)}
        </div>
        <div className="field" id="metric-caveats">
          <label className="field"><span className="field-label">Caveats <span className="hint">optional</span></span>
            <textarea className="input" rows={2} maxLength={METRIC_LIMITS.text} value={d.caveats} onChange={(e) => set({ caveats: e.target.value })} />
          </label>
        </div>
        {/* Anything else the rule says (a length, decimals), together above the button. */}
        {tried && <div className="stack">{problems.filter((p) => !FIELD_PROBLEM.test(p)).map((p) => <div key={p} className="level-block level-fix" role="alert"><span className="level-head"><WarnMark /><span className="level-word">Must fix</span></span><span>{p}</span></div>)}</div>}
        {asking && question && (
          <div className="restored small stack" role="alertdialog" aria-labelledby="metric-confirm" style={{ gap: 'var(--s2)' }}>
            <span id="metric-confirm">{question.text}</span>
            <span className="row"><button type="button" className="btn sm" onClick={() => void save(true)}>Change it</button><button type="button" className="btn ghost sm" onClick={() => { setAsking(false); set({ unit: live!.unit, direction: live!.direction }); }}>Keep it as it was</button></span>
          </div>
        )}
        <div className="stack metric-foot" style={{ gap: 'var(--s1)' }}>
          {count && <p className="small metric-count" role="status">{count}</p>}
          <p className="small metric-still">{still.line}</p>
        </div>
        <div className="foot-row"><button className="btn ghost big-btn" type="button" onClick={back}>Cancel</button><button className="btn primary big-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : live ? 'Save changes' : 'Add the metric'}</button></div>
        {waiting && open.length > 0 && <FixLine>Answer the question above first.</FixLine>}
      </form>
    </div>
  );
}
