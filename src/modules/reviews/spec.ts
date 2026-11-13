/* Reviews' rules for its switch, in plain words with worked examples, for its section of the spec
   (spec/modules/reviews/rules.md): RS1, one phrase for the clock, and RS2, the read-back's two lines
   (docs/design/round-4/reviews-switch/spec.md 4). The spec's generator reads it through the module registry
   (src/spec/rules.ts); every example runs against the rules themselves, so it can't drift from the code. */
import type { Rule } from '../../spec/rules';
import { dueWords, receiptText } from '../../domain/progress';
import { heldOnDueDay } from '../../domain/review';
import { switchOffLines, switchOffReadBack } from '../../domain/reviewsOff';
import { acceptNote } from '../../domain/decide';
import type { Cycle, Review } from '../../domain/types';

// 2026, weekly, check-ins due on Thursday: week 46 is 9–15 Nov, due Thursday 12 Nov.
const CY: Cycle = { id: 'c', name: '2026', startDate: '2025-12-22', weeks: 53, reviewDay: 3 };
const review = (o: Partial<Review> = {}): Review => ({ id: 'weekly', name: 'Platform leadership weekly', everyWeeks: 1, weekday: 3, scope: { goals: [], trees: [], levels: [] }, people: [], createdBy: 'amara', createdAt: '2026-01-01T09:00:00Z', ...o });
const words = (on: boolean, reviews: Review[]) => dueWords(on, CY, 46, heldOnDueDay(reviews, CY, 46));
const receipt = (total: number, after: number, on: boolean) => receiptText({ total, after, week: 46, words: words(on, [review()]), run: 0, forgiven: null, nextDue: null }).first;
const lines = (r: Parameters<typeof switchOffLines>[0]) => switchOffLines(r).map((l) => l.strong + l.rest);

const rules: Rule[] = [
  {
    id: 'reviews-switch',
    title: 'Reviews’ switch: the clock and the read-back',
    summary: 'How the day check-ins are due is said with Reviews on or off, and what switching Reviews off reads back first.',
    code: [
      { file: 'src/domain/progress.ts', names: ['dueWords', 'dueWordsOn', 'receiptText'] },
      { file: 'src/domain/review.ts', names: ['heldOnDueDay'] },
      { file: 'src/domain/reviewsOff.ts', names: ['switchOffReadBack', 'switchOffLines'] },
      { file: 'src/domain/reviewWrites.ts', names: ['writesReviews'] },
      { file: 'src/app/reads.ts', names: ['heldForGoals'] },
    ],
    tests: ['src/domain/dueWords.test.ts', 'src/domain/reviewsOff.test.ts', 'src/app/reviewsOffWrites.test.ts', 'src/app/reviewsOffReads.test.ts', 'src/domain/reviewsOffSheets.test.ts', 'src/modules/reviews/tools.test.ts'],
    reqs: ['REVIEWS-SWITCH-CLOCK', 'REVIEWS-OPTIONAL'],
    body: `
**Rule RS1. One phrase for the clock** (\`dueWords(reviewsOn, cycle, week, held)\`). Check-ins are due by the end of the cycle's due day (\`reviewDay\`), which never needed a review. A review is **held on the due day** when one not ended or removed has its weekday on that day and a session that week (\`heldOnDueDay\`). With Reviews on and a review held that day the deadline is “before Thursday’s review” (past it, “after Thursday’s review”; as a label, “before the review”); with no review that day, or Reviews off, it is “by Thursday” (“after Thursday”; “on time”). The \`due\` flag says “Due by Thu 12 Nov.” either way, and Home names the deadline as a date (“Check-ins are due by Thursday 12 Nov”), never a review. No screen writes “review” in a deadline itself: the check-in's receipt says “All 3 of your check-ins are in by Thursday.”, and the habit panel on a team's page takes its words here too: “review” only when one is held that day with one of the team's goals' owners in it (\`heldForGoals\`), otherwise “on time” and “by its Thursday”, Reviews on or off.

**Rule RS2. The read-back's two lines.** Before Reviews is switched off, after the line about questions: “**{n} accepted risks stay on their goals**, as they were said. No new one can be accepted while Reviews is off.”, counting the notes that start “We accept the risk: ”, not removed, on goals not removed, and left out at nought; then always “**Check-ins are still due by {Thursday}.** “Before the review” becomes “by {Thursday}” on Home, in the check-in and in the count of goals checked in on time.”

**Elsewhere with Reviews off.** The workbook has no Notes sheet and no Review column on Asks, and the JSON export (and get_goal) no \`notes\`: nothing said in a review; a workbook that has them is not refused, and the preview says once “Reviews is off in {workspace}: the Notes sheet and the Review column were not read.”. Every review tool, and edit_call on a note said in a review, answers “Reviews is switched off in {workspace}, so {tool} can’t be used there. An admin can switch it on in Workspace, under Features.”, the sentence every switched-off module's tools use. \`inreview=\` is no filter on Goals or in find_goals, and has no words on the filter line, as a switched-off module's column isn't (module map F4); no screen offers it then, since the review's page that links it is gone.

**What is refused with Reviews off** (\`writesReviews\`, build review of #371). Not a list of actions: whatever touches Reviews' records. An action whose input names a review (a review's id or settings, or a goal's “proposed in”) is refused before its rule runs; then any save, from the app or an AI tool, that logs a change to a review or a note, writes a note or a new review, raises an ask in a review, or proposes a goal in one. So correcting or removing a review note, Undo of an ended review and restoring one from Recently removed are refused too. What a save only carries along still runs: answering a question raised in a review, correcting an ask's words, editing a goal once proposed in one, the reviews someone leaves when marked as left, the reviews a carried goal joins. An action says “Reviews is switched off in {workspace}. An admin can switch it on in Workspace, under Features.”, as any switched-off module's action does; an AI tool, the tools' sentence above. Each reload of the workspace brings its switches, so a tab open from before the switch is refused from its next reload; the internal app checks at the server (the ports at company scale, rule 5).
`,
    examples: [
      { given: 'Due Thursday 12 Nov. Reviews on, Platform leadership weekly held on Thursdays.', then: 'before Thursday’s review', run: () => words(true, [review()]).by },
      { given: 'The same, but the workspace has no review set up (or only one on Tuesdays).', then: 'by Thursday / by Thursday', run: () => `${words(true, []).by} / ${words(true, [review({ weekday: 1 })]).by}` },
      { given: 'The same with Reviews off.', then: 'by Thursday', run: () => words(false, [review()]).by },
      { given: 'The due flag, Reviews on and off.', then: 'Due by Thu 12 Nov. / Due by Thu 12 Nov.', run: () => `${words(true, [review()]).flag} / ${words(false, [review()]).flag}` },
      { given: 'Rhea’s receipt with all 3 of her goals in on Wednesday, Reviews off; then on Friday.', then: 'All 3 of your check-ins are in by Thursday. / All 3 of your check-ins are in. All of them came after Thursday.', run: () => `${receipt(3, 0, false)} / ${receipt(3, 3, false)}` },
      {
        given: 'Switching Reviews off: 2 risks accepted on live goals, one more on a goal since removed, due Thursday.',
        then: '2 accepted risks stay on their goals, as they were said. No new one can be accepted while Reviews is off. | Check-ins are still due by Thursday. “Before the review” becomes “by Thursday” on Home, in the check-in and in the count of goals checked in on time.',
        run: () => {
          const r = switchOffReadBack({ people: [{}], reviews: [], changes: [], asks: [], dueDay: words(false, []).day, goals: [{ id: 'a' }, { id: 'b' }, { id: 'c', removedAt: '2026-11-01' }],
            decisions: ['a', 'b', 'c'].map((goalId) => ({ goalId, kind: 'note' as const, note: acceptNote('Supplier slip'), removedAt: null })) });
          return lines(r).filter((l) => /accepted risk|Check-ins are still due/.test(l)).join(' | ');
        },
      },
    ],
  },
];

export default rules;
