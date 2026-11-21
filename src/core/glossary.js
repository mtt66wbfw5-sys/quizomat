import { norm } from './parser.js';

export function has(t, w, short) {
  let i = t.indexOf(w);
  while (i >= 0) {
    if (!short) return true;
    const a = t[i - 1] || ' ';
    const b = t[i + w.length] || ' ';
    if (!/[a-zäöüß0-9]/.test(a) && !/[a-zäöüß0-9]/.test(b)) return true;
    i = t.indexOf(w, i + 1);
  }
  return false;
}

export function cntHit(t, w, short) {
  let i = t.indexOf(w);
  let c = 0;
  while (i >= 0) {
    if (!short) c++;
    else {
      const a = t[i - 1] || ' ';
      const b = t[i + w.length] || ' ';
      if (!/[a-zäöüß0-9]/.test(a) && !/[a-zäöüß0-9]/.test(b)) c++;
    }
    i = t.indexOf(w, i + 1);
  }
  return c;
}

export function computeTerms(q, gloss, sets) {
  const qo = q.opts || [];
  const tQ = String(q.q || '').toLowerCase();
  const tOk = qo.filter((o) => o.ok).map((o) => o.t || '').join(' ').toLowerCase();
  const tExpMain = String(q.exp || '').toLowerCase();
  const tExpHead = tExpMain.slice(0, 140);
  const tExp = (tExpMain + ' ' + qo.filter((o) => o.ok).map((o) => o.why || '').join(' ')).toLowerCase();
  const tWrong = qo.filter((o) => !o.ok).map((o) => (o.t || '') + ' ' + (o.why || '')).join(' ').toLowerCase();
  const crs = q._course ? norm(q._course) : '';
  const pool = crs ? gloss.filter((g) => norm(g.course) === crs) : gloss;
  const cQs = [];
  (sets || []).forEach((s) => {
    if (!crs || norm(s.course) === crs) (s.qs || []).forEach((x) => cQs.push(x));
  });
  const sc = [];
  pool.forEach((g, idx) => {
    const ws = [g.b, ...(g.a || [])].map((w) => w.toLowerCase()).filter(Boolean);
    let sOk = 0;
    let sExp = 0;
    let sHead = 0;
    let sQ = 0;
    let sWr = 0;
    let occ = 0;
    ws.forEach((w) => {
      const sh = w.length <= 4;
      if (has(tOk, w, sh)) sOk = Math.max(sOk, has(tOk, w, true) ? 11 : 9);
      if (has(tExp, w, sh)) {
        sExp = Math.max(sExp, has(tExp, w, true) ? 9 : 7);
        if (has(tExpHead, w, sh)) sHead = 3;
      }
      if (has(tQ, w, sh)) sQ = Math.max(sQ, has(tQ, w, true) ? 6 : 5);
      if (has(tWrong, w, sh)) sWr = Math.max(sWr, has(tWrong, w, true) ? 2 : 1);
      occ += cntHit(tOk + ' ' + tExp, w, sh);
    });
    let s = sOk + sExp + sHead + sQ + (sOk && sExp ? 5 : 0) + (sQ && sExp ? 3 : 0) + (occ >= 2 ? 1.5 : 0);
    if (!s && sWr) s = sWr;
    else if (s) {
      const bw = g.b.toLowerCase();
      const sh = bw.length <= 4;
      let df = 1;
      if (cQs.length > 1) {
        df = 0;
        for (let i = 0; i < cQs.length; i++) {
          const x = cQs[i];
          if (has((x.q + ' ' + (x.exp || '')).toLowerCase(), bw, sh)) df++;
        }
        df = Math.max(1, df);
      }
      s += 4 / Math.sqrt(df);
    }
    if (s > 0) sc.push({ g, s, idx });
  });
  return sc
    .sort((a, b) => b.s - a.s || a.idx - b.idx)
    .slice(0, 8)
    .map((x) => x.g);
}
