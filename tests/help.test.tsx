import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/app/AppShell'
import { createApp } from '@/app/bootstrap'
import type { DiaryRepository } from '@/domain/DiaryRepository'

afterEach(cleanup)

const repository: DiaryRepository = {
  list: async () => ({ entries: [], failures: [] }),
  read: async () => {
    throw new Error('not used')
  },
  save: async () => {
    throw new Error('not used')
  },
}

it('opens the bundled manual from settings, switches chapters, and restores focus on close', async () => {
  const user = userEvent.setup()
  const app = createApp(repository)
  render(<AppShell registry={app.registry} session={app.services.session} />)

  await user.click(screen.getByRole('button', { name: '设置' }))
  await user.click(screen.getByRole('tab', { name: '帮助' }))
  const trigger = screen.getByRole('button', { name: '打开使用说明' })
  await user.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Diary 使用说明' })
  expect(dialog).toHaveTextContent('首次启动')
  expect(screen.queryByRole('button', { name: '探索自我 - 恋爱' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '标签与分支' }))
  expect(dialog).toHaveTextContent('探索自我 - 恋爱')
  expect(dialog).toHaveTextContent('Tab')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Diary 使用说明' })).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})
