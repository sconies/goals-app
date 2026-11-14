/* One input per action, for working out what each reads (src/spec/reads.ts, spec/rebuild/reads.md): run against the
   demo workspace (src/data/platformOrg) as the person named, picked from its records so they stay valid as the demo
   changes. src/spec/reads.test.ts fails when an action has no sample, so a new action comes with one. */
import type { RunContext } from '../app/actions';
import type { Snapshot } from '../domain/types';
import { emptyDraft } from '../domain/checkin';
import { draftOf } from '../domain/goal';
import { checkInsFor } from '../domain/status';
import { deleteComment } from '../domain/removal';

/** A sample: who acts, and the input, made from the context. */
export interface Sample { as: string | ((s: Snapshot) => string); input: (x: RunContext) => unknown }

const own = (x: RunContext) => x.snapshot.goals.find((g) => g.ownerId === x.actor.id && g.kind === 'metric') ?? x.snapshot.goals.find((g) => g.ownerId === x.actor.id)!;
const other = (x: RunContext) => x.snapshot.goals.find((g) => g.ownerId !== x.actor.id)!;
const asks = (x: RunContext) => x.snapshot.requests ?? [];
const openAsk = (x: RunContext, kind: string) => asks(x).find((a) => a.kind === kind && a.status === 'open')!;
const notes = (x: RunContext) => x.snapshot.changes.filter((c) => c.entity === 'note' && c.actorId === x.actor.id);
const review = (x: RunContext) => x.snapshot.reviews[0]!;
const person = (x: RunContext) => x.snapshot.people.find((p) => !p.admin && p.id !== x.actor.id && x.snapshot.goals.some((g) => g.ownerId === p.id))!;
const ADMIN = 'amara';
/** A milestone goal with stages and no check-ins yet, else any with stages: whose stages are recorded done directly. */
const stagesGoal = (s: Snapshot) => s.goals.find((m) => m.kind === 'milestone' && m.stages.length && !s.checkIns.some((c) => c.goalId === m.id)) ?? s.goals.find((m) => m.kind === 'milestone' && m.stages.length)!;

export const SAMPLES: Record<string, Sample> = {
  planChanges: { as: 'rhea', input: (x) => { const g = own(x); return { tables: { goals: [{ __row: '2', id: g.id, goal: `${g.title}, renamed` }] }, via: 'bulk' }; } },
  postCheckIn: { as: 'rhea', input: (x) => { const g = own(x); const last = checkInsFor(g, x.snapshot.checkIns).at(-1) ?? null; return { goalId: g.id, draft: { ...emptyDraft(g, last), value: g.kind === 'metric' ? String((last?.value ?? 1) + 1) : '', status: 'off', cause: 'slower', why: 'The rollout paused this week', ptgWhat: 'Restart the rollout', ptgBy: x.week + 2, ptgState: 'plan' }, mode: 'again', week: x.week }; } },
  saveGoal: { as: 'rhea', input: (x) => { const g = own(x); return { goalId: g.id, draft: { ...draftOf(g), title: `${g.title}, renamed` }, confirm: true, reason: 'Clearer name' }; } },
  activate: { as: ADMIN, input: (x) => ({ goalId: (x.snapshot.proposed ?? [])[0]?.id ?? other(x).id }) },
  backToProposed: { as: ADMIN, input: (x) => ({ goalId: (x.snapshot.goals.find((g) => !x.snapshot.checkIns.some((c) => c.goalId === g.id && !c.removedAt)) ?? other(x)).id }) },
  stopGoal: { as: 'rhea', input: (x) => ({ goalId: own(x).id, reason: 'No longer needed' }) },
  deleteGoal: { as: ADMIN, input: (x) => ({ goalId: x.snapshot.goals.at(-1)!.id }) },
  deleteCheckIn: { as: 'rhea', input: (x) => ({ checkInId: checkInsFor(own(x), x.snapshot.checkIns).at(-1)!.id }) },
  saveRetro: { as: 'rhea', input: (x) => ({ goalId: own(x).id, result: 'Met', learned: 'Smaller steps', next: 'Keep going' }) },
  recordStagesDone: { as: (s) => stagesGoal(s).ownerId, input: (x) => { const g = stagesGoal(x.snapshot); return { goalId: g.id, stageIds: [g.kind === 'milestone' ? g.stages[0]!.id : ''] }; } },
  undoImport: { as: ADMIN, input: (x) => ({ importId: x.snapshot.changes.find((c) => (c as { importId?: string }).importId)?.['importId' as never] ?? 'imp_none' }) },
  addNote: { as: 'rhea', input: (x) => ({ goalId: other(x).id, text: 'Looks good' }) },
  addAction: { as: ADMIN, input: (x) => { const g = other(x); return { goalId: g.id, text: 'Restart the rollout', assigneeId: g.ownerId, dueWeek: x.week + 2 }; } },
  editComment: { as: ADMIN, input: (x) => ({ commentId: notes(x)[0]?.entityId ?? 'note_none', text: 'Edited' }) },
  deleteComment: { as: ADMIN, input: (x) => ({ commentId: notes(x)[0]?.entityId ?? 'note_none' }) },
  askForUpdate: { as: ADMIN, input: (x) => ({ goalId: x.snapshot.goals.find((g) => g.ownerId !== ADMIN && !asks(x).some((a) => a.kind === 'update' && a.status === 'open' && a.goalIds.includes(g.id)))!.id }) },
  askQuestion: { as: ADMIN, input: (x) => ({ goalId: other(x).id, text: 'What would bring it forward?' }) },
  undoUpdateAsk: { as: ADMIN, input: (x) => ({ goalId: (openAsk(x, 'update') ?? asks(x)[0]!).goalIds[0]! }) },
  answerRequest: { as: ADMIN, input: (x) => ({ askId: (asks(x).find((a) => a.status === 'open' && a.recipientId === ADMIN) ?? asks(x)[0]!).id, answer: 'Yes, go ahead' }) },
  markActionDone: { as: ADMIN, input: (x) => ({ askId: (openAsk(x, 'action') ?? asks(x)[0]!).id, note: 'Done' }) },
  linkRequest: { as: ADMIN, input: (x) => { const a = asks(x).find((r) => r.status === 'open' && r.kind === 'decision') ?? asks(x)[0]!; return { askId: a.id, goalId: x.snapshot.goals.find((g) => !a.goalIds.includes(g.id))!.id }; } },
  withdrawRequest: { as: ADMIN, input: (x) => ({ askId: (asks(x).find((a) => a.status === 'open') ?? asks(x)[0]!).id }) },
  saveReview: { as: ADMIN, input: (x) => ({ review: { ...review(x), name: `${review(x).name}, renamed` } }) },
  reviewCall: { as: ADMIN, input: (x) => ({ goalId: other(x).id, reviewId: review(x).id, kind: 'note', note: 'Talked it through', week: x.week }) },
  acceptRisk: { as: ADMIN, input: (x) => ({ goalId: other(x).id, reviewId: review(x).id, reason: 'Worth the risk this quarter', week: x.week }) },
  markReviewed: { as: ADMIN, input: (x) => ({ goalIds: [other(x).id], reviewId: review(x).id, week: x.week }) },
  editCall: { as: ADMIN, input: (x) => ({ callId: (x.snapshot.decisions.find((d) => d.byId === ADMIN && d.kind === 'note') ?? x.snapshot.decisions[0]!).id, note: 'Edited' }) },
  // A comment the admin wrote, removed, then its Undo: the removal as saved and the workspace before it.
  undoRemoval: { as: ADMIN, input: (x) => ({ removal: deleteComment(x, notes(x)[0]?.entityId ?? 'note_none'), before: x.full ?? x.snapshot }) },
  unmarkReviewed: { as: ADMIN, input: (x) => ({ decisionIds: [(x.snapshot.decisions.find((d) => d.byId === ADMIN && d.kind === 'acknowledge') ?? x.snapshot.decisions[0]!).id] }) },
  deleteNote: { as: ADMIN, input: (x) => ({ noteId: (x.snapshot.decisions.find((d) => d.byId === ADMIN && d.kind === 'note') ?? x.snapshot.decisions[0]!).id }) },
  endReview: { as: ADMIN, input: (x) => ({ reviewId: review(x).id }) },
  deleteReview: { as: ADMIN, input: (x) => ({ reviewId: review(x).id }) },
  watch: { as: 'rhea', input: (x) => ({ kind: 'goal', ref: x.snapshot.goals.find((g) => !x.snapshot.watches.some((w) => w.personId === 'rhea' && w.ref === g.id))!.id }) },
  unwatch: { as: ADMIN, input: (x) => ({ watchId: x.snapshot.watches.find((w) => w.personId === ADMIN)!.id }) },
  saveView: { as: 'rhea', input: () => ({ name: 'My off track', params: 'status=off' }) },
  saveTableView: { as: 'rhea', input: () => ({ name: 'My table', layout: { table: 'goals', cols: null, widths: {}, q: '', filters: [], sort: null } }) },
  deleteView: { as: ADMIN, input: (x) => ({ viewId: (x.snapshot.views ?? [])[0]?.id ?? 'view_none' }) },
  pinView: { as: ADMIN, input: (x) => ({ viewId: (x.snapshot.views ?? [])[0]?.id ?? 'view_none', pinned: true }) },
  savePerson: { as: ADMIN, input: (x) => ({ person: { ...person(x), name: `${person(x).name} Jr` } }) },
  markPersonLeft: { as: ADMIN, input: (x) => ({ personId: person(x).id, goalsTo: ADMIN, asksTo: ADMIN }) },
  deletePerson: { as: ADMIN, input: (x) => ({ personId: x.snapshot.people.find((p) => !x.snapshot.goals.some((g) => g.ownerId === p.id) && p.id !== ADMIN)?.id ?? person(x).id }) },
  arrive: { as: 'rhea', input: () => ({}) },
  leaveWorkspace: { as: 'rhea', input: () => ({ goalsTo: ADMIN, asksTo: ADMIN }) },
  saveTeam: { as: ADMIN, input: (x) => ({ id: x.snapshot.teams[1]!.id, name: `${x.snapshot.teams[1]!.name}, renamed`, leadId: x.snapshot.teams[1]!.leadId }) },
  removeTeam: { as: ADMIN, input: (x) => ({ teamId: x.snapshot.teams.at(-1)!.id, moveTo: x.snapshot.teams[0]!.id }) },
  startNextCycle: { as: ADMIN, input: () => ({}) },
  deleteCycle: { as: ADMIN, input: (x) => ({ cycleId: (x.full ?? x.snapshot).cycles[0]!.id }) },
  undoStart: { as: ADMIN, input: (x) => ({ cycleId: (x.full ?? x.snapshot).cycles.at(-1)!.id }) },
  renameWorkspace: { as: ADMIN, input: () => ({ name: 'Platform, renamed' }) },
  setRecording: { as: ADMIN, input: () => ({ on: false }) },
  setModule: { as: ADMIN, input: () => ({ moduleId: 'metrics', on: false }) },
  restoreRemoved: { as: ADMIN, input: () => ({ kind: 'goal', id: 'goal_none' }) },
  createToken: { as: ADMIN, input: () => ({ personId: ADMIN, name: 'Assistant' }) },
  revokeToken: { as: ADMIN, input: (x) => ({ tokenId: (x.snapshot.tokens ?? [])[0]?.id ?? 'token_none' }) },
  sendFeedback: { as: 'rhea', input: () => ({ mood: 'good', text: 'Clear', path: '/home' }) },
  saveMetric: { as: ADMIN, input: () => ({ name: 'Build time', unit: 'min', direction: 'lower' }) },
  // A metric no goal has measured: one that has is retired, not removed (MT3).
  removeMetric: { as: ADMIN, input: (x) => { const used = new Set(((x.full?.modules?.metrics?.metricLinks ?? []) as { metricId: string }[]).map((l) => l.metricId)); const ms = (x.snapshot.modules?.metrics?.metrics ?? []) as { id: string }[]; return { metricId: (ms.find((m) => !used.has(m.id)) ?? ms[0]!).id }; } },
  retireMetric: { as: ADMIN, input: (x) => ({ metricId: ((x.snapshot.modules?.metrics?.metrics ?? []) as { id: string }[])[0]!.id, why: 'Replaced by the DORA dashboard’s figure.' }) },
  unretireMetric: { as: ADMIN, input: (x) => ({ metricId: ((x.snapshot.modules?.metrics?.metrics ?? []) as { id: string }[])[0]!.id }) },
  mergeMetrics: { as: ADMIN, input: () => ({ fromId: 'metric_lead-time', intoId: 'metric_first-review' }) },
  linkGoalMetric: { as: ADMIN, input: (x) => ({ goalId: own({ ...x, actor: { ...x.actor, id: 'rhea' } }).id, metricId: ((x.snapshot.modules?.metrics?.metrics ?? []) as { id: string }[])[0]!.id, teamId: null }) },
  unlinkGoalMetric: { as: ADMIN, input: (x) => { const l = ((x.snapshot.modules?.metrics?.metricLinks ?? []) as { goalId: string }[])[0]; return { goalId: l?.goalId ?? other(x).id }; } },
  // Fields (TG1): the demo has no field, so only adding one saves; the rest are refused naming the missing field, and
  // still say what they read.
  addField: { as: ADMIN, input: () => ({ name: 'Stage', kind: 'list', options: ['Discover', 'Build', 'Run'] }) },
  changeField: { as: ADMIN, input: (x) => ({ fieldId: (((x.snapshot.modules?.tags?.fields ?? []) as { id: string }[])[0]?.id ?? 'fld_stage'), name: 'Phase', options: ['Discover', 'Build', 'Run'] }) },
  moveField: { as: ADMIN, input: (x) => ({ fieldId: (((x.snapshot.modules?.tags?.fields ?? []) as { id: string }[])[0]?.id ?? 'fld_stage'), by: 1 }) },
  retireField: { as: ADMIN, input: (x) => ({ fieldId: (((x.snapshot.modules?.tags?.fields ?? []) as { id: string }[])[0]?.id ?? 'fld_stage') }) },
  bringBackField: { as: ADMIN, input: (x) => ({ fieldId: (((x.snapshot.modules?.tags?.fields ?? []) as { id: string }[])[0]?.id ?? 'fld_stage') }) },
  setGoalFields: { as: 'rhea', input: (x) => ({ goalId: own(x).id, values: { [(((x.snapshot.modules?.tags?.fields ?? []) as { id: string }[])[0]?.id ?? 'fld_stage')]: 'Build' } }) },
};
