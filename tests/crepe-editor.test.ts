import { expect, it } from 'vitest'
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
