export class ThemePalette {
  static readonly presets = {
    green: '#8fae94',
    pink: '#e9a9bb',
    blue: '#a7c9ea',
  } as const

  static readonly storageKey = 'diary.accentColor.v1'

  static normalize(value: string): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error('主题色必须是六位十六进制颜色')
    return value.toLowerCase()
  }

  static load(storage: Pick<Storage, 'getItem'>): string {
    try {
      return this.normalize(storage.getItem(this.storageKey) ?? this.presets.green)
    } catch {
      return this.presets.green
    }
  }

  static save(storage: Pick<Storage, 'setItem'>, value: string): string {
    const normalized = this.normalize(value)
    storage.setItem(this.storageKey, normalized)
    return normalized
  }
}
