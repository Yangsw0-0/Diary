import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { tagMarkdown } from '@/features/tags/tagMarkdown'
import { frequencyLevels, mergeCloudWords } from '@/domain/WordCloud'
import { CloudTagWriter } from '@/application/CloudTagWriter'
import { DiarySession, todayDate } from '@/application/DiarySession'
import { DiaryService } from '@/application/DiaryService'
import { TagIndex } from '@/application/TagIndex'
import type { DiaryEntry } from '@/domain/DiaryEntry'
import { DiaryError } from '@/domain/DiaryError'
import { NodeWheel } from '@/features/nodes/NodeWheel'
import { wheelDelta } from '@/shared/wheelDelta'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('uses upper cumulative ranks with deterministic ties and explicit boundaries', () => {
  const levels = frequencyLevels(Array.from({ length: 100 }, (_, i) => i + 1))
  expect([1, 19, 20, 49, 50, 89, 90, 100].map((n) => levels.get(n))).toEqual([
    1, 1, 2, 2, 3, 3, 4, 4,
  ])
  expect([...frequencyLevels([8, 8, 8]).values()]).toEqual([4])
  expect(frequencyLevels([1]).get(1)).toBe(4)
  expect(frequencyLevels([]).size).toBe(0)
  expect([...frequencyLevels([4, 1, 4, 2])]).toEqual([...frequencyLevels([2, 4, 1, 4])])
})
it('promotes custom display identity dynamically and preserves it across hiding/removal', () => {
  const custom = [{ id: 'stable', text: '科研' }]
  const before = mergeCloudWords(custom, [], true)[0]!
  const after = mergeCloudWords(
    custom,
    [{ key: '科研', displayTitle: '科研', frequency: 8 }],
    true,
  )[0]!
  expect(before.level).toBe(0)
  expect(after).toMatchObject({
    id: before.id,
    customIds: ['stable'],
    source: 'tag',
    frequency: 8,
    level: 4,
  })
  expect(
    mergeCloudWords(custom, [{ key: '科研', displayTitle: '科研', frequency: 8 }], false)[0],
  ).toEqual(after)
  expect(mergeCloudWords(custom, [], true)[0]).toEqual(before)
})
it('cleans only display breaks while preserving code, escaped literals and block structure', () => {
  const source =
    '\n\n<br>\n\n<br/>\n\n第一段<br />第二行\n\n\n\n第二段\n\n- 项目一\n- 项目二\n\n> 引用\n\n```html\n<br>\n\n保留代码空行\n```\n\n`<br/>`\n\n\\<br>\n\n<br />\n'
  const { container } = render(
    <Markdown remarkPlugins={[remarkGfm, tagMarkdown]}>{source}</Markdown>,
  )
  expect(container.querySelectorAll('br')).toHaveLength(1)
  expect(container.querySelector('ul')?.children).toHaveLength(2)
  expect(container.querySelector('blockquote')).toHaveTextContent('引用')
  expect(container.querySelector('pre')?.textContent).toBe('<br>\n\n保留代码空行\n')
  expect(container.querySelectorAll('code')[1]?.textContent).toBe('<br/>')
  expect(container.textContent).toContain('<br>') // escaped literal remains meaningful text
  expect(source).toMatch(/^\n\n<br>/)
  expect(container.querySelectorAll('p')).toHaveLength(5)
})
function writing(initial?: string, fail = false) {
  const date = todayDate(),
    index = new TagIndex()
  let entry: DiaryEntry | undefined =
    initial === undefined ? undefined : { date, markdown: initial, revision: 'r0' }
  const save = vi.fn(async (_date: typeof date, markdown: string) => {
    if (fail) throw new DiaryError('conflict', '模拟冲突')
    entry = { date, markdown, revision: crypto.randomUUID() }
    return entry
  })
  const session = new DiarySession(
    new DiaryService(
      {
        list: async () => ({ entries: entry ? [entry] : [], failures: [] }),
        read: async () => {
          if (!entry) throw new DiaryError('not_found', 'missing')
          return entry
        },
        save,
      },
      index,
    ),
  )
  return { session, index, save, writer: new CloudTagWriter(session) }
}
it('creates today, counts only H2 occurrences and avoids duplicate append', async () => {
  const { session, writer, index, save } = writing()
  await session.load()
  const ref = await writer.write('科研')
  expect(ref).toMatchObject({ key: '科研', ordinal: 0 })
  expect(session.getSnapshot().selected?.markdown).toContain('## 科研')
  expect(index.listGroups().singleDay[0]?.frequency).toBe(1)
  await writer.write('科研')
  expect(save).toHaveBeenCalledTimes(1)
})
it('preserves existing source including trailing whitespace and safely escapes label syntax', async () => {
  const original = `# ${todayDate()}\n\n## 工作\n原文\n\n\n`
  const { session, writer, index } = writing(original)
  await session.load()
  await writer.write('研究 *方向* [A]')
  expect(session.getSnapshot().selected?.markdown.startsWith(original)).toBe(true)
  expect(index.getOccurrences('研究 *方向* [A]')).toHaveLength(1)
  await writer.write('工作')
  expect(index.getOccurrences('工作')).toHaveLength(1)
})
it('keeps inserted draft on save failure and rejects multiline before touching a diary', async () => {
  const { session, writer } = writing(undefined, true)
  await session.load()
  await expect(writer.write('坏\n词')).rejects.toThrow('换行')
  expect(session.getSnapshot().selected).toBeNull()
  expect(await writer.write('科研')).toMatchObject({ key: '科研' })
  expect(session.getSnapshot().selected?.markdown).toContain('## 科研')
  expect(session.isDirty()).toBe(true)
  session.reset()
})
it('node wheel consumes vertical/diagonal deltas, ignores horizontal and cleans listener', () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const onFocus = vi.fn()
  const events = [0, 1, 2].map((i) => ({
    id: String(i),
    date: '2026-01-01',
    title: '事件' + i,
    colorIndex: 0,
    nodeId: 'day',
    createdAt: '2026-11-23T00:00:00Z',
    updatedAt: '2026-11-23T00:00:00Z',
  }))
  const { getByRole, unmount } = render(
    <NodeWheel
      events={events}
      focusedId="1"
      onFocus={onFocus}
      onEdit={() => {}}
      colors={['#fff']}
    />,
  )
  const el = getByRole('group')
  const horizontal = new WheelEvent('wheel', { deltaX: 60, cancelable: true })
  el.dispatchEvent(horizontal)
  expect(horizontal.defaultPrevented).toBe(false)
  expect(onFocus).not.toHaveBeenCalled()
  fireEvent.wheel(el, { deltaX: 30, deltaY: 64 })
  fireEvent.wheel(el, { deltaX: 30, deltaY: 64 })
  expect(onFocus).toHaveBeenCalledWith('2')
  unmount()
  const after = new WheelEvent('wheel', { deltaY: 60, cancelable: true })
  el.dispatchEvent(after)
  expect(after.defaultPrevented).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})
it('normalizes line/page input and caps each axis', () => {
  expect(wheelDelta({ deltaX: 2, deltaY: -3, deltaMode: 1 }, 500)).toEqual({ x: 32, y: -48 })
  expect(wheelDelta({ deltaX: 1, deltaY: -1, deltaMode: 2 }, 500)).toEqual({ x: 64, y: -64 })
})
it('counts formal occurrences including same-day branches without counting plain body text', () => {
  const index = new TagIndex()
  index.rebuild([
    {
      date: todayDate(),
      revision: 'r',
      markdown: `# ${todayDate()}\n\n## 科研 - 文献\n科研 科研 科研\n\n## 科研 - 实验\n记录\n\n## 生活\n科研`,
    },
  ])
  expect(index.listGroups().singleDay.find((group) => group.key === '科研')).toMatchObject({
    dayCount: 1,
    frequency: 2,
  })
  expect(index.listGroups().singleDay.find((group) => group.key === '生活')?.frequency).toBe(1)
})
it('does not insert inside an unclosed code block or save an invalid section', async () => {
  const original = `# ${todayDate()}\n\n\x60\x60\x60ts\nunfinished`
  const { session, writer, save } = writing(original)
  await session.load()
  await expect(writer.write('科研')).rejects.toThrow('未闭合')
  expect(session.getSnapshot().selected?.markdown).toBe(original)
  expect(save).not.toHaveBeenCalled()
})
