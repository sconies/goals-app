/* The inbox, on its own page, Feedback (/feedback; backlog WS, 9 Nov: it was a section of Workspace; backlog W, Lane, 8 Nov: "more like an inbox where you can click
   through things, not a giant long page. Imagine 75 pieces of feedback."). Markups and feedback people sent, worked
   like an inbox:
   - tabs New · In hand · Closed, each with its count, and "Nothing new" when New is empty;
   - filters for kind, page and person, and a search;
   - markups on the same part of the same page folded into one row ("6 on this part") and handled together;
   - on a computer, the list and the open item side by side, and keys: J and K move, I marks in hand, F fixed, W won't
     fix; on a phone, one item at a time with Next;
   - handling an item opens the next; Undo puts back what it replaced;
   - tick rows to handle a batch at once; 25 rows a page.
   Each status is a shape and a word (New, In hand, Fixed, Won't fix). Open to anyone, with no sign-in, in the live app
   and the demo (backlog O: Faro never holds real data; the internal app keeps its inbox restricted, spec R1 rule 6).
   Every change goes through the shared rule (statusPatch), is recorded as the person using the app, and says who made
   it. The list's rules are in inboxList.ts; the data, loaded once for Workspace, in inboxData.ts. Connect Claude
   (src/markup/Connect.tsx) opens from the top. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApp } from '../app/state';
import { NEWS } from '../help/lookup';
import { Sheet, timeAgo } from '../ui/bits';
import { Icon } from '../ui/Icon';
import { PickOne } from '../ui/Pick';
import { searchNames } from '../app/search';
import { CountLine, FilterLine, ListBar, ListSearch, NoneFound } from '../ui/ListBar';
import { historyStep, type FilterPart, type ListChange } from '../domain/find';
import { ConnectClaude } from './Connect';
import { PartPath } from './Markup';
import type { InboxFeedback } from './feedback';
import type { InboxData } from './inboxData';
import { PAGE_SIZE, TABS, filterChoices, filterItems, inboxItems, itemFor, itemIds, itemLine, itemParam, itemSize, nextAfter, pageOf, stepKey, tabCounts, tabOf, type InboxFilter, type InboxItem, type InboxTab } from './inboxList';
import { ADMINS_TRIAGE, mayTriage, MOOD_WORD, STATUS_WORD, namedParts, problemText, sentFrom, stepText, type Markup, type MarkupStatus, type StatusChange } from './model';
import type { ListedMarkup, OpenedMarkup } from './ops';

/** A markup's status: its shape and its word, always together. Diamonds, so they're never read as a goal's status. */
export function MarkupStatusMark({ status }: { status: MarkupStatus }) {
  const d = 'M8 1.8 14.2 8 8 14.2 1.8 8z';
  return (
    <span className={`mk-status mk-${status}`}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        {status === 'new' && <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" />}
        {status === 'in-hand' && <><path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8 1.8 1.8 8 8 14.2z" fill="currentColor" /></>}
        {status === 'fixed' && <><path d={d} fill="currentColor" stroke="currentColor" strokeWidth="1.6" /><path d="m5.3 8.2 1.9 1.8 3.5-3.6" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>}
        {status === 'wont-fix' && <><path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m5 11 6-6" stroke="currentColor" strokeWidth="1.6" /></>}
      </svg>
      <span>{STATUS_WORD[status]}</span>
    </span>
  );
}

type Item = InboxItem<ListedMarkup>;
type Change = Omit<StatusChange, 'by' | 'admin'>;
/** The last change, and how to take it back. */
interface Undo { done: string; run: () => Promise<void> }

const isTab = (t: string | null): t is InboxTab => t === 'new' || t === 'in-hand' || t === 'closed';
const DONE: Record<MarkupStatus, string> = { new: 'Marked new again', 'in-hand': 'Marked in hand', fixed: 'Marked fixed', 'wont-fix': 'Marked won’t fix' };
/** The inbox's nouns, for the list bar's words. */
const ITEMS = { thing: 'item', things: 'items' };
const short = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export default function Inbox({ data, narrow, inPage = false }: { data: InboxData; narrow: boolean; /** On the Feedback page, whose heading names it: no heading of its own. */ inPage?: boolean }) {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: InboxTab = isTab(tabParam) ? tabParam : 'new';
  // The open item, by its id (a markup's or a piece of feedback's): the address keeps it, so a link opens it.
  const open = params.get('item') ?? params.get('markup');
  // What's searched and filtered is in the address (the list bar, find spec 2.1 and move 17): ?q=, ?kind=, ?page= (a
  // page's name) and ?who=, so Back and a shared link show the same list.
  const kindParam = params.get('kind');
  const [fq, fpage, fwho] = [params.get('q') ?? '', params.get('page') ?? '', params.get('who') ?? ''];
  const fkind: InboxFilter['kind'] = kindParam === 'markup' || kindParam === 'feedback' ? kindParam : 'all';
  // The same object while the address says the same, so the lists below aren't rebuilt (and re-opened) every render.
  const filter: Omit<InboxFilter, 'tab'> = useMemo(() => ({ q: fq, kind: fkind, page: fpage, person: fwho }), [fq, fkind, fpage, fwho]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Undo | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<'fixed' | 'wont-fix' | null>(null);
  const [bulkForm, setBulkForm] = useState<'fixed' | 'wont-fix' | null>(null);
  const [connect, setConnect] = useState(false);
  const [filters, setFilters] = useState(false);

  const all = useMemo(() => inboxItems(data.markups ?? [], data.feedback), [data.markups, data.feedback]);
  const rows = useMemo(() => filterItems(all, { ...filter, tab }), [all, filter, tab]);
  const counts = useMemo(() => tabCounts(all, filter), [all, filter]);
  const choices = useMemo(() => filterChoices(all), [all]);
  // Who sent something, found by typing (find-and-pick): the senders come from every workspace, so the picker asks a
  // search over their names, not this workspace's people.
  const sendersSearch = useMemo(() => searchNames(choices.people), [choices.people]);
  const senders = { search: sendersSearch, viewerId: app.viewer.name, ws: 'inbox' };
  const openRow = open ? rows.find((r) => itemIds(r).includes(open)) : undefined;
  const shown = pageOf(rows, page);
  const filtered = filter.kind !== 'all' || !!filter.page || !!filter.person || !!filter.q.trim();

  // Both read the address as it is now, not as this render saw it: a change saved after an await (handling an item)
  // must not put back a search or a filter cleared meanwhile.
  const go = (next: { tab?: InboxTab; item?: string | null }) => {
    const p = new URLSearchParams(window.location.search);
    p.delete('markup');
    if (next.tab !== undefined) { if (next.tab === 'new') p.delete('tab'); else p.set('tab', next.tab); }
    if (next.item !== undefined) { if (next.item) p.set('item', next.item); else p.delete('item'); }
    setParams(p, { replace: true });
  };
  const openItem = (r: Item | null | undefined) => { setForm(null); go({ item: r ? itemParam(r) : null }); };

  // A link to one item (from a GitHub issue: ?markup=…) opens it in its own tab, once, when the inbox first loads.
  const linkedTo = open && !openRow ? itemFor(all, open) : undefined;
  const firstLoad = useRef(true);
  // The open row's page is the page shown; on a computer, something is always open while the list has rows. Not while a
  // change is being saved: handling a row opens the next one itself.
  useEffect(() => {
    if (!data.markups || busy) return;
    const first = firstLoad.current;
    firstLoad.current = false;
    if (openRow) { const at = Math.floor(rows.indexOf(openRow) / PAGE_SIZE); if (at !== shown.page) setPage(at); return; }
    if (first && linkedTo && !tabParam && linkedTo.tab !== tab) { go({ tab: linkedTo.tab, item: itemParam(linkedTo) }); return; }
    if (!narrow && shown.rows[0]) openItem(shown.rows[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRow?.key, rows, narrow, data.markups, busy]);

  /** Changes the status of rows (one, or a batch), then opens the row that took the open one's place. */
  const handle = async (items: Item[], c: Change) => {
    if (busy || !items.length) return;
    setBusy(true);
    const before = rows;
    const keys = new Set(items.map((i) => i.key));
    const leaves = tabOf(c.status) !== tab;
    const after = leaves ? before.filter((r) => !keys.has(r.key)) : before;
    const firstLine = itemLine(items[0]!);
    const done = `${DONE[c.status]}${items.length > 1 ? `: ${items.reduce((n, i) => n + itemSize(i), 0)} items` : `: “${short(firstLine)}”`}`;
    try {
      const ids = { markups: items.flatMap((i) => (i.kind === 'markup' ? i.markups.map((m) => m.id) : [])), feedback: items.flatMap((i) => (i.kind === 'feedback' ? [i.feedback.id] : [])) };
      const back = await data.setStatus(ids, c);
      const reopen = itemParam(items[0]!);
      setUndo({ done, run: async () => { setUndo(null); try { await back(); go({ item: reopen }); app.toast('Undone'); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); } } });
      setSelected(new Set());
      setBulkForm(null);
      setForm(null);
      if (openRow && keys.has(openRow.key) && leaves) {
        const next = nextAfter(before, after, openRow.key);
        const nextRow = after.find((r) => r.key === next);
        go({ item: nextRow ? itemParam(nextRow) : null });
      }
      app.toast(done);
    } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
    setBusy(false);
  };

  // Keys, on a computer: J and K move, I marks in hand, F fixed, W won't fix. Not while typing, or with a sheet open.
  const triage = mayTriage(app.viewer);
  const keyState = useRef({ rows, openRow, handle, narrow, tab, triage });
  keyState.current = { rows, openRow, handle, narrow, tab, triage };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keyState.current;
      if (k.narrow || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('[role=dialog]')) return;
      const key = e.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        const to = stepKey(k.rows, k.openRow?.key ?? null, key === 'j' ? 1 : -1);
        const r = k.rows.find((x) => x.key === to);
        if (r) { e.preventDefault(); openItem(r); document.querySelector(`[data-row="${CSS.escape(r.key)}"]`)?.scrollIntoView({ block: 'nearest' }); }
      } else if (!k.triage) return;
      else if (k.openRow && key === 'i' && k.tab === 'new') { e.preventDefault(); void k.handle([k.openRow], { status: 'in-hand' }); }
      else if (k.openRow && key === 'f' && k.tab !== 'closed') { e.preventDefault(); setForm('fixed'); }
      else if (k.openRow && key === 'w' && k.tab !== 'closed') { e.preventDefault(); setForm('wont-fix'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setF = (patch: Partial<Omit<InboxFilter, 'tab'>>, change: ListChange = 'choice') => {
    setParams(() => {
      const n = new URLSearchParams(window.location.search);
      const put = (k: string, v: string | undefined, none = '') => { if (v === undefined) return; if (v && v !== none) n.set(k, v); else n.delete(k); };
      put('q', patch.q); put('kind', patch.kind, 'all'); put('page', patch.page); put('who', patch.person);
      return n;
    }, { replace: historyStep(change) === 'replace' });
    setPage(0); setSelected(new Set());
  };
  const parts: FilterPart[] = [
    ...(filter.kind !== 'all' ? [{ key: 'kind', label: 'Kind', values: [filter.kind === 'markup' ? 'Markups' : 'Feedback'] }] : []),
    ...(filter.page ? [{ key: 'page', label: 'Page', values: [filter.page] }] : []),
    ...(filter.person ? [{ key: 'person', label: 'From', values: [filter.person] }] : []),
  ];
  const clearFilters = () => setF({ kind: 'all', page: '', person: '' });
  const pickTab = (t: InboxTab) => { setPage(0); setSelected(new Set()); setBulkForm(null); setForm(null); go({ tab: t, item: null }); };
  const picked = rows.filter((r) => selected.has(r.key));
  const pickedCount = picked.reduce((n, r) => n + itemSize(r), 0);
  const pageAll = shown.rows.length > 0 && shown.rows.every((r) => selected.has(r.key));
  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  // On a phone, an open item takes the screen, with Next and the way back to the list.
  const detailOnly = narrow && !!openRow;
  const loading = data.markups === null;

  return (
    <section className={'inbox-block ibx' + (narrow ? ' ibx-narrow' : '')} id="inbox" aria-labelledby={narrow || inPage ? undefined : 'inbox-title'} aria-label={narrow || inPage ? 'Inbox' : undefined}>
      {!detailOnly && (
        <div className="ws-section-head">
          {!narrow && !inPage && (
            <div className="row between ws-section-title">
              <h2 className="block-title" id="inbox-title">Inbox</h2>
              <button type="button" className="btn ghost sm" aria-expanded={connect} onClick={() => setConnect((x) => !x)}>Connect Claude</button>
            </div>
          )}
          <p className="hint">{narrow ? 'Markups and feedback people send.' : 'Markups (a picture of a screen with a drawing, and a line saying what should change) and feedback (a mood and a few words).'} {inPage ? '' : data.shared ? 'From every workspace and the demo. Anyone can read them and change a status: Faro holds no real data. ' : 'No database is set up, so these are the markups sent from this browser and this workspace’s feedback. '}<Link to="/help/inbox">About the inbox</Link>{(narrow || inPage) && <> · <button type="button" className="linkish" aria-expanded={connect} onClick={() => setConnect((x) => !x)}>Connect Claude</button></>}</p>
          {connect && <ConnectClaude local={!data.shared} />}
        </div>
      )}
      {data.problem && <p className="hint tone-off" role="alert">{data.problem}</p>}
      {undo && <p className="small mk-undo ibx-undo" role="status">{undo.done}. <button type="button" className="linkish" onClick={() => void undo.run()}>Undo</button></p>}

      {!detailOnly && (
        <>
          <div className="ibx-tabs" role="tablist" aria-label="Inbox">
            {TABS.map(([t, label]) => (
              <button key={t} type="button" role="tab" className="ibx-tab" aria-selected={t === tab} onClick={() => pickTab(t)}>
                <span>{label}</span><span className="ibx-tab-count">{loading ? '' : counts[t]}</span>
              </button>
            ))}
          </div>
          {/* The list bar (FS2): the search; Kind inline on a computer; Page and From in Filters. */}
          <div className="ibx-filters" role="search" aria-label="Find in the inbox">
            <ListBar search={<ListSearch value={filter.q} label="Find feedback" placeholder="Find by what was said, who or which page" onSearch={(q, change) => setF({ q }, change)} />}>
              {!narrow && (
                <label className="field"><span className="sr">Kind</span>
                  <select className="input" value={filter.kind} onChange={(e) => setF({ kind: e.target.value as InboxFilter['kind'] })}>
                    <option value="all">Kind: every kind</option><option value="markup">Kind: markups</option><option value="feedback">Kind: feedback</option>
                  </select>
                </label>
              )}
              <button type="button" className="btn" aria-haspopup="dialog" onClick={() => setFilters(true)}>{parts.length ? `Filters · ${parts.length}` : 'Filters'}</button>
            </ListBar>
            {!loading && rows.length > 0 && <CountLine things={ITEMS} n={rows.length} narrowed={filtered} order="newest first" />}
            <FilterLine parts={parts} onRemove={(k) => setF(k === 'kind' ? { kind: 'all' } : k === 'page' ? { page: '' } : { person: '' })} onClear={clearFilters} />
          </div>
          <Sheet open={filters} onClose={() => setFilters(false)} title="Filter feedback">
            <div className="stack" style={{ gap: 'var(--s4)' }}>
              {narrow && (
                <label className="field"><span className="field-label">Kind</span>
                  <select className="input" value={filter.kind} onChange={(e) => setF({ kind: e.target.value as InboxFilter['kind'] })}>
                    <option value="all">Every kind</option><option value="markup">Markups</option><option value="feedback">Feedback</option>
                  </select>
                </label>
              )}
              <label className="field"><span className="field-label">Page</span>
                <select className="input" value={filter.page} onChange={(e) => setF({ page: e.target.value })}>
                  <option value="">Every page</option>{choices.pages.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <PickOne kind="person" label="From" none="Anyone" source={senders} value={filter.person || null} onChange={(name) => setF({ person: name ?? '' })} />
              <div className="sheet-foot">
                {parts.length > 0 && <button type="button" className="linkish small" onClick={clearFilters}>Clear filters</button>}
                <button type="button" className="btn primary" onClick={() => setFilters(false)}>Show {rows.length} {rows.length === 1 ? ITEMS.thing : ITEMS.things}</button>
              </div>
            </div>
          </Sheet>
        </>
      )}

      {loading && <p className="hint" role="status">Opening the inbox…</p>}
      {!loading && (
        <div className={'ibx-split' + (detailOnly || !rows.length ? ' ibx-detail-only' : '')}>
          {!detailOnly && (
            <div className="ibx-listcol">
              {!rows.length ? (
                <div className="ibx-empty" role="status">
                  {filtered ? <NoneFound things={ITEMS} q={filter.q} filtered={parts.length > 0} onClearSearch={() => setF({ q: '' })} onClearFilters={clearFilters} />
                    : tab === 'new' ? <><p className="strong">Nothing new.</p><p className="hint">When someone marks up a screen or sends feedback, it arrives here.</p></>
                      : <p className="hint">{tab === 'in-hand' ? 'Nothing is in hand.' : 'Nothing is closed yet.'}</p>}
                </div>
              ) : (
                <>
                  <div className="ibx-listbar">
                    {triage ? <label className="check ibx-pick-all"><input type="checkbox" checked={pageAll} onChange={(e) => setSelected((s) => { const n = new Set(s); for (const r of shown.rows) { if (e.target.checked) n.add(r.key); else n.delete(r.key); } return n; })} /><span>{pageAll ? 'All on this page' : 'Select this page'}</span></label> : <p className="tiny muted ibx-readonly">{ADMINS_TRIAGE}</p>}
                    {narrow ? <span className="tiny muted">{shown.from}–{shown.to} of {rows.length}</span> : <Pager compact shown={shown} total={rows.length} onPage={setPage} />}
                  </div>
                  {triage && selected.size > 0 && (
                    <BulkBar tab={tab} rows={picked.length} items={pickedCount} busy={busy} form={bulkForm} setForm={setBulkForm}
                      onChange={(c) => void handle(picked, c)} onClear={() => { setSelected(new Set()); setBulkForm(null); }} />
                  )}
                  <ul className="mk-list ibx-list" aria-label={`${TABS.find(([t]) => t === tab)![1]}, ${shown.from} to ${shown.to} of ${rows.length}`}>
                    {shown.rows.map((r) => <Row key={r.key} r={r} open={r.key === openRow?.key} picked={selected.has(r.key)} onPick={triage ? () => toggle(r.key) : undefined} onOpen={() => openItem(r)} />)}
                  </ul>
                  {shown.pages > 1 && <div className="ibx-listbar ibx-listfoot"><span /><Pager shown={shown} total={rows.length} onPage={setPage} /></div>}
                  {!narrow && <p className="tiny muted ibx-keys">{triage ? 'Keys: J and K move through the list, I marks in hand, F fixed, W won’t fix.' : 'Keys: J and K move through the list.'}</p>}
                </>
              )}
            </div>
          )}
          {openRow ? (
            <div className="ibx-detailcol">
              {narrow && (
                <div className="row between ibx-phone-nav">
                  <button type="button" className="btn ghost" onClick={() => openItem(null)}>Back to the list</button>
                  <span className="tiny muted">{rows.indexOf(openRow) + 1} of {rows.length}</span>
                  <button type="button" className="btn" disabled={rows.indexOf(openRow) >= rows.length - 1} onClick={() => openItem(rows[rows.indexOf(openRow) + 1])}>Next</button>
                </div>
              )}
              {openRow.kind === 'markup'
                ? <MarkupDetail key={openRow.key} row={openRow} data={data} busy={busy} form={form} setForm={setForm} onChange={(c) => void handle([openRow], c)} />
                : <FeedbackDetail key={openRow.key} f={openRow.feedback} busy={busy} form={form} setForm={setForm} onChange={(c) => void handle([openRow], c)} />}
            </div>
          ) : !narrow && rows.length > 0 ? <div className="ibx-detailcol ibx-none"><p className="hint">Choose something in the list to open it.</p></div> : null}
        </div>
      )}
    </section>
  );
}

function Pager({ shown, total, onPage, compact = false }: { shown: ReturnType<typeof pageOf<Item>>; total: number; onPage: (p: number) => void; compact?: boolean }) {
  return (
    <span className="ibx-pager">
      <span className="tiny muted" aria-live="polite">{shown.from}–{shown.to} of {total}</span>
      {shown.pages > 1 && (
        <>
          <button type="button" className={'btn sm' + (compact ? ' icon-only' : '')} aria-label="Previous page" disabled={shown.page === 0} onClick={() => onPage(shown.page - 1)}>{compact ? <Icon name="chevron-left" /> : 'Previous page'}</button>
          <button type="button" className={'btn sm' + (compact ? ' icon-only' : '')} aria-label="Next page" disabled={shown.page >= shown.pages - 1} onClick={() => onPage(shown.page + 1)}>{compact ? <Icon name="chevron-right" /> : 'Next page'}</button>
        </>
      )}
    </span>
  );
}

/** One row: a tick box for a batch, then the row itself, which opens it. Its status comes first, as a shape and a word. */
function Row({ r, open, picked, onPick, onOpen }: { r: Item; open: boolean; picked: boolean; onPick?: () => void; onOpen: () => void }) {
  const app = useApp();
  const line = itemLine(r);
  return (
    <li className={'ibx-row' + (open ? ' open' : '') + (picked ? ' picked' : '')} data-row={r.key} aria-current={open ? 'true' : undefined} style={onPick ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {onPick && <label className="ibx-pick"><input type="checkbox" checked={picked} onChange={onPick} aria-label={`Select: ${short(line, 80)}`} /></label>}
      {r.kind === 'markup' ? (() => {
        const m = r.markups[0]!;
        const part = namedParts(m)[0];
        return (
          <button type="button" className="ibx-open mk-item" onClick={onOpen}>
            <span className="ibx-text">
              <span className="ibx-first"><MarkupStatusMark status={m.status} /><span className="mk-line">{line}</span></span>
              <span className="tiny muted">{part ? <PartPath path={part} /> : m.route}</span>
              <span className="tiny muted">{m.personName || 'Someone'}, {sentFrom(m, { host: false })}, {timeAgo(m.createdAt, app.today)}{r.markups.length > 1 ? <strong className="mk-count"> · {r.markups.length} on this part</strong> : null}</span>
            </span>
            {m.thumbUrl ? <img className="mk-thumb" src={m.thumbUrl} alt="" loading="lazy" /> : <span className="mk-thumb empty" aria-hidden="true" />}
          </button>
        );
      })() : (
        <button type="button" className="ibx-open fb-item" onClick={onOpen}>
          <span className="ibx-text">
            <span className="ibx-first"><MarkupStatusMark status={r.feedback.status} /><span className="mk-line">{line}</span></span>
            <span className="tiny muted">Feedback · {MOOD_WORD[r.feedback.mood]} · {r.feedback.path || '/'}</span>
            <span className="tiny muted">{r.feedback.personName || 'Someone'}, {r.feedback.workspaceName || r.feedback.workspaceId}, {timeAgo(r.feedback.at, app.today)}</span>
          </span>
          <span className="mk-thumb fb-thumb" aria-hidden="true"><svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" /></svg></span>
        </button>
      )}
    </li>
  );
}

/** What a batch can be changed to: in hand, fixed in a What's new entry, won't fix with a reason, or new again. */
function BulkBar({ tab, rows, items, busy, form, setForm, onChange, onClear }: { tab: InboxTab; rows: number; items: number; busy: boolean; form: 'fixed' | 'wont-fix' | null; setForm: (f: 'fixed' | 'wont-fix' | null) => void; onChange: (c: Change) => void; onClear: () => void }) {
  return (
    <div className="ibx-bulk" role="group" aria-label="Change the ones selected">
      <div className="row ibx-bulk-row">
        <span className="small strong">{items} selected{items !== rows ? ` (${rows} rows)` : ''}</span>
        {tab === 'new' && <button type="button" className="btn sm" aria-disabled={busy || undefined} onClick={() => onChange({ status: 'in-hand' })}>Mark in hand</button>}
        {tab !== 'closed' && <button type="button" className="btn sm" aria-expanded={form === 'fixed'} onClick={() => setForm('fixed')}>Mark fixed…</button>}
        {tab !== 'closed' && <button type="button" className="btn sm" aria-expanded={form === 'wont-fix'} onClick={() => setForm('wont-fix')}>Won’t fix…</button>}
        {tab !== 'new' && <button type="button" className="btn sm" onClick={() => onChange({ status: 'new' })}>Mark new again</button>}
        <button type="button" className="btn ghost sm" onClick={onClear}>Clear</button>
      </div>
      {form === 'fixed' && <FixedForm label={`Mark ${items} fixed`} hint="Their senders see “You raised this” on that entry." onFixed={(fixedIn) => onChange({ status: 'fixed', fixedIn })} onCancel={() => setForm(null)} />}
      {form === 'wont-fix' && <WontFixForm label={`Won’t fix ${items}`} onWontFix={(reason) => onChange({ status: 'wont-fix', reason })} onCancel={() => setForm(null)} />}
    </div>
  );
}

/** A markup row opened: its newest markup in full (or another on the same part, picked below), and the actions, which
    apply to every markup in the row. */
function MarkupDetail({ row, data, busy, form, setForm, onChange }: { row: Extract<Item, { kind: 'markup' }>; data: InboxData; busy: boolean; form: 'fixed' | 'wont-fix' | null; setForm: (f: 'fixed' | 'wont-fix' | null) => void; onChange: (c: Change) => void }) {
  const app = useApp();
  const [id, setId] = useState(row.markups[0]!.id);
  const [m, setM] = useState<OpenedMarkup | null>(null);
  const [failed, setFailed] = useState('');
  const [ink, setInk] = useState(true);
  const [noPicture, setNoPicture] = useState(false);
  const [issueForm, setIssueForm] = useState(false);
  const [issue, setIssue] = useState('');
  const listed = row.markups.find((x) => x.id === id) ?? row.markups[0]!;
  useEffect(() => {
    let live = true;
    setM(null); setFailed(''); setNoPicture(false);
    data.ops?.open(id).then((x) => { if (live) setM(x); }, (e: unknown) => { if (live) setFailed(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [id, data.ops]);
  // The list's copy is the latest status (a batch or Undo may have changed it since it was opened).
  const shown: OpenedMarkup | null = m ? { ...m, ...pickStatus(listed), issueUrl: listed.issueUrl ?? m.issueUrl } : null;
  const n = row.markups.length;
  const openIssue = async () => {
    try { window.open(await data.ops!.issueLink(id), '_blank', 'noopener'); setIssueForm(true); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
  };
  const keepIssue = async () => {
    try { const next = await data.ops!.setIssueUrl(id, issue); data.patchMarkup(next); setIssueForm(false); app.toast('Kept the issue’s address'); } catch (e) { app.toast(e instanceof Error ? e.message : String(e), 'error'); }
  };
  const notes = shown?.strokes.flatMap((s) => (s.kind === 'note' && s.text ? [s] : [])) ?? [];
  return (
    <article className="stack mk-detail ibx-detail" aria-label={`Markup: ${short(listed.line, 48)}`} style={{ gap: 'var(--s4)' }}>
      {failed && <p className="hint tone-off" role="alert">{failed}</p>}
      <div className="row between" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
        <MarkupStatusMark status={listed.status} />
        <span className="tiny muted">{listed.personName || 'Someone'}, {listed.demo ? 'from ' : 'in '}{sentFrom(listed)}, {timeAgo(listed.createdAt, app.today)}{listed.mood ? ` · ${MOOD_WORD[listed.mood]}` : ''}</span>
      </div>
      <StatusBy t={listed} />
      <p className="mk-said">{listed.line}</p>
      {n > 1 && <p className="small ibx-group-note"><strong>{n} on this part.</strong> They’re handled together: a change here applies to all {n}.</p>}
      <Actions status={listed.status} busy={busy} form={form} setForm={setForm} onChange={onChange} n={n} onIssue={!listed.issueUrl ? openIssue : undefined} />
      {issueForm && (
        <form className="stack mk-form" onSubmit={(e) => { e.preventDefault(); void keepIssue(); }}>
          <label className="field"><span className="field-label">Paste issue link</span><input className="input" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="https://github.com/sconies/goals-app/issues/123" autoFocus /></label>
          <span className="hint">GitHub opened in a new tab with the issue filled in: press Submit there, then paste its address here.</span>
          <div className="row" style={{ gap: 'var(--s2)' }}><button type="submit" className="btn">Keep the link</button><button type="button" className="btn ghost" onClick={() => setIssueForm(false)}>Not now</button></div>
        </form>
      )}
      {form === 'fixed' && <FixedForm label="Mark fixed" onFixed={(fixedIn) => onChange({ status: 'fixed', fixedIn })} onCancel={() => setForm(null)} hint={`${listed.personName || 'The sender'} sees “You raised this” on that entry. List the markup’s id (${listed.id}) in the entry’s fixes, too.`} />}
      {form === 'wont-fix' && <WontFixForm label="Won’t fix" onWontFix={(reason) => onChange({ status: 'wont-fix', reason })} onCancel={() => setForm(null)} />}
      {listed.issueUrl && <p className="small">Issue: <a href={listed.issueUrl} target="_blank" rel="noopener noreferrer">{listed.issueUrl.replace('https://github.com/', '')}</a></p>}
      {listed.fixedIn && <p className="small">Fixed in <Link to={`/whats-new#${listed.fixedIn}`}>{NEWS.find((e) => e.id === listed.fixedIn)?.title ?? listed.fixedIn}</Link>.</p>}
      {listed.wontFixReason && <p className="small">Won’t fix: {listed.wontFixReason}</p>}
      {!shown && !failed && <p className="hint" role="status">Opening the markup…</p>}
      {shown && (
        <>
          <figure className="mk-figure">
            {shown.urls.screen && !noPicture ? (
              <span className="mk-layers">
                <img src={shown.urls.screen} alt={`The screen ${shown.personName || 'they'} marked up, on ${shown.route}`} onError={() => setNoPicture(true)} />
                {ink && shown.urls.ink && <img className="mk-ink-layer" src={shown.urls.ink} alt="" />}
              </span>
            ) : <span className="hint">{noPicture ? 'The picture couldn’t be opened just now.' : 'The picture isn’t there.'}</span>}
            {shown.urls.ink && !noPicture && <label className="check"><input type="checkbox" checked={ink} onChange={(e) => setInk(e.target.checked)} /><span>Show the drawing</span></label>}
          </figure>
          {n > 1 && (
            <section>
              <h3 className="field-label">On the same part · {n}</h3>
              <ul className="mk-siblings">{row.markups.map((s) => <li key={s.id}><button type="button" className="linkish" aria-current={s.id === id || undefined} onClick={() => setId(s.id)}>{s.line}</button> <span className="tiny muted">{s.personName || 'Someone'}, {timeAgo(s.createdAt, app.today)}</span></li>)}</ul>
            </section>
          )}
          <div className="mk-facts">
            <section>
              <h3 className="field-label">Parts named</h3>
              {namedParts(shown).length ? <ul className="mk-parts">{namedParts(shown).map((p, i) => <li key={i}><PartPath path={p} /></li>)}</ul> : <p className="hint">No named part under the drawing.</p>}
              {notes.length > 0 && <><h3 className="field-label">Notes on the picture</h3><ol className="mk-notes">{notes.map((x) => <li key={x.n} value={x.n}>{x.text}</li>)}</ol></>}
            </section>
            <section>
              <h3 className="field-label">Where it was sent from</h3>
              <dl className="mk-where">
                <dt>Page</dt><dd><code>{shown.path || shown.route}</code></dd>
                {shown.goalId && <><dt>Goal</dt><dd><code>{shown.goalId}</code></dd></>}
                {shown.reviewId && <><dt>Review</dt><dd><code>{shown.reviewId}</code></dd></>}
                <dt>Screen</dt><dd>{shown.context.viewport.w} by {shown.context.viewport.h}, {shown.context.theme}{shown.context.themeChoice === 'system' ? ' (the device’s)' : ''}, accent {shown.context.accent}</dd>
                <dt>Version</dt><dd><code>{shown.context.appVersion}</code></dd>
                <dt>Markup</dt><dd><code>{shown.id}</code></dd>
              </dl>
            </section>
          </div>
          <section>
            <h3 className="field-label">Steps before it</h3>
            {shown.steps.length ? <ol className="mk-steps">{shown.steps.map((s, i) => <li key={i}>{stepText(s)}</li>)}</ol> : <p className="hint">Not included.</p>}
          </section>
          <section>
            <h3 className="field-label">Errors and failed saves on that visit</h3>
            {shown.errors.length ? <ul className="mk-errors">{shown.errors.map((e, i) => <li key={i}>{problemText(e)}</li>)}</ul> : <p className="hint">None.</p>}
          </section>
        </>
      )}
    </article>
  );
}

const pickStatus = (m: Markup) => ({ status: m.status, fixedIn: m.fixedIn, wontFixReason: m.wontFixReason, statusBy: m.statusBy, statusAt: m.statusAt });

/** A piece of feedback opened: what was said, from where, and the same triage as a markup (no picture, no issue). */
function FeedbackDetail({ f, busy, form, setForm, onChange }: { f: InboxFeedback; busy: boolean; form: 'fixed' | 'wont-fix' | null; setForm: (f: 'fixed' | 'wont-fix' | null) => void; onChange: (c: Change) => void }) {
  const app = useApp();
  const said = f.text.trim();
  return (
    <article className="stack mk-detail ibx-detail" aria-label={`Feedback: ${said ? short(said, 48) : MOOD_WORD[f.mood]}`} style={{ gap: 'var(--s4)' }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
        <MarkupStatusMark status={f.status} />
        <span className="tiny muted">{f.personName || 'Someone'}, in {f.workspaceName || f.workspaceId}, {timeAgo(f.at, app.today)} · {MOOD_WORD[f.mood]}</span>
      </div>
      <StatusBy t={f} />
      {said ? <p className="mk-said">{said}</p> : <p className="hint">Only a mood, no words.</p>}
      <Actions status={f.status} busy={busy} form={form} setForm={setForm} onChange={onChange} n={1} />
      {form === 'fixed' && <FixedForm label="Mark fixed" hint={`${f.personName || 'The sender'} sees “You raised this” on that entry. List the feedback’s id (${f.id}) in the entry’s fixes, too.`} onFixed={(fixedIn) => onChange({ status: 'fixed', fixedIn })} onCancel={() => setForm(null)} />}
      {form === 'wont-fix' && <WontFixForm label="Won’t fix" onWontFix={(reason) => onChange({ status: 'wont-fix', reason })} onCancel={() => setForm(null)} />}
      {f.fixedIn && <p className="small">Fixed in <Link to={`/whats-new#${f.fixedIn}`}>{NEWS.find((e) => e.id === f.fixedIn)?.title ?? f.fixedIn}</Link>.</p>}
      {f.wontFixReason && <p className="small">Won’t fix: {f.wontFixReason}</p>}
      <dl className="mk-where">
        <dt>Page</dt><dd><code>{f.path || '/'}</code></dd>
        <dt>Feedback</dt><dd><code>{f.id}</code></dd>
      </dl>
    </article>
  );
}

/** The next step is the main action; the others are plain. For a folded row, they apply to every markup in it. */
function Actions({ status, busy, form, setForm, onChange, onIssue, n }: { status: MarkupStatus; busy: boolean; form: string | null; setForm: (f: 'fixed' | 'wont-fix' | null) => void; onChange: (c: Change) => void; onIssue?: () => void; n: number }) {
  const app = useApp();
  // Only an admin changes the status (mayTriage, the rule statusPatch keeps); everyone else reads.
  if (form) return null;
  // Members see why there are no buttons, where the buttons would be (on a phone the list's line is out of sight).
  if (!mayTriage(app.viewer)) return <p className="tiny muted mk-readonly">{ADMINS_TRIAGE}</p>;
  const open = status === 'new' || status === 'in-hand';
  const all = n > 1 ? ` (all ${n})` : '';
  return (
    <div className="row mk-actions" style={{ gap: 'var(--s2)', flexWrap: 'wrap' }}>
      {status === 'new' && <button type="button" className="btn primary" aria-disabled={busy || undefined} aria-keyshortcuts="I" onClick={() => onChange({ status: 'in-hand' })}>Mark in hand{all}</button>}
      {open && onIssue && <button type="button" className="btn" onClick={onIssue}>Open GitHub issue</button>}
      {open && <button type="button" className={'btn' + (status === 'in-hand' ? ' primary' : '')} aria-keyshortcuts="F" onClick={() => setForm('fixed')}>Mark fixed{all}</button>}
      {open && <button type="button" className="btn" aria-keyshortcuts="W" onClick={() => setForm('wont-fix')}>Won’t fix{all}</button>}
      {!open && <button type="button" className="btn" onClick={() => onChange({ status: 'new' })}>Mark new again{all}</button>}
    </div>
  );
}

/** Marking something fixed: in which What's new entry. */
function FixedForm({ label, hint, onFixed, onCancel }: { label: string; hint: string; onFixed: (fixedIn: string) => void; onCancel: () => void }) {
  const [fixedIn, setFixedIn] = useState(NEWS[0]?.id ?? '');
  return (
    <form className="stack mk-form" onSubmit={(e) => { e.preventDefault(); onFixed(fixedIn); }}>
      <label className="field"><span className="field-label">Fixed in this What’s new entry</span>
        <select className="input" value={fixedIn} onChange={(e) => setFixedIn(e.target.value)} autoFocus>{NEWS.slice(0, 30).map((e) => <option key={e.id} value={e.id}>{e.date}: {e.title}</option>)}</select>
      </label>
      <span className="hint">{hint}</span>
      <div className="row" style={{ gap: 'var(--s2)' }}><button type="submit" className="btn primary">{label}</button><button type="button" className="btn ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

/** Saying why something won't be fixed. */
function WontFixForm({ label, onWontFix, onCancel }: { label: string; onWontFix: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <form className="stack mk-form" onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onWontFix(reason); }}>
      <label className="field"><span className="field-label">Why it won’t be fixed</span><textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
      <div className="row" style={{ gap: 'var(--s2)' }}><button type="submit" className="btn" disabled={!reason.trim()}>{label}</button><button type="button" className="btn ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

/** Who set the status, and when: every change in the open inbox is recorded as the person who made it. */
function StatusBy({ t }: { t: { status: MarkupStatus; statusBy: string | null; statusAt: string | null } }) {
  const app = useApp();
  if (!t.statusBy) return null;
  return <p className="tiny muted mk-by">Marked {STATUS_WORD[t.status].toLowerCase()} by {t.statusBy}{t.statusAt ? `, ${timeAgo(t.statusAt, app.today)}` : ''}.</p>;
}
