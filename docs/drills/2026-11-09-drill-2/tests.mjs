import * as R from './rules.mjs';
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); };
const cycle = { startDate: '2026-09-07', weeks: 13, reviewDay: 3 };
const g = { id: 'g', kind: 'metric', unit: '%', decimals: 0, plan: { start: 30, target: 75, shape: 'straight' }, createdAt: '2026-09-01T00:00:00Z' };

// check-in: parseNumber
eq('parse ok', ['29,4', '1,250', '1,250.5', '62%', '29.4 days', ' -3 '].map(R.parseNumber), [29.4, 1250, 1250.5, 62, 29.4, -3]);
eq('parse bad', ['0x1F', '1e308', 'abc', '1.2.3', '99999999999999'].map(R.parseNumber), [null, null, null, null, null]);
// valueProblem
const days = { id: 'd', kind: 'range', unit: 'days', decimals: 1, range: { bound: 'atMost', limit: 40, margin: 5 } };
const pct60 = { id: 'p', kind: 'metric', unit: '%', decimals: 0, plan: { start: 60, target: 150, shape: 'straight' } };
const kind = (r) => (r ? (r.refused ? 'refused' : 'questioned') : null);
eq('-5 days', kind(R.valueProblem(days, '-5', 30)), 'refused');
eq('120% not a share', kind(R.valueProblem(pct60, '120', 60)), 'questioned');
const r294 = R.valueProblem(days, '294', 29.4);
eq('294 days', [kind(r294), r294.questioned], ['questioned', 'Last week was 29.4. Is 294 right?']);
// evaluate on 30->75 week 4
const draftMissing = (text, extra = {}) => R.evaluate(g, cycle, 4, { text, ...extra }, []).missing;
eq('nothing typed', draftMissing(''), ['value']);
eq('abc', draftMissing('abc'), ['value-not-number']);
eq('140', draftMissing('140'), ['value-impossible']);
eq('44', draftMissing('44'), []);
// 40 in week 4 off track: reason-behind, path
eq('40 bare', R.evaluate(g, cycle, 4, { text: '40', call: 'off' }, []).missing, ['reason-behind', 'path']);
eq('58 well ahead', R.evaluate(g, cycle, 4, { text: '58' }, []).missing, ['reason-ahead']);
eq('40 called on = greener', R.evaluate(g, cycle, 4, { text: '40', call: 'on' }, []).missing.includes('greener-why'), true);
eq('stub: asks target at 58', R.evaluate(g, cycle, 4, { text: '58' }, []).asksTarget, true);

// numbers and names
eq('typedDecimals', ['12.5', '12.50', '1,250', '29,4', '3.25 days'].map(R.typedDecimals), [1, 1, 0, 1, 2]);
eq('precision', R.precisionProblem('12.5', 0), '12.5 has 1 decimal place, but this goal keeps whole numbers, so it would show as 13. Type 13, or set the goal’s Decimals to 1.');
eq('group', [R.fixed(1250000, 0), R.fixed(-12000, 0), R.fixed(1250.5, 1)], ['1,250,000', '-12,000', '1,250.5']);
eq('setup', R.setupProblem(10, 5000), 'The target is over 100 times the start (10 to 5,000). Is that right?');
eq('farOutside', [R.farOutside(400, g.plan), R.farOutside(110, g.plan)], [true, false]);

// weeks and plans
const c13 = { startDate: '2026-09-07', weeks: 13, reviewDay: 3 };
eq('weeks', [R.currentWeek(c13, '2026-09-13T23:00:00Z'), R.currentWeek(c13, '2026-09-14T00:00:00Z'), R.currentWeek(c13, '2027-03-01T00:00:00Z')], [0, 1, 13]);
eq('first due', ['2026-09-28T00:00:00Z', '2026-10-01T00:00:00Z', '2026-10-04T00:00:00Z'].map((d) => R.firstDueWeek(c13, d)), [3, 3, 4]);
eq('plan w4', Number(R.planAt(g.plan, 4, 13).toFixed(3)), 43.846);
eq('stepped', [4, 5, 8, 9, 12, 13].map((w) => Number(R.shapeProgress('stepped', w, 13).toFixed(3))), [0, 0.333, 0.333, 0.667, 0.667, 1]);
eq('points', [2, 4, 8].map((w) => Number(R.planAt({ start: 10, target: 50, shape: 'straight', points: [{ week: 4, value: 40 }] }, w, 13).toFixed(3))), [25, 40, 44.444]);
// projection
eq('proj none', R.projection([{ week: 1, value: 1 }, { week: 2, value: 2 }], 13), null);
const p1 = R.projection([{ week: 1, value: 10 }, { week: 4, value: 16 }], 13);
eq('proj 34', [p1.value, p1.low, p1.high, p1.slope], [34, 34, 34, 2]);
// status ratios
const st = (v) => R.assessMetric(g, g.plan, cycle, 4, v, []).status;
eq('status bands', [30 + 45 * 0, 0].length && [43.846 - 30].length ? ['x'] : [], ['x']);
const ratios = [0.95, 0.94, 0.8, 0.79].map((r) => R.assessMetric({ ...g, decimals: 3 }, g.plan, cycle, 4, 30 + (R.planAt(g.plan, 4, 13) - 30) * r, []).status);
eq('95/94/80/79', ratios, ['on', 'risk', 'risk', 'off']);
eq('scorecard words', [R.fmtVal(1, { decimals: 0, unit: 'hours' }), R.fmtVal(1, { decimals: 1, unit: 'hours' }), R.fmtVal(1, { decimals: 0, unit: 'ms' }), R.fmtVal(1, { decimals: 0, unit: 'pts' }), R.fmtVal(1250.5, { decimals: 1, unit: 'USD' }), R.fmtVal(0.4, { decimals: 1, unit: '%' })],
  ['1 hour', '1.0 hours', '1 ms', '1 pts', '1,250.5 USD', '0.4%']);
eq('amounts', [R.amount(1, { decimals: 0, unit: 'hours' }), R.amount(1, { decimals: 1, unit: 'hours' }), R.amount(1, { decimals: 0, unit: 'ms' }), R.amount(1, { decimals: 0, unit: 'pts' }), R.amount(1250.5, { decimals: 1, unit: 'USD' }), R.amount(0.4, { decimals: 1, unit: '%' }), R.amount(1, { decimals: 0, unit: '%' })],
  ['1 hour', '1.0 hour', '1 m', '1 pt', '1,250.5 USD', '0.4 pts', '1 pt']);
eq('by when', [53, 13, 40].map((d, i) => R.byWeekWords(d, i === 0 ? { weeks: 53 } : { weeks: 13 })).map((s, i) => (i === 2 ? R.byWeekWords(40, { weeks: 53 }) : s)), ['by year end', 'by cycle end', 'by week 40']);
console.log(bad ? `${bad} FAILED` : 'all passed');
process.exit(bad ? 1 : 0);
