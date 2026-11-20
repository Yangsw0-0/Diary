import { useEffect, useRef, useState } from 'react'
import type { flattenNodes } from '@/domain/NodesDocument'
import { snapWheel, wheelPosition, wheelStep, wheelWindow } from '@/application/nodeWheel'
export function NodeWheel({
  events,
  focusedId,
  onFocus,
  onEdit,
  onColor,
  colors,
}: {
  events: ReturnType<typeof flattenNodes>
  focusedId: string | null
  onFocus: (id: string) => void
  onEdit: (id: string) => void
  onColor: (id: string, color: number) => void
  colors: readonly string[]
}) {
  const moved = useRef(false)
  const root = useRef<HTMLDivElement>(null),
    drag = useRef<{ y: number; start: number; distance: number } | null>(null)
  const [radius, setRadius] = useState(360),
    [dragPosition, setPosition] = useState(0),
    [dragging, setDragging] = useState(false)
  const index = Math.max(
    0,
    events.findIndex((e) => e.id === focusedId),
  )
  const position = dragging ? dragPosition : index
  useEffect(() => {
    const el = root.current!
    const observer = new ResizeObserver(() =>
      setRadius(Math.max(120, Math.min(860, el.clientHeight * 0.92, el.clientWidth * 0.48))),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const focus = (value: number) => {
    const i = snapWheel(value, events.length)
    setPosition(i)
    if (events[i]) onFocus(events[i].id)
  }
  return (
    <div
      className="node-wheel"
      ref={root}
      tabIndex={0}
      role="group"
      aria-label="事件轮盘"
      data-dragging={dragging}
      onKeyDown={(e) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(e.key)) return
        e.preventDefault()
        if (e.key === 'Enter') {
          if (focusedId) onEdit(focusedId)
        } else
          focus(
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? events.length - 1
                : index + (e.key === 'ArrowDown' ? 1 : -1),
          )
      }}
      onClickCapture={(e) => {
        if (moved.current) {
          e.stopPropagation()
          e.preventDefault()
          moved.current = false
        }
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.node-swatches, .node-pencil')) return
        drag.current = { y: e.clientY, start: position, distance: 0 }
        moved.current = false
        setDragging(true)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dy = e.clientY - drag.current.y
        drag.current.distance = Math.abs(dy)
        if (Math.abs(dy) > 4) {
          moved.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
        }
        const next = wheelPosition(drag.current.start, dy, radius, events.length)
        setPosition(next)
        const row = events[snapWheel(next, events.length)]
        if (row) onFocus(row.id)
      }}
      onPointerUp={() => {
        drag.current = null
        setDragging(false)
        focus(position)
      }}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
        focus(index)
      }}
    >
      <div className="node-pointer" aria-hidden="true">
        ◉ ▷
      </div>
      <div className="node-rotor" style={{ transform: `rotate(${-position * wheelStep}deg)` }}>
        {wheelWindow(position, events.length).map((i) => {
          const event = events[i]!
          return (
            <div
              key={event.id}
              className="node-wheel-item"
              data-focused={event.id === focusedId}
              style={
                {
                  transform: `rotate(${i * wheelStep}deg) translateX(${radius}px)`,
                  '--event-color': colors[event.colorIndex],
                } as React.CSSProperties
              }
            >
              <button
                className="node-event-text"
                title={event.title}
                onClick={() => {
                  if (!drag.current || drag.current.distance < 5) onFocus(event.id)
                }}
                onDoubleClick={() => onEdit(event.id)}
              >
                <small>{event.date.replaceAll('-', '.')}</small>
                <strong>{event.title}</strong>
              </button>
              <button
                className="node-pencil"
                aria-label={`编辑 ${event.title}`}
                onClick={() => onEdit(event.id)}
              >
                ✎
              </button>
              <div className="node-swatches">
                {colors.map((color, n) => (
                  <button
                    key={n}
                    style={{ background: color }}
                    aria-label={`${event.title} 颜色 ${n + 1}`}
                    aria-pressed={event.colorIndex === n}
                    onClick={() => onColor(event.id, n)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
