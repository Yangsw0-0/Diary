import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from '@/app/AppShell'
import { createApp } from '@/app/bootstrap'
import type { AttachmentGateway } from '@/application/AttachmentService'
import { DiaryDate } from '@/domain/DiaryDate'
import type { DiaryRepository } from '@/domain/DiaryRepository'

afterEach(cleanup)
beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
  })
  document.elementFromPoint = () => document.body
})

it('imports a selected file, inserts its link into Crepe and saves it with the diary', async () => {
  const user = userEvent.setup()
  const day = DiaryDate.parse('2024-02-29')
  const fileName = 'att-00000000000000000000000000000000.pdf'
  const relativePath = `../assets/2024/2024-02-29/${fileName}`
  let disk = { date: day, markdown: '# 2024-02-29\n\n正文', revision: 'r1' }
  const save = vi.fn(async (_date: DiaryDate, markdown: string) => {
    disk = { ...disk, markdown, revision: 'r2' }
    return disk
  })
  const repo: DiaryRepository = {
    list: async () => ({ entries: [disk], failures: [] }),
    read: async () => disk,
    save,
  }
  const open = vi.fn(async () => {})
  const attachments: AttachmentGateway = {
    import: async () => ({ fileName, relativePath, isImage: false }),
    preview: async () => ({ bytes: [], mimeType: 'image/png' }),
    open,
  }
  const app = createApp(repo, undefined, attachments)
  render(<AppShell registry={app.registry} session={app.services.session} />)
  await user.click(await screen.findByRole('button', { name: '2024-02-29' }))
  await screen.findByLabelText('日记编辑器')
  await user.upload(
    screen.getByLabelText('选择附件文件'),
    new File(['PDF'], '资料.pdf', { type: 'application/pdf' }),
  )
  await waitFor(() =>
    expect(app.services.session.getSnapshot().selected?.markdown).toContain(relativePath),
  )
  expect(await app.services.session.flush()).toBe(true)
  expect(save).toHaveBeenCalled()
  expect(disk.markdown).toContain(`[资料.pdf](${relativePath})`)
  fireEvent.click(screen.getByRole('link', { name: '资料.pdf' }))
  await waitFor(() => expect(open).toHaveBeenCalledWith(day, fileName))
})
