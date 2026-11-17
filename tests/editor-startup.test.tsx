import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
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

it('consumes an insertion after success so an editor remount cannot repeat it', async () => {
  const insert = vi.fn()
  const mount = vi.fn(async () => {})
  const adapter: EditorAdapter = {
    mount,
    destroy: async () => {},
    setReadonly: () => {},
    focusSection: () => true,
    getMarkdown: () => '',
    insertMarkdown: insert,
  }
  function Host() {
    const [request, setRequest] = useState<{ id: number; markdown: string } | null>({
      id: 1,
      markdown: '[附件](../assets/x)',
    })
    const [epoch, setEpoch] = useState(0)
    return (
      <>
        <button onClick={() => setEpoch((value) => value + 1)}>重载编辑器</button>
        <CrepeEditor
          key={epoch}
          markdown="# 2024-02-29"
          onChange={() => {}}
          onComposing={() => {}}
          readOnly={false}
          createAdapter={() => adapter}
          focusRequest={null}
          onMissingSection={() => {}}
          onReady={() => {}}
          insertRequest={request}
          onInserted={(id) => setRequest((current) => (current?.id === id ? null : current))}
        />
      </>
    )
  }
  render(<Host />)
  await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
  screen.getByRole('button', { name: '重载编辑器' }).click()
  await waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
  expect(insert).toHaveBeenCalledTimes(1)
})
