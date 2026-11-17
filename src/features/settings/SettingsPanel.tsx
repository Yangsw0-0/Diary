import { FolderOpen, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SettingsPanelProps {
  root: string | undefined
  choosingRoot: boolean
  onChooseRoot?: (() => void) | undefined
  theme: 'light' | 'dark'
  onSaveTheme?: ((theme: 'light' | 'dark') => Promise<void>) | undefined
  onError: (message: string) => void
}

export function SettingsPanel({
  root,
  choosingRoot,
  onChooseRoot,
  theme,
  onSaveTheme,
  onError,
}: SettingsPanelProps) {
  return (
    <section className="settings-panel" aria-label="设置">
      <p className="eyebrow">PREFERENCES</p>
      <h1>设置</h1>
      <div className="settings-card">
        <div>
          <h2>日记文件夹</h2>
          <p>日记正文与附件都保存在这个文件夹中。</p>
          <code>{root ?? '尚未选择'}</code>
        </div>
        <Button variant="outline" onClick={onChooseRoot} disabled={choosingRoot}>
          <FolderOpen aria-hidden="true" />
          {choosingRoot ? '正在选择…' : '更换文件夹'}
        </Button>
      </div>
      <div className="settings-card">
        <div>
          <h2>外观</h2>
          <p>选择适合阅读和写作的界面主题。</p>
        </div>
        <div className="settings-theme" role="group" aria-label="主题">
          {(['light', 'dark'] as const).map((value) => (
            <Button
              key={value}
              variant={theme === value ? 'default' : 'outline'}
              aria-pressed={theme === value}
              onClick={() =>
                void onSaveTheme?.(value).catch((reason: unknown) =>
                  onError(reason instanceof Error ? reason.message : '保存主题失败'),
                )
              }
            >
              {value === 'light' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              {value === 'light' ? '浅色' : '深色'}
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
