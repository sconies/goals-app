import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { downloadText } from '../app/spreadsheet';
import { useApp } from '../app/state';
import {
  ACTIVITY_KEYS, ACTIVITY_KINDS, activityEntries, activityFilter, activityRows, describeActivity, EMPTY_ACTIVITY, kindOf, parseActivity, WHEN_OPTIONS, withoutActivity,
  type ActivityQuery, type When,
} from '../domain/activity';
import { toCsv } from '../domain/export';
import { LEVEL_LABEL } from '../domain/format';
import { watchedGoals } from '../domain/review';
import type { Change, Level } from '../domain/types';
import { Avatar, Sheet } from '../ui/bits';
import { ChangeItem } from './GoalScreen';

function dayLabel(iso: string, today: Date) {
  const d = new Date(iso);
  const days = Math.round((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

/** The query in the link: every change builds on the link as it is now. */
function useActivityQuery(): [ActivityQuery, (f: (a: ActivityQuery) => ActivityQuery) => void] {
  const [params, setParams] = useSearchParams();
  const a = parseActivity(params);
  const set = (f: (a: ActivityQuery) => ActivityQuery) => setParams((cur) => {
    const next = f(parseActivity(cur));
    return new URLSearchParams([...[...cur].filter(([k]) => !ACTIVITY_KEYS.includes(k)), ...activityEntries(next)]);
  }, { replace: true });
  return [a, set];
}

/**
 * The change log: every save, by whom and when, newest first. Drafts never appear here. Filter it by who, which goal
 * or tree, team, level, kind of change, dates and words; all of it is in the link, and the result saves as a CSV.
 */
export function Activity() {
  const app = useApp();
  const [a, setA] = useActivityQuery();
  const [limit, setLimit] = useState(40);
  const [open, setOpen] = useState(false);
  // Arriving from Watching keeps its scope: the goals you watch (at a level, if one was picked).
  const level = a.watching && a.watching !== 'all' ? (a.watching as Level) : null;
  const watched = a.watching != null ? new Set(watchedGoals(app.viewer.id, app.snapshot).filter((g) => !level || g.level === level).map((g) => g.id)) : null;
  const all = [...app.snapshot.changes].reverse();
  const base = { ...a, kind: [] as ActivityQuery['kind'] };
  const inScope = all.filter(activityFilter(base, { snapshot: app.snapshot, cycle: app.cycle, week: app.week, watched }));
  const list = a.kind.length ? inScope.filter((c) => a.kind.includes(kindOf(c))) : inScope;
  const shown = list.slice(0, limit);
  const groups: [string, Change[]][] = [];
  for (const c of shown) {
    const k = dayLabel(c.at, app.today);
    const last = groups[groups.length - 1];
    if (last && last[0] === k) last[1].push(c);
    else groups.push([k, [c]]);
  }
  const chips = describeActivity(a, app.snapshot, app.cycle, app.week);
  const scopeText = a.watching != null ? `Goals you watch${level ? ` (${LEVEL_LABEL[level]})` : ''}${a.since ? ` · since ${new Date(a.since + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''}` : '';
  const counts = new Map(ACTIVITY_KINDS.map(([k]) => [k, inScope.filter((c) => kindOf(c) === k).length]));
  const narrowed = chips.length > 0 || a.watching != null;
  const saveCsv = () => {
    downloadText(toCsv(activityRows(list, app.snapshot)), `activity-${app.today.toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    app.toast(`Saved ${list.length} ${list.length === 1 ? 'change' : 'changes'} as CSV`);
  };
  const filterCount = chips.filter((c) => c.key !== 'q' && c.key !== 'kind' && c.key !== 'when').length;
  return (
    <div className="page narrow activity-page">
      <div className="page-head">
        <h1 className="title-xl">Activity</h1>
        <span className="small muted">Every saved change, who made it and when. Drafts aren’t logged; anything posted or saved is, and the log can’t be edited.</span>
      </div>
      {a.watching != null && (
        <p className="row" style={{ gap: 'var(--s2)' }}>
          <span className="small strong">Showing: {scopeText}</span>
          <button type="button" className="linkish small" onClick={() => { setA(() => EMPTY_ACTIVITY); setLimit(40); }}>Show all activity</button>
        </p>
      )}
      <div className="filterbar">
        <div className="filterbar-row">
          <label className="filter-search"><span className="sr">Search changes</span>
            <input className="input" type="search" placeholder="Search changes: names, reasons, numbers" value={a.q} onChange={(e) => { const v = e.target.value; setA((cur) => ({ ...cur, q: v })); setLimit(40); }} />
          </label>
          <label className="filter-sort"><span className="sr">When</span>
            <select className="input" value={a.when ?? ''} onChange={(e) => { const v = (e.target.value || null) as When | null; setA((cur) => ({ ...cur, when: v })); if (v === 'custom') setOpen(true); setLimit(40); }}>
              <option value="">Any time</option>
              {WHEN_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>Filters{filterCount ? ` · ${filterCount}` : ''}</button>
          <button type="button" className="btn" onClick={saveCsv} disabled={!list.length}>Save .csv</button>
        </div>
        <div className="kind-chips" role="group" aria-label="Kind of change">
          {ACTIVITY_KINDS.filter(([k]) => counts.get(k) || a.kind.includes(k)).map(([k, l]) => (
            <button key={k} type="button" className="filter-chip" aria-pressed={a.kind.includes(k)} onClick={() => { setA((cur) => ({ ...cur, kind: cur.kind.includes(k) ? cur.kind.filter((x) => x !== k) : [...cur.kind, k] })); setLimit(40); }}>{l}<span className="tabcount">{counts.get(k)}</span></button>
          ))}
        </div>
        {narrowed && (
          <div className="filter-chips" aria-label="Active filters">
            <span className="small" role="status">{list.length} of {all.length} changes</span>
            {chips.map((c) => <button key={c.key} type="button" className="filter-chip" aria-label={`Remove filter: ${c.text}`} onClick={() => setA((cur) => withoutActivity(cur, c.key))}>{c.text}<span aria-hidden="true"> ✕</span></button>)}
            {chips.length > 0 && <button type="button" className="linkish small" onClick={() => setA((cur) => ({ ...EMPTY_ACTIVITY, watching: cur.watching, since: cur.since }))}>Clear filters</button>}
          </div>
        )}
      </div>
      {groups.length ? groups.map(([day, items]) => (
        <section key={day} className="block">
          <h2 className="label">{day}</h2>
          <ol className="changes">{runs(items).map((r) => (r.length >= 3
            ? <ReviewedRun key={r[0]!.id} run={r} />
            : r.map((c) => <ChangeItem key={c.id} c={c} showGoal />)))}</ol>
        </section>
      )) : <div className="calm">{narrowed ? 'No changes match. Remove a filter to see more.' : 'Nothing here yet.'}</div>}
      {list.length > shown.length && <button className="btn" onClick={() => setLimit((n) => n + 40)}>Show more ({list.length - shown.length} older)</button>}
      {open && <ActivityFilters onClose={() => setOpen(false)} />}
    </div>
  );
}

/** Who, which goal or tree, team, level and dates. */
function ActivityFilters({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [a, setA] = useActivityQuery();
  const [who, setWho] = useState('');
  const toggle = <T extends string>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const people = app.snapshot.people.filter((p) => !a.who.includes(p.id) && who.trim() && p.name.toLowerCase().includes(who.trim().toLowerCase())).slice(0, 6);
  return (
    <Sheet open onClose={onClose} title="Filter activity" wide>
      <div className="filter-sheet">
        <fieldset className="filter-group"><legend className="field-label">Who made the change</legend>
          <span className="filter-options">{a.who.map((id) => <button key={id} type="button" className="filter-chip" aria-label={`Remove ${app.person(id)?.name}`} onClick={() => setA((cur) => ({ ...cur, who: cur.who.filter((x) => x !== id) }))}>{app.person(id)?.name}<span aria-hidden="true"> ✕</span></button>)}</span>
          <input className="input" type="search" placeholder="Find a person" aria-label="Find a person" value={who} onChange={(e) => setWho(e.target.value)} />
          {people.length > 0 && <span className="filter-options">{people.map((p) => <button key={p.id} type="button" className="btn sm" onClick={() => { setA((cur) => ({ ...cur, who: [...cur.who, p.id] })); setWho(''); }}>{p.name}</button>)}</span>}
          <label className="check"><input type="checkbox" checked={a.who.length === 1 && a.who[0] === app.viewer.id} onChange={(e) => setA((cur) => ({ ...cur, who: e.target.checked ? [app.viewer.id] : [] }))} /> Only my changes</label>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Goal</legend>
          <select className="input" aria-label="Goal" value={a.goal ?? ''} onChange={(e) => setA((cur) => ({ ...cur, goal: e.target.value || null }))}>
            <option value="">Any goal</option>
            {[...app.snapshot.goals].sort((x, y) => x.title.localeCompare(y.title)).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <label className="check"><input type="checkbox" disabled={!a.goal} checked={a.tree} onChange={(e) => setA((cur) => ({ ...cur, tree: e.target.checked }))} /> And every goal feeding it</label>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Team</legend>
          <span className="filter-options">{app.snapshot.teams.map((t) => <label key={t.id} className="check"><input type="checkbox" checked={a.team.includes(t.id)} onChange={() => setA((cur) => ({ ...cur, team: toggle(cur.team, t.id) }))} /> {t.name}</label>)}</span>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Level</legend>
          <span className="filter-options">{(['north-star', 'svp', 'team'] as Level[]).map((l) => <label key={l} className="check"><input type="checkbox" checked={a.level.includes(l)} onChange={() => setA((cur) => ({ ...cur, level: toggle(cur.level, l) }))} /> {LEVEL_LABEL[l]}</label>)}</span>
        </fieldset>
        <fieldset className="filter-group"><legend className="field-label">Between two dates</legend>
          <label className="field"><span className="small">From</span><input className="input" type="date" value={a.from ?? ''} onChange={(e) => setA((cur) => ({ ...cur, when: 'custom', from: e.target.value || null }))} /></label>
          <label className="field"><span className="small">To</span><input className="input" type="date" value={a.to ?? ''} onChange={(e) => setA((cur) => ({ ...cur, when: 'custom', to: e.target.value || null }))} /></label>
        </fieldset>
      </div>
      <div className="sheet-foot">
        <button type="button" className="linkish small" onClick={() => setA((cur) => ({ ...EMPTY_ACTIVITY, q: cur.q, kind: cur.kind, watching: cur.watching, since: cur.since }))}>Clear filters</button>
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
