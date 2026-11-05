/* Lane's review notes (5 Nov), print-motion: the one-page views gather everything critical from the domain, and the
   motion layer's arithmetic lands exactly where it should. Each case is tagged with its requirement ID. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import { goalSheet, reviewSheet } from '../src/domain/onePager';
import { currentWeek } from '../src/domain/plan';
import { attentionFor } from '../src/domain/attention';
import { summarise } from '../src/domain/summary';
import { easeOut, flipDeltas, MOTION_MS, tween, type Pos } from '../src/ui/motion';

const R = (id: string, text: string) => `[${id}] ${text}`;
const today = new Date('2026-10-30T12:00:00Z');
const s = seed(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);

describe('print views', () => {
  it(R('PRINT-EXPORT', 'a goal’s page has its status, numbers against plan and target, facts, latest check-in and review notes'), () => {
    const g = s.goals.find((x) => x.id === 'head')!;
    const sh = goalSheet(g, s, cycle, week, today);
    const sum = summarise(g, s, cycle, today, week);
    expect(sh.summary.status).toBe(sum.status);
    expect(sh.summary.target).toBe(sum.target);
    expect(sh.facts[0]).toEqual({ label: 'Where it stands', text: sum.story.where });
    expect(sh.latest?.c.id).toBe(sum.checkIns.at(-1)!.id);
    // Elena's note from last week's review is carried, with who said it.
    const note = sh.said.find((d) => d.note.startsWith('Brain and GPU'));
    expect(note?.kind).toBe('note');
    expect(note?.by).toMatch(/^Elena/);
    expect(note?.review).toBe('Platform weekly review');
    expect(sh.contributing.length).toBe(s.goals.filter((x) => x.parentId === 'head').length);
  });

  it(R('PRINT-EXPORT', 'a goal behind plan carries its path to green and its open requests'), () => {
    const behind = s.goals.map((g) => goalSheet(g, s, cycle, week, today)).find((x) => x.facts.some((f) => f.label === 'Path to green') && x.open.length);
    expect(behind).toBeTruthy();
    const ptg = behind!.facts.find((f) => f.label === 'Path to green')!;
    expect(ptg.text).not.toMatch(/\.\./);
    expect(behind!.open[0]!.ask.length).toBeGreaterThan(3);
  });

  it(R('PRINT-EXPORT', 'contributing goals are worst first'), () => {
    const sh = goalSheet(s.goals.find((x) => x.id === 'head')!, s, cycle, week, today);
    const w = sh.contributing.map((c) => attentionFor(c.goal, s, cycle, today).weight);
    expect(w).toEqual([...w].sort((a, b) => b - a));
  });

  it(R('PRINT-EXPORT', 'a review’s page lists every goal in the session, worst first, with what was said last time'), () => {
    const r = s.reviews.find((x) => x.id === 'weekly')!;
    const sh = reviewSheet(r, s, cycle, week, today);
    expect(sh.items.length).toBe(sh.total);
    const weights = sh.items.map((i) => attentionFor(i.goal, s, cycle, today).weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    const head = sh.items.find((i) => i.goal.id === 'head')!;
    expect(head.earlier.map((d) => d.note).join(' ')).toMatch(/Brain and GPU quota/);
    expect(sh.items.filter((i) => !i.healthy).every((i) => i.facts.length >= 1)).toBe(true);
  });
});

describe('motion', () => {
  it(R('MOTION-ALIVE', 'everything moves for 250ms at most'), () => expect(MOTION_MS).toBeLessThanOrEqual(250));
  it(R('MOTION-ALIVE', 'a count eases out and lands exactly on the value'), () => {
    expect(tween(12, 82, 1)).toBe(82);
    expect(tween(12, 82, 1.4)).toBe(82);
    expect(tween(12, 82, 0)).toBe(12);
    expect(tween(12, 82, 0.5)).toBeGreaterThan(47); // ease-out: past halfway at half time
    expect(easeOut(0.25)).toBeGreaterThan(0.25);
    expect(tween(90, 40, 0.5)).toBeLessThan(65); // counts down as readily
  });
  it(R('MOTION-ALIVE', 'rows that moved slide back from where they were; new rows are listed; small moves are ignored'), () => {
    const before = new Map<string, Pos>([['a', { x: 0, y: 0 }], ['b', { x: 0, y: 40 }], ['c', { x: 0, y: 80 }]]);
    const after = new Map<string, Pos>([['c', { x: 0, y: 0 }], ['b', { x: 0, y: 40.4 }], ['a', { x: 0, y: 80 }], ['d', { x: 0, y: 120 }]]);
    const { moved, added } = flipDeltas(before, after);
    expect(moved.get('a')).toEqual({ x: 0, y: -80 });
    expect(moved.get('c')).toEqual({ x: 0, y: 80 });
    expect(moved.has('b')).toBe(false);
    expect(added).toEqual(['d']);
  });
});
