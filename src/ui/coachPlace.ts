/* Where the walkthrough coach goes: beside the thing it points at, never on top of it (visual review: "anchor the coach
   to the selected context without covering it"). Below it if there's room, else above, right or left; when the target
   fills the screen (the map), whichever corner covers least of it. */
export interface Box { left: number; top: number; width: number; height: number }
export interface View { width: number; height: number; reservedTop: number; reservedBottom: number }

const M = 16;
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

export function placeCoach(target: Box | null, size: { width: number; height: number }, v: View, gap = 12): { left: number; top: number } {
  const { width: w, height: h } = size;
  const minTop = v.reservedTop + M, maxTop = v.height - v.reservedBottom - M - h;
  const minLeft = M, maxLeft = v.width - M - w;
  const clampL = (x: number) => Math.max(minLeft, Math.min(maxLeft, x));
  const clampT = (y: number) => Math.max(minTop, Math.min(maxTop, y));
  const corners = [
    { left: maxLeft, top: maxTop }, { left: minLeft, top: maxTop }, { left: maxLeft, top: minTop }, { left: minLeft, top: minTop },
  ];
  if (!target) return corners[0]!;
  const fits = (p: { left: number; top: number }) => p.left >= minLeft - 0.5 && p.left <= maxLeft + 0.5 && p.top >= minTop - 0.5 && p.top <= maxTop + 0.5;
  const t = target;
  const beside = [
    { left: clampL(t.left), top: t.top + t.height + gap },
    { left: clampL(t.left), top: t.top - gap - h },
    { left: t.left + t.width + gap, top: clampT(t.top) },
    { left: t.left - gap - w, top: clampT(t.top) },
  ];
  const ok = beside.find(fits);
  if (ok) return ok;
  return corners.map((c) => ({ c, o: overlap({ ...c, width: w, height: h }, t) })).sort((a, b) => a.o - b.o)[0]!.c;
}
