/* The change log: what changed, field by field, in words a reader understands. */
import { causeLabel } from './checkin';
import { fmt, kindLabel, LEVEL_LABEL } from './format';
import { LABEL, assessMilestone } from './status';
import type { Change, CheckIn, Diff, Goal, Person } from './types';

export interface Lookup {
  person(id: string): Person | undefined;
  goal(id: string): Goal | undefined;
  teamName(id: string): string;
}

const shapeName = { straight: 'Straight line', back: 'Back-loaded', stepped: 'Three steps' } as const;

function goalFields(g: Goal, l: Lookup): Record<string, string> {
  const f: Record<string, string> = {
    Name: g.title,
    Type: kindLabel(g),
    Team: l.teamName(g.teamId),
    Owner: l.person(g.ownerId)?.name ?? g.ownerId,
    'Feeds into': g.parentId ? l.goal(g.parentId)?.title ?? '—' : 'Nothing',
    'Why it helps': g.parentId ? g.whyHelps || '—' : '—',
    'Also helps': g.alsoHelps?.length ? g.alsoHelps.map((id) => l.goal(id)?.title ?? id).join(', ') : '—',
    Level: LEVEL_LABEL[g.level],
    Role: g.io === 'input' ? 'Input' : 'Output',
    Guardrail: g.guardrail ? 'Yes' : 'No',
    'Estimated effect': g.effect == null ? '—' : String(g.effect),
    'Data source': g.source || '—',
    Definition: g.definition || '—',
  };
  // Every field a form or a spreadsheet can change has a line here, so no change goes unlogged (or unapplied).
  if (g.kind !== 'milestone') {
    f.Unit = g.unit || '—';
    f.Decimals = String(g.decimals);
  }
  if (g.kind === 'metric') {
    f.Start = fmt(g.plan.start, g);
    f.Target = fmt(g.plan.target, g);
    f['Plan shape'] = shapeName[g.plan.shape];
    f['Plan from week'] = g.plan.fromWeek ? `Week ${g.plan.fromWeek}` : '—';
    f['Target due'] = g.plan.endWeek ? `Week ${g.plan.endWeek}` : '—';
    f['Plan numbers'] = g.plan.points?.length ? g.plan.points.map((p) => `wk ${p.week}: ${fmt(p.value, g)}`).join(', ') : '—';
  }
  if (g.kind === 'range') {
    f.Limit = (g.range.bound === 'atMost' ? 'At most ' : 'At least ') + fmt(g.range.limit, g);
    f['Warning margin'] = fmt(g.range.margin, g);
  }
  if (g.kind === 'milestone') f.Stages = g.stages.map((s) => `${s.name} (wk ${s.dueWeek})`).join(', ') || '—';
  return f;
}

function checkInFields(c: CheckIn, g: Goal): Record<string, string> {
  const f: Record<string, string> = { 'Status call': LABEL[c.status] };
  if (g.kind !== 'milestone') f.Value = c.value == null ? '—' : fmt(c.value, g);
  if (g.kind === 'milestone' && c.stages) {
    const a = assessMilestone(g, c.week, c.stages);
    f.Stages = a.stages.map((s) => `${s.name}: ${s.kind === 'done' ? 'done wk ' + s.doneWeek : s.weeksLate > 0 ? 'expected wk ' + s.expectedWeek : 'on schedule'}`).join('; ');
  }
  f.Cause = c.cause ? causeLabel(c.cause) : '—';
  f.Note = c.why || '—';
  f['Why greener'] = c.greenerWhy || '—';
  f['Path to green'] = c.pathToGreen ? `${c.pathToGreen.what} (${c.pathToGreen.byWeek != null ? `by week ${c.pathToGreen.byWeek}` : RECOVERY_LABEL[c.pathToGreen.state ?? 'plan'].toLowerCase()})` : '—';
  f['Needs'] = c.pathToGreen?.needs || '—';
  f['Proposed target'] = c.proposeTarget == null || g.kind === 'milestone' ? '—' : fmt(c.proposeTarget, g);
  f['Next step'] = c.next || '—';
  return f;
}

const RECOVERY_LABEL = { plan: 'Plan', investigating: 'Still investigating', help: 'Needs a decision or help', target: 'Target should change' } as const;

export function diffFields(before: Record<string, string> | null, after: Record<string, string>): Diff[] {
  return Object.keys(after)
    .filter((k) => !before || before[k] !== after[k])
    .filter((k) => before || after[k] !== '—')
    .map((k) => ({ field: k, from: before ? before[k] ?? '—' : '—', to: after[k]! }));
}

const list = (d: Diff[]) => {
  const names = d.map((x) => x.field.toLowerCase());
  return names.length <= 3 ? names.join(', ') : names.slice(0, 2).join(', ') + ` and ${names.length - 2} more`;
};

/** The change record for saving a goal, or null when nothing changed. */
export function goalChange(before: Goal | null, after: Goal, l: Lookup, actorId: string, at: string, id: string): Change | null {
  const diffs = diffFields(before ? goalFields(before, l) : null, goalFields(after, l));
  if (before && !diffs.length) return null;
  return {
    id, at, actorId, goalId: after.id, entity: 'goal', entityId: after.id,
    action: before ? 'edited' : 'created',
    summary: before ? `Changed ${list(diffs)}` : `Created the goal “${after.title}”`,
    diffs,
  };
}

/** The change record for posting or editing a check-in, or null when nothing changed. */
export function checkInChange(before: CheckIn | null, after: CheckIn, g: Goal, actorId: string, id: string): Change | null {
  const diffs = diffFields(before ? checkInFields(before, g) : null, checkInFields(after, g));
  if (before && !diffs.length) return null;
  const headline = g.kind === 'milestone' ? LABEL[after.status] : `${after.value == null ? '—' : fmt(after.value, g)} · ${LABEL[after.status]}`;
  return {
    id, at: after.postedAt, actorId, goalId: g.id, entity: 'check-in', entityId: after.id,
    action: before ? 'edited' : 'posted',
    summary: before ? `Posted an update for week ${after.week}: ${headline}` : `Checked in for week ${after.week}: ${headline}`,
    diffs,
  };
}
