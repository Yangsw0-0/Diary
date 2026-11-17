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
  await waitFor(() => expect(diaryContent.scrollTop).toBe(300))
  Object.defineProperty(tagContent, 'scrollHeight', { configurable: true, value: 250 })
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  await waitFor(() => expect(tagContent.scrollTop).toBe(50))
  await user.click(within(tagContent).getByRole('button', { name: '2025-01-01' }))
  expect(screen.getByTestId('editor')).toHaveTextContent('新年')
  expect(screen.getByTestId('editor')).toHaveAttribute('data-focus', '工作:0')
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
  await user.click(screen.getByText('仅出现一次（1）'))
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
  await user.click(screen.getByText('仅出现一次（1）'))
  await user.click(await screen.findByRole('button', { name: /工作.*1 天/ }))
  await user.click(await screen.findByRole('button', { name: /2024-12-31.*第 2 次/ }))
  app.services.session.edit('# 2024-12-31\n## 工作\n第一次\n## 工作\n修订后')
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(save).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('修订后')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '返回下一页面' }))
  expect(screen.getByTestId('editor')).toHaveTextContent('修订后')
})
