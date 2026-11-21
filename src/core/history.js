import { scoreExamQ, calcGrade } from './scoring.js';

/**
 * Builds a normalized exam attempt record from a finished exam session.
 */
export function buildExamAttempt({
  id,
  course,
  questions,
  picks,
  elapsedSec,
  durationMins,
  passPct,
  scoreMode,
  negMode,
  createdAt = new Date().toISOString()
}) {
  const qs = questions || [];
  const scores = qs.map((q, i) => scoreExamQ(q, (picks && picks[i]) || new Set(), scoreMode, negMode));
  const rawPts = scores.reduce((a, s) => a + s.pts, 0);
  const maxPts = scores.reduce((a, s) => a + s.max, 0);
  const scorePts = Math.max(0, Math.round(rawPts * 100) / 100);
  const pct = maxPts > 0 ? Math.round((scorePts / maxPts) * 1000) / 10 : 0;
  const correctCount = scores.filter((s) => s.ok).length;
  const gr = calcGrade(pct, passPct);

  const chMap = {};
  qs.forEach((q, i) => {
    const title = q._title || 'Allgemein';
    if (!chMap[title]) chMap[title] = { title, pts: 0, max: 0 };
    chMap[title].pts += scores[i].pts;
    chMap[title].max += scores[i].max;
  });

  const chapters = Object.values(chMap).map((c) => {
    const pts = Math.max(0, Math.round(c.pts * 100) / 100);
    const max = Math.round(c.max * 100) / 100;
    return {
      title: c.title,
      pts,
      max,
      pct: max > 0 ? Math.round((pts / max) * 100) : 0
    };
  });

  return {
    id: id || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    course: course || 'Ohne Kurs',
    createdAt,
    grade: gr.g,
    passed: gr.ok,
    scorePts,
    maxPts: Math.round(maxPts * 100) / 100,
    pct,
    correctCount,
    totalCount: qs.length,
    elapsedSec: Math.max(1, Math.round(elapsedSec || 1)),
    durationMins: Math.max(1, Math.round(durationMins || 30)),
    passPct: [50, 60, 70].includes(+passPct) ? +passPct : 50,
    scoreMode: scoreMode || 'all',
    negMode: negMode || 'none',
    chapters
  };
}

/**
 * Merges local and remote exam attempt lists by ID, keeping newest first.
 */
export function mergeAttempts(localList, remoteList) {
  const map = new Map();
  (remoteList || []).forEach((a) => {
    if (a && a.id) map.set(a.id, a);
  });
  (localList || []).forEach((a) => {
    if (a && a.id && !map.has(a.id)) map.set(a.id, a);
  });
  return [...map.values()].sort(
    (a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)
  );
}

/**
 * Computes summary stats for a list of exam attempts.
 */
export function summarizeHistory(attempts) {
  const list = attempts || [];
  if (!list.length) {
    return { count: 0, passedCount: 0, passRate: 0, avgGrade: 0, avgPct: 0, bestPct: 0 };
  }
  const passedCount = list.filter((a) => a.passed).length;
  const avgGrade = Math.round((list.reduce((s, a) => s + a.grade, 0) / list.length) * 10) / 10;
  const avgPct = Math.round((list.reduce((s, a) => s + a.pct, 0) / list.length) * 10) / 10;
  const bestPct = Math.max(...list.map((a) => a.pct));
  return {
    count: list.length,
    passedCount,
    passRate: Math.round((passedCount / list.length) * 100),
    avgGrade,
    avgPct,
    bestPct
  };
}

/**
 * Aggregates chapter performance across attempts and returns weakest chapters first.
 */
export function weakestChapters(attempts) {
  const map = new Map();
  (attempts || []).forEach((a) => {
    (a.chapters || []).forEach((c) => {
      const key = `${a.course || 'Ohne Kurs'}::${c.title}`;
      const cur = map.get(key) || { course: a.course || 'Ohne Kurs', title: c.title, pts: 0, max: 0, runs: 0 };
      cur.pts += Math.max(0, c.pts || 0);
      cur.max += Math.max(0, c.max || 0);
      cur.runs += 1;
      map.set(key, cur);
    });
  });

  return [...map.values()]
    .filter((c) => c.max > 0)
    .map((c) => ({
      ...c,
      pct: Math.round((c.pts / c.max) * 100)
    }))
    .sort((a, b) => a.pct - b.pct || b.runs - a.runs);
}
