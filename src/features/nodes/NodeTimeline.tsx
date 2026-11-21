import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NodesDocument } from '@/domain/NodesDocument'
import { readableInk } from '@/application/NodePalette'
import {
  labelLayout,
  nearestNodeIndex,
  timelinePositions,
  timelineWidth,
} from '@/application/nodeTimeline'

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function NodeTimeline({
  document: model,
  focusedId,
  onFocus,
  colors,
}: {
  document: NodesDocument
  focusedId: string | null
  onFocus: (id: string) => void
  colors: readonly string[]
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number; distance: number } | null>(null)
  const suppressCenter = useRef(0)
  const wheelAt = useRef(0)
  const wheelTimer = useRef(0)
  const frame = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [elastic, setElastic] = useState(0)
  const [width, setWidth] = useState(800)
  const [scroll, setScroll] = useState(0)

  useEffect(() => {
    const el = viewport.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => window.clearTimeout(wheelTimer.current), [])

  const { positions, labels } = useMemo(() => {
    const positions = timelinePositions(
      model.nodes.map((node) => node.date),
      width,
    )
    return { positions, labels: labelLayout(positions) }
  }, [model, width])

  const index = model.nodes.findIndex((node) => node.events.some((event) => event.id === focusedId))
  const ink = (color: string) =>
    readableInk(color, document.documentElement.classList.contains('dark') ? '#141414' : '#ffffff')
  const axisLeft = Math.max(14, (positions[0] ?? 0) - 150)
  const continueX = (positions.at(-1) ?? 0) + 56
  const axisEnd = Math.max(axisLeft, continueX)
  const innerWidth = Math.max(timelineWidth(positions, width), continueX + 190)

  useEffect(() => {
    const el = viewport.current
    if (!el || drag.current || index < 0 || Date.now() < suppressCenter.current) return
    const left = Math.max(0, positions[index]! - el.clientWidth / 2)
    if (Math.abs(el.scrollLeft - left) < 2) return
    el.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [index, positions])

  const focusIndex = (next: number) => {
    const node = model.nodes[next]
    if (!node) return
    const event = node.events.find((item) => item.id === focusedId) ?? node.events[0]
    if (!event) return
    suppressCenter.current = Date.now() + 400
    if (event.id !== focusedId) onFocus(event.id)
  }

  const centre = (left: number) => {
    const el = viewport.current
    if (!el) return
    el.scrollTo({
      left: Math.max(0, left - el.clientWidth / 2),
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
  }

  const settle = () => {
    const el = viewport.current
    if (!el) return
    const next = nearestNodeIndex(el.scrollLeft, positions, el.clientWidth)
    if (next < 0) return
    focusIndex(next)
    centre(positions[next]!)
  }

  return (
    <div
      ref={viewport}
      className="node-timeline"
      aria-label="节点时间轴"
      data-dragging={dragging}
      onDragStart={(event) => event.preventDefault()}
      onScroll={(event) => {
        const el = event.currentTarget
        const left = el.scrollLeft
        if (!frame.current)
          frame.current = requestAnimationFrame(() => {
            frame.current = 0
            setScroll(left)
          })
        if (drag.current || Date.now() - wheelAt.current < 260)
          focusIndex(nearestNodeIndex(left, positions, el.clientWidth))
      }}
      onWheel={() => {
        wheelAt.current = Date.now()
        window.clearTimeout(wheelTimer.current)
        wheelTimer.current = window.setTimeout(() => {
          if (!drag.current) settle()
        }, 280)
      }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        setDragging(true)
        drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, distance: 0 }
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        drag.current.distance = Math.abs(event.clientX - drag.current.x)
        const raw = drag.current.left + drag.current.x - event.clientX
        const max = Math.max(0, event.currentTarget.scrollWidth - event.currentTarget.clientWidth)
        event.currentTarget.scrollLeft = Math.max(0, Math.min(max, raw))
        setElastic(
          raw < 0 ? Math.min(40, -raw * 0.2) : raw > max ? -Math.min(40, (raw - max) * 0.2) : 0,
        )
      }}
      onPointerUp={() => {
        if (!drag.current) return
        drag.current = null
        setDragging(false)
        setElastic(0)
        settle()
      }}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
        setElastic(0)
      }}
    >
      <div
        className="node-timeline-inner"
        style={{
          width: innerWidth,
          transform: `translateX(${elastic}px)`,
          transition: dragging ? 'none' : 'transform 240ms ease-out',
        }}
      >
        {positions.length > 0 && (
          <>
            <div className="node-axis" style={{ left: axisLeft, width: axisEnd - axisLeft }} />
            <div className="node-origin" style={{ left: axisLeft }}>
              <i />
            </div>
            <div className="node-continue" style={{ left: continueX }}>
              <i />
              <span>to be continue…</span>
            </div>
          </>
        )}
        {model.nodes.map((node, i) => {
          const x = positions[i]!
          if (x < scroll - 280 || x > scroll + width + 280) return null
          const label = labels[i]!
          const event = node.events.find((item) => item.id === focusedId) ?? node.events[0]
          if (!event) return null
          const title = node.events.map((item) => item.title).join(' · ')
          const date = node.date.replaceAll('-', '.')
          const color = colors[event.colorIndex]!
          const readable = ink(color) === color ? color : undefined
          return (
            <button
              key={node.id}
              className="node-time-point"
              aria-current={i === index ? 'true' : undefined}
              aria-label={`${date} ${title}`}
              title={`${date} ${title}`}
              onClick={() => onFocus(event.id)}
              style={{ left: x, '--event-color': color } as CSSProperties}
            >
              <i className="node-dot" />
              <i
                className="node-leader node-leader-event"
                data-side={label.event.side}
                style={
                  {
                    '--offset': `${label.event.offset}px`,
                    color,
                  } as CSSProperties
                }
                aria-hidden="true"
              />
              <span
                className="node-date-label"
                data-side={label.date.side}
                style={
                  {
                    width: label.date.width,
                    '--offset': `${label.date.offset}px`,
                  } as CSSProperties
                }
              >
                {date}
              </span>
              <span
                className="node-event-label"
                data-side={label.event.side}
                style={
                  {
                    width: label.event.width,
                    '--offset': `${label.event.offset}px`,
                    color: readable,
                  } as CSSProperties
                }
              >
                {title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
