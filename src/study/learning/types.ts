import type { Card } from 'ts-fsrs'
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'
export type SerializedCard = Omit<Card, 'due' | 'last_review'> & {
  due: string
  last_review?: string
}
export type SettingRecord = {
  key: string
  value: string | number | boolean | null
}
export type StudySettings = {
  examDate?: string
  dailyTargetMinutes?: number
  dailyNewLimit?: number
  shuffleQuestions?: boolean
  reviewOrder?: 'oldest' | 'weakest'
  repetition?: 'light' | 'balanced' | 'intensive'
  keyboardShortcuts?: boolean
}
export type ChunkProgressRecord = {
  chunkId: string
  firstOpenedAt?: string
  studyCompletedAt?: string
  lastOpenedAt?: string
  lastStudiedAt?: string
  seenRevision?: number
}
export type QuestionStateRecord = {
  questionId: string
  lastReviewedAt?: string
  lastRating?: ReviewRating
  dueAt?: string
  schedulerCard?: SerializedCard
  contentRevision?: number
}
export type ReviewLogRecord = {
  retention?: number
  id: string
  questionId: string
  reviewedAt: string
  rating: ReviewRating
  contentRevision?: number
}
export type SessionItem =
  | { kind: 'study'; chunkId: string; revision: number }
  | { kind: 'review'; chunkId: string; questionId: string; revision: number }
export type SessionRecord = {
  id: string
  kind: 'today' | 'practice'
  day: string
  createdAt: string
  items: SessionItem[]
  cursor: number
  revealed: boolean
}
export type Tab = 'today' | 'library' | 'progress'
export type UIRecord = {
  key: 'current'
  tab: Tab
  mode: 'shell' | 'study' | 'review'
  activeChunkId?: string
  activeSessionId?: string
  reviewTopic: boolean
  expandedDomains: string[]
}
export type LearningSnapshot = {
  settings: StudySettings
  chunks: ChunkProgressRecord[]
  questions: QuestionStateRecord[]
  logs: ReviewLogRecord[]
  sessions: SessionRecord[]
  ui: UIRecord
}
export const defaultUI: UIRecord = {
  key: 'current',
  tab: 'today',
  mode: 'shell',
  reviewTopic: false,
  expandedDomains: [],
}
