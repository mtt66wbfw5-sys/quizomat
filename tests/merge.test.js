import { describe, it, expect } from 'vitest';
import { mergeSets3Way, mergeQuestion } from '../src/core/merge.js';

describe('mergeQuestion', () => {
  it('keeps highest streak and unions flagged state', () => {
    const L = { q: 'F1', streak: 2, wrong: false, flagged: true };
    const R = { q: 'F1', streak: 3, wrong: false, flagged: false };
    expect(mergeQuestion(L, R, false)).toMatchObject({ streak: 3, wrong: false, flagged: true });
  });
});

describe('mergeSets3Way', () => {
  it('preserves local additions and remote deletions without data loss', () => {
    const base = [
      {
        id: '1',
        course: 'Bio',
        title: 'V1',
        qs: [
          { q: 'Alt1', streak: 0 },
          { q: 'Alt2', streak: 0 }
        ]
      }
    ];
    // Local adds NeuL
    const local = [
      {
        id: '1',
        course: 'Bio',
        title: 'V1',
        qs: [
          { q: 'Alt1', streak: 0 },
          { q: 'Alt2', streak: 0 },
          { q: 'NeuL', streak: 1 }
        ]
      }
    ];
    // Remote deletes Alt2 and updates Alt1 streak
    const remote = [
      {
        id: '1',
        course: 'Bio',
        title: 'V1',
        qs: [{ q: 'Alt1', streak: 2 }]
      }
    ];

    const merged = mergeSets3Way(base, local, remote, true);
    expect(merged).toHaveLength(1);
    const qs = merged[0].qs.map((q) => q.q);
    expect(qs).toContain('Alt1');
    expect(qs).toContain('NeuL');
    expect(qs).not.toContain('Alt2');
    expect(merged[0].qs.find((q) => q.q === 'Alt1').streak).toBe(2);
  });
});
