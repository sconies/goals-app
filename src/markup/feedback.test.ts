// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Feedback } from '../domain/types';
import { feedbackFromInboxRow, feedbackOps, keptFixes, localFeedback } from './feedback';

const fb = (id: string, at: string, o: Partial<Feedback> = {}): Feedback => ({ id, personId: 'maya', path: '/goals', mood: 'meh', text: 'Hard to find the filters', at, ...o });

describe('feedback in the builder inbox', () => {
  beforeEach(() => localStorage.clear());
  const list = [fb('fb_a', '2026-11-04T10:00:00.000Z'), fb('fb_b', '2026-11-05T10:00:00.000Z', { mood: 'bad', text: '' })];
  const here = { workspaceId: 'ws', workspaceName: 'Platform', feedback: () => list, personName: (id: string) => (id === 'maya' ? 'Maya Okafor' : '') };
  const ops = () => feedbackOps({ store: localFeedback(here), entries: ['remove-and-undo', 'mark-up-a-screen'], now: () => new Date('2026-11-06T12:00:00Z') });

  it('lists this workspace’s feedback newest first, each new, with who sent it and where', async () => {
    const rows = await ops().list();
    expect(rows.map((r) => r.id)).toEqual(['fb_b', 'fb_a']);
    expect(rows[1]).toMatchObject({ status: 'new', personName: 'Maya Okafor', workspaceName: 'Platform', path: '/goals', fixedIn: null });
  });

  it('triages with the markups’ states and rules, and keeps the status', async () => {
    const o = ops();
    expect(await o.setStatus('fb_a', { status: 'in-hand', by: 'Lane' })).toMatchObject({ status: 'in-hand', statusBy: 'Lane', statusAt: '2026-11-06T12:00:00.000Z' });
    await expect(o.setStatus('fb_a', { status: 'fixed', by: 'Lane' })).rejects.toThrow('Say which What’s new entry has the fix.');
    await expect(o.setStatus('fb_a', { status: 'fixed', fixedIn: 'no-such-entry', by: 'Lane' })).rejects.toThrow(/There’s no What’s new entry/);
    await expect(o.setStatus('fb_a', { status: 'wont-fix', reason: ' ', by: 'Lane' })).rejects.toThrow('Say why it won’t be fixed.');
    await o.setStatus('fb_a', { status: 'fixed', fixedIn: 'remove-and-undo', by: 'Lane' });
    expect((await ops().list()).find((r) => r.id === 'fb_a')).toMatchObject({ status: 'fixed', fixedIn: 'remove-and-undo', wontFixReason: null });
    await expect(o.setStatus('fb_gone', { status: 'in-hand', by: 'Lane' })).rejects.toThrow('That feedback isn’t there any more.');
  });

  it('opens one, lists by status, and remembers where each was fixed for “You raised this”', async () => {
    const o = ops();
    expect(await o.open('fb_a')).toMatchObject({ id: 'fb_a', personName: 'Maya Okafor', status: 'new' });
    await expect(o.open('fb_gone')).rejects.toThrow('There’s no feedback fb_gone.');
    await o.setStatus('fb_b', { status: 'fixed', fixedIn: 'mark-up-a-screen', by: 'Lane' });
    expect((await o.list(10, { status: 'fixed' })).map((r) => r.id)).toEqual(['fb_b']);
    expect((await o.list(10, { workspaceId: 'elsewhere' }))).toEqual([]);
    expect(keptFixes()).toEqual({ fb_b: 'mark-up-a-screen' });
  });

  it('reads the database’s rows, a row without a status counting as new', () => {
    const f = feedbackFromInboxRow({ id: 'fb_c', workspace_id: 'w2', workspace_name: 'Other', person_id: 'p', person_name: 'Pat', path: '/', mood: 'good', text: 'Calm', at: '2026-11-06T09:00:00+00:00' });
    expect(f).toMatchObject({ status: 'new', at: '2026-11-06T09:00:00.000Z', workspaceName: 'Other', personName: 'Pat', statusAt: null });
  });
});
