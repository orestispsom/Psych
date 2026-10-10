export type QuestionIntent =
  | 'recall'
  | 'discrimination'
  | 'mechanism'
  | 'application'
  | 'precision'
  | 'synthesis'
export type RuntimeQuestion = {
  id: string
  prompt: string
  intent: QuestionIntent
  modelAnswer: string
}
export type RuntimeChunk = {
  id: string
  revision: number
  domainId: string
  title: string
  role: string
  studyMarkdown: string
  rememberMarkdown: string
  adjacentChunkIds: string[]
  questions: RuntimeQuestion[]
}
export type Curriculum = { schemaVersion: 1; chunks: RuntimeChunk[] }
export type ContentIndex = {
  chunks: Map<string, RuntimeChunk>
  questions: Map<string, { chunk: RuntimeChunk; question: RuntimeQuestion }>
  domains: Map<string, RuntimeChunk[]>
}
export function indexContent(data: Curriculum): ContentIndex {
  const chunks = new Map<string, RuntimeChunk>(),
    questions: ContentIndex['questions'] = new Map(),
    domains: ContentIndex['domains'] = new Map()
  for (const chunk of data.chunks) {
    chunks.set(chunk.id, chunk)
    const domain = domains.get(chunk.domainId) ?? []
    domain.push(chunk)
    domains.set(chunk.domainId, domain)
    for (const question of chunk.questions)
      questions.set(question.id, { chunk, question })
  }
  return { chunks, questions, domains }
}
