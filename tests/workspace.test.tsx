vi.mock('@/features/diary/CrepeEditor', () => ({
  CrepeEditor: ({ markdown }: { markdown: string }) => <pre>{markdown}</pre>,
}))
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoot } from '@/app/AppRoot'
import { createApp } from '@/app/bootstrap'
import type { WorkspaceGateway } from '@/application/WorkspaceService'
import { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import { TauriWorkspaceGateway } from '@/infrastructure/TauriWorkspaceGateway'

afterEach(cleanup)

const entry = {
  date: DiaryDate.parse('2024-02-29'),
  markdown: '# 2024-02-29 Leap day',
  revision: 'abc',
}
const repository: DiaryRepository = {
  list: async () => ({
    entries: [entry],
    failures: [{ fileName: 'bad.md', reason: 'invalid date' }],
  }),
  read: async () => entry,
  save: async () => entry,
}

it('stays on onboarding after cancel, then opens selected diary folder', async () => {
  const user = userEvent.setup()
  const selected = { root: '/chosen', configuredRoot: '/chosen', issue: null }
  const switched = { root: '/other', configuredRoot: '/other', issue: null }
  const gateway: WorkspaceGateway = {
    getStatus: vi.fn().mockResolvedValue({ root: null, configuredRoot: null, issue: null }),
    chooseRoot: vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(selected)
      .mockResolvedValueOnce(switched),
  }
  const app = createApp(repository, gateway)
  render(<AppRoot {...app} />)
  const choose = await screen.findByRole('button', { name: '选择文件夹' })
  await user.click(choose)
  expect(screen.getByRole('button', { name: '选择文件夹' })).toBeInTheDocument()
  await user.click(choose)
  expect(await screen.findByRole('button', { name: '2024-02-29' })).toBeInTheDocument()
  expect(screen.getByText(/bad.md/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '2024-02-29' }))
  expect(await screen.findByText('# 2024-02-29 Leap day')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '设置' }))
  await user.click(screen.getByRole('button', { name: '更换文件夹' }))
  await waitFor(() => expect(screen.getByTitle('/other')).toBeInTheDocument())
  expect(screen.queryByText('# 2024-02-29 Leap day')).not.toBeInTheDocument()
})

it('shows a missing saved folder and allows reselection', async () => {
  const gateway: WorkspaceGateway = {
    getStatus: async () => ({ root: null, configuredRoot: '/missing', issue: '文件夹已失效' }),
    chooseRoot: async () => ({ root: '/new', configuredRoot: '/new', issue: null }),
  }
  render(<AppRoot {...createApp(repository, gateway)} />)
  expect(await screen.findByText('文件夹已失效')).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: '选择文件夹' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument())
})

it('validates workspace IPC responses and preserves cancel', async () => {
  const invoke = vi
    .fn()
    .mockResolvedValueOnce({ root: null, configuredRoot: null, issue: null })
    .mockResolvedValueOnce(null)
  const gateway = new TauriWorkspaceGateway(invoke)
  expect((await gateway.getStatus()).root).toBeNull()
  expect(await gateway.chooseRoot()).toBeNull()
  expect(invoke.mock.calls.map((call) => call[0])).toEqual([
    'get_workspace_status',
    'choose_diary_root',
  ])
  await expect(
    new TauriWorkspaceGateway(vi.fn().mockResolvedValue({ root: 3 })).getStatus(),
  ).rejects.toMatchObject({ code: 'invalid_response' })
})

it('shows an actionable onboarding state when reading settings fails', async () => {
  const gateway: WorkspaceGateway = {
    getStatus: async () => {
      throw new Error('设置读取失败')
    },
    chooseRoot: async () => ({ root: '/chosen', configuredRoot: '/chosen', issue: null }),
  }
  render(<AppRoot {...createApp(repository, gateway)} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('设置读取失败')
  await userEvent.setup().click(screen.getByRole('button', { name: '选择文件夹' }))
  expect(await screen.findByRole('button', { name: '设置' })).toBeInTheDocument()
})

it('keeps a failed new diary draft and does not switch folders', async () => {
  const user = userEvent.setup()
  const chooseRoot = vi
    .fn()
    .mockResolvedValue({ root: '/other', configuredRoot: '/other', issue: null })
  const gateway: WorkspaceGateway = {
    getStatus: async () => ({ root: '/chosen', configuredRoot: '/chosen', issue: null }),
    chooseRoot,
  }
  const failing: DiaryRepository = {
    list: async () => ({ entries: [], failures: [] }),
    read: async () => {
      throw new Error('unused')
    },
    save: async () => {
      throw new Error('磁盘不可写')
    },
  }
  render(<AppRoot {...createApp(failing, gateway)} />)
  await user.click(await screen.findByRole('button', { name: '新建今日日记' }))
  await user.click(screen.getByRole('button', { name: '设置' }))
  await user.click(screen.getByRole('button', { name: '更换文件夹' }))
  expect(await screen.findByText(/保存失败：磁盘不可写/)).toBeInTheDocument()
  expect(chooseRoot).not.toHaveBeenCalled()
  expect(screen.getByTitle('/chosen')).toBeInTheDocument()
})
