/* The conformance data (backlog 8b): recompute every row from spec/conformance/workspace.json with Faro's own rules,
   and fail on any difference from the files. A rebuild proves itself the same way (spec/conformance/README.md). */
import fs from 'node:fs';
import path from 'node:path';
import { CHANGES_HEADER, changeRowsOf, conformanceFiles, EDGE_FILES, importCases, importRowsOf, IMPORT_HEADER, type ConformanceWorkspace, type ScreenCases } from './conformance';
import { edgeWorkspace } from './edge';
import { CHECK_KINDS, MUST_KINDS, NOTE_KINDS } from '../domain/problemLevels';
import { ISSUE_KINDS } from '../domain/issueKinds';

const dir = path.resolve(__dirname, '../../spec/conformance');

describe('the conformance data', () => {
  const w = JSON.parse(fs.readFileSync(path.join(dir, 'workspace.json'), 'utf8')) as ConformanceWorkspace;
  const made = conformanceFiles(w);

  it('makes stage 3’s files from screen-cases.json, as the drill hands them over (drill 11, gap S3-1)', () => {
    const cases = JSON.parse(fs.readFileSync(path.join(dir, 'screen-cases.json'), 'utf8')) as ScreenCases;
    const again = conformanceFiles(w, cases);
    for (const f of ['navigation.csv', 'find.csv', 'readback.csv', 'home.csv']) expect(again[f]).toBe(made[f]);
    // The rows are the cases' rows: one search, one draft, one viewer on one day.
    const one = conformanceFiles(w, { ...cases, find: [cases.find[0]!], readback: { ...cases.readback, cases: [cases.readback.cases[0]!] }, home: { viewers: ['tunde'], days: [cases.home.days[13]!] } });
    expect(['find.csv', 'readback.csv', 'home.csv'].map((f) => one[f]!.trimEnd().split('\n').length)).toEqual([2, 2, 2]);
  });

  for (const file of Object.keys(made)) {
    it(`${file}: every row is what the rules give for workspace.json`, () => {
      const want = made[file]!.split('\n');
      const have = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
      // The first few rows that differ, each as the file has it and as the rules give it.
      const diff: string[] = [];
      for (let i = 0; i < Math.max(want.length, have.length) && diff.length < 10; i++) if (want[i] !== have[i]) diff.push(`row ${i}: file “${have[i] ?? ''}”, rules “${want[i] ?? ''}”`);
      expect(diff).toEqual([]);
    });
  }
});

describe('pinned rows', () => {
  const rows = fs.readFileSync(path.join(dir, 'scorecard-words.csv'), 'utf8').split('\n');
  it('a unit of ms keeps its s after 1: G-58 in week 10 is “1 ms worse”, not “1 m worse” (backlog 0u)', () => {
    expect(rows).toContain('10,G-58,since,1 ms worse,Vs last week,was 101 ms in week 9');
    expect(rows.some((r) => / 1 m (worse|better|ahead|behind|to go|over)/.test(r))).toBe(false);
  });
});

describe('changes.csv (stage 2’s drill)', () => {
  const w = JSON.parse(fs.readFileSync(path.join(dir, 'workspace.json'), 'utf8')) as ConformanceWorkspace;
  const rows = changeRowsOf(w);
  const head = (c: string) => rows.find((r) => r[0] === c && r[1] === '0')!;
  const items = (c: string) => rows.filter((r) => r[0] === c && r[1] !== '0');
  const col = (n: string) => CHANGES_HEADER.indexOf(n);

  it('runs every import case, and each case that blocks saves nothing', () => {
    for (const c of importCases(w)) expect(head(c.case)).toBeTruthy();
    expect(head('required-empty')[col('saves')]).toBe('no');
  });

  it('saves each of the five save cases as one item of its kind', () => {
    const kinds = { 'saves-check-in': 'check-in', 'saves-plan-with-reason': 'plan', 'saves-new-goal': 'new goal', 'saves-person': 'person', 'saves-stop': 'stop goal' };
    for (const [c, kind] of Object.entries(kinds)) {
      expect(head(c)[col('saves')], c).toBe('yes');
      expect(items(c).map((r) => r[col('kind')]), c).toEqual([kind]);
    }
    expect(items('saves-plan-with-reason')[0]![col('needs_reason')]).toBe('yes');
    expect(items('saves-person')[0]![col('diffs')]).toContain('Team: CI/CD → Build & Release');
  });

  it('an admin’s correction of someone else’s check-in keeps its author, with the reason first (Lane, 14 Nov)', () => {
    expect(head('corrects-keeps-author')[col('saves')]).toBe('yes');
    const [it] = items('corrects-keeps-author');
    expect(it![col('kind')]).toBe('replaces check-in');
    expect(it![col('author')]).not.toBe('');
    expect(it![col('author')]).not.toBe('amara');
    expect(it![col('diffs')]).toMatch(/^Why corrected: — → The tracker had last week’s number in it/);
  });
});

describe('import.csv covers every issue kind (KT gap 2)', () => {
  const w = JSON.parse(fs.readFileSync(path.join(dir, 'workspace.json'), 'utf8')) as ConformanceWorkspace;
  const rows = importRowsOf(w);
  const raised = new Set(rows.flatMap((r) => r[IMPORT_HEADER.indexOf('kinds')]!.split(' ').filter(Boolean)));
  const all = [...MUST_KINDS, ...CHECK_KINDS, ...NOTE_KINDS];

  it('every kind the engine raises has a case that raises it', () => {
    expect(all.filter((k) => !ISSUE_KINDS[k].raisedBy && !raised.has(k))).toEqual([]);
  });

  it('a kind said not to be raised by the engine has no case, and says what raises it instead', () => {
    expect(all.filter((k) => ISSUE_KINDS[k].raisedBy && raised.has(k))).toEqual([]);
    for (const k of all) expect(ISSUE_KINDS[k].when.length).toBeGreaterThan(10);
  });

  it('the kinds page names each kind once, with its case', () => {
    const page = fs.readFileSync(path.resolve(__dirname, '../../spec/core/import-issues.md'), 'utf8');
    for (const k of all) expect(page.match(new RegExp(`^\\| \`${k}\` \\|`, 'gm'))?.length).toBe(1);
    expect(page).toContain('| `near-ref` | ');
    expect(page).toMatch(/\| Goals \| Goal \| `goal name`/);
  });
});

describe('the edge-case workspace (item 11: the cases the demo never has)', () => {
  const edge = path.join(dir, 'edge');
  const w = JSON.parse(fs.readFileSync(path.join(edge, 'workspace.json'), 'utf8')) as ConformanceWorkspace;
  const made = conformanceFiles(w);
  const row = (file: string, start: string) => made[file]!.split('\n').find((r) => r.startsWith(start));

  it('makes only stage 1’s files (and scorecard-words.csv), and is what src/spec/edge.ts gives', () => {
    expect(Object.keys(made).sort()).toEqual(EDGE_FILES.map((f) => `${f}.csv`).sort());
    expect(w).toEqual(JSON.parse(JSON.stringify(edgeWorkspace())));
  });

  for (const file of Object.keys(made)) {
    it(`edge/${file}: every row is what the rules give for edge/workspace.json`, () => {
      expect(fs.readFileSync(path.join(edge, file), 'utf8')).toBe(made[file]);
    });
  }

  // Each gap the full drill's stage 1 passed while wrong (1.3, 1.9 and 1.12) has a row the wrong guess misses.
  it('1.3: the week before is the latest earlier week with a check-in, and only the same week makes a correction', () => {
    expect(row('checkin.csv', 'e6-4,')).toMatch(/,$/); // met in week 2, nothing for week 3: not reached again
    expect(row('checkin.csv', 'e6-7,')).toMatch(/,reached$/);
    expect(row('checkin.csv', 'e7-2c,')).toMatch(/,$/); // a second check-in for week 2
    expect(row('checkin.csv', 'e7-4,')).toMatch(/,reached$/); // week 5 posted first is not a correction
    expect(row('checkin.csv', 'e7-6,')).toMatch(/,$/); // backfilled
  });

  it('1.9: 110 and 400 are both refused for a share; 120 is only questioned where the plan passes 100%', () => {
    expect(row('checkin.csv', 'e4-2,')).toContain(',value-impossible reason-ahead,');
    expect(row('checkin.csv', 'e4-3,')).toContain(',value-impossible reason-ahead,');
    expect(row('checkin.csv', 'e5-2,')).not.toContain('value-impossible');
  });

  it('1.12: in a full tie the status keeps the first record and the calculation takes the last', () => {
    expect(row('status.csv', '3,E-9,')).toBe('3,E-9,metric,off,on,no,3,2');
    expect(row('status.csv', '6,E-9,')).toBe('6,E-9,metric,on,off,no,6,2');
    expect(row('status.csv', '5,E-10,')).toBe('5,E-10,metric,risk,on,yes,4,2');
  });

  it('1.7: below zero is refused for a time or money unit, not for ms', () => {
    expect(row('checkin.csv', 'e10-9,')).toContain('value-impossible');
    expect(row('checkin.csv', 'e11-9,')).toContain('value-impossible');
    expect(row('checkin.csv', 'e14-2,')).not.toContain('value-impossible');
  });

  it('1.5 and 1.8: a range between two bounds, and an action in hand until a new flag', () => {
    expect(made['status.csv']!.split('\n').filter((r) => r.includes(',E-1,range,')).map((r) => r.split(',')[4]).slice(1, 9)).toEqual(['on', 'risk', 'risk', 'risk', 'risk', 'risk', 'off', 'risk']);
    expect(row('flags.csv', '5,E-12,')).toBe('5,E-12,off trend due,action,no,handled');
    expect(row('flags.csv', '6,E-12,')).toBe('6,E-12,off missed-path trend due,,yes,needs');
  });

  // The second full drill's stage 1 guessed these with nothing to score them (gaps 6, 16 and 17).
  it('a latest check-in with no number still projects; nothing planned yet is never well ahead; a guard counts at the check-in only', () => {
    expect(row('status.csv', '5,E-16,')).toBe('5,E-16,metric,on,none,no,5,2');
    expect(row('projection.csv', '5,E-16,')).toMatch(/^5,E-16,metric,13,[\d.]+,[\d.]+,[\d.]+,[\d.]+,1,4,no$/);
    expect(row('checkin.csv', 'e17-1,')).toBe('e17-1,1,E-17,on,,no,no,,on,no,,');
    expect(row('checkin.csv', 'e17-3,')).toMatch(/^e17-3,3,E-17,risk,behind,/);
    expect(row('checkin.csv', 'e18-5,')).toMatch(/^e18-5,5,E-18,risk,behind,.*,on,yes,/);
    expect(row('status.csv', '5,E-18,')).toBe('5,E-18,metric,on,on,yes,5,1');
  });
});
