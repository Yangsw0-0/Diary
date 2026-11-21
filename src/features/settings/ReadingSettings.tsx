import { Button } from '@/components/ui/button'
import type { SettingsContentProps } from './settingsTypes'
export function ReadingSettings({ appearance, onSaveAppearance }: SettingsContentProps) {
  return (
    <>
      <div className="settings-card">
        <div>
          <h3>正文排版</h3>
          <p>调整日记正文的行间距和字间距，编辑与相邻日记预览保持一致。</p>
        </div>
        <div className="settings-typography">
          <label>
            行间距{' '}
            <input
              type="range"
              aria-label="行间距"
              aria-valuetext={`${appearance.lineHeight.toFixed(1)} 倍`}
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
              aria-label="字间距"
              aria-valuetext={`${appearance.letterSpacing.toFixed(1)} 像素`}
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
    </>
  )
}
