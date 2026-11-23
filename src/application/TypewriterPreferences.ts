/** Only the mode switch is persisted; caret and scroll positions remain session state. */
export class TypewriterPreferences {
  static readonly key = 'diary.typewriter.v1'
  static load(storage: Pick<Storage, 'getItem'>): boolean {
    try {
      return storage.getItem(this.key) === 'true'
    } catch {
      return false
    }
  }
  static save(storage: Pick<Storage, 'setItem'>, enabled: boolean): void {
    storage.setItem(this.key, String(enabled))
  }
}
