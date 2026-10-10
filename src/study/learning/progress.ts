import type { RuntimeChunk, ContentIndex } from '../content/types'
import type {
  ChunkProgressRecord,
  QuestionStateRecord,
  ReviewLogRecord,
} from './types'
export type LearnerState = 'New' | 'Learning' | 'Due' | 'Retained'
export function chunkState(
  chunk: RuntimeChunk,
  progress: ChunkProgressRecord | undefined,
  states: Map<string, QuestionStateRecord>,
  now = new Date(),
): LearnerState {
  if (!progress?.studyCompletedAt) return 'New'
  if (
    chunk.questions.some((q) => {
      const s = states.get(q.id)
      return s?.lastReviewedAt && s.dueAt && new Date(s.dueAt) <= now
    })
  )
    return 'Due'
  if (
    progress.seenRevision !== chunk.revision ||
    chunk.questions.some((q) => {
      const s = states.get(q.id)
      return (
        !s?.lastReviewedAt ||
        s.contentRevision !== chunk.revision ||
        (s.lastRating !== 'good' && s.lastRating !== 'easy')
      )
    })
  )
    return 'Learning'
  return 'Retained'
}
export function progressMetrics(
  index: ContentIndex,
  chunks: ChunkProgressRecord[],
  states: QuestionStateRecord[],
  logs: ReviewLogRecord[],
  now = new Date(),
) {
  const studied = chunks.filter(
    (c) => index.chunks.has(c.chunkId) && c.studyCompletedAt,
  ).length
  const recent = logs.filter(
    (l) =>
      index.questions.has(l.questionId) &&
      new Date(l.reviewedAt).getTime() >= now.getTime() - 14 * 86400000 &&
      new Date(l.reviewedAt) <= now,
  )
  const successes = recent.filter(
    (l) => l.rating === 'good' || l.rating === 'easy',
  ).length
  const domains = new Map<string, { count: number; successes: number }>()
  for (const l of recent) {
    const domain = index.questions.get(l.questionId)!.chunk.domainId,
      current = domains.get(domain) ?? { count: 0, successes: 0 }
    current.count++
    if (l.rating === 'good' || l.rating === 'easy') current.successes++
    domains.set(domain, current)
  }
  const weak = [...domains]
    .filter(([, d]) => d.count >= 5)
    .map(([id, d]) => ({ id, ...d, recall: d.successes / d.count }))
    .sort((a, b) => a.recall - b.recall || a.id.localeCompare(b.id))
    .slice(0, 3)
  const due = states.filter(
    (s) =>
      index.questions.has(s.questionId) &&
      s.lastReviewedAt &&
      s.dueAt &&
      new Date(s.dueAt) <= now,
  ).length
  return {
    studied,
    total: index.chunks.size,
    due,
    recentCount: recent.length,
    recall: recent.length ? successes / recent.length : null,
    weak,
  }
}
