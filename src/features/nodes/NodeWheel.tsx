import { wheelDelta } from '@/shared/wheelDelta'
import { NodeWheelGeometry } from '@/application/NodeWheelGeometry'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const [geometry, setGeometry] = useState(() => new NodeWheelGeometry())
  const radius = geometry.solidRadius
  const [dragPosition, setDragPosition] = useState(0)
  const [dragging, setDragging] = useState(false)
  const index = Math.max(
    0,
    events.findIndex((event) => event.id === focusedId),
  )
  const position = dragging ? dragPosition : index
  const wheelState = useRef({ index, radius, count: events.length, onFocus })
  useLayoutEffect(() => {
    wheelState.current = { index, radius, count: events.length, onFocus }
  }, [index, radius, events.length, onFocus])
  useEffect(() => {
    const el = root.current
    if (!el) return
    let timer = 0,
      wheelActive = false
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || drag.current) return
      const dy = wheelDelta(event, el.clientHeight).y
      if (!dy) return
      event.preventDefault()
      const state = wheelState.current
      const start = wheelActive ? positionRef.current : state.index
      wheelActive = true
      const next = wheelPosition(start, -dy, state.radius, state.count)
      positionRef.current = next
      setDragPosition(next)
      setDragging(true)
      const row = events[snapWheel(next, state.count)]
      if (row && row.id !== events[state.index]?.id) state.onFocus(row.id)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        wheelActive = false
        if (!drag.current) setDragging(false)
      }, 120)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.clearTimeout(timer)
    }
  }, [events])

  const hasEvents = events.length > 0
  useEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () =>
      setGeometry((previous) => {
        const next = new NodeWheelGeometry(el.clientWidth, el.clientHeight)
        return next.solidRadius === previous.solidRadius && next.cardWidth === previous.cardWidth
          ? previous
          : next
      })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [hasEvents])

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
      style={
        {
          '--wheel-radius': radius + 'px',
          '--wheel-card-width': geometry.cardWidth + 'px',
          '--wheel-date-offset': geometry.dateOffset + 'px',
          '--wheel-date-width': geometry.dateWidth + 'px',
          '--wheel-content-offset': geometry.contentOffset + 'px',
          '--wheel-pointer-offset': geometry.pointerOffset + 'px',
          '--wheel-pointer-length': geometry.pointerLength + 'px',
        } as CSSProperties
      }
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
      <svg
        className="node-wheel-tracks"
        aria-hidden="true"
        width={radius * 2 + 4}
        height={radius * 2 + 4}
        viewBox={[-radius - 2, -radius - 2, radius * 2 + 4, radius * 2 + 4].join(' ')}
      >
        <circle className="node-track-solid" r={radius} />
        <circle
          className="node-track-dashed"
          r={geometry.dashedRadius}
          strokeDasharray="3 8"
          strokeDashoffset={geometry.textureOffset(position, geometry.dashedRadius)}
        />
        <circle
          className="node-track-highlight"
          r={radius}
          strokeDasharray={'18 ' + ((2 * Math.PI * radius) / 12 - 18)}
          strokeDashoffset={geometry.textureOffset(position, radius)}
        />
      </svg>
      <div className="node-rotor" style={{ transform: `rotate(${geometry.angle(position)}deg)` }}>
        {wheelWindow(position, events.length).map((i) => {
          const event = events[i]!
          const [year = '', month = '', day = ''] = event.date.split('-')
          return (
            <div
              key={event.id}
              className="node-wheel-item"
              data-focused={event.id === focusedId}
              style={
                {
                  transform: `rotate(${i * wheelStep}deg) translateX(${geometry.cardRadius}px)`,
                  '--event-color': colors[event.colorIndex],
                  '--event-weight': Math.max(0.28, 1 - Math.abs(i - position) * 0.24),
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
                <span className="node-event-date">
                  <b>
                    {month}.{day}
                  </b>
                  <small>{year}</small>
                </span>
                <span className="node-pointer" aria-hidden="true">
                  <i className="node-pointer-hub" />
                  <i className="node-pointer-line" />
                  <i className="node-pointer-tip" />
                </span>
                <strong>{event.title}</strong>
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
