import Dexie, { type Table } from 'dexie'
import type {
  SettingRecord,
  ChunkProgressRecord,
  QuestionStateRecord,
  ReviewLogRecord,
  SessionRecord,
  UIRecord,
} from '../learning/types'

export class PsychFlashDatabase extends Dexie {
  outbox!: Table<{ id: string; sequence: number; payload: unknown }, string>
  syncMeta!: Table<{ key: string; value: number }, string>
  settings!: Table<SettingRecord, string>
  chunkProgress!: Table<ChunkProgressRecord, string>
  questionState!: Table<QuestionStateRecord, string>
  reviewLog!: Table<ReviewLogRecord, string>
  sessions!: Table<SessionRecord, string>
  ui!: Table<UIRecord, string>
  constructor(name = 'psych-study-internal') {
    super(name)
    const original = {
      settings: '&key',
      chunkProgress: '&chunkId, studyCompletedAt, lastOpenedAt',
      questionState: '&questionId, lastReviewedAt, lastRating',
      reviewLog: '&id, questionId, reviewedAt, rating',
    }
    this.version(1).stores(original)
    this.version(2).stores({
      ...original,
      questionState: '&questionId, lastReviewedAt, lastRating, dueAt',
    })
    this.version(3).stores({
      ...original,
      questionState: '&questionId, lastReviewedAt, lastRating, dueAt',
      sessions: '&id, kind, day, createdAt',
      ui: '&key',
    })
    this.version(4).stores({
      ...original,
      questionState: '&questionId, lastReviewedAt, lastRating, dueAt',
      sessions: '&id, kind, day, createdAt',
      ui: '&key',
      outbox: '&id, sequence',
      syncMeta: '&key',
    })
  }
}
export let database = new PsychFlashDatabase()
