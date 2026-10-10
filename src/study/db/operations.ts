import type { Curriculum, RuntimeChunk } from '../content/types'
import { indexContent } from '../content/types'
import { database, type PsychFlashDatabase } from './database'
import {
  defaultUI,
  type LearningSnapshot,
  type ReviewRating,
  type SessionRecord,
  type StudySettings,
  type UIRecord,
} from '../learning/types'
import { planToday, questionOrder } from '../learning/planner'
import { localDay, validExamDate } from '../learning/dates'
import { scheduleReview } from '../learning/scheduler'

export async function snapshot(db = database): Promise<LearningSnapshot> {
  return db.transaction('r', db.tables, async () => {
    const [records, chunks, questions, logs, sessions, ui] = await Promise.all([
      db.settings.toArray(),
      db.chunkProgress.toArray(),
      db.questionState.toArray(),
      db.reviewLog.toArray(),
      db.sessions.toArray(),
      db.ui.get('current'),
    ])
    const settings: StudySettings = {}
    for (const s of records) {
      if (
        s.key === 'dailyNewLimit' &&
        typeof s.value === 'number' &&
        Number.isInteger(s.value) &&
        s.value >= 0 &&
        s.value <= 50
      )
        settings.dailyNewLimit = s.value
      if (s.key === 'shuffleQuestions' && typeof s.value === 'boolean')
        settings.shuffleQuestions = s.value
      if (s.key === 'keyboardShortcuts' && typeof s.value === 'boolean')
        settings.keyboardShortcuts = s.value
      if (
        s.key === 'reviewOrder' &&
        ['oldest', 'weakest'].includes(s.value as string)
      )
        settings.reviewOrder = s.value as StudySettings['reviewOrder']
      if (
        s.key === 'repetition' &&
        ['light', 'balanced', 'intensive'].includes(s.value as string)
      )
        settings.repetition = s.value as StudySettings['repetition']
      if (s.key === 'examDate' && validExamDate(s.value))
        settings.examDate = s.value as string
      if (
        s.key === 'dailyTargetMinutes' &&
        typeof s.value === 'number' &&
        s.value >= 5 &&
        s.value <= 600
      )
        settings.dailyTargetMinutes = s.value
    }
    return {
      settings,
      chunks,
      questions,
      logs,
      sessions,
      ui: ui ?? { ...defaultUI },
    }
  })
}
export async function saveSettings(settings: StudySettings, db = database) {
  if (
    settings.dailyNewLimit !== undefined &&
    (!Number.isInteger(settings.dailyNewLimit) ||
      settings.dailyNewLimit < 0 ||
      settings.dailyNewLimit > 50)
  )
    throw new Error('New-topic limit must be 0–50 or blank.')
  if (
    (settings.examDate !== undefined && !validExamDate(settings.examDate)) ||
    (settings.dailyTargetMinutes !== undefined &&
      (!Number.isInteger(settings.dailyTargetMinutes) ||
        settings.dailyTargetMinutes < 5 ||
        settings.dailyTargetMinutes > 600))
  )
    throw new Error(
      'Enter a daily target of 5–600 minutes, or leave minutes blank.',
    )
  await db.transaction('rw', db.settings, async () => {
    for (const key of [
      'dailyNewLimit',
      'shuffleQuestions',
      'reviewOrder',
      'repetition',
      'keyboardShortcuts',
    ] as const) {
      await db.settings.put({ key, value: settings[key] ?? null })
    }
    // Retain legacy dates for compatibility, but no current UI/planner requires one.
    if (settings.examDate !== undefined)
      await db.settings.put({ key: 'examDate', value: settings.examDate })
    if (settings.dailyTargetMinutes === undefined)
      await db.settings.delete('dailyTargetMinutes')
    else
      await db.settings.put({
        key: 'dailyTargetMinutes',
        value: settings.dailyTargetMinutes,
      })
  })
}
export async function saveUI(ui: UIRecord, db = database) {
  await db.ui.put(ui)
}
export async function openChunk(
  chunk: RuntimeChunk,
  db = database,
  now = new Date(),
) {
  await db.transaction('rw', db.chunkProgress, async () => {
    const p = await db.chunkProgress.get(chunk.id),
      at = now.toISOString()
    await db.chunkProgress.put({
      ...p,
      chunkId: chunk.id,
      firstOpenedAt: p?.firstOpenedAt ?? at,
      lastOpenedAt: at,
    })
  })
}
export function reconcileSession(
  session: SessionRecord,
  data: Curriculum,
): SessionRecord {
  const index = indexContent(data)
  // Remove retired pending items only; completed history and its cursor stay intact.
  const pending = session.items
    .slice(session.cursor)
    .filter(
      (i) =>
        index.chunks.has(i.chunkId) &&
        (i.kind === 'study' ||
          index.questions.get(i.questionId)?.chunk.id === i.chunkId),
    )
    .map((i) => ({ ...i, revision: index.chunks.get(i.chunkId)!.revision }))
  return {
    ...session,
    items: [...session.items.slice(0, session.cursor), ...pending],
    revealed:
      session.items[session.cursor]?.revision === pending[0]?.revision
        ? session.revealed
        : false,
  }
}
export async function startToday(
  data: Curriculum,
  db = database,
  now = new Date(),
) {
  return db.transaction('rw', db.tables, async () => {
    const state = await snapshot(db)
    const unfinished = state.sessions
      .filter((s) => s.kind === 'today' && s.cursor < s.items.length)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    const session = unfinished
      ? reconcileSession(unfinished, data)
      : {
          id: crypto.randomUUID(),
          kind: 'today' as const,
          day: localDay(now),
          createdAt: now.toISOString(),
          items: planToday(
            data,
            state.chunks,
            state.questions,
            state.settings,
            now,
          ).items,
          cursor: 0,
          revealed: false,
        }
    await db.sessions.put(session)
    await db.ui.put({
      ...state.ui,
      activeSessionId: session.id,
      activeChunkId: session.items[session.cursor]?.chunkId,
      mode:
        session.items[session.cursor]?.kind === 'study'
          ? 'study'
          : session.cursor < session.items.length
            ? 'review'
            : 'shell',
      reviewTopic: false,
      tab: 'today',
    })
    return session
  })
}
export async function startPractice(
  chunk: RuntimeChunk,
  questionId?: string,
  db = database,
  now = new Date(),
) {
  const shuffle = (await db.settings.get('shuffleQuestions'))?.value === true
  const items = (
    shuffle
      ? questionOrder(chunk.questions, now.toISOString())
      : chunk.questions
  )
    .filter((q) => !questionId || q.id === questionId)
    .map((q) => ({
      kind: 'review' as const,
      chunkId: chunk.id,
      questionId: q.id,
      revision: chunk.revision,
    }))
  if (!items.length) throw new Error('Question is not in this topic.')
  return db.transaction(
    'rw',
    db.sessions,
    db.chunkProgress,
    db.ui,
    async () => {
      const at = now.toISOString(),
        p = await db.chunkProgress.get(chunk.id)
      if (!questionId)
        await db.chunkProgress.put({
          ...p,
          chunkId: chunk.id,
          firstOpenedAt: p?.firstOpenedAt ?? at,
          lastOpenedAt: at,
          studyCompletedAt: p?.studyCompletedAt ?? at,
          lastStudiedAt: at,
          seenRevision: chunk.revision,
        })
      const session: SessionRecord = {
        id: crypto.randomUUID(),
        kind: 'practice',
        day: localDay(now),
        createdAt: at,
        items,
        cursor: 0,
        revealed: false,
      }
      await db.sessions.add(session)
      const ui = (await db.ui.get('current')) ?? defaultUI
      await db.ui.put({
        ...ui,
        activeSessionId: session.id,
        activeChunkId: chunk.id,
        mode: 'review',
        reviewTopic: false,
      })
      return session
    },
  )
}
async function advanceUI(db: PsychFlashDatabase, session: SessionRecord) {
  const ui = (await db.ui.get('current')) ?? defaultUI,
    item = session.items[session.cursor]
  await db.ui.put({
    ...ui,
    activeSessionId: session.id,
    activeChunkId: item?.chunkId,
    mode: item?.kind === 'study' ? 'study' : item ? 'review' : 'shell',
    reviewTopic: false,
  })
}
export async function completeStudy(
  sessionId: string,
  cursor: number,
  db = database,
  now = new Date(),
) {
  return db.transaction(
    'rw',
    db.sessions,
    db.chunkProgress,
    db.ui,
    async () => {
      const session = await db.sessions.get(sessionId)
      if (!session) throw new Error('Session is missing. Return to Today.')
      if (session.cursor !== cursor) return session
      const item = session.items[cursor]
      if (!item || item.kind !== 'study')
        throw new Error('This session is not at a study item.')
      const p = await db.chunkProgress.get(item.chunkId),
        at = now.toISOString()
      await db.chunkProgress.put({
        ...p,
        chunkId: item.chunkId,
        firstOpenedAt: p?.firstOpenedAt ?? at,
        studyCompletedAt: p?.studyCompletedAt ?? at,
        lastOpenedAt: at,
        lastStudiedAt: at,
        seenRevision: item.revision,
      })
      const next = { ...session, cursor: cursor + 1, revealed: false }
      await db.sessions.put(next)
      await advanceUI(db, next)
      return next
    },
  )
}
export async function revealAnswer(
  sessionId: string,
  cursor: number,
  db = database,
) {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId)
    if (!s || s.cursor !== cursor || s.items[cursor]?.kind !== 'review')
      throw new Error('Session changed. Refresh before continuing.')
    await db.sessions.put({ ...s, revealed: true })
  })
}
export async function rateAnswer(
  sessionId: string,
  cursor: number,
  rating: ReviewRating,
  db = database,
  now = new Date(),
) {
  return db.transaction(
    'rw',
    db.sessions,
    db.questionState,
    db.reviewLog,
    db.settings,
    db.ui,
    async () => {
      const s = await db.sessions.get(sessionId)
      if (!s) throw new Error('Session is missing.')
      const eventId = `${sessionId}:${cursor}`
      if (await db.reviewLog.get(eventId)) return s
      if (s.cursor !== cursor || !s.revealed)
        throw new Error('Reveal the current answer before rating it.')
      const item = s.items[cursor]
      if (!item || item.kind !== 'review')
        throw new Error('No review question at this position.')
      const previous = await db.questionState.get(item.questionId)
      const intensity = (await db.settings.get('repetition'))?.value
      const retention =
        intensity === 'light' ? 0.8 : intensity === 'intensive' ? 0.95 : 0.9
      const card = scheduleReview(
          previous?.schedulerCard,
          rating,
          now,
          retention,
        ),
        at = now.toISOString()
      await db.questionState.put({
        questionId: item.questionId,
        schedulerCard: card,
        dueAt: card.due,
        lastReviewedAt: at,
        lastRating: rating,
        contentRevision: item.revision,
      })
      await db.reviewLog.add({
        retention,
        id: eventId,
        questionId: item.questionId,
        reviewedAt: at,
        rating,
        contentRevision: item.revision,
      })
      const next = { ...s, cursor: cursor + 1, revealed: false }
      await db.sessions.put(next)
      await advanceUI(db, next)
      return next
    },
  )
}
