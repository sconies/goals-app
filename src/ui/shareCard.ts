/* Share (approved by Lane, 5 Nov: an image plus a link). The summary bar and a small chart, drawn as one SVG card in the
   light theme, then turned into a PNG in the browser with a canvas: no library. The SVG is built here, pure, so it can be
   tested without a browser. The image holds company data, so it's made only on a signed-in (or demo) viewer's request. */
import { planAt, planEnd, type Point, type Projection } from '../domain/plan';
import type { DisplayStatus, MetricGoal } from '../domain/types';

export interface ShareCard {
  workspace: string;
  title: string;
  owner: string;
  /** "North star · G-12". */
  meta: string;
  status: DisplayStatus;
  statusWord: string;
  /** "83%", or "2 of 4 stages done". */
  now: string;
  /** "plan 86% · target 88%". */
  against: string;
  /** Line 3: why, and whether it's handled. */
  why: string;
  /** "Week 44 · 30 Oct 2026". */
  when: string;
  link: string;
  /** A number goal's small chart: its plan, actuals and projection. */
  chart: { goal: MetricGoal; weeks: number; week: number; series: Point[]; projection: Projection | null } | null;
}

export const CARD_W = 1200;
export const CARD_H = 630;

const COLOUR: Record<DisplayStatus, string> = { on: '#1F8A68', risk: '#C46A0C', off: '#C8372B', stale: '#667085', done: '#3451D1', planned: '#667085', none: '#667085' };
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Words broken into lines of about `chars` characters, at most `max` lines, the last ending in an ellipsis if cut. */
export function wrap(text: string, chars: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > chars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length <= max) return lines;
  const out = lines.slice(0, max);
  out[max - 1] = out[max - 1]!.replace(/[\s,;.:]*$/, '') + '…';
  return out;
}

/** The status shape, as the app draws it, at (x, y) with radius r. */
function shape(k: DisplayStatus, x: number, y: number, r: number): string {
  const c = COLOUR[k];
  if (k === 'on') return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  if (k === 'risk') return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${r / 3}"/><path d="M${x} ${y - r}a${r} ${r} 0 0 1 0 ${2 * r}z" fill="${c}"/>`;
  if (k === 'off') return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${r / 3}"/>`;
  if (k === 'done') return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><path d="M${x - r / 2.4} ${y}l${r / 3} ${r / 3} ${r / 1.6} -${r / 1.4}" fill="none" stroke="#fff" stroke-width="${r / 3.5}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="${r / 3}" stroke-dasharray="${r / 1.4} ${r / 1.4}"/>`;
}

function chartSvg(ch: NonNullable<ShareCard['chart']>, x: number, y: number, w: number, h: number): string {
  const { goal, week, series, projection } = ch;
  const weeks = Math.max(ch.weeks, planEnd(goal.plan, ch.weeks));
  const vals = [goal.plan.start, goal.plan.target, ...series.map((p) => p.value), ...(projection ? [projection.low, projection.high] : [])];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
  lo -= pad; hi += pad;
  const X = (wk: number) => x + (wk / weeks) * w;
  const Y = (v: number) => y + h - ((v - lo) / (hi - lo)) * h;
  const pts = (ps: [number, number][]) => ps.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
  const plan = pts(Array.from({ length: weeks + 1 }, (_, i) => [X(i), Y(planAt(goal.plan, i, weeks))]));
  const last = series[series.length - 1];
  let out = `<line x1="${x}" x2="${x + w}" y1="${Y(goal.plan.target).toFixed(1)}" y2="${Y(goal.plan.target).toFixed(1)}" stroke="#1F8A68" stroke-width="2" stroke-dasharray="3 5"/>`;
  out += `<line x1="${X(week).toFixed(1)}" x2="${X(week).toFixed(1)}" y1="${y}" y2="${y + h}" stroke="#D0D5DD" stroke-width="2" stroke-dasharray="3 3"/>`;
  out += `<polyline points="${plan}" fill="none" stroke="#3451D1" stroke-width="4"/>`;
  if (last && projection && projection.high - projection.low > 1e-9) out += `<polygon points="${pts([[X(last.week), Y(last.value)], [X(projection.week), Y(projection.high)], [X(projection.week), Y(projection.low)]])}" fill="#C8372B" fill-opacity="0.12"/>`;
  if (last && projection) out += `<polyline points="${pts([[X(last.week), Y(last.value)], [X(projection.week), Y(projection.value)]])}" fill="none" stroke="#C8372B" stroke-width="3" stroke-dasharray="10 7"/>`;
  if (series.length) out += `<polyline points="${pts(series.map((p) => [X(p.week), Y(p.value)]))}" fill="none" stroke="#101828" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (last) out += `<circle cx="${X(last.week).toFixed(1)}" cy="${Y(last.value).toFixed(1)}" r="8" fill="#101828"/>`;
  return out;
}

/** The card as an SVG document, CARD_W × CARD_H. */
export function shareCardSvg(c: ShareCard): string {
  const font = `font-family="Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"`;
  const title = wrap(c.title, c.chart ? 30 : 46, 2);
  const left = 72;
  let y = 96;
  let body = `<rect width="${CARD_W}" height="${CARD_H}" fill="#FFFFFF"/>`;
  body += `<text x="${left}" y="${y}" ${font} font-size="24" fill="#475467">${esc(c.workspace)}</text>`;
  y += 64;
  for (const t of title) { body += `<text x="${left}" y="${y}" ${font} font-size="52" font-weight="700" fill="#101828">${esc(t)}</text>`; y += 62; }
  body += `<text x="${left}" y="${y}" ${font} font-size="26" fill="#344054">${esc(c.owner)}${c.meta ? ` · ${esc(c.meta)}` : ''}</text>`;
  y += 78;
  body += shape(c.status, left + 16, y - 14, 16);
  body += `<text x="${left + 46}" y="${y}" ${font} font-size="32" font-weight="700" fill="${COLOUR[c.status]}">${esc(c.statusWord)}</text>`;
  y += 70;
  body += `<text x="${left}" y="${y}" ${font} font-size="64" font-weight="700" fill="#101828">${esc(c.now)}</text>`;
  y += 46;
  body += `<text x="${left}" y="${y}" ${font} font-size="28" fill="#344054">${esc(c.against)}</text>`;
  y += 54;
  // As many lines of the why as fit above the footer's rule (a long title once pushed it through the rule: #410 review).
  const room = Math.max(1, Math.min(3, Math.floor((CARD_H - 70 - 20 - y) / 36) + 1));
  for (const t of wrap(c.why, c.chart ? 52 : 80, room)) { body += `<text x="${left}" y="${y}" ${font} font-size="26" fill="#475467">${esc(t)}</text>`; y += 36; }
  if (c.chart) body += chartSvg(c.chart, 700, 210, 430, 300);
  body += `<line x1="${left}" x2="${CARD_W - left}" y1="${CARD_H - 70}" y2="${CARD_H - 70}" stroke="#E4E7EC" stroke-width="2"/>`;
  body += `<text x="${left}" y="${CARD_H - 32}" ${font} font-size="22" fill="#475467">${esc(c.when)}</text>`;
  body += `<text x="${CARD_W - left}" y="${CARD_H - 32}" ${font} font-size="22" fill="#475467" text-anchor="end">${esc(c.link.replace(/^https?:\/\//, ''))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">${body}</svg>`;
}

/** The card as a PNG, drawn by the browser: the SVG as an image onto a canvas, at twice the size for sharp screens. */
export async function shareCardPng(c: ShareCard): Promise<Blob> {
  // A data URL, not an object URL: files.ts is the only place that makes those (SHARED-DOWNLOADS).
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shareCardSvg(c));
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('the image could not be drawn')); img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W * 2;
  canvas.height = CARD_H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas in this browser');
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0, CARD_W, CARD_H);
  return new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error('the image could not be made'))), 'image/png'));
}
