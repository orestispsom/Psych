import { describe, it, expect } from 'vitest'
import { curriculum, now } from './fixtures'
import { parseCurriculum } from '../../content/loader'
import { createSearchIndex, search } from '../../content/search'
import { indexContent } from '../../content/types'
import { planToday } from '../../learning/planner'
import { chunkState, progressMetrics } from '../../learning/progress'
import { ratingMap, scheduleReview } from '../../learning/scheduler'
import { daysToExam, validExamDate } from '../../learning/dates'
import type { QuestionStateRecord } from '../../learning/types'
describe('runtime and search', () => {
  it('rejects missing answers, duplicate IDs, unsupported schema and incomplete full corpus', () => {
    expect(parseCurriculum(curriculum).chunks).toHaveLength(3)
    for (const value of [
      { ...curriculum, schemaVersion: 2 },
      { ...curriculum, chunks: [curriculum.chunks[0], curriculum.chunks[0]] },
      {
        ...curriculum,
        chunks: [
          {
            ...curriculum.chunks[0],
            questions: [
              { ...curriculum.chunks[0].questions[0], modelAnswer: ' ' },
            ],
          },
        ],
      },
    ])
      expect(() => parseCurriculum(value)).toThrow()
    expect(() => parseCurriculum(curriculum, true)).toThrow('455')
  })
  it('searches IDs, study text, Remember and model answers without losing question gaps', () => {
    const index = createSearchIndex(curriculum)
    expect(search(index, 'PSY-001-Q03')[0].question?.id).toBe('PSY-001-Q03')
    expect(search(index, 'full text')).toHaveLength(3)
    expect(search(index, 'key facts')).toHaveLength(3)
    expect(search(index, 'specific contrast')).toHaveLength(3)
    expect(search(index, '')).toHaveLength(0)
  })
})
describe('learning policies', () => {
  it('uses calendar days and validates dates', () => {
    expect(validExamDate('2026-02-30')).toBe(false)
    expect(daysToExam('2026-10-08', now)).toBe(1)
    expect(daysToExam('2026-10-06', now)).toBe(-1)
  })
  it('maps Got it to FSRS Good and serializes complete card state', () => {
    expect(ratingMap.good).toBe(3)
    for (const r of ['again', 'hard', 'good', 'easy'] as const) {
      const card = scheduleReview(undefined, r, now)
      expect(card.reps).toBe(1)
      expect(card.last_review).toBe(now.toISOString())
      expect(new Date(card.due).getTime()).toBeGreaterThan(now.getTime())
      expect(scheduleReview(card, 'good', new Date(card.due)).reps).toBe(2)
    }
  })
  it('interleaves studies and immediate questions, includes every due question once', () => {
    const states = [
      {
        questionId: 'PSY-003-Q01',
        lastReviewedAt: '2026-10-01T00:00:00Z',
        dueAt: '2026-10-02T00:00:00Z',
      },
    ]
    const plan = planToday(
      curriculum,
      [],
      states,
      { examDate: '2026-10-08' },
      now,
    )
    expect(plan.items.filter((i) => i.kind === 'study')).toHaveLength(3)
    const ids = plan.items.flatMap((i) =>
      i.kind === 'review' ? [i.questionId] : [],
    )
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('PSY-003-Q01')
    expect(plan.items.slice(0, 3).map((i) => i.kind)).toEqual([
      'study',
      'review',
      'review',
    ])
  })
  it('time cap never drops due reviews; avoids repeating daily first exposure', () => {
    const states = curriculum.chunks.flatMap((c) =>
      c.questions.map((q) => ({
        questionId: q.id,
        lastReviewedAt: now.toISOString(),
        dueAt: now.toISOString(),
      })),
    )
    expect(
      planToday(
        curriculum,
        [],
        states,
        { examDate: '2026-10-08', dailyTargetMinutes: 5 },
        now,
      ).dueReviews,
    ).toBe(6)
    expect(
      planToday(
        curriculum,
        [],
        states,
        { examDate: '2026-10-08', dailyTargetMinutes: 5 },
        now,
      ).newChunks,
    ).toBe(0)
    expect(
      planToday(
        curriculum,
        [
          {
            chunkId: 'PSY-001',
            studyCompletedAt: now.toISOString(),
            seenRevision: 2,
          },
        ],
        [],
        { dailyNewLimit: 1 },
        now,
      ).newChunks,
    ).toBe(0)
  })
  it('classifies revision changes and recent failures without synthetic mastery', () => {
    const c = curriculum.chunks[0],
      p = {
        chunkId: c.id,
        studyCompletedAt: now.toISOString(),
        seenRevision: 2,
      }
    const states = new Map(
      c.questions.map((q) => [
        q.id,
        {
          questionId: q.id,
          lastReviewedAt: now.toISOString(),
          lastRating: 'good',
          dueAt: '2027-01-01T00:00:00Z',
          contentRevision: 2,
        } as QuestionStateRecord,
      ]),
    )
    expect(chunkState(c, undefined, states, now)).toBe('New')
    expect(chunkState(c, p, states, now)).toBe('Retained')
    expect(chunkState(c, { ...p, seenRevision: 1 }, states, now)).toBe(
      'Learning',
    )
    states.get(c.questions[0].id)!.dueAt = now.toISOString()
    expect(chunkState(c, p, states, now)).toBe('Due')
    const m = progressMetrics(
      indexContent(curriculum),
      [p],
      [],
      [
        {
          id: '1',
          questionId: c.questions[0].id,
          rating: 'hard',
          reviewedAt: now.toISOString(),
        },
      ],
      now,
    )
    expect(m.studied).toBe(1)
    expect(m.recall).toBe(0)
    expect(m.weak).toHaveLength(0)
  })
})
