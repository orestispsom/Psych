import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import App from './App'

afterEach(() => { cleanup(); localStorage.clear() })
function profileStore(id) {
  return JSON.stringify({
    version: 1, activeProfileId: id,
    profiles: { [id]: { id, name: id, mcqProgress: { questions: {} } } },
  })
}
function mount() {
  window.history.replaceState({}, '', '/')
  return render(<BrowserRouter><App /></BrowserRouter>)
}
it('opens the home screen immediately when an ordinary selected profile is remembered', async () => {
  localStorage.setItem('psychiatry-study-profiles-v1', profileStore('alice'))
  const { container } = mount()
  await waitFor(() => expect(container.querySelector('.home-modules')).toBeTruthy())
  expect(screen.queryByLabelText('Όνομα προφίλ')).toBeNull()
})
it('returns to the selected admin profile unlock directly, not a new selection step', async () => {
  localStorage.setItem('psychiatry-study-profiles-v1', profileStore('orestis'))
  mount()
  expect(await screen.findByRole('dialog', { name: 'Επαλήθευση προφίλ διαχειριστή' })).toBeTruthy()
  expect(screen.getByLabelText('Κωδικός διαχειριστή')).toBeTruthy()
})
it('opens the home screen for previously authorized remembered admin access', async () => {
  localStorage.setItem('psychiatry-study-profiles-v1', profileStore('orestis'))
  localStorage.setItem('psychiatry-admin-remember-v1', 'orestis')
  const { container } = mount()
  await waitFor(() => expect(container.querySelector('.home-modules')).toBeTruthy())
  expect(screen.queryByRole('dialog', { name: 'Επαλήθευση προφίλ διαχειριστή' })).toBeNull()
})

it('recovers Orestis directly when remember is enabled but activeProfileId was lost', async () => {
  localStorage.setItem('psychiatry-study-profiles-v1', JSON.stringify({
    version: 1, activeProfileId: null, profiles: {
      orestis: { id: 'orestis', name: 'Orestis', mcqProgress: { questions: {} } },
    },
  }))
  localStorage.setItem('psychiatry-admin-remember-v1', 'orestis')
  const { container } = mount()
  await waitFor(() => expect(container.querySelector('.home-modules')).toBeTruthy())
  expect(screen.queryByLabelText('Όνομα προφίλ')).toBeNull()
  const restored = JSON.parse(localStorage.getItem('psychiatry-study-profiles-v1'))
  expect(restored.activeProfileId).toBe('orestis')
})

it('keeps Orestis PIN requirement when no remembered admin access was granted', async () => {
  localStorage.setItem('psychiatry-study-profiles-v1', profileStore('orestis'))
  mount()
  const pin = await screen.findByRole('dialog', { name: 'Επαλήθευση προφίλ διαχειριστή' })
  expect(screen.getByLabelText('Κωδικός διαχειριστή')).toBeTruthy()
  expect(screen.getByLabelText('Να με θυμάται σε αυτή τη συσκευή')).not.toBeChecked()
  expect(pin).toBeTruthy()
  expect(screen.queryByText('Ενότητες', { selector: 'h2' })).toBeNull()
})

it('keeps explicit Switch Profile on the selector even when Orestis is remembered', async () => {
  const user = userEvent.setup()
  localStorage.setItem('psychiatry-study-profiles-v1', profileStore('orestis'))
  localStorage.setItem('psychiatry-admin-remember-v1', 'orestis')
  const { container } = mount()
  await waitFor(() => expect(container.querySelector('.home-modules')).toBeTruthy())
  await user.click(screen.getByRole('button', { name: /Αλλαγή προφίλ. Τρέχον προφίλ: orestis/ }))
  expect(await screen.findByLabelText('Όνομα προφίλ')).toBeTruthy()
  await waitFor(() => expect(container.querySelector('.home-modules')).toBeNull())
})

it('shows sections and calendar before Update and puts Mastered/Answered last', async () => {
  localStorage.setItem('psychiatry-study-profiles-v1', profileStore('alice'))
  const { container } = mount()
  const home = await waitFor(() => {
    const h = container.querySelector('.home')
    expect(h?.querySelector('.home-calendar')).toBeTruthy()
    return h
  })
  const modules = home.querySelector('.home-modules-section')
  const calendar = home.querySelector('.home-calendar')
  const update = home.querySelector('.home-update-note')
  const stats = home.querySelector('.figures')
  const ahead = (left, right) => Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING)
  expect(ahead(modules, calendar)).toBe(true)
  expect(ahead(calendar, update)).toBe(true)
  expect(ahead(update, stats)).toBe(true)
  expect(stats.textContent).toContain('Mastered')
  expect(stats.textContent).toContain('Απαντημένες')
})
