import { useCallback, useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceStatus } from '@/application/WorkspaceService'
import type { ModuleCatalog } from './moduleRegistry'
import type { AppServices } from './services'
import { AppShell } from './AppShell'
import { ThemePalette } from '@/application/ThemePalette'
import { AppearancePreferences } from '@/application/AppearancePreferences'

interface AppRootProps {
  readonly registry: ModuleCatalog
  readonly services: AppServices
}

export function AppRoot({ registry, services }: AppRootProps) {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closePrompt, setClosePrompt] = useState(false)
  const [accentColor, setAccentColor] = useState(() => ThemePalette.load(window.localStorage))
  const [appearance, setAppearance] = useState(() =>
    AppearancePreferences.load(window.localStorage),
  )
  const theme = status?.theme ?? 'light'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--diary-theme-color', accentColor)
  }, [accentColor])

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--diary-list-color', appearance.listColor)
    root.setProperty('--diary-text-line-height', String(appearance.lineHeight))
    root.setProperty('--diary-text-letter-spacing', `${appearance.letterSpacing}px`)
  }, [appearance])

  useEffect(() => {
    let current = true
    services.workspace
      .getStatus()
      .then(
        (next) => {
          if (current) setStatus(next)
        },
        (reason: unknown) => {
          if (current) setError(reason instanceof Error ? reason.message : '无法读取日记文件夹设置')
        },
      )
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [services.workspace])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (
        services.session.isDirty() ||
        services.nodes.getSnapshot().dirty ||
        services.wordCloud.getSnapshot().dirty
      ) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    let disposed = false
    let unlisten: (() => void) | undefined
    if (isTauri()) {
      void getCurrentWindow()
        .onCloseRequested((event) => {
          if (
            !services.session.isDirty() &&
            !services.nodes.getSnapshot().dirty &&
            !services.wordCloud.getSnapshot().dirty
          )
            return
          event.preventDefault()
          void services.session.prepareWorkspaceSwitch().then(async (saved) => {
            if (
              saved &&
              (await services.nodes.flush()) &&
              (await services.wordCloud.flush()) &&
              !disposed
            )
              void getCurrentWindow().destroy()
            else if (!disposed) {
              services.session.finishWorkspaceSwitch()
              setError(
                services.session.getSnapshot().selected?.error?.message ??
                  services.nodes.getSnapshot().error ??
                  services.wordCloud.getSnapshot().error ??
                  '请先完成输入并保存日记',
              )
              setClosePrompt(true)
            }
          })
        })
        .then((stop) => {
          if (disposed) stop()
          else unlisten = stop
        })
    }
    return () => {
      disposed = true
      window.removeEventListener('beforeunload', beforeUnload)
      unlisten?.()
    }
  }, [services.session, services.nodes, services.wordCloud])

  useEffect(() => {
    const check = () => {
      void services.wordCloud.checkExternalChange()
      void services.nodes.checkExternalChange()
      void services.session.checkExternalChange()
    }
    const blur = () => {
      void services.wordCloud.flush()
      void services.nodes.flush()
    }
    window.addEventListener('blur', blur)
    window.addEventListener('focus', check)
    return () => {
      window.removeEventListener('focus', check)
      window.removeEventListener('blur', blur)
    }
  }, [services.session, services.nodes, services.wordCloud])

  const chooseRoot = useCallback(async () => {
    setChoosing(true)
    setError(null)
    try {
      if (!(await services.session.prepareWorkspaceSwitch())) {
        setError(
          services.session.getSnapshot().selected?.error?.message ?? '请先完成当前输入并保存日记',
        )
        return
      }
      if (!(await services.nodes.flush())) {
        setError(services.nodes.getSnapshot().error ?? '节点尚未保存')
        return
      }
      if (!(await services.wordCloud.flush())) {
        setError(services.wordCloud.getSnapshot().error ?? '词云尚未保存')
        return
      }
      const next = await services.workspace.chooseRoot()
      if (next && next.root !== status?.root) {
        services.wordCloud.reset()
        services.nodes.reset()
        void services.session.resetAndLoad()
        setStatus(next)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '选择文件夹失败')
    } finally {
      services.session.finishWorkspaceSwitch()
      setChoosing(false)
    }
  }, [services.workspace, services.session, services.nodes, services.wordCloud, status?.root])

  if (loading) return <main className="workspace-onboarding">正在检查日记文件夹…</main>

  if (!status?.root) {
    return (
      <main className="workspace-onboarding">
        <div className="onboarding-card">
          <FolderOpen aria-hidden="true" />
          <p className="eyebrow">WELCOME TO DIARY</p>
          <h1>选择你的日记文件夹</h1>
          <p>请选择一个已有文件夹。日记会按年份保存在其中；取消后可以稍后再选。</p>
          {status?.configuredRoot && (
            <p className="onboarding-path">上次选择：{status.configuredRoot}</p>
          )}
          {(error || status?.issue) && (
            <p role="alert" className="workspace-error">
              {error || status?.issue}
            </p>
          )}
          <Button onClick={() => void chooseRoot()} disabled={choosing}>
            {choosing ? '正在选择…' : '选择文件夹'}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <>
      <AppShell
        wordCloud={services.wordCloud}
        nodePalette={services.nodePalette}
        nodes={services.nodes}
        statistics={services.statistics}
        key={status.root}
        registry={registry}
        session={services.session}
        root={status.root}
        onChooseRoot={() => void chooseRoot()}
        choosingRoot={choosing}
        workspaceIssue={error}
        initialSidebarWidth={status.sidebarWidth ?? null}
        initialSidebarCollapsed={status.sidebarCollapsed ?? false}
        onSavePreferences={(width, collapsed) =>
          services.workspace.savePreferences(width, collapsed)
        }
        theme={theme}
        accentColor={accentColor}
        onSaveAccentColor={(value) => setAccentColor(ThemePalette.save(window.localStorage, value))}
        appearance={appearance}
        onSaveAppearance={(value) =>
          setAppearance(
            AppearancePreferences.save(window.localStorage, { ...appearance, ...value }),
          )
        }
        onSaveTheme={async (next) => {
          await services.workspace.saveTheme(next)
          setStatus((current) => (current ? { ...current, theme: next } : current))
        }}
      />
      {closePrompt && (
        <div className="diary-close-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="未保存的日记"
            className="diary-close-dialog"
          >
            <h2>日记、节点或词云尚未保存</h2>
            <p>
              {services.session.getSnapshot().selected?.error?.message ??
                services.nodes.getSnapshot().error ??
                services.wordCloud.getSnapshot().error ??
                '当前草稿无法保存。'}
            </p>
            <p>可以继续编辑并重试，或明确放弃草稿后关闭应用。</p>
            <div>
              <Button variant="outline" onClick={() => setClosePrompt(false)}>
                继续编辑
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  services.wordCloud.reset()
                  services.nodes.reset()
                  void services.session.discardDraft().then(() => void getCurrentWindow().destroy())
                }}
              >
                放弃草稿并关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
