import { seed } from './seed';
import {
  changeFromRow, changeToRow, checkInFromRow, checkInToRow, cycleFromRow, cycleToRow, decisionFromRow, decisionToRow,
  goalFromRows, goalToRows, personFromRow, personToRow, teamFromRow, teamToRow,
} from './rows';

describe('rows', () => {
  const s = seed(new Date('2026-10-30T12:00:00Z'));
  const ws = 'example';
  it('round-trips every record of the demo data', () => {
    expect(s.teams.map((t) => teamFromRow(teamToRow(ws, t)))).toEqual(s.teams);
    expect(s.people.map((p) => personFromRow(personToRow(ws, p)))).toEqual(s.people);
    expect(s.cycles.map((c) => cycleFromRow(cycleToRow(ws, c)))).toEqual(s.cycles);
    const rows = s.goals.map((g) => goalToRows(ws, g));
    expect(rows.map((r) => goalFromRows(r.goal, rows.flatMap((x) => x.stages)))).toEqual(s.goals);
    expect(s.checkIns.map((c) => checkInFromRow(checkInToRow(ws, c)))).toEqual(s.checkIns);
    expect(s.decisions.map((d) => decisionFromRow(decisionToRow(ws, d)))).toEqual(s.decisions);
    expect(s.changes.map((c) => changeFromRow(changeToRow(ws, c)))).toEqual(s.changes);
  });
  it('tags every row with its workspace', () => {
    expect(personToRow('w1', s.people[0]!).workspace_id).toBe('w1');
    expect(goalToRows('w1', s.goals[0]!).goal.workspace_id).toBe('w1');
  });
  it('reads Postgres numerics sent as strings and timestamps in any ISO form', () => {
    const c = checkInToRow(ws, s.checkIns[0]!);
    const back = checkInFromRow({ ...c, value: '33.5' as unknown as number, posted_at: c.posted_at.replace('Z', '+00:00') });
    expect(back.value).toBe(33.5);
    expect(back.postedAt).toBe(s.checkIns[0]!.postedAt);
  });
});
