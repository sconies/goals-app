/**
 * The logical data model (backlog KT, gap 7): each record's key, what is
 * unique, and what it points to, stated as rules a rebuild holds in its own
 * schema. Faro's dump (`spec/core/schema.sql`) uses global text ids, has no
 * foreign key from its tables to the workspace and leaves some of these to the
 * app; this page is what to build instead. `wrongLogical` checks every field
 * named here against `src/domain/types.ts`, so a renamed field fails the spec.
 */
import { cell, table } from './md';

export interface LogicalRecord {
  /** The record's name in src/domain/types.ts (a goal's shared fields are GoalBase's). */
  record: string;
  /** What identifies it. */
  key: string[];
  /** Field sets that are unique, each within the scope given, with any condition. */
  unique: { fields: string[]; within: string; when?: string }[];
  /** The fields that point at another record, and which. */
  refs: { field: string; to: string }[];
  /** What else a rebuild must know about it, in words. */
  note?: string;
}

export const LOGICAL: LogicalRecord[] = [
  { record: 'Person', key: ['id'], unique: [{ fields: ['email'], within: 'the workspace', when: 'when it has one, among people not removed; kept lower case' }], refs: [{ field: 'teamId', to: 'Team' }],
    note: 'Two people may share a name: the email is who someone is (SAME-NAMES).' },
  { record: 'Team', key: ['id'], unique: [], refs: [{ field: 'leadId', to: 'Person' }] },
  { record: 'Cycle', key: ['id'], unique: [{ fields: ['startDate'], within: 'the workspace', when: 'among goal years not removed' }], refs: [] },
  { record: 'GoalBase', key: ['id'], unique: [{ fields: ['cycleId', 'key'], within: 'the workspace', when: 'and a key is never given twice in a workspace, even after its goal is removed' }],
    refs: [{ field: 'cycleId', to: 'Cycle' }, { field: 'ownerId', to: 'Person' }, { field: 'teamId', to: 'Team' }, { field: 'parentId', to: 'Goal (the one it feeds)' }],
    note: 'Two goals may share a title. The goals that feed one another never loop.' },
  { record: 'CheckIn', key: ['id'], unique: [], refs: [{ field: 'goalId', to: 'Goal' }, { field: 'authorId', to: 'Person' }],
    note: 'Not unique by goal and week: an owner may check in as often as they like, and the latest (by `postedAt`) is the week’s (ONE-PER-WEEK). A rebuild must not add that uniqueness.' },
  { record: 'Decision', key: ['id'], unique: [], refs: [{ field: 'goalId', to: 'Goal' }, { field: 'checkInId', to: 'CheckIn' }, { field: 'reviewId', to: 'Review' }, { field: 'byId', to: 'Person' }, { field: 'assigneeId', to: 'Person' }] },
  { record: 'Ask', key: ['id'], unique: [], refs: [{ field: 'goalIds', to: 'Goal (one or more)' }, { field: 'askedBy', to: 'Person' }, { field: 'recipientId', to: 'Person' }, { field: 'reviewId', to: 'Review' }, { field: 'checkInId', to: 'CheckIn' }] },
  { record: 'Review', key: ['id'], unique: [], refs: [{ field: 'createdBy', to: 'Person' }] },
  { record: 'Watch', key: ['id'], unique: [{ fields: ['personId', 'kind', 'ref'], within: 'the workspace' }], refs: [{ field: 'personId', to: 'Person' }, { field: 'ref', to: 'Goal, Goal (a tree) or a level, by `kind`' }] },
  { record: 'Comment', key: ['id'], unique: [], refs: [{ field: 'goalId', to: 'Goal' }, { field: 'authorId', to: 'Person' }],
    note: 'Faro stores a comment as a change-log entry; a rebuild gives comments a table of their own ([don’t copy this](../rebuild/dont-copy.md)).' },
  { record: 'Change', key: ['id'], unique: [], refs: [{ field: 'actorId', to: 'Person' }, { field: 'goalId', to: 'Goal' }], note: 'Never changed once written ([R8](../requirements/internal/r8-audit.md)).' },
  { record: 'Retro', key: ['id'], unique: [{ fields: ['goalId', 'cycleId'], within: 'the workspace' }], refs: [{ field: 'goalId', to: 'Goal' }, { field: 'cycleId', to: 'Cycle' }, { field: 'byId', to: 'Person' }] },
  { record: 'SavedView', key: ['id'], unique: [], refs: [{ field: 'personId', to: 'Person' }] },
  { record: 'ApiToken', key: ['id'], unique: [{ fields: ['tokenHash'], within: 'every workspace' }], refs: [{ field: 'personId', to: 'Person' }, { field: 'createdBy', to: 'Person' }] },
];

/** The scope rules: true of every record above. */
export const SCOPE_RULES = [
  '**Every record belongs to one workspace**, and a workspace is the unit of access ([R1](../requirements/internal/r1-sign-in-and-access.md)). Store the workspace on every row, and make it part of every key and every reference, so a reference to another workspace’s record can’t be stored. (Faro’s tables carry `workspace_id` but no foreign key to the workspace, and their references don’t include it.)',
  '**Ids are unique within their workspace.** Faro’s are global text ids made in the browser (`newId`); a rebuild’s server makes them, of whatever kind its platform uses.',
  '**References stay inside the workspace.** A goal’s owner, its team and the goal it feeds are all in its workspace.',
  '**Removing is marking.** A record with `removedAt` is kept for 30 days for undo and history (REMOVE-ANYTHING); uniqueness counts only records not removed, except a goal’s key, which is never given again.',
  '**Versions.** Goals and reviews carry a `version`; a save names the version it was based on and is refused if it has moved (NO-LOST-UPDATES). A refused save runs its action again on the latest, with the same input, and saves that, unless the input is a whole record as last seen (AX6). Other records are last write wins today: a rebuild extends versions to them and says how a clash is shown.',
];

export function logicalSection(): string[] {
  const fields = (fs: string[]) => fs.map((f) => `\`${f}\``).join(' + ');
  return ['## Keys, uniqueness and scope', '',
    'The logical model: what identifies each record, what must be unique, and what each points to, as rules a rebuild holds in its own schema. Build from this, not from [schema.sql](schema.sql), which is Faro’s Postgres dump for reading. The limits on single fields (a title of at least 3 characters, a review every 1 to 13 weeks) are on their rules’ pages, under “Limits the records hold”.', '',
    ...SCOPE_RULES.map((s) => `- ${s}`), '',
    table(['Record', 'Key', 'Unique', 'Points to', 'Also'], LOGICAL.map((r) => [
      r.record === 'GoalBase' ? 'Goal' : r.record,
      fields(r.key),
      r.unique.map((u) => `${fields(u.fields)} within ${u.within}${u.when ? `, ${u.when}` : ''}`).join('; ') || 'nothing beyond the key',
      r.refs.map((x) => `\`${x.field}\` → ${x.to}`).join(', ') || 'nothing',
      cell(r.note ?? ''),
    ])), ''];
}

/** Every field this page names that the record doesn't have (with its parents' fields). */
export function wrongLogical(decls: { name: string; extends: string[]; fields: { name: string }[] }[]): string[] {
  const all = (name: string): string[] => { const d = decls.find((x) => x.name === name); return d ? [...d.fields.map((f) => f.name), ...d.extends.flatMap(all)] : []; };
  const out: string[] = [];
  for (const r of LOGICAL) {
    if (!decls.some((d) => d.name === r.record)) { out.push(`${r.record}: no such record in src/domain/types.ts`); continue; }
    const have = all(r.record);
    for (const f of [...r.key, ...r.unique.flatMap((u) => u.fields), ...r.refs.map((x) => x.field)]) if (!have.includes(f)) out.push(`${r.record}.${f}: no such field`);
  }
  return out;
}
