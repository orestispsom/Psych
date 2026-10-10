import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs'
import type { ReviewRating, SerializedCard } from './types'
export const ratingMap = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const
const schedulers = new Map<number, ReturnType<typeof fsrs>>()
export function deserializeCard(
  card: SerializedCard | undefined,
  now: Date,
): Card {
  return card
    ? {
        ...card,
        due: new Date(card.due),
        last_review: card.last_review ? new Date(card.last_review) : undefined,
      }
    : createEmptyCard(now)
}
export function scheduleReview(
  card: SerializedCard | undefined,
  rating: ReviewRating,
  now = new Date(),
  retention = 0.9,
): SerializedCard {
  if (!schedulers.has(retention))
    schedulers.set(
      retention,
      fsrs({ request_retention: retention, enable_fuzz: false }),
    )
  const scheduler = schedulers.get(retention)!
  const result = scheduler.next(
    deserializeCard(card, now),
    now,
    ratingMap[rating],
  ).card
  return {
    ...result,
    due: result.due.toISOString(),
    last_review: result.last_review?.toISOString(),
  }
}
