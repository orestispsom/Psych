import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PsychFlashDatabase } from '../../db/database'
import { I18nProvider } from '../../i18n'
import StudyApp from '../../app/StudyApp'
import { snapshot } from '../../db/operations'
import { curriculum } from './fixtures'

vi.mock('../../content/loader', () => ({ loadCurriculum: async () => curriculum }))
let db: PsychFlashDatabase | undefined
afterEach(async () => {
  cleanup()
  if (db) await db.delete()
  db = undefined
})
it('keeps a session open during topic navigation, explicit Home and remount', async () => {
  const user = userEvent.setup()
  db = new PsychFlashDatabase('path-ui-' + crypto.randomUUID())
  const app = () => <I18nProvider db={db!}><StudyApp db={db!} /></I18nProvider>
  const mounted = render(app())
  const start = await screen.findByRole('button', { name: /Πρώτα τα σημαντικότερα/ })
  await user.click(start)
  expect(await screen.findByRole('heading', { name: 'Topic 1' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: /Επόμενο θέμα/ }))
  expect(await screen.findByRole('heading', { name: 'Topic 2' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Αρχική Μελέτης' }))
  expect(await screen.findByRole('heading', { name: 'Οι διαδρομές σου' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: /Πρώτα τα σημαντικότερα/ }))
  expect(await screen.findByRole('heading', { name: 'Topic 2' })).toBeTruthy()
  await waitFor(async () => {
    expect((await snapshot(db!)).ui.activePathId).toBeTruthy()
    expect((await snapshot(db!)).paths[0].cursor).toBe(1)
  })
  mounted.unmount()
  render(app())
  expect(await screen.findByRole('heading', { name: 'Topic 2' })).toBeTruthy()
  // Navigating or opening topics does not silently assert mastery.
  expect((await snapshot(db)).chunks.every(p => !p.studyCompletedAt)).toBe(true)
})
