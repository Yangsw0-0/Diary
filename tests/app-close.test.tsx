import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoot } from '@/app/AppRoot'
import { createApp } from '@/app/bootstrap'
import type { DiaryRepository } from '@/domain/DiaryRepository'
import type { WorkspaceGateway } from '@/application/WorkspaceService'

let onClose: ((event: { preventDefault: () => void }) => void) | undefined
const destroy = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (handler: typeof onClose) => {
      onClose = handler
      return () => {}
    },
    destroy,
  }),
}))
vi.mock('@/features/diary/CrepeEditor', () => ({
  CrepeEditor: ({ markdown }: { markdown: string }) => <pre>{markdown}</pre>,
}))

afterEach(() => {
  cleanup()
  destroy.mockClear()
  onClose = undefined
})

it('offers a deliberate discard-and-close path when saving fails', async () => {
  const gateway: WorkspaceGateway = {
    getStatus: async () => ({ root: '/chosen', configuredRoot: '/chosen', issue: null }),
    chooseRoot: async () => null,
  }
  const repo: DiaryRepository = {
    list: async () => ({ entries: [], failures: [] }),
    read: async () => {
      throw new Error('unused')
    },
    save: async () => {
      throw new Error('磁盘不可写')
    },
  }
  render(<AppRoot {...createApp(repo, gateway)} />)
  await userEvent.setup().click(await screen.findByRole('button', { name: '新建今日日记' }))
  await waitFor(() => expect(onClose).toBeDefined())
  const preventDefault = vi.fn()
  onClose!({ preventDefault })
  expect(preventDefault).toHaveBeenCalled()
  const dialog = await screen.findByRole('dialog', { name: '未保存的日记' })
  expect(dialog).toHaveTextContent('磁盘不可写')
  await userEvent.setup().click(screen.getByRole('button', { name: '放弃草稿并关闭' }))
  await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1))
})
