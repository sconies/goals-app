/* Marking up a screen: the visible screen is taken as a still picture, the person draws on it (pen, arrow, box, a
   numbered note), says in one line what should change, sees the exact picture that will be sent, and sends it to the
   people building Faro. Started from Send feedback, or with Ctrl+Shift+M (Cmd+Shift+M on a Mac); Escape cancels.
   Works with a mouse, touch and the keyboard alone: arrow keys move a crosshair, Enter starts and ends a mark. */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import { useApp } from '../app/state';
import { useAppearance } from '../app/appearance';
import { appRouteFor } from '../help/guide';
import { WHATS_NEW } from '../help/whatsNew';
import { recentProblems, recentSteps, telemetry } from '../telemetry';
import { captureScreen, type Capture } from './capture';
import { HALO, HALO_WIDTH, INK, WIDTH, arrowHead, makePictures, noteLabel, penPath, type Pictures } from './ink';
import { MOODS, PIN, STEPS_MAX, buildMarkup, partsUnder, strokeBox, type Mood, type Pt, type Stroke, type Tool } from './model';
import { newMarkupId, sendMarkup } from './backend';

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'pen', label: 'Pen', key: 'p' },
  { id: 'arrow', label: 'Arrow', key: 'a' },
  { id: 'box', label: 'Box', key: 'b' },
  { id: 'note', label: 'Note', key: 'n' },
];
const ICON: Record<string, ReactElement> = {
  pen: <path d="M3 13.5 3.5 11 11 3.5l1.5 1.5L5 12.5zM9.5 5l1.5 1.5" />,
  arrow: <path d="M3 13 13 3M7 3h6v6" />,
  box: <rect x="2.5" y="3.5" width="11" height="9" rx="1" />,
  note: <><circle cx="8" cy="7" r="4.5" /><path d="M8 11.5V14" /></>,
  undo: <path d="M5.5 4 2.5 7l3 3M2.5 7h7a4 4 0 0 1 0 8h-2" />,
  clear: <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9" />,
  cancel: <path d="m4 4 8 8M12 4l-8 8" />,
  next: <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />,
};
const Glyph = ({ name }: { name: string }) => <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[name]}</svg>;
const KIND: Record<Tool, string> = { pen: 'Pen line', arrow: 'Arrow', box: 'Box', note: 'Note' };

/** The marks as SVG, in the ink colour with its halo. */
function Ink({ strokes, w }: { strokes: Stroke[]; w: number }) {
  return (
    <>
      {strokes.map((s, i) => {
        const both = (d: string) => <><path d={d} stroke={HALO} strokeWidth={HALO_WIDTH} /><path d={d} stroke={INK} strokeWidth={WIDTH} /></>;
        if (s.kind === 'pen') return <g key={i}>{both(penPath(s.points))}</g>;
        if (s.kind === 'arrow') { const [a, b] = arrowHead(s.from, s.to); return <g key={i}>{both(`M${s.from.join(' ')} L${s.to.join(' ')} M${a.join(' ')} L${s.to.join(' ')} L${b.join(' ')}`)}</g>; }
        if (s.kind === 'box') { const b = strokeBox(s); return <g key={i}>{both(`M${b.x} ${b.y}h${b.w}v${b.h}h${-b.w}z`)}</g>; }
        const l = noteLabel(s, w);
        return (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r={PIN / 2} fill={INK} stroke={HALO} strokeWidth={3} />
            <text x={s.x} y={s.y + 5} textAnchor="middle" fill={HALO} fontSize="14" fontWeight="700">{s.n}</text>
            {s.text && <text x={l.x} y={l.y} textAnchor={l.anchor} fill={INK} stroke={HALO} strokeWidth={5} paintOrder="stroke" fontSize="14" fontWeight="600">{s.text.length > 60 ? s.text.slice(0, 59) + '…' : s.text}</text>}
          </g>
        );
      })}
    </>
  );
}

/** A path of screen parts, for reading: "Goal page, Scorecard, Will it hit" to a screen reader, with chevrons between. */
export function PartPath({ path }: { path: string[] }) {
  return (
    <span className="mk-path">
      {path.map((n, i) => <Fragment key={i}>{i > 0 && <><svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><path d="m2.5 1.5 3 2.5-3 2.5" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg><span className="sr">, </span></>}<span>{n}</span></Fragment>)}
    </span>
  );
}

export default function MarkupFlow({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const look = useAppearance();
  const { pathname, search } = useLocation();
  const [cap, setCap] = useState<Capture | null>(null);
  const [shot, setShot] = useState('');
  const [phase, setPhase] = useState<'drawing' | 'send'>('drawing');
  const [tool, setTool] = useState<Tool>('pen');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [note, setNote] = useState<{ x: number; y: number; text: string } | null>(null);
  const [said, setSaid] = useState('');
  const [line, setLine] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [steps, setSteps] = useState(true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pics, setPics] = useState<(Pictures & { preview: string }) | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;

  // Take the picture first (nothing of the markup's own is in it), then freeze the page behind the drawing.
  useEffect(() => {
    let live = true;
    captureScreen().then((c) => {
      if (!live) return;
      setCap(c);
      setShot(c.image.toDataURL('image/png'));
    }).catch((e: unknown) => {
      if (!live) return;
      app.toast('Couldn’t take a picture of this screen: ' + (e instanceof Error ? e.message : String(e)), 'error');
      close.current();
    });
    return () => { live = false; };
    // Once, when the markup starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!cap) return;
    const html = document.documentElement, body = document.body, appEl = document.querySelector<HTMLElement>('.app');
    const before = [html.style.overflow, body.style.overflow];
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden';
    appEl?.setAttribute('inert', '');
    const prev = document.activeElement as HTMLElement | null;
    surface.current?.focus();
    return () => { html.style.overflow = before[0]!; body.style.overflow = before[1]!; appEl?.removeAttribute('inert'); prev?.focus?.(); };
  }, [cap]);

  const W = cap?.width ?? window.innerWidth, H = cap?.height ?? window.innerHeight;
  const clamp = (p: Pt): Pt => [Math.max(0, Math.min(W, p[0])), Math.max(0, Math.min(H, p[1]))];
  const announce = (t: string) => setSaid(t);
  const notes = strokes.filter((s) => s.kind === 'note').length;

  const add = (s: Stroke) => {
    setStrokes((l) => [...l, s]);
    const under = cap ? partsUnder(strokeBox(s), cap.parts)[0] : undefined;
    announce(`${KIND[s.kind]} added${under ? ` over ${under.join(', ')}` : ''}. ${strokes.length + 1} ${strokes.length + 1 === 1 ? 'mark' : 'marks'}.`);
  };
  const begin = (p: Pt) => {
    if (tool === 'note') { setNote({ x: p[0], y: p[1], text: '' }); return; }
    setDraft(tool === 'pen' ? { kind: 'pen', points: [p] } : tool === 'arrow' ? { kind: 'arrow', from: p, to: p } : { kind: 'box', x: p[0], y: p[1], w: 0, h: 0 });
  };
  const extend = (d: Stroke, p: Pt): Stroke => (d.kind === 'pen' ? { ...d, points: [...d.points, p] } : d.kind === 'arrow' ? { ...d, to: p } : d.kind === 'box' ? { ...d, w: p[0] - d.x, h: p[1] - d.y } : d);
  const finish = (d: Stroke | null) => {
    setDraft(null);
    if (!d) return;
    const b = strokeBox(d);
    // A tap with the pen is a dot; an arrow or box too small to see is dropped.
    if (d.kind !== 'pen' && Math.max(b.w, b.h) < 6) return;
    add(d);
  };
  const undo = () => { if (!strokes.length) return; setStrokes((l) => l.slice(0, -1)); announce(`Took back the last mark. ${strokes.length - 1} left.`); };
  const clear = () => { if (!strokes.length) return; setStrokes([]); announce('Cleared every mark.'); };
  const choose = (t: Tool) => { setTool(t); announce(`${TOOLS.find((x) => x.id === t)!.label} chosen.`); };
  const placeNote = () => {
    if (!note) return;
    add({ kind: 'note', n: notes + 1, x: note.x, y: note.y, text: note.text.trim() });
    setNote(null);
    surface.current?.focus();
  };

  const toSend = useCallback(async () => {
    if (!cap) return;
    setNote(null); setDraft(null);
    setPhase('send');
    setPics(await makePictures(cap.image, strokes, cap.width, cap.height, cap.scale));
  }, [cap, strokes]);

  // Escape cancels: what's being drawn first, then the markup.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (note) { setNote(null); surface.current?.focus(); return; }
      if (draft) { setDraft(null); announce('Stopped that mark.'); return; }
      close.current();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [note, draft]);

  const point = (e: ReactPointerEvent): Pt => clamp([e.clientX, e.clientY]);
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (note || e.button > 0) return;
    e.preventDefault();
    surface.current?.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    setCursor(null);
    begin(point(e));
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => { if (drawing.current && draft) setDraft(extend(draft, point(e))); };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    finish(draft ? extend(draft, point(e)) : null);
  };
  const keys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 8;
    const moves: Record<string, Pt> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
    if (t && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); choose(t.id); return; }
    const at = cursor ?? [Math.round(W / 2), Math.round(H / 2)] as Pt;
    if (moves[e.key]) {
      e.preventDefault();
      const next = clamp([at[0] + moves[e.key]![0], at[1] + moves[e.key]![1]]);
      setCursor(next);
      if (draft) setDraft(extend(draft, next));
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (draft) finish(draft);
      else { setCursor(at); begin(at); if (tool !== 'note') announce(`${KIND[tool]} started. Move with the arrow keys, then press Enter.`); }
    }
  };

  const send = async () => {
    if (!line.trim()) { setTried(true); document.getElementById('mk-line')?.focus(); return; }
    if (busy || !cap || !pics) return;
    setBusy(true);
    try {
      const id = await newMarkupId();
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      const m = buildMarkup({
        id, line, mood, includeSteps: steps, strokes, parts: cap.parts, pathname, search, route: appRouteFor(pathname) ?? pathname,
        workspace: { id: app.ws.id, name: app.ws.name }, demo: app.mode === 'demo', person: { id: app.viewer.id, name: app.viewer.name },
        context: { viewport: { w: cap.width, h: cap.height, dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100 }, theme: dark ? 'dark' : 'light', themeChoice: look.theme, accent: look.accent, appVersion: WHATS_NEW[0]?.id ?? 'unknown', sessionId: telemetry.sessionId, userAgent: navigator.userAgent.slice(0, 200) },
        steps: recentSteps(), errors: recentProblems(), pictures: ['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg'], now: app.stamp(),
      });
      await sendMarkup(m, pics);
      app.toast('Sent. You’ll hear when it’s fixed.');
      onClose();
    } catch (e) {
      app.toast(e instanceof Error ? e.message : String(e), 'error');
      setBusy(false);
    }
  };

  const shown = useMemo(() => (draft ? [...strokes, draft] : strokes), [strokes, draft]);
  const errors = useMemo(() => recentProblems().length, []);

  if (!cap) {
    return createPortal(<div className="markup-root taking" role="status" aria-live="polite"><span className="mk-taking">Taking a picture of this screen…</span></div>, document.body);
  }

  return createPortal(
    <div className={'markup-root' + (phase === 'send' ? ' sending' : '')} role="dialog" aria-modal="true" aria-label={phase === 'send' ? 'Send the markup' : 'Mark up this screen'}>
      <img className="mk-shot" src={shot} alt="" draggable={false} />
      <svg className="mk-ink" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Ink strokes={shown} w={W} />
        {cursor && phase === 'drawing' && <g className="mk-cursor"><circle cx={cursor[0]} cy={cursor[1]} r="10" stroke={HALO} strokeWidth="4" /><circle cx={cursor[0]} cy={cursor[1]} r="10" stroke={INK} strokeWidth="2" /><path d={`M${cursor[0] - 16} ${cursor[1]}h10M${cursor[0] + 6} ${cursor[1]}h10M${cursor[0]} ${cursor[1] - 16}v10M${cursor[0]} ${cursor[1] + 6}v10`} stroke={INK} strokeWidth="2" /></g>}
      </svg>
      {phase === 'drawing' && (
        <>
          <div
            ref={surface}
            className={`mk-surface tool-${tool}`}
            tabIndex={0}
            role="application"
            aria-label={`Drawing area: ${TOOLS.find((x) => x.id === tool)!.label}`}
            aria-describedby="mk-how"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drawing.current = false; setDraft(null); }}
            onKeyDown={keys}
          />
          <p id="mk-how" className="sr">Drag to draw, or use the keyboard: the arrow keys move a crosshair (with Shift, further), Enter starts and ends a mark, P, A, B and N choose Pen, Arrow, Box and Note, Ctrl+Z takes back the last mark, and Escape cancels.</p>
          {note && (
            <form className="mk-note" style={{ left: Math.min(Math.max(8, note.x + PIN), W - 268), top: Math.min(Math.max(8, note.y - 22), H - 120) }} onSubmit={(e) => { e.preventDefault(); placeNote(); }}>
              <label className="field"><span className="field-label">Note {notes + 1}</span>
                <input className="input" autoFocus maxLength={140} value={note.text} placeholder="A few words, or leave it as a number" onChange={(e) => setNote({ ...note, text: e.target.value })} />
              </label>
              <div className="row" style={{ gap: 'var(--s2)' }}><button type="submit" className="btn sm">Add note {notes + 1}</button><button type="button" className="btn sm ghost" onClick={() => { setNote(null); surface.current?.focus(); }}>Cancel</button></div>
            </form>
          )}
          <div className="mk-bar" role="toolbar" aria-label="Mark up this screen">
            <div className="mk-group" role="group" aria-label="Draw with">
              {TOOLS.map((t) => <button key={t.id} type="button" className="mk-tool" aria-pressed={tool === t.id} title={`${t.label} (${t.key.toUpperCase()})`} onClick={() => { choose(t.id); surface.current?.focus(); }}><Glyph name={t.id} /><span>{t.label}</span></button>)}
            </div>
            <div className="mk-group" role="group" aria-label="Marks">
              <button type="button" className="mk-tool" onClick={undo} aria-disabled={!strokes.length || undefined} title="Undo (Ctrl+Z)"><Glyph name="undo" /><span>Undo</span></button>
              <button type="button" className="mk-tool" onClick={clear} aria-disabled={!strokes.length || undefined}><Glyph name="clear" /><span>Clear</span></button>
            </div>
            <div className="mk-group mk-end">
              <button type="button" className="mk-tool" onClick={onClose} title="Cancel (Escape)"><Glyph name="cancel" /><span>Cancel</span></button>
              <button type="button" className="btn primary mk-next" onClick={() => void toSend()}><span>Next</span><Glyph name="next" /></button>
            </div>
          </div>
        </>
      )}
      {phase === 'send' && (
        <div className="mk-send-wrap">
          <form className="mk-send" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <h2 className="h3">Send the markup</h2>
            <label className="field"><span className="field-label">What should change?</span>
              <input id="mk-line" className="input" autoFocus aria-required="true" maxLength={500} value={line} onChange={(e) => setLine(e.target.value)} placeholder="One line; the picture says the rest" aria-describedby={tried && !line.trim() ? 'mk-line-need' : undefined} aria-invalid={tried && !line.trim() ? true : undefined} />
              {tried && !line.trim() && <span id="mk-line-need" className="hint tone-off" role="alert">Say what should change first.</span>}
            </label>
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              <span className="field-label" id="mk-mood">How is the app working for you? <span className="hint">optional</span></span>
              <div className="seg full feedback-moods" role="group" aria-labelledby="mk-mood">
                {MOODS.map(([k, l]) => <button key={k} type="button" aria-pressed={mood === k} onClick={() => setMood(mood === k ? null : k)}>{l}</button>)}
              </div>
            </div>
            <figure className="mk-preview">
              {pics ? <img src={pics.preview} alt="The picture that will be sent: this screen, with your marks on it" /> : <span className="hint" role="status">Making the picture…</span>}
              <figcaption className="hint">This is exactly the picture that will be sent. Nothing on it is hidden: go back or cancel if something shouldn’t be in it.</figcaption>
            </figure>
            <label className="check">
              <input type="checkbox" checked={steps} onChange={(e) => setSteps(e.target.checked)} />
              <span>Include my last {STEPS_MAX} steps on this visit</span>
            </label>
            <p className="hint">Sent with your name, this page ({appRouteFor(pathname) ?? pathname}), your screen size, light or dark, accent and the app’s version{errors ? `, and the ${errors === 1 ? 'error' : `${errors} errors`} on this visit` : ''}. <Link to="/help/feedback" target="_blank" rel="noopener">What’s sent, and who sees it</Link></p>
            <div className="sheet-foot mk-foot">
              <button type="button" className="btn ghost" onClick={() => { setPhase('drawing'); setPics(null); }}>Back</button>
              <span className="row" style={{ gap: 'var(--s2)' }}>
                <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn primary" aria-disabled={busy || !pics || undefined}>{busy ? 'Sending…' : 'Send'}</button>
              </span>
            </div>
          </form>
        </div>
      )}
      <div className="sr" role="status" aria-live="polite">{said}</div>
    </div>,
    document.body,
  );
}
