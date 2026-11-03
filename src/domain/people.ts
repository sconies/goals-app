/* People: the rules for a person's record, shared by Workspace, the data tables and the bulk-change engine. */
import type { Change, Person } from './types';

const norm = (s: string) => s.trim().toLowerCase();

/** What's wrong with saving `p` (empty if nothing): a name, a unique name, and always at least one admin. */
export function personProblems(p: Person, people: Person[], before: Person | null): string[] {
  const out: string[] = [];
  if (!p.name.trim()) out.push('Add a name.');
  const dup = people.find((x) => x.id !== p.id && norm(x.name) === norm(p.name));
  if (p.name.trim() && dup) out.push(`${dup.name} is already here. Add a middle initial so people can tell you apart.`);
  if (before?.admin && !p.admin && people.filter((x) => x.admin && x.id !== p.id).length === 0) out.push('The only admin stays one: make someone else an admin first.');
  return out;
}

/** The change-log entry for adding or changing a person; null when nothing changed. */
export function personChange(before: Person | null, after: Person, teamName: (id: string) => string, actorId: string, at: string, id: string): Change | null {
  const diffs = before
    ? [
      ...(before.name !== after.name ? [{ field: 'Name', from: before.name, to: after.name }] : []),
      ...((before.role || '') !== (after.role || '') ? [{ field: 'Job title', from: before.role || '—', to: after.role || '—' }] : []),
      ...(before.teamId !== after.teamId ? [{ field: 'Team', from: teamName(before.teamId ?? '') || '—', to: teamName(after.teamId ?? '') || '—' }] : []),
      ...(before.admin !== after.admin ? [{ field: 'Admin', from: before.admin ? 'Yes' : 'No', to: after.admin ? 'Yes' : 'No' }] : []),
    ]
    : [{ field: 'Person', from: '—', to: after.name }];
  if (before && !diffs.length) return null;
  return { id, at, actorId, goalId: null, entity: 'person', entityId: after.id, action: before ? 'edited' : 'created', summary: before ? `Changed ${after.name}` : `Added ${after.name}`, diffs };
}
