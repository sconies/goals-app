// @vitest-environment node
/* Metric quality (MQ2, docs/design/mq2): the stage, what Defined needs, lapsing, who may verify, baselines per slice,
   the similar-metric check and "To sort out", in the Platform Engineering demo as built for 5 Nov 2026. */
import { buildPlatformOrg } from '../../data/platformOrg';
import { applyCommit, type Commit } from '../../data/store';
import { NotAllowed, type ActionContext } from '../../domain/actions';
import { currentCycle, scopeToCycle as scope } from '../../domain/cycle';
import { currentWeek } from '../../domain/plan';
import type { Snapshot } from '../../domain/types';
import * as M from './rules';
import * as Q from './rulesQuality';
import * as V from './rulesVerify';
import RECORDS from './records';
import { metricFromRow, metricToRow } from './records';
import { openChecks, saveMetricAsked } from './rulesSave';
import type { Metric, MetricCalc } from './types';

const MINE = [{ ...RECORDS, module: M.MODULE }];
const today = new Date('2026-11-05T12:00:00Z');
let n = 0;
const newId = (p: string) => `${p}_q${++n}`;

function world() {
  let full: Snapshot = buildPlatformOrg(today);
  const cycle = currentCycle(full.cycles, today)!;
  const week = currentWeek(cycle, today);
  let clock = Date.parse('2026-11-05T13:00:00Z');
  const x = (who: string): ActionContext => ({ snapshot: scope(full, cycle, MINE), cycle, week, actor: full.people.find((p) => p.id === who)!, now: new Date(clock += 60_000).toISOString(), newId, allGoals: full.goals, full });
  return {
    x,
    metric: (id: string) => M.metricsOf(full).find((m) => m.id === `metric_${id}`)!,
    apply(c: Commit | null) { if (c) full = applyCommit(full, c); return c; },
  };
}
const refused = (f: () => unknown, msg: RegExp) => { expect(f).toThrow(NotAllowed); expect(f).toThrow(msg); };

const RATIO: MetricCalc = {
  measure: 'ratio', aggregate: null,
  numerator: { counts: 'Production deploys tied to an incident, a rollback or a hotfix', filters: 'Every deployable service', excludes: 'Incidents with no deploy in the 24 hours before' },
  denominator: { counts: 'Successful production deploys', filters: 'Every deployable service', excludes: 'Rollbacks' },
};
const P90: MetricCalc = { measure: 'duration', aggregate: 'percentile', percentile: 90, part: { counts: 'Wall-clock minutes from push to a finished pipeline on main', filters: 'Branch is main', excludes: 'Cancelled runs' } };
/** The fields that take the demo's CI pipeline time from Draft to Defined. */
const FULL = { calculation: P90, timeWindow: { kind: 'rolling' as const, days: 7 }, sourceLink: 'https://ci.example.com/pipelines/main/duration-p90?window=7d' };

describe('the stage (MQ2)', () => {
  const at = '2026-11-15T12:00:00Z';
  const base = (o: Partial<Metric> = {}): Metric => ({ id: 'm', name: 'CI pipeline time', meaning: 'p90 minutes', unit: 'min', decimals: 0, direction: 'lower', source: 'CI analytics', sourceOwner: 'Developer Experience', refresh: 'hourly', ownerId: 'daniel', caveats: '', createdBy: 'daniel', createdAt: at, updatedAt: at, ...FULL, ...o });
  it('is Draft while any of the ten parts is missing, naming each in order with why it matters', () => {
    const s = Q.stageOf(base({ sourceLink: '' }), { now: at, ownerIsHere: true });
    expect(s.stage).toBe('draft');
    expect(s.missing.map((m) => m.part)).toEqual(['source']);
    expect(s.missing[0]!.why).toBe('without it the number can’t be checked');
    expect(Q.missingLine(s.missing)).toBe('needs a source link');
    const none = Q.stageOf(base({ calculation: null, timeWindow: null, sourceLink: '', refresh: null }), { now: at, ownerIsHere: false });
    expect(none.missing.map((m) => m.part)).toEqual(['calculation', 'scope', 'window', 'source', 'refresh', 'owner']);
    expect(Q.missingLine([{ part: 'window' }, { part: 'scope' }])).toBe('needs a window and filters and exclusions');
  });
  it('is Defined with all ten, and needs no baseline', () => {
    expect(Q.stageOf(base(), { now: at, ownerIsHere: true })).toMatchObject({ stage: 'defined', toVerify: true, why: 'Defined. Not verified yet.' });
  });
  it('a ratio needs both parts’ counts, filters and exclusions; other needs its formula', () => {
    expect(Q.partSaid(base({ calculation: RATIO }), 'calculation', true)).toBe(true);
    expect(Q.partSaid(base({ calculation: { ...RATIO, denominator: { counts: 'Deploys', filters: '', excludes: '' } } }), 'scope', true)).toBe(false);
    expect(Q.partSaid(base({ calculation: { measure: 'other', aggregate: null, formula: 'Promoters minus detractors', part: { counts: 'Answers', filters: 'All', excludes: 'None' } } }), 'calculation', true)).toBe(true);
  });
  it('is Verified for 12 months, on "To verify" 30 days before, then back to Defined', () => {
    const v = { outcome: 'verified' as const, by: 'amara', at: '2025-12-10T12:00:00Z', period: 'Aug–Oct 2025', figure: 21, stored: 22, storedFrom: 'baseline' as const, note: 'ok' };
    expect(Q.stageOf(base({ verification: v }), { now: '2026-11-01T00:00:00Z', ownerIsHere: true })).toMatchObject({ stage: 'verified', toVerify: false });
    expect(Q.stageOf(base({ verification: v }), { now: '2026-11-15T00:00:00Z', ownerIsHere: true })).toMatchObject({ stage: 'verified', toVerify: true });
    expect(Q.stageOf(base({ verification: v }), { now: '2026-12-11T00:00:00Z', ownerIsHere: true })).toMatchObject({ stage: 'defined', lapsed: { kind: 'age' } });
  });
  it('a Gap is never Verified', () => {
    const v = { outcome: 'verified' as const, by: 'amara', at, period: 'Q3', figure: 1, stored: null, storedFrom: null, note: 'ok' };
    expect(Q.stageOf(base({ verification: v, measurement: 'gap' }), { now: at, ownerIsHere: true }).stage).toBe('defined');
  });
  it('says the calculation, window and refresh in a few words', () => {
    expect(Q.calcWords(P90)).toBe('Duration, p90');
    expect(Q.calcWords({ measure: 'count', aggregate: 'mean', per: 'day' })).toBe('Count, mean per day');
    expect(Q.calcWords(RATIO)).toBe('Ratio');
    expect(Q.windowWords({ kind: 'rolling', days: 28 })).toBe('Rolling 28 days');
    expect(Q.windowWords({ kind: 'period', period: 'month' })).toBe('Per month');
    expect(Q.windowWords(null)).toBe('Not said');
    expect(Q.refreshWords({ refresh: 'weekly', refreshNote: 'Mondays' })).toBe('Refreshed weekly, Mondays');
  });
  it('reads what a tool sends: p90, words for a window', () => {
    expect(Q.calcFrom({ measure: 'duration', aggregate: 'p90', counts: 'Minutes', filters: 'main', excludes: 'cancelled' })).toEqual({ measure: 'duration', aggregate: 'percentile', percentile: 90, part: { counts: 'Minutes', filters: 'main', excludes: 'cancelled' } });
    expect(Q.windowFrom('rolling 28 days')).toEqual({ kind: 'rolling', days: 28 });
    expect(Q.windowFrom('per quarter')).toEqual({ kind: 'period', period: 'quarter' });
    expect(Q.windowFrom('cumulative since 2026-01-01')).toEqual({ kind: 'cumulative', since: '2026-01-01' });
  });
  it('a goal checks in monthly or quarterly when its metric refreshes that often', () => {
    expect(Q.rhythmFor('monthly')).toBe('monthly');
    expect(Q.rhythmFor('quarterly')).toBe('quarterly');
    expect(Q.rhythmFor('weekly')).toBeNull();
    expect(Q.rhythmFor(null)).toBeNull();
  });
});

describe('saving the structured definition (MQ2)', () => {
  it('saves Draft parts, reaches Defined by itself, and round-trips through its row', () => {
    const w = world();
    const c = saveMetricAsked(w.x('daniel'), { id: 'metric_ci-time', ...FULL });
    w.apply(c.commit);
    const m = w.metric('ci-time');
    expect(m).toMatchObject({ ...FULL, calcChangedBy: 'daniel' });
    expect(V.stageNow(w.x('daniel'), m).stage).toBe('defined');
    expect(metricFromRow(metricToRow('ws', m))).toMatchObject(FULL);
    expect(Object.keys(metricFromRow(metricToRow('ws', w.metric('mttd')))).filter((k) => ['timeWindow', 'baselines', 'verification', 'sourceLink'].includes(k))).toEqual([]);
  });
  it('refuses a link that isn’t a web address, and an unknown window', () => {
    const w = world();
    refused(() => saveMetricAsked(w.x('daniel'), { id: 'metric_ci-time', sourceLink: 'ci analytics' }), /web address starting with https/);
    refused(() => saveMetricAsked(w.x('daniel'), { id: 'metric_ci-time', timeWindow: { kind: 'rolling', days: 0 } }), /1 to 730 days/);
  });
});

describe('verifying (MQ2)', () => {
  const ready = () => { const w = world(); w.apply(saveMetricAsked(w.x('daniel'), { id: 'metric_ci-time', ...FULL }).commit); return w; };
  const ok = { period: 'Aug–Oct 2026', figure: 21, note: 'Matches apart from rounding.', openedLink: true, outcome: 'verified' as const };
  it('refuses the owner and whoever last changed the calculation, in words that say who can', () => {
    const w = ready();
    refused(() => V.verifyMetric(w.x('daniel'), 'metric_ci-time', ok), /You own this metric, so someone else must verify it\. Ask an admin, someone in Developer Experience/);
    w.apply(saveMetricAsked(w.x('grace'), { id: 'metric_ci-time', timeWindow: { kind: 'rolling', days: 14 } }).commit);
    refused(() => V.verifyMetric(w.x('grace'), 'metric_ci-time', ok), /You last changed its calculation, window or source/);
  });
  it('refuses someone who is neither an admin, in the source’s owner nor a named verifier', () => {
    const w = ready();
    // Tunde is in Build & Release; CI pipeline time's source is owned by Developer Experience (by name, #576 review).
    refused(() => V.verifyMetric(w.x('tunde'), 'metric_ci-time', ok), /Only an admin, someone in the source’s owner or a verifier an admin named/);
    expect(() => V.verifyMetric(w.x('tariq'), 'metric_ci-time', ok)).not.toThrow();
    // Only an admin names verifiers, at every door: the owner can't through the save (#564 review, medium 2).
    refused(() => saveMetricAsked(w.x('daniel'), { id: 'metric_ci-time', verifiers: ['tunde'] }), /Only an admin can name a metric’s verifiers/);
    w.apply(saveMetricAsked(w.x('grace'), { id: 'metric_ci-time', verifiers: ['tunde'] }).commit);
    expect(() => V.verifyMetric(w.x('tunde'), 'metric_ci-time', ok)).not.toThrow();
  });
  it('needs the link opened, the figure and a note; stores the record and shows the difference', () => {
    const w = ready();
    refused(() => V.verifyMetric(w.x('grace'), 'metric_ci-time', { ...ok, openedLink: false }), /Open the source link first/);
    refused(() => V.verifyMetric(w.x('grace'), 'metric_ci-time', { ...ok, note: ' ' }), /Add a note/);
    w.apply(V.saveBaselines(w.x('daniel'), 'metric_ci-time', [{ teamId: null, value: 22, period: 'Aug–Oct 2026', takenOn: '2026-11-01', how: 'CI analytics, p90 over the quarter' }]).commit);
    const r = V.verifyMetric(w.x('grace'), 'metric_ci-time', ok);
    expect(r.said).toMatch(/Your 21 min against 22 min stored \(1 min lower\)\. Due again 5 Nov 2027\./);
    w.apply(r.commit);
    expect(V.stageNow(w.x('grace'), w.metric('ci-time')).stage).toBe('verified');
  });
  it('"Couldn’t reproduce" keeps the attempt, leaves the stage, and goes on To sort out until answered', () => {
    const w = ready();
    const r = V.verifyMetric(w.x('grace'), 'metric_ci-time', { ...ok, figure: 30, outcome: 'couldnt_reproduce', note: 'The dashboard counts cancelled runs.' });
    expect(r.said).toMatch(/It stays Defined/);
    w.apply(r.commit);
    const m = w.metric('ci-time');
    const st = V.stageNow(w.x('grace'), m);
    expect(st.stage).toBe('defined');
    expect(Q.sortOutOf(m, { stage: st, nameOf: (id) => id }).map((s) => s.kind)).toEqual(['couldntReproduce']);
    w.apply(V.answerAttempt(w.x('daniel'), 'metric_ci-time', 'Cancelled runs are now excluded in the query.'));
    expect(Q.sortOutOf(w.metric('ci-time'), { stage: st, nameOf: (id) => id })).toEqual([]);
  });
});

describe('lapsing (MQ2)', () => {
  const verified = () => {
    const w = world();
    w.apply(saveMetricAsked(w.x('daniel'), { id: 'metric_ci-time', ...FULL }).commit);
    w.apply(V.verifyMetric(w.x('grace'), 'metric_ci-time', { period: 'Q3', figure: 21, note: 'ok', openedLink: true, outcome: 'verified' }).commit);
    return w;
  };
  it('a new window asks first (lapse: go), then drops to Defined with the reason kept', () => {
    const w = verified();
    const input = { id: 'metric_ci-time', timeWindow: { kind: 'rolling' as const, days: 28 } };
    expect(openChecks(w.x('daniel'), input).open.map((c) => c.field)).toEqual(['lapse']);
    refused(() => saveMetricAsked(w.x('daniel'), input), /is Verified\. Changing the window takes it back to Defined/);
    w.apply(saveMetricAsked(w.x('daniel'), { ...input, answers: { lapse: 'go' }, reason: 'Seven days was too noisy.' }).commit);
    const m = w.metric('ci-time');
    expect(m.verification).toBeUndefined();
    expect(m.lapse).toMatchObject({ kind: 'change', by: 'daniel', what: ['the window'], why: 'Seven days was too noisy.', was: { by: 'grace' } });
    expect(V.stageNow(w.x('daniel'), m)).toMatchObject({ stage: 'defined', toVerify: true });
  });
  it('a reworded exclusion asks the last verifier to confirm instead; Verified stands', () => {
    const w = verified();
    w.apply(saveMetricAsked(w.x('daniel'), { id: 'metric_ci-time', calculation: { ...P90, part: { ...P90.part!, excludes: 'Cancelled and skipped runs' } } }).commit);
    const m = w.metric('ci-time');
    expect(V.stageNow(w.x('daniel'), m).stage).toBe('verified');
    expect(m.toConfirm).toMatchObject({ verifier: 'grace', what: ['the exclusions'] });
    refused(() => V.confirmReword(w.x('tariq'), 'metric_ci-time'), /Only Grace/);
    w.apply(V.confirmReword(w.x('grace'), 'metric_ci-time'));
    expect(w.metric('ci-time').toConfirm).toBeUndefined();
  });
  it('never lets whoever reworded it confirm their own rewording, an admin included (#564 review, medium 1)', () => {
    const w = verified();
    w.apply(saveMetricAsked(w.x('amara'), { id: 'metric_ci-time', calculation: { ...P90, part: { ...P90.part!, excludes: 'Cancelled and skipped runs' } } }).commit);
    refused(() => V.confirmReword(w.x('amara'), 'metric_ci-time'), /You reworded it, so someone else confirms it: Grace/);
    expect(() => V.confirmReword(w.x('hamid'), 'metric_ci-time')).not.toThrow();
  });
  it('baselines, the owner and caveats never lapse it', () => {
    const w = verified();
    w.apply(saveMetricAsked(w.x('daniel'), { id: 'metric_ci-time', caveats: 'Pooled repositories.' }).commit);
    w.apply(V.saveBaselines(w.x('daniel'), 'metric_ci-time', [{ teamId: null, value: 21, period: 'Jul–Sep 2026', takenOn: '2026-10-01', how: 'p90 over the quarter' }]).commit);
    expect(V.stageNow(w.x('daniel'), w.metric('ci-time')).stage).toBe('verified');
  });
});

describe('baselines per slice (MQ2)', () => {
  it('need all four parts; a new figure for the same period needs a reason; the old one moves to History', () => {
    const w = world();
    refused(() => V.saveBaselines(w.x('tariq'), 'metric_first-review', [{ teamId: null, value: 11.8, period: '', takenOn: '2026-10-01', how: '' }]), /Say the period it covers.*Say how it was taken/);
    refused(() => V.saveBaselines(w.x('rhea'), 'metric_first-review', [{ teamId: null, value: 11.8, period: 'Jul–Sep 2026', takenOn: '2026-10-01', how: 'Four Keys' }]), /Only Tariq Haddad or an admin/);
    w.apply(V.saveBaselines(w.x('tariq'), 'metric_first-review', [{ teamId: null, value: 11.8, period: 'Jul–Sep 2026', takenOn: '2026-10-01', how: 'Four Keys query, all services' }]).commit);
    refused(() => V.saveBaselines(w.x('tariq'), 'metric_first-review', [{ teamId: null, value: 12, period: 'Jul–Sep 2026', takenOn: '2026-10-02', how: 'Four Keys' }]), /Say why the figure for Jul–Sep 2026 changes from 11\.8/);
    w.apply(V.saveBaselines(w.x('tariq'), 'metric_first-review', [{ teamId: null, value: 10.9, period: 'Oct–Dec 2026', takenOn: '2027-01-02', how: 'Four Keys' }]).commit);
    const bs = w.metric('first-review').baselines!;
    expect(bs.map((b) => [b.value, b.replacedWhy ?? null])).toEqual([[11.8, 'Replaced by Oct–Dec 2026'], [10.9, null]]);
    expect(Q.baselineFor(w.metric('first-review'), { teamId: null })!.value).toBe(10.9);
  });
  it('a figure changed from the one read carries its reason into how it was taken', () => {
    const w = world();
    refused(() => V.saveBaselines(w.x('tariq'), 'metric_first-review', [{ teamId: null, value: 12, read: 11.8, period: 'Jul–Sep 2026', takenOn: '2026-10-01', how: 'Four Keys' }]), /Say why you changed the figure read \(11\.8\)/);
    w.apply(V.saveBaselines(w.x('tariq'), 'metric_first-review', [{ teamId: null, value: 12, read: 11.8, reason: 'Two hotfixes counted twice', period: 'Jul–Sep 2026', takenOn: '2026-10-01', how: 'Four Keys' }]).commit);
    expect(w.metric('first-review').baselines![0]!.how).toBe('Four Keys; Two hotfixes counted twice');
  });
  it('a new source flags the baselines in force as taken from the old source, to retake', () => {
    const w = world();
    w.apply(saveMetricAsked(w.x('rhea'), { id: 'metric_lead-time', source: 'Deploy pipeline events', comparable: true, reason: 'Four Keys stops at the merge.' }).commit);
    const m = w.metric('lead-time');
    expect(Q.liveBaselines(m)[0]!.oldSource).toBe(true);
    expect(m.marks!.at(-1)).toMatchObject({ kind: 'source', why: 'Four Keys stops at the merge.' });
    expect(m.marks!.at(-1)!.now).toMatch(/^Deploy pipeline events/);
    expect(M.markLabel(m.marks!.at(-1)!)).toMatch(/^Source changed, week \d+$/);
    expect(Q.sortOutOf(m, { stage: V.stageNow(w.x('rhea'), m), nameOf: (id) => id })[0]).toMatchObject({ kind: 'oldSource', words: 'Retake 1 baseline from the new source' });
  });
});

describe('adding a metric: similar ones first (MQ2)', () => {
  it('finds one on name, or on source and meaning, and offers “Use this one”', () => {
    const w = world();
    const input = { name: 'Deploys a day to production', unit: 'deploys', direction: 'higher' as const, source: 'DORA dashboard (Four Keys)', meaning: 'Successful production deploys on a working day, averaged over 28 days.' };
    const open = openChecks(w.x('tariq'), input).open;
    const like = open.find((c) => c.field === 'similar' || c.field === 'name');
    expect(like).toBeDefined();
    expect(like!.answers[0]!.choice).toMatch(/^use:metric_/);
    if (like!.field === 'similar') {
      refused(() => saveMetricAsked(w.x('tariq'), { ...input, answers: { similar: like!.answers[0]!.choice } }), /use that metric instead/);
      expect(saveMetricAsked(w.x('tariq'), { ...input, answers: { similar: 'carry-on' } }).commit).not.toBeNull();
    }
  });
  it('says nothing for a metric unlike any in the library', () => {
    expect(Q.similarMetrics({ id: 'x', name: 'Coffee cups', source: 'Kitchen', meaning: 'Cups poured' }, M.metricsOf(buildPlatformOrg(today)))).toEqual([]);
  });
});

describe('who may confirm a rewording (#571 review)', () => {
  const t = { by: 'pavel', verifier: 'amara' };
  it('lets the last verifier, or any admin, confirm it', () => {
    expect(Q.mayConfirmReword(t, { id: 'amara' })).toBe(true);
    expect(Q.mayConfirmReword(t, { id: 'lane', admin: true })).toBe(true);
  });
  it('never lets whoever reworded it confirm it, an admin included, nor anyone else', () => {
    expect(Q.mayConfirmReword(t, { id: 'pavel', admin: true })).toBe(false);
    expect(Q.mayConfirmReword(t, { id: 'yuki' })).toBe(false);
  });
});

describe('a window is said only when it is whole (#574 review)', () => {
  const said = (timeWindow: unknown) => Q.partSaid({ timeWindow } as never, 'window', true);
  it('needs a rolling window’s days and a cumulative one’s date', () => {
    expect(said({ kind: 'rolling', days: 28 })).toBe(true);
    expect(said({ kind: 'rolling', days: 0 })).toBe(false);
    expect(said({ kind: 'cumulative', since: '2026-01-01' })).toBe(true);
    expect(said({ kind: 'cumulative', since: '' })).toBe(false);
    expect(said({ kind: 'point' })).toBe(true);
    expect(said(null)).toBe(false);
  });
});

describe('the source’s owner, by its name when no id is stored (#576 review)', () => {
  const teams = [{ id: 'devex', name: 'Developer Experience', leadId: 'oskar' }];
  const m = { sourceOwnerId: null, sourceOwner: 'developer experience' } as never;
  it('lets someone in the team the words name, or its lead, verify', () => {
    expect(Q.sourceOwnerIdOf(m, teams)).toBe('devex');
    expect(Q.inSourceOwner(m, { id: 'tariq', teamId: 'devex' }, teams)).toBe(true);
    expect(Q.inSourceOwner(m, { id: 'oskar', teamId: 'other' }, teams)).toBe(true);
    expect(Q.inSourceOwner(m, { id: 'yuki', teamId: 'sre' }, teams)).toBe(false);
  });
  it('names nobody for words that match no team or person', () => {
    expect(Q.sourceOwnerIdOf({ sourceOwnerId: null, sourceOwner: 'The data team' } as never, teams)).toBeNull();
  });
});
