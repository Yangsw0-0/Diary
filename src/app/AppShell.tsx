import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ArrowLeft, ArrowRight, PanelLeftClose, PanelLeftOpen, Settings2 } from 'lucide-react'
import type { DiarySession } from '@/application/DiarySession'
import { NavigationContext } from '@/shared/NavigationContext'
import { useAppNavigation } from './useAppNavigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ModuleCatalog } from './moduleRegistry'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { ViewControls } from './ViewControls'
import {
  AdjacentDiaryNavigator,
  type AdjacentDirection,
} from '@/application/AdjacentDiaryNavigator'
import Markdown from 'react-markdown'
import { flushSync } from 'react-dom'
import type { AppearanceValues } from '@/application/AppearancePreferences'
import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const MIN_LIST_WIDTH = 168
const MAX_LIST_WIDTH = 420
const MIN_DETAIL_WIDTH = 300

interface AppShellProps {
  readonly registry: ModuleCatalog
  readonly session: DiarySession
  readonly root?: string
  readonly onChooseRoot?: () => void
  readonly choosingRoot?: boolean
  readonly workspaceIssue?: string | null
  readonly initialSidebarWidth?: number | null
  readonly initialSidebarCollapsed?: boolean
  readonly onSavePreferences?: (width: number | null, collapsed: boolean) => Promise<void>
  readonly theme?: 'light' | 'dark'
  readonly onSaveTheme?: (theme: 'light' | 'dark') => Promise<void>
  readonly accentColor?: string
  readonly onSaveAccentColor?: (value: string) => void
  readonly appearance?: AppearanceValues
  readonly onSaveAppearance?: (value: Partial<AppearanceValues>) => void
}

export function AppShell({
  registry,
  session,
  root,
  onChooseRoot,
  choosingRoot,
  workspaceIssue,
  initialSidebarWidth = null,
  initialSidebarCollapsed = false,
  onSavePreferences,
  theme = 'light',
  onSaveTheme,
  accentColor,
  onSaveAccentColor,
  appearance,
  onSaveAppearance,
}: AppShellProps) {
  const [sidebarWidth, setSidebarWidth] = useState(
    initialSidebarWidth != null && initialSidebarWidth >= 172 && initialSidebarWidth <= 500
      ? initialSidebarWidth
      : null,
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [listWidth, setListWidth] = useState(250)
  const [resizingList, setResizingList] = useState(false)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [zoomByModule, setZoomByModule] = useState<Record<string, number>>({
    diary: 100,
    tags: 100,
  })
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const adjacentGesture = useRef(new AdjacentDiaryNavigator())
  const [adjacentPreview, setAdjacentPreview] = useState<{
    direction: 'older' | 'newer'
    date: string
    markdown: string
  } | null>(null)
  const [, setAdjacentBusy] = useState(false)
  const adjacentBusyRef = useRef(false)
  const [boundaryNotice, setBoundaryNotice] = useState<string | null>(null)
  const trackElement = useRef<HTMLDivElement>(null)
  const previewElement = useRef<HTMLDivElement>(null)
  const previewIdentity = useRef<string | null>(null)
  const trackOffset = useRef(0)
  const cancelTrackAnimation = useRef<(() => void) | null>(null)
  const gestureBaseOffset = useRef(0)
  const gestureDirection = useRef<AdjacentDirection | null>(null)
  const lastWheelAt = useRef(0)
  const gestureEpoch = useRef(0)
  const diaryContentElement = useRef<HTMLElement | null>(null)
  const wheelHandler = useRef<(element: HTMLElement, event: WheelEvent) => void>(() => {})
  const gestureIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unlockIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nativeGestureActive = useRef(false)
  const nativeMomentum = useRef(false)
  const pendingAdjacent = useRef<{
    target: (typeof sessionSnapshot.entries)[number]
    direction: AdjacentDirection
  } | null>(null)
  const phaseHandler = useRef<(phase: string) => void>(() => {})
  useEffect(() => {
    if (!isTauri() || !('__TAURI_INTERNALS__' in window)) return
    let cancelled = false
    let stop: (() => void) | undefined
    void listen<string>('diary-scroll-phase', (event) => phaseHandler.current(event.payload)).then(
      (unlisten) => {
        if (cancelled) unlisten()
        else stop = unlisten
      },
    )
    return () => {
      cancelled = true
      stop?.()
    }
  }, [])
  useEffect(
    () => () => {
      if (gestureIdle.current) clearTimeout(gestureIdle.current)
      if (unlockIdle.current) clearTimeout(unlockIdle.current)
      cancelTrackAnimation.current?.()
    },
    [],
  )
  useLayoutEffect(() => {
    if (adjacentPreview && previewElement.current)
      previewElement.current.scrollTop =
        adjacentPreview.direction === 'newer' ? previewElement.current.scrollHeight : 0
  }, [adjacentPreview])
  const resizeCleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => resizeCleanup.current?.(), [])
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const visibleSidebarWidth = Math.round(
    Math.max(172, Math.min(sidebarWidth ?? viewportWidth * 0.25, viewportWidth / 3)),
  )
  const maxListWidth = Math.min(
    MAX_LIST_WIDTH,
    Math.max(
      MIN_LIST_WIDTH,
      viewportWidth - (sidebarCollapsed ? 0 : visibleSidebarWidth) - MIN_DETAIL_WIDTH,
    ),
  )
  const visibleListWidth = Math.min(listWidth, maxListWidth)
  const hideBlockControls = () => {
    diaryContentElement.current
      ?.querySelectorAll<HTMLElement>('.milkdown-block-handle')
      .forEach((handle) => handle.setAttribute('data-show', 'false'))
  }
  useEffect(() => {
    diaryContentElement.current
      ?.querySelectorAll<HTMLElement>('.milkdown-block-handle')
      .forEach((handle) => handle.setAttribute('data-show', 'false'))
  }, [appearance?.lineHeight, appearance?.letterSpacing])
  const sessionSnapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const saveSidebar = (width: number | null, collapsed: boolean) => {
    void onSavePreferences?.(width, collapsed).catch((reason: unknown) =>
      setSidebarError(reason instanceof Error ? reason.message : '无法保存侧栏设置'),
    )
  }
  const toggleSidebar = () => {
    const collapsed = !sidebarCollapsed
    setSidebarCollapsed(collapsed)
    setSidebarPeek(false)
    saveSidebar(sidebarWidth, collapsed)
  }
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sidebarCollapsed || event.button !== 0) return
    event.preventDefault()
    hideBlockControls()
    resizeCleanup.current?.()
    setResizingList(false)
    const move = (pointer: PointerEvent) => {
      setSidebarWidth(Math.round(Math.max(172, Math.min(pointer.clientX, window.innerWidth / 3))))
    }
    const stop = (pointer: PointerEvent) => {
      const width = Math.round(Math.max(172, Math.min(pointer.clientX, window.innerWidth / 3)))
      setSidebarWidth(width)
      saveSidebar(width, false)
      resizeCleanup.current?.()
    }
    const cancel = () => resizeCleanup.current?.()
    resizeCleanup.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      resizeCleanup.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
  }
  const { navigation, navigating, registerContent, updateScroll, waitForDiaryReady } =
    useAppNavigation(session)
  const activeId = navigation.view.moduleId
  const activeModule = registry.require(activeId)
  const showViewControls =
    !settingsOpen && (activeId === 'tags' || (activeId === 'diary' && !!sessionSnapshot.selected))
  const setTrackOffset = (pixels: number) => {
    const height = diaryContentElement.current?.clientHeight || window.innerHeight
    trackOffset.current = Math.max(-height, Math.min(height, pixels))
    if (trackElement.current)
      trackElement.current.style.transform = `translate3d(0, ${trackOffset.current}px, 0)`
  }
  const animateTrack = (destination: number, duration = 280): Promise<boolean> => {
    cancelTrackAnimation.current?.()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || duration === 0) {
      setTrackOffset(destination)
      return Promise.resolve(true)
    }
    const from = trackOffset.current
    return new Promise((resolve) => {
      const started = performance.now()
      let frame = 0
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - started) / duration))
        const eased = 1 - (1 - t) ** 4
        setTrackOffset(from + (destination - from) * eased)
        if (t < 1) frame = window.requestAnimationFrame(tick)
        else {
          cancelTrackAnimation.current = null
          resolve(true)
        }
      }
      cancelTrackAnimation.current = () => {
        window.cancelAnimationFrame(frame)
        cancelTrackAnimation.current = null
        resolve(false)
      }
      frame = window.requestAnimationFrame(tick)
    })
  }
  const clearPreview = () => {
    previewIdentity.current = null
    pendingAdjacent.current = null
    setAdjacentPreview(null)
  }
  const reboundAdjacent = () => {
    adjacentGesture.current.reset()
    void animateTrack(0, 300).then((finished) => {
      if (finished) clearPreview()
    })
  }
  const scheduleUnlock = () => {
    if (unlockIdle.current) clearTimeout(unlockIdle.current)
    if (adjacentBusyRef.current) return
    unlockIdle.current = setTimeout(() => {
      if (
        !adjacentBusyRef.current &&
        Date.now() - lastWheelAt.current >= AdjacentDiaryNavigator.idleGapMs
      )
        adjacentGesture.current.unlock()
      else scheduleUnlock()
    }, AdjacentDiaryNavigator.idleGapMs)
  }
  const commitAdjacent = (
    target: (typeof sessionSnapshot.entries)[number],
    direction: AdjacentDirection,
  ) => {
    adjacentGesture.current.lock()
    adjacentBusyRef.current = true
    setAdjacentBusy(true)
    const epoch = ++gestureEpoch.current
    const height = diaryContentElement.current?.clientHeight || window.innerHeight
    const destination = direction === 'older' ? -height : height
    void (async () => {
      try {
        const finished = await animateTrack(
          destination,
          Math.abs(trackOffset.current - destination) < 1 ? 0 : 300,
        )
        if (!finished || epoch !== gestureEpoch.current) return
        let opened = false
        try {
          opened = await navigation.openDiary(target.date, direction === 'newer' ? 'end' : 'start')
        } catch {
          // The navigation layer reports the read/save error through its existing notice.
        }
        if (epoch !== gestureEpoch.current) return
        if (opened) {
          if (isTauri() && '__TAURI_INTERNALS__' in window) await waitForDiaryReady(target.date)
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
          setTrackOffset(0)
          clearPreview()
        } else if (await animateTrack(0, 300)) clearPreview()
      } finally {
        if (epoch === gestureEpoch.current) {
          adjacentBusyRef.current = false
          setAdjacentBusy(false)
          scheduleUnlock()
        }
      }
    })()
  }
  const releaseAdjacent = () => {
    const pending = pendingAdjacent.current
    const decision = adjacentGesture.current.release()
    if (decision === 'commit' && pending) commitAdjacent(pending.target, pending.direction)
    else if (decision === 'rebound') reboundAdjacent()
  }
  useLayoutEffect(() => {
    phaseHandler.current = (phase) => {
      if (phase === 'began') {
        nativeGestureActive.current = true
        nativeMomentum.current = false
        if (gestureIdle.current) clearTimeout(gestureIdle.current)
      } else if (phase === 'ended' || phase === 'cancelled') {
        const active = nativeGestureActive.current
        nativeGestureActive.current = false
        if (!active) return
        nativeMomentum.current = !!pendingAdjacent.current || trackOffset.current !== 0
        if (gestureIdle.current) clearTimeout(gestureIdle.current)
        if (phase === 'ended') releaseAdjacent()
        else reboundAdjacent()
      } else if (phase === 'mouse') {
        nativeMomentum.current = false
      }
    }
  })
  const onAdjacentWheel = (element: HTMLElement, event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) return
    if (nativeMomentum.current) {
      event.preventDefault()
      return
    }
    const now = Date.now()
    if (adjacentGesture.current.isLocked || adjacentBusyRef.current) {
      event.preventDefault()
      lastWheelAt.current = now
      scheduleUnlock()
      return
    }
    if (sessionSnapshot.opening || settingsOpen || activeId !== 'diary') return
    const selected = sessionSnapshot.selected
    if (!selected) return
    const index = sessionSnapshot.entries.findIndex((entry) => entry.date.equals(selected.date))
    if (index < 0) return
    const atTop = element.scrollTop <= 2
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 3
    const direction = event.deltaY > 0 ? 'older' : 'newer'
    if (
      (!nativeGestureActive.current &&
        now - lastWheelAt.current > AdjacentDiaryNavigator.idleGapMs) ||
      gestureDirection.current !== direction
    ) {
      cancelTrackAnimation.current?.()
      gestureBaseOffset.current = trackOffset.current
      gestureDirection.current = direction
    }
    lastWheelAt.current = now
    const gesture = adjacentGesture.current.add(
      event.deltaY,
      event.deltaMode,
      atTop,
      atBottom,
      element.clientHeight,
      now,
      nativeGestureActive.current,
    )
    if (gestureIdle.current) clearTimeout(gestureIdle.current)
    if (!gesture) {
      adjacentGesture.current.reset()
      if (trackOffset.current !== 0)
        void animateTrack(0, 300).then((finished) => {
          if (finished) clearPreview()
        })
      return
    }
    const target = sessionSnapshot.entries[index + (gesture.direction === 'older' ? 1 : -1)]
    event.preventDefault()
    const height = element.clientHeight || window.innerHeight
    const signed = gesture.direction === 'older' ? -1 : 1
    if (!target) {
      setBoundaryNotice(gesture.direction === 'older' ? '已经是最早的日记' : '已经是最新的日记')
      setTrackOffset(signed * Math.min(Math.abs(gesture.offset), 72))
      if (!nativeGestureActive.current)
        gestureIdle.current = setTimeout(reboundAdjacent, AdjacentDiaryNavigator.idleGapMs)
      return
    }
    pendingAdjacent.current = { target, direction: gesture.direction }
    if (boundaryNotice) setBoundaryNotice(null)
    const identity = gesture.direction + ':' + target.date.toString()
    if (previewIdentity.current !== identity) {
      previewIdentity.current = identity
      flushSync(() => {
        setAdjacentPreview({
          direction: gesture.direction,
          date: target.date.toString(),
          markdown: target.markdown,
        })
      })
    }
    const amount = gestureBaseOffset.current + gesture.offset
    setTrackOffset(
      gesture.phase === 'complete'
        ? signed * height
        : Math.max(-height + 1, Math.min(height - 1, amount)),
    )
    if (gesture.phase === 'complete') {
      commitAdjacent(target, gesture.direction)
      return
    }
    if (!nativeGestureActive.current)
      gestureIdle.current = setTimeout(releaseAdjacent, AdjacentDiaryNavigator.idleGapMs)
  }
  useLayoutEffect(() => {
    wheelHandler.current = onAdjacentWheel
  })
  const abortAdjacent = () => {
    if (!adjacentBusyRef.current && trackOffset.current === 0 && !previewIdentity.current) return
    gestureEpoch.current += 1
    if (gestureIdle.current) clearTimeout(gestureIdle.current)
    if (unlockIdle.current) clearTimeout(unlockIdle.current)
    cancelTrackAnimation.current?.()
    adjacentGesture.current.reset()
    nativeGestureActive.current = false
    nativeMomentum.current = false
    adjacentBusyRef.current = false
    setAdjacentBusy(false)
    void animateTrack(0, 280).then((finished) => {
      if (finished) clearPreview()
    })
  }
  const abortAdjacentRef = useRef(abortAdjacent)
  useLayoutEffect(() => {
    abortAdjacentRef.current = abortAdjacent
  })
  useEffect(() => {
    if (settingsOpen || activeId !== 'diary') abortAdjacentRef.current()
  }, [settingsOpen, activeId])
  useEffect(() => {
    const abort = () => abortAdjacentRef.current()
    window.addEventListener('resize', abort)
    return () => window.removeEventListener('resize', abort)
  }, [])
  useEffect(() => {
    const element = diaryContentElement.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => wheelHandler.current(element, event)
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])
  const setZoomClamped = (moduleId: string, value: number) => {
    hideBlockControls()
    setZoomByModule((current) => ({
      ...current,
      [moduleId]: Math.max(50, Math.min(150, value)),
    }))
  }
  const startListResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    hideBlockControls()
    resizeCleanup.current?.()
    setResizingList(true)
    const move = (pointer: PointerEvent) =>
      setListWidth(
        Math.round(
          Math.max(
            MIN_LIST_WIDTH,
            Math.min(maxListWidth, pointer.clientX - (sidebarCollapsed ? 0 : visibleSidebarWidth)),
          ),
        ),
      )
    const stop = (pointer: PointerEvent) => {
      move(pointer)
      setResizingList(false)
      resizeCleanup.current?.()
    }
    const cancel = () => {
      setResizingList(false)
      resizeCleanup.current?.()
    }
    resizeCleanup.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      resizeCleanup.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
  }

  return (
    <NavigationContext.Provider value={navigation}>
      <div
        className="app-shell"
        data-sidebar-collapsed={sidebarCollapsed}
        data-sidebar-peek={sidebarPeek}
        data-detail-expanded={detailExpanded && showViewControls}
        style={
          {
            '--sidebar-expanded-width': `${visibleSidebarWidth}px`,
            '--sidebar-layout-width':
              sidebarCollapsed || (detailExpanded && showViewControls)
                ? '0px'
                : `${visibleSidebarWidth}px`,
            '--list-width': `${visibleListWidth}px`,
          } as CSSProperties
        }
      >
        {sidebarCollapsed && (
          <button
            className="sidebar-peek-trigger"
            aria-label="显示侧栏"
            onMouseEnter={() => setSidebarPeek(true)}
            onFocus={() => setSidebarPeek(true)}
          />
        )}
        <aside
          className="feature-sidebar"
          aria-label="功能导航"
          onMouseLeave={() => {
            if (sidebarCollapsed) setSidebarPeek(false)
          }}
        >
          <div className="brand">
            <img className="brand-mark" src="/diary-logo.png" alt="" aria-hidden="true" />
            <div>
              <strong>Diary</strong>
              <span>写给自己的时间</span>
            </div>
          </div>
          <Separator />
          <nav className="feature-nav" aria-label="页面">
            {registry.list().map((module) => {
              const Icon = module.Icon
              return (
                <Button
                  key={module.id}
                  variant="ghost"
                  className="feature-nav-button"
                  aria-current={activeId === module.id ? 'page' : undefined}
                  onClick={() => {
                    setSettingsOpen(false)
                    setDetailExpanded(false)
                    if (module.id === 'diary' || module.id === 'tags')
                      void navigation.openModule(module.id)
                  }}
                  disabled={navigating}
                >
                  <Icon aria-hidden="true" />
                  {module.label}
                </Button>
              )
            })}
          </nav>
          <div className="sidebar-footer">
            <Button
              variant="ghost"
              className="settings-button"
              aria-current={settingsOpen ? 'page' : undefined}
              onClick={() => {
                setSettingsOpen(true)
                setDetailExpanded(false)
              }}
            >
              <Settings2 aria-hidden="true" />
              设置
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-toggle"
              aria-label={sidebarCollapsed ? '固定展开侧栏' : '收起侧栏'}
              onClick={toggleSidebar}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen aria-hidden="true" />
              ) : (
                <PanelLeftClose aria-hidden="true" />
              )}
            </Button>
          </div>
          {!sidebarCollapsed && (
            <div
              className="sidebar-resize-handle"
              role="separator"
              aria-label="调整侧栏宽度"
              aria-orientation="vertical"
              aria-valuenow={visibleSidebarWidth}
              tabIndex={0}
              onPointerDown={startResize}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                const width = Math.round(
                  Math.max(
                    172,
                    Math.min(
                      (sidebarWidth ?? window.innerWidth * 0.25) +
                        (event.key === 'ArrowRight' ? 16 : -16),
                      window.innerWidth / 3,
                    ),
                  ),
                )
                setSidebarWidth(width)
                saveSidebar(width, false)
              }}
            />
          )}
        </aside>
        <main className="workspace">
          <header className="workspace-header">
            <div className="workspace-navigation">
              <Button
                variant="ghost"
                size="sm"
                aria-label="返回上一页面"
                onClick={() => {
                  if (settingsOpen) setSettingsOpen(false)
                  else void navigation.back()
                }}
                disabled={(!settingsOpen && !navigation.canGoBack) || navigating}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="返回下一页面"
                onClick={() => void navigation.forward()}
                disabled={settingsOpen || !navigation.canGoForward || navigating}
              >
                <ArrowRight aria-hidden="true" />
              </Button>
              <span>{settingsOpen ? '设置' : activeModule.label}</span>
            </div>
            <div className="workspace-actions">
              {root && (
                <span className="workspace-root" title={root}>
                  {root.split(/[\\/]/).filter(Boolean).at(-1) ?? root}
                </span>
              )}
            </div>
          </header>
          {(navigation.notice ||
            boundaryNotice ||
            workspaceIssue ||
            sidebarError ||
            sessionSnapshot.error?.message) && (
            <p role="alert" className="app-error-toast">
              {navigation.notice ||
                boundaryNotice ||
                workspaceIssue ||
                sidebarError ||
                sessionSnapshot.error?.message}
            </p>
          )}
          {settingsOpen && (
            <SettingsPanel
              root={root}
              choosingRoot={!!choosingRoot}
              onChooseRoot={onChooseRoot}
              theme={theme}
              onSaveTheme={onSaveTheme}
              accentColor={accentColor}
              onSaveAccentColor={onSaveAccentColor}
              appearance={appearance}
              onSaveAppearance={onSaveAppearance}
              onError={setSidebarError}
            />
          )}
          {registry.list().map((module) => {
            const List = module.List
            const Detail = module.Detail
            const Provider = module.Provider
            const moduleZoom = zoomByModule[module.id] ?? 100
            const contentSection = (
              <section
                className="module-content"
                aria-label={module.detailLabel}
                ref={(element) => {
                  registerContent(module.id, element)
                  if (module.id === 'diary') diaryContentElement.current = element
                }}
                onScroll={(event) => updateScroll(module.id, event.currentTarget.scrollTop)}
              >
                <Detail />
              </section>
            )
            const panels = (
              <div
                className="workspace-panels"
                hidden={settingsOpen || activeId !== module.id}
                data-list-collapsed={listCollapsed}
                data-list-resizing={resizingList}
                style={
                  {
                    '--detail-font-size': `${(16 * moduleZoom) / 100}px`,
                  } as CSSProperties
                }
              >
                <section className="module-list" aria-label={module.listLabel}>
                  <List />
                </section>
                <div
                  className="list-splitter"
                  role="separator"
                  aria-label="调整列表宽度"
                  aria-orientation="vertical"
                  aria-valuenow={visibleListWidth}
                  tabIndex={0}
                  onPointerDown={startListResize}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                    event.preventDefault()
                    setListWidth(
                      Math.max(
                        MIN_LIST_WIDTH,
                        Math.min(
                          maxListWidth,
                          visibleListWidth + (event.key === 'ArrowRight' ? 16 : -16),
                        ),
                      ),
                    )
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="list-collapse"
                  aria-label={listCollapsed ? '展开列表' : '收起列表'}
                  onClick={() => setListCollapsed(!listCollapsed)}
                >
                  {listCollapsed ? (
                    <PanelLeftOpen aria-hidden="true" />
                  ) : (
                    <PanelLeftClose aria-hidden="true" />
                  )}
                </Button>
                {module.id === 'diary' ? (
                  <div className="diary-track-viewport">
                    <div className="adjacent-diary-track" ref={trackElement}>
                      {contentSection}
                      {adjacentPreview && activeId === 'diary' && (
                        <div
                          ref={previewElement}
                          className="adjacent-diary-preview"
                          data-direction={adjacentPreview.direction}
                          aria-hidden="true"
                        >
                          <div className="adjacent-preview-paper">
                            <Markdown
                              components={{
                                img: () => null,
                                a: ({ children }) => <span>{children}</span>,
                              }}
                            >
                              {adjacentPreview.markdown}
                            </Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  contentSection
                )}
                {showViewControls && activeId === module.id && (
                  <ViewControls
                    zoom={moduleZoom}
                    expanded={detailExpanded}
                    onZoomChange={(value) => setZoomClamped(module.id, value)}
                    onToggleExpanded={() => setDetailExpanded((value) => !value)}
                  />
                )}
              </div>
            )
            return Provider ? (
              <Provider key={module.id}>{panels}</Provider>
            ) : (
              <Fragment key={module.id}>{panels}</Fragment>
            )
          })}
        </main>
      </div>
    </NavigationContext.Provider>
  )
}
