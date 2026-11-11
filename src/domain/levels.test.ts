/* Levels read from one place (workspace settings spec, 2.1; CF1). */
import { describe, expect, it } from 'vitest';
import { everydayLevel, hasLevels, isEveryday, isTop, levelIds, levelName, levelRank, levelsOf } from './levels';
import type { LevelDef } from './types';

const four: LevelDef[] = [
  { id: 'north-star', name: 'Company', hint: '' }, { id: 'lv-1', name: 'Group', hint: '' },
  { id: 'svp', name: 'Division', hint: '' }, { id: 'team', name: 'Team', hint: '' },
];

describe('levels (CF1)', () => {
  it('are Faro’s three when a cycle sets none', () => {
    expect(levelsOf(null).map((l) => l.name).join(', ')).toBe('North star, SVP, Team');
    expect(everydayLevel({})).toBe('team');
    expect(isTop(undefined, 'north-star')).toBe(true);
    expect(isEveryday(null, 'team')).toBe(true);
    expect(isEveryday(null, 'svp')).toBe(false);
  });
  it('read a cycle’s own: names, rank, the tag', () => {
    const c = { levels: four };
    expect(levelName(c, 'svp')).toBe('Division');
    expect(levelRank(c, 'svp')).toBe(2);
    expect(isEveryday(c, 'svp')).toBe(false);
    expect(isEveryday(c, 'team')).toBe(true);
    expect(['team', 'svp', 'lv-1', 'north-star'].sort((a, b) => levelRank(c, a) - levelRank(c, b)).map((id) => levelName(c, id))).toEqual(['Company', 'Group', 'Division', 'Team']);
  });
  it('with one level, tag nothing and have no top', () => {
    const c = { levels: [{ id: 'team', name: 'Team', hint: '' }] };
    expect(hasLevels(c)).toBe(false);
    expect(isTop(c, 'team')).toBe(false);
    expect(isEveryday(c, 'team')).toBe(true);
  });
  it('keep a removed level’s name for History, and leave it out of the list', () => {
    const c = { levels: four.map((l) => (l.id === 'svp' ? { ...l, name: 'SVP', removedAt: '2026-11-11T10:00:00Z' } : l)) };
    expect(levelName(c, 'svp')).toBe('SVP');
    expect(levelIds(c)).toEqual(['north-star', 'lv-1', 'team']);
    expect(levelRank(c, 'svp')).toBe(3);
    expect(levelName(c, 'gone')).toBe('gone');
  });
});
