// @vitest-environment jsdom
/* The review of 12 Nov, item 2: just after switching between List, Table and Board, the new layout was drawn misaligned.
   The row-motion layer measured each goal where the old layout had it and slid it from there. A goal's row in one
   layout and its row in another are different rows, so a switch moves nothing; a reorder within a layout still does. */
import { describe, expect, it } from 'vitest';
import { collect, flipDeltas, type Pos } from '../src/ui/motion';

const R = (id: string, text: string) => `[${id}] ${text}`;
const rows = (html: string) => { const root = document.createElement('div'); root.innerHTML = html; return collect(root).keys; };
const at = (keys: string[]) => new Map<string, Pos>(keys.map((k, i) => [k, { x: 0, y: i * 40 }]));

const LIST = '<ul class="tree"><li><a href="/goals/a">A</a></li><li><a href="/goals/b">B</a></li></ul>';
const TABLE = '<table class="gtable"><tbody><tr><td><a href="/goals/a">A</a></td></tr><tr><td><a href="/goals/b">B</a></td></tr></tbody></table>';
const BOARD = '<div class="board-col"><div class="board-card"><a href="/goals/b">B</a></div><div class="board-card"><a href="/goals/a">A</a></div></div>';

describe('Switching layout', () => {
  it(R('MOTION-ALIVE', 'a goal’s row in List, Table and Board are different rows: a switch slides nothing'), () => {
    for (const [from, to] of [[LIST, TABLE], [TABLE, BOARD], [BOARD, LIST]] as const) {
      const before = rows(from), after = rows(to);
      const { moved, added } = flipDeltas(at(before), at(after));
      expect(moved.size).toBe(0);
      expect(added.length).toBe(after.length);
    }
  });
  it(R('MOTION-ALIVE', 'within one layout the same goal is the same row, so a reorder still slides'), () => {
    const reordered = '<ul class="tree"><li><a href="/goals/b">B</a></li><li><a href="/goals/a">A</a></li></ul>';
    const { moved } = flipDeltas(at(rows(LIST)), at(rows(reordered)));
    expect(moved.size).toBe(2);
  });
});
