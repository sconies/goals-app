import { useState } from 'react';
import { useOlderChanges } from '../app/history';
import { useSearchParams } from 'react-router';
import { saveAndSay } from '../app/files';
import { useApp } from '../app/state';
import { useModules } from '../core/app';
import { watchingOn } from '../app/reads';
import {
  ACTIVITY_KEYS, ACTIVITY_KINDS, activityEntries, foldImports, activityParts, activityFilter, activityRows, activityWords, describeActivity, EMPTY_ACTIVITY, kindOf, parseActivity, WHEN_OPTIONS, withoutActivity,
  type ActivityQuery, type When,
} from '../domain/activity';
import { toCsv } from '../domain/export';
import { levelIds, levelName } from '../domain/levels';
import { watchedGoals } from '../domain/review';
import type { Change, Level } from '../domain/types';
import { Avatar, Sheet } from '../ui/bits';
import { ChangeItem } from '../ui/ChangeItem';
import { historyStep, nearMiss, type ListChange } from '../domain/find';
import { CountLine, FilterLine, ListSearch, NoneFound } from '../ui/ListBar';
import { Pick, PickOne } from '../ui/Pick';

function dayLabel(iso: string, today: Date) {
  const d = new Date(iso);
  const days = Math.round((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

/** The query in the link: every change builds on the link as it is now. */
/** A choice adds a history entry; typing in the search replaces it until it settles (find spec, rule 4). */
function useActivityQuery(): [ActivityQuery, (f: (a: ActivityQuery) => ActivityQuery, change?: ListChange) => void] {
  const [params, setParams] = useSearchParams();
  const a = parseActivity(params);
  const set = (f: (a: ActivityQuery) => ActivityQuery, change: ListChange = 'choice') => setParams((cur) => {
    const next = f(parseActivity(cur));
    return new URLSearchParams([...[...cur].filter(([k]) => !ACTIVITY_KEYS.includes(k)), ...activityEntries(next)]);
  }, { replace: historyStep(change) === 'replace' });
  return [a, set];
}
const CHANGES = { thing: 'change', things: 'changes' };

/**
 * The change log: every save, by whom and when, newest first. Drafts never appear here. Filter it by who, which goal
 * or tree, team, level, kind of change, dates and words; all of it is in the link, and the result saves as a CSV.
 */
export function Activity() {
  const app = useApp();
  const [a, setA] = useActivityQuery();
  const [limit, setLimit] = useState(40);
  const [open, setOpen] = useState(false);
  // Arriving from Watching keeps its scope: the goals you watch (at a level, if one was picked). With Watching switched
  // off a link's watching= narrows nothing and says nothing (SW1; build review of #444), as inreview= does with Reviews off.
  const watching = watchingOn(useModules().on) ? a.watching : null;
  const level = watching && watching !== 'all' ? (watching as Level) : null;
  const watched = watching != null ? new Set(watchedGoals(app.viewer.id, app.snapshot).filter((g) => !level || g.level === level).map((g) => g.id)) : null;
  // The load holds about a year of changes (AX5 part 2b); older ones are paged in on request, below the rest.
  const older = useOlderChanges();
  const loaded = [...app.snapshot.changes].reverse();
  const all = older.older.length ? [...loaded, ...older.older].sort((x, y) => Date.parse(y.at) - Date.parse(x.at)) : loaded;
  const base = { ...a, kind: [] as ActivityQuery['kind'] };
  const ctx = { snapshot: app.snapshot, cycle: app.cycle, week: app.week, watched };
  const found = all.filter(activityFilter(base, ctx));
  // A search that finds nothing tries a near miss (find rule 5), as Goals does: those changes are shown, and said so.
  const near = !found.length && a.q.trim() ? nearMiss(a.q, all.map((c) => activityWords(c, app.person(c.actorId)?.name ?? '', (c.goalId && app.goal(c.goalId)?.title) || ''))) : null;
  const inScope = near ? all.filter(activityFilter({ ...base, q: near }, ctx)) : found;
  const list = a.kind.length ? inScope.filter((c) => a.kind.includes(kindOf(c))) : inScope;
  // An import is one entry, its rows folded under it (import spec 2.7); search still finds a row on its own.
  const folded = foldImports(list);
  const shown = folded.top.slice(0, limit);
  const groups: [string, Change[]][] = [];
  for (const c of shown) {
    const k = dayLabel(c.at, app.today);
    const last = groups[groups.length - 1];
    if (last && last[0] === k) last[1].push(c);
    else groups.push([k, [c]]);
  }
  const chips = describeActivity(a, app.snapshot, app.cycle, app.week);
  const parts = activityParts(a, { person: (id) => app.person(id)?.name ?? id, goal: (id) => app.goal(id)?.title ?? 'a goal', team: (id) => app.team(id)?.name ?? id }, chips.find((c) => c.key === 'when')?.text ?? '');
  const scopeText = watching != null ? `Goals you watch${level ? ` (${levelName(app.cycle, level)})` : ''}${a.since ? ` · since ${new Date(a.since + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''}` : '';
  const counts = new Map(ACTIVITY_KINDS.map(([k]) => [k, inScope.filter((c) => kindOf(c) === k).length]));
  const narrowed = chips.length > 0 || watching != null;
  const saveCsv = () => {
    void saveAndSay(app.toast, { workspace: app.ws.name, what: 'activity', scope: narrowed ? 'filtered' : '', date: app.today }, { kind: 'csv', text: toCsv(activityRows(list, app.snapshot)) },
      `Saved ${list.length} ${list.length === 1 ? 'change' : 'changes'} as CSV`);
  };
  const filterCount = chips.filter((c) => c.key !== 'q' && c.key !== 'kind' && c.key !== 'when').length;
  return (
    <div className="page narrow activity-page">
      <div className="page-head">
        <h1 className="title-xl">Activity</h1>
        <span className="small muted">Every saved change, who made it and when. Drafts aren’t logged.</span>
      </div>
      {watching != null && (
        <p className="row" style={{ gap: 'var(--s2)' }}>
          <span className="small strong">Showing: {scopeText}</span>
          <button type="button" className="linkish small" onClick={() => { setA(() => EMPTY_ACTIVITY); setLimit(40); }}>Show all activity</button>
        </p>
      )}
      <div className="filterbar">
        <div className="filterbar-row">
          <ListSearch value={a.q} label="Find a change" placeholder="Find by person, goal, key or what was said" onSearch={(v, change) => { setA((cur) => ({ ...cur, q: v }), change); setLimit(40); }} />
          <label className="filter-sort"><span className="sr">When</span>
            <select className="input" value={a.when ?? ''} onChange={(e) => { const v = (e.target.value || null) as When | null; setA((cur) => ({ ...cur, when: v })); if (v === 'custom') setOpen(true); setLimit(40); }}>
              <option value="">Any time</option>
              {WHEN_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>Filters{filterCount ? <span className="tabcount">{filterCount}</span> : null}</button>
          <button type="button" className="btn activity-save" onClick={saveCsv} disabled={!list.length}>Save .csv</button>
        </div>
        <div className="kind-chips" role="group" aria-label="Kind of change">
          {ACTIVITY_KINDS.filter(([k]) => counts.get(k) || a.kind.includes(k)).map(([k, l]) => (
            <button key={k} type="button" className="filter-chip" aria-pressed={a.kind.includes(k)} onClick={() => { setA((cur) => ({ ...cur, kind: cur.kind.includes(k) ? cur.kind.filter((x) => x !== k) : [...cur.kind, k] })); setLimit(40); }}>{l}<span className="tabcount">{counts.get(k)}</span></button>
          ))}
        </div>
      </div>
      {near && <NoneFound things={CHANGES} q={a.q} filtered={parts.length > 0} near={near} onClearSearch={() => setA((cur) => ({ ...cur, q: '' }))} onClearFilters={() => setA((cur) => ({ ...EMPTY_ACTIVITY, q: cur.q, watching: cur.watching, since: cur.since }))} />}
      {list.length > 0 && <CountLine things={CHANGES} n={list.length} narrowed={narrowed || !!a.q.trim()} order="newest first" />}
      <FilterLine parts={parts} onRemove={(k) => setA((cur) => withoutActivity(cur, k))} onClear={() => setA((cur) => ({ ...EMPTY_ACTIVITY, q: cur.q, watching: cur.watching, since: cur.since }))} />
      {groups.length ? groups.map(([day, items]) => (
        <section key={day} className="block">
          <h2 className="label">{day}</h2>
          <ol className="changes">{runs(items).map((r) => (r.length >= 3
            ? <ReviewedRun key={r[0]!.id} run={r} />
            : r.map((c) => <ChangeItem key={c.id} c={c} showGoal rows={folded.rows.get(c.id)} />)))}</ol>
        </section>
      )) : narrowed || a.q.trim() ? (
        <NoneFound things={CHANGES} q={a.q} filtered={parts.length > 0} onClearSearch={() => setA((cur) => ({ ...cur, q: '' }))} onClearFilters={() => setA((cur) => ({ ...EMPTY_ACTIVITY, q: cur.q, watching: cur.watching, since: cur.since }))} />
      ) : <div className="activity-none"><p className="activity-none-title">Nothing has changed in {app.ws.name} yet.</p></div>}
      {folded.top.length > shown.length
        ? <button className="btn" onClick={() => setLimit((n) => n + 40)}>Show more ({folded.top.length - shown.length} older)</button>
        : older.more && <button className="btn" disabled={older.loading} onClick={() => { older.next(); setLimit((n) => n + 40); }}>{older.loading ? 'Fetching older changes…' : 'Show older changes'}</button>}
      {open && <ActivityFilters onClose={() => setOpen(false)} onSave={list.length ? saveCsv : null} />}
    </div>
  );
}

/** Who, which goal or tree, team, level and dates. */
function ActivityFilters({ onClose, onSave }: { onClose: () => void; onSave: (() => void) | null }) {
  const app = useApp();
  const [a, setA] = useActivityQuery();
  const toggle = <T extends string>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  return (
    <Sheet open onClose={onClose} title="Filter activity" wide>
      <div className="filter-sheet activity-filter-sheet">
        <fieldset className="filter-group"><legend className="field-label">Who made the change</legend>
          <Pick kind="person" several label="Who" value={a.who} onChange={(who) => setA((cur) => ({ ...cur, who }))} />
          <label className="check"><input type="checkbox" checked={a.who.length === 1 && a.who[0] === app.viewer.id} onChange={(e) => setA((cur) => ({ ...cur, who: e.target.checked ? [app.viewer.id] : [] }))} /> Only my changes</label>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Goal</legend>
          <PickOne kind="goal" label="Goal" none="Any goal" value={a.goal} onChange={(goal) => setA((cur) => ({ ...cur, goal, tree: goal ? cur.tree : false }))} />
          {/* Offered once there is a goal to follow down, never as a disabled box with no reason (demo review, 8 Nov). */}
          {a.goal
            ? <label className="check"><input type="checkbox" checked={a.tree} onChange={(e) => setA((cur) => ({ ...cur, tree: e.target.checked }))} /> And every goal feeding it</label>
            : <span className="hint">Choose a goal to include every goal feeding it too.</span>}
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Team</legend>
          <span className="filter-options">{app.snapshot.teams.map((t) => <label key={t.id} className="check"><input type="checkbox" checked={a.team.includes(t.id)} onChange={() => setA((cur) => ({ ...cur, team: toggle(cur.team, t.id) }))} /> {t.name}</label>)}</span>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Level</legend>
          <span className="filter-options">{levelIds(app.cycle).map((l) => <label key={l} className="check"><input type="checkbox" checked={a.level.includes(l)} onChange={() => setA((cur) => ({ ...cur, level: toggle(cur.level, l) }))} /> {levelName(app.cycle, l)}</label>)}</span>
        </fieldset>
        <fieldset className="filter-group filter-dates"><legend className="field-label">Between two dates</legend>
          <label className="field"><span className="date-label">From</span><input className="input" type="date" value={a.from ?? ''} onChange={(e) => setA((cur) => ({ ...cur, when: 'custom', from: e.target.value || null }))} /></label>
          <label className="field"><span className="date-label">To</span><input className="input" type="date" value={a.to ?? ''} onChange={(e) => setA((cur) => ({ ...cur, when: 'custom', to: e.target.value || null }))} /></label>
        </fieldset>
      </div>
      {/* On a phone, Save .csv lives here rather than taking a row of the filter bar. */}
      <div className="sheet-foot activity-foot">
        <button type="button" className="linkish small" onClick={() => setA((cur) => ({ ...EMPTY_ACTIVITY, q: cur.q, kind: cur.kind, watching: cur.watching, since: cur.since }))}>Clear filters</button>
        <button type="button" className="btn activity-foot-save" onClick={() => onSave?.()} disabled={!onSave}>Save .csv</button>
        <button type="button" className="btn primary" onClick={onClose}>Show the changes</button>
      </div>
    </Sheet>
  );
}

/**
 * Runs of routine review coverage ("looked at it") by one person in one review, kept together so they don't push the
 * real changes down the page. Every record is still there, one click away (visual review 2).
 */
function runs(items: Change[]): Change[][] {
  const out: Change[][] = [];
  for (const c of items) {
    const last = out[out.length - 1];
    const routine = c.entity === 'decision' && c.action === 'acknowledged';
    if (routine && last && last[0]!.action === 'acknowledged' && last[0]!.entity === 'decision' && last[0]!.actorId === c.actorId && last[0]!.summary === c.summary) last.push(c);
    else out.push([c]);
  }
  return out;
}

function ReviewedRun({ run }: { run: Change[] }) {
  const app = useApp();
  const who = app.person(run[0]!.actorId);
  const where = run[0]!.summary.replace(/^Looked at it\s*/, '');
  const [open, setOpen] = useState(false);
  return (
    <li className="change change-run">
      <Avatar p={who ?? { name: run[0]!.actorId, initials: '?' }} size="sm" />
      <details className="disclose" style={{ flex: 1, minWidth: 0 }} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="small"><strong>{who?.name ?? run[0]!.actorId}</strong> reviewed {run.length} goals {where}, nothing to add</summary>
        {open && <ol className="changes">{run.map((c) => <ChangeItem key={c.id} c={c} showGoal />)}</ol>}
      </details>
    </li>
  );
}
