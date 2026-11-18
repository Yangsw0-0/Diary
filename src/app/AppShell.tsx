import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ArrowLeft, ArrowRight, PanelLeftClose, PanelLeftOpen, Settings2 } from 'lucide-react'
import type { DiarySession } from '@/application/DiarySession'
import { NavigationContext } from './NavigationContext'
import { useAppNavigation } from './useAppNavigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ModuleCatalog } from './moduleRegistry'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { ViewControls } from './ViewControls'
import { AdjacentDiaryNavigator } from '@/application/AdjacentDiaryNavigator'
import Markdown from 'react-markdown'

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
    progress: number
    date: string
    markdown: string
  } | null>(null)
  const [adjacentBusy, setAdjacentBusy] = useState(false)
  const gestureReset = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (gestureReset.current) clearTimeout(gestureReset.current)
    },
    [],
  )
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
  const { navigation, navigating, registerContent, updateScroll } = useAppNavigation(session)
  const activeId = navigation.view.moduleId
  const activeModule = registry.require(activeId)
  const showViewControls =
    !settingsOpen && (activeId === 'tags' || (activeId === 'diary' && !!sessionSnapshot.selected))
  const onAdjacentWheel = (element: HTMLElement, deltaY: number, deltaMode: number) => {
    if (adjacentBusy || sessionSnapshot.opening || activeId !== 'diary') return
    const selected = sessionSnapshot.selected
    if (!selected) return
    const index = sessionSnapshot.entries.findIndex((entry) => entry.date.equals(selected.date))
    if (index < 0) return
    const atTop = element.scrollTop <= 2
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 3
    const gesture = adjacentGesture.current.add(deltaY, deltaMode, atTop, atBottom, Date.now())
    if (gestureReset.current) clearTimeout(gestureReset.current)
    if (!gesture) {
      setAdjacentPreview(null)
      return
    }
    const target = sessionSnapshot.entries[index + (gesture.direction === 'older' ? 1 : -1)]
    if (!target) {
      adjacentGesture.current.reset()
      setAdjacentPreview(null)
      return
    }
    setAdjacentPreview({
      direction: gesture.direction,
      progress: gesture.progress,
      date: target.date.toString(),
      markdown: target.markdown,
    })
    if (gesture.ready) {
      adjacentGesture.current.reset()
      setAdjacentBusy(true)
      void navigation.openDiary(target.date).finally(() => {
        setAdjacentBusy(false)
        setAdjacentPreview(null)
      })
    } else {
      gestureReset.current = setTimeout(() => {
        adjacentGesture.current.reset()
        setAdjacentPreview(null)
      }, 700)
    }
  }
  const setZoomClamped = (moduleId: string, value: number) =>
    setZoomByModule((current) => ({
      ...current,
      [moduleId]: Math.max(50, Math.min(150, value)),
    }))
  const startListResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
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
                onClick={() => void navigation.back()}
                disabled={!navigation.canGoBack || navigating}
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="返回下一页面"
                onClick={() => void navigation.forward()}
                disabled={!navigation.canGoForward || navigating}
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
            workspaceIssue ||
            sidebarError ||
            sessionSnapshot.error?.message) && (
            <p role="alert" className="app-error-toast">
              {navigation.notice ||
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
              onError={setSidebarError}
            />
          )}
          {registry.list().map((module) => {
            const List = module.List
            const Detail = module.Detail
            const Provider = module.Provider
            const moduleZoom = zoomByModule[module.id] ?? 100
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
                <section
                  className="module-content"
                  aria-label={module.detailLabel}
                  ref={(element) => registerContent(module.id, element)}
                  onScroll={(event) => updateScroll(module.id, event.currentTarget.scrollTop)}
                  onWheel={(event) => {
                    if (module.id === 'diary' && !event.ctrlKey && !event.metaKey)
                      onAdjacentWheel(event.currentTarget, event.deltaY, event.deltaMode)
                  }}
                >
                  <Detail />
                </section>
                {module.id === 'diary' && adjacentPreview && activeId === 'diary' && (
                  <div
                    className="adjacent-diary-preview"
                    data-direction={adjacentPreview.direction}
                    style={{ '--gesture-progress': adjacentPreview.progress } as CSSProperties}
                    aria-hidden="true"
                  >
                    <div className="adjacent-preview-paper">
                      <strong>{adjacentPreview.date}</strong>
                      <Markdown
                        components={{
                          img: () => null,
                          a: ({ children }) => <span>{children}</span>,
                        }}
                      >
                        {adjacentPreview.markdown.slice(0, 700)}
                      </Markdown>
                    </div>
                    <span className="adjacent-preview-hint">
                      {adjacentPreview.progress >= 1 ? '正在切换…' : '继续滚动以切换日记'}
                    </span>
                  </div>
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
