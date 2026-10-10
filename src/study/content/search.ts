import type { Curriculum, RuntimeChunk, RuntimeQuestion } from './types'
export type SearchResult = {
  key: string
  chunk: RuntimeChunk
  question?: RuntimeQuestion
  text: string
}
export const normalize = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
export function createSearchIndex(data: Curriculum): SearchResult[] {
  return data.chunks.flatMap((chunk) => [
    {
      key: chunk.id,
      chunk,
      text: normalize(
        [
          chunk.id,
          chunk.title,
          chunk.studyMarkdown,
          chunk.rememberMarkdown,
        ].join(' '),
      ),
    },
    ...chunk.questions.map((question) => ({
      key: question.id,
      chunk,
      question,
      text: normalize(
        [question.id, chunk.title, question.prompt, question.modelAnswer].join(
          ' ',
        ),
      ),
    })),
  ])
}
export function search(index: SearchResult[], query: string) {
  const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const queryText = normalize(query.trim())
  const rank = (r: SearchResult) =>
    normalize(r.key) === queryText
      ? 0
      : normalize(r.chunk.title).includes(queryText)
        ? 1
        : 2
  return index
    .filter((r) => tokens.every((t) => r.text.includes(t)))
    .sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key))
}
