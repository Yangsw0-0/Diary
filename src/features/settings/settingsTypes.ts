import type { NodePalette } from '@/application/NodePalette'
import type { AppearanceValues } from '@/application/AppearancePreferences'
export interface SettingsPanelProps {
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

export interface SettingsContentProps extends SettingsPanelProps {
  nodePalette: NodePalette
  accentColor: string
  appearance: AppearanceValues
  nodeColors: readonly string[]
  onOpenHelp: () => void
}
