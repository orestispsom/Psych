import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { McqActivityCalendar, McqActivityDay } from './components/McqActivityCalendar.jsx'
import { athensDayKey } from './lib/mcqActivity.mjs'

afterEach(() => cleanup())
const q1 = {id:1,stem:'Calendar question one',options:['wrong','right','another'],correct:1,explanation:'An explanation.'}
const q2 = {id:2,stem:'Calendar question two',options:['wrong','right','another'],correct:1,explanation:'Other explanation.'}
const questions = {1:q1,2:q2}
const getQuestion = id => questions[id] || null

it('renders per-mode totals, with no question list, and starts one review per wrong question', async () => {
  const user = userEvent.setup()
  const attempts = [
    { id:'remote-1',questionId:1,mode:'sprint',isCorrect:false,attemptedAt:'2026-10-12T21:30:00Z' },
    { id:'remote-2',questionId:1,mode:'random',isCorrect:false,attemptedAt:'2026-10-12T21:45:00Z' },
    { id:'remote-3',questionId:2,mode:'written',isCorrect:true,attemptedAt:'2026-10-13T10:00:00Z' },
  ]
  const loadRemote = vi.fn(async () => attempts)
  const onRecordAnswer = vi.fn()
  render(<McqActivityDay date="2026-10-13" profileId="test"
    progress={{attempts:[attempts[0]]}} loadRemote={loadRemote}
    getQuestion={getQuestion} onRecordAnswer={onRecordAnswer} onBack={() => {}} />)
  await waitFor(() => expect(screen.getByText('3', {selector:'.activity-stats strong'})).toBeTruthy())
  const stats = document.querySelector('.activity-stats')
  expect(within(stats).getByText('3')).toBeTruthy()
  expect(within(stats).getByText('1')).toBeTruthy()
  expect(within(stats).getByText('2')).toBeTruthy()
  expect(screen.getByText('Mini-test')).toBeTruthy()
  expect(screen.getByText('Τυχαία θέματα')).toBeTruthy()
  expect(screen.getByText('Προσομοίωση 100')).toBeTruthy()
  expect(screen.queryByText('Calendar question one')).toBeNull()
  await user.click(screen.getByRole('button', {name:'Επανάληψη λαθών (1)'}))
  expect(await screen.findByText('Calendar question one')).toBeTruthy()
  expect(screen.queryByText('Calendar question two')).toBeNull()
  await user.click(screen.getByRole('button', {name:/right/}))
  await user.click(screen.getByRole('button', {name:/Καταχώρηση/}))
  expect(onRecordAnswer).toHaveBeenCalledTimes(1)
  expect(onRecordAnswer.mock.calls[0][0].id).toBe(1)
})
it('shows a calendar for Athens today and opens a clicked date', async () => {
  const user = userEvent.setup()
  const today = athensDayKey(new Date())
  const onOpenDay = vi.fn()
  render(<McqActivityCalendar profileId="test"
    progress={{attempts:[{id:'one',questionId:1,mode:'random',isCorrect:true,attemptedAt:new Date().toISOString()}]}}
    loadRemote={null} onOpenDay={onOpenDay} />)
  const calendar = screen.getByRole('region',{name:'Ημερολόγιο MCQ'})
  expect(within(calendar).getByText('1 MCQ')).toBeTruthy()
  await user.click(within(calendar).getByRole('button',{name:/1 απαντήσεις/}))
  expect(onOpenDay).toHaveBeenCalledWith(today)
})
