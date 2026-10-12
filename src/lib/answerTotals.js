// Recent attempt arrays are capped; question counters and the lifetime counter
// retain repeats beyond that cap. Remote summaries use the full attempt table.
export function totalAnswers(progress = {}) {
  const recorded = Object.values(progress.questions || {}).reduce((sum, record) =>
    sum + Math.max(record?.attempts || 0,
      (record?.correctCount || 0) + (record?.wrongCount || record?.incorrectCount || 0)), 0);
  return Math.max(Number(progress.totalAnswers) || 0, recorded, progress.attempts?.length || 0);
}
