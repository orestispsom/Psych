import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import { PsychFlashDatabase } from '../../db/database'
import {
  snapshot,
  saveSettings,
  startToday,
  completeStudy,
  revealAnswer,
  rateAnswer,
  startPractice,
  reconcileSession,
} from '../../db/operations'
import { exportBackup, importBackup, parseBackup } from '../../db/backup'
import { curriculum, now } from './fixtures'
let db: PsychFlashDatabase
beforeEach(() => {
  db = new PsychFlashDatabase('test-' + crypto.randomUUID())
})
afterEach(async () => {
  await db.delete()
})
describe('durable study transactions', () => {
  it('persists setup, session cursor, reveal and FSRS rating across reopen', async () => {
    await saveSettings({ examDate: '2027-01-01' }, db)
    const session = await startToday(curriculum, db, now)
    expect(session.items[0].kind).toBe('study')
    await completeStudy(session.id, 0, db, now)
    await revealAnswer(session.id, 1, db)
    db.close()
    await db.open()
    expect((await db.sessions.get(session.id))?.revealed).toBe(true)
    await rateAnswer(session.id, 1, 'good', db, now)
    const saved = await snapshot(db)
    expect(saved.logs).toHaveLength(1)
    expect(saved.questions[0].schedulerCard?.reps).toBe(1)
    expect(saved.sessions[0].cursor).toBe(2)
    expect(
      (await startToday(curriculum, db, new Date('2026-10-08T12:00:00Z'))).id,
    ).toBe(session.id)
  })
  it('prevents duplicate ratings across concurrent clicks and tabs', async () => {
    const s = await startPractice(curriculum.chunks[0], undefined, db, now)
    await revealAnswer(s.id, 0, db)
    await Promise.all([
      rateAnswer(s.id, 0, 'good', db, now),
      rateAnswer(s.id, 0, 'easy', db, now),
    ])
    expect(await db.reviewLog.count()).toBe(1)
    expect((await db.questionState.toArray())[0].schedulerCard?.reps).toBe(1)
    expect((await db.sessions.get(s.id))?.cursor).toBe(1)
  })
  it('rejects rating before reveal, preserving all state', async () => {
    const s = await startPractice(curriculum.chunks[0], undefined, db, now)
    await expect(rateAnswer(s.id, 0, 'hard', db, now)).rejects.toThrow('Reveal')
    expect(await db.questionState.count()).toBe(0)
    expect((await db.sessions.get(s.id))?.cursor).toBe(0)
  })
  it('rolls back progress and cursor when a review log write fails', async () => {
    const s = await startPractice(curriculum.chunks[0], undefined, db, now)
    await revealAnswer(s.id, 0, db)
    const spy = vi
      .spyOn(db.reviewLog, 'add')
      .mockRejectedValueOnce(new Error('Storage full'))
    await expect(rateAnswer(s.id, 0, 'good', db, now)).rejects.toThrow(
      'Storage full',
    )
    spy.mockRestore()
    expect(await db.questionState.count()).toBe(0)
    expect((await db.sessions.get(s.id))?.cursor).toBe(0)
  })
  it('reconciles content revision without resetting scheduler history', async () => {
    const s = await startPractice(curriculum.chunks[0], undefined, db, now)
    const revised = structuredClone(curriculum)
    revised.chunks[0].revision = 3
    const fresh = reconcileSession({ ...s, revealed: true }, revised)
    expect(fresh.items[0].revision).toBe(3)
    expect(fresh.revealed).toBe(false)
    const retired = { ...revised, chunks: [] }
    expect(reconcileSession(s, retired).items).toHaveLength(0)
  })
})
describe('backup safety', () => {
  async function populated() {
    await saveSettings({ examDate: '2027-01-01', dailyTargetMinutes: 30 }, db)
    const s = await startPractice(curriculum.chunks[0], undefined, db, now)
    await revealAnswer(s.id, 0, db)
    await rateAnswer(s.id, 0, 'good', db, now)
    return exportBackup(db)
  }
  it('round trips settings, history, scheduler and sessions atomically', async () => {
    const b = await populated(),
      target = new PsychFlashDatabase('target-' + crypto.randomUUID())
    try {
      await importBackup(JSON.parse(JSON.stringify(b)), target)
      const restored = await exportBackup(target)
      expect({ ...restored, exportedAt: b.exportedAt }).toEqual(b)
    } finally {
      await target.delete()
    }
  })
  it('refuses corrupt/duplicate/new-schema imports without losing current data', async () => {
    const b = await populated()
    for (const bad of [
      { ...b, schemaVersion: 2 },
      { ...b, questionState: [...b.questionState, ...b.questionState] },
      { ...b, reviewLog: [{ ...b.reviewLog[0], rating: 'bad' }] },
      { ...b, questionState: [{ ...b.questionState[0], dueAt: 'nonsense' }] },
    ]) {
      await expect(importBackup(bad, db)).rejects.toThrow()
      expect(await db.reviewLog.count()).toBe(1)
    }
  })
  it('preserves well-formed retired stable IDs instead of discarding history', async () => {
    const b = await populated()
    b.chunkProgress.push({
      chunkId: 'PSY-999',
      studyCompletedAt: now.toISOString(),
      seenRevision: 1,
    })
    expect(parseBackup(b).chunkProgress).toHaveLength(2)
    await importBackup(b, db)
    expect(await db.chunkProgress.get('PSY-999')).toBeDefined()
  })
  it('rejects a cursor behind committed events and rolls back failed replacement', async () => {
    const backup = await populated()
    const corrupt = structuredClone(backup)
    corrupt.sessions![0].cursor = 0
    await expect(importBackup(corrupt, db)).rejects.toThrow('corrupt')
    const spy = vi
      .spyOn(db.reviewLog, 'bulkPut')
      .mockRejectedValueOnce(new Error('Storage full'))
    await expect(importBackup(backup, db)).rejects.toThrow('Storage full')
    spy.mockRestore()
    expect(await db.reviewLog.count()).toBe(1)
    expect((await db.sessions.toArray())[0].cursor).toBe(1)
    expect((await db.settings.get('examDate'))?.value).toBe('2027-01-01')
  })
})
it('migrates existing v2 IndexedDB without erasing learner state', async () => {
  const legacy = new Dexie(db.name)
  legacy.version(1).stores({
    settings: '&key',
    chunkProgress: '&chunkId, studyCompletedAt, lastOpenedAt',
    questionState: '&questionId, lastReviewedAt, lastRating',
    reviewLog: '&id, questionId, reviewedAt, rating',
  })
  legacy
    .version(2)
    .stores({ questionState: '&questionId, lastReviewedAt, lastRating, dueAt' })
  await legacy.table('settings').put({ key: 'examDate', value: '2027-01-01' })
  await legacy.table('chunkProgress').put({
    chunkId: 'PSY-001',
    studyCompletedAt: now.toISOString(),
    seenRevision: 1,
  })
  legacy.close()
  await db.open()
  expect((await snapshot(db)).chunks).toHaveLength(1)
  expect(db.verno).toBe(4)
  expect(await db.sessions.count()).toBe(0)
})
