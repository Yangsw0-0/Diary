import { expect, it, vi } from 'vitest'
import {
  AttachmentService,
  attachmentFileName,
  type AttachmentGateway,
} from '@/application/AttachmentService'
import { DiaryDate } from '@/domain/DiaryDate'
import { TauriAttachmentGateway } from '@/infrastructure/TauriAttachmentGateway'

const day = DiaryDate.parse('2026-11-17')
const fileName = 'att-00000000000000000000000000000000.png'
const relativePath = `../assets/2026/2026-11-17/${fileName}`

it('copies before returning a relative Markdown link and limits readable paths', async () => {
  const importFile = vi.fn(async () => ({ fileName, relativePath, isImage: true }))
  const open = vi.fn(async () => {})
  const preview = vi.fn(async () => ({
    bytes: new Uint8Array([137, 80, 78, 71]),
    mimeType: 'image/png',
  }))
  const gateway: AttachmentGateway = {
    import: importFile,
    preview,
    open,
  }
  const service = new AttachmentService(gateway)
  const file = new File(['bytes'], '图[片].png', { type: 'image/png' })
  const imported = await service.importFile(day, file)
  expect(importFile).toHaveBeenCalledOnce()
  expect(imported.markdown).toBe(`![图\\[片\\].png](${relativePath})`)
  expect(attachmentFileName(day, relativePath)).toBe(fileName)
  expect(attachmentFileName(day, '../assets/2026/2026-11-17/../../secret')).toBeNull()
  expect(await service.openUrl(day, relativePath)).toBe(true)
  expect(open).toHaveBeenCalledWith(day, fileName)
  const renamedDiary = DiaryDate.parse('2026-11-18')
  expect(await service.openUrl(renamedDiary, relativePath)).toBe(true)
  expect(open).toHaveBeenLastCalledWith(day, fileName)
  await service.previewUrl(renamedDiary, relativePath)
  expect(preview).toHaveBeenCalledWith(day, fileName)
})

it('does not produce a link when copying fails', async () => {
  const gateway: AttachmentGateway = {
    import: async () => {
      throw new Error('磁盘已满')
    },
    preview: async () => ({ bytes: new Uint8Array(), mimeType: 'image/png' }),
    open: async () => {},
  }
  await expect(
    new AttachmentService(gateway).importFile(day, new File(['x'], 'a.png')),
  ).rejects.toThrow('磁盘已满')
})

it('validates attachment responses at the Tauri IPC boundary', async () => {
  const invoke = vi
    .fn()
    .mockResolvedValueOnce({ fileName, relativePath, isImage: true })
    .mockResolvedValueOnce(new Uint8Array([1, 2]).buffer)
  const gateway = new TauriAttachmentGateway(invoke)
  expect((await gateway.import(day, 'a.png', new Uint8Array([1]))).relativePath).toBe(relativePath)
  expect((await gateway.preview(day, fileName)).bytes).toEqual(new Uint8Array([1, 2]))
  expect(invoke.mock.calls[0]?.[1]).toEqual(new Uint8Array([1]))
  await expect(
    new TauriAttachmentGateway(
      vi.fn().mockResolvedValue({ bytes: [-1], mimeType: 'image/png' }),
    ).preview(day, fileName),
  ).rejects.toMatchObject({ code: 'invalid_response' })
})

it('passes a large attachment through raw IPC without expanding it into JSON numbers', async () => {
  const bytes = new Uint8Array(1024 * 1024)
  bytes[0] = 137
  bytes[bytes.length - 1] = 42
  const invoke = vi
    .fn()
    .mockResolvedValueOnce({ fileName, relativePath, isImage: true })
    .mockResolvedValueOnce(bytes.buffer)
  const gateway = new TauriAttachmentGateway(invoke)
  await gateway.import(day, '图片.png', bytes)
  expect(invoke.mock.calls[0]?.[1]).toBe(bytes)
  expect(invoke.mock.calls[0]?.[2]).toMatchObject({
    headers: { 'x-diary-date': '2026-11-17' },
  })
  const preview = await gateway.preview(day, fileName)
  expect(preview.bytes).toHaveLength(bytes.length)
  expect(preview.bytes[bytes.length - 1]).toBe(42)
})
