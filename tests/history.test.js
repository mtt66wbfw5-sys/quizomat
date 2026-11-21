import { describe, it, expect } from 'vitest';
import {
  buildExamAttempt,
  mergeAttempts,
  summarizeHistory,
  weakestChapters
} from '../src/core/history.js';

describe('Exam History', () => {
  const qs = [
    {
      _title: 'Kapitel 1',
      type: 'single',
      opts: [
        { t: 'A', ok: true },
        { t: 'B', ok: false }
      ]
    },
    {
      _title: 'Kapitel 2',
      type: 'single',
      opts: [
        { t: 'A', ok: false },
        { t: 'B', ok: true }
      ]
    }
  ];

  it('builds a normalized exam attempt with chapter breakdown and grade', () => {
    const attempt = buildExamAttempt({
      id: 'ex1',
      course: 'Informatik',
      questions: qs,
      picks: [new Set([0]), new Set([0])],
      elapsedSec: 120,
      durationMins: 30,
      passPct: 50,
      scoreMode: 'all',
      negMode: 'none',
      createdAt: '2026-11-21T02:00:00.000Z'
    });

    expect(attempt.passed).toBe(true);
    expect(attempt.grade).toBe(4);
    expect(attempt.pct).toBe(50);
    expect(attempt.chapters).toEqual([
      { title: 'Kapitel 1', pts: 1, max: 1, pct: 100 },
      { title: 'Kapitel 2', pts: 0, max: 1, pct: 0 }
    ]);
  });

  it('merges attempts without duplicates, newest first', () => {
    const a1 = { id: '1', createdAt: '2026-11-20T10:00:00Z' };
    const a2 = { id: '2', createdAt: '2026-11-21T10:00:00Z' };
    const merged = mergeAttempts([a1], [a1, a2]);
    expect(merged.map((x) => x.id)).toEqual(['2', '1']);
  });

  it('summarizes history and finds weakest chapters', () => {
    const attempts = [
      {
        course: 'Bio',
        grade: 2,
        passed: true,
        pct: 80,
        chapters: [
          { title: 'Zelle', pts: 4, max: 5, pct: 80 },
          { title: 'Genetik', pts: 1, max: 5, pct: 20 }
        ]
      },
      {
        course: 'Bio',
        grade: 4,
        passed: true,
        pct: 55,
        chapters: [
          { title: 'Zelle', pts: 3, max: 5, pct: 60 },
          { title: 'Genetik', pts: 2, max: 5, pct: 40 }
        ]
      }
    ];

    expect(summarizeHistory(attempts)).toEqual({
      count: 2,
      passedCount: 2,
      passRate: 100,
      avgGrade: 3,
      avgPct: 67.5,
      bestPct: 80
    });

    const weak = weakestChapters(attempts);
    expect(weak[0].title).toBe('Genetik');
    expect(weak[0].pct).toBe(30);
    expect(weak[1].title).toBe('Zelle');
    expect(weak[1].pct).toBe(70);
  });
});
