import { expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { PsychFlashDatabase } from '../../db/database'
import { ProfileSync, journal } from '../../cloud/sync'
import { cloudUrl, publishableKey } from '../../cloud/config'
import { parseCurriculum } from '../../content/loader'
import { snapshot, startToday, completeStudy, startPractice, revealAnswer, rateAnswer, saveSettings } from '../../db/operations'

// Explicit opt-in only: never run against real cloud profiles in ordinary CI.
// All remote writes use newly generated disposable IDs recorded for cleanup.
it.runIf(process.env.PSYCH_STUDY_CLOUD_TEST === '1')('restores real Supabase progress across independent stores, retries offline work and preserves concurrent reviews', async () => {
  const headers = { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, 'Content-Type': 'application/json' }
  const profiles = [1, 2].map(n => ({ id: `codex-study-${crypto.randomUUID()}`, name: `Έλεγχος Μελέτης ${n}-${Date.now()}`, theme_preference: 'dark' }))
  const fixtureFile = resolve(tmpdir(), 'psych-study-cloud-fixtures.json')
  writeFileSync(fixtureFile, JSON.stringify(profiles, null, 2))
  const response = await fetch(`${cloudUrl}/rest/v1/study_profiles`, { method: 'POST', headers, body: JSON.stringify(profiles) })
  expect(response.ok, `Synthetic profile creation returned ${response.status}`).toBe(true)
  const curriculum = parseCurriculum(JSON.parse(readFileSync(resolve(process.cwd(), 'public/study/runtime-content.el.json'), 'utf8')), true)
  const chunk = curriculum.chunks[0]
  const a = new PsychFlashDatabase(`cloud-test-A-${profiles[0].id}`)
  const b = new PsychFlashDatabase(`cloud-test-B-${profiles[0].id}`)
  const c = new PsychFlashDatabase(`cloud-test-C-${profiles[0].id}`)
  const other = new PsychFlashDatabase(`cloud-test-other-${profiles[1].id}`)
  const syncA = new ProfileSync(profiles[0].id, a)
  const syncB = new ProfileSync(profiles[0].id, b)
  try {
    let session: Awaited<ReturnType<typeof startToday>> | undefined
    await journal(async () => { session = await startToday(curriculum, a) }, a)
    await journal(() => completeStudy(session!.id, 0, a), a)
    await journal(() => revealAnswer(session!.id, 1, a), a)
    await journal(() => rateAnswer(session!.id, 1, 'again', a), a)
    await syncA.sync()
    await syncB.sync()
    expect((await snapshot(b)).logs).toHaveLength(1)
    expect((await snapshot(b)).questions).toEqual((await snapshot(a)).questions)

    await journal(() => saveSettings({ dailyNewLimit: 0 }, a), a)
    await journal(() => saveSettings({ dailyNewLimit: 2 }, a), a)
    const realFetch = globalThis.fetch
    globalThis.fetch = async () => { throw new TypeError('synthetic offline connection') }
    try { await expect(syncA.sync()).rejects.toThrow() }
    finally { globalThis.fetch = realFetch }
    expect(await a.outbox.count()).toBe(2)
    await syncB.sync()
    expect((await snapshot(b)).settings.dailyNewLimit).toBeUndefined()
    await syncA.sync()
    await syncB.sync()
    expect((await snapshot(b)).settings.dailyNewLimit).toBe(2)
    expect(await a.outbox.count()).toBe(0)

    for (const [store, rating] of [[a, 'good'], [b, 'hard']] as const) {
      let review: Awaited<ReturnType<typeof startPractice>> | undefined
      await journal(async () => { review = await startPractice(chunk, chunk.questions[0].id, store) }, store)
      await journal(() => revealAnswer(review!.id, 0, store), store)
      await journal(() => rateAnswer(review!.id, 0, rating, store), store)
    }
    await Promise.all([syncA.sync(), syncB.sync()])
    await syncA.sync()
    await new ProfileSync(profiles[0].id, c).sync()
    const restored = await snapshot(c)
    expect(restored.logs).toHaveLength(3)
    expect(new Set(restored.logs.map(log => log.id)).size).toBe(3)
    expect(restored.questions).toEqual((await snapshot(a)).questions)
    expect(restored.sessions).toHaveLength(3)
    await new ProfileSync(profiles[1].id, other).sync()
    expect((await snapshot(other)).logs).toHaveLength(0)
    // Leave these two temporary remote profiles available for browser QA.
    console.log(`Cloud QA fixtures recorded in ${fixtureFile}; all three reviews restored.`)
  } finally {
    await Promise.all([a, b, c, other].map(store => store.delete()))
  }
}, 90000)

it.runIf(process.env.PSYCH_STUDY_VERIFY_UI === '1')('restores the browser-origin review and saved Today cursor in a fresh client', async () => {
  const profiles = JSON.parse(readFileSync(resolve(tmpdir(), 'psych-study-cloud-fixtures.json'), 'utf8'))
  const db = new PsychFlashDatabase(`verify-browser-${crypto.randomUUID()}`)
  try {
    await new ProfileSync(profiles[0].id, db).sync()
    const state = await snapshot(db)
    expect(state.logs).toHaveLength(4)
    expect(state.logs.find(log => log.questionId === 'PSY-001-Q02')?.rating).toBe('good')
    expect(state.sessions.find(session => session.kind === 'today')?.cursor).toBe(3)
    expect(state.settings.dailyNewLimit).toBe(2)
    expect(state.settings.shuffleQuestions).toBe(true)
    expect(state.settings.reviewOrder).toBe('weakest')
    expect(state.chunks.filter(chunk => chunk.studyCompletedAt)).toHaveLength(1)
  } finally { await db.delete() }
}, 60000)
