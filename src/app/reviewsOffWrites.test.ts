// @vitest-environment node
/* With Reviews switched off, nothing saves Reviews' records, whichever door (build review of #371, medium 2): the refusal
   goes by what the save writes (domain/reviewWrites), once in the dispatcher and once in the AI tools' save, not by a
   list of action names. Each door the review found open is here, and what a save only carries along still runs. */
import { buildPlatformOrg } from '../data/platformOrg';
import { applyCommit, type Commit } from '../data/store';
import { currentCycle, scopeToCycle } from '../domain/cycle';
import { currentWeek } from '../domain/plan';
import { blankGoal } from '../domain/goal';
import { writesReviews } from '../domain/reviewWrites';
import type { Snapshot } from '../domain/types';
import { callTool, type McpContext } from '../mcp/tools';
import { moduleOffSentence } from '../mcp/moduleOff';
import { loadGoalEntry, perform, performAny, type RunContext } from './actions';
import { reviewsOffWords } from './reads';

const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_w${++n}`;
const OFF = reviewsOffWords('Platform');

function as(who: string, full: Snapshot = buildPlatformOrg(today), off = true): RunContext {
  const cycle = currentCycle(full.cycles, today)!;
  const actor = full.people.find((p) => p.id === who)!;
  return { snapshot: scopeToCycle(full, cycle), cycle, week: currentWeek(cycle, today), actor, now: '2026-11-05T13:00:00Z', newId, allGoals: full.goals, full, workspace: { id: 'w', name: 'Platform', ...(off ? { modulesOff: ['reviews'] } : {}) }, modules: [] };
}
const admin = (s: Snapshot) => s.people.find((p) => p.admin && !p.leftAt && !p.removedAt)!.id;
const reviewNote = (s: Snapshot) => s.decisions.find((d) => d.kind === 'note' && !!d.reviewId && !d.removedAt)!;

describe('the one sentence', () => {
  it('is the switched-off module’s, for Reviews as for any module', () => {
    expect(OFF).toBe('Reviews is switched off in Platform. An admin can switch it on in Workspace, under Features.');
  });
});

describe('writesReviews', () => {
  const s = buildPlatformOrg(today);
  const goal = s.goals.find((g) => !g.proposedIn)!;
  const ask = (s.requests ?? []).find((r) => !!r.reviewId)!;
  it('is true of a note, a new review, a goal newly proposed in a review and an ask newly raised in one', () => {
    expect(writesReviews({ decisions: [reviewNote(s)], changes: [] }, s)).toBe(true);
    expect(writesReviews({ reviews: [{ ...s.reviews[0]!, id: 'new-review' }], changes: [] }, s)).toBe(true);
    expect(writesReviews({ goals: [{ ...goal, proposedIn: s.reviews[0]!.id }], changes: [] }, s)).toBe(true);
    expect(writesReviews({ requests: [{ ...ask, id: 'new-ask' }], changes: [] }, s)).toBe(true);
    expect(writesReviews({ changes: [{ id: 'c', at: '', actorId: 'x', goalId: null, entity: 'review', entityId: 'r', action: 'restored', summary: '', diffs: [] }] }, s)).toBe(true);
  });
  it('is false of what a save only carries along: an ask raised in a review, answered; a review a person leaves; a goal edited', () => {
    expect(writesReviews({ requests: [{ ...ask, status: 'answered' }], changes: [] }, s)).toBe(false);
    expect(writesReviews({ reviews: [{ ...s.reviews[0]!, people: s.reviews[0]!.people.slice(1) }], changes: [] }, s)).toBe(false);
    expect(writesReviews({ goals: [{ ...goal, title: 'Renamed' }], changes: [] }, s)).toBe(false);
  });
});

describe('the dispatcher, with Reviews off', () => {
  it('refuses deleting and correcting a note said in a review (deleteNote, editCall)', () => {
    const x = as(admin(buildPlatformOrg(today)));
    const note = reviewNote(x.full!);
    expect(() => perform(x, 'deleteNote', { noteId: note.id })).toThrow(OFF);
    expect(() => perform(x, 'editCall', { callId: note.id, note: 'Corrected words' })).toThrow(OFF);
    // On, both run their rule.
    const on = as(admin(x.full!), x.full!, false);
    expect(perform(on, 'deleteNote', { noteId: note.id })).toBeTruthy();
  });

  it('refuses a goal proposed in a review (saveGoal with proposedIn), and saves one proposed anywhere else', async () => {
    await loadGoalEntry();
    const x = as('rhea');
    const draft = { ...blankGoal('portal', 'camille', ''), title: 'Data-backed environments ready in under an hour' };
    expect(() => perform(x, 'saveGoal', { draft, state: 'proposed', proposedIn: 'devprod' })).toThrow(OFF);
    expect((perform(x, 'saveGoal', { draft, state: 'proposed' }) as { goal: { proposedIn?: string | null } }).goal.proposedIn ?? null).toBeNull();
  });

  it('refuses reopening an ended review, by Undo (undoRemoval) or from Recently removed (restoreRemoved)', () => {
    const start = buildPlatformOrg(today);
    const who = admin(start);
    const review = start.reviews.find((r) => !r.endedAt && !r.removedAt)!;
    const ended = performAny(as(who, start, false), 'endReview', { reviewId: review.id }) as { commit: Commit };
    const after = applyCommit(start, ended.commit);
    expect(() => perform(as(who, after), 'undoRemoval', { removal: ended.commit, before: start })).toThrow(OFF);
    expect(() => perform(as(who, after), 'restoreRemoved', { kind: 'ended', id: review.id })).toThrow(OFF);
    expect(perform(as(who, after, false), 'undoRemoval', { removal: ended.commit, before: start })).toBeTruthy();
  });

  it('still marks someone in a review as left (their reviews are carried along), and still corrects an ask’s own words', () => {
    const s = buildPlatformOrg(today);
    const who = admin(s);
    const inReview = s.reviews.flatMap((r) => r.people).find((id) => id !== who && s.people.some((p) => p.id === id && !p.admin && !p.leftAt))!;
    const out = perform(as(who, s), 'markPersonLeft', { personId: inReview, goalsTo: who, asksTo: who }) as Commit;
    expect(out.reviews?.some((r) => !r.people.includes(inReview))).toBe(true);
    const ask = (s.requests ?? []).find((r) => r.status === 'open' && !!r.reviewId)!;
    expect(() => perform(as(ask.askedBy, s), 'editCall', { callId: ask.id, note: `${ask.ask} (corrected)` })).not.toThrow();
  });
});

describe('the AI tools, with Reviews off', () => {
  const ctx = (who: string): { ctx: McpContext; saved: Commit[] } => {
    const x = as(who);
    const saved: Commit[] = [];
    return {
      saved,
      ctx: { ws: { id: 'w', name: 'Platform', modulesOff: ['reviews'] }, snapshot: x.snapshot, cycle: x.cycle, week: x.week, today, actor: x.actor, now: x.now, newId, allGoals: x.allGoals, full: x.full,
        save: async (c) => { saved.push(c); }, issueToken: async () => 'secret' },
    };
  };

  it('edit_comment and delete_comment on a review note answer the switched-off sentence and save nothing', async () => {
    const who = admin(buildPlatformOrg(today));
    for (const [tool, args] of [['edit_comment', { text: 'Corrected words' }], ['delete_comment', {}]] as const) {
      const t = ctx(who);
      const note = reviewNote(t.ctx.full!);
      const out = await callTool(tool, { comment_id: note.id, ...args }, t.ctx);
      expect(out).toMatchObject({ isError: true, text: moduleOffSentence('Reviews', 'Platform', tool) });
      expect(t.saved).toEqual([]);
    }
  });

  it('a comment on a goal still saves', async () => {
    const t = ctx('rhea');
    const goal = t.ctx.snapshot.goals.find((g) => g.ownerId === 'rhea')!;
    const out = await callTool('add_comment', { goal_id: goal.id, text: 'Looks good from here' }, t.ctx);
    expect(out.isError).toBeFalsy();
    expect(t.saved.length).toBe(1);
  });
});
