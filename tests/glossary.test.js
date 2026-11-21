import { describe, it, expect } from 'vitest';
import { computeTerms } from '../src/core/glossary.js';

describe('computeTerms', () => {
  const gloss = [
    { course: 'Bio', b: 'ATP', i: 'Energieträger', a: ['Adenosintriphosphat'] },
    { course: 'Bio', b: 'Mitose', i: 'Zellteilung', a: [] },
    { course: 'Physik', b: 'ATP', i: 'Anderer Kurs', a: [] }
  ];

  it('ranks terms appearing in correct answer & explanation highest and filters by course', () => {
    const q = {
      _course: 'Bio',
      q: 'Welches Molekül liefert Energie?',
      exp: 'Adenosintriphosphat (ATP) ist der universelle Energieträger.',
      opts: [
        { t: 'ATP', ok: true, why: 'Richtig' },
        { t: 'Mitose', ok: false, why: 'Zellteilung' }
      ]
    };

    const res = computeTerms(q, gloss, [{ course: 'Bio', qs: [q] }]);
    expect(res.length).toBe(2);
    expect(res[0].b).toBe('ATP');
    expect(res[0].course).toBe('Bio');
  });
});
