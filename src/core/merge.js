import { norm } from './parser.js';

export const jj = JSON.stringify;
export const qk = (q) => norm(q.q);
export const sk = (s) => norm(s.course) + '|' + norm(s.title);
export const gk = (g) => norm(g.course) + '|' + String(g.b || '').toLowerCase();

/**
 * 3-Wege-Merge (Basis = letzter synchronisierter Stand):
 * Änderungen und Löschungen beider Seiten bleiben erhalten.
 */
export function m3(b, l, r, k, both) {
  const bm = new Map((b || []).map((x) => [k(x), x]));
  const lm = new Map((l || []).map((x) => [k(x), x]));
  const rm = new Map((r || []).map((x) => [k(x), x]));
  const out = [];
  new Set([...lm.keys(), ...rm.keys()]).forEach((key) => {
    const B = bm.get(key);
    const L = lm.get(key);
    const R = rm.get(key);
    if (L && R) {
      if (jj(L) === jj(R)) out.push(L);
      else if (B && jj(L) === jj(B)) out.push(R);
      else if (B && jj(R) === jj(B)) out.push(L);
      else out.push(both(L, R, B));
    } else if (L) {
      if (!(B && jj(L) === jj(B))) out.push(L);
    } else if (!(B && jj(R) === jj(B))) {
      out.push(R);
    }
  });
  return out;
}

export function mergeQuestion(L, R, preferRemote) {
  const [o, n] = preferRemote ? [L, R] : [R, L];
  const st = Math.max(L.streak || 0, R.streak || 0);
  const lSrs = L.srs && typeof L.srs === 'object' ? L.srs : null;
  const rSrs = R.srs && typeof R.srs === 'object' ? R.srs : null;
  let srs = n.srs || o.srs;
  if (lSrs && rSrs) {
    srs = (rSrs.lastReview || 0) >= (lSrs.lastReview || 0) ? rSrs : lSrs;
  } else if (lSrs || rSrs) {
    srs = lSrs || rSrs;
  }
  return {
    ...o,
    ...n,
    streak: st,
    wrong: st > 0 ? false : n.wrong,
    flagged: !!(L.flagged || R.flagged),
    ...(srs ? { srs } : {})
  };
}

export function mergeSets3Way(base, localSets, remoteSets, preferRemote) {
  return m3(base, localSets, remoteSets, sk, (L, R, B) => ({
    ...(preferRemote ? L : R),
    ...(preferRemote ? R : L),
    id: L.id,
    qs: m3(B && B.qs, L.qs || [], R.qs || [], qk, (lq, rq) => mergeQuestion(lq, rq, preferRemote))
  }));
}

export function mergeGloss3Way(base, localGloss, remoteGloss, preferRemote) {
  return m3(base, localGloss, remoteGloss, gk, (L, R) => (preferRemote ? R : L));
}
