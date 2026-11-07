// @vitest-environment jsdom
/* Spec scenarios for SHAPE-MATCHES-WORD: a status shape always agrees with its word. The shape a list draws comes from
   the goal's status, never from what flags it, so an on-track goal flagged "Getting worse" or "Greener than calculated"
   keeps the On track shape, and says the flag beside the warning mark. Every goal that needs attention in the example,
   as Home and the Goals screen list it, is rendered and each shape held to the words beside it by the app's own rule
   (vocabulary.ts shapeAgrees), the same rule the screen checks P3, P4 and P6 use in the browser. */
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg as seed } from '../src/data/platformOrg';
import { attentionList } from '../src/domain/attention';
import { currentWeek } from '../src/domain/plan';
import { LABEL, shapeAgrees, SHAPE_WORDS } from '../src/domain/vocabulary';
import type { DisplayStatus } from '../src/domain/types';
import { AttentionCard } from '../src/ui/bits';

const S = (text: string) => `[SHAPE-MATCHES-WORD] ${text}`;
const today = new Date('2026-11-05T12:00:00Z');
const s0 = seed(today);
const cycle = s0.cycles[0]!;

/** Text as a browser shows it, each element's words apart (jsdom has no innerText). */
const words = (el: Element): string => { const out: string[] = []; const w = el.ownerDocument.createTreeWalker(el, 4); while (w.nextNode()) out.push(w.currentNode.nodeValue ?? ''); return out.join(' '); };
/** The words nearest a shape: its own slot, or the nearest box around it with any text. */
const near = (e: Element) => { let box = e.parentElement; while (box && !box.textContent?.trim()) box = box.parentElement; return box ? words(box) : ''; };

describe('a status shape always agrees with its word', () => {
  it(S('every attention row in the example draws its goal’s status as the shape and the word, never a flag’s'), () => {
    const list = attentionList(s0, cycle, today);
    expect(currentWeek(cycle, today)).toBe(45);
    // The case that broke it: on track, flagged only for a worsening trend or a greener call.
    const onFlagged = list.filter((a) => a.status.status === 'on' && a.flags.some((f) => f.kind === 'trend' || f.kind === 'greener'));
    expect(onFlagged.length).toBeGreaterThan(0);
    for (const a of list) {
      const { container, unmount } = render(createElement(MemoryRouter, null, createElement(AttentionCard, { a, to: '/goals/' + a.goal.id })));
      const shapes = [...container.querySelectorAll('svg.status-shape')];
      expect(shapes.map((e) => e.getAttribute('data-status')), a.goal.id).toEqual([a.status.status]);
      for (const e of shapes) expect(shapeAgrees(e.getAttribute('data-status') as DisplayStatus, near(e)), `${a.goal.id}: “${near(e)}”`).toBe(true);
      expect(container.querySelector('.arow-status')?.textContent).toBe(LABEL[a.status.status]);
      // A flag that isn't the status says its own word, with the warning mark, not a status shape.
      const others = a.flags.filter((f) => f.kind !== 'due' && f.kind !== a.status.status);
      if (others.length) expect(container.querySelector('.arow-flags')?.textContent).toContain(others[0]!.label);
      unmount();
    }
  });

  it(S('the rule: a shape agrees only with its own status’s words, or a word that shares its shape, whole words only'), () => {
    expect(shapeAgrees('risk', 'At risk · Getting worse')).toBe(true);
    expect(shapeAgrees('risk', 'Getting worse — On track today, but the recent trend heads short')).toBe(false);
    expect(shapeAgrees('off', 'Decision or help needed · At risk')).toBe(false);
    expect(shapeAgrees('on', 'Not met')).toBe(false);
    expect(shapeAgrees('off', 'Not met')).toBe(true);
    expect(shapeAgrees('on', 'Met late')).toBe(true);
    expect(shapeAgrees('off', 'Met late')).toBe(false);
    expect(shapeAgrees('risk', 'Expected week 12 · slipping 2 weeks, due week 10')).toBe(true);
    expect(shapeAgrees('risk', 'Expected week 12 · 2 weeks late, due week 10')).toBe(false);
    expect(shapeAgrees('done', 'Nothing is off track, stale or slipping.')).toBe(false);
    // Every status's own word is one of its shape's words.
    for (const k of Object.keys(SHAPE_WORDS) as DisplayStatus[]) expect(shapeAgrees(k, LABEL[k])).toBe(true);
  });
});
