vi.mock('@/features/diary/CrepeEditor', () => ({
  CrepeEditor: ({ markdown }: { markdown: string }) => <pre>{markdown}</pre>,
}))
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/app/AppShell'
import { createApp } from '@/app/bootstrap'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { DiaryDate } from '@/domain/DiaryDate'
import { DiaryError } from '@/domain/DiaryError'

function renderShell(repo: DiaryRepository) {
  const app = createApp(repo)
  render(<AppShell registry={app.registry} session={app.services.session} />)
  return app
}

const repository: DiaryRepository = {
  list: async () => ({ entries: [], failures: [] }),
  read: async () => {
    throw new Error('not used')
  },
  save: async () => {
    throw new Error('not used')
  },
}

afterEach(cleanup)

it('switches between diary and tags without showing fake diary data', async () => {
  const user = userEvent.setup()
  renderShell(repository)

  expect(screen.getByRole('region', { name: '日记列表' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '日记' })).toHaveAttribute('aria-current', 'page')

  await user.click(screen.getByRole('button', { name: '标签' }))
  expect(screen.getByRole('region', { name: '标签列表' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '日记列表' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '标签' })).toHaveAttribute('aria-current', 'page')
})

it('closes settings on Back without changing the underlying page or history', async () => {
  const user = userEvent.setup()
  renderShell(repository)
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(screen.getByRole('button', { name: '设置' }))
  expect(screen.getByRole('region', { name: '设置' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '返回下一页面' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(screen.queryByRole('region', { name: '设置' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: '标签列表' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '返回上一页面' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: '返回上一页面' }))
  expect(screen.getByRole('region', { name: '日记列表' })).toBeInTheDocument()
})

it('pulls current and adjacent pages on one track, then switches only one diary', async () => {
  const user = userEvent.setup()
  const entries = ['2024-03-03', '2024-03-02', '2024-03-01'].map((value) => ({
    date: DiaryDate.parse(value),
    markdown: `# ${value}\n\nA diary entry.`,
    revision: value,
  }))
  renderShell({
    list: async () => ({ entries, failures: [] }),
    read: async (date) => entries.find((entry) => entry.date.equals(date))!,
    save: async (_date, markdown) => ({ ...entries[0]!, markdown }),
  })
  await user.click(await screen.findByRole('button', { name: '2024-03-03' }))
  const content = screen.getByRole('region', { name: '日记正文' })
  Object.defineProperties(content, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1000 },
  })
  content.scrollTop = 200
  for (let i = 0; i < 4; i++) fireEvent.wheel(content, { deltaY: 90 })
  const track = content.closest('.adjacent-diary-track') as HTMLElement
  expect(track.style.transform).toBe('')
  content.scrollTop = 500
  fireEvent.wheel(content, { deltaY: 90 })
  expect(track.style.transform).toBe('translate3d(0px, -64px, 0px)')
  expect(track.querySelector('.adjacent-diary-preview')).toHaveAttribute('data-direction', 'older')
  expect(screen.getByRole('button', { name: '2024-03-03' })).toHaveAttribute('aria-current', 'true')
  fireEvent.wheel(content, { deltaY: 90 })
  expect(track.style.transform).not.toBe('translate3d(0px, 0px, 0px)')
  fireEvent.wheel(content, { deltaY: 90 })
  for (let i = 0; i < 8; i++) fireEvent.wheel(content, { deltaY: 90 })
  await waitFor(
    () =>
      expect(screen.getByRole('button', { name: '2024-03-02' })).toHaveAttribute(
        'aria-current',
        'true',
      ),
    { timeout: 1500 },
  )
  await waitFor(() => expect(track.style.transform).toBe('translate3d(0px, 0px, 0px)'))
  for (let i = 0; i < 8; i++) fireEvent.wheel(content, { deltaY: 90 })
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(screen.getByRole('button', { name: '2024-03-02' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('button', { name: '2024-03-01' })).not.toHaveAttribute(
    'aria-current',
    'true',
  )
})

it('keeps zoom and panel controls scoped to an open diary and opens settings at the left footer', async () => {
  const user = userEvent.setup()
  const date = DiaryDate.parse('2024-02-29')
  const entry = { date, markdown: '# 2024-02-29 Saved', revision: 'r1' }
  renderShell({
    list: async () => ({ entries: [entry], failures: [] }),
    read: async () => entry,
    save: async () => entry,
  })
  expect(screen.queryByRole('slider', { name: '正文缩放' })).not.toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: '2024-02-29' }))
  expect(screen.getByRole('button', { name: '保存日记' })).toHaveAttribute('data-state', 'saved')
  await user.click(screen.getByRole('button', { name: '缩小正文' }))
  expect(screen.getByRole('slider', { name: '正文缩放' })).toHaveValue('90')
  await user.click(screen.getByRole('button', { name: '展开正文' }))
  expect(screen.getByRole('button', { name: '退出展开正文' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '退出展开正文' }))
  await user.click(screen.getByRole('button', { name: '收起列表' }))
  expect(screen.getByRole('button', { name: '展开列表' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '设置' }))
  expect(screen.getByRole('region', { name: '设置' })).toBeInTheDocument()
  expect(screen.queryByRole('slider', { name: '正文缩放' })).not.toBeInTheDocument()
})

it('shows only the workspace folder name and changes font size without CSS zoom', async () => {
  const user = userEvent.setup()
  const date = DiaryDate.parse('2024-02-29')
  const entry = { date, markdown: '# 2024-02-29 Saved', revision: 'r1' }
  const app = createApp({
    list: async () => ({ entries: [entry], failures: [] }),
    read: async () => entry,
    save: async () => entry,
  })
  const { container } = render(
    <AppShell
      registry={app.registry}
      session={app.services.session}
      root="/some/parent/DiaryNotes"
    />,
  )
  expect(screen.getByTitle('/some/parent/DiaryNotes')).toHaveTextContent('DiaryNotes')
  await user.click(await screen.findByRole('button', { name: '2024-02-29' }))
  await user.click(screen.getByRole('button', { name: '放大正文' }))
  const panels = container.querySelector('.workspace-panels:not([hidden])') as HTMLElement
  expect(panels.style.getPropertyValue('--detail-font-size')).toBe('17.6px')
  const shell = container.querySelector('.app-shell') as HTMLElement
  expect(shell.style.getPropertyValue('--editor-zoom')).toBe('')
})

it('resizes the list immediately down to its content-safe minimum', async () => {
  const app = createApp(repository)
  const { container } = render(<AppShell registry={app.registry} session={app.services.session} />)
  const splitter = screen.getByRole('separator', { name: '调整列表宽度' })
  const panels = container.querySelector('.workspace-panels:not([hidden])') as HTMLElement
  fireEvent.pointerDown(splitter, { clientX: 500 })
  expect(panels).toHaveAttribute('data-list-resizing', 'true')
  fireEvent.pointerMove(window, { clientX: 300 })
  expect(splitter).toHaveAttribute('aria-valuenow', '168')
  expect(panels.style.getPropertyValue('--detail-font-size')).toBe('16px')
  fireEvent.pointerUp(window, { clientX: 300 })
  expect(panels).toHaveAttribute('data-list-resizing', 'false')
})

it('provides independent corner controls for tag details', async () => {
  const user = userEvent.setup()
  const app = createApp(repository)
  const { container } = render(<AppShell registry={app.registry} session={app.services.session} />)
  await user.click(screen.getByRole('button', { name: '标签' }))
  const panels = container.querySelector('.workspace-panels:not([hidden])') as HTMLElement
  expect(panels.querySelector('.view-control-zone')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '放大正文' }))
  expect(panels.style.getPropertyValue('--detail-font-size')).toBe('17.6px')
  await user.click(screen.getByRole('button', { name: '展开正文' }))
  expect(screen.getByRole('button', { name: '退出展开正文' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '日记' }))
  expect(screen.queryByRole('slider', { name: '正文缩放' })).not.toBeInTheDocument()
})

it('keeps the selected diary mounted when visiting tags', async () => {
  const user = userEvent.setup()
  const date = DiaryDate.parse('2024-02-29')
  const entry = { date, markdown: '# 2024-02-29 Saved', revision: 'r1' }
  const diary: DiaryRepository = {
    list: async () => ({ entries: [entry], failures: [] }),
    read: async () => entry,
    save: async () => entry,
  }
  renderShell(diary)
  await user.click(await screen.findByRole('button', { name: '2024-02-29' }))
  expect(await screen.findByText('# 2024-02-29 Saved')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(screen.getByRole('button', { name: '日记' }))
  expect(screen.getByText('# 2024-02-29 Saved')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '2024-02-29' })).toHaveAttribute('aria-current', 'true')
})

it('keeps the current diary when another date fails to load', async () => {
  const user = userEvent.setup()
  const first = {
    date: DiaryDate.parse('2024-02-29'),
    markdown: '# 2024-02-29 Saved',
    revision: 'r1',
  }
  const second = {
    date: DiaryDate.parse('2024-03-01'),
    markdown: '# 2024-03-01 Saved',
    revision: 'r2',
  }
  const read = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new DiaryError('corrupt_file', '文件已损坏'))
  const diary: DiaryRepository = {
    list: async () => ({ entries: [second, first], failures: [] }),
    read,
    save: async () => first,
  }
  renderShell(diary)
  await user.click(await screen.findByRole('button', { name: '2024-02-29' }))
  expect(await screen.findByText('# 2024-02-29 Saved')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '2024-03-01' }))
  expect(await screen.findByText('文件已损坏')).toBeInTheDocument()
  expect(screen.getByText('# 2024-02-29 Saved')).toBeInTheDocument()
})

it('groups dates by year and displays long tag labels without changing the date label', async () => {
  const longTitle = '这是一段很长的日记标题'.repeat(8)
  const newer = {
    date: DiaryDate.parse('2025-01-01'),
    markdown: `# 2025-01-01\n## ${longTitle}`,
    revision: 'r2',
  }
  const older = {
    date: DiaryDate.parse('2024-12-31'),
    markdown: '# 2024-12-31',
    revision: 'r1',
  }
  const diary: DiaryRepository = {
    list: async () => ({ entries: [newer, older], failures: [] }),
    read: async (day) => (day.equals(newer.date) ? newer : older),
    save: async () => newer,
  }
  renderShell(diary)
  expect(await screen.findByRole('button', { name: '2025-01-01' })).toHaveAttribute(
    'aria-label',
    '2025-01-01',
  )
  expect(
    screen
      .getAllByText(longTitle)
      .find((element) => element.classList.contains('diary-list-title')),
  ).toHaveAttribute('title', longTitle)
  expect(screen.getAllByText('2025').length).toBeGreaterThan(0)
  expect(screen.getByText('2024')).toBeInTheDocument()
})

it('shows frequent tags by day, keeps single-day tags collapsed and renders read-only sections', async () => {
  const user = userEvent.setup()
  const first = {
    date: DiaryDate.parse('2024-12-31'),
    markdown: '# 2024-12-31\n## 工作\n**第一天**\n## 工作\n第二次\n## 独有\n只在这一天',
    revision: 'r1',
  }
  const second = {
    date: DiaryDate.parse('2025-01-01'),
    markdown: '# 2025-01-01\n## 工作\n第二天',
    revision: 'r2',
  }
  const diary: DiaryRepository = {
    list: async () => ({ entries: [second, first], failures: [] }),
    read: async (day) => (day.equals(first.date) ? first : second),
    save: async () => second,
  }
  renderShell(diary)
  await user.click(screen.getByRole('button', { name: '标签' }))
  expect(await screen.findByRole('button', { name: /工作.*2 天/ })).toBeInTheDocument()
  expect(screen.getByText('隐藏的标签（1）')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /工作.*2 天/ }))
  expect(await screen.findByText('第二天')).toBeInTheDocument()
  expect(screen.getByText('第一天').tagName).toBe('STRONG')
  expect(screen.getByText('第二次')).toBeInTheDocument()
})

it('uses the parsed visible heading for a formatted diary tag', async () => {
  const entry = {
    date: DiaryDate.parse('2026-07-11'),
    markdown: '# 2026-07-11\n## **Bold**',
    revision: 'r1',
  }
  const diary: DiaryRepository = {
    list: async () => ({ entries: [entry], failures: [] }),
    read: async () => entry,
    save: async () => entry,
  }
  renderShell(diary)
  expect(await screen.findByText('Bold')).toHaveAttribute('title', 'Bold')
  expect(screen.queryByText('**Bold**')).not.toBeInTheDocument()
})

it('collapses, peeks and remembers a resized sidebar without changing the page', async () => {
  const user = userEvent.setup()
  const app = createApp(repository)
  const save = vi.fn(async () => {})
  const { container } = render(
    <AppShell registry={app.registry} session={app.services.session} onSavePreferences={save} />,
  )
  const shell = container.querySelector('.app-shell')!
  fireEvent.pointerDown(screen.getByRole('separator', { name: '调整侧栏宽度' }), { clientX: 220 })
  fireEvent.pointerMove(window, { clientX: 240 })
  fireEvent.pointerUp(window, { clientX: 240 })
  expect(save).toHaveBeenCalledWith(240, false)
  await user.click(screen.getByRole('button', { name: '收起侧栏' }))
  expect(shell).toHaveAttribute('data-sidebar-collapsed', 'true')
  await user.hover(screen.getByRole('button', { name: '显示侧栏' }))
  expect(shell).toHaveAttribute('data-sidebar-peek', 'true')
  await user.click(screen.getByRole('button', { name: '固定展开侧栏' }))
  expect(shell).toHaveAttribute('data-sidebar-collapsed', 'false')
  expect(screen.getByRole('button', { name: '日记' })).toHaveAttribute('aria-current', 'page')
})

it('offers explicit conflict recovery actions in the editor', async () => {
  const user = userEvent.setup()
  const day = DiaryDate.parse('2024-02-29')
  let disk = { date: day, markdown: '# 2024-02-29 Old', revision: 'r1' }
  const diary: DiaryRepository = {
    list: async () => ({ entries: [disk], failures: [] }),
    read: async () => disk,
    save: async (_date, markdown, expected) => {
      if (expected.kind !== 'match' || expected.revision !== disk.revision)
        throw new DiaryError('conflict', '日记已被外部修改')
      disk = { date: day, markdown, revision: 'r3' }
      return disk
    },
  }
  const app = createApp(diary)
  render(<AppShell registry={app.registry} session={app.services.session} />)
  await user.click(await screen.findByRole('button', { name: '2024-02-29' }))
  disk = { date: day, markdown: '# 2024-02-29 External', revision: 'r2' }
  app.services.session.edit('# 2024-02-29 My draft')
  expect(await app.services.session.flush()).toBe(false)
  expect(await screen.findByRole('button', { name: '覆盖保存' })).toBeInTheDocument()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  try {
    await user.click(screen.getByRole('button', { name: '覆盖保存' }))
    await vi.waitFor(() => expect(disk.markdown).toBe('# 2024-02-29 My draft'))
  } finally {
    confirm.mockRestore()
  }
})
