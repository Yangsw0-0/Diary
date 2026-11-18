import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EditorAdapter } from '@/application/EditorAdapter'
import type { DiaryDate } from '@/domain/DiaryDate'

interface Props {
  readonly markdown: string
  readonly onChange: (markdown: string) => void
  readonly onComposing: (value: boolean) => void
  readonly readOnly: boolean
  readonly createAdapter: () => EditorAdapter
  readonly focusRequest: {
    readonly date: DiaryDate
    readonly key: string
    readonly ordinal: number
    readonly id: number
    readonly restoreScroll?: boolean
  } | null
  readonly onMissingSection: () => void
  readonly onReady: () => void
  readonly insertRequest?: { readonly id: number; readonly markdown: string } | null
  readonly onInserted?: (id: number) => void
  readonly onFiles?: (files: readonly File[]) => void
  readonly onOpenLink?: (url: string) => void
  readonly onInsertError?: (message: string) => void
  readonly onRequestAttachment?: () => void
}

export function CrepeEditor({
  markdown,
  onChange,
  onComposing,
  readOnly,
  createAdapter,
  focusRequest,
  onMissingSection,
  onReady,
  insertRequest,
  onInserted,
  onFiles,
  onOpenLink,
  onInsertError,
  onRequestAttachment,
}: Props) {
  const root = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onComposingRef = useRef(onComposing)
  const adapterRef = useRef<EditorAdapter | null>(null)
  const readOnlyRef = useRef(readOnly)
  const focusRef = useRef(focusRequest)
  const missingRef = useRef(onMissingSection)
  const readyRef = useRef(onReady)
  const lastFocusId = useRef<number | null>(null)
  const lastInsertId = useRef<number | null>(null)
  const insertRef = useRef(insertRequest)
  const insertErrorRef = useRef(onInsertError)
  const insertedRef = useRef(onInserted)
  const [error, setError] = useState<string | null>(null)
  const [insertMenu, setInsertMenu] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!insertMenu) return
    const close = () => setInsertMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [insertMenu])
  onChangeRef.current = onChange
  onComposingRef.current = onComposing
  readOnlyRef.current = readOnly
  focusRef.current = focusRequest
  missingRef.current = onMissingSection
  readyRef.current = onReady
  insertRef.current = insertRequest
  insertErrorRef.current = onInsertError
  insertedRef.current = onInserted

  const insertIfNeeded = (adapter: EditorAdapter, request = insertRef.current) => {
    if (!request || lastInsertId.current === request.id) return
    try {
      adapter.insertMarkdown(request.markdown)
      lastInsertId.current = request.id
      insertedRef.current?.(request.id)
    } catch (reason) {
      insertErrorRef.current?.(reason instanceof Error ? reason.message : '无法插入附件链接')
    }
  }
  const insertFromMenu = (markdown: string) => {
    setInsertMenu(null)
    try {
      adapterRef.current?.insertMarkdown(markdown)
    } catch (reason) {
      onInsertError?.(reason instanceof Error ? reason.message : '无法插入内容')
    }
  }

  // This editor is intentionally uncontrolled. DiaryDetail changes its key when
  // a disk reload replaces markdown, creating a fresh editor and undo history.
  useEffect(() => {
    const adapter = createAdapter()
    let disposed = false
    if (root.current) {
      void adapter
        .mount(root.current, markdown, (next) => {
          if (!disposed) onChangeRef.current(next)
        })
        .then(
          () => {
            if (disposed) void adapter.destroy()
            else {
              adapterRef.current = adapter
              adapter.setReadonly(readOnlyRef.current)
              insertIfNeeded(adapter)
              const request = focusRef.current
              if (request) {
                lastFocusId.current = request.id
                if (!adapter.focusSection(request.key, request.ordinal)) missingRef.current()
                else if (request.restoreScroll) readyRef.current()
              } else readyRef.current()
            }
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

  useEffect(() => {
    const adapter = adapterRef.current
    if (!adapter || !focusRequest || lastFocusId.current === focusRequest.id) return
    lastFocusId.current = focusRequest.id
    if (!adapter.focusSection(focusRequest.key, focusRequest.ordinal)) onMissingSection()
    else if (focusRequest.restoreScroll) onReady()
  }, [focusRequest, onMissingSection, onReady])

  useEffect(() => {
    if (adapterRef.current) insertIfNeeded(adapterRef.current, insertRequest)
  }, [insertRequest])

  return (
    <div
      className="diary-crepe-container"
      aria-busy={readOnly}
      onCompositionStart={() => onComposingRef.current(true)}
      onCompositionEnd={() => onComposingRef.current(false)}
      onPasteCapture={(event) => {
        const images = [...event.clipboardData.files].filter((file) =>
          file.type.startsWith('image/'),
        )
        if (images.length) {
          event.preventDefault()
          onFiles?.(images)
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
      onDropCapture={(event) => {
        const files = [...event.dataTransfer.files]
        if (files.length) {
          event.preventDefault()
          onFiles?.(files)
        }
      }}
      onClickCapture={(event) => {
        const target = event.target
        const anchor = target instanceof Element ? target.closest('a[href]') : null
        const url = anchor?.getAttribute('href')
        if (url?.startsWith('../assets/')) {
          event.preventDefault()
          onOpenLink?.(url)
        }
      }}
      onContextMenuCapture={(event) => {
        if (readOnly || !(event.target instanceof Element && event.target.closest('.ProseMirror')))
          return
        event.preventDefault()
        if (!adapterRef.current?.placeCursorAt(event.clientX, event.clientY)) {
          onInsertError?.('编辑器尚未启动')
          return
        }
        setInsertMenu({
          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 210)),
          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 210)),
        })
      }}
    >
      {error && (
        <p role="alert" className="workspace-error">
          编辑器加载失败：{error}
        </p>
      )}
      <div className="diary-crepe-root" ref={root} aria-label="日记编辑器" />
      {insertMenu &&
        createPortal(
          <div
            className="diary-insert-menu"
            role="menu"
            aria-label="插入插件"
            style={{ left: insertMenu.x, top: insertMenu.y }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <strong>插入插件</strong>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setInsertMenu(null)
                onRequestAttachment?.()
              }}
            >
              图片或附件…
            </button>
            <button type="button" role="menuitem" onClick={() => insertFromMenu('\n\n---\n\n')}>
              分隔线
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => insertFromMenu('\n\n```\n\n```\n\n')}
            >
              代码块
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                insertFromMenu('\n\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n\n')
              }
            >
              表格
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
