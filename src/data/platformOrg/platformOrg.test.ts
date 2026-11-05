/* The Platform Engineering example is a believable organisation, and every record in it follows the app's own rules. */
import { describe, expect, it } from 'vitest';
import { draftFrom, evaluate } from '../../domain/checkin';
import { goalAsOf } from '../../domain/plan';
import { goalsIn } from '../../domain/review';
import { checkInsFor, goalStatus } from '../../domain/status';
import type { Snapshot } from '../../domain/types';
import { EXAMPLE } from '../examples';
import { BrowserStore, pickExampleFromUrl } from '../store';
import { buildPlatformOrg, PERSONAS } from './index';

const TODAY = new Date('2026-11-05T12:00:00Z');
const s: Snapshot = buildPlatformOrg(TODAY);
const cycle = s.cycles[0]!;
const people = new Set(s.people.map((p) => p.id));
const goals = new Map(s.goals.map((g) => [g.id, g]));
const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe('the Platform Engineering example', () => {
  it('is one division of about 100 people in teams, with a few admins', () => {
    expect(s.people.length).toBeGreaterThanOrEqual(95);
    expect(s.people.length).toBeLessThanOrEqual(105);
    expect(unique(s.people.map((p) => p.id))).toBe(true);
    expect(s.teams.length).toBeGreaterThanOrEqual(12);
    for (const t of s.teams) expect(people.has(t.leadId), t.id).toBe(true);
    for (const p of s.people) if (p.teamId) expect(s.teams.some((t) => t.id === p.teamId), p.id).toBe(true);
    const admins = s.people.filter((p) => p.admin).length;
    expect(admins).toBeGreaterThanOrEqual(2);
    expect(admins).toBeLessThanOrEqual(5);
  });

  it('has exactly 12 north stars and 120 to 160 goals, every one linked to things that exist', () => {
    expect(s.goals.filter((g) => g.level === 'north-star')).toHaveLength(12);
    expect(s.goals.length).toBeGreaterThanOrEqual(120);
    expect(s.goals.length).toBeLessThanOrEqual(160);
    expect(unique(s.goals.map((g) => g.id))).toBe(true);
    expect(unique(s.goals.map((g) => g.key!))).toBe(true);
    for (const g of s.goals) {
      expect(people.has(g.ownerId), `${g.id} owner`).toBe(true);
      expect(s.teams.some((t) => t.id === g.teamId), `${g.id} team`).toBe(true);
      if (g.parentId) expect(goals.has(g.parentId), `${g.id} parent`).toBe(true);
      for (const a of g.alsoHelps ?? []) expect(goals.has(a), `${g.id} also helps`).toBe(true);
    }
    // Each north star has two to four SVP goals feeding it, and every kind of goal is used.
    for (const ns of s.goals.filter((g) => g.level === 'north-star')) {
      const svp = s.goals.filter((g) => g.parentId === ns.id && g.level === 'svp').length;
      expect(svp, ns.id).toBeGreaterThanOrEqual(2);
      expect(svp, ns.id).toBeLessThanOrEqual(4);
    }
    expect(new Set(s.goals.map((g) => g.kind))).toEqual(new Set(['metric', 'range', 'milestone']));
    expect(s.goals.filter((g) => !g.parentId && g.level !== 'north-star').length).toBeGreaterThanOrEqual(2);
    expect(s.goals.some((g) => g.kind === 'metric' && (g.planHistory?.length ?? 0) > 0)).toBe(true);
  });

  it('has check-ins that every one passes the check-in rules, as posted', () => {
    expect(s.checkIns.length).toBeGreaterThan(4000);
    expect(unique(s.checkIns.map((c) => c.id))).toBe(true);
    for (const g of s.goals) {
      const own = checkInsFor(g, s.checkIns);
      for (const c of own) {
        expect(people.has(c.authorId), c.id).toBe(true);
        const e = evaluate(goalAsOf(g, c.week), cycle, c.week, draftFrom(c), own);
        expect(e.missing, c.id).toEqual([]);
        expect(e.status, c.id).toBe(c.status);
        expect(e.calc, c.id).toBe(c.calculated);
      }
    }
    expect(s.checkIns.some((c) => c.backfilled)).toBe(true);
    // Reasons change from week to week.
    const why = s.checkIns.filter((c) => c.goalId === 'ns-lead' && c.cause).map((c) => c.why);
    expect(new Set(why).size).toBeGreaterThan(3);
  });

  it('looks like a real organisation: mostly on track, a real minority behind, a north star off track', () => {
    const st = s.goals.map((g) => goalStatus(g, cycle, s.checkIns, TODAY).status);
    const share = (k: string[]) => st.filter((x) => k.includes(x)).length / st.length;
    expect(share(['on', 'done'])).toBeGreaterThan(0.55);
    expect(share(['risk', 'off'])).toBeGreaterThan(0.15);
    expect(share(['risk', 'off'])).toBeLessThan(0.4);
    expect(share(['off'])).toBeGreaterThan(0.04);
    expect(st.filter((x) => x === 'stale').length).toBeGreaterThanOrEqual(2);
    expect(st.filter((x) => x === 'none').length).toBeGreaterThanOrEqual(2);
    expect(st.filter((x) => x === 'done').length).toBeGreaterThanOrEqual(2);
    expect(goalStatus(goals.get('ns-lead')!, cycle, s.checkIns, TODAY).status).toBe('off');
  });

  it('points every reference at something that exists', () => {
    const reviews = new Set(s.reviews.map((r) => r.id));
    for (const d of s.decisions) {
      expect(goals.has(d.goalId), d.id).toBe(true);
      expect(people.has(d.byId), d.id).toBe(true);
      if (d.reviewId) expect(reviews.has(d.reviewId), d.id).toBe(true);
      if (d.assigneeId) expect(people.has(d.assigneeId), d.id).toBe(true);
    }
    for (const r of s.reviews) {
      for (const id of [...r.scope.goals, ...r.scope.trees]) expect(goals.has(id), r.id).toBe(true);
      for (const p of [...r.people, r.createdBy]) expect(people.has(p), r.id).toBe(true);
    }
    const checkIns = new Set(s.checkIns.map((c) => c.id));
    for (const r of s.requests ?? []) {
      for (const g of r.goalIds) expect(goals.has(g), r.id).toBe(true);
      expect(people.has(r.askedBy), r.id).toBe(true);
      if (r.recipientId) expect(people.has(r.recipientId), r.id).toBe(true);
      if (r.answeredBy) expect(people.has(r.answeredBy), r.id).toBe(true);
      if (r.checkInId) expect(checkIns.has(r.checkInId), r.id).toBe(true);
    }
    for (const w of s.watches) {
      expect(people.has(w.personId), w.id).toBe(true);
      expect(w.kind === 'level' ? ['north-star', 'svp', 'team'].includes(w.ref) : goals.has(w.ref), w.id).toBe(true);
    }
    for (const v of s.views ?? []) expect(people.has(v.personId), v.id).toBe(true);
    for (const t of s.tokens ?? []) expect(people.has(t.personId), t.id).toBe(true);
    for (const c of s.changes) {
      expect(people.has(c.actorId), c.id).toBe(true);
      if (c.goalId) expect(goals.has(c.goalId), c.id).toBe(true);
    }
    expect(unique(s.changes.map((c) => c.id))).toBe(true);
    expect(unique(s.decisions.map((d) => d.id))).toBe(true);
    for (const p of Object.values(PERSONAS)) expect(people.has(p.id), p.id).toBe(true);
  });

  it('has the conversation around the goals: asks of every kind, comments, reviews, watches and views', () => {
    const req = s.requests ?? [];
    for (const k of ['open', 'answered', 'done', 'withdrawn'] as const) expect(req.some((r) => r.status === k), k).toBe(true);
    for (const k of ['decision', 'update', 'question', 'action'] as const) expect(req.some((r) => r.kind === k), k).toBe(true);
    expect(req.some((r) => r.goalIds.length >= 3)).toBe(true);
    expect(s.changes.filter((c) => c.entity === 'note' && c.summary === 'Commented').length).toBeGreaterThan(40);
    expect(s.changes.some((c) => c.entity === 'request' && c.action === 'withdrawn' && c.summary === 'Withdrew the ask for an update')).toBe(true);
    expect(s.changes.some((c) => c.entity === 'workspace' && c.action === 'imported')).toBe(true);
    expect(s.reviews.length).toBeGreaterThanOrEqual(5);
    for (const k of ['acknowledge', 'note'] as const) expect(s.decisions.some((d) => d.kind === k), k).toBe(true);
    // An action past its week and still open: overdue, not dropped.
    expect(req.some((r) => r.kind === 'action' && r.status === 'open' && r.dueWeek != null && r.dueWeek < 45)).toBe(true);
    expect(new Set(s.watches.map((w) => w.kind))).toEqual(new Set(['goal', 'tree', 'level']));
    expect(s.views!.some((v) => v.pinned)).toBe(true);
    expect(s.views!.some((v) => !v.pinned && !v.deletedAt)).toBe(true);
  });

  it('has the long cases on purpose', () => {
    expect(Math.max(...s.goals.map((g) => g.title.length))).toBeGreaterThan(100);
    expect(Math.max(...s.teams.map((t) => t.name.length))).toBeGreaterThan(50);
    expect(Math.max(...s.people.map((p) => p.name.length))).toBeGreaterThan(40);
    expect(Math.max(...s.checkIns.map((c) => c.why.length))).toBeGreaterThan(400);
    const contributors = (id: string) => s.goals.filter((g) => { for (let x = g; x.parentId; x = goals.get(x.parentId)!) if (x.parentId === id) return true; return false; }).length;
    expect(Math.max(...s.goals.filter((g) => g.level === 'north-star').map((g) => contributors(g.id)))).toBeGreaterThanOrEqual(12);
    const owned = new Map<string, number>();
    for (const g of s.goals) owned.set(g.ownerId, (owned.get(g.ownerId) ?? 0) + 1);
    expect(Math.max(...owned.values())).toBeGreaterThanOrEqual(8);
    expect(Math.max(...s.reviews.map((r) => goalsIn(r.scope, s.goals).length))).toBeGreaterThanOrEqual(40);
  });

  it('builds the same workspace every time, and for other days of the year', () => {
    expect(JSON.stringify(buildPlatformOrg(TODAY))).toBe(JSON.stringify(s));
    for (const day of ['2026-10-30T12:00:00Z', '2026-12-01T12:00:00Z', '2027-03-10T12:00:00Z']) {
      const other = buildPlatformOrg(new Date(day));
      expect(other.goals.filter((g) => g.level === 'north-star'), day).toHaveLength(12);
      expect(other.checkIns.length, day).toBeGreaterThan(3000);
    }
  });

  it('is the demo’s only example, and its link opens it', async () => {
    expect(EXAMPLE.id).toBe('platform-org');
    const store = new BrowserStore(() => TODAY);
    expect((await store.workspaces()).map((w) => w.id)).toEqual(['platform-org']);
    localStorage.setItem('goals-app-workspace', 'ws_mine');
    pickExampleFromUrl('?example=platform-org&today=2026-11-05');
    expect(localStorage.getItem('goals-app-workspace')).toBe('platform-org');
    expect((await store.load('platform-org')).goals.length).toBe(s.goals.length);
    pickExampleFromUrl('?example=nothing-like-it');
    expect(localStorage.getItem('goals-app-workspace')).toBe('platform-org');
  });
});
