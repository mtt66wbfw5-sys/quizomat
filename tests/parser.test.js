import { describe, it, expect } from 'vitest';
import { cleanJson, parseSets, parseGloss, extractGloss } from '../src/core/parser.js';

describe('cleanJson', () => {
  it('extracts JSON from markdown code fences', () => {
    const raw = 'Hier ist dein JSON:\n```json\n{"kurs":"Bio","titel":"V1","fragen":[]}\n```\nViel Erfolg!';
    expect(cleanJson(raw)).toBe('{"kurs":"Bio","titel":"V1","fragen":[]}');
  });
});

describe('parseSets', () => {
  it('parses single, multi, and tf questions with progress flags', () => {
    const json = JSON.stringify({
      kurs: 'Informatik',
      titel: 'Kapitel 1',
      fragen: [
        {
          typ: 'single',
          frage: 'Was ist 2+2?',
          optionen: ['3', '4'],
          richtig: [1],
          erklaerung: 'Mathe',
          begruendungen: ['Falsch', 'Richtig'],
          bild: 'https://example.com/grafik.png',
          bildText: 'Rechenbeispiel',
          streak: 2,
          flagged: true
        },
        {
          typ: 'multi',
          frage: 'Gerade Zahlen?',
          optionen: ['2', '3', '4'],
          richtig: [0, 2]
        },
        {
          typ: 'tf',
          frage: 'Wasser ist nass.',
          richtig: 'wahr',
          begruendungen: ['Stimmt', 'Stimmt nicht']
        }
      ]
    });

    const sets = parseSets(json);
    expect(sets).toHaveLength(1);
    expect(sets[0].course).toBe('Informatik');
    expect(sets[0].qs).toHaveLength(3);
    expect(sets[0].qs[0]).toMatchObject({
      type: 'single',
      streak: 2,
      flagged: true,
      img: 'https://example.com/grafik.png',
      imgAlt: 'Rechenbeispiel'
    });
    expect(sets[0].qs[1]).toMatchObject({ type: 'multi' });
    expect(sets[0].qs[2]).toMatchObject({ fixed: true, type: 'single' });
    expect(sets[0].qs[2].opts[0]).toMatchObject({ t: 'Wahr', ok: true, why: 'Stimmt' });
  });

  it('throws readable German errors on invalid input', () => {
    expect(() => parseSets('{broken')).toThrow(/Kein gültiges JSON/);
    expect(() =>
      parseSets(JSON.stringify({ kurs: 'X', titel: 'Y', fragen: [{ typ: 'single', frage: 'F', optionen: ['A'], richtig: [0] }] }))
    ).toThrow(/mindestens 2/);
  });
});

describe('parseGloss & extractGloss', () => {
  it('parses glossary entries and assigns default course', () => {
    const entries = parseGloss(
      JSON.stringify({ glossar: [{ begriff: 'ATP', info: 'Energieträger', alias: ['Adenosintriphosphat'] }] }),
      'Biochemie'
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].kurs).toBe('Biochemie');
    expect(extractGloss([{ kurs: 'A', glossar: [{ begriff: 'X', info: 'Y' }] }])).toHaveLength(1);
  });
});
