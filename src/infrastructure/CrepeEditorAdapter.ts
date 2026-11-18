import type { EditorAdapter } from '@/application/EditorAdapter'
import { TagName } from '@/domain/TagName'
import type { TagCompletion } from '@/application/TagCompletion'
import { createTagCompletionPlugin } from './TagCompletionPlugin'

interface AttachmentHooks {
  readonly onUpload?: (file: File) => Promise<string>
  readonly previewUrl?: (url: string) => Promise<string>
}

/** Keeps Milkdown's lifecycle and listener API outside the React view. */
export class CrepeEditorAdapter implements EditorAdapter {
  private editor: import('@milkdown/crepe').Crepe | null = null
  private root: HTMLElement | null = null
  private insertAction: typeof import('@milkdown/kit/utils').insert | null = null
  private readonly previewUrls = new Set<string>()
  private readonly previewCache = new Map<string, Promise<string>>()
  private previewEpoch = 0
  private readonly attachments: AttachmentHooks
  private readonly completion: TagCompletion | null

  constructor(attachments: AttachmentHooks = {}, completion: TagCompletion | null = null) {
    this.attachments = attachments
    this.completion = completion
  }

  async mount(
    root: HTMLElement,
    markdown: string,
    onChange: (markdown: string) => void,
  ): Promise<void> {
    const previewEpoch = ++this.previewEpoch
    const [{ Crepe, CrepeFeature }, { insert }] = await Promise.all([
      import('@milkdown/crepe'),
      import('@milkdown/kit/utils'),
    ])
    const editor = new Crepe({
      root,
      defaultValue: markdown,
      featureConfigs: {
        [CrepeFeature.ImageBlock]: {
          ...(this.attachments.onUpload ? { onUpload: this.attachments.onUpload } : {}),
          ...(this.attachments.previewUrl
            ? {
                proxyDomURL: async (url: string) => {
                  const cached = this.previewCache.get(url)
                  if (cached) return cached
                  const pending = this.attachments.previewUrl!(url)
                    .then((resolved) => {
                      if (resolved.startsWith('blob:')) {
                        if (previewEpoch === this.previewEpoch) this.previewUrls.add(resolved)
                        else URL.revokeObjectURL(resolved)
                      }
                      return resolved
                    })
                    .catch((reason: unknown) => {
                      this.previewCache.delete(url)
                      throw reason
                    })
                  this.previewCache.set(url, pending)
                  return pending
                },
              }
            : {}),
        },
      },
    })
    if (this.completion) editor.editor.use(createTagCompletionPlugin(this.completion))
    editor.on((listener) => {
      listener.markdownUpdated((_ctx, next, previous) => {
        if (next !== previous) onChange(next)
      })
    })
    try {
      await editor.create()
      this.editor = editor
      this.root = root
      this.insertAction = insert
    } catch (reason) {
      await editor.destroy()
      throw reason
    }
  }

  setReadonly(value: boolean): void {
    this.editor?.setReadonly(value)
  }

  focusSection(key: string, ordinal: number): boolean {
    if (!this.root) return false
    const headings = [...this.root.querySelectorAll<HTMLElement>('.ProseMirror > h2')].filter(
      (heading) => TagName.parse(heading.textContent ?? '')?.key === key,
    )
    const target = headings[ordinal]
    if (!target) return false
    target.scrollIntoView({ block: 'start' })
    return true
  }

  getMarkdown(): string {
    if (!this.editor) throw new Error('编辑器尚未启动')
    return this.editor.getMarkdown()
  }

  insertMarkdown(markdown: string): void {
    if (!this.editor || !this.insertAction) throw new Error('编辑器尚未启动')
    this.editor.editor.action(this.insertAction(markdown))
  }

  async destroy(): Promise<void> {
    this.previewEpoch += 1
    const editor = this.editor
    this.editor = null
    this.root = null
    this.insertAction = null
    for (const url of this.previewUrls) URL.revokeObjectURL(url)
    this.previewUrls.clear()
    this.previewCache.clear()
    if (editor) await editor.destroy()
  }
}
