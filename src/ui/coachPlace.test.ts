import { placeCoach } from './coachPlace';

const desk = { width: 1363, height: 900, reservedTop: 0, reservedBottom: 0 };
const phone = { width: 390, height: 844, reservedTop: 60, reservedBottom: 80 };
const size = { width: 360, height: 200 };
const covers = (p: { left: number; top: number }, s: { width: number; height: number }, t: { left: number; top: number; width: number; height: number }) =>
  p.left < t.left + t.width && p.left + s.width > t.left && p.top < t.top + t.height && p.top + s.height > t.top;

describe('placing the walkthrough coach', () => {
  it('sits just below what it points at when there is room, never on it', () => {
    const t = { left: 900, top: 300, width: 120, height: 40 };
    const p = placeCoach(t, size, desk);
    expect(p.top).toBe(352);
    expect(covers(p, size, t)).toBe(false);
  });
  it('goes above, or beside, when there is no room below', () => {
    const low = { left: 900, top: 800, width: 120, height: 40 };
    expect(placeCoach(low, size, desk).top).toBe(800 - 12 - 200);
    const tall = { left: 300, top: 100, width: 120, height: 700 };
    const p = placeCoach(tall, size, desk);
    expect(p.left).toBe(432);
    expect(covers(p, size, tall)).toBe(false);
  });
  it('on a phone stays clear of the header and tab bar, and of the target', () => {
    const s = { width: 358, height: 220 };
    const t = { left: 16, top: 600, width: 200, height: 44 };
    const p = placeCoach(t, s, phone);
    expect(p.top).toBeGreaterThanOrEqual(76);
    expect(p.top + s.height).toBeLessThanOrEqual(844 - 80 - 16);
    expect(covers(p, s, t)).toBe(false);
  });
  it('over something that fills the screen (the map), takes the corner that covers least of it', () => {
    const map = { left: 260, top: 200, width: 1080, height: 700 };
    const p = placeCoach(map, size, desk);
    expect(p).toEqual({ left: 16, top: 16 });
  });
});
