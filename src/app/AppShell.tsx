import { useMemo, useState } from 'react'
import { BookOpenText, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { DiaryModule } from '@/features/diary/DiaryModule'
import { TagsModule } from '@/features/tags/TagsModule'
import { ModuleRegistry } from './moduleRegistry'
import { createServices } from './services'

const registry = new ModuleRegistry()
registry.register({ id: 'diary', label: '日记', Icon: BookOpenText, View: DiaryModule })
registry.register({ id: 'tags', label: '标签', Icon: Tags, View: TagsModule })

export function AppShell() {
  const [activeId, setActiveId] = useState('diary')
  const services = useMemo(() => createServices(), [])
  const activeModule = registry.get(activeId) ?? registry.list()[0]
  const ActiveView = activeModule.View

  return (
    <div className="app-shell">
      <aside className="feature-sidebar" aria-label="功能导航">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">D</span>
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
          <span className="workspace-status">离线使用 · 文件保存在本地</span>
        </header>
        <div className="workspace-panels">
          <ActiveView services={services} />
        </div>
      </main>
    </div>
  )
}
