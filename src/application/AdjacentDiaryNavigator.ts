export type AdjacentDirection = 'older' | 'newer'

/** Tracks one boundary pull and locks the remainder of its wheel momentum. */
export class AdjacentDiaryNavigator {
  private direction: AdjacentDirection | null = null
  private amount = 0
  private threshold = 220
  private locked = false
  private normalScrolling = false
  private lastWheelTime = 0

  get isLocked(): boolean {
    return this.locked
  }

  reset(): void {
    this.direction = null
    this.amount = 0
  }

  unlock(): void {
    this.locked = false
    this.normalScrolling = false
  }

  add(
    deltaY: number,
    deltaMode: number,
    atTop: boolean,
    atBottom: boolean,
    viewportHeight = 800,
    now = Date.now(),
  ): { direction: AdjacentDirection; progress: number; ready: boolean } | null {
    if (this.locked || !Number.isFinite(deltaY)) return null
    if (now - this.lastWheelTime > 180) this.normalScrolling = false
    this.lastWheelTime = now
    const direction = deltaY > 0 && atBottom ? 'older' : deltaY < 0 && atTop ? 'newer' : null
    if (!direction) {
      this.normalScrolling = true
      this.reset()
      return null
    }
    // Momentum from ordinary in-document scrolling cannot start a page turn.
    if (this.normalScrolling) return null
    if (direction !== this.direction) this.amount = 0
    this.direction = direction
    this.threshold = Math.min(360, Math.max(200, viewportHeight * 0.28))
    const pixels = Math.abs(deltaY) * (deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1)
    // One unusually large wheel event must not jump directly to another diary.
    this.amount = Math.min(this.threshold, this.amount + Math.min(90, pixels))
    return {
      direction,
      progress: this.amount / this.threshold,
      ready: this.amount >= this.threshold,
    }
  }

  /** Called after wheel events settle; at most one page can be committed per gesture. */
  finish(): AdjacentDirection | null {
    const direction = this.amount >= this.threshold ? this.direction : null
    this.reset()
    if (direction) this.locked = true
    return direction
  }
}
