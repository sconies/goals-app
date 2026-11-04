/* Where the walkthrough coach goes: beside the thing it points at, never on top of it (visual review: "anchor the coach
   to the selected context without covering it"). Below it if there's room, else above, right or left; when the target
   fills the screen (the map), whichever corner covers least of it. */
export interface Box { left: number; top: number; width: number; height: number }
/** The window, and what the coach must stay clear of: the phone's top and tab bars, the desktop sidebar on the left. */
export interface View { width: number; height: number; reservedTop: number; reservedBottom: number; reservedLeft?: number }
export type Side = 'below' | 'above' | 'right' | 'left';
/**
 * Optional, for a screen that knows its own layout (the map): the sides to try, in order; 'end' to line the card up with
 * the far edge of the target (its bottom, beside it; its right, above or below it), 16px in; and boxes the card must not
 * cover (the critical path, the panel). A side that fits but covers one of them is passed over.
 */
export interface PlaceOptions { sides?: Side[]; align?: 'start' | 'end'; avoid?: Box[] }

const M = 16;
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/**
 * The ring round a target: 6px outside it, but never past the window. A target that runs to the window's edge (a
 * full-width bar) gets the ring 4px inside that edge instead, so all four sides show.
 */
export function ringBox(r: { left: number; top: number; right: number; bottom: number }, v: { width: number; height: number }, pad = 6, inset = 4): Box {
  const left = Math.max(inset, r.left - pad), top = Math.max(inset, r.top - pad);
  const right = Math.min(v.width - inset, r.right + pad), bottom = Math.min(v.height - inset, r.bottom + pad);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function placeCoach(target: Box | null, size: { width: number; height: number }, v: View, gap = 12, opts: PlaceOptions = {}): { left: number; top: number } {
  const { width: w, height: h } = size;
  const minTop = v.reservedTop + M, maxTop = Math.max(minTop, v.height - v.reservedBottom - M - h);
  const maxLeft = v.width - M - w;
  // Clear of the sidebar when there's room for that; otherwise as far left as still fits.
  const minLeft = Math.max(M, Math.min((v.reservedLeft ?? 0) + M, maxLeft));
  const clampL = (x: number) => Math.max(minLeft, Math.min(maxLeft, x));
  const clampT = (y: number) => Math.max(minTop, Math.min(maxTop, y));
  const corners = [
    { left: maxLeft, top: maxTop }, { left: minLeft, top: maxTop }, { left: maxLeft, top: minTop }, { left: minLeft, top: minTop },
  ];
  if (!target) return corners[0]!;
  const fits = (p: { left: number; top: number }) => p.left >= minLeft - 0.5 && p.left <= maxLeft + 0.5 && p.top >= minTop - 0.5 && p.top <= maxTop + 0.5;
  const t = target;
  const end = opts.align === 'end';
  const at: Record<Side, { left: number; top: number }> = {
    below: { left: clampL(end ? t.left + t.width - w - M : t.left), top: t.top + t.height + gap },
    above: { left: clampL(end ? t.left + t.width - w - M : t.left), top: t.top - gap - h },
    right: { left: t.left + t.width + gap, top: clampT(end ? t.top + t.height - h - M : t.top) },
    left: { left: t.left - gap - w, top: clampT(end ? t.top + t.height - h - M : t.top) },
  };
  const order: Side[] = opts.sides?.length ? [...opts.sides, ...(['below', 'above', 'right', 'left'] as Side[]).filter((s) => !opts.sides!.includes(s))] : ['below', 'above', 'right', 'left'];
  const avoid = opts.avoid ?? [];
  const covers = (p: { left: number; top: number }) => avoid.reduce((n, b) => n + overlap({ ...p, width: w, height: h }, b), 0);
  const beside = order.map((s) => at[s]);
  const ok = beside.find((p) => fits(p) && covers(p) < 1) ?? (avoid.length ? undefined : beside.find(fits));
  if (ok) return ok;
  // Nothing beside it is clear: the spot that covers least of the target and of what to keep in view.
  const spots = [...beside.filter(fits), ...corners];
  return spots.map((c) => ({ c, o: overlap({ ...c, width: w, height: h }, t) + covers(c) })).sort((a, b) => a.o - b.o)[0]!.c;
}
