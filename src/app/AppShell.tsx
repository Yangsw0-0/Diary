import type { NodePalette } from '@/application/NodePalette'
import type { NodesSession } from '@/application/NodesSession'
import {
  Fragment,
  useEffect,
  useMemo,
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
import { SidebarStatistics } from '@/features/diary/SidebarStatistics'
import { DiaryStatistics } from '@/application/DiaryStatistics'
import { ViewControls } from './ViewControls'
import { useAdjacentDiaryNavigation } from './useAdjacentDiaryNavigation'
import Markdown from 'react-markdown'
import type { AppearanceValues } from '@/application/AppearancePreferences'

const MIN_LIST_WIDTH = 168
const MAX_LIST_WIDTH = 420
const MIN_DETAIL_WIDTH = 300

interface AppShellProps {
  readonly nodePalette?: NodePalette
  readonly nodes?: NodesSession
  readonly statistics?: DiaryStatistics
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
  nodes,
  nodePalette,
  statistics: sharedStatistics,
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
  const { navigation, navigating, registerContent, updateScroll, waitForDiaryReady } =
    useAppNavigation(session, nodes)
  const { adjacentPreview, boundaryNotice, trackElement, previewElement, diaryContentElement } =
    useAdjacentDiaryNavigation({
      sessionSnapshot,
      navigation,
      settingsOpen,
      waitForDiaryReady,
      onError: setSidebarError,
    })
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
  const [fallbackStatistics] = useState(() => new DiaryStatistics())
  const statisticsService = sharedStatistics ?? fallbackStatistics
  const statistics = useMemo(
    () => statisticsService.calculate(sessionSnapshot.entries),
    [statisticsService, sessionSnapshot.entries],
  )
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
  const activeId = navigation.view.moduleId
  const activeModule = registry.require(activeId)
  const showViewControls =
    !settingsOpen && (activeId === 'tags' || (activeId === 'diary' && !!sessionSnapshot.selected))
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
                    if (module.id === 'diary' || module.id === 'tags' || module.id === 'nodes')
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
          <SidebarStatistics
            statistics={statistics}
            loading={sessionSnapshot.loading}
            unavailable={!!sessionSnapshot.error && sessionSnapshot.entries.length === 0}
            failedFiles={sessionSnapshot.failures.length}
          />
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
              nodePalette={nodePalette}
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
            if (module.layout === 'canvas') {
              const Detail = module.Detail
              return (
                <div
                  key={module.id}
                  className="workspace-canvas"
                  hidden={settingsOpen || activeId !== module.id}
                >
                  <Detail />
                </div>
              )
            }
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
