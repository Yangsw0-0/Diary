/** User choices override the default (shown when a tag occurs on at least two days). */
export class TagVisibility {
  private readonly overrides: Record<string, boolean>
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  private readonly storageKey: string

  constructor(
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    storageKey = 'diary.tagVisibility.v1',
  ) {
    this.storage = storage
    this.storageKey = storageKey
    try {
      const saved: unknown = JSON.parse(storage.getItem(storageKey) ?? '{}')
      this.overrides =
        saved && typeof saved === 'object' && !Array.isArray(saved)
          ? Object.fromEntries(
              Object.entries(saved).filter(([, value]) => typeof value === 'boolean'),
            )
          : {}
    } catch {
      this.overrides = {}
    }
  }

  isShown(key: string, dayCount: number): boolean {
    return this.overrides[key] ?? dayCount >= 2
  }

  setShown(key: string, shown: boolean): void {
    this.overrides[key] = shown
    this.storage.setItem(this.storageKey, JSON.stringify(this.overrides))
  }
}
