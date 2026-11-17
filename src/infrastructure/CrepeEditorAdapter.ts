import type { EditorAdapter } from '@/application/EditorAdapter'

/** Keeps Milkdown's lifecycle and listener API outside the React view. */
export class CrepeEditorAdapter implements EditorAdapter {
  private editor: import('@milkdown/crepe').Crepe | null = null

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
    } catch (reason) {
      await editor.destroy()
      throw reason
    }
  }

  setReadonly(value: boolean): void {
    this.editor?.setReadonly(value)
  }

  getMarkdown(): string {
    if (!this.editor) throw new Error('编辑器尚未启动')
    return this.editor.getMarkdown()
  }

  async destroy(): Promise<void> {
    const editor = this.editor
    this.editor = null
    if (editor) await editor.destroy()
  }
}
