/* The contracts for the other outside parts (backlog 8c; the goals store's is store.ts). Each takes a way to make the
   part and checks what any replacement must do. src/adapters/parts.test.ts runs them on Faro's adapters; run them on
   yours. */
import type { Feedback, Metric } from '../../domain/types';
import type { Markup, MarkupStatus } from '../../markup/model';
import type { Clock, FeedbackStore, Files, Identity, MarkupStore, NumberSource } from '../index';

const at = (minute: number) => new Date(Date.UTC(2026, 10, 2, 9, minute)).toISOString();

/** A markup as the inbox would hold it, for seeding a store. */
export function contractMarkup(n: number, o: Partial<Markup> = {}): Markup {
  return {
    id: 'mk_' + n.toString(16).padStart(16, '0'), workspaceId: 'ws_markups', workspaceName: 'Markups', demo: false, personId: 'p1', personName: 'Ada Lovelace',
    line: `Markup ${n}`, mood: null, route: '/goals', path: '/goals', goalId: null, reviewId: null, parts: [], strokes: [], context: {} as Markup['context'], steps: [], errors: [],
    pictures: [], status: 'new', issueUrl: null, fixedIn: null, wontFixReason: null, statusBy: null, statusAt: null, createdAt: at(n), ...o,
  };
}

export function markupContract(name: string, make: () => Promise<{ store: MarkupStore; add(m: Markup): Promise<void> }>) {
  describe(`the markup store contract: ${name}`, () => {
    let store: MarkupStore;
    beforeAll(async () => {
      const made = await make();
      store = made.store;
      for (const m of [contractMarkup(1), contractMarkup(2, { status: 'in-hand' }), contractMarkup(3), contractMarkup(4, { demo: true }), contractMarkup(5, { workspaceId: 'ws_other' })]) await made.add(m);
    }, 60_000);

    it('lists markups newest first, as many as asked for', async () => {
      const all = await store.list({ limit: 10 });
      expect(all.map((m) => m.line)).toEqual(['Markup 5', 'Markup 4', 'Markup 3', 'Markup 2', 'Markup 1']);
      expect((await store.list({ limit: 2 })).map((m) => m.line)).toEqual(['Markup 5', 'Markup 4']);
    });

    it('lists one workspace’s (its demo markups left out) or one status', async () => {
      expect((await store.list({ limit: 10, workspaceId: 'ws_markups' })).map((m) => m.line)).toEqual(['Markup 3', 'Markup 2', 'Markup 1']);
      expect((await store.list({ limit: 10, status: 'in-hand' })).map((m) => m.line)).toEqual(['Markup 2']);
    });

    it('opens one, or says there is none', async () => {
      expect((await store.get(contractMarkup(3).id))?.line).toBe('Markup 3');
      expect(await store.get('mk_' + 'f'.repeat(16))).toBeNull();
    });

    it('saves a status and gives the markup back changed, or null when it isn’t there', async () => {
      const patch = { status: 'fixed' as MarkupStatus, fixedIn: '8c', statusBy: 'Ada Lovelace', statusAt: at(30) };
      expect(await store.update(contractMarkup(1).id, patch)).toMatchObject({ status: 'fixed', fixedIn: '8c', line: 'Markup 1' });
      expect((await store.get(contractMarkup(1).id))?.status).toBe('fixed');
      expect(await store.update('mk_' + 'e'.repeat(16), patch)).toBeNull();
    });

    it('makes a picture address, or says it can’t', async () => {
      const u = await store.pictureUrl(contractMarkup(3).id, 'screen.png', 600);
      expect(u === null || typeof u === 'string').toBe(true);
    });
  });
}

export function feedbackContract(name: string, make: () => Promise<{ store: FeedbackStore; add(workspaceId: string, f: Feedback): Promise<void>; workspaceId: string; personId: string }>) {
  describe(`the feedback store contract: ${name}`, () => {
    let made: Awaited<ReturnType<typeof make>>;
    const fb = (n: number, personId: string): Feedback => ({ id: `fb_contract${n}`, personId, mood: n % 2 ? 'good' : 'bad', text: `Feedback ${n}`, path: '/goals', at: at(n) });
    beforeAll(async () => {
      made = await make();
      for (const n of [1, 2, 3]) await made.add(made.workspaceId, fb(n, made.personId));
    }, 60_000);

    it('lists feedback newest first, as much as asked for, and one workspace’s', async () => {
      expect((await made.store.list(10, { workspaceId: made.workspaceId })).map((f) => f.text)).toEqual(['Feedback 3', 'Feedback 2', 'Feedback 1']);
      expect((await made.store.list(1, { workspaceId: made.workspaceId })).map((f) => f.text)).toEqual(['Feedback 3']);
      expect(await made.store.list(10, { workspaceId: 'ws_nobody' })).toEqual([]);
    });

    it('opens one, with who sent it and from where, or says there is none', async () => {
      expect(await made.store.get('fb_contract2')).toMatchObject({ text: 'Feedback 2', mood: 'bad', path: '/goals', personId: made.personId, workspaceId: made.workspaceId, status: 'new' });
      expect(await made.store.get('fb_nobody')).toBeNull();
    });

    it('saves a status, lists by it, and says null when the feedback isn’t there', async () => {
      const t = { status: 'wont-fix' as MarkupStatus, fixedIn: null, wontFixReason: 'Works as intended', statusBy: 'Ada', statusAt: at(40) };
      expect(await made.store.update('fb_contract1', t)).toMatchObject({ status: 'wont-fix', wontFixReason: 'Works as intended' });
      expect((await made.store.get('fb_contract1'))?.status).toBe('wont-fix');
      expect((await made.store.list(10, { status: 'wont-fix' })).map((f) => f.id)).toEqual(['fb_contract1']);
      expect(await made.store.update('fb_nobody', t)).toBeNull();
    });
  });
}

export function identityContract(name: string, make: () => Identity) {
  describe(`the identity contract: ${name}`, () => {
    it('says nobody until someone is chosen, then that person, per workspace, and remembers it', () => {
      const id = make();
      expect(id.who('ws_a')).toBeNull();
      id.choose('ws_a', 'ada');
      id.choose('ws_b', 'grace');
      expect(id.who('ws_a')).toBe('ada');
      expect(id.who('ws_b')).toBe('grace');
      id.choose('ws_a', 'alan');
      expect(id.who('ws_a')).toBe('alan');
      expect(make().who('ws_a')).toBe('alan');
    });
  });
}

export function clockContract(name: string, make: () => Clock) {
  describe(`the clock contract: ${name}`, () => {
    it('gives a real moment that never goes backwards, and can’t be changed by whoever reads it', () => {
      const clock = make();
      const a = clock();
      expect(Number.isNaN(a.getTime())).toBe(false);
      const t = a.getTime();
      a.setFullYear(1990);
      const b = clock();
      expect(b.getTime()).toBeGreaterThanOrEqual(t);
    });
  });
}

export function filesContract(name: string, make: () => Promise<Files>) {
  describe(`the files contract: ${name}`, () => {
    it('keeps a file by its path, gives its bytes and an address, and never replaces it', async () => {
      const files = await make();
      const data = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
      await files.put('markups/mk_1/screen.png', new Blob([data], { type: 'image/png' }), 'image/png');
      expect([...(await files.bytes('markups/mk_1/screen.png'))!]).toEqual([...data]);
      expect(typeof (await files.url('markups/mk_1/screen.png'))).toBe('string');
      await expect(files.put('markups/mk_1/screen.png', new Blob([new Uint8Array([0])]), 'image/png')).rejects.toThrow();
      expect([...(await files.bytes('markups/mk_1/screen.png'))!]).toEqual([...data]);
      expect(await files.bytes('markups/mk_1/none.png')).toBeNull();
    });
  });
}

/** `metric` is one the source reads; `before` a moment before its first reading. */
export function numberSourceContract(name: string, make: () => Promise<{ source: NumberSource; metric: Metric; before: Date; after: Date }>) {
  describe(`the number source contract: ${name}`, () => {
    it('reads its own metrics: a number measured at or before the moment asked, and none before its first', async () => {
      const { source, metric, before, after } = await make();
      expect(source.reads(metric)).toBe(true);
      const r = await source.read(metric, after);
      expect(r).not.toBeNull();
      expect(Number.isFinite(r!.value)).toBe(true);
      expect(Date.parse(r!.at)).toBeLessThanOrEqual(after.getTime());
      expect(await source.read(metric, before)).toBeNull();
    });

    it('doesn’t read a metric from somewhere else', async () => {
      const { source, metric, after } = await make();
      const other = { ...metric, id: 'm_elsewhere', source: 'Somewhere else' };
      expect(source.reads(other)).toBe(false);
      expect(await source.read(other, after)).toBeNull();
    });
  });
}
