import type { Curriculum } from '../../content/types'
export const now = new Date('2026-10-07T12:00:00Z')
export const curriculum: Curriculum = {
  schemaVersion: 1,
  chunks: Array.from({ length: 3 }, (_, i) => {
    const id = `PSY-00${i + 1}`
    return {
      id,
      revision: 2,
      title: `Topic ${i + 1}`,
      domainId: '01',
      role: 'framework',
      studyMarkdown: '# Study\n\nFull text',
      rememberMarkdown: '## Remember\n\nKey facts',
      adjacentChunkIds: [],
      questions: [
        {
          id: id + '-Q01',
          prompt: 'Why this topic?',
          intent: 'recall',
          modelAnswer: 'Specific model answer.',
        },
        {
          id: id + '-Q03',
          prompt: 'How is it distinct?',
          intent: 'discrimination',
          modelAnswer: 'A specific contrast.',
        },
      ],
    }
  }),
}
