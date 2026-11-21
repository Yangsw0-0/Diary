import { SaveIndicator } from '@/shared/SaveIndicator'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { flattenNodes } from '@/domain/NodesDocument'
import type { NodesSession } from '@/application/NodesSession'
import { NodePalette } from '@/application/NodePalette'
import { NodeEditorDialog } from './NodeEditorDialog'
import { NodeTimeline } from './NodeTimeline'
import { NodeWheel } from './NodeWheel'

const splitKey = 'diary.nodeTimelineHeight.v1'
const MIN_TIMELINE = 120
const MIN_WHEEL = 220

function readHeight(): number {
  try {
    const value = Number(window.localStorage.getItem(splitKey))
    if (Number.isFinite(value) && value > 0) return Math.max(MIN_TIMELINE, Math.min(560, value))
  } catch {
    // Storage can be unavailable; the default keeps the layout usable.
  }
  return 176
}

export function NodesPanel({
  session,
  palette,
  active = true,
}: {
  session: NodesSession
  palette: NodePalette
  active?: boolean
}) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot),
    colors = useSyncExternalStore(palette.subscribe, palette.getSnapshot)
  const [editor, setEditor] = useState<string | null>(null),
    [actionError, setActionError] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const split = useRef<{ y: number; height: number } | null>(null)
  const [timelineHeight, setTimelineHeight] = useState(readHeight)
  const [panelHeight, setPanelHeight] = useState(0)
  useEffect(() => {
    const el = panel.current
    if (!el) return
    setPanelHeight(el.clientHeight)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setPanelHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const maxTimeline = Math.max(
    MIN_TIMELINE,
    Math.min(560, panelHeight ? panelHeight - MIN_WHEEL - 60 : 560),
  )
  useEffect(() => {
    setTimelineHeight((height) => Math.min(height, maxTimeline))
  }, [maxTimeline])
  const applyHeight = (value: number) => {
    const next = Math.max(MIN_TIMELINE, Math.min(maxTimeline, value))
    setTimelineHeight(next)
    try {
      window.localStorage.setItem(splitKey, String(next))
    } catch {
      // The layout still works when storage is unavailable.
    }
  }
  const startSplit = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    split.current = { y: event.clientY, height: timelineHeight }
  }
  const moveSplit = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!split.current) return
    applyHeight(split.current.height + event.clientY - split.current.y)
  }
  const endSplit = () => {
    split.current = null
  }
  useEffect(() => {
    if (!active) return
    void session.ensureLoaded().catch((err) => {
      setActionError(err instanceof Error ? err.message : '无法读取节点')
    })
  }, [active, session])
  const rows = useMemo(() => flattenNodes(snapshot.document), [snapshot.document]),
    event = rows.find((e) => e.id === editor)
  const run = (action: () => Promise<unknown>) => {
    setActionError('')
    void action().catch((err) => setActionError(err instanceof Error ? err.message : '操作失败'))
  }
  const status = snapshot.error
    ? 'error'
    : snapshot.saving
      ? 'saving'
      : snapshot.dirty
        ? 'dirty'
        : 'saved'
  return (
    <div
      ref={panel}
      className="nodes-panel"
      style={{ '--nodes-timeline-height': `${timelineHeight}px` } as CSSProperties}
    >
      <header className="nodes-header">
        <SaveIndicator
          state={status}
          label="保存节点"
          title={`${status === 'saved' ? '已保存' : status === 'dirty' ? '尚未保存' : status === 'saving' ? '正在保存' : '保存失败'} ${snapshot.savedAt ?? ''}，点击手动保存`}
          onSave={() => run(() => session.flush())}
        />
      </header>
      {(snapshot.error || actionError) && (
        <div role="alert" className="nodes-error">
          {snapshot.error || actionError}
          <button
            onClick={() => {
              if (!snapshot.dirty || window.confirm('重新载入会放弃节点草稿，继续？'))
                run(() => session.reload())
            }}
          >
            重新载入
          </button>
          {snapshot.dirty && !snapshot.blocked && (
            <button
              onClick={() => {
                if (window.confirm('覆盖外部的节点文件？')) run(() => session.flush(true))
              }}
            >
              覆盖保存
            </button>
          )}
          {snapshot.blocked && !snapshot.dirty && (
            <button
              onClick={() => {
                if (window.confirm('备份原文件并新建空节点文件？'))
                  run(() => session.backupAndReset())
              }}
            >
              备份损坏文件并新建
            </button>
          )}
        </div>
      )}
      {snapshot.loading ? (
        <p role="status">正在读取节点…</p>
      ) : rows.length ? (
        <>
          <NodeTimeline
            document={snapshot.document}
            focusedId={snapshot.focusedId}
            onFocus={(id) => session.focus(id)}
            colors={colors}
          />
          <div
            className="node-splitter"
            role="separator"
            aria-label="调整时间轴与轮盘高度"
            aria-orientation="horizontal"
            aria-valuemin={MIN_TIMELINE}
            aria-valuemax={maxTimeline}
            aria-valuenow={Math.round(timelineHeight)}
            tabIndex={0}
            onPointerDown={startSplit}
            onPointerMove={moveSplit}
            onPointerUp={endSplit}
            onPointerCancel={endSplit}
            onKeyDown={(event) => {
              const delta =
                event.key === 'ArrowUp'
                  ? -16
                  : event.key === 'ArrowDown'
                    ? 16
                    : event.key === 'Home'
                      ? MIN_TIMELINE - timelineHeight
                      : event.key === 'End'
                        ? maxTimeline - timelineHeight
                        : 0
              if (!delta) return
              event.preventDefault()
              applyHeight(timelineHeight + delta)
            }}
          />
          <NodeWheel
            events={rows}
            focusedId={snapshot.focusedId}
            onFocus={(id) => session.focus(id)}
            onEdit={setEditor}
            colors={colors}
          />
        </>
      ) : (
        <div className="nodes-empty">
          <h2>还没有节点</h2>
          <p>记录第一个值得纪念的时刻</p>
        </div>
      )}
      <button
        className="nodes-add"
        disabled={!snapshot.loaded || snapshot.blocked}
        onClick={() => setEditor('new')}
      >
        ＋ 添加事件
      </button>
      {editor && (
        <NodeEditorDialog
          session={session}
          colors={colors}
          {...(event ? { event } : {})}
          onClose={() => setEditor(null)}
        />
      )}
      <span className="sr-only" role="status">
        {status === 'saved'
          ? '节点已保存'
          : status === 'dirty'
            ? '节点尚未保存'
            : status === 'saving'
              ? '节点正在保存'
              : '节点保存失败'}
      </span>
    </div>
  )
}
