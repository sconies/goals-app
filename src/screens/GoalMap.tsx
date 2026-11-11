/* The goal map: the company's goals on a canvas you can pan, zoom and rearrange. North stars at the top, the goals
   that feed them below. Solid lines: feeds into. Dotted: also helps. Bold red: the critical path, the inputs most
   likely to make each top goal miss. Branches fold and unfold; a goal opens its story beside the map. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Background, BaseEdge, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '../app/state';
import { resultWeek } from '../domain/plan';
import { readTour, type TourState } from '../app/tours';
import { fmt, gapBeside, LEVEL_LABEL, nowText } from '../domain/format';
import { FEEDER_SCOPE } from '../domain/goalPage';
import { above, bounds, criticalPath, edges as mapEdges, layout, layoutIndented, NODE_H, NODE_W, pack, rollup, rollupText, shownOnMap, troubled } from '../domain/map';
import { assessPosted, RANK } from '../domain/status';
import { LABEL, type ResultKind } from '../domain/vocabulary';
import { goalResult, RESULT_TEXT } from '../domain/story';
import { summarise } from '../domain/summary';
import type { DisplayStatus, Goal } from '../domain/types';
import { Chip, StatusShape, StatusWord, TitleTell } from '../ui/bits';
import { StoryLines } from '../ui/GoalStory';
import { Icon } from '../ui/Icon';

type GoalNodeData = {
  goal: Goal; status: DisplayStatus; owner: string; result: ResultKind | null; children: number; hidden: number; critical: boolean; root: boolean; context: boolean; found: boolean;
  /** Its number, the target and the gap, in a line; null for a goal with no number. */
  nums: { now: string; target: string | null; gap: { short: string; tone: string } | null } | null;
  /** What's under it, by the one roll-up rule: the worst status there and the words for it. */
  under: { worst: DisplayStatus; text: string; total: number } | null;
  onToggle: (id: string) => void;
};

function GoalNode({ data, selected }: NodeProps<Node<GoalNodeData>>) {
  const { goal, status, owner, result, children, hidden, critical, root, context, found, nums, under, onToggle } = data;
  // The walkthrough's card goes left of a critical goal (else below), 16px off, and never covers the north star it threatens.
  const coach = critical ? (root ? { 'data-coach-avoid': '' } : { 'data-coach-place': 'left below', 'data-coach-gap': '16' }) : {};
  return (
    <div className={'map-node' + (critical ? ' critical' : '') + (selected ? ' selected' : '') + (context ? ' context' : '') + (found ? ' found' : '')} data-tone={status} {...coach}>
      <Handle type="target" position={Position.Bottom} isConnectable={false} />
      <StatusWord k={status} className="map-status">{result && <span className={'result-tag result-' + result}>{RESULT_TEXT[result]}</span>}</StatusWord>
      <span className="map-title" title={goal.title}>{goal.title}<TitleTell goal={goal} /></span>
      {nums && (
        <span className="map-nums">
          <span className="strong">{nums.now}</span>
          {nums.target && <span className="muted"> · target {nums.target}</span>}
          {nums.gap && <span className={'tone-' + nums.gap.tone}> · {nums.gap.short}</span>}
        </span>
      )}
      {/* A parent shows the worst status of everything under it, as a shape and its words (the List's roll-up). */}
      {under && <span className={'map-under tone-' + under.worst} title={`${FEEDER_SCOPE.tree} (${under.total})`}><StatusShape k={under.worst} /><span>Under it: {under.text}</span></span>}
      <span className="map-meta">{context ? 'Shown for context: not in this filter' : `${goal.key ? goal.key + ' · ' : ''}${owner}${goal.level !== 'team' ? ` · ${LEVEL_LABEL[goal.level]}` : ''}`}</span>
      {children > 0 && (
        <button type="button" className="map-toggle nodrag" aria-expanded={hidden === 0} aria-label={hidden ? `Show the ${hidden} ${hidden === 1 ? 'goal' : 'goals'} feeding ${goal.title}` : `Hide the ${children} ${children === 1 ? 'goal' : 'goals'} feeding ${goal.title}`} onClick={(e) => { e.stopPropagation(); onToggle(goal.id); }}>
          {hidden ? <><Icon name="plus" size={12} />{hidden}</> : <Icon name="minus" size={12} />}
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
const troubleKey = (ws: string) => `goals-map-troubled:${ws}`;
const readTrouble = (ws: string) => { try { return localStorage.getItem(troubleKey(ws)) === '1'; } catch { return false; } };

/**
 * The map draws `goals`. When the Goals screen is filtered, `matches` are the goals that match; the rest are the goals
 * they feed into, drawn greyed as context. What needs attention is the Goals list bar's Needs attention switch
 * itself (attention=1, the one rule in domain/attention.ts), so the count, the link and "what's shown now" in Export
 * always agree with what's drawn (round 3 review), and with Home, Watching and reviews.
 *
 * At scale (backlog MAP, 9 Nov): it opens folded to the top goals with the critical path still drawn beneath them,
 * the trees wrapped into rows so Fit all really fits, the list bar's search that opens a goal's tree and moves to it (`goTo`), numbers and
 * a roll-up on every node, and a switch for the trees in trouble only.
 */
export function GoalMap({ goals, matches, goTo }: { goals: Goal[]; matches?: Set<string>; goTo?: { id: string; n: number } | null }) {
  const app = useApp();
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches;
  const [selected, setSelected] = useState<string | null>(null);
  // Opened from the keyboard: the panel takes focus, and closing it gives focus back to the goal on the map.
  const fromKeys = useRef<HTMLElement | null>(null);
  const [moved, setMoved] = useState(() => readPos(app.ws.id));
  const canvas = useRef<HTMLDivElement>(null);
  const statusOf = useCallback((g: Goal) => app.statusOf(g).status, [app]);
  // Only the trees in trouble: their top goal or anything under it off track, at risk or gone quiet.
  const [onlyTroubled, setOnlyTroubled] = useState(() => readTrouble(app.ws.id));
  useEffect(() => { try { localStorage.setItem(troubleKey(app.ws.id), onlyTroubled ? '1' : '0'); } catch { /* storage blocked */ } }, [onlyTroubled, app.ws.id]);
  const scope = useMemo(() => {
    if (!onlyTroubled) return goals;
    const ids = new Set(goals.map((g) => g.id));
    const keep = new Set(goals.filter((g) => !g.parentId || !ids.has(g.parentId)).filter((r) => troubled(r, goals, statusOf)).map((r) => r.id));
    const rootOf = (g: Goal) => { const up = above(g, goals).filter((id) => ids.has(id)); return up.length ? up[up.length - 1]! : g.id; };
    return goals.filter((g) => keep.has(rootOf(g)));
  }, [goals, onlyTroubled, statusOf]);
  const critical = useMemo(() => criticalPath(scope, statusOf), [scope, statusOf]);
  const parents = useMemo(() => new Set(scope.filter((g) => g.parentId).map((g) => g.parentId!)), [scope]);
  // Folding: opened goals show all their inputs, shut ones none; the rest only their next step on the critical path.
  // Filtered (a search or a filter on the Goals screen), every match is unfolded, so none is left hidden in a fold.
  const [open, setOpen] = useState<Set<string>>(() => (matches ? new Set(parents) : new Set()));
  const [shut, setShut] = useState<Set<string>>(() => new Set());
  const matchKey = matches ? [...matches].sort().join(',') : '';
  useEffect(() => { setOpen(matches ? new Set(goals.filter((g) => g.parentId).map((g) => g.parentId!)) : new Set()); setShut(new Set()); }, [matchKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => shownOnMap(scope, critical, { open, shut, trail: true }), [scope, critical, open, shut]);
  const kidsOf = useMemo(() => { const m = new Map<string, Goal[]>(); for (const g of scope) if (g.parentId) m.set(g.parentId, [...(m.get(g.parentId) ?? []), g]); return m; }, [scope]);
  const toggle = useCallback((id: string) => {
    const hidden = (kidsOf.get(id) ?? []).some((c) => !shown.has(c.id));
    setOpen((o) => { const n = new Set(o); if (hidden) n.add(id); else n.delete(id); return n; });
    setShut((o) => { const n = new Set(o); if (hidden) n.delete(id); else n.add(id); return n; });
  }, [kidsOf, shown]);
  // Worst first under each goal, so the critical path sits next to what it threatens.
  const order = useCallback((a: Goal, b: Goal) => RANK[statusOf(b)] - RANK[statusOf(a)] || a.title.localeCompare(b.title), [statusOf]);
  // The canvas's size: the trees are wrapped into rows to suit it.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  // On a desktop, a goal with many inputs stacks them in columns of three, and the trees wrap into rows of about the
  // canvas's shape, so Fit all shows every goal at a size that can still be read where it can (MAP, 9 Nov).
  const placed = useMemo(() => (phone ? layoutIndented(scope, { only: shown, order }) : pack(layout(scope, { only: shown, order, stack: 3 }), box?.w ?? 1200, box?.h ?? 700)), [scope, shown, order, phone, box]);
  const [found, setFound] = useState<string | null>(null);
  const nodes: Node<GoalNodeData>[] = useMemo(() => placed.map((n) => {
    const g = n.goal, a = assessPosted(g, app.cycle, app.snapshot.checkIns, app.week), st = statusOf(g);
    const gap = st === 'stale' ? null : gapBeside(g, a);
    const r = rollup(g, scope, statusOf);
    const kids = kidsOf.get(g.id) ?? [];
    return {
      id: n.id, type: 'goal', position: moved[n.id] ?? { x: n.x, y: n.y }, selected: n.id === selected,
      domAttributes: { 'aria-keyshortcuts': 'Enter Space' },
      ariaLabel: `${g.key ? g.key + ' ' : ''}${g.title}: ${LABEL[st]}${critical.has(n.id) ? ', on the critical path' : ''}${matches && !matches.has(n.id) ? ', shown for context' : ''}`,
      data: {
        goal: g, status: st, owner: app.person(g.ownerId)?.name ?? '', result: goalResult(g, app.cycle, app.snapshot.checkIns, resultWeek(app.cycle, app.today))?.kind ?? null,
        children: kids.length, hidden: kids.filter((c) => !shown.has(c.id)).length, critical: critical.has(n.id), root: n.depth === 0, context: !!matches && !matches.has(n.id), found: found === n.id,
        nums: { now: nowText(g, a), target: g.kind === 'metric' ? fmt(g.plan.target, g) : null, gap: gap ? { short: gap.short, tone: gap.tone } : null },
        under: r ? { worst: r.worst, text: rollupText(r), total: r.total } : null,
        onToggle: toggle,
      },
    };
  }), [placed, moved, selected, statusOf, critical, app, toggle, matches, scope, kidsOf, shown, found]);
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
    return placed.filter((n) => n.id === root.id || (critical.has(n.id) && n.tree === root.id)).map((n) => ({ id: n.id }));
  }, [placed, critical, statusOf]);
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
      const size = { w: Math.round(r.width), h: Math.round(r.height) };
      if (size.w > 0 && size.h > 0) setBox((o) => (o && Math.abs(o.w - size.w) < 8 && Math.abs(o.h - size.h) < 8 ? o : size));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });
  const height = phone ? `${Math.max(360, room?.phone ?? 520)}px` : `max(320px, calc(100dvh - ${(room?.top ?? 250) + 24 + (room?.tabs ?? 0)}px))`;
  const flow = useRef<Pick<ReactFlowInstance<Node<GoalNodeData>, Edge>, 'setViewport' | 'getViewport'> | null>(null);
  // A desktop opens on the whole map, which now fits; a phone on the critical path at a size that can be read.
  const [view, setView] = useState<Frame>(phone ? 'readable' : 'all');
  /**
   * Frame the map ourselves, from the layout: no waiting for nodes to measure. Fit all: every goal, as large as fits
   * (never more than 100%), however small that is: it's an overview, and a goal is a zoom or a search away. Readable:
   * the north stars and the critical path, never smaller than 75% (titles stay at least 10.5px); what doesn't fit is a
   * pan away, and the readable frame then keeps the critical path in view.
   */
  const frame = (rf: Pick<ReactFlowInstance, 'setViewport'>, mode: Frame = view) => {
    const cv = canvas.current?.getBoundingClientRect();
    const pos = (n: (typeof placed)[number]) => moved[n.id] ?? { x: n.x, y: n.y };
    const box = (ns: typeof placed) => bounds(ns.map(pos));
    const onPath = placed.filter((n) => focus.some((f) => f.id === n.id));
    const pick = mode === 'all' ? placed : placed.filter((n) => n.depth === 0 || onPath.includes(n));
    if (!cv || !pick.length) return;
    const pad = phone ? 12 : 32, top = FIND_ROOM;
    const scale = (k: ReturnType<typeof box>) => Math.min(1, (cv.width - 2 * pad) / (k.maxX - k.minX), mode === 'readable' && phone ? 1 : (cv.height - pad - top) / (k.maxY - k.minY));
    const fit = (k: ReturnType<typeof box>) => (mode === 'all' ? Math.max(MIN_ZOOM, scale(k)) : Math.max(0.75, scale(k)));
    const fitsX = (k: ReturnType<typeof box>, z: number) => (k.maxX - k.minX) * z <= cv.width - 2 * pad + 1;
    let b = box(pick), zoom = fit(b);
    // The north stars don't all fit at a readable size: nearly (within 15% of the width), start at the critical path's
    // side and leave the last few pixels a pan away; otherwise the readable frame is the critical path alone, centred.
    if (mode === 'readable' && !phone && onPath.length && (b.maxX - b.minX) * zoom > (cv.width - 2 * pad) * 1.15) { b = box(onPath); zoom = fit(b); }
    // Still too wide (a phone): start at the left; the rest is a pan to the right.
    const f = onPath.length ? box(onPath) : b;
    const x = fitsX(b, zoom) ? cv.width / 2 - ((b.minX + b.maxX) / 2) * zoom : Math.max(pad - f.minX * zoom, Math.min(cv.width - pad - f.maxX * zoom, pad - b.minX * zoom));
    const fitsY = (b.maxY - b.minY) * zoom <= cv.height - pad - top;
    const y = mode === 'all' && fitsY ? top + (cv.height - pad - top) / 2 - ((b.minY + b.maxY) / 2) * zoom : top - b.minY * zoom;
    void rf.setViewport({ zoom, x, y });
  };
  // The map refits whenever what it shows changes: a filter, a search, the trees in trouble or the window's size
  // (review F05), but not when a branch is folded or unfolded, so the goal you were looking at stays where it was.
  const scopeKey = scope.map((g) => g.id).join(',') + (box ? `@${box.w}x${box.h}` : '');
  const framed = useRef('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const rf = flow.current;
    if (!ready || !rf || !box || framed.current === scopeKey) return;
    framed.current = scopeKey;
    frame(rf);
  });

  // Find a goal: it opens the goals above it, so it's drawn, outlines it and moves the map to it.
  const findGoal = (g: Goal) => {
    if (!scope.some((x) => x.id === g.id)) setOnlyTroubled(false);
    const up = above(g, goals);
    setOpen((o) => new Set([...o, ...up]));
    setShut((o) => { const n = new Set(o); up.forEach((id) => n.delete(id)); return n; });
    setFound(g.id);
    pendingPan.current = g.id;
  };
  const pendingPan = useRef<string | null>(null);
  // The list bar's search found a goal (goals spec, 2.3): go to it, each time it's asked, even for the same goal again.
  useEffect(() => { const g = goTo && goals.find((x) => x.id === goTo.id); if (g) findGoal(g); }, [goTo?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = pendingPan.current, rf = flow.current, cv = canvas.current?.getBoundingClientRect();
    const n = placed.find((x) => x.id === id);
    if (!id || !rf || !cv || !n) return;
    pendingPan.current = null;
    const p = moved[n.id] ?? { x: n.x, y: n.y };
    const zoom = Math.max(rf.getViewport().zoom, phone ? 1 : 0.9);
    void rf.setViewport({ zoom, x: cv.width / 2 - (p.x + NODE_W / 2) * zoom, y: FIND_ROOM + (cv.height - FIND_ROOM) / 2 - (p.y + NODE_H / 2) * zoom }, { duration: 300 });
    // The goal itself takes focus, so Enter opens its story.
    setTimeout(() => document.querySelector<HTMLElement>(`.goalmap .react-flow__node[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }), 320);
  }, [placed, moved, phone]);

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

  // Unfold every branch, or go back to the top goals and their critical paths.
  const hiddenAny = scope.some((g) => g.parentId && parents.has(g.parentId) && !shown.has(g.id));
  const fold = () => { if (hiddenAny) { setOpen(new Set(parents)); setShut(new Set()); } else { setOpen(new Set()); setShut(new Set()); } };
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
          <label className="check small map-troubled" title="Trees whose top goal or anything under it is off track, at risk or has no recent update"><input type="checkbox" checked={onlyTroubled} onChange={(e) => setOnlyTroubled(e.target.checked)} /> <span className="map-long">Troubled trees only</span><span className="map-short">Troubled trees</span></label>
          <button type="button" className="btn sm map-fold" onClick={fold}>{hiddenAny ? 'Unfold all' : 'Fold to the top'}</button>
          {Object.keys(moved).length > 0 && <button type="button" className="btn ghost sm" onClick={() => setMoved({})}>Tidy up</button>}
          {/* Two framings, one at a time: every goal, or the north stars and the critical path at a readable size. */}
          <div className="seg map-frame" role="group" aria-label="Frame the map">
            {([['all', 'Fit all'], ['readable', 'Readable']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => { setView(k); if (flow.current) frame(flow.current, k); }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {onlyTroubled && !scope.length && <p className="calm"><Icon name="check-circle" size={15} /> No tree is in trouble: nothing in it is off track, at risk or without a recent update.</p>}
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
            nodes={nodes} edges={links} nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={MIN_ZOOM} maxZoom={1.6}
            onInit={(rf) => { flow.current = rf; setReady(true); }}
            nodesConnectable={false} elementsSelectable deleteKeyCode={null} proOptions={{ hideAttribution: true }} panActivationKeyCode={null}
            onNodeClick={(_, n) => { fromKeys.current = null; setSelected(n.id); setFound(null); }} onPaneClick={() => { setSelected(null); setFound(null); }}
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

/** The smallest the map goes: Fit all reaches it only with every goal unfolded on a small window. */
const MIN_ZOOM = 0.1;
/** Room at the top of the map, above the goals, when it frames them or goes to one. */
const FIND_ROOM = 24;

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
