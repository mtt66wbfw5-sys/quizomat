import { describe, it, expect } from 'vitest';
import {
  setsToRows,
  rowsToSets,
  glossToRows,
  rowsToGloss,
  attemptsToRows,
  rowsToAttempts
} from '../src/sync/supabaseSync.js';

describe('Supabase row mappers', () => {
  it('round-trips sets with sort order and course config', () => {
    const sets = [
      { id: 's1', course: 'Mathe', title: 'Kapitel 1', qs: [{ q: '1+1?', opts: [] }], cfg: { positivAb: 60 } },
      { id: 's2', course: 'Mathe', title: 'Kapitel 2', qs: [] }
    ];
    const rows = setsToRows('user-1', sets, '2026-11-21T01:00:00.000Z');
    expect(rows[0].sort_order).toBe(0);
    expect(rows[1].sort_order).toBe(1);
    expect(rowsToSets([rows[1], rows[0]])).toEqual(sets);
  });

  it('round-trips per-course glossary entries and deduplicates identical course+term', () => {
    const gloss = [
      { course: 'Bio', b: 'ATP', i: 'Alt', a: [] },
      { course: 'Bio', b: 'ATP', i: 'Neu', a: ['Adenosintriphosphat'] },
      { course: 'Chemie', b: 'ATP', i: 'Chemie-Info', a: [] }
    ];
    const rows = glossToRows('user-1', gloss, '2026-11-21T01:00:00.000Z');
    expect(rows).toHaveLength(2);
    expect(rowsToGloss(rows)).toEqual([
      { course: 'Bio', b: 'ATP', i: 'Neu', a: ['Adenosintriphosphat'] },
      { course: 'Chemie', b: 'ATP', i: 'Chemie-Info', a: [] }
    ]);
  });

  it('round-trips exam attempts sorted newest first', () => {
    const attempts = [
      {
        id: 'ex1',
        course: 'Bio',
        createdAt: '2026-11-20T10:00:00.000Z',
        grade: 2,
        passed: true,
        scorePts: 16,
        maxPts: 20,
        pct: 80,
        correctCount: 16,
        totalCount: 20,
        elapsedSec: 600,
        durationMins: 30,
        passPct: 50,
        scoreMode: 'all',
        negMode: 'none',
        chapters: [{ title: 'V1', pts: 16, max: 20, pct: 80 }]
      }
    ];
    const rows = attemptsToRows('user-1', attempts);
    expect(rowsToAttempts(rows)).toEqual(attempts);
  });
});
