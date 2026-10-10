import type { Curriculum } from '../content/types'
import type {
  ChunkProgressRecord,
  QuestionStateRecord,
  StudySettings,
  SessionItem,
} from './types'
import { localDay } from './dates'
export function questionOrder<T extends { id: string }>(
  questions: T[],
  seed: string,
): T[] {
  const hash = (id: string) =>
    [...(seed + id)].reduce(
      (n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0,
      2166136261,
    )
  return [...questions].sort(
    (a, b) => hash(a.id) - hash(b.id) || a.id.localeCompare(b.id),
  )
}
export function planToday(
  data: Curriculum,
  progress: ChunkProgressRecord[],
  states: QuestionStateRecord[],
  settings: StudySettings,
  now = new Date(),
) {
  const completed = new Map(progress.map((p) => [p.chunkId, p])),
    questions = new Map(
      data.chunks.flatMap((c) => c.questions.map((q) => [q.id, c] as const)),
    )
  const unseen = data.chunks.filter(
    (c) => !completed.get(c.id)?.studyCompletedAt,
  )
  const changed = data.chunks.filter(
    (c) =>
      completed.get(c.id)?.studyCompletedAt &&
      completed.get(c.id)?.seenRevision !== c.revision,
  )
  const studiedToday = progress.filter(
    (p) =>
      p.studyCompletedAt &&
      localDay(new Date(p.studyCompletedAt)) === localDay(now) &&
      data.chunks.some((c) => c.id === p.chunkId),
  ).length
  const required = Math.min(
    unseen.length + studiedToday,
    settings.dailyNewLimit ?? 3,
  )
  const due = states
    .filter(
      (s) =>
        s.lastReviewedAt &&
        s.dueAt &&
        new Date(s.dueAt) <= now &&
        questions.has(s.questionId),
    )
    .sort(
      (a, b) =>
        (settings.reviewOrder === 'weakest'
          ? { again: 0, hard: 1, good: 2, easy: 3 }[a.lastRating ?? 'good'] -
            { again: 0, hard: 1, good: 2, easy: 3 }[b.lastRating ?? 'good']
          : 0) ||
        a.dueAt!.localeCompare(b.dueAt!) ||
        a.questionId.localeCompare(b.questionId),
    )
  const requested = Math.max(0, required - studiedToday)
  const limit =
    settings.dailyNewLimit === undefined
      ? requested
      : Math.min(requested, Math.max(0, settings.dailyNewLimit - studiedToday))
  const candidates = [...changed, ...unseen.slice(0, limit)]
  const dueIds = new Set(due.map((s) => s.questionId))
  let remainingMinutes =
    settings.dailyTargetMinutes === undefined
      ? Infinity
      : Math.max(0, settings.dailyTargetMinutes - due.length * 0.5)
  const selected = candidates.filter((c) => {
    // Due questions were budgeted already. Immediate retrieval varies by topic.
    const cost = 3 + c.questions.filter((q) => !dueIds.has(q.id)).length * 0.5
    if (cost > remainingMinutes) return false
    remainingMinutes -= cost
    return true
  })
  const selectedIds = new Set(selected.map((c) => c.id)),
    emitted = new Set<string>(),
    items: SessionItem[] = []
  const oldReviews = due.filter(
    (s) => !selectedIds.has(questions.get(s.questionId)!.id),
  )
  let cursor = 0
  const addReview = (questionId: string) => {
    if (emitted.has(questionId)) return
    const c = questions.get(questionId)!
    emitted.add(questionId)
    items.push({
      kind: 'review',
      questionId,
      chunkId: c.id,
      revision: c.revision,
    })
  }
  for (const c of selected) {
    for (let j = 0; j < 3 && cursor < oldReviews.length; j++)
      addReview(oldReviews[cursor++].questionId)
    items.push({ kind: 'study', chunkId: c.id, revision: c.revision })
    for (const q of settings.shuffleQuestions
      ? questionOrder(c.questions, localDay(now))
      : c.questions)
      addReview(q.id)
  }
  while (cursor < oldReviews.length) addReview(oldReviews[cursor++].questionId)
  // Due questions in unselected topics are still never dropped by a minutes cap.
  for (const s of due) addReview(s.questionId)
  return {
    items,
    requiredNew: requested,
    newChunks: selected.filter((c) => !completed.get(c.id)?.studyCompletedAt)
      .length,
    updatedChunks:
      selected.length -
      selected.filter((c) => !completed.get(c.id)?.studyCompletedAt).length,
    dueReviews: due.length,
    estimatedMinutes: Math.ceil(
      selected.length * 3 +
        items.filter((i) => i.kind === 'review').length * 0.5,
    ),
    paceLimited:
      selected.filter((c) => !completed.get(c.id)?.studyCompletedAt).length <
      requested,
  }
}
