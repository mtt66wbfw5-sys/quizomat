export const SCORE_MODES = ['all', 'opt', 'pos', 'part'];
export const NEG_MODES = ['none', 'clamp', 'full'];
export const THEMES = ['auto', 'light', 'dark'];

export const fmtTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const fmtPct = (n) =>
  String(Math.round(n * 10) / 10).replace('.', ',') + ' %';

export const fmtPts = (n) =>
  String(Math.round(n * 100) / 100).replace('.', ',').replace('-', '−');

export const modeShort = (m) =>
  ({
    all: 'Gesamtfrage',
    opt: 'Einzelantworten (inkl. Nicht-Ankreuzen)',
    pos: 'Einzelantworten (nur richtige)',
    part: 'Teilpunkte (1 Pkt./Frage)'
  })[m] || 'Gesamtfrage';

export const negShort = (n) =>
  ({
    none: 'Keine Minuspunkte',
    clamp: 'Minuspunkte (≥0/Frage)',
    full: 'Minuspunkte (Gesamtabzug)'
  })[n] || 'Keine Minuspunkte';

export function scoreExamQ(q, p, smode, nmode) {
  const multi = q.type === 'multi';
  const open = !p || p.size === 0;
  const N = q.opts.length;
  const R = Math.max(1, q.opts.filter((o) => o.ok).length);
  const max = !multi ? 1 : smode === 'opt' ? N : smode === 'pos' ? R : 1;
  if (open) return { pts: 0, max, ok: false, part: false, open: true };

  const fullOk = q.opts.every((o, k) => o.ok === p.has(k));
  if (!multi || smode === 'all') {
    const pts = fullOk ? 1 : nmode === 'full' ? -1 : 0;
    return { pts, max: 1, ok: fullOk, part: false, open: false };
  }

  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;
  q.opts.forEach((o, k) => {
    const pk = p.has(k);
    if (o.ok && pk) tp++;
    else if (!o.ok && !pk) tn++;
    else if (!o.ok && pk) fp++;
    else fn++;
  });

  let raw = 0;
  if (smode === 'opt') raw = nmode === 'none' ? tp + tn : tp + tn - (fp + fn);
  else if (smode === 'pos') raw = nmode === 'none' ? tp : tp - fp;
  else raw = (nmode === 'none' ? tp + tn : tp + tn - (fp + fn)) / N;

  const pts = nmode === 'clamp' ? Math.max(0, raw) : raw;
  const isOk = Math.abs(pts - max) < 1e-9 && fp === 0 && fn === 0;
  return { pts, max, ok: isOk, part: !isOk && pts > 0, open: false };
}

export function calcGrade(pct, pass) {
  const p = [50, 60, 70].includes(+pass) ? +pass : 50;
  const st = (100 - p) / 4;
  if (pct >= p + 3 * st) return { g: 1, t: 'Sehr gut', ok: true, p, st };
  if (pct >= p + 2 * st) return { g: 2, t: 'Gut', ok: true, p, st };
  if (pct >= p + st) return { g: 3, t: 'Befriedigend', ok: true, p, st };
  if (pct >= p) return { g: 4, t: 'Genügend', ok: true, p, st };
  return { g: 5, t: 'Nicht genügend', ok: false, p, st };
}
