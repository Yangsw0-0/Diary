import { ThemePalette } from './ThemePalette'

export interface AppearanceValues {
  readonly listColor: string
  readonly lineHeight: number
  readonly letterSpacing: number
}

/** Validates and persists visual choices without coupling them to workspace files. */
export class AppearancePreferences {
  static readonly storageKey = 'diary.appearance.v1'
  static readonly defaults: AppearanceValues = {
    listColor: ThemePalette.presets.green,
    lineHeight: 1.7,
    letterSpacing: 0,
  }

  static normalize(value: Partial<AppearanceValues>): AppearanceValues {
    const lineHeight = Number(value.lineHeight)
    const letterSpacing = Number(value.letterSpacing)
    return {
      listColor: ThemePalette.normalize(value.listColor ?? this.defaults.listColor),
      lineHeight: Number.isFinite(lineHeight)
        ? Math.max(1.2, Math.min(2.4, lineHeight))
        : this.defaults.lineHeight,
      letterSpacing: Number.isFinite(letterSpacing)
        ? Math.max(-0.5, Math.min(3, letterSpacing))
        : this.defaults.letterSpacing,
    }
  }

  static load(storage: Pick<Storage, 'getItem'>): AppearanceValues {
    try {
      return this.normalize(
        JSON.parse(storage.getItem(this.storageKey) ?? '{}') as AppearanceValues,
      )
    } catch {
      return this.defaults
    }
  }

  static save(
    storage: Pick<Storage, 'setItem'>,
    value: Partial<AppearanceValues>,
  ): AppearanceValues {
    const normalized = this.normalize(value)
    storage.setItem(this.storageKey, JSON.stringify(normalized))
    return normalized
  }
}
