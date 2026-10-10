import { type PsychFlashDatabase, database } from '../db/database'
import { exportBackup, parseBackup, type Backup } from '../db/backup'
import { scheduleReview } from '../learning/scheduler'
import type { QuestionStateRecord } from '../learning/types'
import { cloudUrl, publishableKey } from './config'

export function validateProfileId(value: string) {
  if (!value || value.length > 200 || /[\u0000-\u001f]/.test(value))
    throw new Error('Invalid Psych profile ID.')
  return value
}
export async function requestSync(
  profileId: string,
  events: unknown[],
  after: number,
) {
  const response = await fetch(`${cloudUrl}/rest/v1/rpc/psych_study_sync`, {
    method: 'POST',
    headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_profile_id: validateProfileId(profileId),
      p_events: events,
      p_after: after,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new Error(
      'Cloud sync failed. Progress remains queued on this device; retry when connected.',
    )
  const value = await response.json()
  if (!Array.isArray(value.events) || !Number.isSafeInteger(value.version))
    throw new Error('Invalid cloud response. Local progress was preserved.')
  return value as {
    events: { id: string; version: number; payload: unknown }[]
    version: number
  }
}
export function delta(before: Backup, after: Backup): Backup {
  const changed = <T>(old: T[], next: T[], key: keyof T) => {
    const map = new Map(old.map((r) => [r[key], JSON.stringify(r)]))
    return next.filter((r) => map.get(r[key]) !== JSON.stringify(r))
  }
  return {
    ...after,
    settings: changed(before.settings, after.settings, 'key').concat(
      before.settings
        .filter((r) => !after.settings.some((n) => n.key === r.key))
        .map((r) => ({ key: r.key, value: null })),
    ),
    chunkProgress: changed(
      before.chunkProgress,
      after.chunkProgress,
      'chunkId',
    ),
    questionState: changed(
      before.questionState,
      after.questionState,
      'questionId',
    ),
    reviewLog: changed(before.reviewLog, after.reviewLog, 'id'),
    sessions: changed(before.sessions ?? [], after.sessions ?? [], 'id'),
    ui:
      JSON.stringify(before.ui) === JSON.stringify(after.ui)
        ? undefined
        : after.ui,
  }
}
export async function enqueue(db: PsychFlashDatabase, payload: Backup) {
  const sequence = ((await db.syncMeta.get('localSequence'))?.value ?? 0) + 1
  await db.syncMeta.put({ key: 'localSequence', value: sequence })
  await db.outbox.add({ id: crypto.randomUUID(), sequence, payload })
}
export async function journal(action: () => Promise<unknown>, db = database) {
  return db.transaction('rw', db.tables, async () => {
    const before = await exportBackup(db)
    await action()
    const payload = delta(before, await exportBackup(db))
    if (
      payload.settings.length ||
      payload.chunkProgress.length ||
      payload.questionState.length ||
      payload.reviewLog.length ||
      payload.sessions?.length ||
      payload.ui
    )
      await enqueue(db, payload)
  })
}
export async function applyDelta(
  db: PsychFlashDatabase,
  value: unknown,
  restoreNavigation = true,
) {
  const b = parseBackup(value)
  await db.settings.bulkPut(b.settings)
  for (const c of b.chunkProgress) {
    const old = await db.chunkProgress.get(c.chunkId)
    const merged = { ...old, ...c }
    for (const field of ['firstOpenedAt', 'studyCompletedAt'] as const) {
      const values = [old?.[field], c[field]]
        .filter((s): s is string => !!s)
        .sort()
      merged[field] = values[0]
    }
    for (const field of ['lastOpenedAt', 'lastStudiedAt'] as const) {
      const values = [old?.[field], c[field]]
        .filter((s): s is string => !!s)
        .sort()
      merged[field] = values.at(-1)
    }
    merged.seenRevision =
      Math.max(old?.seenRevision ?? 0, c.seenRevision ?? 0) || undefined
    await db.chunkProgress.put(merged)
  }
  await db.reviewLog.bulkPut(b.reviewLog)
  await db.questionState.bulkPut(b.questionState)
  for (const s of b.sessions ?? []) {
    const old = await db.sessions.get(s.id)
    await db.sessions.put(old && old.cursor > s.cursor ? old : s)
  }
  if (b.ui && restoreNavigation) await db.ui.put(b.ui)
}
export async function replayQuestions(db: PsychFlashDatabase) {
  const logs = (await db.reviewLog.toArray()).sort(
    (a, b) =>
      a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id),
  )
  const states = new Map<string, QuestionStateRecord>()
  for (const event of logs) {
    const card = scheduleReview(
      states.get(event.questionId)?.schedulerCard,
      event.rating,
      new Date(event.reviewedAt),
      event.retention ?? 0.9,
    )
    states.set(event.questionId, {
      questionId: event.questionId,
      schedulerCard: card,
      dueAt: card.due,
      lastReviewedAt: event.reviewedAt,
      lastRating: event.rating,
      contentRevision: event.contentRevision,
    })
  }
  await db.questionState.bulkPut([...states.values()])
}
export class ProfileSync {
  private running?: Promise<void>
  constructor(
    readonly profileId: string,
    readonly db: PsychFlashDatabase,
    private changed: () => void = () => {},
  ) {}
  sync() {
    if (this.running) return this.running
    this.running = this.perform().finally(() => {
      this.running = undefined
    })
    return this.running
  }
  private async perform() {
    for (;;) {
      const pending = await this.db.outbox
        .orderBy('sequence')
        .limit(100)
        .toArray()
      const after = (await this.db.syncMeta.get('cursor'))?.value ?? 0
      const remote = await requestSync(this.profileId, pending, after)
      let cursor = remote.events.at(-1)?.version ?? after
      while (cursor < remote.version) {
        const page = await requestSync(this.profileId, [], cursor)
        if (!page.events.length)
          throw new Error(
            'Cloud history has a gap. Local progress was preserved.',
          )
        remote.events.push(...page.events)
        cursor = page.events.at(-1)!.version
        remote.version = page.version
      }
      await this.db.transaction('rw', this.db.tables, async () => {
        for (const event of remote.events)
          await applyDelta(this.db, event.payload, false)
        await this.db.outbox.bulkDelete(pending.map((e) => e.id))
        // User actions may have committed during the network request. Overlay them.
        for (const event of await this.db.outbox.orderBy('sequence').toArray())
          await applyDelta(this.db, event.payload, false)
        if (remote.events.length) await replayQuestions(this.db)
        await this.db.syncMeta.put({
          key: 'cursor',
          value: remote.events.at(-1)?.version ?? after,
        })
      })
      this.changed()
      if (!(await this.db.outbox.count())) break
    }
  }
}
