import type { DiaryDate } from '@/domain/DiaryDate'

export interface ImportedAttachment {
  readonly fileName: string
  readonly relativePath: string
  readonly isImage: boolean
}

export interface AttachmentPreview {
  readonly bytes: readonly number[]
  readonly mimeType: string
}

export interface AttachmentGateway {
  import(date: DiaryDate, name: string, bytes: Uint8Array): Promise<ImportedAttachment>
  preview(date: DiaryDate, fileName: string): Promise<AttachmentPreview>
  open(date: DiaryDate, fileName: string): Promise<void>
}

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

/** Accepts only links generated under the selected day's attachment directory. */
export function attachmentFileName(date: DiaryDate, url: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(url)
  } catch {
    return null
  }
  const prefix = `../assets/${date.year}/${date.toString()}/`
  if (!decoded.startsWith(prefix)) return null
  const fileName = decoded.slice(prefix.length)
  return /^att-[0-9a-f]{32}\.[a-zA-Z0-9]{1,12}$/.test(fileName) ? fileName : null
}

function escapeLabel(value: string): string {
  return (
    value
      .replace(/[\\[\]]/g, '\\$&')
      .replace(/[\r\n]/g, ' ')
      .trim() || '附件'
  )
}

export class AttachmentService {
  private readonly gateway: AttachmentGateway

  constructor(gateway: AttachmentGateway) {
    this.gateway = gateway
  }

  async importFile(
    date: DiaryDate,
    file: File,
  ): Promise<{ attachment: ImportedAttachment; markdown: string }> {
    if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error('附件必须非空且不超过 20 MiB')
    }
    const extension =
      (
        {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'image/avif': 'avif',
        } as Record<string, string>
      )[file.type] ?? 'bin'
    const name = file.name
      ? /\.[^./\\]+$/.test(file.name)
        ? file.name
        : `${file.name}.${extension}`
      : `粘贴图片.${extension}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const attachment = await this.gateway.import(date, name, bytes)
    const label = escapeLabel(name)
    const markdown = `${attachment.isImage ? '!' : ''}[${label}](${attachment.relativePath})`
    return { attachment, markdown }
  }

  async previewUrl(date: DiaryDate, url: string): Promise<string> {
    const fileName = attachmentFileName(date, url)
    if (!fileName) return url
    const preview = await this.gateway.preview(date, fileName)
    return URL.createObjectURL(
      new Blob([new Uint8Array(preview.bytes)], { type: preview.mimeType }),
    )
  }

  async openUrl(date: DiaryDate, url: string): Promise<boolean> {
    const fileName = attachmentFileName(date, url)
    if (!fileName) return false
    await this.gateway.open(date, fileName)
    return true
  }
}
