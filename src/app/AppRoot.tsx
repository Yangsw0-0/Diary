import { useCallback, useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceStatus } from '@/application/WorkspaceService'
import type { ModuleCatalog } from './moduleRegistry'
import type { AppServices } from './services'
import { AppShell } from './AppShell'

interface AppRootProps {
  readonly registry: ModuleCatalog
  readonly services: AppServices
}

export function AppRoot({ registry, services }: AppRootProps) {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const chooseRoot = useCallback(async () => {
    setChoosing(true)
    setError(null)
    try {
      const next = await services.workspace.chooseRoot()
      if (next) setStatus(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '选择文件夹失败')
    } finally {
      setChoosing(false)
    }
  }, [services.workspace])

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
    <AppShell
      key={status.root}
      registry={registry}
      root={status.root}
      onChooseRoot={() => void chooseRoot()}
      choosingRoot={choosing}
      workspaceIssue={error}
    />
  )
}
