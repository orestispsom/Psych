import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
