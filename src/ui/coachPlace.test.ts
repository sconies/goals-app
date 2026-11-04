import { placeCoach, ringBox } from './coachPlace';

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
  it('takes the sides a screen asks for, in its order, and keeps clear of what it marks', () => {
    // The map's critical goal: left of it first, 16px off; the red line above it and the north star stay uncovered.
    const node = { left: 490, top: 457, width: 252, height: 136 };
    const edge = { left: 470, top: 420, width: 440, height: 110 };
    const star = { left: 780, top: 294, width: 252, height: 110 };
    const p = placeCoach(node, size, { ...desk, width: 1280, height: 800 }, 16, { sides: ['left', 'below'], avoid: [star] });
    expect(p.left + size.width).toBe(474);
    expect(covers(p, size, node)).toBe(false);
    // When left would cover the line, it goes to the next side that's clear rather than over it.
    const q = placeCoach(node, size, { ...desk, width: 1280, height: 800 }, 16, { sides: ['left', 'below'], avoid: [star, { ...edge, left: 440 }] });
    expect(covers(q, size, node) || covers(q, size, star) || covers(q, size, { ...edge, left: 440 })).toBe(false);
  });
  it('lines up with the far edge when asked: beside the map panel, its bottom 16px above the panel’s', () => {
    const panel = { left: 928, top: 268, width: 320, height: 516 };
    const p = placeCoach(panel, size, { ...desk, width: 1280, height: 800 }, 16, { sides: ['left'], align: 'end' });
    expect(p).toEqual({ left: 928 - 16 - 360, top: 268 + 516 - 16 - 200 });
  });
  it('above a bottom sheet on a phone, 16px clear of it', () => {
    const sheet = { left: 0, top: 506, width: 390, height: 338 };
    const s = { width: 358, height: 230 };
    const p = placeCoach(sheet, s, phone, 16, { sides: ['above'], avoid: [sheet] });
    expect(p.top + s.height).toBe(506 - 16);
    expect(p.top).toBeGreaterThanOrEqual(76);
  });
  it('with no options, places exactly as before', () => {
    const t = { left: 900, top: 300, width: 120, height: 40 };
    expect(placeCoach(t, size, desk, 12, {})).toEqual(placeCoach(t, size, desk));
  });
});

describe('the ring and the sidebar', () => {
  it('keeps the ring inside the window: 4px in from an edge the target touches', () => {
    // A full-bleed bar beside a 236px sidebar, running to the right and bottom edges of a 1440×700 window.
    const r = ringBox({ left: 236, top: 640, right: 1440, bottom: 700 }, { width: 1440, height: 700 });
    expect(r.left).toBe(230);
    expect(r.left + r.width).toBe(1436);
    expect(r.top + r.height).toBe(696);
    expect(ringBox({ left: 0, top: 0, right: 390, bottom: 60 }, { width: 390, height: 844 })).toEqual({ left: 4, top: 4, width: 382, height: 62 });
  });
  it('never puts the coach over the sidebar', () => {
    const v = { ...desk, reservedLeft: 236 };
    const t = { left: 230, top: 300, width: 1000, height: 60 };
    expect(placeCoach(t, size, v).left).toBeGreaterThanOrEqual(252);
    expect(placeCoach(null, size, v).left).toBe(1363 - 16 - 360);
  });
  it('places a closing step from its real height, 16px above the bottom', () => {
    expect(placeCoach(null, { width: 360, height: 180 }, desk).top).toBe(900 - 16 - 180);
  });
});
