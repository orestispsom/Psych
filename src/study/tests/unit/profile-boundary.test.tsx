import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import StudyModule, { studyController } from '../../StudyModule'

vi.mock('../../cloud/config', () => ({ cloudEnabled: true, cloudUrl: 'https://study-test.invalid', publishableKey: 'test-only' }))
const opened: ReturnType<typeof studyController>[] = []
afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  await Promise.all(opened.splice(0).map(controller => controller.db.delete()))
})
it('does not present an empty schedule as restored progress on a first offline visit', async () => {
  const profile = { id: `unit-first-${crypto.randomUUID()}`, name: 'Synthetic first visit' }
  opened.push(studyController(profile.id))
  const ensure = vi.fn().mockRejectedValue(new Error('offline'))
  render(<StudyModule profile={profile} ensureProfile={ensure} />)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('πρώτη φόρτωση'))
  expect(screen.queryByRole('heading', { name: 'Σήμερα' })).toBeNull()
})
it('opens a cached profile immediately while unavailable cloud sync retries in the background', async () => {
  const profile = { id: `unit-cached-${crypto.randomUUID()}`, name: 'Synthetic cached visit' }
  const controller = studyController(profile.id)
  opened.push(controller)
  await controller.db.syncMeta.put({ key: 'cursor', value: 0 })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('runtime-content')) {
      const file = String(url).endsWith('.el.json') ? 'runtime-content.el.json' : 'runtime-content.json'
      return new Response(readFileSync(resolve(process.cwd(), 'public/study', file), 'utf8'))
    }
    throw new TypeError('offline')
  }))
  const ensure = vi.fn().mockRejectedValue(new Error('offline'))
  render(<StudyModule profile={profile} ensureProfile={ensure} />)
  expect(await screen.findByRole('heading', { name: 'Σήμερα' })).toBeTruthy()
  expect(screen.getByText(/Πρόοδος: Synthetic cached visit/)).toBeTruthy()
})
