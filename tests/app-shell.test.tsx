vi.mock('@/features/diary/CrepeEditor', () => ({
  CrepeEditor: ({ markdown }: { markdown: string }) => <pre>{markdown}</pre>,
}))
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/app/AppShell'
import { createApp } from '@/app/bootstrap'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { DiaryDate } from '@/domain/DiaryDate'
import { DiaryError } from '@/domain/DiaryError'

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
  render(<AppShell registry={createApp(repository).registry} />)

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
  render(<AppShell registry={createApp(diary).registry} />)
  await user.click(await screen.findByRole('button', { name: '2024-02-29' }))
  expect(await screen.findByText('# 2024-02-29 Saved')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(screen.getByRole('button', { name: '日记' }))
  expect(screen.getByText('# 2024-02-29 Saved')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '2024-02-29' })).toHaveAttribute('aria-current', 'true')
})

it('clears stale diary content when another date fails to load', async () => {
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
  render(<AppShell registry={createApp(diary).registry} />)
  await user.click(await screen.findByRole('button', { name: '2024-02-29' }))
  expect(await screen.findByText('# 2024-02-29 Saved')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '2024-03-01' }))
  expect(await screen.findByText('文件已损坏')).toBeInTheDocument()
  expect(screen.queryByText('# 2024-02-29 Saved')).not.toBeInTheDocument()
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
  render(<AppShell registry={createApp(diary).registry} />)
  expect(await screen.findByRole('button', { name: '2025-01-01' })).toHaveAttribute(
    'aria-label',
    '2025-01-01',
  )
  expect(screen.getByText(longTitle)).toHaveAttribute('title', longTitle)
  expect(screen.getByText('2025')).toBeInTheDocument()
  expect(screen.getByText('2024')).toBeInTheDocument()
})
