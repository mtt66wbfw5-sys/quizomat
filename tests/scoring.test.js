import { describe, it, expect } from 'vitest';
import { scoreExamQ, calcGrade, fmtTime, fmtPct, fmtPts } from '../src/core/scoring.js';

describe('scoreExamQ', () => {
  const singleQ = {
    type: 'single',
    opts: [
      { t: 'A', ok: false },
      { t: 'B', ok: true },
      { t: 'C', ok: false }
    ]
  };

  const multiQ = {
    type: 'multi',
    opts: [
      { t: 'A', ok: true },
      { t: 'B', ok: false },
      { t: 'C', ok: true },
      { t: 'D', ok: false }
    ]
  };

  it('scores unanswered questions as 0 pts and open', () => {
    expect(scoreExamQ(singleQ, new Set(), 'all', 'full')).toEqual({
      pts: 0,
      max: 1,
      ok: false,
      part: false,
      open: true
    });
    expect(scoreExamQ(multiQ, new Set(), 'opt', 'full')).toEqual({
      pts: 0,
      max: 4,
      ok: false,
      part: false,
      open: true
    });
  });

  it('scores single choice with and without negative points', () => {
    expect(scoreExamQ(singleQ, new Set([1]), 'all', 'none').pts).toBe(1);
    expect(scoreExamQ(singleQ, new Set([0]), 'all', 'none').pts).toBe(0);
    expect(scoreExamQ(singleQ, new Set([0]), 'all', 'full').pts).toBe(-1);
  });

  it('scores multi choice in opt mode', () => {
    // 1 correct picked (A), 1 missed (C), 2 correctly not picked (B, D) -> tp=1, tn=2, fp=0, fn=1
    const none = scoreExamQ(multiQ, new Set([0]), 'opt', 'none');
    expect(none).toEqual({ pts: 3, max: 4, ok: false, part: true, open: false });

    const clamp = scoreExamQ(multiQ, new Set([0]), 'opt', 'clamp');
    expect(clamp).toEqual({ pts: 2, max: 4, ok: false, part: true, open: false });

    // All wrong: B and D picked -> tp=0, tn=0, fp=2, fn=2 -> raw = -4
    expect(scoreExamQ(multiQ, new Set([1, 3]), 'opt', 'clamp').pts).toBe(0);
    expect(scoreExamQ(multiQ, new Set([1, 3]), 'opt', 'full').pts).toBe(-4);
  });

  it('scores multi choice in pos mode', () => {
    expect(scoreExamQ(multiQ, new Set([0, 2]), 'pos', 'none')).toEqual({
      pts: 2,
      max: 2,
      ok: true,
      part: false,
      open: false
    });
    expect(scoreExamQ(multiQ, new Set([0, 1]), 'pos', 'full').pts).toBe(0);
    expect(scoreExamQ(multiQ, new Set([1, 3]), 'pos', 'full').pts).toBe(-2);
    expect(scoreExamQ(multiQ, new Set([1, 3]), 'pos', 'clamp').pts).toBe(0);
  });

  it('scores multi choice in part mode', () => {
    const res = scoreExamQ(multiQ, new Set([0]), 'part', 'none');
    expect(res.pts).toBeCloseTo(0.75);
    expect(res.max).toBe(1);
    expect(res.part).toBe(true);
  });
});

describe('calcGrade', () => {
  it('calculates grades for 50% schema', () => {
    expect(calcGrade(87.5, 50).g).toBe(1);
    expect(calcGrade(75, 50).g).toBe(2);
    expect(calcGrade(62.5, 50).g).toBe(3);
    expect(calcGrade(50, 50).g).toBe(4);
    expect(calcGrade(49.9, 50)).toMatchObject({ g: 5, ok: false });
  });

  it('calculates grades for 60% and 70% schemas', () => {
    expect(calcGrade(90, 60).g).toBe(1);
    expect(calcGrade(59, 60).g).toBe(5);
    expect(calcGrade(92.5, 70).g).toBe(1);
    expect(calcGrade(70, 70).g).toBe(4);
    expect(calcGrade(69.9, 70).g).toBe(5);
  });
});

describe('formatters', () => {
  it('formats time, percentage, and points in German locale style', () => {
    expect(fmtTime(65)).toBe('01:05');
    expect(fmtPct(87.54)).toBe('87,5 %');
    expect(fmtPts(-1.25)).toBe('−1,25');
  });
});
