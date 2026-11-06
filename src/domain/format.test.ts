import { describe, expect, it } from 'vitest';
import { fmt, fmtDiff } from './format';

describe('units after a number', () => {
  it('reads singular after exactly one', () => {
    expect(fmtDiff(-1, { unit: 'templates', decimals: 0 })).toBe('1 template');
    expect(fmt(1, { unit: 'hours', decimals: 0 })).toBe('1 hour');
    expect(fmtDiff(1, { unit: '%', decimals: 0 })).toBe('1 pt');
  });
  it('leaves plurals, decimals and symbols alone', () => {
    expect(fmtDiff(2, { unit: 'templates', decimals: 0 })).toBe('2 templates');
    expect(fmt(1, { unit: 'hours', decimals: 1 })).toBe('1.0 hours');
    expect(fmt(1, { unit: 'k$', decimals: 0 })).toBe('1 k$');
    expect(fmt(1, { unit: 'USD', decimals: 0 })).toBe('1 USD');
    expect(fmt(1, { unit: 'min', decimals: 0 })).toBe('1 min');
  });
});
