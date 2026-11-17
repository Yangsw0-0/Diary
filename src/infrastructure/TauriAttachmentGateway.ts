import { invoke } from '@tauri-apps/api/core'
import type { DiaryDate } from '@/domain/DiaryDate'
import { DiaryError } from '@/domain/DiaryError'
import type {
  AttachmentGateway,
  AttachmentPreview,
  ImportedAttachment,
} from '@/application/AttachmentService'
import { mapIpcError } from './diaryIpc'

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiaryError('invalid_response', '附件操作返回了无效数据')
  }
  return value as Record<string, unknown>
}

export class TauriAttachmentGateway implements AttachmentGateway {
  private readonly invokeCommand: typeof invoke

  constructor(invokeCommand: typeof invoke = invoke) {
    this.invokeCommand = invokeCommand
  }

  async import(date: DiaryDate, name: string, bytes: Uint8Array): Promise<ImportedAttachment> {
    try {
      const encodedName = Array.from(new TextEncoder().encode(name), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('')
      const data = object(
        await this.invokeCommand('import_attachment', bytes, {
          headers: { 'x-diary-date': date.toString(), 'x-diary-name': encodedName },
        }),
      )
      if (
        typeof data.fileName !== 'string' ||
        typeof data.relativePath !== 'string' ||
        typeof data.isImage !== 'boolean'
      )
        throw new DiaryError('invalid_response', '附件导入结果格式错误')
      return { fileName: data.fileName, relativePath: data.relativePath, isImage: data.isImage }
    } catch (reason) {
      throw mapIpcError(reason)
    }
  }

  async preview(date: DiaryDate, fileName: string): Promise<AttachmentPreview> {
    try {
      const data: unknown = await this.invokeCommand('preview_attachment', {
        date: date.toString(),
        fileName,
      })
      if (!(data instanceof ArrayBuffer)) {
        throw new DiaryError('invalid_response', '附件预览结果格式错误')
      }
      const extension = fileName.split('.').at(-1)?.toLowerCase()
      const mimeType = (
        {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          avif: 'image/avif',
        } as Record<string, string>
      )[extension ?? '']
      if (!mimeType) throw new DiaryError('invalid_response', '附件预览格式错误')
      return { bytes: new Uint8Array(data), mimeType }
    } catch (reason) {
      throw mapIpcError(reason)
    }
  }

  async open(date: DiaryDate, fileName: string): Promise<void> {
    try {
      await this.invokeCommand('open_attachment', { date: date.toString(), fileName })
    } catch (reason) {
      throw mapIpcError(reason)
    }
  }
}
