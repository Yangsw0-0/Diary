import { NodePalette } from '@/application/NodePalette'
import { useState, useSyncExternalStore } from 'react'
import { BookOpenText, FolderOpen, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemePalette } from '@/application/ThemePalette'
import { AppearancePreferences, type AppearanceValues } from '@/application/AppearancePreferences'
import { HelpDialog } from '@/features/help/HelpDialog'

interface SettingsPanelProps {
  nodePalette?: NodePalette | undefined
  root: string | undefined
  choosingRoot: boolean
  onChooseRoot?: (() => void) | undefined
  theme: 'light' | 'dark'
  onSaveTheme?: ((theme: 'light' | 'dark') => Promise<void>) | undefined
  onError: (message: string) => void
  accentColor?: string | undefined
  onSaveAccentColor?: ((value: string) => void) | undefined
  appearance?: AppearanceValues | undefined
  onSaveAppearance?: ((value: Partial<AppearanceValues>) => void) | undefined
}

export function SettingsPanel({
  nodePalette: sharedNodePalette,
  root,
  choosingRoot,
  onChooseRoot,
  theme,
  onSaveTheme,
  onError,
  accentColor = ThemePalette.presets.green,
  onSaveAccentColor,
  appearance = AppearancePreferences.defaults,
  onSaveAppearance,
}: SettingsPanelProps) {
  const [fallbackPalette] = useState(() => new NodePalette(window.localStorage))
  const nodePalette = sharedNodePalette ?? fallbackPalette
  const nodeColors = useSyncExternalStore(nodePalette.subscribe, nodePalette.getSnapshot)
  const [helpOpen, setHelpOpen] = useState(false)
  return (
    <section className="settings-panel" aria-label="设置">
      <p className="eyebrow">PREFERENCES</p>
      <h1>设置</h1>
      <div className="settings-card">
        <div>
          <h2>节点颜色</h2>
          <p>修改后所有使用该颜色的事件和时间轴同步更新。</p>
        </div>
        <div className="settings-colors">
          {nodeColors.map((color, index) => (
            <label key={index}>
              颜色 {index + 1}
              <input
                type="color"
                aria-label={`节点颜色 ${index + 1}`}
                value={color}
                onChange={(e) => {
                  try {
                    nodePalette.setColor(index, e.target.value)
                  } catch (error) {
                    onError(String(error))
                  }
                }}
              />
            </label>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              nodePalette.reset()
            }}
          >
            恢复节点默认色
          </Button>
        </div>
      </div>
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
          <h2>主题色</h2>
          <p>选择绿色、浅粉、浅蓝，或从调色盘自选颜色。</p>
        </div>
        <div className="settings-colors" role="group" aria-label="主题色">
          {Object.entries(ThemePalette.presets).map(([name, color]) => (
            <button
              key={name}
              type="button"
              className="settings-color-swatch"
              style={{ backgroundColor: color }}
              aria-label={{ green: '绿色', pink: '浅粉色', blue: '浅蓝色' }[name]}
              aria-pressed={accentColor === color}
              onClick={() => onSaveAccentColor?.(color)}
            />
          ))}
          <label className="settings-color-custom">
            自选{' '}
            <input
              type="color"
              aria-label="自选主题色"
              value={accentColor}
              onChange={(event) => {
                try {
                  onSaveAccentColor?.(event.target.value)
                } catch (reason) {
                  onError(reason instanceof Error ? reason.message : '主题色无效')
                }
              }}
            />
          </label>
        </div>
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
      <div className="settings-card">
        <div>
          <h2>列表栏色调</h2>
          <p>单独调整中间日记与标签列表的底色；深色模式会自动降低亮度。</p>
        </div>
        <div className="settings-colors" role="group" aria-label="列表栏色调">
          {Object.entries(ThemePalette.presets).map(([name, color]) => (
            <button
              key={name}
              type="button"
              className="settings-color-swatch"
              style={{ backgroundColor: color }}
              aria-label={{ green: '绿色列表', pink: '粉色列表', blue: '蓝色列表' }[name]}
              aria-pressed={appearance.listColor === color}
              onClick={() => onSaveAppearance?.({ listColor: color })}
            />
          ))}
          <label className="settings-color-custom">
            自选{' '}
            <input
              type="color"
              aria-label="自选列表栏色调"
              value={appearance.listColor}
              onChange={(event) => onSaveAppearance?.({ listColor: event.target.value })}
            />
          </label>
        </div>
      </div>
      <div className="settings-card">
        <div>
          <h2>正文排版</h2>
          <p>调整日记正文的行间距和字间距，编辑与相邻日记预览保持一致。</p>
        </div>
        <div className="settings-typography">
          <label>
            行间距{' '}
            <input
              type="range"
              min="1.2"
              max="2.4"
              step="0.1"
              value={appearance.lineHeight}
              onChange={(event) => onSaveAppearance?.({ lineHeight: Number(event.target.value) })}
            />
            <output>{appearance.lineHeight.toFixed(1)}</output>
          </label>
          <label>
            字间距{' '}
            <input
              type="range"
              min="-0.5"
              max="3"
              step="0.1"
              value={appearance.letterSpacing}
              onChange={(event) =>
                onSaveAppearance?.({ letterSpacing: Number(event.target.value) })
              }
            />
            <output>{appearance.letterSpacing.toFixed(1)}px</output>
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSaveAppearance?.({ lineHeight: 1.7, letterSpacing: 0 })}
          >
            重置排版
          </Button>
        </div>
      </div>
      <div className="settings-card">
        <div>
          <h2>帮助</h2>
          <p>查看写作、标签、附件、备份和更新等使用说明。</p>
        </div>
        <Button variant="outline" onClick={() => setHelpOpen(true)}>
          <BookOpenText aria-hidden="true" />
          打开使用说明
        </Button>
      </div>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </section>
  )
}
