// @vitest-environment node
/* One form footer (FORM-FOOTER; docs/design/patterns/spec.md section 3): its words. */
import { checkInNext, checkInPostSays, closeWords, draftFromDay, fixCount, fixSummary, importSays, metricSays, postCheckIns, primarySays, publishSays, PROPOSE_SAYS, REPLAN_SAYS, tableSays } from './formFooter';

describe('the form footer and its one exit', () => {
  it('a form that keeps drafts says “Close” until something is typed, then “Close and keep the draft”; one that keeps none says “Close without saving”', () => {
    expect(closeWords(true, false)).toBe('Close');
    expect(closeWords(true, true)).toBe('Close and keep the draft');
    expect(closeWords(false, false)).toBe('Close without saving');
    expect(closeWords(false, true)).toBe('Close without saving');
  });
  it('a primary never says only Continue, Submit, OK or Save', () => {
    for (const l of ['Continue', 'submit', 'OK', 'Save']) expect(primarySays(l)).toBe(false);
    for (const l of ['Post check-in', 'Save changes', 'Next: why it’s behind', 'Publish goal']) expect(primarySays(l)).toBe(true);
  });
  it('a check-in’s step names the next step by what it asks', () => {
    expect(checkInNext('account', { why: true, reason: 'behind', milestone: false })).toBe('Next: why it’s behind');
    expect(checkInNext('account', { why: true, reason: 'ahead', milestone: false })).toBe('Next: why it’s ahead');
    expect(checkInNext('account', { why: true, reason: 'behind', milestone: true })).toBe('Next: why it’s late');
    expect(checkInNext('account', { why: false, milestone: false })).toBe('Next: what changes');
    expect(checkInNext('carry', { why: true, milestone: false })).toBe('Next: what you said last time');
    expect(checkInNext(null, { why: false, milestone: false })).toBe('Next: the rest of the check-in');
  });
  it('the last step says what posting does', () => {
    expect(checkInPostSays(46, 3)).toBe('Goes on record for week 46. The 3 people watching see it on Home.');
    expect(checkInPostSays(46, 1)).toBe('Goes on record for week 46. The person watching sees it on Home.');
    expect(checkInPostSays(46, 0)).toBe('Goes on record for week 46.');
  });
  it('errors: a summary only for two or more, or one out of view', () => {
    expect(fixSummary(['Target'])).toBeNull();
    expect(fixSummary(['Target'], false)).toBe('1 thing to fix: Target');
    expect(fixSummary(['Target', 'Owner'])).toBe('2 things to fix: Target, Owner');
    expect(fixSummary([])).toBeNull();
  });
  it('the table check-in posts what is ready, and says what isn’t', () => {
    expect(postCheckIns(5)).toBe('Post 5 check-ins');
    expect(postCheckIns(1)).toBe('Post 1 check-in');
    expect(tableSays(5, 2)).toBe('5 ready. 2 need a reason before they can post.');
    expect(tableSays(5, 0)).toBe('5 ready.');
  });

  it('the rest of the status lines: Publish or Propose, the reason line, a metric’s Defined or Draft, Import’s count', () => {
    expect(publishSays('Platform Engineering')).toBe('Publishes to everyone in Platform Engineering.');
    expect(PROPOSE_SAYS).toBe('Listed as Proposed: in no count, no agenda and nobody’s check-ins.');
    expect(REPLAN_SAYS).toBe('Check-ins have started, so this needs a reason. Watchers see it flagged.');
    expect(metricSays(0)).toBe('Defined: every part is filled in.');
    expect(metricSays(2)).toBe('Draft: 2 parts still to fill in.');
    expect(metricSays(1)).toBe('Draft: 1 part still to fill in.');
    expect(importSays(12)).toBe('12 goals change. You can undo this from Past imports.');
    expect(importSays(1)).toBe('1 goal changes. You can undo this from Past imports.');
  });
  it('the error summary’s head is the same words the summary uses', () => {
    expect(fixCount(2)).toBe('2 things to fix:');
    expect(fixSummary(['Target', 'Owner'])).toBe(`${fixCount(2)} Target, Owner`);
  });
  it('a resumed draft says its day: today, yesterday, a weekday this week, else the date', () => {
    const now = new Date(2026, 10, 18, 12).getTime();
    expect(draftFromDay(new Date(2026, 10, 18, 9).getTime(), now)).toBe('Draft from today');
    expect(draftFromDay(new Date(2026, 10, 17, 9).getTime(), now)).toBe('Draft from yesterday');
    expect(draftFromDay(new Date(2026, 10, 15, 9).getTime(), now)).toBe('Draft from Sunday');
    expect(draftFromDay(new Date(2026, 10, 2, 9).getTime(), now)).toBe('Draft from 2 Nov');
    expect(draftFromDay(null, now)).toBe('Draft');
  });
});
