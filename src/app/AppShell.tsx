import {
  Fragment,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
} from 'lucide-react'
import type { DiarySession } from '@/application/DiarySession'
import { NavigationContext } from './NavigationContext'
import { useAppNavigation } from './useAppNavigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ModuleCatalog } from './moduleRegistry'
import { SettingsPanel } from '@/features/settings/SettingsPanel'

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
}: AppShellProps) {
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const [sidebarError, setSidebarError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [listWidth, setListWidth] = useState(250)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [zoom, setZoom] = useState(100)
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
    if (sidebarCollapsed) return
    event.preventDefault()
    const move = (pointer: PointerEvent) => {
      setSidebarWidth(Math.round(Math.max(172, Math.min(pointer.clientX, window.innerWidth / 3))))
    }
    const stop = (pointer: PointerEvent) => {
      const width = Math.round(Math.max(172, Math.min(pointer.clientX, window.innerWidth / 3)))
      setSidebarWidth(width)
      saveSidebar(width, false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }
  const { navigation, navigating, registerContent, updateScroll } = useAppNavigation(session)
  const activeId = navigation.view.moduleId
  const activeModule = registry.require(activeId)
  const showZoom = activeId === 'diary' && !!sessionSnapshot.selected && !settingsOpen
  const setZoomClamped = (value: number) => setZoom(Math.max(50, Math.min(150, value)))
  const startListResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const move = (pointer: PointerEvent) =>
      setListWidth(
        Math.round(
          Math.max(
            190,
            Math.min(
              420,
              pointer.clientX - (sidebarCollapsed ? 0 : (sidebarWidth ?? window.innerWidth * 0.25)),
            ),
          ),
        ),
      )
    const stop = (pointer: PointerEvent) => {
      move(pointer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return (
    <NavigationContext.Provider value={navigation}>
      <div
        className="app-shell"
        data-sidebar-collapsed={sidebarCollapsed}
        data-sidebar-peek={sidebarPeek}
        data-detail-expanded={detailExpanded && showZoom}
        style={
          {
            '--sidebar-expanded-width': sidebarWidth ? `${sidebarWidth}px` : '25vw',
            '--list-width': `${listWidth}px`,
            '--editor-zoom': `${zoom}%`,
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
            <span className="brand-mark" aria-hidden="true">
              D
            </span>
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
              aria-valuenow={sidebarWidth ?? Math.round(window.innerWidth * 0.25)}
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
                  {root}
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
              onError={setSidebarError}
            />
          )}
          {registry.list().map((module) => {
            const List = module.List
            const Detail = module.Detail
            const Provider = module.Provider
            const panels = (
              <div
                className="workspace-panels"
                hidden={settingsOpen || activeId !== module.id}
                data-list-collapsed={listCollapsed}
              >
                <section className="module-list" aria-label={module.listLabel}>
                  <List />
                </section>
                <div
                  className="list-splitter"
                  role="separator"
                  aria-label="调整列表宽度"
                  aria-orientation="vertical"
                  aria-valuenow={listWidth}
                  tabIndex={0}
                  onPointerDown={startListResize}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                    event.preventDefault()
                    setListWidth((width) =>
                      Math.max(190, Math.min(420, width + (event.key === 'ArrowRight' ? 16 : -16))),
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
                >
                  <Detail />
                </section>
              </div>
            )
            return Provider ? (
              <Provider key={module.id}>{panels}</Provider>
            ) : (
              <Fragment key={module.id}>{panels}</Fragment>
            )
          })}
          {showZoom && (
            <div className="editor-view-controls" aria-label="正文视图控制">
              <button type="button" onClick={() => setZoomClamped(zoom - 10)} aria-label="缩小正文">
                <Minus aria-hidden="true" />
              </button>
              <output>{zoom}%</output>
              <input
                type="range"
                min="50"
                max="150"
                step="5"
                value={zoom}
                aria-label="正文缩放"
                onChange={(event) => setZoomClamped(Number(event.target.value))}
              />
              <button type="button" onClick={() => setZoomClamped(zoom + 10)} aria-label="放大正文">
                <Plus aria-hidden="true" />
              </button>
              <button
                type="button"
                className="view-expand"
                onClick={() => setDetailExpanded(!detailExpanded)}
                aria-label={detailExpanded ? '退出展开正文' : '展开正文'}
              >
                {detailExpanded ? (
                  <Minimize2 aria-hidden="true" />
                ) : (
                  <Maximize2 aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </main>
      </div>
    </NavigationContext.Provider>
  )
}
