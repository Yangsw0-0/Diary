import type { EditorAdapter } from '@/application/EditorAdapter'

/** Keeps Milkdown's lifecycle and listener API outside the React view. */
export class CrepeEditorAdapter implements EditorAdapter {
  private editor: import('@milkdown/crepe').Crepe | null = null
  private root: HTMLElement | null = null

  async mount(
    root: HTMLElement,
    markdown: string,
    onChange: (markdown: string) => void,
  ): Promise<void> {
    const { Crepe } = await import('@milkdown/crepe')
    const editor = new Crepe({ root, defaultValue: markdown })
    editor.on((listener) => {
      listener.markdownUpdated((_ctx, next, previous) => {
        if (next !== previous) onChange(next)
      })
    })
    try {
      await editor.create()
      this.editor = editor
      this.root = root
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
      (heading) => heading.textContent?.trim().normalize('NFC') === key,
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

  async destroy(): Promise<void> {
    const editor = this.editor
    this.editor = null
    this.root = null
    if (editor) await editor.destroy()
  }
}
