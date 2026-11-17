import { Fragment } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { DiarySession } from '@/application/DiarySession'
import { NavigationContext } from './NavigationContext'
import { useAppNavigation } from './useAppNavigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ModuleCatalog } from './moduleRegistry'

interface AppShellProps {
  readonly registry: ModuleCatalog
  readonly session: DiarySession
  readonly root?: string
  readonly onChooseRoot?: () => void
  readonly choosingRoot?: boolean
  readonly workspaceIssue?: string | null
}

export function AppShell({
  registry,
  session,
  root,
  onChooseRoot,
  choosingRoot,
  workspaceIssue,
}: AppShellProps) {
  const { navigation, navigating, registerContent, updateScroll } = useAppNavigation(session)
  const activeId = navigation.view.moduleId
  const activeModule = registry.require(activeId)

  return (
    <NavigationContext.Provider value={navigation}>
      <div className="app-shell">
        <aside className="feature-sidebar" aria-label="功能导航">
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
          <div className="sidebar-footer">本地 Markdown 日记</div>
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
              <span>{activeModule.label}</span>
            </div>
            <div className="workspace-actions">
              {root && (
                <span className="workspace-root" title={root}>
                  {root}
                </span>
              )}
              {onChooseRoot && (
                <Button variant="outline" size="sm" onClick={onChooseRoot} disabled={choosingRoot}>
                  更换文件夹
                </Button>
              )}
            </div>
          </header>
          {navigation.notice && (
            <p role="alert" className="workspace-error">
              {navigation.notice}
            </p>
          )}
          {workspaceIssue && (
            <p role="alert" className="workspace-error">
              {workspaceIssue}
            </p>
          )}
          {registry.list().map((module) => {
            const List = module.List
            const Detail = module.Detail
            const Provider = module.Provider
            const panels = (
              <div className="workspace-panels" hidden={activeId !== module.id}>
                <section className="module-list" aria-label={module.listLabel}>
                  <List />
                </section>
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
        </main>
      </div>
    </NavigationContext.Provider>
  )
}
