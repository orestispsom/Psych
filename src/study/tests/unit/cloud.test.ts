import { afterEach, expect, it, vi } from 'vitest'
import { PsychFlashDatabase } from '../../db/database'
import {
  journal,
  validateProfileId,
  ProfileSync,
  delta,
  applyDelta,
  replayQuestions,
} from '../../cloud/sync'
import { exportBackup } from '../../db/backup'
import {
  saveSettings,
  snapshot,
  startPractice,
  revealAnswer,
  rateAnswer,
} from '../../db/operations'
import { curriculum, now } from './fixtures'
import { planToday, questionOrder } from '../../learning/planner'
it('uploads multiple queued settings in commit order, not random UUID order', async () => {
  const d = db()
  for (const examDate of ['2027-01-01', '2028-01-01', '2029-01-01'])
    await journal(() => saveSettings({ examDate }, d), d)
  const queue = await d.outbox.orderBy('sequence').toArray()
  expect(queue.map((e) => e.sequence)).toEqual([1, 2, 3])
  const fetcher = vi.fn().mockImplementation(async (_url, init) => {
    const events = JSON.parse(init.body).p_events
    expect(events.map((e: { sequence: number }) => e.sequence)).toEqual([
      1, 2, 3,
    ])
    return new Response(
      JSON.stringify({
        version: 3,
        events: events.map((e: object, i: number) => ({
          ...e,
          version: i + 1,
        })),
      }),
    )
  })
  vi.stubGlobal('fetch', fetcher)
  await new ProfileSync('ordered_test', d).sync()
  expect((await snapshot(d)).settings.examDate).toBe('2029-01-01')
  expect(await d.outbox.count()).toBe(0)
})
const databases: PsychFlashDatabase[] = []
it('saves settings without a date and ignores legacy exam dates in the daily plan', async () => {
  const d = db()
  await saveSettings({ dailyTargetMinutes: 20, dailyNewLimit: 2 }, d)
  expect((await snapshot(d)).settings.examDate).toBeUndefined()
  const settings = (await snapshot(d)).settings
  const without = planToday(curriculum, [], [], settings, now)
  expect(without.newChunks).toBe(2)
  expect(
    planToday(curriculum, [], [], { ...settings, examDate: '2020-01-01' }, now),
  ).toEqual(without)
})
function db() {
  const d = new PsychFlashDatabase('cloud-test-' + crypto.randomUUID())
  databases.push(d)
  return d
}
afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(databases.splice(0).map((d) => d.delete()))
})
it('preserves existing Psych profile IDs without username normalization', () => {
  expect(validateProfileId('profile-Ορέστης')).toBe('profile-Ορέστης')
  expect(validateProfileId('Mixed_Case-42')).toBe('Mixed_Case-42')
  for (const bad of ['', 'a'.repeat(201), 'bad\nprofile'])
    expect(() => validateProfileId(bad)).toThrow()
})
it('commits progress and outbox together; a failed write rolls back both', async () => {
  const d = db()
  await journal(() => saveSettings({ examDate: '2027-01-01' }, d), d)
  expect(await d.outbox.count()).toBe(1)
  await expect(
    journal(async () => {
      await saveSettings({ examDate: '2028-01-01' }, d)
      throw new Error('failure')
    }, d),
  ).rejects.toThrow('failure')
  expect((await snapshot(d)).settings.examDate).toBe('2027-01-01')
  expect(await d.outbox.count()).toBe(1)
})
it('keeps failed uploads across close/reopen and acknowledges only successful sync', async () => {
  const d = db()
  await journal(() => saveSettings({ examDate: '2027-01-01' }, d), d)
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  const engine = new ProfileSync('test_user', d)
  await expect(engine.sync()).rejects.toThrow('offline')
  d.close()
  await d.open()
  expect(await d.outbox.count()).toBe(1)
  const event = (await d.outbox.toArray())[0]
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ version: 1, events: [{ ...event, version: 1 }] }),
        ),
      ),
  )
  await engine.sync()
  expect(await d.outbox.count()).toBe(0)
  expect((await d.syncMeta.get('cursor'))?.value).toBe(1)
})
it('replays merged reviews deterministically and never decreases session cursor', async () => {
  const a = db(),
    b = db()
  const before = await exportBackup(a)
  const session = await startPractice(curriculum.chunks[0], undefined, a, now)
  await revealAnswer(session.id, 0, a)
  await rateAnswer(session.id, 0, 'good', a, now)
  const event = delta(before, await exportBackup(a))
  await b.transaction('rw', b.tables, async () => {
    await applyDelta(b, event)
    await replayQuestions(b)
  })
  expect((await snapshot(b)).questions).toEqual((await snapshot(a)).questions)
  const stale = {
    ...event,
    reviewLog: [],
    sessions: [{ ...session, cursor: 0 }],
  }
  await b.transaction('rw', b.tables, async () => {
    await applyDelta(b, stale)
    await replayQuestions(b)
  })
  expect((await b.sessions.get(session.id))?.cursor).toBe(1)
  expect(await b.reviewLog.count()).toBe(1)
})
it('settings persist and removing a cap survives cloud delta validation', async () => {
  const a = db(),
    b = db()
  await saveSettings({ examDate: '2027-01-01', dailyTargetMinutes: 20 }, a)
  const before = await exportBackup(a)
  await saveSettings(
    {
      examDate: '2027-01-01',
      shuffleQuestions: true,
      dailyNewLimit: 0,
      repetition: 'intensive',
      keyboardShortcuts: false,
      reviewOrder: 'weakest',
    },
    a,
  )
  const payload = delta(before, await exportBackup(a))
  await b.transaction('rw', b.tables, () => applyDelta(b, payload))
  expect((await snapshot(b)).settings).toMatchObject({
    shuffleQuestions: true,
    dailyNewLimit: 0,
    repetition: 'intensive',
    keyboardShortcuts: false,
    reviewOrder: 'weakest',
  })
  expect((await snapshot(b)).settings.dailyTargetMinutes).toBeUndefined()
})
it('new-topic pause does not omit due reviews; seeded order stays stable', () => {
  const chunk = curriculum.chunks[0]
  const due = [
    {
      questionId: chunk.questions[0].id,
      lastReviewedAt: now.toISOString(),
      dueAt: now.toISOString(),
    },
  ]
  const plan = planToday(
    curriculum,
    [],
    due,
    { examDate: '2027-01-01', dailyNewLimit: 0 },
    now,
  )
  expect(plan.newChunks).toBe(0)
  expect(plan.dueReviews).toBe(1)
  expect(questionOrder(chunk.questions, 'seed')).toEqual(
    questionOrder(chunk.questions, 'seed'),
  )
})
