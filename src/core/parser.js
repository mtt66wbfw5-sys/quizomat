export const KINDS = [
  ['single', 'Single Choice'],
  ['multi', 'Multiple Choice'],
  ['tf', 'Wahr/Falsch']
];

export const PROMPT = `Erstelle aus den angehängten Unterlagen [ANZAHL] Prüfungsfragen als JSON. Mische Single Choice (typ "single"), Multiple Choice mit mehreren richtigen Antworten (typ "multi") und Wahr/Falsch (typ "tf"). Falsche Antworten sollen plausibel sein und typische Verwechslungen aus dem Stoff abbilden. Gib nur einen JSON-Codeblock in genau diesem Format aus:

{"kurs":"Name des Kurses","titel":"Thema / Vorlesung","fragen":[
 {"typ":"single","frage":"…","optionen":["A","B","C","D"],"richtig":[1],"erklaerung":"Warum die richtige Antwort stimmt.","begruendungen":["Warum A falsch ist","Warum B richtig ist","Warum C falsch ist","Warum D falsch ist"]},
 {"typ":"multi","frage":"…","optionen":["A","B","C","D"],"richtig":[0,2],"erklaerung":"Gesamterklärung zur Frage.","begruendungen":["Warum A richtig ist","Warum B falsch ist","Warum C richtig ist","Warum D falsch ist"]},
 {"typ":"tf","frage":"Aussage …","richtig":true,"erklaerung":"Warum die Aussage wahr bzw. falsch ist.","begruendungen":["Warum Wahr zutrifft bzw. nicht zutrifft","Warum Falsch nicht zutrifft bzw. zutrifft"]}
]}

"richtig" enthält die Indizes (ab 0) der richtigen Optionen (bzw. true/false bei "tf"). Jede Frage enthält eine allgemeine "erklaerung" sowie in "begruendungen" für jede einzelne Antwortoption eine kurze Begründung.`;

export const GPROMPT = `Erstelle aus den angehängten Unterlagen ein Glossar der wichtigsten Fachbegriffe als JSON. Jeder Begriff bekommt eine Erklärung in ca. 100 Worten, "alias" listet Schreibvarianten (Plural, Abkürzung). Gib nur einen JSON-Codeblock in genau diesem Format aus:

{"kurs":"Name des Kurses","glossar":[{"begriff":"…","info":"…","alias":["…"]}]}`;

export const norm = (s) =>
  String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export function cleanJson(t) {
  t = String(t).trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return m[1].trim();
  const a = t.search(/[\[{]/);
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
}

export function parseSets(txt) {
  let d;
  try {
    d = JSON.parse(cleanJson(txt));
  } catch (e) {
    throw new Error('Kein gültiges JSON: ' + e.message);
  }
  const list = Array.isArray(d) ? d : [d];
  const out = [];
  list.forEach((s, si) => {
    if (s && Array.isArray(s.glossar) && !s.fragen) return;
    if (!s || !Array.isArray(s.fragen) || (!s.fragen.length && !s.kurs && !s.titel)) {
      throw new Error('Kapitel ' + (si + 1) + ': „fragen“ fehlt oder ist leer.');
    }
    const qs = s.fragen.map((f, i) => {
      const w = 'Frage ' + (i + 1) + ': ';
      if (!f.frage) throw new Error(w + '„frage“ fehlt.');
      const st = Math.max(0, parseInt(f.streak, 10) || 0);
      const wr = !!f.wrong;
      const fl = !!(f.flagged || f.markiert);
      const img = String(f.bild || f.img || '').trim();
      const imgAlt = String(f.bildText || f.imgAlt || '').trim();
      const imgFields = img ? { img, ...(imgAlt ? { imgAlt } : {}) } : {};
      if (f.typ === 'tf') {
        let rv = Array.isArray(f.richtig) ? f.richtig[0] : f.richtig;
        if (typeof rv === 'string') {
          rv = { true: true, wahr: true, false: false, falsch: false }[rv.trim().toLowerCase()];
        }
        if (typeof rv !== 'boolean' && rv !== 0 && rv !== 1) {
          throw new Error(w + '„richtig“ muss true oder false sein.');
        }
        const t = rv === true || rv === 0;
        const bg = Array.isArray(f.begruendungen) ? f.begruendungen : [];
        return {
          q: f.frage,
          type: 'single',
          exp: f.erklaerung || '',
          opts: [
            { t: 'Wahr', ok: t, why: String(bg[0] || '') },
            { t: 'Falsch', ok: !t, why: String(bg[1] || '') }
          ],
          fixed: true,
          streak: st,
          wrong: wr,
          flagged: fl,
          ...imgFields
        };
      }
      if (!Array.isArray(f.optionen) || f.optionen.length < 2) {
        throw new Error(w + 'mindestens 2 „optionen“ nötig.');
      }
      const raw = [].concat(f.richtig ?? []);
      const r = raw.map((x) =>
        typeof x === 'number' || (typeof x === 'string' && x.trim() !== '') ? Number(x) : NaN
      );
      if (!r.length || r.some((x) => !(x >= 0 && x < f.optionen.length))) {
        throw new Error(w + '„richtig“ verweist auf eine nicht vorhandene Option.');
      }
      return {
        q: f.frage,
        type: f.typ === 'multi' || r.length > 1 ? 'multi' : 'single',
        exp: f.erklaerung || '',
        streak: st,
        wrong: wr,
        flagged: fl,
        ...imgFields,
        opts: f.optionen.map((t, k) => ({
          t: String(t),
          ok: r.includes(k),
          why: (f.begruendungen && f.begruendungen[k]) || ''
        }))
      };
    });
    const cfg = s.einstellungen && typeof s.einstellungen === 'object' ? s.einstellungen : null;
    out.push({
      id: Date.now().toString(36) + '-' + si,
      course: s.kurs || 'Ohne Kurs',
      title: s.titel || 'Ohne Titel',
      qs,
      cfg
    });
  });
  return out;
}

export function extractGloss(d, defC) {
  const fb = (defC || '').trim() || 'Ohne Kurs';
  return (Array.isArray(d) ? d : [d]).flatMap((x) => {
    if (!x) return [];
    const c = String(x.kurs || x.course || fb).trim() || fb;
    if (Array.isArray(x.glossar)) {
      return x.glossar.map((g) => (g ? { ...g, kurs: String(g.kurs || g.course || c).trim() || c } : g));
    }
    if (x.begriff) return [{ ...x, kurs: c }];
    return [];
  });
}

export function parseGloss(txt, defC) {
  let d;
  try {
    d = JSON.parse(cleanJson(txt));
  } catch (e) {
    throw new Error('Kein gültiges JSON: ' + e.message);
  }
  const l = extractGloss(d, defC);
  if (!l.length) {
    throw new Error('Kein Glossar gefunden. Erwartet wird {"kurs":"…","glossar":[{"begriff":"…","info":"…"}]}.');
  }
  const bad = l.findIndex((g) => !g || !g.begriff || !g.info);
  if (bad >= 0) throw new Error('Eintrag ' + (bad + 1) + ': „begriff“ und „info“ sind Pflicht.');
  return l;
}

export function promptFor(c, a) {
  a = a || KINDS.map((x) => x[0]);
  const nm = {
    single: 'Single Choice (typ "single", genau eine richtige Antwort)',
    multi: 'Multiple Choice (typ "multi", mehrere richtige Antworten)',
    tf: 'Wahr/Falsch (typ "tf")'
  };
  let p = PROMPT.replace(
    /Mische Single Choice.*?\(typ "tf"\)\./s,
    'Verwende ausschließlich diese Fragetypen (bei mehreren gemischt): ' + a.map((k) => nm[k]).join('; ') + '.'
  );
  if (c) p = p.replace('"kurs":"Name des Kurses"', '"kurs":' + JSON.stringify(c));
  return p;
}

export function gpromptFor(c) {
  return c ? GPROMPT.replace('"kurs":"Name des Kurses"', '"kurs":' + JSON.stringify(c)) : GPROMPT;
}
