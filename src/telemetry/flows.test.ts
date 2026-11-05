// @vitest-environment node
import { FlowTracker } from './flows';

const tracker = () => { let t = 0; const f = new FlowTracker(undefined, () => (t += 1000)); return f; };
const brief = (l: { event: string; flow: string; step: string; index: number; count: number; reason?: string }[]) => l.map((e) => `${e.flow} ${e.event} ${e.step} ${e.index}/${e.count}${e.reason ? ' ' + e.reason : ''}`);

describe('Where people are in the named flows', () => {
  it('starts a check-in on its page, moves on with the screen’s marks, and finishes when it posts', () => {
    const f = tracker();
    expect(brief(f.route('/check-in/alerts'))).toEqual(['check-in start open 1/3']);
    expect(f.mark('checkIn.open')).toEqual([]);
    expect(brief(f.mark('checkIn.account'))).toEqual(['check-in step explain 2/3']);
    expect(f.current()).toEqual([{ flow: 'check-in', step: 'explain', index: 2, count: 3 }]);
    f.actionStarted();
    const done = f.actionEnded('postCheckIn', true);
    expect(brief(done)).toEqual(['check-in finish post 3/3']);
    expect(done[0]!.durationMs).toBeGreaterThan(0);
    expect(f.current()).toEqual([]);
  });

  it('records a stop, at the step reached, when they leave for a page outside the flow', () => {
    const f = tracker();
    f.route('/goals/new');
    f.mark('newGoal.step-2');
    f.mark('newGoal.step-3');
    expect(brief(f.route('/help'))).toEqual(['new-goal stop fits 3/5 left']);
  });

  it('doesn’t move a flow on when the action failed, and waits for a save before calling a page change leaving', () => {
    const f = tracker();
    f.route('/goals/head/edit');
    f.actionStarted();
    // The page changes while the save is still going: not a stop yet.
    expect(f.route('/goals/head')).toEqual([]);
    expect(brief(f.actionEnded('saveGoal', true))).toEqual(['change-goal finish save 2/2']);
    f.route('/goals/head/edit');
    f.actionStarted();
    expect(f.actionEnded('saveGoal', false)).toEqual([]);
    expect(brief(f.route('/'))).toEqual(['change-goal stop open 1/2 left']);
  });

  it('runs a review from the agenda through the goals to the summary, and can start at the first goal', () => {
    const f = tracker();
    expect(brief(f.route('/reviews/weekly'))).toEqual(['review start agenda 1/3']);
    expect(brief(f.route('/goals/head', '?review=weekly'))).toEqual(['review step walk 2/3']);
    // Back to the agenda between goals isn't leaving, or a step back.
    expect(f.route('/reviews/weekly')).toEqual([]);
    expect(brief(f.route('/reviews/weekly/summary'))).toEqual(['review finish summary 3/3']);
    const g = tracker();
    expect(brief(g.route('/goals/head', '?review=weekly'))).toEqual(['review start walk 2/3']);
    // A goal page that isn't part of a review is leaving it.
    expect(brief(g.route('/goals/head'))).toEqual(['review stop walk 2/3 left']);
  });

  it('starts answering a request when the sheet opens and stops when it closes unanswered', () => {
    const f = tracker();
    expect(brief(f.mark('respond.open'))).toEqual(['answer-request start open 1/2']);
    expect(brief(f.mark('respond.close'))).toEqual(['answer-request stop open 1/2 closed']);
    f.mark('respond.open');
    f.actionStarted();
    expect(brief(f.actionEnded('answerRequest', true))).toEqual(['answer-request finish answer 2/2']);
    expect(f.mark('respond.close')).toEqual([]);
  });

  it('stops every open flow where it got to when the page closes', () => {
    const f = tracker();
    f.route('/workspace/new');
    f.mark('setUp.step-1');
    f.mark('setUp.step-2');
    expect(brief(f.leave())).toEqual(['set-up stop you 2/8 closed']);
    expect(f.leave()).toEqual([]);
  });
});
