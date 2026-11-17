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
      const data = object(
        await this.invokeCommand('import_attachment', {
          date: date.toString(),
          name,
          bytes: Array.from(bytes),
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
      const data = object(
        await this.invokeCommand('preview_attachment', { date: date.toString(), fileName }),
      )
      if (
        !Array.isArray(data.bytes) ||
        !data.bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255) ||
        typeof data.mimeType !== 'string' ||
        !data.mimeType.startsWith('image/')
      ) {
        throw new DiaryError('invalid_response', '附件预览结果格式错误')
      }
      return { bytes: data.bytes as number[], mimeType: data.mimeType }
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
