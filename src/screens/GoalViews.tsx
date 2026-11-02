/* Other ways to see the same goals: a sortable table, a board by status, a week-by-week history grid and cards.
   The Goals tabs say which goals and how they're grouped; the layout says how they're drawn. Each person's
   choice is remembered, and it's in the address so a view can be shared. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { weekDates } from '../domain/plan';
import { assessPosted, LABEL, RANK } from '../domain/status';
import { summarise, weeklyCalls, type GoalSummary } from '../domain/summary';
import type { DisplayStatus, Goal } from '../domain/types';
import { Spark, StageSpark } from '../ui/charts';
import { Chip, LevelTag, Sheet, StatusShape } from '../ui/bits';
import { describe, type ChangeSet } from '../domain/changeset';
import { LEVEL_LABEL } from '../domain/format';
import type { Level } from '../domain/types';
import { ExportButton } from './Export';

export type Layout = 'list' | 'table' | 'board' | 'history' | 'cards';
export const LAYOUTS: [Layout, string][] = [['list', 'List'], ['table', 'Table'], ['board', 'Board'], ['history', 'History'], ['cards', 'Cards']];
const KEY = 'goals-app-layout';
const isLayout = (v: string | null): v is Layout => !!v && LAYOUTS.some(([k]) => k === v);

/** The layout from the address, else this person's last choice, else the list. */
export function useLayout(): [Layout, (l: Layout) => void] {
  const [params, setParams] = useSearchParams();
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  const fromUrl = params.get('view');
  const layout: Layout = isLayout(fromUrl) ? fromUrl : isLayout(saved) ? saved : 'list';
  const set = (l: Layout) => {
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
    const next = new URLSearchParams(params);
    if (l === 'list') next.delete('view'); else next.set('view', l);
    setParams(next, { replace: true });
  };
  return [layout, set];
}

export function LayoutSwitch({ layout, onChange }: { layout: Layout; onChange: (l: Layout) => void }) {
  return (
    <div className="seg layout-switch" role="group" aria-label="Layout">
      {LAYOUTS.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={layout === k} aria-label={label} onClick={() => onChange(k)}>
          <LayoutIcon k={k} /><span className="ls-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

function LayoutIcon({ k }: { k: Layout }) {
  const p = { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true } as const;
  if (k === 'list') return <svg {...p}><path d="M3 4h10M3 8h10M3 12h10" /></svg>;
  if (k === 'table') return <svg {...p}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6.5h12M6 6.5V13" /></svg>;
  if (k === 'board') return <svg {...p}><rect x="2" y="3" width="3.5" height="10" rx="1" /><rect x="6.25" y="3" width="3.5" height="7" rx="1" /><rect x="10.5" y="3" width="3.5" height="5" rx="1" /></svg>;
  if (k === 'history') return <svg {...p}><path d="M2 4h2M6 4h2M10 4h2M2 8h2M6 8h2M10 8h4M2 12h2M6 12h4" strokeWidth="2.2" /></svg>;
  return <svg {...p}><rect x="2" y="2.5" width="5" height="5" rx="1" /><rect x="9" y="2.5" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>;
}

/** Goals to draw, in groups (a tree, a level, a team…). Depth indents goals inside a tree. */
export interface ViewGroup { key: string; title: string; hint?: string; rows: { goal: Goal; depth: number }[] }

function useSummaries(groups: ViewGroup[]) {
  const app = useApp();
  return useMemo(() => {
    const m = new Map<string, GoalSummary>();
    for (const g of groups) for (const r of g.rows) if (!m.has(r.goal.id)) m.set(r.goal.id, summarise(r.goal, app.snapshot, app.cycle, app.today, app.week));
    return m;
  }, [groups, app.snapshot, app.cycle, app.today, app.week]);
}

function GroupHead({ g, count }: { g: ViewGroup; count: number }) {
  return (
    <div className="stack" style={{ gap: 'var(--s1)' }}>
      <h2 className="block-title">{g.title} <span className="hint">· {count}</span></h2>
      {g.hint && <span className="hint">{g.hint}</span>}
    </div>
  );
}

/* ---------- table ---------- */

type SortKey = 'goal' | 'owner' | 'status' | 'gap' | 'last';
const COLS: [SortKey | null, string, string][] = [
  ['goal', 'Goal', ''], ['owner', 'Owner', 'col-opt'], ['status', 'Status', ''], [null, 'Now', 'num'], [null, 'Target', 'num col-opt'], ['gap', 'Gap', 'col-opt'], [null, 'Trend', 'col-opt'],
];

export function GoalTable({ groups }: { groups: ViewGroup[] }) {
  const app = useApp();
  const sums = useSummaries(groups);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (ids: string[], on: boolean) => setSel((s0) => { const n = new Set(s0); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const cmp = (a: GoalSummary, b: GoalSummary) => {
    if (!sort) return 0;
    const v = {
      goal: a.goal.title.localeCompare(b.goal.title),
      owner: a.owner.localeCompare(b.owner),
      status: RANK[b.status] - RANK[a.status] || a.goal.title.localeCompare(b.goal.title),
      gap: TONE_RANK[b.gapTone] - TONE_RANK[a.gapTone],
      last: (b.lastWeek ?? -1) - (a.lastWeek ?? -1),
    }[sort.key];
    return v * sort.dir;
  };
  const click = (k: SortKey) => setSort((s) => (s?.key === k ? (s.dir === 1 ? { key: k, dir: -1 } : null) : { key: k, dir: 1 }));
  return (
    <>
      {groups.map((g) => {
        const rows = g.rows.map((r) => ({ ...r, s: sums.get(r.goal.id)! }));
        if (sort) rows.sort((a, b) => cmp(a.s, b.s));
        if (!rows.length) return null;
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={rows.length} />}
            <div className="table-wrap">
              <table className="gtable">
                <thead>
                  <tr>
                    <th scope="col" className="selcol"><input type="checkbox" aria-label={`Select every goal in ${g.title}`} checked={rows.every((r) => sel.has(r.goal.id))} onChange={(e) => toggle(rows.map((r) => r.goal.id), e.target.checked)} /></th>
                    {COLS.map(([k, label, cls]) => (
                      <th key={label} scope="col" className={cls} aria-sort={k && sort?.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                        {k ? <button type="button" className="sortbtn" onClick={() => click(k)}>{label}{sort?.key === k ? <span aria-hidden="true">{sort.dir === 1 ? ' ↑' : ' ↓'}</span> : null}</button> : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ goal, depth, s }) => (
                    <tr key={goal.id} data-tone={s.status} className={sel.has(goal.id) ? 'selected' : undefined}>
                      <td className="selcol"><input type="checkbox" aria-label={`Select ${goal.title}`} checked={sel.has(goal.id)} onChange={(e) => toggle([goal.id], e.target.checked)} /></td>
                      <td className="gt-goal" style={!sort && depth ? { paddingLeft: `calc(var(--s3) + ${depth * 16}px)` } : undefined}>
                        <Link to={'/goals/' + goal.id}>{goal.title}</Link><LevelTag level={goal.level} />
                      </td>
                      <td className="col-opt">{s.owner}</td>
                      <td><Chip k={s.status} /><span className="hint gt-plan">{s.lastWeek != null ? `Last: week ${s.lastWeek}` : app.week > 0 ? 'No check-in yet' : ''}</span></td>
                      <td className="num">{s.now}{s.planNow != null && <span className="hint gt-plan">plan {s.planNowText}</span>}</td>
                      <td className="num col-opt">{s.target}</td>
                      <td className={'col-opt tone-' + s.gapTone + ' small'}>{s.gap}</td>
                      <td className="col-opt"><Trend s={s} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {sel.size > 0 && <BulkBar ids={[...sel]} onClear={() => setSel(new Set())} />}
    </>
  );
}
const TONE_RANK = { off: 4, risk: 3, stale: 2, on: 1, ahead: 0 } as const;

function Trend({ s }: { s: GoalSummary }) {
  const app = useApp();
  const g = s.goal;
  if (g.kind === 'milestone') {
    const a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week);
    return a.kind === 'milestone' ? <StageSpark a={a} width={72} /> : null;
  }
  return <Spark goal={g} weeks={app.cycle.weeks} series={s.series} />;
}

/* ---------- board ---------- */

const COLUMNS: { key: string; title: string; statuses: DisplayStatus[]; always: boolean }[] = [
  { key: 'off', title: 'Off track', statuses: ['off'], always: true },
  { key: 'risk', title: 'At risk', statuses: ['risk'], always: true },
  { key: 'stale', title: 'Gone quiet', statuses: ['stale'], always: true },
  { key: 'waiting', title: 'No check-in yet', statuses: ['none', 'planned'], always: false },
  { key: 'on', title: 'On track', statuses: ['on'], always: true },
  { key: 'done', title: 'Done', statuses: ['done'], always: false },
];

export function GoalBoard({ groups }: { groups: ViewGroup[] }) {
  const sums = useSummaries(groups);
  const all = [...sums.values()];
  const cols = COLUMNS.map((c) => ({ ...c, items: all.filter((s) => c.statuses.includes(s.status)).sort((a, b) => a.goal.title.localeCompare(b.goal.title)) })).filter((c) => c.always || c.items.length);
  return (
    <div className="board">
      {cols.map((c) => (
        <section key={c.key} className="board-col" aria-label={`${c.title}, ${c.items.length}`}>
          <h2 className={'board-head tone-' + (c.key === 'waiting' ? 'stale' : c.key)}><StatusShape k={c.statuses[0]!} />{c.title}<span className="tabcount">{c.items.length}</span></h2>
          {c.items.length === 0 && <span className="hint board-empty">None</span>}
          {c.items.map((s) => (
            <Link key={s.goal.id} to={'/goals/' + s.goal.id} className="board-card" data-tone={s.status}>
              <span className="board-title">{s.goal.title}<LevelTag level={s.goal.level} /></span>
              <span className="small"><span className="strong">{s.now}</span> · <span className={'tone-' + s.gapTone}>{s.gap}</span></span>
              <span className="hint ellipsis">{s.owner} · {s.team}</span>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}

/* ---------- history grid ---------- */

export function HistoryGrid({ groups }: { groups: ViewGroup[] }) {
  const app = useApp();
  const sums = useSummaries(groups);
  const weeks = Array.from({ length: app.cycle.weeks }, (_, i) => i + 1);
  const cellText = (s: GoalSummary, w: number, c: ReturnType<typeof weeklyCalls>) => {
    const ci = c.get(w);
    if (!ci) return w <= app.week ? 'No check-in' : 'Not yet';
    const v = s.goal.kind === 'milestone' ? `${(ci.stages ?? []).filter((u) => u.doneWeek != null).length} of ${s.goal.stages.length} stages` : ci.value == null ? '' : String(ci.value) + (s.goal.unit ? (s.goal.unit === '%' ? '%' : ' ' + s.goal.unit) : '');
    return `${LABEL[ci.status]}${v ? ', ' + v : ''}${ci.backfilled ? ' (loaded later)' : ''}`;
  };
  return (
    <>
      <p className="hint">Each square is the owner’s call that week. Hover or tap a goal to open it.</p>
      <div className="hlegend" aria-hidden="true">
        {(['on', 'risk', 'off', 'done'] as const).map((k) => <span key={k} className={'hcell-key tone-' + k}><StatusShape k={k} />{LABEL[k]}</span>)}
        <span className="hcell-key"><span className="hcell-empty" />No check-in</span>
      </div>
      {groups.map((g) => {
        if (!g.rows.length) return null;
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={g.rows.length} />}
            <div className="table-wrap">
              <table className="hgrid">
                <thead>
                  <tr>
                    <th scope="col" className="hg-goal">Goal</th>
                    {weeks.map((w) => <th key={w} scope="col" className={w === app.week ? 'now' : ''} title={weekDates(app.cycle, w)}><span className="sr">Week </span>{w}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(({ goal, depth }) => {
                    const s = sums.get(goal.id)!;
                    const calls = weeklyCalls(s.checkIns);
                    return (
                      <tr key={goal.id}>
                        <th scope="row" className="hg-goal" style={depth ? { paddingLeft: 8 + depth * 12 } : undefined}><Link to={'/goals/' + goal.id}>{goal.title}</Link></th>
                        {weeks.map((w) => {
                          const ci = calls.get(w);
                          const text = cellText(s, w, calls);
                          return (
                            <td key={w} className={'hcell' + (w === app.week ? ' now' : '') + (w > app.week ? ' future' : '') + (ci ? ' tone-' + ci.status : '') + (ci?.backfilled ? ' backfilled' : '')} title={`Week ${w}: ${text}`}>
                              {ci ? <StatusShape k={ci.status} /> : w <= app.week ? <span className="hcell-empty" aria-hidden="true" /> : null}
                              <span className="sr">{text}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ---------- cards ---------- */

export function GoalCards({ groups }: { groups: ViewGroup[] }) {
  const sums = useSummaries(groups);
  return (
    <>
      {groups.map((g) => {
        if (!g.rows.length) return null;
        return (
          <section key={g.key} className="block" aria-label={g.title}>
            {groups.length > 1 && <GroupHead g={g} count={g.rows.length} />}
            <div className="gcards">
              {g.rows.map(({ goal }) => {
                const s = sums.get(goal.id)!;
                return (
                  <Link key={goal.id} to={'/goals/' + goal.id} className="gcard" data-tone={s.status}>
                    <span className="row between nowrap"><Chip k={s.status} /><LevelTag level={goal.level} /></span>
                    <span className="gcard-title">{goal.title}</span>
                    <span className="gcard-now"><span className="big">{s.now}</span><span className="hint">target {s.target}</span></span>
                    <Trend s={s} />
                    <span className={'small tone-' + s.gapTone}>{s.gap}</span>
                    <span className="hint ellipsis">{s.owner}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ---------- bulk actions on the selected goals ---------- */

function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const app = useApp();
  const [sheet, setSheet] = useState<'owner' | 'level' | null>(null);
  const goals = ids.map((id) => app.goal(id)).filter((g): g is Goal => !!g);
  const watch = async () => {
    for (const g of goals) await app.watch('goal', g.id);
    app.toast(`Watching ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`);
  };
  return (
    <div className="selbar" role="region" aria-label="Selected goals">
      <span className="strong">{goals.length} selected</span>
      <button type="button" className="btn sm" onClick={() => setSheet('owner')}>Change owner</button>
      <button type="button" className="btn sm" onClick={() => setSheet('level')}>Change level</button>
      <button type="button" className="btn sm" onClick={() => void watch()}>Watch</button>
      <ExportButton goals={goals} viewName="Selected" />
      <button type="button" className="btn ghost sm" onClick={onClear}>Clear</button>
      {sheet && <BulkSheet kind={sheet} goals={goals} onClose={() => setSheet(null)} onDone={onClear} />}
    </div>
  );
}

function BulkSheet({ kind, goals, onClose, onDone }: { kind: 'owner' | 'level'; goals: Goal[]; onClose: () => void; onDone: () => void }) {
  const app = useApp();
  const [value, setValue] = useState('');
  const [cs, setCs] = useState<ChangeSet | null>(null);
  const [busy, setBusy] = useState(false);
  const levels: Level[] = ['north-star', 'svp', 'team'];
  const save = async () => {
    if (!value) return;
    const res = app.previewChanges({ goals: goals.map((g, i) => ({ __row: String(i + 2), id: g.id, ...(kind === 'owner' ? { owner: app.person(value)?.name ?? '' } : { level: value === 'north-star' ? 'north star' : value }) })) }, 'bulk');
    setCs(res);
    if (!res.commit) return;
    setBusy(true);
    try {
      await app.applyChanges(res);
      app.toast(`Saved: ${describe(res).toLowerCase()}`);
      onDone();
      onClose();
    } catch { setBusy(false); }
  };
  const errors = cs?.issues.filter((x) => x.severity === 'error') ?? [];
  return (
    <Sheet open onClose={onClose} title={`${kind === 'owner' ? 'Change the owner of' : 'Change the level of'} ${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}`}>
      <form className="stack" style={{ gap: 'var(--s4)' }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="field"><span className="field-label">{kind === 'owner' ? 'New owner' : 'Level'}</span>
          <select className="input" value={value} onChange={(e) => { setValue(e.target.value); setCs(null); }}>
            <option value="">Choose…</option>
            {kind === 'owner' ? app.snapshot.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) : levels.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </label>
        <span className="hint">{app.viewer.admin ? 'As an admin you can change any goal.' : 'You can change the goals you own. Leave others out of the selection.'} Each change is logged on its goal.</span>
        {errors.length > 0 && (
          <ul className="issue-list" role="alert">{errors.map((x, i) => <li key={i}><span className="label">{x.goal}</span><span>{x.message}</span></li>)}</ul>
        )}
        {cs && !cs.items.length && !errors.length && <span className="hint" role="status">Nothing changes: they already have that {kind}.</span>}
        <div className="foot-row"><button type="button" className="btn ghost big-btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary big-btn" disabled={!value || busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Sheet>
  );
}
