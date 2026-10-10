import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseCurriculum } from '../../content/loader'
import { createSearchIndex, search } from '../../content/search'
it('loads the real compiled curriculum, with 455 topics and every answer searchable', () => {
  const data = parseCurriculum(
    JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'public/study/runtime-content.json'),
        'utf8',
      ),
    ),
    true,
  )
  expect(data.chunks).toHaveLength(455)
  const index = createSearchIndex(data)
  for (const chunk of data.chunks)
    for (const q of chunk.questions)
      expect(search(index, q.id)[0].question?.modelAnswer).toBe(q.modelAnswer)
})
