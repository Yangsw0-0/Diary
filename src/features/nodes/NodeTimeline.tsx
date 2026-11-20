import { useEffect, useMemo, useRef, useState } from 'react'
import type { NodesDocument } from '@/domain/NodesDocument'
import { labelLanes, timelinePositions } from '@/application/nodeTimeline'
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
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; left: number; distance: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [elastic, setElastic] = useState(0)
  const [width, setWidth] = useState(800),
    [scroll, setScroll] = useState(0)
  useEffect(() => {
    const el = viewport.current!
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])
  const { positions, lanes } = useMemo(() => {
    const positions = timelinePositions(
      model.nodes.map((n) => n.date),
      width,
    )
    return { positions, lanes: labelLanes(positions) }
  }, [model, width])
  const index = model.nodes.findIndex((n) => n.events.some((e) => e.id === focusedId))
  useEffect(() => {
    if (drag.current || index < 0) return
    viewport.current?.scrollTo({
      left: Math.max(0, positions[index]! - width / 2),
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }, [index, positions, width])
  return (
    <div
      ref={viewport}
      className="node-timeline"
      onDragStart={(e) => e.preventDefault()}
      aria-label="节点时间轴"
      onScroll={(e) => setScroll(e.currentTarget.scrollLeft)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        setDragging(true)
        drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, distance: 0 }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (drag.current) {
          drag.current.distance = Math.abs(e.clientX - drag.current.x)
          const raw = drag.current.left + drag.current.x - e.clientX
          const max = Math.max(0, e.currentTarget.scrollWidth - e.currentTarget.clientWidth)
          e.currentTarget.scrollLeft = Math.max(0, Math.min(max, raw))
          setElastic(
            raw < 0 ? Math.min(40, -raw * 0.2) : raw > max ? -Math.min(40, (raw - max) * 0.2) : 0,
          )
        }
      }}
      onPointerUp={() => {
        setDragging(false)
        drag.current = null
        setElastic(0)
      }}
      onPointerCancel={() => {
        setDragging(false)
        drag.current = null
        setElastic(0)
      }}
    >
      <div
        className="node-timeline-inner"
        style={{
          width: Math.max(width, (positions.at(-1) ?? 0) + 100),
          transform: `translateX(${elastic}px)`,
          transition: dragging ? 'none' : 'transform 240ms ease-out',
        }}
      >
        <div className="node-axis" />
        {model.nodes.map((node, i) => {
          const x = positions[i]!,
            lane = lanes[i]!
          if (x < scroll - 200 || x > scroll + width + 200) return null
          const event = node.events.find((e) => e.id === focusedId) ?? node.events[0]!
          const title = node.events.map((e) => e.title).join(' · ')
          return (
            <button
              key={node.id}
              className="node-time-point"
              aria-current={i === index ? 'true' : undefined}
              title={`${node.date} ${title}`}
              onClick={() => onFocus(event.id)}
              style={{ left: x, color: colors[event.colorIndex] }}
            >
              <i />
              <span
                className="node-time-label"
                style={{
                  width: lane.width,
                  transform: `translate(-50%, ${lane.side < 0 ? -(30 + lane.lane * 20) : 22 + lane.lane * 20}px)`,
                }}
              >
                <small>{node.date.replaceAll('-', '.')}</small>
                <strong>{title}</strong>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
