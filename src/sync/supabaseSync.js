/**
 * Pure mappers between Quizomat in-memory state and Supabase Postgres rows.
 */
export function setsToRows(userId, sets, nowIso) {
  return (sets || []).map((s, idx) => ({
    user_id: userId,
    id: String(s.id),
    course: s.course || 'Ohne Kurs',
    title: s.title || 'Ohne Titel',
    qs: Array.isArray(s.qs) ? s.qs : [],
    cfg: s.cfg || null,
    sort_order: idx,
    updated_at: nowIso
  }));
}

export function rowsToSets(rows) {
  return (rows || [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((r) => ({
      id: r.id,
      course: r.course || 'Ohne Kurs',
      title: r.title || 'Ohne Titel',
      qs: Array.isArray(r.qs) ? r.qs : [],
      ...(r.cfg ? { cfg: r.cfg } : {})
    }));
}

export function glossToRows(userId, gloss, nowIso) {
  const seen = new Map();
  (gloss || []).forEach((g) => {
    const course = String(g.course || 'Ohne Kurs').trim() || 'Ohne Kurs';
    const term = String(g.b || '').trim();
    if (!term) return;
    seen.set(`${course}\u0000${term}`, {
      user_id: userId,
      course,
      term,
      info: String(g.i || '').trim(),
      alias: Array.isArray(g.a) ? g.a : [],
      updated_at: nowIso
    });
  });
  return [...seen.values()];
}

export function rowsToGloss(rows) {
  return (rows || []).map((r) => ({
    course: r.course || 'Ohne Kurs',
    b: r.term,
    i: r.info,
    a: Array.isArray(r.alias) ? r.alias : []
  }));
}

export function attemptsToRows(userId, attempts) {
  return (attempts || [])
    .filter((a) => a && a.id)
    .map((a) => ({
      user_id: userId,
      id: String(a.id),
      course: a.course || 'Ohne Kurs',
      created_at: a.createdAt || new Date().toISOString(),
      grade: Number(a.grade) || 5,
      passed: !!a.passed,
      score_pts: Number(a.scorePts) || 0,
      max_pts: Number(a.maxPts) || 0,
      pct: Number(a.pct) || 0,
      correct_count: Number(a.correctCount) || 0,
      total_count: Number(a.totalCount) || 0,
      elapsed_sec: Number(a.elapsedSec) || 1,
      duration_mins: Number(a.durationMins) || 30,
      pass_pct: Number(a.passPct) || 50,
      score_mode: a.scoreMode || 'all',
      neg_mode: a.negMode || 'none',
      chapters: Array.isArray(a.chapters) ? a.chapters : []
    }));
}

export function rowsToAttempts(rows) {
  return (rows || [])
    .map((r) => ({
      id: r.id,
      course: r.course || 'Ohne Kurs',
      createdAt: r.created_at,
      grade: Number(r.grade) || 5,
      passed: !!r.passed,
      scorePts: Number(r.score_pts) || 0,
      maxPts: Number(r.max_pts) || 0,
      pct: Number(r.pct) || 0,
      correctCount: Number(r.correct_count) || 0,
      totalCount: Number(r.total_count) || 0,
      elapsedSec: Number(r.elapsed_sec) || 1,
      durationMins: Number(r.duration_mins) || 30,
      passPct: Number(r.pass_pct) || 50,
      scoreMode: r.score_mode || 'all',
      negMode: r.neg_mode || 'none',
      chapters: Array.isArray(r.chapters) ? r.chapters : []
    }))
    .sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0));
}

export async function fetchSupabaseState(client, userId) {
  const [setsRes, glossRes, settingsRes, attemptsRes] = await Promise.all([
    client
      .from('quizomat_sets')
      .select('id, course, title, qs, cfg, sort_order, updated_at')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
    client
      .from('quizomat_glossary')
      .select('course, term, info, alias, updated_at')
      .eq('user_id', userId),
    client
      .from('quizomat_settings')
      .select('courses, opts, col, gcol, updated_at')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('quizomat_exam_attempts')
      .select(
        'id, course, created_at, grade, passed, score_pts, max_pts, pct, correct_count, total_count, elapsed_sec, duration_mins, pass_pct, score_mode, neg_mode, chapters'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  ]);

  if (setsRes.error) throw new Error(setsRes.error.message);
  if (glossRes.error) throw new Error(glossRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (attemptsRes.error) throw new Error(attemptsRes.error.message);

  const setRows = setsRes.data || [];
  const glossRows = glossRes.data || [];
  const settingsRow = settingsRes.data || null;
  const attemptRows = attemptsRes.data || [];

  if (!setRows.length && !glossRows.length && !settingsRow && !attemptRows.length) {
    return null;
  }

  const timestamps = [
    ...setRows.map((r) => Date.parse(r.updated_at || '') || 0),
    ...glossRows.map((r) => Date.parse(r.updated_at || '') || 0),
    ...attemptRows.map((r) => Date.parse(r.created_at || '') || 0),
    settingsRow ? Date.parse(settingsRow.updated_at || '') || 0 : 0
  ];
  const updatedAt = Math.max(0, ...timestamps);

  return {
    updatedAt,
    sets: rowsToSets(setRows),
    gloss: rowsToGloss(glossRows),
    courses: (settingsRow && settingsRow.courses) || {},
    opts: (settingsRow && settingsRow.opts) || {},
    col: (settingsRow && settingsRow.col) || [],
    gcol: (settingsRow && settingsRow.gcol) || [],
    examHistory: rowsToAttempts(attemptRows)
  };
}

export async function pushSupabaseState(client, userId, payload) {
  const nowIso = new Date(payload.updatedAt || Date.now()).toISOString();
  const setRows = setsToRows(userId, payload.sets, nowIso);
  const glossRows = glossToRows(userId, payload.gloss, nowIso);
  const attemptRows = attemptsToRows(userId, payload.examHistory);

  // Fetch existing keys so deletions are synced cleanly
  const [exSets, exGloss, exAttempts] = await Promise.all([
    client.from('quizomat_sets').select('id').eq('user_id', userId),
    client.from('quizomat_glossary').select('course, term').eq('user_id', userId),
    client.from('quizomat_exam_attempts').select('id').eq('user_id', userId)
  ]);
  if (exSets.error) throw new Error(exSets.error.message);
  if (exGloss.error) throw new Error(exGloss.error.message);
  if (exAttempts.error) throw new Error(exAttempts.error.message);

  const keepSetIds = new Set(setRows.map((r) => r.id));
  const delSetIds = (exSets.data || []).map((r) => r.id).filter((id) => !keepSetIds.has(id));

  if (delSetIds.length) {
    const { error } = await client
      .from('quizomat_sets')
      .delete()
      .eq('user_id', userId)
      .in('id', delSetIds);
    if (error) throw new Error(error.message);
  }

  if (setRows.length) {
    const { error } = await client
      .from('quizomat_sets')
      .upsert(setRows, { onConflict: 'user_id,id' });
    if (error) throw new Error(error.message);
  }

  const keepGlossKeys = new Set(glossRows.map((r) => `${r.course}\u0000${r.term}`));
  const delGloss = (exGloss.data || []).filter(
    (r) => !keepGlossKeys.has(`${r.course}\u0000${r.term}`)
  );

  for (const g of delGloss) {
    const { error } = await client
      .from('quizomat_glossary')
      .delete()
      .eq('user_id', userId)
      .eq('course', g.course)
      .eq('term', g.term);
    if (error) throw new Error(error.message);
  }

  if (glossRows.length) {
    const { error } = await client
      .from('quizomat_glossary')
      .upsert(glossRows, { onConflict: 'user_id,course,term' });
    if (error) throw new Error(error.message);
  }

  const keepAttemptIds = new Set(attemptRows.map((r) => r.id));
  const delAttemptIds = (exAttempts.data || [])
    .map((r) => r.id)
    .filter((id) => !keepAttemptIds.has(id));

  if (delAttemptIds.length) {
    const { error } = await client
      .from('quizomat_exam_attempts')
      .delete()
      .eq('user_id', userId)
      .in('id', delAttemptIds);
    if (error) throw new Error(error.message);
  }

  if (attemptRows.length) {
    const { error } = await client
      .from('quizomat_exam_attempts')
      .upsert(attemptRows, { onConflict: 'user_id,id' });
    if (error) throw new Error(error.message);
  }

  const { error: settingsErr } = await client.from('quizomat_settings').upsert(
    {
      user_id: userId,
      courses: payload.courses || {},
      opts: payload.opts || {},
      col: Array.isArray(payload.col) ? payload.col : [],
      gcol: Array.isArray(payload.gcol) ? payload.gcol : [],
      updated_at: nowIso
    },
    { onConflict: 'user_id' }
  );
  if (settingsErr) throw new Error(settingsErr.message);
}
