import { database } from './database'
import {
  defaultUI,
  type LearningSnapshot,
  type SettingRecord,
} from '../learning/types'
import { snapshot } from './operations'
import { validExamDate } from '../learning/dates'
export type Backup = {
  schemaVersion: 1
  exportedAt: string
  settings: SettingRecord[]
  chunkProgress: LearningSnapshot['chunks']
  questionState: LearningSnapshot['questions']
  reviewLog: LearningSnapshot['logs']
  sessions?: LearningSnapshot['sessions']
  ui?: LearningSnapshot['ui']
}
const fail = (): never => {
  throw new Error('Backup is corrupt or incompatible. Nothing was imported.')
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const date = (v: unknown) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T/.test(v) &&
  Number.isFinite(Date.parse(v))
const integer = (v: unknown, min = 0) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min
const cid = (v: unknown) => typeof v === 'string' && /^PSY-\d{3}$/.test(v)
const qid = (v: unknown) =>
  typeof v === 'string' && /^PSY-\d{3}-Q\d{2}$/.test(v)
const rating = (v: unknown) =>
  ['again', 'hard', 'good', 'easy'].includes(v as string)
function rows(
  v: unknown,
  key: string,
  limit: number,
): Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length > limit) return fail()
  const ids = new Set()
  for (const r of v) {
    if (
      !record(r) ||
      typeof r[key] !== 'string' ||
      !(r[key] as string).length ||
      ids.has(r[key])
    )
      fail()
    ids.add(r[key])
  }
  return v
}
export function parseBackup(value: unknown): Backup {
  if (!record(value) || value.schemaVersion !== 1 || !date(value.exportedAt))
    return fail()
  for (const s of rows(value.settings, 'key', 100)) {
    if (s.key === 'examDate' && s.value !== null && !validExamDate(s.value))
      fail()
    if (
      s.key === 'locale' &&
      s.value !== null &&
      !['en', 'el'].includes(s.value as string)
    )
      fail()
    if (
      s.key === 'dailyTargetMinutes' &&
      s.value !== null &&
      (!integer(s.value, 5) || (s.value as number) > 600)
    )
      fail()
    if (
      s.value !== null &&
      !['number', 'string', 'boolean'].includes(typeof s.value)
    )
      fail()
    if (typeof s.value === 'number' && !Number.isFinite(s.value)) fail()
  }
  for (const c of rows(value.chunkProgress, 'chunkId', 10000)) {
    if (
      !cid(c.chunkId) ||
      (c.seenRevision !== undefined && !integer(c.seenRevision, 1))
    )
      fail()
    for (const f of [
      'firstOpenedAt',
      'studyCompletedAt',
      'lastOpenedAt',
      'lastStudiedAt',
    ])
      if (c[f] !== undefined && !date(c[f])) fail()
  }
  for (const s of rows(value.questionState, 'questionId', 100000)) {
    if (
      !qid(s.questionId) ||
      (s.contentRevision !== undefined && !integer(s.contentRevision, 1)) ||
      (s.lastRating !== undefined && !rating(s.lastRating))
    )
      fail()
    for (const f of ['lastReviewedAt', 'dueAt'])
      if (s[f] !== undefined && !date(s[f])) fail()
    if (s.lastReviewedAt && (!s.lastRating || !s.dueAt || !s.schedulerCard))
      fail()
    if (s.schedulerCard !== undefined) {
      const c = s.schedulerCard
      if (!record(c)) return fail()
      if (
        !date(c.due) ||
        (c.last_review !== undefined && !date(c.last_review)) ||
        c.due !== s.dueAt
      )
        fail()
      for (const f of [
        'stability',
        'difficulty',
        'elapsed_days',
        'scheduled_days',
      ])
        if (
          typeof c[f] !== 'number' ||
          !Number.isFinite(c[f]) ||
          (c[f] as number) < 0
        )
          fail()
      for (const f of ['reps', 'lapses', 'learning_steps', 'state'])
        if (!integer(c[f])) fail()
      if (
        (c.state as number) > 3 ||
        (c.difficulty as number) > 10 ||
        (s.lastReviewedAt && c.last_review !== s.lastReviewedAt)
      )
        fail()
    }
  }
  for (const l of rows(value.reviewLog, 'id', 1000000))
    if (
      !qid(l.questionId) ||
      !date(l.reviewedAt) ||
      !rating(l.rating) ||
      (l.retention !== undefined &&
        ![0.8, 0.9, 0.95].includes(l.retention as number)) ||
      (l.contentRevision !== undefined && !integer(l.contentRevision, 1))
    )
      fail()
  if (value.sessions !== undefined)
    for (const s of rows(value.sessions, 'id', 10000)) {
      if (
        !['today', 'practice'].includes(s.kind as string) ||
        !validExamDate(s.day) ||
        !date(s.createdAt) ||
        !Array.isArray(s.items) ||
        s.items.length > 10000 ||
        !integer(s.cursor) ||
        (s.cursor as number) > s.items.length ||
        typeof s.revealed !== 'boolean'
      )
        fail()
      for (const i of s.items as unknown[])
        if (
          !record(i) ||
          !cid(i.chunkId) ||
          !integer(i.revision, 1) ||
          !['study', 'review'].includes(i.kind as string) ||
          (i.kind === 'review' &&
            (!qid(i.questionId) ||
              !(i.questionId as string).startsWith(i.chunkId + '-')))
        )
          fail()
    }
  if (value.ui !== undefined) {
    const u = value.ui
    if (
      !record(u) ||
      u.key !== 'current' ||
      !['today', 'library', 'progress'].includes(u.tab as string) ||
      !['shell', 'study', 'review'].includes(u.mode as string) ||
      typeof u.reviewTopic !== 'boolean' ||
      !Array.isArray(u.expandedDomains) ||
      !u.expandedDomains.every((d) => typeof d === 'string') ||
      (u.activeChunkId !== undefined && !cid(u.activeChunkId)) ||
      (u.activeSessionId !== undefined && typeof u.activeSessionId !== 'string')
    )
      fail()
  }
  const backup = JSON.parse(JSON.stringify(value)) as Backup
  const events = new Map(backup.reviewLog.map((event) => [event.id, event]))
  for (const session of backup.sessions ?? []) {
    session.items.forEach((item, position) => {
      const event = events.get(`${session.id}:${position}`)
      if (
        event &&
        (position >= session.cursor ||
          item.kind !== 'review' ||
          item.questionId !== event.questionId)
      )
        fail()
    })
  }
  return backup
}
export async function exportBackup(db = database): Promise<Backup> {
  return db.transaction('r', db.tables, async () => {
    const s = await snapshot(db)
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: await db.settings.toArray(),
      chunkProgress: s.chunks,
      questionState: s.questions,
      reviewLog: s.logs,
      sessions: s.sessions,
      ui: s.ui,
    }
  })
}
export async function importBackup(value: unknown, db = database) {
  const b = parseBackup(value)
  const currentLocale = await db.settings.get('locale')
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await db.settings.bulkPut(b.settings)
    if (
      !b.settings.some((setting) => setting.key === 'locale') &&
      currentLocale
    )
      await db.settings.put(currentLocale)
    await db.chunkProgress.bulkPut(b.chunkProgress)
    await db.questionState.bulkPut(b.questionState)
    await db.reviewLog.bulkPut(b.reviewLog)
    await db.sessions.bulkPut(b.sessions ?? [])
    await db.ui.put(b.ui ?? { ...defaultUI })
  })
}
