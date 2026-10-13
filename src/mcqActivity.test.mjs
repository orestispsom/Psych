import { describe, expect, it } from 'vitest'
import {
  athensDayKey, athensMonthKey, shiftMonth, monthDays, activityUtcBounds,
  attemptsOnDay, groupActivityByDay, distinctWrongQuestions,
  mergeActivityAttempts, activityLevel,
} from './lib/mcqActivity.mjs'

describe('Athens MCQ calendar', () => {
  it('uses Athens dates on both sides of the DST change, independently of browser zone', () => {
    expect(athensDayKey('2026-03-28T22:30:00Z')).toBe('2026-03-29')
    expect(athensDayKey('2026-03-29T21:30:00Z')).toBe('2026-03-30')
    expect(athensDayKey('2026-10-24T21:30:00Z')).toBe('2026-10-25')
    expect(athensDayKey('2026-10-25T22:30:00Z')).toBe('2026-10-26')
    expect(athensDayKey('invalid')).toBeNull()
    expect(athensMonthKey('2026-10-25T22:30:00Z')).toBe('2026-10')
  })
  it('makes a Monday-first month grid with stable navigation', () => {
    const days = monthDays('2026-10')
    expect(days.slice(0,3)).toEqual([null, null, null])
    expect(days[3]).toBe('2026-10-01')
    expect(days.includes('2026-10-31')).toBe(true)
    expect(shiftMonth('2026-12',1)).toBe('2027-01')
    expect(shiftMonth('2026-01',-1)).toBe('2025-12')
    const bounds = activityUtcBounds('2026-10')
    expect(Date.parse(bounds.start)).toBeLessThan(Date.parse('2026-09-30T22:30:00Z'))
    expect(Date.parse(bounds.end)).toBeGreaterThan(Date.parse('2026-10-31T21:30:00Z'))
  })
  it('counts every answer attempt while practicing each wrong question only once', () => {
    const attempts = [
      { id:'a',questionId:2,attemptedAt:'2026-10-24T21:30:00Z',isCorrect:false,mode:'random' },
      { id:'b',questionId:2,attemptedAt:'2026-10-25T10:30:00Z',isCorrect:false,mode:'sprint' },
      { id:'c',questionId:3,attemptedAt:'2026-10-25T10:40:00Z',isCorrect:true,mode:'written' },
      { id:'d',questionId:3,attemptedAt:'2026-10-25T22:30:00Z',isCorrect:false,mode:'written' },
    ]
    const selected = attemptsOnDay(attempts, '2026-10-25')
    expect(selected).toHaveLength(3)
    expect(groupActivityByDay(attempts,'2026-10')['2026-10-25']).toEqual({total:3,correct:1,wrong:2})
    expect(distinctWrongQuestions(selected, id => ({2:'Q2',3:'Q3'}[id] || null))).toEqual(['Q2'])
    expect(mergeActivityAttempts([attempts[0]],attempts)).toHaveLength(4)
    expect(mergeActivityAttempts(attempts,[], '2026-10-25T11:00:00Z').map(a=>a.id)).toEqual(['d'])
    expect(activityLevel(0)).toBe(0)
    expect(activityLevel(9)).toBe(1)
    expect(activityLevel(10)).toBe(2)
    expect(activityLevel(25)).toBe(3)
    expect(activityLevel(50)).toBe(4)
  })
})
