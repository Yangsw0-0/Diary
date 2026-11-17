import { useEffect, useRef, useState } from 'react'
import type { EditorAdapter } from '@/application/EditorAdapter'

interface Props {
  readonly markdown: string
  readonly onChange: (markdown: string) => void
  readonly onComposing: (value: boolean) => void
  readonly readOnly: boolean
  readonly createAdapter: () => EditorAdapter
}

export function CrepeEditor({ markdown, onChange, onComposing, readOnly, createAdapter }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onComposingRef = useRef(onComposing)
  const adapterRef = useRef<EditorAdapter | null>(null)
  const readOnlyRef = useRef(readOnly)
  const [error, setError] = useState<string | null>(null)
  onChangeRef.current = onChange
  onComposingRef.current = onComposing
  readOnlyRef.current = readOnly

  useEffect(() => {
    const adapter = createAdapter()
    adapterRef.current = adapter
    let disposed = false
    if (root.current) {
      void adapter
        .mount(root.current, markdown, (next) => {
          if (!disposed) onChangeRef.current(next)
        })
        .then(
          () => {
            if (disposed) void adapter.destroy()
            else adapter.setReadonly(readOnlyRef.current)
          },
          (reason: unknown) => {
            if (!disposed) setError(reason instanceof Error ? reason.message : '编辑器无法启动')
          },
        )
    }
    return () => {
      disposed = true
      adapterRef.current = null
      void adapter.destroy()
    }
  }, [])

  useEffect(() => {
    adapterRef.current?.setReadonly(readOnly)
  }, [readOnly])

  return (
    <div
      className="diary-crepe-container"
      aria-busy={readOnly}
      onCompositionStart={() => onComposingRef.current(true)}
      onCompositionEnd={() => onComposingRef.current(false)}
    >
      {error && (
        <p role="alert" className="workspace-error">
          编辑器加载失败：{error}
        </p>
      )}
      <div className="diary-crepe-root" ref={root} aria-label="日记编辑器" />
    </div>
  )
}
