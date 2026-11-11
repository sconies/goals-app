/* The directory (app redesign WR1): docs/design/workspace/spec.md rules 4, 5 and 8, each worked example a case, read
   against the demo workspace (Platform Engineering, 97 people in 14 teams) as it stands on Wednesday 11 November. */
import { buildPlatformOrg } from '../data/platformOrg/generate';
import { scopeToCycle } from './cycle';
import { movedTo, personLine, teamSummary } from './directory';
import { search, textMatches, type PersonRows, type TeamRows } from './find';
import { goalStatus } from './status';
import type { Person, Snapshot } from './types';

const NOW = new Date('2026-11-11T12:00:00Z');
const full = buildPlatformOrg(NOW);
const s: Snapshot = scopeToCycle(full, full.cycles[0]!);
const names = (xs: { name: string }[]) => xs.map((p) => p.name);
// People and Teams ask the one search (find.ts rule 7) through the Search port; these are its rows over the workspace.
const personRows = (people: Person[], teams = s.teams): PersonRows => ({ kind: 'person', people, teamName: (id) => teams.find((t) => t.id === id)?.name ?? '', teamLead: (id) => teams.find((t) => t.id === id)?.leadId ?? null });
const teamRows: TeamRows = { kind: 'team', teams: s.teams, people: s.people };
/** People's ask, as its address has it: `q`, `teamId` (or `-`), `admins`, `page` from 1, 50 a page. */
const askOf = (people: Person[], teams: Snapshot['teams'], a: { q?: string; teamId?: string; admins?: boolean; page?: number } = {}) => {
  const filters = { ...(a.teamId ? { team: a.teamId } : {}), ...(a.admins ? { admins: '1' } : {}) };
  const first = search(personRows(people, teams), { q: a.q ?? '', filters, size: 50 });
  const pages = Math.max(1, Math.ceil(first.total / 50));
  const page = Math.min(Math.max(1, Math.floor(a.page ?? 1) || 1), pages);
  const r = search(personRows(people, teams), { q: a.q ?? '', filters, size: 50, after: String((page - 1) * 50) });
  return { total: r.total, page, pages, from: r.rows.length ? (page - 1) * 50 + 1 : 0, to: (page - 1) * 50 + r.rows.length, rows: r.rows };
};
const ask = (a: Parameters<typeof askOf>[2] = {}) => askOf(s.people, s.teams, a);
const findTeams = (q = '') => search(teamRows, { q, size: 200 }).rows;
const ctx = { snapshot: s, statusOf: (g: Snapshot['goals'][number]) => goalStatus(g, s.cycles[0]!, s.checkIns, NOW).status };

describe('the directory’s order and search (rule 4)', () => {
  it('lists everyone, A to Z, 50 a page', () => {
    const r = ask({});
    expect(r).toMatchObject({ total: 97, page: 1, pages: 2, from: 1, to: 50 });
    expect(r.rows[0]!.name).toBe('Adaeze Obi');
    expect(names(r.rows)).toEqual([...names(r.rows)].sort((a, b) => a.localeCompare(b, 'en-GB', { sensitivity: 'base' })));
  });
  it('turns pages, and a page past the end is the last page', () => {
    expect(ask({ page: 2 })).toMatchObject({ from: 51, to: 97 });
    expect(ask({ page: 9 })).toMatchObject({ page: 2, from: 51, to: 97 });
    expect(ask({ page: 0 })).toMatchObject({ page: 1, from: 1 });
  });
  it('finds by the start of a word of the name, ignoring case and accents', () => {
    expect(names(ask({ q: 'rhea' }).rows)).toEqual(['Rhea Kapoor']);
    expect(names(ask({ q: 'romero' }).rows)).toEqual(names(ask({ q: 'Romero' }).rows));
    expect(names(ask({ q: 'lucia' }).rows)).toEqual(['Lucía Romero']);
    expect(names(ask({ q: 'kap' }).rows)).toEqual(['Rhea Kapoor']);
  });
  it('finds by job title, every word typed starting a word', () => {
    const r = ask({ q: 'eng man' }).rows;
    expect(r.length).toBeGreaterThan(5);
    const managers = s.people.filter((p) => p.role.startsWith('Engineering Manager'));
    expect(managers.length).toBeGreaterThan(5);
    for (const m of managers) expect(names(r)).toContain(m.name);
    expect(names(r)).not.toContain('Oskar Lindgren');
  });
  it('finds a team’s people by the team’s name, and anyone with it in their job title, once each', () => {
    const r = ask({ q: 'ci/cd' }).rows;
    const cicd = s.people.filter((p) => p.teamId === 'cicd' || /CI\/CD/.test(p.role));
    expect(new Set(r.map((p) => p.id))).toEqual(new Set(cicd.map((p) => p.id)));
    expect(r.length).toBe(new Set(r.map((p) => p.id)).size);
  });
  it('filters by team (its lead counts), by no team, and by admins', () => {
    const cicd = ask({ teamId: 'cicd' });
    expect(cicd.total).toBe(7);
    expect(names(cicd.rows)).toContain('Rhea Kapoor');
    expect(ask({ teamId: '-' }).total).toBe(0);
    expect(names(ask({ admins: true }).rows)).toEqual(['Amara Nwosu', 'Grace Achterberg', 'Hamid Rezaei']);
  });
  it('never lists anyone marked as left', () => {
    const left = s.people.map((p) => (p.id === 'oskar' ? { ...p, leftAt: '2026-11-01T00:00:00Z' } : p));
    expect(names(askOf(left, s.teams, { q: 'oskar' }).rows)).toEqual([]);
    expect(askOf(left, s.teams).total).toBe(96);
  });
  it('keeps two people with one name in a stable order, by email', () => {
    const twins: Person[] = [
      { id: 'b', name: 'Sam Lee', role: '', initials: 'SL', teamId: null, admin: false, email: 'sam.b@x.com' },
      { id: 'a', name: 'Sam Lee', role: '', initials: 'SL', teamId: null, admin: false, email: 'sam.a@x.com' },
    ];
    expect(askOf(twins, []).rows.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('matches words, not the middle of one', () => {
    expect(textMatches('Engineering Manager', 'man')).toBe(true);
    expect(textMatches('Engineering Manager', 'ager')).toBe(false);
    expect(textMatches('Cloud Cost (FinOps)', 'finops')).toBe(true);
    expect(textMatches('anything', '')).toBe(true);
  });
  it('puts those whose name the search starts first, then A to Z: one order for People and every person picker', () => {
    const r = names(ask({ q: 'ci' }).rows);
    const byName = r.filter((n) => textMatches(n, 'ci'));
    expect(r.slice(0, byName.length)).toEqual(byName);
  });
});

describe('teams (rule 4)', () => {
  it('lists the teams A to Z, found by name or by lead', () => {
    const all = findTeams();
    expect(all).toHaveLength(14);
    expect(all[0]!.name).toBe('Build & Release');
    expect(names(findTeams('rhea'))).toEqual(['CI/CD']);
    expect(names(findTeams('sec'))).toEqual(['Security Engineering']);
    expect(findTeams('nothing like it')).toEqual([]);
  });
});

describe('a person’s line and a team’s summary (rule 5)', () => {
  it('says admin, what they lead and how many goals', () => {
    expect(personLine(ctx, 'amara')).toBe('Admin · leads the team · no goals');
    expect(personLine(ctx, 'rhea')).toBe('Leads the team · 8 goals');
    expect(personLine(ctx, 'oskar')).toBe('No goals');
    expect(personLine(ctx, 'hamid')).toBe('Admin · 1 goal');
  });
  it('says which other team someone leads, or how many', () => {
    const one = { ...s, teams: s.teams.map((t) => (t.id === 'cicd' ? { ...t, leadId: 'oskar' } : t)) };
    expect(personLine({ snapshot: one }, 'oskar')).toBe('Leads CI/CD · no goals');
    const two = { ...s, teams: s.teams.map((t) => (t.id === 'cicd' || t.name === 'Observability' ? { ...t, leadId: 'oskar' } : t)) };
    expect(personLine({ snapshot: two }, 'oskar')).toBe('Leads 2 teams · no goals');
  });
  it('counts a team’s people, its lead among them, and its goals by status as Goals’ By team does', () => {
    const t = teamSummary(ctx, 'cicd');
    expect(t.lead?.name).toBe('Rhea Kapoor');
    expect(t.people).toHaveLength(7);
    expect(t.goals).toHaveLength(17);
    expect(t.byStatus.reduce((n, c) => n + c.n, 0)).toBe(17);
    const byTeam = s.goals.filter((g) => g.teamId === 'cicd').map(ctx.statusOf);
    for (const c of t.byStatus) expect(byTeam.filter((k) => k === c.status)).toHaveLength(c.n);
  });
  it('a team with no goals has no counts; a lead from another team is one of its people', () => {
    const empty = { ...ctx, snapshot: { ...s, teams: [...s.teams, { id: 'new', name: 'New team', leadId: 'oskar', objective: '' }] } };
    const t = teamSummary(empty, 'new');
    expect(t.goals).toHaveLength(0);
    expect(t.byStatus).toEqual([]);
    expect(t.people.map((p) => p.id)).toEqual(['oskar']);
  });
});

describe('old addresses (rule 8)', () => {
  it.each([
    ['/workspace/people', '', '', '/people'],
    ['/workspace/people', '?team=cicd', '', '/teams/cicd'],
    ['/workspace/people', '?team=-', '', '/people?team=-'],
    ['/workspace/people', '?today=2026-11-11', '', '/people?today=2026-11-11'],
    ['/workspace/people', '?team=cicd&today=2026-11-11', '', '/teams/cicd?today=2026-11-11'],
    ['/workspace/teams', '', '', '/teams'],
    ['/workspace/overview', '?today=2026-11-11', '', '/workspace?today=2026-11-11'],
    ['/workspace', '', '#people', '/people'],
    ['/workspace', '', '#teams', '/teams'],
    ['/workspace', '', '#cycles', null],
    ['/workspace', '', '', null],
    ['/workspace/cycles', '', '', null],
    ['/people', '', '', null],
  ])('%s%s%s leads to %s', (path, search, hash, to) => {
    expect(movedTo(path, search, hash)).toBe(to);
  });
});
