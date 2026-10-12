import type { Curriculum, RuntimeChunk } from '../content/types'
import type { ChunkProgressRecord, QuestionStateRecord, ReviewLogRecord, SettingRecord } from './types'

export type PathStrategy = 'high' | 'rare' | 'random' | 'systematic' | 'weak' | 'review'
export type StudyPath = {
  id: string
  strategy: PathStrategy
  name: string
  createdAt: string
  updatedAt: string
  seed: string
  sequence: string[]
  cursor: number
  visited: string[]
  stage: 'read' | 'recall'
  questionSessionId?: string
}

export const PATH_KEY_PREFIX = 'study-path-v1:'
export const STRATEGIES: PathStrategy[] = ['high', 'rare', 'random', 'systematic', 'weak', 'review']
const validId = (id: unknown): id is string => typeof id === 'string' && /^PSY-\d{3}$/.test(id)
const hash = (text: string) => [...text].reduce(
  (h, character) => Math.imul(h ^ character.charCodeAt(0), 16777619) >>> 0,
  2166136261,
)

// These are editorial *ordering heuristics*, not validated exam frequencies.
// Future clinical curation should replace them with per-topic priority metadata.
const commonDomains: Record<string, number> = {
  '03': 100, '04': 96, '12': 94, '13': 92, '02': 88,
  '01': 84, '05': 80, '08': 78, '07': 75, '15': 72,
  '06': 67, '10': 65, '14': 64, '09': 62, '11': 60,
  '17': 57, '16': 54, '07b': 40,
}
const rareTerms = [
  'rare', 'uncommon', 'atypical', 'unusual', 'variant', 'syndrome',
  'exception', 'paradox', 'ultrarapid', 'malignant', 'resistant',
  'σπάνι', 'ασυνήθ', 'άτυπ', 'σύνδρομ', 'εξαίρεσ', 'παράδοξ',
  'κακοήθ', 'ανθεκτικ', 'ιδιοσυγκρα',
]
function priority(chunk: RuntimeChunk) {
  const roleWeight: Record<string, number> = {
    clinical: 15, management: 14, precision: 12, differential: 11,
    comparison: 9, mechanism: 8, synthesis: 7, framework: 5, methodology: 1,
  }
  return (commonDomains[chunk.domainId] ?? 35) + (roleWeight[chunk.role] ?? 0)
    + chunk.questions.filter(q => q.intent === 'application' || q.intent === 'precision').length
}
function rarity(chunk: RuntimeChunk) {
  const text = (chunk.title + ' ' + chunk.rememberMarkdown.slice(0, 450)).toLowerCase()
  return rareTerms.reduce((n, word) => n + (text.includes(word) ? 1 : 0), 0)
}
export function pathOrder(
  data: Curriculum,
  strategy: PathStrategy,
  seed: string,
  progress: ChunkProgressRecord[] = [],
  states: QuestionStateRecord[] = [],
  logs: ReviewLogRecord[] = [],
  now = new Date(),
): string[] {
  const studied = new Map(progress.map(p => [p.chunkId, p]))
  const byId = new Map(data.chunks.map(c => [c.id, c]))
  const attempts = new Map<string, { difficult: number; count: number }>()
  for (const log of logs) {
    const id = log.questionId.slice(0, 7)
    if (!byId.has(id)) continue
    const count = attempts.get(id) ?? { difficult: 0, count: 0 }
    count.count++
    if (log.rating === 'again' || log.rating === 'hard') count.difficult++
    attempts.set(id, count)
  }
  const due = new Map<string, number>()
  const reviewed = new Set<string>()
  for (const state of states) {
    const id = state.questionId.slice(0, 7)
    if (!byId.has(id) || !state.lastReviewedAt) continue
    reviewed.add(id)
    const timestamp = state.dueAt ? new Date(state.dueAt).getTime() : NaN
    if (Number.isFinite(timestamp))
      due.set(id, Math.min(due.get(id) ?? Infinity, timestamp))
  }
  const fresh = data.chunks.filter(c => {
    if (strategy === 'review') return reviewed.has(c.id)
    if (strategy === 'weak') return attempts.has(c.id)
    return true
  })
  const natural = (a: RuntimeChunk, b: RuntimeChunk) => a.id.localeCompare(b.id)
  fresh.sort((a, b) => {
    if (strategy === 'high')
      return priority(b) - priority(a) || natural(a, b)
    if (strategy === 'rare')
      return rarity(b) - rarity(a) || priority(a) - priority(b) || natural(a, b)
    if (strategy === 'random')
      return hash(seed + a.id) - hash(seed + b.id) || natural(a, b)
    if (strategy === 'review')
      return (due.get(a.id) ?? Infinity) - (due.get(b.id) ?? Infinity) || natural(a, b)
    if (strategy === 'weak') {
      const aw = attempts.get(a.id)!, bw = attempts.get(b.id)!
      return bw.difficult / bw.count - aw.difficult / aw.count ||
        (due.get(a.id) ?? Infinity) - (due.get(b.id) ?? Infinity) ||
        natural(a, b)
    }
    return natural(a, b)
  })
  // Never turn navigating a path into automatic completion of learning material.
  void studied
  void now
  return fresh.map(c => c.id)
}
export function createPath(
  data: Curriculum,
  strategy: PathStrategy,
  name: string,
  progress: ChunkProgressRecord[] = [],
  states: QuestionStateRecord[] = [],
  logs: ReviewLogRecord[] = [],
  now = new Date(),
): StudyPath {
  const id = crypto.randomUUID()
  const seed = id
  const sequence = pathOrder(data, strategy, seed, progress, states, logs, now)
  if (!sequence.length)
    throw new Error(strategy === 'weak'
      ? 'Complete some recall questions before creating a Weak Areas path.'
      : 'Review previously studied questions before creating a Spaced Review path.')
  return {
    id, strategy, name, seed, sequence, cursor: 0, visited: [],
    stage: 'read', createdAt: now.toISOString(), updatedAt: now.toISOString(),
  }
}
export function readPaths(settings: SettingRecord[]): StudyPath[] {
  const paths: StudyPath[] = []
  for (const record of settings) {
    if (!record.key.startsWith(PATH_KEY_PREFIX) || typeof record.value !== 'string')
      continue
    try {
      const p: unknown = JSON.parse(record.value)
      if (!p || typeof p !== 'object') continue
      const v = p as StudyPath
      if (record.key !== PATH_KEY_PREFIX + v.id ||
        !STRATEGIES.includes(v.strategy) || typeof v.name !== 'string' ||
        typeof v.createdAt !== 'string' || typeof v.updatedAt !== 'string' ||
        typeof v.seed !== 'string' || !Array.isArray(v.sequence) ||
        !v.sequence.every(validId) || v.sequence.length > 10000 ||
        !Number.isSafeInteger(v.cursor) || v.cursor < 0 ||
        v.cursor >= v.sequence.length || !Array.isArray(v.visited) ||
        !v.visited.every(validId) || !['read', 'recall'].includes(v.stage))
        continue
      paths.push(v)
    } catch { /* Keep older or corrupt path data isolated from learning state. */ }
  }
  return paths.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
export function movePath(path: StudyPath, direction: -1 | 1): StudyPath {
  const next = Math.max(0, Math.min(path.sequence.length - 1, path.cursor + direction))
  return {
    ...path,
    cursor: next, stage: 'read', questionSessionId: undefined,
    visited: direction > 0 && next !== path.cursor
      ? [...new Set([...path.visited, path.sequence[path.cursor]])]
      : path.visited,
    updatedAt: new Date().toISOString(),
  }
}
export function restartPath(path: StudyPath): StudyPath {
  return { ...path, cursor: 0, visited: [], stage: 'read',
    questionSessionId: undefined, updatedAt: new Date().toISOString() }
}
