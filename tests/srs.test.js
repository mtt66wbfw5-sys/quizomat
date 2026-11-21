import { describe, it, expect } from 'vitest';
import {
  DAY_MS,
  updateSrs,
  isScheduledDue,
  collectDueQuestions,
  formatRelativeDue
} from '../src/core/srs.js';

describe('Spaced Repetition (SRS)', () => {
  const t0 = Date.UTC(2026, 10, 21, 10, 0, 0);

  it('schedules intervals 1d -> 3d -> scaled by ease on consecutive correct answers', () => {
    const q = { q: 'Test' };
    const s1 = updateSrs(q, true, t0);
    expect(s1.reps).toBe(1);
    expect(s1.interval).toBe(1);
    expect(s1.nextReview).toBe(t0 + 1 * DAY_MS);

    const s2 = updateSrs(q, true, t0 + 1 * DAY_MS);
    expect(s2.reps).toBe(2);
    expect(s2.interval).toBe(3);

    const s3 = updateSrs(q, true, t0 + 4 * DAY_MS);
    expect(s3.reps).toBe(3);
    expect(s3.interval).toBeGreaterThanOrEqual(7);
  });

  it('resets interval and marks immediately due on wrong answer', () => {
    const q = { q: 'Test', srs: { ease: 2.5, interval: 10, reps: 3, lastReview: t0, nextReview: t0 + 10 * DAY_MS } };
    const s = updateSrs(q, false, t0 + DAY_MS);
    expect(s.reps).toBe(0);
    expect(s.interval).toBe(0);
    expect(s.ease).toBe(2.3);
    expect(isScheduledDue(q, t0 + DAY_MS)).toBe(true);
  });

  it('collects due questions sorted by wrong/overdue first and computes nextDueAt', () => {
    const sets = [
      {
        id: 's1',
        course: 'Bio',
        title: 'V1',
        qs: [
          { q: 'Future', srs: { nextReview: t0 + 2 * DAY_MS } },
          { q: 'Overdue', srs: { nextReview: t0 - DAY_MS }, wrong: false },
          { q: 'WrongDue', srs: { nextReview: t0 }, wrong: true },
          { q: 'BrandNew' }
        ]
      }
    ];
    const res = collectDueQuestions(sets, null, t0);
    expect(res.dueCount).toBe(2);
    expect(res.due[0].q).toBe('WrongDue');
    expect(res.due[1].q).toBe('Overdue');
    expect(res.nextDueAt).toBe(t0 + 2 * DAY_MS);
  });

  it('formats relative due dates in German', () => {
    expect(formatRelativeDue(t0 - 1000, t0)).toBe('heute fällig');
    expect(formatRelativeDue(t0 + DAY_MS, t0)).toBe('morgen fällig');
    expect(formatRelativeDue(t0 + 4 * DAY_MS, t0)).toBe('in 4 Tagen');
  });
});
