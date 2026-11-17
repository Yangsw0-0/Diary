/** Editing surface contract; scrolling of the surrounding panel belongs to AppShell. */
export interface EditorAdapter {
  mount(root: HTMLElement, markdown: string, onChange: (markdown: string) => void): Promise<void>
  getMarkdown(): string
  setReadonly(value: boolean): void
  focusSection(key: string, ordinal: number): boolean
  destroy(): Promise<void>
}
