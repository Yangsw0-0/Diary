vi.mock('@/features/diary/CrepeEditor', () => ({
  CrepeEditor: ({ markdown }: { markdown: string }) => <pre>{markdown}</pre>,
}))
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

it('groups dates by year and displays long titles without changing the date label', async () => {
  const longTitle = '这是一段很长的日记标题'.repeat(8)
  const newer = {
    date: DiaryDate.parse('2025-01-01'),
    markdown: `# 2025-01-01 ${longTitle}`,
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
  expect(screen.getByText(longTitle)).toHaveAttribute('title', longTitle)
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
  expect(screen.getByText('仅出现一次（1）')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /工作.*2 天/ }))
  expect(await screen.findByText('第二天')).toBeInTheDocument()
  expect(screen.getByText('第一天').tagName).toBe('STRONG')
  expect(screen.getByText('第二次')).toBeInTheDocument()
})

it('uses the parsed visible heading for a formatted diary title', async () => {
  const entry = {
    date: DiaryDate.parse('2026-07-11'),
    markdown: '# 2026-07-11 **Bold**',
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
