import { Button } from '@/components/ui/button'
import type { SettingsContentProps } from './settingsTypes'
import { Moon, Sun } from 'lucide-react'
import { ThemePalette } from '@/application/ThemePalette'
export function PersonalizationSettings({
  theme,
  onSaveTheme,
  onError,
  accentColor,
  onSaveAccentColor,
  appearance,
  onSaveAppearance,
  nodePalette,
  nodeColors,
}: SettingsContentProps) {
  return (
    <>
      <div className="settings-card">
        <div>
          <h3>外观</h3>
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
          <h3>主题色</h3>
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
          <h3>列表栏色调</h3>
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
          <h3>节点颜色</h3>
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
              try {
                nodePalette.reset()
              } catch (error) {
                onError(error instanceof Error ? error.message : '恢复节点颜色失败')
              }
            }}
          >
            恢复节点默认色
          </Button>
        </div>
      </div>
    </>
  )
}
