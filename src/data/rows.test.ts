import { seed } from './seed';
import { checkInFromRow, checkInToRow, cycleFromRow, cycleToRow, goalFromRows, goalToRows, personFromRow, personToRow, teamFromRow, teamToRow } from './rows';

describe('rows', () => {
  const s = seed(new Date('2026-10-30T12:00:00Z'));
  it('round-trips every record of the demo data', () => {
    expect(s.teams.map((t) => teamFromRow(teamToRow(t)))).toEqual(s.teams);
    expect(s.people.map((p) => personFromRow(personToRow(p)))).toEqual(s.people);
    expect(s.cycles.map((c) => cycleFromRow(cycleToRow(c)))).toEqual(s.cycles);
    const rows = s.goals.map(goalToRows);
    expect(rows.map((r) => goalFromRows(r.goal, rows.flatMap((x) => x.stages)))).toEqual(s.goals);
    expect(s.checkIns.map((c) => checkInFromRow(checkInToRow(c)))).toEqual(s.checkIns);
  });
  it('reads Postgres numerics sent as strings and timestamps in any ISO form', () => {
    const c = checkInToRow(s.checkIns[0]!);
    const back = checkInFromRow({ ...c, value: '33.5' as unknown as number, posted_at: c.posted_at.replace('Z', '+00:00') });
    expect(back.value).toBe(33.5);
    expect(back.postedAt).toBe(s.checkIns[0]!.postedAt);
  });
});
