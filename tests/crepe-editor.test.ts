import { expect, it, vi } from 'vitest'
import { CrepeEditorAdapter } from '@/infrastructure/CrepeEditorAdapter'

it('loads Markdown into Crepe and serializes it back', async () => {
  const root = document.createElement('div')
  document.body.append(root)
  const adapter = new CrepeEditorAdapter()
  try {
    await adapter.mount(root, '# 2024-02-29 Journal\n\n**重要**\n\n- one\n- two', () => {})
    expect(adapter.getMarkdown()).toContain('# 2024-02-29 Journal')
    expect(adapter.getMarkdown()).toContain('**重要**')
    expect(adapter.getMarkdown()).toContain('* one') // Crepe normalizes bullet markers.
  } finally {
    await adapter.destroy()
    root.remove()
  }
})

it('focuses the requested repeated top-level section by key and ordinal', async () => {
  const root = document.createElement('div')
  document.body.append(root)
  const adapter = new CrepeEditorAdapter()
  const original = HTMLElement.prototype.scrollIntoView
  const scroll = vi.fn()
  HTMLElement.prototype.scrollIntoView = scroll
  try {
    await adapter.mount(root, '# 2024-02-29\n## 工作\nA\n## 家庭\nB\n## 工作\nC', () => {})
    expect(adapter.focusSection('工作', 1)).toBe(true)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(adapter.focusSection('工作', 2)).toBe(false)
  } finally {
    await adapter.destroy()
    root.remove()
    HTMLElement.prototype.scrollIntoView = original
  }
})

it('inserts a rendered attachment link and keeps its relative path in Markdown', async () => {
  const root = document.createElement('div')
  document.body.append(root)
  const adapter = new CrepeEditorAdapter()
  try {
    await adapter.mount(root, '# 2024-02-29\n\n正文', () => {})
    adapter.insertMarkdown(
      '[资料](../assets/2024/2024-02-29/att-00000000000000000000000000000000.pdf)',
    )
    expect(adapter.getMarkdown()).toContain('../assets/2024/2024-02-29/att-')
  } finally {
    await adapter.destroy()
    root.remove()
  }
})
