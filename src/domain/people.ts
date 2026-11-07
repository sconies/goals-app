/* People: the rules for a person's record, shared by Workspace, the data tables and the bulk-change engine. */
import type { Change, Person } from './types';

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
  const dup = people.find((x) => x.id !== p.id && norm(x.name) === norm(p.name));
  if (p.name.trim() && dup) out.push(`${dup.name} is already here. Add a middle initial so people can tell you apart.`);
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
