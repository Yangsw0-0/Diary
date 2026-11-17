/** Editing surface contract; section focusing is added with M5 navigation. */
export interface EditorAdapter {
  mount(root: HTMLElement, markdown: string, onChange: (markdown: string) => void): Promise<void>
  getMarkdown(): string
  destroy(): Promise<void>
}
