import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { parseCurriculum } from '../../content/loader'
import { createSearchIndex, search } from '../../content/search'

it('preserves the complete Greek source byte-for-byte and all bilingual stable identities', () => {
  const root = process.cwd()
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/psychflash-import.json'), 'utf8'))
  const english = parseCurriculum(JSON.parse(readFileSync(resolve(root, 'public/study/runtime-content.json'), 'utf8')), true)
  const bytes = readFileSync(resolve(root, 'public/study/runtime-content.el.json'))
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.files['runtime-content.el.json'].sha256)
  const greek = parseCurriculum(JSON.parse(bytes.toString()), true)
  expect(greek.chunks).toHaveLength(455)
  expect(greek.chunks.reduce((n, c) => n + c.questions.length, 0)).toBe(1849)
  greek.chunks.forEach((chunk, i) => {
    expect([chunk.id, chunk.revision]).toEqual([english.chunks[i].id, english.chunks[i].revision])
    expect(chunk.questions.map(q => q.id)).toEqual(english.chunks[i].questions.map(q => q.id))
  })
  const index = createSearchIndex(greek)
  for (const chunk of greek.chunks)
    for (const question of chunk.questions)
      expect(search(index, question.id)[0].question?.modelAnswer).toBe(question.modelAnswer)
})
