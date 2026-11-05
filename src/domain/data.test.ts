// @vitest-environment node
/* The data tables and Activity (3 Nov): people through the bulk-change engine, an admin correcting a past
   check-in, and the change log filtered by who, goal or tree, team, level, kind, dates and words. */
import { applyCommit } from '../data/store';
import { activityEntries, activityFilter, activityRows, describeActivity, EMPTY_ACTIVITY, kindOf, parseActivity, treeOf } from './activity';
import { planChanges, records, type ChangeInput, type Rec } from './changeset';
import { workbook } from './export';
import { currentWeek } from './plan';
import { buildPlatformOrg } from '../data/platformOrg';
import type { Change } from './types';

const today = new Date('2026-11-05T12:00:00Z');
const s = buildPlatformOrg(today);
const cycle = s.cycles[0]!;
const week = currentWeek(cycle, today);
const person = (id: string) => s.people.find((p) => p.id === id)!;
let n = 0;
const base = (actor: string, tables: ChangeInput['tables']): ChangeInput => ({ tables, snapshot: s, cycle, week, actor: person(actor), now: today.toISOString(), newId: (p) => `${p}_d${++n}`, via: 'table' });
const tsvOf = (rows: (string | number | null)[][]) => rows.map((r) => r.map((c) => (c == null ? '' : String(c))).join('\t')).join('\n');
const book = workbook({ ws: { id: 'ws', name: 'P' }, snapshot: s, cycle, week, today });
const peopleRecs = () => records(tsvOf(book.find((t) => t.name === 'People')!.rows));

describe('people in the data tables', () => {
  it('loads the people sheet back unchanged as no changes', () => {
    const cs = planChanges(base('amara', { people: peopleRecs() }));
    expect(cs.issues).toEqual([]);
    expect(cs.items).toEqual([]);
  });
  it('lets an admin change a name, job title, team and admin, logged and saved together', () => {
    const recs = peopleRecs().map((r): Rec => (r.id === 'oskar' ? { ...r, name: 'Oskar Lindgren-Berg', 'job title': 'Staff engineer', team: 'Site Reliability Engineering', admin: 'yes' } : r));
    const cs = planChanges(base('amara', { people: recs }));
    expect(cs.issues).toEqual([]);
    expect(cs.counts.people).toBe(1);
    const after = applyCommit(s, cs.commit!);
    const oskar = after.people.find((p) => p.id === 'oskar')!;
    expect(oskar).toMatchObject({ name: 'Oskar Lindgren-Berg', role: 'Staff engineer', teamId: 'sre', admin: true });
    const ch = cs.commit!.changes.find((c) => c.entity === 'person')!;
    expect(ch.diffs.map((d) => d.field)).toEqual(['Name', 'Job title', 'Team', 'Admin', 'Via']);
    expect(ch.diffs.find((d) => d.field === 'Via')!.to).toBe('Data tables');
  });
  it('refuses a duplicate name, an unknown team, removing the last admin, and changes by non-admins', () => {
    const dup = planChanges(base('amara', { people: peopleRecs().map((r) => (r.id === 'oskar' ? { ...r, name: 'Rhea Kapoor' } : r)) }));
    expect(dup.issues[0]!.message).toMatch(/already here/);
    const team = planChanges(base('amara', { people: peopleRecs().map((r) => (r.id === 'oskar' ? { ...r, team: 'Nowhere' } : r)) }));
    expect(team.issues[0]!.message).toMatch(/no team called/);
    const noAdmins = planChanges(base('amara', { people: peopleRecs().map((r) => ({ ...r, admin: '' })) }));
    expect(noAdmins.issues.some((i) => /only admin stays one/.test(i.message))).toBe(true);
    const notAdmin = planChanges(base('rhea', { people: peopleRecs().map((r) => (r.id === 'oskar' ? { ...r, 'job title': 'x' } : r)) }));
    expect(notAdmin.issues[0]!.message).toMatch(/Only an admin/);
    expect(notAdmin.commit).toBeNull();
  });
});

describe('an admin correcting a past check-in in the data tables', () => {
  it('replaces that week’s check-in, logged with the old and new words, no reason asked', () => {
    const rows = book.find((t) => t.name === 'Check-ins')!.rows;
    const head = rows[0]!.map(String);
    const row = rows.filter((r) => r[head.indexOf('Goal ID')] === 'ns-ai' && Number(r[head.indexOf('Week')]) <= week - 3).at(-1)!;
    const rec: Rec = { __row: '2' };
    head.forEach((h, i) => { rec[h.toLowerCase()] = row[i] == null ? '' : String(row[i]); });
    rec.why = rec.why! + ' Checked with Lucía.';
    const cs = planChanges(base('amara', { checkIns: [rec] }));
    expect(cs.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(cs.counts.replaced).toBe(1);
    expect(cs.needsReason).toBe(false);
    const ch = cs.commit!.changes.find((c) => c.entity === 'check-in')!;
    expect(ch.diffs.some((d) => /Checked with Lucía/.test(d.to))).toBe(true);
    // The rules still apply: a number that makes the owner's call greener than the numbers needs that explained.
    const greener = planChanges(base('amara', { checkIns: [{ ...rec, value: '19' }] }));
    expect(greener.issues.some((i) => i.severity === 'error' && /Why greener/.test(i.message))).toBe(true);
  });
});

describe('every record keeps its own ID', () => {
  const rows = book.find((t) => t.name === 'Check-ins')!.rows;
  const head = rows[0]!.map(String);
  const recOf = (r: (string | number | null)[]): Rec => { const o: Rec = { __row: '2' }; head.forEach((h, i) => { o[h.toLowerCase()] = r[i] == null ? '' : String(r[i]); }); return o; };
  it('exports each check-in with its own ID first, as people have; goals and plans start with the goal’s key, then its ID', () => {
    expect(head[0]).toBe('ID');
    expect(book.find((x) => x.name === 'People')!.rows[0]![0]).toBe('ID');
    for (const t of ['Goals', 'Plan']) expect(book.find((x) => x.name === t)!.rows[0]!.slice(0, 2)).toEqual(['Key', 'ID']);
    expect(new Set(rows.slice(1).map((r) => r[0])).size).toBe(rows.length - 1);
  });
  it('corrects exactly the check-in its ID names, and refuses an unknown ID or a changed week', () => {
    const r = rows.filter((x) => x[head.indexOf('Goal ID')] === 'ns-lead' && Number(x[head.indexOf('Week')]) <= week - 2).at(-1)!;
    const rec = recOf(r);
    const ok = planChanges(base('amara', { checkIns: [{ ...rec, why: rec.why + ' (checked)' }] }));
    expect(ok.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(ok.commit!.checkIns![0]!.id).toBe(rec.id);
    const unknown = planChanges(base('amara', { checkIns: [{ ...rec, id: 'ci_nope' }] }));
    expect(unknown.issues[0]!.message).toMatch(/no check-in with ID ci_nope/);
    const moved = planChanges(base('amara', { checkIns: [{ ...rec, week: String(week - 1) }] }));
    expect(moved.issues[0]!.message).toMatch(/week can’t change/);
  });
});

describe('a filterable change log', () => {
  const ctx = { snapshot: s, cycle, week, watched: null };
  const run = (q: Partial<typeof EMPTY_ACTIVITY>) => s.changes.filter(activityFilter({ ...EMPTY_ACTIVITY, ...q }, ctx));
  it('keeps every setting in the link and reads it back', () => {
    const q = { ...EMPTY_ACTIVITY, q: 'vendor', who: ['rhea', 'tariq'], goal: 'ns-lead', tree: true, team: ['devex'], level: ['svp' as const], kind: ['checkins' as const, 'plans' as const], when: 'custom' as const, from: '2026-10-01', to: '2026-10-30' };
    expect(parseActivity(new URLSearchParams(activityEntries(q)))).toEqual(q);
  });
  it('filters by who, a goal’s whole tree, kind and words', () => {
    expect(run({ who: ['rhea'] }).every((c) => c.actorId === 'rhea')).toBe(true);
    const tree = treeOf('ns-lead', s);
    expect(tree.size).toBeGreaterThan(5);
    const inTree = run({ goal: 'ns-lead', tree: true });
    expect(inTree.length).toBeGreaterThan(run({ goal: 'ns-lead' }).length);
    expect(inTree.every((c) => c.goalId && tree.has(c.goalId))).toBe(true);
    expect(run({ kind: ['checkins'] }).every((c) => c.entity === 'check-in')).toBe(true);
    expect(run({ q: 'nothing-like-this-anywhere' })).toEqual([]);
  });
  it('sorts a plan or target change apart from other goal edits', () => {
    const mk = (field: string): Change => ({ id: 'x', at: '2026-10-30T09:00:00Z', actorId: 'tariq', goalId: 'ns-ai', entity: 'goal', entityId: 'ns-ai', action: 'edited', summary: 's', diffs: [{ field, from: '1', to: '2' }] });
    expect(kindOf(mk('Target'))).toBe('plans');
    expect(kindOf(mk('Owner'))).toBe('goals');
    expect(kindOf({ ...mk('Owner'), diffs: [{ field: 'Via', from: '—', to: 'AI assistant (MCP)' }] })).toBe('ai');
  });
  it('limits to this week, says so in words, and exports what it shows', () => {
    const thisWeek = run({ when: 'this-week' });
    expect(thisWeek.length).toBeLessThan(s.changes.length);
    expect(describeActivity({ ...EMPTY_ACTIVITY, when: 'this-week', who: ['rhea'] }, s, cycle, week).map((c) => c.text)[0]).toBe('By Rhea Kapoor');
    const rows = activityRows(thisWeek, s);
    expect(rows[0]).toEqual(['When', 'Who', 'What', 'Goal', 'Kind', 'Changes', 'Via']);
    expect(rows.length).toBe(thisWeek.length + 1);
  });
});
