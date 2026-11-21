import { useEffect, useRef, useState } from 'react'
import type { NodeEvent } from '@/domain/NodesDocument'
import type { NodesSession } from '@/application/NodesSession'
export function NodeEditorDialog({
  session,
  colors,
  event,
  onClose,
}: {
  session: NodesSession
  colors: readonly string[]
  event?: NodeEvent & { date: string }
  onClose: () => void
}) {
  const [localDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [date, setDate] = useState(event?.date ?? localDate),
    [title, setTitle] = useState(event?.title ?? ''),
    [color, setColor] = useState(event?.colorIndex ?? 0),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector('input')?.focus()
    return () => previous?.focus()
  }, [])
  return (
    <div
      className="help-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialog}
        className="node-editor"
        role="dialog"
        aria-modal="true"
        aria-label={event ? '编辑事件' : '添加事件'}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
          if (e.key === 'Tab') {
            const items = [...dialog.current!.querySelectorAll<HTMLElement>('input,button')]
            if (e.shiftKey && document.activeElement === items[0]) {
              e.preventDefault()
              items.at(-1)?.focus()
            } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
              e.preventDefault()
              items[0]?.focus()
            }
          }
        }}
      >
        <h2>{event ? '编辑事件' : '添加事件'}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            try {
              session.edit(date, title, color, event?.id)
              onClose()
            } catch (err) {
              setError(err instanceof Error ? err.message : '无法保存事件')
            }
          }}
        >
          <label>
            日期
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <p>同一天的事件自动归入同一个节点。</p>
          <label>
            时间概述
            <input
              required
              maxLength={36}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <small>{Array.from(title).length}/36 字</small>
          <div className="node-swatches" role="group" aria-label="事件颜色">
            {colors.map((c, i) => (
              <button
                type="button"
                key={i}
                aria-label={`颜色 ${i + 1}`}
                aria-pressed={color === i}
                style={{ background: c }}
                onClick={() => setColor(i)}
              />
            ))}
          </div>
          {error && <p role="alert">{error}</p>}
          {event &&
            (deleting ? (
              <p>
                确认删除此事件？
                <button
                  type="button"
                  onClick={() => {
                    try {
                      session.remove(event.id)
                      onClose()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : '无法删除事件')
                    }
                  }}
                >
                  确认删除
                </button>
              </p>
            ) : (
              <button type="button" onClick={() => setDeleting(true)}>
                删除事件
              </button>
            ))}
          <footer>
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button type="submit">保存事件</button>
          </footer>
        </form>
      </div>
    </div>
  )
}
