import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { flattenNodes } from '@/domain/NodesDocument'
import { snapWheel, wheelPosition, wheelStep, wheelWindow } from '@/application/nodeWheel'

export function NodeWheel({
  events,
  focusedId,
  onFocus,
  onEdit,
  colors,
}: {
  events: ReturnType<typeof flattenNodes>
  focusedId: string | null
  onFocus: (id: string) => void
  onEdit: (id: string) => void
  colors: readonly string[]
}) {
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; start: number; distance: number } | null>(null)
  const swallowClick = useRef(false)
  const lastFocused = useRef<string | null>(null)
  const positionRef = useRef(0)
  const [radius, setRadius] = useState(360)
  const [dragPosition, setDragPosition] = useState(0)
  const [dragging, setDragging] = useState(false)
  const index = Math.max(
    0,
    events.findIndex((event) => event.id === focusedId),
  )
  const position = dragging ? dragPosition : index

  useEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () =>
      setRadius(Math.max(260, Math.min(860, el.clientHeight * 0.92, el.clientWidth * 0.5)))
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [])

  const focus = (value: number) => {
    const next = snapWheel(value, events.length)
    setDragPosition(next)
    positionRef.current = next
    const row = events[next]
    if (row && row.id !== focusedId) onFocus(row.id)
  }

  if (events.length === 0) return null

  return (
    <div
      className="node-wheel"
      ref={root}
      tabIndex={0}
      role="group"
      aria-label="事件轮盘"
      data-dragging={dragging}
      style={{ '--wheel-radius': `${radius}px` } as CSSProperties}
      onKeyDown={(event) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(event.key)) return
        event.preventDefault()
        if (event.key === 'Enter') {
          if (focusedId) onEdit(focusedId)
        } else
          focus(
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? events.length - 1
                : index + (event.key === 'ArrowDown' ? 1 : -1),
          )
      }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('.node-pencil')) return
        drag.current = { y: event.clientY, start: position, distance: 0 }
        swallowClick.current = false
        lastFocused.current = null
        setDragPosition(position)
        positionRef.current = position
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const dy = event.clientY - drag.current.y
        drag.current.distance = Math.abs(dy)
        if (drag.current.distance > 4) {
          swallowClick.current = true
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }
        const next = wheelPosition(drag.current.start, dy, radius, events.length)
        setDragPosition(next)
        positionRef.current = next
        const row = events[snapWheel(next, events.length)]
        if (row && row.id !== focusedId && row.id !== lastFocused.current) {
          lastFocused.current = row.id
          onFocus(row.id)
        }
      }}
      onPointerUp={() => {
        if (!drag.current) return
        const moved = drag.current.distance > 4
        drag.current = null
        setDragging(false)
        focus(positionRef.current)
        if (moved) window.setTimeout(() => (swallowClick.current = false), 0)
      }}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
        focus(index)
      }}
    >
      <div className="node-pointer" aria-hidden="true" style={{ width: Math.max(64, radius - 4) }}>
        <i className="node-pointer-hub" />
        <i className="node-pointer-line" />
        <i className="node-pointer-tip" />
      </div>
      <div className="node-rotor" style={{ transform: `rotate(${-position * wheelStep}deg)` }}>
        {wheelWindow(position, events.length).map((i) => {
          const event = events[i]!
          const date = event.date.replaceAll('-', '.')
          return (
            <div
              key={event.id}
              className="node-wheel-item"
              data-focused={event.id === focusedId}
              style={
                {
                  transform: `rotate(${i * wheelStep}deg) translateX(${radius}px)`,
                  '--event-color': colors[event.colorIndex],
                } as CSSProperties
              }
            >
              <button
                className="node-event-text"
                title={event.title}
                onClick={() => {
                  if (swallowClick.current) {
                    swallowClick.current = false
                    return
                  }
                  onFocus(event.id)
                }}
                onDoubleClick={() => onEdit(event.id)}
              >
                <small>{date}</small>
                <span className="node-separator" aria-hidden="true" />
                <strong>{event.title}</strong>
                <span className="node-separator" aria-hidden="true" />
              </button>
              <button
                className="node-pencil"
                type="button"
                aria-label={`编辑 ${event.title}`}
                onClick={() => onEdit(event.id)}
              >
                ✎
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
