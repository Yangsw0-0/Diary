import { Fragment, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ModuleCatalog } from './moduleRegistry'

interface AppShellProps {
  readonly registry: ModuleCatalog
  readonly root?: string
  readonly onChooseRoot?: () => void
  readonly choosingRoot?: boolean
  readonly workspaceIssue?: string | null
}

export function AppShell({
  registry,
  root,
  onChooseRoot,
  choosingRoot,
  workspaceIssue,
}: AppShellProps) {
  const [activeId, setActiveId] = useState(registry.defaultId)
  const activeModule = registry.require(activeId)

  return (
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
                onClick={() => setActiveId(module.id)}
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
          <span>{activeModule.label}</span>
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
              <section className="module-content" aria-label={module.detailLabel}>
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
  )
}
