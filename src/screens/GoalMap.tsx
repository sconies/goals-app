/* The goal map: the company's goals on a canvas you can pan, zoom and rearrange. North stars at the top, the goals
   that feed them below. Solid lines: feeds into. Dotted: also helps. Bold red: the critical path, the inputs most
   likely to make each top goal miss. Branches fold and unfold; a goal opens its story beside the map. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Background, BaseEdge, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '../app/state';
import { readTour, type TourState } from '../app/tours';
import { LEVEL_LABEL } from '../domain/format';
import { criticalPath, edges as mapEdges, layout, layoutIndented, NODE_H, NODE_W } from '../domain/map';
import { RANK } from '../domain/status';
import { ATTENTION, LABEL, type ResultKind } from '../domain/vocabulary';
import { RESULT_TEXT } from '../domain/story';
import { summarise } from '../domain/summary';
import type { DisplayStatus, Goal } from '../domain/types';
import { Chip, StatusWord } from '../ui/bits';
import { StoryLines } from '../ui/GoalStory';
import { Icon } from '../ui/Icon';

type GoalNodeData = { goal: Goal; status: DisplayStatus; owner: string; result: ResultKind | null; children: number; collapsed: boolean; critical: boolean; root: boolean; context: boolean; onToggle: (id: string) => void };

function GoalNode({ data, selected }: NodeProps<Node<GoalNodeData>>) {
  const { goal, status, owner, result, children, collapsed, critical, root, context, onToggle } = data;
  // The walkthrough's card goes left of a critical goal (else below), 16px off, and never covers the north star it threatens.
  const coach = critical ? (root ? { 'data-coach-avoid': '' } : { 'data-coach-place': 'left below', 'data-coach-gap': '16' }) : {};
  return (
    <div className={'map-node' + (critical ? ' critical' : '') + (selected ? ' selected' : '') + (context ? ' context' : '')} data-tone={status} {...coach}>
      <Handle type="target" position={Position.Bottom} isConnectable={false} />
      <StatusWord k={status} className="map-status">{result && <span className={'result-tag result-' + result}>{RESULT_TEXT[result]}</span>}</StatusWord>
      <span className="map-title">{goal.title}</span>
      <span className="map-meta">{context ? 'Shown for context: not in this filter' : `${owner}${goal.level !== 'team' ? ` · ${LEVEL_LABEL[goal.level]}` : ''}`}</span>
      {children > 0 && (
        <button type="button" className="map-toggle nodrag" aria-expanded={!collapsed} aria-label={`${collapsed ? 'Show' : 'Hide'} the ${children} ${children === 1 ? 'goal' : 'goals'} feeding ${goal.title}`} onClick={(e) => { e.stopPropagation(); onToggle(goal.id); }}>
          {collapsed ? <><Icon name="plus" size={12} />{children}</> : <Icon name="minus" size={12} />}
        </button>
      )}
      <Handle type="source" id="top" position={Position.Top} isConnectable={false} />
      <Handle type="source" id="left" position={Position.Left} isConnectable={false} />
    </div>
  );
}
const nodeTypes = { goal: GoalNode };

/**
 * Every "feeds into" line under a goal shares one trunk: 24px under the goal it feeds, then one drop into it. A stacked
 * input leaves by its left side to its column's line first; the rest go straight up. So the critical path, drawn last,
 * lies on the same line as its grey siblings rather than beside them (fit and finish, 4 Nov).
 */
function BusEdge({ sourceX, sourceY, targetX, targetY, data, markerEnd, style }: EdgeProps<Edge<{ bus?: number }>>) {
  const turn = targetY + 24;
  const path = data?.bus != null ? `M ${sourceX},${sourceY} H ${data.bus} V ${turn} H ${targetX} V ${targetY}` : `M ${sourceX},${sourceY} V ${turn} H ${targetX} V ${targetY}`;
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
/** On a phone, one goal per row: each input leaves by its left side to a spine under the left of the goal it feeds. */
function SpineEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style }: EdgeProps) {
  const spine = targetX - NODE_W / 2 + 18;
  return <BaseEdge path={`M ${sourceX},${sourceY} H ${spine} V ${targetY}`} markerEnd={markerEnd} style={style} />;
}
const edgeTypes = { bus: BusEdge, spine: SpineEdge };
type Frame = 'readable' | 'all';

const posKey = (ws: string) => `goals-map:${ws}`;
const readPos = (ws: string): Record<string, { x: number; y: number }> => { try { return JSON.parse(localStorage.getItem(posKey(ws)) || '{}'); } catch { return {}; } };

/**
 * The map draws `goals`. When the Goals screen is filtered, `matches` are the goals that match; the rest are the goals
 * they feed into, drawn greyed as context. "Only what needs attention" is the Goals screen's Needs attention filter
 * itself (attention=1, the one rule in domain/attention.ts), so the count, the link and "what's shown now" in Export
 * always agree with what's drawn (round 3 review), and with Home, Watching and reviews.
 */
export function GoalMap({ goals, matches, attention, onAttention }: { goals: Goal[]; matches?: Set<string>; attention: boolean; onAttention: (on: boolean) => void }) {
  const app = useApp();
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;
  const [selected, setSelected] = useState<string | null>(null);
  // Opened from the keyboard: the panel takes focus, and closing it gives focus back to the goal on the map.
  const fromKeys = useRef<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set<string>());
  const [moved, setMoved] = useState(() => readPos(app.ws.id));
  const canvas = useRef<HTMLDivElement>(null);
  const statusOf = useCallback((g: Goal) => app.statusOf(g).status, [app]);
  const critical = useMemo(() => criticalPath(goals, statusOf), [goals, statusOf]);
  const toggle = useCallback((id: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  // Worst first under each goal, so the critical path sits next to what it threatens.
  const order = useCallback((a: Goal, b: Goal) => RANK[statusOf(b)] - RANK[statusOf(a)] || a.title.localeCompare(b.title), [statusOf]);
  // On a desktop, a goal with many inputs stacks them in columns of three, so the map is a block rather than one long row.
  const placed = useMemo(() => (phone ? layoutIndented(goals, { collapsed, order }) : layout(goals, { collapsed, order, stack: 3 })), [goals, collapsed, order, phone]);
  const nodes: Node<GoalNodeData>[] = useMemo(() => placed.map((n) => ({
    id: n.id, type: 'goal', position: moved[n.id] ?? { x: n.x, y: n.y }, selected: n.id === selected,
    domAttributes: { 'aria-keyshortcuts': 'Enter Space' },
    ariaLabel: `${n.goal.title}: ${LABEL[statusOf(n.goal)]}${critical.has(n.id) ? ', on the critical path' : ''}${matches && !matches.has(n.id) ? ', shown for context' : ''}`,
    data: { goal: n.goal, status: statusOf(n.goal), owner: app.person(n.goal.ownerId)?.name ?? '', result: (() => { const r = summarise(n.goal, app.snapshot, app.cycle, app.today, app.week).story.result; return r ? r.kind : null; })(), children: n.children, collapsed: n.collapsed, critical: critical.has(n.id), root: n.depth === 0, context: !!matches && !matches.has(n.id), onToggle: toggle },
  })), [placed, moved, selected, statusOf, critical, app, toggle, matches]);
  const busOf = useMemo(() => new Map(placed.filter((n) => n.bus != null).map((n) => [n.id, n.bus!])), [placed]);
  // The critical path is drawn last, so no grey line paints over it.
  const links: Edge[] = useMemo(() => mapEdges(placed, critical).sort((a, b) => Number(a.critical) - Number(b.critical)).map((e) => ({
    id: e.id, source: e.from, target: e.to, selectable: false,
    ...(e.kind === 'helps' ? { type: 'default', sourceHandle: 'top' }
      : phone ? { type: 'spine', sourceHandle: 'left' }
        : busOf.has(e.from) ? { type: 'bus', sourceHandle: 'left', data: { bus: busOf.get(e.from)! } } : { type: 'bus', sourceHandle: 'top' }),
    className: 'map-edge ' + e.kind + (e.critical ? ' critical' : ''),
    ...(e.critical ? { domAttributes: { 'data-coach-avoid': '' } as Record<string, string> } : {}),
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    ...(e.kind === 'helps' ? { style: { strokeDasharray: '6 5' } } : {}),
  })), [placed, critical, busOf, phone]);

  useEffect(() => { try { localStorage.setItem(posKey(app.ws.id), JSON.stringify(moved)); } catch { /* storage blocked */ } }, [moved, app.ws.id]);
  const sel = selected ? goals.find((g) => g.id === selected) : undefined;
  // Open on what matters: the critical path, or failing that the top goals.
  const focus = useMemo(() => {
    // The worst top goal on a critical path, and its path; otherwise the first top goal.
    const roots = placed.filter((n) => n.depth === 0);
    const root = roots.filter((n) => critical.has(n.id)).sort((a, b) => RANK[statusOf(b.goal)] - RANK[statusOf(a.goal)])[0] ?? roots[0];
    if (!root) return [];
    const inTree = (n: (typeof placed)[number]) => { let g: Goal | undefined = n.goal; const seen = new Set<string>(); while (g && !seen.has(g.id)) { if (g.id === root.id) return true; seen.add(g.id); g = goals.find((x) => x.id === g!.parentId); } return false; };
    return placed.filter((n) => n.id === root.id || (critical.has(n.id) && inTree(n))).map((n) => ({ id: n.id }));
  }, [placed, critical, statusOf, goals]);
  // The map fills the window below its controls: on a desktop down to 24px above the window's bottom, so the page doesn't
  // scroll; on a phone, what's left once the controls sit under the top bar, above the tab bar (fit and finish, 4 Nov).
  const bar = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ top: number; phone: number; tabs: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const r = canvas.current?.getBoundingClientRect(), b = bar.current?.getBoundingClientRect();
      if (!r || !b) return;
      const head = document.querySelector('.mtop')?.getBoundingClientRect().height ?? 0;
      const tabs = document.querySelector('.tabbar')?.getBoundingClientRect().height ?? 0;
      const next = { top: Math.round(r.top + window.scrollY), phone: Math.round(window.innerHeight - head - tabs - (r.top - b.top) - 16), tabs: Math.round(tabs) };
      setRoom((o) => (o && o.top === next.top && o.phone === next.phone && o.tabs === next.tabs ? o : next));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });
  const height = phone ? `${Math.max(360, room?.phone ?? 520)}px` : `max(360px, calc(100dvh - ${(room?.top ?? 250) + 24 + (room?.tabs ?? 0)}px))`;
  const flow = useRef<Pick<ReactFlowInstance<Node<GoalNodeData>, Edge>, 'setViewport' | 'getViewport'> | null>(null);
  const [view, setView] = useState<Frame>('readable');
  /**
   * Frame the map ourselves, from the layout: no waiting for nodes to measure. Readable: the north stars and the critical
   * path; everything: every goal. Never smaller than 75% (titles stay at least 10.5px) nor larger than 100%; what doesn't
   * fit is a pan away, and the readable frame then keeps the critical path in view.
   */
  // Until the map has laid itself out and framed the goals, say so, instead of a blank canvas (demo review, 8 Nov).
  const [drawn, setDrawn] = useState(false);
  const frame = (rf: Pick<ReactFlowInstance, 'setViewport'>, mode: Frame = view) => {
    const box = canvas.current?.getBoundingClientRect();
    const pos = (n: (typeof placed)[number]) => moved[n.id] ?? { x: n.x, y: n.y };
    const bounds = (ns: typeof placed) => {
      const ps = ns.map(pos);
      return { minX: Math.min(...ps.map((p) => p.x)), maxX: Math.max(...ps.map((p) => p.x)) + NODE_W, minY: Math.min(...ps.map((p) => p.y)), maxY: Math.max(...ps.map((p) => p.y)) + NODE_H };
    };
    const onPath = placed.filter((n) => focus.some((f) => f.id === n.id));
    const pick = mode === 'all' ? placed : placed.filter((n) => n.depth === 0 || onPath.includes(n));
    if (!box || !pick.length) return;
    const pad = phone ? 12 : 32;
    const fit = (k: ReturnType<typeof bounds>) => Math.max(0.75, Math.min(1, (box.width - 2 * pad) / (k.maxX - k.minX), phone ? 1 : (box.height - 2 * pad) / (k.maxY - k.minY)));
    const fitsX = (k: ReturnType<typeof bounds>, z: number) => (k.maxX - k.minX) * z <= box.width - 2 * pad + 1;
    let b = bounds(pick), zoom = fit(b);
    // The north stars don't all fit at a readable size: nearly (within 15% of the width), start at the critical path's
    // side and leave the last few pixels a pan away; otherwise the readable frame is the critical path alone, centred.
    if (mode === 'readable' && !phone && onPath.length && (b.maxX - b.minX) * zoom > (box.width - 2 * pad) * 1.15) { b = bounds(onPath); zoom = fit(b); }
    // Still too wide (everything, or a phone): start at the left; the rest is a pan to the right.
    const f = onPath.length ? bounds(onPath) : b;
    const x = fitsX(b, zoom) ? box.width / 2 - ((b.minX + b.maxX) / 2) * zoom : Math.max(pad - f.minX * zoom, Math.min(box.width - pad - f.maxX * zoom, pad - b.minX * zoom));
    void rf.setViewport({ zoom, x, y: (phone ? 16 : pad) - b.minY * zoom });
  };
  const allIds = goals.filter((g) => goals.some((c) => c.parentId === g.id)).map((g) => g.id);

  // The walkthrough: on its critical-path step, bring the map into view on a short screen; on its last, the panel is
  // where the story is, so on a phone the sheet leaves room above it for the coach.
  const [tour, setTour] = useState<TourState | null>(readTour);
  useEffect(() => { const on = () => setTour(readTour()); window.addEventListener('goals-tour', on); return () => window.removeEventListener('goals-tour', on); }, []);
  const touring = tour?.id === 'map' ? tour.step : -1;
  useEffect(() => {
    if (touring !== 1) return;
    const t = setTimeout(() => {
      const node = document.querySelector('.goalmap .map-node.critical')?.getBoundingClientRect(), b = bar.current?.getBoundingClientRect();
      if (!node || !b) return;
      const top = underHead();
      if (node.bottom > window.innerHeight - 16 || node.top < top) window.scrollBy({ top: b.top - top - 8 });
    }, 300);
    return () => clearTimeout(t);
  }, [touring]);
  // On a phone the story opens as a sheet: the map scrolls up under the top bar and the goal moves above the sheet.
  useEffect(() => {
    if (!phone || !selected) return;
    const t = setTimeout(() => {
      const c = canvas.current?.getBoundingClientRect(), sheet = document.querySelector('.map-panel')?.getBoundingClientRect();
      if (!c || !sheet) return;
      const top = underHead();
      if (Math.abs(c.top - top) > 2) window.scrollBy({ top: c.top - top });
      const node = document.querySelector(`.react-flow__node[data-id="${CSS.escape(selected)}"]`)?.getBoundingClientRect();
      const rf = flow.current;
      if (!node || !rf) return;
      const want = top + 16, low = sheet.top - 16;
      if (node.top >= want && node.bottom <= low) return;
      const v = rf.getViewport();
      void rf.setViewport({ ...v, y: v.y + (want - node.top) }, { duration: 200 });
    }, 60);
    return () => clearTimeout(t);
  }, [phone, selected]);

  const fold = () => setCollapsed(collapsed.size ? new Set() : new Set(allIds));
  return (
    <div className="goalmap">
      <div className="map-bar" ref={bar} data-coach-avoid="">
        {/* The key is one line; what the critical path means is a click away (visual review 2). */}
        <div className="map-legend" aria-label="Map key">
          <span><i className="key-line" /> Feeds into</span>
          <span><i className="key-line dotted" /> Also helps</span>
          <KeyMore />
        </div>
        <div className="map-tools">
          <label className="check small"><input type="checkbox" checked={attention} onChange={(e) => onAttention(e.target.checked)} /> Only what {ATTENTION.needs.label.toLowerCase()}</label>
          <button type="button" className="btn sm map-fold" onClick={fold}>{collapsed.size ? 'Unfold all' : 'Fold all'}</button>
          {Object.keys(moved).length > 0 && <button type="button" className="btn ghost sm" onClick={() => setMoved({})}>Tidy up</button>}
          {/* Two framings, one at a time: every goal, or the north stars and the critical path at a readable size. */}
          <div className="seg map-frame" role="group" aria-label="Frame the map">
            {([['all', 'Fit all'], ['readable', 'Readable']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => { setView(k); if (flow.current) frame(flow.current, k); }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="map-body">
        <div className="map-canvas" ref={canvas} style={{ height }} role="region" aria-label="Goal map. Drag to move around, scroll or pinch to zoom, Tab to move between goals, Enter to open one."
          onKeyDown={(e) => {
            const node = (e.target as HTMLElement).closest<HTMLElement>('.react-flow__node');
            if (!node || (e.key !== 'Enter' && e.key !== ' ')) return;
            e.preventDefault();
            fromKeys.current = node;
            setSelected(node.dataset.id ?? null);
          }}>
          {!drawn && <div className="map-loading" role="status">Drawing the map of {goals.length} goals…</div>}
          <ReactFlow
            key={(attention ? 'a' : 'all') + goals.length + '-' + collapsed.size}
            nodes={nodes} edges={links} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.3} maxZoom={1.6}
            onInit={(rf) => { flow.current = rf; frame(rf); requestAnimationFrame(() => setDrawn(true)); }}
            nodesConnectable={false} elementsSelectable proOptions={{ hideAttribution: true }} panActivationKeyCode={null}
            onNodeClick={(_, n) => { fromKeys.current = null; setSelected(n.id); }} onPaneClick={() => setSelected(null)}
            onNodeDragStop={(_, n) => setMoved((m) => ({ ...m, [n.id]: n.position }))}
          >
            <Background gap={24} size={1} />
            {/* Top right, clear of the goals on the left and of the tab bar on a phone. */}
            <Controls showInteractive={false} showFitView={false} position="top-right" />
          </ReactFlow>
        </div>
        {sel && <MapPanel goal={sel} focus={!!fromKeys.current} critical={critical.has(sel.id)} height={height} coached={touring === 2} sheet={phone} onClose={() => {
          const back = fromKeys.current;
          setSelected(null);
          fromKeys.current = null;
          back?.focus();
        }} />}
      </div>
    </div>
  );
}

/** The bottom of the phone's top bar, when it stays put as the page scrolls; 0 on a desktop. */
function underHead() {
  const head = document.querySelector('.mtop');
  return head && getComputedStyle(head).position !== 'static' && getComputedStyle(head).display !== 'none' ? head.getBoundingClientRect().bottom : 0;
}

/** What the critical path means: a click away, below the key, closed by a click anywhere else or Escape. */
function KeyMore() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const away = (e: Event) => { const d = ref.current; if (d?.open && !d.contains(e.target as globalThis.Node)) d.open = false; };
    const esc = (e: KeyboardEvent) => { const d = ref.current; if (e.key === 'Escape' && d?.open) { d.open = false; d.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, []);
  return (
    <details className="map-key-more" ref={ref}>
      <summary><i className="key-line critical" /> Critical path<Icon name="chevron-down" size={12} /></summary>
      <span className="hint">Most likely to make it miss, from status (off track, at risk, no recent update) and how much each goal feeds the one above.</span>
    </details>
  );
}

function MapPanel({ goal, onClose, critical, focus, height, coached, sheet }: { goal: Goal; onClose: () => void; critical: boolean; focus: boolean; height: string; coached: boolean; sheet: boolean }) {
  const app = useApp();
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focus) title.current?.focus(); }, [focus, goal.id]);
  const s = summarise(goal, app.snapshot, app.cycle, app.today, app.week);
  const feeds = app.snapshot.goals.filter((g) => g.parentId === goal.id);
  // Beside the map it's as tall as the map and scrolls inside; on a phone it's a sheet. The walkthrough's last step sits
  // beside it: left of it, lined up with its bottom, on a desktop; above it on a phone.
  return (
    <aside className={'map-panel' + (coached ? ' coached' : '')} aria-label={goal.title} style={sheet ? undefined : { height }} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      data-coach-anchor="" data-coach-place={sheet ? 'above' : 'left end'} data-coach-gap="16">
      <div className="row between nowrap map-panel-head"><Chip k={s.status} /><button type="button" className="iconbtn map-close" aria-label="Close" onClick={onClose}><Icon name="close" size={16} /></button></div>
      <h2 className="block-title" ref={title} tabIndex={-1}>{goal.title}</h2>
      <Link className="btn primary" to={'/goals/' + goal.id}>Open the goal</Link>
      <span className="hint">{s.owner} · {s.team}{s.story.feeds ? ` · ${s.story.feeds}` : ''}</span>
      {critical && <span className="small tone-off strong">On the critical path</span>}
      <span className="small">{s.story.where}</span>
      <StoryLines s={s} />
      {feeds.length > 0 && <span className="hint">{feeds.length} {feeds.length === 1 ? 'goal feeds' : 'goals feed'} it.</span>}
    </aside>
  );
}
