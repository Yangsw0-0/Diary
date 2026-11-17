import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { CrepeEditor } from '@/features/diary/CrepeEditor'
import type { EditorAdapter } from '@/application/EditorAdapter'

afterEach(cleanup)

it('waits for editor startup before inserting an attachment link', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  let ready = false
  const insert = vi.fn((_: string) => {
    if (!ready) throw new Error('编辑器尚未启动')
  })
  const adapter: EditorAdapter = {
    mount: async () => {
      await pending
      ready = true
    },
    destroy: async () => {},
    setReadonly: () => {},
    focusSection: () => true,
    getMarkdown: () => '',
    insertMarkdown: insert,
  }
  const onError = vi.fn()
  render(
    <CrepeEditor
      markdown="# 2024-02-29"
      onChange={() => {}}
      onComposing={() => {}}
      readOnly={false}
      createAdapter={() => adapter}
      focusRequest={null}
      onMissingSection={() => {}}
      onReady={() => {}}
      insertRequest={{ id: 1, markdown: '[附件](../assets/x)' }}
      onInsertError={onError}
    />,
  )
  expect(insert).not.toHaveBeenCalled()
  finish()
  await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
  expect(onError).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
