import { afterEach, expect, it } from 'vitest'
import { PsychFlashDatabase } from '../../db/database'
import { snapshot, savePath, removePath, startPractice, revealAnswer, rateAnswer } from '../../db/operations'
import { journal, delta, applyDelta } from '../../cloud/sync'
import { exportBackup } from '../../db/backup'
import { createPath, movePath, restartPath, readPaths } from '../../learning/paths'
import { curriculum, now } from './fixtures'

const databases: PsychFlashDatabase[] = []
const db = () => {
  const instance = new PsychFlashDatabase('path-test-' + crypto.randomUUID())
  databases.push(instance)
  return instance
}
afterEach(async () => { await Promise.all(databases.splice(0).map(d => d.delete())) })

it('offers six distinct modes with stable, independent saved orders', () => {
  for (const strategy of ['high', 'rare', 'random', 'systematic'] as const) {
    const p = createPath(curriculum, strategy, strategy, [], [], [], now)
    expect(p.sequence).toHaveLength(3)
    expect(p.sequence).toEqual([...new Set(p.sequence)])
  }
  const random = createPath(curriculum, 'random', 'Random', [], [], [], now)
  expect(movePath(random, 1).cursor).toBe(1)
  expect(movePath(random, 1).visited).toEqual([random.sequence[0]])
  expect(random.cursor).toBe(0)
  expect(restartPath(movePath(random, 1)).visited).toHaveLength(0)
  expect(() => createPath(curriculum, 'weak', 'Weak', [], [], [], now)).toThrow()
  expect(() => createPath(curriculum, 'review', 'Review', [], [], [], now)).toThrow()
})

it('persists two paths independently without modifying shared learning history', async () => {
  const d = db()
  const first = createPath(curriculum, 'high', 'High', [], [], [], now)
  const second = createPath(curriculum, 'random', 'Random', [], [], [], now)
  await journal(async () => {
    await savePath(movePath(first, 1), d)
    await savePath(second, d)
  }, d)
  d.close()
  await d.open()
  const saved = await snapshot(d)
  expect(saved.paths).toHaveLength(2)
  expect(saved.paths.find(p => p.id === first.id)?.cursor).toBe(1)
  expect(saved.paths.find(p => p.id === second.id)?.cursor).toBe(0)
  expect(saved.chunks).toHaveLength(0)
  await journal(() => removePath(first.id, d), d)
  expect((await snapshot(d)).paths).toHaveLength(1)
  expect((await d.outbox.count())).toBe(2)
})

it('synchronizes paths via existing safe settings events alongside real FSRS history', async () => {
  const a = db(), b = db()
  const before = await exportBackup(a)
  const path = createPath(curriculum, 'high', 'High', [], [], [], now)
  await savePath(path, a)
  const s = await startPractice(curriculum.chunks[0], undefined, a, now)
  await revealAnswer(s.id, 0, a)
  await rateAnswer(s.id, 0, 'good', a, now)
  const patch = delta(before, await exportBackup(a))
  await b.transaction('rw', b.tables, () => applyDelta(b, patch))
  const restored = await snapshot(b)
  expect(restored.paths.map(p => p.id)).toEqual([path.id])
  expect(restored.logs).toHaveLength(1)
  expect(restored.questions[0].schedulerCard?.reps).toBe(1)
  expect(readPaths(await b.settings.toArray())[0].sequence).toEqual(path.sequence)
})
