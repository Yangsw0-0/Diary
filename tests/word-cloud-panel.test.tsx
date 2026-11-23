import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createApp } from '@/app/bootstrap'
import { AppShell } from '@/app/AppShell'
import { DiaryDate } from '@/domain/DiaryDate'
import type { CloudFile } from '@/domain/WordCloudRepository'
vi.mock('@/features/wordcloud/WordSphere', () => ({
  WordSphere: ({
    words,
    onActivate,
  }: {
    words: readonly { id: string; text: string }[]
    onActivate: (word: unknown) => void
  }) => (
    <div aria-label="测试球面">
      {words.map((w) => (
        <button key={w.id} onClick={() => onActivate(w)}>
          {w.text}
        </button>
      ))}
    </div>
  ),
}))
vi.mock('@/features/diary/CrepeEditor', () => ({
  CrepeEditor: ({ markdown }: { markdown: string }) => <pre>{markdown}</pre>,
}))
afterEach(cleanup)
it('integrates custom/tag deduplication, undo, live tag updates and existing tag navigation', async () => {
  const user = userEvent.setup()
  let entry = {
    date: DiaryDate.parse('2026-11-23'),
    markdown: '# 2026-11-23\n## 成长\n记录',
    revision: 'r1',
  }
  let file: CloudFile | null = null
  const app = createApp(
    {
      list: async () => ({ entries: [entry], failures: [] }),
      read: async () => entry,
      save: async () => entry,
    },
    undefined,
    undefined,
    undefined,
    { read: async () => file, save: async (json) => (file = { json, revision: 'r2' }) },
  )
  render(
    <AppShell
      registry={app.registry}
      session={app.services.session}
      nodes={app.services.nodes}
      wordCloud={app.services.wordCloud}
    />,
  )
  await screen.findByRole('button', { name: '2026-11-23' })
  await user.click(screen.getByRole('button', { name: '词云' }))
  const sphere = screen.getByLabelText('测试球面'),
    input = screen.getByLabelText('自定义词语')
  await waitFor(() => expect(input).not.toBeDisabled())
  await user.type(input, '成长{Enter}')
  expect(within(sphere).getAllByRole('button', { name: '成长' })).toHaveLength(1)
  await user.click(screen.getByRole('checkbox', { name: '显示已有标签' }))
  expect(within(sphere).getByRole('button', { name: '成长' })).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: '显示已有标签' }))
  await user.click(screen.getByRole('button', { name: '删除自定义词 成长' }))
  expect(within(sphere).getByRole('button', { name: '成长' })).toBeInTheDocument()
  expect(app.services.tagIndex.listGroups().singleDay).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: '撤销' }))
  expect(app.services.wordCloud.getSnapshot().document.words).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: '收起词云管理' }))
  expect(screen.queryByRole('complementary', { name: '词云管理' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '展开词云管理' }))
  const next = { ...entry, markdown: '# 2026-11-23\n## 新标签\n记录', revision: 'r2' }
  entry = next
  app.services.diary.reindex(next)
  await waitFor(() =>
    expect(within(sphere).queryByRole('button', { name: '新标签' })).toBeInTheDocument(),
  )
  await user.click(within(sphere).getByRole('button', { name: '新标签' }))
  expect(screen.getByRole('button', { name: '标签' })).toHaveAttribute('aria-current', 'page')
  expect(
    await within(screen.getByRole('region', { name: '标签内容' })).findByText('记录'),
  ).toBeInTheDocument()
  expect(app.services.wordCloud.getSnapshot().dirty).toBe(false)
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(screen.getByRole('button', { name: '词云' })).toHaveAttribute('aria-current', 'page')
  app.services.wordCloud.reset()
})

it('keeps cloud drafts and navigation history when a save fails during module switch', async () => {
  const user = userEvent.setup()
  const app = createApp(
    {
      list: async () => ({ entries: [], failures: [] }),
      read: async () => {
        throw new Error('unused')
      },
      save: async () => {
        throw new Error('unused')
      },
    },
    undefined,
    undefined,
    undefined,
    {
      read: async () => null,
      save: async () => {
        throw new Error('词云磁盘不可写')
      },
    },
  )
  render(
    <AppShell
      registry={app.registry}
      session={app.services.session}
      wordCloud={app.services.wordCloud}
    />,
  )
  await user.click(screen.getByRole('button', { name: '词云' }))
  const input = screen.getByLabelText('自定义词语')
  await waitFor(() => expect(input).not.toBeDisabled())
  await user.type(input, '保留草稿{Enter}')
  await user.click(screen.getByRole('button', { name: '标签' }))
  expect(screen.getByRole('button', { name: '词云' })).toHaveAttribute('aria-current', 'page')
  expect(app.services.wordCloud.getSnapshot().document.words[0]?.text).toBe('保留草稿')
  expect(app.services.wordCloud.getSnapshot().dirty).toBe(true)
  app.services.wordCloud.reset()
})
it('clicks an unused custom word to append today H2, update cloud classification, and return via history', async () => {
  const { todayDate } = await import('@/application/DiarySession')
  const user = userEvent.setup(),
    date = todayDate()
  let entry = { date, markdown: `# ${date}\n\n## 旧标签\n原文\n\n`, revision: 'r0' }
  let file: CloudFile | null = null
  const app = createApp(
    {
      list: async () => ({ entries: [entry], failures: [] }),
      read: async () => entry,
      save: async (d, markdown) => {
        entry = { date: d, markdown, revision: crypto.randomUUID() }
        return entry
      },
    },
    undefined,
    undefined,
    undefined,
    {
      read: async () => file,
      save: async (json) => (file = { json, revision: crypto.randomUUID() }),
    },
  )
  render(
    <AppShell
      registry={app.registry}
      session={app.services.session}
      wordCloud={app.services.wordCloud}
    />,
  )
  await screen.findByRole('button', { name: date.toString() })
  await user.click(screen.getByRole('button', { name: '词云' }))
  const input = screen.getByLabelText('自定义词语')
  await waitFor(() => expect(input).not.toBeDisabled())
  await user.type(input, '科研{Enter}')
  await user.click(within(screen.getByLabelText('测试球面')).getByRole('button', { name: '科研' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '日记' })).toHaveAttribute('aria-current', 'page'),
  )
  expect(entry.markdown).toContain('原文\n\n\n\n## 科研')
  expect(app.services.tagIndex.getOccurrences('科研')).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(screen.getByRole('button', { name: '词云' })).toHaveAttribute('aria-current', 'page')
  expect(app.services.wordCloud.getSnapshot().document.words[0]?.text).toBe('科研')
  const row = screen.getByRole('button', { name: '科研标签' })
  expect(row).toBeInTheDocument()
  app.services.wordCloud.reset()
})
it('opens the inserted draft with retry controls when its first save fails', async () => {
  const user = userEvent.setup()
  const app = createApp(
    {
      list: async () => ({ entries: [], failures: [] }),
      read: async () => {
        throw new Error('unused')
      },
      save: async () => {
        throw new Error('日记不可写')
      },
    },
    undefined,
    undefined,
    undefined,
    { read: async () => null, save: async (json) => ({ json, revision: 'c' }) },
  )
  render(
    <AppShell
      registry={app.registry}
      session={app.services.session}
      wordCloud={app.services.wordCloud}
    />,
  )
  await user.click(screen.getByRole('button', { name: '词云' }))
  const input = screen.getByLabelText('自定义词语')
  await waitFor(() => expect(input).not.toBeDisabled())
  await user.type(input, '科研{Enter}')
  await user.click(within(screen.getByLabelText('测试球面')).getByRole('button', { name: '科研' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '日记' })).toHaveAttribute('aria-current', 'page'),
  )
  expect(app.services.session.getSnapshot().selected?.error?.message).toBe('日记不可写')
  expect(app.services.session.getSnapshot().selected?.markdown).toContain('## 科研')
  expect(app.services.tagIndex.getOccurrences('科研')).toHaveLength(0)
  expect(screen.getByRole('button', { name: '保存日记' })).toBeInTheDocument()
  app.services.session.reset()
  app.services.wordCloud.reset()
})
