import type { Curriculum, RuntimeChunk } from './types'
const intents = new Set([
  'recall',
  'discrimination',
  'mechanism',
  'application',
  'precision',
  'synthesis',
])
const roles = new Set([
  'clinical',
  'management',
  'precision',
  'framework',
  'comparison',
  'differential',
  'mechanism',
  'methodology',
  'synthesis',
])
const nonempty = (x: unknown): x is string =>
  typeof x === 'string' && !!x.trim()
export function parseCurriculum(value: unknown, full = false): Curriculum {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid curriculum envelope.')
  const data = value as Record<string, unknown>
  if (
    data.schemaVersion !== 1 ||
    !Array.isArray(data.chunks) ||
    !data.chunks.length
  )
    throw new Error('Unsupported or empty curriculum.')
  const ids = new Set<string>(),
    qids = new Set<string>()
  for (const raw of data.chunks) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid topic.')
    const c = raw as RuntimeChunk
    if (
      !/^PSY-\d{3}$/.test(c.id) ||
      ids.has(c.id) ||
      !Number.isInteger(c.revision) ||
      c.revision < 1 ||
      !nonempty(c.domainId) ||
      !nonempty(c.title) ||
      !roles.has(c.role) ||
      !nonempty(c.studyMarkdown) ||
      !nonempty(c.rememberMarkdown) ||
      !Array.isArray(c.adjacentChunkIds) ||
      !c.adjacentChunkIds.every(nonempty) ||
      !Array.isArray(c.questions) ||
      !c.questions.length
    )
      throw new Error('Malformed or duplicate topic: ' + c.id)
    ids.add(c.id)
    for (const q of c.questions) {
      if (
        !q ||
        !new RegExp('^' + c.id + '-Q\\d{2}$').test(q.id) ||
        qids.has(q.id) ||
        !nonempty(q.prompt) ||
        !nonempty(q.modelAnswer) ||
        !intents.has(q.intent)
      )
        throw new Error(
          'Malformed, unanswered or duplicate question in ' + c.id,
        )
      qids.add(q.id)
    }
  }
  if (full) {
    // Finite v1 manifest: 457 stable IDs with deliberate inactive 030/203 gaps.
    const active = Array.from({ length: 457 }, (_, i) => i + 1).filter(
      (n) => n !== 30 && n !== 203,
    )
    if (
      ids.size !== active.length ||
      active.some((n) => !ids.has('PSY-' + String(n).padStart(3, '0')))
    )
      throw new Error('The complete 455-topic curriculum is required.')
    for (const c of data.chunks as RuntimeChunk[])
      if (c.adjacentChunkIds.some((id) => !ids.has(id)))
        throw new Error('Unresolved adjacent topic in ' + c.id)
  }
  return { schemaVersion: 1, chunks: data.chunks as RuntimeChunk[] }
}

let englishPromise: Promise<Curriculum> | undefined

async function loadEnglish(): Promise<Curriculum> {
  if (!englishPromise)
    englishPromise = fetch('/study/runtime-content.json').then(async (response) => {
      if (!response.ok)
        throw new Error('Curriculum could not be loaded. Reconnect and retry.')
      return parseCurriculum(await response.json(), true)
    }).catch(error => {
      englishPromise = undefined
      throw error
    })
  return englishPromise
}

function mergeLocalized(
  english: Curriculum,
  localized: Curriculum,
): Curriculum {
  const source = new Map(english.chunks.map((chunk) => [chunk.id, chunk]))
  const translated = new Map<string, RuntimeChunk>()

  for (const chunk of localized.chunks) {
    const base = source.get(chunk.id)
    if (
      !base ||
      chunk.revision !== base.revision ||
      chunk.domainId !== base.domainId ||
      chunk.role !== base.role ||
      chunk.questions.length !== base.questions.length ||
      chunk.questions.some((q, i) => q.id !== base.questions[i]?.id)
    )
      throw new Error('Greek curriculum is out of sync at ' + chunk.id)
    translated.set(chunk.id, chunk)
  }

  return {
    schemaVersion: 1,
    chunks: english.chunks.map((chunk) => translated.get(chunk.id) ?? chunk),
  }
}

export async function loadCurriculum(
  locale: 'en' | 'el' = 'en',
): Promise<Curriculum> {
  const english = await loadEnglish()
  if (locale === 'en') return english

  const response = await fetch('/study/runtime-content.el.json')
  if (!response.ok) throw new Error('Δεν φορτώθηκε η ελληνική ύλη. Έλεγξε τη σύνδεση και δοκίμασε ξανά.')
  return mergeLocalized(english, parseCurriculum(await response.json(), true))
}
