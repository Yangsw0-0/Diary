import { useEffect, useRef, useState } from 'react'
import { CrepeEditorAdapter } from '@/infrastructure/CrepeEditorAdapter'

interface Props {
  readonly markdown: string
  readonly onChange: (markdown: string) => void
  readonly onComposing: (value: boolean) => void
}

export function CrepeEditor({ markdown, onChange, onComposing }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onComposingRef = useRef(onComposing)
  const [error, setError] = useState<string | null>(null)
  onChangeRef.current = onChange
  onComposingRef.current = onComposing

  useEffect(() => {
    const adapter = new CrepeEditorAdapter()
    let disposed = false
    if (root.current) {
      void adapter
        .mount(root.current, markdown, (next) => {
          if (!disposed) onChangeRef.current(next)
        })
        .then(
          () => {
            if (disposed) void adapter.destroy()
          },
          (reason: unknown) => {
            if (!disposed) setError(reason instanceof Error ? reason.message : '编辑器无法启动')
          },
        )
    }
    return () => {
      disposed = true
      void adapter.destroy()
    }
  }, [])

  return (
    <div
      className="diary-crepe-container"
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
