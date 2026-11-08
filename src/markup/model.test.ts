// @vitest-environment node
/* Markups' shared rules: which named screen parts a drawing covers, what a markup carries (the visit's steps and errors
   only as asked), how the inbox groups them, the GitHub issue's text and link, a status change, and What's new's
   "You raised this". Plus the builder's operations on a store kept in memory. */
import { WHATS_NEW } from '../help/whatsNew';
import {
  aboutOf, buildMarkup, groupMarkups, issueBody, issueTitle, MarkupError, namedParts, newIssueLink, partsUnder, placeOf, raisedIn, raisedText, raisedThis, statusPatch, strokeBox,
  type Markup, type MarkupInput, type PartBox, type Stroke,
  undoChange,
} from './model';
import { markupOps, type MarkupStore } from './ops';

/** A goal page at 1280×800: the page, its summary bar with the scorecard and its four cells, the chart, the sidebar. */
const PARTS: PartBox[] = [
  { path: ['Sidebar'], rect: { x: 0, y: 0, w: 240, h: 800 } },
  { path: ['Goal page'], rect: { x: 240, y: 0, w: 1040, h: 2000 } },
  { path: ['Goal page', 'Summary bar'], rect: { x: 260, y: 20, w: 1000, h: 200 } },
  { path: ['Goal page', 'Summary bar', 'Scorecard'], rect: { x: 280, y: 120, w: 960, h: 80 } },
  { path: ['Goal page', 'Summary bar', 'Scorecard', 'Against plan'], rect: { x: 280, y: 120, w: 240, h: 80 } },
  { path: ['Goal page', 'Summary bar', 'Scorecard', 'Will it hit'], rect: { x: 1000, y: 120, w: 240, h: 80 } },
  { path: ['Goal page', 'Chart'], rect: { x: 260, y: 240, w: 1000, h: 320 } },
];

describe('which named parts a drawing covers', () => {
  it('names the most specific part under a box, as a path', () => {
    expect(partsUnder({ x: 1010, y: 130, w: 100, h: 40 }, PARTS)).toEqual([['Goal page', 'Summary bar', 'Scorecard', 'Will it hit']]);
  });
  it('names each part a long stroke crosses, most covered first, and never a part that holds a named one', () => {
    const across = partsUnder({ x: 300, y: 150, w: 940, h: 300 }, PARTS);
    expect(across[0]).toEqual(['Goal page', 'Chart']);
    expect(across).toContainEqual(['Goal page', 'Summary bar', 'Scorecard', 'Will it hit']);
    expect(across).not.toContainEqual(['Goal page']);
    expect(across).not.toContainEqual(['Goal page', 'Summary bar', 'Scorecard']);
    expect(across.length).toBeLessThanOrEqual(3);
  });
  it('names a part with nothing named inside it, and nothing where nothing is named', () => {
    expect(partsUnder({ x: 20, y: 400, w: 50, h: 50 }, PARTS)).toEqual([['Sidebar']]);
    expect(partsUnder({ x: 2000, y: 2000, w: 10, h: 10 }, PARTS)).toEqual([]);
  });
  it('counts a part named twice (two cards of the same name) once', () => {
    const twice: PartBox[] = [{ path: ['Goals', 'Card'], rect: { x: 0, y: 0, w: 100, h: 100 } }, { path: ['Goals', 'Card'], rect: { x: 0, y: 120, w: 100, h: 100 } }];
    expect(partsUnder({ x: 0, y: 0, w: 100, h: 300 }, twice)).toEqual([['Goals', 'Card']]);
  });
  it('takes each kind of mark’s box: a pen line, an arrow, a box drawn backwards, a pin', () => {
    expect(strokeBox({ kind: 'pen', points: [[10, 10], [30, 50]] })).toEqual({ x: 8, y: 8, w: 24, h: 44 });
    expect(strokeBox({ kind: 'box', x: 100, y: 100, w: -40, h: -20 })).toEqual({ x: 60, y: 80, w: 40, h: 20 });
    expect(strokeBox({ kind: 'note', n: 1, x: 50, y: 50, text: '' })).toEqual({ x: 36, y: 36, w: 28, h: 28 });
    expect(strokeBox({ kind: 'arrow', from: [0, 0], to: [10, 0] }).w).toBe(14);
  });
});

const STEPS = Array.from({ length: 24 }, (_, i) => ({ at: `2026-11-05T10:${String(i).padStart(2, '0')}:00.000Z`, kind: i % 2 ? 'action' : 'page', name: i % 2 ? 'postCheckIn' : '/goals/:goalId', ok: i !== 23 }));
const input = (o: Partial<MarkupInput> = {}): MarkupInput => ({
  id: 'mk_0123456789abcdef', line: '  The   “will it hit” cell wraps on a phone ', mood: 'meh', includeSteps: true,
  strokes: [{ kind: 'box', x: 1100, y: 190, w: -90, h: -60 }, { kind: 'note', n: 1, x: 300, y: 300, text: ' This dips ' }],
  parts: PARTS, pathname: '/goals/G-12', search: '?review=weekly', route: '/goals/:goalId',
  workspace: { id: 'ws_1', name: 'Acme' }, demo: false, person: { id: 'maya', name: 'Maya Chen' },
  context: { viewport: { w: 1280, h: 800, dpr: 2 }, theme: 'dark', themeChoice: 'system', accent: 'faro', appVersion: 'markup-inbox', sessionId: 'a'.repeat(32) },
  steps: STEPS, errors: [{ at: '2026-11-05T10:30:00.000Z', kind: 'save', type: 'network', action: 'postCheckIn', route: '/check-in/:goalId' }],
  pictures: ['screen.png', 'ink.png', 'thumb.jpg', 'marked.jpg'], now: '2026-11-05T10:31:00.000Z', ...o,
});

describe('what a markup carries', () => {
  it('carries the line, the drawing, the parts under each mark, where it was, and the visit’s last 20 steps and its errors', () => {
    const m = buildMarkup(input());
    expect(m.line).toBe('The “will it hit” cell wraps on a phone');
    expect(m.strokes[0]).toEqual({ kind: 'box', x: 1010, y: 130, w: 90, h: 60 });
    expect(m.strokes[1]).toMatchObject({ kind: 'note', text: 'This dips' });
    expect(m.parts[0]).toEqual([['Goal page', 'Summary bar', 'Scorecard', 'Will it hit']]);
    expect(m.parts[1]).toEqual([['Goal page', 'Chart']]);
    expect([m.goalId, m.reviewId, m.route, m.path]).toEqual(['G-12', 'weekly', '/goals/:goalId', '/goals/G-12?review=weekly']);
    expect(m.steps).toHaveLength(20);
    expect(m.steps.at(-1)).toMatchObject({ name: 'postCheckIn', ok: false });
    expect(m.errors).toEqual([expect.objectContaining({ kind: 'save', type: 'network' })]);
    expect(m.context).toMatchObject({ theme: 'dark', accent: 'faro', appVersion: 'markup-inbox' });
    expect(m.status).toBe('new');
  });
  it('leaves the steps out when the sender unticks them; errors still come', () => {
    const m = buildMarkup(input({ includeSteps: false }));
    expect(m.steps).toEqual([]);
    expect(m.errors).toHaveLength(1);
  });
  it('needs a line saying what should change, and keeps it short', () => {
    expect(() => buildMarkup(input({ line: '   ' }))).toThrow(MarkupError);
    expect(() => buildMarkup(input({ line: 'x'.repeat(501) }))).toThrow(/500/);
  });
  it('knows the goal or review a page is about', () => {
    expect(aboutOf('/goals/new')).toEqual({ goalId: null, reviewId: null });
    expect(aboutOf('/check-in/ci-docker')).toEqual({ goalId: 'ci-docker', reviewId: null });
    expect(aboutOf('/reviews/weekly/summary')).toEqual({ goalId: null, reviewId: 'weekly' });
  });
});

const make = (o: Partial<Markup> & { id: string }): Markup => ({ ...buildMarkup(input()), ...o });

describe('the inbox', () => {
  it('groups markups on the same part of the same page, newest first, with a count', () => {
    const a = make({ id: 'mk_a', createdAt: '2026-11-05T10:00:00Z' });
    const b = make({ id: 'mk_b', createdAt: '2026-11-05T12:00:00Z' });
    const c = make({ id: 'mk_c', createdAt: '2026-11-05T11:00:00Z', parts: [[['Goal page', 'Chart']]] });
    const d = make({ id: 'mk_d', createdAt: '2026-11-04T11:00:00Z', route: '/' , parts: [[['Home', 'Your goals']]] });
    const g = groupMarkups([a, b, c, d]);
    expect(g.map((x) => x.markups.map((m) => m.id))).toEqual([['mk_b', 'mk_a'], ['mk_c'], ['mk_d']]);
    expect(placeOf(b)).toBe('Goal page › Summary bar › Scorecard › Will it hit');
    expect(namedParts(b)[1]).toEqual(['Goal page', 'Chart']);
  });
  it('says what a status change needs: Fixed names a What’s new entry, Won’t fix a reason', () => {
    const now = '2026-11-06T09:00:00Z', ids = WHATS_NEW.map((e) => e.id);
    expect(statusPatch({ status: 'in-hand', by: 'Lane' }, now, ids)).toEqual({ status: 'in-hand', fixedIn: null, wontFixReason: null, statusBy: 'Lane', statusAt: now });
    expect(() => statusPatch({ status: 'fixed', by: 'Lane' }, now, ids)).toThrow(/What’s new/);
    expect(() => statusPatch({ status: 'fixed', fixedIn: 'no-such-entry', by: 'Lane' }, now, ids)).toThrow(/no What’s new entry/);
    expect(statusPatch({ status: 'fixed', fixedIn: ids[0], by: 'Lane' }, now, ids).fixedIn).toBe(ids[0]);
    expect(() => statusPatch({ status: 'wont-fix', reason: ' ', by: 'Lane' }, now, ids)).toThrow(/why/);
    expect(statusPatch({ status: 'wont-fix', reason: 'By design', by: 'Lane' }, now, ids).wontFixReason).toBe('By design');
  });
});

describe('the GitHub issue', () => {
  const m = buildMarkup(input());
  it('says the line, links back to the markup in the inbox, and lists the page, parts, notes, steps and errors', () => {
    const body = issueBody(m, { inboxUrl: 'https://faro.example/workspace/inbox?markup=mk_0123456789abcdef' });
    expect(issueTitle(m)).toBe('Markup: The “will it hit” cell wraps on a phone');
    expect(body).toContain('> The “will it hit” cell wraps on a phone');
    expect(body).toContain('(https://faro.example/workspace/inbox?markup=mk_0123456789abcdef)');
    expect(body).toContain('- Goal page › Summary bar › Scorecard › Will it hit');
    expect(body).toContain('1. This dips');
    expect(body).toContain('`/goals/G-12?review=weekly`');
    expect(body).toContain('Goal: `G-12`');
    expect(body).toMatch(/20\. 10:23:00 postCheckIn \(failed\)/);
    expect(body).toContain('A save didn’t go through (postCheckIn): network on /check-in/:goalId');
    expect(body).toContain('1280 × 800 at 2x, dark (following the device), accent faro');
    expect(body).toContain('Maya Chen sent this from Acme');
  });
  it('says so when the steps were left out, and never carries markup into GitHub’s page unescaped', () => {
    const body = issueBody(buildMarkup(input({ includeSteps: false, line: 'The <b>bold</b> header', errors: [] })));
    expect(body).toContain('Not included.');
    expect(body).toContain('None.');
    expect(body).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });
  it('opens a pre-filled new-issue link on the repository, cut short to fit GitHub’s limit', () => {
    const link = new URL(newIssueLink('sconies/goals-app', m, { inboxUrl: 'https://faro.example/x' }));
    expect(link.origin + link.pathname).toBe('https://github.com/sconies/goals-app/issues/new');
    expect(link.searchParams.get('title')).toBe(issueTitle(m));
    expect(link.searchParams.get('body')).toContain('https://faro.example/x');
    const long = buildMarkup(input({ strokes: Array.from({ length: 80 }, (_, i): Stroke => ({ kind: 'note', n: i + 1, x: 10, y: 10, text: 'A long note about the thing that should change, '.repeat(3) })) }));
    expect(newIssueLink('sconies/goals-app', long).length).toBeLessThanOrEqual(7500);
  });
});

describe('“You raised this”', () => {
  const entry = { id: 'markup-inbox', fixes: ['mk_mine', 'mk_theirs'] };
  it('shows on an entry that lists a markup this person sent, or one marked fixed in it', () => {
    expect(raisedThis(entry, [{ id: 'mk_mine', personId: 'maya' }], 'maya')).toBe(true);
    expect(raisedThis({ id: 'markup-inbox' }, [{ id: 'mk_other', personId: 'maya', fixedIn: 'markup-inbox' }], 'maya')).toBe(true);
  });
  it('matches by person and markup id: not someone else’s markup on the same browser, not another entry', () => {
    expect(raisedThis(entry, [{ id: 'mk_theirs', personId: 'sam' }], 'maya')).toBe(false);
    expect(raisedThis(entry, [{ id: 'mk_elsewhere', personId: 'maya', fixedIn: 'another-entry' }], 'maya')).toBe(false);
    expect(raisedThis({ id: 'x' }, [], 'maya')).toBe(false);
  });
  it('shows for feedback too, matched by person and feedback id, and says which it was', () => {
    const fixes = { id: 'small-fixes', fixes: ['fb_maya', 'fb_sam', 'mk_mine'] };
    const raised = [{ id: 'fb_maya', personId: 'maya', kind: 'feedback' as const }, { id: 'fb_sam', personId: 'sam', kind: 'feedback' as const }, { id: 'fb_old', personId: 'maya', kind: 'feedback' as const, fixedIn: 'small-fixes' }];
    expect(raisedIn(fixes, raised, 'maya').map((r) => r.id)).toEqual(['fb_maya', 'fb_old']);
    expect(raisedIn(fixes, raised, 'pat')).toEqual([]);
    expect(raisedThis({ id: 'small-fixes' }, [{ id: 'fb_sam', personId: 'sam', kind: 'feedback' }], 'maya')).toBe(false);
    expect(raisedText(raisedIn(fixes, raised, 'maya'))).toBe('Thank you: feedback you sent is fixed here.');
    expect(raisedText([{ id: 'mk_mine', personId: 'maya' }])).toBe('Thank you: a markup you sent is fixed here.');
    expect(raisedText([{ id: 'mk_mine', personId: 'maya' }, raised[0]!])).toBe('Thank you: a markup and feedback you sent are fixed here.');
  });
});

describe('the inbox’s operations (anyone’s, in Faro’s open inbox)', () => {
  const store = (list: Markup[]): MarkupStore => ({
    list: async (o) => list.filter((m) => !o.status || m.status === o.status).slice(0, o.limit),
    get: async (id) => list.find((m) => m.id === id) ?? null,
    update: async (id, patch) => { const i = list.findIndex((m) => m.id === id); if (i < 0) return null; list[i] = { ...list[i]!, ...patch }; return list[i]!; },
    pictureUrl: async (id, name) => `https://pictures.example/${id}/${name}`,
  });
  const ops = (list: Markup[]) => markupOps({ store: store(list), entries: WHATS_NEW.map((e) => e.id), repo: 'sconies/goals-app', inboxLink: (id) => `https://faro.example/workspace?markup=${id}`, now: () => new Date('2026-11-06T09:00:00Z') });

  it('lists with thumbnails, opens with picture links, triages, and keeps an issue’s address', async () => {
    const list = [make({ id: 'mk_1' }), make({ id: 'mk_2', pictures: [] })];
    const o = ops(list);
    expect((await o.list()).map((m) => m.thumbUrl)).toEqual(['https://pictures.example/mk_1/thumb.jpg', null]);
    expect((await o.open('mk_1')).urls).toEqual({ screen: 'https://pictures.example/mk_1/screen.png', ink: 'https://pictures.example/mk_1/ink.png', marked: 'https://pictures.example/mk_1/marked.jpg' });
    expect((await o.setStatus('mk_1', { status: 'in-hand', by: 'Lane' })).status).toBe('in-hand');
    expect(new URL(await o.issueLink('mk_1')).searchParams.get('body')).toContain('https://faro.example/workspace?markup=mk_1');
    await expect(o.setIssueUrl('mk_1', 'https://example.com/issue/1')).rejects.toThrow(/issue’s address/);
    expect((await o.setIssueUrl('mk_1', ' https://github.com/sconies/goals-app/issues/42?x=1 ')).issueUrl).toBe('https://github.com/sconies/goals-app/issues/42');
    await expect(o.open('mk_none')).rejects.toThrow(/no markup/);
  });

  it('undoes a status change through the same rule, putting back what it replaced, recorded as whoever undoes it', async () => {
    const list = [make({ id: 'mk_1' })];
    const o = ops(list);
    const was = await o.setStatus('mk_1', { status: 'wont-fix', reason: 'Calm is the point.', by: 'Maya' });
    await o.setStatus('mk_1', { status: 'fixed', fixedIn: WHATS_NEW[0]!.id, by: 'Sam' });
    expect(await o.setStatus('mk_1', undoChange(was, 'Lane'))).toMatchObject({ status: 'wont-fix', wontFixReason: 'Calm is the point.', fixedIn: null, statusBy: 'Lane' });
    expect(undoChange({ status: 'new', fixedIn: null, wontFixReason: null }, 'Lane')).toEqual({ status: 'new', fixedIn: null, reason: null, by: 'Lane' });
  });
});
