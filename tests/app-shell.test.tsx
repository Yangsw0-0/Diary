import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/app/AppShell'
import { createApp } from '@/app/bootstrap'
import type { DiaryRepository } from '@/domain/DiaryRepository'

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
