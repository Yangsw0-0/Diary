import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/app/AppShell'
import { createApp } from '@/app/bootstrap'
import type { AttachmentGateway } from '@/application/AttachmentService'
import { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryRepository } from '@/domain/DiaryRepository'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('renders a selected-root image in tag details through the safe preview gateway', async () => {
  const user = userEvent.setup()
  const date = DiaryDate.parse('2026-11-17')
  const fileName = 'att-00000000000000000000000000000000.png'
  const link = `../assets/2026/2026-11-17/${fileName}`
  const diary = { date, markdown: `# 2026-11-17\n## 工作\n![图片](${link})`, revision: 'r1' }
  const repo: DiaryRepository = {
    list: async () => ({ entries: [diary], failures: [] }),
    read: async () => diary,
    save: async () => diary,
  }
  const preview = vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' }))
  const attachments: AttachmentGateway = {
    import: async () => ({ fileName, relativePath: link, isImage: true }),
    preview,
    open: async () => {},
  }
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:diary-image'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  const app = createApp(repo, undefined, attachments)
  render(<AppShell registry={app.registry} session={app.services.session} />)
  await user.click(screen.getByRole('button', { name: '标签' }))
  await user.click(screen.getByText('隐藏的标签（1）'))
  await user.click(await screen.findByRole('button', { name: /工作.*1 天/ }))
  await waitFor(() =>
    expect(screen.getByRole('img', { name: '图片' })).toHaveAttribute('src', 'blob:diary-image'),
  )
  expect(preview).toHaveBeenCalledWith(date, fileName)
})
