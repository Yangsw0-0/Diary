import { afterEach, expect, it, vi } from 'vitest'
import { decodeCloud, emptyCloud, mergeCloudWords } from '@/domain/WordCloud'
import type { CloudFile, WordCloudRepository } from '@/domain/WordCloudRepository'
import { WordCloudSession } from '@/application/WordCloudSession'
import {
  constellationEdges,
  dragRotation,
  fibonacciSphere,
  identity,
  multiply,
  project,
  rotate,
  sphereLerp,
} from '@/features/wordcloud/sphereMath'
afterEach(() => vi.useRealTimers())
function repository() {
  let file: CloudFile | null = null
  return {
    read: vi.fn(async () => file),
    save: vi.fn(async (json: string) => {
      file = { json, revision: crypto.randomUUID() }
      return file
    }),
  } satisfies WordCloudRepository
}
it('merges normalized display text while preserving independent custom and tag sources', () => {
  const custom = [{ id: 'custom', text: ' 成长 ' }],
    tags = [{ key: '成长', displayTitle: '成长' }]
  const both = mergeCloudWords(custom, tags, true)
  expect(both).toHaveLength(1)
  expect(both[0]).toMatchObject({ customIds: ['custom'], tagKey: '成长', source: 'tag' })
  expect(mergeCloudWords(custom, tags, false)[0]?.source).toBe('custom')
  expect(mergeCloudWords([], tags, true)[0]?.tagKey).toBe('成长')
  expect(
    mergeCloudWords([{ id: 'a', text: 'e\u0301' }], [{ key: 'é', displayTitle: 'é' }], true),
  ).toHaveLength(1)
})
it('validates and defaults older preferences without silently accepting corrupt content', () => {
  expect(decodeCloud({ version: 1, words: [] }).preferences).toEqual(emptyCloud().preferences)
  for (const bad of [
    { version: 9, words: [] },
    { version: 1, words: [{ id: 'a', text: ' ' }] },
    {
      version: 1,
      words: [
        { id: 'a', text: '词' },
        { id: 'b', text: '词' },
      ],
    },
    { version: 1, words: [], preferences: { lineMode: 'bad' } },
    { version: 1, words: [{ id: 'a', text: 'a'.repeat(121) }] },
  ])
    expect(() => decodeCloud(bad)).toThrow()
})
it('persists custom words and preferences, debounces saves, and supports delete/undo', async () => {
  vi.useFakeTimers()
  const repo = repository(),
    session = new WordCloudSession(repo)
  await session.ensureLoaded()
  expect(repo.save).not.toHaveBeenCalled()
  session.add(' 成长 ')
  expect(() => session.add('成长')).toThrow(/存在/)
  session.configure({ showTags: false, autoRotate: false, lineMode: 'grid', panelCollapsed: true })
  await vi.advanceTimersByTimeAsync(799)
  expect(repo.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(repo.save).toHaveBeenCalledOnce()
  expect(session.getSnapshot().dirty).toBe(false)
  const word = session.getSnapshot().document.words[0]!
  session.remove(word.id)
  expect(session.getSnapshot().document.words).toHaveLength(0)
  session.restore(word)
  await session.flush()
  const reopened = new WordCloudSession(repo)
  await reopened.ensureLoaded()
  expect(reopened.getSnapshot().document).toEqual(session.getSnapshot().document)
  session.reset()
  reopened.reset()
})
it('serializes edits during saves and retains failed drafts for retry', async () => {
  const repo = repository(),
    session = new WordCloudSession(repo)
  await session.ensureLoaded()
  let resolve!: (file: CloudFile) => void
  repo.save.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  session.add('一')
  const pending = session.flush()
  await Promise.resolve()
  session.add('二')
  resolve({ json: '{}', revision: 'r1' })
  expect(await pending).toBe(true)
  expect(repo.save).toHaveBeenCalledTimes(2)
  repo.save.mockRejectedValueOnce(new Error('conflict'))
  session.add('三')
  expect(await session.flush()).toBe(false)
  expect(session.getSnapshot().document.words).toHaveLength(3)
  expect(session.getSnapshot().dirty).toBe(true)
  expect(await session.flush()).toBe(true)
  session.reset()
})
it('protects corrupt files and rejects late reads from a previous workspace', async () => {
  const repo = repository()
  repo.read.mockResolvedValueOnce({ json: 'bad json', revision: 'old' })
  const session = new WordCloudSession(repo)
  await session.ensureLoaded()
  expect(session.getSnapshot().blocked).toBe(true)
  expect(() => session.add('不能覆盖')).toThrow()
  expect(repo.save).not.toHaveBeenCalled()
  session.reset()
  let resolve!: (file: CloudFile | null) => void
  repo.read.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  const old = session.ensureLoaded()
  await Promise.resolve()
  session.reset()
  const next = session.ensureLoaded()
  resolve({
    json: JSON.stringify({ ...emptyCloud(), words: [{ id: 'old', text: '旧文件夹' }] }),
    revision: 'old',
  })
  await Promise.all([old, next])
  expect(session.getSnapshot().document.words).toHaveLength(0)
})
it('detects external changes without discarding custom drafts', async () => {
  const repo = repository(),
    session = new WordCloudSession(repo)
  await session.ensureLoaded()
  session.add('草稿')
  repo.read.mockResolvedValueOnce({ json: JSON.stringify(emptyCloud()), revision: 'changed' })
  await session.checkExternalChange()
  expect(session.getSnapshot().error).toMatch(/外部/)
  expect(session.getSnapshot().document.words[0]?.text).toBe('草稿')
  session.reset()
})
it('distributes finite sphere positions for empty, small and large inputs', () => {
  expect(fibonacciSphere(0)).toEqual([])
  expect(fibonacciSphere(1)).toEqual([[0, 0, 1]])
  for (const n of [2, 2000])
    for (const p of fibonacciSphere(n)) expect(Math.hypot(...p)).toBeCloseTo(1)
  expect(fibonacciSphere(10)).toEqual(fibonacciSphere(10))
})
it('rotates freely without length drift and hides back-facing hit candidates by depth', () => {
  let q = identity
  for (let i = 0; i < 1000; i++) q = multiply(dragRotation(0.02, 0.03), q)
  const p = rotate([0, 0, 1], q)
  expect(Math.hypot(...p)).toBeCloseTo(1)
  expect(rotate([0, 0, 1], dragRotation(Math.PI, 0))[2]).toBeCloseTo(-1)
  expect(project([0, 0, -1], 600, 600).alpha).toBe(0)
  expect(project([0, 0, 0], 600, 600).alpha).toBe(0)
  expect(project([0, 0, 0.01], 600, 600).alpha).toBeLessThan(0.01)
  expect(project([0, 0, 1], 600, 600).alpha).toBe(1)
  expect(Math.hypot(...sphereLerp([0, 0, 1], [0, 0, -1], 0.5))).toBeCloseTo(1)
  for (const [a, b] of constellationEdges(fibonacciSphere(500)))
    expect(
      Math.hypot(...fibonacciSphere(500)[a]!.map((v, i) => v - fibonacciSphere(500)[b]![i]!)),
    ).toBeLessThan(Math.sqrt(0.5))
})
