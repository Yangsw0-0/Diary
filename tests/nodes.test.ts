import { afterEach, expect, it, vi } from 'vitest'
import { decodeNodes, emptyNodes, flattenNodes } from '@/domain/NodesDocument'
import { NodesSession } from '@/application/NodesSession'
import { NodePalette } from '@/application/NodePalette'
import { gapPx, timelinePositions, labelLanes } from '@/application/nodeTimeline'
import { wheelPosition, snapWheel, wheelWindow } from '@/application/nodeWheel'
import type { NodeRepository, NodesFile } from '@/domain/NodeRepository'
const event = {
  id: 'event',
  title: '事件',
  colorIndex: 0,
  createdAt: '2026-11-20T00:00:00Z',
  updatedAt: '2026-11-20T00:00:00Z',
}
const doc = { version: 2, nodes: [{ id: 'node', date: '2024-02-29', events: [event] }] }
afterEach(() => vi.useRealTimers())
it('validates grouped events, duplicate IDs, dates, missing fields and unknown versions', () => {
  expect(decodeNodes(doc).nodes[0]?.events).toHaveLength(1)
  for (const bad of [
    { ...doc, version: 9 },
    { version: 2, nodes: [...doc.nodes, ...doc.nodes] },
    { version: 2, nodes: [{ ...doc.nodes[0], date: '2023-02-29' }] },
    { version: 2, nodes: [{ ...doc.nodes[0], events: [event, event] }] },
    { version: 2, nodes: [{ ...doc.nodes[0], events: [{ ...event, title: ' ' }] }] },
  ])
    expect(() => decodeNodes(bad)).toThrow()
  const legacy = decodeNodes({ version: 1, nodes: [{ ...event, id: 'old', date: '2024-02-29' }] })
  expect(legacy.version).toBe(2)
  expect(legacy.nodes[0]?.events[0]?.title).toBe('事件')
})
function repository() {
  let file: NodesFile | null = null
  const repo: NodeRepository = {
    read: vi.fn(async () => file),
    save: vi.fn(async (json) => {
      file = { json, revision: crypto.randomUUID() }
      return file
    }),
    backup: vi.fn(async () => null),
  }
  return repo
}
it('groups same-day events and moves only the edited event to another date', async () => {
  const repo = repository(),
    session = new NodesSession(repo)
  await session.ensureLoaded()
  session.edit('2024-02-29', '一', 0)
  const first = flattenNodes(session.getSnapshot().document)[0]!
  session.edit('2024-02-29', '二', 1)
  expect(session.getSnapshot().document.nodes).toHaveLength(1)
  session.edit('2025-01-01', '一修改', 2, first.id)
  expect(session.getSnapshot().document.nodes).toHaveLength(2)
  session.remove(first.id)
  expect(session.getSnapshot().document.nodes).toHaveLength(1)
  expect(await session.flush()).toBe(true)
  expect(JSON.parse((vi.mocked(repo.save).mock.calls[0] ?? [])[0] ?? '{}').version).toBe(2)
})
it('debounces saves, serializes edits during save, and retains failed drafts', async () => {
  vi.useFakeTimers()
  const repo = repository(),
    session = new NodesSession(repo)
  await session.ensureLoaded()
  let resolve!: (file: NodesFile) => void
  vi.mocked(repo.save).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  session.edit('2026-01-01', '初始', 0)
  await vi.advanceTimersByTimeAsync(799)
  expect(repo.save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  session.edit('2026-01-02', '新增', 1)
  resolve({ json: JSON.stringify(emptyNodes()), revision: 'r1' })
  await session.flush()
  expect(repo.save).toHaveBeenCalledTimes(2)
  expect(session.getSnapshot().dirty).toBe(false)
  vi.mocked(repo.save).mockRejectedValueOnce(new Error('conflict'))
  session.edit('2026-01-03', '不能丢', 2)
  expect(await session.flush()).toBe(false)
  expect(session.getSnapshot().dirty).toBe(true)
  expect(flattenNodes(session.getSnapshot().document)).toHaveLength(3)
  session.reset()
})
it('blocks corrupt documents and preserves drafts on external change', async () => {
  const repo = repository()
  vi.mocked(repo.read).mockResolvedValueOnce({ json: 'broken', revision: 'r1' })
  const session = new NodesSession(repo)
  await session.ensureLoaded()
  expect(session.getSnapshot().blocked).toBe(true)
  expect(() => session.edit('2026-01-01', '不能覆盖', 0)).toThrow()
  expect(repo.save).not.toHaveBeenCalled()
  await session.backupAndReset()
  expect(repo.backup).toHaveBeenCalledTimes(1)
  session.edit('2026-01-01', '草稿', 0)
  vi.mocked(repo.read).mockResolvedValueOnce({ json: '{}', revision: 'external' })
  await session.checkExternalChange()
  expect(session.getSnapshot().error).toMatch(/外部/)
  expect(session.getSnapshot().dirty).toBe(true)
  session.reset()
})
it('keeps timeline gaps strictly increasing even for long spans and windows wheel items', () => {
  const spans = [1, 180, 365, 3650, 7300, 3000000].map(gapPx)
  expect(spans.every((v, i) => !i || v > spans[i - 1]!)).toBe(true)
  const positions = timelinePositions(['2020-01-01', '2021-01-01', '2023-01-01'], 1000)
  expect(positions[0]).toBe(64)
  expect(positions[2]).toBeCloseTo(936)
  const lanes = labelLanes(positions)
  expect(lanes.every((l) => l.width > 0)).toBe(true)
  expect(wheelPosition(2, 50, 360, 10)).toBeLessThan(2)
  expect(wheelPosition(0, 10000, 360, 10)).toBe(-0.35)
  expect(snapWheel(15, 4)).toBe(3)
  expect(wheelWindow(500, 1000)).toHaveLength(9)
})
it('persists a validated six-slot palette and restores defaults', () => {
  localStorage.clear()
  const palette = new NodePalette(localStorage)
  palette.setColor(1, '#ffffff')
  expect(new NodePalette(localStorage).getSnapshot()[1]).toBe('#ffffff')
  expect(() => palette.setColor(6, '#ffffff')).toThrow()
  palette.reset()
  expect(palette.getSnapshot()[1]).not.toBe('#ffffff')
})

it('keeps extreme palette colors readable', async () => {
  const { readableInk } = await import('@/application/NodePalette')
  expect(readableInk('#ffffff', '#ffffff')).toBe('#000000')
  expect(readableInk('#000000', '#000000')).toBe('#ffffff')
  expect(readableInk('#ffff00', '#ffffff')).toBe('#000000')
})

it('ignores an old workspace read and loads the new workspace after reset', async () => {
  const repo = repository()
  let resolve!: (file: NodesFile | null) => void
  vi.mocked(repo.read).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  const session = new NodesSession(repo)
  const old = session.ensureLoaded()
  session.reset()
  const next = session.ensureLoaded()
  resolve({ json: JSON.stringify(doc), revision: 'old' })
  await Promise.all([old, next])
  expect(session.getSnapshot().document.nodes).toHaveLength(0)
  expect(repo.read).toHaveBeenCalledTimes(2)
})
