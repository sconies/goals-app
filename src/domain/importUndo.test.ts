/* Rule 9's undo and past imports (backlog IM4; import spec 2.5 to 2.7): the summary's File and Rows, what Undo would
   do said before it, why a row stays, and Activity's fold. */
import { describe, expect, it } from 'vitest';
import { buildPlatformOrg } from '../data/platformOrg/generate';
import { applyCommit } from '../data/store';
import { foldImports } from './activity';
import { planChanges, VIA_LABEL, type Rec } from './changeset';
import { currentWeek } from './plan';
import { importCounts, importName, keptText, nothingToUndo, pastImports, undoImport, undoPreview } from './removal';
import type { Change } from './types';

const today = new Date('2026-11-05T13:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
let n = 0;
const newId = (p: string) => `${p}_t${++n}`;
const who = (id: string) => s.people.find((p) => p.id === id)!;
const rec = (row: number, o: Record<string, string>): Rec => ({ __row: String(row), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v])) });
const goals = ['Pipeline cache hit rate', 'Runner idle time'].map((t, i) => rec(i + 2, { Goal: t, Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: '%', Start: '20', Target: '90' }));
const ctx = (snap: typeof s, actor: string, now: string) => ({ snapshot: snap, full: snap, cycle, week, actor: who(actor), now, newId });

function imported() {
  const cs = planChanges({ tables: { goals, checkIns: [rec(2, { Goal: 'Runner idle time', Week: String(week - 2), Value: '20' })] }, snapshot: s, cycle, week, actor: who('amara'), now: today.toISOString(), newId, via: 'spreadsheet', file: { name: 'goals.xlsx', leftOut: 2 } });
  expect(cs.commit).not.toBeNull();
  return { cs, after: applyCommit(s, cs.commit!), entry: cs.commit!.changes.find((c) => c.action === 'imported')! };
}

describe('undoing an import (rule 9)', () => {
  it('keeps the file’s name and its rows on the summary', () => {
    const { entry } = imported();
    expect(entry.diffs).toEqual(expect.arrayContaining([{ field: 'File', from: '—', to: 'goals.xlsx' }, { field: 'Rows', from: '—', to: '3 changed, 0 unchanged, 2 left out' }]));
    expect(importName(entry)).toBe('goals.xlsx');
    expect(importCounts(entry)).toBe('2 new goals, 1 check-in (1 for past weeks)');
  });

  it('names a bulk change by where it was made', () => {
    const base = { id: 'c', at: '', actorId: 'amara', goalId: null, entity: 'workspace', entityId: 'imp', action: 'imported', summary: 'Bulk edit: x' } as const;
    expect(importName({ ...base, diffs: [{ field: 'Via', from: '—', to: VIA_LABEL.table }] })).toBe('Bulk edit on Data');
    expect(importName({ ...base, diffs: [{ field: 'Via', from: '—', to: VIA_LABEL.mcp }] })).toBe('Changes through MCP');
  });

  it('says beforehand what Undo does, and a row changed since stays, with who and when', () => {
    const { after, entry } = imported();
    const goal = after.goals.find((g) => g.title === 'Pipeline cache hit rate')!;
    const later = new Date(today.getTime() + 3_600_000).toISOString();
    const ci = { id: 'ci_later', goalId: goal.id, authorId: 'rhea', week, postedAt: later, value: 30, stages: null, status: 'on' as const, calculated: 'on' as const, cause: null, why: '', greenerWhy: '', proposeTarget: null, pathToGreen: null, next: '', dataFlagged: false };
    const s2 = applyCommit(after, { checkIns: [ci], changes: [{ id: 'chg_l', at: later, actorId: 'rhea', goalId: goal.id, entity: 'check-in', entityId: ci.id, action: 'posted', summary: 'Checked in', diffs: [] }] });
    const p = undoPreview(ctx(s2, 'amara', later), entry.entityId);
    expect(p.restores).toBe(2);
    expect(p.skipped.map(keptText)).toEqual([`Pipeline cache hit rate: Rhea Kapoor posted a check-in for week ${week} on 5 Nov`]);
    // Nothing was saved by the preview; Undo then gives the same.
    const out = undoImport(ctx(s2, 'amara', later), entry.entityId);
    expect({ restores: out.restored, skipped: out.skipped }).toEqual(p);
    const s3 = applyCommit(s2, out.commit);
    expect(pastImports(s3.changes)[0]).toMatchObject({ entry: { entityId: entry.entityId }, undone: { action: 'undone', actorId: 'amara' } });
  });

  it('a field changed since says which', () => {
    const { after, entry } = imported();
    const goal = after.goals.find((g) => g.title === 'Runner idle time')!;
    const later = new Date(today.getTime() + 3_600_000).toISOString();
    const s2 = applyCommit(after, { goals: [{ ...goal, title: 'Runner idle share' }], changes: [{ id: 'chg_t', at: later, actorId: 'rhea', goalId: goal.id, entity: 'goal', entityId: goal.id, action: 'edited', summary: 'Edited', diffs: [{ field: 'Target', from: '90', to: '95' }] }] });
    expect(undoPreview(ctx(s2, 'amara', later), entry.entityId).skipped.map((k) => k.reason)).toContain('Its target was changed on 5 Nov');
  });
});

describe('undo puts back every kind, and leaves nothing hanging (IM4 review)', () => {
  const later = new Date(today.getTime() + 3_600_000).toISOString();
  const plan = (tables: Parameters<typeof planChanges>[0]['tables'], answers?: Record<string, { choice: string }>) => {
    const cs = planChanges({ tables, snapshot: s, cycle, week, actor: who('amara'), now: today.toISOString(), newId, via: 'spreadsheet', ...(answers ? { answers } : {}) } as never);
    expect(cs.commit).not.toBeNull();
    return { after: applyCommit(s, cs.commit!), entry: cs.commit!.changes.find((c) => c.action === 'imported')! };
  };

  it('an import that only changes a team can be undone, and counts the team', () => {
    const team = s.teams.find((t) => t.leadId && s.people.some((p) => p.id === t.leadId))!;
    const lead = who(team.leadId);
    const { after, entry } = plan({ people: [rec(2, { Email: lead.email!, 'Team objective': 'Ship every change within a day' })] });
    expect(entry.undo!.goals.length + entry.undo!.people.length).toBe(0);
    expect(undoPreview(ctx(after, 'amara', later), entry.entityId)).toEqual({ restores: 1, skipped: [] });
    const out = undoImport(ctx(after, 'amara', later), entry.entityId);
    expect(applyCommit(after, out.commit).teams.find((t) => t.id === team.id)!.objective).toBe(team.objective);
  });

  it('says plainly when an import changed nothing, and refuses to mark it undone', () => {
    const { after, entry } = imported();
    const empty = { ...entry, id: 'chg_empty', entityId: 'imp_empty', undo: { goals: [], checkIns: [], people: [], requests: [] } };
    const s2 = applyCommit(after, { changes: [empty] });
    expect(undoPreview(ctx(s2, 'amara', later), 'imp_empty')).toEqual({ restores: 0, skipped: [] });
    expect(() => undoImport(ctx(s2, 'amara', later), 'imp_empty')).toThrow('Nothing to undo: it changed no rows.');
    expect(nothingToUndo(3)).toBe('Nothing left to undo: all 3 rows have changed since.');
  });

  it('a goal changed since that fed one Undo deletes moves up, as deleting it would', () => {
    const { after, entry } = plan({ goals: [rec(2, { Goal: 'Runner pool size', Owner: 'Rhea Kapoor', Team: 'CI/CD', Unit: 'runners', Start: '10', Target: '30' }), rec(3, { Goal: 'Runner spares', Owner: 'Rhea Kapoor', Team: 'CI/CD', 'Feeds into': 'Runner pool size', Unit: 'runners', Start: '1', Target: '3' })] });
    const parent = after.goals.find((g) => g.title === 'Runner pool size')!;
    const child = after.goals.find((g) => g.title === 'Runner spares')!;
    expect(child.parentId).toBe(parent.id);
    const s2 = applyCommit(after, { goals: [{ ...child, title: 'Runner spares kept' }], changes: [{ id: 'chg_c', at: later, actorId: 'rhea', goalId: child.id, entity: 'goal', entityId: child.id, action: 'edited', summary: 'Edited', diffs: [{ field: 'Target', from: '3', to: '4' }] }] });
    const out = undoImport(ctx(s2, 'amara', later), entry.entityId);
    expect(out.restored).toBe(1);
    const s3 = applyCommit(s2, out.commit);
    expect(s3.goals.find((g) => g.id === parent.id)!.removedAt).toBeTruthy();
    const kept = s3.goals.find((g) => g.id === child.id)!;
    expect(kept.removedAt ?? null).toBeNull();
    expect(kept.parentId).toBeNull();
    expect(out.commit.changes.some((c) => c.entityId === child.id && /Now feeds nothing/.test(c.summary))).toBe(true);
  });

  it('someone the import added stays while they lead a team, sit in a review or have an ask', () => {
    const { after, entry } = plan({ people: [rec(2, { Name: 'Noor Haddad', Email: 'noor@example.com', Team: 'CI/CD' })] });
    const noor = after.people.find((p) => p.name === 'Noor Haddad')!;
    expect(undoPreview(ctx(after, 'amara', later), entry.entityId).restores).toBe(1);
    const team = after.teams.find((t) => t.name !== 'CI/CD')!;
    const leads = applyCommit(after, { teams: [{ ...team, leadId: noor.id }], changes: [] });
    expect(undoPreview(ctx(leads, 'amara', later), entry.entityId).skipped.map((k) => k.reason)).toEqual([`Noor Haddad leads the team ${team.name}`]);
    const review = after.reviews[0]!;
    const inReview = applyCommit(after, { reviews: [{ ...review, people: [...review.people, noor.id] }], changes: [] });
    expect(undoPreview(ctx(inReview, 'amara', later), entry.entityId).skipped.map((k) => k.reason)).toEqual(['Noor Haddad is in a review since']);
  });

  it('names a corrected check-in and a bulk edit on People by what they are', () => {
    const base = { id: 'c', at: '', actorId: 'amara', goalId: null, entity: 'workspace', entityId: 'imp', action: 'imported' } as const;
    expect(importName({ ...base, summary: 'Corrected a check-in: 1 check-in', diffs: [] })).toBe('A corrected check-in');
    const bulk = { ...base, summary: 'Bulk edit: 2 people changed', diffs: [{ field: 'Via', from: '—', to: VIA_LABEL.bulk }] };
    expect(importName({ ...bulk, undo: { goals: [], checkIns: [], people: [{ id: 'p', before: null }], requests: [] } } as never)).toBe('Bulk edit on People');
    expect(importName({ ...bulk, undo: { goals: [{ id: 'g', before: null }], checkIns: [], people: [], requests: [] } } as never)).toBe('Bulk edit on Goals');
  });
});

describe('Activity folds an import’s rows under it (spec 2.7)', () => {
  it('folds rows whose summary is listed, and leaves a row found alone', () => {
    const { cs } = imported();
    const list = [...cs.commit!.changes].reverse();
    const head = list.find((c) => c.action === 'imported')!;
    const out = foldImports(list);
    expect(out.top).toEqual([head]);
    expect(out.rows.get(head.id)!.length).toBe(list.length - 1);
    const alone: Change[] = list.filter((c) => c.action !== 'imported');
    expect(foldImports(alone).top.length).toBe(alone.length);
  });
});
