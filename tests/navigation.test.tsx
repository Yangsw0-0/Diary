import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/app/AppShell'
import { createApp } from '@/app/bootstrap'
import { DiaryDate } from '@/domain/DiaryDate'
import { DiaryError } from '@/domain/DiaryError'
import type { DiaryRepository } from '@/domain/DiaryRepository'

vi.mock('@/features/diary/CrepeEditor', () => ({
  CrepeEditor: ({
    markdown,
    focusRequest,
  }: {
    markdown: string
    focusRequest: { key: string; ordinal: number } | null
  }) => (
    <pre
      data-testid="editor"
      data-focus={focusRequest ? focusRequest.key + ':' + focusRequest.ordinal : ''}
    >
      {markdown}
    </pre>
  ),
}))
afterEach(cleanup)

const first = {
  date: DiaryDate.parse('2024-12-31'),
  markdown: '# 2024-12-31\n## 工作\n第一次\n## 工作\n第二次',
  revision: 'r1',
}
const second = {
  date: DiaryDate.parse('2025-01-01'),
  markdown: '# 2025-01-01\n## 工作\n新年',
  revision: 'r2',
}

function renderApp(repo: DiaryRepository) {
  const app = createApp(repo)
  render(<AppShell registry={app.registry} session={app.services.session} />)
  return app
}

it('returns to the tag reading position and then forwards to the diary position', async () => {
  const user = userEvent.setup()
  const repo: DiaryRepository = {
    list: async () => ({ entries: [second, first], failures: [] }),
    read: async (date) => (date.equals(first.date) ? first : second),
    save: async () => first,
  }
  renderApp(repo)
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(await screen.findByRole('button', { name: /工作.*2 天/ }))
  expect(await screen.findByText('第二次')).toBeInTheDocument()
  const tagContent = screen.getByRole('region', { name: '标签内容' })
  Object.defineProperty(tagContent, 'scrollHeight', { configurable: true, value: 1000 })
  Object.defineProperty(tagContent, 'clientHeight', { configurable: true, value: 200 })
  tagContent.scrollTop = 420
  fireEvent.scroll(tagContent)
  await user.click(within(tagContent).getByRole('button', { name: /2024-12-31.*第 2 次/ }))
  expect(screen.getByRole('button', { name: '日记' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByTestId('editor')).toHaveAttribute('data-focus', '工作:1')
  const diaryContent = screen.getByRole('region', { name: '日记正文' })
  Object.defineProperty(diaryContent, 'scrollHeight', { configurable: true, value: 900 })
  Object.defineProperty(diaryContent, 'clientHeight', { configurable: true, value: 200 })
  diaryContent.scrollTop = 300
  fireEvent.scroll(diaryContent)
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(screen.getByRole('button', { name: '标签' })).toHaveAttribute('aria-current', 'page')
  expect(await screen.findByText('第二次')).toBeInTheDocument()
  await waitFor(() => expect(tagContent.scrollTop).toBe(420))
  await user.click(screen.getByRole('button', { name: '返回下一页面' }))
  expect(screen.getByRole('button', { name: '日记' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByTestId('editor')).toHaveAttribute('data-focus', '工作:1')
  await waitFor(() => expect(diaryContent.scrollTop).toBe(300))
  Object.defineProperty(tagContent, 'scrollHeight', { configurable: true, value: 250 })
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  await waitFor(() => expect(tagContent.scrollTop).toBe(50))
  await user.click(within(tagContent).getByRole('button', { name: '2025-01-01' }))
  expect(screen.getByTestId('editor')).toHaveTextContent('新年')
  expect(screen.getByTestId('editor')).toHaveAttribute('data-focus', '工作:0')
})

it('restores the last diary section when reopening its module', async () => {
  const user = userEvent.setup()
  const repo: DiaryRepository = {
    list: async () => ({ entries: [first], failures: [] }),
    read: async () => first,
    save: async () => first,
  }
  renderApp(repo)
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(screen.getByText('隐藏的标签（1）'))
  await user.click(await screen.findByRole('button', { name: /工作.*1 天/ }))
  await user.click(await screen.findByRole('button', { name: /2024-12-31.*第 2 次/ }))
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(screen.getByRole('button', { name: '日记' }))
  expect(screen.getByTestId('editor')).toHaveAttribute('data-focus', '工作:1')
})

it('does not add another history entry when opening the current date', async () => {
  const user = userEvent.setup()
  const repo: DiaryRepository = {
    list: async () => ({ entries: [first], failures: [] }),
    read: async () => first,
    save: async () => first,
  }
  renderApp(repo)
  await user.click(await screen.findByRole('button', { name: '2024-12-31' }))
  await user.click(screen.getByRole('button', { name: '2024-12-31' }))
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(screen.getByRole('button', { name: '返回上一页面' })).toBeDisabled()
})

it('keeps a dirty diary and history in place when saving before back fails', async () => {
  const user = userEvent.setup()
  const repo: DiaryRepository = {
    list: async () => ({ entries: [second, first], failures: [] }),
    read: async (date) => (date.equals(first.date) ? first : second),
    save: async () => {
      throw new DiaryError('conflict', '磁盘文件已变化')
    },
  }
  const app = renderApp(repo)
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(await screen.findByRole('button', { name: /工作.*2 天/ }))
  await user.click(await screen.findByRole('button', { name: /2024-12-31.*第 2 次/ }))
  app.services.session.edit('# 2024-12-31\n## 工作\n本地草稿')
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(screen.getByRole('button', { name: '日记' })).toHaveAttribute('aria-current', 'page')
  expect(app.services.session.getSnapshot().selected?.markdown).toContain('本地草稿')
  expect((await screen.findAllByText(/磁盘文件已变化/)).length).toBeGreaterThan(0)
})

it('opens the day and reports when a tag target changed', async () => {
  const user = userEvent.setup()
  let disk = first
  const repo: DiaryRepository = {
    list: async () => ({ entries: [first], failures: [] }),
    read: async () => disk,
    save: async () => disk,
  }
  renderApp(repo)
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(screen.getByText('隐藏的标签（1）'))
  await user.click(await screen.findByRole('button', { name: /工作.*1 天/ }))
  expect(await screen.findByText('第二次')).toBeInTheDocument()
  disk = { ...first, markdown: '# 2024-12-31\n## 家庭\n变化', revision: 'r3' }
  await user.click(screen.getByRole('button', { name: /2024-12-31.*第 2 次/ }))
  expect(screen.getByRole('button', { name: '日记' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('alert')).toHaveTextContent('小节已变化')
})

it('does not consume history when a target diary was removed externally', async () => {
  const user = userEvent.setup()
  let missing = false
  const repo: DiaryRepository = {
    list: async () => ({ entries: [first], failures: [] }),
    read: async () => {
      if (missing) throw new DiaryError('not_found', '原日记已被删除')
      return first
    },
    save: async () => first,
  }
  renderApp(repo)
  await user.click(await screen.findByRole('button', { name: '2024-12-31' }))
  await user.click(screen.getByRole('button', { name: '标签' }))
  missing = true
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(screen.getByRole('button', { name: '标签' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('alert')).toHaveTextContent('原日记已被删除')
  expect(screen.getByRole('button', { name: '返回上一页面' })).toBeEnabled()
})

it('saves an edited diary before returning to the tag view', async () => {
  const user = userEvent.setup()
  let disk = first
  const save = vi.fn(async (_date: DiaryDate, markdown: string) => {
    disk = { ...disk, markdown, revision: 'r2' }
    return disk
  })
  const repo: DiaryRepository = {
    list: async () => ({ entries: [first], failures: [] }),
    read: async () => disk,
    save,
  }
  const app = renderApp(repo)
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(screen.getByText('隐藏的标签（1）'))
  await user.click(await screen.findByRole('button', { name: /工作.*1 天/ }))
  await user.click(await screen.findByRole('button', { name: /2024-12-31.*第 2 次/ }))
  app.services.session.edit('# 2024-12-31\n## 工作\n第一次\n## 工作\n修订后')
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(save).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('修订后')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '返回下一页面' }))
  expect(screen.getByTestId('editor')).toHaveTextContent('修订后')
})

it('rebounds the first edge pull and lets the next pull continue without a fixed pause', async () => {
  const user = userEvent.setup()
  const read = vi.fn(async (date: DiaryDate) => (date.equals(second.date) ? second : first))
  renderApp({
    list: async () => ({ entries: [second, first], failures: [] }),
    read,
    save: async () => second,
  })
  await user.click(await screen.findByRole('button', { name: '2025-01-01' }))
  const content = screen.getByRole('region', { name: '日记正文' })
  Object.defineProperties(content, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1000 },
  })
  const track = content.closest('.adjacent-diary-track') as HTMLElement
  content.scrollTop = 100
  fireEvent.wheel(content, { deltaY: 90 })
  expect(track.style.transform).toBe('')
  content.scrollTop = 500
  fireEvent.wheel(content, { deltaY: 90 })
  expect(track.style.transform).toBe('translate3d(0px, -64px, 0px)')
  expect(read).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(track.style.transform).toBe('translate3d(0px, 0px, 0px)'))
  expect(read).toHaveBeenCalledTimes(1)
  await new Promise((resolve) => setTimeout(resolve, 130))
  content.scrollTop = 500
  fireEvent.wheel(content, { deltaY: 90 })
  fireEvent.wheel(content, { deltaY: 90 })
  expect(Number(track.style.transform.match(/-([\d.]+)px/)?.[1])).toBeGreaterThan(64)
  expect(read).toHaveBeenCalledTimes(1)
})

it('holds the adjacent preview while reading and rolls back after a failed save', async () => {
  const user = userEvent.setup()
  let releaseRead!: () => void
  const pending = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  let slow = true
  const read = vi.fn(async (date: DiaryDate) => {
    if (date.equals(first.date) && slow) await pending
    return date.equals(first.date) ? first : second
  })
  const save = vi.fn(async () => {
    throw new DiaryError('conflict', '磁盘文件已变化')
  })
  const app = renderApp({
    list: async () => ({ entries: [second, first], failures: [] }),
    read,
    save,
  })
  await user.click(await screen.findByRole('button', { name: '2025-01-01' }))
  const content = screen.getByRole('region', { name: '日记正文' })
  Object.defineProperties(content, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1000 },
  })
  content.scrollTop = 500
  const track = content.closest('.adjacent-diary-track') as HTMLElement
  for (let i = 0; i < 4; i++) fireEvent.wheel(content, { deltaY: 90 })
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2), { timeout: 1200 })
  expect(track.style.transform).toBe('translate3d(0px, -500px, 0px)')
  expect(app.services.session.getSnapshot().selected?.date.toString()).toBe('2025-01-01')
  expect(track.querySelector('.adjacent-diary-preview')).toBeInTheDocument()
  releaseRead()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '2024-12-31' })).toHaveAttribute(
      'aria-current',
      'true',
    ),
  )
  slow = false
  await waitFor(() => expect(track.style.transform).toBe('translate3d(0px, 0px, 0px)'))
  await new Promise((resolve) => setTimeout(resolve, 130))
  app.services.session.edit('# 2024-12-31\n## 工作\n未保存草稿')
  content.scrollTop = 0
  for (let i = 0; i < 4; i++) fireEvent.wheel(content, { deltaY: -90 })
  await new Promise((resolve) => setTimeout(resolve, 700))
  expect(save).toHaveBeenCalledTimes(1)
  expect(app.services.session.getSnapshot().selected?.markdown).toContain('未保存草稿')
  expect(app.services.session.getSnapshot().selected?.date.toString()).toBe('2024-12-31')
  await waitFor(() => expect(track.style.transform).toBe('translate3d(0px, 0px, 0px)'))
})

it('rebounds at both diary ends without reading another day', async () => {
  const user = userEvent.setup()
  const read = vi.fn(async () => first)
  renderApp({
    list: async () => ({ entries: [first], failures: [] }),
    read,
    save: async () => first,
  })
  await user.click(await screen.findByRole('button', { name: '2024-12-31' }))
  const content = screen.getByRole('region', { name: '日记正文' })
  Object.defineProperties(content, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1000 },
  })
  const track = content.closest('.adjacent-diary-track') as HTMLElement
  content.scrollTop = 500
  for (let i = 0; i < 5; i++) fireEvent.wheel(content, { deltaY: 90 })
  expect(screen.getByRole('alert')).toHaveTextContent('已经是最早的日记')
  await waitFor(() => expect(track.style.transform).toBe('translate3d(0px, 0px, 0px)'))
  content.scrollTop = 0
  for (let i = 0; i < 5; i++) fireEvent.wheel(content, { deltaY: -90 })
  expect(screen.getByRole('alert')).toHaveTextContent('已经是最新的日记')
  await waitFor(() => expect(track.style.transform).toBe('translate3d(0px, 0px, 0px)'))
  expect(read).toHaveBeenCalledTimes(1)
})

it('cancels a partial adjacent pull when the window is resized', async () => {
  const user = userEvent.setup()
  const read = vi.fn(async (date: DiaryDate) => (date.equals(second.date) ? second : first))
  renderApp({
    list: async () => ({ entries: [second, first], failures: [] }),
    read,
    save: async () => second,
  })
  await user.click(await screen.findByRole('button', { name: '2025-01-01' }))
  const content = screen.getByRole('region', { name: '日记正文' })
  Object.defineProperties(content, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1000 },
  })
  content.scrollTop = 500
  const track = content.closest('.adjacent-diary-track') as HTMLElement
  fireEvent.wheel(content, { deltaY: 90 })
  fireEvent.wheel(content, { deltaY: 90 })
  expect(track.style.transform).not.toBe('translate3d(0px, 0px, 0px)')
  fireEvent(window, new Event('resize'))
  await waitFor(() => expect(track.style.transform).toBe('translate3d(0px, 0px, 0px)'))
  expect(read).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: '2025-01-01' })).toHaveAttribute('aria-current', 'true')
})

it('respects reduced motion while keeping a one-diary gesture limit', async () => {
  const previous = window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true, addListener: () => {}, removeListener: () => {} }),
  })
  try {
    const user = userEvent.setup()
    const third = { date: DiaryDate.parse('2024-12-30'), markdown: '# 2024-12-30', revision: 'r3' }
    const entries = [second, first, third]
    const read = vi.fn(async (date: DiaryDate) => entries.find((entry) => entry.date.equals(date))!)
    renderApp({ list: async () => ({ entries, failures: [] }), read, save: async () => second })
    await user.click(await screen.findByRole('button', { name: '2025-01-01' }))
    const content = screen.getByRole('region', { name: '日记正文' })
    Object.defineProperties(content, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 1000 },
    })
    content.scrollTop = 500
    for (let i = 0; i < 12; i++) fireEvent.wheel(content, { deltaY: 90 })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '2024-12-31' })).toHaveAttribute(
        'aria-current',
        'true',
      ),
    )
    expect(screen.getByRole('button', { name: '2024-12-30' })).not.toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(read).toHaveBeenCalledTimes(2)
  } finally {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: previous })
  }
})
