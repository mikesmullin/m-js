/**
 * Longest increasing subsequence — VDOM list reorder helper (gobbler port).
 */
import { describe, test, expect } from 'bun:test';
import { longestIncreasingSubsequence } from '../src/m.js';

describe('longestIncreasingSubsequence', () => {
  test('identity sequence — all stay', () => {
    const stay = longestIncreasingSubsequence([0, 1, 2, 3]);
    expect(stay.has(0)).toBe(true);
    expect(stay.has(1)).toBe(true);
    expect(stay.has(2)).toBe(true);
    expect(stay.has(3)).toBe(true);
    expect(stay.size).toBe(4);
  });

  test('reversed — single element subsequence', () => {
    const stay = longestIncreasingSubsequence([3, 2, 1, 0]);
    expect(stay.size).toBeGreaterThanOrEqual(1);
    // any single value is a valid LIS of length 1
    for (const v of stay) {
      expect([0, 1, 2, 3]).toContain(v);
    }
  });

  test('partial reorder keeps longest stable run', () => {
    // old positions mapped to new indices: item0→0, item1→2, item2→1, item3→3
    // LIS of [0,2,1,3] includes 0,2,3 or 0,1,3
    const stay = longestIncreasingSubsequence([0, 2, 1, 3]);
    expect(stay.size).toBeGreaterThanOrEqual(2);
    expect(Math.max(...stay)).toBeLessThanOrEqual(3);
  });

  test('sparse / holes from missing keys are skipped', () => {
    const a = [];
    a[0] = 0;
    a[2] = 2; // index 1 missing (deleted item)
    const stay = longestIncreasingSubsequence(a);
    expect(stay.has(0)).toBe(true);
    expect(stay.has(2)).toBe(true);
  });

  test('empty input', () => {
    expect(longestIncreasingSubsequence([]).size).toBe(0);
  });
});
