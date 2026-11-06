/* How a drawing looks: one ink colour with a white halo, so it stands out on light and dark screens alike. The live
   drawing (SVG) and the pictures that are sent (canvas) are drawn from the same shapes here. */
import { PIN, type Pt, type Stroke } from './model';

/** The ink: a strong magenta, which no status, accent or chart uses, so a mark never reads as part of the app. */
export const INK = '#D4136F';
export const HALO = '#FFFFFF';
export const WIDTH = 4;
export const HALO_WIDTH = 8;

/** The two short lines of an arrow's head, at its point. */
export function arrowHead(from: Pt, to: Pt, size = 16): [Pt, Pt] {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const at = (d: number): Pt => [to[0] - size * Math.cos(a + d), to[1] - size * Math.sin(a + d)];
  return [at(Math.PI / 7), at(-Math.PI / 7)];
}

/** A pen line as an SVG path. */
export const penPath = (pts: Pt[]) => (pts.length ? `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}${pts.length === 1 ? ' l0.1 0' : ''}` : '');

/** Where a note's words sit beside its pin, kept on screen. */
export function noteLabel(s: Extract<Stroke, { kind: 'note' }>, w: number): { x: number; y: number; anchor: 'start' | 'end' } {
  const right = s.x + PIN / 2 + 6;
  return right + 160 > w ? { x: s.x - PIN / 2 - 6, y: s.y + 5, anchor: 'end' } : { x: right, y: s.y + 5, anchor: 'start' };
}

/** Draws strokes on a canvas, `scale` device pixels to each CSS pixel. */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number, width: number) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (paint: () => void) => {
    ctx.strokeStyle = HALO; ctx.lineWidth = HALO_WIDTH; ctx.beginPath(); paint(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = WIDTH; ctx.beginPath(); paint(); ctx.stroke();
  };
  for (const s of strokes) {
    if (s.kind === 'pen' && s.points.length) line(() => { ctx.moveTo(...s.points[0]!); for (const p of s.points.slice(1)) ctx.lineTo(...p); if (s.points.length === 1) ctx.lineTo(s.points[0]![0] + 0.1, s.points[0]![1]); });
    if (s.kind === 'arrow') {
      const [a, b] = arrowHead(s.from, s.to);
      line(() => { ctx.moveTo(...s.from); ctx.lineTo(...s.to); ctx.moveTo(...a); ctx.lineTo(...s.to); ctx.lineTo(...b); });
    }
    if (s.kind === 'box') line(() => { ctx.rect(s.x, s.y, s.w, s.h); });
    if (s.kind === 'note') {
      ctx.beginPath(); ctx.arc(s.x, s.y, PIN / 2, 0, Math.PI * 2);
      ctx.fillStyle = INK; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = HALO; ctx.stroke();
      ctx.fillStyle = HALO; ctx.font = '700 14px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(s.n), s.x, s.y + 0.5);
      if (s.text) {
        const l = noteLabel(s, width);
        ctx.font = '600 14px Inter, system-ui, sans-serif'; ctx.textAlign = l.anchor === 'start' ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
        const text = s.text.length > 60 ? s.text.slice(0, 59) + '…' : s.text;
        ctx.lineWidth = 5; ctx.strokeStyle = HALO; ctx.strokeText(text, l.x, l.y);
        ctx.fillStyle = INK; ctx.fillText(text, l.x, l.y);
      }
    }
  }
  ctx.restore();
}

const blob = (c: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('The picture could not be made.'))), type, quality));

/** The four pictures a markup sends: the screen, the drawing alone (transparent), the two together, and a thumbnail. */
export async function makePictures(screen: HTMLImageElement | HTMLCanvasElement, strokes: Stroke[], w: number, h: number, scale: number) {
  const W = Math.round(w * scale), H = Math.round(h * scale);
  const canvas = (cw: number, ch: number) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };
  const base = canvas(W, H);
  base.getContext('2d')!.drawImage(screen, 0, 0, W, H);
  const ink = canvas(W, H);
  drawStrokes(ink.getContext('2d')!, strokes, scale, w);
  const both = canvas(W, H);
  const b = both.getContext('2d')!;
  b.fillStyle = '#FFFFFF'; b.fillRect(0, 0, W, H);
  b.drawImage(base, 0, 0); b.drawImage(ink, 0, 0);
  const tw = 360, th = Math.round((H / W) * tw);
  const thumb = canvas(tw, th);
  thumb.getContext('2d')!.drawImage(both, 0, 0, tw, th);
  const [screenPng, inkPng, marked, thumbJpg] = await Promise.all([blob(base, 'image/png'), blob(ink, 'image/png'), blob(both, 'image/jpeg', 0.88), blob(thumb, 'image/jpeg', 0.8)]);
  return { 'screen.png': screenPng, 'ink.png': inkPng, 'marked.jpg': marked, 'thumb.jpg': thumbJpg, preview: both.toDataURL('image/jpeg', 0.88) };
}
export type Pictures = Omit<Awaited<ReturnType<typeof makePictures>>, 'preview'>;
