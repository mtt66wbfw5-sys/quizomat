export const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
export const MAX_INTERVAL_DAYS = 180;

/**
 * Updates Spaced Repetition metadata (SM-2-inspired) on a question object.
 * Mutates and returns the updated `srs` object.
 */
export function updateSrs(q, ok, nowMs = Date.now()) {
  const prev = q && q.srs && typeof q.srs === 'object' ? q.srs : null;
  let ease = prev && Number.isFinite(prev.ease) ? prev.ease : DEFAULT_EASE;
  let interval = prev && Number.isFinite(prev.interval) ? prev.interval : 0;
  let reps = prev && Number.isFinite(prev.reps) ? prev.reps : 0;

  if (ok) {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(interval * ease)));
    ease = Math.min(MAX_EASE, Math.round((ease + 0.1) * 100) / 100);
  } else {
    reps = 0;
    interval = 0;
    ease = Math.max(MIN_EASE, Math.round((ease - 0.2) * 100) / 100);
  }

  const nextReview = ok ? nowMs + interval * DAY_MS : nowMs;
  const srs = { ease, interval, reps, lastReview: nowMs, nextReview };
  if (q) q.srs = srs;
  return srs;
}

/**
 * Returns true if the question is due for Spaced Repetition review.
 * Only questions that have been reviewed at least once (or explicitly have nextReview)
 * count as scheduled SRS reviews; brand-new questions are handled by normal practice.
 */
export function isScheduledDue(q, nowMs = Date.now()) {
  if (!q || !q.srs || !Number.isFinite(q.srs.nextReview)) return false;
  return q.srs.nextReview <= nowMs;
}

/**
 * Returns true if the question is either due by SRS or has never been reviewed yet.
 */
export function isDueOrNew(q, nowMs = Date.now()) {
  if (!q || !q.srs || !Number.isFinite(q.srs.nextReview)) return true;
  return q.srs.nextReview <= nowMs;
}

/**
 * Collects all scheduled SRS questions that are currently due from the given sets.
 * If `selIds` (a Set) is provided and non-empty, restricts to those set IDs.
 */
export function collectDueQuestions(sets, selIds, nowMs = Date.now()) {
  const due = [];
  let nextDueAt = null;

  (sets || []).forEach((s) => {
    if (selIds && selIds.size && !selIds.has(s.id)) return;
    (s.qs || []).forEach((q) => {
      if (isScheduledDue(q, nowMs)) {
        due.push({ ...q, _ref: q, _course: s.course, _title: s.title });
      } else if (q.srs && Number.isFinite(q.srs.nextReview) && q.srs.nextReview > nowMs) {
        if (nextDueAt === null || q.srs.nextReview < nextDueAt) {
          nextDueAt = q.srs.nextReview;
        }
      }
    });
  });

  // Prioritize most overdue / wrong questions first
  due.sort((a, b) => {
    const wa = a.wrong ? 0 : 1;
    const wb = b.wrong ? 0 : 1;
    if (wa !== wb) return wa - wb;
    return (a.srs?.nextReview || 0) - (b.srs?.nextReview || 0);
  });

  return { due, dueCount: due.length, nextDueAt };
}

/**
 * Formats a future or past SRS review timestamp in concise German.
 */
export function formatRelativeDue(ts, nowMs = Date.now()) {
  if (!Number.isFinite(ts)) return 'Neu';
  const diffMs = ts - nowMs;
  if (diffMs <= 0) return 'heute fällig';
  const days = Math.ceil(diffMs / DAY_MS);
  if (days <= 1) return 'morgen fällig';
  return `in ${days} Tagen`;
}
