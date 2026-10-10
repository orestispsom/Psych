import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { loadCurriculum } from '../../content/loader'

afterEach(() => vi.unstubAllGlobals())
it('retries a failed first curriculum fetch and never silently replaces missing Greek text with English', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
  await expect(loadCurriculum('el')).rejects.toThrow()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).endsWith('.el.json')) return new Response('missing', { status: 503 })
    return new Response(readFileSync(resolve(process.cwd(), 'public/study/runtime-content.json'), 'utf8'))
  }))
  await expect(loadCurriculum('el')).rejects.toThrow('ελληνική ύλη')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(readFileSync(resolve(process.cwd(), 'public/study/runtime-content.el.json'), 'utf8'))))
  expect((await loadCurriculum('el')).chunks).toHaveLength(455)
})
