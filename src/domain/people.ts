/* People: the rules for a person's record, shared by Workspace, the data tables and the bulk-change engine. */
import type { Change, Goal, Person } from './types';

const norm = (s: string) => s.trim().toLowerCase();

/** Emails are kept lower case and trimmed: the one form they are stored and compared in. */
export const normalEmail = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
/** The one check of what looks like an email. */
export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 254;

/** The person with this email, if anyone has it. */
export const personByEmail = (people: Person[], email: string) => { const e = normalEmail(email); return e ? people.find((p) => normalEmail(p.email) === e) : undefined; };

/**
 * What's wrong with saving `p` (empty if nothing): a name, a unique name, an email for anyone new (a real one, no one
 * else's), and always at least one admin. People added before emails existed may have none until an admin adds it.
 */
export function personProblems(p: Person, people: Person[], before: Person | null): string[] {
  const out: string[] = [];
  if (!p.name.trim()) out.push('Add a name.');
  // Two people can share a name in a company this size: the email is who someone is (backlog N), so a shared name is
  // noted (sameNameNote), never refused.
  const email = normalEmail(p.email);
  if (!email && !before) out.push('Add their email.');
  else if (!email && before?.email) out.push('Their email can be changed, not taken away.');
  else if (email && !isEmail(email)) out.push(`“${p.email}” doesn’t look like an email.`);
  else if (email) {
    const same = people.find((x) => x.id !== p.id && normalEmail(x.email) === email);
    if (same) out.push(`${same.name} already has the email ${email}.`);
  }
  if (before?.admin && !p.admin && people.filter((x) => x.admin && x.id !== p.id).length === 0) out.push('The only admin stays one: make someone else an admin first.');
  return out;
}

/** Someone else with this person's name, said beside the name field: allowed, and how they'll be told apart. */
export function sameNameNote(p: Pick<Person, 'id' | 'name'>, people: Person[], teamName: (id: string) => string): string | null {
  const twin = p.name.trim() ? people.find((x) => x.id !== p.id && norm(x.name) === norm(p.name)) : undefined;
  if (!twin) return null;
  const where = twin.teamId ? teamName(twin.teamId) : twin.role;
  return `${twin.name}${where ? ` (${where})` : ''} is already here. That’s fine: their email tells you apart, and Faro shows a team or job title beside the name.`;
}

/**
 * What tells a person apart from someone with the same name, shown beside the name wherever both could be on screen: their
 * team, else their job title, else their email. Null when no one else has the name.
 */
export function personTell(p: Person, people: Person[], teamName: (id: string) => string): string | null {
  const twins = people.filter((x) => x.id !== p.id && norm(x.name) === norm(p.name));
  if (!twins.length) return null;
  const team = p.teamId ? teamName(p.teamId) : '';
  if (team && twins.every((t) => t.teamId !== p.teamId)) return team;
  if (p.role && twins.every((t) => norm(t.role) !== norm(p.role))) return p.role;
  return p.email || team || p.role || null;
}

/** A person's name with what tells them apart, when someone else shares it: "Sam Lee (Payments)". */
export const nameWithTell = (p: Person, people: Person[], teamName: (id: string) => string) => {
  const t = personTell(p, people, teamName);
  return t ? `${p.name} (${t})` : p.name;
};

/** How many avatar colours there are. */
export const AVATAR_HUES = 6;
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
/**
 * Each person's avatar colour: from who they are (their ID), so two people with the same name differ; and among people with
 * the same initials, each takes a colour none of the others has, while there are colours to go round.
 */
export function avatarHues(people: Pick<Person, 'id' | 'initials'>[]): Map<string, number> {
  const out = new Map<string, number>();
  const groups = new Map<string, Pick<Person, 'id' | 'initials'>[]>();
  for (const p of people) { const k = norm(p.initials); groups.set(k, [...(groups.get(k) ?? []), p]); }
  for (const list of groups.values()) {
    const taken = new Set<number>();
    for (const p of [...list].sort((a, b) => a.id.localeCompare(b.id))) {
      let h = hash(p.id) % AVATAR_HUES;
      for (let k = 0; k < AVATAR_HUES && taken.has(h); k++) h = (h + 1) % AVATAR_HUES;
      taken.add(h);
      if (taken.size === AVATAR_HUES) taken.clear();
      out.set(p.id, h);
    }
  }
  return out;
}

/** Goal titles more than one goal has (compared without case or outer spaces): where a key or team goes beside the title. */
export function duplicateTitles(goals: Pick<Goal, 'title'>[]): Set<string> {
  const seen = new Set<string>(), twice = new Set<string>();
  for (const g of goals) { const k = norm(g.title); if (seen.has(k)) twice.add(k); seen.add(k); }
  return twice;
}
/** What goes beside a goal's title when another goal has the same one: its key, or else its team. */
export const goalTell = (g: Pick<Goal, 'title' | 'key' | 'teamId'>, dups: Set<string>, teamName: (id: string) => string): string | null =>
  dups.has(norm(g.title)) ? g.key || teamName(g.teamId) || null : null;

/** Every other goal with this title (compared without case or outer spaces): New goal names them as links (OB1). */
export function sameTitleGoals<G extends Pick<Goal, 'id' | 'title'>>(title: string, id: string | null, goals: G[]): G[] {
  return title.trim() ? goals.filter((g) => g.id !== id && norm(g.title) === norm(title)) : [];
}

/** The warning when a new goal's title is one another goal already has: allowed (two teams can both "Reduce latency"). */
export function sameTitleNote(title: string, id: string | null, goals: Pick<Goal, 'id' | 'title' | 'key' | 'teamId'>[], teamName: (id: string) => string): string | null {
  const twin = title.trim() ? goals.find((g) => g.id !== id && norm(g.title) === norm(title)) : undefined;
  if (!twin) return null;
  return `Another goal is called “${twin.title}” (${[twin.key, teamName(twin.teamId)].filter(Boolean).join(', ')}). That’s allowed; Faro shows each one’s key beside the title so people can tell them apart.`;
}

/** The change-log entry for adding or changing a person; null when nothing changed. */
export function personChange(before: Person | null, after: Person, teamName: (id: string) => string, actorId: string, at: string, id: string): Change | null {
  const diffs = before
    ? [
      ...(before.name !== after.name ? [{ field: 'Name', from: before.name, to: after.name }] : []),
      ...(normalEmail(before.email) !== normalEmail(after.email) ? [{ field: 'Email', from: before.email || '—', to: after.email || '—' }] : []),
      ...((before.role || '') !== (after.role || '') ? [{ field: 'Job title', from: before.role || '—', to: after.role || '—' }] : []),
      ...(before.teamId !== after.teamId ? [{ field: 'Team', from: teamName(before.teamId ?? '') || '—', to: teamName(after.teamId ?? '') || '—' }] : []),
      ...(before.admin !== after.admin ? [{ field: 'Admin', from: before.admin ? 'Yes' : 'No', to: after.admin ? 'Yes' : 'No' }] : []),
    ]
    : [{ field: 'Person', from: '—', to: after.name }, ...(after.email ? [{ field: 'Email', from: '—', to: after.email }] : [])];
  if (before && !diffs.length) return null;
  return { id, at, actorId, goalId: null, entity: 'person', entityId: after.id, action: before ? 'edited' : 'created', summary: before ? `Changed ${after.name}` : `Added ${after.name}`, diffs };
}

/**
 * Another team's name this one is probably a typo of (setup review, 8 Nov): the same but for case and spaces, or one
 * or two letters out (one for names under eight letters). Null when it's clearly its own team. The team it's closest
 * to, of those typed at least as often, wins; a name typed more often than any near one is taken as meant. `others` is
 * every team typed, this one included.
 */
export function closeTeam(name: string, others: string[]): string | null {
  const a = name.trim();
  if (a.length < 3) return null;
  const squash = (x: string) => x.toLowerCase().replace(/\s+/g, '');
  const far = (x: string, y: string) => {
    const row = Array.from({ length: y.length + 1 }, (_, j) => j);
    for (let i = 1; i <= x.length; i++) {
      let prev = row[0]!; row[0] = i;
      for (let j = 1; j <= y.length; j++) { const keep = row[j]!; row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1)); prev = keep; }
    }
    return row[y.length]!;
  };
  const count = (t: string) => others.filter((o) => o.trim() === t).length;
  const near = [...new Set(others.map((o) => o.trim()))].filter((o) => o && o !== a && count(o) >= count(a) && (squash(o) === squash(a) || far(squash(o), squash(a)) <= (Math.min(o.length, a.length) < 8 ? 1 : 2)));
  return near.sort((x, y) => count(y) - count(x) || far(squash(x), squash(a)) - far(squash(y), squash(a)))[0] ?? null;
}

/**
 * People already typed, then the uploaded ones who aren't among them: the same email, or the same name where either has
 * no email (two people can share a name; the email tells them apart, backlog N). Nothing typed is replaced or reordered,
 * and a typed row's empty fields take the upload's: set-up's upload once replaced everyone typed without a word (deep
 * review U5).
 */
export function mergePeople<P extends { name: string; email: string }>(typed: P[], incoming: P[]): P[] {
  const same = (a: P, b: P) => (a.email.trim() && b.email.trim() ? normalEmail(a.email) === normalEmail(b.email) : !!a.name.trim() && a.name.trim().toLowerCase() === b.name.trim().toLowerCase());
  const out = [...typed];
  for (const p of incoming) {
    const at = out.findIndex((x) => same(x, p));
    if (at < 0) { out.push(p); continue; }
    // Already typed: what the file knows fills only what was left empty (an email, a team), never what was typed.
    const x: P = { ...out[at]! };
    for (const k of Object.keys(p) as (keyof P)[]) if (typeof x[k] === 'string' && !(x[k] as string).trim() && typeof p[k] === 'string') x[k] = p[k];
    out[at] = x;
  }
  return out;
}

/**
 * The people a search finds, best first (the person search, deep review P2): a name or a team that starts with what was
 * typed, then one that contains it. Nothing is listed until something is typed, so a picker never shows everyone.
 */
export function findPeople(people: Person[], q: string, teamName: (id: string) => string, limit = 8): Person[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const text = (p: Person) => `${p.name} ${p.teamId ? teamName(p.teamId) : ''}`.toLowerCase();
  const starts = (p: Person) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(t)) || p.name.toLowerCase().startsWith(t);
  return people.filter((p) => !p.leftAt && text(p).includes(t)).sort((a, b) => Number(starts(b)) - Number(starts(a)) || a.name.localeCompare(b.name)).slice(0, limit);
}
