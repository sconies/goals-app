/* The goal map: the company's goals on a canvas you can pan, zoom and rearrange. North stars at the top, the goals
   that feed them below. Solid lines: feeds into. Dotted: also helps. Bold red: the critical path, the inputs most
   likely to make each top goal miss. Branches fold and unfold; a goal opens its story beside the map. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Background, BaseEdge, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '../app/state';
import { LEVEL_LABEL } from '../domain/format';
import { criticalPath, edges as mapEdges, layout, layoutIndented, NODE_H, NODE_W } from '../domain/map';
import { LABEL, RANK } from '../domain/status';
import { RESULT_TEXT } from '../domain/story';
import { summarise } from '../domain/summary';
import type { DisplayStatus, Goal } from '../domain/types';
import { Chip, StatusShape } from '../ui/bits';
import { StoryLines } from './GoalViews';

type GoalNodeData = { goal: Goal; status: DisplayStatus; owner: string; result: string | null; children: number; collapsed: boolean; critical: boolean; context: boolean; onToggle: (id: string) => void };

function GoalNode({ data, selected }: NodeProps<Node<GoalNodeData>>) {
  const { goal, status, owner, result, children, collapsed, critical, context, onToggle } = data;
  return (
    <div className={'map-node' + (critical ? ' critical' : '') + (selected ? ' selected' : '') + (context ? ' context' : '')} data-tone={status}>
      <Handle type="target" position={Position.Bottom} isConnectable={false} />
      <span className={'map-status tone-' + status}><StatusShape k={status} />{LABEL[status]}{result && <span className={'result-tag result-' + (result === 'Completed' ? 'completed' : result === 'Completed late' ? 'late' : 'missed')}>{result}</span>}</span>
      <span className="map-title">{goal.title}</span>
      <span className="map-meta">{context ? 'Shown for context: not in this filter' : `${owner}${goal.level !== 'team' ? ` · ${LEVEL_LABEL[goal.level]}` : ''}`}</span>
      {children > 0 && (
        <button type="button" className="map-toggle nodrag" aria-expanded={!collapsed} aria-label={`${collapsed ? 'Show' : 'Hide'} the ${children} ${children === 1 ? 'goal' : 'goals'} feeding ${goal.title}`} onClick={(e) => { e.stopPropagation(); onToggle(goal.id); }}>
          {collapsed ? `+ ${children}` : '−'}
        </button>
      )}
      <Handle type="source" id="top" position={Position.Top} isConnectable={false} />
      <Handle type="source" id="left" position={Position.Left} isConnectable={false} />
    </div>
  );
}
const nodeTypes = { goal: GoalNode };

/** A stacked input's line: left out of the goal to its column's line, up that line, then across into the goal it feeds. */
function BusEdge({ sourceX, sourceY, targetX, targetY, data, markerEnd, style }: EdgeProps<Edge<{ bus: number }>>) {
  const bus = data?.bus ?? sourceX - 16;
  const turn = targetY + 24;
  return <BaseEdge path={`M ${sourceX},${sourceY} H ${bus} V ${turn} H ${targetX} V ${targetY}`} markerEnd={markerEnd} style={style} />;
}
const edgeTypes = { bus: BusEdge };

const posKey = (ws: string) => `goals-map:${ws}`;
const readPos = (ws: string): Record<string, { x: number; y: number }> => { try { return JSON.parse(localStorage.getItem(posKey(ws)) || '{}'); } catch { return {}; } };

/**
 * The map draws `goals`. When the Goals screen is filtered, `matches` are the goals that match; the rest are the goals
 * they feed into, drawn greyed as context. "Only what needs attention" is the status filter itself, so the count, the
 * link and "what's shown now" in Export always agree with what's drawn (round 3 review).
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
    id: n.id, type: 'goal', position: moved[n.id] ?? { x: n.x, y: n.y }, selected: n.id === selected, domAttributes: { 'aria-keyshortcuts': 'Enter Space' },
    ariaLabel: `${n.goal.title}: ${LABEL[statusOf(n.goal)]}${critical.has(n.id) ? ', on the critical path' : ''}${matches && !matches.has(n.id) ? ', shown for context' : ''}`,
    data: { goal: n.goal, status: statusOf(n.goal), owner: app.person(n.goal.ownerId)?.name ?? '', result: (() => { const r = summarise(n.goal, app.snapshot, app.cycle, app.today, app.week).story.result; return r ? RESULT_TEXT[r.kind] : null; })(), children: n.children, collapsed: n.collapsed, critical: critical.has(n.id), context: !!matches && !matches.has(n.id), onToggle: toggle },
  })), [placed, moved, selected, statusOf, critical, app, toggle, matches]);
  const busOf = useMemo(() => new Map(placed.filter((n) => n.bus != null).map((n) => [n.id, n.bus!])), [placed]);
  const links: Edge[] = useMemo(() => mapEdges(placed, critical).map((e) => ({
    id: e.id, source: e.from, target: e.to, selectable: false,
    ...(e.kind === 'feeds' && busOf.has(e.from) ? { type: 'bus', sourceHandle: 'left', data: { bus: busOf.get(e.from)! } } : { type: e.kind === 'helps' ? 'default' : 'smoothstep', sourceHandle: 'top' }),
    className: 'map-edge ' + e.kind + (e.critical ? ' critical' : ''),
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    ...(e.kind === 'helps' ? { style: { strokeDasharray: '6 5' } } : {}),
  })), [placed, critical, busOf]);

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
  // On a desktop the canvas fills the window below the page's header: the map is the page.
  // Measured from where the canvas starts, so the whole map and its controls fit in the window (Senior UX review, 2 Nov).
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => { const r = canvas.current?.getBoundingClientRect(); if (r) setTop(r.top + window.scrollY); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const height = phone ? '70vh' : `max(420px, calc(100vh - ${Math.round((top ?? 250) + 16)}px))`;
  const flow = useRef<Pick<ReactFlowInstance, 'setViewport'> | null>(null);
  // Frame the critical path (or the top goals) ourselves, from the layout: no waiting for nodes to measure.
  const frame = (rf: Pick<ReactFlowInstance, 'setViewport'>) => {
    const box = canvas.current?.getBoundingClientRect();
    const pts = placed.filter((n) => focus.some((f) => f.id === n.id)).map((n) => moved[n.id] ?? { x: n.x, y: n.y });
    if (!box || !pts.length) return;
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x)) + NODE_W;
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y)) + NODE_H;
    const zoom = phone ? Math.min(1, (box.width - 24) / (Math.max(...placed.map((n) => n.x)) + NODE_W)) : Math.max(0.7, Math.min(1, (box.width - 48) / (maxX - minX), (box.height - 64) / (maxY - minY)));
    void rf.setViewport(phone ? { zoom, x: 12, y: 16 - minY * zoom } : { zoom, x: box.width / 2 - ((minX + maxX) / 2) * zoom, y: 32 - minY * zoom });
  };
  const allIds = goals.filter((g) => goals.some((c) => c.parentId === g.id)).map((g) => g.id);

  return (
    <div className="goalmap">
      <div className="row between map-bar">
        {/* The key is one line; what the critical path means is a click away (visual review 2). */}
        <div className="map-legend" aria-label="Map key">
          <span><i className="key-line" /> Feeds into</span>
          <span><i className="key-line dotted" /> Also helps</span>
          <details className="map-key-more"><summary><i className="key-line critical" /> Critical path</summary><span className="hint">Most likely to make it miss, from status (off track, at risk, no recent update) and how much each goal feeds the one above.</span></details>
        </div>
        <span className="row" style={{ gap: 'var(--s2)' }}>
          <label className="check small"><input type="checkbox" checked={attention} onChange={(e) => onAttention(e.target.checked)} /> Only what needs attention</label>
          <button type="button" className="btn sm" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(allIds))}>{collapsed.size ? 'Unfold all' : 'Fold all'}</button>
          {Object.keys(moved).length > 0 && <button type="button" className="btn ghost sm" onClick={() => setMoved({})}>Tidy up</button>}
          <button type="button" className="btn ghost sm" onClick={() => { if (flow.current) frame(flow.current); }}>Reset view</button>
        </span>
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
          <ReactFlow
            key={(attention ? 'a' : 'all') + goals.length + '-' + collapsed.size}
            nodes={nodes} edges={links} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.2} maxZoom={1.6}
            onInit={(rf) => { flow.current = rf; frame(rf); }}
            nodesConnectable={false} elementsSelectable proOptions={{ hideAttribution: true }} panActivationKeyCode={null}
            onNodeClick={(_, n) => { fromKeys.current = null; setSelected(n.id); }} onPaneClick={() => setSelected(null)}
            onNodeDragStop={(_, n) => setMoved((m) => ({ ...m, [n.id]: n.position }))}
          >
            <Background gap={24} size={1} />
            {/* Fit view never shrinks the words below a readable size; scroll for the rest (visual review 2). */}
            <Controls showInteractive={false} position="top-right" fitViewOptions={{ minZoom: 0.75, padding: 0.08 }} />
          </ReactFlow>
        </div>
        {sel && <MapPanel goal={sel} focus={!!fromKeys.current} critical={critical.has(sel.id)} onClose={() => {
          const back = fromKeys.current;
          setSelected(null);
          fromKeys.current = null;
          back?.focus();
        }} />}
      </div>
    </div>
  );
}

function MapPanel({ goal, onClose, critical, focus }: { goal: Goal; onClose: () => void; critical: boolean; focus: boolean }) {
  const app = useApp();
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focus) title.current?.focus(); }, [focus, goal.id]);
  const s = summarise(goal, app.snapshot, app.cycle, app.today, app.week);
  const feeds = app.snapshot.goals.filter((g) => g.parentId === goal.id);
  return (
    <aside className="map-panel" aria-label={goal.title} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="row between nowrap"><Chip k={s.status} /><button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>✕</button></div>
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
