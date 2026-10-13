import { afterEach, beforeEach, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router'
import App from './App'
import bank from './data/questions.js'
import { athensDayKey } from './lib/mcqActivity.mjs'

beforeEach(() => { localStorage.clear(); window.history.replaceState({},'', '/') })
afterEach(() => { cleanup(); localStorage.clear() })

it('opens a profile-specific Athens calendar date from Home and reviews recorded mistakes', async () => {
  const user = userEvent.setup()
  const now = new Date()
  const day = athensDayKey(now)
  const question = bank.find(q => q?.options?.length > 2 && Number.isInteger(q.correct))
  const wrongIndex = (question.correct + 1) % question.options.length
  const attempt = {
    id:'calendar-previous-answer', mode:'random', questionId:question.id,
    selected:wrongIndex, isCorrect:false, attemptedAt: now.toISOString(),
  }
  localStorage.setItem('psychiatry-study-profiles-v1',JSON.stringify({
    version:1, activeProfileId:'calendar-user',
    profiles:{'calendar-user':{id:'calendar-user',name:'Calendar User',mcqProgress:{
      questions:{}, attempts:[attempt], sprintSessions:[],writtenExamSessions:[],
    }}},
  }))
  const { container } = render(<BrowserRouter><App /></BrowserRouter>)
  const region = await screen.findByRole('region',{name:'Ημερολόγιο MCQ'})
  expect(within(region).getByText('1 MCQ')).toBeTruthy()
  await user.click(within(region).getByRole('button',{name:/1 απαντήσεις/}))
  await waitFor(() => expect(window.location.pathname).toBe('/activity/'+day))
  expect(await screen.findByText('Απαντήσεις MCQ')).toBeTruthy()
  expect(screen.getByText('Τυχαία θέματα')).toBeTruthy()
  const review = await screen.findByRole('button',{name:'Επανάληψη λαθών (1)'})
  await waitFor(() => expect(review).not.toBeDisabled())
  await user.click(review)
  expect(await screen.findByText(question.stem || question.question || question.prompt,{exact:true})).toBeTruthy()
  expect(container.querySelector('.wrong-answer-practice')).toBeTruthy()
  await user.click(screen.getByRole('button',{name:/Επιστροφή στα αποτελέσματα ημέρας/}))
  expect(await screen.findByText('Απαντήσεις MCQ')).toBeTruthy()
},20000)
