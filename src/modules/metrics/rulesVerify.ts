/* MQ2's actions on a metric's quality: verify it (or record "Couldn't reproduce"), save baselines per slice, confirm a
   handed-over metric, confirm a rewording, and answer a failed attempt. Each is the one rule the screens, the import
   and the MCP tools call. As pure as src/domain: the clock and ids come in through the ActionContext, and a reading
   (for the stored figure) is passed in by whoever read it. */
import './qualityHooks';
import type { ActionContext } from '../../domain/actions';
import type { Commit } from '../../domain/commit';
import { canEditMetric, live, log, metricRows, no, type Metric } from './rules';
import { baselineProblems, differenceWords, mayConfirmReword, onDay, QUALITY_LIMITS, stageOf, storedFigure, whyCantVerify, withBaselines, type BaselineInput } from './rulesQuality';
import type { MetricVerification } from './types';

const nameOf = (x: ActionContext, id: string | null | undefined) => x.snapshot.people.find((p) => p.id === id)?.name ?? 'someone who has left';
const ownerHere = (x: ActionContext, m: Metric) => x.snapshot.people.some((p) => p.id === m.ownerId && !p.leftAt);
/** A metric's stage as the actions read it. */
export const stageNow = (x: Pick<ActionContext, 'snapshot' | 'now'>, m: Metric) =>
  stageOf(m, { now: x.now, ownerIsHere: x.snapshot.people.some((p) => p.id === m.ownerId && !p.leftAt), nameOf: (id) => x.snapshot.people.find((p) => p.id === id)?.name ?? id });
/** Who owns a metric's source, in words: the team's or person's name, else the text. */
export const sourceOwnerName = (s: Pick<ActionContext['snapshot'], 'people' | 'teams'>, m: Metric) =>
  (m.sourceOwnerId && (s.teams.find((t) => t.id === m.sourceOwnerId)?.name ?? s.people.find((p) => p.id === m.sourceOwnerId)?.name)) || m.sourceOwner || '';

export interface VerifyInput { period: string; figure: number; note: string; openedLink: boolean; outcome: 'verified' | 'couldnt_reproduce'; reading?: number | null }

/**
 * Verify a metric, or record that its figure couldn't be reproduced (MQ2). Who may is `whyCantVerify`'s. Both need "I
 * opened the link", the period and the figure got from it, and a note. Verified stores the record (re-verify in 12
 * months) and clears a lapse or a rewording to confirm; "Couldn't reproduce" keeps the attempt, the stage unchanged,
 * and puts it on the owner's "To sort out". Returns the commit and the comparison in words.
 */
export function verifyMetric(x: ActionContext, metricId: string, i: VerifyInput): { commit: Commit; metric: Metric; said: string } {
  const m = live(x, metricId);
  if (m.retiredAt) no(`“${m.name}” is retired. Bring it back before verifying it.`);
  const st = stageNow(x, m);
  const why = whyCantVerify(m, x.actor, { stage: st.stage, teams: x.snapshot.teams, sourceOwnerName: sourceOwnerName(x.snapshot, m) });
  if (why) no(why);
  if (i.outcome !== 'verified' && i.outcome !== 'couldnt_reproduce') no('The outcome is “verified” or “couldnt_reproduce”.');
  if (!i.openedLink) no('Open the source link first, and say so (opened_link): the figure must come from it.');
  const period = (i.period ?? '').trim();
  if (!period) no('Say the period the figure covers (“Aug–Oct 2026”).');
  if (period.length > QUALITY_LIMITS.period) no(`Keep the period to ${QUALITY_LIMITS.period} characters or fewer.`);
  if (typeof i.figure !== 'number' || !Number.isFinite(i.figure)) no('Give the figure you got from the link, as a number.');
  const note = (i.note ?? '').trim();
  if (!note) no(i.outcome === 'verified' ? 'Add a note: what you checked it against.' : 'Add a note: what differs, or what the definition doesn’t say.');
  if (note.length > QUALITY_LIMITS.note) no(`Keep the note to ${QUALITY_LIMITS.note.toLocaleString('en-GB')} characters or fewer.`);
  const stored = storedFigure(m, period, i.reading);
  const record: MetricVerification = { outcome: i.outcome, by: x.actor.id, at: x.now, period, figure: i.figure, stored: stored.value, storedFrom: stored.from, note };
  const diff = differenceWords(i.figure, stored.value, m.unit, m.decimals);
  const owner = nameOf(x, m.ownerId);
  let next: Metric;
  let said: string;
  if (i.outcome === 'verified') {
    const { lapse: _l, toConfirm: _t, ...rest } = m;
    next = { ...rest, verification: record, updatedAt: x.now };
    const due = new Date(x.now); due.setUTCMonth(due.getUTCMonth() + 12);
    said = `Verified “${m.name}” by ${nameOf(x, x.actor.id)}, ${onDay(x.now)}. ${diff} Due again ${onDay(due.toISOString())}. ${owner} was told.`;
  } else {
    next = { ...m, verifyAttempts: [...(m.verifyAttempts ?? []), record].slice(-QUALITY_LIMITS.attempts), updatedAt: x.now };
    said = `Couldn’t reproduce “${m.name}” for ${period}: ${diff} It stays ${st.stage === 'verified' ? 'Verified' : 'Defined'}; ${owner} was told.`;
  }
  const commit: Commit = { ...metricRows({ metrics: [next] }), changes: [log(x, { entityId: m.id, action: 'edited', summary: said, diffs: [{ field: i.outcome === 'verified' ? 'Verification' : 'Couldn’t reproduce', from: '—', to: `${i.figure} ${m.unit}, ${period}: ${note}` }] })] };
  return { commit, metric: next, said };
}

/**
 * Save baselines for one or many slices of a metric (MQ2): its owner or an admin. Each needs its value, the period it
 * covers, the day taken and how; a figure changed from the one read, or a new figure for a period already stored, needs
 * a reason. The old baseline of each slice moves to History. Never changes the stage.
 */
export function saveBaselines(x: ActionContext, metricId: string, entries: readonly BaselineInput[]): { commit: Commit; metric: Metric; said: string } {
  const m = live(x, metricId);
  if (!canEditMetric(x.actor, m)) no(`Only ${nameOf(x, m.ownerId)} or an admin can set this metric’s baselines.`);
  if (m.retiredAt) no(`“${m.name}” is retired. Bring it back before setting its baselines.`);
  if (!entries.length) no('Give at least one baseline.');
  const seen = new Set<string>();
  const problems: string[] = [];
  entries.forEach((b, i) => {
    const key = `${b.teamId ?? ''}|${(b.part ?? '').trim().toLowerCase()}`;
    if (seen.has(key)) problems.push(`Baseline ${i + 1}: that slice is given twice.`);
    seen.add(key);
    if (b.teamId != null && !x.snapshot.teams.some((t) => t.id === b.teamId)) problems.push(`Baseline ${i + 1}: there’s no team with that ID.`);
    for (const p of baselineProblems(b, m)) problems.push(entries.length > 1 ? `Baseline ${i + 1}: ${p}` : p);
  });
  if (problems.length) no(problems.join(' '));
  const next: Metric = { ...m, baselines: withBaselines(m, entries, { actor: x.actor.id, now: x.now, newId: x.newId }), updatedAt: x.now };
  const slice = (b: BaselineInput) => `${b.teamId == null ? 'the company' : x.snapshot.teams.find((t) => t.id === b.teamId)!.name}${b.part ? ` · ${b.part}` : ''}`;
  const said = entries.length === 1 ? `Set the baseline of “${m.name}” for ${slice(entries[0]!)}: ${entries[0]!.value} ${m.unit}, ${entries[0]!.period}` : `Set ${entries.length} baselines of “${m.name}”`;
  const commit: Commit = { ...metricRows({ metrics: [next] }), changes: [log(x, { entityId: m.id, action: 'edited', summary: said, diffs: entries.map((b) => ({ field: `Baseline, ${slice(b)}`, from: '—', to: `${b.value} ${m.unit}, ${b.period}, taken ${b.takenOn}: ${b.how}` })) })] };
  return { commit, metric: next, said };
}

/** The new owner of a handed-over metric confirms it (or an admin does): the handover leaves "To sort out". */
export function confirmOwner(x: ActionContext, metricId: string): Commit {
  const m = live(x, metricId);
  if (!m.handover) no(`“${m.name}” has no handover to confirm.`);
  if (m.ownerId !== x.actor.id && !x.actor.admin) no(`Only ${nameOf(x, m.ownerId)} (the new owner) or an admin can confirm it.`);
  const { handover: _h, ...rest } = m;
  return { ...metricRows({ metrics: [{ ...rest, updatedAt: x.now }] }), changes: [log(x, { entityId: m.id, action: 'edited', summary: `${nameOf(x, m.ownerId)} confirmed owning “${m.name}”`, diffs: [{ field: 'Owner', from: `${nameOf(x, m.ownerId)} (to confirm)`, to: nameOf(x, m.ownerId) }] })] };
}

/** The last verifier confirms a reworded filter or exclusion still means the same (or an admin does); Verified stands. */
export function confirmReword(x: ActionContext, metricId: string): Commit {
  const m = live(x, metricId);
  if (!m.toConfirm) no(`“${m.name}” has no rewording to confirm.`);
  // Whoever reworded it never confirms their own rewording, an admin included (#564 review, medium 1).
  if (!mayConfirmReword(m.toConfirm!, x.actor)) no(m.toConfirm!.by === x.actor.id
    ? `You reworded it, so someone else confirms it: ${nameOf(x, m.toConfirm!.verifier)} (who last verified it) or another admin.`
    : `Only ${nameOf(x, m.toConfirm!.verifier)} (who last verified it) or an admin can confirm the rewording.`);
  const { toConfirm: _t, ...rest } = m;
  return { ...metricRows({ metrics: [{ ...rest, updatedAt: x.now }] }), changes: [log(x, { entityId: m.id, action: 'edited', summary: `${nameOf(x, x.actor.id)} confirmed that the reworded ${m.toConfirm!.what.map((w) => w.replace(/^the\s+/i, '')).join(' and ')} of “${m.name}”: still Verified`, diffs: [] })] };
}

/** The owner (or an admin) answers the latest "Couldn't reproduce": it leaves "To sort out", kept on the page. */
export function answerAttempt(x: ActionContext, metricId: string, note: string): Commit {
  const m = live(x, metricId);
  if (!canEditMetric(x.actor, m)) no(`Only ${nameOf(x, m.ownerId)} or an admin can answer it.`);
  const i = (m.verifyAttempts ?? []).map((a) => !a.answered).lastIndexOf(true);
  if (i < 0) no(`“${m.name}” has no failed verification to answer.`);
  const text = (note ?? '').trim();
  if (!text) no('Say what you changed, or why the figures differ.');
  if (text.length > QUALITY_LIMITS.note) no(`Keep the answer to ${QUALITY_LIMITS.note.toLocaleString('en-GB')} characters or fewer.`);
  const attempts = (m.verifyAttempts ?? []).map((a, k) => (k === i ? { ...a, answered: { by: x.actor.id, at: x.now, note: text } } : a));
  return { ...metricRows({ metrics: [{ ...m, verifyAttempts: attempts, updatedAt: x.now }] }), changes: [log(x, { entityId: m.id, action: 'edited', summary: `Answered ${nameOf(x, attempts[i]!.by)}’s “Couldn’t reproduce” on “${m.name}”`, diffs: [{ field: 'Answer', from: '—', to: text }] })] };
}

export { ownerHere };
